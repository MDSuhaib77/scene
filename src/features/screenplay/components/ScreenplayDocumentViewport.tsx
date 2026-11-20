import React from 'react';
import { DEFAULT_SCREENPLAY_PAGE_CONFIG } from '../layout/screenplayPageConfig';

export interface ScreenplayDocumentViewportProps {
  zoomPercent?: number;
  pageCount?: number;
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

export const ScreenplayDocumentViewport: React.FC<ScreenplayDocumentViewportProps> = ({
  zoomPercent = 100,
  pageCount = 1,
  viewportRef,
  children,
}) => {
  const scale = zoomPercent / 100;
  const pageConfig = DEFAULT_SCREENPLAY_PAGE_CONFIG;
  const totalStackHeightPx =
    pageCount * pageConfig.pageHeightPx +
    Math.max(0, pageCount - 1) * pageConfig.pageGapPx;

  return (
    <div
      ref={viewportRef}
      className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-auto scrollbar-cinema"
      style={{ backgroundColor: 'transparent' }}
      data-testid="screenplay-document-viewport"
      role="region"
      aria-label="Screenplay document viewport"
    >
      <div className="min-h-full w-max min-w-full flex flex-col items-center justify-start py-7 px-4 sm:px-8 md:px-12 box-border">
        <div
          style={
            scale !== 1
              ? {
                  transform: `scale(${scale})`,
                  transformOrigin: 'top center',
                  marginBottom: `${Math.max(0, (scale - 1) * totalStackHeightPx)}px`,
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
};
