/**
 * SceneOS — Final Draft (.fdx) Format Adapter
 * Industry-standard structured XML parsing of Final Draft documents.
 * Works seamlessly in both browser (DOMParser) and headless/Node environments (XML regex parser).
 */

import { FormatAdapter, ParsedScene, ParsingWarning, ScreenplayFormat } from '../types';
import { parseSlugline } from '../sluglineParser';
import { calculateLineEighths, formatEighths, eighthsToMinutes } from '../eighthsHelper';
import { computeSceneContentHash, generateInitialSceneId } from '../sceneIdentityService';

interface FdxParagraph {
  type: string;
  text: string;
  sceneNumber?: string;
}

export class FdxAdapter implements FormatAdapter {
  readonly format: ScreenplayFormat = 'fdx';
  readonly fileExtensions = ['.fdx'];

  canParse(file: File, text?: string): boolean {
    if (file.name.toLowerCase().endsWith('.fdx')) return true;
    if (text && (text.includes('<FinalDraft') || text.includes('DocumentType="Script"'))) return true;
    return false;
  }

  async parse(file: File, text?: string): Promise<{
    title?: string;
    author?: string;
    scenes: ParsedScene[];
    warnings: ParsingWarning[];
    rawText: string;
  }> {
    const rawXml = text || await file.text();
    const warnings: ParsingWarning[] = [];
    const scenes: ParsedScene[] = [];

    let title = file.name.replace(/\.[^/.]+$/, '');
    let author = 'Unknown Screenwriter';
    let paragraphs: FdxParagraph[] = [];

    // 1. Parse via browser DOMParser if available, otherwise use regex XML extractor
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(rawXml, 'application/xml');

      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        warnings.push({
          id: 'fdx-xml-error',
          severity: 'error',
          message: 'Malformed Final Draft XML document structure.',
          context: parseError.textContent?.slice(0, 100),
        });
      } else {
        const titlePage = xmlDoc.querySelector('TitlePage');
        if (titlePage) {
          const titleElem = titlePage.querySelector('Paragraph[Type="Title"] Text');
          if (titleElem?.textContent) title = titleElem.textContent.trim();
          const authorElem = titlePage.querySelector('Paragraph[Type="Author"] Text');
          if (authorElem?.textContent) author = authorElem.textContent.trim();
        }

        const pNodes = xmlDoc.querySelectorAll('Content > Paragraph');
        pNodes.forEach(p => {
          const type = p.getAttribute('Type') || 'Action';
          const sceneProps = p.querySelector('SceneProperties');
          const sceneNumber = sceneProps?.getAttribute('Number') || undefined;
          let pText = '';
          p.querySelectorAll('Text').forEach(t => {
            pText += (t.textContent || '');
          });
          paragraphs.push({
            type,
            text: pText.trim(),
            sceneNumber,
          });
        });
      }
    }

    // Fallback or Node.js environment: Regex-based XML parsing
    if (paragraphs.length === 0) {
      // Extract title and author from TitlePage
      const titleMatch = rawXml.match(/<Paragraph[^>]*Type=["']Title["'][^>]*>[\s\S]*?<Text[^>]*>([^<]+)<\/Text>/i);
      if (titleMatch) title = titleMatch[1].trim();

      const authorMatch = rawXml.match(/<Paragraph[^>]*Type=["']Author["'][^>]*>[\s\S]*?<Text[^>]*>([^<]+)<\/Text>/i);
      if (authorMatch) author = authorMatch[1].trim();

      // Strip TitlePage block so we only match the main Script Content paragraphs
      const scriptBody = rawXml.replace(/<TitlePage>[\s\S]*?<\/TitlePage>/gi, '');

      const pRegex = /<Paragraph(?:\s+([^>]*))?>([\s\S]*?)<\/Paragraph>/gi;
      let pExec: RegExpExecArray | null;

      while ((pExec = pRegex.exec(scriptBody)) !== null) {
        const pAttrs = pExec[1] || '';
        const pBody = pExec[2] || '';

        const typeMatch = pAttrs.match(/Type=["']([^"']+)["']/i);
        const type = typeMatch ? typeMatch[1] : 'Action';

        const sceneNumMatch = pBody.match(/<SceneProperties[^>]*Number=["']([^"']+)["']/i);
        const sceneNumber = sceneNumMatch ? sceneNumMatch[1] : undefined;

        let pText = '';
        const textRegex = /<Text(?:\s+[^>]*)?>([^<]*)<\/Text>/gi;
        let tExec: RegExpExecArray | null;
        while ((tExec = textRegex.exec(pBody)) !== null) {
          pText += tExec[1];
        }

        const trimmed = pText.trim();
        if (trimmed || type === 'Page Break') {
          paragraphs.push({
            type,
            text: trimmed,
            sceneNumber,
          });
        }
      }
    }

    if (paragraphs.length === 0) {
      warnings.push({
        id: 'fdx-empty-content',
        severity: 'warning',
        message: 'Final Draft document contains no script paragraphs.',
      });
      return { title, author, scenes: [], warnings, rawText: rawXml };
    }

    let currentScene: Partial<ParsedScene> | null = null;
    let sceneLines: string[] = [];
    let currentCharacter: string | null = null;
    let currentParenthetical: string | null = null;
    let sceneCounter = 1;
    let currentPage = 1;

    paragraphs.forEach((p, index) => {
      if (p.type === 'Page Break') {
        currentPage += 1;
        return;
      }

      if (!p.text) return;

      if (p.type === 'Scene Heading') {
        // Finalize previous scene
        if (currentScene && currentScene.slugline) {
          const eighths = calculateLineEighths(sceneLines.length);
          const partialScene = {
            slugline: currentScene.slugline,
            characters: Array.from(new Set(currentScene.characters || [])),
            dialogueBlocks: currentScene.dialogueBlocks || [],
            actionSnippet: sceneLines.slice(0, 3).join('\n'),
          };
          const contentHash = computeSceneContentHash(partialScene);
          const stableId = currentScene.id || generateInitialSceneId('fdx', currentScene.slugline, contentHash, scenes.length);

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

        const parsedSlug = parseSlugline(p.text);
        const sceneNum = p.sceneNumber || parsedSlug.sceneNumber || `${sceneCounter++}`;

        currentScene = {
          id: `fdx-scn-${scenes.length + 1}`,
          sceneNumber: sceneNum,
          slugline: parsedSlug.isSlugline ? parsedSlug.rawHeading : p.text,
          intExt: parsedSlug.intExt,
          location: parsedSlug.location || p.text,
          timeOfDay: parsedSlug.timeOfDay,
          startPage: currentPage,
          characters: [],
          dialogueBlocks: [],
          sourceLineNumber: index + 1,
        };
        sceneLines = [p.text];
        currentCharacter = null;
        currentParenthetical = null;
        return;
      }

      if (!currentScene) {
        currentScene = {
          id: `fdx-scn-1`,
          sceneNumber: '1',
          slugline: 'INT. UNTITLED SCENE - DAY',
          intExt: 'INT',
          location: 'UNTITLED SCENE',
          timeOfDay: 'DAY',
          startPage: 1,
          characters: [],
          dialogueBlocks: [],
          sourceLineNumber: 1,
        };
        sceneLines = [];
      }

      sceneLines.push(p.text);

      if (p.type === 'Character') {
        const cleanName = p.text.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
        currentCharacter = cleanName;
        currentParenthetical = null;
        if (currentScene.characters && !currentScene.characters.includes(cleanName)) {
          currentScene.characters.push(cleanName);
        }
      } else if (p.type === 'Parenthetical') {
        currentParenthetical = p.text;
      } else if (p.type === 'Dialogue' && currentCharacter) {
        currentScene.dialogueBlocks?.push({
          character: currentCharacter,
          parenthetical: currentParenthetical || undefined,
          text: p.text,
        });
        currentParenthetical = null;
      }
    });

    // Finalize trailing scene
    if (currentScene && currentScene.slugline) {
      const eighths = calculateLineEighths(sceneLines.length);
      const partialScene = {
        slugline: currentScene.slugline,
        characters: Array.from(new Set(currentScene.characters || [])),
        dialogueBlocks: currentScene.dialogueBlocks || [],
        actionSnippet: sceneLines.slice(0, 3).join('\n'),
      };
      const contentHash = computeSceneContentHash(partialScene);
      const stableId = currentScene.id || generateInitialSceneId('fdx', currentScene.slugline, contentHash, scenes.length);

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

    return {
      title,
      author,
      scenes,
      warnings,
      rawText: rawXml,
    };
  }
}
