/**
 * SceneOS — DOCX Screenplay Parser
 * Fast, lightweight .docx XML parser using fflate.
 * Extracts paragraphs, paragraph styles (<w:pStyle>), text runs (<w:t>),
 * indentation (<w:ind w:left="...">), and metadata from docProps/core.xml.
 */

import * as fflate from 'fflate';
import {
  CanonicalScreenplayDocument,
  CanonicalElement,
  CanonicalWarning,
  ScreenplayMetadata,
  generateElementId,
  FormattingSpan,
  ObservedElementFormatting,
} from './canonicalScreenplay';

export interface ParseDocxOptions {
  fileName?: string;
  fileSize?: number;
}

const SCENE_PREFIXES = ['INT.', 'EXT.', 'INT/EXT.', 'INT./EXT.', 'I/E.', 'EST.'];

function extractDocxRuns(pBody: string, indDxa: number): {
  text: string;
  formatting?: FormattingSpan[];
  observedFormatting?: ObservedElementFormatting;
} {
  const rRegex = /<w:r\b([^>]*)>([\s\S]*?)<\/w:r>/gi;
  let fullText = '';
  const formatting: FormattingSpan[] = [];
  let detectedFont: string | undefined;
  let detectedSize: number | undefined;

  let rMatch: RegExpExecArray | null;
  while ((rMatch = rRegex.exec(pBody)) !== null) {
    const rContent = rMatch[2];
    const tMatches = Array.from(rContent.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi));
    const rText = tMatches.map((m) => decodeXml(m[1])).join('');
    if (!rText) continue;

    const start = fullText.length;
    fullText += rText;
    const end = fullText.length;

    const rPrMatch = rContent.match(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/i);
    const rPr = rPrMatch ? rPrMatch[1] : '';

    if (/<w:b(\/|\s|>)/i.test(rPr) && !/<w:b\s+w:val="(0|false)"/i.test(rPr)) {
      formatting.push({ type: 'bold', start, end });
    }
    if (/<w:i(\/|\s|>)/i.test(rPr) && !/<w:i\s+w:val="(0|false)"/i.test(rPr)) {
      formatting.push({ type: 'italic', start, end });
    }
    if (/<w:u(\/|\s|>)/i.test(rPr) && !/<w:u\s+w:val="(none|0)"/i.test(rPr)) {
      formatting.push({ type: 'underline', start, end });
    }

    const fontMatch = rPr.match(/<w:rFonts\b[^>]*w:ascii="([^"]+)"/i);
    if (fontMatch && !detectedFont) detectedFont = fontMatch[1];

    const szMatch = rPr.match(/<w:sz\b[^>]*w:val="([^"]+)"/i);
    if (szMatch && !detectedSize) detectedSize = parseInt(szMatch[1], 10) / 2;
  }

  if (!fullText) {
    const fallbackT = Array.from(pBody.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi));
    fullText = fallbackT.map((m) => decodeXml(m[1])).join('');
  }

  const jcMatch = pBody.match(/<w:jc\b[^>]*w:val="([^"]+)"/i);
  const jc = jcMatch ? jcMatch[1].toLowerCase() : undefined;
  const alignment = jc === 'center' ? 'center' : jc === 'right' ? 'right' : undefined;

  let observedFormatting: ObservedElementFormatting | undefined;
  if (detectedFont || detectedSize || indDxa > 0 || alignment) {
    observedFormatting = {
      fontFamily: detectedFont,
      fontSizePt: detectedSize,
      indentLeftInches: indDxa > 0 ? Number((indDxa / 1440).toFixed(2)) : undefined,
      alignment,
      isObserved: true,
    };
  }

  return {
    text: fullText.trim(),
    formatting: formatting.length > 0 ? formatting : undefined,
    observedFormatting,
  };
}

export function parseDocx(
  data: Uint8Array | ArrayBuffer,
  options: ParseDocxOptions = {}
): CanonicalScreenplayDocument {
  const warnings: CanonicalWarning[] = [];
  const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = fflate.unzipSync(uint8);
  } catch (err: any) {
    throw new Error(`Failed to decompress DOCX archive: ${err?.message || 'Invalid or corrupt DOCX file'}`);
  }

  const docXmlBytes = unzipped['word/document.xml'];
  if (!docXmlBytes) {
    throw new Error('Invalid DOCX document: word/document.xml was not found in the archive.');
  }

  const docXml = fflate.strFromU8(docXmlBytes);
  const metadata: ScreenplayMetadata = {
    title: options.fileName?.replace(/\.[^/.]+$/, '') || 'Untitled Screenplay',
  };

  // 1. Extract Core Properties Metadata if available
  const coreXmlBytes = unzipped['docProps/core.xml'];
  if (coreXmlBytes) {
    const coreXml = fflate.strFromU8(coreXmlBytes);
    const titleMatch = coreXml.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i);
    if (titleMatch && titleMatch[1].trim()) {
      metadata.title = decodeXml(titleMatch[1].trim());
    }
    const creatorMatch = coreXml.match(/<dc:creator\b[^>]*>([\s\S]*?)<\/dc:creator>/i);
    if (creatorMatch && creatorMatch[1].trim()) {
      metadata.author = decodeXml(creatorMatch[1].trim());
      metadata.authors = [metadata.author];
    }
  }

  // 2. Parse Paragraphs from word/document.xml
  const elements: CanonicalElement[] = [];
  const pRegex = /<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/gi;
  let pMatch: RegExpExecArray | null;

  let prevType: string | null = null;
  let rawTextAccumulator = '';

  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pAttrs = pMatch[1];
    const pBody = pMatch[2];

    // Extract text from all <w:t> tags
    const tMatches = Array.from(pBody.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi));
    const pText = tMatches.map((m) => decodeXml(m[1])).join('').trim();
    if (!pText) continue;

    rawTextAccumulator += pText + '\n';

    // Check style name
    const styleMatch = pBody.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i);
    const styleVal = (styleMatch ? styleMatch[1] : '').toLowerCase();

    // Check left indentation in dxa (1440 dxa = 1 inch)
    const indMatch = pBody.match(/<w:ind\b[^>]*w:left="([^"]+)"/i);
    const indDxaVal = indMatch ? parseInt(indMatch[1], 10) : 0;

    const { text: runText, formatting: runFormatting, observedFormatting: runObserved } = extractDocxRuns(pBody, indDxaVal);

    const isUpper = pText === pText.toUpperCase() && /[A-Z]/.test(pText);

    // Classification Logic:
    // A. Scene Heading
    const isScenePrefix = SCENE_PREFIXES.some((p) => pText.toUpperCase().startsWith(p));
    const isSceneStyle = styleVal.includes('scene') || styleVal.includes('heading');

    if (isScenePrefix || isSceneStyle) {
      elements.push({
        id: generateElementId('scn'),
        type: 'scene_heading',
        text: pText.toUpperCase(),
        formatting: runFormatting,
        observedFormatting: runObserved,
        confidence: 'high',
        rawSourceText: pText,
      });
      prevType = 'scene_heading';
      continue;
    }

    // B. Character Cue
    const isCharStyle = styleVal.includes('character');
    const isCharIndent = indDxaVal >= 4500;
    const isLikelyChar = isUpper && pText.length <= 40 && !pText.endsWith('.');

    if (isCharStyle || (isCharIndent && isLikelyChar) || (isLikelyChar && prevType !== 'character')) {
      const charName = pText.replace(/\s*\(.*\)$/, '').trim();
      const extMatch = pText.match(/\(([^)]+)\)/);
      elements.push({
        id: generateElementId('chr'),
        type: 'character',
        text: pText.toUpperCase(),
        formatting: runFormatting,
        observedFormatting: runObserved,
        characterProperties: {
          characterName: charName,
          extensions: extMatch ? [extMatch[1].trim()] : undefined,
        },
        confidence: 'high',
        rawSourceText: pText,
      });
      prevType = 'character';
      continue;
    }

    // C. Parenthetical
    const isParenStyle = styleVal.includes('paren');
    const isParenText = pText.startsWith('(') && pText.endsWith(')');

    if (isParenStyle || (isParenText && (prevType === 'character' || prevType === 'dialogue'))) {
      elements.push({
        id: generateElementId('par'),
        type: 'parenthetical',
        text: pText,
        formatting: runFormatting,
        observedFormatting: runObserved,
        confidence: 'high',
        rawSourceText: pText,
      });
      prevType = 'parenthetical';
      continue;
    }

    // D. Dialogue
    const isDialogueStyle = styleVal.includes('dialogue');
    const isDialogueIndent = indDxaVal >= 2500 && indDxaVal < 4500;

    if (isDialogueStyle || isDialogueIndent || prevType === 'character' || prevType === 'parenthetical') {
      elements.push({
        id: generateElementId('dia'),
        type: 'dialogue',
        text: pText,
        formatting: runFormatting,
        observedFormatting: runObserved,
        confidence: 'high',
        rawSourceText: pText,
      });
      prevType = 'dialogue';
      continue;
    }

    // E. Transition
    const isTransitionStyle = styleVal.includes('transition');
    const isTransitionText = isUpper && pText.endsWith('TO:');

    if (isTransitionStyle || isTransitionText || indDxaVal >= 5500) {
      elements.push({
        id: generateElementId('trn'),
        type: 'transition',
        text: pText.toUpperCase(),
        formatting: runFormatting,
        observedFormatting: runObserved,
        confidence: 'high',
        rawSourceText: pText,
      });
      prevType = 'transition';
      continue;
    }

    // F. Action (Default)
    elements.push({
      id: generateElementId('act'),
      type: 'action',
      text: pText,
      formatting: runFormatting,
      observedFormatting: runObserved,
      confidence: 'high',
      rawSourceText: pText,
    });
    prevType = 'action';
  }

  if (elements.length === 0) {
    elements.push({
      id: generateElementId('act'),
      type: 'action',
      text: '',
      confidence: 'high',
    });
  }

  return {
    id: generateElementId('doc'),
    metadata,
    elements,
    warnings,
    provenance: {
      sourceFormat: 'docx',
      fileName: options.fileName,
      fileSize: options.fileSize || uint8.byteLength,
      importedAt: new Date().toISOString(),
      rawTextLength: rawTextAccumulator.length,
    },
  };
}

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
