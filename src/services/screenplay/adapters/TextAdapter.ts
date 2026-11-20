/**
 * SceneOS — Plain Text (.txt) Screenplay Adapter
 * Parses text screenplays, identifies sluglines, character cues, dialogue, and eighths.
 */

import { FormatAdapter, ParsedScene, ParsingWarning, ScreenplayFormat } from '../types';
import { parseSlugline } from '../sluglineParser';
import { calculateLineEighths, formatEighths, eighthsToMinutes } from '../eighthsHelper';
import { computeSceneContentHash, generateInitialSceneId } from '../sceneIdentityService';

export class TextAdapter implements FormatAdapter {
  readonly format: ScreenplayFormat = 'txt';
  readonly fileExtensions = ['.txt', '.text'];

  canParse(file: File): boolean {
    return file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.text');
  }

  async parse(file: File, text?: string): Promise<{
    title?: string;
    author?: string;
    scenes: ParsedScene[];
    warnings: ParsingWarning[];
    rawText: string;
  }> {
    const rawContent = text || await file.text();
    const scenes: ParsedScene[] = [];
    const warnings: ParsingWarning[] = [];

    const lines = rawContent.split(/\r?\n/);

    const title = file.name.replace(/\.[^/.]+$/, '');
    const author = 'Screenplay Author';

    let currentScene: Partial<ParsedScene> | null = null;
    let sceneLines: string[] = [];
    let currentCharacter: string | null = null;
    let currentParenthetical: string | null = null;
    let sceneCounter = 1;
    let totalLinesCount = 0;

    const finalizeCurrentScene = () => {
      if (currentScene && currentScene.slugline) {
        const eighths = calculateLineEighths(sceneLines.length);
        const partialScene = {
          slugline: currentScene.slugline,
          characters: Array.from(new Set(currentScene.characters || [])),
          dialogueBlocks: currentScene.dialogueBlocks || [],
          actionSnippet: sceneLines.slice(0, 3).join('\n'),
        };
        const contentHash = computeSceneContentHash(partialScene);
        const stableId = currentScene.id || generateInitialSceneId('txt', currentScene.slugline, contentHash, scenes.length);

        scenes.push({
          id: stableId,
          contentHash,
          sceneNumber: currentScene.sceneNumber || `${scenes.length + 1}`,
          slugline: currentScene.slugline,
          intExt: currentScene.intExt || 'INT',
          location: currentScene.location || 'UNKNOWN LOCATION',
          timeOfDay: currentScene.timeOfDay || 'DAY',
          pageLengthEighths: eighths,
          pageLengthDisplay: formatEighths(eighths),
          startPage: currentScene.startPage || 1,
          estimatedDurationMinutes: eighthsToMinutes(eighths),
          synopsis: currentScene.synopsis || sceneLines.slice(0, 2).join(' '),
          characters: Array.from(new Set(currentScene.characters || [])),
          dialogueBlocks: currentScene.dialogueBlocks || [],
          actionSnippet: sceneLines.slice(0, 3).join('\n'),
          elements: [],
          status: 'unreviewed',
          scriptSnippet: sceneLines.slice(0, 10).join('\n'),
          sourceLineNumber: currentScene.sourceLineNumber,
        });
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      totalLinesCount++;

      // Blank line resets active character and parenthetical
      if (!trimmed) {
        currentCharacter = null;
        currentParenthetical = null;
        continue;
      }

      // Check for Scene Heading
      const slugResult = parseSlugline(trimmed);
      if (slugResult.isSlugline) {
        finalizeCurrentScene();

        const sceneNum = slugResult.sceneNumber || `${sceneCounter++}`;
        currentScene = {
          sceneNumber: sceneNum,
          slugline: slugResult.rawHeading,
          intExt: slugResult.intExt,
          location: slugResult.location,
          timeOfDay: slugResult.timeOfDay,
          startPage: Math.max(1, Math.floor(totalLinesCount / 55) + 1),
          characters: [],
          dialogueBlocks: [],
          sourceLineNumber: i + 1,
        };
        sceneLines = [trimmed];
        currentCharacter = null;
        currentParenthetical = null;
        continue;
      }

      // If we have not encountered a scene heading yet:
      if (!currentScene) {
        // Check if there are any sluglines further down in the script
        const hasSluglinesLater = lines.slice(i).some(l => parseSlugline(l.trim()).isSlugline);
        if (hasSluglinesLater) {
          // Treat as script title / front matter / header notes
          continue;
        }

        // Only synthesize if script has no sluglines at all
        currentScene = {
          sceneNumber: '1',
          slugline: 'INT. UNTITLED SCENE - DAY',
          intExt: 'INT',
          location: 'UNTITLED SCENE',
          timeOfDay: 'DAY',
          startPage: 1,
          characters: [],
          dialogueBlocks: [],
          sourceLineNumber: i + 1,
        };
        sceneLines = [];
        warnings.push({
          id: 'txt-synth-scene',
          severity: 'info',
          message: 'Text starts without a scene heading. Scene 1 established automatically.',
          line: i + 1,
        });
      }

      sceneLines.push(trimmed);

      // Character detection in text screenplay:
      // Typically uppercase line, indented or centered, no punctuation at end
      const isUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
      const isShort = trimmed.length > 1 && trimmed.length < 32;
      const noPunct = !trimmed.endsWith('.') && !trimmed.endsWith(',') && !trimmed.endsWith(':');

      if (isUpper && isShort && noPunct) {
        const cleanName = trimmed.replace(/\s*\(.*\)$/, '').trim();
        currentCharacter = cleanName;
        currentParenthetical = null;
        if (currentScene && !currentScene.characters?.includes(cleanName)) {
          currentScene.characters?.push(cleanName);
        }
      } else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        currentParenthetical = trimmed;
      } else if (currentCharacter && currentScene) {
        // Multiline dialogue coalescing:
        // If the previous block was from the SAME character and no intervening parenthetical, append line!
        const existingBlocks = currentScene.dialogueBlocks || [];
        const lastBlock = existingBlocks.length > 0 ? existingBlocks[existingBlocks.length - 1] : null;

        if (lastBlock && lastBlock.character === currentCharacter && !currentParenthetical) {
          lastBlock.text += `\n${trimmed}`;
        } else {
          existingBlocks.push({
            character: currentCharacter,
            parenthetical: currentParenthetical || undefined,
            text: trimmed,
          });
          currentScene.dialogueBlocks = existingBlocks;
        }
        currentParenthetical = null;
      }
    }

    // Finalize trailing scene
    finalizeCurrentScene();

    return {
      title,
      author,
      scenes,
      warnings,
      rawText: rawContent,
    };
  }
}
