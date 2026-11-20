import React, { useState } from 'react';
import { ScreenplayMetadata } from '../model/canonicalScreenplay';
import {
  ScreenplayPdfDocumentLayout,
  ScreenplayPdfPageLayout,
  ScreenplayPdfLine,
} from '../../../types';
import { FileText, PlusCircle, AlertCircle } from 'lucide-react';

const SCREENPLAY_MONO_FONT = '"Courier Prime", Courier, "Courier New", monospace';

export interface ScreenplayTitlePageViewProps {
  metadata: ScreenplayMetadata;
  pdfLayout?: ScreenplayPdfDocumentLayout;
  onChangeMetadata?: (patch: Partial<ScreenplayMetadata>) => void;
  onChangeTitlePageLayout?: (updatedPage: ScreenplayPdfPageLayout) => void;
  readOnly?: boolean;
}

export const ScreenplayTitlePageView: React.FC<ScreenplayTitlePageViewProps> = ({
  metadata,
  pdfLayout,
  onChangeMetadata,
  onChangeTitlePageLayout,
  readOnly = false,
}) => {
  const [createdBlankTitlePage, setCreatedBlankTitlePage] = useState<boolean>(false);

  // 1. If PDF layout is present, check whether a title page actually existed in the source PDF
  const hasExtractedTitlePage = Boolean(pdfLayout?.hasTitlePage && pdfLayout?.titlePage);
  const isPdfSourceWithoutTitle = Boolean(pdfLayout && !pdfLayout.hasTitlePage && !createdBlankTitlePage);

  if (isPdfSourceWithoutTitle) {
    return (
      <div
        data-testid="screenplay-no-title-page-notice"
        className="w-full flex justify-center py-16 px-4"
      >
        <div className="max-w-md w-full bg-[#181a20] border border-white/10 rounded-xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              No Title Page Detected in Source Screenplay
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This screenplay file begins directly with scene headings on Page 1.
              SceneOS preserves the authentic source document and never fabricates artificial metadata.
            </p>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={() => setCreatedBlankTitlePage(true)}
              data-testid="screenplay-create-title-page-btn"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Screenplay Title Page</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. If source PDF has an authentic title page layout, render that exact layout faithfully
  if (hasExtractedTitlePage && pdfLayout?.titlePage) {
    const titlePage = pdfLayout.titlePage;
    const scale = 96 / 72; // Points to CSS pixels
    const widthPx = Math.round(titlePage.width * scale);
    const heightPx = Math.round(titlePage.height * scale);

    const handleTitleLineChange = (lineId: string, nextText: string) => {
      if (readOnly) return;
      const updatedLines = titlePage.lines.map((line) => {
        if (line.id === lineId) {
          return { ...line, text: nextText };
        }
        return line;
      });

      const updatedPage: ScreenplayPdfPageLayout = {
        ...titlePage,
        lines: updatedLines,
      };

      onChangeTitlePageLayout?.(updatedPage);

      // Also update top-level metadata title/author if applicable
      const changedLine = titlePage.lines.find((l) => l.id === lineId);
      if (changedLine?.type === 'title') {
        onChangeMetadata?.({ title: nextText });
      } else if (changedLine?.type === 'author') {
        onChangeMetadata?.({ author: nextText, authors: [nextText] });
      }
    };

    return (
      <div className="w-full flex justify-center py-8 overflow-y-auto">
        <div
          data-testid="screenplay-title-page-view"
          className="relative bg-white text-black shadow-2xl shrink-0 select-text"
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            boxSizing: 'border-box',
            fontFamily: SCREENPLAY_MONO_FONT,
          }}
        >
          {titlePage.lines.map((line) => {
            const leftPx = Math.round(line.x * scale);
            const topPx = Math.round(line.top * scale);
            const fontSizePx = Math.max(10, Math.round(line.fontSize * scale));
            const isTitle = line.type === 'title';

            return (
              <div
                key={line.id}
                data-testid={`title-page-line-${line.id}`}
                className="absolute"
                style={{
                  left: `${leftPx}px`,
                  top: `${topPx}px`,
                  maxWidth: `${widthPx - leftPx - 36}px`,
                }}
              >
                <span
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const text = e.currentTarget.innerText;
                    if (text !== line.text) {
                      handleTitleLineChange(line.id, text);
                    }
                  }}
                  className={`block outline-none bg-transparent whitespace-pre cursor-text transition-colors rounded-[2px] ${
                    isTitle
                      ? 'font-bold uppercase tracking-widest text-black text-xl'
                      : 'text-stone-900 text-sm'
                  } ${!readOnly ? 'hover:bg-cyan-50 focus:bg-cyan-100/70 focus:ring-1 focus:ring-cyan-500/40' : ''}`}
                  style={{
                    fontSize: `${fontSizePx}px`,
                    lineHeight: '1',
                    fontFamily: SCREENPLAY_MONO_FONT,
                    fontWeight: isTitle ? 'bold' : line.fontWeight || 'normal',
                    textAlign: (line.alignment as any) || 'left',
                    letterSpacing: '0.01em',
                  }}
                >
                  {line.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. Standard / Clean Title Page View (for native drafts or manual creation)
  const title = metadata.title || 'Untitled Screenplay';
  const credit = metadata.credit || 'written by';
  const author = metadata.author || (metadata.authors && metadata.authors[0]) || '';
  const source = metadata.source || '';
  const draftDate = metadata.draftDate || '';
  const contact = metadata.contact || '';
  const notes = metadata.notes || '';

  return (
    <div className="w-full flex justify-center py-8 overflow-y-auto">
      <div
        data-testid="screenplay-title-page-view"
        className="relative bg-white text-black shadow-2xl flex flex-col justify-between p-24 select-text"
        style={{
          width: '816px',
          minHeight: '1056px',
          fontFamily: SCREENPLAY_MONO_FONT,
          boxSizing: 'border-box',
        }}
      >
        {/* Top whitespace */}
        <div className="h-24" />

        {/* Center Block: Title, Credit, Author */}
        <div className="text-center space-y-6 my-auto">
          <div className="text-2xl font-bold tracking-widest uppercase">
            {readOnly ? (
              <span>{title}</span>
            ) : (
              <input
                type="text"
                value={title}
                onChange={(e) => onChangeMetadata?.({ title: e.target.value })}
                className="w-full text-center bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-800 outline-none uppercase font-bold tracking-widest"
                aria-label="Screenplay Title"
              />
            )}
          </div>

          <div className="text-sm lowercase tracking-wider text-stone-700 italic">
            {readOnly ? (
              <span>{credit}</span>
            ) : (
              <input
                type="text"
                value={credit}
                onChange={(e) => onChangeMetadata?.({ credit: e.target.value })}
                className="w-full text-center bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-800 outline-none text-sm italic"
                aria-label="Screenplay Credit"
              />
            )}
          </div>

          <div className="text-lg font-semibold tracking-wider text-stone-900">
            {readOnly ? (
              <span>{author}</span>
            ) : (
              <input
                type="text"
                value={author}
                onChange={(e) =>
                  onChangeMetadata?.({
                    author: e.target.value,
                    authors: [e.target.value],
                  })
                }
                className="w-full text-center bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-800 outline-none text-lg font-semibold"
                aria-label="Screenplay Author"
              />
            )}
          </div>

          {source && (
            <div className="text-xs text-stone-600 mt-4 tracking-normal">
              <span>{source}</span>
            </div>
          )}
        </div>

        {/* Bottom Block: Draft Date & Contact Information */}
        <div className="flex items-end justify-between text-xs text-stone-800 pt-16">
          <div className="space-y-1">
            {draftDate && (
              <div className="font-mono text-stone-700">
                <span>{draftDate}</span>
              </div>
            )}
            {notes && (
              <div className="text-stone-600 text-[11px] max-w-xs">
                <span>{notes}</span>
              </div>
            )}
          </div>

          <div className="text-right whitespace-pre-wrap max-w-xs text-stone-800 leading-relaxed">
            {readOnly ? (
              <span>{contact}</span>
            ) : (
              <textarea
                value={contact}
                placeholder="Contact / Representation info..."
                rows={3}
                onChange={(e) => onChangeMetadata?.({ contact: e.target.value })}
                className="w-full text-right bg-transparent border border-transparent hover:border-stone-200 focus:border-stone-400 outline-none resize-none p-1 text-xs"
                aria-label="Contact Information"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
