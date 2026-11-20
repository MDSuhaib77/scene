/**
 * SceneOS — Final Draft (.fdx) Structured XML Parser
 * High-fidelity XML parser mapping industry-standard Final Draft elements into
 * CanonicalScreenplayDocument. Compatible with browser and headless runtimes.
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
  ObservedElementFormatting,
} from './canonicalScreenplay';

export interface ParseFdxOptions {
  fileName?: string;
  fileSize?: number;
}

export function parseFdx(
  rawXml: string,
  options: ParseFdxOptions = {}
): CanonicalScreenplayDocument {
  const warnings: CanonicalWarning[] = [];
  const metadata: ScreenplayMetadata = {};
  const elements: CanonicalElement[] = [];

  let title = options.fileName?.replace(/\.[^/.]+$/, '') || 'Untitled Screenplay';
  let author = '';

  const decodeXmlEntities = (str: string): string =>
    str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

  const mapFdxType = (rawType: string): CanonicalElementType => {
    const norm = (rawType || '').toLowerCase().trim();
    if (norm === 'scene heading') return 'scene_heading';
    if (norm === 'action') return 'action';
    if (norm === 'character') return 'character';
    if (norm === 'parenthetical') return 'parenthetical';
    if (norm === 'dialogue') return 'dialogue';
    if (norm === 'transition') return 'transition';
    if (norm === 'shot') return 'action';
    if (norm === 'general') return 'action';
    if (norm === 'new act') return 'section_heading';
    if (norm === 'end of act') return 'transition';
    if (norm === 'sequence') return 'section_heading';
    if (norm === 'script note' || norm === 'note') return 'note';
    return 'action';
  };

  const extractFdxTextAndFormatting = (
    pInnerXml: string,
    pAttrs: string = ''
  ): {
    text: string;
    formatting?: FormattingSpan[];
    observedFormatting?: ObservedElementFormatting;
  } => {
    const textMatches = Array.from(pInnerXml.matchAll(/<Text\b([^>]*)>([\s\S]*?)<\/Text>/gi));
    let fullText = '';
    const formatting: FormattingSpan[] = [];
    let detectedFont: string | undefined;
    let detectedSize: number | undefined;

    for (const m of textMatches) {
      const tAttrs = m[1] || '';
      const rawContent = decodeXmlEntities(m[2].replace(/<[^>]+>/g, ''));
      if (!rawContent) continue;

      const start = fullText.length;
      fullText += rawContent;
      const end = fullText.length;

      const fontMatch = tAttrs.match(/Font\s*=\s*["']([^"']+)["']/i);
      if (fontMatch && !detectedFont) detectedFont = fontMatch[1];

      const sizeMatch = tAttrs.match(/Size\s*=\s*["']([^"']+)["']/i);
      if (sizeMatch && !detectedSize) detectedSize = parseFloat(sizeMatch[1]);

      const styleMatch = tAttrs.match(/Style\s*=\s*["']([^"']+)["']/i);
      if (styleMatch) {
        const s = styleMatch[1].toLowerCase();
        if (s.includes('bold')) formatting.push({ type: 'bold', start, end });
        if (s.includes('italic')) formatting.push({ type: 'italic', start, end });
        if (s.includes('underline')) formatting.push({ type: 'underline', start, end });
      }
    }

    if (textMatches.length === 0) {
      fullText = decodeXmlEntities(pInnerXml.replace(/<[^>]+>/g, ''));
    }

    const alignMatch = pAttrs.match(/Alignment\s*=\s*["']([^"']+)["']/i);
    const alignment = alignMatch ? (alignMatch[1].toLowerCase() as any) : undefined;

    let observedFormatting: ObservedElementFormatting | undefined;
    if (detectedFont || detectedSize || alignment) {
      observedFormatting = {
        fontFamily: detectedFont,
        fontSizePt: detectedSize,
        alignment,
        isObserved: true,
      };
    }

    return {
      text: fullText.trim(),
      formatting: formatting.length > 0 ? formatting : undefined,
      observedFormatting,
    };
  };

  const extractParagraphText = (pInnerXml: string): string => {
    const textMatches = Array.from(pInnerXml.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/gi));
    if (textMatches.length > 0) {
      return decodeXmlEntities(textMatches.map((m) => m[1].replace(/<[^>]+>/g, '')).join('')).trim();
    }
    return decodeXmlEntities(pInnerXml.replace(/<[^>]+>/g, '')).trim();
  };

  // 1. Extract TitlePage metadata
  const titlePageMatch = rawXml.match(/<TitlePage\b[^>]*>([\s\S]*?)<\/TitlePage>/i);
  if (titlePageMatch) {
    const tpXml = titlePageMatch[1];
    const tpTexts = Array.from(tpXml.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/gi))
      .map((m) => decodeXmlEntities(m[1].replace(/<[^>]+>/g, '')).trim())
      .filter(Boolean);

    if (tpTexts.length > 0) {
      title = tpTexts[0];
      metadata.title = title;
    }
    for (let i = 1; i < tpTexts.length; i++) {
      const line = tpTexts[i];
      if (/^(written\s+by|by)\s+/i.test(line)) {
        author = line.replace(/^(written\s+by|by)\s+/i, '').trim();
        metadata.author = author;
        metadata.authors = [author];
      } else if (!author && tpTexts.length > 1 && i === 1) {
        author = line;
        metadata.author = author;
        metadata.authors = [author];
      }
    }
  }

  const explicitTitleMatch = rawXml.match(/<Paragraph[^>]*Type=["']Title["'][^>]*>[\s\S]*?<Text[^>]*>([^<]+)<\/Text>/i);
  if (explicitTitleMatch) {
    title = decodeXmlEntities(explicitTitleMatch[1].trim());
    metadata.title = title;
  }
  const explicitAuthorMatch = rawXml.match(/<Paragraph[^>]*Type=["']Author["'][^>]*>[\s\S]*?<Text[^>]*>([^<]+)<\/Text>/i);
  if (explicitAuthorMatch) {
    author = decodeXmlEntities(explicitAuthorMatch[1].trim());
    metadata.author = author;
    metadata.authors = [author];
  }
  const sourceMatch = rawXml.match(/<Paragraph[^>]*Type=["']Source["'][^>]*>[\s\S]*?<Text[^>]*>([^<]+)<\/Text>/i);
  if (sourceMatch) {
    metadata.source = decodeXmlEntities(sourceMatch[1].trim());
  }

  // 2. Extract Script Content Body (excluding <TitlePage> and <SmartType>)
  const scriptOnlyXml = rawXml.replace(/<TitlePage\b[\s\S]*?<\/TitlePage>/gi, '');
  const contentMatch = scriptOnlyXml.match(/<Content\b[^>]*>([\s\S]*?)<\/Content>/i);
  const contentBody = contentMatch ? contentMatch[1] : scriptOnlyXml;

  // 3. Tokenize Content using Regex that treats <DualDialogue> atomically
  const tokenRegex =
    /<Paragraph\b[^>]*>\s*<DualDialogue\b[^>]*>([\s\S]*?)<\/DualDialogue>\s*<\/Paragraph>|<DualDialogue\b[^>]*>([\s\S]*?)<\/DualDialogue>|<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(contentBody)) !== null) {
    const dualBody = match[1] ?? match[2];

    // Handle DualDialogue block
    if (dualBody !== undefined) {
      const subParaRegex = /<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi;
      const leftElements: CanonicalElement[] = [];
      const rightElements: CanonicalElement[] = [];
      let characterCountInDual = 0;
      let subMatch: RegExpExecArray | null;

      while ((subMatch = subParaRegex.exec(dualBody)) !== null) {
        const subAttrs = subMatch[1] || '';
        const subInner = subMatch[2] || '';
        const typeAttr = subAttrs.match(/Type\s*=\s*["']([^"']+)["']/i);
        const pType = mapFdxType(typeAttr ? typeAttr[1] : 'Action');
        const text = extractParagraphText(subInner);
        if (!text) continue;

        if (pType === 'character') {
          characterCountInDual += 1;
        }

        const targetCol = characterCountInDual <= 1 ? leftElements : rightElements;
        const allowedType: CanonicalElementType =
          pType === 'character' || pType === 'parenthetical' || pType === 'dialogue'
            ? pType
            : 'dialogue';

        targetCol.push({
          id: generateElementId('dual-sub'),
          type: allowedType,
          text,
          characterProperties: allowedType === 'character' ? { characterName: text } : undefined,
          confidence: 'high',
        });
      }

      if (leftElements.length > 0 && rightElements.length > 0) {
        const leftChar = leftElements.find((e) => e.type === 'character') || {
          id: generateElementId('chr'),
          type: 'character',
          text: 'CHARACTER 1',
          confidence: 'high',
        };
        const leftParen = leftElements.find((e) => e.type === 'parenthetical');
        const leftDia = leftElements.filter((e) => e.type === 'dialogue');

        const rightChar = rightElements.find((e) => e.type === 'character') || {
          id: generateElementId('chr'),
          type: 'character',
          text: 'CHARACTER 2',
          confidence: 'high',
        };
        const rightParen = rightElements.find((e) => e.type === 'parenthetical');
        const rightDia = rightElements.filter((e) => e.type === 'dialogue');

        const dualProps: DualDialogueProperties = {
          left: {
            character: leftChar,
            parenthetical: leftParen,
            dialogue: leftDia,
          },
          right: {
            character: rightChar,
            parenthetical: rightParen,
            dialogue: rightDia,
          },
        };

        elements.push({
          id: generateElementId('dual'),
          type: 'dual_dialogue',
          text: `${leftChar.text} ^ ${rightChar.text}`,
          dualDialogue: dualProps,
          confidence: 'high',
        });
      }
      continue;
    }

    // Standard Paragraph
    const attrs = match[3] || '';
    const inner = match[4] || '';

    const typeMatch = attrs.match(/Type\s*=\s*["']([^"']+)["']/i);
    const rawType = typeMatch ? typeMatch[1] : 'Action';
    const numMatch =
      inner.match(/<SceneProperties[^>]*Number\s*=\s*["']([^"']+)["']/i) ||
      attrs.match(/Number\s*=\s*["']([^"']+)["']/i);
    const sceneNumber = numMatch ? numMatch[1] : undefined;

    const { text, formatting, observedFormatting } = extractFdxTextAndFormatting(inner, attrs);
    if (!text) continue;

    const cType = mapFdxType(rawType);

    if (cType === 'scene_heading') {
      elements.push({
        id: generateElementId('scn'),
        type: 'scene_heading',
        text: text.toUpperCase(),
        sceneNumber,
        formatting,
        observedFormatting,
        sceneProperties: {
          sceneNumber,
          isForced: false,
        },
        confidence: 'high',
      });
    } else if (cType === 'character') {
      const charName = text.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
      const parenMatch = text.match(/\(([^)]+)\)/);
      elements.push({
        id: generateElementId('chr'),
        type: 'character',
        text: text.toUpperCase(),
        formatting,
        observedFormatting,
        characterProperties: {
          characterName: charName,
          extensions: parenMatch ? [parenMatch[1].trim()] : undefined,
        },
        confidence: 'high',
      });
    } else if (cType === 'parenthetical') {
      elements.push({
        id: generateElementId('par'),
        type: 'parenthetical',
        text: text.startsWith('(') ? text : `(${text})`,
        formatting,
        observedFormatting,
        confidence: 'high',
      });
    } else if (cType === 'dialogue') {
      elements.push({
        id: generateElementId('dia'),
        type: 'dialogue',
        text,
        formatting,
        observedFormatting,
        confidence: 'high',
      });
    } else if (cType === 'transition') {
      elements.push({
        id: generateElementId('trn'),
        type: 'transition',
        text: text.toUpperCase(),
        formatting,
        observedFormatting,
        confidence: 'high',
      });
    } else if (cType === 'section_heading') {
      elements.push({
        id: generateElementId('sec'),
        type: 'section_heading',
        text,
        formatting,
        observedFormatting,
        sectionLevel: 1,
        confidence: 'high',
      });
    } else if (cType === 'note') {
      elements.push({
        id: generateElementId('note'),
        type: 'note',
        text,
        formatting,
        observedFormatting,
        confidence: 'high',
      });
    } else {
      elements.push({
        id: generateElementId('act'),
        type: 'action',
        text,
        formatting,
        observedFormatting,
        confidence: 'high',
      });
    }
  }

  if (elements.length === 0) {
    warnings.push({
      id: 'fdx-empty',
      severity: 'warning',
      message: 'No readable screenplay paragraphs found in Final Draft document.',
    });
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
      title: metadata.title || title,
      ...metadata,
    },
    elements,
    warnings,
    provenance: {
      sourceFormat: 'fdx',
      fileName: options.fileName,
      fileSize: options.fileSize || rawXml.length,
      importedAt: new Date().toISOString(),
      rawTextLength: rawXml.length,
    },
  };
}

export const parseFdxToCanonical = parseFdx;

