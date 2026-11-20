import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  FilePlus2,
  BookOpen,
  Upload,
  Download,
  Clapperboard,
  LayoutDashboard,
  Calendar,
  Users,
  Check,
  ListTree,
  Bookmark,
  Flag,
  Layers,
  Search,
  Copy,
  Trash2,
  Edit3,
  History,
  GitCompare,
  RotateCcw,
  AlertTriangle,
  Library,
  Sparkles,
} from 'lucide-react';
import { ScreenplayVersion } from '../../../types';
import { ScreenplayPanelSection } from './ScreenplayNavigationRail';
import { ScreenplayOutlineEntry } from '../commands/screenplayCommands';
import {
  ScreenplayExportFormat,
  ScreenplayImportPreview,
  filterScriptLibrary,
  computeDocumentQuickStats,
  computeRevisionDiff,
  importScreenplayFile,
} from '../services/screenplayDocumentLifecycle';
import { processScreenplayImportFile } from '../services/screenplayImportService';

export interface ScreenplayNavigationPanelProps {
  isOpen: boolean;
  activeSection: ScreenplayPanelSection;
  onSelectSection: (section: ScreenplayPanelSection) => void;
  onClose: () => void;
  projectName: string;
  versions: ScreenplayVersion[];
  activeVersionId: string;
  currentLiveText?: string;
  onSelectVersion: (versionId: string) => void;
  onNewBlankDraft: (customTitle?: string) => void;
  onLoadSampleScript: () => void;
  onImportScriptFile: (title: string, content: string) => void;
  onImportFileDirect?: (file: File) => void | Promise<void>;
  onImportPreviewConfirm?: (
    preview: ScreenplayImportPreview,
    mode: 'new' | 'replace'
  ) => void;
  onRenameScript?: (versionId: string, nextTitle: string) => void;
  onDuplicateScript?: (versionId: string) => void;
  onDeleteScript?: (versionId: string) => void;
  onCreateCheckpoint?: (changeDescription: string) => void;
  onRestoreRevision?: (revisionId: string) => void;
  onExportScript?: (format: ScreenplayExportFormat) => void;
  outlineEntries: ScreenplayOutlineEntry[];
  selectedOutlinePos?: number | null;
  onNavigateOutlineEntry: (pos: number) => void;
  onOpenSceneMatrix?: () => void;
  onOpenImportModal?: () => void;
  pageCount?: number;
  activePageNumber?: number;
  onNavigateToPage?: (pageNumber: number) => void;
  onNavigateTab?: (tab: string) => void;
  readOnly?: boolean;
}

export const ScreenplayNavigationPanel: React.FC<ScreenplayNavigationPanelProps> = ({
  isOpen,
  activeSection,
  onSelectSection,
  onClose,
  projectName,
  versions = [],
  activeVersionId,
  currentLiveText = '',
  onSelectVersion,
  onNewBlankDraft,
  onLoadSampleScript,
  onImportScriptFile,
  onImportFileDirect,
  onImportPreviewConfirm,
  onRenameScript,
  onDuplicateScript,
  onDeleteScript,
  onCreateCheckpoint,
  onRestoreRevision,
  onExportScript,
  outlineEntries = [],
  selectedOutlinePos = null,
  onNavigateOutlineEntry,
  onOpenSceneMatrix,
  onOpenImportModal,
  pageCount = 1,
  activePageNumber = 1,
  onNavigateToPage,
  onNavigateTab,
  readOnly = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Script Library local UI state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newScriptTitle, setNewScriptTitle] = useState<string>('');
  const [isCreatingScript, setIsCreatingScript] = useState<boolean>(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Revisions / Checkpoint local UI state
  const [checkpointNote, setCheckpointNote] = useState<string>('');
  const [comparingRevisionId, setComparingRevisionId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  // Import local UI state
  const [importPreview, setImportPreview] = useState<ScreenplayImportPreview | null>(
    null
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsingImport, setIsParsingImport] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredVersions = useMemo(
    () => filterScriptLibrary(versions, searchQuery),
    [versions, searchQuery]
  );

  const activeVersion = useMemo(
    () => versions.find((v) => v.id === activeVersionId) ?? null,
    [versions, activeVersionId]
  );

  const activeRevisions = useMemo(() => {
    if (!activeVersion) return [];
    const list = activeVersion.revisions ?? [];
    if (list.length > 0) {
      return [...list].reverse();
    }
    // Synthesize initial revision view for legacy version records without an explicit array
    return [
      {
        id: `${activeVersion.id}-base`,
        versionLabel: activeVersion.version || 'v1.0',
        title: activeVersion.title,
        author: activeVersion.author || 'Screenwriter',
        createdAt: activeVersion.updatedAt || '',
        changeDescription:
          activeVersion.changeDescription || 'Saved screenplay draft',
        rawText: activeVersion.rawText ?? activeVersion.contentSnippet ?? '',
        documentJson: activeVersion.documentJson ?? '',
      },
    ];
  }, [activeVersion]);

  const comparedDiff = useMemo(() => {
    if (!comparingRevisionId) return null;
    const target = activeRevisions.find((r) => r.id === comparingRevisionId);
    if (!target) return null;
    return {
      revision: target,
      diff: computeRevisionDiff(target.rawText, currentLiveText),
    };
  }, [comparingRevisionId, activeRevisions, currentLiveText]);

  if (!isOpen) {
    return null;
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);

    if (onImportFileDirect) {
      try {
        setIsParsingImport(true);
        await onImportFileDirect(file);
        onClose();
      } catch (err: any) {
        setImportError(err?.message || 'Failed to import screenplay document.');
      } finally {
        setIsParsingImport(false);
      }
      return;
    }

    if (onImportPreviewConfirm) {
      try {
        setIsParsingImport(true);
        const preview = await importScreenplayFile(file);
        setImportPreview(preview);
      } catch (err: any) {
        setImportPreview(null);
        setImportError(
          err?.message || 'Unable to parse the selected screenplay file.'
        );
      } finally {
        setIsParsingImport(false);
      }
      return;
    }

    // Safety fallback
    try {
      setIsParsingImport(true);
      const previewData = await processScreenplayImportFile(file);
      onImportScriptFile(
        previewData.title || file.name.replace(/\.[^/.]+$/, ''),
        previewData.plainTextPreview
      );
      onClose();
    } catch (err: any) {
      setImportError(err?.message || 'Failed to import file.');
    } finally {
      setIsParsingImport(false);
    }
  };

  const handleConfirmCreateScript = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const titleToCreate =
      newScriptTitle.trim() || `${projectName} — Script ${versions.length + 1}`;
    onNewBlankDraft(titleToCreate);
    setNewScriptTitle('');
    setIsCreatingScript(false);
  };

  const handleStartRename = (ver: ScreenplayVersion) => {
    if (readOnly) return;
    setRenamingId(ver.id);
    setRenameValue(ver.title);
  };

  const handleCommitRename = (versionId: string) => {
    if (onRenameScript && renameValue.trim()) {
      onRenameScript(versionId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleCreateCheckpointSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !onCreateCheckpoint) return;
    onCreateCheckpoint(checkpointNote.trim() || 'Manual version checkpoint');
    setCheckpointNote('');
  };

  const formatShortTimestamp = (raw?: string) => {
    if (!raw) return 'Saved';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Subtle click-outside backdrop that keeps the manuscript razor-sharp and unshifted */}
      <div
        className="absolute inset-0 z-20 bg-black/15"
        onClick={onClose}
        aria-hidden="true"
        data-testid="screenplay-nav-panel-backdrop"
      />

      <aside
        id="screenplay-secondary-nav-panel"
        aria-label="Screenplay secondary navigation"
        data-testid="screenplay-navigation-panel"
        className="absolute top-0 bottom-0 left-0 w-80 z-30 flex flex-col border-r border-cyan-500/20 shadow-2xl select-none bg-[#090d22]/90 backdrop-blur-2xl"
        style={{
          color: 'var(--scr-text-primary)',
        }}
      >
        {/* Unified Sub-Section Header: Library & History */}
        <div
          className="h-11 px-3 flex items-center justify-between border-b border-cyan-500/15 shrink-0 bg-black/40 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold text-white tracking-tight truncate">
              Library & History
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              {versions.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close screenplay navigation panel"
            title="Close Panel (Esc)"
            data-testid="screenplay-close-nav-panel"
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[#9ba3b4] hover:text-white hover:bg-cyan-500/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 scrollbar-cinema">
          {/* Segmented Mode Selector within the Unified Library & History Sub-section */}
          <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/[0.08] mb-3">
            <button
              type="button"
              onClick={() => onSelectSection('drafts')}
              data-testid="screenplay-panel-tab-drafts"
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                activeSection !== 'revisions'
                  ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/20 text-cyan-200 border border-cyan-400/40 font-semibold shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Script Library ({versions.length})
            </button>
            <button
              type="button"
              onClick={() => onSelectSection('revisions')}
              data-testid="screenplay-panel-tab-revisions"
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                activeSection === 'revisions'
                  ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/20 text-cyan-200 border border-cyan-400/40 font-semibold shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Version History ({activeRevisions.length})
            </button>
          </div>

          {activeSection === 'revisions' ? (

            /* Version History, Checkpoints, Diff & Restoration Section */
            <div data-testid="screenplay-revisions-view" className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--scr-text-muted)' }}
                  >
                    Version Checkpoints
                  </span>
                  <span
                    className="text-[11px] font-mono tabular-nums"
                    style={{ color: 'var(--scr-text-muted)' }}
                  >
                    {activeRevisions.length} saved
                  </span>
                </div>
                {activeVersion && (
                  <p className="text-xs font-medium text-slate-200 mt-1 truncate">
                    {activeVersion.title}
                  </p>
                )}
              </div>

              {/* Create Checkpoint Form */}
              {!readOnly && onCreateCheckpoint && (
                <form
                  onSubmit={handleCreateCheckpointSubmit}
                  data-testid="screenplay-checkpoint-form"
                  className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.09] space-y-2"
                >
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                    Create Version Snapshot
                  </label>
                  <input
                    type="text"
                    value={checkpointNote}
                    onChange={(e) => setCheckpointNote(e.target.value)}
                    placeholder="e.g. Polish Act I dialogue pass"
                    aria-label="Version checkpoint description"
                    data-testid="screenplay-checkpoint-note-input"
                    className="w-full h-7 px-2 rounded text-xs bg-black/30 border border-white/[0.12] text-white placeholder:text-[#6b7385] focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    data-testid="screenplay-create-checkpoint-btn"
                    className="w-full py-1.5 px-2.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Save Version Checkpoint</span>
                  </button>
                </form>
              )}

              {/* Active Revision Comparison View */}
              {comparedDiff && (
                <div
                  data-testid="screenplay-revision-diff-view"
                  className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/35 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-cyan-300">
                      Comparing {comparedDiff.revision.versionLabel} → Current
                    </span>
                    <button
                      type="button"
                      onClick={() => setComparingRevisionId(null)}
                      className="text-[10px] text-[#9ba3b4] hover:text-white cursor-pointer"
                    >
                      Close Diff
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-emerald-400">
                      +{comparedDiff.diff.addedCount} added
                    </span>
                    <span className="text-rose-400">
                      -{comparedDiff.diff.removedCount} removed
                    </span>
                    <span className="text-slate-400">
                      {comparedDiff.diff.unchangedCount} unchanged
                    </span>
                  </div>
                  {comparedDiff.diff.isIdentical ? (
                    <p className="text-[11px] text-slate-400 italic py-1">
                      Current editor text is identical to{' '}
                      {comparedDiff.revision.versionLabel}.
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1 font-mono text-[10px] p-1.5 rounded bg-black/50 scrollbar-cinema">
                      {comparedDiff.diff.lines.slice(0, 60).map((line, idx) => (
                        <div
                          key={idx}
                          className={`px-1.5 py-0.5 rounded truncate ${
                            line.type === 'added'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : line.type === 'removed'
                                ? 'bg-rose-500/15 text-rose-300 line-through'
                                : 'text-slate-400'
                          }`}
                        >
                          {line.type === 'added'
                            ? '+ '
                            : line.type === 'removed'
                              ? '- '
                              : '  '}
                          {line.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Revisions List */}
              {activeRevisions.length === 0 ? (
                <p
                  className="text-xs py-3 px-2.5 rounded border border-dashed"
                  style={{
                    borderColor: 'var(--scr-border)',
                    color: 'var(--scr-text-secondary)',
                  }}
                >
                  No version checkpoints recorded for this script yet.
                </p>
              ) : (
                <ul
                  className="space-y-2"
                  data-testid="screenplay-revisions-list"
                >
                  {activeRevisions.map((rev, index) => {
                    const isComparing = comparingRevisionId === rev.id;
                    const isConfirmingRestore = confirmRestoreId === rev.id;
                    const stats = computeDocumentQuickStats(
                      rev.documentJson,
                      rev.rawText
                    );

                    return (
                      <li
                        key={rev.id}
                        data-testid={`screenplay-revision-item-${rev.id}`}
                        className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.07] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[10px] font-bold">
                              {rev.versionLabel}
                            </span>
                            {index === 0 && (
                              <span className="text-[9px] font-mono uppercase text-emerald-400">
                                Latest
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[10px] font-mono"
                            style={{ color: 'var(--scr-text-muted)' }}
                          >
                            {formatShortTimestamp(rev.createdAt)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-200 leading-snug">
                          {rev.changeDescription}
                        </p>

                        <div
                          className="text-[10px] font-mono flex items-center gap-2"
                          style={{ color: 'var(--scr-text-muted)' }}
                        >
                          <span>{rev.author}</span>
                          <span>•</span>
                          <span>{stats.wordCount} words</span>
                        </div>

                        {isConfirmingRestore ? (
                          <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-cyan-500/30">
                            <span className="text-[10px] text-cyan-300">
                              Restore {rev.versionLabel} into editor?
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreId(null)}
                                className="px-2 py-0.5 rounded text-[10px] text-slate-300 hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onRestoreRevision?.(rev.id);
                                  setConfirmRestoreId(null);
                                }}
                                data-testid={`screenplay-confirm-restore-btn-${rev.id}`}
                                className="px-2 py-0.5 rounded bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-semibold text-[10px] cursor-pointer"
                              >
                                Confirm Restore
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="pt-1.5 border-t flex items-center gap-2 text-[10px]"
                            style={{ borderColor: 'var(--scr-border)' }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setComparingRevisionId(isComparing ? null : rev.id)
                              }
                              data-testid={`screenplay-compare-revision-btn-${rev.id}`}
                              className={`px-1.5 py-0.5 rounded inline-flex items-center gap-1 cursor-pointer ${
                                isComparing
                                  ? 'bg-cyan-500/20 text-cyan-300'
                                  : 'hover:bg-white/[0.07] text-[#9ba3b4] hover:text-white'
                              }`}
                            >
                              <GitCompare className="w-3 h-3" />
                              <span>{isComparing ? 'Hide Diff' : 'Compare'}</span>
                            </button>

                            {!readOnly && onRestoreRevision && (
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreId(rev.id)}
                                data-testid={`screenplay-restore-revision-btn-${rev.id}`}
                                className="px-1.5 py-0.5 rounded hover:bg-cyan-500/15 text-[#9ba3b4] hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Restore</span>
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (

            <div data-testid="screenplay-library-view" className="space-y-4">
              {/* Bookshelf Header & Create Script Trigger */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Library className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
                    Script Library
                  </span>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingScript((prev) => !prev)}
                    data-testid="screenplay-toggle-create-script-btn"
                    className="h-6 px-2 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <FilePlus2 className="w-3 h-3" />
                    <span>New Script</span>
                  </button>
                )}
              </div>

              {/* Inline Create Script Form */}
              {isCreatingScript && !readOnly && (
                <form
                  onSubmit={handleConfirmCreateScript}
                  data-testid="screenplay-create-script-form"
                  className="p-2.5 rounded-lg bg-white/[0.03] border border-emerald-500/30 space-y-2"
                >
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    New Blank Screenplay Title
                  </label>
                  <input
                    type="text"
                    value={newScriptTitle}
                    onChange={(e) => setNewScriptTitle(e.target.value)}
                    placeholder={`${projectName} — Shooting Script`}
                    aria-label="New screenplay title"
                    data-testid="screenplay-new-script-title-input"
                    className="w-full h-7 px-2 rounded text-xs bg-black/30 border border-white/[0.12] text-white focus:outline-none focus:border-emerald-400"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingScript(false);
                        setNewScriptTitle('');
                      }}
                      className="px-2 py-1 rounded text-[11px] text-[#9ba3b4] hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="screenplay-create-script-btn"
                      className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-[11px] cursor-pointer"
                    >
                      Create Blank Script
                    </button>
                  </div>
                </form>
              )}

              {/* Library Search Input */}
              {versions.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#6b7385] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter scripts by title, version, or line..."
                    aria-label="Search scripts in library"
                    data-testid="screenplay-library-search-input"
                    className="w-full h-7 pl-8 pr-2.5 rounded-md text-xs bg-white/[0.04] border border-white/[0.08] text-slate-200 placeholder:text-[#6b7385] focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
              )}

              {/* Bookshelf Script Spine Collection */}
              {versions.length === 0 ? (
                <div
                  className="text-xs py-4 px-3 rounded-lg border border-dashed space-y-2"
                  style={{
                    borderColor: 'var(--scr-border)',
                    color: 'var(--scr-text-secondary)',
                  }}
                  data-testid="screenplay-library-empty"
                >
                  <p className="font-medium text-slate-200">
                    Your project bookshelf is empty.
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Create a blank script above, import an existing{' '}
                    <code>.fountain</code> or <code>.fdx</code> manuscript, or
                    click <strong>Save Draft</strong> in the toolbar.
                  </p>
                </div>
              ) : filteredVersions.length === 0 ? (
                <p
                  className="text-xs py-3 px-2.5 rounded border border-dashed text-center"
                  style={{
                    borderColor: 'var(--scr-border)',
                    color: 'var(--scr-text-secondary)',
                  }}
                  data-testid="screenplay-library-no-matches"
                >
                  No scripts match &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                <ul
                  className="space-y-2"
                  role="listbox"
                  aria-label="Stored screenplay drafts"
                  data-testid="screenplay-library-list"
                >
                  {filteredVersions.map((ver) => {
                    const isSelected = ver.id === activeVersionId;
                    const textBody = ver.rawText ?? ver.contentSnippet ?? '';
                    const stats = computeDocumentQuickStats(
                      ver.documentJson,
                      textBody
                    );
                    const isRenaming = renamingId === ver.id;
                    const isConfirmingDelete = confirmDeleteId === ver.id;
                    const revCount = ver.revisions?.length ?? 1;

                    return (
                      <li
                        key={ver.id}
                        data-testid={`screenplay-library-card-${ver.id}`}
                        className={`relative rounded-lg border transition-colors overflow-hidden ${
                          isSelected
                            ? 'bg-emerald-500/[0.09] border-emerald-500/40'
                            : 'bg-white/[0.025] hover:bg-white/[0.05] border-white/[0.07]'
                        }`}
                      >
                        {/* Bookshelf Spine Accent Bar */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${
                            isSelected ? 'bg-emerald-400' : 'bg-cyan-500/35'
                          }`}
                          aria-hidden="true"
                        />

                        <div className="pl-3 pr-2.5 py-2.5 space-y-2">
                          {isRenaming ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                aria-label="Rename screenplay title"
                                data-testid={`screenplay-rename-input-${ver.id}`}
                                className="w-full h-7 px-2 rounded text-xs bg-black/40 border border-emerald-500/40 text-white focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCommitRename(ver.id);
                                  } else if (e.key === 'Escape') {
                                    e.stopPropagation();
                                    setRenamingId(null);
                                  }
                                }}
                              />
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setRenamingId(null)}
                                  className="px-2 py-0.5 rounded text-[10px] text-[#9ba3b4] hover:text-white cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCommitRename(ver.id)}
                                  data-testid={`screenplay-rename-save-btn-${ver.id}`}
                                  className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-semibold text-[10px] cursor-pointer"
                                >
                                  Save Title
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectVersion(ver.id);
                                onClose();
                              }}
                              data-testid={`screenplay-open-script-btn-${ver.id}`}
                              className="w-full text-left flex items-start justify-between gap-2 cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-100 truncate">
                                    {ver.title}
                                  </span>
                                  {ver.version && (
                                    <span className="px-1.5 py-0.2 rounded bg-white/[0.07] text-[10px] font-mono text-emerald-300">
                                      {ver.version}
                                    </span>
                                  )}
                                  {ver.sourceFormat && (
                                    <span className="px-1 py-0.2 rounded bg-cyan-500/10 text-[9px] font-mono uppercase text-cyan-300">
                                      {ver.sourceFormat}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap font-mono"
                                  style={{ color: 'var(--scr-text-muted)' }}
                                >
                                  <span>{formatShortTimestamp(ver.updatedAt)}</span>
                                  <span>•</span>
                                  <span>{stats.wordCount} words</span>
                                  <span>•</span>
                                  <span>
                                    {revCount} {revCount === 1 ? 'rev' : 'revs'}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono uppercase tracking-wider shrink-0 flex items-center gap-1"
                                  data-testid="screenplay-active-script-badge"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  Active
                                </span>
                              )}
                            </button>
                          )}

                          {/* Inline Delete Confirmation or Bookshelf Card Action Bar */}
                          {isConfirmingDelete ? (
                            <div
                              data-testid={`screenplay-delete-confirm-box-${ver.id}`}
                              className="p-2 rounded bg-rose-950/60 border border-rose-500/35 flex items-center justify-between gap-2"
                            >
                              <span className="text-[10px] text-rose-200 font-medium">
                                Delete this script permanently?
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 rounded text-[10px] text-slate-300 hover:text-white cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteScript?.(ver.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  data-testid={`screenplay-confirm-delete-btn-${ver.id}`}
                                  className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-white font-semibold text-[10px] cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="pt-1.5 border-t flex items-center justify-between gap-1 text-[10px]"
                              style={{ borderColor: 'var(--scr-border)' }}
                            >
                              <div className="flex items-center gap-1">
                                {!readOnly && onRenameScript && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartRename(ver)}
                                    data-testid={`screenplay-rename-script-btn-${ver.id}`}
                                    title="Rename script"
                                    className="px-1.5 py-0.5 rounded hover:bg-white/[0.07] text-[#9ba3b4] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                    <span>Rename</span>
                                  </button>
                                )}
                                {!readOnly && onDuplicateScript && (
                                  <button
                                    type="button"
                                    onClick={() => onDuplicateScript(ver.id)}
                                    data-testid={`screenplay-duplicate-script-btn-${ver.id}`}
                                    title="Duplicate script as independent document"
                                    className="px-1.5 py-0.5 rounded hover:bg-white/[0.07] text-[#9ba3b4] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    <span>Duplicate</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isSelected) {
                                      onSelectVersion(ver.id);
                                    }
                                    onSelectSection('revisions');
                                  }}
                                  data-testid={`screenplay-history-script-btn-${ver.id}`}
                                  title="View version checkpoints and history"
                                  className="px-1.5 py-0.5 rounded hover:bg-white/[0.07] text-[#9ba3b4] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <History className="w-2.5 h-2.5" />
                                  <span>History</span>
                                </button>
                              </div>

                              {!readOnly && onDeleteScript && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(ver.id)}
                                  data-testid={`screenplay-delete-script-btn-${ver.id}`}
                                  title="Delete script from library"
                                  className="px-1.5 py-0.5 rounded hover:bg-rose-500/15 text-[#9ba3b4] hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Export Active Manuscript Section */}
              {onExportScript && (
                <div
                  className="pt-3 border-t space-y-2"
                  style={{ borderColor: 'var(--scr-border)' }}
                >
                  <span
                    className="block text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--scr-text-muted)' }}
                  >
                    Export Active Manuscript
                  </span>
                  <button
                    type="button"
                    onClick={() => onExportScript('pdf')}
                    data-testid="screenplay-quick-export-pdf-btn"
                    className="w-full py-1.5 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-medium text-cyan-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Quick Export (PDF)</span>
                  </button>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onExportScript('pdf')}
                      data-testid="screenplay-export-pdf-btn"
                      className="py-1.5 px-1 rounded bg-white/[0.04] hover:bg-cyan-500/15 border border-white/[0.08] hover:border-cyan-500/35 text-[11px] font-mono text-slate-200 hover:text-cyan-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>.pdf</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportScript('fountain')}
                      data-testid="screenplay-export-fountain-btn"
                      className="py-1.5 px-1 rounded bg-white/[0.04] hover:bg-emerald-500/15 border border-white/[0.08] hover:border-emerald-500/35 text-[11px] font-mono text-slate-200 hover:text-emerald-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>.fountain</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportScript('fdx')}
                      data-testid="screenplay-export-fdx-btn"
                      className="py-1.5 px-1 rounded bg-white/[0.04] hover:bg-cyan-500/15 border border-white/[0.08] hover:border-cyan-500/35 text-[11px] font-mono text-slate-200 hover:text-cyan-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>.fdx</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Document Actions */}
              <div className="pt-3 border-t" style={{ borderColor: 'var(--scr-border)' }}>
                <span
                  className="block text-[11px] font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--scr-text-muted)' }}
                >
                  Manuscript Actions
                </span>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      onNewBlankDraft();
                      onClose();
                    }}
                    data-testid="screenplay-panel-new-blank-btn"
                    className="w-full px-2.5 py-2 rounded-md flex items-center gap-2 text-xs text-slate-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Start New Blank Page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadSampleScript();
                      onClose();
                    }}
                    data-testid="screenplay-panel-load-sample-btn"
                    className="w-full px-2.5 py-2 rounded-md flex items-center gap-2 text-xs text-slate-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Load Sample Screenplay Scene</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenImportModal?.()}
                    className="w-full px-2.5 py-2 rounded-md flex items-center gap-2 text-xs text-slate-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Import Script File (.fountain / .fdx / .pdf)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
