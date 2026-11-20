import React, { useRef, useState } from 'react';
import {
  FilePlus2,
  FolderOpen,
  Upload,
  X,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { ScreenplayVersion } from '../../../types';

export interface ScreenplayEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNewScreenplay: () => void;
  onSelectVersion: (versionId: string) => void;
  onOpenLibraryPanel: () => void;
  onTriggerNativeImport: () => void;
  onImportFileDirect: (file: File) => void;
  versions: ScreenplayVersion[];
  activeVersionId: string;
  projectName: string;
  hasExistingScript?: boolean;
}

export const ScreenplayEntryDialog: React.FC<ScreenplayEntryDialogProps> = ({
  isOpen,
  onClose,
  onNewScreenplay,
  onSelectVersion,
  onOpenLibraryPanel,
  onTriggerNativeImport,
  onImportFileDirect,
  versions,
  activeVersionId,
  projectName,
  hasExistingScript = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  if (!isOpen) return null;

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounterRef.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onImportFileDirect(file);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screenplay Welcome"
      data-testid="screenplay-entry-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0f131d]/95 p-6 sm:p-8 shadow-2xl text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Background Glow */}
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Header Section */}
        <div className="flex items-start justify-between gap-4 mb-6 relative">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold tracking-wide uppercase mb-2">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>SceneOS Screenplay Workspace</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Screenplay Authoring
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Professional industry manuscript editor with zero-perceptible lag, automatic element classification, and multi-format document support.
            </p>
          </div>

          {hasExistingScript && (
            <button
              type="button"
              onClick={onClose}
              data-testid="screenplay-entry-close-btn"
              aria-label="Close Entry Dialog"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 3 Core Workflow Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative">
          {/* Card 1: New Screenplay */}
          <div
            data-testid="screenplay-entry-new-card"
            className="flex flex-col justify-between p-5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-500/40 transition group cursor-pointer"
            onClick={() => {
              onNewScreenplay();
              onClose();
            }}
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                <FilePlus2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                New Screenplay
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Start a fresh screenplay from a blank page with industry-standard margins, scene headings, and character formatting.
              </p>
            </div>
            <button
              type="button"
              data-testid="screenplay-entry-new-btn"
              onClick={(e) => {
                e.stopPropagation();
                onNewScreenplay();
                onClose();
              }}
              className="mt-4 w-full h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-cyan-400 hover:text-slate-950 text-white transition-all cursor-pointer shadow-sm"
            >
              <span>Create Blank Script</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Open Project / Library */}
          <div
            data-testid="screenplay-entry-open-card"
            className="flex flex-col justify-between p-5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-500/40 transition group cursor-pointer"
            onClick={() => {
              onOpenLibraryPanel();
              onClose();
            }}
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                <FolderOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Open Screenplay
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Reopen a saved draft, revision checkpoint, or sample scene from this project's script library.
              </p>

              {/* Quick Drafts List if Available */}
              {versions && versions.length > 0 && (
                <div className="mt-3 space-y-1 max-h-24 overflow-y-auto pr-1">
                  {versions.slice(0, 3).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      data-testid={`screenplay-entry-draft-item-${v.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVersion(v.id);
                        onClose();
                      }}
                      className={`w-full text-left px-2 py-1 rounded text-[11px] truncate flex items-center justify-between ${
                        v.id === activeVersionId
                          ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{v.title}</span>
                      {v.id === activeVersionId && (
                        <Check className="w-3 h-3 text-cyan-400 shrink-0 ml-1" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              data-testid="screenplay-entry-open-library-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLibraryPanel();
                onClose();
              }}
              className="mt-4 w-full h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-cyan-500 hover:text-slate-950 text-white transition-all cursor-pointer shadow-sm"
            >
              <span>Browse Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3: Import Screenplay (Direct File Picker) */}
          <div
            data-testid="screenplay-entry-import-card"
            className={`flex flex-col justify-between p-5 rounded-xl border transition group cursor-pointer ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-500/30'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/40'
            }`}
            onClick={() => {
              onTriggerNativeImport();
            }}
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Import Screenplay
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Select a script file from your computer. Opens directly into the live editable editor without conversion wizards.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {['.PDF', '.FDX', '.FOUNTAIN', '.DOCX'].map((fmt) => (
                  <span
                    key={fmt}
                    className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-semibold"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              data-testid="screenplay-entry-import-btn"
              onClick={(e) => {
                e.stopPropagation();
                onTriggerNativeImport();
              }}
              className="mt-4 w-full h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all cursor-pointer shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select File from Computer</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Files are processed locally on your machine with strict document fidelity.</span>
          </div>
          {hasExistingScript && (
            <button
              type="button"
              onClick={onClose}
              data-testid="screenplay-entry-continue-btn"
              className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer font-medium"
            >
              Continue to Manuscript →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
