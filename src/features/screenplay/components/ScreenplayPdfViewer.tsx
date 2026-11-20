import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Shield,
  FileText,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Loader2,
} from 'lucide-react';
import { pdfjs, ensurePdfWorkerConfigured } from '../services/pdfWorkerConfig';

export interface ScreenplayPdfViewerProps {
  pdfData: string;
  fileName: string;
  onSwitchToEditor: () => void;
}

export const ScreenplayPdfViewer: React.FC<ScreenplayPdfViewerProps> = ({
  pdfData,
  fileName,
  onSwitchToEditor,
}) => {
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const activeRenderTaskRef = useRef<any>(null);

  const handleZoomIn = () => setZoomPercent((prev) => Math.min(200, prev + 15));
  const handleZoomOut = () => setZoomPercent((prev) => Math.max(50, prev - 15));
  const handleResetZoom = () => setZoomPercent(100);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(numPages, prev + 1));
  };

  // 1. Initialize and load the PDF document using PDF.js
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setRenderError(null);

    async function loadPdf() {
      try {
        let uint8Data: Uint8Array;
        if (pdfData.startsWith('data:')) {
          const base64Index = pdfData.indexOf(';base64,');
          if (base64Index !== -1) {
            const rawBase64 = pdfData.slice(base64Index + 8);
            if (typeof atob === 'function') {
              const binaryStr = atob(rawBase64);
              const len = binaryStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              uint8Data = bytes;
            } else if (typeof Buffer !== 'undefined') {
              uint8Data = new Uint8Array(Buffer.from(rawBase64, 'base64'));
            } else {
              throw new Error('Base64 decoder unavailable');
            }
          } else {
            throw new Error('Unsupported data URL format');
          }
        } else {
          // Fallback to fetch if URL
          const res = await fetch(pdfData);
          const buf = await res.arrayBuffer();
          uint8Data = new Uint8Array(buf);
        }

        ensurePdfWorkerConfigured();
        const task = pdfjs.getDocument({
          data: uint8Data,
          useSystemFonts: true,
          disableFontFace: true,
        });

        const doc = await task.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setIsLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        setRenderError(err?.message || 'Could not initialize PDF.js canvas renderer');
        setIsLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
      if (activeRenderTaskRef.current) {
        try {
          activeRenderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [pdfData]);

  // 2. Render the active page onto high-DPI canvas
  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    if (activeRenderTaskRef.current) {
      try {
        activeRenderTaskRef.current.cancel();
      } catch {}
      activeRenderTaskRef.current = null;
    }

    let isSubscribed = true;

    async function renderPage() {
      try {
        const page = await doc.getPage(currentPage);
        if (!isSubscribed || !canvas) return;

        const baseScale = (zoomPercent / 100) * 1.35;
        const viewport = page.getViewport({ scale: baseScale });

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport,
          canvas,
        } as any;

        const renderTask = page.render(renderContext);
        activeRenderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') return;
        // Non-critical, fallback to standard presentation
      }
    }

    renderPage();

    return () => {
      isSubscribed = false;
      if (activeRenderTaskRef.current) {
        try {
          activeRenderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [currentPage, zoomPercent]);

  return (
    <div
      data-testid="screenplay-pdf-viewer"
      className="flex flex-col w-full h-full bg-[#090b10] text-slate-200 overflow-hidden select-none"
    >
      {/* Top Controls Bar */}
      <div className="h-11 px-4 border-b border-white/10 bg-[#12151f] flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSwitchToEditor}
            data-testid="screenplay-pdf-switch-editor-btn"
            className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Editor</span>
          </button>

          <div className="h-4 w-px bg-white/10" aria-hidden="true" />

          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-100 max-w-xs md:max-w-md truncate">
              {fileName}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0">
              <Shield className="w-3 h-3" />
              Source PDF (Untouched)
            </span>
          </div>
        </div>

        {/* Center: Page Navigation */}
        <div className="hidden sm:flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            data-testid="screenplay-pdf-prev-btn"
            aria-label="Previous Page"
            className="p-1 rounded hover:bg-white/10 text-slate-300 disabled:opacity-40 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            data-testid="screenplay-pdf-page-indicator"
            className="px-2 py-0.5 rounded bg-black/40 border border-white/5 font-mono text-[11px] text-slate-300 flex items-center gap-1"
          >
            <span>Page</span>
            <span className="text-cyan-400 font-semibold">{currentPage}</span>
            <span className="opacity-50">/</span>
            <span>{numPages}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoading}
            data-testid="screenplay-pdf-next-btn"
            aria-label="Next Page"
            className="p-1 rounded hover:bg-white/10 text-slate-300 disabled:opacity-40 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Zoom controls */}
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={handleZoomOut}
            data-testid="screenplay-pdf-zoom-out"
            aria-label="Zoom Out"
            title="Zoom Out (-15%)"
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 transition cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset Zoom to 100%"
            className="font-mono text-[11px] px-1 text-slate-400 hover:text-white w-12 text-center transition cursor-pointer"
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            data-testid="screenplay-pdf-zoom-in"
            aria-label="Zoom In"
            title="Zoom In (+15%)"
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 transition cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div className="flex-1 w-full h-full overflow-auto p-4 sm:p-8 flex flex-col items-center justify-start bg-[#05070a]">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-xs">Loading PDF pages...</span>
          </div>
        )}

        {/* High-DPI Virtualized PDF Canvas */}
        <div
          className={`flex flex-col items-center transition-all ${
            isLoading ? 'hidden' : 'flex'
          }`}
        >
          {renderError ? (
            /* Fallback to browser standard presentation if canvas rendering fails */
            <div className="w-full max-w-4xl h-[85vh] rounded-xl shadow-2xl border border-white/10 overflow-hidden bg-white">
              <iframe
                src={pdfData}
                title={fileName}
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="relative shadow-2xl rounded-sm border border-black/20 bg-white">
              <canvas
                ref={canvasRef}
                className="block rounded-sm max-w-full"
                aria-label={`PDF page ${currentPage}`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScreenplayPdfViewer;
