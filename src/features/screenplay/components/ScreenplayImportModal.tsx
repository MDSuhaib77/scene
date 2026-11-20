/**
 * Screenplay Direct Import Modal
 *
 * Implements the direct WriterSolo import experience:
 * Import -> Select file -> Click Import -> Editable screenplay opens directly.
 *
 * All complex parsing, geometry reconstruction, element classification,
 * and canonical conversion happen silently in the pipeline.
 * No technical parser reports, conversion wizards, confidence scores,
 * or diagnostic warnings are exposed to the writer.
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck,
  Loader2,
  FileCode,
} from 'lucide-react';
import {
  processScreenplayImportFile,
  SupportedImportFormat,
} from '../services/screenplayImportService';
import { CanonicalScreenplayDocument } from '../model/canonicalScreenplay';

export interface ScreenplayImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (
    canonical: CanonicalScreenplayDocument,
    originalRawText: string,
    options?: { openView?: 'screenplay' | 'pdf' }
  ) => void;
  projectTitle?: string;
}

export const ScreenplayImportModal: React.FC<ScreenplayImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilePicked = (file: File) => {
    setError(null);
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilePicked(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleExecuteImport = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const previewData = await processScreenplayImportFile(selectedFile);

      // Verify whether the PDF is a scanned image with no extracted text
      const isScannedPdf =
        previewData.detectedFormat === 'pdf' &&
        previewData.warnings.some((w) => w.id === 'pdf-scanned-image') &&
        previewData.totalScenes === 0 &&
        (!previewData.plainTextPreview || previewData.plainTextPreview.length < 40);

      if (isScannedPdf) {
        throw new Error(
          'This PDF appears to be a scanned document without a selectable text layer. Please import a text-based PDF, Fountain, or Final Draft (.fdx) file.'
        );
      }

      // Directly open the editable screenplay in the editor
      onConfirmImport(previewData.canonical, previewData.plainTextPreview || '');
      onClose();
    } catch (err: any) {
      const message =
        err?.message ||
        'Could not import the selected screenplay file. Please ensure it is a valid screenplay document.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getFormatBadge = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          PDF Screenplay
        </span>
      );
    }
    if (lower.endsWith('.fdx')) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
          Final Draft (.fdx)
        </span>
      );
    }
    if (lower.endsWith('.fountain') || lower.endsWith('.spmd')) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Fountain
        </span>
      );
    }
    if (lower.endsWith('.docx')) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
          Word (.docx)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/50">
        Screenplay
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screenplay-import-dialog-title"
    >
      <div className="relative w-full max-w-lg bg-[#11141c] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#161a24]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="screenplay-import-dialog-title"
                className="text-sm font-semibold text-slate-100"
              >
                Import Screenplay
              </h2>
              <p className="text-xs text-slate-400">
                Directly open an existing screenplay into the editor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition cursor-pointer"
            title="Cancel"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.fdx,.fountain,.spmd,.docx"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilePicked(e.target.files[0]);
              }
            }}
          />

          {!selectedFile ? (
            /* File Picker & Drop Target */
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-white/15 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 mb-3">
                <FileText className="w-6 h-6 text-cyan-400" />
              </div>

              <p className="text-sm font-medium text-slate-200">
                Choose screenplay file, or{' '}
                <span className="text-cyan-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Supports standard screenplay files:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-slate-300 border border-white/10">
                  .pdf
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-slate-300 border border-white/10">
                  .fdx
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-slate-300 border border-white/10">
                  .fountain
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-slate-300 border border-white/10">
                  .docx
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                Zero data loss • Non-destructive import
              </p>
            </div>
          ) : (
            /* Selected File Card */
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                    <FileCheck className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <div>{getFormatBadge(selectedFile.name)}</div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={isLoading}
                  className="text-xs text-slate-400 hover:text-slate-200 transition underline cursor-pointer"
                >
                  Choose a different file
                </button>
                <div className="text-[11px] text-slate-500">
                  Zero data loss • Non-destructive import
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-start gap-2.5"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-rose-200">Import Unsuccessful</div>
                <div className="text-[11px] leading-relaxed opacity-90">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-white/[0.08] bg-[#161a24]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition cursor-pointer"
          >
            Cancel
          </button>

          {selectedFile && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isLoading}
              data-testid="screenplay-import-confirm-btn"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing screenplay...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Import Screenplay</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
