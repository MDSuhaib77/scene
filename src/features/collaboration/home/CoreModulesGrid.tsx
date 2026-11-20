import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ArrowRight,
  FileText,
  Layers,
  Clapperboard,
} from 'lucide-react';
import type { FilmProject } from '../../../types';
import type { ProductionWorkspaceStore } from '../../production/types';
import { getProductionVisualizeStore } from '../../visualize/services/visualizeFoundationService';

interface CoreModulesGridProps {
  project: FilmProject;
  operationalStore: ProductionWorkspaceStore;
  simulatedDate?: string;
  onNavigateTab?: (tab: string) => void;
  isDark?: boolean;
}

export function CoreModulesGrid({
  project,
  operationalStore,
  simulatedDate,
  onNavigateTab,
  isDark = true,
}: CoreModulesGridProps) {
  const todayStr = useMemo(() => {
    return simulatedDate || new Date().toISOString().slice(0, 10);
  }, [simulatedDate]);

  // ---------------------------------------------------------------------------
  // 1. PRODUCTION SCHEDULE & CALENDAR DATA (Authoritative Ruby Red Scheme)
  // ---------------------------------------------------------------------------
  const activePhase = useMemo(() => {
    return (
      project.phases?.find((p) => p.status === 'in_progress') ||
      project.phases?.find((p) => p.category === 'prod') ||
      project.phases?.[0]
    );
  }, [project.phases]);

  const scheduleData = useMemo(() => {
    const shootingDays = operationalStore.shootingDays || [];
    const events = operationalStore.events || [];
    const activeDay = shootingDays.find((d) => d.date === todayStr);

    const totalDays =
      shootingDays.length > 0
        ? Math.max(shootingDays.length, Math.max(...shootingDays.map((d) => d.dayNumber || 0)))
        : activePhase?.durationDays || 0;

    const currentDayNumber = activeDay
      ? activeDay.dayNumber
      : shootingDays.filter((d) => d.date <= todayStr).length;

    const progressPercent =
      totalDays > 0 ? Math.min(100, Math.round((currentDayNumber / totalDays) * 100)) : 0;

    const shootToday = shootingDays.find((d) => d.date === todayStr);
    const eventToday = events.find((e) => e.date === todayStr);

    let headline = 'Principal Photography';
    let detail = 'Standby for next shooting call';

    if (shootToday) {
      headline = `Day ${String(shootToday.dayNumber).padStart(2, '0')}: ${shootToday.title || 'Shooting Day'}`;
      detail = shootToday.callTime ? `Call: ${shootToday.callTime}` : 'Call Time Pending';
    } else if (eventToday) {
      headline = eventToday.title;
      detail = eventToday.startTime
        ? `${eventToday.startTime} - ${eventToday.endTime || 'Wrap'}`
        : 'Scheduled Calendar Event';
    } else if (activePhase) {
      headline = activePhase.name;
      detail = 'No active calls scheduled for today';
    } else {
      headline = 'No Active Schedule';
      detail = 'Configure shoot days in Calendar';
    }

    const badge = totalDays > 0 ? `Day ${currentDayNumber} of ${totalDays}` : 'Unscheduled';

    return {
      currentDayNumber,
      totalDays,
      progressPercent,
      headline,
      detail,
      badge,
    };
  }, [operationalStore.shootingDays, operationalStore.events, todayStr, activePhase]);

  // ---------------------------------------------------------------------------
  // 2. SCREENPLAY MODULE DATA (Authoritative Cyan Scheme)
  // ---------------------------------------------------------------------------
  const screenplayData = useMemo(() => {
    const versions = project.screenplayVersions || [];
    const activeScript =
      versions.find((v) => v.id === (project as any).activeScreenplayVersionId) ||
      versions[0] ||
      null;

    let scenes: any[] = [];
    if (activeScript?.extractedScenes && activeScript.extractedScenes.length > 0) {
      scenes = activeScript.extractedScenes;
    } else if (activeScript?.scenes && activeScript.scenes.length > 0) {
      scenes = activeScript.scenes;
    } else if (Array.isArray((project as any).scenes) && (project as any).scenes.length > 0) {
      scenes = (project as any).scenes;
    }

    const sceneCount = scenes.length > 0 ? scenes.length : activeScript?.totalScenes || 0;
    const pageCount =
      (project as any).pagesCount ||
      activeScript?.pageCount ||
      (scenes.length > 0
        ? Math.ceil(
            scenes.reduce(
              (acc: number, s: any) =>
                acc + (s.pageLengthEighths ? s.pageLengthEighths / 8 : 1),
              0
            )
          )
        : 0);

    const versionStr = activeScript?.version || 'v1.0';
    const statusStr = activeScript?.status || (activeScript ? 'Draft' : 'No Script');
    const titleStr = activeScript?.title || (activeScript ? `${project.title} Script` : 'No Script Uploaded');
    const author = activeScript?.author || project.writer || project.director || 'Unassigned';

    const badge = activeScript ? `${versionStr} · ${statusStr}` : 'No Script';

    return {
      versionStr,
      statusStr,
      titleStr,
      sceneCount,
      pageCount,
      author,
      badge,
      hasScript: Boolean(activeScript),
    };
  }, [project]);

  // ---------------------------------------------------------------------------
  // 3. BREAKDOWN MODULE DATA (Authoritative Emerald Scheme)
  // ---------------------------------------------------------------------------
  const breakdownData = useMemo(() => {
    const catalog = project.elementCatalog || [];
    const castCount = catalog.filter(
      (e) => e.category === 'cast' || (e as any).category === 'character'
    ).length;
    const locationCount = catalog.filter((e) => e.category === 'location').length;
    const propCount = catalog.filter(
      (e) => e.category === 'prop' || e.category === 'vehicle' || e.category === 'wardrobe'
    ).length;
    const totalElements = catalog.length;

    const assocs = project.sceneBreakdownAssociations || [];
    const taggedCount = assocs.length;

    const detail =
      taggedCount > 0
        ? `${taggedCount} scene tags indexed`
        : totalElements > 0
        ? `${totalElements} elements cataloged`
        : 'No elements indexed yet';

    return {
      castCount,
      locationCount,
      propCount,
      totalElements,
      taggedCount,
      detail,
    };
  }, [project]);

  // ---------------------------------------------------------------------------
  // 4. VISUALISE MODULE DATA (Authoritative Yellow Scheme)
  // ---------------------------------------------------------------------------
  const visualizeData = useMemo(() => {
    const store = getProductionVisualizeStore(project);
    const panelsCount = (store.storyboardPanels || []).length;
    const cameraSetupsCount = (store.cameraSetups || []).length;
    const shotsCount = (store.shots || []).length;
    const boardsCount =
      (store.boards || []).length ||
      (store.lookbookBoards || []).length ||
      (store.moodBoards || []).length ||
      0;

    const detail =
      cameraSetupsCount > 0 || boardsCount > 0
        ? `${cameraSetupsCount} Setups · ${boardsCount} Lookbooks`
        : 'Visual Planning & Setups';

    return {
      panelsCount,
      cameraSetupsCount,
      shotsCount,
      boardsCount,
      detail,
    };
  }, [project]);

  return (
    <div
      data-testid="core-modules-grid"
      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 h-full"
    >
      {/* ===================================================================
          SQUARE 1: PRODUCTION / SCHEDULE (Canonical Ruby Red / Rose Scheme)
         =================================================================== */}
      <div
        data-testid="module-card-schedule"
        onClick={() => onNavigateTab?.('production')}
        className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#1A0A12]/95 via-[#13070E]/95 to-[#0A0912]/95 backdrop-blur-2xl border border-rose-500/25 hover:border-rose-500/45 shadow-[0_8px_24px_rgba(244,63,94,0.08)] transition-all duration-200 cursor-pointer overflow-hidden min-h-[175px]"
      >
        <div
          className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-25"
          style={{ background: 'radial-gradient(circle, #f43f5e, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* Card Header */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
            <CalendarIcon className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-rose-200/90">
              Schedule
            </span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            {scheduleData.badge}
          </span>
        </div>

        {/* Card Body */}
        <div className="relative z-10 my-1.5 space-y-2">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-white font-sans truncate">
              {scheduleData.headline}
            </p>
            <p className="text-[11px] font-mono text-slate-400 truncate">
              {scheduleData.detail}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">Progress</span>
              <span className="text-rose-300 font-bold">{scheduleData.progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                style={{ width: `${scheduleData.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card Footer Link */}
        <div className="relative z-10 flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px] font-medium text-rose-300 group-hover:text-rose-200">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Calendar & Strip</span>
          <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Calendar</span>
            <ArrowRight className="w-3 h-3 text-rose-400" />
          </span>
        </div>
      </div>

      {/* ===================================================================
          SQUARE 2: SCREENPLAY (Canonical Electric Cyan Scheme)
         =================================================================== */}
      <div
        data-testid="module-card-screenplay"
        onClick={() => onNavigateTab?.('screenplay')}
        className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#071720]/95 via-[#061017]/95 to-[#080D15]/95 backdrop-blur-2xl border border-cyan-500/25 hover:border-cyan-500/45 shadow-[0_8px_24px_rgba(6,182,212,0.08)] transition-all duration-200 cursor-pointer overflow-hidden min-h-[175px]"
      >
        <div
          className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-25"
          style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* Card Header */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-cyan-200/90">
              Screenplay
            </span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            {screenplayData.badge}
          </span>
        </div>

        {/* Card Body */}
        <div className="relative z-10 my-1.5 space-y-2">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-white font-sans truncate">
              {screenplayData.titleStr}
            </p>
            <p className="text-[11px] font-mono text-slate-400 truncate">
              {screenplayData.author}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Scenes</span>
              <strong className="text-sm font-bold text-cyan-200">{screenplayData.sceneCount}</strong>
            </div>
            <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Pages</span>
              <strong className="text-sm font-bold text-cyan-200">{screenplayData.pageCount}</strong>
            </div>
          </div>
        </div>

        {/* Card Footer Link */}
        <div className="relative z-10 flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px] font-medium text-cyan-300 group-hover:text-cyan-200">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Script Intelligence</span>
          <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Screenplay</span>
            <ArrowRight className="w-3 h-3 text-cyan-400" />
          </span>
        </div>
      </div>

      {/* ===================================================================
          SQUARE 3: BREAKDOWN (Canonical Emerald Green Scheme)
         =================================================================== */}
      <div
        data-testid="module-card-breakdown"
        onClick={() => onNavigateTab?.('breakdown')}
        className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#061711]/95 via-[#05110C]/95 to-[#080F0D]/95 backdrop-blur-2xl border border-emerald-500/25 hover:border-emerald-500/45 shadow-[0_8px_24px_rgba(16,185,129,0.08)] transition-all duration-200 cursor-pointer overflow-hidden min-h-[175px]"
      >
        <div
          className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-25"
          style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* Card Header */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-emerald-200/90">
              Breakdown
            </span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {breakdownData.totalElements} Elements
          </span>
        </div>

        {/* Card Body */}
        <div className="relative z-10 my-1.5 space-y-2">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-white font-sans truncate">
              Production Master Catalog
            </p>
            <p className="text-[11px] font-mono text-slate-400 truncate">
              {breakdownData.detail}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center">
            <div className="p-1 rounded-lg bg-black/40 border border-white/5">
              <span className="block text-[8px] uppercase tracking-wider text-slate-400">Cast</span>
              <strong className="text-xs font-bold text-emerald-200">{breakdownData.castCount}</strong>
            </div>
            <div className="p-1 rounded-lg bg-black/40 border border-white/5">
              <span className="block text-[8px] uppercase tracking-wider text-slate-400">Locations</span>
              <strong className="text-xs font-bold text-emerald-200">{breakdownData.locationCount}</strong>
            </div>
            <div className="p-1 rounded-lg bg-black/40 border border-white/5">
              <span className="block text-[8px] uppercase tracking-wider text-slate-400">Props</span>
              <strong className="text-xs font-bold text-emerald-200">{breakdownData.propCount}</strong>
            </div>
          </div>
        </div>

        {/* Card Footer Link */}
        <div className="relative z-10 flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px] font-medium text-emerald-300 group-hover:text-emerald-200">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Element Catalog</span>
          <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Breakdown</span>
            <ArrowRight className="w-3 h-3 text-emerald-400" />
          </span>
        </div>
      </div>

      {/* ===================================================================
          SQUARE 4: VISUALISE (Canonical Warm Yellow Scheme)
         =================================================================== */}
      <div
        data-testid="module-card-visualise"
        onClick={() => onNavigateTab?.('visualize')}
        className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#1A1608]/95 via-[#120F06]/95 to-[#0A0D12]/95 backdrop-blur-2xl border border-yellow-500/25 hover:border-yellow-500/45 shadow-[0_8px_24px_rgba(245,240,0,0.08)] transition-all duration-200 cursor-pointer overflow-hidden min-h-[175px]"
      >
        <div
          className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-25"
          style={{ background: 'radial-gradient(circle, #F5F000, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* Card Header */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5F000] shadow-[0_0_6px_rgba(245,240,0,0.8)]" />
            <Clapperboard className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-yellow-200/90">
              Visualise
            </span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
            {visualizeData.shotsCount} Shots
          </span>
        </div>

        {/* Card Body */}
        <div className="relative z-10 my-1.5 space-y-2">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-white font-sans truncate">
              Camera & Boards
            </p>
            <p className="text-[11px] font-mono text-slate-400 truncate">
              {visualizeData.detail}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Storyboards</span>
              <strong className="text-sm font-bold text-yellow-200">{visualizeData.panelsCount}</strong>
            </div>
            <div className="p-1.5 rounded-lg bg-black/40 border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-slate-400">Camera Setups</span>
              <strong className="text-sm font-bold text-yellow-200">{visualizeData.cameraSetupsCount}</strong>
            </div>
          </div>
        </div>

        {/* Card Footer Link */}
        <div className="relative z-10 flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px] font-medium text-yellow-300 group-hover:text-yellow-200">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Boards & Setups</span>
          <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Visualise</span>
            <ArrowRight className="w-3 h-3 text-yellow-400" />
          </span>
        </div>
      </div>
    </div>
  );
}
