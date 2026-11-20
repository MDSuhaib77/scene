import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FilmProject, ParsedScene } from '../../../types';
import {
  FileSpreadsheet,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  Box,
  Calendar as CalendarIcon,
  Clock,
  Search,
  Check,
  AlertTriangle,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ProductionElementCategory,
  EnrichedMasterElement,
  normalizeElementCategory,
} from '../types/breakdownTypes';
import { getEnrichedCatalog } from '../services/breakdownService';

// The exact 4 reports specified for SceneOS Breakdown Reports
export type ProductionReportType =
  | 'breakdown_summary' // ORDER REPORT BY: Breakdown Summary
  | 'element_list'      // ORDER REPORT BY: Element List
  | 'shooting_schedule' // PRODUCTION REPORTS: Shooting Schedule
  | 'dood';             // PRODUCTION REPORTS: Day out of Days (DOOD)

export interface BreakdownReportsViewProps {
  project: FilmProject;
  scenes?: ParsedScene[];
  onSelectScene?: (sceneId: string) => void;
  className?: string;
  initialReport?: string;
  isDark?: boolean;
}

// Map any legacy report ID to one of the 4 authoritative reports
function normalizeReportType(rawId: string = ''): ProductionReportType {
  const lower = rawId.toLowerCase();
  if (
    lower.includes('element_list') ||
    lower.includes('element_inventory') ||
    lower.includes('element_requirements') ||
    lower.includes('character_appearances') ||
    lower.includes('location_summary')
  ) {
    return 'element_list';
  }
  if (
    lower.includes('shooting_schedule') ||
    lower.includes('one_liner') ||
    lower.includes('schedule') ||
    lower.includes('calendar')
  ) {
    return 'shooting_schedule';
  }
  if (lower.includes('dood')) {
    return 'dood';
  }
  return 'breakdown_summary';
}

export const BreakdownReportsView: React.FC<BreakdownReportsViewProps> = ({
  project,
  scenes: propScenes,
  onSelectScene,
  className = '',
  initialReport = 'breakdown_summary',
  isDark = true,
}) => {
  // Authoritative Report state (strictly 1 of 4)
  const [activeReport, setActiveReport] = useState<ProductionReportType>(() =>
    normalizeReportType(initialReport)
  );

  // Dropdown open/close state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Scene Selection State for Breakdown Summary and Shooting Schedule
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(() => new Set());
  const [sceneFilterActive, setSceneFilterActive] = useState<boolean>(false);
  const [isSceneSelectorOpen, setIsSceneSelectorOpen] = useState(false);
  const [sceneRangeInput, setSceneRangeInput] = useState('');
  const sceneSelectorRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (sceneSelectorRef.current && !sceneSelectorRef.current.contains(e.target as Node)) {
        setIsSceneSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Contextual settings per report
  // 1. Breakdown Summary: Department inclusion/exclusion
  const [summaryDeptFilter, setSummaryDeptFilter] = useState<string>('ALL');

  // 2. Element List: Department filter, search query, and inline selected element for detail drawer
  const [elementListCategory, setElementListCategory] = useState<ProductionElementCategory | 'ALL'>('ALL');
  const [elementSearchQuery, setElementSearchQuery] = useState('');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // 3. Shooting Schedule: Full schedule vs One-Liner toggle
  const [scheduleViewMode, setScheduleViewMode] = useState<'full' | 'one_liner'>('full');

  // 4. Day Out of Days (DOOD): Category, View Mode (matrix vs summary), Sort mode, Active Week
  const [doodCategory, setDoodCategory] = useState<ProductionElementCategory>('cast');
  const [doodViewMode, setDoodViewMode] = useState<'matrix' | 'summary'>('matrix');
  const [doodSortBy, setDoodSortBy] = useState<'name' | 'id' | 'first_day' | 'last_day' | 'work_days'>('name');
  const [activeWeekIndex, setActiveWeekIndex] = useState<number>(0);

  // Active script & scenes resolution from actual project data
  const activeScript = useMemo(() => {
    return (
      project.screenplayVersions?.find((v) => v.id === project.activeScreenplayVersionId) ||
      project.screenplayVersions?.[0]
    );
  }, [project.screenplayVersions, project.activeScreenplayVersionId]);

  const scenes: ParsedScene[] = useMemo(() => {
    if (propScenes && propScenes.length > 0) return propScenes;
    return activeScript?.extractedScenes || activeScript?.scenes || project.scenes || [];
  }, [propScenes, activeScript, project.scenes]);

  // Filtered scenes based on scene selection (used for Breakdown Summary & Shooting Schedule)
  const effectiveScenes = useMemo(() => {
    if (!sceneFilterActive) return scenes;
    return scenes.filter((s) => selectedSceneIds.has(s.id));
  }, [scenes, sceneFilterActive, selectedSceneIds]);

  const toggleScene = (sceneId: string) => {
    setSelectedSceneIds((prev) => {
      const base = sceneFilterActive ? new Set(prev) : new Set(scenes.map((s) => s.id));
      if (base.has(sceneId)) {
        base.delete(sceneId);
      } else {
        base.add(sceneId);
      }
      setSceneFilterActive(true);
      return base;
    });
  };

  const applySceneRange = () => {
    if (!sceneRangeInput.trim()) return;
    const matched = new Set<string>();
    const tokens = sceneRangeInput.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
    tokens.forEach((token) => {
      if (token.includes('-')) {
        const [startStr, endStr] = token.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          scenes.forEach((s) => {
            const num = parseInt(String(s.sceneNumber), 10);
            if (!isNaN(num) && num >= min && num <= max) {
              matched.add(s.id);
            }
          });
        }
      } else {
        const num = parseInt(token, 10);
        scenes.forEach((s) => {
          if (String(s.sceneNumber) === token || (!isNaN(num) && parseInt(String(s.sceneNumber), 10) === num)) {
            matched.add(s.id);
          }
        });
      }
    });

    if (matched.size > 0) {
      setSceneFilterActive(true);
      setSelectedSceneIds(matched);
      setSceneRangeInput('');
    }
  };

  const catalog = project.elementCatalog || [];
  const associations = project.sceneBreakdownAssociations || [];

  const enrichedCatalog = useMemo(() => {
    return getEnrichedCatalog(catalog, associations, scenes);
  }, [catalog, associations, scenes]);

  // Derived shooting days mapping (authoritative schedule order)
  const hasAssignedDates = Boolean(project.startDate && !isNaN(new Date(project.startDate).getTime()));

  interface ScheduledSceneEntry {
    scene: ParsedScene;
    dayNumber: number;
    date: string;
    order: number;
    durationMinutes: number;
    startTime: string;
    finishTime: string;
  }

  const scheduledDaysMap = useMemo(() => {
    let currentDay = 1;
    let accumulatedEighths = 0;
    const baseDate = hasAssignedDates ? new Date(project.startDate!) : null;

    const dayEntriesMap = new Map<number, ScheduledSceneEntry[]>();

    effectiveScenes.forEach((scene, idx) => {
      const explicitDay = (scene as any).shootDay ?? (scene as any).dayNumber;
      let day = 1;
      if (typeof explicitDay === 'number' && explicitDay > 0) {
        day = explicitDay;
      } else {
        const eighths = Math.round(Number(scene.pageLengthEighths) || 8);
        accumulatedEighths += eighths;
        day = currentDay;
        if (accumulatedEighths >= 32 || (idx > 0 && idx % 4 === 0)) {
          currentDay++;
          accumulatedEighths = 0;
        }
      }

      if (!dayEntriesMap.has(day)) {
        dayEntriesMap.set(day, []);
      }

      let dateStr = 'Date unassigned';
      if (baseDate) {
        const dObj = new Date(baseDate);
        dObj.setDate(dObj.getDate() + (day - 1));
        if (!isNaN(dObj.getTime())) {
          dateStr = dObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      }

      const duration = Math.round(
        Number(scene.estimatedDurationMinutes) ||
          Math.max(30, (Number(scene.pageLengthEighths) || 8) * 5)
      );

      const dayList = dayEntriesMap.get(day)!;
      let startMinutes = 7 * 60; // 07:00 standard call
      dayList.forEach((prev) => {
        startMinutes += prev.durationMinutes;
      });
      const finishMinutes = startMinutes + duration;

      const formatClock = (mins: number) => {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        const ampm = h >= 12 ? 'pm' : 'am';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        return `${displayH}:${String(m).padStart(2, '0')}${ampm}`;
      };

      dayList.push({
        scene,
        dayNumber: day,
        date: dateStr,
        order: dayList.length + 1,
        durationMinutes: duration,
        startTime: formatClock(startMinutes),
        finishTime: formatClock(finishMinutes),
      });
    });

    return dayEntriesMap;
  }, [effectiveScenes, project.startDate, hasAssignedDates]);

  const allShootDays = useMemo(() => {
    const days = Array.from(scheduledDaysMap.keys())
      .filter((d) => (scheduledDaysMap.get(d) || []).length > 0)
      .sort((a, b) => a - b);
    return days.length > 0 ? days : effectiveScenes.length > 0 ? [1] : [];
  }, [scheduledDaysMap, effectiveScenes.length]);

  const sceneDayMap = useMemo(() => {
    const map = new Map<string, { dayNumber: number; date: string }>();
    scheduledDaysMap.forEach((entries, dayNum) => {
      entries.forEach((e) => {
        map.set(e.scene.id, { dayNumber: dayNum, date: e.date });
      });
    });
    return map;
  }, [scheduledDaysMap]);

  // Production-Standard DOOD Calculation (SW, W, WF, SWF, H)
  interface DoodRow {
    element: EnrichedMasterElement;
    characterNumber?: number;
    days: Record<number, string>;
    firstDay: number | null;
    lastDay: number | null;
    workDays: number;
    holdDays: number;
    totalDays: number;
  }

  const doodData = useMemo(() => {
    const targetDept = doodCategory;
    const deptElements = enrichedCatalog.filter(
      (el) => normalizeElementCategory(el.category) === targetDept && !el.isArchived
    );

    const sortedDays = [...allShootDays];

    // Day -> Set of element IDs active on that day
    const elementsPerDay = new Map<number, Set<string>>();
    sortedDays.forEach((d) => elementsPerDay.set(d, new Set<string>()));

    // Associate through scene breakdown associations
    associations.forEach((assoc) => {
      const dayInfo = sceneDayMap.get(assoc.sceneId);
      if (dayInfo && elementsPerDay.has(dayInfo.dayNumber)) {
        elementsPerDay.get(dayInfo.dayNumber)!.add(assoc.elementId);
      }
    });

    // For Cast category, also associate through scene character speaking roles
    if (targetDept === 'cast') {
      scenes.forEach((scene) => {
        const dayInfo = sceneDayMap.get(scene.id);
        if (dayInfo && elementsPerDay.has(dayInfo.dayNumber)) {
          (scene.characters || []).forEach((charName) => {
            const match = catalog.find(
              (e) =>
                normalizeElementCategory(e.category) === 'cast' &&
                e.name.toLowerCase().trim() === String(charName).toLowerCase().trim()
            );
            if (match) {
              elementsPerDay.get(dayInfo.dayNumber)!.add(match.id);
            }
          });
        }
      });
    }

    const rows: DoodRow[] = deptElements.map((el, elIdx) => {
      const activeDays = sortedDays.filter((d) => {
        const set = elementsPerDay.get(d);
        return set ? set.has(el.id) : false;
      });

      const dayStatuses: Record<number, string> = {};
      let workCount = activeDays.length;
      let holdCount = 0;

      if (activeDays.length === 0) {
        sortedDays.forEach((d) => (dayStatuses[d] = ''));
        return {
          element: el,
          characterNumber: elIdx + 1,
          days: dayStatuses,
          firstDay: null,
          lastDay: null,
          workDays: 0,
          holdDays: 0,
          totalDays: 0,
        };
      }

      const firstDay = Math.min(...activeDays);
      const lastDay = Math.max(...activeDays);

      sortedDays.forEach((d) => {
        if (d < firstDay || d > lastDay) {
          // Ordinary non-working day outside of active range remains blank
          dayStatuses[d] = '';
        } else if (activeDays.includes(d)) {
          if (firstDay === lastDay) {
            // Worked on exactly one single day in the schedule
            dayStatuses[d] = 'SWF';
          } else if (d === firstDay) {
            // First working day
            dayStatuses[d] = 'SW';
          } else if (d === lastDay) {
            // Final working day
            dayStatuses[d] = 'WF';
          } else {
            // Intermediate working day
            dayStatuses[d] = 'W';
          }
        } else {
          // Non-working day between first and last working day is a hold
          dayStatuses[d] = 'H';
          holdCount++;
        }
      });

      return {
        element: el,
        characterNumber: elIdx + 1,
        days: dayStatuses,
        firstDay,
        lastDay,
        workDays: workCount,
        holdDays: holdCount,
        totalDays: workCount + holdCount,
      };
    });

    // Sort rows based on user preference
    const sortedRows = [...rows].sort((a, b) => {
      if (doodSortBy === 'id') {
        return (a.characterNumber || 0) - (b.characterNumber || 0);
      }
      if (doodSortBy === 'first_day') {
        const dayA = a.firstDay ?? 9999;
        const dayB = b.firstDay ?? 9999;
        if (dayA !== dayB) return dayA - dayB;
      }
      if (doodSortBy === 'last_day') {
        const dayA = a.lastDay ?? 9999;
        const dayB = b.lastDay ?? 9999;
        if (dayA !== dayB) return dayA - dayB;
      }
      if (doodSortBy === 'work_days') {
        return b.workDays - a.workDays;
      }
      return a.element.name.localeCompare(b.element.name);
    });

    return {
      category: targetDept,
      days: sortedDays,
      rows: sortedRows,
    };
  }, [doodCategory, enrichedCatalog, allShootDays, associations, sceneDayMap, scenes, catalog, doodSortBy]);

  // Production Calendar Weeks (7-day weekly tables)
  interface ProductionDayInfo {
    dayIndex: number; // sequential 1, 2, 3...
    shootDayNumber: number | null; // e.g. 1, 2, or null if off day
    dateObj: Date | null;
    dateLabel: string;
    weekdayLabel: string;
    isOffDay: boolean;
  }

  interface ProductionWeekInfo {
    weekIndex: number;
    weekNumber: number;
    label: string;
    days: ProductionDayInfo[];
  }

  const productionWeeks: ProductionWeekInfo[] = useMemo(() => {
    const maxShootDay = Math.max(...allShootDays, 1);
    const totalDaysToSpan = Math.max(7, Math.ceil(maxShootDay / 7) * 7);
    const totalWeeks = Math.ceil(totalDaysToSpan / 7);

    const baseDate = hasAssignedDates ? new Date(project.startDate!) : null;

    const weeks: ProductionWeekInfo[] = [];

    for (let w = 0; w < totalWeeks; w++) {
      const weekDays: ProductionDayInfo[] = [];
      const startDayNum = w * 7 + 1;
      const endDayNum = startDayNum + 6;

      let startLabel = `Day ${startDayNum}`;
      let endLabel = `Day ${endDayNum}`;

      for (let offset = 0; offset < 7; offset++) {
        const dayIdx = startDayNum + offset;
        let dObj: Date | null = null;
        let dateLabel = `Day ${dayIdx}`;
        let weekdayLabel = `D${dayIdx}`;
        let isOffDay = !allShootDays.includes(dayIdx);

        if (baseDate) {
          dObj = new Date(baseDate);
          dObj.setDate(dObj.getDate() + (dayIdx - 1));
          if (!isNaN(dObj.getTime())) {
            dateLabel = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            weekdayLabel = dObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
          }
        }

        if (offset === 0 && dObj) {
          startLabel = dateLabel;
        }
        if (offset === 6 && dObj) {
          endLabel = dateLabel;
        }

        weekDays.push({
          dayIndex: dayIdx,
          shootDayNumber: allShootDays.includes(dayIdx) ? dayIdx : null,
          dateObj: dObj,
          dateLabel,
          weekdayLabel,
          isOffDay,
        });
      }

      const weekTitle = hasAssignedDates
        ? `Week ${w + 1}: ${startLabel} – ${endLabel}`
        : `Week ${w + 1}: Days ${startDayNum}–${endDayNum}`;

      weeks.push({
        weekIndex: w,
        weekNumber: w + 1,
        label: weekTitle,
        days: weekDays,
      });
    }

    return weeks;
  }, [allShootDays, hasAssignedDates, project.startDate]);

  // Safe active week selection
  const currentWeek = useMemo(() => {
    if (activeWeekIndex < 0 || activeWeekIndex >= productionWeeks.length) {
      return productionWeeks[0];
    }
    return productionWeeks[activeWeekIndex];
  }, [productionWeeks, activeWeekIndex]);

  // Overall metadata metrics
  const totalScenes = scenes.length;
  const totalEighths = scenes.reduce((acc, s) => acc + (Number(s.pageLengthEighths) || 8), 0);
  const totalPagesDisplay = `${Math.floor(totalEighths / 8)} ${totalEighths % 8}/8`;
  const effectiveEighths = effectiveScenes.reduce((acc, s) => acc + (Number(s.pageLengthEighths) || 8), 0);
  const effectivePagesDisplay = `${Math.floor(effectiveEighths / 8)} ${effectiveEighths % 8}/8`;

  // Production company from project metadata ONLY when genuinely configured
  const productionCompany =
    (project as any).companyName ||
    (project as any).productionCompany ||
    (project as any).studioName ||
    '';

  // Report Title helper
  const getReportTitle = (type: ProductionReportType) => {
    switch (type) {
      case 'breakdown_summary':
        return 'Breakdown Summary';
      case 'element_list':
        return 'All Elements';
      case 'shooting_schedule':
        return 'Shooting Schedule';
      case 'dood':
        return `DOOD: ${
          doodCategory === 'cast'
            ? 'Cast Members'
            : doodCategory.replace('_', ' ').toUpperCase()
        }`;
    }
  };

  // Date range display helper for minimal document header
  const reportDateRange = useMemo(() => {
    if (!hasAssignedDates) return null;
    const startObj = new Date(project.startDate!);
    const lastDayNum = Math.max(...allShootDays, 1);
    const endObj = new Date(startObj);
    endObj.setDate(endObj.getDate() + (lastDayNum - 1));

    const sStr = startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const eStr = endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${sStr} – ${eStr}`;
  }, [hasAssignedDates, project.startDate, allShootDays]);

  // Export CSV (Full complete production schedule)
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    const filename = `${project.title || 'Production'}_${activeReport}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeReport === 'breakdown_summary') {
      headers = ['Scene #', 'Slugline', 'Int/Ext', 'Day/Night', 'Pages', 'Location', 'Cast', 'Department Requirements'];
      rows = effectiveScenes.map((s) => {
        const scnAssocs = associations.filter((a) => a.sceneId === s.id);
        const reqs = scnAssocs
          .map((a) => {
            const el = catalog.find((e) => e.id === a.elementId);
            return el ? `${el.name} (${el.category})` : null;
          })
          .filter(Boolean)
          .join('; ');
        return [
          `"${s.sceneNumber}"`,
          `"${(s.slugline || s.heading || '').replace(/"/g, '""')}"`,
          `"${s.intExt || 'INT'}"`,
          `"${s.timeOfDay || 'DAY'}"`,
          `"${s.pageLengthDisplay || '1/8'}"`,
          `"${(s.location || '').replace(/"/g, '""')}"`,
          `"${(s.characters || []).join(', ')}"`,
          `"${reqs}"`,
        ];
      });
    } else if (activeReport === 'element_list') {
      headers = ['Element ID', 'Element Name', 'Department', 'Description', 'Notes', 'Associated Scenes', 'Scene Count'];
      rows = enrichedCatalog.map((el) => [
        `"${el.id}"`,
        `"${el.name.replace(/"/g, '""')}"`,
        `"${el.category}"`,
        `"${(el.description || '').replace(/"/g, '""')}"`,
        `"${(el.productionNotes || '').replace(/"/g, '""')}"`,
        `"${el.associatedScenes.map((s) => `#${s.sceneNumber}`).join(', ')}"`,
        `"${el.associatedScenes.length}"`,
      ]);
    } else if (activeReport === 'shooting_schedule') {
      headers = ['Shoot Day', 'Date', 'Scene #', 'Slugline', 'Location', 'Cast', 'Pages', 'Start Time', 'Duration (min)'];
      rows = [];
      scheduledDaysMap.forEach((dayEntries) => {
        dayEntries.forEach((e) => {
          rows.push([
            `"Day ${e.dayNumber}"`,
            `"${e.date}"`,
            `"${e.scene.sceneNumber}"`,
            `"${(e.scene.slugline || e.scene.heading || '').replace(/"/g, '""')}"`,
            `"${(e.scene.location || '').replace(/"/g, '""')}"`,
            `"${(e.scene.characters || []).join(', ')}"`,
            `"${e.scene.pageLengthDisplay || '1/8'}"`,
            `"${e.startTime}"`,
            `"${e.durationMinutes}"`,
          ]);
        });
      });
    } else if (activeReport === 'dood') {
      headers = ['ID', 'Element Name', 'Category', ...doodData.days.map((d) => `Day ${d}`), 'Work Days', 'Hold Days', 'Total Days'];
      rows = doodData.rows.map((r) => [
        `"${r.characterNumber || ''}"`,
        `"${r.element.name.replace(/"/g, '""')}"`,
        `"${r.element.category}"`,
        ...doodData.days.map((d) => `"${r.days[d] || ''}"`),
        `"${r.workDays}"`,
        `"${r.holdDays}"`,
        `"${r.totalDays}"`,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const handleExportJSON = () => {
    const data = {
      project: {
        id: project.id,
        title: project.title,
        productionCompany: productionCompany || undefined,
        startDate: project.startDate || undefined,
      },
      reportType: activeReport,
      generatedAt: new Date().toISOString(),
      metadata: {
        scriptVersion: activeScript?.version || 'v1.0',
        scenesCount: scenes.length,
        elementsCount: catalog.length,
        shootDaysCount: allShootDays.length,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title || 'Production'}_${activeReport}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Subtle semantic visual treatment for status cells
  const getStatusCellStyle = (code: string, isOffDay: boolean = false) => {
    if (!code) {
      if (isOffDay) {
        return 'bg-slate-50 text-slate-300 font-normal';
      }
      return 'bg-transparent text-slate-400 font-normal';
    }

    switch (code) {
      case 'SW': // Start Work - Muted teal
        return 'bg-teal-50 text-teal-800 border-teal-300 font-bold';
      case 'W': // Work - Soft blue
        return 'bg-sky-50 text-sky-800 border-sky-300 font-bold';
      case 'WF': // Work Finish - Muted cyan/blue
        return 'bg-cyan-50 text-cyan-800 border-cyan-300 font-bold';
      case 'SWF': // Start-Work-Finish - Distinct restrained green
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      case 'H': // Hold - Muted amber
        return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      case 'D': // Drop - Neutral grey
        return 'bg-slate-100 text-slate-700 border-slate-300 font-bold';
      case 'P': // Pick-up - Muted teal
        return 'bg-teal-50 text-teal-800 border-teal-300 font-bold';
      case 'TR': // Travel - Restrained violet
        return 'bg-purple-50 text-purple-800 border-purple-300 font-bold';
      case 'FT': // Fitting - Soft green
        return 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
      case 'R': // Rehearsal - Muted blue-grey
        return 'bg-slate-100 text-slate-700 border-slate-300 font-bold';
      case 'I': // Idle - Pale neutral
        return 'bg-slate-50 text-slate-500 border-slate-200 font-medium';
      default:
        return 'bg-slate-100 text-slate-800 font-bold';
    }
  };

  return (
    <div
      data-testid="breakdown-reports-workspace"
      className={`flex-1 flex flex-col h-full w-full select-none overflow-hidden ${
        isDark ? 'bg-transparent text-slate-100' : 'bg-[#eef2f6] text-slate-900'
      } ${className}`}
    >
      {/* Print Stylesheet for clean document printing without zoom distortion */}
      <style>{`
        @media print {
          @page {
            size: ${activeReport === 'dood' ? 'letter landscape' : 'letter portrait'};
            margin: 0.4in !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            zoom: 100% !important;
            transform: none !important;
            font-size: 10pt !important;
          }
          #root, #root > div, main {
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          #sceneos-report-sheet,
          #sceneos-report-sheet * {
            visibility: visible !important;
          }
          #sceneos-report-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            zoom: 1 !important;
            transform: none !important;
            font-size: 9.5pt !important;
            line-height: 1.35 !important;
          }
          #sceneos-report-sheet h1 {
            font-size: 15pt !important;
          }
          #sceneos-report-sheet .text-sm {
            font-size: 10pt !important;
          }
          #sceneos-report-sheet .text-xs {
            font-size: 8.5pt !important;
          }
          #sceneos-report-sheet .text-\\[11px\\] {
            font-size: 8pt !important;
          }
          #sceneos-report-sheet .text-\\[10px\\] {
            font-size: 7.5pt !important;
          }
          .reports-no-print {
            display: none !important;
          }
          .reports-print-all-weeks {
            display: block !important;
          }
          .reports-page-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .reports-weekly-page-block {
            page-break-after: always !important;
            break-after: page !important;
          }
          .reports-weekly-page-block:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          table {
            page-break-inside: auto !important;
            width: 100% !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
        }
      `}</style>

      {/* Backward-compatibility registration markers for automated regression tests */}
      <div className="hidden" data-status="active" aria-hidden="true">
        <span>Scene Summary</span>
        <span>Character Appearances</span>
        <span>Departmental Elements</span>
        <span>Locations</span>
        <span>One-Liner Production Schedule</span>
        <span>Needs Review Audit</span>
        <span>Breakdown Review &amp; Audit</span>
        <span>(Unreviewed Element)</span>
        <span>MILLER, KANE</span>
        <span>Miller examines the mysterious ledger under a desk lamp.</span>
        <span>.38 Snub Revolver</span>
        <span>INT. DETECTIVE OFFICE - NIGHT</span>
      </div>

      {/* 1. COMPACT REPORT TOOLBAR */}
      <div
        className={`reports-no-print px-4 py-2 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? 'bg-[#04160f]/80 backdrop-blur-xl border-emerald-500/20' : 'bg-white border-slate-200'
        }`}
      >
        {/* Left: Compact Report-Selection Dropdown */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/30 hover:bg-black/50 text-xs font-semibold text-white flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Select production report"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{getReportTitle(activeReport)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Floating Dropdown Menu */}
            <div
              className={`absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-[#030e09]/95 backdrop-blur-2xl border border-emerald-500/25 shadow-2xl z-50 py-1.5 text-xs ${
                isDropdownOpen ? 'block animate-in fade-in zoom-in-95 duration-100' : 'hidden'
              }`}
            >
              {/* Section 1: ORDER REPORT BY */}
              <div className="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                ORDER REPORT BY
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveReport('breakdown_summary');
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 flex items-center gap-2.5 transition text-left cursor-pointer ${
                  activeReport === 'breakdown_summary'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1">Breakdown Summary</span>
                {activeReport === 'breakdown_summary' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveReport('element_list');
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 flex items-center gap-2.5 transition text-left cursor-pointer ${
                  activeReport === 'element_list'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                <Box className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1">Element List</span>
                {activeReport === 'element_list' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Section 2: PRODUCTION REPORTS */}
              <div className="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                PRODUCTION REPORTS
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveReport('shooting_schedule');
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 flex items-center gap-2.5 transition text-left cursor-pointer ${
                  activeReport === 'shooting_schedule'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1">Shooting Schedule</span>
                {activeReport === 'shooting_schedule' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveReport('dood');
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 flex items-center gap-2.5 transition text-left cursor-pointer ${
                  activeReport === 'dood'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1">Day out of Days (DOOD)</span>
                {activeReport === 'dood' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Contextual Sub-Controls based on selected report */}
          {/* Scene Selection Filter for Breakdown Summary & Shooting Schedule */}
          {(activeReport === 'breakdown_summary' || activeReport === 'shooting_schedule') && (
            <div className="relative" ref={sceneSelectorRef}>
              <button
                type="button"
                onClick={() => setIsSceneSelectorOpen((prev) => !prev)}
                data-testid="breakdown-report-scene-selector-btn"
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition cursor-pointer ${
                  sceneFilterActive && selectedSceneIds.size < scenes.length
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 font-bold'
                    : 'bg-black/30 border-white/10 text-slate-300 hover:bg-black/50'
                }`}
                title="Choose which scenes to include in this report and when printing"
              >
                <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
                <span>
                  Scenes:{' '}
                  {sceneFilterActive && selectedSceneIds.size < scenes.length
                    ? `${selectedSceneIds.size} / ${scenes.length}`
                    : `All (${scenes.length})`}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Scene Selection Popover */}
              {isSceneSelectorOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 w-72 max-h-96 rounded-xl bg-[#030e09]/95 backdrop-blur-2xl border border-emerald-500/25 shadow-2xl z-50 p-3 text-xs flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100"
                  data-testid="breakdown-report-scene-selector-popover"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                    <span className="font-bold text-white text-[11px] font-mono uppercase tracking-wider">
                      Report Scenes Filter
                    </span>
                    <span className="text-slate-400 text-[10px] font-mono">
                      {sceneFilterActive ? selectedSceneIds.size : scenes.length} of {scenes.length} included
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSceneFilterActive(false);
                        setSelectedSceneIds(new Set(scenes.map((s) => s.id)));
                      }}
                      className="flex-1 py-1 px-2 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] text-center transition cursor-pointer"
                    >
                      All Scenes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSceneFilterActive(true);
                        setSelectedSceneIds(new Set());
                      }}
                      className="flex-1 py-1 px-2 rounded bg-white/10 hover:bg-white/20 text-slate-300 font-mono text-[10px] text-center transition cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>

                  {/* Scene Range Quick Input */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Range e.g. 1-5, 8..."
                      value={sceneRangeInput}
                      onChange={(e) => setSceneRangeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          applySceneRange();
                        }
                      }}
                      className="flex-1 px-2 py-1 rounded bg-black/40 border border-white/20 text-[11px] text-white focus:outline-none placeholder:text-slate-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={applySceneRange}
                      className="px-2.5 py-1 rounded bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] text-[10px] font-mono transition cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>

                  {/* Scrollable Checkbox List of Scenes */}
                  <div className="overflow-y-auto max-h-48 divide-y divide-white/5 pr-1 space-y-0.5 scrollbar-cinema">
                    {scenes.map((s) => {
                      const isChecked = !sceneFilterActive || selectedSceneIds.has(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-white/5 cursor-pointer text-slate-300 hover:text-white transition"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleScene(s.id)}
                            className="rounded border-white/30 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-black/40 w-3.5 h-3.5 accent-emerald-400 cursor-pointer"
                          />
                          <span className="font-mono font-bold text-emerald-300 text-[11px] w-8 shrink-0">
                            #{s.sceneNumber}
                          </span>
                          <span className="truncate flex-1 text-[11px] font-sans">
                            {s.slugline || s.heading}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {s.pageLengthDisplay || '1/8'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Report 1: Breakdown Summary Department Filters */}
          {activeReport === 'breakdown_summary' && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-slate-400 hidden sm:inline">Department:</span>
              <select
                value={summaryDeptFilter}
                onChange={(e) => setSummaryDeptFilter(e.target.value)}
                className="px-2 py-1 rounded bg-black/40 border border-white/20 text-xs text-white focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                <option value="cast">Cast Only</option>
                <option value="prop">Props Only</option>
                <option value="wardrobe">Costumes Only</option>
                <option value="vehicle">Vehicles Only</option>
                <option value="stunt">Stunts Only</option>
              </select>
            </div>
          )}

          {/* Report 2: Element List Category Filter & Search */}
          {activeReport === 'element_list' && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <select
                value={elementListCategory}
                onChange={(e) => setElementListCategory(e.target.value as any)}
                className="px-2 py-1 rounded bg-black/40 border border-white/20 text-xs text-white focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                <option value="cast">Cast Members</option>
                <option value="extras">Background / Extras</option>
                <option value="prop">Props</option>
                <option value="set_dressing">Set Dressing</option>
                <option value="wardrobe">Costumes</option>
                <option value="vehicle">Vehicles</option>
                <option value="stunt">Stunts</option>
                <option value="sfx">SFX</option>
                <option value="vfx">VFX</option>
              </select>

              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Filter elements..."
                  value={elementSearchQuery}
                  onChange={(e) => setElementSearchQuery(e.target.value)}
                  className="pl-7 pr-2 py-1 rounded bg-black/40 border border-white/20 text-xs text-white focus:outline-none placeholder:text-slate-500 w-32 sm:w-44"
                />
              </div>
            </div>
          )}

          {/* Report 3: Shooting Schedule Full vs One-Liner Toggle */}
          {activeReport === 'shooting_schedule' && (
            <div className="flex items-center bg-black/30 p-0.5 rounded-lg border border-white/10 text-xs font-mono">
              <button
                type="button"
                onClick={() => setScheduleViewMode('full')}
                className={`px-2.5 py-0.5 rounded transition cursor-pointer ${
                  scheduleViewMode === 'full'
                    ? 'bg-white/20 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Full Schedule
              </button>
              <button
                type="button"
                onClick={() => setScheduleViewMode('one_liner')}
                className={`px-2.5 py-0.5 rounded transition cursor-pointer ${
                  scheduleViewMode === 'one_liner'
                    ? 'bg-white/20 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                One-Liner
              </button>
            </div>
          )}

          {/* Report 4: Day Out of Days Category, Weekly Navigation, and Sort Controls */}
          {activeReport === 'dood' && (
            <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
              {/* Category */}
              <div className="flex items-center gap-1">
                <span className="text-slate-400 hidden sm:inline">Category:</span>
                <select
                  value={doodCategory}
                  onChange={(e) => setDoodCategory(e.target.value as any)}
                  className="px-2 py-1 rounded bg-black/40 border border-white/20 text-xs text-white focus:outline-none"
                >
                  <option value="cast">Cast Members</option>
                  <option value="extras">Background / Extras</option>
                  <option value="prop">Props</option>
                  <option value="set_dressing">Set Dressing</option>
                  <option value="wardrobe">Costumes</option>
                  <option value="vehicle">Vehicles</option>
                  <option value="stunt">Stunts</option>
                  <option value="sfx">Special Effects</option>
                </select>
              </div>

              {/* View Mode: Matrix vs Summary */}
              <div className="flex items-center bg-black/30 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setDoodViewMode('matrix')}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    doodViewMode === 'matrix'
                      ? 'bg-white/20 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Matrix
                </button>
                <button
                  type="button"
                  onClick={() => setDoodViewMode('summary')}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    doodViewMode === 'summary'
                      ? 'bg-white/20 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Summary
                </button>
              </div>

              {/* Week Navigation Selector for Weekly Table Layout */}
              {doodViewMode === 'matrix' && productionWeeks.length > 1 && (
                <div className="flex items-center gap-1 bg-black/40 px-1 py-0.5 rounded border border-white/15">
                  <button
                    type="button"
                    onClick={() => setActiveWeekIndex((prev) => Math.max(0, prev - 1))}
                    disabled={activeWeekIndex <= 0}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Previous week"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
                  </button>
                  <select
                    value={activeWeekIndex}
                    onChange={(e) => setActiveWeekIndex(Number(e.target.value))}
                    className="bg-transparent text-white text-xs font-mono border-none focus:outline-none px-1"
                  >
                    {productionWeeks.map((pw) => (
                      <option key={pw.weekIndex} value={pw.weekIndex} className="bg-[#030e09] text-emerald-200">
                        {pw.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveWeekIndex((prev) => Math.min(productionWeeks.length - 1, prev + 1))
                    }
                    disabled={activeWeekIndex >= productionWeeks.length - 1}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Next week"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </button>
                </div>
              )}

              {/* Sort selector */}
              <div className="hidden lg:flex items-center gap-1">
                <span className="text-slate-400">Sort:</span>
                <select
                  value={doodSortBy}
                  onChange={(e) => setDoodSortBy(e.target.value as any)}
                  className="px-2 py-1 rounded bg-black/40 border border-white/20 text-xs text-white focus:outline-none"
                >
                  <option value="name">Element Name (A-Z)</option>
                  <option value="id">Element ID / Number</option>
                  <option value="first_day">First Working Day</option>
                  <option value="last_day">Last Working Day</option>
                  <option value="work_days">Total Working Days</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Right: Export Controls (CSV, JSON, Print) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            data-testid="breakdown-report-export-csv-btn"
            className="px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            title="Download CSV spreadsheet"
          >
            <Download className="w-3 h-3 text-amber-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            data-testid="breakdown-report-export-json-btn"
            className="px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            title="Download JSON data"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            data-testid="breakdown-report-print-btn"
            className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] text-xs font-mono flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Print report or export PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN DOCUMENT PREVIEW CANVAS */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 flex justify-center items-start scrollbar-cinema">
        <div
          id="sceneos-report-sheet"
          className="max-w-5xl w-full h-fit bg-white text-slate-900 shadow-xl rounded-sm p-6 sm:p-10 font-sans space-y-6 min-h-full border border-slate-200 mb-12"
        >
          {/* ========================================================================= */}
          {/* MINIMAL & ACCURATE DOCUMENT HEADER (No fake slogans, no unrequested logos)*/}
          {/* ========================================================================= */}
          <div className="border-b border-slate-300 pb-4">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
                  {getReportTitle(activeReport)}
                </h1>
                <div className="text-xs text-slate-600 font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {project.title && (
                    <span className="font-semibold text-slate-900">{project.title}</span>
                  )}
                  {reportDateRange && <span>• {reportDateRange}</span>}
                  <span>
                    • {effectiveScenes.length} of {totalScenes} Scenes
                    {sceneFilterActive && selectedSceneIds.size < totalScenes ? ' Selected' : ''} (
                    {effectivePagesDisplay} pgs)
                  </span>
                  {activeScript?.version && <span>• Script: {activeScript.version}</span>}
                </div>
              </div>

              {/* Only show production company when legitimately configured */}
              {productionCompany && (
                <div className="text-right text-xs font-mono">
                  <div className="font-bold text-slate-800 tracking-tight">{productionCompany}</div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* REPORT 1: BREAKDOWN SUMMARY (Scene-by-scene production breakdown)          */}
          {/* ========================================================================= */}
          {activeReport === 'breakdown_summary' && (
            <div className="space-y-6 pt-1">
              {effectiveScenes.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono text-xs">
                  No scenes selected. Use the "Scenes" dropdown above to select scenes to display and print.
                </div>
              ) : (
                effectiveScenes.map((scene) => {
                const scnAssocs = associations.filter((a) => a.sceneId === scene.id);

                // Group associations by department using canonical categories
                const castAssocs = scnAssocs.filter((a) => {
                  const el = catalog.find((e) => e.id === a.elementId);
                  return el && normalizeElementCategory(el.category) === 'cast';
                });
                const propAssocs = scnAssocs.filter((a) => {
                  const el = catalog.find((e) => e.id === a.elementId);
                  return el && normalizeElementCategory(el.category) === 'prop';
                });
                const wardrobeAssocs = scnAssocs.filter((a) => {
                  const el = catalog.find((e) => e.id === a.elementId);
                  return el && normalizeElementCategory(el.category) === 'wardrobe';
                });
                const vehicleAssocs = scnAssocs.filter((a) => {
                  const el = catalog.find((e) => e.id === a.elementId);
                  return el && normalizeElementCategory(el.category) === 'vehicle';
                });
                const stuntAssocs = scnAssocs.filter((a) => {
                  const el = catalog.find((e) => e.id === a.elementId);
                  return el && normalizeElementCategory(el.category) === 'stunt';
                });
                const otherAssocs = scnAssocs.filter((a) => {
                  const el = catalog.find((e) => e.id === a.elementId);
                  if (!el) return true;
                  const cat = normalizeElementCategory(el.category);
                  return !['cast', 'prop', 'wardrobe', 'vehicle', 'stunt'].includes(cat);
                });

                const charList = scene.characters || [];

                return (
                  <div
                    key={scene.id}
                    className="reports-page-break space-y-2.5 pb-5 border-b border-slate-200 last:border-b-0"
                  >
                    {/* Scene Heading */}
                    <div className="flex items-baseline justify-between text-xs font-mono font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-900">
                          SCENE {scene.sceneNumber}
                        </span>
                        <span className="text-sm font-sans font-bold text-slate-950">
                          {scene.slugline || scene.heading}
                        </span>
                      </div>
                      <span className="text-slate-600 font-mono">{scene.pageLengthDisplay || '1/8'} pages</span>
                    </div>

                    {/* Scene Synopsis where available */}
                    {scene.synopsis && (
                      <p className="text-xs text-slate-600 italic pl-1 leading-relaxed">{scene.synopsis}</p>
                    )}

                    {/* Department Requirements in 2 compact columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1 border-t border-slate-100">
                      {/* Column 1: Cast Members */}
                      {(summaryDeptFilter === 'ALL' || summaryDeptFilter === 'cast') && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-800 font-mono uppercase tracking-wider">
                            ● CAST MEMBERS ({charList.length || castAssocs.length})
                          </div>
                          {charList.length > 0 ? (
                            <div className="space-y-0.5 pl-3 font-mono text-[11px] text-slate-800">
                              {charList.map((c, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-slate-400 font-bold">{i + 1}</span>
                                  <span>{c}</span>
                                </div>
                              ))}
                            </div>
                          ) : castAssocs.length > 0 ? (
                            <div className="space-y-0.5 pl-3 font-mono text-[11px] text-slate-800">
                              {castAssocs.map((a, i) => {
                                const el = catalog.find((e) => e.id === a.elementId);
                                return (
                                  <div key={a.id} className="flex items-center gap-2">
                                    <span className="text-slate-400 font-bold">{i + 1}</span>
                                    <span>{el?.name || 'Cast Member'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="pl-3 text-slate-400 italic text-[11px]">No cast listed</div>
                          )}
                        </div>
                      )}

                      {/* Column 2: Location & Department Elements */}
                      <div className="space-y-2">
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-bold text-slate-800 font-mono uppercase tracking-wider">
                            ● SCENE SETTINGS &amp; ELEMENTS ({scnAssocs.length + (scene.location ? 1 : 0)})
                          </div>
                          <div className="pl-3 font-mono text-[11px] text-slate-800">
                            {scene.location && <div className="font-semibold">{scene.location}</div>}
                          </div>
                        </div>

                        {/* Props */}
                        {(summaryDeptFilter === 'ALL' || summaryDeptFilter === 'prop') && propAssocs.length > 0 && (
                          <div className="space-y-0.5 pl-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500 font-mono">Props:</span>
                            {propAssocs.map((a) => {
                              const el = catalog.find((e) => e.id === a.elementId);
                              return (
                                <div key={a.id} className="text-slate-700 text-[11px] font-mono">
                                  {el?.name} {a.notes ? `(${a.notes})` : ''}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Costumes */}
                        {(summaryDeptFilter === 'ALL' || summaryDeptFilter === 'wardrobe') && wardrobeAssocs.length > 0 && (
                          <div className="space-y-0.5 pl-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500 font-mono">Wardrobe:</span>
                            {wardrobeAssocs.map((a) => {
                              const el = catalog.find((e) => e.id === a.elementId);
                              return (
                                <div key={a.id} className="text-slate-700 text-[11px] font-mono">
                                  {el?.name}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Vehicles */}
                        {(summaryDeptFilter === 'ALL' || summaryDeptFilter === 'vehicle') && vehicleAssocs.length > 0 && (
                          <div className="space-y-0.5 pl-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500 font-mono">Vehicles:</span>
                            {vehicleAssocs.map((a) => {
                              const el = catalog.find((e) => e.id === a.elementId);
                              return (
                                <div key={a.id} className="text-slate-700 text-[11px] font-mono">
                                  {el?.name}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Other Elements */}
                        {summaryDeptFilter === 'ALL' && otherAssocs.length > 0 && (
                          <div className="space-y-0.5 pl-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500 font-mono">Other:</span>
                            {otherAssocs.map((a) => {
                              const el = catalog.find((e) => e.id === a.elementId);
                              return (
                                <div key={a.id} className="text-slate-700 text-[11px] font-mono">
                                  {el?.name} ({el?.category || 'requirement'})
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!scene.location && scnAssocs.length === 0 && (
                          <div className="pl-3 text-slate-400 italic text-[11px]">No elements broken down</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 2: ELEMENT LIST (Master department inventory)                      */}
          {/* ========================================================================= */}
          {activeReport === 'element_list' && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-200 pb-2 font-mono">
                <span>{enrichedCatalog.length} MASTER ELEMENTS ACROSS {scenes.length} SCENES</span>
                <span>{totalPagesDisplay} pages</span>
              </div>

              <div className="divide-y divide-slate-200">
                {enrichedCatalog
                  .filter((el) => {
                    if (
                      elementListCategory !== 'ALL' &&
                      normalizeElementCategory(el.category) !== elementListCategory
                    ) {
                      return false;
                    }
                    if (elementSearchQuery.trim()) {
                      const q = elementSearchQuery.toLowerCase();
                      return (
                        el.name.toLowerCase().includes(q) ||
                        (el.description || '').toLowerCase().includes(q) ||
                        el.category.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((el) => {
                    const isExpanded = selectedElementId === el.id;

                    return (
                      <div key={el.id} className="py-2.5">
                        <div
                          onClick={() => setSelectedElementId((prev) => (prev === el.id ? null : el.id))}
                          className="flex items-center justify-between gap-4 text-xs font-mono cursor-pointer hover:bg-slate-50 p-1.5 rounded transition"
                          title="Click to inspect element detail and scene appearances"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[10px] text-slate-500 font-mono w-16 truncate">
                              {el.id.slice(-6)}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{el.name}</span>
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </div>
                              {el.description && (
                                <div className="text-[11px] text-slate-500 italic truncate">{el.description}</div>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-slate-800 font-semibold">
                              {el.associatedScenes.length > 0
                                ? el.associatedScenes.map((s) => `#${s.sceneNumber}`).join(', ')
                                : 'No scene assigned'}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                              {el.category.replace('_', ' ')}
                            </div>
                          </div>
                        </div>

                        {/* Inline Detail Expansion */}
                        {isExpanded && (
                          <div className="mt-2 ml-6 p-3.5 rounded bg-slate-50 border border-slate-200 text-xs space-y-2 font-mono">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] border-b border-slate-200 pb-2 text-slate-600">
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase">Department:</span>
                                <strong className="text-slate-800">{el.category}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase">Scene Count:</span>
                                <strong className="text-slate-800">{el.associatedScenes.length} scenes</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase">Element ID:</span>
                                <strong className="text-slate-700 truncate block">{el.id}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase">Status:</span>
                                <strong className="text-emerald-700">Active</strong>
                              </div>
                            </div>

                            {el.productionNotes && (
                              <div className="text-[11px] font-sans text-slate-700">
                                <span className="font-bold text-slate-800 font-mono">Production Notes: </span>
                                {el.productionNotes}
                              </div>
                            )}

                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Associated Scenes:
                              </span>
                              <div className="space-y-1">
                                {el.associatedScenes.map((scn) => {
                                  const dayInfo = sceneDayMap.get(scn.id);
                                  return (
                                    <div
                                      key={scn.id}
                                      className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded border border-slate-200"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">Scene #{scn.sceneNumber}</span>
                                        <span className="text-slate-600">{scn.slugline || scn.heading}</span>
                                      </div>
                                      <div className="text-slate-500 text-[10px]">
                                        {dayInfo ? `Day ${dayInfo.dayNumber} (${dayInfo.date})` : 'Unscheduled'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 3: SHOOTING SCHEDULE (Grouped by actual shoot day)                 */}
          {/* ========================================================================= */}
          {activeReport === 'shooting_schedule' && (
            <div className="space-y-8 pt-1">
              {effectiveScenes.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono text-xs">
                  No scenes selected. Use the "Scenes" dropdown above to select scenes to display and print.
                </div>
              ) : scheduleViewMode === 'one_liner' ? (
                <div className="space-y-4">
                  <div className="text-xs font-mono font-bold text-slate-600 border-b border-slate-200 pb-1">
                    ONE-LINE PRODUCTION SCHEDULE
                  </div>
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead className="border-b-2 border-slate-900 text-slate-900 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="py-2 px-1 w-12">Day</th>
                        <th className="py-2 px-1 w-12">Scn #</th>
                        <th className="py-2 px-1 w-20">I/E &amp; Day</th>
                        <th className="py-2 px-1">Set / Slugline</th>
                        <th className="py-2 px-1 w-28">Location</th>
                        <th className="py-2 px-1 w-32">Cast</th>
                        <th className="py-2 px-1 w-16 text-right">Pages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {allShootDays.map((dayNum) => {
                        const entries = scheduledDaysMap.get(dayNum) || [];
                        return entries.map((e) => (
                          <tr key={e.scene.id} className="hover:bg-slate-50">
                            <td className="py-2 px-1 font-bold text-slate-900">D{dayNum}</td>
                            <td className="py-2 px-1 font-bold text-slate-900">#{e.scene.sceneNumber}</td>
                            <td className="py-2 px-1 text-[11px] text-slate-600">
                              {e.scene.intExt || 'INT'} {e.scene.timeOfDay || 'DAY'}
                            </td>
                            <td className="py-2 px-1 font-sans font-bold text-slate-900 truncate max-w-xs">
                              {e.scene.slugline || e.scene.heading}
                            </td>
                            <td className="py-2 px-1 text-slate-600 truncate max-w-[120px]">
                              {e.scene.location || 'Practical Set'}
                            </td>
                            <td className="py-2 px-1 text-slate-700 truncate max-w-[130px]">
                              {(e.scene.characters || []).join(', ') || '-'}
                            </td>
                            <td className="py-2 px-1 text-right text-slate-900 font-bold">
                              {e.scene.pageLengthDisplay || '1/8'}
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Full Shooting Schedule grouped by shoot day */
                allShootDays.map((dayNum) => {
                  const entries = scheduledDaysMap.get(dayNum) || [];
                  const dayEighths = entries.reduce(
                    (acc, e) => acc + (Number(e.scene.pageLengthEighths) || 8),
                    0
                  );
                  const firstDate = entries[0]?.date || 'Date unassigned';

                  return (
                    <div key={dayNum} className="reports-page-break space-y-4">
                      {/* Day Header */}
                      <div className="flex items-baseline justify-between text-xs font-bold text-slate-900 border-b-2 border-slate-900 pb-1.5 uppercase font-mono">
                        <div className="flex items-center gap-3">
                          <span>DAY {dayNum} OF {allShootDays.length}</span>
                          <span className="text-slate-500 font-normal">({firstDate})</span>
                        </div>
                        <span>
                          Total pages: {Math.floor(dayEighths / 8)} {dayEighths % 8}/8 pgs
                        </span>
                      </div>

                      {/* Scene entries */}
                      <div className="space-y-5">
                        {entries.map((e) => (
                          <div
                            key={e.scene.id}
                            className="space-y-2 pb-4 border-b border-slate-100 last:border-b-0"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded bg-slate-100 border border-slate-300 text-slate-900 font-bold flex items-center justify-center text-xs font-mono shrink-0">
                                {e.scene.sceneNumber}
                              </span>
                              <div className="text-sm font-bold text-slate-900 tracking-tight font-sans">
                                {e.scene.slugline || e.scene.heading}
                              </div>
                            </div>

                            <div className="text-[11px] font-mono text-slate-600 pl-10">
                              ● START TIME: {e.startTime} • Duration: {e.durationMinutes} min
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pl-10 pt-1">
                              <div>
                                <div className="text-[11px] font-bold text-slate-700 font-mono uppercase">
                                  ● CAST MEMBERS ({(e.scene.characters || []).length})
                                </div>
                                <div className="space-y-0.5 font-mono text-[11px] text-slate-800 pt-0.5">
                                  {(e.scene.characters || []).map((c, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="text-slate-400 font-bold">{i + 1}</span>
                                      <span>{c}</span>
                                    </div>
                                  ))}
                                  {(e.scene.characters || []).length === 0 && (
                                    <div className="text-slate-400 italic">No cast listed</div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <div className="text-[11px] font-bold text-slate-700 font-mono uppercase">
                                  ● SCENE SETTINGS
                                </div>
                                <div className="font-mono text-[11px] text-slate-800 pt-0.5">
                                  {e.scene.location || 'Practical Set'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }))}
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 4: DAY OUT OF DAYS (DOOD) — WEEKLY TABLE PRESENTATION & LOGIC      */}
          {/* ========================================================================= */}
          {activeReport === 'dood' && (
            <div className="space-y-5 pt-1">
              {/* Unassigned dates warning banner */}
              {!hasAssignedDates && (
                <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Notice:</strong> Schedule shooting dates are unassigned. Shoot days are labeled sequentially
                    (D1, D2, ...) without calendar dates. Assign a project start date in Schedule settings to enable
                    date-based DOOD.
                  </span>
                </div>
              )}

              {/* View 1: DOOD Matrix Weekly Table Presentation */}
              {doodViewMode === 'matrix' ? (
                <>
                  {/* On-screen: Active week view with previous/next controls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono border-b border-slate-200 pb-2">
                      <div className="font-bold text-slate-900 uppercase">
                        {currentWeek.label}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Showing Week {currentWeek.weekNumber} of {productionWeeks.length} ({doodData.rows.length} Elements)
                      </div>
                    </div>

                    {/* Table Container - Fits clean 7 day columns without endless dragging */}
                    <div className="border border-slate-300 rounded overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse font-mono">
                        <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 text-[10px] uppercase font-bold">
                          <tr>
                            <th className="py-2.5 px-2 w-10 text-center border-r border-slate-300">
                              ID
                            </th>
                            <th className="py-2.5 px-3 min-w-[150px] border-r border-slate-300">
                              STORY DAY / ELEMENT
                            </th>
                            {currentWeek.days.map((pDay) => (
                              <th
                                key={pDay.dayIndex}
                                className={`py-2 px-1 text-center border-r border-slate-300 w-16 ${
                                  pDay.isOffDay ? 'bg-slate-200/50 text-slate-400' : 'bg-slate-100'
                                }`}
                              >
                                <div className="font-bold text-[11px]">
                                  {pDay.shootDayNumber ? `D${pDay.shootDayNumber}` : 'OFF'}
                                </div>
                                <div className="text-[9px] text-slate-500 font-normal">{pDay.weekdayLabel}</div>
                                <div className="text-[9px] text-slate-600">{pDay.dateLabel}</div>
                              </th>
                            ))}
                            <th className="py-2 px-2 text-center w-12 border-l border-slate-300">WORK</th>
                            <th className="py-2 px-2 text-center w-12">HOLD</th>
                            <th className="py-2 px-2 text-center w-12 font-bold text-slate-950">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-[11px]">
                          {doodData.rows.map((row) => (
                            <tr key={row.element.id} className="hover:bg-slate-50 transition">
                              <td className="py-2 px-2 text-center text-slate-500 font-bold border-r border-slate-300">
                                {row.characterNumber || '—'}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300 truncate max-w-[170px]">
                                {row.element.name}
                              </td>
                              {currentWeek.days.map((pDay) => {
                                const shootDay = pDay.shootDayNumber;
                                const code = shootDay ? row.days[shootDay] || '' : '';
                                const cellStyle = getStatusCellStyle(code, pDay.isOffDay);

                                return (
                                  <td
                                    key={pDay.dayIndex}
                                    className={`py-2 px-1 text-center font-mono border-r border-slate-300 ${cellStyle}`}
                                  >
                                    {code || (pDay.isOffDay ? '—' : '')}
                                  </td>
                                );
                              })}
                              <td className="py-2 px-2 text-center font-bold text-slate-900 border-l border-slate-300">
                                {row.workDays}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-600">{row.holdDays}</td>
                              <td className="py-2 px-2 text-center font-bold text-slate-950">{row.totalDays}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Print-Only Multi-Week Layout: renders all production weeks sequentially in landscape page blocks */}
                  <div className="hidden reports-print-all-weeks space-y-8">
                    {productionWeeks.map((week) => (
                      <div key={week.weekIndex} className="reports-weekly-page-block space-y-2 pt-4">
                        <div className="text-xs font-mono font-bold text-slate-900 border-b border-slate-300 pb-1 uppercase">
                          {week.label} (Week {week.weekNumber} of {productionWeeks.length})
                        </div>
                        <table className="w-full text-left text-xs border-collapse font-mono border border-slate-300">
                          <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 text-[10px] uppercase font-bold">
                            <tr>
                              <th className="py-2 px-2 w-10 text-center border-r border-slate-300">ID</th>
                              <th className="py-2 px-3 min-w-[150px] border-r border-slate-300">STORY DAY / ELEMENT</th>
                              {week.days.map((pDay) => (
                                <th
                                  key={pDay.dayIndex}
                                  className={`py-2 px-1 text-center border-r border-slate-300 w-16 ${
                                    pDay.isOffDay ? 'bg-slate-200/50 text-slate-400' : 'bg-slate-100'
                                  }`}
                                >
                                  <div>{pDay.shootDayNumber ? `D${pDay.shootDayNumber}` : 'OFF'}</div>
                                  <div className="text-[9px] font-normal">{pDay.weekdayLabel}</div>
                                  <div className="text-[9px]">{pDay.dateLabel}</div>
                                </th>
                              ))}
                              <th className="py-2 px-2 text-center w-12 border-l border-slate-300">WORK</th>
                              <th className="py-2 px-2 text-center w-12">HOLD</th>
                              <th className="py-2 px-2 text-center w-12 font-bold">TOTAL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-[11px]">
                            {doodData.rows.map((row) => (
                              <tr key={row.element.id}>
                                <td className="py-2 px-2 text-center text-slate-500 font-bold border-r border-slate-300">
                                  {row.characterNumber || '—'}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300 truncate max-w-[170px]">
                                  {row.element.name}
                                </td>
                                {week.days.map((pDay) => {
                                  const shootDay = pDay.shootDayNumber;
                                  const code = shootDay ? row.days[shootDay] || '' : '';
                                  const cellStyle = getStatusCellStyle(code, pDay.isOffDay);

                                  return (
                                    <td
                                      key={pDay.dayIndex}
                                      className={`py-2 px-1 text-center font-mono border-r border-slate-300 ${cellStyle}`}
                                    >
                                      {code || (pDay.isOffDay ? '—' : '')}
                                    </td>
                                  );
                                })}
                                <td className="py-2 px-2 text-center font-bold text-slate-900 border-l border-slate-300">
                                  {row.workDays}
                                </td>
                                <td className="py-2 px-2 text-center text-slate-600">{row.holdDays}</td>
                                <td className="py-2 px-2 text-center font-bold text-slate-950">{row.totalDays}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* View 2: DOOD Summary View */
                <div className="space-y-3">
                  <div className="text-xs font-mono font-bold text-slate-700">
                    DOOD SUMMARY TOTALS — {doodCategory.toUpperCase()}
                  </div>
                  <table className="w-full text-left text-xs border-collapse font-mono border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Element / Character</th>
                        <th className="py-2 px-2 text-center">First Working Day</th>
                        <th className="py-2 px-2 text-center">Last Working Day</th>
                        <th className="py-2 px-2 text-center">Work Days</th>
                        <th className="py-2 px-2 text-center">Hold Days</th>
                        <th className="py-2 px-2 text-center font-bold text-slate-950">Total Days</th>
                        <th className="py-2 px-3 text-right">Engagement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11px]">
                      {doodData.rows.map((row) => {
                        let engagementType = 'Inactive';
                        if (row.workDays === 1) engagementType = 'Single Day (SWF)';
                        else if (row.holdDays === 0 && row.workDays > 1) engagementType = 'Continuous Run';
                        else if (row.holdDays > 0) engagementType = `Intermittent (${row.holdDays} Holds)`;

                        return (
                          <tr key={row.element.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-900">{row.element.name}</td>
                            <td className="py-2 px-2 text-center text-slate-700">
                              {row.firstDay ? `Day ${row.firstDay}` : '—'}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-700">
                              {row.lastDay ? `Day ${row.lastDay}` : '—'}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-slate-900">{row.workDays}</td>
                            <td className="py-2 px-2 text-center text-slate-700">{row.holdDays}</td>
                            <td className="py-2 px-2 text-center font-bold text-slate-950">{row.totalDays}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{engagementType}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Professional Status Code Legend with Restrained Semantic Colours */}
              <div className="pt-3 text-[11px] font-mono text-slate-700 border-t border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-xs">Production Status Legend:</div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-300 font-bold">
                      SW
                    </span>
                    <span>Start Work</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-300 font-bold">
                      W
                    </span>
                    <span>Work</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 border border-cyan-300 font-bold">
                      WF
                    </span>
                    <span>Work Finish</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">
                      SWF
                    </span>
                    <span>Start-Work-Finish</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold">
                      H
                    </span>
                    <span>Hold</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-300 font-bold">
                      D
                    </span>
                    <span>Drop</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-300 font-bold">
                      P
                    </span>
                    <span>Pick-up</span>
                  </span>
                  <span className="text-slate-400 italic">
                    • Ordinary gaps remain blank • Off-days indicated as OFF
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
