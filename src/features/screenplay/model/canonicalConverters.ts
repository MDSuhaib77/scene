/**
 * SceneOS — Canonical Screenplay Converters & Serializers
 * Bi-directional conversion between CanonicalScreenplayDocument, Tiptap JSONContent,
 * Fountain text, Final Draft XML, Plain Text, and ParsedScene models.
 */

import { JSONContent } from '@tiptap/react';
import {
  CanonicalScreenplayDocument,
  CanonicalElement,
  CanonicalElementType,
  ScreenplayMetadata,
  generateElementId,
  DualDialogueProperties,
  FormattingSpan,
  ObservedElementFormatting,
} from './canonicalScreenplay';
import { ParsedScene } from '../../../types';

/**
 * Builds Tiptap text nodes with marks (bold, italic, underline) from formatting spans
 */
function buildTextNodesWithFormatting(
  text: string,
  formatting?: FormattingSpan[]
): JSONContent[] | undefined {
  if (!text) return undefined;
  if (!formatting || formatting.length === 0) {
    return [{ type: 'text', text }];
  }

  // Generate boundary points from spans
  const boundaries = new Set<number>([0, text.length]);
  for (const span of formatting) {
    if (span.start >= 0 && span.start <= text.length) boundaries.add(span.start);
    if (span.end >= 0 && span.end <= text.length) boundaries.add(span.end);
  }
  const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);

  const textNodes: JSONContent[] = [];
  for (let idx = 0; idx < sortedPoints.length - 1; idx++) {
    const start = sortedPoints[idx];
    const end = sortedPoints[idx + 1];
    const sliceText = text.slice(start, end);
    if (!sliceText) continue;

    // Check which spans cover this slice
    const activeSpans = formatting.filter(
      (s) => s.start <= start && s.end >= end
    );

    const marks: Array<{ type: string }> = [];
    if (activeSpans.some((s) => s.type === 'bold')) marks.push({ type: 'bold' });
    if (activeSpans.some((s) => s.type === 'italic')) marks.push({ type: 'italic' });
    if (activeSpans.some((s) => s.type === 'underline')) marks.push({ type: 'underline' });

    textNodes.push({
      type: 'text',
      text: sliceText,
      marks: marks.length > 0 ? marks : undefined,
    });
  }

  return textNodes.length > 0 ? textNodes : [{ type: 'text', text }];
}

/**
 * Constructs node attributes from observed formatting
 */
function buildNodeAttrs(el: CanonicalElement): Record<string, any> | undefined {
  const attrs: Record<string, any> = {};
  if (el.observedFormatting) {
    const f = el.observedFormatting;
    if (f.fontSizePt) attrs.fontSizePt = f.fontSizePt;
    if (f.fontFamily) attrs.fontFamily = f.fontFamily;
    if (f.fontWeight) attrs.fontWeight = f.fontWeight;
    if (f.isItalic) attrs.isItalic = f.isItalic;
    if (f.alignment) attrs.alignment = f.alignment;
    if (f.indentLeftInches !== undefined && f.indentLeftInches !== null) {
      attrs.indentLeftInches = f.indentLeftInches;
    }
    if (f.indentRightInches !== undefined && f.indentRightInches !== null) {
      attrs.indentRightInches = f.indentRightInches;
    }
    if (f.marginTopPt !== undefined && f.marginTopPt !== null) {
      attrs.marginTopPt = f.marginTopPt;
    }
    if (f.sourceCoordinates) attrs.sourceCoordinates = f.sourceCoordinates;
  }
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

/**
 * Extracts concatenated text and formatting spans from Tiptap node content
 */
function extractTextAndFormatting(nodeContent?: JSONContent[]): {
  text: string;
  formatting?: FormattingSpan[];
} {
  if (!nodeContent || nodeContent.length === 0) {
    return { text: '' };
  }

  let fullText = '';
  const spans: FormattingSpan[] = [];

  for (const item of nodeContent) {
    if (item.type === 'text' && typeof item.text === 'string') {
      const start = fullText.length;
      fullText += item.text;
      const end = fullText.length;

      if (item.marks && item.marks.length > 0) {
        for (const m of item.marks) {
          if (m.type === 'bold' || m.type === 'italic' || m.type === 'underline') {
            spans.push({
              type: m.type as 'bold' | 'italic' | 'underline',
              start,
              end,
            });
          }
        }
      }
    }
  }

  return {
    text: fullText,
    formatting: spans.length > 0 ? spans : undefined,
  };
}

/**
 * 1. Converts CanonicalScreenplayDocument into Tiptap / ProseMirror JSONContent
 */
export function canonicalToTiptapDoc(canonical: CanonicalScreenplayDocument): JSONContent {
  const content: JSONContent[] = [];

  for (let i = 0; i < canonical.elements.length; i++) {
    const el = canonical.elements[i];

    if (el.type === 'dual_dialogue' && el.dualDialogue) {
      const leftNodes: JSONContent[] = [
        {
          type: 'character',
          content: el.dualDialogue.left.character.text
            ? [{ type: 'text', text: el.dualDialogue.left.character.text }]
            : undefined,
        },
      ];
      if (el.dualDialogue.left.parenthetical?.text) {
        leftNodes.push({
          type: 'parenthetical',
          content: [{ type: 'text', text: el.dualDialogue.left.parenthetical.text }],
        });
      }
      for (const d of el.dualDialogue.left.dialogue) {
        if (d.text) {
          leftNodes.push({
            type: 'dialogue',
            content: [{ type: 'text', text: d.text }],
          });
        }
      }

      const rightNodes: JSONContent[] = [
        {
          type: 'character',
          content: el.dualDialogue.right.character.text
            ? [{ type: 'text', text: el.dualDialogue.right.character.text }]
            : undefined,
        },
      ];
      if (el.dualDialogue.right.parenthetical?.text) {
        rightNodes.push({
          type: 'parenthetical',
          content: [{ type: 'text', text: el.dualDialogue.right.parenthetical.text }],
        });
      }
      for (const d of el.dualDialogue.right.dialogue) {
        if (d.text) {
          rightNodes.push({
            type: 'dialogue',
            content: [{ type: 'text', text: d.text }],
          });
        }
      }

      content.push({
        type: 'dualDialogue',
        content: [
          {
            type: 'dualDialogueColumn',
            attrs: { side: 'left' },
            content: leftNodes,
          },
          {
            type: 'dualDialogueColumn',
            attrs: { side: 'right' },
            content: rightNodes,
          },
        ],
      });
      continue;
    }

    if (el.isDualDialogue && el.type === 'character') {
      const leftNodes: JSONContent[] = [];
      while (
        content.length > 0 &&
        (content[content.length - 1].type === 'dialogue' ||
          content[content.length - 1].type === 'parenthetical' ||
          content[content.length - 1].type === 'character')
      ) {
        const popped = content.pop()!;
        leftNodes.unshift(popped);
        if (popped.type === 'character') break;
      }

      const rightNodes: JSONContent[] = [
        {
          type: 'character',
          content: el.text ? [{ type: 'text', text: el.text }] : undefined,
        },
      ];

      while (
        i + 1 < canonical.elements.length &&
        canonical.elements[i + 1].isDualDialogue &&
        canonical.elements[i + 1].type !== 'character'
      ) {
        i++;
        const nextEl = canonical.elements[i];
        const nextTextNode = nextEl.text ? [{ type: 'text', text: nextEl.text }] : undefined;
        if (nextEl.type === 'parenthetical') {
          rightNodes.push({ type: 'parenthetical', content: nextTextNode });
        } else {
          rightNodes.push({ type: 'dialogue', content: nextTextNode });
        }
      }

      content.push({
        type: 'dualDialogue',
        content: [
          {
            type: 'dualDialogueColumn',
            attrs: { side: 'left' },
            content: leftNodes,
          },
          {
            type: 'dualDialogueColumn',
            attrs: { side: 'right' },
            content: rightNodes,
          },
        ],
      });
      continue;
    }

    const nodeAttrs = buildNodeAttrs(el);
    const textNodes = buildTextNodesWithFormatting(el.text || '', el.formatting);

    switch (el.type) {
      case 'scene_heading':
        content.push({ type: 'sceneHeading', attrs: nodeAttrs, content: textNodes });
        break;
      case 'character':
        content.push({ type: 'character', attrs: nodeAttrs, content: textNodes });
        break;
      case 'parenthetical':
        content.push({ type: 'parenthetical', attrs: nodeAttrs, content: textNodes });
        break;
      case 'dialogue':
        content.push({ type: 'dialogue', attrs: nodeAttrs, content: textNodes });
        break;
      case 'transition':
        content.push({ type: 'transition', attrs: nodeAttrs, content: textNodes });
        break;
      case 'section_heading':
        content.push({ type: 'actHeading', attrs: nodeAttrs, content: textNodes });
        break;
      case 'lyrics':
        content.push({ type: 'lyrics', attrs: nodeAttrs, content: textNodes });
        break;
      case 'centered_text':
        if (/^ACT\s+[IVX0-9]+/i.test(el.text)) {
          content.push({ type: 'actHeading', attrs: nodeAttrs, content: textNodes });
        } else if (/^END\s+OF\s+ACT/i.test(el.text)) {
          content.push({ type: 'endAct', attrs: nodeAttrs, content: textNodes });
        } else {
          content.push({ type: 'generalText', attrs: nodeAttrs, content: textNodes });
        }
        break;
      case 'note':
        content.push({ type: 'screenplayNote', attrs: nodeAttrs, content: textNodes });
        break;
      case 'page_break':
        content.push({ type: 'generalText', attrs: nodeAttrs, content: [{ type: 'text', text: '===' }] });
        break;
      case 'action':
      default:
        content.push({ type: 'action', attrs: nodeAttrs, content: textNodes });
        break;
    }
  }

  if (content.length === 0) {
    content.push({ type: 'action' });
  }

  return {
    type: 'doc',
    content,
  };
}

/**
 * 2. Converts Tiptap JSONContent into a CanonicalScreenplayDocument
 */
export function tiptapDocToCanonical(
  doc: JSONContent,
  metadata: ScreenplayMetadata = {}
): CanonicalScreenplayDocument {
  const elements: CanonicalElement[] = [];
  const rawNodes = doc.content || [];

  for (const node of rawNodes) {
    const nodeType = node.type || 'action';

    if (nodeType === 'dualDialogue' && Array.isArray(node.content)) {
      const leftCol = node.content[0]?.content || [];
      const rightCol = node.content[1]?.content || [];

      const extractCol = (colNodes: JSONContent[]) => {
        let charElem: CanonicalElement = {
          id: generateElementId('chr'),
          type: 'character',
          text: '',
          confidence: 'high',
        };
        let parenElem: CanonicalElement | undefined;
        const diaElems: CanonicalElement[] = [];

        for (const sub of colNodes) {
          const { text: subText, formatting: subFormatting } = extractTextAndFormatting(sub.content);
          if (sub.type === 'character') {
            charElem = {
              id: generateElementId('chr'),
              type: 'character',
              text: subText,
              formatting: subFormatting,
              characterProperties: { characterName: subText },
              confidence: 'high',
            };
          } else if (sub.type === 'parenthetical') {
            parenElem = {
              id: generateElementId('par'),
              type: 'parenthetical',
              text: subText,
              formatting: subFormatting,
              confidence: 'high',
            };
          } else if (sub.type === 'dialogue') {
            diaElems.push({
              id: generateElementId('dia'),
              type: 'dialogue',
              text: subText,
              formatting: subFormatting,
              confidence: 'high',
            });
          }
        }

        return { character: charElem, parenthetical: parenElem, dialogue: diaElems };
      };

      const left = extractCol(leftCol);
      const right = extractCol(rightCol);

      if (left.character.text) {
        elements.push(left.character);
      }
      if (left.parenthetical && left.parenthetical.text) {
        elements.push(left.parenthetical);
      }
      for (const d of left.dialogue) {
        if (d.text) elements.push(d);
      }

      if (right.character.text) {
        elements.push({
          ...right.character,
          isDualDialogue: true,
        });
      }
      if (right.parenthetical && right.parenthetical.text) {
        elements.push({
          ...right.parenthetical,
          isDualDialogue: true,
        });
      }
      for (const d of right.dialogue) {
        if (d.text) {
          elements.push({
            ...d,
            isDualDialogue: true,
          });
        }
      }
      continue;
    }

    const { text, formatting } = extractTextAndFormatting(node.content);

    let observedFormatting: ObservedElementFormatting | undefined;
    if (node.attrs) {
      const a = node.attrs;
      if (
        a.fontSizePt ||
        a.fontFamily ||
        a.fontWeight ||
        a.isItalic ||
        a.alignment ||
        a.indentLeftInches !== undefined ||
        a.indentRightInches !== undefined ||
        a.marginTopPt !== undefined ||
        a.sourceCoordinates
      ) {
        observedFormatting = {
          fontSizePt: a.fontSizePt,
          fontFamily: a.fontFamily,
          fontWeight: a.fontWeight,
          isItalic: a.isItalic,
          alignment: a.alignment,
          indentLeftInches: a.indentLeftInches,
          indentRightInches: a.indentRightInches,
          marginTopPt: a.marginTopPt,
          sourceCoordinates: a.sourceCoordinates,
          isObserved: true,
        };
      }
    }

    let type: CanonicalElementType = 'action';
    switch (nodeType) {
      case 'sceneHeading':
        type = 'scene_heading';
        break;
      case 'character':
        type = 'character';
        break;
      case 'parenthetical':
        type = 'parenthetical';
        break;
      case 'dialogue':
        type = 'dialogue';
        break;
      case 'transition':
        type = 'transition';
        break;
      case 'actHeading':
      case 'sequenceHeading':
        type = 'section_heading';
        break;
      case 'lyrics':
        type = 'lyrics';
        break;
      case 'screenplayNote':
        type = 'note';
        break;
      case 'generalText':
        type = text === '===' ? 'page_break' : 'action';
        break;
      case 'action':
      default:
        type = 'action';
        break;
    }

    elements.push({
      id: generateElementId('elem'),
      type,
      text,
      formatting,
      observedFormatting,
      confidence: 'high',
    });
  }

  return {
    id: generateElementId('doc'),
    metadata,
    elements,
    warnings: [],
    provenance: {
      sourceFormat: 'native',
      importedAt: new Date().toISOString(),
      rawTextLength: elements.reduce((acc, el) => acc + el.text.length, 0),
    },
  };
}

/**
 * 3. Serializes CanonicalScreenplayDocument to official Fountain format
 */
export function canonicalToFountain(canonical: CanonicalScreenplayDocument): string {
  const chunks: string[] = [];
  const meta = canonical.metadata;

  // Title page block if metadata exists
  if (meta.title || meta.authors?.length || meta.credit) {
    if (meta.title) chunks.push(`Title: ${meta.title}`);
    if (meta.credit) chunks.push(`Credit: ${meta.credit}`);
    if (meta.authors && meta.authors.length > 0) {
      chunks.push(`Author: ${meta.authors.join(', ')}`);
    }
    if (meta.source) chunks.push(`Source: ${meta.source}`);
    if (meta.draftDate) chunks.push(`Draft date: ${meta.draftDate}`);
    if (meta.contact) chunks.push(`Contact: ${meta.contact}`);
    if (meta.copyright) chunks.push(`Copyright: ${meta.copyright}`);
    if (meta.notes) chunks.push(`Notes: ${meta.notes}`);
    chunks.push(''); // Blank line terminates Title Page in Fountain
  }

  for (let i = 0; i < canonical.elements.length; i++) {
    const el = canonical.elements[i];

    if (el.type === 'dual_dialogue' && el.dualDialogue) {
      const left = el.dualDialogue.left;
      const right = el.dualDialogue.right;

      // Left character & dialogue
      chunks.push(left.character.text);
      if (left.parenthetical?.text) chunks.push(left.parenthetical.text);
      for (const d of left.dialogue) chunks.push(d.text);
      chunks.push('');

      // Right character (with ^) & dialogue
      chunks.push(`${right.character.text} ^`);
      if (right.parenthetical?.text) chunks.push(right.parenthetical.text);
      for (const d of right.dialogue) chunks.push(d.text);
      chunks.push('');
      continue;
    }

    switch (el.type) {
      case 'scene_heading': {
        const sceneNum = el.sceneProperties?.sceneNumber ? ` #${el.sceneProperties.sceneNumber}#` : '';
        const isStandard = /^(INT\.|EXT\.|INT\/EXT\.|INT\.\/EXT\.|I\/E\.|EST\.)/i.test(el.text);
        const headingLine = isStandard ? `${el.text}${sceneNum}` : `.${el.text}${sceneNum}`;
        chunks.push(headingLine);
        chunks.push('');
        break;
      }
      case 'character':
        chunks.push(el.text);
        break;
      case 'parenthetical':
        chunks.push(el.text.startsWith('(') ? el.text : `(${el.text})`);
        break;
      case 'dialogue':
        chunks.push(el.text);
        // If next element is not dialogue or parenthetical, add blank line
        const nextEl = canonical.elements[i + 1];
        if (!nextEl || (nextEl.type !== 'dialogue' && nextEl.type !== 'parenthetical')) {
          chunks.push('');
        }
        break;
      case 'transition': {
        const isStandard = el.text.endsWith('TO:') || el.text === 'FADE OUT.' || el.text === 'FADE IN:';
        chunks.push(isStandard ? el.text : `> ${el.text}`);
        chunks.push('');
        break;
      }
      case 'centered_text':
        chunks.push(`> ${el.text} <`);
        chunks.push('');
        break;
      case 'section_heading': {
        const hashes = '#'.repeat(el.sectionLevel || 1);
        chunks.push(`${hashes} ${el.text}`);
        chunks.push('');
        break;
      }
      case 'synopsis':
        chunks.push(`= ${el.text}`);
        chunks.push('');
        break;
      case 'note':
        chunks.push(`[[ ${el.text} ]]`);
        chunks.push('');
        break;
      case 'page_break':
        chunks.push('===');
        chunks.push('');
        break;
      case 'action':
      default:
        if (el.text) {
          chunks.push(el.text);
          chunks.push('');
        }
        break;
    }
  }

  return chunks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 4. Serializes CanonicalScreenplayDocument to Final Draft XML (FDX) format
 */
export function canonicalToFdx(canonical: CanonicalScreenplayDocument): string {
  const escapeXml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const meta = canonical.metadata;
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n`;
  xml += `<FinalDraft DocumentType="Script" Template="No" Version="4">\n`;

  // TitlePage
  xml += `  <TitlePage>\n`;
  xml += `    <Content>\n`;
  if (meta.title) {
    xml += `      <Paragraph Type="Title"><Text>${escapeXml(meta.title)}</Text></Paragraph>\n`;
  }
  if (meta.credit) {
    xml += `      <Paragraph Type="Credit"><Text>${escapeXml(meta.credit)}</Text></Paragraph>\n`;
  }
  if (meta.authors && meta.authors.length > 0) {
    xml += `      <Paragraph Type="Author"><Text>${escapeXml(meta.authors.join(', '))}</Text></Paragraph>\n`;
  }
  if (meta.source) {
    xml += `      <Paragraph Type="Source"><Text>${escapeXml(meta.source)}</Text></Paragraph>\n`;
  }
  xml += `    </Content>\n`;
  xml += `  </TitlePage>\n`;

  // Script Content
  xml += `  <Content>\n`;

  for (const el of canonical.elements) {
    if (el.type === 'dual_dialogue' && el.dualDialogue) {
      xml += `    <Paragraph Type="Action">\n`;
      xml += `      <DualDialogue>\n`;
      // Left
      xml += `        <Paragraph Type="Character"><Text>${escapeXml(el.dualDialogue.left.character.text)}</Text></Paragraph>\n`;
      if (el.dualDialogue.left.parenthetical?.text) {
        xml += `        <Paragraph Type="Parenthetical"><Text>${escapeXml(el.dualDialogue.left.parenthetical.text)}</Text></Paragraph>\n`;
      }
      for (const d of el.dualDialogue.left.dialogue) {
        xml += `        <Paragraph Type="Dialogue"><Text>${escapeXml(d.text)}</Text></Paragraph>\n`;
      }
      // Right
      xml += `        <Paragraph Type="Character"><Text>${escapeXml(el.dualDialogue.right.character.text)}</Text></Paragraph>\n`;
      if (el.dualDialogue.right.parenthetical?.text) {
        xml += `        <Paragraph Type="Parenthetical"><Text>${escapeXml(el.dualDialogue.right.parenthetical.text)}</Text></Paragraph>\n`;
      }
      for (const d of el.dualDialogue.right.dialogue) {
        xml += `        <Paragraph Type="Dialogue"><Text>${escapeXml(d.text)}</Text></Paragraph>\n`;
      }
      xml += `      </DualDialogue>\n`;
      xml += `    </Paragraph>\n`;
      continue;
    }

    switch (el.type) {
      case 'scene_heading': {
        const numAttr = el.sceneProperties?.sceneNumber
          ? ` Number="${escapeXml(el.sceneProperties.sceneNumber)}"`
          : '';
        xml += `    <Paragraph Type="Scene Heading">\n`;
        if (numAttr) {
          xml += `      <SceneProperties${numAttr} />\n`;
        }
        xml += `      <Text>${escapeXml(el.text)}</Text>\n`;
        xml += `    </Paragraph>\n`;
        break;
      }
      case 'character':
        xml += `    <Paragraph Type="Character"><Text>${escapeXml(el.text)}</Text></Paragraph>\n`;
        break;
      case 'parenthetical':
        xml += `    <Paragraph Type="Parenthetical"><Text>${escapeXml(el.text)}</Text></Paragraph>\n`;
        break;
      case 'dialogue':
        xml += `    <Paragraph Type="Dialogue"><Text>${escapeXml(el.text)}</Text></Paragraph>\n`;
        break;
      case 'transition':
        xml += `    <Paragraph Type="Transition"><Text>${escapeXml(el.text)}</Text></Paragraph>\n`;
        break;
      case 'action':
      default:
        xml += `    <Paragraph Type="Action"><Text>${escapeXml(el.text)}</Text></Paragraph>\n`;
        break;
    }
  }

  xml += `  </Content>\n`;
  xml += `</FinalDraft>\n`;

  return xml;
}

/**
 * 5. Serializes CanonicalScreenplayDocument to clean readable Plain Text
 */
export function canonicalToPlainText(canonical: CanonicalScreenplayDocument): string {
  const lines: string[] = [];

  for (const el of canonical.elements) {
    if (el.type === 'note') continue; // Notes excluded from plain manuscript
    if (el.type === 'dual_dialogue' && el.dualDialogue) {
      lines.push(el.dualDialogue.left.character.text);
      if (el.dualDialogue.left.parenthetical?.text) lines.push(el.dualDialogue.left.parenthetical.text);
      for (const d of el.dualDialogue.left.dialogue) lines.push(d.text);
      lines.push('');
      lines.push(`${el.dualDialogue.right.character.text} ^`);
      if (el.dualDialogue.right.parenthetical?.text) lines.push(el.dualDialogue.right.parenthetical.text);
      for (const d of el.dualDialogue.right.dialogue) lines.push(d.text);
      lines.push('');
      continue;
    }

    if (el.text) {
      lines.push(el.text);
      if (
        el.type === 'scene_heading' ||
        el.type === 'transition' ||
        el.type === 'action' ||
        el.type === 'section_heading'
      ) {
        lines.push('');
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 6. Projects CanonicalScreenplayDocument into ParsedScene[] for Script Intelligence & Breakdown
 */
export function canonicalToParsedScenes(canonical: CanonicalScreenplayDocument): ParsedScene[] {
  const scenes: ParsedScene[] = [];
  let currentScene: Partial<ParsedScene> | null = null;
  let currentLines: string[] = [];
  let sceneCounter = 1;
  let activeCharacterCue: string | null = null;
  let activeParenthetical: string | null = null;
  let activeDialogueIndex: number | null = null;

  const resetDialogueTurn = () => {
    activeCharacterCue = null;
    activeParenthetical = null;
    activeDialogueIndex = null;
  };

  const finalizeScene = () => {
    if (currentScene && currentScene.slugline) {
      const lineCount = Math.max(1, currentLines.length);
      const eighths = Math.max(1, Math.round((lineCount / 54) * 8));

      scenes.push({
        id: currentScene.id || `scn-${scenes.length + 1}`,
        sceneNumber: currentScene.sceneNumber || `${scenes.length + 1}`,
        slugline: currentScene.slugline,
        intExt: currentScene.intExt || 'INT',
        location: currentScene.location || 'UNKNOWN LOCATION',
        timeOfDay: currentScene.timeOfDay || 'DAY',
        pageLengthEighths: eighths,
        pageLengthDisplay: `${eighths}/8`,
        startPage: Math.max(1, Math.ceil(scenes.reduce((acc, s) => acc + s.pageLengthEighths, 0) / 8)),
        estimatedDurationMinutes: Math.max(0.5, (eighths / 8)),
        characters: Array.from(new Set(currentScene.characters || [])),
        dialogueBlocks: currentScene.dialogueBlocks || [],
        actionSnippet: currentLines.slice(0, 3).join('\n'),
        elements: [],
        status: 'unreviewed',
      });
    }
  };

  for (const el of canonical.elements) {
    if (el.type === 'scene_heading') {
      finalizeScene();
      resetDialogueTurn();
      const slugline = el.text;
      const sceneProps = el.sceneProperties;
      const num = sceneProps?.sceneNumber || `${sceneCounter++}`;

      // Extract INT/EXT, Location, and Time of Day
      const upper = slugline.toUpperCase();
      let intExt: any = 'INT';
      if (upper.startsWith('EXT')) intExt = 'EXT';
      else if (upper.startsWith('INT/EXT') || upper.startsWith('INT./EXT.') || upper.startsWith('I/E')) intExt = 'INT/EXT';

      const parts = slugline.split(/\s+[-—–]\s+/);
      const timeOfDay: any = parts.length > 1 ? parts[parts.length - 1].trim() : 'DAY';
      const location = parts.length > 1 ? parts.slice(0, -1).join(' - ').replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '').trim() : slugline;

      currentScene = {
        id: el.id,
        sceneNumber: num,
        slugline,
        intExt,
        location: location || 'UNKNOWN LOCATION',
        timeOfDay,
        characters: [],
        dialogueBlocks: [],
      };
      currentLines = [slugline];
      continue;
    }

    if (!currentScene) {
      currentScene = {
        id: `scn-1`,
        sceneNumber: '1',
        slugline: 'INT. UNTITLED SCENE - DAY',
        intExt: 'INT',
        location: 'UNTITLED SCENE',
        timeOfDay: 'DAY',
        characters: [],
        dialogueBlocks: [],
      };
      currentLines = [];
      resetDialogueTurn();
    }

    if (el.text) {
      currentLines.push(el.text);
    }

    if (el.type === 'character' && el.text) {
      const charName = (el.characterProperties?.characterName || el.text)
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\^$/, '')
        .replace(/^@/, '')
        .trim()
        .toUpperCase();
      if (charName && !currentScene.characters?.includes(charName)) {
        currentScene.characters?.push(charName);
      }
      activeCharacterCue = el.text.trim();
      activeParenthetical = null;
      activeDialogueIndex = null;
    } else if (el.type === 'parenthetical' && el.text) {
      activeParenthetical = el.text.trim();
    } else if (el.type === 'dialogue' && el.text) {
      const lineText = el.text.trim();
      if (!lineText) continue;
      if (!currentScene.dialogueBlocks) currentScene.dialogueBlocks = [];
      if (activeCharacterCue) {
        if (activeDialogueIndex !== null && !activeParenthetical && currentScene.dialogueBlocks[activeDialogueIndex]) {
          currentScene.dialogueBlocks[activeDialogueIndex].text += `\n${lineText}`;
        } else {
          currentScene.dialogueBlocks.push({
            character: activeCharacterCue,
            parenthetical: activeParenthetical || undefined,
            text: lineText,
          });
          activeDialogueIndex = currentScene.dialogueBlocks.length - 1;
          activeParenthetical = null;
        }
      } else {
        // Unassigned dialogue block captured for completeness audit
        currentScene.dialogueBlocks.push({
          character: '',
          parenthetical: activeParenthetical || undefined,
          text: lineText,
        });
        activeParenthetical = null;
      }
    } else if (el.type === 'dual_dialogue' && el.dualDialogue) {
      resetDialogueTurn();
      if (!currentScene.dialogueBlocks) currentScene.dialogueBlocks = [];
      const dualGroupId = el.id || `dual-${currentScene.dialogueBlocks.length}`;
      const columns = [el.dualDialogue.left, el.dualDialogue.right];
      for (const col of columns) {
        const rawChar = col?.character?.text?.trim();
        const diagText = (col?.dialogue || []).map((d) => d.text.trim()).filter(Boolean).join('\n');
        if (rawChar) {
          const cleanName = (col.character.characterProperties?.characterName || rawChar)
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/\^$/, '')
            .replace(/^@/, '')
            .trim()
            .toUpperCase();
          if (cleanName && !currentScene.characters?.includes(cleanName)) {
            currentScene.characters?.push(cleanName);
          }
          if (diagText) {
            currentScene.dialogueBlocks.push({
              character: rawChar,
              parenthetical: col.parenthetical?.text?.trim() || undefined,
              text: diagText,
              isDualDialogue: true,
              dualGroupId,
            });
          }
        }
      }
    } else {
      resetDialogueTurn();
    }
  }

  finalizeScene();
  return scenes;
}
