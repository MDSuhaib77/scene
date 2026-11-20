export type VaultCategory = 'images' | 'video' | 'audio' | 'graphics';

export type VaultProductionStatus =
  | 'Raw'
  | 'Unedited'
  | 'In Progress'
  | 'Edited'
  | 'Unfinished'
  | 'Dubbing Needed'
  | 'Dubbing In Progress'
  | 'Dubbing Done'
  | 'Final';

export const VAULT_PRODUCTION_STATUSES: readonly VaultProductionStatus[] = [
  'Raw',
  'Unedited',
  'In Progress',
  'Edited',
  'Unfinished',
  'Dubbing Needed',
  'Dubbing In Progress',
  'Dubbing Done',
  'Final',
] as const;

export const VAULT_IMAGE_STATUSES: readonly VaultProductionStatus[] = [
  'Raw',
  'In Progress',
  'Edited',
  'Unfinished',
  'Final',
] as const;

export const VAULT_AUDIO_STATUSES: readonly VaultProductionStatus[] = [
  'Raw',
  'Unedited',
  'In Progress',
  'Unfinished',
  'Dubbing Needed',
  'Dubbing In Progress',
  'Dubbing Done',
  'Final',
] as const;

export const VAULT_VIDEO_STATUSES: readonly VaultProductionStatus[] = [
  'Raw',
  'Unedited',
  'In Progress',
  'Unfinished',
  'Edited',
  'Dubbing Needed',
  'Dubbing In Progress',
  'Dubbing Done',
  'Final',
] as const;

export const VAULT_STATUSES_BY_CATEGORY: Record<
  VaultCategory,
  readonly VaultProductionStatus[]
> = {
  images: VAULT_IMAGE_STATUSES,
  graphics: VAULT_IMAGE_STATUSES,
  audio: VAULT_AUDIO_STATUSES,
  video: VAULT_VIDEO_STATUSES,
};

export function getStatusesForVaultCategory(
  category: VaultCategory | 'all'
): readonly VaultProductionStatus[] {
  if (category === 'all') return VAULT_PRODUCTION_STATUSES;
  return VAULT_STATUSES_BY_CATEGORY[category];
}

export function coerceStatusForVaultCategory(
  category: VaultCategory,
  status: VaultProductionStatus
): VaultProductionStatus {
  const allowed = VAULT_STATUSES_BY_CATEGORY[category];
  return allowed.includes(status) ? status : 'Raw';
}

export type MediaPlaybackCompatibility = 'native' | 'uncertain' | 'unsupported';

export interface VaultAssetRecord {
  id: string;
  productionId: string;
  category: VaultCategory;
  name: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  description?: string;
  tags: string[];
  productionStatus: VaultProductionStatus;
  /** Audio/video duration in seconds (measured during non-blocking metadata probe) */
  durationSeconds?: number;
  /** Image/graphic intrinsic width and height to preserve natural aspect ratio */
  width?: number;
  height?: number;
  /** Sniffed container label (e.g. WAV, MP3, WebM, MOV, MKV, FLAC) */
  detectedContainer?: string;
  /** Browser native playback assessment captured during upload (honest support signal) */
  playbackSupport?: MediaPlaybackCompatibility;
  /** Lightweight compressed data URL thumbnail (never used to store video/audio payloads) */
  thumbnailDataUrl?: string;
  storageProvider: 'vault-idb' | 'vault-local' | 'external-url';
  /** IndexedDB object key or URI */
  storageKey?: string;
  externalUrl?: string;
  /** Direct 1:1 link to VisualReferenceAsset.id so Visualise never duplicates Vault uploads */
  sharedReferenceAssetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultProductionStore {
  schemaVersion: 1;
  productionId: string;
  assets: VaultAssetRecord[];
  updatedAt: string;
}
