import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileAudio,
  FileImage,
  FileVideo,
  Grid,
  Layers,
  List,
  Lock,
  Maximize2,
  Minimize2,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { FilmProject, FootageBackup } from '../../../types';
import type { ProjectRole } from '../../../types/database.types';
import { hasPermission } from '../../../services/rbac/permissions';
import type { VaultAssetRecord, VaultCategory, VaultProductionStatus } from '../types';
import { getStatusesForVaultCategory } from '../types';
import {
  attachVaultAssetToProject,
  formatDuration,
  formatFileSize,
  getVaultStore,
  processAndStoreVaultFile,
  removeVaultAssetFromProject,
  updateVaultAssetMetadata,
} from '../services/vaultMediaService';
import { releaseProductionVaultUrls } from '../services/vaultStorageService';
import { VaultAudioPlayer } from './VaultAudioPlayer';
import { VaultVideoPlayer } from './VaultVideoPlayer';
import {
  VaultInlineMetadataUpdate,
  VaultMediaGalleries,
} from './VaultMediaGalleries';

export type { VaultCategory, VaultProductionStatus };

export interface VaultWorkspaceProps {
  project: FilmProject;
  isDark?: boolean;
  activeRole?: ProjectRole | null;
  initialCategory?: VaultCategory;
  onUpdateProject?: (updated: FilmProject) => void;
  onUpdateFootage?: (backups: FootageBackup[]) => void;
  onNavigateTab?: (tabId: string, submodule?: string) => void;
}

type PrimaryVaultTab = 'images' | 'audio' | 'video';

const PRIMARY_VAULT_TABS: Array<{
  id: PrimaryVaultTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}> = [
  {
    id: 'images',
    label: 'Images',
    icon: FileImage,
    activeClass: 'bg-gradient-to-r from-[#B45CFF] via-[#923BFF] to-[#7628D9] text-white font-bold shadow-[0_0_14px_rgba(180,92,255,0.40)] border border-[#D18AFF]/50',
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: FileAudio,
    activeClass: 'bg-gradient-to-r from-[#923BFF] via-[#B45CFF] to-[#7628D9] text-white font-bold shadow-[0_0_14px_rgba(180,92,255,0.40)] border border-[#D18AFF]/50',
  },
  {
    id: 'video',
    label: 'Video',
    icon: FileVideo,
    activeClass: 'bg-gradient-to-r from-[#7628D9] via-[#923BFF] to-[#B45CFF] text-white font-bold shadow-[0_0_14px_rgba(180,92,255,0.40)] border border-[#D18AFF]/50',
  },
];

function normalizeInitialVaultTab(cat?: string): PrimaryVaultTab {
  if (cat === 'audio') return 'audio';
  if (cat === 'video') return 'video';
  return 'images';
}

export const VaultWorkspace: React.FC<VaultWorkspaceProps> = ({
  project,
  isDark = true,
  activeRole,
  initialCategory = 'images',
  onUpdateProject,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<PrimaryVaultTab>(() =>
    normalizeInitialVaultTab(initialCategory)
  );
  const [statusFilter, setStatusFilter] = useState<VaultProductionStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'size'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');
  const [brokenAssetIds, setBrokenAssetIds] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    filename: string;
    percent: number;
  } | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  // Full Media Playback / Lightbox Stage (Strictly for viewing/listening, not a metadata form modal)
  const [activePreviewAssetId, setActivePreviewAssetId] = useState<string | null>(null);
  const [isImageMaximized, setIsImageMaximized] = useState(false);
  const [isImageNativeFullscreen, setIsImageNativeFullscreen] = useState(false);
  const [savedAssetId, setSavedAssetId] = useState<string | null>(null);
  const [editingListRowId, setEditingListRowId] = useState<string | null>(null);
  const [listRowNameDraft, setListRowNameDraft] = useState('');

  const savedTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageStageRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
      releaseProductionVaultUrls(project.id);
    };
  }, [project.id]);

  const vaultStore = useMemo(() => getVaultStore(project), [project]);

  const resolvedRole =
    activeRole !== undefined
      ? activeRole
      : (project as { persistence?: string }).persistence === 'mock'
        ? (project.userRole ?? null)
        : null;
  const canEdit =
    hasPermission(resolvedRole, 'production:edit_data') ||
    hasPermission(resolvedRole, 'production:edit_dept_data');

  const counts = useMemo(() => {
    const map: Record<PrimaryVaultTab, number> = {
      images: 0,
      audio: 0,
      video: 0,
    };
    for (const a of vaultStore.assets) {
      if (a.category === 'images' || a.category === 'graphics') map.images += 1;
      else if (a.category === 'audio') map.audio += 1;
      else if (a.category === 'video') map.video += 1;
    }
    return map;
  }, [vaultStore.assets]);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = vaultStore.assets.filter((asset) => {
      const belongsToTab =
        activeTab === 'images'
          ? asset.category === 'images' || asset.category === 'graphics'
          : asset.category === activeTab;
      if (!belongsToTab) return false;
      if (statusFilter !== 'all' && asset.productionStatus !== statusFilter) return false;
      if (!q) return true;
      return [
        asset.name,
        asset.originalFilename,
        asset.description,
        asset.productionStatus,
        asset.detectedContainer,
        ...(asset.tags || []),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

    if (sortBy === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'size') {
      return [...list].sort((a, b) => (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0));
    }
    return list;
  }, [vaultStore.assets, activeTab, statusFilter, query, sortBy]);

  const activePreviewAsset = useMemo(
    () => vaultStore.assets.find((a) => a.id === activePreviewAssetId) || null,
    [vaultStore.assets, activePreviewAssetId]
  );

  const imagePreviewList = useMemo(
    () =>
      filteredAssets.filter(
        (a) => a.category === 'images' || a.category === 'graphics'
      ),
    [filteredAssets]
  );

  const activeImageIndex = useMemo(() => {
    if (!activePreviewAsset) return -1;
    if (activePreviewAsset.category !== 'images' && activePreviewAsset.category !== 'graphics') {
      return -1;
    }
    return imagePreviewList.findIndex((a) => a.id === activePreviewAsset.id);
  }, [activePreviewAsset, imagePreviewList]);

  const closePreview = useCallback(() => {
    setIsImageMaximized(false);
    if (
      typeof document !== 'undefined' &&
      document.fullscreenElement === imageStageRef.current &&
      typeof document.exitFullscreen === 'function'
    ) {
      void document.exitFullscreen().catch(() => {});
    }
    setActivePreviewAssetId(null);
  }, []);

  const stepImagePreview = useCallback(
    (delta: -1 | 1) => {
      if (imagePreviewList.length <= 1 || activeImageIndex < 0) return;
      const nextIdx =
        (activeImageIndex + delta + imagePreviewList.length) % imagePreviewList.length;
      setActivePreviewAssetId(imagePreviewList[nextIdx].id);
    },
    [activeImageIndex, imagePreviewList]
  );

  const toggleImageMaximizeFullscreen = useCallback(async () => {
    const nextMax = !isImageMaximized;
    setIsImageMaximized(nextMax);
    const stage = imageStageRef.current;
    if (!stage || typeof document === 'undefined') return;
    try {
      if (nextMax && !document.fullscreenElement && typeof stage.requestFullscreen === 'function') {
        await stage.requestFullscreen();
      } else if (
        !nextMax &&
        document.fullscreenElement === stage &&
        typeof document.exitFullscreen === 'function'
      ) {
        await document.exitFullscreen();
      }
    } catch {
      // Viewport-maximize state remains active even if native fullscreen is restricted
    }
  }, [isImageMaximized]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onFs = () => {
      setIsImageNativeFullscreen(document.fullscreenElement === imageStageRef.current);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Close or step lightbox stage with Escape / Arrow keys
  useEffect(() => {
    if (!activePreviewAssetId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isImageMaximized) {
          setIsImageMaximized(false);
          if (document.fullscreenElement === imageStageRef.current) {
            void document.exitFullscreen().catch(() => {});
          }
        } else {
          closePreview();
        }
      } else if (
        activePreviewAsset &&
        (activePreviewAsset.category === 'images' || activePreviewAsset.category === 'graphics')
      ) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stepImagePreview(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          stepImagePreview(1);
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          void toggleImageMaximizeFullscreen();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activePreviewAssetId,
    activePreviewAsset,
    isImageMaximized,
    closePreview,
    stepImagePreview,
    toggleImageMaximizeFullscreen,
  ]);

  const flashSavedFeedback = useCallback((assetId: string) => {
    setSavedAssetId(assetId);
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = window.setTimeout(() => {
      setSavedAssetId(null);
    }, 1800);
  }, []);

  const handleFilesUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!canEdit || !onUpdateProject) return;
      const list = Array.from(files || []);
      if (list.length === 0) return;

      setUploadError(null);
      const failedMessages: string[] = [];
      let workingProject = projectRef.current;
      const uploadedCategories = new Set<PrimaryVaultTab>();

      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setUploadProgress({
          current: i + 1,
          total: list.length,
          filename: file.name,
          percent: 5,
        });

        try {
          const { asset } = await processAndStoreVaultFile(file, workingProject.id, {
            preferredCategory: activeTab,
            status: 'Raw',
            onProgress: (pct) => {
              setUploadProgress({
                current: i + 1,
                total: list.length,
                filename: file.name,
                percent: pct,
              });
            },
          });
          workingProject = attachVaultAssetToProject(workingProject, asset);
          onUpdateProject(workingProject);
          projectRef.current = workingProject;
          uploadedCategories.add(
            asset.category === 'audio'
              ? 'audio'
              : asset.category === 'video'
                ? 'video'
                : 'images'
          );
        } catch (err: any) {
          failedMessages.push(err?.message || `Failed to upload "${file.name}".`);
        }
      }

      setUploadProgress(null);

      // Focus the uploaded category if all newly uploaded files target another submodule
      if (uploadedCategories.size === 1) {
        const singleTarget = Array.from(uploadedCategories)[0];
        if (singleTarget !== activeTab) {
          setActiveTab(singleTarget);
          setStatusFilter('all');
        }
      }

      if (failedMessages.length > 0) {
        setUploadError(failedMessages.join(' '));
      }
    },
    [canEdit, onUpdateProject, activeTab]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void handleFilesUpload(files);
    }
    e.target.value = '';
  };

  const handleInlineMetadataUpdate = useCallback(
    (asset: VaultAssetRecord, updates: VaultInlineMetadataUpdate) => {
      if (!canEdit || !onUpdateProject) return;
      const updated = updateVaultAssetMetadata(projectRef.current, asset, updates);
      projectRef.current = updated;
      onUpdateProject(updated);
      flashSavedFeedback(asset.id);
    },
    [canEdit, onUpdateProject, flashSavedFeedback]
  );

  const handleDeleteAsset = useCallback(
    async (asset: VaultAssetRecord) => {
      if (!canEdit || !onUpdateProject) return;
      const next = await removeVaultAssetFromProject(projectRef.current, asset);
      projectRef.current = next;
      onUpdateProject(next);
      if (activePreviewAssetId === asset.id) {
        setActivePreviewAssetId(null);
      }
    },
    [canEdit, onUpdateProject, activePreviewAssetId]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (canEdit && e.dataTransfer?.files?.length) {
      void handleFilesUpload(e.dataTransfer.files);
    }
  };

  return (
    <div
      id="workspace-assets-content"
      data-testid="vault-workspace-root"
      onDragOver={(e) => {
        if (canEdit) {
          e.preventDefault();
          setIsDraggingFiles(true);
        }
      }}
      onDragLeave={() => setIsDraggingFiles(false)}
      onDrop={handleDrop}
      className={`flex-1 min-h-0 flex flex-col h-full w-full vault-atmospheric-bg text-slate-100 overflow-hidden select-none relative ${
        isDraggingFiles ? 'ring-2 ring-inset ring-[#B45CFF]/60' : ''
      }`}
    >
      {/* Liquid-Glass Vault Top Navigation & Controls Bar (Strictly 3 Peer Submodules) */}
      <div className="vault-glass-panel mx-4 mt-3 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#f3efe6] tracking-wide">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#923BFF]/35 to-[#B45CFF]/20 border border-[#B45CFF]/30 flex items-center justify-center">
              <Database className="w-3.5 h-3.5 text-[#D18AFF]" />
            </span>
            Vault
          </span>

          <div
            data-testid="vault-category-bar"
            role="tablist"
            aria-label="Vault media categories"
            className="flex items-center gap-1 bg-[#0B0712]/80 p-1 rounded-xl border border-[#B45CFF]/25"
          >
            {PRIMARY_VAULT_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`vault-cat-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (
                      statusFilter !== 'all' &&
                      !getStatusesForVaultCategory(tab.id).includes(statusFilter)
                    ) {
                      setStatusFilter('all');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                    active
                      ? tab.activeClass
                      : 'text-purple-300/70 hover:text-[#E6C2FF] hover:bg-[#B45CFF]/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className="font-mono text-[10px] opacity-75">
                    ({counts[tab.id]})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!canEdit && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#B45CFF]/20 bg-[#191126] text-[10px] font-mono text-purple-300">
              <Lock className="w-3 h-3" />
              Read-only
            </span>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-purple-300/50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="vault-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${activeTab}, tags, format...`}
              className="w-40 md:w-48 rounded-xl border border-[#B45CFF]/25 bg-[#0B0712]/90 pl-8 pr-2.5 py-1.5 text-xs text-[#E6C2FF] placeholder:text-purple-300/40 focus:outline-none focus:border-[#B45CFF]/60"
            />
          </div>

          <select
            value={statusFilter}
            data-testid="vault-status-filter"
            onChange={(e) =>
              setStatusFilter(e.target.value as VaultProductionStatus | 'all')
            }
            className="rounded-xl border border-[#B45CFF]/25 bg-[#0B0712]/90 px-2.5 py-1.5 text-[11px] text-[#E6C2FF] focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            {getStatusesForVaultCategory(activeTab).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort media assets"
            data-testid="vault-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'name' | 'size')}
            className="rounded-xl border border-[#B45CFF]/25 bg-[#0B0712]/90 px-2 py-1.5 text-[11px] text-[#E6C2FF] focus:outline-none cursor-pointer hidden sm:block"
          >
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
            <option value="size">File Size</option>
          </select>

          <div className="inline-flex rounded-xl bg-[#0B0712]/90 border border-[#B45CFF]/25 p-0.5">
            <button
              type="button"
              data-testid="vault-view-grid"
              onClick={() => setViewMode('grid')}
              aria-label="Gallery view"
              className={`p-1.5 rounded-lg cursor-pointer transition ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-[#B45CFF] to-[#923BFF] text-white shadow-sm'
                  : 'text-purple-300/60 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="vault-view-list"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`p-1.5 rounded-lg cursor-pointer transition ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-[#B45CFF] to-[#923BFF] text-white shadow-sm'
                  : 'text-purple-300/60 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.svg,.mp3,.wav,.aac,.m4a,.ogg,.oga,.opus,.flac,.aiff,.aif,.mp4,.m4v,.webm,.mov,.mkv,.avi,.ogv"
                data-testid="vault-upload-input"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <button
                type="button"
                data-testid="vault-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#B45CFF] via-[#923BFF] to-[#7628D9] text-white hover:brightness-110 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(180,92,255,0.30)] border border-[#D18AFF]/40"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Files
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploadProgress && (
        <div
          data-testid="vault-upload-progress"
          className="mx-4 mt-3 vault-glass-card rounded-xl px-4 py-2.5 space-y-1.5 shrink-0"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[#E6C2FF] truncate">
              Storing {uploadProgress.current} of {uploadProgress.total}: {uploadProgress.filename}
            </span>
            <span className="font-mono text-[#D18AFF] shrink-0 font-bold">
              {uploadProgress.percent}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7628D9] via-[#923BFF] to-[#D18AFF] transition-[width] duration-150"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Failure Banner */}
      {uploadError && (
        <div
          data-testid="vault-upload-error"
          className="mx-4 mt-3 rounded-xl border border-rose-400/35 bg-rose-950/40 px-4 py-2.5 text-xs text-rose-100 flex items-center justify-between gap-2 shrink-0"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
            {uploadError}
          </span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Gallery / Table Surface */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 pt-5">
        {filteredAssets.length === 0 ? (
          <div
            id="vault-empty-state"
            className="h-full min-h-[300px] flex items-center justify-center"
          >
            <div className="max-w-md w-full vault-glass-card rounded-2xl border-dashed border-[#B45CFF]/30 p-8 text-center space-y-3">
              <Layers className="w-7 h-7 text-[#B45CFF] mx-auto" />
              <h3 className="text-base font-semibold text-[#f3efe6]">
                {counts[activeTab] === 0
                  ? `No ${activeTab} in Vault yet`
                  : `No ${activeTab} match your active filter`}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeTab === 'images'
                  ? 'Upload production stills, colour keys, SVGs, or artwork frames. Visuals appear automatically across Storyboards, Shot Lists, Camera Setups, and Boards.'
                  : activeTab === 'audio'
                    ? 'Upload production stems, dialogue takes, SFX, or wild tracks (WAV, MP3, AAC, M4A, OGG, Opus, FLAC) for dynamic wave playback and dubbing tracking.'
                    : 'Upload camera dailies, animatics, or editorial cuts (MP4, WebM, MOV, MKV, AVI) with IndexedDB binary persistence and frame-accurate cinema controls.'}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B45CFF] to-[#923BFF] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(180,92,255,0.30)] hover:brightness-110"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Select Files to Upload
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <VaultMediaGalleries
            category={activeTab}
            assets={filteredAssets}
            activeAssetId={activePreviewAssetId}
            canEdit={canEdit}
            savedAssetId={savedAssetId}
            brokenAssetIds={brokenAssetIds}
            onMarkBroken={(id) =>
              setBrokenAssetIds((prev) => ({ ...prev, [id]: true }))
            }
            onUpdateMetadata={handleInlineMetadataUpdate}
            onDeleteAsset={(asset) => void handleDeleteAsset(asset)}
            onOpenPreview={(asset) => setActivePreviewAssetId(asset.id)}
          />
        ) : (
          /* Clean Scannable Production List View with Inline Rename & Status Controls */
          <div id="vault-media-list" className="max-w-6xl space-y-2 pb-12">
            {filteredAssets.map((asset) => {
              const isVisual = asset.category === 'images' || asset.category === 'graphics';
              const src = asset.thumbnailDataUrl || asset.externalUrl;
              const isEditingThisName = editingListRowId === asset.id;

              return (
                <div
                  key={asset.id}
                  data-vault-asset-id={asset.id}
                  className="rounded-xl border border-[#B45CFF]/20 bg-[#191126]/90 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs hover:border-[#B45CFF]/45 transition shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      onClick={() => setActivePreviewAssetId(asset.id)}
                      className="w-16 h-11 rounded-lg bg-[#0B0712] border border-[#B45CFF]/25 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={asset.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain"
                        />
                      ) : asset.category === 'video' ? (
                        <FileVideo className="w-4 h-4 text-[#D18AFF]" />
                      ) : (
                        <FileAudio className="w-4 h-4 text-[#B45CFF]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditingThisName ? (
                        <input
                          type="text"
                          autoFocus
                          value={listRowNameDraft}
                          data-testid={`vault-inline-name-input-${asset.id}`}
                          onChange={(e) => setListRowNameDraft(e.target.value)}
                          onBlur={() => {
                            setEditingListRowId(null);
                            if (
                              listRowNameDraft.trim() &&
                              listRowNameDraft.trim() !== asset.name
                            ) {
                              handleInlineMetadataUpdate(asset, {
                                name: listRowNameDraft.trim(),
                              });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditingListRowId(null);
                          }}
                          className="px-2 py-0.5 rounded bg-[#0B0712] border border-[#B45CFF]/50 text-[#E6C2FF] w-full max-w-xs focus:outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) {
                              setActivePreviewAssetId(asset.id);
                              return;
                            }
                            setListRowNameDraft(asset.name);
                            setEditingListRowId(asset.id);
                          }}
                          className="font-semibold text-[#f3efe6] hover:text-[#D18AFF] truncate text-left block max-w-full cursor-pointer"
                        >
                          {asset.name}
                        </button>
                      )}
                      <div className="text-[10.5px] font-mono text-purple-200/60 truncate mt-0.5">
                        {asset.detectedContainer || asset.category.toUpperCase()}
                        {asset.durationSeconds
                          ? ` · ${formatDuration(asset.durationSeconds)}`
                          : ''}
                        {asset.width && asset.height
                          ? ` · ${asset.width}×${asset.height}`
                          : ''}
                        {asset.fileSizeBytes > 0
                          ? ` · ${formatFileSize(asset.fileSizeBytes)}`
                          : ''}
                        {asset.tags.length > 0 ? ` · #${asset.tags.join(', #')}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {savedAssetId === asset.id && (
                      <span className="text-[10px] font-mono text-emerald-300 inline-flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    )}

                    <select
                      value={asset.productionStatus}
                      disabled={!canEdit}
                      data-testid={`vault-status-select-${asset.id}`}
                      onChange={(e) =>
                        handleInlineMetadataUpdate(asset, {
                          productionStatus: e.target.value as VaultProductionStatus,
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-[#0B0712] border border-[#B45CFF]/25 text-[11px] font-mono text-[#E6C2FF] focus:outline-none disabled:opacity-60"
                    >
                      {getStatusesForVaultCategory(asset.category).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      data-testid={`vault-preview-btn-${asset.id}`}
                      onClick={() => setActivePreviewAssetId(asset.id)}
                      className="px-2.5 py-1 rounded-lg bg-[#211632] hover:bg-[#B45CFF]/20 border border-[#B45CFF]/25 text-[11px] text-[#E6C2FF] cursor-pointer"
                    >
                      {isVisual ? 'View' : 'Play'}
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteAsset(asset)}
                        className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-rose-300 cursor-pointer"
                        title="Delete asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated Full Media Playback / Lightbox Stage (Portaled above App Shell chrome!) */}
      {activePreviewAsset &&
        (() => {
          const modalNode = (
            <div
              data-testid="vault-asset-preview-modal"
              onClick={closePreview}
              className={`fixed inset-0 z-[200] bg-[#0B0712]/95 backdrop-blur-xl flex items-center justify-center select-text ${
                isImageMaximized ? 'p-0' : 'p-4 sm:p-6'
              }`}
            >
              <div
                ref={imageStageRef}
                onClick={(e) => e.stopPropagation()}
                className={`w-full flex flex-col gap-3 bg-[#10091B] ${
                  isImageMaximized
                    ? 'h-full max-w-none max-h-none p-3 sm:p-4 rounded-none'
                    : 'max-w-5xl max-h-[92vh] rounded-2xl'
                }`}
              >
                {/* Compact Floating Header with Clear Return to Gallery + Maximize/Fullscreen */}
                <div className="rounded-2xl border border-[#B45CFF]/30 bg-[#191126]/95 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xl">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={closePreview}
                      data-testid="vault-preview-back-btn"
                      className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-[#B45CFF]/25 text-[11px] font-medium text-[#E6C2FF] inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to Gallery
                    </button>

                    <span className="font-semibold text-sm text-[#f3efe6] truncate">
                      {activePreviewAsset.name}
                    </span>
                    <span className="text-[11px] font-mono text-purple-200/60 shrink-0 hidden sm:inline">
                      {activePreviewAsset.detectedContainer ||
                        activePreviewAsset.category.toUpperCase()}
                      {activePreviewAsset.width && activePreviewAsset.height
                        ? ` · ${activePreviewAsset.width}×${activePreviewAsset.height}`
                        : ''}
                      {activePreviewAsset.fileSizeBytes > 0
                        ? ` · ${formatFileSize(activePreviewAsset.fileSizeBytes)}`
                        : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label="Asset status"
                      value={activePreviewAsset.productionStatus}
                      disabled={!canEdit}
                      data-testid="vault-player-status-select"
                      onChange={(e) =>
                        handleInlineMetadataUpdate(activePreviewAsset, {
                          productionStatus: e.target.value as VaultProductionStatus,
                        })
                      }
                      className="px-2.5 py-1 rounded-xl bg-[#0B0712] border border-[#B45CFF]/30 text-[11px] font-mono text-[#E6C2FF]"
                    >
                      {getStatusesForVaultCategory(activePreviewAsset.category).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>

                    {(activePreviewAsset.category === 'images' ||
                      activePreviewAsset.category === 'graphics') && (
                      <>
                        <button
                          type="button"
                          onClick={() => void toggleImageMaximizeFullscreen()}
                          data-testid="vault-image-fullscreen-btn"
                          aria-label={
                            isImageMaximized || isImageNativeFullscreen
                              ? 'Restore preview size'
                              : 'Maximise / Fullscreen preview'
                          }
                          title="Maximise / Fullscreen (F)"
                          className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-[#B45CFF]/25 text-[11px] text-[#E6C2FF] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {isImageMaximized || isImageNativeFullscreen ? (
                            <>
                              <Minimize2 className="w-3.5 h-3.5" />
                              Restore
                            </>
                          ) : (
                            <>
                              <Maximize2 className="w-3.5 h-3.5" />
                              Fullscreen
                            </>
                          )}
                        </button>

                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => {
                              closePreview();
                              onNavigateTab('visualize', 'boards');
                            }}
                            className="px-2.5 py-1 rounded-xl bg-[#211632] hover:bg-[#B45CFF]/20 border border-[#B45CFF]/25 text-[11px] text-[#D18AFF] inline-flex items-center gap-1 cursor-pointer"
                          >
                            Open in Boards <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={closePreview}
                      aria-label="Close asset preview"
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-purple-200 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Active Player or Full Aspect-Preserving Image Stage */}
                <div
                  className={
                    isImageMaximized
                      ? 'flex-1 min-h-0 flex items-center justify-center'
                      : 'overflow-y-auto'
                  }
                >
                  {activePreviewAsset.category === 'video' ? (
                    <VaultVideoPlayer
                      key={activePreviewAsset.id}
                      asset={activePreviewAsset}
                      productionId={project.id}
                    />
                  ) : activePreviewAsset.category === 'audio' ? (
                    <VaultAudioPlayer
                      key={activePreviewAsset.id}
                      asset={activePreviewAsset}
                      productionId={project.id}
                    />
                  ) : (
                    <div
                      data-testid="vault-image-preview-stage"
                      className={`relative rounded-2xl border border-[#B45CFF]/25 bg-[#0B0712] flex items-center justify-center overflow-hidden ${
                        isImageMaximized ? 'w-full h-full p-4 sm:p-6' : 'p-4 sm:p-6 h-[68vh]'
                      }`}
                    >
                      {imagePreviewList.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => stepImagePreview(-1)}
                            data-testid="vault-image-prev-btn"
                            aria-label="Previous image"
                            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 border border-white/20 text-[#f3efe6] flex items-center justify-center cursor-pointer transition"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => stepImagePreview(1)}
                            data-testid="vault-image-next-btn"
                            aria-label="Next image"
                            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 border border-white/20 text-[#f3efe6] flex items-center justify-center cursor-pointer transition"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </>
                      )}

                      {activePreviewAsset.thumbnailDataUrl || activePreviewAsset.externalUrl ? (
                        <img
                          data-testid="vault-image-preview-img"
                          src={
                            activePreviewAsset.thumbnailDataUrl ||
                            activePreviewAsset.externalUrl
                          }
                          alt={activePreviewAsset.name}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="py-12 text-slate-500 text-xs">
                          No image preview available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );

          return typeof document !== 'undefined'
            ? createPortal(modalNode, document.body)
            : modalNode;
        })()}
    </div>
  );
};
