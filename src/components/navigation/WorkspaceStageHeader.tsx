import React from 'react';
import { 
  ChevronRight, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  ExternalLink,
  Layers
} from 'lucide-react';

export type ProductionStage = 'WRITE' | 'BREAKDOWN' | 'VISUALIZE' | 'PLAN' | 'SHOOT';

export interface StageSubmodule {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
  badgeColor?: string;
  status: 'active' | 'implemented' | 'planned' | 'navigates-to-tab';
  targetTab?: string;
  isPlanned?: boolean;
}

export interface WorkspaceStageHeaderProps {
  stage: ProductionStage;
  stageNumber: number;
  workspaceTitle: string;
  workspaceSubtitle?: string;
  activeSubmoduleId: string;
  submodules: StageSubmodule[];
  onSelectSubmodule: (submodule: StageSubmodule) => void;
  nextStep?: {
    label: string;
    targetTab: string;
  };
  previousStep?: {
    label: string;
    targetTab: string;
  };
  onNavigateTab: (tabId: string) => void;
  isDark: boolean;
}

const STAGE_CONFIG: Record<ProductionStage, {
  name: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  activePillBg: string;
  activePillBorder: string;
  activePillText: string;
}> = {
  WRITE: {
    name: 'Write',
    accentText: 'text-indigo-400',
    accentBg: 'bg-indigo-500/10',
    accentBorder: 'border-indigo-500/25',
    activePillBg: 'bg-indigo-500/20',
    activePillBorder: 'border-indigo-500/40',
    activePillText: 'text-indigo-300',
  },
  BREAKDOWN: {
    name: 'Breakdown',
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10',
    accentBorder: 'border-cyan-500/25',
    activePillBg: 'bg-cyan-500/20',
    activePillBorder: 'border-cyan-500/40',
    activePillText: 'text-cyan-300',
  },
  VISUALIZE: {
    name: 'Visualize',
    accentText: 'text-purple-400',
    accentBg: 'bg-purple-500/10',
    accentBorder: 'border-purple-500/25',
    activePillBg: 'bg-purple-500/20',
    activePillBorder: 'border-purple-500/40',
    activePillText: 'text-purple-300',
  },
  PLAN: {
    name: 'Plan',
    accentText: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/25',
    activePillBg: 'bg-amber-500/20',
    activePillBorder: 'border-amber-500/40',
    activePillText: 'text-amber-300',
  },
  SHOOT: {
    name: 'Shoot',
    accentText: 'text-rose-400',
    accentBg: 'bg-rose-500/10',
    accentBorder: 'border-rose-500/25',
    activePillBg: 'bg-rose-500/20',
    activePillBorder: 'border-rose-500/40',
    activePillText: 'text-rose-300',
  },
};

export function WorkspaceStageHeader({
  stage,
  stageNumber,
  workspaceTitle,
  workspaceSubtitle,
  activeSubmoduleId,
  submodules,
  onSelectSubmodule,
  nextStep,
  previousStep,
  onNavigateTab,
  isDark,
}: WorkspaceStageHeaderProps) {
  const config = STAGE_CONFIG[stage];

  return (
    <div 
      className={`rounded-2xl border transition-all mb-6 ${
        isDark 
          ? 'bg-[#070b16]/75 backdrop-blur-xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_1px_rgba(255,255,255,0.06)]' 
          : 'bg-white/95 backdrop-blur-xl border-slate-200 shadow-sm'
      }`}
      id={`workspace-stage-header-${stage.toLowerCase()}`}
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* Top Meta Row: Stage Badge, Title & Linear Workflow Handoffs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/[0.06] dark:border-white/[0.06]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${config.accentBg} ${config.accentText} ${config.accentBorder}`}>
                Stage {stageNumber} · {config.name}
              </span>
              <span className="text-zinc-500 dark:text-zinc-500 text-xs">•</span>
              <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-400">
                Production Operating System
              </span>
            </div>

            <div className="flex items-baseline gap-2.5">
              <h2 className={`text-xl sm:text-2xl font-bold font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {workspaceTitle}
              </h2>
            </div>
            {workspaceSubtitle && (
              <p className={`text-xs leading-relaxed max-w-2xl ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                {workspaceSubtitle}
              </p>
            )}
          </div>

          {/* Linear Workflow Quick-Links */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            {previousStep && (
              <button
                type="button"
                onClick={() => onNavigateTab(previousStep.targetTab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                  isDark 
                    ? 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-white/[0.08]' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                }`}
                title={`Navigate to ${previousStep.label}`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{previousStep.label}</span>
                <span className="sm:hidden">Prev</span>
              </button>
            )}

            {nextStep && (
              <button
                type="button"
                onClick={() => onNavigateTab(nextStep.targetTab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  isDark 
                    ? `${config.accentBg} ${config.accentText} ${config.accentBorder} hover:brightness-110` 
                    : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900'
                }`}
                title={`Navigate to ${nextStep.label}`}
              >
                <span>{nextStep.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Submodules Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {submodules.map((submodule) => {
            const Icon = submodule.icon;
            const isActive = submodule.id === activeSubmoduleId;
            const isPlanned = submodule.status === 'planned' || submodule.isPlanned;

            return (
              <button
                key={submodule.id}
                type="button"
                id={`submodule-tab-${submodule.id}`}
                onClick={() => onSelectSubmodule(submodule)}
                className={`group px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer border ${
                  isActive
                    ? isDark 
                      ? `${config.activePillBg} ${config.activePillText} ${config.activePillBorder} shadow-sm shadow-black/40`
                      : 'bg-white text-slate-900 border-slate-300 shadow-sm'
                    : isDark 
                      ? 'bg-black/20 hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border-transparent hover:border-white/[0.06]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-200'
                }`}
                title={submodule.description}
              >
                <Icon className={`w-3.5 h-3.5 transition-colors ${
                  isActive 
                    ? config.accentText 
                    : isDark ? 'text-zinc-500 group-hover:text-zinc-300' : 'text-slate-400 group-hover:text-slate-700'
                }`} />
                <span>{submodule.name}</span>

                {/* Status or Batch Badge */}
                {submodule.badge && (
                  <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full border ${
                    submodule.badgeColor || (isPlanned 
                      ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60' 
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30')
                  }`}>
                    {submodule.badge}
                  </span>
                )}

                {isPlanned && !submodule.badge && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                    Planned
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
