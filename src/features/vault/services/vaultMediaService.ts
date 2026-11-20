import type { FilmProject } from '../../../types';
import type { VisualReferenceAsset } from '../../visualize/types';
import {
  compressStoryboardImageFile,
  registerSharedReferenceAsset,
  updateProductionVisualizeStore,
} from '../../visualize/services/visualizeFoundationService';
import type {
  MediaPlaybackCompatibility,
  VaultAssetRecord,
  VaultCategory,
  VaultProductionStatus,
  VaultProductionStore,
} from '../types';
import { coerceStatusForVaultCategory } from '../types';
import {
  deleteVaultMediaBlob,
  saveVaultMediaBlob,
} from './vaultStorageService';

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

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '--:--';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const SUPPORTED_AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'aac',
  'm4a',
  'ogg',
  'oga',
  'opus',
  'flac',
  'aiff',
  'aif',
  'weba',
] as const;

export const SUPPORTED_VIDEO_EXTENSIONS = [
  'mp4',
  'm4v',
  'webm',
  'mov',
  'mkv',
  'avi',
  'ogv',
] as const;

const EXTENSION_MIME_DEFAULTS: Record<string, { category: VaultCategory; mime: string; container: string }> = {
  mp3: { category: 'audio', mime: 'audio/mpeg', container: 'MP3' },
  wav: { category: 'audio', mime: 'audio/wav', container: 'WAV' },
  aac: { category: 'audio', mime: 'audio/aac', container: 'AAC' },
  m4a: { category: 'audio', mime: 'audio/mp4', container: 'M4A (MP4 Audio)' },
  ogg: { category: 'audio', mime: 'audio/ogg', container: 'OGG' },
  oga: { category: 'audio', mime: 'audio/ogg', container: 'OGG' },
  opus: { category: 'audio', mime: 'audio/ogg; codecs=opus', container: 'Opus' },
  flac: { category: 'audio', mime: 'audio/flac', container: 'FLAC' },
  aiff: { category: 'audio', mime: 'audio/aiff', container: 'AIFF' },
  aif: { category: 'audio', mime: 'audio/aiff', container: 'AIFF' },
  weba: { category: 'audio', mime: 'audio/webm', container: 'WebM Audio' },
  mp4: { category: 'video', mime: 'video/mp4', container: 'MP4' },
  m4v: { category: 'video', mime: 'video/mp4', container: 'MP4 / M4V' },
  webm: { category: 'video', mime: 'video/webm', container: 'WebM' },
  mov: { category: 'video', mime: 'video/quicktime', container: 'QuickTime MOV' },
  mkv: { category: 'video', mime: 'video/x-matroska', container: 'Matroska MKV' },
  avi: { category: 'video', mime: 'video/x-msvideo', container: 'AVI' },
  ogv: { category: 'video', mime: 'video/ogg', container: 'Ogg Video' },
};

export interface DetectedMediaInspection {
  category: VaultCategory | null;
  mimeType: string;
  detectedContainer?: string;
  playbackSupport: MediaPlaybackCompatibility;
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return '';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

/**
 * Assesses native browser decodability via HTMLMediaElement.canPlayType without converting files.
 */
export function probeBrowserPlaybackCompatibility(
  kind: 'audio' | 'video',
  mimeType: string
): MediaPlaybackCompatibility {
  if (typeof document === 'undefined') return 'uncertain';
  try {
    const el = document.createElement(kind);
    if (!el || typeof el.canPlayType !== 'function') return 'uncertain';
    const raw = mimeType.split(';')[0].trim().toLowerCase();
    const fullCheck = el.canPlayType(mimeType);
    const baseCheck = el.canPlayType(raw);
    const res = fullCheck || baseCheck;
    if (res === 'probably') return 'native';
    if (res === 'maybe') {
      // Browsers often return '' or 'maybe' for AIFF, AVI, MKV, QuickTime depending on codecs
      if (raw === 'audio/aiff' || raw === 'audio/x-aiff' || raw === 'video/x-msvideo') {
        return 'uncertain';
      }
      return 'native';
    }
    // MOV (QuickTime) with H.264/AAC often plays in Chromium via mp4 demuxer even when canPlayType('video/quicktime') === ''
    if (raw === 'video/quicktime' && el.canPlayType('video/mp4') !== '') {
      return 'uncertain';
    }
    if (raw === 'video/x-matroska' && el.canPlayType('video/webm') !== '') {
      return 'uncertain';
    }
    return 'unsupported';
  } catch {
    return 'uncertain';
  }
}

/**
 * Inspects up to 64 header bytes (without reading the entire payload into memory)
 * to identify true container format even if a file's extension or browser MIME is generic.
 */
export async function inspectMediaFileHeader(
  file: File,
  preferredCategory?: VaultCategory | 'all'
): Promise<DetectedMediaInspection> {
  const browserMime = (file.type || '').toLowerCase();
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  let bytes = new Uint8Array(0);
  if (typeof file.slice === 'function') {
    try {
      const slice = file.slice(0, 64);
      if (typeof slice.arrayBuffer === 'function') {
        const buf = await slice.arrayBuffer();
        bytes = new Uint8Array(buf);
      }
    } catch {
      bytes = new Uint8Array(0);
    }
  }

  let sniffedCategory: VaultCategory | null = null;
  let sniffedMime: string | undefined;
  let container: string | undefined;

  if (bytes.length >= 4) {
    const magic4 = asciiAt(bytes, 0, 4);
    const sub8 = asciiAt(bytes, 8, 4);
    if (magic4 === 'RIFF' && sub8 === 'WAVE') {
      sniffedCategory = 'audio';
      sniffedMime = 'audio/wav';
      container = 'WAV';
    } else if (magic4 === 'RIFF' && sub8 === 'AVI ') {
      sniffedCategory = 'video';
      sniffedMime = 'video/x-msvideo';
      container = 'AVI';
    } else if (magic4 === 'FORM' && (sub8 === 'AIFF' || sub8 === 'AIFC')) {
      sniffedCategory = 'audio';
      sniffedMime = 'audio/aiff';
      container = 'AIFF';
    } else if (magic4 === 'fLaC') {
      sniffedCategory = 'audio';
      sniffedMime = 'audio/flac';
      container = 'FLAC';
    } else if (magic4 === 'OggS') {
      const headerStr = asciiAt(bytes, 0, bytes.length);
      if (headerStr.includes('theora')) {
        sniffedCategory = 'video';
        sniffedMime = 'video/ogg';
        container = 'Ogg Video';
      } else if (headerStr.includes('OpusHead')) {
        sniffedCategory = 'audio';
        sniffedMime = 'audio/ogg; codecs=opus';
        container = 'Opus';
      } else {
        sniffedCategory = 'audio';
        sniffedMime = 'audio/ogg';
        container = 'OGG';
      }
    } else if (
      asciiAt(bytes, 0, 3) === 'ID3' ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && ext !== 'aac')
    ) {
      sniffedCategory = 'audio';
      sniffedMime = 'audio/mpeg';
      container = 'MP3';
    } else if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      const lowerText = asciiAt(bytes, 0, bytes.length).toLowerCase();
      if (lowerText.includes('webm')) {
        sniffedCategory = ext === 'weba' || browserMime === 'audio/webm' ? 'audio' : 'video';
        sniffedMime = sniffedCategory === 'audio' ? 'audio/webm' : 'video/webm';
        container = 'WebM';
      } else {
        sniffedCategory = 'video';
        sniffedMime = 'video/x-matroska';
        container = 'Matroska MKV';
      }
    } else if (bytes.length >= 12 && asciiAt(bytes, 4, 4) === 'ftyp') {
      const brand = asciiAt(bytes, 8, 4);
      if (brand.startsWith('M4A') || brand === 'M4B ') {
        sniffedCategory = 'audio';
        sniffedMime = 'audio/mp4';
        container = 'M4A (MP4 Audio)';
      } else if (brand === 'qt  ') {
        sniffedCategory = 'video';
        sniffedMime = 'video/quicktime';
        container = 'QuickTime MOV';
      } else {
        sniffedCategory = ext === 'm4a' ? 'audio' : 'video';
        sniffedMime = ext === 'm4a' ? 'audio/mp4' : 'video/mp4';
        container = ext === 'm4a' ? 'M4A' : 'MP4';
      }
    } else if (bytes[0] === 0x89 && asciiAt(bytes, 1, 3) === 'PNG') {
      sniffedCategory = preferredCategory === 'graphics' ? 'graphics' : 'images';
      sniffedMime = 'image/png';
      container = 'PNG';
    } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      sniffedCategory = preferredCategory === 'graphics' ? 'graphics' : 'images';
      sniffedMime = 'image/jpeg';
      container = 'JPEG';
    }
  }

  const fallbackByExt = EXTENSION_MIME_DEFAULTS[ext];
  const category =
    sniffedCategory ||
    detectVaultCategoryFromFile(file, preferredCategory) ||
    fallbackByExt?.category ||
    null;

  if (!category) {
    return {
      category: null,
      mimeType: browserMime || 'application/octet-stream',
      playbackSupport: 'unsupported',
    };
  }

  const resolvedMime =
    sniffedMime ||
    (browserMime && browserMime !== 'application/octet-stream' ? browserMime : undefined) ||
    fallbackByExt?.mime ||
    (category === 'video' ? 'video/mp4' : category === 'audio' ? 'audio/mpeg' : 'image/png');

  const resolvedContainer =
    container || fallbackByExt?.container || ext.toUpperCase() || category.toUpperCase();

  let playbackSupport: MediaPlaybackCompatibility = 'native';
  if (category === 'audio' || category === 'video') {
    playbackSupport = probeBrowserPlaybackCompatibility(category, resolvedMime);
  }

  return {
    category,
    mimeType: resolvedMime,
    detectedContainer: resolvedContainer,
    playbackSupport,
  };
}

export function detectVaultCategoryFromFile(
  file: File,
  preferredCategory?: VaultCategory | 'all'
): VaultCategory | null {
  const mime = (file.type || '').toLowerCase();
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (mime === 'audio/webm' || ext === 'weba') {
    return 'audio';
  }
  if (
    mime.startsWith('video/') ||
    (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(ext)
  ) {
    return 'video';
  }
  if (
    mime.startsWith('audio/') ||
    (SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)
  ) {
    return 'audio';
  }
  if (mime === 'image/svg+xml' || ext === 'svg') {
    return 'graphics';
  }
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'].includes(ext)
  ) {
    return preferredCategory === 'graphics' ? 'graphics' : 'images';
  }
  return null;
}

export function getVaultStore(project: FilmProject): VaultProductionStore {
  const raw = project.vaultState;
  const productionId = project.id;
  const storedAssets = deduplicateById(
    (raw?.assets || []).filter((a) => a.productionId === productionId)
  );

  // Non-duplicating projection for any Images/Graphics uploaded directly inside Visualise
  const knownRefIds = new Set(
    storedAssets.map((a) => a.sharedReferenceAssetId).filter((v): v is string => Boolean(v))
  );
  const knownVaultIds = new Set(storedAssets.map((a) => a.id));

  const projectedFromVisualize: VaultAssetRecord[] = (
    project.visualizeState?.referenceAssets || []
  )
    .filter((ref) => {
      if (ref.productionId !== productionId || ref.mediaType !== 'image') return false;
      if (knownRefIds.has(ref.id)) return false;
      if (ref.vaultAssetId && knownVaultIds.has(ref.vaultAssetId)) return false;
      return true;
    })
    .map((ref) => {
      const isGraphic = (ref.tags || []).some((t) => t.toLowerCase() === 'graphic');
      return {
        id: ref.vaultAssetId || `vault-from-ref-${ref.id}`,
        productionId,
        category: isGraphic ? ('graphics' as const) : ('images' as const),
        name: ref.originalFilename,
        originalFilename: ref.originalFilename,
        mimeType: ref.mimeType || 'image/jpeg',
        fileSizeBytes: ref.fileSizeBytes || 0,
        description: ref.description,
        tags: ref.tags || [],
        productionStatus: 'Raw' as VaultProductionStatus,
        thumbnailDataUrl: ref.thumbnailDataUrl || ref.storageRef,
        storageProvider: 'vault-local' as const,
        sharedReferenceAssetId: ref.id,
        createdAt: ref.createdAt,
        updatedAt: ref.updatedAt,
      };
    });

  return {
    schemaVersion: 1,
    productionId,
    assets: deduplicateById([...storedAssets, ...projectedFromVisualize]).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    ),
    updatedAt: raw?.updatedAt || project.updatedAt,
  };
}

export function updateVaultStore(
  project: FilmProject,
  updater: (cur: VaultProductionStore) => VaultProductionStore
): FilmProject {
  const currentStored: VaultProductionStore = {
    schemaVersion: 1,
    productionId: project.id,
    assets: deduplicateById(
      (project.vaultState?.assets || []).filter((a) => a.productionId === project.id)
    ),
    updatedAt: project.vaultState?.updatedAt || project.updatedAt,
  };
  const next = updater(currentStored);
  const now = new Date().toISOString();

  return {
    ...project,
    vaultState: {
      schemaVersion: 1,
      productionId: project.id,
      assets: deduplicateById(
        next.assets.map((a) => ({ ...a, productionId: project.id }))
      ),
      updatedAt: now,
    },
    updatedAt: now,
  };
}

async function probeImageDimensions(
  file: File
): Promise<{ width?: number; height?: number }> {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') return {};
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface ProbedMediaMetadata {
  durationSeconds?: number;
  width?: number;
  height?: number;
  thumbnailDataUrl?: string;
}

function captureVideoPosterFrame(video: HTMLVideoElement): string | undefined {
  if (typeof document === 'undefined' || !video.videoWidth || !video.videoHeight) {
    return undefined;
  }
  try {
    const maxW = 640;
    const scale = video.videoWidth > maxW ? maxW / video.videoWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.74);
    return dataUrl && dataUrl.length > 100 ? dataUrl : undefined;
  } catch {
    return undefined;
  }
}

async function probeMediaMetadataAndThumbnail(
  file: File,
  kind: 'video' | 'audio'
): Promise<ProbedMediaMetadata> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return {};
  const url = URL.createObjectURL(file);
  const el = document.createElement(kind);
  el.preload = 'metadata';
  if (el instanceof HTMLVideoElement) {
    el.muted = true;
    el.playsInline = true;
  }

  try {
    return await new Promise<ProbedMediaMetadata>((resolve) => {
      let finished = false;
      const done = (result: ProbedMediaMetadata) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        resolve(result);
      };

      const timeout = setTimeout(() => {
        const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : undefined;
        if (el instanceof HTMLVideoElement) {
          done({
            durationSeconds: d,
            width: el.videoWidth || undefined,
            height: el.videoHeight || undefined,
            thumbnailDataUrl: captureVideoPosterFrame(el),
          });
        } else {
          done({ durationSeconds: d });
        }
      }, 3500);

      const finishVideoAfterMetadata = (dur?: number) => {
        if (!(el instanceof HTMLVideoElement)) {
          done({ durationSeconds: dur });
          return;
        }
        const captureTargetTime = dur && dur > 0.6 ? Math.min(0.45, dur * 0.1) : 0.05;
        let captured = false;
        const onFrameReady = () => {
          if (captured) return;
          captured = true;
          done({
            durationSeconds:
              dur ?? (Number.isFinite(el.duration) && el.duration > 0 ? el.duration : undefined),
            width: el.videoWidth || undefined,
            height: el.videoHeight || undefined,
            thumbnailDataUrl: captureVideoPosterFrame(el),
          });
        };

        el.onseeked = onFrameReady;
        el.onloadeddata = () => {
          if (captureTargetTime <= 0.05) {
            onFrameReady();
          } else {
            try {
              el.currentTime = captureTargetTime;
            } catch {
              onFrameReady();
            }
          }
        };
        setTimeout(onFrameReady, 1400);
      };

      el.onloadedmetadata = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) {
          finishVideoAfterMetadata(el.duration);
          return;
        }
        // WebM streams written by MediaRecorder omit duration in header until seeked
        if (el.duration === Infinity) {
          const resolveSeekDuration = () => {
            el.ontimeupdate = null;
            el.onseeked = null;
            const finite =
              Number.isFinite(el.duration) && el.duration > 0 ? el.duration : undefined;
            if (el instanceof HTMLVideoElement) {
              finishVideoAfterMetadata(finite);
            } else {
              done({ durationSeconds: finite });
            }
          };
          el.onseeked = resolveSeekDuration;
          el.ontimeupdate = resolveSeekDuration;
          try {
            el.currentTime = 1e101;
          } catch {
            finishVideoAfterMetadata(undefined);
          }
          return;
        }
        finishVideoAfterMetadata(undefined);
      };

      el.onerror = () => {
        done({});
      };
      el.src = url;
    });
  } finally {
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
  }
}

export interface PreparedVaultUpload {
  asset: VaultAssetRecord;
}

export async function processAndStoreVaultFile(
  file: File,
  productionId: string,
  options?: {
    preferredCategory?: VaultCategory | 'all';
    status?: VaultProductionStatus;
    onProgress?: (percent: number) => void;
  }
): Promise<PreparedVaultUpload> {
  const inspection = await inspectMediaFileHeader(file, options?.preferredCategory);
  const category = inspection.category;
  if (!category) {
    throw new Error(
      `Unsupported file format for "${file.name}". Supported: Images, Graphics, Audio (MP3, WAV, AAC, M4A, OGG, Opus, FLAC, AIFF), and Video (MP4, WebM, MOV, MKV, AVI).`
    );
  }

  options?.onProgress?.(15);

  const assetId = `vasset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  let thumbnailDataUrl: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let durationSeconds: number | undefined;

  if (category === 'images' || category === 'graphics') {
    const dims = await probeImageDimensions(file);
    width = dims.width;
    height = dims.height;
    options?.onProgress?.(45);
    if ((file.type || '').toLowerCase() === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      thumbnailDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read SVG graphic.'));
        reader.readAsDataURL(file);
      });
    } else {
      const compressed = await compressStoryboardImageFile(file, 960, 960);
      thumbnailDataUrl = compressed.dataUrl;
    }
  } else {
    options?.onProgress?.(45);
    if (inspection.playbackSupport !== 'unsupported') {
      const probed = await probeMediaMetadataAndThumbnail(file, category);
      durationSeconds = probed.durationSeconds;
      width = probed.width;
      height = probed.height;
      thumbnailDataUrl = probed.thumbnailDataUrl;
    }
  }

  options?.onProgress?.(75);
  await saveVaultMediaBlob(assetId, productionId, file);
  options?.onProgress?.(100);

  const baseTags =
    category === 'graphics'
      ? ['graphic', 'vault']
      : [category === 'images' ? 'reference' : category, 'vault'];

  const record: VaultAssetRecord = {
    id: assetId,
    productionId,
    category,
    name: file.name,
    originalFilename: file.name,
    mimeType: inspection.mimeType,
    fileSizeBytes: file.size || 0,
    tags: baseTags,
    productionStatus: coerceStatusForVaultCategory(category, options?.status || 'Raw'),
    durationSeconds,
    width,
    height,
    detectedContainer: inspection.detectedContainer,
    playbackSupport: inspection.playbackSupport,
    thumbnailDataUrl,
    storageProvider: 'vault-idb',
    storageKey: assetId,
    createdAt: now,
    updatedAt: now,
  };

  return { asset: record };
}

export function attachVaultAssetToProject(
  project: FilmProject,
  asset: VaultAssetRecord
): FilmProject {
  let working = project;

  // Link Images & Graphics directly into Visualise's canonical Shared Reference Library without duplicating blobs
  if (
    (asset.category === 'images' || asset.category === 'graphics') &&
    asset.thumbnailDataUrl
  ) {
    const { updatedProject, asset: sharedRef } = registerSharedReferenceAsset(working, {
      originalFilename: asset.originalFilename,
      thumbnailDataUrl: asset.thumbnailDataUrl,
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes,
      description: asset.description || (asset.category === 'graphics' ? 'Vault Graphic' : 'Vault Image'),
      tags: asset.tags,
      source: asset.category === 'graphics' ? 'Vault Graphics' : 'Media Vault',
      vaultAssetId: asset.id,
    });
    working = updatedProject;
    asset = { ...asset, sharedReferenceAssetId: sharedRef.id };
  }

  return updateVaultStore(working, (cur) => ({
    ...cur,
    assets: [asset, ...cur.assets.filter((a) => a.id !== asset.id)],
  }));
}

export function updateVaultAssetMetadata(
  project: FilmProject,
  assetOrProjected: VaultAssetRecord,
  updates: Partial<
    Pick<VaultAssetRecord, 'name' | 'description' | 'tags' | 'category' | 'productionStatus'>
  >
): FilmProject {
  const now = new Date().toISOString();
  const nextTags =
    updates.tags !== undefined
      ? updates.tags
      : assetOrProjected.tags;

  // Ensure 'graphic' tag tracks category transitions cleanly for Visualise sharing
  const targetCategory = updates.category || assetOrProjected.category;
  const resolvedStatus = coerceStatusForVaultCategory(
    targetCategory,
    updates.productionStatus || assetOrProjected.productionStatus
  );
  let normalizedTags = [...nextTags];
  if (targetCategory === 'graphics' && !normalizedTags.some((t) => t.toLowerCase() === 'graphic')) {
    normalizedTags.push('graphic');
  } else if (targetCategory === 'images') {
    normalizedTags = normalizedTags.filter((t) => t.toLowerCase() !== 'graphic');
  }

  const nextRecord: VaultAssetRecord = {
    ...assetOrProjected,
    ...updates,
    category: targetCategory,
    productionStatus: resolvedStatus,
    tags: normalizedTags,
    updatedAt: now,
  };

  let working = updateVaultStore(project, (cur) => {
    const exists = cur.assets.some((a) => a.id === nextRecord.id);
    return {
      ...cur,
      assets: exists
        ? cur.assets.map((a) => (a.id === nextRecord.id ? nextRecord : a))
        : [nextRecord, ...cur.assets],
    };
  });

  // Sync name/description/tags changes onto linked SharedReferenceAsset if present
  if (nextRecord.sharedReferenceAssetId && working.visualizeState) {
    working = updateProductionVisualizeStore(working, (vCur) => ({
      ...vCur,
      referenceAssets: vCur.referenceAssets.map((r: VisualReferenceAsset) =>
        r.id === nextRecord.sharedReferenceAssetId || r.vaultAssetId === nextRecord.id
          ? {
              ...r,
              originalFilename: nextRecord.name || r.originalFilename,
              description: nextRecord.description,
              tags: normalizedTags,
              updatedAt: now,
            }
          : r
      ),
    }));
  }

  return working;
}

export async function removeVaultAssetFromProject(
  project: FilmProject,
  asset: VaultAssetRecord
): Promise<FilmProject> {
  await deleteVaultMediaBlob(asset.id);

  let working = updateVaultStore(project, (cur) => ({
    ...cur,
    assets: cur.assets.filter((a) => a.id !== asset.id),
  }));

  // Clean up Visualise reference projections tied exclusively to this Vault record
  if (working.visualizeState) {
    working = updateProductionVisualizeStore(working, (vCur) => ({
      ...vCur,
      referenceAssets: vCur.referenceAssets.filter(
        (r) =>
          r.id !== asset.sharedReferenceAssetId &&
          r.vaultAssetId !== asset.id
      ),
    }));
  }

  return working;
}
