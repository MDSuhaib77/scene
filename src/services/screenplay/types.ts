/**
 * SceneOS — Screenplay Ingestion & Scene Breakdown Types
 * Standardized data models for screenplay parsing, format adapters, and scene breakdown.
 */

export type ScreenplayFormat = 'fdx' | 'fountain' | 'txt' | 'pdf' | 'docx' | 'rtf' | 'unknown';

export type SceneIntExt = 'INT' | 'EXT' | 'INT/EXT' | 'I/E' | 'UNKNOWN';

export type SceneTimeOfDay = 
  | 'DAY' 
  | 'NIGHT' 
  | 'DUSK' 
  | 'DAWN' 
  | 'MORNING' 
  | 'EVENING' 
  | 'AFTERNOON' 
  | 'CONTINUOUS' 
  | 'LATER' 
  | 'SAME TIME' 
  | 'UNSPECIFIED';

export type SceneReviewStatus = 'unreviewed' | 'reviewed' | 'locked';

export type SceneExtractionReviewState =
  | 'extracted'
  | 'needs_review'
  | 'manually_corrected'
  | 'reviewed';

export interface CharacterAppearanceRecord {
  normalizedName: string;
  rawCues: string[];
  dialogueCount: number;
  isAmbiguous?: boolean;
  ambiguityReason?: string;
}

export interface SceneManualOverrides {
  intExt?: SceneIntExt;
  location?: string;
  timeOfDay?: SceneTimeOfDay;
  characters?: string[];
  correctedAt?: string;
}

export interface SceneElement {
  id: string;
  category: 'character' | 'prop' | 'wardrobe' | 'vehicle' | 'stunt' | 'vfx' | 'sfx' | 'animal' | 'sound';
  name: string;
  notes?: string;
}

export interface DialogueBlock {
  character: string;
  parenthetical?: string;
  text: string;
  isDualDialogue?: boolean;
  dualGroupId?: string;
}

export interface ParsedScene {
  id: string;
  sceneNumber: string; // e.g. "1", "2A", "104"
  slugline: string; // e.g. "INT. MONORAIL CONTROL TOWER - NIGHT"
  originalHeading?: string; // Preserved verbatim scene heading from the screenplay
  intExt: SceneIntExt;
  location: string; // e.g. "MONORAIL CONTROL TOWER"
  timeOfDay: SceneTimeOfDay;
  pageLengthEighths: number; // Integer representation: e.g., 8 = 1 page, 11 = 1 3/8 pages
  pageLengthDisplay: string; // e.g. "1 3/8" or "4/8"
  startPage: number;
  estimatedDurationMinutes: number; // calculated from eighths (~1 min / page)
  synopsis?: string;
  characters: string[]; // List of character names speaking or present
  dialogueBlocks: DialogueBlock[];
  actionSnippet?: string;
  elements: SceneElement[];
  status: SceneReviewStatus;
  scriptSnippet?: string;
  notes?: string;
  sourceLineNumber?: number;
  sourcePos?: number; // Ordered ProseMirror document position of the Scene Heading
  endPos?: number;
  sourceDocumentId?: string;
  sourceDocFingerprint?: string;
  extractedAt?: string;
  reviewState?: SceneExtractionReviewState;
  reviewReasons?: string[];
  extractedIntExt?: SceneIntExt;
  extractedLocation?: string;
  extractedTimeOfDay?: SceneTimeOfDay;
  extractedCharacters?: string[];
  characterAppearances?: CharacterAppearanceRecord[];
  manualOverrides?: SceneManualOverrides;
  actHeading?: string;
  sequenceHeading?: string;
  shotHeadings?: string[];
  transitions?: string[];
  contentHash?: string;
  isAmbiguousMatch?: boolean;
}

export interface ParsingWarning {
  id: string;
  line?: number;
  sceneNumber?: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  context?: string;
  suggestion?: string;
}

export interface ScreenplayDocument {
  id: string;
  projectId: string;
  title: string;
  version: string; // e.g. "v1.0"
  author: string;
  fileName: string;
  fileSize: number;
  sourceFormat: ScreenplayFormat;
  importedAt: string;
  totalScenes: number;
  totalPageEighths: number;
  totalPageCountDisplay: string;
  characters: string[];
  locations: string[];
  status: 'Draft' | 'Approved' | 'Locked';
  scenes: ParsedScene[];
  warnings: ParsingWarning[];
  rawText?: string;
  sourceBlobUrl?: string;
}

export interface ScreenplayValidationResult {
  isValid: boolean;
  format: ScreenplayFormat;
  error?: string;
  warning?: string;
  fileSizeMB: number;
}

export interface FormatAdapter {
  readonly format: ScreenplayFormat;
  readonly fileExtensions: string[];
  canParse(file: File, text?: string, buffer?: ArrayBuffer): boolean;
  parse(file: File, text?: string, buffer?: ArrayBuffer): Promise<{
    title?: string;
    author?: string;
    scenes: ParsedScene[];
    warnings: ParsingWarning[];
    rawText: string;
  }>;
}

export interface ScreenplayImportPreview {
  documentSummary: {
    title: string;
    author: string;
    fileName: string;
    fileSizeFormatted: string;
    sourceFormat: ScreenplayFormat;
    sceneCount: number;
    pageCountDisplay: string;
    characterCount: number;
    locationCount: number;
    warningCount: number;
  };
  detectedScenes: ParsedScene[];
  warnings: ParsingWarning[];
  duplicateDetected: boolean;
  existingVersion?: string;
  suggestedVersion: string;
  rawText: string;
}
