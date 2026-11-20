import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignJustify,
  Check,
  CheckCircle2,
  Clapperboard,
  Clock,
  Download,
  Eye,
  FileText,
  MapPin,
  MessageSquare,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { FilmProject, ParsedScene } from '../../../types';
import type { DiscussionRecordTarget } from '../../../services/contracts/types';
import type {
  CallSheetCastCallRow,
  CallSheetDepartmentInstruction,
  CallSheetKeyContact,
  CallSheetRecord,
  CallSheetSceneTimingOverride,
  DailyProductionReportRecord,
  DirectoryEntryRecord,
  DprAttendanceRow,
  DprDelayCategory,
  DprDelayRow,
  DprSceneOutcome,
  DprSceneResultRow,
  ProductionWorkspaceStore,
  ShootingDayRecord,
} from '../types';
import {
  assignSceneToShootingDay,
  createShootingDay,
  deleteShootingDay,
  getCanonicalProductionScenes,
  getCumulativeDprProgress,
  resolvePhaseCrewEntries,
  syncShootingDaysFromScreenplay,
  unassignSceneFromShootingDay,
  updateShootingDay,
  upsertCallSheetForDay,
  upsertDailyReport,
} from '../services/productionStoreService';
import {
  buildCallSheetPdfBytes,
  buildDprPdfBytes,
  type CallSheetCrewRow,
  type CallSheetPdfData,
  type DprPdfData,
  triggerProductionPdfDownload,
} from '../services/productionPdfService';
import { CallSheetDocument } from './CallSheetDocument';
import { DprDocument } from './DprDocument';

interface ProductionShootViewProps {
  project: FilmProject;
  productionStore: ProductionWorkspaceStore;
  simulatedDate: string;
  canEdit: boolean;
  initialDayId?: string | null;
  onUpdateProject?: (updated: FilmProject) => void;
  onOpenDirectory?: () => void;
  onOpenStripboard?: () => void;
  onOpenDiscussion?: (target: DiscussionRecordTarget) => void;
}

interface ResolvedRosterPerson {
  id: string;
  name: string;
  kindLabel: string;
  kind: 'cast' | 'crew' | 'contact';
  rolesDisplay: string;
  department?: string;
  phone?: string;
  email?: string;
  status?: string;
  archived?: boolean;
}

interface CallSheetDraft {
  locationId: string;
  generalCallTime: string;
  firstShotTime: string;
  estimatedWrapTime: string;
  sunriseTime: string;
  sunsetTime: string;
  weatherSummary: string;
  safetyNotes: string;
  parkingNotes: string;
  basecampAddress: string;
  hospitalOverride: string;
  emergencyContact: string;
  mealInfo: string;
  productionNotes: string;
  advanceNextDay: string;
  keyContacts: CallSheetKeyContact[];
  castCalls: CallSheetCastCallRow[];
  departmentInstructions: CallSheetDepartmentInstruction[];
  sceneTimingOverrides: Record<string, CallSheetSceneTimingOverride>;
  directoryEntryIds: string[];
  callTimeOverrides: Record<string, string>;
  published: boolean;
}

interface DprDraft {
  directorName: string;
  locationSummary: string;
  preparedBy: string;
  approvedBy: string;
  generalCall: string;
  firstShotTime: string;
  mealOutTime: string;
  mealInTime: string;
  plannedPostMealFirstShot: string;
  actualPostMealFirstShot: string;
  cameraWrapTime: string;
  wrapTime: string;
  sceneResults: DprSceneResultRow[];
  setupsCompleted: number;
  attendanceLog: DprAttendanceRow[];
  delayEntries: DprDelayRow[];
  equipmentIssues: string;
  delaysNotes: string;
  status: 'Draft' | 'Submitted' | 'Approved';
}

function buildInitialCallSheetDraft(
  day: ShootingDayRecord,
  cs: CallSheetRecord | null,
  project: FilmProject
): CallSheetDraft {
  const defaultContacts: CallSheetKeyContact[] = cs?.keyContacts
    ? cs.keyContacts
    : [
        ...(project.director ? [{ role: 'Director', name: project.director }] : []),
        ...(project.producer ? [{ role: 'Producer', name: project.producer }] : []),
      ];

  return {
    locationId: cs?.locationId ?? day.locationId ?? '',
    generalCallTime: cs?.generalCallTime || day.callTime || '06:30',
    firstShotTime: cs?.firstShotTime || '07:30',
    estimatedWrapTime: cs?.estimatedWrapTime || day.wrapTime || '18:30',
    sunriseTime: cs?.sunriseTime || '',
    sunsetTime: cs?.sunsetTime || '',
    weatherSummary: cs?.weatherSummary || '',
    safetyNotes: cs?.safetyNotes || '',
    parkingNotes: cs?.parkingNotes || '',
    basecampAddress: cs?.basecampAddress || '',
    hospitalOverride: cs?.hospitalOverride || '',
    emergencyContact: cs?.emergencyContact || '',
    mealInfo: cs?.mealInfo || '12:30 – 13:30 Unit Lunch',
    productionNotes: cs?.productionNotes || '',
    advanceNextDay: cs?.advanceNextDay || '',
    keyContacts: defaultContacts,
    castCalls: cs?.castCalls ? [...cs.castCalls] : [],
    departmentInstructions: cs?.departmentInstructions ? [...cs.departmentInstructions] : [],
    sceneTimingOverrides: cs?.sceneTimingOverrides ? { ...cs.sceneTimingOverrides } : {},
    directoryEntryIds: cs?.directoryEntryIds ? [...cs.directoryEntryIds] : [],
    callTimeOverrides: cs?.callTimeOverrides ? { ...cs.callTimeOverrides } : {},
    published: Boolean(cs?.published),
  };
}

function buildInitialDprDraft(
  day: ShootingDayRecord,
  dpr: DailyProductionReportRecord | null,
  cs: CallSheetRecord | null,
  project: FilmProject,
  dayScenes: ParsedScene[],
  locationName?: string
): DprDraft {
  const existingMap = new Map<string, DprSceneResultRow>();
  (dpr?.sceneResults || []).forEach((r) => existingMap.set(r.sceneId, r));
  const legacyCompleted = new Set(dpr?.scenesCompletedIds || []);

  const sceneResults: DprSceneResultRow[] = dayScenes.map((sc) => {
    const saved = existingMap.get(sc.id);
    if (saved) return saved;
    const planned = Math.max(1, Number(sc.pageLengthEighths) || 8);
    const done = legacyCompleted.has(sc.id);
    return {
      sceneId: sc.id,
      sceneNumber: sc.sceneNumber,
      slugline: sc.slugline,
      result: done ? 'Completed' : 'Not Shot',
      plannedEighths: planned,
      completedEighths: done ? planned : 0,
      notes: '',
    };
  });

  return {
    directorName: dpr?.directorName || project.director || '',
    locationSummary: dpr?.locationSummary || locationName || '',
    preparedBy: dpr?.preparedBy || dpr?.submittedBy || project.producer || '1st AD',
    approvedBy: dpr?.approvedBy || '',
    generalCall: dpr?.generalCall || cs?.generalCallTime || day.callTime || '06:30',
    firstShotTime: dpr?.firstShotTime || cs?.firstShotTime || '07:30',
    mealOutTime: dpr?.mealOutTime || '12:30',
    mealInTime: dpr?.mealInTime || '13:30',
    plannedPostMealFirstShot: dpr?.plannedPostMealFirstShot || '14:00',
    actualPostMealFirstShot: dpr?.actualPostMealFirstShot || dpr?.plannedPostMealFirstShot || '14:00',
    cameraWrapTime: dpr?.cameraWrapTime || dpr?.wrapTime || cs?.estimatedWrapTime || day.wrapTime || '18:30',
    wrapTime: dpr?.wrapTime || cs?.estimatedWrapTime || day.wrapTime || '18:30',
    sceneResults,
    setupsCompleted: dpr?.setupsCompleted ?? 0,
    attendanceLog: dpr?.attendanceLog ? [...dpr.attendanceLog] : [],
    delayEntries: dpr?.delayEntries ? [...dpr.delayEntries] : [],
    equipmentIssues: dpr?.equipmentIssues || '',
    delaysNotes: dpr?.delaysNotes || '',
    status: dpr?.status || 'Draft',
  };
}

export const ProductionShootView: React.FC<ProductionShootViewProps> = ({
  project,
  productionStore,
  simulatedDate,
  canEdit,
  initialDayId,
  onUpdateProject,
  onOpenDirectory,
  onOpenStripboard,
  onOpenDiscussion,
}) => {
  const canonicalScenes = useMemo(
    () => getCanonicalProductionScenes(project),
    [project]
  );
  const sceneMap = useMemo(() => {
    const map = new Map<string, ParsedScene>();
    canonicalScenes.forEach((s) => map.set(s.id, s));
    return map;
  }, [canonicalScenes]);

  const directoryLocations = useMemo(
    () => productionStore.directoryEntries.filter((e) => e.kind === 'location'),
    [productionStore.directoryEntries]
  );

  const locationMap = useMemo(() => {
    const map = new Map<string, DirectoryEntryRecord>();
    directoryLocations.forEach((l) => map.set(l.id, l));
    return map;
  }, [directoryLocations]);

  const canonicalRoster: ResolvedRosterPerson[] = useMemo(() => {
    const fromDirectory: ResolvedRosterPerson[] = productionStore.directoryEntries
      .filter((e) => e.kind === 'cast' || e.kind === 'crew' || e.kind === 'contact')
      .map((e) => ({
        id: e.id,
        name: e.name,
        kindLabel: e.kind.toUpperCase(),
        kind: e.kind as 'cast' | 'crew' | 'contact',
        rolesDisplay: [e.roleOrCategory, ...(e.secondaryRoles || [])].filter(Boolean).join(' / '),
        department: e.department,
        phone: e.phone,
        email: e.email,
        status: e.status,
        archived: e.archived,
      }));

    const legacyCrew: ResolvedRosterPerson[] = resolvePhaseCrewEntries(project).map((m) => ({
      id: `phase-crew:${m.phaseId}:${m.id}`,
      name: m.name,
      kindLabel: 'CREW',
      kind: 'crew',
      rolesDisplay: m.role,
      department: m.department || m.phaseName,
      phone: m.phone !== 'n/a' ? m.phone : undefined,
      email: m.email !== 'n/a' ? m.email : undefined,
      status: m.status,
      archived: false,
    }));

    return [...fromDirectory, ...legacyCrew];
  }, [productionStore.directoryEntries, project]);

  const rosterMap = useMemo(() => {
    const map = new Map<string, ResolvedRosterPerson>();
    canonicalRoster.forEach((p) => map.set(p.id, p));
    return map;
  }, [canonicalRoster]);

  const [selectedDayId, setSelectedDayId] = useState<string>(
    () => initialDayId || productionStore.shootingDays[0]?.id || ''
  );
  const [subPanel, setSubPanel] = useState<'call-sheet' | 'dpr'>('call-sheet');
  const [confirmDeleteDayId, setConfirmDeleteDayId] = useState<string | null>(null);
  const [sceneToAssign, setSceneToAssign] = useState('');
  const [rosterPickerId, setRosterPickerId] = useState('');
  const [previewDocType, setPreviewDocType] = useState<'call-sheet' | 'dpr' | null>(null);
  const [printingDocType, setPrintingDocType] = useState<'call-sheet' | 'dpr' | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Per-day unsaved draft buffers so switching shooting days NEVER discards unsaved edits
  const [dirtyCallSheetDrafts, setDirtyCallSheetDrafts] = useState<Record<string, CallSheetDraft>>({});
  const [dirtyDprDrafts, setDirtyDprDrafts] = useState<Record<string, DprDraft>>({});

  useEffect(() => {
    if (initialDayId && productionStore.shootingDays.some((d) => d.id === initialDayId)) {
      setSelectedDayId(initialDayId);
    }
  }, [initialDayId, productionStore.shootingDays]);

  useEffect(() => {
    if (productionStore.shootingDays.length === 0) {
      if (selectedDayId !== '') setSelectedDayId('');
      return;
    }
    if (!productionStore.shootingDays.some((d) => d.id === selectedDayId)) {
      setSelectedDayId(productionStore.shootingDays[0].id);
    }
  }, [project.id, productionStore.shootingDays, selectedDayId]);

  const selectedDay: ShootingDayRecord | null = useMemo(
    () => productionStore.shootingDays.find((d) => d.id === selectedDayId) || null,
    [productionStore.shootingDays, selectedDayId]
  );

  const nextShootDay: ShootingDayRecord | null = useMemo(() => {
    if (!selectedDay) return null;
    const idx = productionStore.shootingDays.findIndex((d) => d.id === selectedDay.id);
    return idx >= 0 && idx + 1 < productionStore.shootingDays.length
      ? productionStore.shootingDays[idx + 1]
      : null;
  }, [productionStore.shootingDays, selectedDay]);

  const dayScenes: ParsedScene[] = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.sceneIds
      .map((id) => sceneMap.get(id))
      .filter((s): s is ParsedScene => Boolean(s));
  }, [selectedDay, sceneMap]);

  const activeCallSheet: CallSheetRecord | null = useMemo(() => {
    if (!selectedDay) return null;
    return (
      productionStore.callSheets.find((c) => c.shootingDayId === selectedDay.id) || null
    );
  }, [productionStore.callSheets, selectedDay]);

  const activeDpr: DailyProductionReportRecord | null = useMemo(() => {
    if (!selectedDay) return null;
    return (
      productionStore.dailyReports.find(
        (r) => r.shootingDayId === selectedDay.id || r.shootDayNumber === selectedDay.dayNumber
      ) || null
    );
  }, [productionStore.dailyReports, selectedDay]);

  const cumulativeProgress = useMemo(
    () => getCumulativeDprProgress(productionStore, canonicalScenes),
    [productionStore, canonicalScenes]
  );

  // Active Call Sheet draft: returns unsaved dirty draft for selectedDay if present, else canonical stored state
  const currentCallSheetDraft: CallSheetDraft | null = useMemo(() => {
    if (!selectedDay) return null;
    return (
      dirtyCallSheetDrafts[selectedDay.id] ||
      buildInitialCallSheetDraft(selectedDay, activeCallSheet, project)
    );
  }, [selectedDay, dirtyCallSheetDrafts, activeCallSheet, project]);

  const currentDprDraft: DprDraft | null = useMemo(() => {
    if (!selectedDay) return null;
    const storedLoc = activeCallSheet?.locationId || selectedDay.locationId;
    const locName = storedLoc ? locationMap.get(storedLoc)?.name : undefined;
    const base =
      dirtyDprDrafts[selectedDay.id] ||
      buildInitialDprDraft(selectedDay, activeDpr, activeCallSheet, project, dayScenes, locName);

    // Ensure any newly attached Stripboard scene appears in DPR sceneResults without dropping unsaved edits
    if (dirtyDprDrafts[selectedDay.id]) {
      const existingIds = new Set(base.sceneResults.map((r) => r.sceneId));
      const extras = dayScenes
        .filter((sc) => !existingIds.has(sc.id))
        .map<DprSceneResultRow>((sc) => ({
          sceneId: sc.id,
          sceneNumber: sc.sceneNumber,
          slugline: sc.slugline,
          result: 'Not Shot',
          plannedEighths: Math.max(1, Number(sc.pageLengthEighths) || 8),
          completedEighths: 0,
          notes: '',
        }));
      if (extras.length > 0) {
        return { ...base, sceneResults: [...base.sceneResults, ...extras] };
      }
    }
    return base;
  }, [
    selectedDay,
    dirtyDprDrafts,
    activeDpr,
    activeCallSheet,
    project,
    dayScenes,
    locationMap,
  ]);

  const isCallSheetDirty = Boolean(selectedDay && dirtyCallSheetDrafts[selectedDay.id]);
  const isDprDirty = Boolean(selectedDay && dirtyDprDrafts[selectedDay.id]);

  const patchCallSheetDraft = (patch: Partial<CallSheetDraft>) => {
    if (!selectedDay || !currentCallSheetDraft) return;
    setDirtyCallSheetDrafts((prev) => ({
      ...prev,
      [selectedDay.id]: { ...currentCallSheetDraft, ...patch },
    }));
  };

  const patchDprDraft = (patch: Partial<DprDraft>) => {
    if (!selectedDay || !currentDprDraft) return;
    setDirtyDprDrafts((prev) => ({
      ...prev,
      [selectedDay.id]: { ...currentDprDraft, ...patch },
    }));
  };

  const flashSaved = (msg: string) => {
    setSavedNotice(msg);
    window.setTimeout(() => setSavedNotice(null), 2000);
  };

  // Dedicated #production-print-root container management
  const printTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (printTimeoutRef.current !== null) window.clearTimeout(printTimeoutRef.current);
      if (typeof document !== 'undefined') {
        document.body.classList.remove('sceneos-printing-production-doc');
      }
    };
  }, []);

  const handlePrintDocument = (type: 'call-sheet' | 'dpr') => {
    setPrintingDocType(type);
    if (typeof document !== 'undefined') {
      document.body.classList.add('sceneos-printing-production-doc');
      const cleanup = () => {
        document.body.classList.remove('sceneos-printing-production-doc');
        setPrintingDocType(null);
      };
      window.addEventListener('afterprint', cleanup, { once: true });
      printTimeoutRef.current = window.setTimeout(() => {
        window.print();
        // Safety fallback if browser/headless skips afterprint
        window.setTimeout(cleanup, 1200);
      }, 60);
    }
  };

  // Actions
  const handleAddShootDay = () => {
    if (!canEdit || !onUpdateProject) return;
    const { updatedProject, day } = createShootingDay(project, {
      date: simulatedDate || project.startDate || new Date().toISOString().slice(0, 10),
    });
    onUpdateProject(updatedProject);
    setSelectedDayId(day.id);
  };

  const handleSyncFromScenes = () => {
    if (!canEdit || !onUpdateProject) return;
    onUpdateProject(syncShootingDaysFromScreenplay(project));
  };

  const handleAssignScene = () => {
    if (!canEdit || !onUpdateProject || !selectedDay || !sceneToAssign) return;
    onUpdateProject(assignSceneToShootingDay(project, selectedDay.id, sceneToAssign));
    setSceneToAssign('');
  };

  const handleSaveCallSheet = (bumpRevision = false) => {
    if (!canEdit || !onUpdateProject || !selectedDay || !currentCallSheetDraft) return;
    const cleanLocationId = currentCallSheetDraft.locationId || undefined;

    const { updatedProject } = upsertCallSheetForDay(project, selectedDay.id, {
      locationId: cleanLocationId,
      generalCallTime: currentCallSheetDraft.generalCallTime,
      firstShotTime: currentCallSheetDraft.firstShotTime,
      estimatedWrapTime: currentCallSheetDraft.estimatedWrapTime,
      sunriseTime: currentCallSheetDraft.sunriseTime.trim() || undefined,
      sunsetTime: currentCallSheetDraft.sunsetTime.trim() || undefined,
      weatherSummary: currentCallSheetDraft.weatherSummary.trim() || undefined,
      safetyNotes: currentCallSheetDraft.safetyNotes.trim() || undefined,
      parkingNotes: currentCallSheetDraft.parkingNotes.trim() || undefined,
      basecampAddress: currentCallSheetDraft.basecampAddress.trim() || undefined,
      hospitalOverride: currentCallSheetDraft.hospitalOverride.trim() || undefined,
      emergencyContact: currentCallSheetDraft.emergencyContact.trim() || undefined,
      mealInfo: currentCallSheetDraft.mealInfo.trim() || undefined,
      productionNotes: currentCallSheetDraft.productionNotes.trim() || undefined,
      advanceNextDay: currentCallSheetDraft.advanceNextDay.trim() || undefined,
      keyContacts: currentCallSheetDraft.keyContacts,
      castCalls: currentCallSheetDraft.castCalls,
      departmentInstructions: currentCallSheetDraft.departmentInstructions,
      sceneTimingOverrides: currentCallSheetDraft.sceneTimingOverrides,
      directoryEntryIds: currentCallSheetDraft.directoryEntryIds,
      callTimeOverrides: currentCallSheetDraft.callTimeOverrides,
      published: currentCallSheetDraft.published,
      bumpRevision,
    });

    // Fix Bug: ALWAYS sync locationId (including clearing back to undefined!) onto ShootingDayRecord
    const withDaySynced = updateShootingDay(updatedProject, selectedDay.id, {
      locationId: cleanLocationId,
      callTime: currentCallSheetDraft.generalCallTime,
      wrapTime: currentCallSheetDraft.estimatedWrapTime,
    });
    onUpdateProject(withDaySynced);

    setDirtyCallSheetDrafts((prev) => {
      const next = { ...prev };
      delete next[selectedDay.id];
      return next;
    });
    flashSaved(bumpRevision ? 'Call Sheet saved (New Revision)' : 'Call Sheet saved');
  };

  const handleSyncCastFromScenesAndDirectory = () => {
    if (!currentCallSheetDraft || !selectedDay) return;
    const charNames = new Set<string>();
    dayScenes.forEach((sc) => (sc.characters || []).forEach((ch) => charNames.add(ch)));
    const existingChars = new Set(
      currentCallSheetDraft.castCalls.map((r) => r.character.toUpperCase())
    );
    const additions: CallSheetCastCallRow[] = [];
    let castCounter = currentCallSheetDraft.castCalls.length + 1;

    // 1. Add Directory cast entries matched or selected
    canonicalRoster
      .filter((r) => !r.archived && r.kind === 'cast')
      .forEach((castPerson) => {
        const charUpper = (castPerson.rolesDisplay || castPerson.name).toUpperCase();
        if (!existingChars.has(charUpper)) {
          additions.push({
            directoryEntryId: castPerson.id,
            castNumber: String(castCounter++),
            character: castPerson.rolesDisplay || castPerson.name,
            performer: castPerson.name,
            pickupTime: '',
            makeupTime: '',
            wardrobeTime: '',
            onSetCall: currentCallSheetDraft.firstShotTime || '07:30',
            status: castPerson.status || 'Confirmed',
          });
          existingChars.add(charUpper);
        }
      });

    // 2. Add any scene character not yet listed
    charNames.forEach((charName) => {
      if (!existingChars.has(charName.toUpperCase())) {
        additions.push({
          castNumber: String(castCounter++),
          character: charName,
          performer: '',
          pickupTime: '',
          makeupTime: '',
          wardrobeTime: '',
          onSetCall: currentCallSheetDraft.firstShotTime || '07:30',
          status: 'Unassigned',
        });
        existingChars.add(charName.toUpperCase());
      }
    });

    if (additions.length > 0) {
      patchCallSheetDraft({
        castCalls: [...currentCallSheetDraft.castCalls, ...additions],
      });
    }
  };

  const handleSaveDpr = (nextStatusOverride?: 'Draft' | 'Submitted' | 'Approved') => {
    if (!canEdit || !onUpdateProject || !selectedDay || !currentDprDraft) return;
    const statusToSave = nextStatusOverride ?? currentDprDraft.status;
    const completedIds = currentDprDraft.sceneResults
      .filter((sr) => sr.result === 'Completed')
      .map((sr) => sr.sceneId);
    const plannedEighths = currentDprDraft.sceneResults.reduce(
      (sum, sr) => sum + (Number(sr.plannedEighths) || 0),
      0
    );
    const completedEighths = currentDprDraft.sceneResults.reduce(
      (sum, sr) => sum + (Number(sr.completedEighths) || 0),
      0
    );

    const updated = upsertDailyReport(project, {
      id: activeDpr?.id || `dpr-${selectedDay.id}`,
      shootingDayId: selectedDay.id,
      shootDayNumber: selectedDay.dayNumber,
      calendarDate: selectedDay.date,
      callSheetId: activeCallSheet?.id,
      directorName: currentDprDraft.directorName.trim() || undefined,
      locationSummary: currentDprDraft.locationSummary.trim() || undefined,
      preparedBy: currentDprDraft.preparedBy.trim() || '1st AD',
      approvedBy:
        statusToSave === 'Approved'
          ? currentDprDraft.approvedBy.trim() || project.producer || 'Producer'
          : currentDprDraft.approvedBy.trim() || undefined,
      generalCall: currentDprDraft.generalCall,
      firstShotTime: currentDprDraft.firstShotTime,
      mealOutTime: currentDprDraft.mealOutTime,
      mealInTime: currentDprDraft.mealInTime,
      plannedPostMealFirstShot: currentDprDraft.plannedPostMealFirstShot,
      actualPostMealFirstShot: currentDprDraft.actualPostMealFirstShot,
      cameraWrapTime: currentDprDraft.cameraWrapTime,
      wrapTime: currentDprDraft.wrapTime,
      totalScenesScheduled: selectedDay.sceneIds.length,
      totalScenesCompleted: completedIds.length,
      scenesCompletedIds: completedIds,
      sceneResults: currentDprDraft.sceneResults,
      pagesScheduledEighths: plannedEighths,
      pagesCompletedEighths: completedEighths,
      setupsCompleted: currentDprDraft.setupsCompleted,
      attendanceLog: currentDprDraft.attendanceLog,
      delayEntries: currentDprDraft.delayEntries,
      equipmentIssues: currentDprDraft.equipmentIssues.trim() || undefined,
      delaysNotes: currentDprDraft.delaysNotes.trim() || undefined,
      safetyIncidentsReported: currentDprDraft.delayEntries.length,
      submittedBy: currentDprDraft.preparedBy.trim() || project.producer || '1st AD',
      status: statusToSave,
    });

    onUpdateProject(updated);
    setDirtyDprDrafts((prev) => {
      const next = { ...prev };
      delete next[selectedDay.id];
      return next;
    });
    flashSaved(`DPR saved (${statusToSave})`);
  };

  // Assemble structured Call Sheet & DPR document payloads for Preview / Print / PDF Export
  const callSheetDocData: CallSheetPdfData | null = useMemo(() => {
    if (!selectedDay || !currentCallSheetDraft) return null;
    const loc = currentCallSheetDraft.locationId
      ? locationMap.get(currentCallSheetDraft.locationId) || null
      : null;

    const mergedCallSheet: CallSheetRecord = {
      id: activeCallSheet?.id || `cs-draft-${selectedDay.id}`,
      productionId: project.id,
      shootingDayId: selectedDay.id,
      locationId: currentCallSheetDraft.locationId || undefined,
      revisionNumber: activeCallSheet?.revisionNumber || 1,
      generalCallTime: currentCallSheetDraft.generalCallTime,
      firstShotTime: currentCallSheetDraft.firstShotTime,
      estimatedWrapTime: currentCallSheetDraft.estimatedWrapTime,
      sunriseTime: currentCallSheetDraft.sunriseTime || undefined,
      sunsetTime: currentCallSheetDraft.sunsetTime || undefined,
      weatherSummary: currentCallSheetDraft.weatherSummary || undefined,
      safetyNotes: currentCallSheetDraft.safetyNotes || undefined,
      parkingNotes: currentCallSheetDraft.parkingNotes || undefined,
      basecampAddress: currentCallSheetDraft.basecampAddress || undefined,
      hospitalOverride: currentCallSheetDraft.hospitalOverride || undefined,
      emergencyContact: currentCallSheetDraft.emergencyContact || undefined,
      mealInfo: currentCallSheetDraft.mealInfo || undefined,
      productionNotes: currentCallSheetDraft.productionNotes || undefined,
      advanceNextDay: currentCallSheetDraft.advanceNextDay || undefined,
      keyContacts: currentCallSheetDraft.keyContacts,
      castCalls: currentCallSheetDraft.castCalls,
      departmentInstructions: currentCallSheetDraft.departmentInstructions,
      sceneTimingOverrides: currentCallSheetDraft.sceneTimingOverrides,
      directoryEntryIds: currentCallSheetDraft.directoryEntryIds,
      callTimeOverrides: currentCallSheetDraft.callTimeOverrides,
      published: currentCallSheetDraft.published,
      publishedAt: activeCallSheet?.publishedAt,
      createdAt: activeCallSheet?.createdAt || selectedDay.createdAt,
      updatedAt: activeCallSheet?.updatedAt || selectedDay.updatedAt,
    };

    const crewRows: CallSheetCrewRow[] = currentCallSheetDraft.directoryEntryIds
      .map((entryId) => {
        const person = rosterMap.get(entryId);
        if (!person) return null;
        return {
          department: person.department || person.kindLabel,
          role: person.rolesDisplay || person.kindLabel,
          name: person.name,
          phone: person.phone || person.email || '—',
          callTime:
            currentCallSheetDraft.callTimeOverrides[entryId] ||
            currentCallSheetDraft.generalCallTime,
        };
      })
      .filter((r): r is CallSheetCrewRow => Boolean(r));

    return {
      project,
      day: selectedDay,
      callSheet: mergedCallSheet,
      location: loc,
      scenes: dayScenes,
      crewRows,
      totalShootDays: productionStore.shootingDays.length,
      nextShootDay,
    };
  }, [
    selectedDay,
    currentCallSheetDraft,
    activeCallSheet,
    project,
    locationMap,
    rosterMap,
    dayScenes,
    productionStore.shootingDays.length,
    nextShootDay,
  ]);

  const dprDocData: DprPdfData | null = useMemo(() => {
    if (!selectedDay || !currentDprDraft) return null;
    const loc =
      (currentCallSheetDraft?.locationId && locationMap.get(currentCallSheetDraft.locationId)) ||
      (selectedDay.locationId && locationMap.get(selectedDay.locationId)) ||
      null;
    const completedIds = currentDprDraft.sceneResults
      .filter((r) => r.result === 'Completed')
      .map((r) => r.sceneId);
    const plannedEighths = currentDprDraft.sceneResults.reduce(
      (s, r) => s + (Number(r.plannedEighths) || 0),
      0
    );
    const completedEighths = currentDprDraft.sceneResults.reduce(
      (s, r) => s + (Number(r.completedEighths) || 0),
      0
    );

    const mergedDpr: DailyProductionReportRecord = {
      id: activeDpr?.id || `dpr-${selectedDay.id}`,
      productionId: project.id,
      shootingDayId: selectedDay.id,
      shootDayNumber: selectedDay.dayNumber,
      calendarDate: selectedDay.date,
      callSheetId: activeCallSheet?.id,
      directorName: currentDprDraft.directorName,
      locationSummary: currentDprDraft.locationSummary,
      preparedBy: currentDprDraft.preparedBy,
      approvedBy: currentDprDraft.approvedBy,
      generalCall: currentDprDraft.generalCall,
      firstShotTime: currentDprDraft.firstShotTime,
      mealOutTime: currentDprDraft.mealOutTime,
      mealInTime: currentDprDraft.mealInTime,
      plannedPostMealFirstShot: currentDprDraft.plannedPostMealFirstShot,
      actualPostMealFirstShot: currentDprDraft.actualPostMealFirstShot,
      cameraWrapTime: currentDprDraft.cameraWrapTime,
      wrapTime: currentDprDraft.wrapTime,
      totalScenesScheduled: selectedDay.sceneIds.length,
      totalScenesCompleted: completedIds.length,
      scenesCompletedIds: completedIds,
      sceneResults: currentDprDraft.sceneResults,
      pagesScheduledEighths: plannedEighths,
      pagesCompletedEighths: completedEighths,
      setupsCompleted: currentDprDraft.setupsCompleted,
      attendanceLog: currentDprDraft.attendanceLog,
      delayEntries: currentDprDraft.delayEntries,
      equipmentIssues: currentDprDraft.equipmentIssues,
      delaysNotes: currentDprDraft.delaysNotes,
      safetyIncidentsReported: currentDprDraft.delayEntries.length,
      submittedBy: currentDprDraft.preparedBy || '1st AD',
      status: currentDprDraft.status,
      updatedAt: activeDpr?.updatedAt || new Date().toISOString(),
    };

    return {
      project,
      day: selectedDay,
      dpr: mergedDpr,
      callSheet: callSheetDocData?.callSheet || activeCallSheet,
      location: loc,
      cumulative: cumulativeProgress,
      totalShootDays: productionStore.shootingDays.length,
    };
  }, [
    selectedDay,
    currentDprDraft,
    currentCallSheetDraft,
    activeDpr,
    activeCallSheet,
    project,
    locationMap,
    callSheetDocData,
    cumulativeProgress,
    productionStore.shootingDays.length,
  ]);

  const linkedLocation =
    currentCallSheetDraft?.locationId && locationMap.get(currentCallSheetDraft.locationId)
      ? locationMap.get(currentCallSheetDraft.locationId)!
      : null;

  const availableScenesToAssign = selectedDay
    ? canonicalScenes.filter((sc) => !selectedDay.sceneIds.includes(sc.id))
    : [];
  const availableRosterOptions = canonicalRoster.filter(
    (p) => !p.archived && !(currentCallSheetDraft?.directoryEntryIds || []).includes(p.id)
  );

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div id="production-shoot-section" className="flex-1 min-h-0 flex overflow-hidden">
      {/* Left Rail: Shooting Days */}
      <aside className="w-64 md:w-72 shrink-0 border-r border-[#E63950]/15 bg-[#1A1017]/95 border-r border-[#E63950]/20 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-[#E63950]/15 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Shooting Days
              </div>
              <div className="text-[11px] text-slate-500">
                {productionStore.shootingDays.length} scheduled
              </div>
            </div>
            {canEdit && (
              <button
                type="button"
                data-testid="add-shoot-day-btn"
                onClick={handleAddShootDay}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white hover:from-[#FF5368] hover:to-[#FF1744] shadow-[0_0_10px_rgba(255,23,68,0.35)] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Day
              </button>
            )}
          </div>

          {canEdit && canonicalScenes.length > 0 && (
            <button
              type="button"
              data-testid="sync-scenes-shoot-days-btn"
              onClick={handleSyncFromScenes}
              className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#26151F] border border-[#E63950]/30 text-rose-100 hover:border-white/25 text-[11px] text-slate-300 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Sync Breakdown Stripboard
            </button>
          )}

          {onOpenStripboard && (
            <button
              type="button"
              data-testid="shoot-open-stripboard-btn"
              onClick={onOpenStripboard}
              className="w-full px-2.5 py-1 rounded-lg border border-[#E63950]/15 bg-white/[0.02] hover:bg-white/[0.06] text-[10.5px] font-mono text-slate-400 hover:text-[#FF8A9B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <AlignJustify className="w-3 h-3" />
              Open Breakdown Stripboard →
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {productionStore.shootingDays.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No shooting days yet. Add a day or sync scenes from Breakdown Stripboard.
            </div>
          ) : (
            productionStore.shootingDays.map((day) => {
              const active = day.id === selectedDayId;
              const cs = productionStore.callSheets.find((c) => c.shootingDayId === day.id);
              const dpr = productionStore.dailyReports.find(
                (r) => r.shootingDayId === day.id || r.shootDayNumber === day.dayNumber
              );
              const hasDirty = Boolean(dirtyCallSheetDrafts[day.id] || dirtyDprDrafts[day.id]);
              return (
                <button
                  key={day.id}
                  type="button"
                  data-shoot-day-id={day.id}
                  onClick={() => {
                    setSelectedDayId(day.id);
                    setConfirmDeleteDayId(null);
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2 border transition cursor-pointer flex items-center justify-between gap-2 ${
                    active
                      ? 'border-[#FF1744]/60 bg-gradient-to-r from-[#65152D]/80 to-[#26151F] text-white shadow-[0_0_12px_rgba(255,23,68,0.25)]'
                      : 'border-transparent hover:bg-white/[0.03] text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold">
                        Day {day.dayNumber}
                      </span>
                      {cs && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                            cs.published
                              ? 'bg-emerald-950/60 border-emerald-400/25 text-emerald-200'
                              : 'bg-white/5 border-white/15 text-slate-300'
                          }`}
                        >
                          CS {cs.published ? `R${cs.revisionNumber || 1}` : 'Draft'}
                        </span>
                      )}
                      {dpr && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-400/25 text-[9px] font-mono text-cyan-200">
                          {dpr.status}
                        </span>
                      )}
                      {hasDirty && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved draft preserved" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {day.date} · {day.callTime}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {day.sceneIds.length} sc
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Workspace */}
      <section className="flex-1 min-w-0 min-h-0 overflow-y-auto p-5 md:p-6">
        {!selectedDay || !currentCallSheetDraft || !currentDprDraft ? (
          <div
            id="production-shoot-empty-state"
            className="h-full min-h-[320px] flex items-center justify-center"
          >
            <div className="max-w-md w-full rounded-2xl border border-dashed border-white/15 bg-[#1A1017]/85 border border-dashed border-[#E63950]/30 p-8 text-center space-y-4">
              <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-[#26151F] border border-[#E63950]/30 flex items-center justify-center">
                <Clapperboard className="w-5 h-5 text-[#FF8A9B]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-rose-100">
                  No shooting days scheduled
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Create a shooting day or sync Stripboard scenes to build formal Call Sheets and Daily Production Reports.
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddShootDay}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)] text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Shoot Day
                  </button>
                  {canonicalScenes.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncFromScenes}
                      className="px-3.5 py-2 rounded-lg border border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-slate-200 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Schedule {canonicalScenes.length} Scenes
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-5 pb-12">
            {/* SELECTED SHOOTING DAY OVERVIEW CARD */}
            <div
              data-testid="shoot-day-overview"
              className="rounded-2xl border border-[#E63950]/20 bg-[#1A1017]/85 border border-[#E63950]/20 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#FF1744] to-[#E63950] text-white font-mono text-xs font-bold shadow-[0_0_8px_rgba(255,23,68,0.3)]">
                    DAY {selectedDay.dayNumber}
                  </span>
                  <input
                    type="date"
                    value={selectedDay.date}
                    disabled={!canEdit}
                    onChange={(e) =>
                      onUpdateProject?.(
                        updateShootingDay(project, selectedDay.id, { date: e.target.value })
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-xs font-mono text-rose-100"
                  />
                  <select
                    value={selectedDay.status}
                    disabled={!canEdit}
                    data-testid="shoot-day-status-select"
                    onChange={(e) =>
                      onUpdateProject?.(
                        updateShootingDay(project, selectedDay.id, {
                          status: e.target.value as ShootingDayRecord['status'],
                        })
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-xs text-slate-200"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed</option>
                  </select>
                  {onOpenDiscussion && (
                    <button
                      type="button"
                      data-testid="discuss-shooting-day-btn"
                      onClick={() =>
                        onOpenDiscussion({
                          entityType: 'shooting_day',
                          entityId: selectedDay.id,
                          entityLabel: `Day ${selectedDay.dayNumber} · ${selectedDay.date}`,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg border border-cyan-500/30 bg-cyan-950/35 text-xs text-cyan-200 hover:bg-cyan-950/60 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Discuss Day
                    </button>
                  )}
                </div>

                {/* Call Sheet / DPR Destination Tabs + Saved Notice */}
                <div className="flex flex-wrap items-center gap-2">
                  {savedNotice && (
                    <span className="text-[11px] font-mono text-emerald-300 inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {savedNotice}
                    </span>
                  )}

                  <div className="inline-flex rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 p-0.5">
                    <button
                      type="button"
                      data-testid="shoot-tab-call-sheet"
                      onClick={() => setSubPanel('call-sheet')}
                      className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
                        subPanel === 'call-sheet'
                          ? 'bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Call Sheet (Planned)
                    </button>
                    <button
                      type="button"
                      data-testid="shoot-tab-dpr"
                      onClick={() => setSubPanel('dpr')}
                      className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
                        subPanel === 'dpr'
                          ? 'bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      DPR (Actual)
                    </button>
                  </div>

                  {canEdit &&
                    (confirmDeleteDayId === selectedDay.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateProject?.(deleteShootingDay(project, selectedDay.id));
                            setConfirmDeleteDayId(null);
                          }}
                          className="px-2 py-1 rounded bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200 cursor-pointer"
                        >
                          Delete Day
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDayId(null)}
                          className="px-2 py-1 text-xs text-slate-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteDayId(selectedDay.id)}
                        title="Delete shooting day"
                        className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ))}
                </div>
              </div>

              {/* Overview Status Bar: Location, Timings, Call Sheet Status, DPR Status & Day Notes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px] pt-2 border-t border-[#E63950]/15">
                <div>
                  <span className="font-mono text-[9.5px] uppercase text-slate-500 block">
                    Directory Location
                  </span>
                  <span className="text-slate-200 truncate block">
                    {(selectedDay.locationId && locationMap.get(selectedDay.locationId)?.name) ||
                      'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[9.5px] uppercase text-slate-500 block">
                    Timings
                  </span>
                  <span className="font-mono text-slate-200">
                    {selectedDay.callTime} → {selectedDay.wrapTime}
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[9.5px] uppercase text-slate-500 block">
                    Call Sheet Status
                  </span>
                  <span className="font-mono text-emerald-200">
                    {activeCallSheet
                      ? `${activeCallSheet.published ? 'Published' : 'Draft'} (Rev ${
                          activeCallSheet.revisionNumber || 1
                        })`
                      : 'Not Created'}
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[9.5px] uppercase text-slate-500 block">
                    DPR Status
                  </span>
                  <span className="font-mono text-cyan-200">
                    {activeDpr ? activeDpr.status : 'Not Started'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="text"
                  value={selectedDay.notes || ''}
                  disabled={!canEdit}
                  data-testid="shoot-day-notes-input"
                  onChange={(e) =>
                    onUpdateProject?.(
                      updateShootingDay(project, selectedDay.id, { notes: e.target.value })
                    )
                  }
                  placeholder="Day-specific unit note (persisted immediately)..."
                  className="flex-1 min-w-[200px] px-2.5 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-xs text-slate-200"
                />
              </div>
            </div>

            {/* Canonical Scenes Scheduled for Day (Stripboard Source of Truth) */}
            <div className="rounded-xl border border-[#E63950]/15 bg-[#26151F]/70 border border-[#E63950]/20 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Scenes Scheduled ({selectedDay.sceneIds.length}) · Breakdown Stripboard
                </div>
                {canEdit && availableScenesToAssign.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={sceneToAssign}
                      data-testid="shoot-assign-scene-select"
                      onChange={(e) => setSceneToAssign(e.target.value)}
                      className="px-2 py-1 rounded bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-slate-200 max-w-[220px]"
                    >
                      <option value="">Attach Stripboard Scene...</option>
                      {availableScenesToAssign.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          SC {sc.sceneNumber} · {sc.slugline}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      data-testid="shoot-assign-scene-btn"
                      disabled={!sceneToAssign}
                      onClick={handleAssignScene}
                      className="px-2.5 py-1 rounded bg-[#26151F] border border-[#E63950]/35 hover:border-[#FF1744]/60 disabled:opacity-40 text-[11px] text-rose-100 cursor-pointer"
                    >
                      Add Scene
                    </button>
                  </div>
                )}
              </div>

              {selectedDay.sceneIds.length === 0 ? (
                <div className="text-xs text-slate-500">
                  No scenes linked to Day {selectedDay.dayNumber} yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedDay.sceneIds.map((id) => {
                    const sc = sceneMap.get(id);
                    if (!sc) return null;
                    return (
                      <span
                        key={id}
                        className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-xs text-rose-100 font-mono inline-flex items-center gap-2"
                      >
                        <span>
                          SC {sc.sceneNumber} · {sc.slugline} (
                          {sc.pageLengthDisplay || `${sc.pageLengthEighths}/8`} pg)
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateProject?.(
                                unassignSceneFromShootingDay(project, selectedDay.id, id)
                              )
                            }
                            className="text-slate-400 hover:text-rose-300 cursor-pointer"
                            title="Remove scene from Day"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* =============================================================== */}
            {/* SUB-PANEL A: CALL SHEET (PLANNED INFORMATION)                   */}
            {/* =============================================================== */}
            {subPanel === 'call-sheet' ? (
              <div
                data-testid="call-sheet-form"
                className="rounded-2xl border border-[#E63950]/20 bg-[#1A1017]/85 border border-[#E63950]/20 p-5 space-y-5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E63950]/15 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-rose-100 flex items-center gap-2 flex-wrap">
                      <FileText className="w-4 h-4 text-[#FF8A9B]" />
                      Day {selectedDay.dayNumber} Call Sheet · Rev{' '}
                      {activeCallSheet?.revisionNumber || 1}
                      {activeCallSheet?.published && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-400/30 text-[10px] font-mono text-emerald-200">
                          PUBLISHED
                        </span>
                      )}
                      {isCallSheetDirty && (
                        <span
                          data-testid="cs-unsaved-draft-badge"
                          className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-400/35 text-[10px] font-mono text-amber-200"
                        >
                          UNSAVED DRAFT PRESERVED
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Authoritative Stripboard schedule & Directory data with non-destructive day overrides.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenDiscussion && activeCallSheet && (
                      <button
                        type="button"
                        data-testid="discuss-call-sheet-btn"
                        onClick={() =>
                          onOpenDiscussion({
                            entityType: 'call_sheet',
                            entityId: activeCallSheet.id,
                            entityLabel: `Call Sheet · Day ${selectedDay.dayNumber}`,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/35 text-xs text-cyan-200 hover:bg-cyan-950/60 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Discuss
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="cs-preview-btn"
                      onClick={() => setPreviewDocType('call-sheet')}
                      className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      data-testid="cs-print-btn"
                      onClick={() => handlePrintDocument('call-sheet')}
                      className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print
                    </button>
                    <button
                      type="button"
                      data-testid="cs-export-pdf-btn"
                      onClick={() => {
                        if (!callSheetDocData) return;
                        const bytes = buildCallSheetPdfBytes(callSheetDocData);
                        triggerProductionPdfDownload(
                          bytes,
                          `${project.title.replace(/\s+/g, '_')}_CallSheet_Day${selectedDay.dayNumber}.pdf`
                        );
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-950/30 text-xs text-cyan-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export PDF
                    </button>
                    {canEdit && (
                      <>
                        {isCallSheetDirty && (
                          <button
                            type="button"
                            onClick={() =>
                              setDirtyCallSheetDrafts((prev) => {
                                const next = { ...prev };
                                delete next[selectedDay.id];
                                return next;
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 cursor-pointer"
                          >
                            Discard
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid="save-call-sheet-btn"
                          onClick={() => handleSaveCallSheet(false)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)] text-xs cursor-pointer"
                        >
                          Save Call Sheet
                        </button>
                        {activeCallSheet && (
                          <button
                            type="button"
                            data-testid="cs-bump-revision-btn"
                            onClick={() => handleSaveCallSheet(true)}
                            className="px-2.5 py-1.5 rounded-lg border border-amber-400/30 bg-amber-950/30 text-amber-200 text-xs font-mono cursor-pointer"
                          >
                            + New Rev
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Timings & Weather */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Crew Call
                    </label>
                    <input
                      type="text"
                      value={currentCallSheetDraft.generalCallTime}
                      disabled={!canEdit}
                      data-testid="cs-input-calltime"
                      onChange={(e) => patchCallSheetDraft({ generalCallTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Shooting Call
                    </label>
                    <input
                      type="text"
                      value={currentCallSheetDraft.firstShotTime}
                      disabled={!canEdit}
                      onChange={(e) => patchCallSheetDraft({ firstShotTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Est. Wrap
                    </label>
                    <input
                      type="text"
                      value={currentCallSheetDraft.estimatedWrapTime}
                      disabled={!canEdit}
                      onChange={(e) => patchCallSheetDraft({ estimatedWrapTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Sunrise
                    </label>
                    <input
                      type="text"
                      value={currentCallSheetDraft.sunriseTime}
                      disabled={!canEdit}
                      placeholder="Optional"
                      onChange={(e) => patchCallSheetDraft({ sunriseTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Sunset
                    </label>
                    <input
                      type="text"
                      value={currentCallSheetDraft.sunsetTime}
                      disabled={!canEdit}
                      placeholder="Optional"
                      onChange={(e) => patchCallSheetDraft({ sunsetTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-rose-100"
                    />
                  </div>
                </div>

                {/* Directory Location + Medical/Emergency/Basecamp */}
                <div className="space-y-3 border-t border-[#E63950]/15 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      Set Location (Directory FK) & Medical / Basecamp
                    </label>
                    {onOpenDirectory && (
                      <button
                        type="button"
                        onClick={onOpenDirectory}
                        className="text-[11px] text-[#FF8A9B] hover:underline cursor-pointer"
                      >
                        Manage Locations in Directory →
                      </button>
                    )}
                  </div>

                  <select
                    value={currentCallSheetDraft.locationId}
                    disabled={!canEdit}
                    data-testid="cs-select-location"
                    onChange={(e) => patchCallSheetDraft({ locationId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-slate-200"
                  >
                    <option value="">No Location Assigned</option>
                    {directoryLocations
                      .filter(
                        (loc) => !loc.archived || loc.id === currentCallSheetDraft.locationId
                      )
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                          {loc.address ? ` — ${loc.address}` : ''}
                        </option>
                      ))}
                  </select>

                  {linkedLocation && (
                    <div className="rounded-lg border border-[#E63950]/20 bg-[#10090D] border border-[#E63950]/20 p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Address</span>
                        <span className="text-slate-200">{linkedLocation.address || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Directory Hospital</span>
                        <span className="text-slate-200">
                          {linkedLocation.nearestHospital || 'Unverified / Not specified'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Access & Parking</span>
                        <span className="text-slate-200">
                          {linkedLocation.parkingNotes || 'See Basecamp'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Site Contact</span>
                        <span className="text-slate-200">
                          {linkedLocation.phone || linkedLocation.email || 'Not specified'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Basecamp Address Override
                      </label>
                      <input
                        type="text"
                        value={currentCallSheetDraft.basecampAddress}
                        disabled={!canEdit}
                        onChange={(e) => patchCallSheetDraft({ basecampAddress: e.target.value })}
                        placeholder="Basecamp lot / staging"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Parking Override
                      </label>
                      <input
                        type="text"
                        value={currentCallSheetDraft.parkingNotes}
                        disabled={!canEdit}
                        onChange={(e) => patchCallSheetDraft({ parkingNotes: e.target.value })}
                        placeholder="Tech trucks & crew parking"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Hospital Override
                      </label>
                      <input
                        type="text"
                        value={currentCallSheetDraft.hospitalOverride}
                        disabled={!canEdit}
                        onChange={(e) => patchCallSheetDraft({ hospitalOverride: e.target.value })}
                        placeholder="Only if different from Directory"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Emergency Contact
                      </label>
                      <input
                        type="text"
                        value={currentCallSheetDraft.emergencyContact}
                        disabled={!canEdit}
                        onChange={(e) => patchCallSheetDraft({ emergencyContact: e.target.value })}
                        placeholder="Unit Medic / Safety Lead"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Cast Call Table (Synced from Scene Characters / Directory with Day Overrides) */}
                <div className="space-y-2 border-t border-[#E63950]/15 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                      Cast Calls ({currentCallSheetDraft.castCalls.length})
                    </span>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="cs-sync-cast-btn"
                          onClick={handleSyncCastFromScenesAndDirectory}
                          className="px-2.5 py-1 rounded-lg border border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-[11px] text-[#FF8A9B] cursor-pointer"
                        >
                          Sync Cast from Scenes & Directory
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            patchCallSheetDraft({
                              castCalls: [
                                ...currentCallSheetDraft.castCalls,
                                {
                                  castNumber: String(currentCallSheetDraft.castCalls.length + 1),
                                  character: '',
                                  performer: '',
                                  pickupTime: '',
                                  makeupTime: '',
                                  wardrobeTime: '',
                                  onSetCall: currentCallSheetDraft.firstShotTime || '07:30',
                                  status: 'Confirmed',
                                },
                              ],
                            })
                          }
                          className="px-2 py-1 rounded-lg border border-white/10 text-[11px] text-slate-300 cursor-pointer"
                        >
                          + Cast Row
                        </button>
                      </div>
                    )}
                  </div>

                  {currentCallSheetDraft.castCalls.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-[#E63950]/20">
                      <table className="w-full text-[11px]">
                        <thead className="bg-[#10090D] border border-[#E63950]/20 font-mono text-[9.5px] uppercase text-slate-400">
                          <tr>
                            <th className="px-2 py-1.5 text-left w-12">ID</th>
                            <th className="px-2 py-1.5 text-left">Character</th>
                            <th className="px-2 py-1.5 text-left">Performer</th>
                            <th className="px-2 py-1.5 text-left w-20">Pickup</th>
                            <th className="px-2 py-1.5 text-left w-20">H/MU</th>
                            <th className="px-2 py-1.5 text-left w-20">Wardrobe</th>
                            <th className="px-2 py-1.5 text-left w-20">On Set</th>
                            <th className="px-2 py-1.5 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06] bg-[#10090D] border border-[#E63950]/25">
                          {currentCallSheetDraft.castCalls.map((row, idx) => (
                            <tr key={idx}>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.castNumber}
                                  disabled={!canEdit}
                                  onChange={(e) => {
                                    const next = [...currentCallSheetDraft.castCalls];
                                    next[idx] = { ...row, castNumber: e.target.value };
                                    patchCallSheetDraft({ castCalls: next });
                                  }}
                                  className="w-full px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                                />
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.character}
                                  disabled={!canEdit}
                                  onChange={(e) => {
                                    const next = [...currentCallSheetDraft.castCalls];
                                    next[idx] = { ...row, character: e.target.value };
                                    patchCallSheetDraft({ castCalls: next });
                                  }}
                                  className="w-full px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 text-rose-100"
                                />
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.performer}
                                  disabled={!canEdit}
                                  onChange={(e) => {
                                    const next = [...currentCallSheetDraft.castCalls];
                                    next[idx] = { ...row, performer: e.target.value };
                                    patchCallSheetDraft({ castCalls: next });
                                  }}
                                  className="w-full px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 text-slate-200"
                                />
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.pickupTime || ''}
                                  disabled={!canEdit}
                                  placeholder="--:--"
                                  onChange={(e) => {
                                    const next = [...currentCallSheetDraft.castCalls];
                                    next[idx] = { ...row, pickupTime: e.target.value };
                                    patchCallSheetDraft({ castCalls: next });
                                  }}
                                  className="w-full px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-slate-200"
                                />
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.makeupTime || ''}
                                  disabled={!canEdit}
                                  placeholder="--:--"
                                  onChange={(e) => {
                                    const next = [...currentCallSheetDraft.castCalls];
                                    next[idx] = { ...row, makeupTime: e.target.value };
                                    patchCallSheetDraft({ castCalls: next });
                                  }}
                                  className="w-full px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-slate-200"
                                />
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.wardrobeTime || ''}
                                  disabled={!canEdit}
                                  placeholder="--:--"
                                  onChange={(e) => {
                                    const next = [...currentCallSheetDraft.castCalls];
                                    next[idx] = { ...row, wardrobeTime: e.target.value };
                                    patchCallSheetDraft({ castCalls: next });
                                  }}
                                  className="w-full px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-slate-200"
                                />
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.onSetCall}
                                  disabled={!canEdit}
                                  onChange={(e) => {
                                    const next = [...currentCallSheetDraft.castCalls];
                                    next[idx] = { ...row, onSetCall: e.target.value };
                                    patchCallSheetDraft({ castCalls: next });
                                  }}
                                  className="w-full px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                                />
                              </td>
                              <td className="p-1 text-center">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchCallSheetDraft({
                                        castCalls: currentCallSheetDraft.castCalls.filter(
                                          (_, i) => i !== idx
                                        ),
                                      })
                                    }
                                    className="text-slate-500 hover:text-rose-300 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Crew & Contacts Roster Linked to Directory */}
                <div className="space-y-2.5 border-t border-[#E63950]/15 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Called Crew & Roster ({currentCallSheetDraft.directoryEntryIds.length})
                    </label>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <select
                          value={rosterPickerId}
                          data-testid="cs-roster-picker"
                          onChange={(e) => {
                            const pid = e.target.value;
                            if (!pid) return;
                            if (!currentCallSheetDraft.directoryEntryIds.includes(pid)) {
                              patchCallSheetDraft({
                                directoryEntryIds: [...currentCallSheetDraft.directoryEntryIds, pid],
                              });
                            }
                            setRosterPickerId('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-slate-200 max-w-[260px]"
                        >
                          <option value="">+ Call person from Directory...</option>
                          {availableRosterOptions.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name} ({person.rolesDisplay})
                            </option>
                          ))}
                        </select>
                        {onOpenDirectory && canonicalRoster.length === 0 && (
                          <button
                            type="button"
                            onClick={onOpenDirectory}
                            className="px-2.5 py-1 rounded-lg border border-white/10 text-[11px] text-[#FF8A9B] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" />
                            Directory
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {currentCallSheetDraft.directoryEntryIds.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 bg-[#10090D] border border-[#E63950]/20/60 p-3 text-[11px] text-slate-500">
                      No personnel called yet. Add crew/contacts directly from your Production Directory.
                    </div>
                  ) : (
                    <div
                      data-testid="cs-called-roster-list"
                      className="rounded-xl border border-[#E63950]/20 overflow-hidden divide-y divide-white/[0.06]"
                    >
                      {currentCallSheetDraft.directoryEntryIds.map((entryId) => {
                        const person = rosterMap.get(entryId);
                        if (!person) return null;
                        const callOverride =
                          currentCallSheetDraft.callTimeOverrides[entryId] ??
                          currentCallSheetDraft.generalCallTime;
                        return (
                          <div
                            key={entryId}
                            data-cs-roster-person={person.name}
                            className="px-3 py-2 bg-[#10090D] border border-[#E63950]/20 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-white/[0.07] font-mono text-[9px] text-[#FF8A9B]">
                                  {person.department || person.kindLabel}
                                </span>
                                <span className="font-semibold text-rose-100 truncate">
                                  {person.name}
                                </span>
                                <span className="text-slate-400 truncate">{person.rolesDisplay}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <label className="text-[10px] font-mono text-slate-400">Call:</label>
                              <input
                                type="text"
                                value={callOverride}
                                disabled={!canEdit}
                                onChange={(e) =>
                                  patchCallSheetDraft({
                                    callTimeOverrides: {
                                      ...currentCallSheetDraft.callTimeOverrides,
                                      [entryId]: e.target.value,
                                    },
                                  })
                                }
                                className="w-16 px-2 py-0.5 rounded bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-[11px] text-rose-100"
                              />
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextOverrides = {
                                      ...currentCallSheetDraft.callTimeOverrides,
                                    };
                                    delete nextOverrides[entryId];
                                    patchCallSheetDraft({
                                      directoryEntryIds:
                                        currentCallSheetDraft.directoryEntryIds.filter(
                                          (id) => id !== entryId
                                        ),
                                      callTimeOverrides: nextOverrides,
                                    });
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-300 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Weather, Meals, Safety, Production Notes & Next-Day Advance */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-[#E63950]/15 pt-4">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Weather Summary
                    </label>
                    <input
                      type="text"
                      value={currentCallSheetDraft.weatherSummary}
                      disabled={!canEdit}
                      placeholder="Clear, 18°C, 6kt NW"
                      onChange={(e) => patchCallSheetDraft({ weatherSummary: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Meals & Catering Schedule
                    </label>
                    <input
                      type="text"
                      value={currentCallSheetDraft.mealInfo}
                      disabled={!canEdit}
                      onChange={(e) => patchCallSheetDraft({ mealInfo: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Safety Notes
                    </label>
                    <input
                      type="text"
                      value={currentCallSheetDraft.safetyNotes}
                      disabled={!canEdit}
                      placeholder="Harness / waterfront protocols..."
                      onChange={(e) => patchCallSheetDraft({ safetyNotes: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Production & Department Notes
                    </label>
                    <textarea
                      rows={2}
                      value={currentCallSheetDraft.productionNotes}
                      disabled={!canEdit}
                      onChange={(e) => patchCallSheetDraft({ productionNotes: e.target.value })}
                      placeholder="Department call instructions, stunt/rigging reminders..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Advance Schedule (Next Day)
                    </label>
                    <textarea
                      rows={2}
                      value={currentCallSheetDraft.advanceNextDay}
                      disabled={!canEdit}
                      onChange={(e) => patchCallSheetDraft({ advanceNextDay: e.target.value })}
                      placeholder={
                        nextShootDay
                          ? `Day ${nextShootDay.dayNumber} (${nextShootDay.date}) — ${nextShootDay.sceneIds.length} scenes`
                          : 'Next shooting day advance details...'
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100 resize-none"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={currentCallSheetDraft.published}
                    disabled={!canEdit}
                    onChange={(e) => patchCallSheetDraft({ published: e.target.checked })}
                    className="rounded border-white/20"
                  />
                  Mark Call Sheet as Published (Day {selectedDay.dayNumber} · Rev{' '}
                  {activeCallSheet?.revisionNumber || 1})
                </label>
              </div>
            ) : (
              /* =============================================================== */
              /* SUB-PANEL B: DPR (ACTUAL END-OF-DAY PRODUCTION REPORT)          */
              /* =============================================================== */
              <div
                data-testid="dpr-form"
                className="rounded-2xl border border-[#E63950]/20 bg-[#1A1017]/85 border border-[#E63950]/20 p-5 space-y-5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E63950]/15 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-rose-100 flex items-center gap-2 flex-wrap">
                      <CheckCircle2 className="w-4 h-4 text-[#FF8A9B]" />
                      Day {selectedDay.dayNumber} Daily Production Report (DPR)
                      <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-400/30 text-[10px] font-mono text-cyan-200">
                        {currentDprDraft.status.toUpperCase()}
                      </span>
                      {isDprDirty && (
                        <span
                          data-testid="dpr-unsaved-draft-badge"
                          className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-400/35 text-[10px] font-mono text-amber-200"
                        >
                          UNSAVED DRAFT PRESERVED
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Compares planned Call Sheet / Stripboard expectations with actual shooting outcomes without mutating planned records.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenDiscussion && activeDpr && (
                      <button
                        type="button"
                        data-testid="discuss-dpr-btn"
                        onClick={() =>
                          onOpenDiscussion({
                            entityType: 'dpr',
                            entityId: activeDpr.id,
                            entityLabel: `DPR · Day ${selectedDay.dayNumber}`,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/35 text-xs text-cyan-200 hover:bg-cyan-950/60 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Discuss
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="dpr-preview-btn"
                      onClick={() => setPreviewDocType('dpr')}
                      className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      data-testid="dpr-print-btn"
                      onClick={() => handlePrintDocument('dpr')}
                      className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print
                    </button>
                    <button
                      type="button"
                      data-testid="dpr-export-pdf-btn"
                      onClick={() => {
                        if (!dprDocData) return;
                        const bytes = buildDprPdfBytes(dprDocData);
                        triggerProductionPdfDownload(
                          bytes,
                          `${project.title.replace(/\s+/g, '_')}_DPR_Day${selectedDay.dayNumber}.pdf`
                        );
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-950/30 text-xs text-cyan-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export PDF
                    </button>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          data-testid="save-dpr-btn"
                          onClick={() => handleSaveDpr()}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)] text-xs cursor-pointer"
                        >
                          Save DPR
                        </button>
                        {currentDprDraft.status === 'Draft' && (
                          <button
                            type="button"
                            data-testid="dpr-submit-btn"
                            onClick={() => {
                              patchDprDraft({ status: 'Submitted' });
                              handleSaveDpr('Submitted');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            Submit
                          </button>
                        )}
                        {currentDprDraft.status !== 'Approved' && (
                          <button
                            type="button"
                            data-testid="dpr-approve-btn"
                            onClick={() => {
                              patchDprDraft({ status: 'Approved' });
                              handleSaveDpr('Approved');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            Approve
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Production Header Info & Cumulative Progress */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Director
                    </label>
                    <input
                      type="text"
                      value={currentDprDraft.directorName}
                      disabled={!canEdit}
                      onChange={(e) => patchDprDraft({ directorName: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Location Summary
                    </label>
                    <input
                      type="text"
                      value={currentDprDraft.locationSummary}
                      disabled={!canEdit}
                      onChange={(e) => patchDprDraft({ locationSummary: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Prepared By
                    </label>
                    <input
                      type="text"
                      value={currentDprDraft.preparedBy}
                      disabled={!canEdit}
                      onChange={(e) => patchDprDraft({ preparedBy: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Report State
                    </label>
                    <select
                      value={currentDprDraft.status}
                      disabled={!canEdit}
                      data-testid="dpr-input-status"
                      onChange={(e) =>
                        patchDprDraft({
                          status: e.target.value as 'Draft' | 'Submitted' | 'Approved',
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>
                </div>

                {/* Planned vs Actual Schedule Comparison Table */}
                <div className="space-y-2 border-t border-[#E63950]/15 pt-4">
                  <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Planned vs. Actual Schedule Timings
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-[#E63950]/20">
                    <table className="w-full text-xs">
                      <thead className="bg-[#10090D] border border-[#E63950]/20 font-mono text-[9.5px] uppercase text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">Milestone</th>
                          <th className="px-3 py-2 text-left">Planned (Call Sheet / Day)</th>
                          <th className="px-3 py-2 text-left">Actual Recorded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06] bg-[#10090D] border border-[#E63950]/25">
                        <tr>
                          <td className="px-3 py-2 font-medium text-slate-200">General Crew Call</td>
                          <td className="px-3 py-2 font-mono text-slate-400">
                            {activeCallSheet?.generalCallTime || selectedDay.callTime}
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={currentDprDraft.generalCall}
                              disabled={!canEdit}
                              onChange={(e) => patchDprDraft({ generalCall: e.target.value })}
                              className="w-28 px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-slate-200">First Shot (AM)</td>
                          <td className="px-3 py-2 font-mono text-slate-400">
                            {activeCallSheet?.firstShotTime || '07:30'}
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={currentDprDraft.firstShotTime}
                              disabled={!canEdit}
                              onChange={(e) => patchDprDraft({ firstShotTime: e.target.value })}
                              className="w-28 px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-slate-200">Meal Out / Meal In</td>
                          <td className="px-3 py-2 font-mono text-slate-400">
                            {activeCallSheet?.mealInfo || 'Standard Meal'}
                          </td>
                          <td className="px-3 py-1.5 flex items-center gap-2">
                            <input
                              type="text"
                              value={currentDprDraft.mealOutTime}
                              disabled={!canEdit}
                              onChange={(e) => patchDprDraft({ mealOutTime: e.target.value })}
                              className="w-20 px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                            <span className="text-slate-500">→</span>
                            <input
                              type="text"
                              value={currentDprDraft.mealInTime}
                              disabled={!canEdit}
                              onChange={(e) => patchDprDraft({ mealInTime: e.target.value })}
                              className="w-20 px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-slate-200">Post-Meal First Shot</td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={currentDprDraft.plannedPostMealFirstShot}
                              disabled={!canEdit}
                              onChange={(e) =>
                                patchDprDraft({ plannedPostMealFirstShot: e.target.value })
                              }
                              className="w-24 px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-slate-300"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={currentDprDraft.actualPostMealFirstShot}
                              disabled={!canEdit}
                              onChange={(e) =>
                                patchDprDraft({ actualPostMealFirstShot: e.target.value })
                              }
                              className="w-28 px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-slate-200">Camera Wrap / Crew Wrap</td>
                          <td className="px-3 py-2 font-mono text-slate-400">
                            {activeCallSheet?.estimatedWrapTime || selectedDay.wrapTime}
                          </td>
                          <td className="px-3 py-1.5 flex items-center gap-2">
                            <input
                              type="text"
                              value={currentDprDraft.cameraWrapTime}
                              disabled={!canEdit}
                              title="Camera wrap"
                              onChange={(e) => patchDprDraft({ cameraWrapTime: e.target.value })}
                              className="w-20 px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                            <span className="text-slate-500">/</span>
                            <input
                              type="text"
                              value={currentDprDraft.wrapTime}
                              disabled={!canEdit}
                              title="Final crew wrap"
                              onChange={(e) => patchDprDraft({ wrapTime: e.target.value })}
                              className="w-20 px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Scene-by-Scene Shooting Outcome Table */}
                <div className="space-y-2 border-t border-[#E63950]/15 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                      Scene-by-Scene Results ({currentDprDraft.sceneResults.length}) · Cumul. Progress:{' '}
                      {cumulativeProgress.completedEighths}/{cumulativeProgress.totalScriptEighths} eighths
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-mono text-slate-400">Setups:</label>
                      <input
                        type="number"
                        min={0}
                        value={currentDprDraft.setupsCompleted}
                        disabled={!canEdit}
                        data-testid="dpr-input-setups"
                        onChange={(e) =>
                          patchDprDraft({ setupsCompleted: Number(e.target.value) || 0 })
                        }
                        className="w-16 px-2 py-1 rounded bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-rose-100"
                      />
                    </div>
                  </div>

                  {currentDprDraft.sceneResults.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No scheduled Stripboard scenes attached to Day {selectedDay.dayNumber}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#E63950]/20">
                      <table className="w-full text-[11px]">
                        <thead className="bg-[#10090D] border border-[#E63950]/20 font-mono text-[9.5px] uppercase text-slate-400">
                          <tr>
                            <th className="px-2.5 py-1.5 text-left w-16">Scene</th>
                            <th className="px-2.5 py-1.5 text-left">Slugline</th>
                            <th className="px-2.5 py-1.5 text-left w-40">Result</th>
                            <th className="px-2.5 py-1.5 text-left w-24">Shot Eighths</th>
                            <th className="px-2.5 py-1.5 text-left">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06] bg-[#10090D] border border-[#E63950]/25">
                          {currentDprDraft.sceneResults.map((sr, idx) => (
                            <tr key={sr.sceneId}>
                              <td className="px-2.5 py-1.5 font-mono font-bold text-rose-100">
                                SC {sr.sceneNumber}
                              </td>
                              <td className="px-2.5 py-1.5 text-slate-300 truncate max-w-[200px]">
                                {sr.slugline}
                              </td>
                              <td className="px-2.5 py-1.5">
                                <select
                                  value={sr.result}
                                  disabled={!canEdit}
                                  data-testid={`dpr-scene-result-${sr.sceneNumber}`}
                                  onChange={(e) => {
                                    const nextRes = e.target.value as DprSceneOutcome;
                                    const nextRows = [...currentDprDraft.sceneResults];
                                    nextRows[idx] = {
                                      ...sr,
                                      result: nextRes,
                                      completedEighths:
                                        nextRes === 'Completed'
                                          ? sr.plannedEighths
                                          : nextRes === 'Not Shot'
                                          ? 0
                                          : Math.max(1, Math.floor(sr.plannedEighths / 2)),
                                    };
                                    patchDprDraft({ sceneResults: nextRows });
                                  }}
                                  className="w-full px-2 py-1 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 text-rose-100"
                                >
                                  <option value="Completed">Completed</option>
                                  <option value="Partially Completed">Partially Completed</option>
                                  <option value="Not Shot">Not Shot</option>
                                </select>
                              </td>
                              <td className="px-2.5 py-1.5">
                                <div className="flex items-center gap-1 font-mono">
                                  <input
                                    type="number"
                                    min={0}
                                    max={sr.plannedEighths}
                                    value={sr.completedEighths}
                                    disabled={!canEdit}
                                    onChange={(e) => {
                                      const nextRows = [...currentDprDraft.sceneResults];
                                      nextRows[idx] = {
                                        ...sr,
                                        completedEighths: Number(e.target.value) || 0,
                                      };
                                      patchDprDraft({ sceneResults: nextRows });
                                    }}
                                    className="w-12 px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 text-rose-100"
                                  />
                                  <span className="text-slate-500">/{sr.plannedEighths}</span>
                                </div>
                              </td>
                              <td className="px-2.5 py-1.5">
                                <input
                                  type="text"
                                  value={sr.notes || ''}
                                  disabled={!canEdit}
                                  placeholder="Reshoot/pickup note..."
                                  onChange={(e) => {
                                    const nextRows = [...currentDprDraft.sceneResults];
                                    nextRows[idx] = { ...sr, notes: e.target.value };
                                    patchDprDraft({ sceneResults: nextRows });
                                  }}
                                  className="w-full px-2 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 text-slate-200"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Cast & Crew Attendance Log */}
                <div className="space-y-2 border-t border-[#E63950]/15 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                      Cast & Crew Attendance ({currentDprDraft.attendanceLog.length})
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        data-testid="dpr-import-roster-btn"
                        onClick={() => {
                          const existingNames = new Set(
                            currentDprDraft.attendanceLog.map((a) => a.name.toLowerCase())
                          );
                          const imported: DprAttendanceRow[] = [];
                          currentCallSheetDraft.directoryEntryIds.forEach((eid) => {
                            const p = rosterMap.get(eid);
                            if (p && !existingNames.has(p.name.toLowerCase())) {
                              imported.push({
                                directoryEntryId: eid,
                                name: p.name,
                                departmentOrRole: p.department || p.rolesDisplay,
                                category: p.kind === 'cast' ? 'Cast' : 'Crew',
                                status: 'Present',
                                actualCallTime:
                                  currentCallSheetDraft.callTimeOverrides[eid] ||
                                  currentDprDraft.generalCall,
                                actualWrapTime: currentDprDraft.wrapTime,
                              });
                              existingNames.add(p.name.toLowerCase());
                            }
                          });
                          currentCallSheetDraft.castCalls.forEach((c) => {
                            const nm = c.performer || c.character;
                            if (nm && !existingNames.has(nm.toLowerCase())) {
                              imported.push({
                                name: nm,
                                departmentOrRole: c.character,
                                category: 'Cast',
                                status: 'Present',
                                actualCallTime: c.onSetCall || currentDprDraft.firstShotTime,
                                actualWrapTime: currentDprDraft.cameraWrapTime,
                              });
                              existingNames.add(nm.toLowerCase());
                            }
                          });
                          if (imported.length > 0) {
                            patchDprDraft({
                              attendanceLog: [...currentDprDraft.attendanceLog, ...imported],
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-[11px] text-[#FF8A9B] cursor-pointer"
                      >
                        Import Call Sheet Roster
                      </button>
                    )}
                  </div>

                  {currentDprDraft.attendanceLog.length > 0 && (
                    <div className="space-y-1.5">
                      {currentDprDraft.attendanceLog.map((row, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-white/[0.07] bg-[#10090D] border border-[#E63950]/25 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-rose-100">{row.name}</span>{' '}
                            <span className="text-slate-400">
                              ({row.category} · {row.departmentOrRole})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={row.status}
                              disabled={!canEdit}
                              onChange={(e) => {
                                const next = [...currentDprDraft.attendanceLog];
                                next[idx] = {
                                  ...row,
                                  status: e.target.value as DprAttendanceRow['status'],
                                };
                                patchDprDraft({ attendanceLog: next });
                              }}
                              className="px-2 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 text-slate-200"
                            >
                              <option value="Present">Present</option>
                              <option value="Late">Late</option>
                              <option value="Absent">Absent</option>
                              <option value="Wrapped Early">Wrapped Early</option>
                            </select>
                            <input
                              type="text"
                              value={row.actualCallTime || ''}
                              disabled={!canEdit}
                              placeholder="In"
                              onChange={(e) => {
                                const next = [...currentDprDraft.attendanceLog];
                                next[idx] = { ...row, actualCallTime: e.target.value };
                                patchDprDraft({ attendanceLog: next });
                              }}
                              className="w-16 px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                            <input
                              type="text"
                              value={row.actualWrapTime || ''}
                              disabled={!canEdit}
                              placeholder="Wrap"
                              onChange={(e) => {
                                const next = [...currentDprDraft.attendanceLog];
                                next[idx] = { ...row, actualWrapTime: e.target.value };
                                patchDprDraft({ actualWrapTime: e.target.value });
                              }}
                              className="w-16 px-1.5 py-0.5 rounded bg-[#1A1017]/85 border border-[#E63950]/20 border border-white/10 font-mono text-rose-100"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Itemized Delays & Lost Time + Issues/Notes */}
                <div className="space-y-2 border-t border-[#E63950]/15 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                      Delays & Lost Time (
                      {currentDprDraft.delayEntries.reduce((s, d) => s + d.durationMinutes, 0)} min)
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        data-testid="dpr-add-delay-btn"
                        onClick={() => {
                          const row: DprDelayRow = {
                            id: `dl-${Date.now()}`,
                            category: 'Technical',
                            durationMinutes: 15,
                            description: '',
                          };
                          patchDprDraft({
                            delayEntries: [...currentDprDraft.delayEntries, row],
                          });
                        }}
                        className="px-2 py-1 rounded-lg border border-white/10 text-[11px] text-slate-300 cursor-pointer"
                      >
                        + Add Delay
                      </button>
                    )}
                  </div>

                  {currentDprDraft.delayEntries.map((dl, idx) => (
                    <div key={dl.id} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={dl.category}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = [...currentDprDraft.delayEntries];
                          next[idx] = { ...dl, category: e.target.value as DprDelayCategory };
                          patchDprDraft({ delayEntries: next });
                        }}
                        className="col-span-3 px-2 py-1 rounded bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-slate-200"
                      >
                        {['Weather', 'Technical', 'Equipment', 'Talent', 'Location', 'Other'].map(
                          (cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          )
                        )}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={dl.durationMinutes}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = [...currentDprDraft.delayEntries];
                          next[idx] = { ...dl, durationMinutes: Number(e.target.value) || 0 };
                          patchDprDraft({ delayEntries: next });
                        }}
                        className="col-span-2 px-2 py-1 rounded bg-[#10090D] border border-[#E63950]/25 border border-white/10 font-mono text-rose-100"
                      />
                      <input
                        type="text"
                        value={dl.description}
                        disabled={!canEdit}
                        placeholder="Cause & impact..."
                        onChange={(e) => {
                          const next = [...currentDprDraft.delayEntries];
                          next[idx] = { ...dl, description: e.target.value };
                          patchDprDraft({ delayEntries: next });
                        }}
                        className="col-span-6 px-2 py-1 rounded bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                      />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            patchDprDraft({
                              delayEntries: currentDprDraft.delayEntries.filter(
                                (_, i) => i !== idx
                              ),
                            })
                          }
                          className="col-span-1 text-slate-500 hover:text-rose-300 cursor-pointer flex justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Equipment / Technical Issues
                      </label>
                      <textarea
                        rows={2}
                        value={currentDprDraft.equipmentIssues}
                        disabled={!canEdit}
                        onChange={(e) => patchDprDraft({ equipmentIssues: e.target.value })}
                        placeholder="Camera/sound/lighting issues or expendable requests..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Production Updates & Daily Notes
                      </label>
                      <textarea
                        rows={2}
                        value={currentDprDraft.delaysNotes}
                        disabled={!canEdit}
                        data-testid="dpr-input-notes"
                        onChange={(e) => patchDprDraft({ delaysNotes: e.target.value })}
                        placeholder="End-of-day unit remarks..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* FULL PAPERWORK PREVIEW MODAL (Call Sheet or DPR)                    */}
      {/* =================================================================== */}
      {previewDocType &&
        ((previewDocType === 'call-sheet' && callSheetDocData) ||
          (previewDocType === 'dpr' && dprDocData)) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="production-document-preview-modal"
            onClick={() => setPreviewDocType(null)}
            className="prod-doc-no-print fixed inset-0 z-[200] bg-black/85 flex flex-col overflow-hidden"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-5 py-3 bg-[#1A1017] border-b border-[#E63950]/25 flex flex-wrap items-center justify-between gap-3 shrink-0"
            >
              <span className="font-mono text-xs text-rose-100 font-semibold">
                {previewDocType === 'call-sheet'
                  ? `Call Sheet Document Preview — Day ${selectedDay?.dayNumber}`
                  : `Daily Production Report Preview — Day ${selectedDay?.dayNumber}`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="preview-print-btn"
                  onClick={() => handlePrintDocument(previewDocType)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Document
                </button>
                <button
                  type="button"
                  data-testid="preview-export-pdf-btn"
                  onClick={() => {
                    if (previewDocType === 'call-sheet' && callSheetDocData) {
                      triggerProductionPdfDownload(
                        buildCallSheetPdfBytes(callSheetDocData),
                        `${project.title.replace(/\s+/g, '_')}_CallSheet_Day${selectedDay?.dayNumber}.pdf`
                      );
                    } else if (previewDocType === 'dpr' && dprDocData) {
                      triggerProductionPdfDownload(
                        buildDprPdfBytes(dprDocData),
                        `${project.title.replace(/\s+/g, '_')}_DPR_Day${selectedDay?.dayNumber}.pdf`
                      );
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)] text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
                <button
                  type="button"
                  data-testid="close-doc-preview-btn"
                  onClick={() => setPreviewDocType(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              onClick={(e) => e.stopPropagation()}
              className="flex-1 overflow-y-auto p-6 bg-slate-800/70"
            >
              {previewDocType === 'call-sheet' && callSheetDocData && (
                <CallSheetDocument data={callSheetDocData} />
              )}
              {previewDocType === 'dpr' && dprDocData && <DprDocument data={dprDocData} />}
            </div>
          </div>,
          document.body
        )}

      {/* =================================================================== */}
      {/* HIDDEN DEDICATED PRINT ROOT (#production-print-root)                */}
      {/* Printed cleanly in @media print without dark app chrome/screenshots */}
      {/* =================================================================== */}
      {printingDocType &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id="production-print-root" className="hidden print:block bg-white text-slate-900">
            {printingDocType === 'call-sheet' && callSheetDocData && (
              <CallSheetDocument data={callSheetDocData} />
            )}
            {printingDocType === 'dpr' && dprDocData && <DprDocument data={dprDocData} />}
          </div>,
          document.body
        )}
    </div>
  );
};
