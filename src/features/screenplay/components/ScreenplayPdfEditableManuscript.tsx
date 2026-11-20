import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScreenplayPdfDocumentLayout,
  ScreenplayPdfPageLayout,
  ScreenplayPdfLine,
} from '../../../types';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Clapperboard,
  User,
  MessageSquare,
  FileText,
  CornerDownRight,
  HelpCircle,
} from 'lucide-react';

export interface ScreenplayPdfEditableManuscriptProps {
  layout: ScreenplayPdfDocumentLayout;
  zoomPercent?: number;
  activePageNumber?: number;
  onPageChange?: (page: number) => void;
  onChangeLayout: (newLayout: ScreenplayPdfDocumentLayout, newText: string) => void;
  readOnly?: boolean;
}

const SCREENPLAY_MONO_FONT = '"Courier Prime", Courier, "Courier New", monospace';

const ELEMENT_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string; bgClass: string }> = {
  sceneHeading: {
    label: 'SCENE',
    icon: Clapperboard,
    colorClass: 'text-emerald-400 border-emerald-500/40',
    bgClass: 'bg-emerald-500/10 hover:bg-emerald-500/20',
  },
  scene_heading: {
    label: 'SCENE',
    icon: Clapperboard,
    colorClass: 'text-emerald-400 border-emerald-500/40',
    bgClass: 'bg-emerald-500/10 hover:bg-emerald-500/20',
  },
  character: {
    label: 'CHARACTER',
    icon: User,
    colorClass: 'text-purple-400 border-purple-500/40',
    bgClass: 'bg-purple-500/10 hover:bg-purple-500/20',
  },
  dialogue: {
    label: 'DIALOGUE',
    icon: MessageSquare,
    colorClass: 'text-cyan-400 border-cyan-500/40',
    bgClass: 'bg-cyan-500/10 hover:bg-cyan-500/20',
  },
  parenthetical: {
    label: 'PARENS',
    icon: Sparkles,
    colorClass: 'text-sky-400 border-sky-500/40',
    bgClass: 'bg-sky-500/10 hover:bg-sky-500/20',
  },
  transition: {
    label: 'TRANSITION',
    icon: CornerDownRight,
    colorClass: 'text-rose-400 border-rose-500/40',
    bgClass: 'bg-rose-500/10 hover:bg-rose-500/20',
  },
  action: {
    label: 'ACTION',
    icon: FileText,
    colorClass: 'text-slate-400 border-slate-500/40',
    bgClass: 'bg-slate-500/10 hover:bg-slate-500/20',
  },
};

/**
 * Re-derives plain text from the entire document layout.
 */
function derivePlainTextFromLayout(layout: ScreenplayPdfDocumentLayout): string {
  const pageTexts = layout.pages.map((p) => {
    return p.lines.map((l) => l.text).join('\n');
  });
  return pageTexts.join('\n\n=== PAGE BREAK ===\n\n');
}

export const ScreenplayPdfEditableManuscript: React.FC<ScreenplayPdfEditableManuscriptProps> = ({
  layout,
  zoomPercent = 100,
  activePageNumber = 1,
  onPageChange,
  onChangeLayout,
  readOnly = false,
}) => {
  const [internalLayout, setInternalLayout] = useState<ScreenplayPdfDocumentLayout>(layout);
  const [activePage, setActivePage] = useState<number>(activePageNumber);
  const [history, setHistory] = useState<ScreenplayPdfDocumentLayout[]>([layout]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [showBlockBadges, setShowBlockBadges] = useState<boolean>(true);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [editingTypeMenuLineId, setEditingTypeMenuLineId] = useState<string | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Sync with prop updates if layout reference changes from external source
  useEffect(() => {
    setInternalLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (activePageNumber && activePageNumber !== activePage) {
      setActivePage(activePageNumber);
    }
  }, [activePageNumber]);

  // Points to CSS pixels scale (72 pt/in to 96 px/in = 1.333)
  const baseScale = (zoomPercent / 100) * (96 / 72);
  const pageWidthPx = Math.round(layout.pageWidth * baseScale);
  const pageHeightPx = Math.round(layout.pageHeight * baseScale);

  const handleLineTextChange = useCallback(
    (pageIndex: number, lineIndex: number, newText: string) => {
      if (readOnly) return;

      const nextPages = internalLayout.pages.map((p, pIdx) => {
        if (pIdx !== pageIndex) return p;
        const nextLines = p.lines.map((l, lIdx) => {
          if (lIdx !== lineIndex) return l;
          return { ...l, text: newText };
        });
        return { ...p, lines: nextLines };
      });

      const nextLayout: ScreenplayPdfDocumentLayout = {
        ...internalLayout,
        pages: nextPages,
      };

      setInternalLayout(nextLayout);

      // Save to undo history
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), nextLayout]);
      setHistoryIndex((prev) => prev + 1);

      const nextRawText = derivePlainTextFromLayout(nextLayout);
      onChangeLayout(nextLayout, nextRawText);
    },
    [historyIndex, internalLayout, onChangeLayout, readOnly]
  );

  const handleLineTypeChange = useCallback(
    (pageIndex: number, lineIndex: number, newType: string) => {
      if (readOnly) return;

      const nextPages = internalLayout.pages.map((p, pIdx) => {
        if (pIdx !== pageIndex) return p;
        const nextLines = p.lines.map((l, lIdx) => {
          if (lIdx !== lineIndex) return l;
          return { ...l, type: newType };
        });
        return { ...p, lines: nextLines };
      });

      const nextLayout: ScreenplayPdfDocumentLayout = {
        ...internalLayout,
        pages: nextPages,
      };

      setInternalLayout(nextLayout);
      setEditingTypeMenuLineId(null);

      setHistory((prev) => [...prev.slice(0, historyIndex + 1), nextLayout]);
      setHistoryIndex((prev) => prev + 1);

      const nextRawText = derivePlainTextFromLayout(nextLayout);
      onChangeLayout(nextLayout, nextRawText);
    },
    [historyIndex, internalLayout, onChangeLayout, readOnly]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevLayout = history[historyIndex - 1];
      setHistoryIndex((prev) => prev - 1);
      setInternalLayout(prevLayout);
      onChangeLayout(prevLayout, derivePlainTextFromLayout(prevLayout));
    }
  }, [history, historyIndex, onChangeLayout]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextLayout = history[historyIndex + 1];
      setHistoryIndex((prev) => prev + 1);
      setInternalLayout(nextLayout);
      onChangeLayout(nextLayout, derivePlainTextFromLayout(nextLayout));
    }
  }, [history, historyIndex, onChangeLayout]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    },
    [handleRedo, handleUndo]
  );

  const scrollToPage = useCallback(
    (pageNum: number) => {
      const targetIdx = pageNum - 1;
      if (pageRefs.current[targetIdx]) {
        pageRefs.current[targetIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActivePage(pageNum);
        onPageChange?.(pageNum);
      }
    },
    [onPageChange]
  );

  return (
    <div
      data-testid="screenplay-pdf-editable-manuscript"
      className="flex flex-col w-full h-full bg-[#111318] overflow-hidden select-text"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Editable Screenplay Manuscript"
    >
      {/* Top Controls Bar: Page Stats & Block Structure Understanding Toggle (Circled legend completely removed) */}
      <div className="h-10 px-4 border-b border-cyan-500/15 bg-[#080b18]/80 backdrop-blur-xl flex items-center justify-between text-xs text-slate-300 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-slate-400">
            <span>Manuscript:</span>
            <span className="font-semibold text-cyan-300">{internalLayout.pages.length} Pages</span>
          </div>

          <div className="h-3 w-px bg-white/10" aria-hidden="true" />

          {/* Block Understanding Pill */}
          <button
            type="button"
            onClick={() => setShowBlockBadges((prev) => !prev)}
            data-testid="manuscript-toggle-structure-badges-btn"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer border ${
              showBlockBadges
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
            }`}
            title="Toggle screenplay element structure badges (Scene, Character, Dialogue, Action)"
          >
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Block Structure: {showBlockBadges ? 'Visible' : 'Hidden'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Document Canvas with centered pages */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-auto py-8 px-4 flex flex-col items-center gap-12">
        {internalLayout.pages.map((page, pIdx) => {
          const pageNum = page.pageNumber || pIdx + 1;

          return (
            <div
              key={`manuscript-page-${pageNum}`}
              id={`screenplay-page-surface-${pageNum}`}
              ref={(el) => {
                pageRefs.current[pIdx] = el;
              }}
              data-testid={`screenplay-manuscript-page-${pageNum}`}
              className="relative bg-[#ffffff] text-[#111111] shadow-[0_4px_24px_rgba(0,0,0,0.5),0_1px_3px_rgba(0,0,0,0.4)] transition-all shrink-0 select-text"
              style={{
                width: `${pageWidthPx}px`,
                height: `${pageHeightPx}px`,
                boxSizing: 'border-box',
                fontFamily: SCREENPLAY_MONO_FONT,
              }}
            >
              {/* Running Page Number Header (Page 2+) */}
              {pageNum >= 2 && (
                <div
                  className="absolute pointer-events-none select-none text-stone-700 font-mono"
                  style={{
                    right: `${Math.round(54 * baseScale)}px`,
                    top: `${Math.round(28 * baseScale)}px`,
                    fontSize: `${Math.round(11 * baseScale)}px`,
                  }}
                >
                  {pageNum}.
                </div>
              )}

              {/* Exact Positioned Text Lines with Block Understanding Badges */}
              {page.lines.map((line, lIdx) => {
                const leftPx = Math.round(line.x * baseScale);
                const topPx = Math.round(line.top * baseScale);
                const fontSizePx = Math.max(9, Math.round(line.fontSize * baseScale));
                const isHeading = line.type === 'scene_heading' || line.type === 'sceneHeading';
                const isChar = line.type === 'character';
                const isDialogue = line.type === 'dialogue';
                const isParens = line.type === 'parenthetical';
                const isTransition = line.type === 'transition';
                const isFocused = focusedLineId === line.id;
                const isMenuOpen = editingTypeMenuLineId === line.id;

                const elemMeta = ELEMENT_LABELS[line.type || 'action'] || ELEMENT_LABELS.action;

                return (
                  <div
                    key={line.id || `p${pageNum}-l${lIdx}`}
                    data-testid={`manuscript-line-${pageNum}-${lIdx}`}
                    data-element-type={line.type || 'action'}
                    className="absolute group z-10"
                    style={{
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      maxWidth: `${pageWidthPx - leftPx - 36}px`,
                    }}
                  >
                    {/* Block Understanding Pill Badge (left gutter indicator) */}
                    {showBlockBadges && (
                      <div
                        className={`absolute -left-20 -top-0.5 transition-opacity pointer-events-auto select-none ${
                          isFocused || isMenuOpen
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-90'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setEditingTypeMenuLineId(isMenuOpen ? null : line.id)}
                          data-testid={`line-type-badge-${line.id}`}
                          title={`Understood as ${elemMeta.label}. Click to adjust element type.`}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider border flex items-center gap-1 cursor-pointer transition ${elemMeta.colorClass} ${elemMeta.bgClass}`}
                        >
                          <span>{elemMeta.label}</span>
                          {line.sceneNumber && (
                            <span className="text-[8px] opacity-75">#{line.sceneNumber}</span>
                          )}
                        </button>

                        {/* Quick Reclassification Dropdown */}
                        {isMenuOpen && (
                          <div className="absolute left-0 top-6 w-36 bg-[#1a1d26] border border-white/15 rounded-lg shadow-2xl py-1 z-50 text-[11px] font-sans">
                            <div className="px-2 py-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider border-b border-white/10">
                              Classify Block As
                            </div>
                            {Object.entries(ELEMENT_LABELS).map(([key, config]) => {
                              const Icon = config.icon;
                              const isSelected = (line.type || 'action') === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => handleLineTypeChange(pIdx, lIdx, key)}
                                  className={`w-full px-2.5 py-1 flex items-center gap-2 text-left hover:bg-white/10 transition cursor-pointer ${
                                    isSelected ? 'text-cyan-300 font-semibold' : 'text-slate-300'
                                  }`}
                                >
                                  <Icon className="w-3 h-3 shrink-0" />
                                  <span>{config.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <span
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                      onFocus={() => setFocusedLineId(line.id)}
                      onBlur={(e) => {
                        setFocusedLineId(null);
                        const updated = e.currentTarget.innerText;
                        if (updated !== line.text) {
                          handleLineTextChange(pIdx, lIdx, updated);
                        }
                      }}
                      className={`block outline-none bg-transparent whitespace-pre cursor-text selection:bg-cyan-300/40 selection:text-black transition-colors rounded-[2px] ${
                        isHeading
                          ? 'font-bold uppercase text-black'
                          : isChar
                          ? 'font-bold uppercase text-stone-900'
                          : isParens
                          ? 'italic text-stone-800'
                          : isTransition
                          ? 'uppercase text-stone-800'
                          : isDialogue
                          ? 'text-stone-950 font-normal'
                          : 'text-stone-950'
                      } ${
                        !readOnly
                          ? 'hover:bg-cyan-50/60 focus:bg-cyan-100/70 focus:ring-1 focus:ring-cyan-500/40'
                          : ''
                      }`}
                      style={{
                        fontSize: `${fontSizePx}px`,
                        lineHeight: '1',
                        fontFamily: SCREENPLAY_MONO_FONT,
                        fontWeight: line.fontWeight || (isHeading || isChar ? 'bold' : 'normal'),
                        fontStyle: line.isItalic || isParens ? 'italic' : 'normal',
                        textAlign: (line.alignment as any) || (isTransition ? 'right' : 'left'),
                        letterSpacing: '0.01em',
                      }}
                    >
                      {line.text}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Navigation Pill for Smooth Page Jumps */}
      {internalLayout.pages.length > 1 && (
        <div className="h-10 border-t border-white/10 bg-[#161922] px-4 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2 font-mono">
            <span>Page</span>
            <span className="font-semibold text-white">{activePage}</span>
            <span>of</span>
            <span>{internalLayout.pages.length}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollToPage(Math.max(1, activePage - 1))}
              disabled={activePage <= 1}
              data-testid="manuscript-prev-page-btn"
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 hover:text-white transition cursor-pointer"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollToPage(Math.min(internalLayout.pages.length, activePage + 1))}
              disabled={activePage >= internalLayout.pages.length}
              data-testid="manuscript-next-page-btn"
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 hover:text-white transition cursor-pointer"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
