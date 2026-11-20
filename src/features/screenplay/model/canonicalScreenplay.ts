/**
 * SceneOS — Canonical Screenplay Document Model
 * Authoritative, format-agnostic screenplay representation separating semantics
 * from editor node representations and visual canvas layout.
 */

export type CanonicalElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'dual_dialogue'
  | 'transition'
  | 'centered_text'
  | 'section_heading'
  | 'synopsis'
  | 'note'
  | 'lyrics'
  | 'page_break';

export type ClassificationConfidence = 'high' | 'ambiguous';

export interface FormattingSpan {
  type: 'bold' | 'italic' | 'underline';
  start: number;
  end: number;
}

export interface ObservedElementFormatting {
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: 'normal' | 'bold' | '500' | '600' | '700' | string;
  isItalic?: boolean;
  isUnderline?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  indentLeftInches?: number;
  indentRightInches?: number;
  marginTopPt?: number;
  marginBottomPt?: number;
  lineSpacing?: number;
  pageNumber?: number;
  sourceCoordinates?: { x: number; y: number; width?: number; height?: number };
  isObserved?: boolean;
}

export interface SceneProperties {
  sceneNumber?: string;
  intExt?: 'INT' | 'EXT' | 'INT/EXT' | 'I/E' | 'EST' | string;
  location?: string;
  timeOfDay?: string;
  isForced?: boolean;
}

export interface CharacterProperties {
  characterName: string;
  extensions?: string[]; // e.g. ['V.O.'], ['O.S.'], ['CONT\'D']
  isForced?: boolean;
}

export interface DualDialogueColumn {
  character: CanonicalElement;
  parenthetical?: CanonicalElement;
  dialogue: CanonicalElement[];
}

export interface DualDialogueProperties {
  left: DualDialogueColumn;
  right: DualDialogueColumn;
}

export interface CanonicalElement {
  id: string; // Stable UUID for element tracking across revisions
  type: CanonicalElementType;
  text: string;
  formatting?: FormattingSpan[];
  observedFormatting?: ObservedElementFormatting;
  sceneProperties?: SceneProperties;
  characterProperties?: CharacterProperties;
  dualDialogue?: DualDialogueProperties;
  sceneNumber?: string;
  isDualDialogue?: boolean;
  sectionLevel?: number; // 1 for '#', 2 for '##', 3 for '###'
  confidence: ClassificationConfidence;
  classificationWarning?: string;
  warnings?: string[];
  sourceLineRange?: { start: number; end: number };
  rawSourceText?: string;
}

export interface ScreenplayTitlePage {
  title?: string;
  credit?: string; // e.g. "Written by"
  author?: string;
  source?: string; // e.g. "Based on..."
  draftDate?: string;
  contact?: string;
  notes?: string;
  copyright?: string;
  customLines?: string[];
}

export interface ScreenplayMetadata {
  title?: string;
  credit?: string; // e.g. "written by", "screenplay by"
  author?: string;
  authors?: string[];
  source?: string; // e.g. "based on the novel by..."
  draftDate?: string;
  contact?: string;
  copyright?: string;
  notes?: string;
  watermark?: string;
  titlePage?: ScreenplayTitlePage;
  visualSettings?: {
    defaultFontFamily?: string;
    defaultFontSizePt?: number;
    lineSpacing?: number;
    pageWidthInches?: number;
    pageHeightInches?: number;
  };
}

export interface DocumentProvenance {
  sourceFormat: 'fountain' | 'fdx' | 'txt' | 'docx' | 'pdf' | 'native';
  fileName?: string;
  fileSize?: number;
  importedAt: string; // ISO 8601
  rawTextLength: number;
  originalChecksum?: string;
  sourcePdfDataUrl?: string;
}

export interface CanonicalWarning {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  lineNumber?: number;
  elementId?: string;
  contextSnippet?: string;
}

import {
  ScreenplayPdfLine,
  ScreenplayPdfPageLayout,
  ScreenplayPdfDocumentLayout,
} from '../../../types';

export type {
  ScreenplayPdfLine,
  ScreenplayPdfPageLayout,
  ScreenplayPdfDocumentLayout,
};

export interface CanonicalScreenplayDocument {
  id: string;
  metadata: ScreenplayMetadata;
  elements: CanonicalElement[];
  warnings: CanonicalWarning[];
  provenance: DocumentProvenance;
  pdfLayout?: ScreenplayPdfDocumentLayout;
}

/**
 * Generates a stable unique identifier for screenplay elements
 */
export function generateElementId(prefix = 'elem'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Creates an empty CanonicalScreenplayDocument
 */
export function createEmptyCanonicalDocument(title = 'Untitled Screenplay'): CanonicalScreenplayDocument {
  return {
    id: generateElementId('doc'),
    metadata: {
      title,
      draftDate: new Date().toLocaleDateString(),
    },
    elements: [
      {
        id: generateElementId('elem'),
        type: 'scene_heading',
        text: 'INT. UNTITLED SCENE - DAY',
        sceneProperties: {
          intExt: 'INT',
          location: 'UNTITLED SCENE',
          timeOfDay: 'DAY',
        },
        confidence: 'high',
      },
      {
        id: generateElementId('elem'),
        type: 'action',
        text: '',
        confidence: 'high',
      },
    ],
    warnings: [],
    provenance: {
      sourceFormat: 'native',
      importedAt: new Date().toISOString(),
      rawTextLength: 0,
    },
  };
}
