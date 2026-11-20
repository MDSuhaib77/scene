import React, { useState } from 'react';
import {
  CharacterExtractionAudit,
  CharacterAnalysisOverrides,
  ConfirmedCharacterRecord,
} from '../services/characterAnalysisService';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Merge,
  Edit2,
  Plus,
  Check,
  HelpCircle,
  Users,
} from 'lucide-react';

interface CharacterExtractionAuditModalProps {
  audit: CharacterExtractionAudit;
  characters: ConfirmedCharacterRecord[];
  overrides?: CharacterAnalysisOverrides;
  isOpen: boolean;
  onClose: () => void;
  onSaveOverrides: (updatedOverrides: CharacterAnalysisOverrides) => void;
}

export const CharacterExtractionAuditModal: React.FC<
  CharacterExtractionAuditModalProps
> = ({
  audit,
  characters,
  overrides = {},
  isOpen,
  onClose,
  onSaveOverrides,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'aliases' | 'merge' | 'add'>('audit');

  // Alias state
  const [aliasSource, setAliasSource] = useState('');
  const [aliasTarget, setAliasTarget] = useState('');

  // Rename state
  const [renameOld, setRenameOld] = useState('');
  const [renameNew, setRenameNew] = useState('');

  // Merge state
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');

  // Add character state
  const [manualName, setManualName] = useState('');

  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});

  const handleAssignBlock = (blockKey: string, characterName: string) => {
    if (!characterName.trim()) return;
    const clean = characterName.trim().toUpperCase();
    onSaveOverrides({
      ...overrides,
      assignedBlocks: {
        ...(overrides.assignedBlocks || {}),
        [blockKey]: clean,
      },
    });
  };

  const handleRemoveAlias = (aliasKey: string) => {
    const next = { ...(overrides.aliases || {}) };
    delete next[aliasKey];
    onSaveOverrides({ ...overrides, aliases: next });
  };

  const handleSeparateMerge = (sourceKey: string) => {
    const next = { ...(overrides.mergedCharacters || {}) };
    delete next[sourceKey];
    onSaveOverrides({ ...overrides, mergedCharacters: next });
  };

  const handleRemoveRename = (oldKey: string) => {
    const next = { ...(overrides.canonicalNames || {}) };
    delete next[oldKey];
    onSaveOverrides({ ...overrides, canonicalNames: next });
  };

  if (!isOpen) return null;

  const handleApplyAlias = (source: string, target: string) => {
    if (!source.trim() || !target.trim()) return;
    const cleanSource = source.trim().toUpperCase();
    const cleanTarget = target.trim().toUpperCase();
    const updated = {
      ...overrides,
      aliases: {
        ...(overrides.aliases || {}),
        [cleanSource]: cleanTarget,
      },
    };
    onSaveOverrides(updated);
    setAliasSource('');
    setAliasTarget('');
  };

  const handleApplyRename = () => {
    if (!renameOld.trim() || !renameNew.trim()) return;
    const cleanOld = renameOld.trim().toUpperCase();
    const cleanNew = renameNew.trim().toUpperCase();
    const updated = {
      ...overrides,
      canonicalNames: {
        ...(overrides.canonicalNames || {}),
        [cleanOld]: cleanNew,
      },
    };
    onSaveOverrides(updated);
    setRenameOld('');
    setRenameNew('');
  };

  const handleApplyMerge = (source: string, target: string) => {
    if (!source.trim() || !target.trim() || source === target) return;
    const cleanSource = source.trim().toUpperCase();
    const cleanTarget = target.trim().toUpperCase();
    const updated = {
      ...overrides,
      mergedCharacters: {
        ...(overrides.mergedCharacters || {}),
        [cleanSource]: cleanTarget,
      },
    };
    onSaveOverrides(updated);
    setMergeSource('');
    setMergeTarget('');
  };

  const handleAddManualCharacter = () => {
    if (!manualName.trim()) return;
    const clean = manualName.trim().toUpperCase();
    const current = overrides.manuallyAddedCharacters || [];
    if (!current.includes(clean)) {
      const updated = {
        ...overrides,
        manuallyAddedCharacters: [...current, clean],
      };
      onSaveOverrides(updated);
    }
    setManualName('');
  };

  return (
    <div
      data-testid="character-extraction-audit-modal"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div className="bg-[#121622] border border-white/10 rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#161b28]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Screenplay Character Extraction &amp; Audit
              </h3>
              <p className="text-xs text-slate-400">
                Completeness verification, alias resolution, and canonical overrides
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-white/[0.08] bg-[#04160f]/90 px-5 gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-emerald-400 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('aliases')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'aliases'
                ? 'border-emerald-400 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Aliases &amp; Rename
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('merge')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'merge'
                ? 'border-emerald-400 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Merge Characters
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'add'
                ? 'border-emerald-400 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Add Missing
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-300">
          {activeTab === 'audit' && (
            <div className="space-y-5">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center gap-3 ${
                  audit.status === 'complete'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}
              >
                {audit.status === 'complete' ? (
                  <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {audit.status === 'complete'
                      ? 'Screenplay Extraction Complete & Reconciled'
                      : 'Screenplay Extraction Review Required'}
                  </div>
                  <div className="text-xs opacity-90">{audit.statusMessage}</div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Parsed Scenes
                  </span>
                  <span className="text-xl font-bold font-mono text-white">
                    {audit.totalParsedScenes}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Speaking Characters
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {audit.confirmedSpeakingCharactersCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Dialogue Blocks
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {audit.totalDialogueBlocks}
                  </span>
                </div>
              </div>

              {/* Unassigned Dialogue Blocks Section */}
              {audit.unassignedDialogueBlocks && audit.unassignedDialogueBlocks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono block">
                    Unassigned Dialogue Blocks ({audit.unassignedDialogueBlocks.length})
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {audit.unassignedDialogueBlocks.map((uBlock) => (
                      <div
                        key={uBlock.blockKey}
                        className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-amber-300 font-bold">
                            SCENE {uBlock.sceneNumber}
                          </span>
                          <span className="text-slate-300 italic truncate flex-1">
                            "{uBlock.textSnippet}"
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Assign character cue (e.g. DETECTIVE BLAKE)"
                            value={assignDrafts[uBlock.blockKey] || ''}
                            onChange={(e) =>
                              setAssignDrafts((prev) => ({ ...prev, [uBlock.blockKey]: e.target.value }))
                            }
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-[11px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAssignBlock(uBlock.blockKey, assignDrafts[uBlock.blockKey] || '')}
                            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] rounded-lg text-[11px] transition cursor-pointer shrink-0"
                          >
                            Assign Speaker
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Aliases Section */}
              {audit.suggestedAliases && audit.suggestedAliases.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block">
                    Suggested Alias Merges ({audit.suggestedAliases.length})
                  </span>
                  <div className="space-y-2">
                    {audit.suggestedAliases.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{suggestion.candidate}</span>
                          <span className="text-slate-500">→</span>
                          <span className="font-bold text-emerald-400">{suggestion.targetCanonical}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyAlias(suggestion.candidate, suggestion.targetCanonical)}
                          className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] rounded-lg text-xs transition cursor-pointer"
                        >
                          Confirm Alias
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'aliases' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-slate-400">
                  Map secondary character cues, nicknames, or spelling variants to their canonical name.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Variant / Alias (e.g. BLAKE)"
                    value={aliasSource}
                    onChange={(e) => setAliasSource(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Canonical Name (e.g. DETECTIVE BLAKE)"
                    value={aliasTarget}
                    onChange={(e) => setAliasTarget(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyAlias(aliasSource, aliasTarget)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] rounded-xl transition cursor-pointer"
                >
                  Register Alias Mapping
                </button>
              </div>

              {/* Canonical Rename Section */}
              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                <span className="text-[11px] font-mono uppercase text-slate-400 block font-bold">
                  Correct Canonical Character Name
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={renameOld}
                    onChange={(e) => setRenameOld(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs outline-none"
                  >
                    <option value="">Select Character to Rename</option>
                    {characters.map((c) => (
                      <option key={c.canonicalName} value={c.canonicalName}>
                        {c.canonicalName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="New Canonical Name"
                    value={renameNew}
                    onChange={(e) => setRenameNew(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyRename}
                  disabled={!renameOld || !renameNew.trim()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Rename Canonical Record
                </button>
              </div>

              {/* Existing Aliases */}
              {overrides.aliases && Object.keys(overrides.aliases).length > 0 && (
                <div className="pt-4 border-t border-white/[0.06] space-y-2">
                  <span className="text-[11px] font-mono uppercase text-slate-400 block font-bold">
                    Active Alias Mappings
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {Object.entries(overrides.aliases).map(([from, to]) => (
                      <div
                        key={from}
                        className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <span>
                          <strong className="text-white font-mono">{from}</strong> maps to{' '}
                          <strong className="text-emerald-400 font-mono">{to}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAlias(from)}
                          className="text-[10px] font-mono text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 cursor-pointer"
                        >
                          Separate
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Canonical Renames */}
              {overrides.canonicalNames && Object.keys(overrides.canonicalNames).length > 0 && (
                <div className="pt-4 border-t border-white/[0.06] space-y-2">
                  <span className="text-[11px] font-mono uppercase text-slate-400 block font-bold">
                    Active Canonical Renames
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {Object.entries(overrides.canonicalNames).map(([oldName, newName]) => (
                      <div
                        key={oldName}
                        className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <span>
                          <strong className="text-slate-400 font-mono">{oldName}</strong> renamed to{' '}
                          <strong className="text-emerald-400 font-mono">{newName}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRename(oldName)}
                          className="text-[10px] font-mono text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 cursor-pointer"
                        >
                          Revert
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'merge' && (
            <div className="space-y-4">
              <p className="text-slate-400">
                Consolidate two character records into one single identity. All dialogue blocks and interactions will combine.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={mergeSource}
                  onChange={(e) => setMergeSource(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs outline-none"
                >
                  <option value="">Select Character to Merge</option>
                  {characters.map((c) => (
                    <option key={c.canonicalName} value={c.canonicalName}>
                      {c.canonicalName} ({c.totalDialogueBlocks} cues)
                    </option>
                  ))}
                </select>

                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs outline-none"
                >
                  <option value="">Merge Into Target Character</option>
                  {characters.map((c) => (
                    <option key={c.canonicalName} value={c.canonicalName}>
                      {c.canonicalName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleApplyMerge(mergeSource, mergeTarget)}
                disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] rounded-xl transition cursor-pointer"
              >
                Merge Character Records
              </button>

              {overrides.mergedCharacters && Object.keys(overrides.mergedCharacters).length > 0 && (
                <div className="pt-4 border-t border-white/[0.06] space-y-2">
                  <span className="text-[11px] font-mono uppercase text-slate-400 block font-bold">
                    Active Merged Records
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {Object.entries(overrides.mergedCharacters).map(([source, target]) => (
                      <div
                        key={source}
                        className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <span>
                          <strong className="text-white font-mono">{source}</strong> merged into{' '}
                          <strong className="text-emerald-400 font-mono">{target}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSeparateMerge(source)}
                          className="text-[10px] font-mono text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 cursor-pointer"
                        >
                          Separate
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <div className="space-y-4">
              <p className="text-slate-400">
                If the screenplay parser missed an unformatted speaker cue, register them manually here.
              </p>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Character Name (UPPERCASE)"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddManualCharacter}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] rounded-xl transition cursor-pointer shrink-0"
                >
                  Add Character
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-[#161b28] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
