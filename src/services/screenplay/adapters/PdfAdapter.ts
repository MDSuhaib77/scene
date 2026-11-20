/**
 * SceneOS — PDF (.pdf) Screenplay Adapter
 * Extracts text streams from vector PDFs, detects sluglines, and flags extraction fidelity.
 * Supports uncompressed and /FlateDecode compressed PDF content streams with strict bounds.
 */

import { unzlibSync, inflateSync } from 'fflate';
import { FormatAdapter, ParsedScene, ParsingWarning, ScreenplayFormat } from '../types';
import { TextAdapter } from './TextAdapter';

const MAX_STREAMS_TO_PROCESS = 200;
const MAX_TOTAL_EXTRACTED_BYTES = 5 * 1024 * 1024; // 5MB uncompressed text limit

export class PdfAdapter implements FormatAdapter {
  readonly format: ScreenplayFormat = 'pdf';
  readonly fileExtensions = ['.pdf'];

  canParse(file: File): boolean {
    return file.name.toLowerCase().endsWith('.pdf');
  }

  async parse(file: File, _text?: string, buffer?: ArrayBuffer): Promise<{
    title?: string;
    author?: string;
    scenes: ParsedScene[];
    warnings: ParsingWarning[];
    rawText: string;
  }> {
    const arrayBuffer = buffer || await file.arrayBuffer();
    const warnings: ParsingWarning[] = [];

    // Extract text streams from vector PDF
    const {
      text: extractedText,
      hasFlateStreams,
      isLikelyImageOnly,
      wasTruncated,
      streamCount,
      unclosedStreamsDetected,
    } = this.extractTextFromPdfBuffer(arrayBuffer);

    if (unclosedStreamsDetected) {
      warnings.push({
        id: 'pdf-stream-unclosed-warning',
        severity: 'info',
        message: 'One or more PDF stream blocks were incomplete or malformed. Parsed available data safely.',
      });
    }

    if (wasTruncated) {
      warnings.push({
        id: 'pdf-extraction-truncated',
        severity: 'warning',
        message: `PDF text extraction reached the safety limit of 5 MB or ${MAX_STREAMS_TO_PROCESS} streams. Text beyond this limit was truncated.`,
        suggestion: 'If parts of the screenplay are missing, consider exporting directly as .fdx or .fountain.',
      });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      if (isLikelyImageOnly) {
        warnings.push({
          id: 'pdf-scanned-ocr-unsupported',
          severity: 'warning',
          message: 'No extractable text found. This PDF appears to be a scanned image. OCR is not currently supported.',
          suggestion: 'Please export the screenplay directly as .fdx, .fountain, or plain text from your screenwriting application.',
        });
      } else {
        warnings.push({
          id: 'pdf-empty-or-corrupt',
          severity: 'warning',
          message: 'Could not extract text from PDF document. The file may be empty or contain unsupported stream encodings.',
          suggestion: 'Please verify the file or export as .fdx or .fountain.',
        });
      }
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Unknown Screenwriter',
        scenes: [],
        warnings,
        rawText: '',
      };
    }

    warnings.push({
      id: 'pdf-stream-notice',
      severity: 'info',
      message: hasFlateStreams
        ? 'Script extracted from compressed vector PDF stream. Character and slugline boundaries should be reviewed before locking.'
        : 'Script extracted from PDF text stream. Review sluglines and character cues before locking.',
    });

    // Delegate normalized text to TextAdapter for scene breakdown
    const textAdapter = new TextAdapter();
    const result = await textAdapter.parse(file, extractedText);

    return {
      title: result.title || file.name.replace(/\.[^/.]+$/, ''),
      author: result.author || 'Screenplay Author',
      scenes: result.scenes,
      warnings: [...warnings, ...result.warnings],
      rawText: extractedText,
    };
  }

  /**
   * Helper to search for byte sequences in Uint8Array
   */
  private findBytePattern(haystack: Uint8Array, needle: number[], start: number = 0): number {
    const maxSearch = haystack.length - needle.length;
    for (let i = start; i <= maxSearch; i++) {
      let match = true;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }

  /**
   * Bounded binary-accurate stream extraction and decompression from PDF ArrayBuffer
   */
  private extractTextFromPdfBuffer(buffer: ArrayBuffer): {
    text: string;
    hasFlateStreams: boolean;
    isLikelyImageOnly: boolean;
    wasTruncated: boolean;
    streamCount: number;
    unclosedStreamsDetected: boolean;
  } {
    const uint8 = new Uint8Array(buffer);
    const latinDecoder = new TextDecoder('latin1');
    const pdfRawString = latinDecoder.decode(uint8);

    let hasFlateStreams = false;
    let streamCount = 0;
    let unclosedStreamsDetected = false;
    let wasTruncated = false;
    const decompressedStreams: string[] = [];

    const streamHeader = [0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]; // 'stream'
    const endstreamHeader = [0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]; // 'endstream'

    let searchPos = 0;
    while (searchPos < uint8.length && streamCount < MAX_STREAMS_TO_PROCESS) {
      const streamIdx = this.findBytePattern(uint8, streamHeader, searchPos);
      if (streamIdx === -1) break;

      streamCount++;
      let dataStart = streamIdx + streamHeader.length;
      if (dataStart < uint8.length && uint8[dataStart] === 0x0d && uint8[dataStart + 1] === 0x0a) {
        dataStart += 2;
      } else if (dataStart < uint8.length && uint8[dataStart] === 0x0a) {
        dataStart += 1;
      }

      const endstreamIdx = this.findBytePattern(uint8, endstreamHeader, dataStart);
      if (endstreamIdx === -1) {
        // Missing endstream terminator: flag malformed stream and advance past this 'stream' marker
        unclosedStreamsDetected = true;
        searchPos = Math.max(dataStart, streamIdx + 1);
        continue;
      }

      let dataEnd = endstreamIdx;
      if (dataEnd > dataStart && uint8[dataEnd - 1] === 0x0a) dataEnd--;
      if (dataEnd > dataStart && uint8[dataEnd - 1] === 0x0d) dataEnd--;

      const streamBytes = uint8.slice(dataStart, dataEnd);

      // Check preceding dictionary for /FlateDecode
      const precedingDict = pdfRawString.slice(Math.max(0, streamIdx - 400), streamIdx);
      const isFlate = precedingDict.includes('/FlateDecode');

      if (isFlate) {
        hasFlateStreams = true;
        let decompressed: Uint8Array | null = null;
        try {
          decompressed = unzlibSync(streamBytes);
        } catch {
          try {
            decompressed = inflateSync(streamBytes);
          } catch {
            // Stream decompression failed or encrypted
          }
        }

        if (decompressed) {
          decompressedStreams.push(latinDecoder.decode(decompressed));
          searchPos = endstreamIdx + endstreamHeader.length;
          continue;
        }
      }

      // Uncompressed stream or flate decode fallback
      decompressedStreams.push(latinDecoder.decode(streamBytes));
      searchPos = endstreamIdx + endstreamHeader.length;
    }

    if (streamCount >= MAX_STREAMS_TO_PROCESS) {
      wasTruncated = true;
    }

    // Extract text operators (Tj and TJ) from all streams
    const allStreamText = decompressedStreams.join('\n');
    const textPieces: string[] = [];

    // 1. Array text operator: [ (Some) -10 (Text) ] TJ (non-backtracking)
    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    let tjArrayMatch: RegExpExecArray | null;
    while ((tjArrayMatch = tjArrayRegex.exec(allStreamText)) !== null) {
      const inside = tjArrayMatch[1];
      const stringMatches = inside.match(/\((?:[^\\)]|\\.)*\)|<[0-9a-fA-F]+>/g);
      if (stringMatches) {
        const line = stringMatches.map(s => this.decodePdfString(s)).join('');
        if (line.trim()) textPieces.push(line);
      }
    }

    // 2. Simple text operator: (Some Text) Tj or ' or "
    const tjSimpleRegex = /(?:\(((?:[^\\)]|\\.)*)\)|<([0-9a-fA-F]+)>)\s*(?:Tj|'|")/g;
    let tjSimpleMatch: RegExpExecArray | null;
    while ((tjSimpleMatch = tjSimpleRegex.exec(allStreamText)) !== null) {
      if (tjSimpleMatch[1] !== undefined) {
        textPieces.push(this.decodePdfString(`(${tjSimpleMatch[1]})`));
      } else if (tjSimpleMatch[2] !== undefined) {
        textPieces.push(this.decodePdfString(`<${tjSimpleMatch[2]}>`));
      }
    }

    // Fallback if no text operators found
    if (textPieces.length === 0) {
      const globalMatches = pdfRawString.match(/\(((?:[^\\)]|\\.)*)\)\s*(?:Tj|TJ|'|")/g);
      if (globalMatches) {
        globalMatches.forEach(m => {
          const content = m.replace(/\s*(?:Tj|TJ|'|")$/, '');
          textPieces.push(this.decodePdfString(content));
        });
      }
    }

    const unclippedText = textPieces
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .join('\n')
      .replace(/\r\n/g, '\n');

    let fullExtracted = unclippedText;
    if (unclippedText.length > MAX_TOTAL_EXTRACTED_BYTES) {
      fullExtracted = unclippedText.slice(0, MAX_TOTAL_EXTRACTED_BYTES);
      wasTruncated = true;
    }

    const hasImageXObjects = pdfRawString.includes('/Subtype /Image') || pdfRawString.includes('/Subtype/Image');
    const isLikelyImageOnly = (textPieces.length === 0) && (hasImageXObjects || streamCount > 0);

    return {
      text: fullExtracted,
      hasFlateStreams,
      isLikelyImageOnly,
      wasTruncated,
      streamCount,
      unclosedStreamsDetected,
    };
  }

  private decodePdfString(str: string): string {
    if (str.startsWith('<') && str.endsWith('>')) {
      const hex = str.slice(1, -1);
      let out = '';
      for (let i = 0; i < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
      return out;
    }

    if (str.startsWith('(') && str.endsWith(')')) {
      const inner = str.slice(1, -1);
      return inner
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    }

    return str;
  }
}
