/**
 * SceneOS — Rich Text Format (.rtf) Screenplay Adapter
 * Decodes RTF control symbols, group blocks, and character hex escapes (\'xx).
 */

import { FormatAdapter, ParsedScene, ParsingWarning, ScreenplayFormat } from '../types';
import { TextAdapter } from './TextAdapter';

export class RtfAdapter implements FormatAdapter {
  readonly format: ScreenplayFormat = 'rtf';
  readonly fileExtensions = ['.rtf'];

  canParse(file: File, text?: string): boolean {
    if (file.name.toLowerCase().endsWith('.rtf')) return true;
    if (text && text.trim().startsWith('{\\rtf')) return true;
    return false;
  }

  async parse(file: File, text?: string): Promise<{
    title?: string;
    author?: string;
    scenes: ParsedScene[];
    warnings: ParsingWarning[];
    rawText: string;
  }> {
    const rawContent = text || await file.text();
    const warnings: ParsingWarning[] = [];

    const extractedText = this.stripRtfToPlainText(rawContent);

    warnings.push({
      id: 'rtf-conversion-notice',
      severity: 'info',
      message: 'RTF formatting stripped. Character hex escapes and standard screenplay syntax normalized.',
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

  private stripRtfToPlainText(rtf: string): string {
    // 1. Convert hex character escapes: \'92 -> single quote, \'93/\'94 -> double quotes, etc.
    let text = rtf.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
      const code = parseInt(hex, 16);
      if (code === 0x91 || code === 0x92) return "'";
      if (code === 0x93 || code === 0x94) return '"';
      if (code === 0x96 || code === 0x97) return '-';
      if (code >= 32 && code <= 126) return String.fromCharCode(code);
      return '';
    });

    // 2. Remove group headers (font table, color table, stylesheet, info) using brace matching
    const groupKeywords = ['fonttbl', 'colortbl', 'stylesheet', 'info', '*\\themedata'];
    for (const kw of groupKeywords) {
      const idx = text.indexOf(`{\\${kw}`);
      if (idx !== -1) {
        // Find matching closing brace
        let depth = 0;
        let endIdx = idx;
        for (let i = idx; i < text.length; i++) {
          if (text[i] === '{') depth++;
          else if (text[i] === '}') {
            depth--;
            if (depth === 0) {
              endIdx = i;
              break;
            }
          }
        }
        if (endIdx > idx) {
          text = text.slice(0, idx) + text.slice(endIdx + 1);
        }
      }
    }

    // 3. Convert paragraphs & linebreaks
    text = text
      .replace(/\\par\b/g, '\n')
      .replace(/\\line\b/g, '\n')
      .replace(/\\tab\b/g, '\t');

    // 4. Remove remaining control words (\b, \i, \fs24, \cf0, etc.)
    text = text.replace(/\\[a-zA-Z]+(-?\d+)?\s?/g, '');

    // 5. Remove leftover braces
    text = text.replace(/[{}]/g, '');

    // 6. Normalize newlines and collapse excessive blank lines
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
