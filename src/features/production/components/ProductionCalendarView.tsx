import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  FileText,
  List,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { Activity, FilmProject } from '../../../types';
import type { DiscussionRecordTarget } from '../../../services/contracts/types';
import { addDays, formatDate, getDaysDifference, parseDate } from '../../../utils/scheduler';
import type {
  DayOperationalStatus,
  ProductionEventCategory,
  ProductionEventRecord,
  ProductionWorkspaceStore,
} from '../types';
import {
  createProductionEvent,
  deleteProductionEvent,
  detectDateConflicts,
  getCanonicalProductionScenes,
  getDailyCalendarLog,
  getEventPhaseCategory,
  getPhaseCategoryForDate,
  getPhasesForDate,
  getProjectScheduleSpan,
  PHASE_COLOR_META,
  type PhaseCategoryWindowSummary,
  type ProductionPhaseCategory,
  resolvePhaseCrewEntries,
  setProductionPhaseCategoryDates,
  updateProductionEvent,
  updateShootingDay,
  upsertDailyCalendarLog,
} from '../services/productionStoreService';

export type CalendarSubView = 'month' | 'week' | 'agenda';

interface ProductionCalendarViewProps {
  project: FilmProject;
  productionStore: ProductionWorkspaceStore;
  simulatedDate: string;
  isDark: boolean;
  theme?: any;
  canEdit: boolean;
  initialSubView?: CalendarSubView;
  projectMembers?: Array<{ fullName: string }>;
  onUpdateProject?: (updated: FilmProject) => void;
  onSetSimulatedDate: (d: string) => void;
  onAddActivity: (phaseId: string, name: string) => void;
  onAddActivityWithDetails: (phaseId: string, activity: Activity) => void;
  onRemoveActivity: (phaseId: string, activityId: string) => void;
  onUpdateActivity: (phaseId: string, activityId: string, data: Partial<Activity>) => void;
  onOpenShootDay: (dayId?: string) => void;
  onNavigateTab: (tab: string, submodule?: string) => void;
  onOpenDiscussion?: (target: DiscussionRecordTarget) => void;
}

const DAY_STATUS_OPTIONS: DayOperationalStatus[] = [
  'Planned',
  'In Progress',
  'Completed',
  'Delayed',
];

const EVENT_CATEGORY_LABELS: Record<ProductionEventCategory, string> = {
  milestone: 'Milestone',
  rehearsal: 'Rehearsal / Read',
  'tech-scout': 'Tech Scout',
  fitting: 'Costume / Makeup',
  delivery: 'Delivery / Deadline',
  meeting: 'Meeting',
  general: 'General Event',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const ProductionCalendarView: React.FC<ProductionCalendarViewProps> = ({
  project,
  productionStore,
  simulatedDate,
  canEdit,
  initialSubView = 'month',
  projectMembers = [],
  onUpdateProject,
  onSetSimulatedDate,
  onAddActivity,
  onAddActivityWithDetails,
  onRemoveActivity,
  onUpdateActivity,
  onOpenShootDay,
  onNavigateTab,
  onOpenDiscussion,
}) => {
  const realTodayStr = useMemo(() => formatDate(new Date()), []);
  const scheduleSpan = useMemo(
    () => getProjectScheduleSpan(project, productionStore),
    [project, productionStore]
  );

  const [viewMode, setViewMode] = useState<CalendarSubView>(initialSubView);
  const [filterKind, setFilterKind] = useState<'all' | 'shoot' | 'events' | 'tasks' | 'issues'>(
    'all'
  );
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() =>
    parseDate(simulatedDate || scheduleSpan.startDate)
  );

  useEffect(() => {
    if (initialSubView) setViewMode(initialSubView);
  }, [initialSubView]);

  useEffect(() => {
    if (simulatedDate) {
      const parsedYear = parseInt(simulatedDate.split('-')[0], 10);
      if (parsedYear < 2020) {
        onSetSimulatedDate(realTodayStr);
        return;
      }
      setCurrentMonthDate(parseDate(simulatedDate));
    }
  }, [simulatedDate, realTodayStr, onSetSimulatedDate]);

  // Auto-heal any legacy or corrupt past dates (< 2020 or distant anomalies) in project phases or start dates
  useEffect(() => {
    if (!canEdit || !onUpdateProject) return;
    let hasCorruptDates = false;
    const sanitizedPhases = (project.phases || []).map((ph) => {
      let changed = false;
      let start = ph.startDate;
      let end = ph.endDate;
      if (start && parseInt(start.split('-')[0], 10) < 2020) {
        start = realTodayStr;
        changed = true;
      }
      if (end && parseInt(end.split('-')[0], 10) < 2020) {
        end = addDays(start || realTodayStr, ph.durationDays || 7);
        changed = true;
      }
      if (changed) hasCorruptDates = true;
      return changed ? { ...ph, startDate: start, endDate: end } : ph;
    });

    let newProjStart = project.startDate;
    let newProjEnd = project.finalEndDate;
    if (newProjStart && parseInt(newProjStart.split('-')[0], 10) < 2020) {
      newProjStart = realTodayStr;
      hasCorruptDates = true;
    }
    if (newProjEnd && parseInt(newProjEnd.split('-')[0], 10) < 2020) {
      newProjEnd = addDays(newProjStart || realTodayStr, 75);
      hasCorruptDates = true;
    }

    if (hasCorruptDates) {
      onUpdateProject({
        ...project,
        phases: sanitizedPhases,
        startDate: newProjStart || realTodayStr,
        finalEndDate: newProjEnd,
      });
      if (parseInt(simulatedDate.split('-')[0], 10) < 2020) {
        onSetSimulatedDate(realTodayStr);
      }
    }
  }, [project.id]);

  const canonicalScenes = useMemo(() => getCanonicalProductionScenes(project), [project]);
  const sceneMap = useMemo(
    () => new Map(canonicalScenes.map((s) => [s.id, s])),
    [canonicalScenes]
  );

  const directoryLocations = useMemo(
    () =>
      productionStore.directoryEntries.filter(
        (e) => !e.archived && e.kind === 'location'
      ),
    [productionStore.directoryEntries]
  );

  const locationNameMap = useMemo(
    () =>
      new Map(
        productionStore.directoryEntries
          .filter((e) => e.kind === 'location')
          .map((l) => [l.id, l.name])
      ),
    [productionStore.directoryEntries]
  );

  const directoryPeople = useMemo(() => {
    const names = new Set<string>();
    productionStore.directoryEntries
      .filter((e) => !e.archived && (e.kind === 'cast' || e.kind === 'crew' || e.kind === 'contact'))
      .forEach((e) => names.add(e.name));
    resolvePhaseCrewEntries(project).forEach((m) => names.add(m.name));
    projectMembers.forEach((m) => {
      if (m.fullName) names.add(m.fullName);
    });
    return Array.from(names);
  }, [productionStore.directoryEntries, project, projectMembers]);

  const overallSpanDays = useMemo(() => {
    if (!scheduleSpan.startDate || !scheduleSpan.endDate) return 0;
    return Math.max(1, getDaysDifference(scheduleSpan.startDate, scheduleSpan.endDate) + 1);
  }, [scheduleSpan.startDate, scheduleSpan.endDate]);

  // Month buttons spanning complete project production date range
  const scheduleMonths = useMemo(() => {
    const start = parseDate(scheduleSpan.startDate);
    const end = parseDate(scheduleSpan.endDate);
    const list: Array<{ year: number; month: number; label: string; firstDateStr: string }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    let guard = 0;
    while (cursor <= endMonth && guard < 24) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      list.push({
        year: y,
        month: m,
        label: `${MONTH_NAMES[m].slice(0, 3)} ${String(y).slice(-2)}`,
        firstDateStr: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      });
      cursor.setMonth(cursor.getMonth() + 1);
      guard += 1;
    }
    return list;
  }, [scheduleSpan.startDate, scheduleSpan.endDate]);

  // All phase tasks flattened with canonical category
  const allTasks = useMemo(
    () =>
      (project.phases || []).flatMap((ph) =>
        ph.activities.map((act) => ({
          act,
          phaseId: ph.id,
          phaseName: ph.name,
          phaseCategory: (ph.category || 'pre') as ProductionPhaseCategory,
        }))
      ),
    [project.phases]
  );

  // Overdue items summary across entire production
  const attentionSummary = useMemo(() => {
    const overdueTasks = allTasks.filter(
      ({ act }) =>
        !act.completed &&
        (act.endDate || act.startDate || '') < realTodayStr &&
        Boolean(act.endDate || act.startDate)
    );
    const overdueEvents = productionStore.events.filter(
      (ev) => !ev.completed && ev.date < realTodayStr
    );
    const dateSet = new Set<string>();
    productionStore.shootingDays.forEach((d) => dateSet.add(d.date));
    productionStore.events.forEach((ev) => dateSet.add(ev.date));
    allTasks.forEach(({ act }) => {
      if (act.endDate) dateSet.add(act.endDate);
      else if (act.startDate) dateSet.add(act.startDate);
    });
    let conflictCount = 0;
    dateSet.forEach((d) => {
      conflictCount += detectDateConflicts(d, project, productionStore, realTodayStr).filter(
        (c) => c.severity === 'conflict'
      ).length;
    });
    return {
      overdueCount: overdueTasks.length + overdueEvents.length,
      conflictCount,
    };
  }, [allTasks, productionStore, project, realTodayStr]);

  // Month & Week Calendar Grids
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthDaysGrid = useMemo(() => {
    const daysCount = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const cells: Array<{ dayNum: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ dayNum: null, dateStr: null });
    for (let d = 1; d <= daysCount; d++) {
      cells.push({
        dayNum: d,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
    return cells;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const focus = parseDate(simulatedDate);
    const sunday = new Date(focus);
    sunday.setDate(focus.getDate() - focus.getDay());
    const labels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(sunday);
      dt.setDate(sunday.getDate() + i);
      return {
        weekday: labels[i],
        dayNum: dt.getDate(),
        dateStr: formatDate(dt),
      };
    });
  }, [simulatedDate]);

  // Agenda entries across the full production schedule (sorted chronologically)
  const agendaDates = useMemo(() => {
    const dates = new Set<string>();
    productionStore.shootingDays.forEach((d) => {
      if (filterKind === 'all' || filterKind === 'shoot' || filterKind === 'issues') dates.add(d.date);
    });
    productionStore.events.forEach((ev) => {
      if (filterKind === 'all' || filterKind === 'events' || filterKind === 'issues') dates.add(ev.date);
    });
    allTasks.forEach(({ act }) => {
      const d = act.endDate || act.startDate;
      if (d && (filterKind === 'all' || filterKind === 'tasks' || filterKind === 'issues')) {
        dates.add(d);
      }
    });
    (productionStore.dailyLogs || []).forEach((l) => {
      if (filterKind === 'all' || filterKind === 'issues') dates.add(l.date);
    });
    if (simulatedDate) dates.add(simulatedDate);

    return Array.from(dates)
      .sort()
      .filter((dateStr) => {
        if (filterKind !== 'issues') return true;
        return detectDateConflicts(dateStr, project, productionStore, realTodayStr).length > 0;
      });
  }, [productionStore, allTasks, simulatedDate, filterKind, project, realTodayStr]);

  // ============================================================================
  // Phase Date Editing Handlers
  // ============================================================================
  const handleUpdatePhaseWindow = (
    category: ProductionPhaseCategory,
    nextStart: string | null,
    nextEnd: string | null
  ) => {
    if (!canEdit || !onUpdateProject) return;
    const updated = setProductionPhaseCategoryDates(project, category, nextStart, nextEnd);
    onUpdateProject(updated);
  };

  const handleShiftPhaseEnd = (
    category: ProductionPhaseCategory,
    win: PhaseCategoryWindowSummary,
    deltaDays: number
  ) => {
    if (!canEdit || !onUpdateProject) return;
    const baseStart = win.start || scheduleSpan.startDate || realTodayStr;
    const baseEnd = win.end || baseStart;
    const shiftedEnd = addDays(baseEnd, deltaDays);
    const clampedEnd = shiftedEnd < baseStart ? baseStart : shiftedEnd;
    onUpdateProject(setProductionPhaseCategoryDates(project, category, baseStart, clampedEnd));
  };

  // ============================================================================
  // Selected Date Inspector Draft States (Daily Log, Event Form, Task Form)
  // ============================================================================
  const selectedDailyLog = useMemo(
    () => getDailyCalendarLog(productionStore, simulatedDate),
    [productionStore, simulatedDate]
  );

  const [dayStatusDraft, setDayStatusDraft] = useState<DayOperationalStatus>('Planned');
  const [dayNotesDraft, setDayNotesDraft] = useState('');
  const [dayProgressDraft, setDayProgressDraft] = useState('');
  const [dayRemindersDraft, setDayRemindersDraft] = useState('');
  const [logSavedFlash, setLogSavedFlash] = useState(false);

  useEffect(() => {
    setDayStatusDraft(selectedDailyLog?.status || 'Planned');
    setDayNotesDraft(selectedDailyLog?.notes || '');
    setDayProgressDraft(selectedDailyLog?.progressUpdate || '');
    setDayRemindersDraft(selectedDailyLog?.reminders || '');
    setLogSavedFlash(false);
  }, [
    simulatedDate,
    selectedDailyLog?.status,
    selectedDailyLog?.notes,
    selectedDailyLog?.progressUpdate,
    selectedDailyLog?.reminders,
  ]);

  const handleSaveDailyLog = (nextStatus?: DayOperationalStatus) => {
    if (!canEdit || !onUpdateProject) return;
    const statusToSave = nextStatus ?? dayStatusDraft;
    if (nextStatus) setDayStatusDraft(nextStatus);
    onUpdateProject(
      upsertDailyCalendarLog(project, simulatedDate, {
        status: statusToSave,
        notes: dayNotesDraft,
        progressUpdate: dayProgressDraft,
        reminders: dayRemindersDraft,
      })
    );
    setLogSavedFlash(true);
    window.setTimeout(() => setLogSavedFlash(false), 1600);
  };

  // Event create/edit form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtDate, setEvtDate] = useState(simulatedDate);
  const [evtTime, setEvtTime] = useState('09:00');
  const [evtCategory, setEvtCategory] = useState<ProductionEventCategory>('milestone');
  const [evtLocationId, setEvtLocationId] = useState('');
  const [evtNotes, setEvtNotes] = useState('');

  useEffect(() => {
    if (!editingEventId) setEvtDate(simulatedDate);
  }, [simulatedDate, editingEventId]);

  const openNewEventForm = () => {
    setEditingEventId(null);
    setEvtTitle('');
    setEvtDate(simulatedDate);
    setEvtTime('09:00');
    setEvtCategory('milestone');
    setEvtLocationId('');
    setEvtNotes('');
    setShowEventForm(true);
  };

  const openEditEventForm = (ev: ProductionEventRecord) => {
    setEditingEventId(ev.id);
    setEvtTitle(ev.title);
    setEvtDate(ev.date);
    setEvtTime(ev.time || '');
    setEvtCategory(ev.category);
    setEvtLocationId(ev.locationId || '');
    setEvtNotes(ev.notes || '');
    setShowEventForm(true);
  };

  const handleSubmitEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onUpdateProject || !evtTitle.trim()) return;
    if (editingEventId) {
      onUpdateProject(
        updateProductionEvent(project, editingEventId, {
          title: evtTitle.trim(),
          date: evtDate || simulatedDate,
          time: evtTime.trim() || undefined,
          category: evtCategory,
          locationId: evtLocationId || undefined,
          notes: evtNotes.trim() || undefined,
        })
      );
    } else {
      const { updatedProject } = createProductionEvent(project, {
        title: evtTitle.trim(),
        date: evtDate || simulatedDate,
        time: evtTime.trim() || undefined,
        category: evtCategory,
        locationId: evtLocationId || undefined,
        notes: evtNotes.trim() || undefined,
      });
      onUpdateProject(updatedProject);
    }
    setShowEventForm(false);
    setEditingEventId(null);
    setEvtTitle('');
  };

  // Phase-backed Task create/edit state (strictly mutates project.phases[].activities)
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskRef, setEditingTaskRef] = useState<{ phaseId: string; actId: string } | null>(
    null
  );
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPhaseId, setTaskPhaseId] = useState(() => project.phases[0]?.id || '');
  const [taskStartDate, setTaskStartDate] = useState(simulatedDate);
  const [taskEndDate, setTaskEndDate] = useState(simulatedDate);
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');

  useEffect(() => {
    if (!taskPhaseId && project.phases.length > 0) {
      setTaskPhaseId(project.phases[0].id);
    }
  }, [project.phases, taskPhaseId]);

  const openNewTaskForm = () => {
    const matchingPhase = getPhasesForDate(project, simulatedDate)[0] || project.phases[0];
    setEditingTaskRef(null);
    setTaskTitle('');
    setTaskPhaseId(matchingPhase?.id || '');
    setTaskStartDate(simulatedDate);
    setTaskEndDate(simulatedDate);
    setTaskAssignee('');
    setTaskPriority('medium');
    setShowTaskForm(true);
  };

  const openEditTaskForm = (phaseId: string, act: Activity) => {
    setEditingTaskRef({ phaseId, actId: act.id });
    setTaskTitle(act.name);
    setTaskPhaseId(phaseId);
    setTaskStartDate(act.startDate || simulatedDate);
    setTaskEndDate(act.endDate || act.startDate || simulatedDate);
    setTaskAssignee(act.assignedTo || '');
    setTaskPriority(act.priority || 'medium');
    setShowTaskForm(true);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !taskTitle.trim()) return;
    if (editingTaskRef) {
      onUpdateActivity(editingTaskRef.phaseId, editingTaskRef.actId, {
        name: taskTitle.trim(),
        startDate: taskStartDate || simulatedDate,
        endDate: taskEndDate || taskStartDate || simulatedDate,
        assignedTo: taskAssignee.trim() || undefined,
        priority: taskPriority,
      });
    } else if (taskPhaseId) {
      const activity: Activity = {
        id: `act-cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: taskTitle.trim(),
        completed: false,
        estimatedDays: 1,
        startDate: taskStartDate || simulatedDate,
        endDate: taskEndDate || taskStartDate || simulatedDate,
        assignedTo: taskAssignee.trim() || undefined,
        priority: taskPriority,
        subTasks: [],
      };
      if (onAddActivityWithDetails) {
        onAddActivityWithDetails(taskPhaseId, activity);
      } else {
        onAddActivity(taskPhaseId, taskTitle.trim());
      }
    }
    setShowTaskForm(false);
    setEditingTaskRef(null);
    setTaskTitle('');
  };

  // Selected date collections
  const selectedPhases = useMemo(
    () => getPhasesForDate(project, simulatedDate),
    [project, simulatedDate]
  );
  const selectedPhaseCategory = useMemo(
    () => getPhaseCategoryForDate(project, simulatedDate),
    [project, simulatedDate]
  );
  const selectedShootDays = useMemo(
    () => productionStore.shootingDays.filter((d) => d.date === simulatedDate),
    [productionStore.shootingDays, simulatedDate]
  );
  const selectedEvents = useMemo(
    () =>
      productionStore.events.filter(
        (ev) =>
          ev.date === simulatedDate ||
          (ev.endDate && simulatedDate >= ev.date && simulatedDate <= ev.endDate)
      ),
    [productionStore.events, simulatedDate]
  );
  const selectedTasks = useMemo(
    () =>
      allTasks.filter(
        ({ act }) => act.startDate === simulatedDate || act.endDate === simulatedDate
      ),
    [allTasks, simulatedDate]
  );
  const selectedConflicts = useMemo(
    () => detectDateConflicts(simulatedDate, project, productionStore, realTodayStr),
    [simulatedDate, project, productionStore, realTodayStr]
  );

  const handlePrevPeriod = () => {
    if (viewMode === 'week') {
      const dt = parseDate(simulatedDate);
      dt.setDate(dt.getDate() - 7);
      onSetSimulatedDate(formatDate(dt));
    } else {
      setCurrentMonthDate(new Date(year, month - 1, 1));
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      const dt = parseDate(simulatedDate);
      dt.setDate(dt.getDate() + 7);
      onSetSimulatedDate(formatDate(dt));
    } else {
      setCurrentMonthDate(new Date(year, month + 1, 1));
    }
  };

  const inProductionPeriod = (dateStr: string) =>
    Boolean(
      scheduleSpan.startDate &&
        scheduleSpan.endDate &&
        dateStr >= scheduleSpan.startDate &&
        dateStr <= scheduleSpan.endDate
    );

  const inShootWindow = (dateStr: string) =>
    Boolean(
      scheduleSpan.shootWindowStart &&
        scheduleSpan.shootWindowEnd &&
        dateStr >= scheduleSpan.shootWindowStart &&
        dateStr <= scheduleSpan.shootWindowEnd
    );

  const resolveCellStyle = (dateStr: string) => {
    const phaseCat = getPhaseCategoryForDate(project, dateStr);
    const insidePeriod = inProductionPeriod(dateStr);
    const shootSpan = inShootWindow(dateStr);
    if (phaseCat) {
      return {
        phaseCat,
        meta: PHASE_COLOR_META[phaseCat],
        insidePeriod: true,
        shootSpan,
        containerClass: PHASE_COLOR_META[phaseCat].cellClass,
      };
    }
    if (shootSpan) {
      return {
        phaseCat: 'prod' as ProductionPhaseCategory,
        meta: PHASE_COLOR_META.prod,
        insidePeriod: true,
        shootSpan: true,
        containerClass: PHASE_COLOR_META.prod.cellClass,
      };
    }
    if (insidePeriod) {
      return {
        phaseCat: null,
        meta: null,
        insidePeriod: true,
        shootSpan: false,
        containerClass: 'border-[#E63950]/20 bg-[#1A1017]',
      };
    }
    return {
      phaseCat: null,
      meta: null,
      insidePeriod: false,
      shootSpan: false,
      containerClass: 'border-[#E63950]/10 bg-[#10090D] opacity-60',
    };
  };

  const getEventPillClass = (ev: ProductionEventRecord) => {
    if (ev.completed) {
      return 'border-emerald-500/20 bg-emerald-950/20 text-slate-400 line-through';
    }
    const cat = getEventPhaseCategory(project, ev);
    if (cat) return PHASE_COLOR_META[cat].pillClass;
    return 'border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-slate-200';
  };

  const getTaskPillClass = (completed: boolean, category: ProductionPhaseCategory) => {
    if (completed) {
      return 'border-emerald-500/20 bg-emerald-950/20 text-slate-400 line-through';
    }
    return PHASE_COLOR_META[category].pillClass;
  };

  const renderPhaseCard = (
    category: ProductionPhaseCategory,
    win: PhaseCategoryWindowSummary,
    subtitle: string
  ) => {
    const meta = PHASE_COLOR_META[category];
    const pct =
      win.totalTasks > 0 ? Math.round((win.completedTasks / win.totalTasks) * 100) : 0;
    const isScheduled = Boolean(win.start && win.end);

    return (
      <div
        key={category}
        data-testid={`calendar-phase-card-${category}`}
        className={`rounded-xl border ${meta.cardBorderClass} bg-[#1A1017]/90 border border-[#E63950]/25 p-3.5 flex flex-col justify-between gap-2.5`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dotClass}`} />
            <span className={`text-[11px] font-mono uppercase tracking-wider font-bold ${meta.textClass}`}>
              {meta.label}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-[10px] font-mono text-slate-300 shrink-0">
            {isScheduled ? `${win.durationDays}d scheduled` : 'Not scheduled'}
          </span>
        </div>

        {/* Editable Start / End Phase Dates + Quick +/- 1d Extension */}
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="space-y-1 min-w-0">
            <span className="block text-[9.5px] font-mono uppercase tracking-wider text-slate-400">
              Start Date
            </span>
            <input
              type="date"
              min="2024-01-01"
              max="2040-12-31"
              aria-label={`${meta.label} Start Date`}
              data-testid={`phase-${category}-start-input`}
              value={win.start || ''}
              disabled={!canEdit}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  handleUpdatePhaseWindow(category, null, win.end);
                  return;
                }
                const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
                if (match) {
                  const y = parseInt(match[1], 10);
                  if (y >= 2020 && y <= 2045) {
                    handleUpdatePhaseWindow(category, val, win.end);
                  }
                }
              }}
              className="w-full px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 font-mono text-[11px] text-rose-100 disabled:opacity-60"
            />
          </label>

          <label className="space-y-1 min-w-0">
            <span className="block text-[9.5px] font-mono uppercase tracking-wider text-slate-400">
              End Date
            </span>
            <input
              type="date"
              min="2024-01-01"
              max="2040-12-31"
              aria-label={`${meta.label} End Date`}
              data-testid={`phase-${category}-end-input`}
              value={win.end || ''}
              disabled={!canEdit}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  handleUpdatePhaseWindow(category, win.start, null);
                  return;
                }
                const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
                if (match) {
                  const y = parseInt(match[1], 10);
                  if (y >= 2020 && y <= 2045) {
                    handleUpdatePhaseWindow(category, win.start, val);
                  }
                }
              }}
              className="w-full px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 font-mono text-[11px] text-rose-100 disabled:opacity-60"
            />
          </label>

          {canEdit && (
            <div className="flex items-center gap-1 pb-[1px]">
              <button
                type="button"
                title={`Shorten ${meta.label} by 1 day`}
                data-testid={`phase-${category}-shorten-btn`}
                disabled={!isScheduled || win.durationDays <= 1}
                onClick={() => handleShiftPhaseEnd(category, win, -1)}
                className="p-1.5 rounded-lg border border-white/10 bg-[#10090D] border border-[#E63950]/25 hover:border-white/30 text-slate-300 disabled:opacity-35 cursor-pointer disabled:cursor-default"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                title={`Extend ${meta.label} by 1 day`}
                data-testid={`phase-${category}-extend-btn`}
                onClick={() => handleShiftPhaseEnd(category, win, 1)}
                className="p-1.5 rounded-lg border border-white/10 bg-[#10090D] border border-[#E63950]/25 hover:border-white/30 text-slate-200 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
            <span className="truncate">{subtitle}</span>
            <span className="font-mono text-[10px] text-slate-400 shrink-0">{pct}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/[0.07] overflow-hidden">
            <div
              className={`h-full rounded-full ${meta.progressBarClass} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      id="production-calendar-section"
      data-testid="production-calendar-root"
      className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4"
    >
      {/* Top Production Window & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span
            data-testid="calendar-production-range"
            className="px-3 py-1.5 rounded-lg border border-white/15 bg-[#1A1017] border border-[#E63950]/25 font-mono text-[11px] text-rose-100 inline-flex items-center gap-1.5"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#FF8A9B]" />
            Production Period: {scheduleSpan.startDate} → {scheduleSpan.endDate} ({overallSpanDays}d)
          </span>

          {scheduleSpan.shootWindowStart && scheduleSpan.shootWindowEnd && (
            <span
              data-testid="calendar-shoot-window-badge"
              className="px-3 py-1.5 rounded-lg border border-amber-400/35 bg-amber-950/25 font-mono text-[11px] text-amber-200 inline-flex items-center gap-1.5"
            >
              <Clapperboard className="w-3.5 h-3.5 text-amber-300" />
              Shooting Schedule: {scheduleSpan.shootWindowStart} → {scheduleSpan.shootWindowEnd} (
              {productionStore.shootingDays.length} shoot days)
            </span>
          )}

          {(attentionSummary.overdueCount > 0 || attentionSummary.conflictCount > 0) && (
            <button
              type="button"
              onClick={() => {
                setFilterKind('issues');
                setViewMode('agenda');
              }}
              data-testid="calendar-issues-pill"
              className="px-3 py-1.5 rounded-lg border border-rose-400/35 bg-rose-950/30 text-[11px] font-mono text-rose-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {attentionSummary.overdueCount} overdue · {attentionSummary.conflictCount} conflicts
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#10090D]/80 border border-[#E63950]/25 border border-[#E63950]/20 p-0.5">
            {(
              [
                { id: 'month', label: 'Month', testId: 'calendar-view-month-btn' },
                { id: 'week', label: 'Week', testId: 'calendar-view-week-btn' },
                { id: 'agenda', label: 'Agenda', testId: 'calendar-view-agenda-btn' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={opt.testId}
                onClick={() => setViewMode(opt.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition ${
                  viewMode === opt.id
                    ? 'bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('breakdown', 'breakdown-stripboard')}
            data-testid="calendar-open-stripboard-btn"
            className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#1A1017] border border-[#E63950]/25 hover:border-white/25 text-[11px] font-mono text-slate-300 cursor-pointer"
          >
            Breakdown Stripboard →
          </button>
        </div>
      </div>

      {/* Persistent Visual Legend Explaining Consistent Phase Colors */}
      <div
        data-testid="calendar-phase-legend"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E63950]/20 bg-[#1A1017]/90 border border-[#E63950]/20 px-3.5 py-2 text-[11px]"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {(['pre', 'prod', 'post'] as const).map((cat) => {
            const meta = PHASE_COLOR_META[cat];
            return (
              <span key={cat} className="inline-flex items-center gap-1.5 text-slate-200">
                <span className={`w-2.5 h-2.5 rounded-sm ${meta.dotClass}`} />
                <span className={`font-medium ${meta.textClass}`}>{meta.label}</span>
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm border border-[#E63950]/30 bg-[#26151F]" />
            <span>In Production Period</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#FF8A9B]">
            <span className="w-2.5 h-2.5 rounded-sm border border-[#FF1744] bg-[#FF1744]/25 shadow-[0_0_6px_rgba(255,23,68,0.4)]" />
            <span>Today</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-300">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500/25 text-[9px] font-bold flex items-center justify-center">
              !
            </span>
            <span>Conflict / Alert</span>
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Phase colours apply consistently to cells, badges & event/task labels
        </span>
      </div>

      {/* 3 Editable Phase Window Cards (Set, Extend or Shorten Pre / Prod / Post Dates) */}
      <div
        data-testid="calendar-phase-summaries"
        className="grid grid-cols-1 md:grid-cols-3 gap-3.5"
      >
        {renderPhaseCard(
          'pre',
          scheduleSpan.preWindow,
          `${scheduleSpan.preWindow.completedTasks}/${scheduleSpan.preWindow.totalTasks} tasks complete`
        )}
        {renderPhaseCard(
          'prod',
          scheduleSpan.prodWindow,
          productionStore.shootingDays.length > 0
            ? `${
                productionStore.shootingDays.filter((d) => d.status === 'completed').length
              }/${productionStore.shootingDays.length} shoot days done · ${
                scheduleSpan.prodWindow.completedTasks
              }/${scheduleSpan.prodWindow.totalTasks} tasks`
            : `${scheduleSpan.prodWindow.completedTasks}/${scheduleSpan.prodWindow.totalTasks} tasks complete`
        )}
        {renderPhaseCard(
          'post',
          scheduleSpan.postWindow,
          `${scheduleSpan.postWindow.completedTasks}/${scheduleSpan.postWindow.totalTasks} tasks complete`
        )}
      </div>

      {/* Main Workspace: Calendar Surface + Selected Date Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left/Center: Month / Week / Agenda */}
        <section className="xl:col-span-7 rounded-2xl border border-[#E63950]/20 bg-[#1A1017]/85 backdrop-blur-xl border border-[#E63950]/20 p-4 space-y-3.5">
          {/* Calendar Header Navigation & Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E63950]/20">
            <div className="flex items-center gap-2">
              {viewMode !== 'agenda' && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevPeriod}
                    aria-label="Previous period"
                    className="p-1.5 rounded-lg border border-white/10 bg-[#10090D] border border-[#E63950]/25 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-sm font-semibold text-rose-100 min-w-[140px]">
                    {viewMode === 'week'
                      ? `Week of ${weekDays[0]?.dateStr}`
                      : `${MONTH_NAMES[month]} ${year}`}
                  </h2>
                  <button
                    type="button"
                    onClick={handleNextPeriod}
                    aria-label="Next period"
                    className="p-1.5 rounded-lg border border-white/10 bg-[#10090D] border border-[#E63950]/25 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              {viewMode === 'agenda' && (
                <h2 className="text-sm font-semibold text-rose-100 flex items-center gap-2">
                  <List className="w-4 h-4 text-[#FF8A9B]" />
                  Production Agenda ({agendaDates.length} dates)
                </h2>
              )}

              <button
                type="button"
                data-testid="calendar-today-btn"
                onClick={() => onSetSimulatedDate(realTodayStr)}
                className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#10090D] border border-[#E63950]/25 hover:border-[#FF1744]/80 text-[11px] font-mono text-[#FF8A9B] cursor-pointer"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1 flex-wrap text-[10.5px] font-mono">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'shoot', label: 'Shoot' },
                  { id: 'events', label: 'Events' },
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'issues', label: 'Alerts' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterKind(f.id)}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    filterKind === f.id
                      ? 'border-[#FF1744]/60 bg-[#FF1744]/20 text-white font-bold shadow-[0_0_8px_rgba(255,23,68,0.25)]'
                      : 'border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month Jump Strip Across Complete Production Period */}
          {scheduleMonths.length > 1 && viewMode === 'month' && (
            <div data-testid="calendar-month-strip" className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {scheduleMonths.map((sm) => {
                const activeMonth = sm.year === year && sm.month === month;
                return (
                  <button
                    key={sm.firstDateStr}
                    type="button"
                    onClick={() => setCurrentMonthDate(new Date(sm.year, sm.month, 1))}
                    className={`px-2.5 py-1 rounded-md text-[10.5px] font-mono shrink-0 cursor-pointer border transition ${
                      activeMonth
                        ? 'bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] border-[#FF5368]/40 text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)]'
                        : 'bg-[#10090D] border border-[#E63950]/25 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {sm.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* VIEW 1: MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-7 text-center text-[10px] font-mono text-slate-500 pb-1">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div data-testid="calendar-monthly-grid" className="grid grid-cols-7 gap-2">
                {monthDaysGrid.map((cell, idx) => {
                  if (!cell.dayNum || !cell.dateStr) {
                    return (
                      <div
                        key={`pad-${idx}`}
                        className="min-h-[88px] rounded-lg border border-white/[0.02] bg-[#10090D]/50 border border-[#E63950]/10"
                      />
                    );
                  }
                  const dateStr = cell.dateStr;
                  const isSelected = dateStr === simulatedDate;
                  const isToday = dateStr === realTodayStr;
                  const days =
                    filterKind === 'all' || filterKind === 'shoot' || filterKind === 'issues'
                      ? productionStore.shootingDays.filter((d) => d.date === dateStr)
                      : [];
                  const evts =
                    filterKind === 'all' || filterKind === 'events' || filterKind === 'issues'
                      ? productionStore.events.filter((e) => e.date === dateStr)
                      : [];
                  const tasks =
                    filterKind === 'all' || filterKind === 'tasks' || filterKind === 'issues'
                      ? allTasks.filter(
                          ({ act }) => act.startDate === dateStr || act.endDate === dateStr
                        )
                      : [];
                  const log = getDailyCalendarLog(productionStore, dateStr);
                  const conflicts = detectDateConflicts(
                    dateStr,
                    project,
                    productionStore,
                    realTodayStr
                  );
                  const style = resolveCellStyle(dateStr);

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      id={`calendar-day-${dateStr}`}
                      data-testid={`calendar-cell-${dateStr}`}
                      data-phase-category={style.phaseCat || 'none'}
                      onClick={() => onSetSimulatedDate(dateStr)}
                      className={`min-h-[88px] rounded-lg border p-1.5 text-left flex flex-col justify-between gap-1 cursor-pointer transition relative overflow-hidden ${
                        style.containerClass
                      } ${isSelected ? 'ring-2 ring-[#FF1744] border-[#FF1744] shadow-[0_0_14px_rgba(255,23,68,0.3)]' : ''} ${
                        isToday && !isSelected ? 'ring-1 ring-[#FF1744]/80' : ''
                      } hover:border-white/35`}
                    >
                      {/* Top Phase Color Strip */}
                      {style.meta && (
                        <div className={`absolute inset-x-0 top-0 h-[3px] ${style.meta.topBarClass}`} />
                      )}

                      <div className="flex items-center justify-between gap-1 w-full pt-0.5">
                        <span
                          className={`font-mono text-[10.5px] font-medium ${
                            isToday
                              ? 'px-1 rounded bg-[#FF1744]/25 text-[#FF8A9B] font-bold border border-[#FF1744]/50 shadow-[0_0_8px_rgba(255,23,68,0.3)]'
                              : style.insidePeriod
                                ? 'text-slate-100'
                                : 'text-slate-500'
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                        <div className="flex items-center gap-1">
                          {style.meta && (
                            <span className={`font-mono text-[8px] font-semibold ${style.meta.textClass}`}>
                              {style.meta.shortLabel}
                            </span>
                          )}
                          {conflicts.length > 0 && (
                            <span
                              title={conflicts.map((c) => c.message).join('; ')}
                              className="w-3.5 h-3.5 rounded-full bg-rose-500/30 text-rose-200 text-[9px] font-bold flex items-center justify-center"
                            >
                              !
                            </span>
                          )}
                          {log?.status && log.status !== 'Planned' && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                              title={log.status}
                            />
                          )}
                        </div>
                      </div>

                      <div className="space-y-0.5 w-full overflow-hidden">
                        {days.slice(0, 1).map((d) => (
                          <div
                            key={d.id}
                            className="px-1 py-0.5 rounded bg-amber-400 text-[#0b0e14] font-mono text-[8.5px] font-bold truncate"
                          >
                            DAY {d.dayNumber}
                          </div>
                        ))}
                        {evts.slice(0, 1).map((ev) => (
                          <div
                            key={ev.id}
                            className={`px-1 py-0.5 rounded border text-[8.5px] truncate ${getEventPillClass(
                              ev
                            )}`}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {tasks.length > 0 && (
                          <div
                            className={`px-1 py-0.5 rounded border text-[8.5px] font-mono truncate ${getTaskPillClass(
                              tasks.every((t) => t.act.completed),
                              tasks[0].phaseCategory
                            )}`}
                          >
                            {tasks.filter((t) => t.act.completed).length}/{tasks.length} tasks
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: WEEK VIEW */}
          {viewMode === 'week' && (
            <div data-testid="calendar-weekly-grid" className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {weekDays.map((cell) => {
                const isSelected = cell.dateStr === simulatedDate;
                const isToday = cell.dateStr === realTodayStr;
                const days =
                  filterKind === 'all' || filterKind === 'shoot' || filterKind === 'issues'
                    ? productionStore.shootingDays.filter((d) => d.date === cell.dateStr)
                    : [];
                const evts =
                  filterKind === 'all' || filterKind === 'events' || filterKind === 'issues'
                    ? productionStore.events.filter((e) => e.date === cell.dateStr)
                    : [];
                const tasks =
                  filterKind === 'all' || filterKind === 'tasks' || filterKind === 'issues'
                    ? allTasks.filter(
                        ({ act }) => act.startDate === cell.dateStr || act.endDate === cell.dateStr
                      )
                    : [];
                const log = getDailyCalendarLog(productionStore, cell.dateStr);
                const style = resolveCellStyle(cell.dateStr);

                return (
                  <div
                    key={cell.dateStr}
                    data-phase-category={style.phaseCat || 'none'}
                    onClick={() => onSetSimulatedDate(cell.dateStr)}
                    className={`min-h-[248px] rounded-xl border p-2 flex flex-col gap-1.5 cursor-pointer transition relative overflow-hidden ${
                      style.containerClass
                    } ${isSelected ? 'ring-2 ring-[#FF1744] border-[#FF1744] shadow-[0_0_14px_rgba(255,23,68,0.3)]' : ''}`}
                  >
                    {style.meta && (
                      <div className={`absolute inset-x-0 top-0 h-[3px] ${style.meta.topBarClass}`} />
                    )}

                    <div className="flex items-center justify-between border-b border-[#E63950]/15 pb-1 pt-0.5">
                      <span className="font-mono text-[10px] text-slate-400">{cell.weekday}</span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          isToday ? 'text-cyan-300' : 'text-rose-100'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                    </div>

                    {style.meta && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border w-fit ${style.meta.pillClass}`}
                      >
                        {style.meta.label}
                      </span>
                    )}

                    {log?.status && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 w-fit">
                        {log.status}
                      </span>
                    )}

                    {days.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenShootDay(d.id);
                        }}
                        className="text-left px-1.5 py-1 rounded bg-amber-400 text-[#0b0e14] font-mono text-[10px] font-bold cursor-pointer"
                      >
                        DAY {d.dayNumber} · {d.callTime}
                      </button>
                    ))}

                    {evts.map((ev) => (
                      <div
                        key={ev.id}
                        className={`px-1.5 py-1 rounded border text-[10px] truncate ${getEventPillClass(
                          ev
                        )}`}
                      >
                        {ev.time ? `${ev.time} ` : ''}
                        {ev.title}
                      </div>
                    ))}

                    {tasks.map(({ act, phaseCategory }) => (
                      <div
                        key={act.id}
                        className={`px-1.5 py-0.5 rounded border text-[10px] truncate ${getTaskPillClass(
                          act.completed,
                          phaseCategory
                        )}`}
                      >
                        {act.name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 3: AGENDA VIEW */}
          {viewMode === 'agenda' && (
            <div
              data-testid="calendar-agenda-list"
              className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1"
            >
              {agendaDates.map((dateStr) => {
                const days =
                  filterKind === 'all' || filterKind === 'shoot' || filterKind === 'issues'
                    ? productionStore.shootingDays.filter((d) => d.date === dateStr)
                    : [];
                const evts =
                  filterKind === 'all' || filterKind === 'events' || filterKind === 'issues'
                    ? productionStore.events.filter((e) => e.date === dateStr)
                    : [];
                const tasks =
                  filterKind === 'all' || filterKind === 'tasks' || filterKind === 'issues'
                    ? allTasks.filter(
                        ({ act }) => act.startDate === dateStr || act.endDate === dateStr
                      )
                    : [];
                const conflicts = detectDateConflicts(
                  dateStr,
                  project,
                  productionStore,
                  realTodayStr
                );
                const log = getDailyCalendarLog(productionStore, dateStr);
                const activePhases = getPhasesForDate(project, dateStr);
                const style = resolveCellStyle(dateStr);

                return (
                  <div
                    key={dateStr}
                    onClick={() => onSetSimulatedDate(dateStr)}
                    className={`rounded-xl border p-3 cursor-pointer transition space-y-2 ${
                      dateStr === simulatedDate
                        ? 'border-[#FF1744] ring-1 ring-[#FF1744] bg-[#26151F] shadow-[0_0_12px_rgba(255,23,68,0.25)]'
                        : `${style.containerClass} hover:border-[#E63950]/40`
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-rose-100">{dateStr}</span>
                        {dateStr === realTodayStr && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FF1744]/20 text-[#FF8A9B] border border-[#FF1744]/40 font-mono text-[9px]">
                            TODAY
                          </span>
                        )}
                        {activePhases.map((ph) => {
                          const cat = (ph.category || 'pre') as ProductionPhaseCategory;
                          return (
                            <span
                              key={ph.id}
                              className={`px-1.5 py-0.5 rounded border font-mono text-[10px] ${PHASE_COLOR_META[cat].pillClass}`}
                            >
                              {ph.name}
                            </span>
                          );
                        })}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {log?.status || (days[0] ? `Shoot: ${days[0].status}` : 'Planned')}
                      </span>
                    </div>

                    {conflicts.length > 0 && (
                      <div className="text-[11px] text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{conflicts.map((c) => c.message).join(' · ')}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {days.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenShootDay(d.id);
                          }}
                          className="px-2 py-0.5 rounded bg-amber-400 text-[#0b0e14] font-mono font-bold cursor-pointer"
                        >
                          Shoot Day {d.dayNumber} · {d.sceneIds.length} scenes ({d.callTime}) →
                        </button>
                      ))}
                      {evts.map((ev) => (
                        <span
                          key={ev.id}
                          className={`px-2 py-0.5 rounded border ${getEventPillClass(ev)}`}
                        >
                          {ev.time ? `${ev.time} ` : ''}
                          {ev.title} ({EVENT_CATEGORY_LABELS[ev.category]})
                        </span>
                      ))}
                      {tasks.map(({ act, phaseCategory }) => (
                        <span
                          key={act.id}
                          className={`px-2 py-0.5 rounded border ${getTaskPillClass(
                            act.completed,
                            phaseCategory
                          )}`}
                        >
                          Task: {act.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Selected Date Inspector */}
        <aside
          data-testid="calendar-date-inspector"
          className="xl:col-span-5 rounded-2xl border border-[#E63950]/20 bg-[#1A1017]/85 backdrop-blur-xl border border-[#E63950]/20 p-4 md:p-5 space-y-4"
        >
          {/* Inspector Header + Phase Pill + Operational Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E63950]/20">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Inspecting Date
              </span>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-base font-mono font-bold text-rose-100">
                  {simulatedDate}
                </span>
                {selectedPhaseCategory ? (
                  <span
                    data-testid="calendar-inspector-phase-badge"
                    className={`px-2 py-0.5 rounded border font-mono text-[10px] ${PHASE_COLOR_META[selectedPhaseCategory].pillClass}`}
                  >
                    {selectedPhases[0]?.name || PHASE_COLOR_META[selectedPhaseCategory].label}
                  </span>
                ) : (
                  <span
                    data-testid="calendar-inspector-phase-badge"
                    className="px-2 py-0.5 rounded border border-white/10 bg-white/[0.04] font-mono text-[10px] text-slate-400"
                  >
                    Outside Scheduled Phases
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Day operational status"
                data-testid="calendar-day-status-select"
                value={dayStatusDraft}
                disabled={!canEdit}
                onChange={(e) =>
                  handleSaveDailyLog(e.target.value as DayOperationalStatus)
                }
                className="px-2.5 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/15 text-[11px] font-mono text-rose-100"
              >
                {DAY_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conflict / Overdue Alerts on Selected Date */}
          {selectedConflicts.length > 0 && (
            <div
              data-testid="calendar-date-conflicts"
              className="rounded-xl border border-rose-400/35 bg-rose-950/25 p-3 space-y-1 text-xs text-rose-100"
            >
              <div className="font-mono text-[10px] font-bold uppercase text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Scheduling Conflicts & Attention Required
              </div>
              {selectedConflicts.map((c) => (
                <div key={c.id}>• {c.message}</div>
              ))}
            </div>
          )}

          {/* Authoritative Shooting Days on Date */}
          {selectedShootDays.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1.5">
                <Clapperboard className="w-3.5 h-3.5" />
                Scheduled Shooting Day(s)
              </div>
              {selectedShootDays.map((day) => {
                const cs = productionStore.callSheets.find((c) => c.shootingDayId === day.id);
                const dpr = productionStore.dailyReports.find(
                  (r) => r.shootingDayId === day.id || r.shootDayNumber === day.dayNumber
                );
                const locName = day.locationId ? locationNameMap.get(day.locationId) : undefined;
                return (
                  <div
                    key={day.id}
                    className="rounded-xl border border-amber-400/35 bg-amber-950/15 p-3 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-rose-100">
                          Shoot Day {day.dayNumber} · {day.callTime} → {day.wrapTime}
                        </span>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          {day.sceneIds.length} Breakdown scenes
                          {locName ? ` · ${locName}` : ''} · Status: {day.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`calendar-open-shoot-day-${day.id}`}
                        onClick={() => onOpenShootDay(day.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-400 text-[#0b0e14] font-semibold text-[11px] cursor-pointer"
                      >
                        Open in Shoot →
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#E63950]/15 text-[10.5px] font-mono">
                      <span className="text-slate-400">
                        Call Sheet: {cs ? (cs.published ? 'Published' : 'Draft') : 'None'} · DPR:{' '}
                        {dpr ? dpr.status : 'None'}
                      </span>
                      {canEdit && onUpdateProject && (
                        <label className="inline-flex items-center gap-1.5 text-slate-300">
                          Reschedule:
                          <input
                            type="date"
                            min="2024-01-01"
                            max="2040-12-31"
                            value={day.date}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
                              if (match && parseInt(match[1], 10) >= 2020) {
                                onUpdateProject(
                                  updateShootingDay(project, day.id, { date: val })
                                );
                              }
                            }}
                            className="px-1.5 py-0.5 rounded bg-[#10090D] border border-[#E63950]/25 border border-white/15 text-rose-100"
                          />
                        </label>
                      )}
                    </div>

                    {day.sceneIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {day.sceneIds.slice(0, 5).map((sid) => {
                          const sc = sceneMap.get(sid);
                          if (!sc) return null;
                          return (
                            <span
                              key={sid}
                              className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[10px] text-slate-300"
                            >
                              SC {sc.sceneNumber}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Events & Milestones Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Events & Milestones ({selectedEvents.length})
              </span>
              {canEdit && (
                <button
                  type="button"
                  data-testid="calendar-toggle-add-event-btn"
                  onClick={openNewEventForm}
                  className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#26151F] border border-[#E63950]/30 hover:border-white/30 text-[11px] text-[#FF8A9B] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Event
                </button>
              )}
            </div>

            {canEdit && showEventForm && (
              <form
                onSubmit={handleSubmitEvent}
                data-testid="calendar-event-form"
                className="rounded-xl border border-white/15 bg-[#26151F]/80 border border-[#E63950]/25 p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-300">
                  <span>{editingEventId ? 'Edit / Reschedule Event' : 'New Production Event'}</span>
                  <button
                    type="button"
                    onClick={() => setShowEventForm(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  required
                  data-testid="event-input-title"
                  value={evtTitle}
                  onChange={(e) => setEvtTitle(e.target.value)}
                  placeholder="Event title (e.g. Harbor Pier Tech Scout)"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    min="2024-01-01"
                    max="2040-12-31"
                    value={evtDate}
                    onChange={(e) => setEvtDate(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-[11px] text-rose-100"
                  />
                  <input
                    type="text"
                    value={evtTime}
                    data-testid="event-input-time"
                    onChange={(e) => setEvtTime(e.target.value)}
                    placeholder="09:00"
                    className="px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-[11px] text-rose-100"
                  />
                  <select
                    value={evtCategory}
                    data-testid="event-input-category"
                    onChange={(e) => setEvtCategory(e.target.value as ProductionEventCategory)}
                    className="px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-slate-200"
                  >
                    {Object.entries(EVENT_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                {directoryLocations.length > 0 && (
                  <select
                    value={evtLocationId}
                    onChange={(e) => setEvtLocationId(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-slate-200"
                  >
                    <option value="">Optional Directory Location...</option>
                    {directoryLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={evtNotes}
                  onChange={(e) => setEvtNotes(e.target.value)}
                  placeholder="Optional logistics note..."
                  className="w-full px-2.5 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-slate-200"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEventForm(false)}
                    className="px-2.5 py-1 rounded bg-white/5 text-slate-300 text-[11px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="event-submit-btn"
                    className="px-3 py-1 rounded bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)] text-[11px] cursor-pointer"
                  >
                    {editingEventId ? 'Update Event' : 'Save Event'}
                  </button>
                </div>
              </form>
            )}

            {selectedEvents.length === 0 ? (
              <p className="text-[11px] text-slate-500">No events on {simulatedDate}.</p>
            ) : (
              <div className="space-y-1.5">
                {selectedEvents.map((ev) => {
                  const evCat = getEventPhaseCategory(project, ev);
                  const evMeta = evCat ? PHASE_COLOR_META[evCat] : null;
                  return (
                    <div
                      key={ev.id}
                      data-event-id={ev.id}
                      className="rounded-lg border border-[#E63950]/20 bg-[#26151F]/80 border border-[#E63950]/25 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          onUpdateProject?.(
                            updateProductionEvent(project, ev.id, { completed: !ev.completed })
                          )
                        }
                        className="flex items-start gap-2 text-left min-w-0 flex-1 cursor-pointer disabled:cursor-default"
                      >
                        {ev.completed ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <Square
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              evMeta ? evMeta.textClass : 'text-slate-300'
                            }`}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={
                                ev.completed
                                  ? 'line-through text-slate-500'
                                  : 'text-rose-100 font-medium'
                              }
                            >
                              {ev.title}
                            </span>
                            {evMeta && (
                              <span
                                className={`px-1.5 py-0.2 rounded border text-[9px] font-mono ${evMeta.pillClass}`}
                              >
                                {evMeta.shortLabel}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {EVENT_CATEGORY_LABELS[ev.category]}
                            {ev.time ? ` · ${ev.time}` : ''}
                            {ev.locationId && locationNameMap.get(ev.locationId)
                              ? ` · ${locationNameMap.get(ev.locationId)}`
                              : ''}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        {onOpenDiscussion && (
                          <button
                            type="button"
                            data-testid={`calendar-discuss-event-${ev.id}`}
                            onClick={() =>
                              onOpenDiscussion({
                                entityType: 'production_event',
                                entityId: ev.id,
                                entityLabel: `${ev.title} (${ev.date})`,
                              })
                            }
                            title="Discuss this event"
                            className="p-1 text-cyan-400/80 hover:text-cyan-200 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditEventForm(ev)}
                              title="Edit / reschedule event"
                              className="p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateProject?.(deleteProductionEvent(project, ev.id))}
                              title="Delete event"
                              className="p-1 text-slate-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phase-Linked Tasks Section */}
          <div className="space-y-2 pt-2 border-t border-[#E63950]/15">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Phase Tasks on Date ({selectedTasks.length})
              </span>
              {canEdit && project.phases.length > 0 && (
                <button
                  type="button"
                  data-testid="calendar-toggle-add-task-btn"
                  onClick={openNewTaskForm}
                  className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#26151F] border border-[#E63950]/30 hover:border-white/30 text-[11px] text-[#FF8A9B] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Task
                </button>
              )}
            </div>

            {canEdit && showTaskForm && (
              <form
                onSubmit={handleSubmitTask}
                data-testid="calendar-task-form"
                className="rounded-xl border border-white/15 bg-[#26151F]/80 border border-[#E63950]/25 p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-300">
                  <span>{editingTaskRef ? 'Edit / Reschedule Phase Task' : 'New Phase Task'}</span>
                  <button
                    type="button"
                    onClick={() => setShowTaskForm(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  required
                  data-testid="calendar-task-input-title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title connected to production phase"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                />
                {!editingTaskRef && (
                  <select
                    value={taskPhaseId}
                    onChange={(e) => setTaskPhaseId(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-slate-200"
                  >
                    {project.phases.map((ph) => (
                      <option key={ph.id} value={ph.id}>
                        {ph.name} ({ph.category || 'pre'})
                      </option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    min="2024-01-01"
                    max="2040-12-31"
                    data-testid="calendar-task-input-duedate"
                    value={taskEndDate}
                    onChange={(e) => {
                      setTaskEndDate(e.target.value);
                      if (!taskStartDate) setTaskStartDate(e.target.value);
                    }}
                    className="px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-[11px] text-rose-100"
                  />
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as 'high' | 'medium' | 'low')}
                    className="px-2 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-slate-200"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
                <input
                  type="text"
                  list="calendar-dir-people"
                  data-testid="calendar-task-input-assignee"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  placeholder="Assignee (Directory)"
                  className="w-full px-2.5 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-rose-100"
                />
                <datalist id="calendar-dir-people">
                  {directoryPeople.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTaskForm(false)}
                    className="px-2.5 py-1 rounded bg-white/5 text-slate-300 text-[11px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="calendar-task-submit-btn"
                    className="px-3 py-1 rounded bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)] text-[11px] cursor-pointer"
                  >
                    {editingTaskRef ? 'Update Task' : 'Add Task'}
                  </button>
                </div>
              </form>
            )}

            {selectedTasks.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {project.phases.length === 0
                  ? 'Set any Pre/Prod/Post phase dates above to unlock phase tasks.'
                  : `No phase tasks due on ${simulatedDate}.`}
              </p>
            ) : (
              <div className="space-y-1.5">
                {selectedTasks.map(({ act, phaseId, phaseName, phaseCategory }) => {
                  const meta = PHASE_COLOR_META[phaseCategory];
                  return (
                    <div
                      key={act.id}
                      className="rounded-lg border border-[#E63950]/20 bg-[#26151F]/80 border border-[#E63950]/25 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          onUpdateActivity(phaseId, act.id, { completed: !act.completed })
                        }
                        className="flex items-start gap-2 text-left min-w-0 flex-1 cursor-pointer disabled:cursor-default"
                      >
                        {act.completed ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <Square className={`w-3.5 h-3.5 ${meta.textClass} shrink-0 mt-0.5`} />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={act.completed ? 'line-through text-slate-500' : 'text-rose-100'}
                            >
                              {act.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded border text-[9px] font-mono ${meta.pillClass}`}
                            >
                              {meta.shortLabel}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {phaseName}
                            {act.assignedTo ? ` · ${act.assignedTo}` : ''}
                            {act.priority ? ` · ${act.priority.toUpperCase()}` : ''}
                          </div>
                        </div>
                      </button>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditTaskForm(phaseId, act)}
                            title="Edit / reschedule task"
                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveActivity(phaseId, act.id)}
                            title="Delete task"
                            className="p-1 text-slate-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Notes, Progress Updates & Reminders */}
          <div className="space-y-2 pt-2 border-t border-[#E63950]/15 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Daily Notes, Progress & Reminders
              </span>
              {logSavedFlash && (
                <span className="text-[10px] font-mono text-emerald-300 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>

            <textarea
              rows={2}
              value={dayNotesDraft}
              disabled={!canEdit}
              data-testid="calendar-daily-notes-input"
              onChange={(e) => setDayNotesDraft(e.target.value)}
              placeholder="Daily operational notes..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100 text-[11px] resize-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={dayProgressDraft}
                disabled={!canEdit}
                data-testid="calendar-daily-progress-input"
                onChange={(e) => setDayProgressDraft(e.target.value)}
                placeholder="Progress update..."
                className="px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100 text-[11px]"
              />
              <input
                type="text"
                value={dayRemindersDraft}
                disabled={!canEdit}
                data-testid="calendar-daily-reminders-input"
                onChange={(e) => setDayRemindersDraft(e.target.value)}
                placeholder="Important reminder..."
                className="px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100 text-[11px]"
              />
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <button
                  type="button"
                  data-testid="calendar-save-daily-log-btn"
                  onClick={() => handleSaveDailyLog()}
                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)] text-[11px] cursor-pointer"
                >
                  Save Daily Log
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
