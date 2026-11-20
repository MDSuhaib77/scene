import type { CrewMember, FilmPhase, FilmProject, ParsedScene } from '../../../types';
import { addDays, getDaysDifference } from '../../../utils/scheduler';
import type {
  CallSheetRecord,
  DailyCalendarLogRecord,
  DailyProductionReportRecord,
  DayOperationalStatus,
  DirectoryEntryKind,
  DirectoryEntryRecord,
  ProductionEventCategory,
  ProductionEventRecord,
  ProductionSectionId,
  ProductionWorkspaceStore,
  ShootingDayRecord,
} from '../types';

export const PRODUCTION_SECTIONS: Array<{
  id: ProductionSectionId;
  label: string;
  description: string;
}> = [
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Production calendar, tasks, milestones, phases, and shooting dates',
  },
  {
    id: 'shoot',
    label: 'Shoot',
    description: 'Authoritative shooting-day schedule, call sheets, and daily production reports',
  },
  {
    id: 'directory',
    label: 'Directory',
    description: 'Cast, crew, contacts, vendors, and location directory',
  },
];

export function normalizeProductionSectionId(raw?: string | null): ProductionSectionId {
  const val = (raw || '').trim().toLowerCase();
  if (val === 'shoot' || val === 'call-sheets' || val === 'dpr') return 'shoot';
  if (
    val === 'directory' ||
    val === 'crew' ||
    val === 'people' ||
    val === 'contacts' ||
    val === 'locations' ||
    val === 'vendors'
  ) {
    return 'directory';
  }
  return 'calendar';
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function getCanonicalProductionScenes(project: FilmProject): ParsedScene[] {
  const versions = project.screenplayVersions || [];
  const active =
    versions.find((v) => v.id === (project as any).activeScreenplayVersionId) ||
    versions[0] ||
    null;
  const extractedScenes = (active as any)?.extractedScenes as ParsedScene[] | undefined;
  if (extractedScenes && extractedScenes.length > 0) {
    return extractedScenes;
  }
  if (active?.scenes && active.scenes.length > 0) {
    return active.scenes;
  }
  if (Array.isArray((project as any).scenes) && (project as any).scenes.length > 0) {
    return (project as any).scenes;
  }
  return [];
}

/**
 * Retrieves the strictly production-isolated ProductionWorkspaceStore for a FilmProject.
 */
export function getProductionOperationalStore(
  project: FilmProject
): ProductionWorkspaceStore {
  const raw = project.productionState;
  const productionId = project.id;

  const filterScoped = <T extends { id: string; productionId: string }>(
    arr?: T[]
  ): T[] => deduplicateById((arr || []).filter((item) => item.productionId === productionId));

  return {
    schemaVersion: 1,
    productionId,
    shootingDays: filterScoped(raw?.shootingDays).sort(
      (a, b) => a.dayNumber - b.dayNumber
    ),
    events: filterScoped(raw?.events).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
    dailyLogs: (raw?.dailyLogs || [])
      .filter((log) => log.productionId === productionId && Boolean(log.date))
      .sort((a, b) => a.date.localeCompare(b.date)),
    callSheets: filterScoped(raw?.callSheets),
    dailyReports: filterScoped(raw?.dailyReports).sort(
      (a, b) => a.shootDayNumber - b.shootDayNumber
    ),
    directoryEntries: filterScoped(raw?.directoryEntries),
    updatedAt: raw?.updatedAt || project.updatedAt,
  };
}

export function updateProductionOperationalStore(
  project: FilmProject,
  updater: (cur: ProductionWorkspaceStore) => ProductionWorkspaceStore
): FilmProject {
  const current = getProductionOperationalStore(project);
  const next = updater(current);
  const now = new Date().toISOString();

  const logByDate = new Map<string, DailyCalendarLogRecord>();
  (next.dailyLogs || []).forEach((log) => {
    if (log?.date) {
      logByDate.set(log.date, { ...log, productionId: project.id });
    }
  });

  return {
    ...project,
    productionState: {
      ...next,
      schemaVersion: 1,
      productionId: project.id,
      shootingDays: deduplicateById(
        next.shootingDays.map((d) => ({ ...d, productionId: project.id }))
      ).sort((a, b) => a.dayNumber - b.dayNumber),
      events: deduplicateById(
        (next.events || []).map((ev) => ({ ...ev, productionId: project.id }))
      ).sort((a, b) => a.date.localeCompare(b.date)),
      dailyLogs: Array.from(logByDate.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
      callSheets: deduplicateById(
        next.callSheets.map((c) => ({ ...c, productionId: project.id }))
      ),
      dailyReports: deduplicateById(
        next.dailyReports.map((r) => ({ ...r, productionId: project.id }))
      ),
      directoryEntries: deduplicateById(
        next.directoryEntries.map((e) => ({ ...e, productionId: project.id }))
      ),
      updatedAt: now,
    },
    updatedAt: now,
  };
}

// ============================================================================
// Authoritative Shooting-Day Records (aligned with Breakdown Stripboard)
// ============================================================================

export interface CreateShootingDayInput {
  date: string;
  dayNumber?: number;
  callTime?: string;
  wrapTime?: string;
  locationId?: string;
  sceneIds?: string[];
  notes?: string;
  status?: ShootingDayRecord['status'];
}

export function createShootingDay(
  project: FilmProject,
  input: CreateShootingDayInput
): { updatedProject: FilmProject; day: ShootingDayRecord } {
  const current = getProductionOperationalStore(project);
  const nextNumber =
    input.dayNumber ??
    (current.shootingDays.length > 0
      ? Math.max(...current.shootingDays.map((d) => d.dayNumber)) + 1
      : 1);
  const now = new Date().toISOString();
  const dayId = `shootday-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const day: ShootingDayRecord = {
    id: dayId,
    productionId: project.id,
    dayNumber: nextNumber,
    date: input.date || project.startDate,
    callTime: input.callTime?.trim() || '06:30',
    wrapTime: input.wrapTime?.trim() || '18:30',
    locationId: input.locationId || undefined,
    sceneIds: input.sceneIds ? [...input.sceneIds] : [],
    notes: input.notes?.trim() || undefined,
    status: input.status || 'scheduled',
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    shootingDays: [...cur.shootingDays, day],
  }));

  return { updatedProject, day };
}

export function updateShootingDay(
  project: FilmProject,
  dayId: string,
  updates: Partial<
    Pick<
      ShootingDayRecord,
      'dayNumber' | 'date' | 'callTime' | 'wrapTime' | 'locationId' | 'sceneIds' | 'notes' | 'status'
    >
  >
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    shootingDays: cur.shootingDays.map((d) =>
      d.id === dayId && d.productionId === project.id
        ? { ...d, ...updates, updatedAt: now }
        : d
    ),
  }));
}

export function assignSceneToShootingDay(
  project: FilmProject,
  dayId: string,
  sceneId: string
): FilmProject {
  const now = new Date().toISOString();
  const updated = updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    shootingDays: cur.shootingDays.map((d) => {
      if (d.id === dayId) {
        if (d.sceneIds.includes(sceneId)) return d;
        return { ...d, sceneIds: [...d.sceneIds, sceneId], updatedAt: now };
      }
      // Remove scene from any other day to avoid duplicate scheduling across shooting days
      if (d.sceneIds.includes(sceneId)) {
        return {
          ...d,
          sceneIds: d.sceneIds.filter((id) => id !== sceneId),
          updatedAt: now,
        };
      }
      return d;
    }),
  }));

  const targetDay = updated.productionState?.shootingDays.find((d) => d.id === dayId);
  if (!targetDay) return updated;
  return syncStripboardFieldsOnProjectScenes(updated, targetDay.dayNumber, sceneId);
}

export function unassignSceneFromShootingDay(
  project: FilmProject,
  dayId: string,
  sceneId: string
): FilmProject {
  const now = new Date().toISOString();
  const updated = updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    shootingDays: cur.shootingDays.map((d) =>
      d.id === dayId
        ? {
            ...d,
            sceneIds: d.sceneIds.filter((id) => id !== sceneId),
            updatedAt: now,
          }
        : d
    ),
  }));
  return syncStripboardFieldsOnProjectScenes(updated, 0, sceneId);
}

function syncStripboardFieldsOnProjectScenes(
  project: FilmProject,
  shootDay: number,
  sceneId: string
): FilmProject {
  const patchList = (list?: ParsedScene[]) =>
    list?.map((sc) =>
      sc.id === sceneId
        ? ({ ...sc, shootDay, dayNumber: shootDay } as ParsedScene)
        : sc
    );

  const versions = (project.screenplayVersions || []).map((ver) => ({
    ...ver,
    scenes: patchList(ver.scenes),
    ...(Array.isArray((ver as any).extractedScenes)
      ? { extractedScenes: patchList((ver as any).extractedScenes) }
      : {}),
  }));

  return {
    ...project,
    screenplayVersions: versions,
    ...(Array.isArray((project as any).scenes)
      ? { scenes: patchList((project as any).scenes) }
      : {}),
  };
}

export function deleteShootingDay(project: FilmProject, dayId: string): FilmProject {
  return updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    shootingDays: cur.shootingDays
      .filter((d) => !(d.id === dayId && d.productionId === project.id))
      .map((d, idx) => ({ ...d, dayNumber: idx + 1 })),
    callSheets: cur.callSheets.filter((c) => c.shootingDayId !== dayId),
    dailyReports: cur.dailyReports.filter((r) => r.shootingDayId !== dayId),
  }));
}

/**
 * Reconciles Production Shooting Days directly with saved Stripboard scenes & day metadata.
 * Non-destructive: preserves existing Call Sheets, notes, and statuses on matching day numbers.
 */
export function reconcileShootingDaysFromStripboard(
  project: FilmProject,
  stripboardScenes: ParsedScene[],
  dayScheduleMeta?: Record<number, { date: string; callTime: string }>
): FilmProject {
  const dayBuckets = new Map<number, ParsedScene[]>();
  stripboardScenes.forEach((sc) => {
    const dayNum = Number((sc as any).shootDay || (sc as any).dayNumber || 0);
    if (dayNum > 0) {
      const existing = dayBuckets.get(dayNum) || [];
      existing.push(sc);
      dayBuckets.set(dayNum, existing);
    }
  });

  if (dayBuckets.size === 0) return project;

  const prodPhaseStart =
    project.phases.find((p) => p.category === 'prod')?.startDate ||
    project.startDate ||
    new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  return updateProductionOperationalStore(project, (cur) => {
    const byDayNum = new Map<number, ShootingDayRecord>();
    cur.shootingDays.forEach((d) => byDayNum.set(d.dayNumber, d));

    const sortedDays = Array.from(dayBuckets.keys()).sort((a, b) => a - b);
    const updatedDays: ShootingDayRecord[] = [];
    const handledDayNums = new Set<number>();

    sortedDays.forEach((dayNum) => {
      handledDayNums.add(dayNum);
      const bucket = (dayBuckets.get(dayNum) || []).sort(
        (a, b) =>
          (Number((a as any).stripboardOrder) || 0) -
          (Number((b as any).stripboardOrder) || 0)
      );
      const existing = byDayNum.get(dayNum);
      const meta = dayScheduleMeta?.[dayNum];
      const hasNight = bucket.some(
        (s) => s.timeOfDay === 'NIGHT' || s.timeOfDay === 'DUSK'
      );

      if (existing) {
        updatedDays.push({
          ...existing,
          date: meta?.date || existing.date,
          callTime: meta?.callTime || existing.callTime,
          sceneIds: bucket.map((s) => s.id),
          updatedAt: now,
        });
      } else {
        updatedDays.push({
          id: `shootday-${Date.now()}-${dayNum}-${Math.random().toString(36).slice(2, 6)}`,
          productionId: project.id,
          dayNumber: dayNum,
          date: meta?.date || addDays(prodPhaseStart, dayNum - 1),
          callTime: meta?.callTime || (hasNight ? '18:00' : '06:30'),
          wrapTime: hasNight ? '04:30' : '18:30',
          sceneIds: bucket.map((s) => s.id),
          status: 'scheduled',
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    // Keep any manually created extra shoot days that aren't represented in Stripboard yet
    cur.shootingDays.forEach((d) => {
      if (!handledDayNums.has(d.dayNumber)) {
        updatedDays.push(d);
      }
    });

    return {
      ...cur,
      shootingDays: updatedDays.sort((a, b) => a.dayNumber - b.dayNumber),
    };
  });
}

/**
 * Generates ShootingDayRecords from authoritative Stripboard assignments when present,
 * otherwise cleanly batches unscheduled canonical screenplay scenes without overwriting existing days.
 */
export function syncShootingDaysFromScreenplay(project: FilmProject): FilmProject {
  const scenes = getCanonicalProductionScenes(project);
  if (scenes.length === 0) return project;

  const hasStripboardAssignments = scenes.some(
    (s) => Number((s as any).shootDay || (s as any).dayNumber || 0) > 0
  );
  if (hasStripboardAssignments) {
    return reconcileShootingDaysFromStripboard(project, scenes);
  }

  const current = getProductionOperationalStore(project);
  const scheduledSceneIds = new Set(current.shootingDays.flatMap((d) => d.sceneIds));
  const remainingScenes = scenes.filter((sc) => !scheduledSceneIds.has(sc.id));
  if (remainingScenes.length === 0) return project;

  const prodPhaseStart =
    project.phases.find((p) => p.category === 'prod')?.startDate ||
    project.startDate ||
    new Date().toISOString().slice(0, 10);

  let nextDayNum =
    current.shootingDays.length > 0
      ? Math.max(...current.shootingDays.map((d) => d.dayNumber)) + 1
      : 1;
  const now = new Date().toISOString();

  const newDays: ShootingDayRecord[] = [];
  let bucket: ParsedScene[] = [];
  let bucketEighths = 0;

  remainingScenes.forEach((sc, idx) => {
    bucket.push(sc);
    bucketEighths += Math.max(1, Math.round(Number(sc.pageLengthEighths) || 8));

    if (bucket.length >= 3 || bucketEighths >= 28 || idx === remainingScenes.length - 1) {
      const hasNight = bucket.some(
        (s) => s.timeOfDay === 'NIGHT' || s.timeOfDay === 'DUSK'
      );
      const dayDate = addDays(prodPhaseStart, nextDayNum - 1);
      newDays.push({
        id: `shootday-${Date.now()}-${nextDayNum}-${Math.random().toString(36).slice(2, 6)}`,
        productionId: project.id,
        dayNumber: nextDayNum,
        date: dayDate,
        callTime: hasNight ? '18:00' : '06:30',
        wrapTime: hasNight ? '04:30' : '18:30',
        sceneIds: bucket.map((b) => b.id),
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
      });
      nextDayNum += 1;
      bucket = [];
      bucketEighths = 0;
    }
  });

  return updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    shootingDays: [...cur.shootingDays, ...newDays],
  }));
}

// ============================================================================
// Production Events & Milestones (consumed by Production / Calendar)
// ============================================================================

export interface CreateProductionEventInput {
  title: string;
  date: string;
  time?: string;
  category?: ProductionEventCategory;
  locationId?: string;
  notes?: string;
}

export function createProductionEvent(
  project: FilmProject,
  input: CreateProductionEventInput
): { updatedProject: FilmProject; event: ProductionEventRecord } {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    throw new Error('Event title is required.');
  }
  const now = new Date().toISOString();
  const event: ProductionEventRecord = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productionId: project.id,
    title: cleanTitle,
    date: input.date || project.startDate,
    time: input.time?.trim() || undefined,
    category: input.category || 'general',
    locationId: input.locationId || undefined,
    notes: input.notes?.trim() || undefined,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    events: [...cur.events, event],
  }));

  return { updatedProject, event };
}

export function updateProductionEvent(
  project: FilmProject,
  eventId: string,
  updates: Partial<
    Omit<ProductionEventRecord, 'id' | 'productionId' | 'createdAt'>
  >
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    events: cur.events.map((ev) =>
      ev.id === eventId && ev.productionId === project.id
        ? { ...ev, ...updates, updatedAt: now }
        : ev
    ),
  }));
}

export function deleteProductionEvent(
  project: FilmProject,
  eventId: string
): FilmProject {
  return updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    events: cur.events.filter(
      (ev) => !(ev.id === eventId && ev.productionId === project.id)
    ),
  }));
}

export interface UpsertDailyCalendarLogInput {
  status?: DayOperationalStatus;
  notes?: string;
  progressUpdate?: string;
  reminders?: string;
}

export function getDailyCalendarLog(
  store: ProductionWorkspaceStore,
  date: string
): DailyCalendarLogRecord | null {
  return (store.dailyLogs || []).find((l) => l.date === date) || null;
}

export function upsertDailyCalendarLog(
  project: FilmProject,
  date: string,
  updates: UpsertDailyCalendarLogInput
): FilmProject {
  if (!date) return project;
  const now = new Date().toISOString();
  return updateProductionOperationalStore(project, (cur) => {
    const existingList = cur.dailyLogs || [];
    const existing = existingList.find((l) => l.date === date);
    const merged: DailyCalendarLogRecord = {
      date,
      productionId: project.id,
      status: updates.status ?? existing?.status ?? 'Planned',
      notes: 'notes' in updates ? updates.notes?.trim() || undefined : existing?.notes,
      progressUpdate:
        'progressUpdate' in updates
          ? updates.progressUpdate?.trim() || undefined
          : existing?.progressUpdate,
      reminders:
        'reminders' in updates
          ? updates.reminders?.trim() || undefined
          : existing?.reminders,
      updatedAt: now,
    };

    const nextLogs = existing
      ? existingList.map((l) => (l.date === date ? merged : l))
      : [...existingList, merged];

    return {
      ...cur,
      dailyLogs: nextLogs,
    };
  });
}

export type ProductionPhaseCategory = 'pre' | 'prod' | 'post';

export interface PhaseColorMeta {
  category: ProductionPhaseCategory;
  label: string;
  shortLabel: string;
  dotClass: string;
  topBarClass: string;
  textClass: string;
  cardBorderClass: string;
  cellClass: string;
  pillClass: string;
  progressBarClass: string;
}

export const PHASE_COLOR_META: Record<ProductionPhaseCategory, PhaseColorMeta> = {
  pre: {
    category: 'pre',
    label: 'Pre-Production',
    shortLabel: 'PRE',
    dotClass: 'bg-sky-400',
    topBarClass: 'bg-sky-400/85',
    textClass: 'text-sky-300',
    cardBorderClass: 'border-sky-400/30',
    cellClass: 'border-sky-400/25 bg-sky-950/20',
    pillClass: 'border-sky-400/40 bg-sky-500/20 text-sky-100',
    progressBarClass: 'bg-sky-400/85',
  },
  prod: {
    category: 'prod',
    label: 'Production',
    shortLabel: 'PROD',
    dotClass: 'bg-amber-400',
    topBarClass: 'bg-amber-400/90',
    textClass: 'text-amber-300',
    cardBorderClass: 'border-amber-400/35',
    cellClass: 'border-amber-400/30 bg-amber-950/20',
    pillClass: 'border-amber-400/45 bg-amber-500/20 text-amber-100',
    progressBarClass: 'bg-amber-400/90',
  },
  post: {
    category: 'post',
    label: 'Post-Production',
    shortLabel: 'POST',
    dotClass: 'bg-violet-400',
    topBarClass: 'bg-violet-400/85',
    textClass: 'text-violet-300',
    cardBorderClass: 'border-violet-400/30',
    cellClass: 'border-violet-400/25 bg-violet-950/20',
    pillClass: 'border-violet-400/40 bg-violet-500/20 text-violet-100',
    progressBarClass: 'bg-violet-400/85',
  },
};

export interface PhaseCategoryWindowSummary {
  start: string | null;
  end: string | null;
  durationDays: number;
  completedTasks: number;
  totalTasks: number;
}

export interface ProjectScheduleSpan {
  startDate: string;
  endDate: string;
  shootWindowStart: string | null;
  shootWindowEnd: string | null;
  preWindow: PhaseCategoryWindowSummary;
  prodWindow: PhaseCategoryWindowSummary;
  postWindow: PhaseCategoryWindowSummary;
}

export function getPhasesForDate(project: FilmProject, dateStr: string): FilmPhase[] {
  if (!dateStr) return [];
  return (project.phases || []).filter(
    (ph) => Boolean(ph.startDate && ph.endDate && dateStr >= ph.startDate && dateStr <= ph.endDate)
  );
}

/**
 * Resolves the dominant production phase category owning a specific calendar date.
 * If phases overlap or multiple exist on a date, Production takes visual precedence
 * so active shooting windows remain unmistakable.
 */
export function getPhaseCategoryForDate(
  project: FilmProject,
  dateStr: string
): ProductionPhaseCategory | null {
  const active = getPhasesForDate(project, dateStr);
  if (active.length === 0) return null;
  if (active.some((p) => p.category === 'prod')) return 'prod';
  if (active.some((p) => p.category === 'pre')) return 'pre';
  if (active.some((p) => p.category === 'post')) return 'post';
  return active[0].category || 'pre';
}

export function getEventPhaseCategory(
  project: FilmProject,
  event: Pick<ProductionEventRecord, 'date' | 'category'>
): ProductionPhaseCategory | null {
  const fromDate = getPhaseCategoryForDate(project, event.date);
  if (fromDate) return fromDate;
  if (
    event.category === 'rehearsal' ||
    event.category === 'tech-scout' ||
    event.category === 'fitting'
  ) {
    return 'pre';
  }
  if (event.category === 'delivery') {
    return 'post';
  }
  return null;
}

/**
 * Updates (or initializes) start/end dates for a canonical production phase category
 * ('pre' | 'prod' | 'post'), recalculating phase duration and project schedule bounds
 * without losing any existing tasks, events, shooting days, or daily calendar logs.
 */
export function setProductionPhaseCategoryDates(
  project: FilmProject,
  category: ProductionPhaseCategory,
  nextStartDate?: string | null,
  nextEndDate?: string | null
): FilmProject {
  const existingPhases = (project.phases || []).map((p) => ({
    ...p,
    activities: [...(p.activities || [])],
    crew: [...(p.crew || [])],
  }));

  const prevEndsAll = existingPhases.map((p) => p.endDate).filter(Boolean).sort();
  const prevMaxEnd = prevEndsAll[prevEndsAll.length - 1] || null;

  const matchingIndices: number[] = [];
  existingPhases.forEach((p, idx) => {
    if ((p.category || 'pre') === category) matchingIndices.push(idx);
  });

  const isSensibleProductionDate = (d?: string | null): boolean => {
    if (!d || typeof d !== 'string') return false;
    const parts = d.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    return !isNaN(y) && y >= 2020 && y <= 2045;
  };

  const validNextStart = isSensibleProductionDate(nextStartDate) ? nextStartDate!.trim() : null;
  const validNextEnd = isSensibleProductionDate(nextEndDate) ? nextEndDate!.trim() : null;

  // If user passed invalid / incomplete date strings (e.g. typing "0002"), ignore them
  if (nextStartDate !== undefined && nextStartDate !== null && nextStartDate.trim() !== '' && !validNextStart) {
    return project;
  }
  if (nextEndDate !== undefined && nextEndDate !== null && nextEndDate.trim() !== '' && !validNextEnd) {
    return project;
  }

  const existingStarts = matchingIndices
    .map((idx) => existingPhases[idx].startDate)
    .filter(isSensibleProductionDate)
    .sort();
  const existingEnds = matchingIndices
    .map((idx) => existingPhases[idx].endDate)
    .filter(isSensibleProductionDate)
    .sort();

  const fallbackStart =
    existingStarts[0] ||
    (validNextEnd ? validNextEnd : (isSensibleProductionDate(project.startDate) ? project.startDate : null)) ||
    new Date().toISOString().slice(0, 10);
  const rawStart = (validNextStart ?? existingStarts[0] ?? fallbackStart).trim();
  const fallbackEnd =
    existingEnds[existingEnds.length - 1] ||
    (rawStart ? addDays(rawStart, Math.max(0, (existingPhases[matchingIndices[0]]?.durationDays || 7) - 1)) : fallbackStart);
  const rawEnd = (validNextEnd ?? existingEnds[existingEnds.length - 1] ?? fallbackEnd).trim();

  let cleanStart = rawStart || rawEnd;
  let cleanEnd = rawEnd || rawStart;
  if (!cleanStart || !cleanEnd) return project;

  if (cleanStart > cleanEnd) {
    // Preserve intent based on which edge the user edited
    if (nextStartDate && !nextEndDate) {
      cleanEnd = cleanStart;
    } else {
      cleanStart = cleanEnd;
    }
  }

  const totalDuration = Math.max(1, getDaysDifference(cleanStart, cleanEnd) + 1);
  const meta = PHASE_COLOR_META[category];

  let nextPhases = [...existingPhases];

  if (matchingIndices.length === 0) {
    const newPhase: FilmPhase = {
      id: `phase-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: meta.label,
      category,
      color: meta.cellClass,
      textLightColor: meta.textClass,
      textDarkColor: meta.textClass,
      durationDays: totalDuration,
      startDate: cleanStart,
      endDate: cleanEnd,
      status: 'active',
      activities: [],
      crew: [],
    };
    const orderRank: Record<ProductionPhaseCategory, number> = { pre: 0, prod: 1, post: 2 };
    nextPhases.push(newPhase);
    nextPhases.sort(
      (a, b) =>
        (orderRank[(a.category || 'pre') as ProductionPhaseCategory] ?? 9) -
        (orderRank[(b.category || 'pre') as ProductionPhaseCategory] ?? 9)
    );
  } else if (matchingIndices.length === 1) {
    const idx = matchingIndices[0];
    const target = nextPhases[idx];
    nextPhases[idx] = {
      ...target,
      startDate: cleanStart,
      endDate: cleanEnd,
      durationDays: totalDuration,
    };
  } else {
    const firstIdx = matchingIndices[0];
    const lastIdx = matchingIndices[matchingIndices.length - 1];
    matchingIndices.forEach((idx) => {
      const target = nextPhases[idx];
      const nextSubStart =
        idx === firstIdx
          ? cleanStart
          : target.startDate && target.startDate >= cleanStart && target.startDate <= cleanEnd
            ? target.startDate
            : cleanStart;
      const nextSubEnd =
        idx === lastIdx
          ? cleanEnd
          : target.endDate && target.endDate >= nextSubStart && target.endDate <= cleanEnd
            ? target.endDate
            : cleanEnd;
      const safeSubStart = nextSubStart <= nextSubEnd ? nextSubStart : nextSubEnd;
      nextPhases[idx] = {
        ...target,
        startDate: safeSubStart,
        endDate: nextSubEnd,
        durationDays: Math.max(1, getDaysDifference(safeSubStart, nextSubEnd) + 1),
      };
    });
  }

  const nextStartsAll = nextPhases.map((p) => p.startDate).filter(Boolean).sort();
  const nextEndsAll = nextPhases.map((p) => p.endDate).filter(Boolean).sort();
  const minPhaseStart = nextStartsAll[0];
  const maxPhaseEnd = nextEndsAll[nextEndsAll.length - 1];

  const shouldUpdateFinalEnd =
    Boolean(maxPhaseEnd) &&
    (!project.isEndDateFixed ||
      !project.finalEndDate ||
      prevMaxEnd === null ||
      maxPhaseEnd > project.finalEndDate ||
      prevMaxEnd === project.finalEndDate);

  return {
    ...project,
    phases: nextPhases,
    startDate: minPhaseStart || project.startDate,
    suggestedEndDate: maxPhaseEnd || project.suggestedEndDate,
    finalEndDate: shouldUpdateFinalEnd && maxPhaseEnd ? maxPhaseEnd : project.finalEndDate,
    updatedAt: new Date().toISOString(),
  };
}

export function getProjectScheduleSpan(
  project: FilmProject,
  store: ProductionWorkspaceStore
): ProjectScheduleSpan {
  const isSensibleDate = (d?: string | null): boolean => {
    if (!d || typeof d !== 'string') return false;
    const parts = d.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    return !isNaN(y) && y >= 2020 && y <= 2045;
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const candidates: string[] = [];
  const validProjectStart = isSensibleDate(project.startDate) ? project.startDate : null;
  const validProjectFinalEnd = isSensibleDate(project.finalEndDate) ? project.finalEndDate : null;
  const validProjectSuggestedEnd = isSensibleDate(project.suggestedEndDate) ? project.suggestedEndDate : null;

  if (validProjectStart) candidates.push(validProjectStart);
  if (validProjectFinalEnd) candidates.push(validProjectFinalEnd);
  if (validProjectSuggestedEnd) candidates.push(validProjectSuggestedEnd);

  const catWindow = (cat: ProductionPhaseCategory): PhaseCategoryWindowSummary => {
    const matching = (project.phases || []).filter((p) => (p.category || 'pre') === cat);
    const starts = matching.map((p) => p.startDate).filter(isSensibleDate).sort();
    const ends = matching.map((p) => p.endDate).filter(isSensibleDate).sort();
    matching.forEach((p) => {
      if (isSensibleDate(p.startDate)) candidates.push(p.startDate!);
      if (isSensibleDate(p.endDate)) candidates.push(p.endDate!);
    });
    const activities = matching.flatMap((p) => p.activities || []);
    const start = starts[0] || null;
    const end = ends[ends.length - 1] || null;
    const durationDays =
      start && end
        ? Math.max(1, getDaysDifference(start, end) + 1)
        : matching.reduce((sum, p) => sum + (p.durationDays || 0), 0);
    return {
      start,
      end,
      durationDays,
      completedTasks: activities.filter((a) => a.completed).length,
      totalTasks: activities.length,
    };
  };

  const preWindow = catWindow('pre');
  const prodWindow = catWindow('prod');
  const postWindow = catWindow('post');

  store.shootingDays.forEach((d) => {
    if (isSensibleDate(d.date)) candidates.push(d.date);
  });
  store.events.forEach((ev) => {
    if (isSensibleDate(ev.date)) candidates.push(ev.date);
    if (isSensibleDate(ev.endDate)) candidates.push(ev.endDate!);
  });

  const sortedAll = candidates.filter(isSensibleDate).sort();
  const shootDates = store.shootingDays.map((d) => d.date).filter(isSensibleDate).sort();
  const shootBoundsStart = [prodWindow.start, shootDates[0]].filter(Boolean).sort()[0] || null;
  const shootBoundsEndList = [prodWindow.end, shootDates[shootDates.length - 1]].filter(Boolean).sort();
  const shootBoundsEnd = shootBoundsEndList[shootBoundsEndList.length - 1] || null;

  return {
    startDate: validProjectStart || sortedAll[0] || todayStr,
    endDate:
      sortedAll[sortedAll.length - 1] ||
      validProjectFinalEnd ||
      validProjectStart ||
      todayStr,
    shootWindowStart: shootBoundsStart,
    shootWindowEnd: shootBoundsEnd,
    preWindow,
    prodWindow,
    postWindow,
  };
}

export interface DateConflictItem {
  id: string;
  severity: 'conflict' | 'overdue' | 'warning';
  message: string;
}

export function detectDateConflicts(
  dateStr: string,
  project: FilmProject,
  store: ProductionWorkspaceStore,
  todayStr: string
): DateConflictItem[] {
  const issues: DateConflictItem[] = [];
  const daysOnDate = store.shootingDays.filter((d) => d.date === dateStr);
  const eventsOnDate = store.events.filter(
    (ev) => ev.date === dateStr || (ev.endDate && dateStr >= ev.date && dateStr <= ev.endDate)
  );

  // 1. Multiple shoot days on the same calendar date
  if (daysOnDate.length > 1) {
    issues.push({
      id: `dup-shoot-${dateStr}`,
      severity: 'conflict',
      message: `${daysOnDate.length} shooting days scheduled on the same date (Day ${daysOnDate
        .map((d) => d.dayNumber)
        .join(', Day ')})`,
    });
  }

  // 2. Duplicate location booking across multiple shoot days or events
  if (daysOnDate.length > 1) {
    const locCounts = new Map<string, number>();
    daysOnDate.forEach((d) => {
      if (d.locationId) locCounts.set(d.locationId, (locCounts.get(d.locationId) || 0) + 1);
    });
    locCounts.forEach((count) => {
      if (count > 1) {
        issues.push({
          id: `dup-loc-${dateStr}`,
          severity: 'conflict',
          message: 'Same Directory location assigned to multiple shooting days on this date',
        });
      }
    });
  }

  // 3. Same Directory person called across multiple shoot days on this date
  if (daysOnDate.length > 1) {
    const personSeen = new Set<string>();
    const personDuplicated = new Set<string>();
    daysOnDate.forEach((d) => {
      const cs = store.callSheets.find((c) => c.shootingDayId === d.id);
      (cs?.directoryEntryIds || []).forEach((pid) => {
        if (personSeen.has(pid)) personDuplicated.add(pid);
        personSeen.add(pid);
      });
    });
    if (personDuplicated.size > 0) {
      issues.push({
        id: `dup-person-${dateStr}`,
        severity: 'conflict',
        message: `${personDuplicated.size} cast/crew member(s) double-booked across shooting days`,
      });
    }
  }

  // 4. Shoot day scheduled outside active Production phase window
  const prodPhases = (project.phases || []).filter((p) => (p.category || 'prod') === 'prod');
  if (daysOnDate.length > 0 && prodPhases.length > 0) {
    const insideProd = prodPhases.some(
      (p) => dateStr >= p.startDate && dateStr <= p.endDate
    );
    if (!insideProd) {
      issues.push({
        id: `outside-prod-${dateStr}`,
        severity: 'warning',
        message: 'Shoot day falls outside configured Production phase dates',
      });
    }
  }

  // 5. Delayed log or overdue items
  const dailyLog = getDailyCalendarLog(store, dateStr);
  if (dailyLog?.status === 'Delayed' || daysOnDate.some((d) => d.status === 'delayed')) {
    issues.push({
      id: `delayed-${dateStr}`,
      severity: 'warning',
      message: 'Day marked as Delayed',
    });
  }

  if (dateStr < todayStr) {
    daysOnDate
      .filter((d) => d.status !== 'completed')
      .forEach((d) => {
        issues.push({
          id: `overdue-shoot-${d.id}`,
          severity: 'overdue',
          message: `Shoot Day ${d.dayNumber} still "${d.status}" past scheduled date`,
        });
      });

    eventsOnDate
      .filter((ev) => !ev.completed && ev.date < todayStr)
      .forEach((ev) => {
        issues.push({
          id: `overdue-evt-${ev.id}`,
          severity: 'overdue',
          message: `Event overdue: ${ev.title}`,
        });
      });

    (project.phases || []).forEach((ph) => {
      ph.activities
        .filter((act) => !act.completed && (act.endDate || act.startDate) === dateStr)
        .forEach((act) => {
          issues.push({
            id: `overdue-act-${act.id}`,
            severity: 'overdue',
            message: `Task overdue: ${act.name}`,
          });
        });
    });
  }

  return issues;
}

// ============================================================================
// Call Sheets (referencing ShootingDay & Directory without duplication)
// ============================================================================

export type UpsertCallSheetUpdates = Partial<
  Omit<CallSheetRecord, 'id' | 'productionId' | 'shootingDayId' | 'createdAt' | 'updatedAt'>
> & {
  bumpRevision?: boolean;
};

export function upsertCallSheetForDay(
  project: FilmProject,
  shootingDayId: string,
  updates: UpsertCallSheetUpdates
): { updatedProject: FilmProject; callSheet: CallSheetRecord | null } {
  const current = getProductionOperationalStore(project);
  const day = current.shootingDays.find((d) => d.id === shootingDayId);
  if (!day) return { updatedProject: project, callSheet: null };

  const existing = current.callSheets.find((c) => c.shootingDayId === shootingDayId);
  const now = new Date().toISOString();
  const { bumpRevision, ...cleanUpdates } = updates;

  const baseRevision = existing?.revisionNumber || 1;
  const nextRevision = bumpRevision ? baseRevision + 1 : cleanUpdates.revisionNumber ?? baseRevision;

  const record: CallSheetRecord = existing
    ? {
        ...existing,
        ...cleanUpdates,
        locationId: 'locationId' in cleanUpdates ? cleanUpdates.locationId : existing.locationId,
        revisionNumber: nextRevision,
        publishedAt:
          cleanUpdates.published && !existing.published
            ? now
            : cleanUpdates.published === false
            ? undefined
            : existing.publishedAt,
        updatedAt: now,
      }
    : {
        id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productionId: project.id,
        shootingDayId,
        locationId: 'locationId' in cleanUpdates ? cleanUpdates.locationId : day.locationId,
        revisionNumber: cleanUpdates.revisionNumber ?? 1,
        generalCallTime: cleanUpdates.generalCallTime || day.callTime || '06:30',
        firstShotTime: cleanUpdates.firstShotTime || '07:30',
        estimatedWrapTime: cleanUpdates.estimatedWrapTime || day.wrapTime || '18:30',
        sunriseTime: cleanUpdates.sunriseTime,
        sunsetTime: cleanUpdates.sunsetTime,
        weatherSummary: cleanUpdates.weatherSummary,
        safetyNotes: cleanUpdates.safetyNotes,
        parkingNotes: cleanUpdates.parkingNotes,
        basecampAddress: cleanUpdates.basecampAddress,
        hospitalOverride: cleanUpdates.hospitalOverride,
        emergencyContact: cleanUpdates.emergencyContact,
        mealInfo: cleanUpdates.mealInfo,
        productionNotes: cleanUpdates.productionNotes,
        advanceNextDay: cleanUpdates.advanceNextDay,
        keyContacts: cleanUpdates.keyContacts,
        castCalls: cleanUpdates.castCalls,
        departmentInstructions: cleanUpdates.departmentInstructions,
        sceneTimingOverrides: cleanUpdates.sceneTimingOverrides,
        directoryEntryIds: cleanUpdates.directoryEntryIds || [],
        callTimeOverrides: cleanUpdates.callTimeOverrides || {},
        published: Boolean(cleanUpdates.published),
        publishedAt: cleanUpdates.published ? now : undefined,
        createdAt: now,
        updatedAt: now,
      };

  const updatedProject = updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    callSheets: existing
      ? cur.callSheets.map((c) => (c.id === existing.id ? record : c))
      : [...cur.callSheets, record],
  }));

  return { updatedProject, callSheet: record };
}

// ============================================================================
// Daily Production Reports (DPR) — Persistent per Production
// ============================================================================

export function upsertDailyReport(
  project: FilmProject,
  report: Omit<DailyProductionReportRecord, 'productionId' | 'updatedAt'>
): FilmProject {
  const now = new Date().toISOString();
  const existingStore = getProductionOperationalStore(project);
  const existing = existingStore.dailyReports.find((r) => r.id === report.id);

  // Derive completed scene IDs accurately from sceneResults if provided
  const completedFromResults = report.sceneResults
    ? report.sceneResults.filter((sr) => sr.result === 'Completed').map((sr) => sr.sceneId)
    : undefined;
  const scenesCompletedIds = completedFromResults ?? report.scenesCompletedIds ?? [];

  const full: DailyProductionReportRecord = {
    ...report,
    scenesCompletedIds,
    productionId: project.id,
    submittedAt:
      report.status === 'Submitted' && !report.submittedAt
        ? existing?.submittedAt || now
        : report.submittedAt,
    approvedAt:
      report.status === 'Approved' && !report.approvedAt
        ? existing?.approvedAt || now
        : report.status !== 'Approved'
        ? undefined
        : report.approvedAt,
    updatedAt: now,
  };

  return updateProductionOperationalStore(project, (cur) => {
    const exists = cur.dailyReports.some((r) => r.id === full.id);
    // Update operational shooting-day status from submitted/approved DPR outcome WITHOUT touching sceneIds or Call Sheet plan
    const targetDayId = full.shootingDayId;
    const nextDays = targetDayId
      ? cur.shootingDays.map((d) => {
          if (d.id !== targetDayId) return d;
          if (full.status === 'Draft') return d;
          const totalScheduled = d.sceneIds.length;
          if (totalScheduled > 0 && scenesCompletedIds.length >= totalScheduled) {
            return { ...d, status: 'completed' as const, updatedAt: now };
          }
          if (scenesCompletedIds.length > 0 || (full.sceneResults || []).some((r) => r.result !== 'Not Shot')) {
            return { ...d, status: 'in-progress' as const, updatedAt: now };
          }
          return d;
        })
      : cur.shootingDays;

    return {
      ...cur,
      shootingDays: nextDays,
      dailyReports: exists
        ? cur.dailyReports.map((r) => (r.id === full.id ? full : r))
        : [...cur.dailyReports, full],
    };
  });
}

export interface CumulativeDprProgress {
  completedSceneIds: string[];
  partialSceneIds: string[];
  completedEighths: number;
  totalScriptEighths: number;
  totalSetups: number;
  totalLostMinutes: number;
  reportsCount: number;
  approvedReportsCount: number;
}

export function getCumulativeDprProgress(
  store: ProductionWorkspaceStore,
  canonicalScenes: ParsedScene[]
): CumulativeDprProgress {
  const completedSet = new Set<string>();
  const partialSet = new Set<string>();
  let totalSetups = 0;
  let totalLostMinutes = 0;
  let approvedReportsCount = 0;
  let completedEighthsFromReports = 0;

  store.dailyReports.forEach((rep) => {
    if (rep.status === 'Approved') approvedReportsCount += 1;
    totalSetups += Number(rep.setupsCompleted) || 0;
    totalLostMinutes += (rep.delayEntries || []).reduce(
      (sum, d) => sum + (Number(d.durationMinutes) || 0),
      0
    );

    if (rep.sceneResults && rep.sceneResults.length > 0) {
      rep.sceneResults.forEach((sr) => {
        if (sr.result === 'Completed') {
          completedSet.add(sr.sceneId);
          partialSet.delete(sr.sceneId);
        } else if (sr.result === 'Partially Completed' && !completedSet.has(sr.sceneId)) {
          partialSet.add(sr.sceneId);
        }
      });
    } else {
      (rep.scenesCompletedIds || []).forEach((id) => completedSet.add(id));
    }

    if (canonicalScenes.length === 0) {
      completedEighthsFromReports += Number(rep.pagesCompletedEighths) || 0;
    }
  });

  const sceneEighthsMap = new Map<string, number>();
  let totalScriptEighths = 0;
  canonicalScenes.forEach((sc) => {
    const e = Math.max(1, Number(sc.pageLengthEighths) || 8);
    sceneEighthsMap.set(sc.id, e);
    totalScriptEighths += e;
  });

  let completedEighths = 0;
  if (canonicalScenes.length > 0) {
    completedSet.forEach((id) => {
      completedEighths += sceneEighthsMap.get(id) || 0;
    });
  } else {
    completedEighths = completedEighthsFromReports;
  }

  return {
    completedSceneIds: Array.from(completedSet),
    partialSceneIds: Array.from(partialSet),
    completedEighths,
    totalScriptEighths,
    totalSetups,
    totalLostMinutes,
    reportsCount: store.dailyReports.length,
    approvedReportsCount,
  };
}

// ============================================================================
// Production Directory (Cast, Crew, Contacts, Vendors, Locations)
// ============================================================================

export interface CreateDirectoryEntryInput {
  kind: DirectoryEntryKind;
  name: string;
  roleOrCategory: string;
  secondaryRoles?: string[];
  department?: string;
  email?: string;
  phone?: string;
  company?: string;
  services?: string;
  address?: string;
  nearestHospital?: string;
  parkingNotes?: string;
  notes?: string;
  status?: DirectoryEntryRecord['status'];
}

export function createDirectoryEntry(
  project: FilmProject,
  input: CreateDirectoryEntryInput
): { updatedProject: FilmProject; entry: DirectoryEntryRecord } {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Directory entry name is required.');
  }
  const cleanSecondary = (input.secondaryRoles || [])
    .map((r) => r.trim())
    .filter(Boolean);

  const now = new Date().toISOString();
  const entry: DirectoryEntryRecord = {
    id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productionId: project.id,
    kind: input.kind,
    name: cleanName,
    roleOrCategory: input.roleOrCategory.trim() || input.kind,
    secondaryRoles: cleanSecondary.length > 0 ? cleanSecondary : undefined,
    department: input.department?.trim() || undefined,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    company: input.company?.trim() || undefined,
    services: input.services?.trim() || undefined,
    address: input.address?.trim() || undefined,
    nearestHospital: input.nearestHospital?.trim() || undefined,
    parkingNotes: input.parkingNotes?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: input.status || 'Confirmed',
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    directoryEntries: [...cur.directoryEntries, entry],
  }));

  return { updatedProject, entry };
}

export function updateDirectoryEntry(
  project: FilmProject,
  entryId: string,
  updates: Partial<Omit<DirectoryEntryRecord, 'id' | 'productionId' | 'createdAt'>>
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    directoryEntries: cur.directoryEntries.map((entry) =>
      entry.id === entryId && entry.productionId === project.id
        ? { ...entry, ...updates, updatedAt: now }
        : entry
    ),
  }));
}

export function toggleArchiveDirectoryEntry(
  project: FilmProject,
  entryId: string,
  archived?: boolean
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    directoryEntries: cur.directoryEntries.map((entry) =>
      entry.id === entryId && entry.productionId === project.id
        ? {
            ...entry,
            archived: archived !== undefined ? archived : !entry.archived,
            updatedAt: now,
          }
        : entry
    ),
  }));
}

export function deleteDirectoryEntry(
  project: FilmProject,
  entryId: string
): FilmProject {
  const now = new Date().toISOString();
  return updateProductionOperationalStore(project, (cur) => ({
    ...cur,
    directoryEntries: cur.directoryEntries.filter(
      (e) => !(e.id === entryId && e.productionId === project.id)
    ),
    shootingDays: cur.shootingDays.map((d) =>
      d.locationId === entryId ? { ...d, locationId: undefined, updatedAt: now } : d
    ),
    events: (cur.events || []).map((ev) =>
      ev.locationId === entryId ? { ...ev, locationId: undefined, updatedAt: now } : ev
    ),
    callSheets: cur.callSheets.map((cs) => ({
      ...cs,
      locationId: cs.locationId === entryId ? undefined : cs.locationId,
      directoryEntryIds: cs.directoryEntryIds.filter((id) => id !== entryId),
      updatedAt: now,
    })),
  }));
}

/**
 * Projects legacy phase.crew members into non-duplicating read-only crew entries alongside stored Directory entries.
 */
export function resolvePhaseCrewEntries(project: FilmProject): Array<
  CrewMember & { phaseId: string; phaseName: string }
> {
  return (project.phases || []).flatMap((ph) =>
    (ph.crew || []).map((member) => ({
      ...member,
      phaseId: ph.id,
      phaseName: ph.name,
    }))
  );
}
