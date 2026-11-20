/**
 * SceneOS — Fountain Specification 1.1 Compliant Parser
 * Deterministic parser implementing the official Fountain syntax rules:
 * https://fountain.io/syntax/
 */

import {
  CanonicalScreenplayDocument,
  CanonicalElement,
  CanonicalWarning,
  CanonicalElementType,
  ScreenplayMetadata,
  generateElementId,
  DualDialogueProperties,
  FormattingSpan,
} from './canonicalScreenplay';

/**
 * Parses Fountain inline markdown formatting (bold, italic, underline)
 */
export function parseFountainFormatting(rawText: string): {
  cleanText: string;
  formatting?: FormattingSpan[];
} {
  if (!rawText) return { cleanText: '' };

  const formatting: FormattingSpan[] = [];
  let result = '';
  let i = 0;
  const len = rawText.length;

  while (i < len) {
    // Bold italic: ***text***
    if (rawText.startsWith('***', i)) {
      const end = rawText.indexOf('***', i + 3);
      if (end !== -1) {
        const inner = rawText.slice(i + 3, end);
        const startPos = result.length;
        result += inner;
        const endPos = result.length;
        formatting.push({ type: 'bold', start: startPos, end: endPos });
        formatting.push({ type: 'italic', start: startPos, end: endPos });
        i = end + 3;
        continue;
      }
    }
    // Bold: **text**
    if (rawText.startsWith('**', i)) {
      const end = rawText.indexOf('**', i + 2);
      if (end !== -1) {
        const inner = rawText.slice(i + 2, end);
        const startPos = result.length;
        result += inner;
        const endPos = result.length;
        formatting.push({ type: 'bold', start: startPos, end: endPos });
        i = end + 2;
        continue;
      }
    }
    // Italic: *text*
    if (rawText[i] === '*' && !rawText.startsWith('**', i)) {
      const end = rawText.indexOf('*', i + 1);
      if (end !== -1 && end > i + 1) {
        const inner = rawText.slice(i + 1, end);
        const startPos = result.length;
        result += inner;
        const endPos = result.length;
        formatting.push({ type: 'italic', start: startPos, end: endPos });
        i = end + 1;
        continue;
      }
    }
    // Underline: _text_
    if (rawText[i] === '_') {
      const end = rawText.indexOf('_', i + 1);
      if (end !== -1 && end > i + 1) {
        const inner = rawText.slice(i + 1, end);
        const startPos = result.length;
        result += inner;
        const endPos = result.length;
        formatting.push({ type: 'underline', start: startPos, end: endPos });
        i = end + 1;
        continue;
      }
    }

    result += rawText[i];
    i++;
  }

  return {
    cleanText: result,
    formatting: formatting.length > 0 ? formatting : undefined,
  };
}

const STANDARD_SCENE_PREFIXES = [
  'INT.',
  'EXT.',
  'INT/EXT.',
  'INT./EXT.',
  'I/E.',
  'EST.',
  'INT ',
  'EXT ',
  'INT/EXT ',
  'I/E ',
  'EST ',
];

const TRANSITION_PATTERNS = [
  'CUT TO:',
  'FADE IN:',
  'FADE OUT.',
  'FADE TO BLACK.',
  'FADE TO BLACK:',
  'DISSOLVE TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'BACK TO SCENE.',
  'TIME CUT:',
];

export interface ParseFountainOptions {
  fileName?: string;
  fileSize?: number;
  title?: string;
}

/**
 * Parses raw Fountain screenplay text into a CanonicalScreenplayDocument
 */
export function parseFountain(
  rawText: string,
  options: ParseFountainOptions = {}
): CanonicalScreenplayDocument {
  const warnings: CanonicalWarning[] = [];
  const normalized = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const allLines = normalized.split('\n');

  let currentLineIndex = 0;

  // 1. Parse Title Page Metadata (must be at the very top of file)
  const metadata: ScreenplayMetadata = {};
  const metadataKeys = new Set([
    'title',
    'credit',
    'author',
    'authors',
    'source',
    'draft date',
    'date',
    'contact',
    'copyright',
    'notes',
    'watermark',
  ]);

  let inTitlePage = false;
  let currentMetaKey: string | null = null;
  let currentMetaValues: string[] = [];

  // Check if first non-empty line looks like a title page key
  for (let i = 0; i < allLines.length; i++) {
    const trimmed = allLines[i].trim();
    if (!trimmed) {
      if (inTitlePage) {
        // Blank line ends title page
        if (currentMetaKey) {
          applyMetaKey(metadata, currentMetaKey, currentMetaValues.join('\n'));
        }
        currentLineIndex = i + 1;
        break;
      }
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const keyCandidate = trimmed.slice(0, colonIdx).trim().toLowerCase();
      if (metadataKeys.has(keyCandidate)) {
        inTitlePage = true;
        if (currentMetaKey) {
          applyMetaKey(metadata, currentMetaKey, currentMetaValues.join('\n'));
        }
        currentMetaKey = keyCandidate;
        const firstVal = trimmed.slice(colonIdx + 1).trim();
        currentMetaValues = firstVal ? [firstVal] : [];
        continue;
      }
    }

    if (inTitlePage) {
      // Continuation line for previous key
      currentMetaValues.push(trimmed);
    } else {
      // Not a title page
      currentLineIndex = 0;
      break;
    }
  }

  // 2. Parse Screenplay Body
  const elements: CanonicalElement[] = [];
  let inBoneyard = false;

  const linesCount = allLines.length;
  let i = currentLineIndex;

  while (i < linesCount) {
    const rawLine = allLines[i];
    const trimmed = rawLine.trim();

    // Check previous line was blank
    const prevLineBlank = i === 0 || allLines[i - 1].trim() === '';
    // Check next line exists and is not blank
    const nextLine = i + 1 < linesCount ? allLines[i + 1] : '';
    const nextLineTrimmed = nextLine.trim();
    const nextLineBlank = i + 1 >= linesCount || nextLineTrimmed === '';

    // Handle Boneyard comments /* ... */
    if (trimmed.startsWith('/*')) {
      inBoneyard = true;
      let boneyardContent = trimmed.slice(2);
      const boneyardStartLine = i + 1;

      while (i < linesCount) {
        const closeIdx = allLines[i].indexOf('*/');
        if (closeIdx !== -1) {
          inBoneyard = false;
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (inBoneyard) {
      i++;
      continue;
    }

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Section Headings: # (Act), ## (Sequence), ### (Scene)
    if (trimmed.startsWith('#')) {
      const levelMatch = trimmed.match(/^(#{1,3})\s*(.*)$/);
      if (levelMatch) {
        const hashes = levelMatch[1].length;
        const titleText = levelMatch[2].trim();
        elements.push({
          id: generateElementId('sec'),
          type: 'section_heading',
          text: titleText,
          sectionLevel: hashes,
          confidence: 'high',
          sourceLineRange: { start: i + 1, end: i + 1 },
          rawSourceText: rawLine,
        });
        i++;
        continue;
      }
    }

    // Synopsis: = Synopsis text
    if (trimmed.startsWith('=') && !trimmed.startsWith('===')) {
      elements.push({
        id: generateElementId('syn'),
        type: 'synopsis',
        text: trimmed.slice(1).trim(),
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Page Break: === (three or more equals signs alone on line)
    if (/^={3,}$/.test(trimmed)) {
      elements.push({
        id: generateElementId('pb'),
        type: 'page_break',
        text: '===',
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Inline Notes: [[ Note text ]]
    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      elements.push({
        id: generateElementId('note'),
        type: 'note',
        text: trimmed.slice(2, -2).trim(),
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Lyrics: ~ Lyrics line
    if (trimmed.startsWith('~')) {
      elements.push({
        id: generateElementId('lyr'),
        type: 'lyrics',
        text: trimmed.slice(1).trim(),
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Centered Text: > text <
    if (trimmed.startsWith('>') && trimmed.endsWith('<') && trimmed.length > 2) {
      elements.push({
        id: generateElementId('cnt'),
        type: 'centered_text',
        text: trimmed.slice(1, -1).trim(),
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Forced Transitions: > Transition (without trailing <)
    if (trimmed.startsWith('>') && !trimmed.endsWith('<')) {
      elements.push({
        id: generateElementId('trn'),
        type: 'transition',
        text: trimmed.slice(1).trim().toUpperCase(),
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Forced Scene Heading: .HEADING
    if (trimmed.startsWith('.') && !trimmed.startsWith('..') && trimmed.length > 1) {
      const headingBody = trimmed.slice(1).trim();
      const { text, sceneNumber } = extractTrailingSceneNumber(headingBody);
      const parsedProps = parseHeadingAttributes(text);

      elements.push({
        id: generateElementId('scn'),
        type: 'scene_heading',
        text: text.toUpperCase(),
        sceneNumber,
        sceneProperties: {
          ...parsedProps,
          sceneNumber,
          isForced: true,
        },
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Automatic Scene Heading: Standard prefixes preceded by blank line (or top of script)
    if (prevLineBlank && isStandardSceneHeading(trimmed)) {
      const { text, sceneNumber } = extractTrailingSceneNumber(trimmed);
      const parsedProps = parseHeadingAttributes(text);

      elements.push({
        id: generateElementId('scn'),
        type: 'scene_heading',
        text: text.toUpperCase(),
        sceneNumber,
        sceneProperties: {
          ...parsedProps,
          sceneNumber,
          isForced: false,
        },
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Forced Action: !Action text (escapes character/transition collisions)
    if (trimmed.startsWith('!') && trimmed.length > 1) {
      const { cleanText: actText, formatting: actFormatting } = parseFountainFormatting(trimmed.slice(1).trim());
      elements.push({
        id: generateElementId('act'),
        type: 'action',
        text: actText,
        formatting: actFormatting,
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Character Cue:
    // Either forced with @Name or automatic (uppercase line preceded by blank line and followed by dialogue/parenthetical)
    const isForcedChar = trimmed.startsWith('@') && trimmed.length > 1;
    const isDualRight = trimmed.endsWith('^') && trimmed.length > 1;

    const testCharLine = (isForcedChar ? trimmed.slice(1) : trimmed)
      .replace(/\^\s*$/, '')
      .trim();

    const isAutomaticChar =
      prevLineBlank &&
      !nextLineBlank &&
      isLikelyCharacterName(testCharLine) &&
      !isStandardSceneHeading(testCharLine) &&
      !isStandardTransition(testCharLine);

    if (isForcedChar || isAutomaticChar) {
      const parsedChar = parseCharacterLine(testCharLine);

      // Check if this is dual dialogue (speaking simultaneously with previous character dialogue block)
      if (isDualRight) {
        elements.push({
          id: generateElementId('chr'),
          type: 'character',
          text: testCharLine,
          isDualDialogue: true,
          characterProperties: {
            characterName: parsedChar.characterName,
            extensions: parsedChar.extensions,
            isForced: isForcedChar,
          },
          confidence: 'high',
          sourceLineRange: { start: i + 1, end: i + 1 },
          rawSourceText: rawLine,
        });

        i++;
        while (i < linesCount && allLines[i].trim().length > 0) {
          const diaLine = allLines[i].trim();
          if (diaLine.startsWith('~')) {
            const { cleanText: lyrText, formatting: lyrFormatting } = parseFountainFormatting(diaLine.slice(1).trim());
            elements.push({
              id: generateElementId('lyr'),
              type: 'lyrics',
              text: lyrText,
              formatting: lyrFormatting,
              isDualDialogue: true,
              confidence: 'high',
              sourceLineRange: { start: i + 1, end: i + 1 },
              rawSourceText: allLines[i],
            });
          } else if (diaLine.startsWith('(') && diaLine.endsWith(')')) {
            const { cleanText: parText, formatting: parFormatting } = parseFountainFormatting(diaLine);
            elements.push({
              id: generateElementId('par'),
              type: 'parenthetical',
              text: parText,
              formatting: parFormatting,
              isDualDialogue: true,
              confidence: 'high',
              sourceLineRange: { start: i + 1, end: i + 1 },
              rawSourceText: allLines[i],
            });
          } else {
            const { cleanText: dText, formatting: dFormatting } = parseFountainFormatting(diaLine);
            elements.push({
              id: generateElementId('dia'),
              type: 'dialogue',
              text: dText,
              formatting: dFormatting,
              isDualDialogue: true,
              confidence: 'high',
              sourceLineRange: { start: i + 1, end: i + 1 },
              rawSourceText: allLines[i],
            });
          }
          i++;
        }
        continue;
      }

      // Normal single character cue
      elements.push({
        id: generateElementId('chr'),
        type: 'character',
        text: testCharLine,
        characterProperties: {
          characterName: parsedChar.characterName,
          extensions: parsedChar.extensions,
          isForced: isForcedChar,
        },
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });

      // Collect subsequent dialogue lines
      i++;
      while (i < linesCount && allLines[i].trim().length > 0) {
        const diaLine = allLines[i].trim();

        if (diaLine.startsWith('~')) {
          const { cleanText: lyrText, formatting: lyrFormatting } = parseFountainFormatting(diaLine.slice(1).trim());
          elements.push({
            id: generateElementId('lyr'),
            type: 'lyrics',
            text: lyrText,
            formatting: lyrFormatting,
            confidence: 'high',
            sourceLineRange: { start: i + 1, end: i + 1 },
            rawSourceText: allLines[i],
          });
        } else if (diaLine.startsWith('(') && diaLine.endsWith(')')) {
          const { cleanText: parText, formatting: parFormatting } = parseFountainFormatting(diaLine);
          elements.push({
            id: generateElementId('par'),
            type: 'parenthetical',
            text: parText,
            formatting: parFormatting,
            confidence: 'high',
            sourceLineRange: { start: i + 1, end: i + 1 },
            rawSourceText: allLines[i],
          });
        } else {
          const { cleanText: dText, formatting: dFormatting } = parseFountainFormatting(diaLine);
          elements.push({
            id: generateElementId('dia'),
            type: 'dialogue',
            text: dText,
            formatting: dFormatting,
            confidence: 'high',
            sourceLineRange: { start: i + 1, end: i + 1 },
            rawSourceText: allLines[i],
          });
        }
        i++;
      }
      continue;
    }

    // Automatic Transitions (e.g. CUT TO:, FADE OUT.)
    if (prevLineBlank && nextLineBlank && isStandardTransition(trimmed)) {
      elements.push({
        id: generateElementId('trn'),
        type: 'transition',
        text: trimmed.toUpperCase(),
        confidence: 'high',
        sourceLineRange: { start: i + 1, end: i + 1 },
        rawSourceText: rawLine,
      });
      i++;
      continue;
    }

    // Fallback: Action / Description
    // If the line is entirely uppercase but was followed by a blank line (no dialogue),
    // flag with explanation so writer knows why it wasn't a character cue
    const isOrphanUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length <= 40;
    const confidence = isOrphanUpper ? 'ambiguous' : 'high';
    const warning = isOrphanUpper
      ? 'Uppercase line has no dialogue following it; classified as action. Use @ prefix to force character or ! to force action.'
      : undefined;

    if (warning) {
      warnings.push({
        id: `warn-${i + 1}`,
        severity: 'info',
        message: warning,
        lineNumber: i + 1,
        contextSnippet: trimmed,
      });
    }

    const { cleanText: actionText, formatting: actionFormatting } = parseFountainFormatting(trimmed);

    elements.push({
      id: generateElementId('act'),
      type: 'action',
      text: actionText,
      formatting: actionFormatting,
      confidence,
      classificationWarning: warning,
      sourceLineRange: { start: i + 1, end: i + 1 },
      rawSourceText: rawLine,
    });
    i++;
  }

  // Fallback if document is empty
  if (elements.length === 0) {
    elements.push({
      id: generateElementId('act'),
      type: 'action',
      text: '',
      confidence: 'high',
    });
  }

  return {
    id: generateElementId('doc'),
    metadata: {
      title: metadata.title || options.title || options.fileName?.replace(/\.[^/.]+$/, '') || 'Untitled Screenplay',
      ...metadata,
    },
    elements,
    warnings,
    provenance: {
      sourceFormat: 'fountain',
      fileName: options.fileName,
      fileSize: options.fileSize || rawText.length,
      importedAt: new Date().toISOString(),
      rawTextLength: rawText.length,
    },
  };
}

// --------------------------------------------------------------------------
// Helper Parsing Functions
// --------------------------------------------------------------------------

function isStandardSceneHeading(text: string): boolean {
  const upper = text.toUpperCase();
  return STANDARD_SCENE_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

function isStandardTransition(text: string): boolean {
  const upper = text.toUpperCase();
  return (
    upper.endsWith('TO:') ||
    TRANSITION_PATTERNS.includes(upper) ||
    /^[A-Z\s]+TO:$/.test(upper)
  );
}

function isLikelyCharacterName(text: string): boolean {
  if (!text || text.length === 0 || text.length > 45) return false;
  // Strip parentheticals like (V.O.) for testing uppercase
  const stripped = text.replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (!stripped || stripped.length === 0) return false;
  // Must be uppercase
  if (stripped !== stripped.toUpperCase()) return false;
  // Must contain letters
  if (!/[A-Z]/.test(stripped)) return false;
  // Cannot end with period (that's likely a sentence or heading prefix)
  if (stripped.endsWith('.')) return false;
  return true;
}

function parseCharacterLine(line: string): { characterName: string; extensions?: string[] } {
  const extensions: string[] = [];
  const parenMatches = line.matchAll(/\(([^)]+)\)/g);
  for (const m of parenMatches) {
    extensions.push(m[1].trim());
  }

  const cleanName = line.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  return {
    characterName: cleanName,
    extensions: extensions.length > 0 ? extensions : undefined,
  };
}

function extractTrailingSceneNumber(line: string): { text: string; sceneNumber?: string } {
  const match = line.match(/\s*#([a-zA-Z0-9.\-_]+)#\s*$/);
  if (match) {
    const textWithoutNum = line.slice(0, match.index).trim();
    return {
      text: textWithoutNum,
      sceneNumber: match[1],
    };
  }
  return { text: line };
}

function parseHeadingAttributes(slugline: string): {
  intExt: string;
  location: string;
  timeOfDay: string;
} {
  const upper = slugline.toUpperCase();
  let intExt = 'INT';
  for (const prefix of STANDARD_SCENE_PREFIXES) {
    if (upper.startsWith(prefix)) {
      intExt = prefix.replace(/\.$/, '').trim();
      break;
    }
  }

  // Extract location and time of day (typically separated by hyphen or dash)
  const remainder = slugline.slice(intExt.length).replace(/^[.\s-]+/, '').trim();
  const hyphenParts = remainder.split(/\s+[-—–]\s+/);

  if (hyphenParts.length > 1) {
    const timeOfDay = hyphenParts[hyphenParts.length - 1].trim();
    const location = hyphenParts.slice(0, hyphenParts.length - 1).join(' - ').trim();
    return { intExt, location: location || remainder, timeOfDay };
  }

  return { intExt, location: remainder || 'UNKNOWN LOCATION', timeOfDay: 'DAY' };
}

function applyMetaKey(meta: ScreenplayMetadata, key: string, value: string): void {
  const v = value.trim();
  switch (key) {
    case 'title':
      meta.title = v;
      break;
    case 'credit':
      meta.credit = v;
      break;
    case 'author':
    case 'authors':
      meta.authors = v.split('\n').map((a) => a.trim()).filter(Boolean);
      meta.author = meta.authors[0] || v;
      break;
    case 'source':
      meta.source = v;
      break;
    case 'draft date':
    case 'date':
      meta.draftDate = v;
      break;
    case 'contact':
      meta.contact = v;
      break;
    case 'copyright':
      meta.copyright = v;
      break;
    case 'notes':
      meta.notes = v;
      break;
    case 'watermark':
      meta.watermark = v;
      break;
  }
}

export const parseFountainToCanonical = parseFountain;

