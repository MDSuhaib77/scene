import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  FolderOpen,
  ImageOff,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type { VisualReferenceAsset } from '../types';

interface SharedReferencePickerModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  referenceAssets: VisualReferenceAsset[];
  alreadyAttachedAssetIds?: string[];
  canEdit: boolean;
  onClose: () => void;
  onSelectAsset: (assetId: string) => void;
  onUploadNewAsset: (file: File) => Promise<void>;
}

export const SharedReferencePickerModal: React.FC<SharedReferencePickerModalProps> = ({
  isOpen,
  title,
  subtitle,
  referenceAssets,
  alreadyAttachedAssetIds = [],
  canEdit,
  onClose,
  onSelectAsset,
  onUploadNewAsset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});

  const attachedSet = useMemo(
    () => new Set(alreadyAttachedAssetIds),
    [alreadyAttachedAssetIds]
  );

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return referenceAssets;
    return referenceAssets.filter((a) =>
      [a.originalFilename, a.description, a.source, ...(a.tags || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [referenceAssets, query]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file || !canEdit) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      await onUploadNewAsset(file);
    } catch (err: any) {
      setUploadError(err?.message || 'Unable to upload reference image.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      data-testid="shared-reference-picker-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-text"
    >
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-white/[0.1] bg-[#120f06]/95 backdrop-blur-2xl border border-[#F5F000]/35 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] bg-[#141005]/90 border-b border-[#FFD34E]/25 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-yellow-100 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-yellow-400" />
              {title}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {subtitle ||
                'Reuse existing production assets or upload new imagery into the shared Reference Library.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reference picker"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload & Search Bar */}
        <div className="px-5 py-3 border-b border-white/[0.06] bg-[#0c0f16] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shared assets by filename, source, or tag..."
              className="w-full rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 pl-8 pr-2.5 py-1.5 text-xs text-yellow-100 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40"
            />
          </div>

          {canEdit && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                data-testid="shared-picker-upload-input"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploading}
                data-testid="shared-picker-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? 'Uploading...' : 'Upload New Reference'}
              </button>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="mx-5 mt-3 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {uploadError}
          </div>
        )}

        {/* Shared Assets Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {filteredAssets.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs text-slate-400">
                {referenceAssets.length === 0
                  ? 'No visual reference assets uploaded for this production yet.'
                  : 'No assets match your search filter.'}
              </p>
              {canEdit && referenceAssets.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  Upload an image above to add it to this collection and make it reusable across Storyboards, Shot Lists, Camera Setups, and Boards.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredAssets.map((asset) => {
                const src = asset.thumbnailDataUrl || asset.storageRef;
                const isBroken = Boolean(brokenIds[asset.id]);
                const alreadyLinked = attachedSet.has(asset.id);

                return (
                  <button
                    key={asset.id}
                    type="button"
                    data-testid={`shared-asset-option-${asset.id}`}
                    onClick={() => onSelectAsset(asset.id)}
                    className={`group rounded-xl border text-left overflow-hidden flex flex-col bg-[#1F2226] border border-[#FFD34E]/25 transition cursor-pointer ${
                      alreadyLinked
                        ? 'border-[#F5F000]/45 ring-1 ring-[#F5F000]/30'
                        : 'border-white/10 hover:border-[#F5F000]/50'
                    }`}
                  >
                    <div className="aspect-video w-full bg-[#0A0B0D] flex items-center justify-center overflow-hidden relative border-b border-white/[0.06]">
                      {src && !isBroken ? (
                        <img
                          src={src}
                          alt={asset.originalFilename}
                          onError={() =>
                            setBrokenIds((prev) => ({ ...prev, [asset.id]: true }))
                          }
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-500">
                          <ImageOff className="w-4 h-4" />
                          <span className="text-[10px]">Unavailable</span>
                        </div>
                      )}
                      {alreadyLinked && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)] text-[9px] font-semibold inline-flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" />
                          Linked
                        </span>
                      )}
                    </div>
                    <div className="p-2 min-w-0">
                      <div className="text-[11px] font-medium text-yellow-100 truncate">
                        {asset.originalFilename}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                        {asset.source || 'Reference Library'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.08] bg-[#141005]/90 border-b border-[#FFD34E]/25 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>
            {referenceAssets.length} production-scoped shared{' '}
            {referenceAssets.length === 1 ? 'asset' : 'assets'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

interface AttachedReferencesFieldProps {
  label: string;
  attachedAssetIds: string[];
  referenceAssets: VisualReferenceAsset[];
  canEdit: boolean;
  onOpenPicker: () => void;
  onRemoveAsset: (assetId: string) => void;
  testIdPrefix: string;
}

export const AttachedReferencesField: React.FC<AttachedReferencesFieldProps> = ({
  label,
  attachedAssetIds,
  referenceAssets,
  canEdit,
  onOpenPicker,
  onRemoveAsset,
  testIdPrefix,
}) => {
  const assetById = useMemo(() => {
    const map = new Map<string, VisualReferenceAsset>();
    referenceAssets.forEach((a) => map.set(a.id, a));
    return map;
  }, [referenceAssets]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
          {label} ({attachedAssetIds.length})
        </span>
        {canEdit && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-attach-ref-btn`}
            onClick={onOpenPicker}
            className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-medium text-yellow-400 transition cursor-pointer"
          >
            + Attach from Vault
          </button>
        )}
      </div>

      {attachedAssetIds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/40 border border-[#FFD34E]/20/60 px-3 py-2 text-[11px] text-slate-500">
          No Vault references linked yet. Attach existing Vault images or upload once into the shared library.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {attachedAssetIds.map((assetId) => {
            const asset = assetById.get(assetId);
            const src = asset?.thumbnailDataUrl || asset?.storageRef || '';
            return (
              <div
                key={assetId}
                data-testid={`${testIdPrefix}-ref-chip-${assetId}`}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25/80 p-1.5 pr-2 max-w-full"
              >
                {src && !src.startsWith('vault://') ? (
                  <img
                    src={src}
                    alt={asset?.originalFilename || 'Linked reference'}
                    loading="lazy"
                    decoding="async"
                    className="w-8 h-8 rounded object-cover bg-[#0A0B0D] border border-white/10 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#0A0B0D] border border-white/10 flex items-center justify-center shrink-0">
                    <ImageOff className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-yellow-100 truncate max-w-[140px]">
                    {asset?.originalFilename || 'Linked Vault Asset'}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 truncate">
                    {asset?.source || 'Vault'}
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemoveAsset(assetId)}
                    title="Unlink reference"
                    className="p-1 rounded text-slate-400 hover:text-rose-300 cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
