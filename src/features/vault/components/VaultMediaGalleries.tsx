import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  FileAudio,
  FileVideo,
  Film,
  ImageOff,
  Maximize2,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import type { VaultAssetRecord, VaultCategory, VaultProductionStatus } from '../types';
import { getStatusesForVaultCategory } from '../types';
import { formatDuration, formatFileSize } from '../services/vaultMediaService';

export const VAULT_STATUS_BADGE_CLASS: Record<VaultProductionStatus, string> = {
  Raw: 'border-[#B45CFF]/30 bg-[#42156F]/50 text-[#E6C2FF]',
  Unedited: 'border-[#923BFF]/25 bg-[#191126] text-[#D18AFF]',
  'In Progress': 'border-amber-400/35 bg-amber-950/65 text-amber-200',
  Edited: 'border-[#923BFF]/35 bg-[#211632] text-[#D18AFF]',
  Unfinished: 'border-orange-400/35 bg-orange-950/65 text-orange-200',
  'Dubbing Needed': 'border-rose-400/35 bg-rose-950/65 text-rose-200',
  'Dubbing In Progress': 'border-[#B45CFF]/35 bg-[#42156F]/65 text-[#E6C2FF]',
  'Dubbing Done': 'border-emerald-400/40 bg-emerald-950/65 text-emerald-200',
  Final: 'border-[#B45CFF]/50 bg-[#42156F]/80 text-white font-bold',
};

export interface VaultInlineMetadataUpdate {
  name?: string;
  description?: string;
  tags?: string[];
  productionStatus?: VaultProductionStatus;
}

interface InlineAssetControlsProps {
  asset: VaultAssetRecord;
  canEdit: boolean;
  justSaved: boolean;
  onUpdateMetadata: (asset: VaultAssetRecord, updates: VaultInlineMetadataUpdate) => void;
  onDeleteAsset: (asset: VaultAssetRecord) => void;
  onOpenPreview: (asset: VaultAssetRecord) => void;
}

/**
 * Shared inline metadata bar rendered cleanly inside every Image, Audio, and Video tile:
 * - Click name to edit directly (Enter / Blur saves, Escape cancels)
 * - Toggle inline Description & Tags editor right inside the tile (no modal!)
 * - Category-filtered Status <select>
 */
const InlineAssetControls: React.FC<InlineAssetControlsProps> = ({
  asset,
  canEdit,
  justSaved,
  onUpdateMetadata,
  onDeleteAsset,
  onOpenPreview,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(asset.name);

  const [editingDetails, setEditingDetails] = useState(false);
  const [descDraft, setDescDraft] = useState(asset.description || '');
  const [tagsDraft, setTagsDraft] = useState((asset.tags || []).join(', '));

  const startEditName = () => {
    if (!canEdit) return;
    setNameDraft(asset.name);
    setEditingName(true);
  };

  const commitName = () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== asset.name) {
      onUpdateMetadata(asset, { name: trimmed });
    } else {
      setNameDraft(asset.name);
    }
  };

  const startEditDetails = () => {
    if (!canEdit) return;
    setDescDraft(asset.description || '');
    setTagsDraft((asset.tags || []).join(', '));
    setEditingDetails((prev) => !prev);
  };

  const saveDetails = () => {
    const parsedTags = tagsDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onUpdateMetadata(asset, {
      description: descDraft.trim() || undefined,
      tags: parsedTags,
    });
    setEditingDetails(false);
  };

  return (
    <div className="p-3 space-y-2 text-xs">
      {/* Row 1: Direct Click-to-Edit Title + Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              type="text"
              autoFocus
              value={nameDraft}
              data-testid={`vault-inline-name-input-${asset.id}`}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitName();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setNameDraft(asset.name);
                  setEditingName(false);
                }
              }}
              className="w-full px-2 py-0.5 rounded-md bg-[#0B0712] border border-[#B45CFF]/50 text-[#E6C2FF] text-xs font-medium focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={canEdit ? startEditName : () => onOpenPreview(asset)}
              data-testid={`vault-inline-name-btn-${asset.id}`}
              title={canEdit ? 'Click to rename inline' : asset.name}
              className="text-left font-semibold text-[#f3efe6] hover:text-[#D18AFF] truncate block max-w-full cursor-pointer transition-colors"
            >
              {asset.name}
            </button>
          )}

          {asset.description && !editingDetails && (
            <p className="text-[11px] text-purple-200/60 line-clamp-2 mt-0.5 leading-relaxed">
              {asset.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {justSaved && (
            <span
              data-testid={`vault-inline-saved-${asset.id}`}
              className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[9px] font-mono text-emerald-300 inline-flex items-center gap-0.5"
            >
              <Check className="w-2.5 h-2.5" />
              Saved
            </span>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={startEditDetails}
              data-testid={`vault-inline-edit-toggle-${asset.id}`}
              title="Edit description & tags inline"
              className={`p-1 rounded-lg transition cursor-pointer ${
                editingDetails
                  ? 'bg-[#B45CFF]/25 text-[#D18AFF]'
                  : 'text-purple-300/60 hover:text-[#E6C2FF] hover:bg-[#B45CFF]/10 opacity-75 group-hover:opacity-100'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              data-testid={`vault-delete-btn-${asset.id}`}
              onClick={() => onDeleteAsset(asset)}
              className="p-1 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-950/30 transition cursor-pointer opacity-75 group-hover:opacity-100"
              title="Delete asset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tags Pills */}
      {!editingDetails && asset.tags && asset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {asset.tags.slice(0, 5).map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-[10px] font-mono text-indigo-200/90"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Contextual Inline Description & Tags Editor (Replaces Separate Metadata Modal!) */}
      {editingDetails && (
        <div
          data-testid={`vault-inline-details-panel-${asset.id}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setEditingDetails(false);
            }
          }}
          className="vault-glass-surface rounded-xl p-2.5 space-y-2"
        >
          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
              Description
            </label>
            <textarea
              rows={2}
              value={descDraft}
              data-testid={`vault-inline-desc-input-${asset.id}`}
              onChange={(e) => setDescDraft(e.target.value)}
              placeholder="Notes about lighting, take, dubbing..."
              className="w-full px-2 py-1 rounded-lg bg-[#0B0712]/90 border border-[#B45CFF]/20 text-[11px] text-[#E6C2FF] resize-none focus:outline-none focus:border-[#B45CFF]/60"
            />
          </div>

          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-purple-300/60 block mb-0.5">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsDraft}
              data-testid={`vault-inline-tags-input-${asset.id}`}
              onChange={(e) => setTagsDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveDetails();
                }
              }}
              placeholder="e.g. night, neon, adr"
              className="w-full px-2 py-1 rounded-lg bg-[#0B0712]/90 border border-[#B45CFF]/20 text-[11px] text-[#E6C2FF] focus:outline-none focus:border-[#B45CFF]/60"
            />
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setEditingDetails(false)}
              data-testid={`vault-inline-cancel-${asset.id}`}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDetails}
              data-testid={`vault-inline-save-${asset.id}`}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#B45CFF] to-[#923BFF] text-white hover:brightness-110 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 shadow-sm"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
          </div>
        </div>
      )}

      {/* Row 3: Category-Specific Status Dropdown + Play/Inspect Trigger */}
      <div className="pt-2 border-t border-[#B45CFF]/15 flex items-center justify-between gap-1.5 min-w-0">
        <select
          value={asset.productionStatus}
          disabled={!canEdit}
          data-testid={`vault-status-select-${asset.id}`}
          onChange={(e) =>
            onUpdateMetadata(asset, {
              productionStatus: e.target.value as VaultProductionStatus,
            })
          }
          className="min-w-0 max-w-[125px] truncate px-2 py-1 rounded-lg bg-[#0B0712] border border-[#B45CFF]/25 text-[10.5px] font-mono text-[#E6C2FF] focus:outline-none focus:border-[#B45CFF]/60 disabled:opacity-60 cursor-pointer"
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
          onClick={() => onOpenPreview(asset)}
          className="px-2.5 py-1 rounded-lg bg-[#211632] hover:bg-[#B45CFF]/20 border border-[#B45CFF]/25 text-[11px] font-medium text-[#E6C2FF] inline-flex items-center gap-1 cursor-pointer transition"
        >
          {asset.category === 'images' || asset.category === 'graphics' ? (
            <>
              <Maximize2 className="w-3 h-3" />
              View
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              Play
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/**
 * Abstract acoustic artwork SVG seeded smoothly from filename/asset ID when custom art is absent.
 */
function AbstractAudioArtwork({ asset, isActive }: { asset: VaultAssetRecord; isActive: boolean }) {
  const palette = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < asset.name.length; i++) {
      hash = (hash * 31 + asset.name.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % 4;
    const schemes = [
      { bg1: '#10091B', bg2: '#42156F', accent1: '#B45CFF', accent2: '#D18AFF' },
      { bg1: '#191126', bg2: '#211632', accent1: '#923BFF', accent2: '#E6C2FF' },
      { bg1: '#0B0712', bg2: '#42156F', accent1: '#D18AFF', accent2: '#7628D9' },
      { bg1: '#10091B', bg2: '#211632', accent1: '#B45CFF', accent2: '#923BFF' },
    ];
    return schemes[idx];
  }, [asset.name]);

  return (
    <svg
      viewBox="0 0 400 130"
      preserveAspectRatio="none"
      className="w-full h-full block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`ag-${asset.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.bg1} />
          <stop offset="100%" stopColor={palette.bg2} />
        </linearGradient>
      </defs>
      <rect width="400" height="130" fill={`url(#ag-${asset.id})`} />
      <path
        d="M0 78 Q 70 30 140 72 T 280 65 T 400 72"
        fill="none"
        stroke={palette.accent1}
        strokeWidth={isActive ? '2.5' : '1.75'}
        strokeOpacity={isActive ? '0.9' : '0.55'}
      />
      <path
        d="M0 86 Q 90 112 180 68 T 320 76 T 400 58"
        fill="none"
        stroke={palette.accent2}
        strokeWidth={isActive ? '2.2' : '1.4'}
        strokeOpacity={isActive ? '0.85' : '0.45'}
      />
      <circle
        cx="330"
        cy="42"
        r="26"
        fill={palette.accent1}
        fillOpacity="0.10"
        stroke={palette.accent2}
        strokeOpacity="0.25"
      />
    </svg>
  );
}

interface VaultMediaGalleriesProps {
  category: VaultCategory;
  assets: VaultAssetRecord[];
  activeAssetId: string | null;
  canEdit: boolean;
  savedAssetId: string | null;
  brokenAssetIds: Record<string, boolean>;
  onMarkBroken: (assetId: string) => void;
  onUpdateMetadata: (asset: VaultAssetRecord, updates: VaultInlineMetadataUpdate) => void;
  onDeleteAsset: (asset: VaultAssetRecord) => void;
  onOpenPreview: (asset: VaultAssetRecord) => void;
}

export const VaultMediaGalleries: React.FC<VaultMediaGalleriesProps> = ({
  category,
  assets,
  activeAssetId,
  canEdit,
  savedAssetId,
  brokenAssetIds,
  onMarkBroken,
  onUpdateMetadata,
  onDeleteAsset,
  onOpenPreview,
}) => {
  // ===========================================================================
  // GALLERY 1: IMAGES — Compact, Neatly Arranged Aspect-Preserving Thumbnails
  // ===========================================================================
  if (category === 'images' || category === 'graphics') {
    return (
      <div
        id="vault-images-grid"
        data-testid="vault-gallery-images"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 pb-12"
      >
        {assets.map((asset) => {
          const src = asset.thumbnailDataUrl || asset.externalUrl;
          const broken = Boolean(brokenAssetIds[asset.id]);
          const statusClass =
            VAULT_STATUS_BADGE_CLASS[asset.productionStatus] || VAULT_STATUS_BADGE_CLASS.Raw;
          const isSelected = activeAssetId === asset.id;

          return (
            <article
              key={asset.id}
              data-vault-asset-id={asset.id}
              className={`group rounded-xl border bg-[#191126]/90 overflow-hidden flex flex-col justify-between transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl ${
                isSelected
                  ? 'border-[#B45CFF] ring-2 ring-[#B45CFF]/30 shadow-[0_0_16px_rgba(180,92,255,0.25)]'
                  : 'border-[#B45CFF]/20 hover:border-[#B45CFF]/45'
              }`}
            >
              {/* Compact Uniform Frame with 100% Aspect-Preserving Thumbnail */}
              <div
                onClick={() => onOpenPreview(asset)}
                data-testid={`vault-thumb-stage-${asset.id}`}
                title="Open larger preview"
                className="relative h-36 sm:h-40 bg-[#0B0712] flex items-center justify-center p-2 cursor-pointer overflow-hidden border-b border-[#B45CFF]/15"
              >
                {src && !broken ? (
                  <img
                    src={src}
                    alt={asset.name}
                    loading="lazy"
                    decoding="async"
                    onError={() => onMarkBroken(asset.id)}
                    className="max-w-full max-h-full w-auto h-auto object-contain rounded block transition-transform duration-150 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-purple-300/40">
                    <ImageOff className="w-5 h-5" />
                    <span className="text-[11px]">Preview unavailable</span>
                  </div>
                )}

                <span
                  className={`vault-glass-pill absolute top-2 left-2 px-1.5 py-0.5 rounded-full border text-[9px] font-mono ${statusClass}`}
                >
                  {asset.productionStatus}
                </span>

                {(asset.category === 'graphics' || asset.mimeType === 'image/svg+xml') && (
                  <span className="vault-glass-pill absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-mono text-[#D18AFF] border border-[#B45CFF]/30 uppercase bg-[#42156F]/60">
                    Graphic
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B0712]/90 via-[#0B0712]/40 to-transparent px-2.5 pb-1.5 pt-5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none flex items-end justify-between text-[9.5px] font-mono text-purple-200/80">
                  <span>
                    {asset.width && asset.height
                      ? `${asset.width}×${asset.height}`
                      : asset.detectedContainer || 'IMAGE'}
                  </span>
                  <span>{formatFileSize(asset.fileSizeBytes)}</span>
                </div>
              </div>

              <InlineAssetControls
                asset={asset}
                canEdit={canEdit}
                justSaved={savedAssetId === asset.id}
                onUpdateMetadata={onUpdateMetadata}
                onDeleteAsset={onDeleteAsset}
                onOpenPreview={onOpenPreview}
              />
            </article>
          );
        })}
      </div>
    );
  }

  // ===========================================================================
  // GALLERY 2: AUDIO — Expressive Studio Wave Collection Tiles
  // ===========================================================================
  if (category === 'audio') {
    return (
      <div
        id="vault-audio-collection"
        data-testid="vault-gallery-audio"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-12"
      >
        {assets.map((asset) => {
          const isActive = activeAssetId === asset.id;
          const statusClass =
            VAULT_STATUS_BADGE_CLASS[asset.productionStatus] || VAULT_STATUS_BADGE_CLASS.Raw;

          return (
            <article
              key={asset.id}
              data-vault-asset-id={asset.id}
              className={`group rounded-2xl border bg-[#191126]/90 overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${
                isActive
                  ? 'border-[#B45CFF] ring-2 ring-[#B45CFF]/30 shadow-[0_0_18px_rgba(180,92,255,0.25)]'
                  : 'border-[#B45CFF]/20 hover:border-[#B45CFF]/45'
              }`}
            >
              {/* Expressive Waveform Artwork Stage */}
              <div
                onClick={() => onOpenPreview(asset)}
                className="relative h-32 cursor-pointer overflow-hidden border-b border-[#B45CFF]/15"
              >
                {asset.thumbnailDataUrl ? (
                  <img
                    src={asset.thumbnailDataUrl}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AbstractAudioArtwork asset={asset} isActive={isActive} />
                )}

                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                  <span
                    className={`vault-glass-pill px-2 py-0.5 rounded-full border text-[10px] font-mono ${statusClass}`}
                  >
                    {asset.productionStatus}
                  </span>

                  <span className="vault-glass-pill px-2 py-0.5 rounded-full text-[10px] font-mono text-[#D18AFF] border border-[#B45CFF]/25 bg-[#42156F]/60">
                    {asset.detectedContainer || 'AUDIO'} · {formatDuration(asset.durationSeconds)}
                  </span>
                </div>

                {/* Floating Glass Play Trigger */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="vault-glass-pill w-11 h-11 rounded-full flex items-center justify-center text-[#E6C2FF] group-hover:scale-105 group-hover:border-[#B45CFF]/60 transition-transform shadow-xl bg-[#211632]/80 border border-[#B45CFF]/30">
                    <Play className="w-4 h-4 ml-0.5 text-[#D18AFF]" />
                  </span>
                </div>

                <div className="absolute bottom-2 right-2.5 text-[10px] font-mono text-purple-200/90">
                  {isActive ? (
                    <span className="text-emerald-300 font-semibold">NOW ACTIVE</span>
                  ) : (
                    formatFileSize(asset.fileSizeBytes)
                  )}
                </div>
              </div>

              <InlineAssetControls
                asset={asset}
                canEdit={canEdit}
                justSaved={savedAssetId === asset.id}
                onUpdateMetadata={onUpdateMetadata}
                onDeleteAsset={onDeleteAsset}
                onOpenPreview={onOpenPreview}
              />
            </article>
          );
        })}
      </div>
    );
  }

  // ===========================================================================
  // GALLERY 3: VIDEO — Cinema Screening Gallery
  // ===========================================================================
  return (
    <div
      id="vault-video-cinema"
      data-testid="vault-gallery-video"
      className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12"
    >
      {assets.map((asset) => {
        const isActive = activeAssetId === asset.id;
        const statusClass =
          VAULT_STATUS_BADGE_CLASS[asset.productionStatus] || VAULT_STATUS_BADGE_CLASS.Raw;

        return (
          <article
            key={asset.id}
            data-vault-asset-id={asset.id}
            className={`group rounded-2xl border bg-[#191126]/90 overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${
              isActive
                ? 'border-[#B45CFF] ring-2 ring-[#B45CFF]/30 shadow-[0_0_18px_rgba(180,92,255,0.25)]'
                : 'border-[#B45CFF]/20 hover:border-[#B45CFF]/45'
            }`}
          >
            {/* Cinematic Thumbnail Frame */}
            <div
              onClick={() => onOpenPreview(asset)}
              className="relative aspect-video bg-gradient-to-br from-[#191126] via-[#10091B] to-[#211632] cursor-pointer overflow-hidden border-b border-[#B45CFF]/15 flex items-center justify-center"
            >
              {asset.thumbnailDataUrl ? (
                <img
                  src={asset.thumbnailDataUrl}
                  alt={asset.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-purple-300/60">
                  <Film className="w-8 h-8 text-[#D18AFF]/60" />
                  <span className="text-[11px] font-mono">
                    {asset.playbackSupport === 'unsupported'
                      ? `${asset.detectedContainer || 'VIDEO'} (External Playback / Download)`
                      : `${asset.detectedContainer || 'VIDEO'} Reel`}
                  </span>
                </div>
              )}

              {/* Top Overlay Pills */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                <span
                  className={`vault-glass-pill px-2.5 py-0.5 rounded-full border text-[10px] font-mono ${statusClass}`}
                >
                  {asset.productionStatus}
                </span>

                <span className="vault-glass-pill px-2.5 py-0.5 rounded-full text-[10px] font-mono text-[#E6C2FF] border border-[#B45CFF]/25 bg-[#42156F]/60">
                  {asset.detectedContainer || 'VIDEO'}
                  {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                </span>
              </div>

              {/* Center Play Affordance */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="vault-glass-bar w-14 h-14 rounded-full flex items-center justify-center text-[#E6C2FF] group-hover:scale-105 transition-transform shadow-2xl bg-[#211632]/80 border border-[#B45CFF]/40">
                  <Play className="w-5 h-5 ml-0.5 text-[#D18AFF]" />
                </span>
              </div>

              {/* Bottom Duration & File Size */}
              <div className="absolute bottom-2.5 right-3 vault-glass-pill px-2 py-0.5 rounded-full text-[10px] font-mono text-purple-200/90 pointer-events-none border border-[#B45CFF]/20 bg-[#10091B]/80">
                {formatDuration(asset.durationSeconds)} · {formatFileSize(asset.fileSizeBytes)}
              </div>
            </div>

            <InlineAssetControls
              asset={asset}
              canEdit={canEdit}
              justSaved={savedAssetId === asset.id}
              onUpdateMetadata={onUpdateMetadata}
              onDeleteAsset={onDeleteAsset}
              onOpenPreview={onOpenPreview}
            />
          </article>
        );
      })}
    </div>
  );
};
