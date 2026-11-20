import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  ExternalLink,
  Film,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Link2Off,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  Video,
} from 'lucide-react';
import type { FilmProject, ParsedScene, ProjectRole } from '../../../types';
import type { DiscussionRecordTarget } from '../../../services/contracts/types';
import type {
  CameraSetup,
  ShotPlanRecord,
  StoryboardPanelRecord,
  VisualizeProductionStore,
} from '../types';
import {
  assignCameraSetupToShots,
  compressStoryboardImageFile,
  createCameraSetup,
  createShot,
  createShotFromStoryboardPanel,
  deleteCameraSetup,
  deleteShot,
  duplicateShot,
  getShotCountsByScene,
  getShotsForCameraSetup,
  getShotsForScene,
  getStoryboardPanelsForScene,
  getUnresolvedSceneShots,
  moveShotToScene,
  registerSharedReferenceAsset,
  removeShotCameraSetupAssociation,
  reorderShotsInScene,
  resolveCameraSetupForShot,
  resolveStoryboardPanelForShot,
  updateCameraSetup,
  updateShot,
} from '../services/visualizeFoundationService';
import type { StoryboardsScreenplayContext } from './StoryboardsWorkspace';
import { ShotDraftUpdates, ShotEditorDrawer } from './ShotEditorDrawer';
import {
  CameraSetupDraftValues,
  CameraSetupEditorDrawer,
} from './CameraSetupEditorDrawer';
import { SharedReferencePickerModal } from './SharedReferencePickerModal';

export type ShotListsSubView = 'shot-list' | 'camera-setups';
type SceneShotFilterMode = 'all' | 'with-shots' | 'empty';

interface ShotListsWorkspaceProps {
  project: FilmProject;
  activeRole: ProjectRole | null;
  canEdit: boolean;
  screenplayCtx: StoryboardsScreenplayContext;
  visualizeStore: VisualizeProductionStore;
  onUpdateProject?: (updated: FilmProject) => void;
  onNavigateTab: (tabId: string, submodule?: string) => void;
  onOpenStoryboardPanel?: (sceneId: string, panelId: string) => void;
  onOpenDiscussion?: (target: DiscussionRecordTarget) => void;
}

const SHOT_STATUS_BADGE: Record<
  ShotPlanRecord['status'],
  { label: string; classes: string }
> = {
  planned: {
    label: 'Planned',
    classes: 'border-white/10 bg-[#15171A] border border-[#FFD34E]/20 text-slate-300',
  },
  ready: {
    label: 'Ready',
    classes: 'border-[#FFD34E]/30 bg-[#F5F000]/10 text-yellow-100',
  },
  completed: {
    label: 'Completed',
    classes: 'border-emerald-400/25 bg-emerald-950/50 text-emerald-200',
  },
};

export const ShotListsWorkspace: React.FC<ShotListsWorkspaceProps> = ({
  project,
  activeRole,
  canEdit,
  screenplayCtx,
  visualizeStore,
  onUpdateProject,
  onNavigateTab,
  onOpenStoryboardPanel,
  onOpenDiscussion,
}) => {
  const [viewMode, setViewMode] = useState<ShotListsSubView>('shot-list');
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    () => screenplayCtx.scenes[0]?.id ?? ''
  );
  const [navigatorCollapsed, setNavigatorCollapsed] = useState(false);
  const [sceneSearch, setSceneSearch] = useState('');
  const [sceneFilter, setSceneFilter] = useState<SceneShotFilterMode>('all');
  const [showPassage, setShowPassage] = useState(false);

  // Shot List filtering & inline controls
  const [shotQuery, setShotQuery] = useState('');
  const [setupFilterId, setSetupFilterId] = useState<string>('all');
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [confirmDeleteShotId, setConfirmDeleteShotId] = useState<string | null>(null);
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);
  const [dragOverShotId, setDragOverShotId] = useState<string | null>(null);
  const [showStoryboardPicker, setShowStoryboardPicker] = useState(false);

  // Camera Setups state
  const [setupSearch, setSetupSearch] = useState('');
  const [editingSetupId, setEditingSetupId] = useState<string | null>(null);
  const [isCreatingSetup, setIsCreatingSetup] = useState(false);
  const [expandedSetupIds, setExpandedSetupIds] = useState<Record<string, boolean>>({});
  const [pendingCreateSetupRefs, setPendingCreateSetupRefs] = useState<string[]>([]);
  const [refPickerTarget, setRefPickerTarget] = useState<
    | { kind: 'shot'; shotId: string }
    | { kind: 'setup'; setupId: string | '__new__' }
    | null
  >(null);

  // Sync valid scene selection across screenplay or project changes
  useEffect(() => {
    if (screenplayCtx.scenes.length === 0) {
      if (selectedSceneId !== '') setSelectedSceneId('');
      setEditingShotId(null);
      return;
    }
    const exists = screenplayCtx.scenes.some((sc) => sc.id === selectedSceneId);
    if (!exists) {
      setSelectedSceneId(screenplayCtx.scenes[0].id);
      setEditingShotId(null);
    }
  }, [project.id, screenplayCtx.scenes, selectedSceneId]);

  const countsByScene = useMemo(
    () => getShotCountsByScene(visualizeStore),
    [visualizeStore]
  );

  const unresolvedShots = useMemo(
    () => getUnresolvedSceneShots(visualizeStore, screenplayCtx.scenes),
    [visualizeStore, screenplayCtx.scenes]
  );

  const filteredScenes = useMemo(() => {
    const q = sceneSearch.trim().toLowerCase();
    return screenplayCtx.scenes.filter((scene) => {
      const count = countsByScene.get(scene.id) ?? 0;
      if (sceneFilter === 'with-shots' && count === 0) return false;
      if (sceneFilter === 'empty' && count > 0) return false;
      if (!q) return true;
      return (
        scene.sceneNumber.toLowerCase().includes(q) ||
        scene.slugline.toLowerCase().includes(q)
      );
    });
  }, [screenplayCtx.scenes, countsByScene, sceneFilter, sceneSearch]);

  const selectedScene = useMemo(
    () => screenplayCtx.scenes.find((s) => s.id === selectedSceneId) ?? null,
    [screenplayCtx.scenes, selectedSceneId]
  );

  const sceneShots = useMemo(() => {
    if (!selectedScene) return [];
    return getShotsForScene(visualizeStore, selectedScene.id);
  }, [visualizeStore, selectedScene]);

  const filteredSceneShots = useMemo(() => {
    const q = shotQuery.trim().toLowerCase();
    return sceneShots.filter((shot) => {
      if (setupFilterId === 'unassigned' && shot.cameraSetupId) return false;
      if (
        setupFilterId !== 'all' &&
        setupFilterId !== 'unassigned' &&
        shot.cameraSetupId !== setupFilterId
      ) {
        return false;
      }
      if (!q) return true;
      return (
        shot.description.toLowerCase().includes(q) ||
        shot.shotNumber.toLowerCase().includes(q) ||
        (shot.shotSize || '').toLowerCase().includes(q) ||
        (shot.cameraAngle || '').toLowerCase().includes(q) ||
        (shot.movement || '').toLowerCase().includes(q) ||
        (shot.focalLengthMm || '').toLowerCase().includes(q) ||
        (shot.framingNotes || '').toLowerCase().includes(q) ||
        (shot.cameraNotes || '').toLowerCase().includes(q)
      );
    });
  }, [sceneShots, shotQuery, setupFilterId]);

  const sceneStoryboardPanels = useMemo(() => {
    if (!selectedScene) return [];
    return getStoryboardPanelsForScene(visualizeStore, selectedScene.id);
  }, [visualizeStore, selectedScene]);

  const editingShot = useMemo(
    () => visualizeStore.shots.find((s) => s.id === editingShotId) ?? null,
    [visualizeStore.shots, editingShotId]
  );

  const editingSetup = useMemo(
    () => visualizeStore.cameraSetups.find((c) => c.id === editingSetupId) ?? null,
    [visualizeStore.cameraSetups, editingSetupId]
  );

  const filteredSetups = useMemo(() => {
    const q = setupSearch.trim().toLowerCase();
    if (!q) return visualizeStore.cameraSetups;
    return visualizeStore.cameraSetups.filter((setup) =>
      [
        setup.name,
        setup.cameraBody,
        setup.lensSeries,
        setup.focalLengthMm,
        setup.supportRig,
        setup.placementNotes,
        setup.movementConfig,
        setup.notes,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q))
    );
  }, [visualizeStore.cameraSetups, setupSearch]);

  const allProductionShots = useMemo(() => {
    return [...visualizeStore.shots].sort((a, b) => {
      const na = parseInt(a.sceneNumber, 10);
      const nb = parseInt(b.sceneNumber, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      if (a.sceneNumber !== b.sceneNumber) return a.sceneNumber.localeCompare(b.sceneNumber);
      return a.sortOrder - b.sortOrder;
    });
  }, [visualizeStore.shots]);

  // --- Shot Handlers ---
  const handleAddShot = () => {
    if (!canEdit || !selectedScene || !onUpdateProject) return;
    const { updatedProject, shot } = createShot(project, {
      scene: selectedScene,
      screenplayVersionId: screenplayCtx.activeScript?.id || 'active-script',
    });
    onUpdateProject(updatedProject);
    setEditingShotId(shot.id);
    setConfirmDeleteShotId(null);
  };

  const handleCreateShotFromPanel = (panel: StoryboardPanelRecord) => {
    if (!canEdit || !selectedScene || !onUpdateProject) return;
    const { updatedProject, shot } = createShotFromStoryboardPanel(
      project,
      selectedScene,
      panel,
      screenplayCtx.activeScript?.id || 'active-script'
    );
    onUpdateProject(updatedProject);
    setShowStoryboardPicker(false);
    setEditingShotId(shot.id);
  };

  const handleSaveShot = (shotId: string, updates: ShotDraftUpdates) => {
    if (!canEdit || !onUpdateProject) return;
    const updatedProject = updateShot(project, shotId, updates);
    onUpdateProject(updatedProject);
    setEditingShotId(null);
  };

  const handleDuplicateShot = (shotId: string) => {
    if (!canEdit || !onUpdateProject) return;
    const { updatedProject } = duplicateShot(project, shotId);
    onUpdateProject(updatedProject);
  };

  const handleDeleteShot = (shotId: string) => {
    if (!canEdit || !onUpdateProject) return;
    const updatedProject = deleteShot(project, shotId);
    onUpdateProject(updatedProject);
    setConfirmDeleteShotId(null);
    if (editingShotId === shotId) {
      setEditingShotId(null);
    }
  };

  const handleMoveShot = (shotId: string, targetSceneId: string) => {
    if (!canEdit || !onUpdateProject) return;
    const targetScene = screenplayCtx.scenes.find((sc) => sc.id === targetSceneId);
    if (!targetScene) return;
    const updatedProject = moveShotToScene(
      project,
      shotId,
      targetScene,
      screenplayCtx.activeScript?.id || 'active-script'
    );
    onUpdateProject(updatedProject);
    setSelectedSceneId(targetScene.id);
  };

  const handleStepReorderShot = (shotId: string, direction: -1 | 1) => {
    if (!canEdit || !selectedScene || !onUpdateProject) return;
    const currentIds = sceneShots.map((s) => s.id);
    const idx = currentIds.indexOf(shotId);
    const nextIdx = idx + direction;
    if (idx === -1 || nextIdx < 0 || nextIdx >= currentIds.length) return;
    const nextOrder = [...currentIds];
    const [moved] = nextOrder.splice(idx, 1);
    nextOrder.splice(nextIdx, 0, moved);
    onUpdateProject(
      reorderShotsInScene(project, selectedScene.id, selectedScene.sceneNumber, nextOrder)
    );
  };

  const handleDropReorderShot = (targetShotId: string) => {
    if (!canEdit || !selectedScene || !onUpdateProject) return;
    if (!draggedShotId || draggedShotId === targetShotId) {
      setDraggedShotId(null);
      setDragOverShotId(null);
      return;
    }
    const ids = sceneShots.map((s) => s.id);
    const fromIdx = ids.indexOf(draggedShotId);
    const toIdx = ids.indexOf(targetShotId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedShotId(null);
      setDragOverShotId(null);
      return;
    }
    const nextOrder = [...ids];
    const [moved] = nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, moved);
    onUpdateProject(
      reorderShotsInScene(project, selectedScene.id, selectedScene.sceneNumber, nextOrder)
    );
    setDraggedShotId(null);
    setDragOverShotId(null);
  };

  const handleUnlinkShotSetup = (shotId: string) => {
    if (!canEdit || !onUpdateProject) return;
    onUpdateProject(removeShotCameraSetupAssociation(project, shotId));
  };

  // --- Camera Setup Handlers ---
  const handleCreateSetup = (values: CameraSetupDraftValues) => {
    if (!canEdit || !onUpdateProject) return;
    const { updatedProject, setup } = createCameraSetup(project, values);
    onUpdateProject(updatedProject);
    setPendingCreateSetupRefs([]);
    setIsCreatingSetup(false);
    setEditingSetupId(setup.id);
  };

  const handleAttachReferenceToTarget = (assetId: string) => {
    if (!canEdit || !refPickerTarget) return;
    if (refPickerTarget.kind === 'shot') {
      if (!onUpdateProject) return;
      const targetShot = visualizeStore.shots.find((s) => s.id === refPickerTarget.shotId);
      if (!targetShot) return;
      const existing = targetShot.referenceAssetIds || [];
      if (!existing.includes(assetId)) {
        onUpdateProject(
          updateShot(project, targetShot.id, {
            referenceAssetIds: [...existing, assetId],
          })
        );
      }
      return;
    }

    if (refPickerTarget.setupId === '__new__') {
      setPendingCreateSetupRefs((prev) => (prev.includes(assetId) ? prev : [...prev, assetId]));
      return;
    }

    if (!onUpdateProject) return;
    const targetSetup = visualizeStore.cameraSetups.find((c) => c.id === refPickerTarget.setupId);
    if (!targetSetup) return;
    const existing = targetSetup.referenceAssetIds || [];
    if (!existing.includes(assetId)) {
      onUpdateProject(
        updateCameraSetup(project, targetSetup.id, {
          referenceAssetIds: [...existing, assetId],
        })
      );
    }
  };

  const handleUploadSharedAssetAndAttach = async (file: File) => {
    if (!canEdit || !onUpdateProject || !refPickerTarget) return;
    const compressed = await compressStoryboardImageFile(file);
    const { updatedProject, asset } = registerSharedReferenceAsset(project, {
      originalFilename: compressed.originalFilename,
      thumbnailDataUrl: compressed.dataUrl,
      mimeType: compressed.mimeType,
      fileSizeBytes: compressed.fileSizeBytes,
      description:
        refPickerTarget.kind === 'shot'
          ? 'Shot plan visual reference'
          : 'Camera setup diagram / reference',
      tags: [refPickerTarget.kind === 'shot' ? 'shot' : 'camera-setup', 'vault'],
      source: 'Vault & Visualize Library',
    });

    if (refPickerTarget.kind === 'shot') {
      const targetShot = visualizeStore.shots.find((s) => s.id === refPickerTarget.shotId);
      const existing = targetShot?.referenceAssetIds || [];
      const nextRefs = existing.includes(asset.id) ? existing : [...existing, asset.id];
      onUpdateProject(
        targetShot
          ? updateShot(updatedProject, targetShot.id, { referenceAssetIds: nextRefs })
          : updatedProject
      );
    } else if (refPickerTarget.setupId === '__new__') {
      onUpdateProject(updatedProject);
      setPendingCreateSetupRefs((prev) => (prev.includes(asset.id) ? prev : [...prev, asset.id]));
    } else {
      const targetSetup = visualizeStore.cameraSetups.find((c) => c.id === refPickerTarget.setupId);
      const existing = targetSetup?.referenceAssetIds || [];
      const nextRefs = existing.includes(asset.id) ? existing : [...existing, asset.id];
      onUpdateProject(
        targetSetup
          ? updateCameraSetup(updatedProject, targetSetup.id, { referenceAssetIds: nextRefs })
          : updatedProject
      );
    }
  };

  const handleUpdateSetup = (setupId: string, values: CameraSetupDraftValues) => {
    if (!canEdit || !onUpdateProject) return;
    onUpdateProject(updateCameraSetup(project, setupId, values));
    setEditingSetupId(null);
  };

  const handleDeleteSetup = (setupId: string) => {
    if (!canEdit || !onUpdateProject) return;
    onUpdateProject(deleteCameraSetup(project, setupId));
    if (editingSetupId === setupId) {
      setEditingSetupId(null);
    }
    if (setupFilterId === setupId) {
      setSetupFilterId('all');
    }
  };

  const handleAssignShotToSetup = (setupId: string, shotId: string) => {
    if (!canEdit || !onUpdateProject) return;
    onUpdateProject(assignCameraSetupToShots(project, setupId, [shotId]));
  };

  const handleJumpToShotFromSetup = (shot: ShotPlanRecord) => {
    setViewMode('shot-list');
    if (screenplayCtx.scenes.some((s) => s.id === shot.sceneId)) {
      setSelectedSceneId(shot.sceneId);
    }
    setEditingSetupId(null);
    setIsCreatingSetup(false);
    setEditingShotId(shot.id);
  };

  // Empty Screenplay State (never fabricate sample scenes)
  if (screenplayCtx.scenes.length === 0) {
    return (
      <div
        id="shotlists-empty-screenplay-state"
        className="flex-1 min-h-0 flex items-center justify-center p-6 md:p-8 overflow-y-auto"
      >
        <div className="max-w-lg w-full rounded-3xl border border-[#F5F000]/35 bg-[#15171A]/90 backdrop-blur-2xl p-8 text-center space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_40px_rgba(250,204,21,0.15)]">
          <div className="mx-auto w-12 h-12 rounded-xl border border-[#F5F000]/35 bg-yellow-500/15 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.2)]">
            <Camera className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-yellow-100 tracking-tight">
              No screenplay attached
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Shot Lists & Camera Setups map directly to scenes in the canonical screenplay of{' '}
              <span className="text-slate-200 font-medium">{project.title}</span>.
              Import a screenplay first so real scenes appear here.
            </p>
          </div>
          <div className="pt-1 flex items-center justify-center">
            <button
              type="button"
              onClick={() => onNavigateTab('screenplay', 'library')}
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
      id="shotlists-workspace-root"
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent"
    >
      {/* Connected Sub-Navigation Strip: Shot List <-> Camera Setups */}
      <div className="px-4 py-2 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div
            role="tablist"
            aria-label="Shot Lists and Camera Setups Views"
            className="inline-flex items-center rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-[#FFD34E]/20 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'shot-list'}
              data-testid="shotlists-subview-shot-list"
              onClick={() => {
                setViewMode('shot-list');
                setEditingSetupId(null);
                setIsCreatingSetup(false);
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'shot-list'
                  ? 'bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_12px_rgba(245,240,0,0.35)]'
                  : 'text-slate-400 hover:text-yellow-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Shot List
              <span className="font-mono text-[10px] opacity-75">
                ({visualizeStore.shots.length})
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'camera-setups'}
              data-testid="shotlists-subview-camera-setups"
              onClick={() => {
                setViewMode('camera-setups');
                setEditingShotId(null);
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'camera-setups'
                  ? 'bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_12px_rgba(245,240,0,0.35)]'
                  : 'text-slate-400 hover:text-yellow-100'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Camera Setups
              <span className="font-mono text-[10px] opacity-75">
                ({visualizeStore.cameraSetups.length})
              </span>
            </button>
          </div>

          <span className="hidden md:inline text-[11px] font-mono text-slate-500">
            {screenplayCtx.activeScript?.title || project.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!canEdit && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-[11px] text-slate-400">
              <Lock className="w-3 h-3" />
              Read-only ({activeRole || 'viewer'})
            </span>
          )}
          <button
            type="button"
            onClick={() => onNavigateTab('screenplay')}
            className="px-2.5 py-1 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-[11px] font-medium text-slate-300 hover:text-yellow-100 hover:border-white/20 transition-colors cursor-pointer"
          >
            Open Screenplay ↗
          </button>
        </div>
      </div>

      {/* Unresolved Scene Reference Flag (never silently deletes shot records if canonical scenes change) */}
      {unresolvedShots.length > 0 && (
        <div
          data-testid="shotlists-unresolved-scenes-banner"
          className="px-4 py-2 border-b border-amber-400/20 bg-amber-950/20 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              {unresolvedShots.length} shot{unresolvedShots.length === 1 ? ' references' : 's reference'} a scene missing from the current screenplay draft. Preserved safely for review:
            </span>
          </div>
          {canEdit && selectedScene && (
            <button
              type="button"
              onClick={() => {
                unresolvedShots.forEach((s) => handleMoveShot(s.id, selectedScene.id));
              }}
              className="px-2.5 py-1 rounded border border-amber-300/30 bg-amber-950/40 text-[11px] text-amber-100 hover:bg-amber-900/50 cursor-pointer"
            >
              Reassign to SC {selectedScene.sceneNumber}
            </button>
          )}
        </div>
      )}

      {/* AREA 1: SHOT LIST */}
      {viewMode === 'shot-list' ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Compact Collapsible Scene Navigator */}
          {navigatorCollapsed ? (
            <aside
              id="shotlists-scene-navigator-collapsed"
              className="w-11 shrink-0 border-r border-[#FFD34E]/20 bg-[#15171A]/90 backdrop-blur-xl border-r border-[#FFD34E]/15 flex flex-col items-center py-3 gap-3"
            >
              <button
                type="button"
                onClick={() => setNavigatorCollapsed(false)}
                title="Expand Scene Navigator"
                aria-label="Expand Scene Navigator"
                className="w-7 h-7 rounded-md border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-300 hover:text-yellow-100 hover:border-white/20 flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="text-[10px] font-mono text-slate-500 [writing-mode:vertical-rl] rotate-180 tracking-wider uppercase select-none">
                Scenes ({screenplayCtx.scenes.length})
              </div>
            </aside>
          ) : (
            <aside
              id="shotlists-scene-navigator"
              className="w-64 md:w-72 shrink-0 border-r border-[#FFD34E]/20 bg-[#15171A]/90 backdrop-blur-xl border-r border-[#FFD34E]/15 flex flex-col min-h-0"
            >
              <div className="px-3.5 pt-3 pb-2.5 border-b border-[#FFD34E]/20 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Scene Navigator
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {screenplayCtx.scenes.filter((s) => (countsByScene.get(s.id) ?? 0) > 0).length} /{' '}
                      {screenplayCtx.scenes.length} with shots
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNavigatorCollapsed(true)}
                    title="Collapse Scene Navigator"
                    aria-label="Collapse Scene Navigator"
                    className="w-7 h-7 rounded-md border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-yellow-100 hover:border-white/20 flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

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

                <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/40 border border-[#FFD34E]/20 p-0.5 border border-[#FFD34E]/20">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'with-shots', label: 'Planned' },
                      { id: 'empty', label: 'No Shots' },
                    ] as const
                  ).map((tab) => {
                    const active = sceneFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSceneFilter(tab.id)}
                        className={`py-1 px-1.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)]'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
                {filteredScenes.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-slate-500">
                    No matching scenes.
                  </div>
                ) : (
                  filteredScenes.map((scene) => {
                    const shotCount = countsByScene.get(scene.id) ?? 0;
                    const isSelected = scene.id === selectedSceneId;
                    return (
                      <button
                        key={scene.id}
                        type="button"
                        data-scene-id={scene.id}
                        onClick={() => {
                          setSelectedSceneId(scene.id);
                          setEditingShotId(null);
                          setShowStoryboardPicker(false);
                        }}
                        className={`w-full text-left rounded-lg px-2.5 py-2 border transition-all flex items-start justify-between gap-2 cursor-pointer ${
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
                                shotCount > 0 ? 'bg-emerald-400/80' : 'bg-slate-600'
                              }`}
                              title={
                                shotCount > 0 ? `${shotCount} shots` : 'No shots planned yet'
                              }
                            />
                          </div>
                          <div className="mt-1 text-[11px] font-medium truncate text-slate-300">
                            {scene.slugline || 'UNTITLED SCENE'}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                            shotCount > 0
                              ? 'border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 text-yellow-400'
                              : 'border-white/[0.05] text-slate-600'
                          }`}
                        >
                          {shotCount > 0 ? `${shotCount}s` : '—'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
          )}

          {/* Main Scene Shot List Canvas */}
          <section
            id="shotlists-main-pane"
            className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
          >
            {selectedScene && (
              <>
                {/* Selected Scene Header */}
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
                        · {sceneShots.length} {sceneShots.length === 1 ? 'shot' : 'shots'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap relative">
                    <button
                      type="button"
                      onClick={() => setShowPassage((prev) => !prev)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        showPassage
                          ? 'border-[#F5F000]/50 bg-[#F5F000]/15 text-[#FFF1A8] shadow-[0_0_10px_rgba(245,240,0,0.2)]'
                          : 'border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 text-amber-100 text-slate-300 hover:text-yellow-100 hover:border-white/20'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Scene Script
                    </button>

                    {canEdit && sceneStoryboardPanels.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          data-testid="shot-from-storyboard-btn"
                          onClick={() => setShowStoryboardPicker((prev) => !prev)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#FFD34E]/30 bg-[#1F2226] text-yellow-200 text-xs font-medium text-slate-200 hover:border-white/30 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-yellow-400" />
                          From Storyboard ({sceneStoryboardPanels.length})
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>

                        {showStoryboardPicker && (
                          <div
                            data-testid="shot-from-storyboard-menu"
                            className="absolute right-0 mt-1.5 w-72 rounded-xl border border-[#FFD34E]/30 bg-[#1F2226] text-yellow-200 shadow-2xl p-2 z-30 space-y-1"
                          >
                            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-[#FFD34E]/20">
                              Create Shot from Storyboard Panel
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-1 pt-1">
                              {sceneStoryboardPanels.map((panel) => (
                                <button
                                  key={panel.id}
                                  type="button"
                                  onClick={() => handleCreateShotFromPanel(panel)}
                                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/[0.06] flex items-center justify-between gap-2 text-xs cursor-pointer"
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium text-yellow-100 truncate">
                                      Panel {panel.panelNumber}: {panel.title}
                                    </div>
                                    {(panel.shotSize || panel.movement) && (
                                      <div className="text-[10px] font-mono text-slate-400">
                                        {[panel.shotSize, panel.movement].filter(Boolean).join(' · ')}
                                      </div>
                                    )}
                                  </div>
                                  <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        data-testid="add-shot-btn"
                        onClick={handleAddShot}
                        className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_16px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Shot
                      </button>
                    )}
                  </div>
                </div>

                {/* Read-Only Screenplay Strip */}
                {showPassage && (
                  <div className="px-5 py-3 border-b border-[#FFD34E]/20 bg-[#0A0B0D] border-b border-[#FFD34E]/20 text-xs text-slate-300 max-h-40 overflow-y-auto shrink-0 space-y-2 select-text">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Read-only Screenplay Context · Scene {selectedScene.sceneNumber}
                    </div>
                    {(selectedScene.actionSnippet || selectedScene.scriptSnippet) && (
                      <p className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                        {selectedScene.actionSnippet || selectedScene.scriptSnippet}
                      </p>
                    )}
                    {selectedScene.dialogueBlocks.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {selectedScene.dialogueBlocks.slice(0, 4).map((dlg, idx) => (
                          <div
                            key={`${dlg.character}-${idx}`}
                            className="rounded border border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl px-2.5 py-1.5"
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

                {/* Search & Setup Filter Toolbar (only shown when scene has shots) */}
                {sceneShots.length > 0 && (
                  <div className="px-5 py-2.5 border-b border-[#FFD34E]/20 bg-[#0A0B0D] border-b border-[#FFD34E]/20 flex flex-wrap items-center gap-2.5 shrink-0">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={shotQuery}
                        onChange={(e) => setShotQuery(e.target.value)}
                        data-testid="shot-list-search-input"
                        placeholder="Search shots by description, lens, framing..."
                        className="w-full rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 pl-8 pr-2.5 py-1.5 text-xs text-yellow-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40"
                      />
                    </div>

                    <select
                      value={setupFilterId}
                      onChange={(e) => setSetupFilterId(e.target.value)}
                      data-testid="shot-list-setup-filter"
                      className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="all">All Camera Setups</option>
                      <option value="unassigned">Unassigned Setup</option>
                      {visualizeStore.cameraSetups.map((setup) => (
                        <option key={setup.id} value={setup.id}>
                          {setup.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Shot List Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-5">
                  {sceneShots.length === 0 ? (
                    <div
                      id="shotlists-empty-scene-state"
                      className="h-full min-h-[300px] flex items-center justify-center"
                    >
                      <div className="max-w-md w-full rounded-2xl border border-dashed border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/25 p-8 text-center space-y-4">
                        <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 flex items-center justify-center">
                          <Camera className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="space-y-1.5">
                          <h3 className="text-base font-semibold text-yellow-100">
                            No shots planned for Scene {selectedScene.sceneNumber} yet
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Break{' '}
                            <span className="text-slate-200 font-medium">
                              {selectedScene.slugline}
                            </span>{' '}
                            into camera shots, focal lengths, movement notes, and reusable setups.
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              data-testid="add-first-shot-btn"
                              onClick={handleAddShot}
                              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_16px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add First Shot
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : filteredSceneShots.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.08] bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 p-8 text-center text-xs text-slate-400">
                      No shots match the current search or setup filter.
                    </div>
                  ) : (
                    <div id="shotlists-rows-container" className="space-y-2 pb-8">
                      {filteredSceneShots.map((shot, idx) => {
                        const linkedSetup = resolveCameraSetupForShot(shot, visualizeStore);
                        const linkedPanel = resolveStoryboardPanelForShot(shot, visualizeStore);
                        const statusStyle = SHOT_STATUS_BADGE[shot.status];
                        const isDragging = draggedShotId === shot.id;
                        const isDragTarget =
                          dragOverShotId === shot.id && draggedShotId !== shot.id;

                        return (
                          <div
                            key={shot.id}
                            data-shot-id={shot.id}
                            data-shot-number={shot.shotNumber}
                            draggable={canEdit}
                            onDragStart={(e) => {
                              if (!canEdit) return;
                              setDraggedShotId(shot.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', shot.id);
                            }}
                            onDragOver={(e) => {
                              if (!canEdit || !draggedShotId) return;
                              e.preventDefault();
                              if (dragOverShotId !== shot.id) setDragOverShotId(shot.id);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropReorderShot(shot.id);
                            }}
                            onDragEnd={() => {
                              setDraggedShotId(null);
                              setDragOverShotId(null);
                            }}
                            onClick={() => setEditingShotId(shot.id)}
                            className={`group rounded-xl border bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 px-3.5 py-3 transition-all cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                              isDragTarget
                                ? 'border-[#F5F000] ring-1 ring-[#F5F000]/60 shadow-[0_0_14px_rgba(245,240,0,0.25)]'
                                : editingShotId === shot.id
                                ? 'border-[#F5F000]/60 bg-[#1F2226] shadow-[0_0_12px_rgba(245,240,0,0.15)]'
                                : 'border-white/[0.08] hover:border-white/20'
                            } ${isDragging ? 'opacity-50' : ''}`}
                          >
                            {/* Left: Handle + Sequence + Spec Tags + Description */}
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {canEdit && (
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1 text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
                                  title="Drag to reorder"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </span>
                              )}

                              <span className="mt-0.5 px-2 py-0.5 rounded bg-[#1F2226] border border-[#FFD34E]/25 text-[#FFF1A8] border border-white/10 font-mono text-xs font-semibold text-yellow-100 shrink-0">
                                {shot.shotNumber}
                              </span>

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {shot.shotSize && (
                                    <span className="px-1.5 py-0.5 rounded bg-white/[0.07] font-mono text-[10px] font-semibold text-yellow-100">
                                      {shot.shotSize}
                                    </span>
                                  )}
                                  {shot.cameraAngle && (
                                    <span className="px-1.5 py-0.5 rounded border border-white/[0.08] text-[10px] text-slate-300">
                                      {shot.cameraAngle}
                                    </span>
                                  )}
                                  {shot.movement && (
                                    <span className="px-1.5 py-0.5 rounded border border-white/[0.08] text-[10px] text-slate-300">
                                      {shot.movement}
                                    </span>
                                  )}
                                  {shot.focalLengthMm && (
                                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-[#FFD34E]/20 font-mono text-[10px] text-slate-300">
                                      {shot.focalLengthMm}
                                    </span>
                                  )}
                                  <span
                                    className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusStyle.classes}`}
                                  >
                                    {statusStyle.label}
                                  </span>
                                </div>

                                <p className="text-xs font-medium text-yellow-100 leading-snug">
                                  {shot.description}
                                </p>

                                {(shot.framingNotes || shot.cameraNotes || (shot.linkedCharacters && shot.linkedCharacters.length > 0)) && (
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                    {shot.framingNotes && (
                                      <span className="truncate max-w-md">
                                        Framing: {shot.framingNotes}
                                      </span>
                                    )}
                                    {shot.cameraNotes && (
                                      <span className="truncate max-w-md text-slate-500">
                                        Note: {shot.cameraNotes}
                                      </span>
                                    )}
                                    {shot.linkedCharacters && shot.linkedCharacters.length > 0 && (
                                      <span className="font-mono text-[10px] text-slate-400">
                                        [{shot.linkedCharacters.join(', ')}]
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Setup Badge, Storyboard Reference Link, Quick Actions */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex flex-wrap items-center gap-2 shrink-0 justify-end"
                            >
                              {linkedSetup ? (
                                <div className="inline-flex items-center rounded-lg border border-white/15 bg-[#15171A] border border-[#FFD34E]/25 text-[#FFF1A8] text-[11px] overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewMode('camera-setups');
                                      setEditingSetupId(linkedSetup.id);
                                      setExpandedSetupIds((prev) => ({
                                        ...prev,
                                        [linkedSetup.id]: true,
                                      }));
                                    }}
                                    className="px-2 py-1 text-yellow-100 hover:bg-white/[0.06] inline-flex items-center gap-1 cursor-pointer"
                                    title="Inspect Camera Setup"
                                  >
                                    <Video className="w-3 h-3 text-yellow-400" />
                                    <span className="max-w-[140px] truncate">{linkedSetup.name}</span>
                                  </button>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleUnlinkShotSetup(shot.id)}
                                      title="Remove camera setup link"
                                      aria-label={`Remove setup link for Shot ${shot.shotNumber}`}
                                      className="px-1.5 py-1 border-l border-white/10 text-slate-400 hover:text-amber-300 hover:bg-white/[0.05] cursor-pointer"
                                    >
                                      <Link2Off className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-600 px-2 py-1">
                                  No setup
                                </span>
                              )}

                              {linkedPanel && (
                                <button
                                  type="button"
                                  data-testid={`shot-panel-link-${shot.shotNumber}`}
                                  onClick={() =>
                                    onOpenStoryboardPanel?.(linkedPanel.sceneId, linkedPanel.id)
                                  }
                                  title={`Open Panel ${linkedPanel.panelNumber} in Storyboards`}
                                  className="px-2 py-1 rounded-lg border border-[#FFD34E]/25 bg-[#F5F000]/10 text-[11px] text-yellow-100 hover:bg-[#F5F000]/15 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  <span>Panel {linkedPanel.panelNumber}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-75" />
                                </button>
                              )}

                              {onOpenDiscussion && (
                                <button
                                  type="button"
                                  data-testid={`shot-discuss-btn-${shot.shotNumber}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenDiscussion({
                                      entityType: 'shot',
                                      entityId: shot.id,
                                      entityLabel: `Scene ${shot.sceneNumber} · Shot ${shot.shotNumber}`,
                                    });
                                  }}
                                  title={`Discuss Shot ${shot.shotNumber}`}
                                  className="px-2 py-1 rounded-lg border border-[#FFD34E]/30 bg-[#9C741C]/25 text-[11px] text-[#FFF1A8] hover:bg-[#9C741C]/45 hover:border-[#F5F000]/50 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Discuss</span>
                                </button>
                              )}

                              {canEdit && (
                                <div className="flex items-center gap-1 pl-1 border-l border-[#FFD34E]/20">
                                  <button
                                    type="button"
                                    disabled={idx === 0 || shotQuery !== '' || setupFilterId !== 'all'}
                                    onClick={() => handleStepReorderShot(shot.id, -1)}
                                    title="Move shot up"
                                    aria-label={`Move Shot ${shot.shotNumber} up`}
                                    className="w-6 h-6 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-yellow-100 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      idx === filteredSceneShots.length - 1 ||
                                      shotQuery !== '' ||
                                      setupFilterId !== 'all'
                                    }
                                    onClick={() => handleStepReorderShot(shot.id, 1)}
                                    title="Move shot down"
                                    aria-label={`Move Shot ${shot.shotNumber} down`}
                                    className="w-6 h-6 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-yellow-100 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateShot(shot.id)}
                                    title="Duplicate shot"
                                    aria-label={`Duplicate Shot ${shot.shotNumber}`}
                                    className="w-6 h-6 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-yellow-100 flex items-center justify-center cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingShotId(shot.id)}
                                    title="Edit shot"
                                    aria-label={`Edit Shot ${shot.shotNumber}`}
                                    className="w-6 h-6 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-yellow-100 flex items-center justify-center cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  {confirmDeleteShotId === shot.id ? (
                                    <button
                                      type="button"
                                      data-testid={`confirm-delete-shot-${shot.shotNumber}`}
                                      onClick={() => handleDeleteShot(shot.id)}
                                      className="px-2 py-0.5 rounded bg-rose-500/25 border border-rose-400/40 text-[10px] font-semibold text-rose-100 cursor-pointer"
                                    >
                                      Delete?
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteShotId(shot.id)}
                                      title="Delete shot"
                                      aria-label={`Delete Shot ${shot.shotNumber}`}
                                      className="w-6 h-6 rounded border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-rose-300 flex items-center justify-center cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Shot Editor Drawer */}
          <ShotEditorDrawer
            shot={editingShot}
            scene={
              editingShot
                ? screenplayCtx.scenes.find((s) => s.id === editingShot.sceneId) ?? selectedScene
                : selectedScene
            }
            allScenes={screenplayCtx.scenes}
            cameraSetups={visualizeStore.cameraSetups}
            sceneStoryboardPanels={
              editingShot
                ? getStoryboardPanelsForScene(visualizeStore, editingShot.sceneId)
                : sceneStoryboardPanels
            }
            referenceAssets={visualizeStore.referenceAssets}
            canEdit={canEdit}
            onClose={() => setEditingShotId(null)}
            onSave={handleSaveShot}
            onDeleteShot={handleDeleteShot}
            onMoveShotToScene={handleMoveShot}
            onOpenStoryboardPanel={onOpenStoryboardPanel}
            onOpenCameraSetup={(setupId) => {
              setEditingShotId(null);
              setViewMode('camera-setups');
              setEditingSetupId(setupId);
            }}
            onOpenReferencePicker={
              editingShot
                ? () => setRefPickerTarget({ kind: 'shot', shotId: editingShot.id })
                : undefined
            }
          />
        </div>
      ) : (
        /* AREA 2: CAMERA SETUPS */
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <section
            id="camera-setups-main-pane"
            className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
          >
            {/* Header Bar */}
            <div className="px-5 py-3.5 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-sm md:text-base font-semibold text-yellow-100">
                  Reusable Camera Setups
                </h2>
                <p className="text-xs text-slate-400">
                  Define shared camera positions, rigs, and optics served across multiple shots.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={setupSearch}
                    onChange={(e) => setSetupSearch(e.target.value)}
                    placeholder="Filter setups..."
                    className="w-48 md:w-56 rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 pl-8 pr-2.5 py-1.5 text-xs text-yellow-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40"
                  />
                </div>

                {canEdit && (
                  <button
                    type="button"
                    data-testid="add-camera-setup-btn"
                    onClick={() => {
                      setEditingSetupId(null);
                      setIsCreatingSetup(true);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_16px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Camera Setup
                  </button>
                )}
              </div>
            </div>

            {/* Setup List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {visualizeStore.cameraSetups.length === 0 ? (
                <div
                  id="camera-setups-empty-state"
                  className="h-full min-h-[300px] flex items-center justify-center"
                >
                  <div className="max-w-md w-full rounded-2xl border border-dashed border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/25 p-8 text-center space-y-4">
                    <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 flex items-center justify-center">
                      <Video className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-yellow-100">
                        No camera setups defined yet
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Create reusable camera positions and rigs so multiple shots can share the same setup without duplicating specifications.
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        data-testid="add-first-camera-setup-btn"
                        onClick={() => {
                          setEditingSetupId(null);
                          setIsCreatingSetup(true);
                        }}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_16px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Camera Setup
                      </button>
                    )}
                  </div>
                </div>
              ) : filteredSetups.length === 0 ? (
                <div className="rounded-xl border border-white/[0.08] bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 p-8 text-center text-xs text-slate-400">
                  No camera setups match "{setupSearch}".
                </div>
              ) : (
                <div id="camera-setups-list" className="space-y-2.5 max-w-5xl pb-8">
                  {filteredSetups.map((setup) => {
                    const shotsUsing = getShotsForCameraSetup(visualizeStore, setup.id);
                    const isExpanded = Boolean(expandedSetupIds[setup.id]);
                    const summaryParts = [
                      setup.cameraBody,
                      setup.lensSeries,
                      setup.focalLengthMm,
                      setup.supportRig,
                      setup.movementConfig,
                    ].filter(Boolean);

                    return (
                      <div
                        key={setup.id}
                        data-setup-id={setup.id}
                        className={`rounded-xl border bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 overflow-hidden transition-colors ${
                          editingSetupId === setup.id
                            ? 'border-[#F5F000]/60'
                            : 'border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-sm font-semibold text-yellow-100">
                                {setup.name}
                              </h3>
                              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 text-[#FFD34E] font-mono text-[10px] text-yellow-400">
                                {shotsUsing.length} {shotsUsing.length === 1 ? 'shot' : 'shots'}
                              </span>
                            </div>

                            {summaryParts.length > 0 ? (
                              <div className="text-xs text-slate-300 font-mono truncate">
                                {summaryParts.join(' · ')}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic">
                                Minimal identifier setup (technical fields optional)
                              </div>
                            )}

                            {(setup.placementNotes || setup.notes) && (
                              <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-0.5">
                                {setup.placementNotes && (
                                  <span>Placement: {setup.placementNotes}</span>
                                )}
                                {setup.notes && <span>Notes: {setup.notes}</span>}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              data-testid={`setup-toggle-shots-${setup.id}`}
                              onClick={() =>
                                setExpandedSetupIds((prev) => ({
                                  ...prev,
                                  [setup.id]: !prev[setup.id],
                                }))
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-[11px] text-slate-300 hover:text-yellow-100 hover:border-white/25 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                              Inspect Shots ({shotsUsing.length})
                            </button>

                            <button
                              type="button"
                              data-testid={`setup-edit-btn-${setup.id}`}
                              onClick={() => {
                                setIsCreatingSetup(false);
                                setEditingSetupId(setup.id);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-white/15 bg-[#1F2226] border border-[#FFD34E]/25 text-[#FFD34E] text-[11px] font-medium text-yellow-100 hover:border-white/30 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              {canEdit ? 'Edit' : 'View'}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-[#FFD34E]/20 bg-[#0A0B0D] border-b border-[#FFD34E]/20 px-4 py-3 space-y-1.5">
                            {shotsUsing.length === 0 ? (
                              <div className="text-xs text-slate-500">
                                No shots currently assigned to this camera setup.
                              </div>
                            ) : (
                              shotsUsing.map((shot) => (
                                <div
                                  key={shot.id}
                                  className="rounded-lg border border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleJumpToShotFromSetup(shot)}
                                    className="min-w-0 flex-1 text-left flex items-center gap-2 hover:text-white cursor-pointer"
                                  >
                                    <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.08] text-yellow-100 shrink-0">
                                      SC {shot.sceneNumber} · Shot {shot.shotNumber}
                                    </span>
                                    {shot.shotSize && (
                                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                        {shot.shotSize}
                                      </span>
                                    )}
                                    <span className="truncate text-slate-300">
                                      {shot.description}
                                    </span>
                                  </button>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleJumpToShotFromSetup(shot)}
                                      title="Open in Shot List"
                                      className="px-2 py-1 rounded border border-white/10 text-[10px] text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      Open <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => handleUnlinkShotSetup(shot.id)}
                                        title="Unlink from setup without deleting shot"
                                        className="px-2 py-1 rounded border border-white/10 text-[10px] text-slate-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Link2Off className="w-2.5 h-2.5" />
                                        Unlink
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Camera Setup Editor Drawer */}
          <CameraSetupEditorDrawer
            setup={editingSetup}
            isCreating={isCreatingSetup}
            associatedShots={
              editingSetup
                ? getShotsForCameraSetup(visualizeStore, editingSetup.id)
                : []
            }
            allProductionShots={allProductionShots}
            referenceAssets={visualizeStore.referenceAssets}
            pendingCreateReferenceIds={pendingCreateSetupRefs}
            canEdit={canEdit}
            onClose={() => {
              setIsCreatingSetup(false);
              setPendingCreateSetupRefs([]);
              setEditingSetupId(null);
            }}
            onCreate={handleCreateSetup}
            onUpdate={handleUpdateSetup}
            onDelete={handleDeleteSetup}
            onAssignShot={handleAssignShotToSetup}
            onUnlinkShot={handleUnlinkShotSetup}
            onJumpToShot={handleJumpToShotFromSetup}
            onOpenReferencePicker={() =>
              setRefPickerTarget({
                kind: 'setup',
                setupId: isCreatingSetup ? '__new__' : editingSetup?.id || '__new__',
              })
            }
            onRemovePendingCreateRef={(assetId) =>
              setPendingCreateSetupRefs((prev) => prev.filter((id) => id !== assetId))
            }
          />
        </div>
      )}

      <SharedReferencePickerModal
        isOpen={Boolean(refPickerTarget)}
        title={
          refPickerTarget?.kind === 'shot'
            ? 'Attach Vault / Reference Image to Shot'
            : 'Attach Vault / Reference Image to Camera Setup'
        }
        subtitle="Select from production Vault Images/Graphics or Shared Library assets — no duplicate files created."
        referenceAssets={visualizeStore.referenceAssets}
        alreadyAttachedAssetIds={
          refPickerTarget?.kind === 'shot'
            ? editingShot?.referenceAssetIds || []
            : refPickerTarget?.setupId === '__new__'
              ? pendingCreateSetupRefs
              : editingSetup?.referenceAssetIds || []
        }
        canEdit={canEdit}
        onClose={() => setRefPickerTarget(null)}
        onSelectAsset={(assetId) => {
          handleAttachReferenceToTarget(assetId);
          setRefPickerTarget(null);
        }}
        onUploadNewAsset={handleUploadSharedAssetAndAttach}
      />
    </div>
  );
};
