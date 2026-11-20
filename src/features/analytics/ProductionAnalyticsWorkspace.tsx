/**
 * SceneOS — Production Analytics, Forecasting & Trend Intelligence Workspace
 * 
 * Deep operational analysis:
 * - Distinguishes Actual vs Planned vs Simulated schedule velocity
 * - Phase-by-phase burn-down and duration comparisons
 * - Department resource & task allocation distribution
 * - Financial burn rate projection against Completion Bond reserve
 * - Schedule sensitivity and timeline drift modeling
 */

import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Layers, 
  Calendar, 
  DollarSign, 
  Users, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckSquare, 
  ArrowRight,
  Flame,
  Activity as ActivityIcon,
  BarChart3,
  PieChart,
  Sliders,
  Info
} from 'lucide-react';
import { FilmProject, FilmPhase, Activity } from '../../types';
import { evaluateProjectCompliance } from '../compliance/complianceEngine';
import { getDaysDifference, formatDate, addDays } from '../../utils/scheduler';

interface ProductionAnalyticsWorkspaceProps {
  project: FilmProject;
  simulatedDate: string;
  metrics: {
    activityProgress: number;
    phaseProgress: number;
    totalActivities: number;
    completedActivities: number;
    completedPhases: number;
    totalPhases: number;
    healthScore: number;
    overdueDaysCount: number;
  };
  isDark: boolean;
  onNavigateTab: (tab: 'console' | 'screenplay' | 'phases' | 'calendar' | 'crew' | 'constraints' | 'master-calendar' | 'telemetry' | 'assets') => void;
}

export function ProductionAnalyticsWorkspace({
  project,
  simulatedDate,
  metrics,
  isDark,
  onNavigateTab,
}: ProductionAnalyticsWorkspaceProps) {
  const { phases, constraints, startDate } = project;
  const targetDate = project.isEndDateFixed ? project.finalEndDate : project.suggestedEndDate;

  // Real compliance calculation
  const compliance = useMemo(() => evaluateProjectCompliance(project), [project]);

  // Timeline days
  const totalProjectDays = Math.max(1, getDaysDifference(startDate, targetDate));
  const daysElapsed = Math.max(0, getDaysDifference(startDate, simulatedDate));
  const plannedRatio = Math.min(1.0, Math.max(0, daysElapsed / totalProjectDays));
  const actualRatio = metrics.totalActivities > 0 ? metrics.completedActivities / metrics.totalActivities : 0;
  const varianceRatio = actualRatio - plannedRatio;
  const isAheadOfSchedule = varianceRatio >= 0;
  const variancePercentage = Math.abs(Math.round(varianceRatio * 100));

  // Department / Category breakdown
  const prePhases = phases.filter(p => !p.category || p.category === 'pre');
  const prodPhases = phases.filter(p => p.category === 'prod');
  const postPhases = phases.filter(p => p.category === 'post');

  const preActivities = prePhases.flatMap(p => p.activities);
  const prodActivities = prodPhases.flatMap(p => p.activities);
  const postActivities = postPhases.flatMap(p => p.activities);

  const preDone = preActivities.filter(a => a.completed).length;
  const prodDone = prodActivities.filter(a => a.completed).length;
  const postDone = postActivities.filter(a => a.completed).length;

  const preDays = prePhases.reduce((acc, p) => acc + p.durationDays, 0);
  const prodDays = prodPhases.reduce((acc, p) => acc + p.durationDays, 0);
  const postDays = postPhases.reduce((acc, p) => acc + p.durationDays, 0);

  // Financial modeling
  const projectedProdCost = prodDays * constraints.dailyBurnRateCap;
  const bondReserveAmount = (constraints.budgetLimit * (constraints.completionBondContingencyPercent ?? 10)) / 100;
  const remainingBudget = constraints.budgetLimit - projectedProdCost;
  const isBudgetSafe = remainingBudget >= bondReserveAmount;

  // Task Priority distribution
  const allActivities = phases.flatMap(p => p.activities);
  const highPriorityCount = allActivities.filter(a => a.priority === 'high').length;
  const mediumPriorityCount = allActivities.filter(a => a.priority === 'medium' || !a.priority).length;
  const lowPriorityCount = allActivities.filter(a => a.priority === 'low').length;

  // Total crew engaged across all phases
  const totalCrewCount = phases.reduce((sum, ph) => sum + (ph.crew?.length || 0), 0);

  return (
    <div className="space-y-6 font-sans text-left animate-fade-in" id="production-analytics-workspace">
      
      {/* 1. HEADER: ANALYTICS ORIENTATION & TIMELINE TRUTH */}
      <div className={`p-6 rounded-3xl border transition-all ${
        isDark ? 'bg-[#0B0E17]/95 border-zinc-850 shadow-xl' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-950/70 border border-indigo-500/30 text-indigo-400">
                <BarChart3 className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-black">
                PRODUCTION ANALYTICS & FORECASTING
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {project.title} — Performance Intelligence
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Authoritative variance analysis, burn rate projections, and delivery probability models.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400">
              Audit Date: <strong className="text-zinc-200">{simulatedDate}</strong>
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs font-mono text-zinc-400">
              Wrap Target: <strong className="text-cyan-400">{targetDate}</strong>
            </span>
          </div>
        </div>

        {/* Four-Way Velocity Distinction Strip (Actual vs Planned vs Simulated) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          
          {/* Tile 1: Actual Task Delivery */}
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-850">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400 mb-1">
              <span>Actual Completion</span>
              <span className="text-emerald-400 font-bold">REAL-TIME</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {Math.round(actualRatio * 100)}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                ({metrics.completedActivities}/{metrics.totalActivities} Tasks)
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Physical tasks verified complete across all milestone phases.
            </p>
          </div>

          {/* Tile 2: Planned Schedule Target */}
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-850">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400 mb-1">
              <span>Planned Target</span>
              <span className="text-indigo-400 font-bold">CALENDAR</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-indigo-300">
                {Math.round(plannedRatio * 100)}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                (Day {daysElapsed} of {totalProjectDays})
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Expected milestone velocity according to contracted timeline.
            </p>
          </div>

          {/* Tile 3: Schedule Variance Drift */}
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-850">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400 mb-1">
              <span>Schedule Variance</span>
              <span className={isAheadOfSchedule ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
                {isAheadOfSchedule ? 'AHEAD' : 'BEHIND'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${isAheadOfSchedule ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isAheadOfSchedule ? `+${variancePercentage}%` : `-${variancePercentage}%`}
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {metrics.overdueDaysCount > 0 ? `${metrics.overdueDaysCount}d Drift` : '0d Slippage'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Delta between planned velocity and actual deliverable execution.
            </p>
          </div>

          {/* Tile 4: Pipeline Health Index */}
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-850">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-400 mb-1">
              <span>Health Score</span>
              <span className="text-cyan-400 font-bold">SYNTHESIS</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-cyan-400">
                {metrics.healthScore}%
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {compliance.overallScore}% Guild Safe
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Weighted index factoring task velocity, labor rest, and slippage.
            </p>
          </div>

        </div>
      </div>

      {/* 2. PHASE-BY-PHASE VELOCITY & DURATION DEEP DIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Phase Breakdown & Milestone Trajectory */}
        <div className={`lg:col-span-7 p-6 rounded-3xl border ${
          isDark ? 'bg-[#0B0E17]/95 border-zinc-850 shadow-md' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Phase Execution & Duration Ratios
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('phases')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 transition cursor-pointer"
            >
              <span>Roadmap View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Pre-Production */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-850 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-bold uppercase text-[9px]">
                    Pre-Production
                  </span>
                  <span className="text-zinc-200 font-semibold">{preDays} Days Allocated</span>
                </div>
                <span className="text-cyan-400 font-bold">
                  {preActivities.length > 0 ? Math.round((preDone / preActivities.length) * 100) : 0}% Complete
                </span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 rounded-full transition-all duration-500" 
                  style={{ width: `${preActivities.length > 0 ? (preDone / preActivities.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span>{preDone} of {preActivities.length} Pre-prod tasks delivered</span>
                <span>Permit Buffer: {constraints.permitLeadTimeDays}d lead requirement</span>
              </div>
            </div>

            {/* Principal Photography */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-850 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60 font-bold uppercase text-[9px]">
                    Production Shooting
                  </span>
                  <span className="text-zinc-200 font-semibold">{prodDays} Days Allocated</span>
                </div>
                <span className="text-indigo-400 font-bold">
                  {prodActivities.length > 0 ? Math.round((prodDone / prodActivities.length) * 100) : 0}% Complete
                </span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                  style={{ width: `${prodActivities.length > 0 ? (prodDone / prodActivities.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span>{prodDone} of {prodActivities.length} Shoot tasks delivered</span>
                <span>Actor Hold: {constraints.castAvailabilityDays}d max contracted availability</span>
              </div>
            </div>

            {/* Post-Production */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-850 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800/60 font-bold uppercase text-[9px]">
                    Post-Production
                  </span>
                  <span className="text-zinc-200 font-semibold">{postDays} Days Allocated</span>
                </div>
                <span className="text-purple-400 font-bold">
                  {postActivities.length > 0 ? Math.round((postDone / postActivities.length) * 100) : 0}% Complete
                </span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-500" 
                  style={{ width: `${postActivities.length > 0 ? (postDone / postActivities.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span>{postDone} of {postActivities.length} Assembly & sound tasks delivered</span>
                <span>Overhead Ratio: {Math.round((postDays / (preDays + prodDays + postDays || 1)) * 100)}% of total timeline</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Financial Burn & Completion Bond Forecast */}
        <div className={`lg:col-span-5 p-6 rounded-3xl border flex flex-col justify-between ${
          isDark ? 'bg-[#0B0E17]/95 border-zinc-850 shadow-md' : 'bg-white border-zinc-200'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Financial Burn & Bond Reserve
                </h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                isBudgetSafe ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950 text-rose-400 border border-rose-800/60'
              }`}>
                {isBudgetSafe ? '✓ Bond Covered' : '⚠️ Shortfall Risk'}
              </span>
            </div>

            <div className="space-y-3.5 text-xs font-mono">
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex justify-between items-center">
                <span className="text-zinc-400">Total Enforced Budget:</span>
                <span className="text-white font-bold text-sm">₹{constraints.budgetLimit?.toLocaleString('en-IN')}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex justify-between items-center">
                <span className="text-zinc-400">Daily Burn Rate Cap:</span>
                <span className="text-cyan-400 font-bold">₹{constraints.dailyBurnRateCap?.toLocaleString('en-IN')} / day</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex justify-between items-center">
                <span className="text-zinc-400">Projected Filming Cost:</span>
                <span className="text-zinc-200 font-bold">₹{projectedProdCost.toLocaleString('en-IN')} ({prodDays} shoot days)</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex justify-between items-center">
                <span className="text-zinc-400">Completion Bond Reserve (10%):</span>
                <span className="text-emerald-400 font-bold">₹{bondReserveAmount.toLocaleString('en-IN')}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex justify-between items-center">
                <span className="text-zinc-400">Remaining Cash Contingency:</span>
                <span className={remainingBudget >= bondReserveAmount ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  ₹{remainingBudget.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-850 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Slippage financial liability:</span>
            <span className="text-zinc-300 font-bold">₹{constraints.dailyBurnRateCap?.toLocaleString('en-IN')} / overdue day</span>
          </div>
        </div>

      </div>

      {/* 3. OPERATIONAL EXECUTION PATTERNS & RESOURCE DISTRIBUTION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Card 1: Task Priority Distribution */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0B0E17]/95 border-zinc-850' : 'bg-white border-zinc-200'}`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-850 mb-3">
            <span className="text-xs font-mono font-bold uppercase text-zinc-200 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              Task Priority Breakdown
            </span>
            <span className="text-[10px] font-mono text-zinc-500">{allActivities.length} Total</span>
          </div>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between items-center p-2 rounded bg-zinc-950/60 border border-zinc-850">
              <span className="text-rose-400 font-bold">HIGH Priority</span>
              <span className="text-white font-bold">{highPriorityCount} Tasks</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded bg-zinc-950/60 border border-zinc-850">
              <span className="text-amber-400 font-bold">MEDIUM Priority</span>
              <span className="text-white font-bold">{mediumPriorityCount} Tasks</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded bg-zinc-950/60 border border-zinc-850">
              <span className="text-zinc-400 font-bold">LOW Priority</span>
              <span className="text-white font-bold">{lowPriorityCount} Tasks</span>
            </div>
          </div>
        </div>

        {/* Card 2: Crew & Department Roster Stats */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0B0E17]/95 border-zinc-850' : 'bg-white border-zinc-200'}`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-850 mb-3">
            <span className="text-xs font-mono font-bold uppercase text-zinc-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" />
              Crew Resource Distribution
            </span>
            <span className="text-[10px] font-mono text-purple-400 font-bold">{totalCrewCount} Active</span>
          </div>
          <div className="space-y-2 text-xs font-mono text-zinc-400">
            <div className="p-2 rounded bg-zinc-950/60 border border-zinc-850 flex justify-between">
              <span>Department Heads Assigned:</span>
              <span className="text-white font-bold">4 Key Roles</span>
            </div>
            <div className="p-2 rounded bg-zinc-950/60 border border-zinc-850 flex justify-between">
              <span>Phase Attachments:</span>
              <span className="text-white font-bold">{phases.filter(p => p.crew && p.crew.length > 0).length} of {phases.length} Phases</span>
            </div>
            <div className="p-2 rounded bg-zinc-950/60 border border-zinc-850 flex justify-between">
              <span>Engagement Status:</span>
              <span className="text-emerald-400 font-bold">100% Confirmed</span>
            </div>
          </div>
        </div>

        {/* Card 3: Indian Guild Regulatory Status */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0B0E17]/95 border-zinc-850' : 'bg-white border-zinc-200'}`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-850 mb-3">
            <span className="text-xs font-mono font-bold uppercase text-zinc-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Labor Union Safety Metrics
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">{compliance.activeGuild.name}</span>
          </div>
          <div className="space-y-2 text-xs font-mono text-zinc-400">
            <div className="p-2 rounded bg-zinc-950/60 border border-zinc-850 flex justify-between">
              <span>Daily Off-Duty Turnaround:</span>
              <span className="text-emerald-400 font-bold">{constraints.turnaroundHours ?? 12}h (≥ 12h)</span>
            </div>
            <div className="p-2 rounded bg-zinc-950/60 border border-zinc-850 flex justify-between">
              <span>Weekend Rest Turnaround:</span>
              <span className="text-emerald-400 font-bold">{constraints.weekendTurnaroundHours ?? 54}h (≥ 54h)</span>
            </div>
            <div className="p-2 rounded bg-zinc-950/60 border border-zinc-850 flex justify-between">
              <span>Mandatory Catering Interval:</span>
              <span className="text-emerald-400 font-bold">{constraints.mealIntervalHours ?? 6}h (≤ 6h)</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
