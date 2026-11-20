/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'Confirmed' | 'Negotiating' | 'Hold';
  department?: string;
}

export interface SubTask {
  id: string;
  name: string;
  completed: boolean;
}

export interface Activity {
  id: string;
  name: string;
  completed: boolean;
  estimatedDays: number;
  startDate?: string;
  endDate?: string;
  assignedTo?: string;
  notes?: string;
  subTasks?: SubTask[];
  priority?: 'high' | 'medium' | 'low';
  isThresholdTask?: boolean;
  minDaysThreshold?: number;
  canBePostponed?: boolean;
  isPostponed?: boolean;
  callSheetDate?: string;
}

export interface FilmPhase {
  id: string;
  name: string;
  category?: 'pre' | 'prod' | 'post'; // Structural three main modules
  color: string; // Tailwind bg color class
  textLightColor: string; // Tailwind bright text color class
  textDarkColor: string; // Tailwind muted/dark text color class
  durationDays: number;
  startDate: string; // YYYY-MM-DD (computed)
  endDate: string; // YYYY-MM-DD (computed)
  activities: Activity[];
  crew: CrewMember[];
  status: 'pending' | 'active' | 'completed' | 'overdue';
  importance?: 'critical' | 'high' | 'medium' | 'low';
}

export interface ProjectConstraints {
  budgetLimit: number;
  dailyBurnRateCap: number;
  screenplayLocked: boolean;
  castAvailabilityDays: number;
  permitLeadTimeDays: number;
  targetRating: 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17' | 'U' | 'UA' | 'A' | 'S';
  weatherContingencyBuffer: number;
  postOverheadRatio: number; // Percentage e.g. 15%
  // Extensive Real-World Hollywood Union & Safety Rules Constraints
  turnaroundHours?: number; // SAG-AFTRA daily rest turnaround (typically 12 hours)
  weekendTurnaroundHours?: number; // IATSE weekend rest turnaround (typically 54 or 56 hours)
  maxWorkdayHours?: number; // Maximum workday length before hazard overtime/penalties (typically 12 or 14 hours)
  mealIntervalHours?: number; // Mandatory meal interval (typically 6 hours)
  medicRequiredOnSet?: boolean; // Set medic presence mandate
  stuntCoordinatorRequired?: boolean; // Stunt safety coordinator mandate
  completionBondContingencyPercent?: number; // Cash reserve safety buffer (typically 10%)
  selectedGuild?: string; // Selected federation/guild (e.g., 'FWICE', 'FEFSI', 'TFIEF', 'FEFKA', 'KFWF', 'none')
}

export interface FootageBackup {
  id: string;
  name: string; // e.g. "Day 1 Shoot"
  date: string; // YYYY-MM-DD
  storageLocation: string; // e.g. "AWS Glacier Deep Archive", "Local RAID-10 SSD on set"
  fileCount: number;
  totalSizeGB: number;
  hashMD5: string; // MD5 integrity checksum
  status: 'Verified' | 'Uploading' | 'Failed';
  notes?: string;
  fileType?: 'Video' | 'Audio' | 'DCP';
  formatName?: 'Scope' | 'IMAX' | 'Flat' | 'Standard';
  isEdited?: boolean;
  needsDubbing?: boolean;
  isDubbed?: boolean;
}
import type {
  ParsedScene,
  ParsingWarning,
  ScreenplayFormat,
  SceneElement,
  SceneIntExt,
  SceneTimeOfDay,
  SceneReviewStatus,
  SceneExtractionReviewState,
  CharacterAppearanceRecord,
  SceneManualOverrides,
} from './services/screenplay/types';
export type {
  ParsedScene,
  ParsingWarning,
  ScreenplayFormat,
  SceneElement,
  SceneIntExt,
  SceneTimeOfDay,
  SceneReviewStatus,
  SceneExtractionReviewState,
  CharacterAppearanceRecord,
  SceneManualOverrides,
};

export interface ScreenplayTitlePageMetadata {
  title?: string;
  author?: string;
  basedOn?: string;
  draftDate?: string;
  contact?: string;
  copyright?: string;
  notes?: string;
}

export interface ScreenplayRevisionSnapshot {
  id: string;
  versionLabel: string;
  title: string;
  author: string;
  createdAt: string;
  changeDescription: string;
  rawText: string;
  documentJson: string;
  wordCount?: number;
  sceneCount?: number;
}

export interface ScreenplayImportMetadata {
  originalFileName: string;
  importedFormat: ScreenplayFormat;
  importedAt: string;
  fileSize?: number;
  warningCount?: number;
}

export interface ScreenplayPdfLine {
  id: string;
  text: string;
  type?: string;
  x: number; // left in points
  top: number; // top from page top in points
  width: number; // width in points
  height: number; // height in points
  fontSize: number; // font size in points
  fontFamily?: string;
  fontWeight?: string;
  isItalic?: boolean;
  alignment?: 'left' | 'center' | 'right';
}

export interface ScreenplayPdfPageLayout {
  pageNumber: number;
  width: number;
  height: number;
  isTitlePage?: boolean;
  lines: ScreenplayPdfLine[];
}

export interface ScreenplayPdfDocumentLayout {
  pageWidth: number;
  pageHeight: number;
  pages: ScreenplayPdfPageLayout[];
  hasTitlePage: boolean;
  titlePage?: ScreenplayPdfPageLayout;
}

export interface ScreenplayVersion {
  id: string;
  version: string; // e.g. "v1.0", "v1.4"
  title: string; // e.g. "First locked shooting draft"
  author: string;
  updatedAt: string; // date & time string
  createdAt?: string;
  lastSavedAt?: string;
  changeDescription: string;
  contentSnippet?: string; // sample line from script
  status: 'Draft' | 'Approved' | 'Locked';
  fileName?: string;
  fileUrl?: string;
  sourceFormat?: ScreenplayFormat;
  fileSize?: number;
  totalScenes?: number;
  totalPageEighths?: number;
  totalPageCountDisplay?: string;
  characters?: string[];
  locations?: string[];
  scenes?: ParsedScene[];
  warnings?: ParsingWarning[];
  rawText?: string;
  documentJson?: string;
  content?: any;
  titlePageMetadata?: ScreenplayTitlePageMetadata;
  revisions?: ScreenplayRevisionSnapshot[];
  importMetadata?: ScreenplayImportMetadata;
  owner?: string;
  isLocked?: boolean;
  sourcePdfDataUrl?: string;
  sourcePdfFileName?: string;
  pdfLayout?: ScreenplayPdfDocumentLayout;
}

export interface StoryboardRevision {
  id: string;
  sceneNumber: string; // e.g. "Scene 3"
  panelNumber: string; // e.g. "Panel 2A"
  title: string; // e.g. "Elena silhouette over lights shadow"
  description: string;
  updatedAt: string;
  version: string; // e.g. "v1", "v2"
  artist: string;
  status: 'Approved' | 'In-Review' | 'Revised';
  imageUrl?: string;
}

import type {
  ProductionElementCategory,
  MasterElement,
  SceneElementAssociation,
  BreakdownRequirementStatus,
  BreakdownProvenance,
  BreakdownAssociationReviewState,
} from './features/breakdown/types/breakdownTypes';
import type { VisualizeProductionStore } from './features/visualize/types';
import type { ProductionWorkspaceStore } from './features/production/types';
import type { VaultProductionStore } from './features/vault/types';
export type {
  ProductionElementCategory,
  MasterElement,
  SceneElementAssociation,
  BreakdownRequirementStatus,
  BreakdownProvenance,
  BreakdownAssociationReviewState,
  VisualizeProductionStore,
  ProductionWorkspaceStore,
  VaultProductionStore,
};

export interface FilmProject {
  id: string;
  owner?: string;
  ownerId?: string;
  title: string;
  logline: string;
  director: string;
  producer?: string;
  writer?: string;
  cinematographer?: string;
  productionType?: string;
  productionCompany?: string;
  companyName?: string;
  primaryLocation?: string;
  status?: ProjectStatus;
  budgetTotal?: number;
  dailyBurnCap?: number;
  startDate: string; // YYYY-MM-DD (base date)
  finalEndDate: string; // YYYY-MM-DD (selected/recalibrated end date)
  suggestedEndDate: string; // YYYY-MM-DD (sum of all duration chains)
  isEndDateFixed: boolean; // if true, remaining phases shrink to fit finalEndDate
  constraints: ProjectConstraints;
  phases: FilmPhase[];
  createdAt?: string;
  updatedAt: string;
  footageBackups?: FootageBackup[];
  screenplayVersions?: ScreenplayVersion[];
  storyboardRevisions?: StoryboardRevision[];
  visualizeState?: VisualizeProductionStore;
  productionState?: ProductionWorkspaceStore;
  vaultState?: VaultProductionStore;
  elementCatalog?: MasterElement[];
  sceneBreakdownAssociations?: SceneElementAssociation[];
  userDesignation?: string;
  userDesignations?: string[];
  memberCount?: number;
  userRole?: ProjectRole;
  persistence?: 'remote' | 'local' | 'mock';
  isWalkthrough?: boolean;
}

export interface TechnicalSpecificationDoc {
  synopsis: string;
  projectScope: string;
  technicalArchitecture: string;
  constraintsGuidelines: string;
}

export interface GuildRule {
  id: string;
  name: string;
  fullName: string;
  region: string;
  recommendedTurnaround: number; // min turnaround hours
  recommendedWeekendTurnaround: number; // min weekend turnaround hours
  recommendedMaxWorkday: number; // max workday hours
  recommendedMealInterval: number; // max hours between meals
  recommendedWeatherBuffer: number; // min weather buffer days for outdoor shoots
  strictness: 'Very Strict' | 'Strict' | 'Moderate' | 'Advisory';
  description: string;
  penaltyModel: string;
  mealViolationMessage: string;
  turnaroundViolationMessage: string;
  weekendViolationMessage: string;
}

export const INDIAN_GUILDS: Record<string, GuildRule> = {
  FWICE: {
    id: 'FWICE',
    name: 'FWICE (Bollywood)',
    fullName: 'Federation of Western India Cine Employees',
    region: 'Mumbai (Hindi/Bollywood)',
    recommendedTurnaround: 12,
    recommendedWeekendTurnaround: 54,
    recommendedMaxWorkday: 12,
    recommendedMealInterval: 6,
    recommendedWeatherBuffer: 6,
    strictness: 'Very Strict',
    description: 'The premier and largest federation in Western India, demanding strict compliance on rest turnarounds, workday limits, and catering breaks to safeguard workers from burnout.',
    penaltyModel: 'Mandatory Double Wages & Labor Disciplinary Actions',
    mealViolationMessage: 'Triggers double-time wages and labor union walkout risk.',
    turnaroundViolationMessage: 'Triggers daily Forced Call penalty fees (double shifts).',
    weekendViolationMessage: 'Triggers standard labor rest penalties.'
  },
  FEFSI: {
    id: 'FEFSI',
    name: 'FEFSI (Kollywood)',
    fullName: 'Film Employees Federation of South India',
    region: 'Chennai (Tamil/Kollywood)',
    recommendedTurnaround: 12,
    recommendedWeekendTurnaround: 48,
    recommendedMaxWorkday: 11,
    recommendedMealInterval: 5.5,
    recommendedWeatherBuffer: 5,
    strictness: 'Very Strict',
    description: 'Renowned for tight, disciplined schedules in Tamil cinema, strictly capping shift hours and setting high rest limits with heavy union fines for violations.',
    penaltyModel: 'Slick Arbitration, Guild Fines & Crew Stop-Work Warnings',
    mealViolationMessage: 'Triggers immediate dining compliance disputes and penalty payments.',
    turnaroundViolationMessage: 'Triggers double-wage forced call penalty fees.',
    weekendViolationMessage: 'Triggers South India guild weekend rest penalty fees.'
  },
  TFIEF: {
    id: 'TFIEF',
    name: 'TFIEF (Tollywood)',
    fullName: 'Telugu Film Industry Employees Federation',
    region: 'Hyderabad (Telugu/Tollywood)',
    recommendedTurnaround: 12,
    recommendedWeekendTurnaround: 48,
    recommendedMaxWorkday: 11,
    recommendedMealInterval: 5.5,
    recommendedWeatherBuffer: 5,
    strictness: 'Strict',
    description: 'Enforces robust labor standards for Telugu blockbusters, keeping shifts safe but enabling streamlined shoots with set overtime compensation protocols.',
    penaltyModel: 'Mandatory Overtime Surcharges & Shift Surcharges',
    mealViolationMessage: 'Triggers double-rate meal penalties for actors and technicians.',
    turnaroundViolationMessage: 'Triggers standard Hyderabad chamber forced call premium rates.',
    weekendViolationMessage: 'Triggers Chamber of Commerce review/penalty warnings.'
  },
  FEFKA: {
    id: 'FEFKA',
    name: 'FEFKA (Mollywood)',
    fullName: 'Film Employees Federation of Kerala',
    region: 'Kochi (Malayalam/Mollywood)',
    recommendedTurnaround: 12,
    recommendedWeekendTurnaround: 36,
    recommendedMaxWorkday: 10,
    recommendedMealInterval: 5,
    recommendedWeatherBuffer: 4,
    strictness: 'Strict',
    description: 'Nurtures Kerala’s highly focused, realistic, and lightning-fast cinema schedules. Caps shifts to maintain peak crew performance and artistic quality.',
    penaltyModel: 'Direct Association Warnings & Regional Union Penalties',
    mealViolationMessage: 'Triggers AMMA/FEFKA labor warnings and snack break delays.',
    turnaroundViolationMessage: 'Triggers mandatory rest extension or travel rest penalties.',
    weekendViolationMessage: 'Triggers single-day rest violation claims.'
  },
  KFWF: {
    id: 'KFWF',
    name: 'KFWF (Sandalwood)',
    fullName: 'Karnataka Film Workers Federation',
    region: 'Bengaluru (Kannada/Sandalwood)',
    recommendedTurnaround: 12,
    recommendedWeekendTurnaround: 36,
    recommendedMaxWorkday: 12,
    recommendedMealInterval: 6,
    recommendedWeatherBuffer: 5,
    strictness: 'Moderate',
    description: 'Governs local Kannada cinema crew parameters, balancing robust work schedules with standard health and rest-compliance benchmarks.',
    penaltyModel: 'Federation Mediation & Overtime Compensation Slips',
    mealViolationMessage: 'Triggers meal delay fines and overtime catering penalties.',
    turnaroundViolationMessage: 'Triggers local chamber rest grievance report.',
    weekendViolationMessage: 'Triggers weekend shift premium charges.'
  },
  none: {
    id: 'none',
    name: 'Independent (No Guild)',
    fullName: 'Independent / Non-Guild Production',
    region: 'Flexible / Pan-India',
    recommendedTurnaround: 10,
    recommendedWeekendTurnaround: 24,
    recommendedMaxWorkday: 14,
    recommendedMealInterval: 6.5,
    recommendedWeatherBuffer: 3,
    strictness: 'Advisory',
    description: 'Operates without formal union bounds. Employs advisory safety bounds to protect the cast and crew from physical exhaustion and project liability.',
    penaltyModel: 'Self-Regulated Advisory (High Exhaustion & Health Risks)',
    mealViolationMessage: 'Exhausts crew and increases overall shoot friction.',
    turnaroundViolationMessage: 'High risk of accidents, sluggish setups, and extreme fatigue.',
    weekendViolationMessage: 'Zero rest day results in critical crew exhaustion and dropouts.'
  }
};

/* =========================================================================
   SCENEOS PRODUCTION WORKFLOW & 5-STAGE INTEGRATION MODELS (Batch 01)
   ========================================================================= */

export type ProductionWorkflowStageId = 'write' | 'breakdown' | 'visualize' | 'plan' | 'shoot';

export interface ProductionWorkflowStep {
  id: string;
  number: number; // 1 to 7
  title: string;
  stageId: ProductionWorkflowStageId;
  stageName: string;
  description: string;
  prerequisiteDescription: string;
  targetTab: string;
  status: 'completed' | 'in-progress' | 'pending-prerequisites';
  actionLabel: string;
  metricSummary?: string;
}

/**
 * Shared Data Integration Contracts for Future Batches:
 * 1. Production -> Screenplay & Screenplay Versions
 * 2. Screenplay Version -> Scenes
 * 3. Scene -> Breakdown Elements
 * 4. Scene -> Shot List & Storyboard References
 * 5. Scenes & Breakdown Elements -> Shooting Schedule
 * 6. Shooting Schedule -> Crew Assignments & Call Sheets
 * 7. Call Sheets -> Distribution Status & Daily Production Records
 */

export interface ShotListItem {
  id: string;
  sceneId: string;
  sceneNumber: string;
  shotNumber: string; // e.g. "1A", "1B"
  shotType: 'Wide' | 'Medium' | 'Close-Up' | 'Extreme Close-Up' | 'Over-the-Shoulder' | 'POV' | 'Aerial';
  cameraAngle: 'Eye-Level' | 'Low Angle' | 'High Angle' | 'Dutch Angle' | 'Birds-Eye';
  movement: 'Static' | 'Pan' | 'Tilt' | 'Tracking' | 'Dolly' | 'Steadicam' | 'Handheld';
  lensMM?: string; // e.g. "35mm", "50mm"
  description: string;
  equipmentNotes?: string;
  setupMinutes?: number;
  completed?: boolean;
}

export interface CallSheet {
  id: string;
  shootDayNumber: number;
  calendarDate: string; // YYYY-MM-DD
  crewCallTime: string; // e.g. "06:30"
  shootingCallTime: string; // e.g. "07:30"
  locationName: string;
  locationAddress: string;
  nearestHospital: string;
  weatherSummary: string;
  scenesPlanned: string[]; // Scene IDs or numbers
  totalPageEighthsPlanned: number;
  published: boolean;
  publishedAt?: string;
  distributedCount?: number;
}

export interface DailyProductionReport {
  id: string;
  shootDayNumber: number;
  calendarDate: string;
  callSheetId?: string;
  generalCall: string;
  firstShotTime: string;
  wrapTime: string;
  totalScenesScheduled: number;
  totalScenesCompleted: number;
  pagesScheduledEighths: number;
  pagesCompletedEighths: number;
  setupsCompleted: number;
  mealOutTime: string;
  mealInTime: string;
  delaysNotes?: string;
  safetyIncidentsReported: number;
  submittedBy: string;
  status: 'Draft' | 'Submitted' | 'Approved';
}

export interface ProductionDocument {
  id: string;
  title: string;
  category: 'Legal & Clearances' | 'Safety & Permits' | 'Crew Agreements' | 'Location Releases' | 'Insurance & Bond';
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'Pending' | 'Executed' | 'Expired';
  requiresReview: boolean;
}

export interface ScriptSide {
  id: string;
  shootDayNumber: number;
  calendarDate: string;
  scenesIncluded: string[];
  castIncluded: string[];
  pdfGenerated: boolean;
  generatedAt?: string;
}

