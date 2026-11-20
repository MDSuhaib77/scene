import { JSONContent } from '@tiptap/react';
import { Node as PMNode } from '@tiptap/pm/model';
import { ScreenplayPdfDocumentLayout } from '../../../types';
import {
  ParsedScene,
  ParsingWarning,
  SceneIntExt,
  SceneTimeOfDay,
  SceneExtractionReviewState,
  CharacterAppearanceRecord,
  SceneManualOverrides,
  DialogueBlock,
} from '../../../services/screenplay/types';
import {
  hashString,
  normalizeSlugline,
  computeSceneContentHash,
  generateInitialSceneId,
} from '../../../services/screenplay/sceneIdentityService';
import { formatEighths } from '../../../services/screenplay/eighthsHelper';
import {
  ScreenplayPaginationResult,
  getPageNumberForPos,
} from '../layout/screenplayPaginationEngine';

export interface ParsedHeadingMetadata {
  originalHeading: string;
  explicitSceneNumber?: string;
  intExt: SceneIntExt;
  location: string;
  timeOfDay: SceneTimeOfDay;
  reviewReasons: string[];
}

export interface ScriptIntelligenceExtractionResult {
  sourceDocumentId: string;
  sourceDocFingerprint: string;
  extractedAt: string;
  scenes: ParsedScene[];
  characters: string[];
  locations: string[];
  totalScenes: number;
  totalPageEighths: number;
  totalPageCountDisplay: string;
  warnings: ParsingWarning[];
  needsReviewCount: number;
  manuallyCorrectedCount: number;
}

const TIME_OF_DAY_CANONICAL_MAP: Record<string, SceneTimeOfDay> = {
  DAY: 'DAY',
  DAYTIME: 'DAY',
  MIDDAY: 'DAY',
  NOON: 'DAY',
  NIGHT: 'NIGHT',
  NIGHTTIME: 'NIGHT',
  MIDNIGHT: 'NIGHT',
  'LATE NIGHT': 'NIGHT',
  DUSK: 'DUSK',
  SUNSET: 'DUSK',
  TWILIGHT: 'DUSK',
  'MAGIC HOUR': 'DUSK',
  DAWN: 'DAWN',
  SUNRISE: 'DAWN',
  DAYBREAK: 'DAWN',
  'EARLY MORNING': 'DAWN',
  MORNING: 'MORNING',
  EVENING: 'EVENING',
  AFTERNOON: 'AFTERNOON',
  'LATE AFTERNOON': 'AFTERNOON',
  CONTINUOUS: 'CONTINUOUS',
  'CONT.': 'CONTINUOUS',
  CONT: 'CONTINUOUS',
  'CONTINUOUS ACTION': 'CONTINUOUS',
  LATER: 'LATER',
  'MOMENTS LATER': 'LATER',
  'A MOMENT LATER': 'LATER',
  'SHORTLY AFTER': 'LATER',
  'SAME TIME': 'SAME TIME',
  SAME: 'SAME TIME',
  SIMULTANEOUS: 'SAME TIME',
};

const STANDARD_SPEECH_EXTENSIONS = new Set([
  'V.O.',
  'VO',
  'O.S.',
  'OS',
  'O.C.',
  'OC',
  "CONT'D",
  'CONTD',
  'CONTINUED',
  'CONT.',
  'CONT',
  'OVER RADIO',
  'INTO RADIO',
  'OVER COMM',
  'INTO COMM',
  'INTO HEADSET',
  'ON PHONE',
  'INTO PHONE',
  'ON MONITOR',
  'ON TV',
  'ON SCREEN',
  'FILTERED',
  'PRE-LAP',
  'PRELAP',
  'SUBTITLED',
]);

/**
 * Deterministically parses a Scene Heading string into INT./EXT., Location, and Time of Day
 * without mutating the original heading or guessing DAY when time of day is omitted.
 */
export function parseSceneHeadingMetadata(rawHeading: string): ParsedHeadingMetadata {
  const originalHeading = rawHeading.trim();
  const reviewReasons: string[] = [];

  if (!originalHeading) {
    return {
      originalHeading: 'UNTITLED SCENE',
      intExt: 'UNKNOWN',
      location: 'UNKNOWN LOCATION',
      timeOfDay: 'UNSPECIFIED',
      reviewReasons: ['Scene heading is empty'],
    };
  }

  let working = originalHeading;
  let explicitSceneNumber: string | undefined;

  // Strip optional leading scene number (e.g. "12 INT. OFFICE - DAY" or "4A. EXT. STREET")
  const leadingNumMatch = working.match(/^(\d+[A-Z]?)(?:\.|\s)+(?=[A-Z])/i);
  if (leadingNumMatch) {
    explicitSceneNumber = leadingNumMatch[1].toUpperCase();
    working = working.slice(leadingNumMatch[0].length).trim();
  }

  // Strip optional trailing duplicate scene number (e.g. "INT. OFFICE - DAY 12")
  if (explicitSceneNumber) {
    const trailingRegex = new RegExp(`\\s+${explicitSceneNumber}$`, 'i');
    working = working.replace(trailingRegex, '').trim();
  } else {
    const trailingNumMatch = working.match(/\s+#?(\d+[A-Z]?)#?$/i);
    if (trailingNumMatch) {
      explicitSceneNumber = trailingNumMatch[1].toUpperCase();
      working = working.slice(0, -trailingNumMatch[0].length).trim();
    }
  }

  // Strip forced Fountain leading dot if present
  if (working.startsWith('.') && !working.startsWith('..')) {
    working = working.slice(1).trim();
  }

  // 1. Identify INT./EXT. prefix
  let intExt: SceneIntExt = 'UNKNOWN';
  const intExtRegex =
    /^(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\s*\/\s*E\.?|INT\.|EXT\.|INTERIOR\.?|EXTERIOR\.?)(?=\s|$|-|—|–)/i;
  const prefixMatch = working.match(intExtRegex);

  if (prefixMatch) {
    const token = prefixMatch[1].toUpperCase().replace(/\s+/g, '');
    if (token.startsWith('I/E')) {
      intExt = 'I/E';
    } else if (token.includes('/')) {
      intExt = 'INT/EXT';
    } else if (token.startsWith('INT')) {
      intExt = 'INT';
    } else if (token.startsWith('EXT')) {
      intExt = 'EXT';
    }
    working = working.slice(prefixMatch[0].length).trim();
    // Strip leading separator immediately after INT./EXT. if writer typed "INT. - OFFICE"
    working = working.replace(/^[-—–:]+\s*/, '').trim();
  } else {
    reviewReasons.push('Unrecognized or missing INT./EXT. prefix');
  }

  // 2. Split remaining heading by dash separators (" - ", " — ", " – ", "--")
  const rawSegments = working
    .split(/\s*(?:--|—|–|\s-\s|-)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSegments.length === 0) {
    reviewReasons.push('Missing location in scene heading');
    reviewReasons.push('Unspecified time of day');
    return {
      originalHeading,
      explicitSceneNumber,
      intExt,
      location: 'UNKNOWN LOCATION',
      timeOfDay: 'UNSPECIFIED',
      reviewReasons,
    };
  }

  // Helper to check if a segment is a known Time of Day token
  const matchTimeOfDaySegment = (seg: string): SceneTimeOfDay | null => {
    const cleaned = seg
      .toUpperCase()
      .replace(/\([^)]*\)/g, '') // allow e.g. "NIGHT (FLASHBACK)"
      .replace(/[.!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (TIME_OF_DAY_CANONICAL_MAP[cleaned]) {
      return TIME_OF_DAY_CANONICAL_MAP[cleaned];
    }
    return null;
  };

  let timeOfDay: SceneTimeOfDay = 'UNSPECIFIED';
  const locationSegments = [...rawSegments];

  if (locationSegments.length >= 2) {
    const lastSeg = locationSegments[locationSegments.length - 1];
    const matchedLast = matchTimeOfDaySegment(lastSeg);

    if (matchedLast) {
      timeOfDay = matchedLast;
      locationSegments.pop();

      // If preceded by another time token like "DAY - CONTINUOUS", consume the secondary token too
      if (locationSegments.length >= 2) {
        const secondLast = locationSegments[locationSegments.length - 1];
        const matchedSecondLast = matchTimeOfDaySegment(secondLast);
        if (matchedSecondLast) {
          // Prefer specific time of day (e.g. DAY/NIGHT) if the trailing token was CONTINUOUS/LATER,
          // or keep the trailing token if more descriptive
          if (timeOfDay === 'CONTINUOUS' || timeOfDay === 'LATER') {
            timeOfDay = matchedSecondLast;
          }
          locationSegments.pop();
        }
      }
    }
  }

  const location =
    locationSegments.join(' - ').trim().toUpperCase() || 'UNKNOWN LOCATION';

  if (location === 'UNKNOWN LOCATION') {
    reviewReasons.push('Missing location in scene heading');
  }
  if (timeOfDay === 'UNSPECIFIED') {
    reviewReasons.push('Unspecified time of day');
  }

  return {
    originalHeading,
    explicitSceneNumber,
    intExt,
    location,
    timeOfDay,
    reviewReasons,
  };
}

/**
 * Normalizes a raw Character Cue string while preserving conservative ambiguity flags.
 * Never merges distinct characters automatically when identity is uncertain.
 */
export function normalizeCharacterCue(rawCue: string): {
  normalizedName: string;
  rawCue: string;
  isAmbiguous: boolean;
  ambiguityReason?: string;
} {
  const trimmed = rawCue.trim();
  if (!trimmed) {
    return {
      normalizedName: '',
      rawCue: trimmed,
      isAmbiguous: false,
    };
  }

  // Strip trailing dual dialogue caret
  let working = trimmed.replace(/\s*\^\s*$/, '').trim();
  let isAmbiguous = false;
  let ambiguityReason: string | undefined;

  // Extract parenthetical annotations at the end of the cue
  const parenMatches = Array.from(working.matchAll(/\(([^)]*)\)/g));
  for (const match of parenMatches) {
    const inside = match[1].trim().toUpperCase();
    if (STANDARD_SPEECH_EXTENSIONS.has(inside)) {
      working = working.replace(match[0], '').trim();
    } else {
      // Non-standard annotation e.g. "COLE (DISGUISED)" or "MARA (YOUNG)"
      // Strip standard age numbers like "(38)" or "(40s)" only if someone put them in a cue,
      // otherwise flag non-standard cue annotation for review while keeping base name
      if (/^\d+S?$/i.test(inside)) {
        working = working.replace(match[0], '').trim();
      } else {
        isAmbiguous = true;
        ambiguityReason = `Character cue "${trimmed}" includes non-standard annotation (${inside})`;
        working = working.replace(match[0], '').trim();
      }
    }
  }

  const normalizedName = working.replace(/\s+/g, ' ').trim().toUpperCase();

  // Check for compound / multi-speaker cue such as "MARA / JULIAN" or "GUARD 1 & GUARD 2"
  if (/[\/&]/.test(normalizedName) && !/^(I\/E|INT\/EXT)/.test(normalizedName)) {
    isAmbiguous = true;
    ambiguityReason = `Compound character cue "${trimmed}" may refer to multiple characters`;
  }

  return {
    normalizedName,
    rawCue: trimmed,
    isAmbiguous,
    ambiguityReason,
  };
}

/**
 * Consolidates character appearances within a single scene:
 * - Deduplicates repeated exact normalized names within the scene.
 * - Flags potential name-variant ambiguities (e.g., "MARA" vs "MARA VANCE" or "YOUNG MARA")
 *   without destructively merging them automatically.
 */
export function buildSceneCharacterAppearances(
  rawCuesInOrder: string[]
): {
  characters: string[];
  appearances: CharacterAppearanceRecord[];
  ambiguityReasons: string[];
} {
  const byName = new Map<string, CharacterAppearanceRecord>();
  const orderedNames: string[] = [];
  const ambiguityReasons: string[] = [];

  for (const rawCue of rawCuesInOrder) {
    const parsed = normalizeCharacterCue(rawCue);
    if (!parsed.normalizedName) continue;

    const existing = byName.get(parsed.normalizedName);
    if (existing) {
      existing.dialogueCount += 1;
      if (!existing.rawCues.includes(parsed.rawCue)) {
        existing.rawCues.push(parsed.rawCue);
      }
      if (parsed.isAmbiguous && !existing.isAmbiguous) {
        existing.isAmbiguous = true;
        existing.ambiguityReason = parsed.ambiguityReason;
      }
    } else {
      const record: CharacterAppearanceRecord = {
        normalizedName: parsed.normalizedName,
        rawCues: [parsed.rawCue],
        dialogueCount: 1,
        isAmbiguous: parsed.isAmbiguous,
        ambiguityReason: parsed.ambiguityReason,
      };
      byName.set(parsed.normalizedName, record);
      orderedNames.push(parsed.normalizedName);
      if (parsed.isAmbiguous && parsed.ambiguityReason) {
        ambiguityReasons.push(parsed.ambiguityReason);
      }
    }
  }

  // Conservative cross-cue check within the scene:
  // If two distinct cues share a multi-character token (e.g. "MARA VANCE" and "MARA", or "YOUNG COLE" and "COLE"),
  // do NOT merge them automatically, but flag them for review so the writer/producer can confirm.
  for (let i = 0; i < orderedNames.length; i++) {
    for (let j = i + 1; j < orderedNames.length; j++) {
      const nameA = orderedNames[i];
      const nameB = orderedNames[j];
      const tokensA = nameA.split(/\s+/).filter((t) => t.length >= 3);
      const tokensB = nameB.split(/\s+/).filter((t) => t.length >= 3);
      const IgnoredTitles = new Set([
        'THE',
        'AND',
        'MAN',
        'WOMAN',
        'BOY',
        'GIRL',
        'GUARD',
        'COP',
        'OFFICER',
        'DOCTOR',
        'DETECTIVE',
        'AGENT',
        'CAPTAIN',
        'DIRECTOR',
        'YOUNG',
        'OLD',
      ]);
      const sharedProperTokens = tokensA.filter(
        (t) => !IgnoredTitles.has(t) && tokensB.includes(t)
      );
      if (sharedProperTokens.length > 0) {
        const reason = `Possible character name variants in scene: "${nameA}" and "${nameB}"`;
        if (!ambiguityReasons.includes(reason)) {
          ambiguityReasons.push(reason);
        }
        const recA = byName.get(nameA);
        const recB = byName.get(nameB);
        if (recA) {
          recA.isAmbiguous = true;
          recA.ambiguityReason = recA.ambiguityReason || reason;
        }
        if (recB) {
          recB.isAmbiguous = true;
          recB.ambiguityReason = recB.ambiguityReason || reason;
        }
      }
    }
  }

  return {
    characters: orderedNames,
    appearances: orderedNames.map((n) => byName.get(n)!),
    ambiguityReasons,
  };
}

interface NormalizedBlockEntry {
  type: string;
  text: string;
  pos: number;
  nodeSize: number;
  pageNumber?: number;
  dualChildren?: Array<{ type: string; text: string }>;
}

/**
 * Converts either a ProseMirror PMNode, serialized Tiptap JSONContent,
 * ScreenplayPdfDocumentLayout, or raw screenplay text into a uniform list of semantic blocks.
 */
function normalizeDocumentBlocks(
  docSource: PMNode | JSONContent | string | ScreenplayPdfDocumentLayout | null | undefined
): NormalizedBlockEntry[] {
  if (!docSource) return [];

  // 1. ScreenplayPdfDocumentLayout (faithful PDF import and editing mode)
  if (
    typeof docSource === 'object' &&
    docSource !== null &&
    'pages' in docSource &&
    Array.isArray((docSource as any).pages)
  ) {
    const pdf = docSource as ScreenplayPdfDocumentLayout;
    const entries: NormalizedBlockEntry[] = [];
    let runningOffset = 0;
    for (const page of pdf.pages) {
      for (const line of page.lines || []) {
        const text = line.text || '';
        const nodeSize = text.length + 1;
        entries.push({
          type: line.type || 'action',
          text,
          pos: runningOffset + 1,
          nodeSize,
          pageNumber: page.pageNumber,
        });
        runningOffset += nodeSize;
      }
    }
    return entries;
  }

  // 2. Live ProseMirror PMNode
  if (typeof (docSource as PMNode).forEach === 'function' && (docSource as PMNode).type) {
    const pmDoc = docSource as PMNode;
    const entries: NormalizedBlockEntry[] = [];
    pmDoc.forEach((node, offset) => {
      const type = node.type.name;
      if (type === 'dualDialogue') {
        const dualChildren: Array<{ type: string; text: string }> = [];
        node.forEach((col) => {
          col.forEach((child) => {
            dualChildren.push({
              type: child.type.name,
              text: child.textContent,
            });
          });
        });
        entries.push({
          type,
          text: node.textContent,
          pos: offset + 1,
          nodeSize: node.nodeSize,
          dualChildren,
        });
      } else {
        entries.push({
          type,
          text: node.textContent,
          pos: offset + 1,
          nodeSize: node.nodeSize,
        });
      }
    });
    return entries;
  }

  // 3. JSONContent or JSON string / fallback to raw text
  let parsedJson: JSONContent | null = null;
  if (typeof docSource === 'string') {
    try {
      parsedJson = JSON.parse(docSource) as JSONContent;
    } catch {
      // Plain text or Fountain text fallback
      const lines = docSource.split('\n');
      const entries: NormalizedBlockEntry[] = [];
      let runningOffset = 0;
      let prevType = 'action';
      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        const nodeSize = rawLine.length + 1;
        if (!trimmed) {
          runningOffset += nodeSize;
          continue;
        }
        let type = 'action';
        if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed)) {
          type = 'sceneHeading';
        } else if (/^ACT\s+[0-9IVXLCDM]+/i.test(trimmed)) {
          type = 'actHeading';
        } else if (/^(FADE IN|FADE OUT|CUT TO|DISSOLVE TO|SMASH CUT):?$/i.test(trimmed)) {
          type = 'transition';
        } else if (/^\(.*\)$/.test(trimmed)) {
          type = 'parenthetical';
        } else if (
          /^[A-Z0-9\s._'-]+(\s*\(.*\))?$/.test(trimmed) &&
          trimmed.length < 35 &&
          !trimmed.endsWith('.')
        ) {
          type = 'character';
        } else if (prevType === 'character' || prevType === 'parenthetical') {
          type = 'dialogue';
        }
        prevType = type;
        entries.push({
          type,
          text: rawLine,
          pos: runningOffset + 1,
          nodeSize,
        });
        runningOffset += nodeSize;
      }
      return entries;
    }
  } else {
    parsedJson = docSource as JSONContent;
  }

  if (!parsedJson || !Array.isArray(parsedJson.content)) return [];

  const getText = (n: JSONContent): string => {
    if (typeof n.text === 'string') return n.text;
    if (!Array.isArray(n.content)) return '';
    return n.content.map(getText).join('');
  };

  const entries: NormalizedBlockEntry[] = [];
  let runningOffset = 0;

  for (const node of parsedJson.content) {
    if (!node || typeof node.type !== 'string') continue;
    const text = getText(node);
    const nodeSize = text.length + 2;

    if (node.type === 'dualDialogue' && Array.isArray(node.content)) {
      const dualChildren: Array<{ type: string; text: string }> = [];
      for (const col of node.content) {
        for (const child of col.content ?? []) {
          if (child && typeof child.type === 'string') {
            dualChildren.push({
              type: child.type,
              text: getText(child),
            });
          }
        }
      }
      entries.push({
        type: 'dualDialogue',
        text,
        pos: runningOffset + 1,
        nodeSize,
        dualChildren,
      });
    } else {
      entries.push({
        type: node.type,
        text,
        pos: runningOffset + 1,
        nodeSize,
      });
    }
    runningOffset += nodeSize;
  }

  return entries;
}

/**
 * Computes the overall review state for a scene based on its extraction reasons,
 * manual overrides, and explicit review status.
 */
export function resolveSceneReviewState(params: {
  manualOverrides?: SceneManualOverrides;
  status?: ParsedScene['status'];
  reviewReasons?: string[];
  isAmbiguousMatch?: boolean;
}): SceneExtractionReviewState {
  const { manualOverrides, status, reviewReasons = [], isAmbiguousMatch } = params;
  const hasManualOverrides =
    Boolean(manualOverrides) &&
    (manualOverrides?.intExt !== undefined ||
      manualOverrides?.location !== undefined ||
      manualOverrides?.timeOfDay !== undefined ||
      manualOverrides?.characters !== undefined);

  if (isAmbiguousMatch) {
    return 'needs_review';
  }
  if (hasManualOverrides) {
    return 'manually_corrected';
  }
  if (status === 'reviewed' || status === 'locked') {
    return 'reviewed';
  }
  if (reviewReasons.length > 0) {
    return 'needs_review';
  }
  return 'extracted';
}

/**
 * Reconciles newly extracted scenes from the active screenplay document against prior
 * scenes so that stable IDs, manual metadata corrections, and review states are preserved
 * across document edits unless a change is genuinely ambiguous.
 */
export function reconcileExtractedScenes(
  extractedScenes: ParsedScene[],
  priorScenes: ParsedScene[] = [],
  sourceDocumentId: string = 'working-draft'
): { scenes: ParsedScene[]; warnings: ParsingWarning[] } {
  if (!priorScenes || priorScenes.length === 0) {
    return { scenes: extractedScenes, warnings: [] };
  }

  // Only reconcile against prior scenes belonging to the same screenplay document (or legacy unscoped scenes)
  const compatiblePrior = priorScenes.filter(
    (p) => !p.sourceDocumentId || p.sourceDocumentId === sourceDocumentId
  );
  if (compatiblePrior.length === 0) {
    return { scenes: extractedScenes, warnings: [] };
  }

  const matchedPriorIds = new Set<string>();
  const warnings: ParsingWarning[] = [];

  const priorMeta = compatiblePrior.map((p, index) => ({
    scene: p,
    index,
    normSlug: normalizeSlugline(p.originalHeading || p.slugline || ''),
    contentHash: p.contentHash || computeSceneContentHash(p),
    extractedLocation: (p.extractedLocation || p.location || '').toUpperCase(),
    charSet: new Set((p.extractedCharacters || p.characters || []).map((c) => c.toUpperCase())),
  }));

  const reconciled: ParsedScene[] = extractedScenes.map((inc, idx) => {
    const incNormSlug = normalizeSlugline(inc.originalHeading || inc.slugline || '');
    const incHash = inc.contentHash || computeSceneContentHash(inc);
    const incChars = new Set((inc.extractedCharacters || inc.characters || []).map((c) => c.toUpperCase()));

    // 1. Exact content hash + slugline match
    const exactMatches = priorMeta.filter(
      (p) =>
        !matchedPriorIds.has(p.scene.id) &&
        p.contentHash === incHash &&
        p.normSlug === incNormSlug
    );

    // 2. Same normalized slugline + same scene number
    const slugAndNumMatches = priorMeta.filter(
      (p) =>
        !matchedPriorIds.has(p.scene.id) &&
        p.normSlug === incNormSlug &&
        p.scene.sceneNumber === inc.sceneNumber
    );

    // 3. Same normalized slugline + character overlap
    const slugAndCharMatches = priorMeta.filter((p) => {
      if (matchedPriorIds.has(p.scene.id) || p.normSlug !== incNormSlug) return false;
      if (p.charSet.size === 0 && incChars.size === 0) return true;
      let shared = 0;
      p.charSet.forEach((c) => {
        if (incChars.has(c)) shared += 1;
      });
      return shared > 0;
    });

    // 4. Same ordinal position + strong character/dialogue overlap (when writer edits the scene heading itself!)
    const positionalMatches = priorMeta.filter((p) => {
      if (matchedPriorIds.has(p.scene.id)) return false;
      if (p.index !== idx || compatiblePrior.length !== extractedScenes.length) {
        return false;
      }
      if (p.charSet.size > 0 && incChars.size > 0) {
        let shared = 0;
        p.charSet.forEach((c) => {
          if (incChars.has(c)) shared += 1;
        });
        return shared > 0;
      }
      return (
        Boolean(p.scene.actionSnippet) &&
        p.scene.actionSnippet === inc.actionSnippet
      );
    });

    let matched: (typeof priorMeta)[0] | null = null;
    let isAmbiguous = false;

    if (exactMatches.length === 1) {
      matched = exactMatches[0];
    } else if (exactMatches.length > 1) {
      isAmbiguous = true;
    } else if (slugAndNumMatches.length === 1) {
      matched = slugAndNumMatches[0];
    } else if (slugAndNumMatches.length > 1) {
      isAmbiguous = true;
    } else if (slugAndCharMatches.length === 1) {
      matched = slugAndCharMatches[0];
    } else if (slugAndCharMatches.length > 1) {
      isAmbiguous = true;
    } else if (positionalMatches.length === 1) {
      matched = positionalMatches[0];
    }

    if (isAmbiguous) {
      const ambigReason =
        'Multiple scenes match this heading after document edits; verify metadata.';
      const nextReasons = [...(inc.reviewReasons || []), ambigReason];
      warnings.push({
        id: `ambig-reconcile-${inc.sceneNumber}-${idx}`,
        sceneNumber: inc.sceneNumber,
        severity: 'warning',
        message: `Scene ${inc.sceneNumber} (${inc.slugline}) matched multiple prior scenes ambiguously.`,
      });
      return {
        ...inc,
        isAmbiguousMatch: true,
        reviewReasons: nextReasons,
        reviewState: 'needs_review',
        status: 'unreviewed',
      };
    }

    if (!matched) {
      return inc;
    }

    matchedPriorIds.add(matched.scene.id);
    const prior = matched.scene;
    const overrides = prior.manualOverrides;

    // Apply preserved manual overrides on top of fresh deterministic extraction
    const effectiveIntExt = overrides?.intExt ?? inc.extractedIntExt ?? inc.intExt;
    const effectiveLocation =
      overrides?.location ?? inc.extractedLocation ?? inc.location;
    const effectiveTimeOfDay =
      overrides?.timeOfDay ?? inc.extractedTimeOfDay ?? inc.timeOfDay;
    const effectiveCharacters =
      overrides?.characters ?? inc.extractedCharacters ?? inc.characters;

    // Filter out review reasons that were resolved by manual overrides
    const remainingReasons = (inc.reviewReasons || []).filter((reason) => {
      if (
        overrides?.intExt &&
        overrides.intExt !== 'UNKNOWN' &&
        reason.includes('INT./EXT.')
      ) {
        return false;
      }
      if (
        overrides?.location &&
        overrides.location !== 'UNKNOWN LOCATION' &&
        reason.includes('location')
      ) {
        return false;
      }
      if (
        overrides?.timeOfDay &&
        overrides.timeOfDay !== 'UNSPECIFIED' &&
        reason.includes('time of day')
      ) {
        return false;
      }
      if (overrides?.characters && reason.includes('character')) {
        return false;
      }
      return true;
    });

    const preservedStatus = prior.status || inc.status;
    const nextReviewState = resolveSceneReviewState({
      manualOverrides: overrides,
      status: preservedStatus,
      reviewReasons: remainingReasons,
      isAmbiguousMatch: false,
    });

    return {
      ...inc,
      id: prior.id,
      intExt: effectiveIntExt,
      location: effectiveLocation,
      timeOfDay: effectiveTimeOfDay,
      characters: effectiveCharacters,
      manualOverrides: overrides,
      elements: prior.elements?.length ? prior.elements : inc.elements,
      notes: prior.notes ?? inc.notes,
      status: preservedStatus,
      reviewReasons: remainingReasons,
      reviewState: nextReviewState,
      isAmbiguousMatch: false,
    };
  });

  return { scenes: reconciled, warnings };
}

/**
 * Authoritative Script Intelligence Extraction Pipeline:
 * Converts the active screenplay document (ProseMirror PMNode or JSONContent) into
 * structured, reviewable scene records with source traceability and reconciliation.
 */
export function extractScriptIntelligenceFromDoc(params: {
  doc: PMNode | JSONContent | string | null | undefined;
  sourceDocumentId?: string;
  pagination?: ScreenplayPaginationResult | null;
  priorScenes?: ParsedScene[];
  format?: string;
}): ScriptIntelligenceExtractionResult {
  const {
    doc,
    sourceDocumentId = 'working-draft',
    pagination = null,
    priorScenes = [],
    format = 'fountain',
  } = params;

  const extractedAt = new Date().toISOString();
  const blocks = normalizeDocumentBlocks(doc);
  const fingerprintPayload = blocks.map((b) => `${b.type}:${b.text}`).join('\n');
  const sourceDocFingerprint = hashString(fingerprintPayload);

  const rawScenes: ParsedScene[] = [];
  const warnings: ParsingWarning[] = [];

  let currentAct: string | undefined;
  let currentSequence: string | undefined;

  interface WorkingSceneAccumulator {
    sceneIndex: number;
    headingText: string;
    headingPos: number;
    endPos: number;
    startPage?: number;
    endPage?: number;
    actHeading?: string;
    sequenceHeading?: string;
    actionLines: string[];
    rawCharacterCues: string[];
    dialogueBlocks: DialogueBlock[];
    activeSpeaker: string | null;
    activeParenthetical: string | undefined;
    shotHeadings: string[];
    transitions: string[];
    notes: string[];
    blockCount: number;
    textLineEstimate: number;
  }

  let currentScene: WorkingSceneAccumulator | null = null;
  let sceneCounter = 0;

  const finalizeAccumulator = (acc: WorkingSceneAccumulator): ParsedScene => {
    const headingMeta = parseSceneHeadingMetadata(acc.headingText);
    const charResult = buildSceneCharacterAppearances(acc.rawCharacterCues);
    const reviewReasons = [
      ...headingMeta.reviewReasons,
      ...charResult.ambiguityReasons,
    ];

    const sceneNumber =
      headingMeta.explicitSceneNumber || String(acc.sceneIndex);

    // Compute start page and eighths from pagination engine when available
    let startPage = acc.startPage || 1;
    let endPage = acc.endPage || startPage;
    if (pagination && pagination.pages.length > 0) {
      startPage = getPageNumberForPos(pagination, acc.headingPos);
      endPage = getPageNumberForPos(pagination, Math.max(acc.headingPos, acc.endPos));
    }

    const estimatedEighthsFromLines = Math.max(
      1,
      Math.round((acc.textLineEstimate / 54) * 8)
    );
    const pageSpanEighths =
      endPage > startPage
        ? Math.max((endPage - startPage) * 8, estimatedEighthsFromLines)
        : estimatedEighthsFromLines;

    const actionSnippet = acc.actionLines.join(' ').trim().slice(0, 180);
    const synopsis = actionSnippet || acc.dialogueBlocks[0]?.text?.slice(0, 140) || '';

    const contentHash = computeSceneContentHash({
      slugline: headingMeta.originalHeading,
      characters: charResult.characters,
      dialogueBlocks: acc.dialogueBlocks,
      actionSnippet,
    });

    const initialId = generateInitialSceneId(
      format,
      headingMeta.originalHeading,
      contentHash,
      acc.sceneIndex - 1
    );

    const reviewState = resolveSceneReviewState({
      reviewReasons,
      status: 'unreviewed',
    });

    return {
      id: initialId,
      sceneNumber,
      slugline: headingMeta.originalHeading,
      originalHeading: headingMeta.originalHeading,
      intExt: headingMeta.intExt,
      location: headingMeta.location,
      timeOfDay: headingMeta.timeOfDay,
      extractedIntExt: headingMeta.intExt,
      extractedLocation: headingMeta.location,
      extractedTimeOfDay: headingMeta.timeOfDay,
      extractedCharacters: charResult.characters,
      pageLengthEighths: pageSpanEighths,
      pageLengthDisplay: formatEighths(pageSpanEighths),
      startPage,
      estimatedDurationMinutes: Math.max(
        0.25,
        Math.round((pageSpanEighths / 8) * 100) / 100
      ),
      synopsis,
      characters: charResult.characters,
      characterAppearances: charResult.appearances,
      dialogueBlocks: acc.dialogueBlocks,
      actionSnippet,
      elements: charResult.characters.map((name, i) => ({
        id: `el-char-${initialId}-${i}`,
        category: 'character',
        name,
      })),
      status: 'unreviewed',
      notes: acc.notes.length > 0 ? acc.notes.join(' | ') : undefined,
      sourcePos: acc.headingPos,
      endPos: acc.endPos,
      sourceDocumentId,
      sourceDocFingerprint,
      extractedAt,
      reviewState,
      reviewReasons,
      actHeading: acc.actHeading,
      sequenceHeading: acc.sequenceHeading,
      shotHeadings: acc.shotHeadings,
      transitions: acc.transitions,
      contentHash,
      isAmbiguousMatch: false,
    };
  };

  for (const block of blocks) {
    const trimmed = block.text.trim();

    if (block.type === 'actHeading') {
      if (trimmed) currentAct = trimmed;
      continue;
    }
    if (block.type === 'endAct') {
      continue;
    }
    if (block.type === 'sequenceHeading') {
      if (trimmed) currentSequence = trimmed;
      continue;
    }

    // Scene boundaries are identified strictly from semantic sceneHeading elements
    if (block.type === 'sceneHeading' || block.type === 'scene_heading') {
      if (currentScene) {
        rawScenes.push(finalizeAccumulator(currentScene));
      }
      sceneCounter += 1;
      currentScene = {
        sceneIndex: sceneCounter,
        headingText: trimmed || 'UNTITLED SCENE',
        headingPos: block.pos,
        endPos: block.pos + block.nodeSize,
        startPage: block.pageNumber || 1,
        endPage: block.pageNumber || 1,
        actHeading: currentAct,
        sequenceHeading: currentSequence,
        actionLines: [],
        rawCharacterCues: [],
        dialogueBlocks: [],
        activeSpeaker: null,
        activeParenthetical: undefined,
        shotHeadings: [],
        transitions: [],
        notes: [],
        blockCount: 1,
        textLineEstimate: 2,
      };
      continue;
    }

    // Do not invent a scene from ordinary Action or Dialogue before the first Scene Heading
    if (!currentScene) {
      continue;
    }

    currentScene.endPos = block.pos + block.nodeSize;
    if (block.pageNumber) {
      currentScene.endPage = block.pageNumber;
    }
    currentScene.blockCount += 1;
    const approxLines = Math.max(1, Math.ceil((trimmed.length || 1) / 55)) + 1;
    currentScene.textLineEstimate += approxLines;

    if (block.type === 'dualDialogue' && block.dualChildren) {
      let dualSpeaker: string | null = null;
      let dualParen: string | undefined;
      for (const child of block.dualChildren) {
        const cText = child.text.trim();
        if (!cText) continue;
        if (child.type === 'character') {
          currentScene.rawCharacterCues.push(cText);
          dualSpeaker = normalizeCharacterCue(cText).normalizedName || cText;
          dualParen = undefined;
        } else if (child.type === 'parenthetical') {
          dualParen = cText;
        } else if (child.type === 'dialogue' && dualSpeaker) {
          currentScene.dialogueBlocks.push({
            character: dualSpeaker,
            parenthetical: dualParen,
            text: cText,
          });
          dualParen = undefined;
        }
      }
      continue;
    }

    if (!trimmed) continue;

    switch (block.type) {
      case 'action':
      case 'generalText':
      case 'lyrics':
        currentScene.actionLines.push(trimmed);
        currentScene.activeSpeaker = null;
        currentScene.activeParenthetical = undefined;
        break;
      case 'character': {
        currentScene.rawCharacterCues.push(trimmed);
        const norm = normalizeCharacterCue(trimmed).normalizedName;
        currentScene.activeSpeaker = norm || trimmed;
        currentScene.activeParenthetical = undefined;
        break;
      }
      case 'parenthetical':
        currentScene.activeParenthetical = trimmed;
        break;
      case 'dialogue':
        if (currentScene.activeSpeaker) {
          currentScene.dialogueBlocks.push({
            character: currentScene.activeSpeaker,
            parenthetical: currentScene.activeParenthetical,
            text: trimmed,
          });
          currentScene.activeParenthetical = undefined;
        }
        break;
      case 'shot':
        currentScene.shotHeadings.push(trimmed);
        break;
      case 'transition':
        currentScene.transitions.push(trimmed);
        break;
      case 'screenplayNote':
        currentScene.notes.push(trimmed);
        break;
      default:
        break;
    }
  }

  if (currentScene) {
    rawScenes.push(finalizeAccumulator(currentScene));
  }

  // Reconcile with prior scenes from the same document to preserve stable IDs and manual corrections
  const reconciled = reconcileExtractedScenes(
    rawScenes,
    priorScenes,
    sourceDocumentId
  );
  const finalScenes = reconciled.scenes;
  warnings.push(...reconciled.warnings);

  for (const scene of finalScenes) {
    if (scene.reviewReasons && scene.reviewReasons.length > 0) {
      for (const reason of scene.reviewReasons) {
        warnings.push({
          id: `warn-${scene.id}-${hashString(reason)}`,
          sceneNumber: scene.sceneNumber,
          severity: 'warning',
          message: `Scene ${scene.sceneNumber}: ${reason}`,
        });
      }
    }
  }

  const totalPageEighths = finalScenes.reduce(
    (sum, s) => sum + (s.pageLengthEighths || 0),
    0
  );
  const allCharacters = Array.from(
    new Set(finalScenes.flatMap((s) => s.characters || []))
  );
  const allLocations = Array.from(
    new Set(
      finalScenes
        .map((s) => s.location)
        .filter((loc) => Boolean(loc) && loc !== 'UNKNOWN LOCATION')
    )
  );

  const needsReviewCount = finalScenes.filter(
    (s) => s.reviewState === 'needs_review'
  ).length;
  const manuallyCorrectedCount = finalScenes.filter(
    (s) => s.reviewState === 'manually_corrected'
  ).length;

  return {
    sourceDocumentId,
    sourceDocFingerprint,
    extractedAt,
    scenes: finalScenes,
    characters: allCharacters,
    locations: allLocations,
    totalScenes: finalScenes.length,
    totalPageEighths,
    totalPageCountDisplay: formatEighths(Math.max(8, totalPageEighths)),
    warnings,
    needsReviewCount,
    manuallyCorrectedCount,
  };
}

/**
 * Applies a user's manual metadata correction to a specific scene without mutating
 * the original screenplay heading or dialogue text.
 */
export function applySceneManualOverride(
  scenes: ParsedScene[],
  sceneId: string,
  patch: Partial<SceneManualOverrides> & { markReviewed?: boolean }
): ParsedScene[] {
  const nowIso = new Date().toISOString();

  return scenes.map((scene) => {
    if (scene.id !== sceneId) return scene;

    const existingOverrides: SceneManualOverrides = {
      ...(scene.manualOverrides || {}),
    };

    if (patch.intExt !== undefined) {
      existingOverrides.intExt = patch.intExt;
    }
    if (patch.location !== undefined) {
      existingOverrides.location = patch.location.trim().toUpperCase();
    }
    if (patch.timeOfDay !== undefined) {
      existingOverrides.timeOfDay = patch.timeOfDay;
    }
    if (patch.characters !== undefined) {
      existingOverrides.characters = Array.from(
        new Set(
          patch.characters
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean)
        )
      );
    }
    existingOverrides.correctedAt = nowIso;

    const nextIntExt =
      existingOverrides.intExt ?? scene.extractedIntExt ?? scene.intExt;
    const nextLocation =
      existingOverrides.location ?? scene.extractedLocation ?? scene.location;
    const nextTimeOfDay =
      existingOverrides.timeOfDay ?? scene.extractedTimeOfDay ?? scene.timeOfDay;
    const nextCharacters =
      existingOverrides.characters ??
      scene.extractedCharacters ??
      scene.characters;

    // Clear review reasons that have now been manually resolved
    const remainingReasons = (scene.reviewReasons || []).filter((reason) => {
      if (
        existingOverrides.intExt &&
        existingOverrides.intExt !== 'UNKNOWN' &&
        reason.includes('INT./EXT.')
      ) {
        return false;
      }
      if (
        existingOverrides.location &&
        existingOverrides.location !== 'UNKNOWN LOCATION' &&
        reason.includes('location')
      ) {
        return false;
      }
      if (
        existingOverrides.timeOfDay &&
        existingOverrides.timeOfDay !== 'UNSPECIFIED' &&
        reason.includes('time of day')
      ) {
        return false;
      }
      if (existingOverrides.characters && reason.includes('character')) {
        return false;
      }
      return true;
    });

    const nextStatus = patch.markReviewed ? 'reviewed' : scene.status;
    const nextReviewState = resolveSceneReviewState({
      manualOverrides: existingOverrides,
      status: nextStatus,
      reviewReasons: remainingReasons,
      isAmbiguousMatch: false,
    });

    return {
      ...scene,
      intExt: nextIntExt,
      location: nextLocation,
      timeOfDay: nextTimeOfDay,
      characters: nextCharacters,
      manualOverrides: existingOverrides,
      status: nextStatus,
      isAmbiguousMatch: false,
      reviewReasons: remainingReasons,
      reviewState: nextReviewState,
    };
  });
}

/**
 * Resets a scene's manual metadata overrides back to its deterministic extracted values.
 */
export function resetSceneManualOverride(
  scenes: ParsedScene[],
  sceneId: string
): ParsedScene[] {
  return scenes.map((scene) => {
    if (scene.id !== sceneId) return scene;

    const restoredHeading = parseSceneHeadingMetadata(
      scene.originalHeading || scene.slugline
    );
    const restoredIntExt = scene.extractedIntExt ?? restoredHeading.intExt;
    const restoredLocation = scene.extractedLocation ?? restoredHeading.location;
    const restoredTimeOfDay =
      scene.extractedTimeOfDay ?? restoredHeading.timeOfDay;
    const restoredCharacters = scene.extractedCharacters ?? scene.characters;

    const nextReasons = [...restoredHeading.reviewReasons];
    const nextReviewState = resolveSceneReviewState({
      manualOverrides: undefined,
      status: 'unreviewed',
      reviewReasons: nextReasons,
      isAmbiguousMatch: false,
    });

    return {
      ...scene,
      intExt: restoredIntExt,
      location: restoredLocation,
      timeOfDay: restoredTimeOfDay,
      characters: restoredCharacters,
      manualOverrides: undefined,
      status: 'unreviewed',
      reviewReasons: nextReasons,
      reviewState: nextReviewState,
    };
  });
}

/**
 * Toggles a scene's review confirmation state ('reviewed' vs 'unreviewed').
 */
export function toggleSceneReviewedStatus(
  scenes: ParsedScene[],
  sceneId: string
): ParsedScene[] {
  return scenes.map((scene) => {
    if (scene.id !== sceneId) return scene;
    const nextStatus = scene.status === 'reviewed' ? 'unreviewed' : 'reviewed';
    const nextReviewState =
      nextStatus === 'reviewed' && !scene.manualOverrides
        ? 'reviewed'
        : resolveSceneReviewState({
            manualOverrides: scene.manualOverrides,
            status: nextStatus,
            reviewReasons: scene.reviewReasons,
            isAmbiguousMatch: false,
          });
    return {
      ...scene,
      status: nextStatus,
      isAmbiguousMatch: false,
      reviewState: nextReviewState,
    };
  });
}

export interface SceneMatrixFilterCriteria {
  searchQuery?: string;
  intExt?: string; // 'ALL' | SceneIntExt
  location?: string; // 'ALL' | string
  timeOfDay?: string; // 'ALL' | SceneTimeOfDay
  character?: string; // 'ALL' | string
  reviewState?: string; // 'ALL' | SceneExtractionReviewState
}

/**
 * Filters extracted scenes by search query (scene number, heading, location),
 * INT./EXT., location, time of day, character, and review state.
 */
export function filterExtractedScenes(
  scenes: ParsedScene[],
  criteria: SceneMatrixFilterCriteria
): ParsedScene[] {
  const q = (criteria.searchQuery || '').trim().toLowerCase();
  const intExtFilter = criteria.intExt && criteria.intExt !== 'ALL' ? criteria.intExt : null;
  const locFilter = criteria.location && criteria.location !== 'ALL' ? criteria.location : null;
  const todFilter = criteria.timeOfDay && criteria.timeOfDay !== 'ALL' ? criteria.timeOfDay : null;
  const charFilter = criteria.character && criteria.character !== 'ALL' ? criteria.character : null;
  const stateFilter =
    criteria.reviewState && criteria.reviewState !== 'ALL' ? criteria.reviewState : null;

  return scenes.filter((scene) => {
    if (intExtFilter && scene.intExt !== intExtFilter) return false;
    if (locFilter && scene.location !== locFilter) return false;
    if (todFilter && scene.timeOfDay !== todFilter) return false;
    if (charFilter && !(scene.characters || []).includes(charFilter)) return false;
    if (stateFilter && (scene.reviewState || 'extracted') !== stateFilter) return false;

    if (q) {
      const haystack = [
        scene.sceneNumber,
        `#${scene.sceneNumber}`,
        scene.originalHeading || scene.slugline,
        scene.location,
        scene.timeOfDay,
        ...(scene.characters || []),
        scene.actHeading,
        scene.sequenceHeading,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}
