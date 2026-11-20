/**
 * SceneOS — Coordinate-Based Screenplay PDF Parser
 * High-fidelity, format-preserving parser for text-based screenplay PDFs using Mozilla PDF.js.
 * Utilizes standard screenplay typographic geometry (72 pt/in, US Letter 612x792 pt):
 * - Left margin / Action / Scene Headings: ~1.5" (90–140 pt)
 * - Dialogue: ~2.5" (150–225 pt)
 * - Parentheticals: ~3.1" (180–270 pt)
 * - Character Cues: ~3.7"–4.0" (210–330 pt)
 * - Transitions: ~5.5"–6.0" (350+ pt)
 *
 * Detects Title Page separately from manuscript body, extracts scene numbers,
 * handles multiline dialogue and parentheticals, and flags scanned image-only PDFs.
 */

import { pdfjs, ensurePdfWorkerConfigured } from '../services/pdfWorkerConfig';
import {
  CanonicalScreenplayDocument,
  CanonicalElement,
  CanonicalWarning,
  ScreenplayMetadata,
  ScreenplayTitlePage,
  generateElementId,
  FormattingSpan,
  ObservedElementFormatting,
  ScreenplayPdfDocumentLayout,
  ScreenplayPdfPageLayout,
  ScreenplayPdfLine,
} from './canonicalScreenplay';

export function resolveScreenplayFontFamily(rawFontName?: string): string {
  if (!rawFontName) {
    return '"Courier Prime", "Courier New", Courier, monospace';
  }
  const lower = rawFontName.toLowerCase();
  if (lower.includes('courier')) {
    return '"Courier Prime", "Courier New", Courier, monospace';
  }
  if (lower.includes('times')) {
    return '"Courier Prime", "Courier New", Courier, monospace';
  }
  if (lower.includes('helvetica') || lower.includes('arial') || lower.includes('sans')) {
    return 'Helvetica, Arial, sans-serif';
  }
  // Standard screenplay typesetting default
  return '"Courier Prime", "Courier New", Courier, monospace';
}

function extractLineFormatting(
  line: PdfLine,
  pageNumber: number,
  alignment?: 'left' | 'center' | 'right'
): {
  formatting?: FormattingSpan[];
  observedFormatting?: ObservedElementFormatting;
} {
  const fontName = line.fontName || '';
  const spans: FormattingSpan[] = [];
  if (/bold/i.test(fontName)) {
    spans.push({ type: 'bold', start: 0, end: line.text.length });
  }
  if (/italic|oblique/i.test(fontName)) {
    spans.push({ type: 'italic', start: 0, end: line.text.length });
  }

  const cleanFont = fontName ? fontName.replace(/^[A-Z0-9]+\+/, '') : undefined;
  const observed: ObservedElementFormatting = {
    fontFamily: cleanFont,
    fontSizePt: line.fontSize ? Math.round(line.fontSize * 10) / 10 : undefined,
    indentLeftInches: Number((line.x / 72).toFixed(2)),
    alignment,
    sourceCoordinates: { x: line.x, y: line.y, width: line.maxX - line.x, height: line.fontSize },
    pageNumber,
    isObserved: true,
  };

  return {
    formatting: spans.length > 0 ? spans : undefined,
    observedFormatting: observed,
  };
}

export interface ParsePdfOptions {
  fileName?: string;
  fileSize?: number;
  sourcePdfDataUrl?: string;
}

interface RawPdfItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
}

interface PdfLine {
  text: string;
  x: number;
  y: number;
  maxX: number;
  fontSize: number;
  fontName?: string;
  items: RawPdfItem[];
}

interface PdfPageData {
  pageNumber: number;
  width: number;
  height: number;
  lines: PdfLine[];
  rawText: string;
}

export const STANDARD_SCENE_PREFIXES = [
  'INT.',
  'EXT.',
  'INT/EXT.',
  'INT./EXT.',
  'I/E.',
  'EST.',
  'INT ',
  'EXT ',
  'INT/EXT ',
  'I/E ',
  'EST ',
];

export const TRANSITION_PATTERNS = [
  'CUT TO:',
  'FADE IN:',
  'FADE OUT.',
  'FADE TO BLACK.',
  'FADE TO BLACK:',
  'DISSOLVE TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'BACK TO SCENE.',
  'TIME CUT:',
  'CUT TO BLACK.',
];

/**
 * Classifies a line of screenplay text based on horizontal indentation coordinate (in points).
 * Used by coordinate-based extractors and unit tests.
 */
export function classifyPdfLineByPosition(text: string, xPosPt: number): string {
  const trimmed = text.trim();
  const isUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

  // Indented ~350+ pt = transition
  if (xPosPt >= 350 || (isUpper && trimmed.endsWith('TO:'))) {
    return 'transition';
  }

  // Indented ~230-340 pt = character
  if (xPosPt >= 230 && xPosPt <= 340) {
    return 'character';
  }

  // Indented ~175-229 pt = parenthetical
  if (xPosPt >= 175 && xPosPt < 230) {
    return 'parenthetical';
  }

  // Indented ~130-174 pt = dialogue
  if (xPosPt >= 130 && xPosPt < 175) {
    return 'dialogue';
  }

  // Left margin (< 130 pt)
  const isScenePrefix = STANDARD_SCENE_PREFIXES.some((p) => trimmed.toUpperCase().startsWith(p));
  if (isScenePrefix || (isUpper && isSceneHeadingPattern(trimmed))) {
    return 'scene_heading';
  }

  return 'action';
}

/**
 * Parses a PDF file (Uint8Array or ArrayBuffer) into a structured CanonicalScreenplayDocument.
 */
export async function parsePdf(
  data: Uint8Array | ArrayBuffer,
  options: ParsePdfOptions = {}
): Promise<CanonicalScreenplayDocument> {
  const warnings: CanonicalWarning[] = [];
  let uint8Data: Uint8Array;
  if (data instanceof ArrayBuffer) {
    uint8Data = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    uint8Data = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  } else {
    uint8Data = new Uint8Array(data);
  }

  if (uint8Data.byteLength === 0) {
    throw new Error('The selected PDF file is empty.');
  }

  let pdfDoc: pdfjs.PDFDocumentProxy | null = null;
  let numPages = 0;
  const pages: PdfPageData[] = [];
  let totalExtractedChars = 0;

  try {
    ensurePdfWorkerConfigured();
    const loadingTask = pdfjs.getDocument({
      data: uint8Data,
      useSystemFonts: true,
      disableFontFace: true,
    });
    pdfDoc = await loadingTask.promise;
    numPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent({ disableCombineTextItems: false } as any);

      const rawItems: RawPdfItem[] = [];
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const str = item.str;
          if (!str || str.trim().length === 0) continue;

          const transform = item.transform || [12, 0, 0, 12, 0, 0];
          const x = transform[4];
          const y = transform[5];
          const fontSize = Math.hypot(transform[0], transform[1]) || 12;

          rawItems.push({
            str,
            x,
            y,
            width: item.width || str.length * 7.2,
            height: item.height || fontSize,
            fontSize,
            fontName: item.fontName,
          });
          totalExtractedChars += str.trim().length;
        }
      }

      // Group items into lines by vertical coordinate y (tolerance 3.5 pt)
      const lines = groupItemsIntoLines(rawItems, viewport.width, viewport.height);
      const rawPageText = lines.map((l) => l.text).join('\n');

      pages.push({
        pageNumber: pageNum,
        width: viewport.width,
        height: viewport.height,
        lines,
        rawText: rawPageText,
      });
    }
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (err?.name === 'PasswordException' || /password|encrypted/i.test(errMsg)) {
      throw new Error('The selected PDF is password-protected or encrypted. Please provide an unencrypted screenplay.');
    }
    // If text layer could not be extracted (e.g. image-only PDF, mock buffer, or missing xref), warn for OCR
    warnings.push({
      id: 'pdf-scanned-image',
      severity: 'warning',
      message: `Failed to extract text layer from PDF: ${errMsg || 'Invalid or scanned PDF structure'}. Optical Character Recognition (OCR) is required.`,
    });
  }

  // 1. Scanned / image-based PDF detection
  if (totalExtractedChars < 40) {
    const scannedWarning =
      'Scanned / Image-based PDF detected: This PDF has no embedded text layer. Optical Character Recognition (OCR) is required to extract text from scanned images. Please import a text-based PDF, Fountain, or FDX file.';
    
    if (!warnings.some((w) => w.id === 'pdf-scanned-image')) {
      warnings.push({
        id: 'pdf-scanned-image',
        severity: 'warning',
        message: scannedWarning,
      });
    }

    const fallbackTitle = options.fileName?.replace(/\.[^/.]+$/, '') || 'Scanned Screenplay';
    return {
      id: generateElementId('doc'),
      metadata: { title: fallbackTitle },
      elements: [
        {
          id: generateElementId('act'),
          type: 'action',
          text: `[Scanned PDF document: "${options.fileName || 'screenplay.pdf'}" contains no extractable text layer.]`,
          confidence: 'ambiguous',
          classificationWarning: scannedWarning,
        },
      ],
      warnings,
      provenance: {
        sourceFormat: 'pdf',
        fileName: options.fileName,
        fileSize: options.fileSize || uint8Data.byteLength,
        importedAt: new Date().toISOString(),
        rawTextLength: 0,
        sourcePdfDataUrl: options.sourcePdfDataUrl,
      },
    };
  }

  // 2. Determine Title Page vs. Manuscript Body
  let titlePageData: ScreenplayTitlePage | undefined;
  let bodyStartPageIndex = 0;

  if (pages.length > 0) {
    const firstPage = pages[0];
    const isFirstPageTitle = isTitlePage(firstPage);

    if (isFirstPageTitle) {
      titlePageData = extractTitlePageData(firstPage);
      bodyStartPageIndex = 1; // Manuscript starts on page 2
    }
  }

  const metadata: ScreenplayMetadata = {
    title: titlePageData?.title || options.fileName?.replace(/\.[^/.]+$/, '') || 'Untitled Screenplay',
    author: titlePageData?.author,
    authors: titlePageData?.author ? [titlePageData.author] : [],
    credit: titlePageData?.credit,
    draftDate: titlePageData?.draftDate,
    contact: titlePageData?.contact,
    notes: titlePageData?.notes,
    copyright: titlePageData?.copyright,
    titlePage: titlePageData,
  };

  // 3. Classify Manuscript Elements from body pages
  const elements: CanonicalElement[] = [];

  for (let pIdx = bodyStartPageIndex; pIdx < pages.length; pIdx++) {
    const pageData = pages[pIdx];
    const bodyLines = filterRunningHeadersAndFooters(pageData.lines, pageData.height);

    if (elements.length > 0 && pIdx > bodyStartPageIndex) {
      elements.push({
        id: generateElementId('pb'),
        type: 'page_break',
        text: '===',
        confidence: 'high',
      });
    }

    let prevType: string | null = null;

    for (let lIdx = 0; lIdx < bodyLines.length; lIdx++) {
      const line = bodyLines[lIdx];
      const trimmed = line.text.trim();
      if (!trimmed) continue;

      const normX = normalizeX(line.x, pageData.width);
      const isUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

      const fmt = extractLineFormatting(line, pageData.pageNumber);

      // A. Scene Heading
      const isPrefixScene = STANDARD_SCENE_PREFIXES.some((p) =>
        trimmed.toUpperCase().startsWith(p)
      );
      const isForcedScene = trimmed.startsWith('.') && trimmed.length > 1;

      if (isPrefixScene || isForcedScene || (isUpper && normX <= 145 && isSceneHeadingPattern(trimmed))) {
        const cleanHeading = isForcedScene ? trimmed.slice(1).trim() : trimmed;
        const { text, sceneNumber } = extractSceneNumber(cleanHeading);
        const intExt = text.toUpperCase().startsWith('EXT') ? 'EXT' : 'INT';

        elements.push({
          id: generateElementId('scn'),
          type: 'scene_heading',
          text: text.toUpperCase(),
          sceneNumber,
          formatting: fmt.formatting,
          observedFormatting: fmt.observedFormatting,
          sceneProperties: {
            sceneNumber,
            intExt,
            isForced: isForcedScene,
          },
          confidence: 'high',
          rawSourceText: line.text,
        });
        prevType = 'scene_heading';
        continue;
      }

      // B. Transition
      const isTransitionMatch =
        normX >= 350 ||
        TRANSITION_PATTERNS.some((tp) => trimmed.toUpperCase().includes(tp)) ||
        (isUpper && trimmed.endsWith('TO:'));

      if (isTransitionMatch && normX >= 250) {
        const trnFmt = extractLineFormatting(line, pageData.pageNumber, 'right');
        elements.push({
          id: generateElementId('trn'),
          type: 'transition',
          text: trimmed.toUpperCase(),
          formatting: trnFmt.formatting,
          observedFormatting: trnFmt.observedFormatting,
          confidence: 'high',
          rawSourceText: line.text,
        });
        prevType = 'transition';
        continue;
      }

      // C. Parenthetical
      if (
        (normX >= 170 && normX <= 280 && trimmed.startsWith('(') && trimmed.endsWith(')')) ||
        (trimmed.startsWith('(') && trimmed.endsWith(')') && (prevType === 'character' || prevType === 'dialogue'))
      ) {
        elements.push({
          id: generateElementId('par'),
          type: 'parenthetical',
          text: trimmed,
          formatting: fmt.formatting,
          observedFormatting: fmt.observedFormatting,
          confidence: 'high',
          rawSourceText: line.text,
        });
        prevType = 'parenthetical';
        continue;
      }

      // D. Character Cue
      const isCharacterCue =
        normX >= 210 &&
        normX <= 340 &&
        isUpper &&
        trimmed.length <= 40 &&
        !trimmed.endsWith('.') &&
        !trimmed.endsWith(':');

      if (isCharacterCue) {
        const charName = trimmed.replace(/\s*\(.*\)$/, '').trim();
        const extensionMatch = trimmed.match(/\(([^)]+)\)/);
        const extensions = extensionMatch ? [extensionMatch[1].trim()] : undefined;

        elements.push({
          id: generateElementId('chr'),
          type: 'character',
          text: trimmed,
          formatting: fmt.formatting,
          observedFormatting: fmt.observedFormatting,
          characterProperties: {
            characterName: charName,
            extensions,
          },
          confidence: 'high',
          rawSourceText: line.text,
        });
        prevType = 'character';
        continue;
      }

      // E. Dialogue
      const isDialogueIndent = normX >= 135 && normX <= 250;
      const isDirectlyFollowingSpeaker = prevType === 'character' || prevType === 'parenthetical';

      if (isDirectlyFollowingSpeaker || (isDialogueIndent && prevType === 'dialogue')) {
        // Merge multiline dialogue under the same character if contiguous
        if (prevType === 'dialogue' && elements.length > 0 && elements[elements.length - 1].type === 'dialogue' && lIdx > 0) {
          const prevLine = bodyLines[lIdx - 1];
          const yDiff = Math.abs(line.y - prevLine.y);
          if (yDiff <= 18) {
            elements[elements.length - 1].text += ' ' + trimmed;
            prevType = 'dialogue';
            continue;
          }
        }

        elements.push({
          id: generateElementId('dia'),
          type: 'dialogue',
          text: trimmed,
          formatting: fmt.formatting,
          observedFormatting: fmt.observedFormatting,
          confidence: 'high',
          rawSourceText: line.text,
        });
        prevType = 'dialogue';
        continue;
      }

      // F. Shot
      if (normX <= 145 && isUpper && /^(ANGLE ON|CLOSE ON|WIDE SHOT|POV|INSERT|ESTABLISHING SHOT)/i.test(trimmed)) {
        elements.push({
          id: generateElementId('act'),
          type: 'action',
          text: trimmed.toUpperCase(),
          formatting: fmt.formatting,
          observedFormatting: fmt.observedFormatting,
          confidence: 'high',
          rawSourceText: line.text,
        });
        prevType = 'action';
        continue;
      }

      // G. Action / Description (Default for left-aligned body text)
      // Merge multiline action within regular line spacing
      if (prevType === 'action' && elements.length > 0 && elements[elements.length - 1].type === 'action' && lIdx > 0) {
        const prevLine = bodyLines[lIdx - 1];
        const yDiff = Math.abs(line.y - prevLine.y);
        if (yDiff <= 16 && normX <= 145) {
          elements[elements.length - 1].text += ' ' + trimmed;
          prevType = 'action';
          continue;
        }
      }

      elements.push({
        id: generateElementId('act'),
        type: 'action',
        text: trimmed,
        formatting: fmt.formatting,
        observedFormatting: fmt.observedFormatting,
        confidence: 'high',
        rawSourceText: line.text,
      });
      prevType = 'action';
    }
  }

  if (elements.length === 0) {
    elements.push({
      id: generateElementId('act'),
      type: 'action',
      text: '',
      confidence: 'high',
    });
  }

  const hasTitlePage = bodyStartPageIndex === 1;
  let titlePageLayout: ScreenplayPdfPageLayout | undefined;

  if (hasTitlePage && pages.length > 0) {
    const first = pages[0];
    titlePageLayout = {
      pageNumber: 1,
      width: first.width,
      height: first.height,
      isTitlePage: true,
      lines: first.lines.map((l, lIdx) => {
        const normX = normalizeX(l.x, first.width);
        const top = Math.max(0, first.height - l.y - (l.fontSize * 0.78));
        let lineType = 'general';
        const lower = l.text.toLowerCase();
        if (
          l.text === l.text.toUpperCase() &&
          l.text.length > 2 &&
          !lower.includes('written') &&
          !lower.includes('by')
        ) {
          lineType = 'title';
        } else if (/^(written\s+by|screenplay\s+by|by)\b/i.test(l.text)) {
          lineType = 'credit';
        } else if (lower.includes('@') || lower.includes('phone') || lower.includes('contact')) {
          lineType = 'contact';
        } else if (/^(draft|first draft|second draft|final draft|\d{4})/i.test(l.text)) {
          lineType = 'draftDate';
        } else {
          lineType = 'author';
        }
        return {
          id: `title-l${lIdx}`,
          text: l.text,
          type: lineType,
          x: l.x,
          top,
          width: Math.max(l.maxX - l.x, 20),
          height: l.fontSize * 1.25,
          fontSize: l.fontSize,
          fontFamily: resolveScreenplayFontFamily(l.fontName),
          fontWeight: /bold/i.test(l.fontName || '') || lineType === 'title' ? 'bold' : 'normal',
          isItalic: /italic|oblique/i.test(l.fontName || '') || lineType === 'credit',
          alignment: normX > 180 && normX < 360 ? 'center' : 'left',
        };
      }),
    };
  }

  const manuscriptPageLayouts: ScreenplayPdfPageLayout[] = [];
  for (let pIdx = bodyStartPageIndex; pIdx < pages.length; pIdx++) {
    const p = pages[pIdx];
    const pageNum = pIdx - bodyStartPageIndex + 1;
    let prevLineType = '';

    const lines: ScreenplayPdfLine[] = [];
    for (let lIdx = 0; lIdx < p.lines.length; lIdx++) {
      const l = p.lines[lIdx];
      const trimmed = l.text.trim();
      const normX = normalizeX(l.x, p.width);
      const isUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

      // Sub-pixel baseline alignment matching source PDF
      const top = Math.max(0, p.height - l.y - (l.fontSize * 0.78));

      let classifiedType = 'action';
      let sceneNumber: string | undefined;
      let characterName: string | undefined;

      const isScenePrefix = STANDARD_SCENE_PREFIXES.some((prefix) =>
        trimmed.toUpperCase().startsWith(prefix)
      );
      const isForcedScene = trimmed.startsWith('.') && trimmed.length > 1;

      if (isScenePrefix || isForcedScene || (isUpper && normX <= 145 && isSceneHeadingPattern(trimmed))) {
        classifiedType = 'scene_heading';
        const cleanHeading = isForcedScene ? trimmed.slice(1).trim() : trimmed;
        const extracted = extractSceneNumber(cleanHeading);
        sceneNumber = extracted.sceneNumber;
      } else if (
        normX >= 340 ||
        TRANSITION_PATTERNS.some((tp) => trimmed.toUpperCase().includes(tp)) ||
        (isUpper && trimmed.endsWith('TO:'))
      ) {
        classifiedType = 'transition';
      } else if (
        normX >= 210 &&
        normX <= 340 &&
        isUpper &&
        trimmed.length <= 40 &&
        !trimmed.endsWith('.') &&
        !trimmed.endsWith(':')
      ) {
        classifiedType = 'character';
        characterName = trimmed.replace(/\s*\(.*\)$/, '').trim();
      } else if (
        (normX >= 170 && normX <= 280 && trimmed.startsWith('(') && trimmed.endsWith(')')) ||
        (trimmed.startsWith('(') && trimmed.endsWith(')') && (prevLineType === 'character' || prevLineType === 'dialogue'))
      ) {
        classifiedType = 'parenthetical';
      } else if (
        prevLineType === 'character' ||
        prevLineType === 'parenthetical' ||
        (prevLineType === 'dialogue' && normX >= 130 && normX <= 260)
      ) {
        classifiedType = 'dialogue';
      } else if (normX >= 130 && normX <= 250) {
        classifiedType = 'dialogue';
      } else {
        classifiedType = 'action';
      }

      prevLineType = classifiedType;

      lines.push({
        id: `p${pageNum}-l${lIdx}`,
        text: l.text,
        type: classifiedType,
        sceneNumber,
        characterName,
        x: l.x,
        top,
        width: Math.max(l.maxX - l.x, 20),
        height: l.fontSize * 1.25,
        fontSize: l.fontSize,
        fontFamily: resolveScreenplayFontFamily(l.fontName),
        fontWeight: /bold/i.test(l.fontName || '') || classifiedType === 'scene_heading' ? 'bold' : 'normal',
        isItalic: /italic|oblique/i.test(l.fontName || '') || classifiedType === 'parenthetical',
        alignment: classifiedType === 'transition' ? 'right' : 'left',
      });
    }

    manuscriptPageLayouts.push({
      pageNumber: pageNum,
      width: p.width,
      height: p.height,
      isTitlePage: false,
      lines,
    });
  }

  const pdfDocumentLayout: ScreenplayPdfDocumentLayout = {
    pageWidth: pages[0]?.width || 612,
    pageHeight: pages[0]?.height || 792,
    pages: manuscriptPageLayouts,
    hasTitlePage,
    titlePage: titlePageLayout,
  };

  return {
    id: generateElementId('doc'),
    metadata,
    elements,
    warnings,
    provenance: {
      sourceFormat: 'pdf',
      fileName: options.fileName,
      fileSize: options.fileSize || uint8Data.byteLength,
      importedAt: new Date().toISOString(),
      rawTextLength: totalExtractedChars,
      sourcePdfDataUrl: options.sourcePdfDataUrl,
    },
    pdfLayout: pdfDocumentLayout,
  };
}

export const parsePdfToCanonical = (data: ArrayBuffer | Uint8Array, fileName?: string) =>
  parsePdf(data, { fileName });

// --------------------------------------------------------------------------
// Geometry and Classification Helper Functions
// --------------------------------------------------------------------------

function normalizeX(x: number, pageWidth: number): number {
  if (pageWidth <= 0) return x;
  return (x / pageWidth) * 612;
}

function groupItemsIntoLines(items: RawPdfItem[], _pageWidth: number, _pageHeight: number): PdfLine[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) <= 3.5) {
      return a.x - b.x;
    }
    return b.y - a.y;
  });

  const lines: PdfLine[] = [];
  let currentGroup: RawPdfItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= 3.5) {
      currentGroup.push(item);
    } else {
      lines.push(buildLine(currentGroup, currentY));
      currentGroup = [item];
      currentY = item.y;
    }
  }

  if (currentGroup.length > 0) {
    lines.push(buildLine(currentGroup, currentY));
  }

  return lines;
}

function buildLine(items: RawPdfItem[], y: number): PdfLine {
  items.sort((a, b) => a.x - b.x);

  let text = '';
  let minX = items[0].x;
  let maxX = items[0].x + items[0].width;
  let fontSize = items[0].fontSize;
  let fontName = items[0].fontName;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (i > 0) {
      const prev = items[i - 1];
      const gap = it.x - (prev.x + prev.width);
      if (gap > 2.0) {
        text += ' ';
      }
    }
    text += it.str;
    if (it.x + it.width > maxX) {
      maxX = it.x + it.width;
    }
  }

  return {
    text: text.trim(),
    x: minX,
    y,
    maxX,
    fontSize,
    fontName,
    items,
  };
}

function filterRunningHeadersAndFooters(lines: PdfLine[], pageHeight: number): PdfLine[] {
  return lines.filter((l) => {
    const trimmed = l.text.trim();
    if (l.y > pageHeight - 54 && /^(page\s*)?\d+\.?$/i.test(trimmed)) {
      return false;
    }
    if (l.y < 45 && /^(page\s*)?\d+\.?$/i.test(trimmed)) {
      return false;
    }
    return true;
  });
}

function isTitlePage(page: PdfPageData): boolean {
  if (page.lines.length === 0) return false;

  for (const line of page.lines) {
    const upper = line.text.trim().toUpperCase();
    if (STANDARD_SCENE_PREFIXES.some((p) => upper.startsWith(p))) {
      return false;
    }
  }

  if (page.lines.length <= 16) {
    const textAll = page.lines.map((l) => l.text.toLowerCase()).join(' ');
    if (
      textAll.includes('written by') ||
      textAll.includes('screenplay by') ||
      textAll.includes('by ') ||
      textAll.includes('draft') ||
      textAll.includes('contact:') ||
      textAll.includes('@')
    ) {
      return true;
    }
  }

  return false;
}

function extractTitlePageData(page: PdfPageData): ScreenplayTitlePage {
  const lines = page.lines.map((l) => l.text.trim()).filter(Boolean);
  const result: ScreenplayTitlePage = { customLines: lines };

  let title = '';
  let credit = '';
  let author = '';
  let draftDate = '';
  const contactLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (/^(written\s+by|screenplay\s+by|by)\b/i.test(line)) {
      credit = line;
      if (i + 1 < lines.length && !author) {
        author = lines[i + 1];
      }
      continue;
    }

    if (/^(draft|first draft|second draft|final draft|shooting draft|\d{4}-\d{2}-\d{2}|\b[a-z]+\s+\d{1,2},\s+\d{4})/i.test(line)) {
      draftDate = line;
      continue;
    }

    if (lower.includes('@') || lower.includes('phone:') || lower.includes('email:') || lower.includes('contact:')) {
      contactLines.push(line);
      continue;
    }

    if (!title && line.length > 2 && line === line.toUpperCase()) {
      title = line;
    }
  }

  result.title = title || lines[0] || 'Untitled Screenplay';
  result.credit = credit || 'Written by';
  result.author = author || '';
  result.draftDate = draftDate;
  result.contact = contactLines.join('\n');

  return result;
}

function extractSceneNumber(slugline: string): { text: string; sceneNumber?: string } {
  const hashMatch = slugline.match(/#([^#]+)#\s*$/);
  if (hashMatch) {
    return {
      text: slugline.replace(/\s*#[^#]+#\s*$/, '').trim(),
      sceneNumber: hashMatch[1].trim(),
    };
  }

  const leadingNumMatch = slugline.match(/^(\d+[A-Z]?)\.?\s+(INT|EXT|INT\/EXT|I\/E)/i);
  if (leadingNumMatch) {
    return {
      text: slugline.slice(leadingNumMatch[1].length).replace(/^\.?\s+/, '').trim(),
      sceneNumber: leadingNumMatch[1].trim(),
    };
  }

  return { text: slugline };
}

function isSceneHeadingPattern(text: string): boolean {
  return /^(INT|EXT|INT\/EXT|I\/E|EST)\b/i.test(text);
}
