import React, { useState, useEffect, useRef } from 'react';
import { ParsedScene } from '../../../types';
import {
  ShotMovementType,
  ShotSizeCode,
  StoryboardPanelRecord,
  VisualReferenceAsset,
} from '../types';
import {
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  FolderOpen,
  FileText,
  Check,
  AlertCircle,
} from 'lucide-react';

const SHOT_SIZE_OPTIONS: Array<{ value: ShotSizeCode; label: string }> = [
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

const MOVEMENT_OPTIONS: ShotMovementType[] = [
  'Static',
  'Pan',
  'Tilt',
  'Track',
  'Dolly',
  'Steadicam',
  'Handheld',
  'Crane',
];

export interface StoryboardPanelDraftUpdates {
  title: string;
  shotSize?: ShotSizeCode;
  movement?: ShotMovementType;
  framingNotes?: string;
  actionNotes?: string;
  dialogueCue?: string;
  directorNotes?: string;
  primaryAssetId?: string;
  status: StoryboardPanelRecord['status'];
}

interface StoryboardPanelEditorDrawerProps {
  panel: StoryboardPanelRecord | null;
  scene: ParsedScene | null;
  referenceAssets: VisualReferenceAsset[];
  canEdit: boolean;
  linkedShotsCount?: number;
  onClose: () => void;
  onSave: (panelId: string, updates: StoryboardPanelDraftUpdates, closeDrawer?: boolean) => void;
  onUploadImage: (panelId: string, file: File) => Promise<void>;
  onDeletePanel: (panelId: string) => void;
  onCreateShotFromPanel?: (panel: StoryboardPanelRecord) => void;
  onOpenLinkedShots?: (sceneId: string) => void;
}

export const StoryboardPanelEditorDrawer: React.FC<StoryboardPanelEditorDrawerProps> = ({
  panel,
  scene,
  referenceAssets,
  canEdit,
  linkedShotsCount = 0,
  onClose,
  onSave,
  onUploadImage,
  onDeletePanel,
  onCreateShotFromPanel,
  onOpenLinkedShots,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(panel?.title || '');
  const [shotSize, setShotSize] = useState<ShotSizeCode | ''>(panel?.shotSize || '');
  const [movement, setMovement] = useState<ShotMovementType | ''>(panel?.movement || '');
  const [framingNotes, setFramingNotes] = useState(panel?.framingNotes || '');
  const [actionNotes, setActionNotes] = useState(panel?.actionNotes || '');
  const [dialogueCue, setDialogueCue] = useState(panel?.dialogueCue || '');
  const [directorNotes, setDirectorNotes] = useState(panel?.directorNotes || '');
  const [primaryAssetId, setPrimaryAssetId] = useState<string | undefined>(
    panel?.primaryAssetId || panel?.referenceAssetIds?.[0]
  );
  const [status, setStatus] = useState<StoryboardPanelRecord['status']>(panel?.status || 'draft');

  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imgBroken, setImgBroken] = useState(false);

  // Reset draft fields only when switching to a different panel id
  useEffect(() => {
    if (!panel) return;
    setTitle(panel.title || '');
    setShotSize(panel.shotSize || '');
    setMovement(panel.movement || '');
    setFramingNotes(panel.framingNotes || '');
    setActionNotes(panel.actionNotes || '');
    setDialogueCue(panel.dialogueCue || '');
    setDirectorNotes(panel.directorNotes || '');
    setPrimaryAssetId(panel.primaryAssetId || panel.referenceAssetIds?.[0]);
    setStatus(panel.status || 'draft');
    setShowAssetPicker(false);
    setUploadError(null);
    setImgBroken(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel?.id]);

  // Keep primaryAssetId synced when async upload finishes for the currently open panel
  useEffect(() => {
    if (!panel) return;
    setPrimaryAssetId(panel.primaryAssetId || panel.referenceAssetIds?.[0]);
    setImgBroken(false);
  }, [panel?.id, panel?.primaryAssetId]);

  if (!panel) return null;

  const activeAsset = referenceAssets.find((a) => a.id === primaryAssetId) || null;
  const activeImageSrc = activeAsset?.thumbnailDataUrl || (activeAsset?.storageProvider === 'external-url' ? activeAsset.storageRef : undefined);
  const sceneDialogueBlocks = scene?.dialogueBlocks || [];

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    onSave(panel.id, {
      title: title.trim() || `Panel ${panel.panelNumber}`,
      shotSize: shotSize || undefined,
      movement: movement || undefined,
      framingNotes: framingNotes.trim() || undefined,
      actionNotes: actionNotes.trim() || undefined,
      dialogueCue: dialogueCue.trim() || undefined,
      directorNotes: directorNotes.trim() || undefined,
      primaryAssetId: primaryAssetId || undefined,
      status,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canEdit) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      await onUploadImage(panel.id, file);
      setImgBroken(false);
    } catch (err: any) {
      setUploadError(err?.message || 'Unable to attach image file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectSharedAsset = (assetId: string) => {
    if (!canEdit) return;
    setPrimaryAssetId(assetId);
    setImgBroken(false);
    setShowAssetPicker(false);
    onSave(
      panel.id,
      {
        title: title.trim() || `Panel ${panel.panelNumber}`,
        shotSize: shotSize || undefined,
        movement: movement || undefined,
        framingNotes: framingNotes.trim() || undefined,
        actionNotes: actionNotes.trim() || undefined,
        dialogueCue: dialogueCue.trim() || undefined,
        directorNotes: directorNotes.trim() || undefined,
        primaryAssetId: assetId,
        status,
      },
      false
    );
  };

  const handleRemoveImage = () => {
    if (!canEdit) return;
    setPrimaryAssetId(undefined);
    setImgBroken(false);
    onSave(
      panel.id,
      {
        title: title.trim() || `Panel ${panel.panelNumber}`,
        shotSize: shotSize || undefined,
        movement: movement || undefined,
        framingNotes: framingNotes.trim() || undefined,
        actionNotes: actionNotes.trim() || undefined,
        dialogueCue: dialogueCue.trim() || undefined,
        directorNotes: directorNotes.trim() || undefined,
        primaryAssetId: undefined,
        status,
      },
      false
    );
  };

  return (
    <aside
      data-testid="storyboard-panel-editor-drawer"
      className="w-full sm:w-[420px] xl:w-[440px] border-l border-white/[0.08] bg-[#10131a] flex flex-col h-full shrink-0 overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.07] text-yellow-100 border border-white/10">
              Panel {panel.panelNumber}
            </span>
            <span className="text-[11px] font-mono text-slate-400 truncate">
              Sc. {panel.sceneNumber}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white truncate mt-1">
            {panel.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel editor"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Editor Form */}
      <form
        onSubmit={handleSaveSubmit}
        className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 text-xs"
      >
        {/* Visual Content Stage */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Panel Artwork / Frame
            </label>
            {activeAsset && (
              <span className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]">
                {activeAsset.originalFilename}
              </span>
            )}
          </div>

          <div className="aspect-video w-full rounded-xl bg-[#07090d] border border-white/[0.08] overflow-hidden flex items-center justify-center relative">
            {activeImageSrc && !imgBroken ? (
              <img
                src={activeImageSrc}
                alt={panel.title}
                onError={() => setImgBroken(true)}
                className="w-full h-full object-contain"
              />
            ) : activeAsset && imgBroken ? (
              <div className="text-center p-4 space-y-1.5">
                <AlertCircle className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="text-[11px] text-slate-400">Image unavailable</p>
              </div>
            ) : (
              <div className="text-center p-4 space-y-1.5">
                <ImageIcon className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-[11px] text-slate-500">No artwork attached yet</p>
              </div>
            )}
          </div>

          {uploadError && (
            <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5">
              {uploadError}
            </p>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                data-testid="storyboard-panel-image-input"
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-slate-200 font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{activeAsset ? 'Replace Image' : 'Upload Image'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAssetPicker((prev) => !prev)}
                data-testid="storyboard-toggle-library-picker"
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Reference Library ({referenceAssets.length})</span>
              </button>

              {activeAsset && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  data-testid="storyboard-remove-image-btn"
                  className="px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 font-medium transition cursor-pointer ml-auto"
                >
                  Remove Image
                </button>
              )}
            </div>
          )}

          {/* Inline Shared Reference Asset Picker */}
          {showAssetPicker && canEdit && (
            <div
              data-testid="storyboard-shared-asset-picker"
              className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2"
            >
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
                <span>Attach from Production Reference Library</span>
                <span>Links without duplicating</span>
              </div>
              {referenceAssets.length === 0 ? (
                <p className="text-[11px] text-slate-500 py-2">
                  No shared visual reference assets uploaded for this production yet. Upload an image above to add one.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {referenceAssets.map((asset) => {
                    const isPicked = asset.id === primaryAssetId;
                    const src = asset.thumbnailDataUrl || asset.storageRef;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleSelectSharedAsset(asset.id)}
                        className={`rounded-lg border overflow-hidden aspect-video bg-[#07090d] relative cursor-pointer transition ${
                          isPicked
                            ? 'border-yellow-400 ring-1 ring-yellow-400/50 shadow-[0_0_12px_rgba(250,204,21,0.3)]'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                        title={asset.originalFilename}
                      >
                        {src ? (
                          <img
                            src={src}
                            alt={asset.originalFilename}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-500 p-1 block truncate">
                            {asset.originalFilename}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel Details */}
        <div className="space-y-3.5 pt-2 border-t border-white/[0.06]">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Panel Title
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="storyboard-input-title"
              placeholder="Concise framing or beat title..."
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-400/60 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Shot Size / Framing
              </label>
              <select
                disabled={!canEdit}
                value={shotSize}
                onChange={(e) => setShotSize(e.target.value as ShotSizeCode | '')}
                data-testid="storyboard-input-shot-size"
                className="w-full px-2.5 py-2 rounded-lg bg-[#0a0d13] border border-white/10 text-white focus:border-indigo-400/60 focus:outline-none disabled:opacity-60"
              >
                <option value="">Unspecified</option>
                {SHOT_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Camera Movement
              </label>
              <select
                disabled={!canEdit}
                value={movement}
                onChange={(e) => setMovement(e.target.value as ShotMovementType | '')}
                data-testid="storyboard-input-movement"
                className="w-full px-2.5 py-2 rounded-lg bg-[#0a0d13] border border-white/10 text-white focus:border-indigo-400/60 focus:outline-none disabled:opacity-60"
              >
                <option value="">Unspecified</option>
                {MOVEMENT_OPTIONS.map((mv) => (
                  <option key={mv} value={mv}>
                    {mv}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Visual &amp; Action Description
            </label>
            <textarea
              rows={3}
              disabled={!canEdit}
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              data-testid="storyboard-input-action"
              placeholder="Describe key visual action, blocking, or composition..."
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-400/60 focus:outline-none disabled:opacity-60 resize-none"
            />
          </div>

          {/* Read-only Screenplay Connection Reference */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Dialogue / Screenplay Reference
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Read-only link</span>
            </div>
            <textarea
              rows={2}
              disabled={!canEdit}
              value={dialogueCue}
              onChange={(e) => setDialogueCue(e.target.value)}
              data-testid="storyboard-input-dialogue"
              placeholder="Attach spoken cue or beat excerpt from this scene..."
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-slate-200 placeholder-slate-500 focus:border-indigo-400/60 focus:outline-none disabled:opacity-60 resize-none"
            />

            {canEdit && sceneDialogueBlocks.length > 0 && (
              <div className="pt-0.5">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setDialogueCue(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[11px] text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="">Insert dialogue line from Scene {scene?.sceneNumber}...</option>
                  {sceneDialogueBlocks.slice(0, 30).map((blk, i) => {
                    const snippet = `${blk.character}: ${blk.text}`;
                    return (
                      <option key={i} value={snippet}>
                        {snippet.length > 72 ? `${snippet.slice(0, 70)}…` : snippet}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Framing &amp; Lens Notes
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={framingNotes}
              onChange={(e) => setFramingNotes(e.target.value)}
              data-testid="storyboard-input-framing-notes"
              placeholder="e.g. Low horizon, foreground silhouette..."
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-400/60 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Director&apos;s Notes
            </label>
            <textarea
              rows={2}
              disabled={!canEdit}
              value={directorNotes}
              onChange={(e) => setDirectorNotes(e.target.value)}
              data-testid="storyboard-input-director-notes"
              placeholder="Pacing, performance intention, continuity note..."
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-400/60 focus:outline-none disabled:opacity-60 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Review Status
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['draft', 'in-review', 'approved'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setStatus(st)}
                  className={`py-1.5 rounded-lg border text-[11px] font-medium capitalize transition cursor-pointer disabled:opacity-60 ${
                    status === st
                      ? 'bg-[#F5F000]/15 border-[#F5F000]/40 text-yellow-100'
                      : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Shot List Integration (Create distinct production Shot referencing this panel) */}
          {(onCreateShotFromPanel || linkedShotsCount > 0) && (
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[11px] text-slate-400">
                Shot List link:{' '}
                <strong className="text-slate-200 font-mono">{linkedShotsCount}</strong>{' '}
                {linkedShotsCount === 1 ? 'shot' : 'shots'}
              </div>
              <div className="flex items-center gap-1.5">
                {linkedShotsCount > 0 && onOpenLinkedShots && (
                  <button
                    type="button"
                    onClick={() => onOpenLinkedShots(panel.sceneId)}
                    className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-slate-200 cursor-pointer"
                  >
                    Open Shot List ↗
                  </button>
                )}
                {canEdit && onCreateShotFromPanel && (
                  <button
                    type="button"
                    data-testid="storyboard-create-shot-from-panel-btn"
                    onClick={() => onCreateShotFromPanel(panel)}
                    className="px-2.5 py-1 rounded-lg border border-[#FFD34E]/30 bg-[#F5F000]/10 hover:bg-[#F5F000]/20 text-[11px] font-medium text-yellow-100 cursor-pointer"
                  >
                    + Create Shot from Panel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Footer Actions */}
      <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-between gap-2 shrink-0">
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => onDeletePanel(panel.id)}
              data-testid="storyboard-delete-panel-btn"
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveSubmit}
                data-testid="storyboard-save-panel-btn"
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_12px_rgba(245,240,0,0.3)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Panel</span>
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition cursor-pointer ml-auto"
          >
            Done
          </button>
        )}
      </div>
    </aside>
  );
};
