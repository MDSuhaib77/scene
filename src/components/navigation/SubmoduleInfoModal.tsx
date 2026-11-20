import React from 'react';
import { 
  X, 
  Layers, 
  Database, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Sparkles,
  Info,
  Calendar,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { FilmProject } from '../../types';
import { getFeatureGateConfig } from '../../utils/productionWorkflow';

interface SubmoduleInfoModalProps {
  submoduleId: string;
  project: FilmProject;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  isDark: boolean;
}

export function SubmoduleInfoModal({
  submoduleId,
  project,
  isOpen,
  onClose,
  onNavigateTab,
  isDark,
}: SubmoduleInfoModalProps) {
  if (!isOpen) return null;

  // Retrieve genuine feature gate metadata from productionWorkflow
  const gateConfig = getFeatureGateConfig(submoduleId, project);

  const fallbackTitle = submoduleId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const title = gateConfig?.featureTitle || fallbackTitle;
  const stage = gateConfig?.stage || 'PRODUCTION';
  const stageNumber = gateConfig?.stageNumber || 1;
  const description = gateConfig?.description || 
    'This StudioBinder-grade capability is scheduled for delivery in an upcoming SceneOS integration batch.';

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md bg-black/60 animate-fade-in"
      id="submodule-info-modal-backdrop"
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl space-y-6 animate-scale-up ${
          isDark 
            ? 'bg-[#0B0F17]/95 border-white/[0.12] shadow-black/80 text-white' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.08] dark:border-white/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Phase {stageNumber} · {stage}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                StudioBinder Module Integration
              </span>
            </div>
            <h3 className="text-xl font-bold font-display tracking-tight">
              {title}
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isDark 
                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 border-slate-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status & Prerequisite Card */}
        {gateConfig && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prerequisite Check */}
            <div className={`p-4 rounded-xl border space-y-2 ${
              isDark ? 'bg-zinc-900/40 border-white/[0.06]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                  Step {gateConfig.prerequisiteStepNumber} Prerequisite
                </span>
                {gateConfig.prerequisiteMet ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Met
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                    <Clock className="w-3.5 h-3.5" /> Pending
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold">{gateConfig.prerequisiteTitle}</h4>
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {gateConfig.prerequisiteDetails}
              </p>
            </div>

            {/* Data Contract */}
            <div className={`p-4 rounded-xl border space-y-2 ${
              isDark ? 'bg-zinc-900/40 border-white/[0.06]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                  Data Contract
                </span>
                <Database className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <h4 className="text-xs font-mono text-cyan-300 font-bold">
                {gateConfig.dataContract.name}
              </h4>
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {gateConfig.dataContract.relationship}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {gateConfig.dataContract.fields.slice(0, 4).map((f) => (
                  <span key={f} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {f}
                  </span>
                ))}
                {gateConfig.dataContract.fields.length > 4 && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded text-zinc-500">
                    +{gateConfig.dataContract.fields.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] dark:border-white/[0.08]">
          <span className="text-[11px] font-mono text-zinc-500">
            Batch 02 Architecture Contract
          </span>

          <div className="flex items-center gap-2">
            {gateConfig?.prerequisiteTab && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateTab(gateConfig.prerequisiteTab);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                  isDark 
                    ? 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border-cyan-500/30' 
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
              >
                <span>Fulfill Prerequisite ({gateConfig.prerequisiteTitle})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                isDark 
                  ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border-zinc-700' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
