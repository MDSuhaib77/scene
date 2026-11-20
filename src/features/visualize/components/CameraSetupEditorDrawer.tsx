import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Link2Off,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { CameraSetup, ShotPlanRecord, VisualReferenceAsset } from '../types';
import { AttachedReferencesField } from './SharedReferencePickerModal';

export interface CameraSetupDraftValues {
  name: string;
  cameraBody?: string;
  lensSeries?: string;
  focalLengthMm?: string;
  supportRig?: string;
  placementNotes?: string;
  movementConfig?: string;
  notes?: string;
  referenceAssetIds?: string[];
}

interface CameraSetupEditorDrawerProps {
  /** 'create' when creating a brand-new setup, or a CameraSetup object when editing */
  setup: CameraSetup | null;
  isCreating: boolean;
  associatedShots: ShotPlanRecord[];
  allProductionShots: ShotPlanRecord[];
  referenceAssets?: VisualReferenceAsset[];
  pendingCreateReferenceIds?: string[];
  canEdit: boolean;
  onClose: () => void;
  onCreate: (values: CameraSetupDraftValues) => void;
  onUpdate: (setupId: string, values: CameraSetupDraftValues) => void;
  onDelete: (setupId: string) => void;
  onAssignShot: (setupId: string, shotId: string) => void;
  onUnlinkShot: (shotId: string) => void;
  onJumpToShot: (shot: ShotPlanRecord) => void;
  onOpenReferencePicker?: () => void;
  onRemovePendingCreateRef?: (assetId: string) => void;
}

export const CameraSetupEditorDrawer: React.FC<CameraSetupEditorDrawerProps> = ({
  setup,
  isCreating,
  associatedShots,
  allProductionShots,
  referenceAssets = [],
  pendingCreateReferenceIds = [],
  canEdit,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onAssignShot,
  onUnlinkShot,
  onJumpToShot,
  onOpenReferencePicker,
  onRemovePendingCreateRef,
}) => {
  const [name, setName] = useState(setup?.name || '');
  const [cameraBody, setCameraBody] = useState(setup?.cameraBody || '');
  const [lensSeries, setLensSeries] = useState(setup?.lensSeries || '');
  const [focalLengthMm, setFocalLengthMm] = useState(setup?.focalLengthMm || '');
  const [supportRig, setSupportRig] = useState(setup?.supportRig || '');
  const [placementNotes, setPlacementNotes] = useState(setup?.placementNotes || '');
  const [movementConfig, setMovementConfig] = useState(setup?.movementConfig || '');
  const [notes, setNotes] = useState(setup?.notes || '');
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>(
    setup?.referenceAssetIds || []
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [shotToAssignId, setShotToAssignId] = useState('');

  useEffect(() => {
    if (!isCreating && !setup) return;
    setName(setup?.name || '');
    setCameraBody(setup?.cameraBody || '');
    setLensSeries(setup?.lensSeries || '');
    setFocalLengthMm(setup?.focalLengthMm || '');
    setSupportRig(setup?.supportRig || '');
    setPlacementNotes(setup?.placementNotes || '');
    setMovementConfig(setup?.movementConfig || '');
    setNotes(setup?.notes || '');
    setReferenceAssetIds(setup?.referenceAssetIds || []);
    setValidationError(null);
    setConfirmingDelete(false);
    setShotToAssignId('');
  }, [isCreating, setup?.id]);

  useEffect(() => {
    if (!isCreating) {
      setReferenceAssetIds(setup?.referenceAssetIds || []);
    }
  }, [isCreating, setup?.referenceAssetIds]);

  if (!isCreating && !setup) return null;

  const assignableShots = setup
    ? allProductionShots.filter((s) => s.cameraSetupId !== setup.id)
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setValidationError('Setup name or identifier is required.');
      return;
    }
    const payload: CameraSetupDraftValues = {
      name: cleanName,
      cameraBody: cameraBody.trim() || undefined,
      lensSeries: lensSeries.trim() || undefined,
      focalLengthMm: focalLengthMm.trim() || undefined,
      supportRig: supportRig.trim() || undefined,
      placementNotes: placementNotes.trim() || undefined,
      movementConfig: movementConfig.trim() || undefined,
      notes: notes.trim() || undefined,
      referenceAssetIds: isCreating
        ? pendingCreateReferenceIds.length
          ? pendingCreateReferenceIds
          : undefined
        : referenceAssetIds.length
          ? referenceAssetIds
          : undefined,
    };
    if (isCreating) {
      onCreate(payload);
    } else if (setup) {
      onUpdate(setup.id, payload);
    }
  };

  return (
    <aside
      data-testid="camera-setup-editor-drawer"
      className="w-full sm:w-[420px] xl:w-[440px] border-l border-white/[0.08] bg-[#10131a] flex flex-col h-full shrink-0 overflow-hidden shadow-2xl select-text"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)] inline-flex items-center gap-1">
              <Video className="w-3 h-3" />
              {isCreating ? 'New Setup' : 'Camera Setup'}
            </span>
            {!isCreating && setup && (
              <span className="text-[11px] font-mono text-slate-400">
                {associatedShots.length} {associatedShots.length === 1 ? 'shot' : 'shots'}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-yellow-100 truncate mt-1">
            {isCreating ? 'Define Reusable Camera Setup' : setup?.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera setup editor"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Body */}
      <form
        id="camera-setup-form"
        onSubmit={handleSubmit}
        className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 text-xs"
      >
        {validationError && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-rose-200 text-[11px]">
            {validationError}
          </div>
        )}

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Setup Name / Identifier <span className="text-slate-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            disabled={!canEdit}
            onChange={(e) => {
              setName(e.target.value);
              if (validationError) setValidationError(null);
            }}
            data-testid="setup-input-name"
            placeholder="e.g. Setup A — Window Master (South)"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Camera Body
            </label>
            <input
              type="text"
              value={cameraBody}
              disabled={!canEdit}
              onChange={(e) => setCameraBody(e.target.value)}
              data-testid="setup-input-body"
              placeholder="e.g. ARRI Alexa 35"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Support / Rig
            </label>
            <input
              type="text"
              value={supportRig}
              disabled={!canEdit}
              onChange={(e) => setSupportRig(e.target.value)}
              data-testid="setup-input-rig"
              placeholder="e.g. Chapman Dolly, Heavy Sticks"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Lens Package / Series
            </label>
            <input
              type="text"
              value={lensSeries}
              disabled={!canEdit}
              onChange={(e) => setLensSeries(e.target.value)}
              data-testid="setup-input-lens"
              placeholder="e.g. Cooke Anamorphic /i"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Default Focal Length
            </label>
            <input
              type="text"
              value={focalLengthMm}
              disabled={!canEdit}
              onChange={(e) => setFocalLengthMm(e.target.value)}
              data-testid="setup-input-focal"
              placeholder="e.g. 40mm"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Position / Placement Notes
          </label>
          <input
            type="text"
            value={placementNotes}
            disabled={!canEdit}
            onChange={(e) => setPlacementNotes(e.target.value)}
            data-testid="setup-input-placement"
            placeholder="e.g. North doorway looking south-west toward brass console"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Movement / Operating Configuration
          </label>
          <input
            type="text"
            value={movementConfig}
            disabled={!canEdit}
            onChange={(e) => setMovementConfig(e.target.value)}
            data-testid="setup-input-movement-config"
            placeholder="e.g. 12ft Straight Track, OConnor 2575D"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Technical Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            disabled={!canEdit}
            onChange={(e) => setNotes(e.target.value)}
            data-testid="setup-input-notes"
            placeholder="ND strength, filtration, slate clearance, height notes..."
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60 resize-none"
          />
        </div>

        {onOpenReferencePicker && (
          <div className="pt-2">
            <AttachedReferencesField
              label="Setup Diagram / Vault References"
              attachedAssetIds={isCreating ? pendingCreateReferenceIds : referenceAssetIds}
              referenceAssets={referenceAssets}
              canEdit={canEdit}
              onOpenPicker={onOpenReferencePicker}
              onRemoveAsset={(assetId) => {
                if (isCreating) {
                  onRemovePendingCreateRef?.(assetId);
                } else {
                  setReferenceAssetIds((prev) => prev.filter((id) => id !== assetId));
                }
              }}
              testIdPrefix="setup"
            />
          </div>
        )}

        {/* Associated Shots Section (Edit mode only) */}
        {!isCreating && setup && (
          <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Associated Shots ({associatedShots.length})
              </span>
            </div>

            {associatedShots.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/40 border border-[#FFD34E]/20 text-yellow-100/60 p-3 text-[11px] text-slate-500">
                No shots assigned to this setup yet. Assign shots below or from the Shot List editor.
              </div>
            ) : (
              <div className="space-y-1.5">
                {associatedShots.map((shot) => (
                  <div
                    key={shot.id}
                    className="rounded-lg border border-white/[0.08] bg-[#1F2226] border border-[#FFD34E]/25/70 px-2.5 py-2 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => onJumpToShot(shot)}
                      className="min-w-0 flex-1 text-left hover:text-white cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.08] text-yellow-100">
                          SC {shot.sceneNumber} · #{shot.shotNumber}
                        </span>
                        {shot.shotSize && (
                          <span className="font-mono text-[10px] text-slate-400">
                            {shot.shotSize}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-300 truncate mt-0.5">
                        {shot.description}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onJumpToShot(shot)}
                        title="Inspect in Shot List"
                        className="p-1.5 rounded text-slate-400 hover:text-white cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onUnlinkShot(shot.id)}
                          title="Remove association without deleting shot or setup"
                          className="p-1.5 rounded text-slate-400 hover:text-amber-300 cursor-pointer"
                        >
                          <Link2Off className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Multi-Shot Assigner */}
            {canEdit && assignableShots.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                <select
                  value={shotToAssignId}
                  onChange={(e) => setShotToAssignId(e.target.value)}
                  data-testid="setup-assign-shot-select"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-black/40 border border-[#FFD34E]/20 text-yellow-100 border border-white/10 text-slate-300 text-[11px] focus:outline-none"
                >
                  <option value="">Assign existing shot to this setup...</option>
                  {assignableShots.map((s) => (
                    <option key={s.id} value={s.id}>
                      SC {s.sceneNumber} · Shot {s.shotNumber} — {s.description.slice(0, 42)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!shotToAssignId}
                  data-testid="setup-assign-shot-btn"
                  onClick={() => {
                    if (!shotToAssignId) return;
                    onAssignShot(setup.id, shotToAssignId);
                    setShotToAssignId('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#1F2226] border border-[#FFD34E]/25 text-[11px] text-yellow-100 hover:border-white/30 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Assign
                </button>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Footer Actions */}
      <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#15171A] border border-[#FFD34E]/20 space-y-2.5 shrink-0">
        {confirmingDelete && setup && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-950/30 p-2.5 text-[11px] text-rose-100 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              <span>
                {associatedShots.length > 0
                  ? `${associatedShots.length} associated shot${
                      associatedShots.length === 1 ? '' : 's'
                    } will become unassigned. Shot records will remain intact.`
                  : `Delete setup "${setup.name}"?`}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-2.5 py-1 rounded border border-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="setup-delete-confirm-btn"
                onClick={() => onDelete(setup.id)}
                className="px-2.5 py-1 rounded bg-rose-500/30 border border-rose-400/40 text-rose-100 font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {!isCreating && setup && canEdit && !confirmingDelete ? (
            <button
              type="button"
              data-testid="setup-delete-btn"
              onClick={() => setConfirmingDelete(true)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              Close
            </button>
            {canEdit && (
              <button
                type="submit"
                form="camera-setup-form"
                data-testid="setup-save-btn"
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_12px_rgba(245,240,0,0.3)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow"
              >
                <Check className="w-3.5 h-3.5" />
                {isCreating ? 'Create Setup' : 'Save Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
