import type { DailyProductionReport } from '../../types';

export type ProductionSectionId = 'calendar' | 'shoot' | 'directory';

export type ShootingDayStatus = 'scheduled' | 'in-progress' | 'completed' | 'delayed';

export type DayOperationalStatus = 'Planned' | 'In Progress' | 'Completed' | 'Delayed';

export interface DailyCalendarLogRecord {
  date: string; // YYYY-MM-DD
  productionId: string;
  status: DayOperationalStatus;
  notes?: string;
  progressUpdate?: string;
  reminders?: string;
  updatedAt: string;
}

export interface ShootingDayRecord {
  id: string;
  productionId: string;
  dayNumber: number;
  date: string; // YYYY-MM-DD
  callTime: string; // e.g. '06:30'
  wrapTime: string; // e.g. '18:30'
  /** Optional FK referencing DirectoryEntryRecord (kind === 'location') without duplicating address */
  locationId?: string;
  /** Canonical ParsedScene.id list scheduled for this day (aligned with Stripboard) */
  sceneIds: string[];
  notes?: string;
  status: ShootingDayStatus;
  createdAt: string;
  updatedAt: string;
}

export type ProductionEventCategory =
  | 'milestone'
  | 'rehearsal'
  | 'tech-scout'
  | 'fitting'
  | 'delivery'
  | 'meeting'
  | 'general';

export interface ProductionEventRecord {
  id: string;
  productionId: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // Optional YYYY-MM-DD for multi-day milestones/windows
  time?: string; // e.g. '10:00'
  category: ProductionEventCategory;
  /** Optional FK referencing DirectoryEntryRecord (kind === 'location') */
  locationId?: string;
  notes?: string;
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CallSheetKeyContact {
  role: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface CallSheetCastCallRow {
  directoryEntryId?: string;
  castNumber: string;
  character: string;
  performer: string;
  pickupTime?: string;
  makeupTime?: string;
  wardrobeTime?: string;
  onSetCall: string;
  status?: string;
}

export interface CallSheetDepartmentInstruction {
  department: string;
  instruction: string;
}

export interface CallSheetSceneTimingOverride {
  startTime?: string;
  notes?: string;
  castIds?: string[];
}

export interface CallSheetRecord {
  id: string;
  productionId: string;
  /** Authoritative FK referencing ShootingDayRecord.id */
  shootingDayId: string;
  /** Authoritative FK referencing DirectoryEntryRecord (location) */
  locationId?: string;
  revisionNumber?: number;
  generalCallTime: string;
  firstShotTime: string;
  estimatedWrapTime: string;
  sunriseTime?: string;
  sunsetTime?: string;
  weatherSummary?: string;
  safetyNotes?: string;
  parkingNotes?: string;
  basecampAddress?: string;
  hospitalOverride?: string;
  emergencyContact?: string;
  mealInfo?: string;
  productionNotes?: string;
  advanceNextDay?: string;
  keyContacts?: CallSheetKeyContact[];
  castCalls?: CallSheetCastCallRow[];
  departmentInstructions?: CallSheetDepartmentInstruction[];
  sceneTimingOverrides?: Record<string, CallSheetSceneTimingOverride>;
  /** DirectoryEntryRecord IDs or legacy crew composite IDs included on call */
  directoryEntryIds: string[];
  /** Optional per-entry call time overrides keyed by directory/crew ID */
  callTimeOverrides?: Record<string, string>;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type DprSceneOutcome = 'Completed' | 'Partially Completed' | 'Not Shot';

export interface DprSceneResultRow {
  sceneId: string;
  sceneNumber: string;
  slugline: string;
  result: DprSceneOutcome;
  plannedEighths: number;
  completedEighths: number;
  notes?: string;
}

export interface DprAttendanceRow {
  directoryEntryId?: string;
  name: string;
  departmentOrRole: string;
  category: 'Cast' | 'Crew';
  status: 'Present' | 'Late' | 'Absent' | 'Wrapped Early';
  actualCallTime?: string;
  actualWrapTime?: string;
  notes?: string;
}

export type DprDelayCategory =
  | 'Weather'
  | 'Technical'
  | 'Equipment'
  | 'Talent'
  | 'Location'
  | 'Other';

export interface DprDelayRow {
  id: string;
  category: DprDelayCategory;
  durationMinutes: number;
  description: string;
}

export interface DailyProductionReportRecord extends DailyProductionReport {
  productionId: string;
  shootingDayId?: string;
  /** Canonical ParsedScene.id list completed on this shooting day */
  scenesCompletedIds?: string[];
  directorName?: string;
  locationSummary?: string;
  plannedPostMealFirstShot?: string;
  actualPostMealFirstShot?: string;
  cameraWrapTime?: string;
  sceneResults?: DprSceneResultRow[];
  attendanceLog?: DprAttendanceRow[];
  delayEntries?: DprDelayRow[];
  equipmentIssues?: string;
  preparedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  updatedAt: string;
}

export type DirectoryEntryKind =
  | 'cast'
  | 'crew'
  | 'contact'
  | 'vendor'
  | 'location';

export interface DirectoryEntryRecord {
  id: string;
  productionId: string;
  kind: DirectoryEntryKind;
  name: string;
  roleOrCategory: string;
  /** Additional roles held by the same person without creating duplicate Directory records */
  secondaryRoles?: string[];
  department?: string;
  email?: string;
  phone?: string;
  company?: string;
  /** Vendor services summary (when kind === 'vendor') */
  services?: string;
  /** Location-specific fields (when kind === 'location') */
  address?: string;
  nearestHospital?: string;
  parkingNotes?: string;
  notes?: string;
  status?: 'Confirmed' | 'Negotiating' | 'Hold' | 'Active';
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionWorkspaceStore {
  schemaVersion: 1;
  productionId: string;
  shootingDays: ShootingDayRecord[];
  events: ProductionEventRecord[];
  dailyLogs?: DailyCalendarLogRecord[];
  callSheets: CallSheetRecord[];
  dailyReports: DailyProductionReportRecord[];
  directoryEntries: DirectoryEntryRecord[];
  updatedAt: string;
}
