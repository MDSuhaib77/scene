/**
 * SceneOS — Script Structural Breakdown Service
 * Computes authoritative composition & frequency of canonical screenplay block types,
 * reconciling every non-empty block instance, percentage share, word count, scene coverage,
 * and drill-down occurrences directly from the active canonical screenplay.
 */

import { FilmProject, ParsedScene, ScreenplayVersion } from '../../../types';
import {
  CanonicalElement,
  CanonicalScreenplayDocument,
} from '../../screenplay/model/canonicalScreenplay';
import {
  tiptapDocToCanonical,
} from '../../screenplay/model/canonicalConverters';
import {
  parseFountainToCanonical,
} from '../../screenplay/model/fountainParser';
import { countWords } from './characterAnalysisService';

export type ScriptBlockCategoryKey =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'lyrics'
  | 'section_heading'
  | 'centered_text'
  | 'note'
  | 'synopsis'
  | 'page_break'
  | 'unclassified';

export interface ScriptBlockOccurrence {
  id: string;
  blockIndex: number;
  sceneId: string;
  sceneNumber: string;
  sceneHeading: string;
  text: string;
  wordCount: number;
}

export interface ScriptBlockCategoryStat {
  key: ScriptBlockCategoryKey;
  label: string;
  description: string;
  instances: number;
  percentage: number; // 0..100
  wordCount: number;
  sceneCoverage: number;
  occurrences: ScriptBlockOccurrence[];
}

export interface ScriptBreakdownDataset {
  categories: ScriptBlockCategoryStat[];
  unclassifiedCategory: ScriptBlockCategoryStat | null;
  totalClassifiedInstances: number;
  totalAllInstances: number;
  totalWords: number;
  totalScenes: number;
  sourceKind: 'canonical_document' | 'fountain_text' | 'parsed_scenes';
  sourceTitle: string;
}

const CATEGORY_META: Record<
  ScriptBlockCategoryKey,
  { label: string; description: string; order: number }
> = {
  scene_heading: {
    label: 'Scene Headings',
    description: 'Sluglines establishing INT./EXT., location, and time of day',
    order: 1,
  },
  action: {
    label: 'Action',
    description: 'Narrative description and physical stage directions',
    order: 2,
  },
  character: {
    label: 'Character Cues',
    description: 'Speaker attribution lines preceding dialogue blocks',
    order: 3,
  },
  dialogue: {
    label: 'Dialogue',
    description: 'Spoken lines attributed to characters',
    order: 4,
  },
  parenthetical: {
    label: 'Parentheticals',
    description: 'Actor delivery directions nested under character cues',
    order: 5,
  },
  transition: {
    label: 'Transitions',
    description: 'Editorial cut, fade, and dissolve directives',
    order: 6,
  },
  lyrics: {
    label: 'Lyrics',
    description: 'Sung vocal lines marked with Fountain lyric syntax',
    order: 7,
  },
  section_heading: {
    label: 'Section Headings',
    description: 'Structural act and sequence outline markers',
    order: 8,
  },
  centered_text: {
    label: 'Centered Text',
    description: 'Centered title cards and on-screen inserts',
    order: 9,
  },
  note: {
    label: 'Script Notes',
    description: 'Inline production and writer annotations',
    order: 10,
  },
  synopsis: {
    label: 'Synopses',
    description: 'Scene summary notes excluded from printed pages',
    order: 11,
  },
  page_break: {
    label: 'Page Breaks',
    description: 'Forced manual pagination markers',
    order: 12,
  },
  unclassified: {
    label: 'Unclassified Blocks',
    description: 'Elements without a recognized canonical screenplay block type',
    order: 99,
  },
};

function resolveCanonicalFromVersion(
  activeScript?: ScreenplayVersion | null
): { canonical: CanonicalScreenplayDocument; sourceKind: 'canonical_document' | 'fountain_text' } | null {
  if (!activeScript) return null;

  if (activeScript.documentJson) {
    try {
      const parsed = JSON.parse(activeScript.documentJson);
      const canonical = parsed?.elements
        ? (parsed as CanonicalScreenplayDocument)
        : tiptapDocToCanonical(parsed);
      if (canonical?.elements && canonical.elements.length > 0) {
        return { canonical, sourceKind: 'canonical_document' };
      }
    } catch {
      // Fall through cleanly to rawText or scenes
    }
  }

  if (activeScript.rawText && activeScript.rawText.trim()) {
    const canonical = parseFountainToCanonical(activeScript.rawText);
    if (canonical?.elements && canonical.elements.length > 0) {
      return { canonical, sourceKind: 'fountain_text' };
    }
  }

  return null;
}

/**
 * Computes structural block-type composition metrics from a screenplay version and fallback scenes.
 */
export function analyzeScriptBreakdown(
  activeScript: ScreenplayVersion | null | undefined,
  fallbackScenes: ParsedScene[] = [],
  projectTitle: string = 'Screenplay'
): ScriptBreakdownDataset {
  const buckets = new Map<
    ScriptBlockCategoryKey,
    {
      instances: number;
      wordCount: number;
      sceneIds: Set<string>;
      occurrences: ScriptBlockOccurrence[];
    }
  >();

  const ensureBucket = (key: ScriptBlockCategoryKey) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        instances: 0,
        wordCount: 0,
        sceneIds: new Set<string>(),
        occurrences: [],
      });
    }
    return buckets.get(key)!;
  };

  let totalScenes = 0;
  let blockSeq = 0;
  let sourceKind: ScriptBreakdownDataset['sourceKind'] = 'canonical_document';
  const resolved = resolveCanonicalFromVersion(activeScript);

  const recordOccurrence = (
    key: ScriptBlockCategoryKey,
    sceneId: string,
    sceneNumber: string,
    sceneHeading: string,
    text: string,
    includeSceneCoverage: boolean
  ) => {
    const trimmed = text.trim();
    if (!trimmed && key !== 'page_break') return;
    const words = key === 'page_break' ? 0 : countWords(trimmed);
    const bucket = ensureBucket(key);
    bucket.instances += 1;
    bucket.wordCount += words;
    if (includeSceneCoverage && sceneId) {
      bucket.sceneIds.add(sceneId);
    }
    bucket.occurrences.push({
      id: `${key}-${blockSeq++}`,
      blockIndex: blockSeq,
      sceneId,
      sceneNumber,
      sceneHeading,
      text: trimmed || '=== Page Break ===',
      wordCount: words,
    });
  };

  if (resolved) {
    sourceKind = resolved.sourceKind;
    let currentSceneId = '';
    let currentSceneNumber = '—';
    let currentSceneHeading = 'Opening / Pre-Scene';
    let sceneCounter = 0;

    for (const el of resolved.canonical.elements) {
      if (el.type === 'scene_heading') {
        sceneCounter += 1;
        currentSceneNumber = el.sceneProperties?.sceneNumber || String(sceneCounter);
        currentSceneId = el.id || `scn-${sceneCounter}`;
        currentSceneHeading = el.text.trim() || `SCENE ${currentSceneNumber}`;
        recordOccurrence('scene_heading', currentSceneId, currentSceneNumber, currentSceneHeading, el.text, true);
        continue;
      }

      if (el.type === 'dual_dialogue' && el.dualDialogue) {
        const cols = [el.dualDialogue.left, el.dualDialogue.right];
        for (const col of cols) {
          if (col?.character?.text?.trim()) {
            recordOccurrence(
              'character',
              currentSceneId,
              currentSceneNumber,
              currentSceneHeading,
              col.character.text,
              Boolean(currentSceneId)
            );
          }
          if (col?.parenthetical?.text?.trim()) {
            recordOccurrence(
              'parenthetical',
              currentSceneId,
              currentSceneNumber,
              currentSceneHeading,
              col.parenthetical.text,
              Boolean(currentSceneId)
            );
          }
          for (const d of col?.dialogue || []) {
            if (d?.text?.trim()) {
              recordOccurrence(
                'dialogue',
                currentSceneId,
                currentSceneNumber,
                currentSceneHeading,
                d.text,
                Boolean(currentSceneId)
              );
            }
          }
        }
        continue;
      }

      const rawType = el.type as string;
      const mappedKey: ScriptBlockCategoryKey =
        rawType in CATEGORY_META && rawType !== 'unclassified'
          ? (rawType as ScriptBlockCategoryKey)
          : 'unclassified';

      recordOccurrence(
        mappedKey,
        currentSceneId,
        currentSceneNumber,
        currentSceneHeading,
        el.text || '',
        Boolean(currentSceneId)
      );
    }

    totalScenes = sceneCounter > 0 ? sceneCounter : fallbackScenes.length;
  } else {
    // Fallback strictly to structured ParsedScene[] records when no canonical doc or raw text is present
    sourceKind = 'parsed_scenes';
    totalScenes = fallbackScenes.length;

    fallbackScenes.forEach((scene, idx) => {
      const sceneId = scene.id || `scn-${idx + 1}`;
      const sceneNumber = scene.sceneNumber || String(idx + 1);
      const heading = scene.heading || scene.slugline || `SCENE ${sceneNumber}`;

      if (scene.slugline || scene.heading) {
        recordOccurrence('scene_heading', sceneId, sceneNumber, heading, heading, true);
      }

      const actionSource = scene.actionSnippet || scene.synopsis;
      if (actionSource && actionSource.trim()) {
        recordOccurrence('action', sceneId, sceneNumber, heading, actionSource, true);
      }

      for (const block of scene.dialogueBlocks || []) {
        if (block.character && block.character.trim()) {
          recordOccurrence('character', sceneId, sceneNumber, heading, block.character, true);
        }
        if (block.parenthetical && block.parenthetical.trim()) {
          recordOccurrence('parenthetical', sceneId, sceneNumber, heading, block.parenthetical, true);
        }
        if (block.text && block.text.trim()) {
          recordOccurrence('dialogue', sceneId, sceneNumber, heading, block.text, true);
        }
      }
    });
  }

  // Reconcile totals cleanly
  let totalClassifiedInstances = 0;
  let unclassifiedInstances = 0;

  for (const [key, b] of buckets.entries()) {
    if (key === 'unclassified') {
      unclassifiedInstances += b.instances;
    } else {
      totalClassifiedInstances += b.instances;
    }
  }

  const totalAllInstances = totalClassifiedInstances + unclassifiedInstances;

  const categories: ScriptBlockCategoryStat[] = [];
  let totalWords = 0;

  for (const [key, b] of buckets.entries()) {
    if (key === 'unclassified') continue;
    const meta = CATEGORY_META[key];
    totalWords += b.wordCount;
    const percentage =
      totalClassifiedInstances > 0
        ? Math.round((b.instances / totalClassifiedInstances) * 1000) / 10
        : 0;
    categories.push({
      key,
      label: meta.label,
      description: meta.description,
      instances: b.instances,
      percentage,
      wordCount: b.wordCount,
      sceneCoverage: b.sceneIds.size,
      occurrences: b.occurrences,
    });
  }

  categories.sort((a, b) => b.instances - a.instances || CATEGORY_META[a.key].order - CATEGORY_META[b.key].order);

  const rawUnclassified = buckets.get('unclassified');
  const unclassifiedCategory: ScriptBlockCategoryStat | null = rawUnclassified
    ? {
        key: 'unclassified',
        label: CATEGORY_META.unclassified.label,
        description: CATEGORY_META.unclassified.description,
        instances: rawUnclassified.instances,
        percentage:
          totalAllInstances > 0
            ? Math.round((rawUnclassified.instances / totalAllInstances) * 1000) / 10
            : 0,
        wordCount: rawUnclassified.wordCount,
        sceneCoverage: rawUnclassified.sceneIds.size,
        occurrences: rawUnclassified.occurrences,
      }
    : null;

  return {
    categories,
    unclassifiedCategory,
    totalClassifiedInstances,
    totalAllInstances,
    totalWords: totalWords + (unclassifiedCategory?.wordCount || 0),
    totalScenes,
    sourceKind,
    sourceTitle: activeScript?.title || projectTitle,
  };
}
