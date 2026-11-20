/**
 * SceneOS — Fountain (.fountain / .spmd) Screenplay Adapter
 * Parses Fountain syntax according to official specifications:
 * - Scene Headings (standard & forced with leading dot)
 * - Scene Numbers (#number# syntax)
 * - Character cues and multiline dialogue coalescing
 * - Synopses, Boneyards, and Page/Eighths estimation
 */

import { FormatAdapter, ParsedScene, ParsingWarning, ScreenplayFormat } from '../types';
import { parseSlugline } from '../sluglineParser';
import { calculateLineEighths, formatEighths, eighthsToMinutes } from '../eighthsHelper';
import { computeSceneContentHash, generateInitialSceneId } from '../sceneIdentityService';

export class FountainAdapter implements FormatAdapter {
  readonly format: ScreenplayFormat = 'fountain';
  readonly fileExtensions = ['.fountain', '.spmd'];

  canParse(file: File): boolean {
    const lower = file.name.toLowerCase();
    return lower.endsWith('.fountain') || lower.endsWith('.spmd');
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

    let title = file.name.replace(/\.[^/.]+$/, '');
    let author = 'Screenplay Author';

    let currentScene: Partial<ParsedScene> | null = null;
    let sceneLines: string[] = [];
    let currentCharacter: string | null = null;
    let currentParenthetical: string | null = null;
    let sceneCounter = 1;
    let totalLinesCount = 0;
    let inBoneyard = false;

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
        const stableId = currentScene.id || generateInitialSceneId('fountain', currentScene.slugline, contentHash, scenes.length);

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

      // Handle Fountain Boneyard /* comment */
      if (trimmed.startsWith('/*')) {
        inBoneyard = true;
        continue;
      }
      if (trimmed.endsWith('*/')) {
        inBoneyard = false;
        continue;
      }
      if (inBoneyard) continue;

      // Title Page metadata key: value (Title: ..., Author: ..., etc.)
      if (!currentScene && trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':');
        const k = trimmed.slice(0, colonIdx).trim().toLowerCase();
        const v = trimmed.slice(colonIdx + 1).trim();
        if (k === 'title') {
          title = v;
          continue;
        }
        if (k === 'author' || k === 'authors' || k === 'credit' || k === 'source' || k === 'draft date' || k === 'contact') {
          if (k === 'author' || k === 'authors') author = v;
          continue;
        }
      }

      // Check for Scene Synopsis (= synopsis)
      if (trimmed.startsWith('=')) {
        if (currentScene) {
          currentScene.synopsis = trimmed.replace(/^=\s*/, '');
        }
        continue;
      }

      // Check for Scene Heading
      const slugResult = parseSlugline(trimmed);
      if (slugResult.isSlugline) {
        finalizeCurrentScene();

        // Check for Fountain scene number syntax e.g. "INT. LAB - NIGHT #12#"
        let sceneNum = slugResult.sceneNumber;
        let cleanHeading = slugResult.rawHeading;
        const numMatch = cleanHeading.match(/#([a-zA-Z0-9_\-\.]+)#$/);
        if (numMatch) {
          sceneNum = numMatch[1];
          cleanHeading = cleanHeading.replace(/\s*#[a-zA-Z0-9_\-\.]+#$/, '').trim();
        }
        if (!sceneNum) {
          sceneNum = `${sceneCounter++}`;
        }

        currentScene = {
          sceneNumber: sceneNum,
          slugline: cleanHeading,
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

      // If text exists before first scene heading:
      // Only synthesize Scene 1 if there are no sluglines anywhere in the document
      if (!currentScene && trimmed) {
        const hasSluglinesLater = lines.slice(i).some(l => parseSlugline(l.trim()).isSlugline);
        if (hasSluglinesLater) {
          // Front matter or title page continuation, do not synthesize scene yet
          continue;
        }

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
          id: 'fountain-synth-scene',
          severity: 'info',
          message: 'Screenplay text begins before first Scene Heading. Scene 1 created automatically.',
          line: i + 1,
        });
      }

      if (trimmed) {
        sceneLines.push(trimmed);

        // Fountain Character detection:
        // All-uppercase line with preceding blank line, not a transition
        const prevLineEmpty = i > 0 && lines[i - 1].trim() === '';
        const isUppercase = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
        const isTransition = trimmed.endsWith('TO:') || trimmed.startsWith('>');

        if (prevLineEmpty && isUppercase && !isTransition && trimmed.length < 35 && !trimmed.endsWith('.')) {
          const cleanName = trimmed.replace(/\s*\(.*\)$/, '').replace(/^@/, '').trim();
          currentCharacter = cleanName;
          currentParenthetical = null;
          if (currentScene && !currentScene.characters?.includes(cleanName)) {
            currentScene.characters?.push(cleanName);
          }
        } else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
          currentParenthetical = trimmed;
        } else if (currentCharacter && currentScene) {
          // Multiline dialogue coalescing in Fountain
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
      } else {
        // Empty line resets current speaker
        currentCharacter = null;
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
