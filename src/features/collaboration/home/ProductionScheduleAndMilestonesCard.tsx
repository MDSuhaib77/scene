import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ArrowRight,
  MapPin,
  Film,
  CheckCircle2,
  AlertCircle,
  Clapperboard,
} from 'lucide-react';
import type { FilmProject, FilmPhase } from '../../../types';
import type { ProductionWorkspaceStore } from '../../production/types';
import { ProductionMilestoneVisualizer } from '../../../components/overview/ProductionMilestoneVisualizer';

interface ProductionScheduleAndMilestonesCardProps {
  project: FilmProject;
  operationalStore: ProductionWorkspaceStore;
  simulatedDate?: string;
  onNavigateTab?: (tab: string) => void;
  isDark?: boolean;
}

export function ProductionScheduleAndMilestonesCard({
  project,
  operationalStore,
  simulatedDate,
  onNavigateTab,
  isDark = true,
}: ProductionScheduleAndMilestonesCardProps) {
  const todayStr = useMemo(() => {
    return simulatedDate || new Date().toISOString().slice(0, 10);
  }, [simulatedDate]);

  // Active production phase
  const activePhase = useMemo(() => {
    return (
      project.phases?.find((p) => p.status === 'in_progress') ||
      project.phases?.find((p) => p.category === 'prod') ||
      project.phases?.[0]
    );
  }, [project.phases]);

  // Shooting progress calculation
  const shootingProgress = useMemo(() => {
    const shootingDays = operationalStore.shootingDays || [];
    let activeDay = shootingDays.find((d) => d.date === todayStr);
    const totalDays =
      shootingDays.length > 0
        ? Math.max(shootingDays.length, Math.max(...shootingDays.map((d) => d.dayNumber)))
        : activePhase?.durationDays || 24;
    const currentDayNumber = activeDay ? activeDay.dayNumber : 1;
    const progressPercent = Math.min(100, Math.round((currentDayNumber / Math.max(1, totalDays)) * 100));

    return {
      activeDay,
      currentDayNumber,
      totalDays,
      progressPercent,
    };
  }, [operationalStore.shootingDays, todayStr, activePhase]);

  // Calendar Focus item
  const focusItem = useMemo(() => {
    const events = operationalStore.events || [];
    const shootingDays = operationalStore.shootingDays || [];
    const allActivities = (project.phases || []).flatMap((p) =>
      (p.activities || []).map((a) => ({ ...a, phaseName: p.name, phaseCategory: p.category }))
    );

    // 1. Is there an event today?
    const eventToday = events.find((e) => e.date === todayStr);
    if (eventToday) {
      return {
        title: eventToday.title,
        subtitle: eventToday.type ? `${eventToday.type.toUpperCase()} EVENT` : 'CALENDAR EVENT',
        date: eventToday.date,
        time: eventToday.startTime ? `${eventToday.startTime} - ${eventToday.endTime || 'Wrap'}` : 'All Day',
        location: eventToday.location || null,
        statusText: 'TODAY ON CALENDAR',
        dotClass: 'bg-rose-400 animate-pulse',
        badgeClass: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
      };
    }

    // 2. Is there a shoot day today?
    const shootDayToday = shootingDays.find((d) => d.date === todayStr);
    if (shootDayToday) {
      return {
        title: `Day ${String(shootDayToday.dayNumber).padStart(2, '0')}: Principal Photography`,
        subtitle: shootDayToday.title || `${shootDayToday.sceneIds?.length || 0} Scenes Scheduled`,
        date: shootDayToday.date,
        time: shootDayToday.callTime ? `Call: ${shootDayToday.callTime}` : 'Call: 07:00 AM',
        location: shootDayToday.location || project.primaryLocation || null,
        statusText: 'ON SET TODAY',
        dotClass: 'bg-emerald-400 animate-ping',
        badgeClass: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
      };
    }

    // 3. Is there an active phase task today?
    const taskToday = allActivities.find(
      (a) => a.startDate && a.endDate && a.startDate <= todayStr && a.endDate >= todayStr && !a.completed
    );
    if (taskToday) {
      return {
        title: taskToday.name,
        subtitle: `${taskToday.phaseName || 'Phase'} Task`,
        date: taskToday.startDate,
        time: taskToday.assignedRole ? `Assigned: ${taskToday.assignedRole}` : 'Scheduled Task',
        location: null,
        statusText: 'ACTIVE PHASE TASK',
        dotClass: 'bg-cyan-400 animate-pulse',
        badgeClass: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
      };
    }

    // 4. Upcoming shoot or event
    const futureShoots = shootingDays
      .filter((d) => d.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (futureShoots.length > 0) {
      const nextShoot = futureShoots[0];
      return {
        title: `Day ${String(nextShoot.dayNumber).padStart(2, '0')}: Next Scheduled Shoot`,
        subtitle: nextShoot.title || `${nextShoot.sceneIds?.length || 0} Scenes Scheduled`,
        date: nextShoot.date,
        time: nextShoot.callTime ? `Call: ${nextShoot.callTime}` : 'Planned Call: 07:00 AM',
        location: nextShoot.location || project.primaryLocation || null,
        statusText: 'UPCOMING SHOOT',
        dotClass: 'bg-amber-400',
        badgeClass: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
      };
    }

    const futureEvents = events
      .filter((e) => e.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (futureEvents.length > 0) {
      const nextEvent = futureEvents[0];
      return {
        title: nextEvent.title,
        subtitle: nextEvent.type ? `${nextEvent.type.toUpperCase()} EVENT` : 'CALENDAR EVENT',
        date: nextEvent.date,
        time: nextEvent.startTime || 'Scheduled',
        location: nextEvent.location || null,
        statusText: 'UPCOMING EVENT',
        dotClass: 'bg-cyan-400',
        badgeClass: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
      };
    }

    return null;
  }, [operationalStore.events, operationalStore.shootingDays, project.phases, todayStr, project.primaryLocation]);

  return (
    <div
      data-testid="production-schedule-combined-card"
      className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#181109]/90 via-[#101316]/95 to-[#080D15]/95 backdrop-blur-2xl border border-amber-500/25 shadow-[0_10px_32px_rgba(245,158,11,0.1)] relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300 h-full"
    >
      {/* Subtle Warm Amber Reflected Gradient */}
      <div
        className="absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 group-hover:opacity-35 transition-opacity"
        style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.4), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-3.5">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-300 font-bold">
              SCHEDULE & MILESTONES
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Day {shootingProgress.currentDayNumber} of {shootingProgress.totalDays}
            </span>
            <span className="text-[10px] font-mono text-slate-400">Pace: 24 FPS</span>
          </div>
        </div>

        {/* 2-Column Split: Calendar Focus (Left) + Production Pace (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
          {/* Left Focus (7 cols) */}
          <div className="md:col-span-7 space-y-1.5 min-w-0">
            {focusItem ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono font-semibold uppercase tracking-wider border ${focusItem.badgeClass}`}
                  >
                    <span className={`w-1 h-1 rounded-full ${focusItem.dotClass}`} />
                    <span>{focusItem.statusText}</span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-400/90 uppercase tracking-wide truncate">
                    {focusItem.subtitle}
                  </span>
                </div>

                <div className="text-base sm:text-lg font-bold tracking-tight text-white font-sans truncate">
                  {focusItem.title}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300 font-mono">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{focusItem.time}</span>
                  </div>
                  {focusItem.location && (
                    <div className="flex items-center gap-1 text-slate-400 truncate">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      <span className="truncate">{focusItem.location}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                  Today's Schedule
                </span>
                <p className="text-xs font-semibold text-slate-300">No scheduled production events today</p>
                <p className="text-[10px] font-mono text-slate-500">Standby for next shooting call</p>
              </div>
            )}
          </div>

          {/* Right Progress Gauge (5 cols) */}
          <div className="md:col-span-5 space-y-1.5 md:border-l md:border-white/[0.06] md:pl-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Overall Progress
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-amber-300">
                {shootingProgress.progressPercent}%
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full bg-black/50 border border-white/10 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                style={{ width: `${shootingProgress.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Milestone Visualizer Ribbon */}
        {project.phases && project.phases.length > 0 && (
          <div className="pt-2 border-t border-white/[0.04]">
            <ProductionMilestoneVisualizer
              phases={project.phases}
              activePhaseId={activePhase?.id}
              simulatedDate={todayStr}
              targetDate={project.finalEndDate}
              isEndDateFixed={project.isEndDateFixed}
              onNavigateTab={onNavigateTab}
              isDark={isDark}
            />
          </div>
        )}
      </div>

      {/* Footer Navigation Trigger */}
      <div className="relative z-10 pt-2.5 mt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400 text-[11px]">Production Calendar & Stripboard</span>
        <button
          type="button"
          onClick={() => onNavigateTab?.('production')}
          className="text-amber-400 font-medium hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Open Calendar</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
