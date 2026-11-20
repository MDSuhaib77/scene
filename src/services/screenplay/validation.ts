/**
 * SceneOS — Screenplay File Validator & Format Detector
 * Inspects uploaded files for size, extension, content headers (magic bytes), and duplicate state.
 */

import { ScreenplayFormat, ScreenplayValidationResult } from './types';
import { ScreenplayVersion } from '../../types';

export const SUPPORTED_EXTENSIONS = ['.fdx', '.fountain', '.spmd', '.txt', '.pdf', '.docx', '.rtf'];
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function detectFormatFromFilename(filename: string): ScreenplayFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.fdx')) return 'fdx';
  if (lower.endsWith('.fountain') || lower.endsWith('.spmd')) return 'fountain';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.rtf')) return 'rtf';
  if (lower.endsWith('.txt')) return 'txt';
  return 'unknown';
}

/**
 * Fast synchronous check on filename and size
 */
export function validateScreenplayFile(file: File): ScreenplayValidationResult {
  const fileSizeMB = Math.round((file.size / (1024 * 1024)) * 100) / 100;

  // 1. Size check
  if (file.size === 0) {
    return {
      isValid: false,
      format: 'unknown',
      error: 'The uploaded file is empty (0 bytes).',
      fileSizeMB,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      format: 'unknown',
      error: `File size (${fileSizeMB} MB) exceeds the maximum allowed limit of 25 MB.`,
      fileSizeMB,
    };
  }

  // 2. Extension check
  const format = detectFormatFromFilename(file.name);
  if (format === 'unknown') {
    return {
      isValid: false,
      format: 'unknown',
      error: `Unsupported file format. Please upload one of: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      fileSizeMB,
    };
  }

  return {
    isValid: true,
    format,
    fileSizeMB,
  };
}

/**
 * Content-aware inspection of the first chunk of file bytes to verify format signatures
 * and prevent misleading extension bypass (e.g. executable renamed to .fdx).
 */
export async function validateScreenplayFileIntegrity(
  file: File,
  buffer?: ArrayBuffer
): Promise<ScreenplayValidationResult> {
  const basic = validateScreenplayFile(file);
  if (!basic.isValid) return basic;

  // Read leading 4KB for header signature inspection
  let headerBytes: Uint8Array;
  if (buffer) {
    headerBytes = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 4096)));
  } else if (typeof file.slice === 'function') {
    const chunk = await file.slice(0, 4096).arrayBuffer();
    headerBytes = new Uint8Array(chunk);
  } else {
    const fullBuf = await file.arrayBuffer();
    headerBytes = new Uint8Array(fullBuf.slice(0, Math.min(fullBuf.byteLength, 4096)));
  }

  // Reject Windows PE executable signature ("MZ" / 0x4D 0x5A)
  if (headerBytes.length >= 2 && headerBytes[0] === 0x4D && headerBytes[1] === 0x5A) {
    return {
      isValid: false,
      format: 'unknown',
      error: `File '${file.name}' is an executable binary, not a valid screenplay document.`,
      fileSizeMB: basic.fileSizeMB,
    };
  }

  const decoderLatin = new TextDecoder('latin1');
  const latinHeader = decoderLatin.decode(headerBytes);
  const detectedFormat = basic.format;

  switch (detectedFormat) {
    case 'pdf': {
      // Must start with %PDF- (standard allows up to 1024 bytes header search for binary preamble)
      const isPdfHeader = latinHeader.slice(0, 1024).includes('%PDF-');
      if (!isPdfHeader) {
        return {
          isValid: false,
          format: 'pdf',
          error: `File '${file.name}' has a .pdf extension but does not contain a valid PDF signature (%PDF-).`,
          fileSizeMB: basic.fileSizeMB,
        };
      }
      break;
    }

    case 'docx': {
      // DOCX is a ZIP container: must start with PK\x03\x04 (or PK\x05\x06 / PK\x07\x08)
      const isZip = headerBytes.length >= 4 &&
        headerBytes[0] === 0x50 && headerBytes[1] === 0x4B &&
        (headerBytes[2] === 0x03 || headerBytes[2] === 0x05 || headerBytes[2] === 0x07);

      if (!isZip) {
        return {
          isValid: false,
          format: 'docx',
          error: `File '${file.name}' is not a valid OpenXML Word document (.docx package).`,
          fileSizeMB: basic.fileSizeMB,
        };
      }
      break;
    }

    case 'rtf': {
      // RTF must start with {\rtf
      if (!latinHeader.trimStart().startsWith('{\\rtf')) {
        return {
          isValid: false,
          format: 'rtf',
          error: `File '${file.name}' does not contain a valid Rich Text Format ({\\rtf) header.`,
          fileSizeMB: basic.fileSizeMB,
        };
      }
      break;
    }

    case 'fdx': {
      // FDX must be XML and reference FinalDraft / Final Draft document structure
      const isXml = latinHeader.includes('<?xml') || latinHeader.includes('<FinalDraft') || latinHeader.includes('<Content>');
      if (!isXml) {
        return {
          isValid: false,
          format: 'fdx',
          error: `File '${file.name}' does not contain valid Final Draft XML content.`,
          fileSizeMB: basic.fileSizeMB,
        };
      }
      break;
    }

    case 'fountain':
    case 'txt': {
      // Verify text encoding is valid UTF-8/ASCII without null bytes / high density binary control chars
      let nullCount = 0;
      for (let i = 0; i < headerBytes.length; i++) {
        if (headerBytes[i] === 0) nullCount++;
      }
      if (nullCount > 2) {
        return {
          isValid: false,
          format: detectedFormat,
          error: `File '${file.name}' appears to be a binary file, not plain text or Fountain screenplay.`,
          fileSizeMB: basic.fileSizeMB,
        };
      }
      break;
    }
  }

  return basic;
}

export function checkDuplicateScreenplay(
  fileName: string,
  existingVersions: ScreenplayVersion[] = []
): { isDuplicate: boolean; matchedVersion?: ScreenplayVersion; nextVersionTag: string } {
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
  
  const matched = existingVersions.find(v => {
    if (v.fileName && v.fileName.toLowerCase() === fileName.toLowerCase()) return true;
    if (v.title && v.title.toLowerCase() === baseName) return true;
    return false;
  });

  // Calculate next suggested version tag (e.g. v1.0 -> v1.1)
  let nextVersionTag = 'v1.0';
  if (existingVersions.length > 0) {
    const versions = existingVersions
      .map(v => parseFloat(v.version.replace(/[^0-9.]/g, '')))
      .filter(n => !isNaN(n));
    if (versions.length > 0) {
      const maxVer = Math.max(...versions);
      nextVersionTag = `v${(maxVer + 0.1).toFixed(1)}`;
    }
  }

  return {
    isDuplicate: !!matched,
    matchedVersion: matched,
    nextVersionTag,
  };
}
