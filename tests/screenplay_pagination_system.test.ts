import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SCREENPLAY_SCHEMA_EXTENSIONS } from '../src/features/screenplay/schema/screenplayExtensions';
import {
  deserializeScreenplayDocument,
  extractScreenplayPlainText,
  setScreenplayElement,
  executeDualDialogueCommand,
  insertScreenplayImage,
} from '../src/features/screenplay/commands/screenplayCommands';
import {
  US_LETTER_PAGE_CONFIG,
  DEFAULT_SCREENPLAY_PAGE_CONFIG,
  SCREENPLAY_ELEMENT_LAYOUT_METRICS,
} from '../src/features/screenplay/layout/screenplayPageConfig';
import {
  computeScreenplayPagination,
  getPageNumberForPos,
  wrapScreenplayTextLines,
} from '../src/features/screenplay/layout/screenplayPaginationEngine';

function createPaginatedHeadlessEditor(initialText = '') {
  const initialDoc = deserializeScreenplayDocument(null, initialText);
  return new Editor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
      }),
      ...SCREENPLAY_SCHEMA_EXTENSIONS,
    ],
    content: initialDoc,
  });
}

describe('Screenplay Pagination & Manuscript Layout System (Prompt 03)', () => {
  it('centralizes US Letter (8.5 x 11 in = 816 x 1056 px) geometry and screenplay margins', () => {
    expect(DEFAULT_SCREENPLAY_PAGE_CONFIG).toEqual(US_LETTER_PAGE_CONFIG);
    expect(US_LETTER_PAGE_CONFIG.widthInches).toBe(8.5);
    expect(US_LETTER_PAGE_CONFIG.heightInches).toBe(11);
    expect(US_LETTER_PAGE_CONFIG.dpi).toBe(96);
    expect(US_LETTER_PAGE_CONFIG.pageWidthPx).toBe(816);
    expect(US_LETTER_PAGE_CONFIG.pageHeightPx).toBe(1056);

    // Margins: Left 1.5in (144px), Right 1.0in (96px), Top 1.0in (96px), Bottom 1.0in (96px)
    expect(US_LETTER_PAGE_CONFIG.marginLeftPx).toBe(144);
    expect(US_LETTER_PAGE_CONFIG.marginRightPx).toBe(96);
    expect(US_LETTER_PAGE_CONFIG.marginTopPx).toBe(96);
    expect(US_LETTER_PAGE_CONFIG.marginBottomPx).toBe(96);

    // Usable writing area: 576 x 864 px (6.0 x 9.0 in)
    expect(US_LETTER_PAGE_CONFIG.contentWidthPx).toBe(576);
    expect(US_LETTER_PAGE_CONFIG.contentHeightPx).toBe(864);

    // Dialogue column is narrower than Action column due to screenplay indentation
    expect(SCREENPLAY_ELEMENT_LAYOUT_METRICS.dialogue.usableWidthPx).toBeLessThan(
      SCREENPLAY_ELEMENT_LAYOUT_METRICS.action.usableWidthPx
    );
    expect(SCREENPLAY_ELEMENT_LAYOUT_METRICS.parenthetical.usableWidthPx).toBeLessThan(
      SCREENPLAY_ELEMENT_LAYOUT_METRICS.dialogue.usableWidthPx
    );
  });

  it('paginates based on wrapped line height and element measure rather than fixed paragraph count', () => {
    // 10 short 1-line action blocks easily fit on a single page (10 * 20px + 9 * 14px = 326px < 864px)
    const shortParagraphs = Array.from(
      { length: 10 },
      (_, i) => `Short action beat ${i + 1}.`
    ).join('\n\n');
    const editorShort = createPaginatedHeadlessEditor(shortParagraphs);
    const shortPagination = computeScreenplayPagination(editorShort.state.doc);
    expect(shortPagination.pageCount).toBe(1);

    // 10 multi-line paragraphs (each ~6 lines = 120px + 14px gap = 134px -> 10 blocks > 864px) span 2 pages
    const multiLineSentence =
      'The heavy rain hammers against the corrugated roof of Soundstage Four as grips secure the overhead diffusion frames and cables.';
    const longParagraphs = Array.from(
      { length: 10 },
      () => `${multiLineSentence} ${multiLineSentence}`
    ).join('\n\n');
    const editorLong = createPaginatedHeadlessEditor(longParagraphs);
    const longPagination = computeScreenplayPagination(editorLong.state.doc);
    expect(longPagination.pageCount).toBe(2);
    expect(longPagination.pages[0].pageNumber).toBe(1);
    expect(longPagination.pages[1].pageNumber).toBe(2);

    editorShort.destroy();
    editorLong.destroy();
  });

  it('prevents stranding a Character Cue or Parenthetical at the bottom of a page without its Dialogue', () => {
    // Fill Page 1 so ~48px remains at the bottom — enough for a 1-line MARA cue (20px + 14px = 34px),
    // but NOT enough for MARA + Parenthetical + Dialogue!
    const fillerLine =
      'A steady tracking shot follows the cable run along the catwalk above the set.';
    // 12 blocks of 2 lines (40px each) + 11 gaps (14px each) = 480 + 154 = 634px
    // Add 4 more 2-line blocks: + 4 * 54 = 216px -> 850px, or 3 blocks -> 634 + 162 = 796px (68px left)
    const fillerBlocks = Array.from(
      { length: 15 },
      (_, idx) => `Beat ${idx + 1}: ${fillerLine}`
    ).join('\n\n');

    const script = `${fillerBlocks}\n\nMARA\n(into headset)\nHold the crane on mark three until the rain towers reach full pressure.`;
    const editor = createPaginatedHeadlessEditor(script);
    const pagination = computeScreenplayPagination(editor.state.doc);

    expect(pagination.pageCount).toBe(2);

    // Find the character, parenthetical, and dialogue blocks
    const charBlock = pagination.blocks.find((b) => b.type === 'character');
    const parenBlock = pagination.blocks.find((b) => b.type === 'parenthetical');
    const dlgBlock = pagination.blocks.find((b) => b.type === 'dialogue');

    expect(charBlock).toBeDefined();
    expect(parenBlock).toBeDefined();
    expect(dlgBlock).toBeDefined();

    // All three must start on Page 2 together rather than stranding MARA on Page 1
    expect(pagination.blockPageMap.get(charBlock!.pos)).toBe(2);
    expect(pagination.blockPageMap.get(parenBlock!.pos)).toBe(2);
    expect(pagination.blockPageMap.get(dlgBlock!.pos)).toBe(2);

    editor.destroy();
  });

  it('keeps a Scene Heading with its immediately following Action block at a page boundary', () => {
    const fillerLine =
      'Technicians calibrate the high-speed phantom camera on the north dolly track.';
    const fillerBlocks = Array.from(
      { length: 15 },
      (_, idx) => `Setup ${idx + 1}: ${fillerLine}`
    ).join('\n\n');

    const script = `${fillerBlocks}\n\nINT. CONTROL BOOTH - NIGHT\n\nJulian watches the waveform monitors flicker in the dark booth.`;
    const editor = createPaginatedHeadlessEditor(script);
    const pagination = computeScreenplayPagination(editor.state.doc);

    expect(pagination.pageCount).toBe(2);

    const sceneBlock = pagination.blocks.find((b) => b.type === 'sceneHeading');
    const followingAction = pagination.blocks[pagination.blocks.length - 1];

    expect(sceneBlock).toBeDefined();
    expect(pagination.blockPageMap.get(sceneBlock!.pos)).toBe(2);
    expect(pagination.blockPageMap.get(followingAction.pos)).toBe(2);

    editor.destroy();
  });

  it('allows long Action paragraphs and oversized single paragraphs to continue across pages without infinite loops', () => {
    // Create a massive 100-line single paragraph (> 2000px tall, spanning 3 pages)
    const hugeParagraph = Array.from(
      { length: 95 },
      (_, i) => `Continuous action sequence line ${i + 1} across the flooded soundstage floor.`
    ).join(' ');

    const editor = createPaginatedHeadlessEditor(hugeParagraph);
    const pagination = computeScreenplayPagination(editor.state.doc);

    expect(pagination.pageCount).toBeGreaterThanOrEqual(3);
    expect(pagination.inlineBreakSpacers.length).toBeGreaterThanOrEqual(2);
    // Content is 100% preserved
    expect(extractScreenplayPlainText(editor.state.doc)).toBe(hugeParagraph);

    editor.destroy();
  });

  it('keeps compact Dual Dialogue blocks intact on the next page when near a page boundary', () => {
    const fillerLine =
      'Rainwater cascades down the iron fire escape into the narrow cobblestone lane.';
    const fillerBlocks = Array.from(
      { length: 15 },
      (_, idx) => `Action ${idx + 1}: ${fillerLine}`
    ).join('\n\n');

    const script = `${fillerBlocks}\n\nMARA\nRoll sound on A and B cameras.\n\nJULIAN\nBackground action, set the rain curtain.`;
    const editor = createPaginatedHeadlessEditor(script);

    // Position cursor inside JULIAN's dialogue and trigger Dual Dialogue command
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    executeDualDialogueCommand(editor as any);

    const pagination = computeScreenplayPagination(editor.state.doc);
    const dualBlock = pagination.blocks.find((b) => b.type === 'dualDialogue');
    expect(dualBlock).toBeDefined();
    expect(pagination.blockPageMap.get(dualBlock!.pos)).toBe(2);

    editor.destroy();
  });

  it('preserves continuous editing, element conversion, and page numbering across page boundaries', () => {
    const fillerLine =
      'The camera crane rises above the neon-lit street set toward the third-floor window.';
    const multiPageScript = Array.from(
      { length: 22 },
      (_, idx) => `Beat ${idx + 1}: ${fillerLine}`
    ).join('\n\n');

    const editor = createPaginatedHeadlessEditor(multiPageScript);
    const paginationBefore = computeScreenplayPagination(editor.state.doc);
    expect(paginationBefore.pageCount).toBe(2);
    expect(paginationBefore.pages[0].showPageNumber).toBe(true);
    expect(paginationBefore.pages[1].showPageNumber).toBe(true);

    // Verify optional title-page convention flag suppresses page number on page 1 only
    const titlePagePagination = computeScreenplayPagination(editor.state.doc, {
      hideFirstPageNumber: true,
    });
    expect(titlePagePagination.pages[0].showPageNumber).toBe(false);
    expect(titlePagePagination.pages[1].showPageNumber).toBe(true);

    // Move cursor to the last block on Page 2, convert it to Transition, and type text
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const endCursorPos = editor.state.selection.from;
    expect(getPageNumberForPos(paginationBefore, endCursorPos)).toBe(2);

    setScreenplayElement(editor as any, 'transition');
    const paginationAfter = computeScreenplayPagination(editor.state.doc);
    const lastBlock = paginationAfter.blocks[paginationAfter.blocks.length - 1];
    expect(lastBlock.type).toBe('transition');
    expect(paginationAfter.pageCount).toBe(2);

    editor.destroy();
  });

  it('accounts for screenplayImage dimensions in pagination calculations', () => {
    const fillerLine =
      'Production designers inspect the miniature scale model on the workshop table.';
    const fillerBlocks = Array.from(
      { length: 14 },
      (_, idx) => `Note ${idx + 1}: ${fillerLine}`
    ).join('\n\n');

    const editor = createPaginatedHeadlessEditor(fillerBlocks);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    insertScreenplayImage(editor as any, {
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      alt: 'Stage Blueprint',
      caption: 'Stage Blueprint',
    });

    const pagination = computeScreenplayPagination(editor.state.doc);
    const imgBlock = pagination.blocks.find((b) => b.type === 'screenplayImage');
    expect(imgBlock).toBeDefined();
    expect(imgBlock!.heightPx).toBeGreaterThan(200);
    // Image overflows remaining space on Page 1 and moves cleanly to Page 2
    expect(pagination.blockPageMap.get(imgBlock!.pos)).toBe(2);

    editor.destroy();
  });
});
