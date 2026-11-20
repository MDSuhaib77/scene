import React from 'react';
import { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import {
  DEFAULT_SCREENPLAY_PAGE_CONFIG,
  ScreenplayPageConfig,
} from '../layout/screenplayPageConfig';
import { ScreenplayPageDescriptor } from '../layout/screenplayPaginationEngine';

export interface ScreenplayPageProps {
  editor?: Editor | null;
  pageNumber?: number;
  pages?: ScreenplayPageDescriptor[];
  pageConfig?: ScreenplayPageConfig | any;
  titleHeader?: string;
  children: React.ReactNode;
}

interface ManuscriptPageSurfaceProps {
  page: ScreenplayPageDescriptor;
  width: number;
  height: number;
  headerTop: number;
  marginLeft: number;
  marginRight: number;
  fontFamily: string;
  titleHeader?: string;
  onMouseDown: (e: React.MouseEvent<HTMLElement>, page: ScreenplayPageDescriptor) => void;
}

const ManuscriptPageSurface = React.memo<ManuscriptPageSurfaceProps>(({
  page,
  width,
  height,
  headerTop,
  marginLeft,
  marginRight,
  fontFamily,
  titleHeader,
  onMouseDown,
}) => {
  return (
    <article
      id={`screenplay-page-surface-${page.pageNumber}`}
      className="scr-manuscript-page cursor-text select-text"
      data-testid={
        page.pageNumber === 1
          ? 'screenplay-manuscript-page'
          : `screenplay-manuscript-page-${page.pageNumber}`
      }
      data-page-surface="true"
      data-page-number={page.pageNumber}
      aria-label={`Screenplay manuscript page ${page.pageNumber}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minHeight: `${height}px`,
      }}
      onMouseDown={(e) => onMouseDown(e, page)}
    >
      {/* Standard screenplay running header on page 2+ (Page 1 has no running header per screenplay standard) */}
      {page.pageNumber > 1 && (
        <div
          className="screenplay-running-header pointer-events-none select-none flex items-center justify-between text-[10pt] text-[#374151]"
          style={{
            position: 'absolute',
            top: `${headerTop}px`,
            left: `${marginLeft}px`,
            right: `${marginRight}px`,
            fontFamily,
          }}
          aria-hidden="true"
        >
          {titleHeader ? (
            <span className="truncate max-w-[75%] uppercase tracking-wider text-[#6b7280]">
              {titleHeader}
            </span>
          ) : (
            <span />
          )}
          {page.showPageNumber !== false && (
            <span
              data-testid={`screenplay-page-number-${page.pageNumber}`}
              className="tabular-nums font-normal text-[#374151]"
            >
              {page.pageNumber}.
            </span>
          )}
        </div>
      )}
    </article>
  );
});

export const ScreenplayPage: React.FC<ScreenplayPageProps> = ({
  editor,
  pageNumber = 1,
  pages,
  pageConfig = DEFAULT_SCREENPLAY_PAGE_CONFIG,
  titleHeader,
  children,
}) => {
  const normWidth = (pageConfig as any)?.pageWidthPx ?? (pageConfig as any)?.pageWidth ?? DEFAULT_SCREENPLAY_PAGE_CONFIG.pageWidthPx;
  const normHeight = (pageConfig as any)?.pageHeightPx ?? (pageConfig as any)?.pageHeight ?? DEFAULT_SCREENPLAY_PAGE_CONFIG.pageHeightPx;
  const normGap = (pageConfig as any)?.pageGapPx ?? 40;
  const normMarginTop = (pageConfig as any)?.marginTopPx ?? (pageConfig as any)?.topMargin ?? DEFAULT_SCREENPLAY_PAGE_CONFIG.marginTopPx;
  const normMarginBottom = (pageConfig as any)?.marginBottomPx ?? (pageConfig as any)?.bottomMargin ?? DEFAULT_SCREENPLAY_PAGE_CONFIG.marginBottomPx;
  const normMarginLeft = (pageConfig as any)?.marginLeftPx ?? (pageConfig as any)?.leftMargin ?? DEFAULT_SCREENPLAY_PAGE_CONFIG.marginLeftPx;
  const normMarginRight = (pageConfig as any)?.marginRightPx ?? (pageConfig as any)?.rightMargin ?? DEFAULT_SCREENPLAY_PAGE_CONFIG.marginRightPx;
  const normHeaderTop = (pageConfig as any)?.headerTopPx ?? (pageConfig as any)?.headerBaseline ?? DEFAULT_SCREENPLAY_PAGE_CONFIG.headerTopPx;
  const normFontFamily = (pageConfig as any)?.fontFamily || DEFAULT_SCREENPLAY_PAGE_CONFIG.fontFamily;

  const effectivePages: ScreenplayPageDescriptor[] =
    pages && pages.length > 0
      ? pages
      : [
          {
            pageNumber,
            pageIndex: 0,
            startPos: 0,
            endPos: 0,
            usedHeightPx: 0,
            remainingHeightPx: normHeight - normMarginTop - normMarginBottom,
            showPageNumber: true,
            blockPositions: [],
          },
        ];

  const pageCount = effectivePages.length;
  const totalStackHeightPx =
    pageCount * normHeight +
    Math.max(0, pageCount - 1) * normGap;

  const handleSurfaceMouseDown = (
    event: React.MouseEvent<HTMLElement>,
    pageDesc: ScreenplayPageDescriptor
  ) => {
    if (!editor) return;
    const target = event.target as HTMLElement;
    if (target.closest('.ProseMirror')) {
      return;
    }

    event.preventDefault();

    // Try placing the caret at the line nearest to the click coordinate
    try {
      const view = (editor as any).editorView || editor.view;
      if (view && typeof view.posAtCoords === 'function') {
        const surfaceRect = event.currentTarget.getBoundingClientRect();
        const probeLeft = surfaceRect.left + normMarginLeft + 12;
        const hit = view.posAtCoords({
          left: probeLeft,
          top: event.clientY,
        });
        if (hit && typeof hit.pos === 'number') {
          const resolved = editor.state.doc.resolve(
            Math.max(0, Math.min(editor.state.doc.content.size, hit.pos))
          );
          const tr = editor.state.tr.setSelection(TextSelection.near(resolved));
          view.dispatch(tr);
          view.focus();
          return;
        }
      }
    } catch {
      // Fallback to page startPos or document end
    }

    if (pageDesc.startPos > 0 && pageDesc.startPos <= editor.state.doc.content.size) {
      try {
        const resolved = editor.state.doc.resolve(
          Math.min(editor.state.doc.content.size, pageDesc.startPos + 1)
        );
        editor.view.dispatch(
          editor.state.tr.setSelection(TextSelection.near(resolved))
        );
        editor.view.focus();
        return;
      } catch {
        // Fallback below
      }
    }

    editor.commands.focus('end');
  };

  return (
    <div
      className="scr-page-stack-container relative select-text"
      data-testid="screenplay-page-stack"
      data-page-count={pageCount}
      style={{
        width: `${normWidth}px`,
        minWidth: `${normWidth}px`,
        minHeight: `${totalStackHeightPx}px`,
      }}
    >
      {/* Layer 1: Distinct physical US Letter manuscript page surfaces separated by dark workspace gaps */}
      <div
        className="scr-page-surfaces-layer flex flex-col pointer-events-auto"
        style={{
          gap: `${normGap}px`,
          width: `${normWidth}px`,
        }}
      >
        {effectivePages.map((page) => (
          <ManuscriptPageSurface
            key={page.pageNumber}
            page={page}
            width={normWidth}
            height={normHeight}
            headerTop={normHeaderTop}
            marginLeft={normMarginLeft}
            marginRight={normMarginRight}
            fontFamily={normFontFamily}
            titleHeader={titleHeader}
            onMouseDown={handleSurfaceMouseDown}
          />
        ))}
      </div>

      {/* Layer 2: Continuous editable ProseMirror document aligned to page writing margins */}
      <div
        className="scr-page-content-layer pointer-events-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${normWidth}px`,
          minHeight: `${totalStackHeightPx}px`,
          paddingTop: `${normMarginTop}px`,
          paddingRight: `${normMarginRight}px`,
          paddingBottom: `${normMarginBottom}px`,
          paddingLeft: `${normMarginLeft}px`,
          boxSizing: 'border-box',
        }}
      >
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
};
