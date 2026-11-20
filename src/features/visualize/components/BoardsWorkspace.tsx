import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BringToFront,
  Columns,
  Copy,
  Database,
  FolderPlus,
  Grid,
  Heading,
  Layers,
  Lock,
  MessageSquare,
  Plus,
  Printer,
  Rows,
  Search,
  SendToBack,
  StickyNote,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { FilmProject, ParsedScene } from '../../../types';
import type { ProjectRole } from '../../../types/database.types';
import type { DiscussionRecordTarget } from '../../../services/contracts/types';
import type {
  UnifiedBoardRecord,
  VisualizeProductionStore,
} from '../types';
import {
  BOARD_CATEGORY_SUGGESTIONS,
  addBoardSection,
  addImageItemToBoard,
  addTextItemToBoard,
  archiveUnifiedBoard,
  arrangeBoardItems,
  changeBoardItemZIndex,
  createUnifiedBoard,
  deleteBoardSection,
  deleteUnifiedBoard,
  duplicateUnifiedBoard,
  getUnifiedBoards,
  removeBoardItem,
  updateBoardItem,
  updateUnifiedBoard,
} from '../services/boardService';
import {
  attachVaultAssetToProject,
  processAndStoreVaultFile,
} from '../../vault/services/vaultMediaService';
import { SharedReferencePickerModal } from './SharedReferencePickerModal';
import { BoardFreeformCanvas } from './BoardFreeformCanvas';

interface BoardsWorkspaceProps {
  project: FilmProject;
  activeRole: ProjectRole | null;
  canEdit: boolean;
  scenes: ParsedScene[];
  visualizeStore: VisualizeProductionStore;
  onUpdateProject?: (updated: FilmProject) => void;
  onNavigateTab: (tabId: string, submodule?: string) => void;
  onOpenDiscussion?: (target: DiscussionRecordTarget) => void;
}

const BORDER_COLOR_SWATCHES = [
  { label: 'Slate', value: '#334155' },
  { label: 'Chalk', value: '#e8e3d9' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Cobalt', value: '#38bdf8' },
  { label: 'Pure Black', value: '#090c12' },
];

export const BoardsWorkspace: React.FC<BoardsWorkspaceProps> = ({
  project,
  activeRole,
  canEdit,
  scenes,
  visualizeStore,
  onUpdateProject,
  onOpenDiscussion,
}) => {
  const boards = useMemo(() => getUnifiedBoards(project), [project]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived' | 'published'>(
    'active'
  );

  // Create Board modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');

  // Active Board Canvas UI state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sectionFilterId, setSectionFilterId] = useState<string>('all');
  const [showPicker, setShowPicker] = useState(false);
  const [showSectionsBar, setShowSectionsBar] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const directUploadRef = useRef<HTMLInputElement>(null);
  const latestProjectRef = useRef(project);
  latestProjectRef.current = project;

  const commitProject = (next: FilmProject) => {
    latestProjectRef.current = next;
    onUpdateProject?.(next);
  };

  const activeBoard: UnifiedBoardRecord | null = useMemo(
    () => (selectedBoardId ? boards.find((b) => b.id === selectedBoardId) ?? null : null),
    [boards, selectedBoardId]
  );

  const selectedItem = useMemo(
    () =>
      activeBoard && selectedItemId
        ? activeBoard.items.find((i) => i.id === selectedItemId) ?? null
        : null,
    [activeBoard, selectedItemId]
  );

  const assetMap = useMemo(() => {
    const map = new Map<string, (typeof visualizeStore.referenceAssets)[number]>();
    visualizeStore.referenceAssets.forEach((a) => map.set(a.id, a));
    return map;
  }, [visualizeStore.referenceAssets]);

  const filteredBoards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return boards.filter((b) => {
      if (statusFilter === 'active' && b.status === 'archived') return false;
      if (statusFilter === 'archived' && b.status !== 'archived') return false;
      if (statusFilter === 'published' && b.status !== 'published') return false;
      if (!q) return true;
      return [b.title, b.description, b.categoryTag, b.department]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [boards, statusFilter, searchQuery]);

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onUpdateProject || !newTitle.trim()) return;
    const { updatedProject, board } = createUnifiedBoard(project, {
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      categoryTag: newCategory.trim() || undefined,
    });
    onUpdateProject(updatedProject);
    setNewTitle('');
    setNewDescription('');
    setNewCategory('');
    setShowCreateModal(false);
    setSelectedBoardId(board.id);
    setSelectedItemId(null);
    setSectionFilterId('all');
  };

  /** Uploads image strictly through canonical Vault storage infrastructure without duplicating */
  const uploadViaVaultForBoard = async (file: File, attachToBoardId?: string) => {
    if (!canEdit || !onUpdateProject) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const { asset: vaultRecord } = await processAndStoreVaultFile(
        file,
        latestProjectRef.current.id,
        { preferredCategory: 'images' }
      );
      const withVault = attachVaultAssetToProject(latestProjectRef.current, vaultRecord);
      const sharedRef = (withVault.visualizeState?.referenceAssets || []).find(
        (r) => r.vaultAssetId === vaultRecord.id || r.originalFilename === vaultRecord.originalFilename
      );
      if (attachToBoardId && sharedRef) {
        const ratio =
          vaultRecord.width && vaultRecord.height
            ? vaultRecord.width / vaultRecord.height
            : undefined;
        const { updatedProject, item } = addImageItemToBoard(
          withVault,
          attachToBoardId,
          sharedRef.id,
          {
            sectionId: sectionFilterId !== 'all' ? sectionFilterId : undefined,
            naturalAspectRatio: ratio,
          }
        );
        commitProject(updatedProject);
        if (item) setSelectedItemId(item.id);
      } else {
        commitProject(withVault);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Unable to upload image into Vault.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectExistingVaultAsset = (assetId: string) => {
    if (!canEdit || !onUpdateProject || !activeBoard) return;
    const { updatedProject, item } = addImageItemToBoard(
      latestProjectRef.current,
      activeBoard.id,
      assetId,
      {
        sectionId: sectionFilterId !== 'all' ? sectionFilterId : undefined,
      }
    );
    commitProject(updatedProject);
    if (item) setSelectedItemId(item.id);
  };

  // =========================================================================
  // VIEW A: UNIFIED BOARDS OVERVIEW (LANDING DIRECTORY)
  // =========================================================================
  if (!activeBoard) {
    return (
      <div
        id="boards-workspace-root"
        data-testid="boards-workspace-root"
        className="flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent"
      >
        {/* Top Controls Bar */}
        <div className="px-5 py-3 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-yellow-100">
                Boards — {project.title}
              </h2>
              <p className="text-[11px] text-slate-400">
                Freeform visual pinboards, mood explorations, sections, and curated production lookbooks backed by Vault.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="boards-search-input"
                placeholder="Search boards..."
                className="w-full rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 pl-8 pr-2.5 py-1.5 text-xs text-yellow-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40"
              />
            </div>

            <div className="inline-flex rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 p-0.5 text-[11px]">
              {(['active', 'published', 'archived', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  data-testid={`boards-filter-${tab}`}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2.5 py-1 rounded-md capitalize cursor-pointer transition ${
                    statusFilter === tab
                      ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {!canEdit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 text-[11px] text-slate-400">
                <Lock className="w-3 h-3" />
                Read-only ({activeRole || 'viewer'})
              </span>
            )}

            {canEdit && (
              <button
                type="button"
                data-testid="boards-create-btn"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(250,204,21,0.35)] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Board
              </button>
            )}
          </div>
        </div>

        {/* Boards Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {filteredBoards.length === 0 ? (
            <div
              data-testid="boards-empty-state"
              className="h-full min-h-[280px] flex items-center justify-center"
            >
              <div className="max-w-md w-full rounded-2xl border border-dashed border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/25 p-8 text-center space-y-3">
                <Layers className="w-6 h-6 text-yellow-400 mx-auto" />
                <h3 className="text-base font-semibold text-yellow-100">
                  {boards.length === 0
                    ? 'No visual boards yet'
                    : 'No boards match current filter'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Create a board to arrange Vault imagery freely on a visual pinboard, add section headings and notes, adjust borders and spacing, and preserve layouts automatically.
                </p>
                {canEdit && (
                  <button
                    type="button"
                    data-testid="boards-empty-create-btn"
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(250,204,21,0.35)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Board
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBoards.map((board) => {
                const imageItems = board.items.filter((i) => i.kind === 'image');
                const thumbs = imageItems
                  .slice(0, 4)
                  .map((it) => (it.assetId ? assetMap.get(it.assetId) : undefined))
                  .filter((a): a is NonNullable<typeof a> => Boolean(a));

                return (
                  <article
                    key={board.id}
                    data-testid={`board-card-${board.id}`}
                    className="rounded-xl border border-[#FFD34E]/25 bg-[#141005]/80 backdrop-blur-xl border-[#FFD34E]/25 hover:border-yellow-400/50 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(250,204,21,0.06)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(250,204,21,0.18)] transition-all overflow-hidden flex flex-col"
                  >
                    <div
                      onClick={() => {
                        setSelectedBoardId(board.id);
                        setSelectedItemId(null);
                        setSectionFilterId('all');
                      }}
                      className="h-36 bg-[#0A0B0D] border-b border-[#FFD34E]/20 grid grid-cols-4 gap-0.5 p-1 cursor-pointer"
                    >
                      {thumbs.length === 0 ? (
                        <div className="col-span-4 flex items-center justify-center text-[11px] font-mono text-slate-500">
                          Empty pinboard canvas
                        </div>
                      ) : (
                        [0, 1, 2, 3].map((idx) => {
                          const asset = thumbs[idx];
                          const src = asset?.thumbnailDataUrl || asset?.storageRef;
                          return (
                            <div
                              key={idx}
                              className="bg-[#0d1119] rounded overflow-hidden flex items-center justify-center"
                            >
                              {src && !src.startsWith('vault://') ? (
                                <img
                                  src={src}
                                  alt={asset?.originalFilename || 'Thumb'}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-[#10141f]" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            onClick={() => {
                              setSelectedBoardId(board.id);
                              setSelectedItemId(null);
                            }}
                            className="text-sm font-semibold text-yellow-100 hover:text-white cursor-pointer truncate"
                          >
                            {board.title}
                          </h3>
                          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono uppercase text-slate-300 shrink-0">
                            {board.status}
                          </span>
                        </div>
                        {board.categoryTag && (
                          <div className="text-[10px] font-mono text-[#FFF1A8]/80 mt-0.5">
                            {board.categoryTag}
                          </div>
                        )}
                        {board.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                            {board.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-[#FFD34E]/20 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                        <span>
                          {imageItems.length} {imageItems.length === 1 ? 'image' : 'images'} ·{' '}
                          {board.sections.length}{' '}
                          {board.sections.length === 1 ? 'section' : 'sections'}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            data-testid={`board-open-btn-${board.id}`}
                            onClick={() => {
                              setSelectedBoardId(board.id);
                              setSelectedItemId(null);
                            }}
                            className="px-3 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 font-bold shadow-xs cursor-pointer"
                          >
                            Open
                          </button>

                          {canEdit && onUpdateProject && (
                            <>
                              <button
                                type="button"
                                title="Duplicate board"
                                data-testid={`board-duplicate-btn-${board.id}`}
                                onClick={() => {
                                  const { updatedProject } = duplicateUnifiedBoard(
                                    project,
                                    board.id
                                  );
                                  onUpdateProject(updatedProject);
                                }}
                                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                title={
                                  board.status === 'archived'
                                    ? 'Restore board'
                                    : 'Archive board'
                                }
                                data-testid={`board-archive-btn-${board.id}`}
                                onClick={() =>
                                  onUpdateProject(
                                    archiveUnifiedBoard(
                                      project,
                                      board.id,
                                      board.status !== 'archived'
                                    )
                                  )
                                }
                                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                              >
                                {board.status === 'archived' ? (
                                  <ArchiveRestore className="w-3 h-3" />
                                ) : (
                                  <Archive className="w-3 h-3" />
                                )}
                              </button>
                              {confirmDeleteId === board.id ? (
                                <button
                                  type="button"
                                  data-testid={`board-confirm-delete-${board.id}`}
                                  onClick={() => {
                                    onUpdateProject(deleteUnifiedBoard(project, board.id));
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 rounded bg-rose-500/20 border border-rose-400/40 text-rose-200 cursor-pointer"
                                >
                                  Delete?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Delete board"
                                  data-testid={`board-delete-btn-${board.id}`}
                                  onClick={() => setConfirmDeleteId(board.id)}
                                  className="p-1.5 rounded bg-white/5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Board Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <form
              onSubmit={handleCreateBoard}
              className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#120f06]/95 backdrop-blur-2xl border border-[#F5F000]/35 p-5 space-y-4 text-xs shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#FFD34E]/25 pb-2.5">
                <h3 className="text-sm font-semibold text-yellow-100">Create Board</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Board Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  data-testid="board-create-title-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Harbor Dusk & Tungsten Lookbook"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-yellow-100"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Focus / Department Tag (Optional)
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Cinematography, Costume, Mood & Tone..."
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-yellow-100"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {BOARD_CATEGORY_SUGGESTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNewCategory(tag)}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Purpose, linked scenes, or visual direction scope..."
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-yellow-100 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="board-create-submit-btn"
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_12px_rgba(245,240,0,0.35)] cursor-pointer"
                >
                  Create Board
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: ACTIVE BOARD FREEFORM COMPOSITION CANVAS
  // =========================================================================
  return (
    <div
      id="boards-workspace-root"
      data-testid="boards-canvas-workspace"
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent"
    >
      {/* Top Board Bar */}
      <div className="px-4 py-2 border-b border-[#FFD34E]/25 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            data-testid="board-back-to-all-btn"
            onClick={() => {
              setSelectedBoardId(null);
              setSelectedItemId(null);
            }}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Boards
          </button>

          {canEdit && onUpdateProject ? (
            <input
              type="text"
              data-testid="board-active-title-input"
              value={activeBoard.title}
              onChange={(e) =>
                onUpdateProject(
                  updateUnifiedBoard(project, activeBoard.id, { title: e.target.value })
                )
              }
              className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 text-sm font-semibold text-yellow-100 px-1 py-0.5 focus:outline-none min-w-[160px]"
            />
          ) : (
            <span className="text-sm font-semibold text-yellow-100 truncate">
              {activeBoard.title}
            </span>
          )}

          {activeBoard.categoryTag && (
            <span className="hidden md:inline px-2 py-0.5 rounded bg-yellow-500/15 border border-[#F5F000]/35 text-[10px] font-mono text-yellow-300">
              {activeBoard.categoryTag}
            </span>
          )}
        </div>

        {/* Canvas Tools */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {onOpenDiscussion && (
            <button
              type="button"
              data-testid={`board-discuss-btn-${activeBoard.id}`}
              onClick={() =>
                onOpenDiscussion({
                  entityType: 'board',
                  entityId: activeBoard.id,
                  entityLabel: `Board · ${activeBoard.title}`,
                })
              }
              className="px-2.5 py-1 rounded-lg bg-yellow-950/40 hover:bg-yellow-950/70 border border-[#F5F000]/35 text-yellow-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Discuss
            </button>
          )}
          {canEdit && onUpdateProject && (
            <>
              <button
                type="button"
                data-testid="board-add-vault-btn"
                onClick={() => setShowPicker(true)}
                className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold inline-flex items-center gap-1 shadow-[0_0_12px_rgba(250,204,21,0.3)] cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                Add from Vault
              </button>

              <input
                ref={directUploadRef}
                type="file"
                accept="image/*,.svg"
                data-testid="board-direct-upload-input"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void uploadViaVaultForBoard(f, activeBoard.id);
                }}
              />
              <button
                type="button"
                disabled={isUploading}
                data-testid="board-upload-image-btn"
                onClick={() => directUploadRef.current?.click()}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>

              <button
                type="button"
                data-testid="board-add-heading-btn"
                onClick={() => {
                  const { updatedProject, item } = addTextItemToBoard(project, activeBoard.id, {
                    kind: 'heading',
                    text: 'New Section Heading',
                    sectionId: sectionFilterId !== 'all' ? sectionFilterId : undefined,
                  });
                  onUpdateProject(updatedProject);
                  if (item) setSelectedItemId(item.id);
                }}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 inline-flex items-center gap-1 cursor-pointer"
              >
                <Heading className="w-3.5 h-3.5" />
                Heading
              </button>

              <button
                type="button"
                data-testid="board-add-note-btn"
                onClick={() => {
                  const { updatedProject, item } = addTextItemToBoard(project, activeBoard.id, {
                    kind: 'note',
                    text: 'Visual note or lighting detail...',
                    sectionId: sectionFilterId !== 'all' ? sectionFilterId : undefined,
                  });
                  onUpdateProject(updatedProject);
                  if (item) setSelectedItemId(item.id);
                }}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 inline-flex items-center gap-1 cursor-pointer"
              >
                <StickyNote className="w-3.5 h-3.5" />
                Note
              </button>

              <div className="h-4 w-px bg-white/10 mx-0.5 hidden sm:block" />

              <button
                type="button"
                title="Arrange side by side"
                data-testid="board-arrange-row-btn"
                onClick={() =>
                  onUpdateProject(arrangeBoardItems(project, activeBoard.id, 'side-by-side'))
                }
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Arrange vertically"
                data-testid="board-arrange-col-btn"
                onClick={() =>
                  onUpdateProject(arrangeBoardItems(project, activeBoard.id, 'vertical'))
                }
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
              >
                <Rows className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Arrange tidy masonry grid"
                data-testid="board-arrange-grid-btn"
                onClick={() =>
                  onUpdateProject(arrangeBoardItems(project, activeBoard.id, 'grid'))
                }
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            data-testid="board-toggle-sections-btn"
            onClick={() => setShowSectionsBar((p) => !p)}
            className={`px-2 py-1 rounded-lg border text-[11px] inline-flex items-center gap-1 cursor-pointer ${
              showSectionsBar
                ? 'bg-[#F5F000]/15 border-[#F5F000]/40 text-yellow-100'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Sections ({activeBoard.sections.length})
          </button>

          <button
            type="button"
            data-testid="board-toggle-settings-btn"
            onClick={() => setShowBoardSettings((p) => !p)}
            className={`px-2 py-1 rounded-lg border text-[11px] cursor-pointer ${
              showBoardSettings
                ? 'bg-[#F5F000]/15 border-[#F5F000]/40 text-yellow-100'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
          >
            Borders & Spacing
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            title="Print Board"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Collapsible Borders, Spacing & Metadata Settings Bar */}
      {showBoardSettings && (
        <div
          data-testid="board-settings-bar"
          className="px-4 py-2.5 border-b border-[#FFD34E]/20 bg-[#15171A] border border-[#FFD34E]/20 flex flex-wrap items-center gap-4 text-[11px] shrink-0"
        >
          <label className="flex items-center gap-2 text-slate-300">
            <span className="font-mono text-slate-400">Spacing ({activeBoard.spacingPx}px)</span>
            <input
              type="range"
              min={0}
              max={48}
              step={2}
              disabled={!canEdit || !onUpdateProject}
              data-testid="board-spacing-slider"
              value={activeBoard.spacingPx}
              onChange={(e) =>
                onUpdateProject?.(
                  updateUnifiedBoard(project, activeBoard.id, {
                    spacingPx: Number(e.target.value),
                  })
                )
              }
              className="w-24 accent-[#F5F000] cursor-pointer"
            />
          </label>

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              disabled={!canEdit || !onUpdateProject}
              data-testid="board-border-toggle"
              checked={activeBoard.borderEnabled}
              onChange={(e) =>
                onUpdateProject?.(
                  updateUnifiedBoard(project, activeBoard.id, {
                    borderEnabled: e.target.checked,
                  })
                )
              }
              className="accent-[#F5F000]"
            />
            <span>Borders</span>
          </label>

          <label className="flex items-center gap-2 text-slate-300">
            <span className="font-mono text-slate-400">
              Width ({activeBoard.borderWidthPx}px)
            </span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              disabled={!canEdit || !onUpdateProject || !activeBoard.borderEnabled}
              data-testid="board-border-width-slider"
              value={activeBoard.borderWidthPx}
              onChange={(e) =>
                onUpdateProject?.(
                  updateUnifiedBoard(project, activeBoard.id, {
                    borderWidthPx: Number(e.target.value),
                  })
                )
              }
              className="w-20 accent-[#F5F000] cursor-pointer disabled:opacity-40"
            />
          </label>

          <div className="flex items-center gap-1">
            <span className="font-mono text-slate-400 mr-1">Frame:</span>
            {BORDER_COLOR_SWATCHES.map((sw) => (
              <button
                key={sw.value}
                type="button"
                disabled={!canEdit || !onUpdateProject || !activeBoard.borderEnabled}
                title={sw.label}
                onClick={() =>
                  onUpdateProject?.(
                    updateUnifiedBoard(project, activeBoard.id, {
                      borderColor: sw.value,
                    })
                  )
                }
                style={{ backgroundColor: sw.value }}
                className={`w-4 h-4 rounded-full border cursor-pointer ${
                  activeBoard.borderColor === sw.value
                    ? 'border-white scale-110'
                    : 'border-white/25'
                }`}
              />
            ))}
          </div>

          {scenes.length > 0 && canEdit && onUpdateProject && (
            <select
              value={activeBoard.linkedSceneIds[0] || ''}
              onChange={(e) =>
                onUpdateProject(
                  updateUnifiedBoard(project, activeBoard.id, {
                    linkedSceneIds: e.target.value ? [e.target.value] : [],
                  })
                )
              }
              className="rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 px-2 py-1 text-[11px] text-slate-200"
            >
              <option value="">No primary linked scene</option>
              {scenes.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  SC {sc.sceneNumber} — {sc.slugline}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Optional Sections Bar */}
      {(showSectionsBar || activeBoard.sections.length > 0) && (
        <div
          data-testid="board-sections-bar"
          className="px-4 py-1.5 border-b border-[#FFD34E]/20 bg-[#0b0f17] flex flex-wrap items-center gap-1.5 text-[11px] shrink-0"
        >
          <button
            type="button"
            onClick={() => setSectionFilterId('all')}
            className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
              sectionFilterId === 'all'
                ? 'bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({activeBoard.items.length})
          </button>
          {activeBoard.sections.map((sec) => {
            const count = activeBoard.items.filter((i) => i.sectionId === sec.id).length;
            return (
              <div key={sec.id} className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setSectionFilterId(sec.id)}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                    sectionFilterId === sec.id
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  {sec.title} ({count})
                </button>
                {canEdit && onUpdateProject && (
                  <button
                    type="button"
                    title="Delete section"
                    onClick={() => {
                      onUpdateProject(deleteBoardSection(project, activeBoard.id, sec.id));
                      if (sectionFilterId === sec.id) setSectionFilterId('all');
                    }}
                    className="p-0.5 text-slate-500 hover:text-rose-300 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          {canEdit && onUpdateProject && showSectionsBar && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSectionTitle.trim()) return;
                const { updatedProject, section } = addBoardSection(project, activeBoard.id, {
                  title: newSectionTitle.trim(),
                });
                onUpdateProject(updatedProject);
                setNewSectionTitle('');
                if (section) setSectionFilterId(section.id);
              }}
              className="inline-flex items-center gap-1 ml-1"
            >
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="New section..."
                className="px-2 py-0.5 rounded bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-[11px] text-yellow-100 w-32"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-yellow-100 cursor-pointer"
              >
                Add
              </button>
            </form>
          )}
        </div>
      )}

      {uploadError && (
        <div className="mx-4 mt-2 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-200 flex items-center justify-between">
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-300 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Split: Freeform Pinboard Canvas + Contextual Item Inspector */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <BoardFreeformCanvas
          board={activeBoard}
          referenceAssets={visualizeStore.referenceAssets}
          selectedItemId={selectedItemId}
          sectionFilterId={sectionFilterId}
          canEdit={canEdit}
          onSelectItem={setSelectedItemId}
          onCommitGeometry={(itemId, geo) => {
            if (!canEdit || !onUpdateProject) return;
            onUpdateProject(updateBoardItem(project, activeBoard.id, itemId, geo));
          }}
          onUpdateItemText={(itemId, text) => {
            if (!canEdit || !onUpdateProject) return;
            onUpdateProject(updateBoardItem(project, activeBoard.id, itemId, { text }));
          }}
        />

        {/* Contextual Selected Item Inspector */}
        {selectedItem && (
          <aside
            data-testid="board-item-inspector"
            className="w-72 border-l border-[#FFD34E]/25 bg-[#120f06]/95 backdrop-blur-2xl border border-[#F5F000]/35 p-4 flex flex-col justify-between gap-4 overflow-y-auto text-xs shrink-0 select-text"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#FFD34E]/25 pb-2">
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  {selectedItem.kind === 'image'
                    ? 'Image Item'
                    : selectedItem.kind === 'heading'
                      ? 'Heading'
                      : 'Text Note'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedItemId(null)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  {selectedItem.kind === 'image' ? 'Caption / Label' : 'Text'}
                </label>
                <textarea
                  rows={selectedItem.kind === 'note' ? 3 : 2}
                  disabled={!canEdit || !onUpdateProject}
                  data-testid="board-item-text-input"
                  value={selectedItem.text || ''}
                  onChange={(e) =>
                    onUpdateProject?.(
                      updateBoardItem(project, activeBoard.id, selectedItem.id, {
                        text: e.target.value,
                      })
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-yellow-100 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  disabled={!canEdit || !onUpdateProject}
                  value={selectedItem.note || ''}
                  onChange={(e) =>
                    onUpdateProject?.(
                      updateBoardItem(project, activeBoard.id, selectedItem.id, {
                        note: e.target.value,
                      })
                    )
                  }
                  placeholder="Optional reference notes..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-yellow-100 resize-none"
                />
              </div>

              {/* Layer Stacking Order Controls */}
              {canEdit && onUpdateProject && (
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Layer Order (z{selectedItem.zIndex})
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      title="Bring to front"
                      data-testid="board-layer-front-btn"
                      onClick={() =>
                        onUpdateProject(
                          changeBoardItemZIndex(project, activeBoard.id, selectedItem.id, 'front')
                        )
                      }
                      className="py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 flex justify-center cursor-pointer"
                    >
                      <BringToFront className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Step forward"
                      onClick={() =>
                        onUpdateProject(
                          changeBoardItemZIndex(
                            project,
                            activeBoard.id,
                            selectedItem.id,
                            'forward'
                          )
                        )
                      }
                      className="py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 flex justify-center cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Step backward"
                      onClick={() =>
                        onUpdateProject(
                          changeBoardItemZIndex(
                            project,
                            activeBoard.id,
                            selectedItem.id,
                            'backward'
                          )
                        )
                      }
                      className="py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 flex justify-center cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Send to back"
                      data-testid="board-layer-back-btn"
                      onClick={() =>
                        onUpdateProject(
                          changeBoardItemZIndex(project, activeBoard.id, selectedItem.id, 'back')
                        )
                      }
                      className="py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 flex justify-center cursor-pointer"
                    >
                      <SendToBack className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {selectedItem.kind === 'image' && canEdit && onUpdateProject && (
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={selectedItem.lockAspectRatio !== false}
                    onChange={(e) =>
                      onUpdateProject(
                        updateBoardItem(project, activeBoard.id, selectedItem.id, {
                          lockAspectRatio: e.target.checked,
                        })
                      )
                    }
                    className="accent-[#F5F000]"
                  />
                  <span>Lock Aspect Ratio on Resize</span>
                </label>
              )}

              {activeBoard.sections.length > 0 && canEdit && onUpdateProject && (
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Section
                  </label>
                  <select
                    value={selectedItem.sectionId || ''}
                    onChange={(e) =>
                      onUpdateProject(
                        updateBoardItem(project, activeBoard.id, selectedItem.id, {
                          sectionId: e.target.value || undefined,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">Unsectioned</option>
                    {activeBoard.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="text-[10px] font-mono text-slate-500 pt-1">
                Pos: {selectedItem.x}, {selectedItem.y} · Size: {selectedItem.width}×
                {selectedItem.height}
              </div>
            </div>

            {canEdit && onUpdateProject && (
              <button
                type="button"
                data-testid="board-remove-item-btn"
                onClick={() => {
                  onUpdateProject(removeBoardItem(project, activeBoard.id, selectedItem.id));
                  setSelectedItemId(null);
                }}
                className="w-full py-2 rounded-lg border border-rose-400/30 text-rose-300 hover:bg-rose-950/30 font-medium cursor-pointer"
              >
                Remove from Board (Keep in Vault)
              </button>
            )}
          </aside>
        )}
      </div>

      {/* Shared Reference / Vault Picker Modal */}
      <SharedReferencePickerModal
        isOpen={showPicker}
        title={`Add Vault Reference to "${activeBoard.title}"`}
        subtitle="Select existing Vault Images/Graphics or upload once via Vault without duplicating storage."
        referenceAssets={visualizeStore.referenceAssets}
        alreadyAttachedAssetIds={activeBoard.items
          .map((i) => i.assetId)
          .filter((v): v is string => Boolean(v))}
        canEdit={canEdit}
        onClose={() => setShowPicker(false)}
        onSelectAsset={handleSelectExistingVaultAsset}
        onUploadNewAsset={(file) => uploadViaVaultForBoard(file, activeBoard.id)}
      />
    </div>
  );
};
