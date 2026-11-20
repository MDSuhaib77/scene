import React from 'react';
import {
  ConfirmedCharacterRecord,
  CharacterInteractionDetail,
} from '../services/characterAnalysisService';
import {
  X,
  Users,
  MessageSquare,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Tag,
  Hash,
} from 'lucide-react';

interface CharacterDetailDrawerProps {
  character: ConfirmedCharacterRecord | null;
  onClose: () => void;
  onSelectPartner?: (partnerName: string) => void;
  onJumpToScene?: (sceneId: string) => void;
  onOpenAuditReview?: () => void;
}

export const CharacterDetailDrawer: React.FC<CharacterDetailDrawerProps> = ({
  character,
  onClose,
  onSelectPartner,
  onJumpToScene,
  onOpenAuditReview,
}) => {
  if (!character) return null;

  return (
    <div
      data-testid="character-detail-drawer"
      className="w-80 xl:w-96 border-l border-white/[0.08] bg-[#030e09]/95 backdrop-blur-2xl border-l border-emerald-500/20 flex flex-col h-full shrink-0 overflow-hidden shadow-2xl transition-all"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/[0.08] flex items-start justify-between gap-3 bg-[#04160f]/90 border-b border-emerald-500/20">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-500/30 font-semibold">
              Speaking Character
            </span>
            {character.extensionsSeen && character.extensionsSeen.length > 0 && (
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                {character.extensionsSeen.join(', ')}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white tracking-tight truncate">
            {character.canonicalName}
          </h3>
          {character.aliases && character.aliases.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 truncate">
              <span className="text-slate-500 font-mono text-[10px]">Aliases:</span>
              <span className="text-slate-300 font-medium">
                {character.aliases.join(', ')}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          type="button"
          aria-label="Close character details"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
        {/* Dialogue Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Dialogue Blocks
            </span>
            <span className="text-lg font-bold font-mono text-white">
              {character.totalDialogueBlocks}
            </span>
            <span className="text-[10px] text-slate-500 block">Screenplay cues</span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Dialogue Words
            </span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {character.totalDialogueWords}
            </span>
            <span className="text-[10px] text-slate-500 block">Total words spoken</span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Avg Turn Length
            </span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {character.averageDialogueLength}
            </span>
            <span className="text-[10px] text-slate-500 block">Words per block</span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Speaking Scenes
            </span>
            <span className="text-lg font-bold font-mono text-lime-400">
              {character.speakingScenesCount}
            </span>
            <span className="text-[10px] text-slate-500 block">Distinct scenes</span>
          </div>
        </div>

        {/* Interaction Partners Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-mono">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dialogue Partners ({character.interactions.length})</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-500">
              {character.totalInteractionCount} total turns
            </span>
          </div>

          {character.interactions.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-slate-500 text-xs">
              No consecutive dialogue exchanges recorded with other characters.
            </div>
          ) : (
            <div className="space-y-2">
              {character.interactions.map((partner) => (
                <div
                  key={partner.partnerId}
                  className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition flex flex-col gap-2 group"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onSelectPartner?.(partner.partnerName)}
                      className="font-bold text-slate-200 group-hover:text-emerald-300 text-xs text-left truncate flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="truncate">{partner.partnerName}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition" />
                    </button>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-semibold shrink-0">
                      {partner.exchangeCount} {partner.exchangeCount === 1 ? 'turn' : 'turns'}
                    </span>
                  </div>

                  {/* Scene References tags */}
                  {partner.sceneReferences && partner.sceneReferences.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] font-mono text-slate-500">Scenes:</span>
                      {partner.sceneReferences.slice(0, 4).map((scn) => (
                        <button
                          key={scn.sceneId}
                          type="button"
                          onClick={() => onJumpToScene?.(scn.sceneId)}
                          title={`${scn.heading} (${scn.exchangeCount} turns)`}
                          className="px-1.5 py-0.2 rounded bg-black/40 hover:bg-white/10 text-[10px] font-mono text-slate-400 hover:text-white border border-white/5 transition cursor-pointer"
                        >
                          Sc. {scn.sceneNumber} ({scn.exchangeCount})
                        </button>
                      ))}
                      {partner.sceneReferences.length > 4 && (
                        <span className="text-[10px] font-mono text-slate-500">
                          +{partner.sceneReferences.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scene Participation Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-mono">
              <FileText className="w-3.5 h-3.5 text-lime-400" />
              <span>Speaking Scenes ({character.speakingScenes.length})</span>
            </h4>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {character.speakingScenes.map((scn) => (
              <div
                key={scn.sceneId}
                onClick={() => onJumpToScene?.(scn.sceneId)}
                className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition flex items-center justify-between gap-2 cursor-pointer group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-emerald-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                      Sc. {scn.sceneNumber}
                    </span>
                    <span className="font-medium text-slate-200 text-xs truncate group-hover:text-white">
                      {scn.heading}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                    {scn.dialogueCount} {scn.dialogueCount === 1 ? 'line' : 'lines'}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/[0.08] bg-[#04160f]/90 border-t border-emerald-500/20 flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Canonical Record
        </span>
        {onOpenAuditReview && (
          <button
            type="button"
            onClick={onOpenAuditReview}
            className="px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 rounded-lg transition cursor-pointer border border-emerald-500/30"
          >
            Review Aliases &amp; Overrides
          </button>
        )}
      </div>
    </div>
  );
};
