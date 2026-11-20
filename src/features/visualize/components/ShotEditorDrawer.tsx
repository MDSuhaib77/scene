import React, { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Link2Off,
  Trash2,
  X,
  Check,
  Video,
} from 'lucide-react';
import type { ParsedScene } from '../../../types';
import type {
  CameraSetup,
  ShotCameraAngle,
  ShotMovementType,
  ShotPlanRecord,
  ShotSizeCode,
  StoryboardPanelRecord,
  VisualReferenceAsset,
} from '../types';
import {
  VISUALIZE_CAMERA_ANGLE_OPTIONS,
  VISUALIZE_MOVEMENT_OPTIONS,
  VISUALIZE_SHOT_SIZE_OPTIONS,
} from '../services/visualizeFoundationService';
import { AttachedReferencesField } from './SharedReferencePickerModal';

export interface ShotDraftUpdates {
  description: string;
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
  status: ShotPlanRecord['status'];
}

interface ShotEditorDrawerProps {
  shot: ShotPlanRecord | null;
  scene: ParsedScene | null;
  allScenes: ParsedScene[];
  cameraSetups: CameraSetup[];
  sceneStoryboardPanels: StoryboardPanelRecord[];
  referenceAssets: VisualReferenceAsset[];
  canEdit: boolean;
  onClose: () => void;
  onSave: (shotId: string, updates: ShotDraftUpdates) => void;
  onDeleteShot: (shotId: string) => void;
  onMoveShotToScene: (shotId: string, targetSceneId: string) => void;
  onOpenStoryboardPanel?: (sceneId: string, panelId: string) => void;
  onOpenCameraSetup?: (setupId: string) => void;
  onOpenReferencePicker?: () => void;
}

export const ShotEditorDrawer: React.FC<ShotEditorDrawerProps> = ({
  shot,
  scene,
  allScenes,
  cameraSetups,
  sceneStoryboardPanels,
  referenceAssets,
  canEdit,
  onClose,
  onSave,
  onDeleteShot,
  onMoveShotToScene,
  onOpenStoryboardPanel,
  onOpenCameraSetup,
  onOpenReferencePicker,
}) => {
  const [description, setDescription] = useState(shot?.description || '');
  const [shotSize, setShotSize] = useState<ShotSizeCode | ''>(shot?.shotSize || '');
  const [cameraAngle, setCameraAngle] = useState<ShotCameraAngle | ''>(shot?.cameraAngle || '');
  const [movement, setMovement] = useState<ShotMovementType | ''>(shot?.movement || '');
  const [focalLengthMm, setFocalLengthMm] = useState(shot?.focalLengthMm || '');
  const [framingNotes, setFramingNotes] = useState(shot?.framingNotes || '');
  const [cameraNotes, setCameraNotes] = useState(shot?.cameraNotes || '');
  const [linkedCharacters, setLinkedCharacters] = useState<string[]>(
    shot?.linkedCharacters || []
  );
  const [cameraSetupId, setCameraSetupId] = useState<string>(shot?.cameraSetupId || '');
  const [storyboardPanelId, setStoryboardPanelId] = useState<string>(
    shot?.storyboardPanelId || ''
  );
  const [referenceAssetIds, setReferenceAssetIds] = useState<string[]>(
    shot?.referenceAssetIds || []
  );
  const [status, setStatus] = useState<ShotPlanRecord['status']>(shot?.status || 'planned');

  const [showTechSpecs, setShowTechSpecs] = useState(false);
  const [moveTargetSceneId, setMoveTargetSceneId] = useState<string>('');
  const [confirmingMove, setConfirmingMove] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!shot) return;
    setDescription(shot.description || '');
    setShotSize(shot.shotSize || '');
    setCameraAngle(shot.cameraAngle || '');
    setMovement(shot.movement || '');
    setFocalLengthMm(shot.focalLengthMm || '');
    setFramingNotes(shot.framingNotes || '');
    setCameraNotes(shot.cameraNotes || '');
    setLinkedCharacters(shot.linkedCharacters || []);
    setCameraSetupId(shot.cameraSetupId || '');
    setStoryboardPanelId(shot.storyboardPanelId || '');
    setReferenceAssetIds(shot.referenceAssetIds || []);
    setStatus(shot.status || 'planned');
    setShowTechSpecs(
      Boolean(
        shot.focalLengthMm ||
          shot.framingNotes ||
          shot.cameraNotes ||
          (shot.linkedCharacters && shot.linkedCharacters.length > 0)
      )
    );
    setMoveTargetSceneId('');
    setConfirmingMove(false);
    setConfirmingDelete(false);
  }, [shot?.id]);

  useEffect(() => {
    setReferenceAssetIds(shot?.referenceAssetIds || []);
  }, [shot?.referenceAssetIds]);

  if (!shot) return null;

  const selectedSetup = cameraSetups.find((c) => c.id === cameraSetupId) || null;
  const linkedPanel =
    sceneStoryboardPanels.find((p) => p.id === storyboardPanelId) || null;
  const linkedPanelAsset = linkedPanel?.primaryAssetId
    ? referenceAssets.find((a) => a.id === linkedPanel.primaryAssetId) || null
    : null;
  const availableSceneCharacters = scene?.characters || [];
  const otherScenes = allScenes.filter((s) => s.id !== shot.sceneId);

  const toggleCharacter = (charName: string) => {
    if (!canEdit) return;
    setLinkedCharacters((prev) =>
      prev.includes(charName)
        ? prev.filter((c) => c !== charName)
        : [...prev, charName]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    onSave(shot.id, {
      description: description.trim() || shot.description,
      shotSize: shotSize || undefined,
      cameraAngle: cameraAngle || undefined,
      movement: movement || undefined,
      focalLengthMm: focalLengthMm.trim() || undefined,
      framingNotes: framingNotes.trim() || undefined,
      cameraNotes: cameraNotes.trim() || undefined,
      linkedCharacters: linkedCharacters.length ? linkedCharacters : undefined,
      cameraSetupId: cameraSetupId || undefined,
      storyboardPanelId: storyboardPanelId || undefined,
      referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
      status,
    });
  };

  return (
    <aside
      data-testid="shot-editor-drawer"
      className="w-full sm:w-[420px] xl:w-[440px] border-l border-white/[0.08] bg-[#10131a] flex flex-col h-full shrink-0 overflow-hidden shadow-2xl select-text"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)]">
              Shot {shot.shotNumber}
            </span>
            <span className="text-[11px] font-mono text-slate-400 truncate">
              SC {scene?.sceneNumber || shot.sceneNumber}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-yellow-100 truncate mt-1">
            {scene?.slugline || `Scene ${shot.sceneNumber}`}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close shot editor"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Editor Body */}
      <form
        id="shot-editor-form"
        onSubmit={handleSubmit}
        className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 text-xs"
      >
        {/* 1-4. Essential Production Shot Fields First */}
        <div className="space-y-3.5">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Shot Description
            </label>
            <textarea
              rows={2}
              value={description}
              disabled={!canEdit}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="shot-input-description"
              placeholder="What is the camera capturing in this beat?"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Shot Size
              </label>
              <select
                value={shotSize}
                disabled={!canEdit}
                onChange={(e) => setShotSize(e.target.value as ShotSizeCode | '')}
                data-testid="shot-input-size"
                className="w-full px-2 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
              >
                <option value="">Any</option>
                {VISUALIZE_SHOT_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Angle
              </label>
              <select
                value={cameraAngle}
                disabled={!canEdit}
                onChange={(e) => setCameraAngle(e.target.value as ShotCameraAngle | '')}
                data-testid="shot-input-angle"
                className="w-full px-2 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
              >
                <option value="">Any</option>
                {VISUALIZE_CAMERA_ANGLE_OPTIONS.map((ang) => (
                  <option key={ang} value={ang}>
                    {ang}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Movement
              </label>
              <select
                value={movement}
                disabled={!canEdit}
                onChange={(e) => setMovement(e.target.value as ShotMovementType | '')}
                data-testid="shot-input-movement"
                className="w-full px-2 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
              >
                <option value="">Any</option>
                {VISUALIZE_MOVEMENT_OPTIONS.map((mv) => (
                  <option key={mv} value={mv}>
                    {mv}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Shot Status
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['planned', 'ready', 'completed'] as const).map((st) => {
                const active = status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setStatus(st)}
                    data-testid={`shot-status-${st}`}
                    className={`py-1.5 rounded-lg border text-[11px] font-medium capitalize transition cursor-pointer disabled:opacity-60 ${
                      active
                        ? 'bg-[#F5F000]/15 border-[#F5F000]/40 text-yellow-100'
                        : 'bg-black/40 border border-[#FFD34E]/20 text-yellow-100 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 6. Camera Setup Association */}
        <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-slate-400" />
              Camera Setup Association
            </label>
            {cameraSetupId && canEdit && (
              <button
                type="button"
                data-testid="shot-unlink-setup-btn"
                onClick={() => setCameraSetupId('')}
                className="text-[11px] text-slate-400 hover:text-yellow-100 inline-flex items-center gap-1 cursor-pointer"
              >
                <Link2Off className="w-3 h-3" />
                Unlink setup
              </button>
            )}
          </div>

          <select
            value={cameraSetupId}
            disabled={!canEdit}
            onChange={(e) => setCameraSetupId(e.target.value)}
            data-testid="shot-select-setup"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
          >
            <option value="">No camera setup assigned</option>
            {cameraSetups.map((setup) => (
              <option key={setup.id} value={setup.id}>
                {setup.name}
                {setup.cameraBody || setup.lensSeries
                  ? ` (${[setup.cameraBody, setup.lensSeries].filter(Boolean).join(' · ')})`
                  : ''}
              </option>
            ))}
          </select>

          {selectedSetup && (
            <div className="rounded-lg border border-white/[0.08] bg-[#1F2226] border border-[#FFD34E]/25/70 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
              <div className="min-w-0">
                <div className="font-medium text-yellow-100 truncate">{selectedSetup.name}</div>
                <div className="text-slate-400 truncate">
                  {[
                    selectedSetup.cameraBody,
                    selectedSetup.lensSeries,
                    selectedSetup.focalLengthMm,
                    selectedSetup.supportRig,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Reusable setup linked'}
                </div>
              </div>
              {onOpenCameraSetup && (
                <button
                  type="button"
                  onClick={() => onOpenCameraSetup(selectedSetup.id)}
                  className="shrink-0 px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-yellow-100 hover:border-white/25 inline-flex items-center gap-1"
                >
                  Inspect <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 7. Storyboard Panel Reference */}
        <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              Storyboard Panel Reference
            </label>
            {linkedPanel && onOpenStoryboardPanel && (
              <button
                type="button"
                data-testid="shot-jump-to-panel-btn"
                onClick={() => onOpenStoryboardPanel(linkedPanel.sceneId, linkedPanel.id)}
                className="text-[11px] text-yellow-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                Open Panel {linkedPanel.panelNumber}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={storyboardPanelId}
            disabled={!canEdit}
            onChange={(e) => setStoryboardPanelId(e.target.value)}
            data-testid="shot-select-storyboard-panel"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
          >
            <option value="">No linked storyboard panel</option>
            {sceneStoryboardPanels.map((panel) => (
              <option key={panel.id} value={panel.id}>
                Panel {panel.panelNumber} — {panel.title}
              </option>
            ))}
          </select>

          {linkedPanel && (
            <div className="rounded-lg border border-white/[0.08] bg-[#1F2226] border border-[#FFD34E]/25/70 p-2.5 flex items-center gap-3">
              {linkedPanelAsset?.thumbnailDataUrl || linkedPanelAsset?.storageRef ? (
                <img
                  src={linkedPanelAsset.thumbnailDataUrl || linkedPanelAsset.storageRef}
                  alt={linkedPanel.title}
                  className="w-16 h-10 rounded bg-[#0A0B0D] object-contain border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-16 h-10 rounded bg-[#0A0B0D] border border-white/10 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-slate-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-yellow-100 truncate">
                  Panel {linkedPanel.panelNumber}: {linkedPanel.title}
                </div>
                {linkedPanel.actionNotes && (
                  <div className="text-[10px] text-slate-400 line-clamp-1">
                    {linkedPanel.actionNotes}
                  </div>
                )}
              </div>
            </div>
          )}

          {onOpenReferencePicker && (
            <div className="pt-2">
              <AttachedReferencesField
                label="Vault / Visual References"
                attachedAssetIds={referenceAssetIds}
                referenceAssets={referenceAssets}
                canEdit={canEdit}
                onOpenPicker={onOpenReferencePicker}
                onRemoveAsset={(assetId) =>
                  setReferenceAssetIds((prev) => prev.filter((id) => id !== assetId))
                }
                testIdPrefix="shot"
              />
            </div>
          )}
        </div>

        {/* 5 & 8. Collapsible Optional Technical Specs & Scene Actions */}
        <div className="pt-4 border-t border-white/[0.06] space-y-3">
          <button
            type="button"
            onClick={() => setShowTechSpecs((prev) => !prev)}
            data-testid="shot-toggle-tech-specs"
            className="w-full flex items-center justify-between text-left py-1 text-[11px] font-mono uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer"
          >
            <span>Optional Technical Specs & Notes</span>
            {showTechSpecs ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {showTechSpecs && (
            <div className="space-y-3.5 pt-1">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                  Lens / Focal Length
                </label>
                <input
                  type="text"
                  value={focalLengthMm}
                  disabled={!canEdit}
                  onChange={(e) => setFocalLengthMm(e.target.value)}
                  data-testid="shot-input-lens"
                  placeholder="e.g. 35mm T2.0 Anamorphic"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                  Framing / Composition
                </label>
                <input
                  type="text"
                  value={framingNotes}
                  disabled={!canEdit}
                  onChange={(e) => setFramingNotes(e.target.value)}
                  data-testid="shot-input-framing"
                  placeholder="e.g. Low horizon, foreground glass reflection"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                  Camera / Technical Notes
                </label>
                <textarea
                  rows={2}
                  value={cameraNotes}
                  disabled={!canEdit}
                  onChange={(e) => setCameraNotes(e.target.value)}
                  data-testid="shot-input-notes"
                  placeholder="Focus pull cues, rig clearance, ND filter or speed note..."
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/25 text-amber-100 placeholder:text-slate-600 focus:border-[#F5F000]/60 focus:outline-none disabled:opacity-60 resize-none"
                />
              </div>

              {availableSceneCharacters.length > 0 && (
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
                    Associated Characters (Scene {scene?.sceneNumber})
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSceneCharacters.map((charName) => {
                      const active = linkedCharacters.includes(charName);
                      return (
                        <button
                          key={charName}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => toggleCharacter(charName)}
                          className={`px-2 py-1 rounded border text-[10px] font-mono transition cursor-pointer ${
                            active
                              ? 'border-[#F5F000]/50 bg-[#F5F000]/15 text-yellow-100'
                              : 'border-white/10 bg-black/40 border border-[#FFD34E]/20 text-yellow-100 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {charName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Move Shot to Another Scene with Confirmation */}
              {canEdit && otherScenes.length > 0 && (
                <div className="pt-2 border-t border-white/[0.06] space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3 h-3" />
                    Move Shot to Another Scene
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={moveTargetSceneId}
                      onChange={(e) => {
                        setMoveTargetSceneId(e.target.value);
                        setConfirmingMove(false);
                      }}
                      data-testid="shot-move-scene-select"
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-black/40 border border-[#FFD34E]/20 text-yellow-100 border border-white/10 text-slate-300 text-[11px] focus:outline-none"
                    >
                      <option value="">Select destination scene...</option>
                      {otherScenes.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          SC {sc.sceneNumber} — {sc.slugline}
                        </option>
                      ))}
                    </select>
                    {moveTargetSceneId && !confirmingMove && (
                      <button
                        type="button"
                        data-testid="shot-move-trigger-btn"
                        onClick={() => setConfirmingMove(true)}
                        className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#1F2226] border border-[#FFD34E]/25 text-[11px] text-slate-200 hover:border-white/30 shrink-0 cursor-pointer"
                      >
                        Move
                      </button>
                    )}
                  </div>
                  {confirmingMove && moveTargetSceneId && (
                    <div className="rounded-lg border border-amber-400/25 bg-amber-950/20 p-2.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-amber-100">Confirm move & renumber both scenes?</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmingMove(false)}
                          className="px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          data-testid="shot-move-confirm-btn"
                          onClick={() => {
                            onMoveShotToScene(shot.id, moveTargetSceneId);
                            setConfirmingMove(false);
                            setMoveTargetSceneId('');
                          }}
                          className="px-2.5 py-1 rounded bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_12px_rgba(245,240,0,0.35)] cursor-pointer"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Footer Actions */}
      <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-between gap-2 shrink-0">
        {canEdit ? (
          confirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="shot-delete-confirm-btn"
                onClick={() => onDeleteShot(shot.id)}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200 hover:bg-rose-500/30 text-xs font-medium cursor-pointer"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="shot-delete-btn"
              onClick={() => setConfirmingDelete(true)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )
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
              form="shot-editor-form"
              data-testid="shot-save-btn"
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_12px_rgba(245,240,0,0.3)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow"
            >
              <Check className="w-3.5 h-3.5" />
              Save Shot
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
