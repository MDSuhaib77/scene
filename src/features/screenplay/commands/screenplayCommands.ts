import { Editor, JSONContent } from '@tiptap/react';
import { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { ScreenplayElementType } from '../schema/screenplayExtensions';

export type ScreenplayToolbarCommandId =
  | 'scene'
  | 'action'
  | 'character'
  | 'parens'
  | 'dialogue'
  | 'transition'
  | 'shot'
  | 'text'
  | 'note'
  | 'outline'
  | 'newAct'
  | 'endAct'
  | 'lyrics'
  | 'image'
  | 'sequence'
  | 'dual';

export interface ScreenplayCommandSpec {
  id: ScreenplayToolbarCommandId;
  label: string;
  title: string;
  group: 'core' | 'structural';
  elementType?: ScreenplayElementType;
  shortcut?: string;
}

/**
 * Authoritative registry of all 16 required screenplay authoring capabilities (Section 2 & Section 4)
 */
export const SCREENPLAY_AUTHORING_COMMANDS: ScreenplayCommandSpec[] = [
  // A. Core screenplay elements (1–9)
  {
    id: 'scene',
    label: 'Scene',
    title: 'Scene Heading (INT./EXT.)',
    group: 'core',
    elementType: 'sceneHeading',
    shortcut: 'Alt+1',
  },
  {
    id: 'action',
    label: 'Action',
    title: 'Action Paragraph',
    group: 'core',
    elementType: 'action',
    shortcut: 'Alt+2',
  },
  {
    id: 'character',
    label: 'Character',
    title: 'Character Cue',
    group: 'core',
    elementType: 'character',
    shortcut: 'Alt+3',
  },
  {
    id: 'parens',
    label: 'Parens',
    title: 'Parenthetical Direction',
    group: 'core',
    elementType: 'parenthetical',
    shortcut: 'Alt+4',
  },
  {
    id: 'dialogue',
    label: 'Dialogue',
    title: 'Dialogue Paragraph',
    group: 'core',
    elementType: 'dialogue',
    shortcut: 'Alt+5',
  },
  {
    id: 'transition',
    label: 'Transition',
    title: 'Transition (CUT TO:)',
    group: 'core',
    elementType: 'transition',
    shortcut: 'Alt+6',
  },
  {
    id: 'shot',
    label: 'Shot',
    title: 'Camera / Shot Heading',
    group: 'core',
    elementType: 'shot',
    shortcut: 'Alt+7',
  },
  {
    id: 'text',
    label: 'Text',
    title: 'General Text',
    group: 'core',
    elementType: 'generalText',
    shortcut: 'Alt+8',
  },
  {
    id: 'note',
    label: 'Note',
    title: 'Insert or Format Script Note',
    group: 'core',
    elementType: 'screenplayNote',
    shortcut: 'Alt+9',
  },

  // B. Structural and advanced screenplay elements (10–16)
  {
    id: 'outline',
    label: 'Outline',
    title: 'Toggle Screenplay Document Outline',
    group: 'structural',
  },
  {
    id: 'newAct',
    label: 'New Act',
    title: 'Insert or Format Act Heading',
    group: 'structural',
    elementType: 'actHeading',
  },
  {
    id: 'endAct',
    label: 'End Act',
    title: 'Insert or Format End Act Marker',
    group: 'structural',
    elementType: 'endAct',
  },
  {
    id: 'lyrics',
    label: 'Lyrics',
    title: 'Format Musical Lyrics Block',
    group: 'structural',
    elementType: 'lyrics',
  },
  {
    id: 'image',
    label: 'Image',
    title: 'Insert Reference Image into Manuscript',
    group: 'structural',
    elementType: 'screenplayImage',
  },
  {
    id: 'sequence',
    label: 'Sequence',
    title: 'Insert or Format Sequence Heading',
    group: 'structural',
    elementType: 'sequenceHeading',
  },
  {
    id: 'dual',
    label: 'Dual',
    title: 'Create or Manage Dual Dialogue',
    group: 'structural',
    elementType: 'dualDialogue',
  },
];

export interface ScreenplayOutlineEntry {
  id: string;
  type: 'actHeading' | 'endAct' | 'sequenceHeading' | 'sceneHeading';
  text: string;
  pos: number;
  sceneNumber?: number;
  pageNumber?: number;
}

export interface ActiveScreenplayState {
  activeElement: ScreenplayElementType;
  isInsideDualDialogue: boolean;
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function toRoman(num: number): string {
  return ROMAN_NUMERALS[num - 1] || String(num);
}

/**
 * Inspects the current editor selection and returns the active semantic element type
 * and whether the cursor is currently inside a Dual Dialogue block.
 */
export function getActiveScreenplayState(editor: Editor): ActiveScreenplayState {
  const { selection } = editor.state;
  const { $from } = selection;

  if ((selection as any).node?.type?.name === 'screenplayImage') {
    return {
      activeElement: 'screenplayImage',
      isInsideDualDialogue: false,
    };
  }

  let isInsideDualDialogue = false;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'dualDialogue') {
      isInsideDualDialogue = true;
      break;
    }
  }

  const parentName = $from.parent.type.name as ScreenplayElementType;
  return {
    activeElement: parentName || 'action',
    isInsideDualDialogue,
  };
}

/**
 * Helper to check if the current cursor is inside a dualDialogueColumn and return the dualDialogue depth
 */
function findDualDialogueDepth(editor: Editor): number {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'dualDialogue') {
      return d;
    }
  }
  return -1;
}

function safeFocus(editor: Editor): void {
  try {
    if ((editor as any).editorView) {
      editor.view.focus();
    }
  } catch {
    // Headless editor without mounted DOM view
  }
}

function dispatchTr(editor: Editor, tr: any): boolean {
  editor.view.dispatch(tr.scrollIntoView());
  safeFocus(editor);
  return true;
}

/**
 * Sets or converts the current paragraph(s) to the target screenplay element while
 * preserving existing text and cursor selection.
 */
export function setScreenplayElement(
  editor: Editor,
  elementType: ScreenplayElementType
): boolean {
  const dualDepth = findDualDialogueDepth(editor);
  const allowedInDualColumn =
    elementType === 'character' ||
    elementType === 'parenthetical' ||
    elementType === 'dialogue';

  // If inside Dual Dialogue and the user chooses a block type not allowed inside dualDialogueColumn,
  // insert that block immediately after the dualDialogue container
  if (dualDepth !== -1 && !allowedInDualColumn) {
    const { state } = editor;
    const afterDual = state.selection.$from.after(dualDepth);
    const nodeType = state.schema.nodes[elementType];
    if (!nodeType) return false;
    const newNode = nodeType.create();
    const tr = state.tr.insert(afterDual, newNode);
    tr.setSelection(TextSelection.near(tr.doc.resolve(afterDual + 1)));
    return dispatchTr(editor, tr);
  }

  safeFocus(editor);
  return editor.commands.setNode(elementType);
}

/**
 * 1. Scene Command (Section 6):
 * - Preserves existing text when converting an existing non-scene paragraph.
 * - Inserts an empty Scene Heading when invoked on an existing non-empty Scene Heading,
 *   or converts the current empty paragraph into a Scene Heading.
 * - Places cursor at the editing position without forcing any modal.
 */
export function executeSceneCommand(editor: Editor): boolean {
  const { state } = editor;
  const { $from } = state.selection;
  const currentType = $from.parent.type.name;
  const hasText = $from.parent.textContent.trim().length > 0;
  const dualDepth = findDualDialogueDepth(editor);

  if (dualDepth !== -1) {
    return setScreenplayElement(editor, 'sceneHeading');
  }

  // If in a non-empty Scene/Act/Sequence/EndAct Heading and selection is collapsed at the end,
  // insert a new empty Scene Heading below it
  if (
    (currentType === 'sceneHeading' ||
      currentType === 'actHeading' ||
      currentType === 'sequenceHeading' ||
      currentType === 'endAct') &&
    hasText &&
    state.selection.empty &&
    $from.parentOffset === $from.parent.content.size
  ) {
    const insertPos = $from.after($from.depth);
    const sceneNode = state.schema.nodes.sceneHeading.create();
    const tr = state.tr.insert(insertPos, sceneNode);
    tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
    return dispatchTr(editor, tr);
  }

  safeFocus(editor);
  return editor.commands.setNode('sceneHeading');
}

/**
 * Optional Scene Heading assistance: inserts or updates standard INT./EXT. prefix or time-of-day suffix
 * in the active Scene Heading without modals or destructive overwrites.
 */
export function applySceneHeadingAssist(
  editor: Editor,
  assistToken: 'INT. ' | 'EXT. ' | 'INT./EXT. ' | ' - DAY' | ' - NIGHT' | ' - CONTINUOUS'
): boolean {
  const { state } = editor;
  const { $from } = state.selection;
  if ($from.parent.type.name !== 'sceneHeading') {
    return false;
  }

  const blockStart = $from.start($from.depth);
  const blockEnd = $from.end($from.depth);
  const currentText = $from.parent.textContent;

  let nextText = currentText;
  if (assistToken.startsWith(' - ')) {
    // Replace existing trailing time-of-day or append
    const cleaned = currentText.replace(/\s+-\s+(DAY|NIGHT|CONTINUOUS|DUSK|DAWN|LATER|MOMENTS LATER)$/i, '');
    nextText = `${cleaned.trimEnd()}${assistToken}`;
  } else {
    // Prefix replacement or insertion
    const stripped = currentText.replace(/^(INT\.\/EXT\.|I\/E\.|INT\.|EXT\.)\s*/i, '');
    nextText = `${assistToken}${stripped}`;
  }

  const tr = state.tr.insertText(nextText, blockStart, blockEnd);
  tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + nextText.length)));
  return dispatchTr(editor, tr);
}

/**
 * 9. Note Command (Section 7):
 * Inserts or formats a genuine screenplayNote block associated with the current screenplay location.
 */
export function executeNoteCommand(editor: Editor): boolean {
  const { state } = editor;
  const { $from } = state.selection;
  const currentType = $from.parent.type.name;
  const isBlockEmpty = $from.parent.textContent.trim().length === 0;
  const dualDepth = findDualDialogueDepth(editor);

  if (currentType === 'screenplayNote') {
    if (isBlockEmpty) {
      safeFocus(editor);
      return editor.commands.setNode('action');
    }
    safeFocus(editor);
    return true;
  }

  if (dualDepth === -1 && isBlockEmpty) {
    safeFocus(editor);
    return editor.commands.setNode('screenplayNote');
  }

  const insertPos =
    dualDepth !== -1 ? $from.after(dualDepth) : $from.after($from.depth);
  const noteNode = state.schema.nodes.screenplayNote.create({
    noteId: `note-${Date.now()}`,
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const tr = state.tr.insert(insertPos, noteNode);
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
  return dispatchTr(editor, tr);
}

/**
 * Helper to insert or convert a structural marker (New Act, End Act, Sequence)
 */
function insertOrConvertStructuralHeading(
  editor: Editor,
  nodeTypeName: 'actHeading' | 'endAct' | 'sequenceHeading',
  defaultText: string
): boolean {
  const { state } = editor;
  const { $from } = state.selection;
  const currentType = $from.parent.type.name;
  const isBlockEmpty = $from.parent.textContent.trim().length === 0;
  const dualDepth = findDualDialogueDepth(editor);

  const schemaNode = state.schema.nodes[nodeTypeName];
  if (!schemaNode) return false;

  if (
    dualDepth === -1 &&
    !isBlockEmpty &&
    currentType !== 'sceneHeading' &&
    currentType !== 'actHeading' &&
    currentType !== 'endAct' &&
    currentType !== 'sequenceHeading'
  ) {
    safeFocus(editor);
    return editor.commands.setNode(nodeTypeName);
  }

  const headingNode = schemaNode.create(
    {},
    defaultText ? state.schema.text(defaultText) : undefined
  );

  if (dualDepth === -1 && isBlockEmpty) {
    const blockStart = $from.before($from.depth);
    const blockEnd = $from.after($from.depth);
    const tr = state.tr.replaceWith(blockStart, blockEnd, headingNode);
    const endCursor = blockStart + 1 + defaultText.length;
    tr.setSelection(TextSelection.near(tr.doc.resolve(endCursor)));
    return dispatchTr(editor, tr);
  }

  const insertPos =
    dualDepth !== -1 ? $from.after(dualDepth) : $from.after($from.depth);
  const tr = state.tr.insert(insertPos, headingNode);
  const endCursor = insertPos + 1 + defaultText.length;
  tr.setSelection(TextSelection.near(tr.doc.resolve(endCursor)));
  return dispatchTr(editor, tr);
}

/**
 * 11. New Act Command (Section 9)
 */
export function executeNewActCommand(editor: Editor): boolean {
  let actCount = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'actHeading') {
      actCount += 1;
    }
  });
  const defaultActLabel = `ACT ${toRoman(actCount + 1)}`;
  return insertOrConvertStructuralHeading(editor, 'actHeading', defaultActLabel);
}

/**
 * 12. End Act Command (Section 9)
 */
export function executeEndActCommand(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  let latestActLabel = 'ACT I';
  editor.state.doc.nodesBetween(0, $from.pos, (node) => {
    if (node.type.name === 'actHeading' && node.textContent.trim()) {
      latestActLabel = node.textContent.trim().toUpperCase();
    }
  });
  const defaultEndLabel = latestActLabel.startsWith('END ')
    ? latestActLabel
    : `END OF ${latestActLabel}`;
  return insertOrConvertStructuralHeading(editor, 'endAct', defaultEndLabel);
}

/**
 * 15. Sequence Command (Section 9)
 */
export function executeSequenceCommand(editor: Editor): boolean {
  let seqCount = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'sequenceHeading') {
      seqCount += 1;
    }
  });
  const letter = String.fromCharCode(65 + (seqCount % 26));
  const defaultSeqLabel = `SEQUENCE ${letter}`;
  return insertOrConvertStructuralHeading(editor, 'sequenceHeading', defaultSeqLabel);
}

/**
 * 16. Dual Dialogue Command (Section 11):
 * Creates or manages a genuine structural Dual Dialogue container with two independent
 * dualDialogueColumn children. Preserves existing character/dialogue text when invoked
 * on a dialogue block.
 */
export function executeDualDialogueCommand(editor: Editor): boolean {
  const { state } = editor;
  const { schema, doc, selection } = state;
  const { $from } = selection;

  // 1. If already inside a Dual Dialogue block, unwrap it back into sequential blocks
  const dualDepth = findDualDialogueDepth(editor);
  if (dualDepth !== -1) {
    const dualPos = $from.before(dualDepth);
    const dualNode = $from.node(dualDepth);
    const extracted: PMNode[] = [];
    dualNode.forEach((col) => {
      col.forEach((child) => {
        extracted.push(child);
      });
    });
    if (extracted.length > 0) {
      const tr = state.tr.replaceWith(dualPos, dualPos + dualNode.nodeSize, extracted);
      tr.setSelection(TextSelection.near(tr.doc.resolve(dualPos + 1)));
      return dispatchTr(editor, tr);
    }
  }

  // Collect top-level children to inspect if cursor is inside a dialogue unit
  const topIndex = $from.index(0);
  const currentTopNode = doc.child(topIndex);
  const currentType = currentTopNode.type.name;

  const isDialoguePart = (typeName: string) =>
    typeName === 'character' || typeName === 'parenthetical' || typeName === 'dialogue';

  const createDefaultColumn = (side: 'left' | 'right', charName = '', lineText = '') => {
    const charNode = schema.nodes.character.create(
      {},
      charName ? schema.text(charName) : undefined
    );
    const dlgNode = schema.nodes.dialogue.create(
      {},
      lineText ? schema.text(lineText) : undefined
    );
    return schema.nodes.dualDialogueColumn.create({ side }, [charNode, dlgNode]);
  };

  if (isDialoguePart(currentType)) {
    let startIdx = topIndex;
    while (
      startIdx > 0 &&
      isDialoguePart(doc.child(startIdx - 1).type.name) &&
      doc.child(startIdx).type.name !== 'character'
    ) {
      startIdx -= 1;
    }

    let endIdx = topIndex;
    while (
      endIdx + 1 < doc.childCount &&
      (doc.child(endIdx + 1).type.name === 'parenthetical' ||
        doc.child(endIdx + 1).type.name === 'dialogue')
    ) {
      endIdx += 1;
    }

    const currentGroupNodes: PMNode[] = [];
    if (doc.child(startIdx).type.name !== 'character') {
      currentGroupNodes.push(schema.nodes.character.create({}, schema.text('CHARACTER 1')));
    }
    for (let i = startIdx; i <= endIdx; i++) {
      currentGroupNodes.push(doc.child(i));
    }
    if (
      currentGroupNodes.length === 1 &&
      currentGroupNodes[0].type.name === 'character'
    ) {
      currentGroupNodes.push(schema.nodes.dialogue.create());
    }

    let prevStartIdx = -1;
    const prevEndIdx = startIdx - 1;
    if (prevEndIdx >= 0 && isDialoguePart(doc.child(prevEndIdx).type.name)) {
      prevStartIdx = prevEndIdx;
      while (
        prevStartIdx > 0 &&
        isDialoguePart(doc.child(prevStartIdx - 1).type.name) &&
        doc.child(prevStartIdx).type.name !== 'character'
      ) {
        prevStartIdx -= 1;
      }
      if (doc.child(prevStartIdx).type.name !== 'character') {
        prevStartIdx = -1;
      }
    }

    let posBeforeStart = 0;
    const effectiveFirstIdx = prevStartIdx !== -1 ? prevStartIdx : startIdx;
    for (let i = 0; i < effectiveFirstIdx; i++) {
      posBeforeStart += doc.child(i).nodeSize;
    }
    let posAfterEnd = posBeforeStart;
    for (let i = effectiveFirstIdx; i <= endIdx; i++) {
      posAfterEnd += doc.child(i).nodeSize;
    }

    let leftCol: PMNode;
    let rightCol: PMNode;

    if (prevStartIdx !== -1) {
      const prevGroupNodes: PMNode[] = [];
      for (let i = prevStartIdx; i <= prevEndIdx; i++) {
        prevGroupNodes.push(doc.child(i));
      }
      leftCol = schema.nodes.dualDialogueColumn.create({ side: 'left' }, prevGroupNodes);
      rightCol = schema.nodes.dualDialogueColumn.create({ side: 'right' }, currentGroupNodes);
    } else {
      leftCol = schema.nodes.dualDialogueColumn.create({ side: 'left' }, currentGroupNodes);
      rightCol = createDefaultColumn('right');
    }

    const dualNode = schema.nodes.dualDialogue.create({}, [leftCol, rightCol]);
    const tr = state.tr.replaceWith(posBeforeStart, posAfterEnd, dualNode);
    const rightColFocusPos = posBeforeStart + 1 + leftCol.nodeSize + 2;
    tr.setSelection(TextSelection.near(tr.doc.resolve(rightColFocusPos)));
    return dispatchTr(editor, tr);
  }

  const leftCol = createDefaultColumn('left');
  const rightCol = createDefaultColumn('right');
  const dualNode = schema.nodes.dualDialogue.create({}, [leftCol, rightCol]);

  const isBlockEmpty = currentTopNode.textContent.trim().length === 0;
  if (isBlockEmpty) {
    const blockStart = $from.before(1);
    const blockEnd = $from.after(1);
    const tr = state.tr.replaceWith(blockStart, blockEnd, dualNode);
    tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + 3)));
    return dispatchTr(editor, tr);
  }

  const insertPos = $from.after(1);
  const tr = state.tr.insert(insertPos, dualNode);
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 3)));
  return dispatchTr(editor, tr);
}

/**
 * 14. Image Command & Validation Workflow (Section 10):
 * Validates supported image MIME types and file size, optimizes dimensions so huge binary
 * payloads are not embedded into JSON, and inserts a real screenplayImage node.
 */
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB upload policy limit

export interface ProcessedScreenplayImage {
  src: string;
  alt: string;
  caption: string;
}

export async function processScreenplayImageFile(
  file: File
): Promise<ProcessedScreenplayImage> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported image type "${file.type || 'unknown'}". Please select a PNG, JPEG, WebP, or GIF image.`
    );
  }
  if (file.size === 0) {
    throw new Error('The selected image file is empty.');
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error('Image exceeds the 10 MB maximum file size limit.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image data.'));
      }
    };
    reader.onerror = () => reject(new Error('File reader error while loading image.'));
    reader.readAsDataURL(file);
  });

  const compactSrc = await new Promise<string>((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(rawDataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const maxDim = 680;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w <= maxDim && h <= maxDim && rawDataUrl.length < 120_000) {
        resolve(rawDataUrl);
        return;
      }
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const targetW = Math.max(1, Math.round(w * scale));
      const targetH = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const compressed = canvas.toDataURL('image/webp', 0.82);
      resolve(compressed.startsWith('data:image/') ? compressed : rawDataUrl);
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });

  const cleanLabel = file.name.replace(/\.[a-z0-9]+$/i, '');
  return {
    src: compactSrc,
    alt: cleanLabel,
    caption: cleanLabel,
  };
}

export function insertScreenplayImage(
  editor: Editor,
  image: ProcessedScreenplayImage
): boolean {
  if (
    !image.src ||
    (!image.src.startsWith('data:image/') &&
      !image.src.startsWith('blob:') &&
      !image.src.startsWith('http'))
  ) {
    return false;
  }

  const { state } = editor;
  const { schema, selection } = state;
  const { $from } = selection;
  const dualDepth = findDualDialogueDepth(editor);

  const imageNode = schema.nodes.screenplayImage.create({
    src: image.src,
    alt: image.alt,
    caption: image.caption,
    alignment: 'center',
    widthPercent: 65,
  });

  const insertPos =
    dualDepth !== -1 ? $from.after(dualDepth) : $from.after($from.depth);
  const actionFollowNode = schema.nodes.action.create();

  const tr = state.tr.insert(insertPos, [imageNode, actionFollowNode]);
  const nextCursorPos = insertPos + imageNode.nodeSize + 1;
  tr.setSelection(TextSelection.near(tr.doc.resolve(nextCursorPos)));
  return dispatchTr(editor, tr);
}

/**
 * 10. Outline Extraction & Navigation (Section 8):
 * Extracts all structural markers (Act Heading, End Act, Sequence Heading, Scene Heading)
 * directly from the live ProseMirror document so there is never a second source of truth.
 */
export function extractScreenplayOutline(doc: PMNode): ScreenplayOutlineEntry[] {
  const entries: ScreenplayOutlineEntry[] = [];
  let sceneCounter = 0;

  doc.forEach((node, offset) => {
    const type = node.type.name;
    if (
      type === 'sceneHeading' ||
      type === 'actHeading' ||
      type === 'endAct' ||
      type === 'sequenceHeading'
    ) {
      const raw = node.textContent.trim();
      if (type === 'sceneHeading') {
        sceneCounter += 1;
      }
      entries.push({
        id: `${type}-${offset}`,
        type: type as ScreenplayOutlineEntry['type'],
        text:
          raw ||
          (type === 'sceneHeading'
            ? 'UNTITLED SCENE'
            : type === 'actHeading'
              ? 'UNTITLED ACT'
              : type === 'endAct'
                ? 'END OF ACT'
                : 'UNTITLED SEQUENCE'),
        pos: offset + 1,
        sceneNumber: type === 'sceneHeading' ? sceneCounter : undefined,
      });
    }
  });

  return entries;
}

export function navigateToOutlineEntry(editor: Editor, pos: number): boolean {
  const { state } = editor;
  const clampedPos = Math.max(1, Math.min(pos, state.doc.content.size));
  const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(clampedPos)));
  dispatchTr(editor, tr);

  // Also ensure the DOM element is scrolled smoothly within the viewport when mounted
  try {
    if ((editor as any).editorView) {
      const domAtPos = editor.view.domAtPos(clampedPos);
      const el =
        domAtPos.node instanceof HTMLElement
          ? domAtPos.node
          : domAtPos.node.parentElement;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  } catch {
    // Headless fallback
  }
  return true;
}

/**
 * Extracts clean screenplay plain text from the ProseMirror document while excluding
 * internal screenplayNote blocks so notes are never exported as dialogue or action.
 */
export function extractScreenplayPlainText(doc: PMNode): string {
  const lines: string[] = [];

  doc.forEach((node) => {
    const type = node.type.name;
    if (type === 'screenplayNote' || type === 'screenplayImage') {
      return;
    }
    if (type === 'dualDialogue') {
      node.forEach((col, _colOffset, colIndex) => {
        col.forEach((child) => {
          const text = child.textContent;
          if (child.type.name === 'character' && colIndex === 1) {
            lines.push(`${text} ^`);
          } else {
            lines.push(text);
          }
        });
      });
      return;
    }
    lines.push(node.textContent);
  });

  return lines.join('\n');
}

import { parseFountain } from '../model/fountainParser';
import { canonicalToTiptapDoc } from '../model/canonicalConverters';

/**
 * Valid node type names in our authoritative screenplay schema
 */
const VALID_TOP_NODE_NAMES = new Set<string>([
  'sceneHeading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
  'generalText',
  'screenplayNote',
  'actHeading',
  'endAct',
  'sequenceHeading',
  'lyrics',
  'screenplayImage',
  'dualDialogue',
]);

/**
 * Parses plain text or Fountain text into semantic screenplay JSONContent
 * using the canonical Fountain specification parser.
 */
export function parsePlainTextToScreenplayDoc(rawText: string): JSONContent {
  if (!rawText || rawText.trim().length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'action' }],
    };
  }

  const canonical = parseFountain(rawText);
  return canonicalToTiptapDoc(canonical);
}

/**
 * Validates and sanitizes a saved ProseMirror JSON document before loading into Tiptap
 * so malformed structures cannot break the editor (Section 15).
 */
export function deserializeScreenplayDocument(
  documentJson?: string | null,
  rawTextFallback?: string | null
): JSONContent {
  if (documentJson && typeof documentJson === 'string' && documentJson.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(documentJson) as JSONContent;
      if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content) && parsed.content.length > 0) {
        const sanitizedBlocks: JSONContent[] = [];
        for (const node of parsed.content) {
          if (!node || typeof node.type !== 'string') continue;
          if (node.type === 'paragraph') {
            sanitizedBlocks.push({ ...node, type: 'action' });
          } else if (VALID_TOP_NODE_NAMES.has(node.type)) {
            sanitizedBlocks.push(node);
          } else {
            sanitizedBlocks.push({
              type: 'action',
              content: node.content,
            });
          }
        }
        if (sanitizedBlocks.length > 0) {
          return {
            type: 'doc',
            content: sanitizedBlocks,
          };
        }
      }
    } catch {
      // Fall back to plain text parser if JSON is malformed
    }
  }

  return parsePlainTextToScreenplayDoc(rawTextFallback || '');
}
