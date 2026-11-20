/**
 * SceneOS — Word Document (.docx) Screenplay Adapter
 * Extracts paragraph structure and text elements from DOCX packages using fflate.
 */

import { unzipSync, strFromU8 } from 'fflate';
import { FormatAdapter, ParsedScene, ParsingWarning, ScreenplayFormat } from '../types';
import { TextAdapter } from './TextAdapter';

export class DocxAdapter implements FormatAdapter {
  readonly format: ScreenplayFormat = 'docx';
  readonly fileExtensions = ['.docx'];

  canParse(file: File): boolean {
    return file.name.toLowerCase().endsWith('.docx');
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

    let extractedText = '';
    try {
      extractedText = this.extractTextFromDocxZip(arrayBuffer);
    } catch (err: any) {
      warnings.push({
        id: 'docx-zip-corrupt',
        severity: 'warning',
        message: `Could not decompress Word document: ${err.message || 'Corrupted ZIP archive'}.`,
        suggestion: 'Please verify the file can be opened in Word or export as .fdx / .fountain.',
      });
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Unknown Screenwriter',
        scenes: [],
        warnings,
        rawText: '',
      };
    }

    if (!extractedText || extractedText.trim().length === 0) {
      warnings.push({
        id: 'docx-empty-document',
        severity: 'warning',
        message: 'Could not extract text from Word document. The document appears empty or contains unsupported content structures.',
      });
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Unknown Screenwriter',
        scenes: [],
        warnings,
        rawText: '',
      };
    }

    warnings.push({
      id: 'docx-formatting-notice',
      severity: 'info',
      message: 'Extracted text from Word document package. Paragraph order and dialogue lines preserved.',
    });

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
   * Standards-aware extraction of word/document.xml from DOCX ZIP container
   */
  private extractTextFromDocxZip(buffer: ArrayBuffer): string {
    const uint8 = new Uint8Array(buffer);
    const unzipped = unzipSync(uint8);

    // Look for word/document.xml (case-insensitive find in ZIP entries)
    const docEntryKey = Object.keys(unzipped).find(k => k.toLowerCase() === 'word/document.xml');
    if (!docEntryKey || !unzipped[docEntryKey]) {
      throw new Error("Missing 'word/document.xml' in Word document container.");
    }

    const documentXml = strFromU8(unzipped[docEntryKey]);

    // Parse paragraphs <w:p> while preserving order and inner text runs <w:t>
    const paragraphRegex = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/g;
    const textTagRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;

    const paragraphs: string[] = [];
    let pMatch: RegExpExecArray | null;

    while ((pMatch = paragraphRegex.exec(documentXml)) !== null) {
      const pXml = pMatch[1];
      let pText = '';
      let tMatch: RegExpExecArray | null;

      while ((tMatch = textTagRegex.exec(pXml)) !== null) {
        // Decode XML character entities
        const rawT = tMatch[1];
        const unescaped = rawT
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        pText += unescaped;
      }

      // Keep paragraph if it has content, or an empty string to represent line breaks
      paragraphs.push(pText.trim());
    }

    // Join with newlines, collapsing multiple excessive blank lines to max 2
    return paragraphs
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
