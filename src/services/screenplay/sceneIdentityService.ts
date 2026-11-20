/**
 * SceneOS — Screenplay Scene Identity & Revision Reconciliation Service
 * 
 * Provides stable composite IDs for screenplay scenes and a conservative,
 * ambiguity-safe reconciliation engine that matches prior draft scenes to new drafts.
 * 
 * Principle: The original screenplay is the source of truth. Scene identity must not
 * shift when scenes are inserted or deleted, and dependent breakdown records must
 * NEVER be silently misassociated when scene numbering or sluglines are ambiguous.
 */

import { ParsedScene, ParsingWarning } from './types';

/**
 * Fast, deterministic, non-cryptographic 32-bit hash (MurmurHash3 implementation).
 * Browser-safe and collision-resistant for script strings.
 */
export function hashString(key: string, seed: number = 0): string {
  let remainder = key.length & 3;
  let bytes = key.length - remainder;
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    const h1b = (((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16)) & 0xffffffff;
    h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
  }

  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
      // falls through
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
      // falls through
    case 1:
      k1 ^= key.charCodeAt(i) & 0xff;
      k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = (((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return (h1 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Normalizes slugline text for invariant matching (strips superfluous punctuation, spacing).
 */
export function normalizeSlugline(slug: string): string {
  return slug
    .toUpperCase()
    .replace(/^(?:\.|\s)+/, '')
    .replace(/[^\w\s\-\/\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a content signature hash based on invariant scene dialogue and action content.
 */
export function computeSceneContentHash(scene: {
  slugline: string;
  characters?: string[];
  dialogueBlocks?: Array<{ character: string; text: string }>;
  actionSnippet?: string;
}): string {
  const normSlug = normalizeSlugline(scene.slugline || '');
  const chars = (scene.characters || []).slice().sort().join(',');
  const dialogues = (scene.dialogueBlocks || [])
    .map(d => `${d.character}:${d.text.replace(/\s+/g, ' ').trim()}`)
    .join('|');
  const action = (scene.actionSnippet || '').replace(/\s+/g, ' ').trim().slice(0, 100);

  const payload = `${normSlug}#${chars}#${dialogues}#${action}`;
  return hashString(payload);
}

/**
 * Generates an initial stable ID for a newly extracted scene if it doesn't already have one.
 * Uses format prefix + content hash + disambiguation index if needed.
 */
export function generateInitialSceneId(
  format: string,
  slugline: string,
  contentHash: string,
  occurrenceIndex: number = 0
): string {
  const cleanFormat = format.toLowerCase().slice(0, 4);
  const disambiguation = occurrenceIndex > 0 ? `-${occurrenceIndex}` : '';
  return `scn-${cleanFormat}-${contentHash}${disambiguation}`;
}

export interface SceneReconciliationResult {
  reconciledScenes: ParsedScene[];
  reconciliationWarnings: ParsingWarning[];
  matchedCount: number;
  newScenesCount: number;
  ambiguousCount: number;
  deletedSceneIds: string[];
}

/**
 * Conservative revision reconciliation:
 * Matches prior scenes to revised incoming scenes without blindly trusting scene numbers.
 * 
 * Rules:
 * 1. If prior scene has exact same contentHash and normalized slugline, and match is unique:
 *    -> PRESERVE previous scene ID, review status, and attached breakdown elements!
 * 2. If prior scene has exact same sceneNumber, slugline, and high character overlap, and match is unique:
 *    -> PRESERVE previous scene ID and elements.
 * 3. If multiple prior scenes match a new scene or multiple new scenes match a prior scene (ambiguous):
 *    -> DO NOT silently attach dependent records.
 *    -> Assign a new scene ID.
 *    -> Mark scene status as 'unreviewed'.
 *    -> Emit a high-visibility warning flagging the scene for manual human review.
 * 4. Any newly inserted scene gets a deterministic stable ID.
 */
export function reconcileSceneRevisions(
  incomingScenes: ParsedScene[],
  priorScenes: ParsedScene[] = [],
  format: string = 'txt'
): SceneReconciliationResult {
  if (!priorScenes || priorScenes.length === 0) {
    // First version: assign stable IDs and content hashes
    const scenesWithStableIds = incomingScenes.map((scene, idx) => {
      const contentHash = computeSceneContentHash(scene);
      const stableId = scene.id && !scene.id.match(/^[a-z]+-scn-\d+$/)
        ? scene.id
        : generateInitialSceneId(format, scene.slugline, contentHash, idx);

      return {
        ...scene,
        id: stableId,
        contentHash,
        status: scene.status || 'unreviewed',
      };
    });

    return {
      reconciledScenes: scenesWithStableIds,
      reconciliationWarnings: [],
      matchedCount: 0,
      newScenesCount: incomingScenes.length,
      ambiguousCount: 0,
      deletedSceneIds: [],
    };
  }

  const reconciliationWarnings: ParsingWarning[] = [];
  const matchedPriorIds = new Set<string>();
  let matchedCount = 0;
  let ambiguousCount = 0;

  // Prepare prior scenes with normalized keys
  const priorMeta = priorScenes.map(p => ({
    scene: p,
    normSlug: normalizeSlugline(p.slugline),
    contentHash: p.contentHash || computeSceneContentHash(p),
    sceneNum: (p.sceneNumber || '').trim(),
    characters: new Set((p.characters || []).map(c => c.toUpperCase())),
  }));

  const reconciledScenes: ParsedScene[] = [];

  for (let i = 0; i < incomingScenes.length; i++) {
    const inc = incomingScenes[i];
    const incNormSlug = normalizeSlugline(inc.slugline);
    const incContentHash = computeSceneContentHash(inc);
    const incSceneNum = (inc.sceneNumber || '').trim();
    const incChars = new Set((inc.characters || []).map(c => c.toUpperCase()));

    // Candidates matching exact content hash AND slugline
    const exactContentMatches = priorMeta.filter(
      p => !matchedPriorIds.has(p.scene.id) &&
           p.contentHash === incContentHash &&
           p.normSlug === incNormSlug
    );

    // Candidates matching same scene number AND slugline
    const numberAndSlugMatches = priorMeta.filter(
      p => !matchedPriorIds.has(p.scene.id) &&
           p.sceneNum === incSceneNum &&
           p.normSlug === incNormSlug
    );

    // Candidates matching slugline and substantial character overlap
    const slugAndCharMatches = priorMeta.filter(p => {
      if (matchedPriorIds.has(p.scene.id) || p.normSlug !== incNormSlug) return false;
      if (p.characters.size === 0 && incChars.size === 0) return true;
      let shared = 0;
      p.characters.forEach(c => { if (incChars.has(c)) shared++; });
      return shared > 0;
    });

    let selectedMatch: (typeof priorMeta)[0] | null = null;
    let isAmbiguous = false;

    if (exactContentMatches.length === 1) {
      // Clean 1-to-1 match by content
      selectedMatch = exactContentMatches[0];
    } else if (exactContentMatches.length > 1) {
      // Duplicate sluglines with identical content in multiple places
      isAmbiguous = true;
    } else if (numberAndSlugMatches.length === 1) {
      // Clean 1-to-1 match by explicit scene number + slugline
      selectedMatch = numberAndSlugMatches[0];
    } else if (numberAndSlugMatches.length > 1) {
      isAmbiguous = true;
    } else if (slugAndCharMatches.length === 1) {
      // Slugline and characters match uniquely (renumbered scene)
      selectedMatch = slugAndCharMatches[0];
    } else if (slugAndCharMatches.length > 1) {
      isAmbiguous = true;
    }

    if (isAmbiguous) {
      ambiguousCount++;
      const newId = generateInitialSceneId(format, inc.slugline, incContentHash, i);
      reconciliationWarnings.push({
        id: `ambiguous-scene-match-${i + 1}`,
        sceneNumber: inc.sceneNumber,
        severity: 'warning',
        message: `Scene ${inc.sceneNumber} (${inc.slugline}) has multiple possible matches in prior draft. Assigned new ID to prevent misattaching breakdown elements.`,
        suggestion: 'Please verify attached props, cast, and notes in the Breakdown workspace.',
      });

      reconciledScenes.push({
        ...inc,
        id: newId,
        contentHash: incContentHash,
        status: 'unreviewed', // Flagged for human review
        elements: [], // Do NOT carry over elements blindly
      });
    } else if (selectedMatch) {
      // Safe unique match! Carry over prior ID, verified review status, and breakdown elements
      matchedPriorIds.add(selectedMatch.scene.id);
      matchedCount++;

      reconciledScenes.push({
        ...inc,
        id: selectedMatch.scene.id, // PRESERVE EXISTING STABLE ID
        contentHash: incContentHash,
        status: selectedMatch.scene.status, // Preserve reviewed/locked state
        elements: selectedMatch.scene.elements || [], // Preserve breakdown elements!
        notes: inc.notes || selectedMatch.scene.notes,
      });
    } else {
      // Completely new scene inserted in this revision
      const newId = generateInitialSceneId(format, inc.slugline, incContentHash, i);
      reconciledScenes.push({
        ...inc,
        id: newId,
        contentHash: incContentHash,
        status: 'unreviewed',
        elements: [],
      });
    }
  }

  // Detect scenes from prior draft that were deleted
  const deletedSceneIds = priorScenes
    .filter(p => !matchedPriorIds.has(p.id))
    .map(p => p.id);

  if (deletedSceneIds.length > 0) {
    reconciliationWarnings.push({
      id: 'scenes-deleted-in-revision',
      severity: 'info',
      message: `${deletedSceneIds.length} scene(s) from the previous draft were deleted or modified beyond recognition in this revision.`,
    });
  }

  return {
    reconciledScenes,
    reconciliationWarnings,
    matchedCount,
    newScenesCount: incomingScenes.length - matchedCount - ambiguousCount,
    ambiguousCount,
    deletedSceneIds,
  };
}
