import { ScreenplayElementType } from '../schema/screenplayExtensions';

export type ScreenplayPageSizePreset = 'us-letter';

export interface ScreenplayPageConfig {
  id: ScreenplayPageSizePreset;
  label: string;
  widthInches: number;
  heightInches: number;
  dpi: number;
  pageWidthPx: number;
  pageHeightPx: number;
  marginTopInches: number;
  marginBottomInches: number;
  marginLeftInches: number;
  marginRightInches: number;
  marginTopPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  marginRightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  pageGapPx: number;
  headerTopPx: number;
  fontFamily: string;
  fontSizePt: number;
  fontSizePx: number;
  lineHeightRatio: number;
  lineHeightPx: number;
  charWidthPx: number;
}

/**
 * Centralized US Letter screenplay manuscript page configuration:
 * - Physical page: 8.5 × 11 inches @ 96 CSS px/in = 816 × 1056 px
 * - Margins: Left 1.5in (144px), Right 1.0in (96px), Top 1.0in (96px), Bottom 1.0in (96px)
 * - Usable writing area: 6.0 × 9.0 inches = 576 × 864 px
 * - Typography: 12pt (16px) Courier Prime, 1.25 line-height (20px/line), 10 CPI (9.6px/char)
 */
export const US_LETTER_PAGE_CONFIG: ScreenplayPageConfig = {
  id: 'us-letter',
  label: 'US Letter (8.5 × 11 in)',
  widthInches: 8.5,
  heightInches: 11,
  dpi: 96,
  pageWidthPx: 816,
  pageHeightPx: 1056,
  marginTopInches: 1.0,
  marginBottomInches: 1.0,
  marginLeftInches: 1.5,
  marginRightInches: 1.0,
  marginTopPx: 96,
  marginBottomPx: 96,
  marginLeftPx: 144,
  marginRightPx: 96,
  contentWidthPx: 576,
  contentHeightPx: 864,
  pageGapPx: 28,
  headerTopPx: 44,
  fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
  fontSizePt: 12,
  fontSizePx: 16,
  lineHeightRatio: 1.25,
  lineHeightPx: 20,
  charWidthPx: 9.6,
};

export const DEFAULT_SCREENPLAY_PAGE_CONFIG: ScreenplayPageConfig = US_LETTER_PAGE_CONFIG;

export const SCREENPLAY_PAGE_PRESETS: Record<ScreenplayPageSizePreset, ScreenplayPageConfig> = {
  'us-letter': US_LETTER_PAGE_CONFIG,
};

export interface ScreenplayElementLayoutMetrics {
  /** Left indentation inside the 6.0in (576px) usable writing column */
  paddingLeftPx: number;
  /** Right indentation inside the 6.0in (576px) usable writing column */
  paddingRightPx: number;
  /** Usable horizontal line measure in CSS pixels */
  usableWidthPx: number;
  /** Approximate characters per line at 12pt Courier 10 CPI */
  charsPerLine: number;
  /** Default intrinsic top spacing in CSS pixels when following another block on the same page */
  defaultMarginTopPx: number;
}

/**
 * Centralized element indentation and spacing metrics within the 576px (6.0in) content area.
 * Note: Page margins (1.5in left, 1.0in right) are applied once at the page level;
 * these values are relative to the usable writing area so double indentation never occurs.
 */
export const SCREENPLAY_ELEMENT_LAYOUT_METRICS: Record<
  ScreenplayElementType,
  ScreenplayElementLayoutMetrics
> = {
  sceneHeading: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 24,
  },
  action: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 14,
  },
  character: {
    paddingLeftPx: 206, // 2.15in
    paddingRightPx: 48, // 0.5in
    usableWidthPx: 322,
    charsPerLine: 33,
    defaultMarginTopPx: 14,
  },
  parenthetical: {
    paddingLeftPx: 149, // 1.55in
    paddingRightPx: 178, // 1.85in
    usableWidthPx: 249,
    charsPerLine: 25,
    defaultMarginTopPx: 0,
  },
  dialogue: {
    paddingLeftPx: 96, // 1.0in
    paddingRightPx: 139, // 1.45in
    usableWidthPx: 341,
    charsPerLine: 35,
    defaultMarginTopPx: 0,
  },
  transition: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 16,
  },
  shot: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 16,
  },
  generalText: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 12,
  },
  screenplayNote: {
    paddingLeftPx: 16,
    paddingRightPx: 16,
    usableWidthPx: 544,
    charsPerLine: 62,
    defaultMarginTopPx: 12,
  },
  actHeading: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 26,
  },
  endAct: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 26,
  },
  sequenceHeading: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 22,
  },
  lyrics: {
    paddingLeftPx: 120, // 1.25in
    paddingRightPx: 120, // 1.25in
    usableWidthPx: 336,
    charsPerLine: 35,
    defaultMarginTopPx: 10,
  },
  screenplayImage: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 60,
    defaultMarginTopPx: 16,
  },
  dualDialogue: {
    paddingLeftPx: 0,
    paddingRightPx: 0,
    usableWidthPx: 576,
    charsPerLine: 26,
    defaultMarginTopPx: 14,
  },
};

/**
 * Returns the exact intrinsic top spacing (in CSS pixels) before a screenplay block
 * when it appears on the same page after `prevType`.
 * At the very top of a page (or first child of document), top spacing is always 0.
 */
export function getIntrinsicMarginTopPx(
  prevType: ScreenplayElementType | null,
  currentType: ScreenplayElementType,
  isFirstOnPage: boolean
): number {
  if (isFirstOnPage || !prevType) {
    return 0;
  }

  if (currentType === 'parenthetical') {
    if (prevType === 'character' || prevType === 'dialogue') {
      return 0;
    }
    return 6;
  }

  if (currentType === 'dialogue') {
    if (prevType === 'character' || prevType === 'parenthetical') {
      return 0;
    }
    if (prevType === 'dialogue') {
      return 6;
    }
    return 10;
  }

  const metrics = SCREENPLAY_ELEMENT_LAYOUT_METRICS[currentType];
  return metrics ? metrics.defaultMarginTopPx : 14;
}
