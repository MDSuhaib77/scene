import React, { useState, useMemo } from 'react';
import { FilmPhase } from '../../types';
import { ChevronRight, ArrowRight, Calendar } from 'lucide-react';

interface ProductionMilestoneVisualizerProps {
  phases: FilmPhase[];
  activePhaseId?: string;
  simulatedDate: string;
  targetDate?: string;
  isEndDateFixed?: boolean;
  onNavigateTab?: (tab: string) => void;
  isDark?: boolean;
}

export function ProductionMilestoneVisualizer({
  phases,
  activePhaseId,
  simulatedDate,
  targetDate,
  isEndDateFixed = false,
  onNavigateTab,
  isDark = true,
}: ProductionMilestoneVisualizerProps) {
  const [inspectedPhaseId, setInspectedPhaseId] = useState<string | null>(null);

  // Authoritative phase sequencing
  const sortedPhases = useMemo(() => {
    return [...phases];
  }, [phases]);

  const activePhase = useMemo(() => {
    return phases.find(p => p.id === activePhaseId)
      || phases.find(p => p.status === 'active')
      || phases.find(p => p.status === 'overdue')
      || phases[0];
  }, [phases, activePhaseId]);

  const activeIndex = sortedPhases.findIndex(p => p.id === activePhase?.id);

  const inspectedPhase = useMemo(() => {
    return sortedPhases.find(p => p.id === inspectedPhaseId) || null;
  }, [sortedPhases, inspectedPhaseId]);

  // Calculate task statistics for active phase
  const activeCompletedTasks = activePhase?.activities.filter(a => a.completed).length || 0;
  const activeTotalTasks = activePhase?.activities.length || 0;

  return (
    <div 
      className="w-full relative pt-2 pb-1 text-left select-none"
      aria-label="Production Milestone Timeline"
    >
      {/* Header telemetry line: Clear, restrained phase status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm font-sans mb-3 text-zinc-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold uppercase tracking-wider text-cyan-400 text-xs font-mono">
            Phase Timeline:
          </span>
          <span className="font-medium">
            Active: <strong className="text-white font-bold">{activePhase?.name || 'Pre-Production'}</strong>
          </span>
          {activePhase?.startDate && activePhase?.endDate && (
            <span className="text-zinc-400 font-mono text-xs">
              ({activePhase.startDate} → {activePhase.endDate})
            </span>
          )}
          {activeTotalTasks > 0 && (
            <span className="text-cyan-300 text-xs font-mono hidden md:inline">
              • {activeCompletedTasks}/{activeTotalTasks} tasks done
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-xs text-zinc-300 shrink-0">
          <span>Target Wrap: <strong className="text-white font-mono">{targetDate || 'Unset'}</strong></span>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('phases')}
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold transition cursor-pointer ml-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 rounded px-2 py-1 min-h-[32px] bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/25"
              title="Open full Roadmap workspace"
            >
              <span>Roadmap</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Elegant, Fine Baseline Track */}
      <div className="relative px-2 sm:px-4 py-2">
        {/* Fine horizontal baseline */}
        <div className="relative h-[2px] w-full bg-zinc-800 rounded-full">
          {/* Active progress fill */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-cyan-500/80 rounded-full transition-all duration-300 motion-reduce:transition-none"
            style={{
              width: `${Math.min(100, Math.max(0, ((activeIndex + 0.5) / Math.max(1, sortedPhases.length)) * 100))}%`,
            }}
          />
        </div>

        {/* Milestone Nodes Positioned Along Track */}
        <div className="relative -mt-[6px] flex items-start justify-between">
          {sortedPhases.map((phase, idx) => {
            const isCompleted = phase.status === 'completed' || idx < activeIndex;
            const isOverdue = phase.status === 'overdue';
            const isActive = phase.id === activePhase?.id || idx === activeIndex;
            const isInspected = phase.id === inspectedPhaseId;

            return (
              <div 
                key={phase.id} 
                className="relative flex flex-col items-center group"
                style={{ width: `${100 / sortedPhases.length}%` }}
              >
                {/* Node Marker Button */}
                <button
                  type="button"
                  tabIndex={0}
                  aria-label={`${phase.name} phase: ${isCompleted ? 'Completed' : isOverdue ? 'Overdue' : isActive ? 'Active' : 'Pending'}`}
                  aria-expanded={isInspected}
                  onMouseEnter={() => setInspectedPhaseId(phase.id)}
                  onMouseLeave={() => setInspectedPhaseId(null)}
                  onFocus={() => setInspectedPhaseId(phase.id)}
                  onBlur={() => setInspectedPhaseId(null)}
                  onClick={() => onNavigateTab?.('phases')}
                  className={`p-1.5 -m-1.5 rounded transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isActive ? 'scale-115' : ''
                  }`}
                >
                  {isCompleted ? (
                    /* Completed: Small emerald diamond */
                    <div 
                      className="w-3 h-3 rotate-45 bg-emerald-500 rounded-[1px] shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                      title={`${phase.name}: Completed`}
                    />
                  ) : isOverdue ? (
                    /* Overdue: Amber/Rose diamond warning */
                    <div 
                      className="w-3.5 h-3.5 rounded-full border-2 border-rose-500 bg-rose-950 flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"
                      title={`${phase.name}: Overdue milestone`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    </div>
                  ) : isActive ? (
                    /* Active: Cyan ring with solid core */
                    <div 
                      className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 bg-cyan-950 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                      title={`${phase.name}: Active Phase`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
                    </div>
                  ) : (
                    /* Pending: Small muted dot */
                    <div 
                      className="w-2.5 h-2.5 rounded-full border border-zinc-700 bg-zinc-900 group-hover:border-zinc-500"
                      title={`${phase.name}: Pending`}
                    />
                  )}
                </button>

                {/* Compact Milestone Label Below Node */}
                <div className="mt-2 text-center max-w-[110px] px-1">
                  <div className={`text-xs font-sans font-semibold truncate ${
                    isOverdue 
                      ? 'text-rose-400 font-bold' 
                      : isActive 
                      ? 'text-cyan-300 font-bold' 
                      : isCompleted 
                      ? 'text-zinc-200' 
                      : 'text-zinc-400'
                  }`}>
                    {phase.name}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 truncate hidden sm:block">
                    {phase.durationDays}d
                  </div>
                </div>

                {/* Restrained Popover on Hover / Focus */}
                {isInspected && (
                  <div 
                    role="tooltip"
                    className="absolute bottom-full mb-3 z-30 w-56 p-3 rounded-xl bg-zinc-950 border border-cyan-500/40 text-xs font-sans shadow-2xl text-left pointer-events-none animate-fade-in"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                      <span className="font-bold text-white text-xs">{phase.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold ${
                        isCompleted 
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' 
                          : isOverdue
                          ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                          : isActive 
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30' 
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-750'
                      }`}>
                        {phase.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-zinc-300 font-mono">
                      <div>Dates: <span className="text-zinc-100">{phase.startDate || 'TBD'} → {phase.endDate || 'TBD'}</span></div>
                      <div>Duration: <span className="text-zinc-100">{phase.durationDays} days</span></div>
                      <div>Tasks: <span className="text-cyan-300">{phase.activities.filter(a => a.completed).length} of {phase.activities.length} completed</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
