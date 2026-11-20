/**
 * SceneOS — Visualise Domain Architecture & Shared Relationship Contracts (Batch 0)
 *
 * Establishes normalized, production-scoped data contracts for the three primary
 * Visualise workspaces and the shared Visual Reference Library:
 *   1. Storyboards (StoryboardPanelRecord)
 *   2. Shot Lists & Camera Setups (ShotPlanRecord + CameraSetup)
 *   3. Boards (UnifiedBoardRecord — consolidating Mood Boards & Lookbooks)
 *   Shared Infrastructure: VisualReferenceAsset + ScreenplayPassageReference
 */

export type VisualizeWorkspaceId = 'storyboards' | 'shot-lists' | 'boards';

export interface ScreenplayPassageReference {
  /** References ScreenplayVersion.id */
  screenplayVersionId: string;
  /** Stable ParsedScene.id */
  sceneId: string;
  sceneNumber: string;
  sceneSlugline: string;
  excerpt?: string;
  sourceLineNumber?: number;
  sourcePos?: number;
  endPos?: number;
  elementId?: string;
}

export type VisualReferenceMediaType = 'image' | 'video' | 'pdf' | 'other';

export interface VisualReferenceAsset {
  id: string;
  productionId: string;
  storageProvider: 'vault-local' | 'supabase-storage' | 'external-url';
  /** Underlying storage key / Vault URI / signed asset path (never duplicated across links) */
  storageRef: string;
  /** Optional foreign reference to existing Media Vault record (StoryboardRevision or FootageBackup ID) */
  vaultAssetId?: string;
  originalFilename: string;
  mediaType: VisualReferenceMediaType;
  mimeType?: string;
  fileSizeBytes?: number;
  thumbnailDataUrl?: string;
  description?: string;
  tags: string[];
  source?: string;
  attribution?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CameraSetup {
  id: string;
  productionId: string;
  name: string;
  cameraBody?: string;
  lensSeries?: string;
  focalLengthMm?: string;
  aspectRatio?: string;
  frameRateFps?: number;
  supportRig?: string;
  placementNotes?: string;
  movementConfig?: string;
  lightingSetupNotes?: string;
  notes?: string;
  referenceAssetIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ShotSizeCode =
  | 'ECU'
  | 'CU'
  | 'MCU'
  | 'MS'
  | 'MLS'
  | 'LS'
  | 'WS'
  | 'EWS'
  | 'OTS'
  | 'POV'
  | 'INSERT';

export type ShotCameraAngle =
  | 'Eye-Level'
  | 'Low Angle'
  | 'High Angle'
  | 'Dutch Angle'
  | 'Overhead';

export type ShotMovementType =
  | 'Static'
  | 'Pan'
  | 'Tilt'
  | 'Track'
  | 'Dolly'
  | 'Steadicam'
  | 'Handheld'
  | 'Crane';

export interface ShotPlanRecord {
  id: string;
  productionId: string;
  /** Canonical ParsedScene.id (never duplicates canonical scene data) */
  sceneId: string;
  sceneNumber: string;
  passageRef?: ScreenplayPassageReference;
  /** References shared CameraSetup.id without duplicating physical setup specs */
  cameraSetupId?: string;
  /** Optional FK referencing StoryboardPanelRecord.id without duplicating panels */
  storyboardPanelId?: string;
  shotNumber: string;
  sortOrder: number;
  shotSize?: ShotSizeCode;
  cameraAngle?: ShotCameraAngle;
  movement?: ShotMovementType;
  focalLengthMm?: string;
  framingNotes?: string;
  description: string;
  cameraNotes?: string;
  equipmentNotes?: string;
  linkedCharacters?: string[];
  estimatedSetupMinutes?: number;
  /** References VisualReferenceAsset.id entries without duplicating files */
  referenceAssetIds: string[];
  status: 'planned' | 'ready' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardPanelRecord {
  id: string;
  productionId: string;
  /** Canonical ParsedScene.id */
  sceneId: string;
  sceneNumber: string;
  /** Optional FK to ShotPlanRecord.id — links without duplicating shot records */
  shotId?: string;
  passageRef?: ScreenplayPassageReference;
  panelNumber: string;
  sortOrder: number;
  title: string;
  shotSize?: ShotSizeCode;
  movement?: ShotMovementType;
  framingNotes?: string;
  actionNotes?: string;
  dialogueCue?: string;
  directorNotes?: string;
  aspectRatio?: string;
  /** Ordered VisualReferenceAsset.id links without duplicating media */
  referenceAssetIds: string[];
  primaryAssetId?: string;
  status: 'draft' | 'in-review' | 'approved';
  createdAt: string;
  updatedAt: string;
}

export type MoodBoardTileSize = 'compact' | 'medium' | 'wide' | 'feature';

export interface MoodBoardItemRecord {
  id: string;
  /** FK referencing shared VisualReferenceAsset.id without duplicating image storage */
  assetId: string;
  caption?: string;
  note?: string;
  tileSize?: MoodBoardTileSize;
  /** Optional non-destructive cross-links to existing storyboard panels or shots */
  linkedPanelId?: string;
  linkedShotId?: string;
  sortOrder: number;
}

export interface MoodBoardRecord {
  id: string;
  productionId: string;
  title: string;
  description?: string;
  theme?: string;
  notes?: string;
  /** Optional canonical ParsedScene.id references */
  linkedSceneIds: string[];
  items: MoodBoardItemRecord[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LookbookSectionItemRecord {
  id: string;
  /** FK referencing shared VisualReferenceAsset.id without duplicating image storage */
  assetId: string;
  caption?: string;
  note?: string;
  linkedPanelId?: string;
  linkedShotId?: string;
  sortOrder: number;
}

export interface LookbookSectionRecord {
  id: string;
  title: string;
  summary?: string;
  creativeNotes?: string;
  items: LookbookSectionItemRecord[];
  sortOrder: number;
}

export interface LookbookRecord {
  id: string;
  productionId: string;
  title: string;
  description?: string;
  department?: string;
  /** Optional canonical ParsedScene.id references */
  linkedSceneIds: string[];
  /** Optional cover image referencing shared VisualReferenceAsset.id */
  coverAssetId?: string;
  status: 'draft' | 'published';
  sections: LookbookSectionRecord[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LookbookBoardRecord {
  id: string;
  productionId: string;
  title: string;
  description?: string;
  theme?: string;
  department?: string;
  /** Optional canonical ParsedScene.id references */
  linkedSceneIds: string[];
  /** References shared VisualReferenceAsset.id entries without duplicating files */
  referenceAssetIds: string[];
  colorPaletteHex?: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type BoardCanvasItemKind = 'image' | 'heading' | 'note';
export type BoardBorderStyle = 'none' | 'subtle' | 'solid' | 'frame';
export type BoardArrangementPreset = 'freeform' | 'side-by-side' | 'vertical' | 'grid';

export interface BoardSectionRecord {
  id: string;
  title: string;
  summary?: string;
  sortOrder: number;
}

export interface BoardCanvasItem {
  id: string;
  kind: BoardCanvasItemKind;
  /** Optional grouping section inside a unified board */
  sectionId?: string;
  /** FK to shared VisualReferenceAsset.id (present when kind === 'image', never duplicates Vault payload) */
  assetId?: string;
  /** Caption or label shown on image item, or content for heading/note */
  text?: string;
  note?: string;
  /** Freeform canvas coordinates (px) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stacking layer order (higher renders in front) */
  zIndex: number;
  /** Preserve natural image ratio during corner resizing */
  lockAspectRatio?: boolean;
  naturalAspectRatio?: number;
  /** Optional per-item border override */
  borderStyle?: BoardBorderStyle;
  borderWidthPx?: number;
  borderColor?: string;
  /** Optional cross-links to canonical Storyboard Panel or Shot Plan */
  linkedPanelId?: string;
  linkedShotId?: string;
}

export interface UnifiedBoardRecord {
  id: string;
  productionId: string;
  title: string;
  description?: string;
  categoryTag?: string;
  department?: string;
  status: 'active' | 'archived' | 'published';
  /** Preserves lineage when consolidated non-destructively from Batch 3 Mood Boards / Lookbooks */
  sourceLegacyKind?: 'mood-board' | 'lookbook' | 'lookbook-board';
  sourceLegacyId?: string;
  /** Optional canonical ParsedScene.id links */
  linkedSceneIds: string[];
  sections: BoardSectionRecord[];
  items: BoardCanvasItem[];
  /** Board-wide canvas spacing & framing configuration persisted across reloads */
  spacingPx: number;
  borderEnabled: boolean;
  borderWidthPx: number;
  borderColor: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisualizeProductionStore {
  schemaVersion: 1;
  productionId: string;
  storyboardPanels: StoryboardPanelRecord[];
  cameraSetups: CameraSetup[];
  shots: ShotPlanRecord[];
  /** Unified Boards store (Batch 4 consolidating Mood Boards & Lookbooks) */
  boards?: UnifiedBoardRecord[];
  /** Legacy arrays retained non-destructively for backward compatibility */
  lookbookBoards: LookbookBoardRecord[];
  moodBoards?: MoodBoardRecord[];
  lookbooks?: LookbookRecord[];
  referenceAssets: VisualReferenceAsset[];
  updatedAt: string;
}

export interface VisualizeWorkspaceMeta {
  id: VisualizeWorkspaceId;
  name: string;
  shortLabel: string;
  purpose: string;
}
