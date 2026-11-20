import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ImageOff,
  ImagePlus,
  Maximize2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { FilmProject, ParsedScene } from '../../../types';
import type {
  MoodBoardItemRecord,
  MoodBoardRecord,
  MoodBoardTileSize,
  VisualReferenceAsset,
  VisualizeProductionStore,
} from '../types';
import {
  MOODBOARD_THEME_SUGGESTIONS,
  addAssetToMoodBoard,
  compressStoryboardImageFile,
  createMoodBoard,
  deleteMoodBoard,
  registerSharedReferenceAsset,
  removeMoodBoardItem,
  reorderMoodBoardItems,
  updateMoodBoard,
  updateMoodBoardItem,
} from '../services/visualizeFoundationService';
import { SharedReferencePickerModal } from './SharedReferencePickerModal';

interface MoodBoardsViewProps {
  project: FilmProject;
  scenes: ParsedScene[];
  visualizeStore: VisualizeProductionStore;
  canEdit: boolean;
  onUpdateProject?: (updated: FilmProject) => void;
}

const TILE_SPAN_CLASS: Record<MoodBoardTileSize, string> = {
  compact: 'col-span-1',
  medium: 'col-span-1',
  wide: 'col-span-1 md:col-span-2',
  feature: 'col-span-1 md:col-span-2',
};

const TILE_HEIGHT_CLASS: Record<MoodBoardTileSize, string> = {
  compact: 'h-48',
  medium: 'h-64',
  wide: 'h-64',
  feature: 'h-80',
};

export const MoodBoardsView: React.FC<MoodBoardsViewProps> = ({
  project,
  scenes,
  visualizeStore,
  canEdit,
  onUpdateProject,
}) => {
  const moodBoards = useMemo(
    () =>
      [...(visualizeStore.moodBoards || [])].sort(
        (a, b) => a.sortOrder - b.sortOrder
      ),
    [visualizeStore.moodBoards]
  );

  const assetMap = useMemo(() => {
    const map = new Map<string, VisualReferenceAsset>();
    visualizeStore.referenceAssets.forEach((a) => map.set(a.id, a));
    return map;
  }, [visualizeStore.referenceAssets]);

  const sceneMap = useMemo(() => {
    const map = new Map<string, ParsedScene>();
    scenes.forEach((s) => map.set(s.id, s));
    return map;
  }, [scenes]);

  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [inspectingItemId, setInspectingItemId] = useState<string | null>(null);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(false);
  const [brokenAssetIds, setBrokenAssetIds] = useState<Record<string, boolean>>({});

  // Create/Edit Board Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTheme, setFormTheme] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSceneIds, setFormSceneIds] = useState<string[]>([]);

  // Inspector draft fields
  const [draftCaption, setDraftCaption] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftLinkedPanelId, setDraftLinkedPanelId] = useState('');
  const [draftLinkedShotId, setDraftLinkedShotId] = useState('');

  const activeBoard: MoodBoardRecord | null = useMemo(
    () => moodBoards.find((b) => b.id === activeBoardId) || null,
    [moodBoards, activeBoardId]
  );

  const inspectingItem: MoodBoardItemRecord | null = useMemo(() => {
    if (!activeBoard || !inspectingItemId) return null;
    return activeBoard.items.find((i) => i.id === inspectingItemId) || null;
  }, [activeBoard, inspectingItemId]);

  const openCreateForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormTheme('');
    setFormNotes('');
    setFormSceneIds([]);
    setShowCreateModal(true);
  };

  const openEditMeta = (board: MoodBoardRecord) => {
    setFormTitle(board.title);
    setFormDescription(board.description || '');
    setFormTheme(board.theme || '');
    setFormNotes(board.notes || '');
    setFormSceneIds(board.linkedSceneIds || []);
    setEditingMeta(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onUpdateProject) return;
    const { updatedProject, board } = createMoodBoard(project, {
      title: formTitle.trim() || 'Untitled Mood Board',
      description: formDescription,
      theme: formTheme,
      notes: formNotes,
      linkedSceneIds: formSceneIds,
    });
    onUpdateProject(updatedProject);
    setShowCreateModal(false);
    setActiveBoardId(board.id);
  };

  const handleSaveMetaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onUpdateProject || !activeBoard) return;
    const updated = updateMoodBoard(project, activeBoard.id, {
      title: formTitle,
      description: formDescription,
      theme: formTheme,
      notes: formNotes,
      linkedSceneIds: formSceneIds,
    });
    onUpdateProject(updated);
    setEditingMeta(false);
  };

  const handleDeleteBoard = () => {
    if (!canEdit || !onUpdateProject || !activeBoard) return;
    onUpdateProject(deleteMoodBoard(project, activeBoard.id));
    setConfirmDeleteBoard(false);
    setActiveBoardId(null);
  };

  const handleAttachExistingAsset = (assetId: string) => {
    if (!canEdit || !onUpdateProject || !activeBoard) return;
    onUpdateProject(addAssetToMoodBoard(project, activeBoard.id, assetId));
  };

  const handleUploadNewToBoard = async (file: File) => {
    if (!canEdit || !onUpdateProject || !activeBoard) return;
    const compressed = await compressStoryboardImageFile(file);
    const { updatedProject, asset } = registerSharedReferenceAsset(project, {
      originalFilename: compressed.originalFilename,
      thumbnailDataUrl: compressed.dataUrl,
      mimeType: compressed.mimeType,
      fileSizeBytes: compressed.fileSizeBytes,
      description: `Mood Board: ${activeBoard.title}`,
      tags: ['mood-board', activeBoard.theme ? activeBoard.theme.toLowerCase() : 'reference'],
      source: 'Mood Board Upload',
    });
    const finalProj = addAssetToMoodBoard(updatedProject, activeBoard.id, asset.id);
    onUpdateProject(finalProj);
  };

  const handleReorderTile = (itemId: string, direction: -1 | 1) => {
    if (!canEdit || !onUpdateProject || !activeBoard) return;
    const sorted = [...activeBoard.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((i) => i.id === itemId);
    const nextIdx = idx + direction;
    if (idx === -1 || nextIdx < 0 || nextIdx >= sorted.length) return;
    const ids = sorted.map((i) => i.id);
    const [moved] = ids.splice(idx, 1);
    ids.splice(nextIdx, 0, moved);
    onUpdateProject(reorderMoodBoardItems(project, activeBoard.id, ids));
  };

  const handleCycleTileSize = (item: MoodBoardItemRecord) => {
    if (!canEdit || !onUpdateProject || !activeBoard) return;
    const order: MoodBoardTileSize[] = ['compact', 'medium', 'wide', 'feature'];
    const current = item.tileSize || 'medium';
    const next = order[(order.indexOf(current) + 1) % order.length];
    onUpdateProject(
      updateMoodBoardItem(project, activeBoard.id, item.id, { tileSize: next })
    );
  };

  const openInspector = (item: MoodBoardItemRecord) => {
    setInspectingItemId(item.id);
    setDraftCaption(item.caption || '');
    setDraftNote(item.note || '');
    setDraftLinkedPanelId(item.linkedPanelId || '');
    setDraftLinkedShotId(item.linkedShotId || '');
  };

  const handleSaveInspector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onUpdateProject || !activeBoard || !inspectingItem) return;
    onUpdateProject(
      updateMoodBoardItem(project, activeBoard.id, inspectingItem.id, {
        caption: draftCaption,
        note: draftNote,
        linkedPanelId: draftLinkedPanelId || undefined,
        linkedShotId: draftLinkedShotId || undefined,
      })
    );
    setInspectingItemId(null);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!canEdit || !onUpdateProject || !activeBoard) return;
    onUpdateProject(removeMoodBoardItem(project, activeBoard.id, itemId));
    if (inspectingItemId === itemId) setInspectingItemId(null);
  };

  // --- LANDING INDEX VIEW ---
  if (!activeBoard) {
    return (
      <div
        id="moodboards-landing-view"
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-sm md:text-base font-semibold text-yellow-100">
              Mood Boards
            </h2>
            <p className="text-xs text-slate-400">
              Exploratory visual collections for colour, lighting, atmosphere, costume, and location discovery.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              data-testid="create-moodboard-btn"
              onClick={openCreateForm}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Mood Board
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {moodBoards.length === 0 ? (
            <div
              id="moodboards-empty-state"
              className="h-full min-h-[320px] flex items-center justify-center"
            >
              <div className="max-w-md w-full rounded-2xl border border-dashed border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20/80 p-8 text-center space-y-4">
                <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-yellow-100">
                    No mood boards yet
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Start an exploratory pinboard for lighting tone, lens mood, wardrobe texture, or atmosphere in{' '}
                    <span className="text-slate-200 font-medium">{project.title}</span>.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    data-testid="create-first-moodboard-btn"
                    onClick={openCreateForm}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Mood Board
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              id="moodboards-cards-grid"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-8"
            >
              {moodBoards.map((board) => {
                const sortedItems = [...board.items].sort(
                  (a, b) => a.sortOrder - b.sortOrder
                );
                const previewAssets = sortedItems
                  .slice(0, 4)
                  .map((i) => assetMap.get(i.assetId))
                  .filter((a): a is VisualReferenceAsset => Boolean(a));

                return (
                  <button
                    key={board.id}
                    type="button"
                    data-moodboard-id={board.id}
                    onClick={() => setActiveBoardId(board.id)}
                    className="group rounded-2xl border border-[#FFD34E]/25 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 hover:border-[#F5F000]/40 overflow-hidden text-left flex flex-col transition-all cursor-pointer"
                  >
                    {/* Visual Pinboard Preview Mosaic */}
                    <div className="aspect-[16/10] w-full bg-[#0A0B0D] border-b border-[#FFD34E]/20 p-2 grid grid-cols-2 gap-1.5">
                      {previewAssets.length === 0 ? (
                        <div className="col-span-2 flex flex-col items-center justify-center text-slate-600 gap-1">
                          <ImagePlus className="w-5 h-5" />
                          <span className="text-[11px]">Open to pin references</span>
                        </div>
                      ) : previewAssets.length === 1 ? (
                        <div className="col-span-2 bg-[#0d1018] rounded-lg overflow-hidden flex items-center justify-center">
                          <img
                            src={
                              previewAssets[0].thumbnailDataUrl ||
                              previewAssets[0].storageRef
                            }
                            alt={board.title}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        [0, 1, 2, 3].map((slotIdx) => {
                          const ast = previewAssets[slotIdx];
                          return (
                            <div
                              key={slotIdx}
                              className="bg-[#0d1018] rounded-md overflow-hidden flex items-center justify-center"
                            >
                              {ast && (ast.thumbnailDataUrl || ast.storageRef) ? (
                                <img
                                  src={ast.thumbnailDataUrl || ast.storageRef}
                                  alt={ast.originalFilename}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full bg-white/[0.015]" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-yellow-100 group-hover:text-white truncate">
                            {board.title}
                          </h3>
                          {board.theme && (
                            <span className="px-2 py-0.5 rounded-full border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 text-[10px] font-medium text-yellow-400 shrink-0">
                              {board.theme}
                            </span>
                          )}
                        </div>
                        {board.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">
                            {board.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-white/[0.05]">
                        <span>
                          {board.items.length}{' '}
                          {board.items.length === 1 ? 'reference' : 'references'}
                        </span>
                        {board.linkedSceneIds.length > 0 && (
                          <span>
                            {board.linkedSceneIds.length}{' '}
                            {board.linkedSceneIds.length === 1 ? 'scene' : 'scenes'}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Mood Board Modal */}
        {showCreateModal && (
          <MoodBoardFormModal
            heading="New Mood Board"
            submitLabel="Create Mood Board"
            title={formTitle}
            description={formDescription}
            theme={formTheme}
            notes={formNotes}
            linkedSceneIds={formSceneIds}
            scenes={scenes}
            onChangeTitle={setFormTitle}
            onChangeDescription={setFormDescription}
            onChangeTheme={setFormTheme}
            onChangeNotes={setFormNotes}
            onToggleScene={(id) =>
              setFormSceneIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateSubmit}
          />
        )}
      </div>
    );
  }

  // --- ACTIVE MOOD BOARD PINBOARD CANVAS ---
  const sortedBoardItems = [...activeBoard.items].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <div
      id="moodboards-active-canvas"
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
    >
      {/* Top Board Bar */}
      <div className="px-5 py-3 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            data-testid="moodboard-back-btn"
            onClick={() => {
              setActiveBoardId(null);
              setConfirmDeleteBoard(false);
              setInspectingItemId(null);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-xs text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            All Boards
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm md:text-base font-semibold text-yellow-100 truncate">
                {activeBoard.title}
              </h2>
              {activeBoard.theme && (
                <span className="px-2 py-0.5 rounded-full border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 text-[10px] font-medium text-yellow-400">
                  {activeBoard.theme}
                </span>
              )}
              {activeBoard.linkedSceneIds.map((scId) => {
                const sc = sceneMap.get(scId);
                if (!sc) return null;
                return (
                  <span
                    key={scId}
                    className="px-2 py-0.5 rounded border border-white/10 bg-[#0A0B0D] border-b border-[#FFD34E]/20 font-mono text-[10px] text-slate-300"
                  >
                    SC {sc.sceneNumber}
                  </span>
                );
              })}
            </div>
            {(activeBoard.description || activeBoard.notes) && (
              <p className="text-[11px] text-slate-400 truncate max-w-2xl">
                {activeBoard.description || activeBoard.notes}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-testid="moodboard-edit-meta-btn"
              onClick={() => openEditMeta(activeBoard)}
              className="px-2.5 py-1.5 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-xs text-slate-300 hover:text-yellow-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Board Details
            </button>

            <button
              type="button"
              data-testid="moodboard-add-reference-btn"
              onClick={() => setShowPicker(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Add Reference
            </button>

            {confirmDeleteBoard ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="moodboard-confirm-delete-btn"
                  onClick={handleDeleteBoard}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-xs font-medium text-rose-200 cursor-pointer"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteBoard(false)}
                  className="px-2 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="moodboard-delete-btn"
                onClick={() => setConfirmDeleteBoard(true)}
                title="Delete Mood Board (preserves shared assets)"
                className="p-2 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Exploratory Visual Pinboard Canvas */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
        {sortedBoardItems.length === 0 ? (
          <div
            id="moodboard-empty-canvas"
            className="h-full min-h-[320px] flex items-center justify-center"
          >
            <div className="max-w-md w-full rounded-2xl border border-dashed border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20/80 p-8 text-center space-y-4">
              <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 flex items-center justify-center">
                <ImagePlus className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-yellow-100">
                  Empty mood board canvas
                </h3>
                <p className="text-xs text-slate-400">
                  Pin shared images from this production’s Reference Library or upload new visual inspiration.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  data-testid="moodboard-empty-add-ref-btn"
                  onClick={() => setShowPicker(true)}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Visual References
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            id="moodboard-pinboard-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-10 auto-rows-max"
          >
            {sortedBoardItems.map((item, idx) => {
              const asset = assetMap.get(item.assetId) || null;
              const src = asset?.thumbnailDataUrl || asset?.storageRef;
              const isBroken = !asset || Boolean(brokenAssetIds[asset.id]);
              const tileSize: MoodBoardTileSize = item.tileSize || 'medium';
              const spanCls = TILE_SPAN_CLASS[tileSize];
              const heightCls = TILE_HEIGHT_CLASS[tileSize];

              return (
                <article
                  key={item.id}
                  data-mb-item-id={item.id}
                  className={`${spanCls} group rounded-2xl border border-[#FFD34E]/25 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 hover:border-white/25 overflow-hidden flex flex-col transition-all`}
                >
                  {/* Image-Led Surface preserving natural aspect ratio */}
                  <button
                    type="button"
                    onClick={() => openInspector(item)}
                    className={`relative w-full ${heightCls} bg-[#07090e] flex items-center justify-center overflow-hidden p-2 cursor-pointer`}
                  >
                    {src && !isBroken ? (
                      <img
                        src={src}
                        alt={item.caption || asset?.originalFilename || 'Mood board reference'}
                        onError={() =>
                          asset &&
                          setBrokenAssetIds((prev) => ({ ...prev, [asset.id]: true }))
                        }
                        className="max-w-full max-h-full w-auto h-auto object-contain rounded"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-500">
                        <ImageOff className="w-5 h-5" />
                        <span className="text-[11px]">Image unavailable</span>
                      </div>
                    )}

                    <span className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/65 border border-white/15 text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </span>
                  </button>

                  {/* Caption, Notes & Pin Controls */}
                  <div className="px-3.5 py-2.5 border-t border-[#FFD34E]/20 space-y-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-yellow-100 truncate">
                        {item.caption || asset?.originalFilename || 'Reference'}
                      </div>
                      {item.note && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {item.note}
                        </p>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/[0.04]">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleReorderTile(item.id, -1)}
                            title="Move earlier"
                            aria-label={`Move pin ${idx + 1} earlier`}
                            className="p-1 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === sortedBoardItems.length - 1}
                            onClick={() => handleReorderTile(item.id, 1)}
                            title="Move later"
                            aria-label={`Move pin ${idx + 1} later`}
                            className="p-1 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCycleTileSize(item)}
                            title="Cycle tile frame size"
                            className="px-1.5 py-0.5 rounded border border-white/10 font-mono text-[10px] text-slate-300 hover:text-white uppercase cursor-pointer"
                          >
                            {tileSize}
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openInspector(item)}
                            title="Edit caption & inspect"
                            className="p-1 rounded border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            title="Remove from board (keeps asset in Reference Library)"
                            aria-label={`Remove pin ${idx + 1} from board`}
                            className="p-1 rounded border border-white/10 text-slate-400 hover:text-rose-300 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Shared Reference Picker Modal */}
      <SharedReferencePickerModal
        isOpen={showPicker}
        title={`Add References to "${activeBoard.title}"`}
        referenceAssets={visualizeStore.referenceAssets}
        alreadyAttachedAssetIds={activeBoard.items.map((i) => i.assetId)}
        canEdit={canEdit}
        onClose={() => setShowPicker(false)}
        onSelectAsset={handleAttachExistingAsset}
        onUploadNewAsset={handleUploadNewToBoard}
      />

      {/* Edit Board Metadata Modal */}
      {editingMeta && (
        <MoodBoardFormModal
          heading="Edit Mood Board Details"
          submitLabel="Save Details"
          title={formTitle}
          description={formDescription}
          theme={formTheme}
          notes={formNotes}
          linkedSceneIds={formSceneIds}
          scenes={scenes}
          onChangeTitle={setFormTitle}
          onChangeDescription={setFormDescription}
          onChangeTheme={setFormTheme}
          onChangeNotes={setFormNotes}
          onToggleScene={(id) =>
            setFormSceneIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onClose={() => setEditingMeta(false)}
          onSubmit={handleSaveMetaSubmit}
        />
      )}

      {/* Individual Reference Lightbox Inspector */}
      {inspectingItem && (
        <div
          data-testid="moodboard-item-inspector-modal"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-text"
        >
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/[0.1] bg-[#10131a] overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-5">
            <div className="md:col-span-3 bg-[#07090d] flex items-center justify-center p-4 min-h-[260px] max-h-[75vh]">
              {(() => {
                const asset = assetMap.get(inspectingItem.assetId);
                const src = asset?.thumbnailDataUrl || asset?.storageRef;
                if (!asset || !src || brokenAssetIds[asset.id]) {
                  return (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <ImageOff className="w-6 h-6" />
                      <span className="text-xs">Image unavailable</span>
                    </div>
                  );
                }
                return (
                  <img
                    src={src}
                    alt={draftCaption || asset.originalFilename}
                    className="max-w-full max-h-[68vh] object-contain rounded"
                  />
                );
              })()}
            </div>

            <form
              onSubmit={handleSaveInspector}
              className="md:col-span-2 border-t md:border-t-0 md:border-l border-[#FFD34E]/25 p-5 flex flex-col justify-between gap-4 overflow-y-auto"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Pinned Reference
                    </div>
                    <div className="text-xs font-medium text-yellow-100 truncate mt-0.5">
                      {assetMap.get(inspectingItem.assetId)?.originalFilename || 'Asset'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {assetMap.get(inspectingItem.assetId)?.source || 'Shared Reference Library'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectingItemId(null)}
                    className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    Caption
                  </label>
                  <input
                    type="text"
                    value={draftCaption}
                    disabled={!canEdit}
                    onChange={(e) => setDraftCaption(e.target.value)}
                    data-testid="mb-inspector-caption-input"
                    placeholder="Concise creative caption..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0A0B0D] border border-[#FFD34E]/25 text-xs text-amber-100 focus:border-[#F5F000]/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    Creative Note
                  </label>
                  <textarea
                    rows={3}
                    value={draftNote}
                    disabled={!canEdit}
                    onChange={(e) => setDraftNote(e.target.value)}
                    data-testid="mb-inspector-note-input"
                    placeholder="Colour palette, shadow contrast, wardrobe texture..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0A0B0D] border border-[#FFD34E]/25 text-xs text-amber-100 focus:border-[#F5F000]/60 focus:outline-none resize-none"
                  />
                </div>

                {visualizeStore.storyboardPanels.length > 0 && (
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Optional Storyboard Panel Link
                    </label>
                    <select
                      value={draftLinkedPanelId}
                      disabled={!canEdit}
                      onChange={(e) => setDraftLinkedPanelId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A0B0D] border border-[#FFD34E]/25 border border-white/10 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="">None</option>
                      {visualizeStore.storyboardPanels.map((p) => (
                        <option key={p.id} value={p.id}>
                          SC {p.sceneNumber} · Panel {p.panelNumber}: {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {visualizeStore.shots.length > 0 && (
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Optional Shot Link
                    </label>
                    <select
                      value={draftLinkedShotId}
                      disabled={!canEdit}
                      onChange={(e) => setDraftLinkedShotId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A0B0D] border border-[#FFD34E]/25 border border-white/10 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="">None</option>
                      {visualizeStore.shots.map((s) => (
                        <option key={s.id} value={s.id}>
                          SC {s.sceneNumber} · Shot {s.shotNumber} — {s.description.slice(0, 36)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#FFD34E]/25 flex items-center justify-between gap-2">
                {canEdit ? (
                  <button
                    type="button"
                    data-testid="mb-inspector-remove-btn"
                    onClick={() => handleRemoveItem(inspectingItem.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 hover:text-rose-300 cursor-pointer"
                  >
                    Remove from Board
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectingItemId(null)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300 cursor-pointer"
                  >
                    Close
                  </button>
                  {canEdit && (
                    <button
                      type="submit"
                      data-testid="mb-inspector-save-btn"
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)] text-xs font-semibold cursor-pointer"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface MoodBoardFormModalProps {
  heading: string;
  submitLabel: string;
  title: string;
  description: string;
  theme: string;
  notes: string;
  linkedSceneIds: string[];
  scenes: ParsedScene[];
  onChangeTitle: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeTheme: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onToggleScene: (sceneId: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const MoodBoardFormModal: React.FC<MoodBoardFormModalProps> = ({
  heading,
  submitLabel,
  title,
  description,
  theme,
  notes,
  linkedSceneIds,
  scenes,
  onChangeTitle,
  onChangeDescription,
  onChangeTheme,
  onChangeNotes,
  onToggleScene,
  onClose,
  onSubmit,
}) => (
  <div
    data-testid="moodboard-form-modal"
    className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-text"
  >
    <form
      onSubmit={onSubmit}
      className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#10131a] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
    >
      <div className="px-5 py-3.5 border-b border-[#FFD34E]/25 bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-yellow-100">{heading}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4 text-xs overflow-y-auto">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Board Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            data-testid="moodboard-input-title"
            placeholder="e.g. Harbor Dusk & Fog Atmosphere"
            className="w-full px-3 py-2 rounded-lg bg-[#0A0B0D] border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Creative Theme / Category (Optional)
          </label>
          <input
            type="text"
            value={theme}
            onChange={(e) => onChangeTheme(e.target.value)}
            data-testid="moodboard-input-theme"
            placeholder="e.g. Lighting, Colour Palette, Costume..."
            className="w-full px-3 py-2 rounded-lg bg-[#0A0B0D] border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {MOODBOARD_THEME_SUGGESTIONS.map((sugg) => (
              <button
                key={sugg}
                type="button"
                onClick={() => onChangeTheme(sugg)}
                className={`px-2 py-0.5 rounded-full border text-[10px] cursor-pointer ${
                  theme === sugg
                    ? 'border-[#F5F000]/50 bg-[#F5F000]/15 text-yellow-100'
                    : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {sugg}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
            data-testid="moodboard-input-description"
            placeholder="What creative direction is this board exploring?"
            className="w-full px-3 py-2 rounded-lg bg-[#0A0B0D] border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Notes (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            data-testid="moodboard-input-notes"
            placeholder="Key texture, contrast, lens or practical light references..."
            className="w-full px-3 py-2 rounded-lg bg-[#0A0B0D] border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none"
          />
        </div>

        {scenes.length > 0 && (
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
              Associated Screenplay Scenes (Optional)
            </label>
            <div className="max-h-28 overflow-y-auto rounded-lg border border-white/10 bg-[#0A0B0D] border border-[#FFD34E]/25 p-2 space-y-1">
              {scenes.map((sc) => {
                const active = linkedSceneIds.includes(sc.id);
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => onToggleScene(sc.id)}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center justify-between cursor-pointer ${
                      active
                        ? 'bg-[#F5F000]/15 text-yellow-100'
                        : 'text-slate-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="truncate">
                      SC {sc.sceneNumber} — {sc.slugline}
                    </span>
                    {active && <span className="text-[10px] font-mono">Linked</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-3.5 border-t border-[#FFD34E]/25 bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="moodboard-submit-btn"
          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)] text-xs font-semibold cursor-pointer"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  </div>
);
