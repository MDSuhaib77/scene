/**
 * PDF Export Service for Screenplay Documents
 *
 * Generates genuine, industry-compliant US Letter PDF documents directly
 * in the client with standard screenplay typography and margin conventions:
 * - 8.5" x 11" US Letter format (612 x 792 points)
 * - Standard Courier & Courier-Bold typography (10 cpi, 12pt font, 12pt leading)
 * - Standard screenplay margins:
 *     Left margin: 1.5 inches (108 pt)
 *     Right margin: 1.0 inch (72 pt from right edge, x = 540 pt)
 *     Top/Bottom margins: 1.0 inch (72 pt, printable height = 648 pt / 54 lines)
 * - Standard element horizontal alignments:
 *     Scene Heading: 1.5" (108 pt), uppercase, bold
 *     Action: 1.5" (108 pt), width ~6.0" (432 pt / 60 chars)
 *     Character: 3.7" (266.4 pt), uppercase
 *     Dialogue: 2.5" (180 pt), width ~3.5" (252 pt / 35 chars)
 *     Parenthetical: 3.1" (223.2 pt), width ~2.5" (180 pt / 25 chars)
 *     Transition: 5.5" (396 pt) or right-aligned (x = 540 pt)
 * - Separate Title Page with centered title & author, bottom-left contact
 * - Running headers with page numbers on Page 2+
 */

import { JSONContent } from '@tiptap/react';
import { deserializeScreenplayDocument } from '../commands/screenplayCommands';
import { ScreenplayPdfDocumentLayout } from '../../../types';

export interface ScreenplayPdfExportOptions {
  title?: string;
  author?: string;
  draftDate?: string;
  contact?: string;
  includeTitlePage?: boolean;
  pdfLayout?: ScreenplayPdfDocumentLayout;
}

interface ScreenplayPrintLine {
  text: string;
  x: number;
  isBold?: boolean;
}

interface ScreenplayPdfPage {
  pageNumber: number; // 0 for title page, 1..N for body
  isTitlePage?: boolean;
  lines: Array<{
    y: number;
    print: ScreenplayPrintLine[];
  }>;
}

/**
 * Word wraps a text string to a maximum character count.
 */
function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      if (word.length > maxChars) {
        // Chunk overly long words
        let remaining = word;
        while (remaining.length > maxChars) {
          lines.push(remaining.slice(0, maxChars));
          remaining = remaining.slice(maxChars);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    } else if (currentLine.length + 1 + word.length <= maxChars) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Extracts plain text from a JSONContent node.
 */
function extractNodeText(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractNodeText).join('');
  }
  return '';
}

/**
 * Escapes characters for PDF string literals.
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Lays out screenplay blocks into paginated US Letter pages.
 */
function layoutScreenplayToPages(
  docOrJson: JSONContent | string,
  options: ScreenplayPdfExportOptions = {}
): ScreenplayPdfPage[] {
  const doc: JSONContent =
    typeof docOrJson === 'string'
      ? deserializeScreenplayDocument(docOrJson, '')
      : docOrJson;

  const pages: ScreenplayPdfPage[] = [];

  // If a source-faithful PDF layout is present, export exactly using its page geometry and line positions
  if (options.pdfLayout && options.pdfLayout.pages.length > 0) {
    if (options.includeTitlePage !== false && options.pdfLayout.hasTitlePage && options.pdfLayout.titlePage) {
      const tp = options.pdfLayout.titlePage;
      pages.push({
        pageNumber: 0,
        isTitlePage: true,
        lines: tp.lines.map((l) => ({
          y: Math.max(36, tp.height - l.top - l.fontSize),
          print: [
            {
              text: l.text,
              x: l.x,
              isBold: l.fontWeight === 'bold' || l.type === 'title',
            },
          ],
        })),
      });
    }

    for (const p of options.pdfLayout.pages) {
      pages.push({
        pageNumber: p.pageNumber,
        isTitlePage: false,
        lines: p.lines.map((l) => ({
          y: Math.max(36, p.height - l.top - l.fontSize),
          print: [
            {
              text: l.text,
              x: l.x,
              isBold: l.fontWeight === 'bold' || l.type === 'scene_heading',
            },
          ],
        })),
      });
    }

    return pages;
  }

  // 1. Title Page (if requested or metadata present)
  const title = (options.title || 'Untitled Screenplay').trim();
  const author = (options.author || '').trim();
  const draftDate = options.draftDate || new Date().toISOString().slice(0, 10);
  const contact = (options.contact || '').trim();

  const includeTitlePage = options.includeTitlePage ?? Boolean(title || author);
  if (includeTitlePage) {
    const titlePage: ScreenplayPdfPage = {
      pageNumber: 0,
      isTitlePage: true,
      lines: [],
    };

    // Centered Title at y = 460
    const titleLines = wrapText(title.toUpperCase(), 40);
    let curY = 480;
    for (const tLine of titleLines) {
      const charWidth = 7.2;
      const textWidth = tLine.length * charWidth;
      const centeredX = Math.max(108, (612 - textWidth) / 2);
      titlePage.lines.push({
        y: curY,
        print: [{ text: tLine, x: centeredX, isBold: true }],
      });
      curY -= 16;
    }

    if (author) {
      curY -= 20;
      const byText = 'Written by';
      titlePage.lines.push({
        y: curY,
        print: [{ text: byText, x: (612 - byText.length * 7.2) / 2 }],
      });
      curY -= 16;
      titlePage.lines.push({
        y: curY,
        print: [{ text: author, x: (612 - author.length * 7.2) / 2, isBold: true }],
      });
    }

    // Bottom Left Contact & Draft metadata
    let bottomY = 140;
    if (draftDate) {
      titlePage.lines.push({
        y: bottomY,
        print: [{ text: `Draft Date: ${draftDate}`, x: 108 }],
      });
      bottomY -= 14;
    }
    if (contact) {
      const contactLines = contact.split('\n');
      for (const cLine of contactLines) {
        if (cLine.trim()) {
          titlePage.lines.push({
            y: bottomY,
            print: [{ text: cLine.trim(), x: 108 }],
          });
          bottomY -= 14;
        }
      }
    }

    pages.push(titlePage);
  }

  // 2. Manuscript Body Layout
  // US Letter: 612 x 792 pt. Top margin = 72 pt (y = 720). Bottom margin = 72 pt (y = 72).
  // Line leading = 12 pt. Total 54 lines.
  const TOP_Y = 720;
  const BOTTOM_Y = 72;
  const LINE_HEIGHT = 12;

  let currentBodyPageNumber = 1;
  let currentPage: ScreenplayPdfPage = {
    pageNumber: currentBodyPageNumber,
    isTitlePage: false,
    lines: [],
  };
  let currentY = TOP_Y;

  const startNewPage = () => {
    pages.push(currentPage);
    currentBodyPageNumber += 1;
    currentPage = {
      pageNumber: currentBodyPageNumber,
      isTitlePage: false,
      lines: [],
    };
    currentY = TOP_Y;
  };

  const blocks = doc.content ?? [];

  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const block = blocks[bIdx];
    const rawText = extractNodeText(block).trim();
    if (!rawText) continue;

    const blockType = block.type || 'action';

    // Layout configuration per element type
    let xOffset = 108; // 1.5 inches
    let maxChars = 60; // 60 chars = 432 pt
    let isBold = false;
    let isUppercase = false;
    let blankBefore = true;

    switch (blockType) {
      case 'sceneHeading':
        xOffset = 108;
        maxChars = 60;
        isBold = true;
        isUppercase = true;
        blankBefore = true;
        break;

      case 'character':
        xOffset = 266.4; // 3.7 inches
        maxChars = 38;
        isUppercase = true;
        blankBefore = true;
        break;

      case 'parenthetical':
        xOffset = 223.2; // 3.1 inches
        maxChars = 25;
        blankBefore = false;
        break;

      case 'dialogue':
        xOffset = 180; // 2.5 inches
        maxChars = 35;
        blankBefore = false;
        break;

      case 'transition':
        isUppercase = true;
        blankBefore = true;
        maxChars = 25;
        // Right margin aligned
        xOffset = Math.max(396, 540 - rawText.length * 7.2);
        break;

      case 'shot':
      case 'actHeading':
      case 'sequenceHeading':
        xOffset = 108;
        maxChars = 60;
        isUppercase = true;
        isBold = true;
        blankBefore = true;
        break;

      case 'action':
      case 'generalText':
      default:
        xOffset = 108;
        maxChars = 60;
        blankBefore = true;
        break;
    }

    const formattedText = isUppercase ? rawText.toUpperCase() : rawText;
    const wrappedLines = wrapText(formattedText, maxChars);
    if (wrappedLines.length === 0) continue;

    // Blank line before element (if not at top of page)
    if (blankBefore && currentY < TOP_Y) {
      currentY -= LINE_HEIGHT;
    }

    // Orphan prevention:
    // If scene heading or character cannot fit at least heading + 1 line, or char + 1 line dialogue, break page
    const requiredLines =
      blockType === 'sceneHeading' || blockType === 'character' ? 3 : 1;
    if (currentY - requiredLines * LINE_HEIGHT < BOTTOM_Y) {
      startNewPage();
    }

    // Print lines
    for (const lineText of wrappedLines) {
      if (currentY - LINE_HEIGHT < BOTTOM_Y) {
        startNewPage();
      }

      currentPage.lines.push({
        y: currentY,
        print: [{ text: lineText, x: xOffset, isBold }],
      });
      currentY -= LINE_HEIGHT;
    }
  }

  // Add the final page if it contains lines
  if (currentPage.lines.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  return pages;
}

/**
 * Builds an authentic, binary-safe PDF 1.4 document from laid-out screenplay pages.
 */
function compilePdfDocument(pages: ScreenplayPdfPage[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const textEncoder = new TextEncoder();

  function pushString(str: string) {
    chunks.push(textEncoder.encode(str));
  }

  // Track object byte offsets for xref table
  const objectOffsets: number[] = [];
  let currentByteOffset = 0;

  function writeBytes(bytes: Uint8Array) {
    chunks.push(bytes);
    currentByteOffset += bytes.length;
  }

  function writeString(str: string) {
    const encoded = textEncoder.encode(str);
    writeBytes(encoded);
  }

  function startObject(objId: number) {
    objectOffsets[objId] = currentByteOffset;
    writeString(`${objId} 0 obj\n`);
  }

  function endObject() {
    writeString('endobj\n');
  }

  // 1. PDF Header
  writeString('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Object indices:
  // 1: Catalog
  // 2: Pages root
  // 3: Font /Courier
  // 4: Font /Courier-Bold
  // 5..(4 + N): Page objects
  // (5 + N)..(4 + 2N): Content stream objects
  const pageCount = pages.length;
  const FONT_REGULAR_ID = 3;
  const FONT_BOLD_ID = 4;
  const FIRST_PAGE_ID = 5;
  const FIRST_STREAM_ID = FIRST_PAGE_ID + pageCount;

  // Obj 1: Catalog
  startObject(1);
  writeString('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();

  // Obj 2: Pages root
  const pageKids = Array.from({ length: pageCount }, (_, i) => `${FIRST_PAGE_ID + i} 0 R`).join(' ');
  startObject(2);
  writeString(`<< /Type /Pages /Kids [${pageKids}] /Count ${pageCount} >>\n`);
  endObject();

  // Obj 3: Courier Font
  startObject(FONT_REGULAR_ID);
  writeString('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\n');
  endObject();

  // Obj 4: Courier-Bold Font
  startObject(FONT_BOLD_ID);
  writeString('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>\n');
  endObject();

  // Obj 5..(4 + N): Page objects
  for (let i = 0; i < pageCount; i++) {
    const pageObjId = FIRST_PAGE_ID + i;
    const streamObjId = FIRST_STREAM_ID + i;

    startObject(pageObjId);
    writeString(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] `);
    writeString(`/Resources << /Font << /F1 ${FONT_REGULAR_ID} 0 R /F2 ${FONT_BOLD_ID} 0 R >> >> `);
    writeString(`/Contents ${streamObjId} 0 R >>\n`);
    endObject();
  }

  // Obj (5 + N)..(4 + 2N): Content Streams
  for (let i = 0; i < pageCount; i++) {
    const streamObjId = FIRST_STREAM_ID + i;
    const page = pages[i];

    // Build PDF content commands
    let streamCommands = '';

    // Running page number on body pages (pageNumber >= 2)
    if (!page.isTitlePage && page.pageNumber >= 2) {
      const pageNumStr = `${page.pageNumber}.`;
      // Right margin at 540 pt
      const pageNumX = 540 - pageNumStr.length * 7.2;
      streamCommands += `BT /F1 12 Tf 1 0 0 1 ${pageNumX.toFixed(2)} 756 Tm (${escapePdfText(pageNumStr)}) Tj ET\n`;
    }

    // Page text lines
    for (const line of page.lines) {
      for (const printItem of line.print) {
        const fontName = printItem.isBold ? '/F2' : '/F1';
        const escaped = escapePdfText(printItem.text);
        streamCommands += `BT ${fontName} 12 Tf 1 0 0 1 ${printItem.x.toFixed(2)} ${line.y.toFixed(2)} Tm (${escaped}) Tj ET\n`;
      }
    }

    const streamBytes = textEncoder.encode(streamCommands);

    startObject(streamObjId);
    writeString(`<< /Length ${streamBytes.length} >>\nstream\n`);
    writeBytes(streamBytes);
    writeString('\nendstream\n');
    endObject();
  }

  // Cross Reference Table (xref)
  const totalObjects = FIRST_STREAM_ID + pageCount;
  const xrefOffset = currentByteOffset;

  writeString(`xref\n0 ${totalObjects}\n`);
  writeString('0000000000 65535 f \n');

  for (let id = 1; id < totalObjects; id++) {
    const offset = objectOffsets[id] || 0;
    const offsetStr = offset.toString().padStart(10, '0');
    writeString(`${offsetStr} 00000 n \n`);
  }

  // Trailer
  writeString(`trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  // Concatenate all chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
}

/**
 * Main export function: Converts a Screenplay JSONContent or raw text into a valid PDF Uint8Array.
 */
export function exportScreenplayToPdf(
  docOrJson: JSONContent | string,
  options: ScreenplayPdfExportOptions = {}
): Uint8Array {
  const pages = layoutScreenplayToPages(docOrJson, options);
  return compilePdfDocument(pages);
}
