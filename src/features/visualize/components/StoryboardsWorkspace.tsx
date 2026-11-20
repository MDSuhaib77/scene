import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  GripVertical,
  ImageOff,
  ImagePlus,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { FilmProject, ParsedScene, ProjectRole } from '../../../types';
import type { DiscussionRecordTarget } from '../../../services/contracts/types';
import type {
  StoryboardPanelRecord,
  VisualReferenceAsset,
  VisualizeProductionStore,
} from '../types';
import {
  compressStoryboardImageFile,
  createShotFromStoryboardPanel,
  createStoryboardPanel,
  deleteStoryboardPanel,
  getShotsForStoryboardPanel,
  getStoryboardCountsByScene,
  getStoryboardPanelsForScene,
  registerSharedReferenceAsset,
  reorderStoryboardPanels,
  updateStoryboardPanel,
} from '../services/visualizeFoundationService';
import {
  StoryboardPanelDraftUpdates,
  StoryboardPanelEditorDrawer,
} from './StoryboardPanelEditorDrawer';

export interface StoryboardsScreenplayContext {
  productionId: string;
  hasScreenplay: boolean;
  activeScript: FilmProject['scripts'] extends Array<infer T> ? T | null : any;
  scenes: ParsedScene[];
  sceneMap: Map<string, ParsedScene>;
}

export interface StoryboardsWorkspaceProps {
  project: FilmProject;
  activeRole: ProjectRole | null;
  canEdit: boolean;
  screenplayCtx: StoryboardsScreenplayContext;
  visualizeStore: VisualizeProductionStore;
  onUpdateProject?: (updated: FilmProject) => void;
  onNavigateTab: (tabId: string, submodule?: string) => void;
  focusedPanelRequest?: { sceneId: string; panelId: string } | null;
  onClearFocusedPanelRequest?: () => void;
  onOpenShotListsForScene?: (sceneId: string) => void;
  onOpenDiscussion?: (target: DiscussionRecordTarget) => void;
}

type SceneFilterMode = 'all' | 'storyboarded' | 'unstoryboarded';

const STATUS_BADGE_MAP: Record<
  StoryboardPanelRecord['status'],
  { label: string; classes: string }
> = {
  draft: {
    label: 'Draft',
    classes: 'border-white/10 bg-[#15171A] border border-[#FFD34E]/20 text-slate-300',
  },
  'in-review': {
    label: 'In Review',
    classes: 'border-[#FFD34E]/30 bg-[#F5F000]/10 text-[#FFF1A8]',
  },
  approved: {
    label: 'Approved',
    classes: 'border-yellow-400/30 bg-yellow-950/40 text-yellow-300',
  },
};

export const StoryboardsWorkspace: React.FC<StoryboardsWorkspaceProps> = ({
  project,
  activeRole,
  canEdit,
  screenplayCtx,
  visualizeStore,
  onUpdateProject,
  onNavigateTab,
  focusedPanelRequest,
  onClearFocusedPanelRequest,
  onOpenShotListsForScene,
  onOpenDiscussion,
}) => {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(() => {
    return focusedPanelRequest?.sceneId || screenplayCtx.scenes[0]?.id || '';
  });
  const [navigatorCollapsed, setNavigatorCollapsed] = useState(false);
  const [sceneSearch, setSceneSearch] = useState('');
  const [sceneFilter, setSceneFilter] = useState<SceneFilterMode>('all');
  const [showPassage, setShowPassage] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(
    () => focusedPanelRequest?.panelId ?? null
  );
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dragOverPanelId, setDragOverPanelId] = useState<string | null>(null);
  const [brokenAssetIds, setBrokenAssetIds] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusedPanelRequest) return;
    if (screenplayCtx.scenes.some((s) => s.id === focusedPanelRequest.sceneId)) {
      setSelectedSceneId(focusedPanelRequest.sceneId);
      setEditingPanelId(focusedPanelRequest.panelId);
    }
    onClearFocusedPanelRequest?.();
  }, [focusedPanelRequest, screenplayCtx.scenes, onClearFocusedPanelRequest]);

  // Keep selectedSceneId valid whenever production or screenplay changes
  useEffect(() => {
    if (screenplayCtx.scenes.length === 0) {
      if (selectedSceneId !== '') setSelectedSceneId('');
      setEditingPanelId(null);
      return;
    }
    const exists = screenplayCtx.scenes.some((sc) => sc.id === selectedSceneId);
    if (!exists) {
      setSelectedSceneId(screenplayCtx.scenes[0].id);
      setEditingPanelId(null);
    }
  }, [project.id, screenplayCtx.scenes, selectedSceneId]);

  const countsByScene = useMemo(
    () => getStoryboardCountsByScene(visualizeStore),
    [visualizeStore]
  );

  const assetMap = useMemo(() => {
    const map = new Map<string, VisualReferenceAsset>();
    for (const asset of visualizeStore.referenceAssets) {
      map.set(asset.id, asset);
    }
    return map;
  }, [visualizeStore.referenceAssets]);

  const filteredScenes = useMemo(() => {
    const query = sceneSearch.trim().toLowerCase();
    return screenplayCtx.scenes.filter((scene) => {
      const panelCount = countsByScene.get(scene.id) ?? 0;
      if (sceneFilter === 'storyboarded' && panelCount === 0) return false;
      if (sceneFilter === 'unstoryboarded' && panelCount > 0) return false;
      if (!query) return true;
      return (
        scene.sceneNumber.toLowerCase().includes(query) ||
        scene.slugline.toLowerCase().includes(query)
      );
    });
  }, [screenplayCtx.scenes, countsByScene, sceneFilter, sceneSearch]);

  const selectedScene = useMemo(
    () => screenplayCtx.scenes.find((sc) => sc.id === selectedSceneId) ?? null,
    [screenplayCtx.scenes, selectedSceneId]
  );

  const scenePanels = useMemo(() => {
    if (!selectedScene) return [];
    return getStoryboardPanelsForScene(visualizeStore, selectedScene.id);
  }, [visualizeStore, selectedScene]);

  const editingPanel = useMemo(
    () => scenePanels.find((panel) => panel.id === editingPanelId) ?? null,
    [scenePanels, editingPanelId]
  );

  const totalStoryboardedScenes = useMemo(() => {
    let count = 0;
    for (const sc of screenplayCtx.scenes) {
      if ((countsByScene.get(sc.id) ?? 0) > 0) count += 1;
    }
    return count;
  }, [screenplayCtx.scenes, countsByScene]);

  const handleAddPanel = () => {
    if (!canEdit || !selectedScene || !onUpdateProject) return;
    setUploadError(null);
    const { updatedProject, panel } = createStoryboardPanel(project, {
      scene: selectedScene,
      screenplayVersionId: screenplayCtx.activeScript?.id || 'active-script',
    });
    onUpdateProject(updatedProject);
    setEditingPanelId(panel.id);
  };

  const handleSavePanel = (
    panelId: string,
    updates: StoryboardPanelDraftUpdates,
    closeDrawer = true
  ) => {
    if (!canEdit || !onUpdateProject) return;
    const updatedProject = updateStoryboardPanel(project, panelId, updates);
    onUpdateProject(updatedProject);
    if (closeDrawer) {
      setEditingPanelId(null);
    }
  };

  const handleUploadImageForPanel = async (panelId: string, file: File) => {
    if (!canEdit || !onUpdateProject) return;
    setUploadError(null);
    try {
      const compressed = await compressStoryboardImageFile(file);
      const { updatedProject, asset } = registerSharedReferenceAsset(project, {
        originalFilename: compressed.originalFilename,
        thumbnailDataUrl: compressed.dataUrl,
        mimeType: compressed.mimeType,
        fileSizeBytes: compressed.fileSizeBytes,
        description: selectedScene
          ? `Storyboard frame for Scene ${selectedScene.sceneNumber}`
          : 'Storyboard frame',
        tags: ['storyboard', selectedScene ? `scene-${selectedScene.sceneNumber}` : 'panel'],
        source: 'Storyboards Upload',
      });
      const finalProject = updateStoryboardPanel(updatedProject, panelId, {
        primaryAssetId: asset.id,
      });
      setBrokenAssetIds((prev) => {
        const next = { ...prev };
        delete next[asset.id];
        return next;
      });
      onUpdateProject(finalProject);
    } catch (err: any) {
      setUploadError(err?.message || 'Unable to read or attach image file.');
    }
  };

  const handleDeletePanel = (panelId: string) => {
    if (!canEdit || !onUpdateProject) return;
    const updatedProject = deleteStoryboardPanel(project, panelId);
    onUpdateProject(updatedProject);
    if (editingPanelId === panelId) {
      setEditingPanelId(null);
    }
  };

  const handleReorderByDrop = (targetPanelId: string) => {
    if (!canEdit || !selectedScene || !onUpdateProject) return;
    if (!draggedPanelId || draggedPanelId === targetPanelId) {
      setDraggedPanelId(null);
      setDragOverPanelId(null);
      return;
    }

    const currentIds = scenePanels.map((p) => p.id);
    const fromIndex = currentIds.indexOf(draggedPanelId);
    const toIndex = currentIds.indexOf(targetPanelId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedPanelId(null);
      setDragOverPanelId(null);
      return;
    }

    const reordered = [...currentIds];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updatedProject = reorderStoryboardPanels(
      project,
      selectedScene.id,
      selectedScene.sceneNumber,
      reordered
    );
    onUpdateProject(updatedProject);
    setDraggedPanelId(null);
    setDragOverPanelId(null);
  };

  const handleStepReorder = (panelId: string, direction: -1 | 1) => {
    if (!canEdit || !selectedScene || !onUpdateProject) return;
    const currentIds = scenePanels.map((p) => p.id);
    const index = currentIds.indexOf(panelId);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= currentIds.length) return;

    const reordered = [...currentIds];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    const updatedProject = reorderStoryboardPanels(
      project,
      selectedScene.id,
      selectedScene.sceneNumber,
      reordered
    );
    onUpdateProject(updatedProject);
  };

  // Empty screenplay state (strictly no fake demo scenes)
  if (screenplayCtx.scenes.length === 0) {
    return (
      <div
        id="storyboards-empty-screenplay-state"
        className="flex-1 min-h-0 flex items-center justify-center p-6 md:p-8 overflow-y-auto"
      >
        <div className="max-w-lg w-full rounded-3xl border border-[#F5F000]/35 bg-[#15171A]/90 backdrop-blur-2xl p-8 text-center space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_40px_rgba(250,204,21,0.15)]">
          <div className="mx-auto w-12 h-12 rounded-xl border border-[#F5F000]/35 bg-yellow-500/15 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.2)]">
            <Film className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-yellow-100 tracking-tight">
              No screenplay attached
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Storyboards build scene-by-scene from the canonical screenplay in{' '}
              <span className="text-slate-200 font-medium">{project.title}</span>.
              Import a screenplay first so real scene numbers and headings appear here.
            </p>
          </div>
          <div className="pt-1 flex items-center justify-center">
            <button
              type="button"
              onClick={() => onNavigateTab('screenplay')}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] shadow-[0_0_16px_rgba(250,204,21,0.35)] transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Clapperboard className="w-3.5 h-3.5" />
              Open Screenplay Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="storyboards-workspace-root"
      className="flex-1 min-h-0 flex overflow-hidden bg-transparent"
    >
      {/* Compact Collapsible Scene Navigator */}
      {navigatorCollapsed ? (
        <aside
          id="storyboards-scene-navigator-collapsed"
          className="w-11 shrink-0 border-r border-[#FFD34E]/20 bg-[#15171A]/90 backdrop-blur-xl border-r border-[#FFD34E]/15 flex flex-col items-center py-3 gap-3"
        >
          <button
            type="button"
            onClick={() => setNavigatorCollapsed(false)}
            title="Expand Scene Navigator"
            aria-label="Expand Scene Navigator"
            className="w-7 h-7 rounded-md border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-300 hover:text-yellow-100 hover:border-white/20 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="text-[10px] font-mono text-slate-500 [writing-mode:vertical-rl] rotate-180 tracking-wider uppercase select-none">
            Scenes ({screenplayCtx.scenes.length})
          </div>
        </aside>
      ) : (
        <aside
          id="storyboards-scene-navigator"
          className="w-64 md:w-72 shrink-0 border-r border-[#FFD34E]/20 bg-[#15171A]/90 backdrop-blur-xl border-r border-[#FFD34E]/15 flex flex-col min-h-0"
        >
          {/* Navigator Top Header */}
          <div className="px-3.5 pt-3 pb-2.5 border-b border-[#FFD34E]/20 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Scene Navigator
                </div>
                <div className="text-[11px] text-slate-500">
                  {totalStoryboardedScenes} / {screenplayCtx.scenes.length} storyboarded
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNavigatorCollapsed(true)}
                title="Collapse Scene Navigator"
                aria-label="Collapse Scene Navigator"
                className="w-7 h-7 rounded-md border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-yellow-100 hover:border-white/20 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={sceneSearch}
                onChange={(e) => setSceneSearch(e.target.value)}
                placeholder="Filter scenes..."
                className="w-full rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 pl-8 pr-2.5 py-1.5 text-xs text-yellow-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40"
              />
            </div>

            {/* Filter Pills */}
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/40 border border-[#FFD34E]/20 p-0.5 border border-[#FFD34E]/20">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'storyboarded', label: 'Boards' },
                  { id: 'unstoryboarded', label: 'Empty' },
                ] as const
              ).map((item) => {
                const active = sceneFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSceneFilter(item.id)}
                    className={`py-1 px-1.5 rounded-md text-[10px] font-medium transition-colors ${
                      active
                        ? 'bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scene List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            {filteredScenes.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                No matching scenes.
              </div>
            ) : (
              filteredScenes.map((scene) => {
                const panelCount = countsByScene.get(scene.id) ?? 0;
                const isSelected = scene.id === selectedSceneId;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    data-scene-id={scene.id}
                    onClick={() => {
                      setSelectedSceneId(scene.id);
                      setEditingPanelId(null);
                    }}
                    className={`w-full text-left rounded-lg px-2.5 py-2 border transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'border-[#F5F000]/50 bg-gradient-to-r from-[#9C741C]/35 to-[#1F2226] text-[#FFF1A8] shadow-[0_0_12px_rgba(245,240,0,0.18)]'
                        : 'border-transparent hover:border-[#FFD34E]/20 hover:bg-white/[0.025] text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)]'
                              : 'bg-white/[0.06] text-slate-300'
                          }`}
                        >
                          SC {scene.sceneNumber}
                        </span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            panelCount > 0 ? 'bg-emerald-400/80' : 'bg-slate-600'
                          }`}
                          title={
                            panelCount > 0
                              ? `${panelCount} storyboard panels`
                              : 'Not yet storyboarded'
                          }
                        />
                      </div>
                      <div className="mt-1 text-[11px] font-medium truncate text-slate-300">
                        {scene.slugline || 'UNTITLED SCENE'}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                        panelCount > 0
                          ? 'border-white/15 bg-[#15171A] border border-[#FFD34E]/20 text-yellow-400'
                          : 'border-white/[0.05] text-slate-600'
                      }`}
                    >
                      {panelCount > 0 ? `${panelCount}p` : '—'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* Main Storyboard Canvas */}
      <section
        id="storyboards-canvas-pane"
        className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
      >
        {selectedScene && (
          <>
            {/* Canvas Header Bar */}
            <div className="px-5 py-3.5 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-[#F5F000] to-[#FFD34E] text-stone-950 font-mono text-xs font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)] shadow-xs">
                    SC {selectedScene.sceneNumber}
                  </span>
                  <h2 className="text-sm md:text-base font-semibold text-yellow-100 truncate">
                    {selectedScene.slugline}
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    · {scenePanels.length}{' '}
                    {scenePanels.length === 1 ? 'panel' : 'panels'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {!canEdit && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-[11px] text-slate-400">
                    <Lock className="w-3 h-3" />
                    Read-only ({activeRole || 'viewer'})
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setShowPassage((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                    showPassage
                      ? 'border-[#F5F000]/50 bg-[#F5F000]/15 text-[#FFF1A8] shadow-[0_0_10px_rgba(245,240,0,0.2)]'
                      : 'border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 text-amber-100 text-slate-300 hover:text-yellow-100 hover:border-white/20'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Scene Script
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab('screenplay')}
                  className="px-2.5 py-1.5 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-xs font-medium text-slate-300 hover:text-yellow-100 hover:border-white/20 transition-colors"
                >
                  Open Screenplay ↗
                </button>

                {canEdit && (
                  <button
                    type="button"
                    data-testid="add-storyboard-panel-btn"
                    onClick={handleAddPanel}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(250,204,21,0.35)] transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Panel
                  </button>
                )}
              </div>
            </div>

            {/* Optional Read-Only Screenplay Context Strip */}
            {showPassage && (
              <div className="px-5 py-3 border-b border-[#FFD34E]/20 bg-[#0A0B0D]/90 border-b border-[#FFD34E]/15 text-xs text-slate-300 max-h-40 overflow-y-auto shrink-0 space-y-2 select-text">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Read-only Screenplay Passage · Scene {selectedScene.sceneNumber}
                </div>
                {(selectedScene.actionSnippet || selectedScene.scriptSnippet) && (
                  <p className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                    {selectedScene.actionSnippet || selectedScene.scriptSnippet}
                  </p>
                )}
                {selectedScene.dialogueBlocks.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    {selectedScene.dialogueBlocks.slice(0, 4).map((dlg, dlgIdx) => (
                      <div
                        key={`${dlg.character}-${dlgIdx}`}
                        className="rounded border border-[#FFD34E]/20 bg-[#15171A] border border-[#FFD34E]/20 px-2.5 py-1.5"
                      >
                        <div className="font-mono text-[10px] font-semibold text-yellow-400">
                          {dlg.character}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-2">
                          “{dlg.text}”
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {uploadError && (
              <div className="mx-5 mt-3 rounded-lg border border-red-400/30 bg-red-950/30 px-3.5 py-2 text-xs text-red-200 flex items-center justify-between shrink-0">
                <span>{uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-red-300 hover:text-white text-[11px]"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Canvas Scroll Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {scenePanels.length === 0 ? (
                <div
                  id="storyboards-empty-scene-state"
                  className="h-full min-h-[320px] flex items-center justify-center"
                >
                  <div className="max-w-md w-full rounded-2xl border border-dashed border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/25 p-8 text-center space-y-4">
                    <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 flex items-center justify-center">
                      <ImagePlus className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-yellow-100">
                        No storyboard panels yet
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Begin framing{' '}
                        <span className="text-slate-200 font-medium">
                          Scene {selectedScene.sceneNumber} ({selectedScene.slugline})
                        </span>{' '}
                        with ordered panels, uploaded artwork, shared references, and camera notes.
                      </p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        data-testid="add-first-panel-btn"
                        onClick={handleAddPanel}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(250,204,21,0.35)] transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add First Panel
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        Switch to an editor role (Director, Producer, First AD) to add panels.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  id="storyboards-panel-grid"
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-8"
                >
                  {scenePanels.map((panel, index) => {
                    const asset = panel.primaryAssetId
                      ? assetMap.get(panel.primaryAssetId) ?? null
                      : null;
                    const isAssetBroken = Boolean(asset && brokenAssetIds[asset.id]);
                    const statusStyle = STATUS_BADGE_MAP[panel.status];
                    const isDragging = draggedPanelId === panel.id;
                    const isDragTarget =
                      dragOverPanelId === panel.id && draggedPanelId !== panel.id;

                    return (
                      <article
                        key={panel.id}
                        data-panel-id={panel.id}
                        data-panel-number={panel.panelNumber}
                        draggable={canEdit}
                        onDragStart={(e) => {
                          if (!canEdit) return;
                          setDraggedPanelId(panel.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', panel.id);
                        }}
                        onDragOver={(e) => {
                          if (!canEdit || !draggedPanelId) return;
                          e.preventDefault();
                          if (dragOverPanelId !== panel.id) {
                            setDragOverPanelId(panel.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverPanelId === panel.id) {
                            setDragOverPanelId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleReorderByDrop(panel.id);
                        }}
                        onDragEnd={() => {
                          setDraggedPanelId(null);
                          setDragOverPanelId(null);
                        }}
                        className={`group rounded-2xl border border-[#FFD34E]/25 bg-[#141005]/80 backdrop-blur-xl overflow-hidden flex flex-col transition-all shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(250,204,21,0.06)] hover:border-yellow-400/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(250,204,21,0.18)] ${
                          isDragTarget
                            ? 'border-yellow-400 ring-2 ring-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.3)]'
                            : editingPanelId === panel.id
                            ? 'border-yellow-400/80 shadow-[0_0_16px_rgba(250,204,21,0.25)]'
                            : 'border-white/[0.08] hover:border-white/20'
                        } ${isDragging ? 'opacity-50' : ''}`}
                      >
                        {/* Top Card Chrome */}
                        <div className="px-3 py-2 border-b border-[#FFD34E]/20 bg-[#1F2226] border border-[#FFD34E]/25 text-amber-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {canEdit && (
                              <span
                                title="Drag to reorder panel"
                                className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span className="font-mono text-[11px] font-semibold text-yellow-100">
                              Panel {panel.panelNumber}
                            </span>
                            {panel.shotSize && (
                              <span className="px-1.5 py-0.5 rounded bg-white/[0.07] font-mono text-[10px] text-slate-300">
                                {panel.shotSize}
                              </span>
                            )}
                            {panel.movement && (
                              <span className="px-1.5 py-0.5 rounded border border-white/[0.07] text-[10px] text-slate-400 truncate max-w-[80px]">
                                {panel.movement}
                              </span>
                            )}
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${statusStyle.classes}`}
                          >
                            {statusStyle.label}
                          </span>
                        </div>

                        {/* Visual Frame Stage (16:9 neutral slate frame, images stay central focus) */}
                        <button
                          type="button"
                          onClick={() => setEditingPanelId(panel.id)}
                          className="relative aspect-video w-full bg-[#0A0B0D] border-b border-[#FFD34E]/20 flex items-center justify-center overflow-hidden text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-yellow-400"
                        >
                          {asset && !isAssetBroken ? (
                            <img
                              src={asset.thumbnailDataUrl || asset.storageRef}
                              alt={panel.title || `Panel ${panel.panelNumber}`}
                              onError={() =>
                                setBrokenAssetIds((prev) => ({
                                  ...prev,
                                  [asset.id]: true,
                                }))
                              }
                              className="w-full h-full object-contain"
                            />
                          ) : asset && isAssetBroken ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500 px-4 text-center">
                              <ImageOff className="w-5 h-5 text-slate-500" />
                              <span className="text-[11px] font-medium text-slate-400">
                                Image unavailable
                              </span>
                              <span className="text-[10px] text-slate-600 truncate max-w-[180px]">
                                {asset.originalFilename}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500 px-4 text-center">
                              <ImagePlus className="w-5 h-5 text-slate-600 group-hover:text-yellow-400/80 transition-colors" />
                              <span className="text-[11px] text-slate-500 group-hover:text-slate-300 transition-colors">
                                {canEdit ? 'Click to add artwork' : 'No visual attached'}
                              </span>
                            </div>
                          )}
                        </button>

                        {/* Panel Summary Notes */}
                        <div
                          onClick={() => setEditingPanelId(panel.id)}
                          className="p-3 flex-1 flex flex-col justify-between gap-2.5 cursor-pointer"
                        >
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-yellow-100 line-clamp-1">
                              {panel.title || `Panel ${panel.panelNumber}`}
                            </h3>
                            {panel.actionNotes ? (
                              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                                {panel.actionNotes}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-600 italic">
                                No action notes yet
                              </p>
                            )}
                            {panel.dialogueCue && (
                              <div className="rounded border border-[#FFD34E]/20 bg-[#0A0B0D]/90 border-b border-[#FFD34E]/15 px-2 py-1 text-[10px] font-mono text-slate-300 line-clamp-2">
                                {panel.dialogueCue}
                              </div>
                            )}
                          </div>

                          {/* Card Footer Actions */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-1">
                              {canEdit && scenePanels.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => handleStepReorder(panel.id, -1)}
                                    title="Move panel earlier"
                                    aria-label={`Move Panel ${panel.panelNumber} earlier`}
                                    className="w-6 h-6 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-yellow-100 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === scenePanels.length - 1}
                                    onClick={() => handleStepReorder(panel.id, 1)}
                                    title="Move panel later"
                                    aria-label={`Move Panel ${panel.panelNumber} later`}
                                    className="w-6 h-6 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-yellow-100 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
                                  >
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {onOpenDiscussion && (
                                <button
                                  type="button"
                                  data-testid={`storyboard-discuss-panel-${panel.id}`}
                                  onClick={() =>
                                    onOpenDiscussion({
                                      entityType: 'storyboard_panel',
                                      entityId: panel.id,
                                      entityLabel: `Scene ${panel.sceneNumber || selectedScene?.sceneNumber || ''} · Panel ${panel.panelNumber}`,
                                    })
                                  }
                                  title="Discuss this panel"
                                  className="w-7 h-7 rounded border border-[#FFD34E]/30 bg-[#9C741C]/25 text-[#FFF1A8] hover:bg-[#9C741C]/45 hover:border-[#F5F000]/50 flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingPanelId(panel.id)}
                                className="px-2 py-1 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-[11px] font-medium text-slate-300 hover:text-yellow-100 hover:border-white/25 inline-flex items-center gap-1 transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                                {canEdit ? 'Edit' : 'Inspect'}
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePanel(panel.id)}
                                  title="Delete panel"
                                  aria-label={`Delete Panel ${panel.panelNumber}`}
                                  className="w-7 h-7 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-red-300 hover:border-red-400/30 flex items-center justify-center transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
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
          </>
        )}
      </section>

      {/* Slide-over Individual Panel Editor Drawer */}
      <StoryboardPanelEditorDrawer
        panel={editingPanel}
        scene={selectedScene}
        referenceAssets={visualizeStore.referenceAssets}
        canEdit={canEdit}
        linkedShotsCount={
          editingPanel ? getShotsForStoryboardPanel(visualizeStore, editingPanel.id).length : 0
        }
        onClose={() => setEditingPanelId(null)}
        onSave={handleSavePanel}
        onUploadImage={handleUploadImageForPanel}
        onDeletePanel={handleDeletePanel}
        onCreateShotFromPanel={
          canEdit && selectedScene && onUpdateProject
            ? (panel) => {
                const { updatedProject } = createShotFromStoryboardPanel(
                  project,
                  selectedScene,
                  panel,
                  screenplayCtx.activeScript?.id || 'active-script'
                );
                onUpdateProject(updatedProject);
              }
            : undefined
        }
        onOpenLinkedShots={onOpenShotListsForScene}
      />
    </div>
  );
};
