/**
 * SceneOS — Plain Text Screenplay Parser
 * Conservative screenplay element classifier distinguishing high-confidence matches
 * from ambiguous narrative blocks. Never silently drops text.
 */

import {
  CanonicalScreenplayDocument,
  CanonicalElement,
  CanonicalWarning,
  generateElementId,
} from './canonicalScreenplay';

export interface ParseTextOptions {
  fileName?: string;
  fileSize?: number;
}

const SCENE_PREFIXES = ['INT.', 'EXT.', 'INT/EXT.', 'INT./EXT.', 'I/E.', 'EST.'];

export function parsePlainText(
  rawText: string,
  options: ParseTextOptions = {}
): CanonicalScreenplayDocument {
  const warnings: CanonicalWarning[] = [];
  const elements: CanonicalElement[] = [];

  const normalized = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let prevType: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      prevType = null;
      continue;
    }

    const prevLineBlank = i === 0 || lines[i - 1].trim() === '';
    const nextLineTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : '';
    const hasNextLine = nextLineTrimmed.length > 0;

    // 1. Scene Heading
    const isScene = SCENE_PREFIXES.some((p) => trimmed.toUpperCase().startsWith(p));
    if (isScene) {
      elements.push({
        id: generateElementId('scn'),
        type: 'scene_heading',
        text: trimmed.toUpperCase(),
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      prevType = 'scene_heading';
      continue;
    }

    // 2. Transitions (CUT TO:, FADE OUT., etc.)
    if (
      /^(FADE IN:|FADE OUT\.|CUT TO:|SMASH CUT TO:|DISSOLVE TO:|MATCH CUT TO:)$/i.test(trimmed) ||
      (/^[A-Z0-9\s]+TO:$/.test(trimmed) && trimmed.length < 35)
    ) {
      elements.push({
        id: generateElementId('trn'),
        type: 'transition',
        text: trimmed.toUpperCase(),
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      prevType = 'transition';
      continue;
    }

    // 3. Parenthetical
    if (trimmed.startsWith('(') && trimmed.endsWith(')') && (prevType === 'character' || prevType === 'dialogue')) {
      elements.push({
        id: generateElementId('par'),
        type: 'parenthetical',
        text: trimmed,
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      prevType = 'parenthetical';
      continue;
    }

    // 4. Dialogue (follows character or parenthetical)
    if (prevType === 'character' || prevType === 'parenthetical') {
      elements.push({
        id: generateElementId('dia'),
        type: 'dialogue',
        text: trimmed,
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      prevType = 'dialogue';
      continue;
    }

    // 5. Character Cue (uppercase line preceded by blank line and followed by text)
    const isUppercase = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
    const looksLikeCharacter =
      prevLineBlank &&
      hasNextLine &&
      isUppercase &&
      trimmed.length <= 40 &&
      !trimmed.endsWith('.');

    if (looksLikeCharacter) {
      elements.push({
        id: generateElementId('chr'),
        type: 'character',
        text: trimmed,
        characterProperties: {
          characterName: trimmed.replace(/\s*\(.*\)$/, '').trim(),
        },
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      prevType = 'character';
      continue;
    }

    // 6. Action / Description
    // If line is uppercase but not followed by dialogue, flag as ambiguous action
    if (isUppercase && trimmed.length <= 45 && !hasNextLine) {
      const warningMsg = `Line ${i + 1} is all-caps but has no dialogue following it. Preserved as action.`;
      warnings.push({
        id: `warn-txt-${i + 1}`,
        severity: 'info',
        message: warningMsg,
        lineNumber: i + 1,
        contextSnippet: trimmed,
      });
      elements.push({
        id: generateElementId('act'),
        type: 'action',
        text: trimmed,
        confidence: 'ambiguous',
        classificationWarning: warningMsg,
        warnings: [warningMsg],
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      prevType = 'action';
      continue;
    }

    elements.push({
      id: generateElementId('act'),
      type: 'action',
      text: trimmed,
      confidence: 'high',
      sourceLineRange: { start: i + 1, end: i + 1 },
      rawSourceText: rawLine,
    });
    prevType = 'action';
  }

  if (elements.length === 0) {
    elements.push({
      id: generateElementId('act'),
      type: 'action',
      text: '',
      confidence: 'high',
    });
  }

  const title = options.fileName?.replace(/\.[^/.]+$/, '') || 'Untitled Screenplay';

  return {
    id: generateElementId('doc'),
    metadata: {
      title,
    },
    elements,
    warnings,
    provenance: {
      sourceFormat: 'txt',
      fileName: options.fileName,
      fileSize: options.fileSize || rawText.length,
      importedAt: new Date().toISOString(),
      rawTextLength: rawText.length,
    },
  };
}

export const parsePlainTextToCanonical = parsePlainText;

