/**
 * SceneOS — Screenplay Character Analysis Service
 * Authoritative screenplay-aware extraction, consecutive dialogue-turn interaction engine,
 * completeness & consistency audit, and manual override persistence.
 */

import { ParsedScene, DialogueBlock, ScreenplayVersion, FilmProject } from '../../../types';

export interface SpeakingSceneDetail {
  sceneId: string;
  sceneNumber: string;
  heading: string;
  dialogueCount: number;
}

export interface CharacterInteractionDetail {
  partnerId: string;
  partnerName: string;
  exchangeCount: number; // Consecutive dialogue turn interactions
  sceneReferences: Array<{
    sceneId: string;
    sceneNumber: string;
    heading: string;
    exchangeCount: number;
  }>;
}

export interface ConfirmedCharacterRecord {
  id: string; // Stable canonical ID (UPPERCASE)
  canonicalName: string;
  aliases: string[];
  rawCues: string[];
  extensionsSeen: string[]; // e.g. ['O.S.', 'V.O.', 'CONT\'D']
  totalDialogueBlocks: number;
  totalDialogueWords: number;
  averageDialogueLength: number; // words per block
  speakingScenesCount: number;
  speakingScenes: SpeakingSceneDetail[];
  interactions: CharacterInteractionDetail[];
  totalInteractionCount: number;
  isConfirmed: boolean;
  manualOverride?: boolean;
}

export interface MentionedCharacterRecord {
  name: string;
  detectionCount: number;
  detectedInScenes: Array<{
    sceneId: string;
    sceneNumber: string;
    heading: string;
    contextSnippet?: string;
  }>;
}

export interface CharacterInteractionEdge {
  id: string; // `${charA}---${charB}`
  source: string; // Canonical name A
  target: string; // Canonical name B
  exchangeCount: number;
  sceneReferences: Array<{
    sceneId: string;
    sceneNumber: string;
    heading: string;
    exchangeCount: number;
  }>;
}

export interface CharacterExtractionAudit {
  totalParsedScenes: number;
  totalDetectedCues: number;
  totalDialogueBlocks: number;
  confirmedSpeakingCharactersCount: number;
  mentionedCharactersCount: number;
  unresolvedCues: Array<{ rawCue: string; sceneNumber: string; reason: string }>;
  unassignedDialogueBlocks: Array<{ blockKey: string; textSnippet: string; sceneNumber: string }>;
  suggestedAliases: Array<{ candidate: string; targetCanonical: string; confidence: number }>;
  status: 'complete' | 'review_required';
  statusMessage: string;
}

export interface CharacterAnalysisDataset {
  characters: ConfirmedCharacterRecord[];
  mentionedCharacters: MentionedCharacterRecord[];
  interactions: CharacterInteractionEdge[];
  audit: CharacterExtractionAudit;
  activeScreenplayTitle: string;
}

export interface CharacterAnalysisOverrides {
  aliases?: Record<string, string>; // alias -> canonical
  canonicalNames?: Record<string, string>; // old -> new
  mergedCharacters?: Record<string, string>; // source -> target
  assignedBlocks?: Record<string, string>; // `${sceneId}:${blockIndex}` -> characterName
  manuallyAddedCharacters?: string[];
  confirmedCharacters?: string[];
}

/**
 * Strips cue extensions like (O.S.), (V.O.), (CONT'D), (OFF) while preserving canonical name.
 */
export function cleanCharacterCue(rawCue: string): { canonicalName: string; extensions: string[] } {
  if (!rawCue) return { canonicalName: '', extensions: [] };
  let cue = rawCue.trim();
  const extensions: string[] = [];

  // Extract all parenthetical extensions
  const parenRegex = /\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRegex.exec(cue)) !== null) {
    const ext = match[1].trim();
    if (ext) extensions.push(ext.toUpperCase());
  }

  // Remove parentheticals
  cue = cue.replace(/\([^)]*\)/g, '').trim();

  // Strip trailing Fountain dual dialogue caret
  cue = cue.replace(/\^$/, '').trim();

  // Strip leading Fountain forced character cue symbol @
  if (cue.startsWith('@')) {
    cue = cue.substring(1).trim();
  }

  // Normalize internal whitespace
  cue = cue.replace(/\s+/g, ' ');

  return {
    canonicalName: cue.toUpperCase(),
    extensions,
  };
}

/**
 * Counts words in dialogue text only (ignoring empty strings and punctuation-only tokens).
 */
export function countWords(text: string): number {
  if (!text) return 0;
  // Match contiguous word characters
  const words = text.trim().split(/\s+/).filter(w => /[a-zA-Z0-9]/.test(w));
  return words.length;
}

/**
 * Resolves a raw or alias cue to its canonical character name based on overrides and normalisation.
 */
export function resolveCanonicalName(
  rawCue: string,
  overrides?: CharacterAnalysisOverrides
): { canonicalName: string; extensions: string[] } {
  const { canonicalName: cleaned, extensions } = cleanCharacterCue(rawCue);
  if (!cleaned) return { canonicalName: '', extensions };

  let resolved = cleaned;

  // 1. Check direct alias mapping
  if (overrides?.aliases && overrides.aliases[resolved]) {
    resolved = overrides.aliases[resolved].toUpperCase();
  }

  // 2. Check merged mapping
  if (overrides?.mergedCharacters && overrides.mergedCharacters[resolved]) {
    resolved = overrides.mergedCharacters[resolved].toUpperCase();
  }

  // 3. Check renamed canonical
  if (overrides?.canonicalNames && overrides.canonicalNames[resolved]) {
    resolved = overrides.canonicalNames[resolved].toUpperCase();
  }

  return { canonicalName: resolved, extensions };
}

/**
 * Generates an edge key alphabetically so interaction A<->B is unique and symmetrical.
 */
function getEdgeKey(charA: string, charB: string): string {
  return charA < charB ? `${charA}---${charB}` : `${charB}---${charA}`;
}

/**
 * Analyzes scenes from canonical screenplay to extract complete character intelligence.
 */
export function analyzeScreenplayCharacters(
  scenes: ParsedScene[],
  screenplayTitle: string = 'Screenplay',
  overrides?: CharacterAnalysisOverrides
): CharacterAnalysisDataset {
  const charStatsMap = new Map<
    string,
    {
      canonicalName: string;
      aliases: Set<string>;
      rawCues: Set<string>;
      extensions: Set<string>;
      totalBlocks: number;
      totalWords: number;
      speakingScenes: Map<string, SpeakingSceneDetail>;
    }
  >();

  // Temporary interaction tracking: edgeKey -> { charA, charB, exchanges, sceneMap }
  const edgeMap = new Map<
    string,
    {
      source: string;
      target: string;
      exchangeCount: number;
      sceneRefs: Map<string, { sceneId: string; sceneNumber: string; heading: string; count: number }>;
    }
  >();

  let totalDetectedCues = 0;
  let totalDialogueBlocks = 0;
  const unresolvedCues: Array<{ rawCue: string; sceneNumber: string; reason: string }> = [];
  const unassignedDialogueBlocks: Array<{ blockKey: string; textSnippet: string; sceneNumber: string }> = [];

  // Track all characters explicitly mentioned across scenes
  const mentionedCandidateMap = new Map<
    string,
    {
      name: string;
      scenes: Array<{ sceneId: string; sceneNumber: string; heading: string }>;
    }
  >();

  // Process all parsed scenes
  for (const scene of scenes) {
    const sceneId = scene.id || `scn-${scene.sceneNumber}`;
    const sceneNumber = scene.sceneNumber || '1';
    const heading = scene.heading || scene.slugline || `SCENE ${sceneNumber}`;

    // Collect scene-level character mentions
    if (scene.characters && Array.isArray(scene.characters)) {
      for (const rawName of scene.characters) {
        const { canonicalName } = resolveCanonicalName(rawName, overrides);
        if (canonicalName && !canonicalName.startsWith('INT.') && !canonicalName.startsWith('EXT.')) {
          if (!mentionedCandidateMap.has(canonicalName)) {
            mentionedCandidateMap.set(canonicalName, {
              name: canonicalName,
              scenes: [],
            });
          }
          const entry = mentionedCandidateMap.get(canonicalName)!;
          if (!entry.scenes.some(s => s.sceneId === sceneId)) {
            entry.scenes.push({ sceneId, sceneNumber, heading });
          }
        }
      }
    }

    const dialogueBlocks = scene.dialogueBlocks || [];
    let prevSpeaker: string | null = null;

    for (let bIndex = 0; bIndex < dialogueBlocks.length; bIndex++) {
      const block = dialogueBlocks[bIndex];
      totalDialogueBlocks++;
      const blockKey = `${sceneId}:${bIndex}`;
      const assignedCue = overrides?.assignedBlocks?.[blockKey];
      const effectiveCharacter = (block.character && block.character.trim()) ? block.character : assignedCue;

      if (!effectiveCharacter || !effectiveCharacter.trim()) {
        unassignedDialogueBlocks.push({
          blockKey,
          textSnippet: (block.text || '').slice(0, 60),
          sceneNumber,
        });
        continue;
      }

      totalDetectedCues++;
      const rawCue = effectiveCharacter.trim();
      const { canonicalName, extensions } = resolveCanonicalName(rawCue, overrides);

      // Validate character cue doesn't look like an accidental scene heading or transition
      if (
        canonicalName.startsWith('INT.') ||
        canonicalName.startsWith('EXT.') ||
        canonicalName.startsWith('INT/EXT') ||
        canonicalName.startsWith('I/E') ||
        canonicalName === 'FADE IN:' ||
        canonicalName === 'FADE OUT' ||
        canonicalName === 'CUT TO:'
      ) {
        unresolvedCues.push({
          rawCue,
          sceneNumber,
          reason: 'Element matches screenplay scene heading or transition syntax',
        });
        continue;
      }

      if (!canonicalName) {
        unresolvedCues.push({
          rawCue,
          sceneNumber,
          reason: 'Could not resolve canonical character name from cue',
        });
        continue;
      }

      // Initialize stats record if new
      if (!charStatsMap.has(canonicalName)) {
        charStatsMap.set(canonicalName, {
          canonicalName,
          aliases: new Set<string>(),
          rawCues: new Set<string>(),
          extensions: new Set<string>(),
          totalBlocks: 0,
          totalWords: 0,
          speakingScenes: new Map<string, SpeakingSceneDetail>(),
        });
      }

      const charEntry = charStatsMap.get(canonicalName)!;
      charEntry.rawCues.add(rawCue);
      extensions.forEach(ext => charEntry.extensions.add(ext));

      // Check if cue differs from canonical (potential alias)
      const { canonicalName: rawCleaned } = cleanCharacterCue(rawCue);
      if (rawCleaned !== canonicalName) {
        charEntry.aliases.add(rawCleaned);
      }

      const words = countWords(block.text || '');
      charEntry.totalBlocks += 1;
      charEntry.totalWords += words;

      if (!charEntry.speakingScenes.has(sceneId)) {
        charEntry.speakingScenes.set(sceneId, {
          sceneId,
          sceneNumber,
          heading,
          dialogueCount: 1,
        });
      } else {
        const scnRec = charEntry.speakingScenes.get(sceneId)!;
        scnRec.dialogueCount += 1;
      }

      // Interaction engine: Consecutive dialogue turns within same scene
      if (prevSpeaker && prevSpeaker !== canonicalName) {
        const edgeKey = getEdgeKey(prevSpeaker, canonicalName);
        if (!edgeMap.has(edgeKey)) {
          const [source, target] = prevSpeaker < canonicalName
            ? [prevSpeaker, canonicalName]
            : [canonicalName, prevSpeaker];
          edgeMap.set(edgeKey, {
            source,
            target,
            exchangeCount: 0,
            sceneRefs: new Map(),
          });
        }

        const edge = edgeMap.get(edgeKey)!;
        edge.exchangeCount += 1;

        if (!edge.sceneRefs.has(sceneId)) {
          edge.sceneRefs.set(sceneId, {
            sceneId,
            sceneNumber,
            heading,
            count: 1,
          });
        } else {
          edge.sceneRefs.get(sceneId)!.count += 1;
        }
      }

      prevSpeaker = canonicalName;
    }
  }

  // Include manually added characters if requested
  if (overrides?.manuallyAddedCharacters) {
    for (const manualName of overrides.manuallyAddedCharacters) {
      const clean = manualName.trim().toUpperCase();
      if (clean && !charStatsMap.has(clean)) {
        charStatsMap.set(clean, {
          canonicalName: clean,
          aliases: new Set(),
          rawCues: new Set([clean]),
          extensions: new Set(),
          totalBlocks: 0,
          totalWords: 0,
          speakingScenes: new Map(),
        });
      }
    }
  }

  // Build edges list
  const interactions: CharacterInteractionEdge[] = Array.from(edgeMap.values()).map(edge => ({
    id: `${edge.source}---${edge.target}`,
    source: edge.source,
    target: edge.target,
    exchangeCount: edge.exchangeCount,
    sceneReferences: Array.from(edge.sceneRefs.values()).map(r => ({
      sceneId: r.sceneId,
      sceneNumber: r.sceneNumber,
      heading: r.heading,
      exchangeCount: r.count,
    })),
  })).sort((a, b) => b.exchangeCount - a.exchangeCount);

  // Build confirmed speaking characters list
  const confirmedCharacters: ConfirmedCharacterRecord[] = Array.from(charStatsMap.values())
    .map(entry => {
      // Find all interactions for this character
      const partnerInteractions: CharacterInteractionDetail[] = [];
      let totalInteractions = 0;

      for (const edge of interactions) {
        let partnerName: string | null = null;
        if (edge.source === entry.canonicalName) {
          partnerName = edge.target;
        } else if (edge.target === entry.canonicalName) {
          partnerName = edge.source;
        }

        if (partnerName) {
          totalInteractions += edge.exchangeCount;
          partnerInteractions.push({
            partnerId: partnerName,
            partnerName,
            exchangeCount: edge.exchangeCount,
            sceneReferences: edge.sceneReferences,
          });
        }
      }

      // Sort partner interactions by frequency descending
      partnerInteractions.sort((a, b) => b.exchangeCount - a.exchangeCount);

      const totalBlocks = entry.totalBlocks;
      const totalWords = entry.totalWords;
      const avgLength = totalBlocks > 0 ? Math.round((totalWords / totalBlocks) * 10) / 10 : 0;
      const speakingScenes = Array.from(entry.speakingScenes.values()).sort((a, b) => {
        const numA = parseInt(a.sceneNumber, 10) || 0;
        const numB = parseInt(b.sceneNumber, 10) || 0;
        return numA - numB;
      });

      const isConfirmed = overrides?.confirmedCharacters?.includes(entry.canonicalName) ?? true;

      return {
        id: entry.canonicalName,
        canonicalName: entry.canonicalName,
        aliases: Array.from(entry.aliases),
        rawCues: Array.from(entry.rawCues),
        extensionsSeen: Array.from(entry.extensions),
        totalDialogueBlocks: totalBlocks,
        totalDialogueWords: totalWords,
        averageDialogueLength: avgLength,
        speakingScenesCount: speakingScenes.length,
        speakingScenes,
        interactions: partnerInteractions,
        totalInteractionCount: totalInteractions,
        isConfirmed,
        manualOverride: Boolean(
          overrides?.canonicalNames?.[entry.canonicalName] ||
          overrides?.mergedCharacters?.[entry.canonicalName]
        ),
      };
    })
    .sort((a, b) => b.totalDialogueBlocks - a.totalDialogueBlocks);

  // Extract Mentioned-Only Characters (characters present in scene list or action text with 0 dialogue blocks)
  const confirmedNamesSet = new Set(confirmedCharacters.map(c => c.canonicalName));
  const mentionedCharacters: MentionedCharacterRecord[] = [];

  for (const [name, data] of mentionedCandidateMap.entries()) {
    if (!confirmedNamesSet.has(name)) {
      mentionedCharacters.push({
        name,
        detectionCount: data.scenes.length,
        detectedInScenes: data.scenes,
      });
    }
  }
  mentionedCharacters.sort((a, b) => b.detectionCount - a.detectionCount);

  // Alias suggestions discovery (e.g. "DETECTIVE BLAKE" vs "BLAKE")
  const suggestedAliases: Array<{ candidate: string; targetCanonical: string; confidence: number }> = [];
  const charNames = confirmedCharacters.map(c => c.canonicalName);

  for (let i = 0; i < charNames.length; i++) {
    for (let j = 0; j < charNames.length; j++) {
      if (i === j) continue;
      const nameA = charNames[i];
      const nameB = charNames[j];
      // If one contains the other as a discrete word token (e.g. "BLAKE" in "DETECTIVE BLAKE")
      const wordsA = nameA.split(' ');
      if (wordsA.length > 1 && wordsA.includes(nameB) && nameB.length >= 3) {
        // nameB is a sub-name of nameA
        if (!suggestedAliases.some(s => s.candidate === nameB && s.targetCanonical === nameA)) {
          suggestedAliases.push({
            candidate: nameB,
            targetCanonical: nameA,
            confidence: 0.85,
          });
        }
      }
    }
  }

  // Audit status
  const auditStatus = unresolvedCues.length === 0 && unassignedDialogueBlocks.length === 0
    ? 'complete'
    : 'review_required';

  const auditMessage = auditStatus === 'complete'
    ? `Extraction verified across ${scenes.length} scenes. ${confirmedCharacters.length} speaking characters and ${interactions.length} dialogue interaction channels.`
    : `Screenplay extraction completed with ${unresolvedCues.length} unresolved cue(s) and ${unassignedDialogueBlocks.length} unassigned dialogue block(s).`;

  const audit: CharacterExtractionAudit = {
    totalParsedScenes: scenes.length,
    totalDetectedCues,
    totalDialogueBlocks,
    confirmedSpeakingCharactersCount: confirmedCharacters.length,
    mentionedCharactersCount: mentionedCharacters.length,
    unresolvedCues,
    unassignedDialogueBlocks,
    suggestedAliases,
    status: auditStatus,
    statusMessage: auditMessage,
  };

  return {
    characters: confirmedCharacters,
    mentionedCharacters,
    interactions,
    audit,
    activeScreenplayTitle: screenplayTitle,
  };
}
