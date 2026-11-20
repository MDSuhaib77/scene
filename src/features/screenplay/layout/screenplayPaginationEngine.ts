import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ScreenplayElementType } from '../schema/screenplayExtensions';
import {
  DEFAULT_SCREENPLAY_PAGE_CONFIG,
  SCREENPLAY_ELEMENT_LAYOUT_METRICS,
  ScreenplayPageConfig,
  getIntrinsicMarginTopPx,
} from './screenplayPageConfig';

export interface WrappedLineSpan {
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface ScreenplayMeasuredBlock {
  index: number;
  pos: number;
  endPos: number;
  nodeSize: number;
  type: ScreenplayElementType;
  text: string;
  wrappedLines: WrappedLineSpan[];
  lineCount: number;
  heightPx: number;
  intrinsicMarginTopPx: number;
  pageBreakBefore?: boolean;
}

export interface ScreenplayPageDescriptor {
  pageNumber: number;
  pageIndex: number;
  startPos: number;
  endPos: number;
  usedHeightPx: number;
  remainingHeightPx: number;
  showPageNumber: boolean;
  blockPositions: number[];
}

export interface ScreenplayBlockBreakOffset {
  pos: number;
  nodeSize: number;
  pageNumber: number;
  marginTopPx: number;
}

export interface ScreenplayInlineBreakSpacer {
  pos: number;
  blockPos: number;
  pageNumber: number;
  spacerHeightPx: number;
}

export interface ScreenplayPaginationResult {
  config: ScreenplayPageConfig;
  pageCount: number;
  pages: ScreenplayPageDescriptor[];
  blocks: ScreenplayMeasuredBlock[];
  /** Maps top-level block `pos` -> starting 1-indexed `pageNumber` */
  blockPageMap: Map<number, number>;
  /** Block-level page-break offsets (`Decoration.node`) keyed by block `pos` */
  blockBreakOffsets: Map<number, ScreenplayBlockBreakOffset>;
  /** Intra-paragraph continuation spacers (`Decoration.widget`) for long split paragraphs */
  inlineBreakSpacers: ScreenplayInlineBreakSpacer[];
  /** Compact deterministic signature used to skip redundant decoration transactions */
  signature: string;
}

export interface ComputeScreenplayPaginationOptions {
  config?: ScreenplayPageConfig;
  /** Optional map of block `pos` -> intrinsic DOM `offsetHeight` in CSS pixels */
  domBlockHeights?: Map<number, number>;
  /** Optional title-page convention flag to suppress page number on Page 1 */
  hideFirstPageNumber?: boolean;
}

/** Minimum height of a paragraph (in px) before we allow splitting it across pages instead of moving intact */
const LONG_PARAGRAPH_SPLIT_THRESHOLD_PX = 160; // 8 lines @ 20px/line
/** Minimum lines that must fit on the bottom of the current page to split a long paragraph */
const MIN_LINES_BEFORE_SPLIT = 3;
/** Minimum lines that must carry over to the next page when splitting a long paragraph */
const MIN_LINES_AFTER_SPLIT = 3;

/**
 * Word-wraps a string into lines of at most `charsPerLine` characters,
 * returning exact character offset spans (`startOffset`, `endOffset`) within `text`.
 * Respects explicit `\n` line breaks as well as whitespace word boundaries.
 */
export function wrapScreenplayTextLines(
  text: string,
  charsPerLine: number
): WrappedLineSpan[] {
  const safeMax = Math.max(10, charsPerLine);
  if (!text || text.length === 0) {
    return [{ text: '', startOffset: 0, endOffset: 0 }];
  }

  const spans: WrappedLineSpan[] = [];
  let cursor = 0;
  const len = text.length;

  while (cursor <= len) {
    const nextNewline = text.indexOf('\n', cursor);
    const hardEnd = nextNewline === -1 ? len : nextNewline;
    const segmentLen = hardEnd - cursor;

    if (segmentLen <= safeMax) {
      spans.push({
        text: text.slice(cursor, hardEnd),
        startOffset: cursor,
        endOffset: hardEnd,
      });
      if (nextNewline === -1) {
        break;
      }
      cursor = nextNewline + 1;
      continue;
    }

    // Wrap long segment within [cursor, hardEnd]
    let segStart = cursor;
    while (hardEnd - segStart > safeMax) {
      const maxSliceEnd = segStart + safeMax;
      let breakAt = -1;
      for (let i = maxSliceEnd; i > segStart; i--) {
        const ch = text.charCodeAt(i);
        if (ch === 32 || ch === 9) {
          breakAt = i;
          break;
        }
      }

      if (breakAt === -1) {
        // Unbroken token longer than line width: break at safeMax
        spans.push({
          text: text.slice(segStart, maxSliceEnd),
          startOffset: segStart,
          endOffset: maxSliceEnd,
        });
        segStart = maxSliceEnd;
      } else {
        spans.push({
          text: text.slice(segStart, breakAt),
          startOffset: segStart,
          endOffset: breakAt + 1,
        });
        segStart = breakAt + 1;
      }
    }

    if (segStart <= hardEnd) {
      spans.push({
        text: text.slice(segStart, hardEnd),
        startOffset: segStart,
        endOffset: hardEnd,
      });
    }

    if (nextNewline === -1) {
      break;
    }
    cursor = nextNewline + 1;
  }

  return spans.length > 0 ? spans : [{ text: '', startOffset: 0, endOffset: 0 }];
}

/**
 * Estimates the intrinsic rendered height of a top-level ProseMirror node using
 * centralized screenplay typography metrics when live DOM measurement is unavailable
 * (or as a baseline reference).
 */
export function estimateNodeIntrinsicHeightPx(
  node: ProseMirrorNode,
  wrappedLines: WrappedLineSpan[],
  config: ScreenplayPageConfig = DEFAULT_SCREENPLAY_PAGE_CONFIG
): number {
  const type = node.type.name as ScreenplayElementType;
  const lineCount = Math.max(1, wrappedLines.length);

  if (type === 'screenplayImage') {
    const widthPercent = Number(node.attrs?.widthPercent) || 65;
    const naturalW = Number(node.attrs?.naturalWidth) || 0;
    const naturalH = Number(node.attrs?.naturalHeight) || 0;
    const targetWidthPx = (config.contentWidthPx * widthPercent) / 100;
    let imgHeightPx = 200;
    if (naturalW > 0 && naturalH > 0) {
      imgHeightPx = Math.min(360, Math.round((targetWidthPx * naturalH) / naturalW));
    }
    return imgHeightPx + 48; // Image frame + caption/controls bar
  }

  if (type === 'dualDialogue') {
    let maxColHeightPx = config.lineHeightPx * 2;
    node.forEach((colNode) => {
      let colHeight = 8;
      let prevChildType: ScreenplayElementType | null = null;
      colNode.forEach((child, _offset, idx) => {
        const childType = child.type.name as ScreenplayElementType;
        const childLines = wrapScreenplayTextLines(child.textContent, 26);
        const childGap = idx === 0 ? 4 : getIntrinsicMarginTopPx(prevChildType, childType, false);
        colHeight += childGap + Math.max(1, childLines.length) * config.lineHeightPx;
        prevChildType = childType;
      });
      if (colHeight > maxColHeightPx) {
        maxColHeightPx = colHeight;
      }
    });
    return maxColHeightPx + 28; // Header bar + top/bottom dashed borders
  }

  if (type === 'screenplayNote') {
    return lineCount * 18 + 38;
  }

  if (type === 'sequenceHeading') {
    return lineCount * config.lineHeightPx + 4;
  }

  return lineCount * config.lineHeightPx;
}

/**
 * Reads intrinsic DOM block heights from the mounted `.ProseMirror` element,
 * subtracting any inline page-break spacer widgets (`[data-spacer-height]`)
 * so measurements are 100% intrinsic and immune to pagination feedback loops.
 */
export function extractDomBlockMeasurements(
  proseMirrorRoot: HTMLElement | null,
  doc: ProseMirrorNode
): Map<number, number> {
  const map = new Map<number, number>();
  if (!proseMirrorRoot) return map;

  const domChildren = Array.from(proseMirrorRoot.children) as HTMLElement[];
  let childIdx = 0;

  doc.forEach((_node, offset) => {
    const el = domChildren[childIdx];
    childIdx += 1;
    if (!el) return;

    const rawOffsetHeight = el.offsetHeight;
    if (rawOffsetHeight <= 0) return;

    // Subtract any inline page-break spacer heights inside this block
    let inlineSpacerSum = 0;
    const spacers = el.querySelectorAll('[data-spacer-height]');
    spacers.forEach((sp) => {
      const h = Number(sp.getAttribute('data-spacer-height')) || 0;
      inlineSpacerSum += h;
    });

    const intrinsicHeight = Math.max(20, rawOffsetHeight - inlineSpacerSum);
    map.set(offset, intrinsicHeight);
  });

  return map;
}

/**
 * Measures all top-level screenplay blocks in `doc`.
 */
export function measureScreenplayBlocks(
  doc: ProseMirrorNode,
  domBlockHeights?: Map<number, number>,
  config: ScreenplayPageConfig = DEFAULT_SCREENPLAY_PAGE_CONFIG
): ScreenplayMeasuredBlock[] {
  const blocks: ScreenplayMeasuredBlock[] = [];
  let prevType: ScreenplayElementType | null = null;

  doc.forEach((node, offset, index) => {
    const type = (node.type.name as ScreenplayElementType) || 'action';
    const metrics =
      SCREENPLAY_ELEMENT_LAYOUT_METRICS[type] ||
      SCREENPLAY_ELEMENT_LAYOUT_METRICS.action;
    const text = node.textContent || '';
    const wrappedLines = wrapScreenplayTextLines(text, metrics.charsPerLine);
    const estimatedHeightPx = estimateNodeIntrinsicHeightPx(node, wrappedLines, config);
    const domHeightPx = domBlockHeights?.get(offset);
    const heightPx =
      typeof domHeightPx === 'number' && domHeightPx > 0
        ? domHeightPx
        : estimatedHeightPx;

    const lineCount =
      type === 'action' || type === 'dialogue' || type === 'generalText'
        ? Math.max(wrappedLines.length, Math.round(heightPx / config.lineHeightPx))
        : Math.max(1, wrappedLines.length);

    const intrinsicMarginTopPx = getIntrinsicMarginTopPx(
      prevType,
      type,
      index === 0
    );

    blocks.push({
      index,
      pos: offset,
      endPos: offset + node.nodeSize,
      nodeSize: node.nodeSize,
      type,
      text,
      wrappedLines,
      lineCount,
      heightPx,
      intrinsicMarginTopPx,
      pageBreakBefore: Boolean((node.attrs as any)?.pageBreakBefore),
    });

    prevType = type;
  });

  return blocks;
}

function minHeightToStartBlockOnSamePage(
  block: ScreenplayMeasuredBlock,
  config: ScreenplayPageConfig
): number {
  const minSplitPx = MIN_LINES_BEFORE_SPLIT * config.lineHeightPx;
  if (
    isSplittableProseElement(block.type) &&
    block.heightPx >= LONG_PARAGRAPH_SPLIT_THRESHOLD_PX
  ) {
    return block.intrinsicMarginTopPx + minSplitPx;
  }
  return block.intrinsicMarginTopPx + block.heightPx;
}

/**
 * Computes the minimum vertical space (in CSS pixels) required after block `i`
 * on the SAME page to satisfy screenplay keep-with-next rules (Section 6):
 * - Scene / Act / Sequence Headings stay with the start of the following block.
 * - Character cues stay with any immediate parenthetical and the start of dialogue.
 * - Parentheticals stay with the start of the following dialogue block.
 */
function getKeepWithNextRequiredFollowPx(
  blocks: ScreenplayMeasuredBlock[],
  index: number,
  config: ScreenplayPageConfig
): number {
  const current = blocks[index];
  const next1 = blocks[index + 1];
  if (!next1) return 0;

  if (
    current.type === 'sceneHeading' ||
    current.type === 'actHeading' ||
    current.type === 'sequenceHeading'
  ) {
    return (
      minHeightToStartBlockOnSamePage(next1, config) +
      getKeepWithNextRequiredFollowPx(blocks, index + 1, config)
    );
  }

  if (current.type === 'character') {
    if (next1.type === 'parenthetical') {
      const next2 = blocks[index + 2];
      const parenPx = next1.intrinsicMarginTopPx + next1.heightPx;
      const dlgMinPx =
        next2 && (next2.type === 'dialogue' || next2.type === 'lyrics')
          ? minHeightToStartBlockOnSamePage(next2, config)
          : 0;
      return parenPx + dlgMinPx;
    }
    if (next1.type === 'dialogue' || next1.type === 'lyrics') {
      return minHeightToStartBlockOnSamePage(next1, config);
    }
    return minHeightToStartBlockOnSamePage(next1, config);
  }

  if (current.type === 'parenthetical') {
    if (next1.type === 'dialogue' || next1.type === 'lyrics') {
      return minHeightToStartBlockOnSamePage(next1, config);
    }
  }

  return 0;
}

function isSplittableProseElement(type: ScreenplayElementType): boolean {
  return type === 'action' || type === 'dialogue' || type === 'generalText';
}

/**
 * Computes content-aware screenplay pagination across US Letter manuscript pages.
 * Never mutates the ProseMirror document.
 */
export function computeScreenplayPagination(
  doc: ProseMirrorNode,
  options: ComputeScreenplayPaginationOptions = {}
): ScreenplayPaginationResult {
  const config = options.config ?? DEFAULT_SCREENPLAY_PAGE_CONFIG;
  const hideFirstPageNumber = Boolean(options.hideFirstPageNumber);
  const blocks = measureScreenplayBlocks(doc, options.domBlockHeights, config);

  const pages: ScreenplayPageDescriptor[] = [];
  const blockPageMap = new Map<number, number>();
  const blockBreakOffsets = new Map<number, ScreenplayBlockBreakOffset>();
  const inlineBreakSpacers: ScreenplayInlineBreakSpacer[] = [];

  if (blocks.length === 0) {
    pages.push({
      pageNumber: 1,
      pageIndex: 0,
      startPos: 0,
      endPos: doc.content.size,
      usedHeightPx: 0,
      remainingHeightPx: config.contentHeightPx,
      showPageNumber: !hideFirstPageNumber,
      blockPositions: [],
    });
    return {
      config,
      pageCount: 1,
      pages,
      blocks,
      blockPageMap,
      blockBreakOffsets,
      inlineBreakSpacers,
      signature: 'p:1|b:0|s:0',
    };
  }

  const pageTurnBridgeBasePx =
    config.marginBottomPx + config.pageGapPx + config.marginTopPx;

  let currentPage: ScreenplayPageDescriptor = {
    pageNumber: 1,
    pageIndex: 0,
    startPos: blocks[0].pos,
    endPos: blocks[0].endPos,
    usedHeightPx: 0,
    remainingHeightPx: config.contentHeightPx,
    showPageNumber: !hideFirstPageNumber,
    blockPositions: [],
  };
  pages.push(currentPage);

  const advanceToNewPage = (nextStartPos: number, nextEndPos: number): number => {
    const prevUsedPx = currentPage.usedHeightPx;
    currentPage.remainingHeightPx = Math.max(0, config.contentHeightPx - prevUsedPx);

    const nextPageIndex = pages.length;
    const nextPageNumber = nextPageIndex + 1;
    currentPage = {
      pageNumber: nextPageNumber,
      pageIndex: nextPageIndex,
      startPos: nextStartPos,
      endPos: Math.max(nextStartPos, nextEndPos),
      usedHeightPx: 0,
      remainingHeightPx: config.contentHeightPx,
      showPageNumber: true,
      blockPositions: [],
    };
    pages.push(currentPage);

    return (
      Math.max(0, config.contentHeightPx - prevUsedPx) + pageTurnBridgeBasePx
    );
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    let isFirstOnCurrentPage = currentPage.usedHeightPx === 0;
    let topGap = isFirstOnCurrentPage ? 0 : block.intrinsicMarginTopPx;
    const keepWithNextPx = getKeepWithNextRequiredFollowPx(blocks, i, config);

    // 1. Check explicit pageBreakBefore or Keep-With-Next cohesion rules when current page already has content
    const totalWithKeepPx = topGap + block.heightPx + keepWithNextPx;
    if (
      !isFirstOnCurrentPage &&
      (block.pageBreakBefore ||
        (keepWithNextPx > 0 &&
          currentPage.usedHeightPx + totalWithKeepPx > config.contentHeightPx &&
          block.heightPx + keepWithNextPx <= config.contentHeightPx))
    ) {
      const marginTopPx = advanceToNewPage(block.pos, block.endPos);
      blockBreakOffsets.set(block.pos, {
        pos: block.pos,
        nodeSize: block.nodeSize,
        pageNumber: currentPage.pageNumber,
        marginTopPx,
      });
      isFirstOnCurrentPage = true;
      topGap = 0;
    }

    // 2. Check if block fits intact on the current page
    if (currentPage.usedHeightPx + topGap + block.heightPx <= config.contentHeightPx) {
      blockPageMap.set(block.pos, currentPage.pageNumber);
      currentPage.blockPositions.push(block.pos);
      currentPage.usedHeightPx += topGap + block.heightPx;
      currentPage.remainingHeightPx = Math.max(
        0,
        config.contentHeightPx - currentPage.usedHeightPx
      );
      currentPage.endPos = block.endPos;
      continue;
    }

    // 3. Block does not fit intact on the current page.
    // Decide whether to move the block intact to the next page OR continue/split it across pages.
    const remainingAvailForBlockPx =
      config.contentHeightPx - (currentPage.usedHeightPx + topGap);
    const linesFittingOnCurrentPage = Math.floor(
      remainingAvailForBlockPx / config.lineHeightPx
    );
    const totalBlockLines = Math.max(
      1,
      Math.round(block.heightPx / config.lineHeightPx)
    );
    const linesRemainingAfterCurrentPage =
      totalBlockLines - linesFittingOnCurrentPage;

    const canContinueOnCurrentPage =
      isSplittableProseElement(block.type) &&
      (isFirstOnCurrentPage ||
        (block.heightPx >= LONG_PARAGRAPH_SPLIT_THRESHOLD_PX &&
          linesFittingOnCurrentPage >= MIN_LINES_BEFORE_SPLIT &&
          linesRemainingAfterCurrentPage >= MIN_LINES_AFTER_SPLIT));

    if (!canContinueOnCurrentPage && !isFirstOnCurrentPage) {
      // Move block to the top of the next page first
      const marginTopPx = advanceToNewPage(block.pos, block.endPos);
      blockBreakOffsets.set(block.pos, {
        pos: block.pos,
        nodeSize: block.nodeSize,
        pageNumber: currentPage.pageNumber,
        marginTopPx,
      });
      isFirstOnCurrentPage = true;
      topGap = 0;

      // If the block now fits intact on the fresh page, place it and continue
      if (block.heightPx <= config.contentHeightPx) {
        blockPageMap.set(block.pos, currentPage.pageNumber);
        currentPage.blockPositions.push(block.pos);
        currentPage.usedHeightPx = block.heightPx;
        currentPage.remainingHeightPx = Math.max(
          0,
          config.contentHeightPx - currentPage.usedHeightPx
        );
        currentPage.endPos = block.endPos;
        continue;
      }
    }

    // 4. Multi-page continuation slicer for long or oversized blocks
    blockPageMap.set(block.pos, currentPage.pageNumber);
    currentPage.blockPositions.push(block.pos);

    let remainingHeightPx = block.heightPx;
    let linesConsumed = 0;
    let sliceTopGap = topGap;

    while (
      currentPage.usedHeightPx + sliceTopGap + remainingHeightPx >
      config.contentHeightPx
    ) {
      const availPx = Math.max(
        config.lineHeightPx,
        config.contentHeightPx - (currentPage.usedHeightPx + sliceTopGap)
      );
      const sliceLines = Math.max(1, Math.floor(availPx / config.lineHeightPx));
      const sliceHeightPx = Math.min(
        remainingHeightPx,
        sliceLines * config.lineHeightPx
      );

      currentPage.usedHeightPx += sliceTopGap + sliceHeightPx;
      currentPage.remainingHeightPx = Math.max(
        0,
        config.contentHeightPx - currentPage.usedHeightPx
      );

      const targetLineIdx = Math.min(
        block.wrappedLines.length - 1,
        linesConsumed + sliceLines - 1
      );
      const splitCharOffset =
        block.wrappedLines[targetLineIdx]?.endOffset ?? block.text.length;
      const clampedCharOffset = Math.max(
        1,
        Math.min(Math.max(1, block.text.length - 1), splitCharOffset)
      );
      const splitDocPos = Math.min(
        block.endPos - 1,
        block.pos + 1 + clampedCharOffset
      );

      currentPage.endPos = splitDocPos;
      const spacerHeightPx = advanceToNewPage(splitDocPos, block.endPos);

      if (
        isSplittableProseElement(block.type) &&
        block.text.length > 1 &&
        splitDocPos > block.pos &&
        splitDocPos < block.endPos
      ) {
        inlineBreakSpacers.push({
          pos: splitDocPos,
          blockPos: block.pos,
          pageNumber: currentPage.pageNumber,
          spacerHeightPx,
        });
      }

      currentPage.blockPositions.push(block.pos);
      linesConsumed += sliceLines;
      remainingHeightPx = Math.max(0, remainingHeightPx - sliceHeightPx);
      sliceTopGap = 0;

      // Safety guard against non-shrinking remainder
      if (remainingHeightPx <= 0) {
        break;
      }
    }

    currentPage.usedHeightPx += sliceTopGap + remainingHeightPx;
    currentPage.remainingHeightPx = Math.max(
      0,
      config.contentHeightPx - currentPage.usedHeightPx
    );
    currentPage.endPos = block.endPos;
  }

  const blockSig = Array.from(blockBreakOffsets.values())
    .map((b) => `${b.pos}:${b.pageNumber}:${Math.round(b.marginTopPx)}`)
    .join(',');
  const inlineSig = inlineBreakSpacers
    .map((s) => `${s.pos}:${s.pageNumber}:${Math.round(s.spacerHeightPx)}`)
    .join(',');
  const signature = `p:${pages.length}|b:${blockSig}|s:${inlineSig}`;

  return {
    config,
    pageCount: pages.length,
    pages,
    blocks,
    blockPageMap,
    blockBreakOffsets,
    inlineBreakSpacers,
    signature,
  };
}

/**
 * Resolves the 1-indexed page number for any ProseMirror document position `pos`.
 */
export function getPageNumberForPos(
  pagination: ScreenplayPaginationResult,
  pos: number
): number {
  if (!pagination || pagination.pages.length === 0) {
    return 1;
  }

  // Check if `pos` falls after an inline continuation spacer inside a split block
  let matchedPage = 1;
  for (const page of pagination.pages) {
    if (pos >= page.startPos) {
      matchedPage = page.pageNumber;
    } else {
      break;
    }
  }

  return Math.max(1, Math.min(pagination.pageCount, matchedPage));
}
