/**
 * SceneOS — Visualise Foundation Service (Batch 0)
 *
 * Provides production-isolated data normalization, canonical screenplay & scene resolution,
 * RBAC permission evaluation, and relational helpers shared across Storyboards,
 * Shot Lists & Camera Setups, Lookbooks & Mood Boards, and the Shared Visual Reference Library.
 */

import { FilmProject, ParsedScene, ScreenplayVersion } from '../../../types';
import { ProjectRole } from '../../../types/database.types';
import { hasPermission } from '../../../services/rbac/permissions';
import {
  CameraSetup,
  LookbookBoardRecord,
  LookbookRecord,
  LookbookSectionItemRecord,
  LookbookSectionRecord,
  MoodBoardItemRecord,
  MoodBoardRecord,
  MoodBoardTileSize,
  ScreenplayPassageReference,
  ShotCameraAngle,
  ShotMovementType,
  ShotPlanRecord,
  ShotSizeCode,
  StoryboardPanelRecord,
  UnifiedBoardRecord,
  VisualReferenceAsset,
  VisualizeProductionStore,
  VisualizeWorkspaceId,
  VisualizeWorkspaceMeta,
} from '../types';

export const VISUALIZE_WORKSPACES: VisualizeWorkspaceMeta[] = [
  {
    id: 'storyboards',
    name: 'Storyboards',
    shortLabel: 'Storyboards',
    purpose: 'Visualise scenes through ordered storyboard panels and keyframes anchored to canonical scenes, shots, and passages.',
  },
  {
    id: 'shot-lists',
    name: 'Shot Lists & Camera Setups',
    shortLabel: 'Shot Lists & Camera Setups',
    purpose: 'Plan scene camera shots with technical specifications linked to reusable physical camera setups.',
  },
  {
    id: 'boards',
    name: 'Boards',
    shortLabel: 'Boards',
    purpose: 'Unified freeform visual composition pinboards uniting mood boards, lookbooks, sections, and Vault references.',
  },
];

/**
 * Normalizes incoming submodule / route identifiers strictly into the 3 approved Visualise workspaces.
 * Legacy Lookbooks & Mood Boards aliases consolidate cleanly onto unified "boards".
 */
export function normalizeVisualizeWorkspaceId(raw?: string | null): VisualizeWorkspaceId {
  const val = (raw || '').trim().toLowerCase();
  if (val === 'shot-lists' || val === 'shots' || val === 'visualize-shots' || val === 'visualize-shot-lists') {
    return 'shot-lists';
  }
  if (
    val === 'boards' ||
    val === 'visualize-boards' ||
    val === 'lookbooks' ||
    val === 'moodboards' ||
    val === 'mood-boards' ||
    val === 'visualize-lookbooks'
  ) {
    return 'boards';
  }
  return 'storyboards';
}

export interface CanonicalScreenplayContext {
  productionId: string;
  hasScreenplay: boolean;
  activeScript: ScreenplayVersion | null;
  scenes: ParsedScene[];
  sceneMap: Map<string, ParsedScene>;
}

/**
 * Retrieves the canonical active screenplay version and stable ParsedScene records for a production.
 * Never fabricates demo scenes and never duplicates screenplay state.
 */
export function getCanonicalVisualizeScreenplayContext(
  project: FilmProject
): CanonicalScreenplayContext {
  const versions = project.screenplayVersions || [];
  const activeScript =
    versions.find((v) => v.id === (project as any).activeScreenplayVersionId) ||
    versions[0] ||
    null;

  let scenes: ParsedScene[] = [];
  if (activeScript?.extractedScenes && activeScript.extractedScenes.length > 0) {
    scenes = activeScript.extractedScenes;
  } else if (activeScript?.scenes && activeScript.scenes.length > 0) {
    scenes = activeScript.scenes;
  } else if (Array.isArray((project as any).scenes) && (project as any).scenes.length > 0) {
    scenes = (project as any).scenes;
  }

  const sceneMap = new Map<string, ParsedScene>();
  scenes.forEach((scn) => {
    if (scn?.id) sceneMap.set(scn.id, scn);
  });

  return {
    productionId: project.id,
    hasScreenplay: Boolean(activeScript),
    activeScript,
    scenes,
    sceneMap,
  };
}

/**
 * Constructs a stable ScreenplayPassageReference pointing to a canonical scene without duplicating text.
 */
export function createPassageReference(
  scene: ParsedScene,
  screenplayVersionId: string,
  options?: { excerpt?: string; elementId?: string; sourceLineNumber?: number }
): ScreenplayPassageReference {
  const slugline = scene.slugline || (scene as any).heading || `SCENE ${scene.sceneNumber}`;
  return {
    screenplayVersionId,
    sceneId: scene.id,
    sceneNumber: scene.sceneNumber,
    sceneSlugline: slugline,
    excerpt: options?.excerpt ?? scene.actionSnippet ?? scene.synopsis,
    sourceLineNumber: options?.sourceLineNumber ?? scene.sourceLineNumber,
    sourcePos: scene.sourcePos,
    endPos: scene.endPos,
    elementId: options?.elementId,
  };
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Indexes any existing Vault storyboard images into non-duplicating VisualReferenceAsset projections
 * scoped strictly to this production. Does not mutate Vault storage.
 */
export function deriveVaultReferenceAssets(project: FilmProject): VisualReferenceAsset[] {
  const revisions = project.storyboardRevisions || [];
  const assets: VisualReferenceAsset[] = [];

  for (const va of project.vaultState?.assets || []) {
    if (!va?.id || va.productionId !== project.id) continue;
    if (va.category !== 'images' && va.category !== 'graphics') continue;
    const src = va.thumbnailDataUrl || va.externalUrl;
    if (!src) continue;
    assets.push({
      id: va.sharedReferenceAssetId || `vault-asset-${va.id}`,
      productionId: project.id,
      storageProvider: 'vault-local',
      storageRef: src,
      vaultAssetId: va.id,
      originalFilename: va.name || va.originalFilename,
      mediaType: 'image',
      mimeType: va.mimeType || 'image/png',
      fileSizeBytes: va.fileSizeBytes,
      thumbnailDataUrl: src,
      description: va.description,
      tags: va.tags || ['vault'],
      source: va.category === 'graphics' ? 'Vault Graphics' : 'Media Vault',
      createdAt: va.createdAt,
      updatedAt: va.updatedAt,
    });
  }

  for (const rev of revisions) {
    if (!rev?.id || !rev.imageUrl) continue;
    const isDataUrl = rev.imageUrl.startsWith('data:');
    assets.push({
      id: `vault-ref-${rev.id}`,
      productionId: project.id,
      storageProvider: isDataUrl ? 'vault-local' : 'external-url',
      storageRef: isDataUrl ? `vault://storyboard/${rev.id}` : rev.imageUrl,
      vaultAssetId: rev.id,
      originalFilename: rev.title ? `${rev.title.replace(/[^a-z0-9-_]/gi, '_')}.jpg` : `storyboard_${rev.id}.jpg`,
      mediaType: 'image',
      mimeType: 'image/jpeg',
      thumbnailDataUrl: rev.imageUrl,
      description: rev.description || undefined,
      tags: ['vault', 'storyboard', rev.sceneNumber ? `scene-${rev.sceneNumber}` : ''].filter(Boolean),
      attribution: rev.artist || undefined,
      source: 'Media Vault',
      createdAt: rev.updatedAt || project.updatedAt,
      updatedAt: rev.updatedAt || project.updatedAt,
    });
  }

  return assets;
}

/**
 * Returns the strictly production-isolated VisualizeProductionStore for a FilmProject.
 * Filters out any cross-production records and merges non-duplicating Vault reference indexes.
 */
export function getProductionVisualizeStore(project: FilmProject): VisualizeProductionStore {
  const raw = project.visualizeState;
  const productionId = project.id;

  const filterProduction = <T extends { id: string; productionId: string }>(arr?: T[]): T[] =>
    deduplicateById((arr || []).filter((item) => item.productionId === productionId));

  const storedAssets = filterProduction(raw?.referenceAssets);
  const vaultProjected = deriveVaultReferenceAssets(project);

  // Merge Vault-derived projections without duplicating already-indexed vaultAssetId records
  const indexedVaultIds = new Set(
    storedAssets.map((a) => a.vaultAssetId).filter((v): v is string => Boolean(v))
  );
  const mergedAssets = [
    ...storedAssets,
    ...vaultProjected.filter((v) => !v.vaultAssetId || !indexedVaultIds.has(v.vaultAssetId)),
  ];

  return {
    schemaVersion: 1,
    productionId,
    storyboardPanels: filterProduction(raw?.storyboardPanels),
    cameraSetups: filterProduction(raw?.cameraSetups),
    shots: filterProduction(raw?.shots),
    boards: filterProduction(raw?.boards),
    lookbookBoards: filterProduction(raw?.lookbookBoards),
    moodBoards: filterProduction(raw?.moodBoards),
    lookbooks: filterProduction(raw?.lookbooks),
    referenceAssets: deduplicateById(mergedAssets),
    updatedAt: raw?.updatedAt || project.updatedAt,
  };
}

/**
 * Produces an immutable updated FilmProject with production-isolated visualizeState.
 */
export function updateProductionVisualizeStore(
  project: FilmProject,
  updater: (current: VisualizeProductionStore) => VisualizeProductionStore
): FilmProject {
  const current = getProductionVisualizeStore(project);
  const next = updater(current);
  const now = new Date().toISOString();

  return {
    ...project,
    visualizeState: {
      ...next,
      schemaVersion: 1,
      productionId: project.id,
      storyboardPanels: deduplicateById(
        next.storyboardPanels.map((p) => ({ ...p, productionId: project.id }))
      ),
      cameraSetups: deduplicateById(
        next.cameraSetups.map((c) => ({ ...c, productionId: project.id }))
      ),
      shots: deduplicateById(
        next.shots.map((s) => ({ ...s, productionId: project.id }))
      ),
      boards: deduplicateById(
        (next.boards || []).map((b: UnifiedBoardRecord) => ({ ...b, productionId: project.id }))
      ),
      lookbookBoards: deduplicateById(
        next.lookbookBoards.map((b) => ({ ...b, productionId: project.id }))
      ),
      moodBoards: deduplicateById(
        (next.moodBoards || []).map((mb) => ({ ...mb, productionId: project.id }))
      ),
      lookbooks: deduplicateById(
        (next.lookbooks || []).map((lb) => ({ ...lb, productionId: project.id }))
      ),
      referenceAssets: deduplicateById(
        next.referenceAssets.map((a) => ({ ...a, productionId: project.id }))
      ),
      updatedAt: now,
    },
    updatedAt: now,
  };
}

/** Relational resolvers enforcing non-duplication across workspaces */
export function resolveShotForPanel(
  panel: StoryboardPanelRecord,
  store: VisualizeProductionStore
): ShotPlanRecord | null {
  if (!panel.shotId) return null;
  return (
    store.shots.find(
      (s) => s.id === panel.shotId && s.productionId === panel.productionId
    ) || null
  );
}

export function resolveCameraSetupForShot(
  shot: ShotPlanRecord,
  store: VisualizeProductionStore
): CameraSetup | null {
  if (!shot.cameraSetupId) return null;
  return (
    store.cameraSetups.find(
      (c) => c.id === shot.cameraSetupId && c.productionId === shot.productionId
    ) || null
  );
}

export function resolveReferenceAssetsForIds(
  assetIds: string[],
  store: VisualizeProductionStore
): VisualReferenceAsset[] {
  if (!assetIds || assetIds.length === 0) return [];
  const map = new Map<string, VisualReferenceAsset>();
  store.referenceAssets.forEach((a) => map.set(a.id, a));
  const resolved: VisualReferenceAsset[] = [];
  for (const id of assetIds) {
    const asset = map.get(id);
    if (asset && asset.productionId === store.productionId) {
      resolved.push(asset);
    }
  }
  return resolved;
}

/** RBAC permission checks for Visualise workspaces */
export function canViewVisualizeWorkspace(role?: ProjectRole | null): boolean {
  if (!role) return false;
  return hasPermission(role, 'production:view_data');
}

export function canEditVisualizeWorkspace(role?: ProjectRole | null): boolean {
  if (!role) return false;
  return (
    hasPermission(role, 'production:edit_data') ||
    hasPermission(role, 'production:edit_dept_data')
  );
}

// ============================================================================
// Storyboards Workspace Helpers & Shared Media Library Persistence (Batch 1)
// ============================================================================

/**
 * Compresses an uploaded image file to a storage-efficient data URL while preserving aspect ratio.
 */
export function compressStoryboardImageFile(
  file: File,
  maxWidth = 960,
  maxHeight = 540
): Promise<{
  dataUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.onload = (ev) => {
      const rawUrl = (ev.target?.result as string) || '';
      if (!rawUrl) {
        reject(new Error('Empty image data returned.'));
        return;
      }

      // Preserve vector SVG cleanly without rasterizing
      if (file.type === 'image/svg+xml') {
        resolve({
          dataUrl: rawUrl,
          originalFilename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve({
          dataUrl: rawUrl,
          originalFilename: file.name,
          mimeType: file.type || 'image/jpeg',
          fileSizeBytes: file.size,
        });
      };
      img.onload = () => {
        let w = img.width || maxWidth;
        let h = img.height || maxHeight;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        if (h > maxHeight) {
          w = Math.round((w * maxHeight) / h);
          h = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: rawUrl,
            originalFilename: file.name,
            mimeType: file.type || 'image/jpeg',
            fileSizeBytes: file.size,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        resolve({
          dataUrl: compressed,
          originalFilename: file.name,
          mimeType: 'image/jpeg',
          fileSizeBytes: file.size,
        });
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

/** Returns storyboard panels for a canonical scene sorted cleanly by sortOrder */
export function getStoryboardPanelsForScene(
  store: VisualizeProductionStore,
  sceneId: string
): StoryboardPanelRecord[] {
  return store.storyboardPanels
    .filter((p) => p.sceneId === sceneId && p.productionId === store.productionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Returns panel counts keyed by canonical sceneId */
export function getStoryboardCountsByScene(
  store: VisualizeProductionStore
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of store.storyboardPanels) {
    if (p.productionId !== store.productionId) continue;
    counts.set(p.sceneId, (counts.get(p.sceneId) || 0) + 1);
  }
  return counts;
}

/** Re-numbers panelNumber ("1", "2", ...) and sortOrder sequentially for a scene */
export function reindexStoryboardPanelsForScene(
  panels: StoryboardPanelRecord[],
  productionId: string,
  sceneId: string,
  sceneNumber?: string
): StoryboardPanelRecord[] {
  const scenePanels = panels
    .filter((p) => p.productionId === productionId && p.sceneId === sceneId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const renumbered = new Map<string, { sortOrder: number; panelNumber: string }>();
  scenePanels.forEach((p, idx) => {
    renumbered.set(p.id, {
      sortOrder: idx + 1,
      panelNumber: String(idx + 1),
    });
  });

  return panels.map((p) => {
    const patch = renumbered.get(p.id);
    if (!patch) return p;
    return {
      ...p,
      sceneNumber: sceneNumber || p.sceneNumber,
      sortOrder: patch.sortOrder,
      panelNumber: patch.panelNumber,
    };
  });
}

export interface SharedReferenceAssetInput {
  originalFilename: string;
  thumbnailDataUrl: string;
  mimeType?: string;
  fileSizeBytes?: number;
  description?: string;
  tags?: string[];
  source?: string;
  attribution?: string;
  createdBy?: string;
  vaultAssetId?: string;
}

/**
 * Registers a reusable VisualReferenceAsset in the production's shared Reference Library
 * (or returns an existing matching asset without duplicating files).
 */
export function registerSharedReferenceAsset(
  project: FilmProject,
  input: SharedReferenceAssetInput
): { updatedProject: FilmProject; asset: VisualReferenceAsset } {
  const current = getProductionVisualizeStore(project);
  const existing = current.referenceAssets.find(
    (a) =>
      a.productionId === project.id &&
      ((a.thumbnailDataUrl && a.thumbnailDataUrl === input.thumbnailDataUrl) ||
        (a.originalFilename === input.originalFilename && a.fileSizeBytes === input.fileSizeBytes))
  );

  if (existing) {
    return { updatedProject: project, asset: existing };
  }

  const now = new Date().toISOString();
  const newId = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const asset: VisualReferenceAsset = {
    id: newId,
    productionId: project.id,
    storageProvider: 'vault-local',
    storageRef: `vault://visualize/${project.id}/${newId}`,
    originalFilename: input.originalFilename,
    mediaType: 'image',
    mimeType: input.mimeType || 'image/jpeg',
    fileSizeBytes: input.fileSizeBytes,
    thumbnailDataUrl: input.thumbnailDataUrl,
    description: input.description,
    tags: input.tags || ['storyboard'],
    source: input.source || 'Storyboards Upload',
    attribution: input.attribution,
    createdBy: input.createdBy,
    vaultAssetId: input.vaultAssetId,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    referenceAssets: [...cur.referenceAssets, asset],
  }));

  return { updatedProject, asset };
}

export interface CreateStoryboardPanelInput {
  scene: ParsedScene;
  screenplayVersionId: string;
  title?: string;
  shotSize?: ShotSizeCode;
  movement?: ShotMovementType;
  framingNotes?: string;
  actionNotes?: string;
  dialogueCue?: string;
  directorNotes?: string;
  primaryAssetId?: string;
  status?: StoryboardPanelRecord['status'];
}

export function createStoryboardPanel(
  project: FilmProject,
  input: CreateStoryboardPanelInput
): { updatedProject: FilmProject; panel: StoryboardPanelRecord } {
  const now = new Date().toISOString();
  const current = getProductionVisualizeStore(project);
  const existingScenePanels = getStoryboardPanelsForScene(current, input.scene.id);
  const nextOrder = existingScenePanels.length + 1;
  const panelId = `sbpanel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const passageRef = createPassageReference(input.scene, input.screenplayVersionId, {
    excerpt: input.dialogueCue || input.scene.actionSnippet || input.scene.synopsis,
  });

  const panel: StoryboardPanelRecord = {
    id: panelId,
    productionId: project.id,
    sceneId: input.scene.id,
    sceneNumber: input.scene.sceneNumber,
    passageRef,
    panelNumber: String(nextOrder),
    sortOrder: nextOrder,
    title: (input.title || '').trim() || `Panel ${nextOrder}`,
    shotSize: input.shotSize,
    movement: input.movement,
    framingNotes: input.framingNotes?.trim() || undefined,
    actionNotes: input.actionNotes?.trim() || undefined,
    dialogueCue: input.dialogueCue?.trim() || undefined,
    directorNotes: input.directorNotes?.trim() || undefined,
    referenceAssetIds: input.primaryAssetId ? [input.primaryAssetId] : [],
    primaryAssetId: input.primaryAssetId,
    status: input.status || 'draft',
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    storyboardPanels: reindexStoryboardPanelsForScene(
      [...cur.storyboardPanels, panel],
      project.id,
      input.scene.id,
      input.scene.sceneNumber
    ),
  }));

  return { updatedProject, panel };
}

export function updateStoryboardPanel(
  project: FilmProject,
  panelId: string,
  updates: Partial<
    Pick<
      StoryboardPanelRecord,
      | 'title'
      | 'shotSize'
      | 'movement'
      | 'framingNotes'
      | 'actionNotes'
      | 'dialogueCue'
      | 'directorNotes'
      | 'primaryAssetId'
      | 'referenceAssetIds'
      | 'passageRef'
      | 'status'
    >
  >
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    storyboardPanels: cur.storyboardPanels.map((panel) => {
      if (panel.id !== panelId || panel.productionId !== project.id) return panel;

      const nextPrimaryAssetId =
        updates.primaryAssetId !== undefined ? updates.primaryAssetId : panel.primaryAssetId;
      let nextAssetIds =
        updates.referenceAssetIds !== undefined
          ? [...updates.referenceAssetIds]
          : [...panel.referenceAssetIds];

      if (nextPrimaryAssetId && !nextAssetIds.includes(nextPrimaryAssetId)) {
        nextAssetIds = [nextPrimaryAssetId, ...nextAssetIds];
      } else if (updates.primaryAssetId === undefined && panel.primaryAssetId && updates.primaryAssetId !== panel.primaryAssetId) {
        // Unchanged
      }
      if (updates.primaryAssetId === undefined) {
        // keep as is
      } else if (!updates.primaryAssetId) {
        nextAssetIds = nextAssetIds.filter((id) => id !== panel.primaryAssetId);
      }

      return {
        ...panel,
        ...updates,
        primaryAssetId: nextPrimaryAssetId,
        referenceAssetIds: nextAssetIds,
        updatedAt: now,
      };
    }),
  }));
}

export function reorderStoryboardPanels(
  project: FilmProject,
  sceneId: string,
  sceneNumber: string,
  orderedPanelIds: string[]
): FilmProject {
  const orderIndex = new Map<string, number>();
  orderedPanelIds.forEach((id, idx) => orderIndex.set(id, idx + 1));

  return updateProductionVisualizeStore(project, (cur) => {
    const withUpdatedSort = cur.storyboardPanels.map((p) => {
      if (p.productionId !== project.id || p.sceneId !== sceneId) return p;
      const newOrder = orderIndex.get(p.id);
      return newOrder !== undefined ? { ...p, sortOrder: newOrder } : p;
    });

    return {
      ...cur,
      storyboardPanels: reindexStoryboardPanelsForScene(
        withUpdatedSort,
        project.id,
        sceneId,
        sceneNumber
      ),
    };
  });
}

export function deleteStoryboardPanel(
  project: FilmProject,
  panelId: string
): FilmProject {
  const current = getProductionVisualizeStore(project);
  const target = current.storyboardPanels.find(
    (p) => p.id === panelId && p.productionId === project.id
  );
  if (!target) return project;

  return updateProductionVisualizeStore(project, (cur) => {
    const remaining = cur.storyboardPanels.filter((p) => p.id !== panelId);
    return {
      ...cur,
      storyboardPanels: reindexStoryboardPanelsForScene(
        remaining,
        project.id,
        target.sceneId,
        target.sceneNumber
      ),
    };
  });
}

// ============================================================================
// Shot Lists & Camera Setups Domain Helpers (Batch 2)
// ============================================================================

export const VISUALIZE_SHOT_SIZE_OPTIONS: Array<{ value: ShotSizeCode; label: string }> = [
  { value: 'EWS', label: 'EWS — Extreme Wide Shot' },
  { value: 'WS', label: 'WS — Wide Shot' },
  { value: 'LS', label: 'LS — Long Shot' },
  { value: 'MLS', label: 'MLS — Medium Long Shot' },
  { value: 'MS', label: 'MS — Medium Shot' },
  { value: 'MCU', label: 'MCU — Medium Close-Up' },
  { value: 'CU', label: 'CU — Close-Up' },
  { value: 'ECU', label: 'ECU — Extreme Close-Up' },
  { value: 'OTS', label: 'OTS — Over the Shoulder' },
  { value: 'POV', label: 'POV — Point of View' },
  { value: 'INSERT', label: 'INSERT — Detail Insert' },
];

export const VISUALIZE_CAMERA_ANGLE_OPTIONS: ShotCameraAngle[] = [
  'Eye-Level',
  'Low Angle',
  'High Angle',
  'Dutch Angle',
  'Overhead',
];

export const VISUALIZE_MOVEMENT_OPTIONS: ShotMovementType[] = [
  'Static',
  'Pan',
  'Tilt',
  'Track',
  'Dolly',
  'Steadicam',
  'Handheld',
  'Crane',
];

export function resolveStoryboardPanelForShot(
  shot: ShotPlanRecord,
  store: VisualizeProductionStore
): StoryboardPanelRecord | null {
  if (!shot.storyboardPanelId) return null;
  return (
    store.storyboardPanels.find(
      (p) => p.id === shot.storyboardPanelId && p.productionId === shot.productionId
    ) || null
  );
}

export function getShotsForStoryboardPanel(
  store: VisualizeProductionStore,
  panelId: string
): ShotPlanRecord[] {
  return store.shots
    .filter((s) => s.productionId === store.productionId && s.storyboardPanelId === panelId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getShotsForScene(
  store: VisualizeProductionStore,
  sceneId: string
): ShotPlanRecord[] {
  return store.shots
    .filter((s) => s.productionId === store.productionId && s.sceneId === sceneId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getShotCountsByScene(
  store: VisualizeProductionStore
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shot of store.shots) {
    if (shot.productionId !== store.productionId) continue;
    counts.set(shot.sceneId, (counts.get(shot.sceneId) || 0) + 1);
  }
  return counts;
}

export function getShotsForCameraSetup(
  store: VisualizeProductionStore,
  setupId: string
): ShotPlanRecord[] {
  return store.shots
    .filter((s) => s.productionId === store.productionId && s.cameraSetupId === setupId)
    .sort((a, b) => {
      const numA = parseInt(a.sceneNumber, 10);
      const numB = parseInt(b.sceneNumber, 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) return numA - numB;
      if (a.sceneNumber !== b.sceneNumber) return a.sceneNumber.localeCompare(b.sceneNumber);
      return a.sortOrder - b.sortOrder;
    });
}

export function getUnresolvedSceneShots(
  store: VisualizeProductionStore,
  canonicalScenes: ParsedScene[]
): ShotPlanRecord[] {
  const validSceneIds = new Set(canonicalScenes.map((s) => s.id));
  return store.shots.filter(
    (shot) => shot.productionId === store.productionId && !validSceneIds.has(shot.sceneId)
  );
}

export function reindexShotsForScene(
  shots: ShotPlanRecord[],
  productionId: string,
  sceneId: string,
  sceneNumber: string
): ShotPlanRecord[] {
  const target = shots
    .filter((s) => s.productionId === productionId && s.sceneId === sceneId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const updatedMap = new Map<string, { sortOrder: number; shotNumber: string }>();
  target.forEach((s, idx) => {
    const num = idx + 1;
    updatedMap.set(s.id, { sortOrder: num, shotNumber: String(num) });
  });

  return shots.map((s) => {
    const patch = updatedMap.get(s.id);
    if (!patch) return s;
    return {
      ...s,
      sceneNumber,
      sortOrder: patch.sortOrder,
      shotNumber: patch.shotNumber,
    };
  });
}

export interface CreateShotInput {
  scene: ParsedScene;
  screenplayVersionId: string;
  description?: string;
  shotSize?: ShotSizeCode;
  cameraAngle?: ShotCameraAngle;
  movement?: ShotMovementType;
  focalLengthMm?: string;
  framingNotes?: string;
  cameraNotes?: string;
  linkedCharacters?: string[];
  cameraSetupId?: string;
  storyboardPanelId?: string;
  referenceAssetIds?: string[];
  status?: ShotPlanRecord['status'];
}

export function createShot(
  project: FilmProject,
  input: CreateShotInput
): { updatedProject: FilmProject; shot: ShotPlanRecord } {
  const now = new Date().toISOString();
  const current = getProductionVisualizeStore(project);
  const existingSceneShots = getShotsForScene(current, input.scene.id);
  const nextOrder = existingSceneShots.length + 1;
  const shotId = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const passageRef = createPassageReference(input.scene, input.screenplayVersionId, {
    excerpt: input.description?.trim() || input.scene.actionSnippet || input.scene.synopsis,
  });

  const validSetupId =
    input.cameraSetupId &&
    current.cameraSetups.some(
      (c) => c.id === input.cameraSetupId && c.productionId === project.id
    )
      ? input.cameraSetupId
      : undefined;

  const validPanelId =
    input.storyboardPanelId &&
    current.storyboardPanels.some(
      (p) => p.id === input.storyboardPanelId && p.productionId === project.id
    )
      ? input.storyboardPanelId
      : undefined;

  const shot: ShotPlanRecord = {
    id: shotId,
    productionId: project.id,
    sceneId: input.scene.id,
    sceneNumber: input.scene.sceneNumber,
    passageRef,
    cameraSetupId: validSetupId,
    storyboardPanelId: validPanelId,
    shotNumber: String(nextOrder),
    sortOrder: nextOrder,
    shotSize: input.shotSize,
    cameraAngle: input.cameraAngle,
    movement: input.movement,
    focalLengthMm: input.focalLengthMm?.trim() || undefined,
    framingNotes: input.framingNotes?.trim() || undefined,
    description:
      input.description?.trim() || `Shot ${nextOrder} — ${input.scene.slugline || 'Scene Beat'}`,
    cameraNotes: input.cameraNotes?.trim() || undefined,
    linkedCharacters: input.linkedCharacters?.length ? [...input.linkedCharacters] : undefined,
    referenceAssetIds: input.referenceAssetIds ? [...input.referenceAssetIds] : [],
    status: input.status || 'planned',
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    shots: reindexShotsForScene(
      [...cur.shots, shot],
      project.id,
      input.scene.id,
      input.scene.sceneNumber
    ),
  }));

  return { updatedProject, shot };
}

export function createShotFromStoryboardPanel(
  project: FilmProject,
  scene: ParsedScene,
  panel: StoryboardPanelRecord,
  screenplayVersionId: string
): { updatedProject: FilmProject; shot: ShotPlanRecord } {
  const combinedDescription =
    [panel.title, panel.actionNotes].filter(Boolean).join(' — ') ||
    `Beat from Panel ${panel.panelNumber}`;
  return createShot(project, {
    scene,
    screenplayVersionId,
    description: combinedDescription,
    shotSize: panel.shotSize,
    movement: panel.movement,
    framingNotes: panel.framingNotes,
    cameraNotes: panel.directorNotes,
    storyboardPanelId: panel.id,
    referenceAssetIds: panel.primaryAssetId ? [panel.primaryAssetId] : [],
    status: 'planned',
  });
}

export function updateShot(
  project: FilmProject,
  shotId: string,
  updates: Partial<
    Pick<
      ShotPlanRecord,
      | 'description'
      | 'shotSize'
      | 'cameraAngle'
      | 'movement'
      | 'focalLengthMm'
      | 'framingNotes'
      | 'cameraNotes'
      | 'equipmentNotes'
      | 'linkedCharacters'
      | 'cameraSetupId'
      | 'storyboardPanelId'
      | 'referenceAssetIds'
      | 'status'
    >
  >
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    shots: cur.shots.map((shot) => {
      if (shot.id !== shotId || shot.productionId !== project.id) return shot;

      const resolvedSetupId =
        updates.cameraSetupId !== undefined
          ? updates.cameraSetupId &&
            cur.cameraSetups.some(
              (c) => c.id === updates.cameraSetupId && c.productionId === project.id
            )
            ? updates.cameraSetupId
            : undefined
          : shot.cameraSetupId;

      const resolvedPanelId =
        updates.storyboardPanelId !== undefined
          ? updates.storyboardPanelId &&
            cur.storyboardPanels.some(
              (p) => p.id === updates.storyboardPanelId && p.productionId === project.id
            )
            ? updates.storyboardPanelId
            : undefined
          : shot.storyboardPanelId;

      return {
        ...shot,
        ...updates,
        description:
          updates.description !== undefined
            ? updates.description.trim() || shot.description
            : shot.description,
        focalLengthMm:
          updates.focalLengthMm !== undefined
            ? updates.focalLengthMm?.trim() || undefined
            : shot.focalLengthMm,
        framingNotes:
          updates.framingNotes !== undefined
            ? updates.framingNotes?.trim() || undefined
            : shot.framingNotes,
        cameraNotes:
          updates.cameraNotes !== undefined
            ? updates.cameraNotes?.trim() || undefined
            : shot.cameraNotes,
        cameraSetupId: resolvedSetupId,
        storyboardPanelId: resolvedPanelId,
        updatedAt: now,
      };
    }),
  }));
}

export function duplicateShot(
  project: FilmProject,
  shotId: string
): { updatedProject: FilmProject; duplicatedShot: ShotPlanRecord | null } {
  const current = getProductionVisualizeStore(project);
  const source = current.shots.find(
    (s) => s.id === shotId && s.productionId === project.id
  );
  if (!source) return { updatedProject: project, duplicatedShot: null };

  const now = new Date().toISOString();
  const newId = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const sceneShots = getShotsForScene(current, source.sceneId);
  const idx = sceneShots.findIndex((s) => s.id === source.id);
  const clone: ShotPlanRecord = {
    ...source,
    id: newId,
    description: `${source.description} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  const reorderedIds = sceneShots.map((s) => s.id);
  reorderedIds.splice(idx + 1, 0, newId);
  const orderMap = new Map<string, number>();
  reorderedIds.forEach((id, i) => orderMap.set(id, i + 1));

  const updatedProject = updateProductionVisualizeStore(project, (cur) => {
    const withClone = [...cur.shots, clone].map((s) => {
      if (s.productionId !== project.id || s.sceneId !== source.sceneId) return s;
      const ord = orderMap.get(s.id);
      return ord !== undefined ? { ...s, sortOrder: ord } : s;
    });

    return {
      ...cur,
      shots: reindexShotsForScene(withClone, project.id, source.sceneId, source.sceneNumber),
    };
  });

  const savedClone =
    getProductionVisualizeStore(updatedProject).shots.find((s) => s.id === newId) || null;
  return { updatedProject, duplicatedShot: savedClone };
}

export function reorderShotsInScene(
  project: FilmProject,
  sceneId: string,
  sceneNumber: string,
  orderedShotIds: string[]
): FilmProject {
  const orderIndex = new Map<string, number>();
  orderedShotIds.forEach((id, idx) => orderIndex.set(id, idx + 1));

  return updateProductionVisualizeStore(project, (cur) => {
    const updated = cur.shots.map((s) => {
      if (s.productionId !== project.id || s.sceneId !== sceneId) return s;
      const nextOrder = orderIndex.get(s.id);
      return nextOrder !== undefined ? { ...s, sortOrder: nextOrder } : s;
    });

    return {
      ...cur,
      shots: reindexShotsForScene(updated, project.id, sceneId, sceneNumber),
    };
  });
}

export function moveShotToScene(
  project: FilmProject,
  shotId: string,
  targetScene: ParsedScene,
  screenplayVersionId: string
): FilmProject {
  const current = getProductionVisualizeStore(project);
  const source = current.shots.find(
    (s) => s.id === shotId && s.productionId === project.id
  );
  if (!source || source.sceneId === targetScene.id) return project;

  const targetCount = getShotsForScene(current, targetScene.id).length;
  const now = new Date().toISOString();

  return updateProductionVisualizeStore(project, (cur) => {
    const moved = cur.shots.map((s) => {
      if (s.id !== shotId || s.productionId !== project.id) return s;
      // Clear storyboard link only if panel belonged to a different scene
      const linkedPanel = s.storyboardPanelId
        ? cur.storyboardPanels.find((p) => p.id === s.storyboardPanelId)
        : undefined;
      return {
        ...s,
        sceneId: targetScene.id,
        sceneNumber: targetScene.sceneNumber,
        passageRef: createPassageReference(targetScene, screenplayVersionId, {
          excerpt: s.description,
        }),
        storyboardPanelId:
          linkedPanel && linkedPanel.sceneId === targetScene.id ? s.storyboardPanelId : undefined,
        sortOrder: targetCount + 1,
        updatedAt: now,
      };
    });

    const afterSourceReindex = reindexShotsForScene(
      moved,
      project.id,
      source.sceneId,
      source.sceneNumber
    );
    return {
      ...cur,
      shots: reindexShotsForScene(
        afterSourceReindex,
        project.id,
        targetScene.id,
        targetScene.sceneNumber
      ),
    };
  });
}

export function deleteShot(project: FilmProject, shotId: string): FilmProject {
  const current = getProductionVisualizeStore(project);
  const target = current.shots.find(
    (s) => s.id === shotId && s.productionId === project.id
  );
  if (!target) return project;

  return updateProductionVisualizeStore(project, (cur) => {
    const remaining = cur.shots.filter((s) => s.id !== shotId);
    return {
      ...cur,
      shots: reindexShotsForScene(remaining, project.id, target.sceneId, target.sceneNumber),
    };
  });
}

export interface CreateCameraSetupInput {
  name: string;
  cameraBody?: string;
  lensSeries?: string;
  focalLengthMm?: string;
  aspectRatio?: string;
  frameRateFps?: number;
  supportRig?: string;
  placementNotes?: string;
  movementConfig?: string;
  notes?: string;
  referenceAssetIds?: string[];
}

export function createCameraSetup(
  project: FilmProject,
  input: CreateCameraSetupInput
): { updatedProject: FilmProject; setup: CameraSetup } {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Camera Setup requires a setup name or identifier.');
  }

  const now = new Date().toISOString();
  const setupId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const setup: CameraSetup = {
    id: setupId,
    productionId: project.id,
    name: cleanName,
    cameraBody: input.cameraBody?.trim() || undefined,
    lensSeries: input.lensSeries?.trim() || undefined,
    focalLengthMm: input.focalLengthMm?.trim() || undefined,
    aspectRatio: input.aspectRatio?.trim() || undefined,
    frameRateFps:
      typeof input.frameRateFps === 'number' && !Number.isNaN(input.frameRateFps)
        ? input.frameRateFps
        : undefined,
    supportRig: input.supportRig?.trim() || undefined,
    placementNotes: input.placementNotes?.trim() || undefined,
    movementConfig: input.movementConfig?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    referenceAssetIds: input.referenceAssetIds?.length ? input.referenceAssetIds : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    cameraSetups: [...cur.cameraSetups, setup],
  }));

  return { updatedProject, setup };
}

export function updateCameraSetup(
  project: FilmProject,
  setupId: string,
  updates: Partial<Omit<CameraSetup, 'id' | 'productionId' | 'createdAt' | 'updatedAt'>>
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    cameraSetups: cur.cameraSetups.map((setup) => {
      if (setup.id !== setupId || setup.productionId !== project.id) return setup;
      const nextName =
        updates.name !== undefined ? updates.name.trim() || setup.name : setup.name;
      return {
        ...setup,
        ...updates,
        name: nextName,
        cameraBody:
          updates.cameraBody !== undefined
            ? updates.cameraBody?.trim() || undefined
            : setup.cameraBody,
        lensSeries:
          updates.lensSeries !== undefined
            ? updates.lensSeries?.trim() || undefined
            : setup.lensSeries,
        focalLengthMm:
          updates.focalLengthMm !== undefined
            ? updates.focalLengthMm?.trim() || undefined
            : setup.focalLengthMm,
        supportRig:
          updates.supportRig !== undefined
            ? updates.supportRig?.trim() || undefined
            : setup.supportRig,
        placementNotes:
          updates.placementNotes !== undefined
            ? updates.placementNotes?.trim() || undefined
            : setup.placementNotes,
        movementConfig:
          updates.movementConfig !== undefined
            ? updates.movementConfig?.trim() || undefined
            : setup.movementConfig,
        notes:
          updates.notes !== undefined ? updates.notes?.trim() || undefined : setup.notes,
        updatedAt: now,
      };
    }),
  }));
}

export function deleteCameraSetup(project: FilmProject, setupId: string): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    cameraSetups: cur.cameraSetups.filter(
      (c) => !(c.id === setupId && c.productionId === project.id)
    ),
    // Safely unlink referencing shots without deleting the shot records
    shots: cur.shots.map((shot) =>
      shot.productionId === project.id && shot.cameraSetupId === setupId
        ? { ...shot, cameraSetupId: undefined, updatedAt: now }
        : shot
    ),
  }));
}

export function assignCameraSetupToShots(
  project: FilmProject,
  setupId: string,
  shotIds: string[]
): FilmProject {
  const current = getProductionVisualizeStore(project);
  const setupExists = current.cameraSetups.some(
    (c) => c.id === setupId && c.productionId === project.id
  );
  if (!setupExists || shotIds.length === 0) return project;

  const targetIds = new Set(shotIds);
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    shots: cur.shots.map((shot) =>
      shot.productionId === project.id && targetIds.has(shot.id)
        ? { ...shot, cameraSetupId: setupId, updatedAt: now }
        : shot
    ),
  }));
}

export function removeShotCameraSetupAssociation(
  project: FilmProject,
  shotId: string
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    shots: cur.shots.map((shot) =>
      shot.id === shotId && shot.productionId === project.id
        ? { ...shot, cameraSetupId: undefined, updatedAt: now }
        : shot
    ),
  }));
}

// ============================================================================
// Lookbooks & Mood Boards Domain Helpers (Batch 3)
// ============================================================================

export const MOODBOARD_THEME_SUGGESTIONS: string[] = [
  'Cinematography',
  'Lighting',
  'Colour Palette',
  'Production Design',
  'Costume',
  'Locations',
  'Atmosphere',
];

export const LOOKBOOK_DEPARTMENT_SUGGESTIONS: string[] = [
  'Director Vision',
  'Cinematography',
  'Production Design',
  'Costume & Wardrobe',
  'Locations',
  'Lighting & Grip',
  'Visual Effects',
];

function reindexOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return items.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
}

export interface CreateMoodBoardInput {
  title: string;
  description?: string;
  theme?: string;
  notes?: string;
  linkedSceneIds?: string[];
}

export function createMoodBoard(
  project: FilmProject,
  input: CreateMoodBoardInput
): { updatedProject: FilmProject; board: MoodBoardRecord } {
  const cleanTitle = input.title.trim() || 'Untitled Mood Board';
  const now = new Date().toISOString();
  const current = getProductionVisualizeStore(project);
  const existingBoards = current.moodBoards || [];
  const boardId = `mb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const board: MoodBoardRecord = {
    id: boardId,
    productionId: project.id,
    title: cleanTitle,
    description: input.description?.trim() || undefined,
    theme: input.theme?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    linkedSceneIds: input.linkedSceneIds ? [...input.linkedSceneIds] : [],
    items: [],
    sortOrder: existingBoards.length + 1,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    moodBoards: [...(cur.moodBoards || []), board],
  }));

  return { updatedProject, board };
}

export function updateMoodBoard(
  project: FilmProject,
  boardId: string,
  updates: Partial<
    Pick<MoodBoardRecord, 'title' | 'description' | 'theme' | 'notes' | 'linkedSceneIds'>
  >
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    moodBoards: (cur.moodBoards || []).map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      return {
        ...board,
        ...updates,
        title:
          updates.title !== undefined
            ? updates.title.trim() || board.title
            : board.title,
        description:
          updates.description !== undefined
            ? updates.description?.trim() || undefined
            : board.description,
        theme:
          updates.theme !== undefined ? updates.theme?.trim() || undefined : board.theme,
        notes:
          updates.notes !== undefined ? updates.notes?.trim() || undefined : board.notes,
        updatedAt: now,
      };
    }),
  }));
}

export function deleteMoodBoard(project: FilmProject, boardId: string): FilmProject {
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    moodBoards: reindexOrder(
      (cur.moodBoards || []).filter(
        (b) => !(b.id === boardId && b.productionId === project.id)
      )
    ),
  }));
}

export function addAssetToMoodBoard(
  project: FilmProject,
  boardId: string,
  assetId: string,
  options?: {
    caption?: string;
    note?: string;
    tileSize?: MoodBoardTileSize;
    linkedPanelId?: string;
    linkedShotId?: string;
  }
): FilmProject {
  const current = getProductionVisualizeStore(project);
  const assetExists = current.referenceAssets.some(
    (a) => a.id === assetId && a.productionId === project.id
  );
  if (!assetExists) return project;

  const now = new Date().toISOString();
  const itemId = `mbitem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    moodBoards: (cur.moodBoards || []).map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      const nextItem: MoodBoardItemRecord = {
        id: itemId,
        assetId,
        caption: options?.caption?.trim() || undefined,
        note: options?.note?.trim() || undefined,
        tileSize: options?.tileSize || 'medium',
        linkedPanelId: options?.linkedPanelId,
        linkedShotId: options?.linkedShotId,
        sortOrder: board.items.length + 1,
      };
      return {
        ...board,
        items: reindexOrder([...board.items, nextItem]),
        updatedAt: now,
      };
    }),
  }));
}

export function updateMoodBoardItem(
  project: FilmProject,
  boardId: string,
  itemId: string,
  updates: Partial<
    Pick<MoodBoardItemRecord, 'caption' | 'note' | 'tileSize' | 'linkedPanelId' | 'linkedShotId'>
  >
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    moodBoards: (cur.moodBoards || []).map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      return {
        ...board,
        items: board.items.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            ...updates,
            caption:
              updates.caption !== undefined
                ? updates.caption?.trim() || undefined
                : item.caption,
            note:
              updates.note !== undefined ? updates.note?.trim() || undefined : item.note,
          };
        }),
        updatedAt: now,
      };
    }),
  }));
}

export function reorderMoodBoardItems(
  project: FilmProject,
  boardId: string,
  orderedItemIds: string[]
): FilmProject {
  const indexMap = new Map<string, number>();
  orderedItemIds.forEach((id, idx) => indexMap.set(id, idx + 1));
  const now = new Date().toISOString();

  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    moodBoards: (cur.moodBoards || []).map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      const sorted = [...board.items]
        .sort(
          (a, b) =>
            (indexMap.get(a.id) ?? a.sortOrder) - (indexMap.get(b.id) ?? b.sortOrder)
        );
      return {
        ...board,
        items: reindexOrder(sorted),
        updatedAt: now,
      };
    }),
  }));
}

/**
 * Removes an image association from a Mood Board WITHOUT deleting the underlying shared VisualReferenceAsset.
 */
export function removeMoodBoardItem(
  project: FilmProject,
  boardId: string,
  itemId: string
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    moodBoards: (cur.moodBoards || []).map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      return {
        ...board,
        items: reindexOrder(board.items.filter((i) => i.id !== itemId)),
        updatedAt: now,
      };
    }),
  }));
}

// --- Lookbooks (Curated Structured Presentations) ---

export interface CreateLookbookInput {
  title: string;
  description?: string;
  department?: string;
  linkedSceneIds?: string[];
  coverAssetId?: string;
  status?: LookbookRecord['status'];
}

export function createLookbook(
  project: FilmProject,
  input: CreateLookbookInput
): { updatedProject: FilmProject; lookbook: LookbookRecord } {
  const cleanTitle = input.title.trim() || 'Untitled Lookbook';
  const now = new Date().toISOString();
  const current = getProductionVisualizeStore(project);
  const existing = current.lookbooks || [];
  const lookbookId = `lb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const validCoverId =
    input.coverAssetId &&
    current.referenceAssets.some(
      (a) => a.id === input.coverAssetId && a.productionId === project.id
    )
      ? input.coverAssetId
      : undefined;

  const lookbook: LookbookRecord = {
    id: lookbookId,
    productionId: project.id,
    title: cleanTitle,
    description: input.description?.trim() || undefined,
    department: input.department?.trim() || undefined,
    linkedSceneIds: input.linkedSceneIds ? [...input.linkedSceneIds] : [],
    coverAssetId: validCoverId,
    status: input.status || 'draft',
    sections: [],
    sortOrder: existing.length + 1,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: [...(cur.lookbooks || []), lookbook],
  }));

  return { updatedProject, lookbook };
}

export function updateLookbook(
  project: FilmProject,
  lookbookId: string,
  updates: Partial<
    Pick<
      LookbookRecord,
      'title' | 'description' | 'department' | 'linkedSceneIds' | 'coverAssetId' | 'status'
    >
  >
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      return {
        ...lb,
        ...updates,
        title:
          updates.title !== undefined ? updates.title.trim() || lb.title : lb.title,
        description:
          updates.description !== undefined
            ? updates.description?.trim() || undefined
            : lb.description,
        department:
          updates.department !== undefined
            ? updates.department?.trim() || undefined
            : lb.department,
        updatedAt: now,
      };
    }),
  }));
}

export function deleteLookbook(project: FilmProject, lookbookId: string): FilmProject {
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: reindexOrder(
      (cur.lookbooks || []).filter(
        (lb) => !(lb.id === lookbookId && lb.productionId === project.id)
      )
    ),
  }));
}

export function addLookbookSection(
  project: FilmProject,
  lookbookId: string,
  input: { title: string; summary?: string; creativeNotes?: string }
): { updatedProject: FilmProject; section: LookbookSectionRecord | null } {
  const sectionId = `lbsec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  let created: LookbookSectionRecord | null = null;

  const updatedProject = updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      created = {
        id: sectionId,
        title: input.title.trim() || `Section ${lb.sections.length + 1}`,
        summary: input.summary?.trim() || undefined,
        creativeNotes: input.creativeNotes?.trim() || undefined,
        items: [],
        sortOrder: lb.sections.length + 1,
      };
      return {
        ...lb,
        sections: reindexOrder([...lb.sections, created]),
        updatedAt: now,
      };
    }),
  }));

  return { updatedProject, section: created };
}

export function updateLookbookSection(
  project: FilmProject,
  lookbookId: string,
  sectionId: string,
  updates: Partial<Pick<LookbookSectionRecord, 'title' | 'summary' | 'creativeNotes'>>
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      return {
        ...lb,
        sections: lb.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          return {
            ...sec,
            ...updates,
            title:
              updates.title !== undefined ? updates.title.trim() || sec.title : sec.title,
            summary:
              updates.summary !== undefined
                ? updates.summary?.trim() || undefined
                : sec.summary,
            creativeNotes:
              updates.creativeNotes !== undefined
                ? updates.creativeNotes?.trim() || undefined
                : sec.creativeNotes,
          };
        }),
        updatedAt: now,
      };
    }),
  }));
}

export function reorderLookbookSections(
  project: FilmProject,
  lookbookId: string,
  orderedSectionIds: string[]
): FilmProject {
  const indexMap = new Map<string, number>();
  orderedSectionIds.forEach((id, idx) => indexMap.set(id, idx + 1));
  const now = new Date().toISOString();

  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      const sorted = [...lb.sections].sort(
        (a, b) =>
          (indexMap.get(a.id) ?? a.sortOrder) - (indexMap.get(b.id) ?? b.sortOrder)
      );
      return {
        ...lb,
        sections: reindexOrder(sorted),
        updatedAt: now,
      };
    }),
  }));
}

export function deleteLookbookSection(
  project: FilmProject,
  lookbookId: string,
  sectionId: string
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      return {
        ...lb,
        sections: reindexOrder(lb.sections.filter((sec) => sec.id !== sectionId)),
        updatedAt: now,
      };
    }),
  }));
}

export function addAssetToLookbookSection(
  project: FilmProject,
  lookbookId: string,
  sectionId: string,
  assetId: string,
  options?: { caption?: string; note?: string; linkedPanelId?: string; linkedShotId?: string }
): FilmProject {
  const current = getProductionVisualizeStore(project);
  const assetExists = current.referenceAssets.some(
    (a) => a.id === assetId && a.productionId === project.id
  );
  if (!assetExists) return project;

  const itemId = `lbitem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      return {
        ...lb,
        sections: lb.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          const nextItem: LookbookSectionItemRecord = {
            id: itemId,
            assetId,
            caption: options?.caption?.trim() || undefined,
            note: options?.note?.trim() || undefined,
            linkedPanelId: options?.linkedPanelId,
            linkedShotId: options?.linkedShotId,
            sortOrder: sec.items.length + 1,
          };
          return {
            ...sec,
            items: reindexOrder([...sec.items, nextItem]),
          };
        }),
        updatedAt: now,
      };
    }),
  }));
}

export function updateLookbookSectionItem(
  project: FilmProject,
  lookbookId: string,
  sectionId: string,
  itemId: string,
  updates: Partial<
    Pick<LookbookSectionItemRecord, 'caption' | 'note' | 'linkedPanelId' | 'linkedShotId'>
  >
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      return {
        ...lb,
        sections: lb.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          return {
            ...sec,
            items: sec.items.map((item) => {
              if (item.id !== itemId) return item;
              return {
                ...item,
                ...updates,
                caption:
                  updates.caption !== undefined
                    ? updates.caption?.trim() || undefined
                    : item.caption,
                note:
                  updates.note !== undefined ? updates.note?.trim() || undefined : item.note,
              };
            }),
          };
        }),
        updatedAt: now,
      };
    }),
  }));
}

export function reorderLookbookSectionItems(
  project: FilmProject,
  lookbookId: string,
  sectionId: string,
  orderedItemIds: string[]
): FilmProject {
  const indexMap = new Map<string, number>();
  orderedItemIds.forEach((id, idx) => indexMap.set(id, idx + 1));
  const now = new Date().toISOString();

  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      return {
        ...lb,
        sections: lb.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          const sorted = [...sec.items].sort(
            (a, b) =>
              (indexMap.get(a.id) ?? a.sortOrder) - (indexMap.get(b.id) ?? b.sortOrder)
          );
          return {
            ...sec,
            items: reindexOrder(sorted),
          };
        }),
        updatedAt: now,
      };
    }),
  }));
}

/**
 * Removes an image association from a Lookbook section WITHOUT deleting the underlying shared VisualReferenceAsset.
 */
export function removeLookbookSectionItem(
  project: FilmProject,
  lookbookId: string,
  sectionId: string,
  itemId: string
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    lookbooks: (cur.lookbooks || []).map((lb) => {
      if (lb.id !== lookbookId || lb.productionId !== project.id) return lb;
      return {
        ...lb,
        sections: lb.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          return {
            ...sec,
            items: reindexOrder(sec.items.filter((i) => i.id !== itemId)),
          };
        }),
        updatedAt: now,
      };
    }),
  }));
}
