/**
 * SceneOS — Universal Screenplay Import & Validation Pipeline
 * Detects format, parses into CanonicalScreenplayDocument, validates integrity,
 * generates honest human preview with warnings, and constructs new ScreenplayVersion.
 */

import {
  CanonicalScreenplayDocument,
  CanonicalWarning,
} from '../model/canonicalScreenplay';
import { parseFountain } from '../model/fountainParser';
import { parseFdx } from '../model/fdxParser';
import { parsePlainText } from '../model/textParser';
import { parsePdf } from '../model/pdfParser';
import { parseDocx } from '../model/docxParser';
import {
  canonicalToTiptapDoc,
  canonicalToPlainText,
  canonicalToParsedScenes,
} from '../model/canonicalConverters';
import { ScreenplayVersion, FilmProject } from '../../../types';

export type SupportedImportFormat = 'fountain' | 'fdx' | 'txt' | 'docx' | 'pdf';

export interface ScreenplayImportPreviewData {
  fileName: string;
  fileSize: number;
  detectedFormat: SupportedImportFormat;
  title: string;
  authors: string[];
  canonical: CanonicalScreenplayDocument;
  totalScenes: number;
  estimatedPages: number;
  characterNames: string[];
  elementCounts: Record<string, number>;
  warnings: CanonicalWarning[];
  plainTextPreview: string;
  sourcePdfDataUrl?: string;
  originalPdfData?: string;
  pdfPageCount?: number;
}

/**
 * Converts a browser File into a base64 Data URL
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Detects the screenplay format from file name and raw text/magic bytes
 */
export function detectScreenplayFormat(fileName: string, rawContent: string): SupportedImportFormat {
  const lowerName = (fileName || '').toLowerCase();

  if (lowerName.endsWith('.fountain') || lowerName.endsWith('.spmd')) {
    return 'fountain';
  }
  if (lowerName.endsWith('.fdx')) {
    return 'fdx';
  }
  if (lowerName.endsWith('.docx')) {
    return 'docx';
  }
  if (lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (lowerName.endsWith('.txt')) {
    return 'txt';
  }

  // Content inspection
  if (rawContent.includes('<FinalDraft') || rawContent.includes('DocumentType="Script"')) {
    return 'fdx';
  }
  if (/^(Title|Credit|Author|Draft date):/im.test(rawContent) || /^[A-Z0-9\s]+(\(.*\))?\s*\n[a-zA-Z]/m.test(rawContent)) {
    return 'fountain';
  }

  return 'txt';
}

/**
 * Ingests a file and produces a structured preview with warnings
 */
export async function processScreenplayImportFile(
  file: File
): Promise<ScreenplayImportPreviewData> {
  if (!file || file.size === 0) {
    throw new Error('The selected file is empty.');
  }

  const fileName = file.name;
  const fileSize = file.size;
  const lowerName = fileName.toLowerCase();

  let detectedFormat: SupportedImportFormat = 'txt';

  // Check magic bytes by slicing first 16 bytes
  try {
    const headerBuffer = await file.slice(0, 16).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);
    if (
      headerBytes.length >= 5 &&
      headerBytes[0] === 0x25 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x44 &&
      headerBytes[3] === 0x46 &&
      headerBytes[4] === 0x2d
    ) {
      detectedFormat = 'pdf';
    } else if (
      headerBytes.length >= 4 &&
      headerBytes[0] === 0x50 &&
      headerBytes[1] === 0x4b &&
      headerBytes[2] === 0x03 &&
      headerBytes[3] === 0x04
    ) {
      detectedFormat = 'docx';
    }
  } catch {
    // Fall back to filename inspection
  }

  if (detectedFormat === 'txt') {
    if (lowerName.endsWith('.pdf')) {
      detectedFormat = 'pdf';
    } else if (lowerName.endsWith('.docx')) {
      detectedFormat = 'docx';
    } else if (lowerName.endsWith('.fdx')) {
      detectedFormat = 'fdx';
    } else if (lowerName.endsWith('.fountain') || lowerName.endsWith('.spmd')) {
      detectedFormat = 'fountain';
    } else {
      try {
        const sampleText = await file.slice(0, 4096).text();
        detectedFormat = detectScreenplayFormat(fileName, sampleText);
      } catch {
        detectedFormat = 'txt';
      }
    }
  }

  let canonical: CanonicalScreenplayDocument;
  let sourcePdfDataUrl: string | undefined;

  switch (detectedFormat) {
    case 'pdf': {
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await file.arrayBuffer();
        if (typeof FileReader !== 'undefined') {
          try {
            sourcePdfDataUrl = await readFileAsDataUrl(file);
          } catch {
            // Data URL generation fallback below
          }
        }
        if (!sourcePdfDataUrl && typeof Buffer !== 'undefined') {
          const b64 = Buffer.from(arrayBuffer).toString('base64');
          sourcePdfDataUrl = `data:application/pdf;base64,${b64}`;
        }
      } catch (err: any) {
        throw new Error(`Failed to read PDF file "${fileName}": ${err?.message || 'Unknown error'}`);
      }

      canonical = await parsePdf(arrayBuffer, {
        fileName,
        fileSize,
        sourcePdfDataUrl,
      });
      break;
    }

    case 'docx': {
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await file.arrayBuffer();
      } catch (err: any) {
        throw new Error(`Failed to read DOCX file "${fileName}": ${err?.message || 'Unknown error'}`);
      }

      canonical = parseDocx(arrayBuffer, { fileName, fileSize });
      break;
    }

    case 'fdx': {
      const rawText = await file.text();
      canonical = parseFdx(rawText, { fileName, fileSize });
      break;
    }

    case 'fountain': {
      const rawText = await file.text();
      canonical = parseFountain(rawText, { fileName, fileSize });
      break;
    }

    case 'txt':
    default: {
      const rawText = await file.text();
      canonical = parsePlainText(rawText, { fileName, fileSize });
      break;
    }
  }

  // Calculate metrics
  const elementCounts: Record<string, number> = {};
  for (const el of canonical.elements) {
    elementCounts[el.type] = (elementCounts[el.type] || 0) + 1;
  }

  const parsedScenes = canonicalToParsedScenes(canonical);
  const characterSet = new Set<string>();
  for (const el of canonical.elements) {
    if (el.type === 'character' && el.text) {
      characterSet.add(el.text.replace(/\s*\(.*\)$/, '').trim().toUpperCase());
    }
  }

  const totalLines = canonical.elements.length;
  const estimatedPages = Math.max(1, Math.ceil(totalLines / 45));
  const plainTextPreview = canonicalToPlainText(canonical).slice(0, 3000);

  return {
    fileName,
    fileSize,
    detectedFormat,
    title: canonical.metadata.title || fileName.replace(/\.[^/.]+$/, ''),
    authors: canonical.metadata.authors || [],
    canonical,
    totalScenes: parsedScenes.length,
    estimatedPages,
    characterNames: Array.from(characterSet).slice(0, 15),
    elementCounts,
    warnings: canonical.warnings,
    plainTextPreview,
    sourcePdfDataUrl,
    originalPdfData: sourcePdfDataUrl,
    pdfPageCount: detectedFormat === 'pdf' ? Math.max(1, estimatedPages) : undefined,
  };
}

/**
 * Builds a valid ScreenplayVersion ready to add to the FilmProject
 */
export function buildScreenplayVersionFromCanonical(
  canonical: CanonicalScreenplayDocument,
  project: FilmProject,
  rawOriginalText?: string,
  sourcePdfDataUrl?: string
): ScreenplayVersion {
  const existingVersions = project.screenplayVersions || [];
  const nextVersionNum = existingVersions.length + 1;
  const nowIso = new Date().toISOString();

  const title = canonical.metadata.title || `Draft ${nextVersionNum}`;
  const doc = canonicalToTiptapDoc(canonical);

  // Strictly guard against raw binary string injection (e.g. %PDF-1.3, PK\x03\x04, obj/stream)
  const isBinarySyntax =
    typeof rawOriginalText === 'string' &&
    (rawOriginalText.startsWith('%PDF-') ||
      rawOriginalText.startsWith('PK\x03\x04') ||
      rawOriginalText.includes('/FlateDecode') ||
      rawOriginalText.includes('stream\n') ||
      rawOriginalText.includes('endobj'));

  const rawText =
    !isBinarySyntax &&
    rawOriginalText &&
    canonical.provenance.sourceFormat !== 'pdf' &&
    canonical.provenance.sourceFormat !== 'docx'
      ? rawOriginalText
      : canonicalToPlainText(canonical);

  const scenes = canonicalToParsedScenes(canonical);

  const effectivePdfDataUrl = sourcePdfDataUrl || canonical.provenance.sourcePdfDataUrl;

  const effectiveAuthor =
    canonical.metadata.author ||
    (canonical.metadata.authors && canonical.metadata.authors[0]) ||
    '';

  return {
    id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    version: `v${nextVersionNum}.0`,
    title,
    author: effectiveAuthor,
    createdAt: nowIso,
    updatedAt: nowIso,
    changeDescription: `Imported from ${canonical.provenance.sourceFormat.toUpperCase()}`,
    status: 'Draft',
    content: doc,
    documentJson: JSON.stringify(doc),
    rawText,
    contentSnippet: rawText.slice(0, 250),
    scenes,
    sourceFormat: canonical.provenance.sourceFormat as any,
    sourcePdfDataUrl: effectivePdfDataUrl,
    sourcePdfFileName: effectivePdfDataUrl ? canonical.provenance.fileName : undefined,
    pdfLayout: canonical.pdfLayout,
    titlePageMetadata: {
      title: canonical.metadata.title || title,
      author: effectiveAuthor,
      credit: canonical.metadata.credit || 'written by',
      draftDate: canonical.metadata.draftDate || '',
      contact: canonical.metadata.contact || '',
      notes: canonical.metadata.notes || '',
    },
  };
}

/**
 * Synchronously inspects a screenplay file name and raw text content, returning
 * human-readable metrics, format detection, and parsed canonical document.
 */
export function inspectScreenplayImportFile(
  fileName: string,
  rawText: string
): {
  format: SupportedImportFormat;
  title: string;
  sceneCount: number;
  estimatedPages: number;
  characterNames: string[];
  warnings: string[];
  rawText: string;
  canonical: CanonicalScreenplayDocument;
} {
  const detectedFormat = detectScreenplayFormat(fileName, rawText);
  let canonical: CanonicalScreenplayDocument;
  const warnings: string[] = [];

  switch (detectedFormat) {
    case 'fountain': {
      canonical = parseFountain(rawText, { fileName });
      break;
    }
    case 'fdx': {
      canonical = parseFdx(rawText, { fileName });
      break;
    }
    case 'docx':
    case 'pdf': {
      warnings.push(
        `${detectedFormat.toUpperCase()} document import: Text layout extracted, but binary formatting may be lossy. For lossless fidelity, import .fountain or .fdx.`
      );
      canonical = parsePlainText(rawText, { fileName });
      canonical.provenance.sourceFormat = detectedFormat;
      break;
    }
    case 'txt':
    default: {
      canonical = parsePlainText(rawText, { fileName });
      break;
    }
  }

  for (const w of canonical.warnings) {
    warnings.push(w.message);
  }

  const scenes = canonicalToParsedScenes(canonical);
  const characterSet = new Set<string>();
  for (const el of canonical.elements) {
    if (el.type === 'character' && el.text) {
      characterSet.add(el.text.replace(/\s*\(.*\)$/, '').trim().toUpperCase());
    }
  }

  return {
    format: detectedFormat,
    title: canonical.metadata.title || fileName.replace(/\.[^/.]+$/, ''),
    sceneCount: scenes.length,
    estimatedPages: Math.max(1, Math.ceil(canonical.elements.length / 45)),
    characterNames: Array.from(characterSet),
    warnings,
    rawText,
    canonical,
  };
}

