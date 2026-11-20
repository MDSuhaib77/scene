import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Database, Layers, ShieldCheck } from 'lucide-react';

interface DataContractSummary {
  name: string;
  relationship: string;
  fields: string[];
}

interface ProductionFeatureGateProps {
  featureTitle: string;
  stage: 'WRITE' | 'BREAKDOWN' | 'VISUALIZE' | 'PLAN' | 'SHOOT';
  stageNumber: number;
  description: string;
  prerequisiteStepNumber: number;
  prerequisiteTitle: string;
  prerequisiteMet: boolean;
  prerequisiteDetails: string;
  prerequisiteTab: string;
  onNavigateTab: (tabId: string) => void;
  dataContract: DataContractSummary;
  isDark: boolean;
}

export function ProductionFeatureGate({
  featureTitle,
  stage,
  stageNumber,
  description,
  prerequisiteStepNumber,
  prerequisiteTitle,
  prerequisiteMet,
  prerequisiteDetails,
  prerequisiteTab,
  onNavigateTab,
  dataContract,
  isDark,
}: ProductionFeatureGateProps) {
  const stageColorMap = {
    WRITE: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    BREAKDOWN: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    VISUALIZE: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    PLAN: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    SHOOT: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4 animate-fade-in" id="production-feature-gate">
      {/* Top Breadcrumb / Stage Banner */}
      <div className={`p-6 rounded-2xl border backdrop-blur-xl transition ${
        isDark 
          ? 'bg-zinc-900/60 border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.36)]' 
          : 'bg-white/80 border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${stageColorMap[stage]}`}>
                Phase {stageNumber} · {stage}
              </span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                Batch 01 Integration Point
              </span>
            </div>
            <h1 className={`text-2xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {featureTitle}
            </h1>
            <p className={`text-xs max-w-2xl leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {description}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('overview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                isDark 
                  ? 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border-zinc-700' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-250'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prerequisite & Pipeline Status Card */}
        <div className={`p-5 rounded-2xl border backdrop-blur-xl space-y-4 ${
          isDark 
            ? 'bg-zinc-900/50 border-zinc-800' 
            : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/40">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                Production Pipeline Prerequisites
              </h2>
            </div>
            {prerequisiteMet ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Prerequisites Met</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Upstream Data</span>
              </span>
            )}
          </div>

          <div className={`p-4 rounded-xl border text-xs space-y-2 ${
            prerequisiteMet 
              ? (isDark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-800')
              : (isDark ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800')
          }`}>
            <div className="font-semibold flex items-center justify-between">
              <span>Step {prerequisiteStepNumber}: {prerequisiteTitle}</span>
              <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-black/20">
                {prerequisiteMet ? 'Ready' : 'Action Required'}
              </span>
            </div>
            <p className="opacity-90 leading-relaxed text-[11px]">
              {prerequisiteDetails}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigateTab(prerequisiteTab)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Jump to {prerequisiteTitle}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Shared Data Contract Integration Card */}
        <div className={`p-5 rounded-2xl border backdrop-blur-xl space-y-4 ${
          isDark 
            ? 'bg-zinc-900/50 border-zinc-800' 
            : 'bg-white/70 border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/40">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <h2 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                Shared Data Integration Contract
              </h2>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-mono text-cyan-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Contract Locked</span>
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className={`p-3 rounded-xl border font-mono text-[11px] space-y-1.5 ${
              isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="text-cyan-400 font-bold">interface {dataContract.name}</div>
              <div className="text-zinc-500 text-[10px]">Relationship: {dataContract.relationship}</div>
              <div className="pl-3 border-l-2 border-zinc-700/60 space-y-0.5 pt-1 text-[10px]">
                {dataContract.fields.map((field, i) => (
                  <div key={i} className="text-zinc-400">{field}</div>
                ))}
              </div>
            </div>
            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Subsequent implementation batches will bind directly to this established model, guaranteeing persistence and zero duplicate data stores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
