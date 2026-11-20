import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ArrowRight,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clapperboard,
} from 'lucide-react';
import type { FilmProject } from '../../../types';
import type { ProductionWorkspaceStore } from '../../production/types';

interface CalendarFocusCardProps {
  project: FilmProject;
  operationalStore: ProductionWorkspaceStore;
  simulatedDate?: string;
  onNavigateTab?: (tab: string) => void;
  isDark?: boolean;
}

export function CalendarFocusCard({
  project,
  operationalStore,
  simulatedDate,
  onNavigateTab,
  isDark = true,
}: CalendarFocusCardProps) {
  const todayStr = useMemo(() => {
    return simulatedDate || new Date().toISOString().slice(0, 10);
  }, [simulatedDate]);

  // Retrieve actual calendar records
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
        kind: 'event' as const,
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
        kind: 'shoot' as const,
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

    // 3. Is there an active phase activity occurring today?
    const taskToday = allActivities.find((a) => a.startDate && a.endDate && a.startDate <= todayStr && a.endDate >= todayStr && !a.completed);
    if (taskToday) {
      return {
        kind: 'task' as const,
        title: taskToday.name,
        subtitle: `${taskToday.phaseName || 'Production Phase'} Task`,
        date: taskToday.startDate,
        time: taskToday.assignedRole ? `Assigned: ${taskToday.assignedRole}` : 'Scheduled Task',
        location: null,
        statusText: 'ACTIVE PHASE TASK',
        dotClass: 'bg-cyan-400 animate-pulse',
        badgeClass: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
      };
    }

    // 4. Look for the nearest future event or shoot day
    const futureShoots = shootingDays
      .filter((d) => d.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (futureShoots.length > 0) {
      const nextShoot = futureShoots[0];
      return {
        kind: 'shoot' as const,
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
        kind: 'event' as const,
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

    const futureTasks = allActivities
      .filter((a) => a.startDate && a.startDate > todayStr && !a.completed)
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    if (futureTasks.length > 0) {
      const nextTask = futureTasks[0];
      return {
        kind: 'task' as const,
        title: nextTask.name,
        subtitle: `${nextTask.phaseName} Milestone`,
        date: nextTask.startDate!,
        time: nextTask.assignedRole || 'Phase Milestone',
        location: null,
        statusText: 'NEXT MILESTONE',
        dotClass: 'bg-indigo-400',
        badgeClass: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
      };
    }

    return null;
  }, [operationalStore.events, operationalStore.shootingDays, project.phases, todayStr, project.primaryLocation]);

  if (!focusItem) {
    return (
      <div
        data-testid="calendar-focus-empty-card"
        className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-[#090D15]/80 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden h-full min-h-[220px] group hover:border-amber-500/30 transition-all"
      >
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="uppercase tracking-wider font-semibold text-slate-300">
              Calendar Focus
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">{todayStr}</span>
        </div>

        <div className="my-auto py-3 text-center space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300 mx-auto">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-200">No activity scheduled</p>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
            No shoot days, calendar events or milestone deadlines scheduled for this date.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab?.('production')}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-amber-300 hover:text-amber-200 transition cursor-pointer"
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Open Production Calendar</span>
        </button>
      </div>
    );
  }

  // Format date nicely
  const parsedDate = new Date(focusItem.date + 'T12:00:00');
  const formattedDateStr = !isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : focusItem.date;

  return (
    <div
      data-testid="calendar-focus-card"
      onClick={() => onNavigateTab?.('production')}
      className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-[#090E17]/85 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-amber-500/40 transition-all cursor-pointer h-full min-h-[220px]"
    >
      {/* Subtle Reflected Glow */}
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity"
        style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.4), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-3.5">
        {/* Header & Status Pill */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 font-semibold block">
            CALENDAR FOCUS
          </span>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border ${focusItem.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${focusItem.dotClass}`} />
            <span>{focusItem.statusText}</span>
          </span>
        </div>

        {/* Task Title & Subtitle */}
        <div className="pt-1">
          <div className="text-[11px] font-mono text-amber-400/90 uppercase tracking-wider font-semibold">
            {focusItem.subtitle}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans mt-0.5 group-hover:text-amber-100 transition-colors">
            {focusItem.title}
          </h3>
        </div>

        {/* Date, Time & Location Details */}
        <div className="space-y-1.5 pt-1 text-xs text-slate-300 font-mono">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-medium text-white">{formattedDateStr}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{focusItem.time}</span>
          </div>

          {focusItem.location && (
            <div className="flex items-center gap-2 text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{focusItem.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Link */}
      <div className="relative z-10 pt-4 mt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400">Production Schedule</span>
        <span className="text-amber-400 font-medium group-hover:text-amber-300 flex items-center gap-1 transition-colors">
          <span>View in Calendar</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </div>
  );
}
