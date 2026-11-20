import React from 'react';
import { X, FileText, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

export interface ScreenplayPdfCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDataUrl?: string;
  pdfFileName?: string;
  draftTitle: string;
}

export const ScreenplayPdfCompareModal: React.FC<ScreenplayPdfCompareModalProps> = ({
  isOpen,
  onClose,
  pdfDataUrl,
  pdfFileName,
  draftTitle,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Compare Editable Manuscript with Source PDF"
      data-testid="screenplay-pdf-compare-modal"
    >
      <div className="relative w-full max-w-6xl h-[92vh] bg-[#0f1218] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">
                  Source PDF Comparison
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Immutable Source
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparing original untouched PDF{' '}
                <span className="font-mono text-slate-300">
                  ({pdfFileName || 'source.pdf'})
                </span>{' '}
                against editable draft{' '}
                <span className="text-cyan-300 font-medium font-mono">
                  &ldquo;{draftTitle}&rdquo;
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Comparison"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {pdfDataUrl ? (
            <div className="flex-1 flex flex-col w-full h-full bg-[#0a0c10]">
              <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Source PDF preserved verbatim. All edits in SceneOS apply strictly to the reflowable manuscript.
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  Browser PDF Viewer
                </span>
              </div>
              <iframe
                src={pdfDataUrl}
                title="Original Source PDF Document"
                className="w-full flex-1 border-0"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
                <AlertCircle className="w-6 h-6 text-cyan-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">
                No Original Source PDF Attached
              </h4>
              <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
                This screenplay was created natively or imported from Fountain / Final Draft (.fdx), which did not include an underlying immutable PDF file. To use source comparison, import a screenplay directly from a .pdf file.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#141822] flex items-center justify-between text-xs text-slate-400">
          <span>
            Original PDF is stored immutably alongside the draft record and never overwritten by edits.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-100 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
