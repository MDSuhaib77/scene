import React from 'react';
import {
  Node,
  Extension,
  Mark,
  mergeAttributes,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  NodeViewProps,
} from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import {
  StickyNote,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Columns2,
} from 'lucide-react';
import { ScreenplayPaginationExtension } from '../layout/screenplayPaginationPlugin';

export type ScreenplayElementType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'shot'
  | 'generalText'
  | 'screenplayNote'
  | 'actHeading'
  | 'endAct'
  | 'lyrics'
  | 'screenplayImage'
  | 'sequenceHeading'
  | 'dualDialogue';

/**
 * Screenplay Underline Mark
 */
export const ScreenplayUnderlineMark = Mark.create({
  name: 'underline',
  parseHTML() {
    return [{ tag: 'u' }, { style: 'text-decoration=underline' }, { style: 'text-decoration: underline' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['u', mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * Default Enter key progression map (Section 12)
 */
export const ENTER_PROGRESSION_MAP: Record<string, ScreenplayElementType> = {
  sceneHeading: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'dialogue',
  transition: 'action',
  shot: 'action',
  sequenceHeading: 'action',
  actHeading: 'action',
  endAct: 'action',
  lyrics: 'lyrics',
  generalText: 'generalText',
  screenplayNote: 'action',
};

/**
 * Helper to create standard semantic screenplay textblock nodes with document-adaptive formatting
 */
function createScreenplayTextBlockNode(config: {
  name: ScreenplayElementType;
  cssClass: string;
  label: string;
  alsoParseTags?: string[];
}) {
  return Node.create({
    name: config.name,
    group: 'block',
    content: 'inline*',
    defining: true,

    addAttributes() {
      return {
        pageBreakBefore: {
          default: false,
          parseHTML: (element) =>
            element.getAttribute('data-page-break-before') === 'true',
          renderHTML: (attributes) =>
            attributes.pageBreakBefore
              ? { 'data-page-break-before': 'true' }
              : {},
        },
        fontSizePt: {
          default: null,
          parseHTML: (element) => {
            const raw = element.getAttribute('data-font-size');
            return raw ? parseFloat(raw) : null;
          },
          renderHTML: (attributes) =>
            attributes.fontSizePt
              ? { 'data-font-size': String(attributes.fontSizePt) }
              : {},
        },
        fontFamily: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-font-family') || null,
          renderHTML: (attributes) =>
            attributes.fontFamily
              ? { 'data-font-family': attributes.fontFamily }
              : {},
        },
        fontWeight: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-font-weight') || null,
          renderHTML: (attributes) =>
            attributes.fontWeight
              ? { 'data-font-weight': attributes.fontWeight }
              : {},
        },
        isItalic: {
          default: false,
          parseHTML: (element) => element.getAttribute('data-italic') === 'true',
          renderHTML: (attributes) =>
            attributes.isItalic ? { 'data-italic': 'true' } : {},
        },
        alignment: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-alignment') || null,
          renderHTML: (attributes) =>
            attributes.alignment
              ? { 'data-alignment': attributes.alignment }
              : {},
        },
        indentLeftInches: {
          default: null,
          parseHTML: (element) => {
            const raw = element.getAttribute('data-indent-left');
            return raw ? parseFloat(raw) : null;
          },
          renderHTML: (attributes) =>
            attributes.indentLeftInches !== null && attributes.indentLeftInches !== undefined
              ? { 'data-indent-left': String(attributes.indentLeftInches) }
              : {},
        },
        indentRightInches: {
          default: null,
          parseHTML: (element) => {
            const raw = element.getAttribute('data-indent-right');
            return raw ? parseFloat(raw) : null;
          },
          renderHTML: (attributes) =>
            attributes.indentRightInches !== null && attributes.indentRightInches !== undefined
              ? { 'data-indent-right': String(attributes.indentRightInches) }
              : {},
        },
        marginTopPt: {
          default: null,
          parseHTML: (element) => {
            const raw = element.getAttribute('data-margin-top');
            return raw ? parseFloat(raw) : null;
          },
          renderHTML: (attributes) =>
            attributes.marginTopPt !== null && attributes.marginTopPt !== undefined
              ? { 'data-margin-top': String(attributes.marginTopPt) }
              : {},
        },
        sourceCoordinates: {
          default: null,
          parseHTML: (element) => {
            const raw = element.getAttribute('data-source-coords');
            if (!raw) return null;
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          },
          renderHTML: (attributes) =>
            attributes.sourceCoordinates
              ? { 'data-source-coords': JSON.stringify(attributes.sourceCoordinates) }
              : {},
        },
      };
    },

    parseHTML() {
      const rules: Array<{ tag: string }> = [
        { tag: `div[data-screenplay-element="${config.name}"]` },
        { tag: `p[data-screenplay-element="${config.name}"]` },
      ];
      if (config.alsoParseTags) {
        for (const tag of config.alsoParseTags) {
          rules.push({ tag });
        }
      }
      return rules;
    },

    renderHTML({ HTMLAttributes }) {
      const styles: string[] = [];
      if (HTMLAttributes['data-font-size']) {
        styles.push(`font-size: ${HTMLAttributes['data-font-size']}pt`);
      }
      if (HTMLAttributes['data-font-family']) {
        const ff = String(HTMLAttributes['data-font-family']).toLowerCase();
        // Disallow proportional serif / Times / Georgia from overriding standard Courier Prime
        if (ff.includes('times') || ff.includes('georgia') || ff.includes('serif')) {
          styles.push('font-family: var(--font-screenplay, "Courier Prime", monospace)');
        } else {
          styles.push(`font-family: ${HTMLAttributes['data-font-family']}`);
        }
      }
      if (HTMLAttributes['data-font-weight']) {
        styles.push(`font-weight: ${HTMLAttributes['data-font-weight']}`);
      }
      if (HTMLAttributes['data-italic'] === 'true') {
        styles.push('font-style: italic');
      }
      if (HTMLAttributes['data-alignment']) {
        styles.push(`text-align: ${HTMLAttributes['data-alignment']}`);
      }
      if (HTMLAttributes['data-indent-left']) {
        // Prevent double margin: slugline and action are already positioned flush at 1.5in on page
        if (config.name !== 'sceneHeading' && config.name !== 'action') {
          styles.push(`padding-left: ${HTMLAttributes['data-indent-left']}in`);
        }
      }
      if (HTMLAttributes['data-indent-right']) {
        styles.push(`padding-right: ${HTMLAttributes['data-indent-right']}in`);
      }
      if (HTMLAttributes['data-margin-top']) {
        styles.push(`margin-top: ${HTMLAttributes['data-margin-top']}pt`);
      }

      const styleAttr = styles.length > 0 ? { style: styles.join('; ') } : {};

      return [
        'div',
        mergeAttributes(HTMLAttributes, styleAttr, {
          'data-screenplay-element': config.name,
          'data-element-label': config.label,
          class: `scr-el ${config.cssClass}`,
        }),
        0,
      ];
    },
  });
}

// 1. Action (Default block element in schema; also parses bare <p> tags)
export const ActionNode = createScreenplayTextBlockNode({
  name: 'action',
  cssClass: 'scr-el-action',
  label: 'Action',
  alsoParseTags: ['p'],
});

// 2. Scene Heading
export const SceneHeadingNode = createScreenplayTextBlockNode({
  name: 'sceneHeading',
  cssClass: 'scr-el-scene-heading',
  label: 'Scene Heading',
});

// 3. Character Cue
export const CharacterNode = createScreenplayTextBlockNode({
  name: 'character',
  cssClass: 'scr-el-character',
  label: 'Character',
});

// 4. Parenthetical
export const ParentheticalNode = createScreenplayTextBlockNode({
  name: 'parenthetical',
  cssClass: 'scr-el-parenthetical',
  label: 'Parenthetical',
});

// 5. Dialogue
export const DialogueNode = createScreenplayTextBlockNode({
  name: 'dialogue',
  cssClass: 'scr-el-dialogue',
  label: 'Dialogue',
});

// 6. Transition
export const TransitionNode = createScreenplayTextBlockNode({
  name: 'transition',
  cssClass: 'scr-el-transition',
  label: 'Transition',
});

// 7. Shot
export const ShotNode = createScreenplayTextBlockNode({
  name: 'shot',
  cssClass: 'scr-el-shot',
  label: 'Shot',
});

// 8. General Text
export const GeneralTextNode = createScreenplayTextBlockNode({
  name: 'generalText',
  cssClass: 'scr-el-general-text',
  label: 'General Text',
});

// 9. Act Heading
export const ActHeadingNode = createScreenplayTextBlockNode({
  name: 'actHeading',
  cssClass: 'scr-el-act-heading',
  label: 'Act Heading',
});

// 10. End Act Marker
export const EndActNode = createScreenplayTextBlockNode({
  name: 'endAct',
  cssClass: 'scr-el-end-act',
  label: 'End Act',
});

// 11. Sequence Heading
export const SequenceHeadingNode = createScreenplayTextBlockNode({
  name: 'sequenceHeading',
  cssClass: 'scr-el-sequence-heading',
  label: 'Sequence',
});

// 12. Lyrics
export const LyricsNode = createScreenplayTextBlockNode({
  name: 'lyrics',
  cssClass: 'scr-el-lyrics',
  label: 'Lyrics',
});

// 13. Screenplay Note (Editable annotation kept distinct from manuscript text)
const ScreenplayNoteComponent: React.FC<NodeViewProps> = ({
  node,
  deleteNode,
}) => {
  const createdAt = node.attrs.createdAt as string | undefined;
  return (
    <NodeViewWrapper
      data-screenplay-element="screenplayNote"
      data-testid="screenplay-note-block"
      className="scr-el scr-el-note"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-violet-500/25 select-none text-[10px] font-sans uppercase tracking-wider text-violet-300"
      >
        <span className="inline-flex items-center gap-1 font-semibold">
          <StickyNote className="w-3 h-3 text-violet-400" />
          <span>Script Note</span>
          {createdAt ? (
            <span className="font-normal opacity-75 normal-case">
              • {createdAt}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={deleteNode}
          aria-label="Remove screenplay note"
          title="Remove Note"
          data-testid="screenplay-remove-note-btn"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-violet-300 hover:bg-violet-500/20 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          <span>Remove</span>
        </button>
      </div>
      <NodeViewContent className="scr-note-editable-content" />
    </NodeViewWrapper>
  );
};

export const ScreenplayNoteNode = Node.create({
  name: 'screenplayNote',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      noteId: {
        default: () => `note-${Date.now()}`,
      },
      createdAt: {
        default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-screenplay-element="screenplayNote"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-screenplay-element': 'screenplayNote',
        class: 'scr-el scr-el-note',
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScreenplayNoteComponent);
  },
});

// 14. Screenplay Image Node
const ScreenplayImageComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
}) => {
  const {
    src,
    alt = '',
    caption = '',
    alignment = 'center',
    widthPercent = 65,
  } = node.attrs as {
    src: string;
    alt?: string;
    caption?: string;
    alignment?: 'left' | 'center' | 'right';
    widthPercent?: 40 | 65 | 100;
  };

  if (!src) {
    return null;
  }

  const justifyClass =
    alignment === 'left'
      ? 'justify-start'
      : alignment === 'right'
        ? 'justify-end'
        : 'justify-center';

  return (
    <NodeViewWrapper
      data-screenplay-element="screenplayImage"
      data-testid="screenplay-image-block"
      className="scr-el scr-el-image select-none"
      contentEditable={false}
    >
      <div className={`w-full flex ${justifyClass}`}>
        <figure
          style={{ width: `${widthPercent}%` }}
          className={`relative group border bg-[#f8f9fa] p-2 transition-shadow ${
            selected
              ? 'border-emerald-600 ring-2 ring-emerald-500/30'
              : 'border-slate-300'
          }`}
        >
          {/* Image Controls Bar */}
          <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-slate-200 text-[10px] font-sans text-slate-600">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'left' })}
                aria-label="Align image left"
                title="Align Left"
                className={`p-1 rounded ${
                  alignment === 'left'
                    ? 'bg-slate-800 text-white'
                    : 'hover:bg-slate-200 text-slate-700'
                }`}
              >
                <AlignLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'center' })}
                aria-label="Align image center"
                title="Align Center"
                className={`p-1 rounded ${
                  alignment === 'center'
                    ? 'bg-slate-800 text-white'
                    : 'hover:bg-slate-200 text-slate-700'
                }`}
              >
                <AlignCenter className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => updateAttributes({ alignment: 'right' })}
                aria-label="Align image right"
                title="Align Right"
                className={`p-1 rounded ${
                  alignment === 'right'
                    ? 'bg-slate-800 text-white'
                    : 'hover:bg-slate-200 text-slate-700'
                }`}
              >
                <AlignRight className="w-3 h-3" />
              </button>

              <span className="mx-1 text-slate-300">|</span>

              {([40, 65, 100] as const).map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => updateAttributes({ widthPercent: pct })}
                  aria-label={`Set image width to ${pct}%`}
                  className={`px-1.5 py-0.5 rounded font-mono ${
                    widthPercent === pct
                      ? 'bg-slate-800 text-white'
                      : 'hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={deleteNode}
              aria-label="Remove screenplay image"
              title="Remove Image"
              data-testid="screenplay-remove-image-btn"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          </div>

          <img
            src={src}
            alt={alt || caption || 'Screenplay reference image'}
            onLoad={(e) => {
              const imgEl = e.currentTarget;
              if (
                imgEl.naturalWidth > 0 &&
                imgEl.naturalHeight > 0 &&
                (!node.attrs.naturalWidth || !node.attrs.naturalHeight)
              ) {
                updateAttributes({
                  naturalWidth: imgEl.naturalWidth,
                  naturalHeight: imgEl.naturalHeight,
                });
              }
            }}
            className="block w-full h-auto max-h-[380px] object-contain mx-auto bg-white"
          />

          <input
            type="text"
            value={caption}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            placeholder="Optional visual reference caption..."
            aria-label="Screenplay image caption"
            className="mt-1.5 w-full text-center text-[10pt] font-mono bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none border-b border-transparent focus:border-slate-400"
          />
        </figure>
      </div>
    </NodeViewWrapper>
  );
};

export const ScreenplayImageNode = Node.create({
  name: 'screenplayImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      alignment: { default: 'center' },
      widthPercent: { default: 65 },
      naturalWidth: { default: 0 },
      naturalHeight: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-screenplay-element="screenplayImage"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-screenplay-element': 'screenplayImage',
        class: 'scr-el scr-el-image',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScreenplayImageComponent);
  },
});

// 15. Dual Dialogue Structural Nodes (dualDialogue + dualDialogueColumn)
export const DualDialogueColumnNode = Node.create({
  name: 'dualDialogueColumn',
  content: '(character | parenthetical | dialogue)+',
  isolating: true,

  addAttributes() {
    return {
      side: {
        default: 'left',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-screenplay-element="dualDialogueColumn"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-screenplay-element': 'dualDialogueColumn',
        class: 'scr-el-dual-column',
      }),
      0,
    ];
  },
});

const DualDialogueComponent: React.FC<NodeViewProps> = ({ editor, getPos }) => {
  const handleUnwrapDual = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'dualDialogue') return;

    const extractedBlocks: any[] = [];
    node.forEach((col) => {
      col.forEach((child) => {
        extractedBlocks.push(child);
      });
    });

    if (extractedBlocks.length > 0) {
      const { tr } = editor.state;
      tr.replaceWith(pos, pos + node.nodeSize, extractedBlocks);
      editor.view.dispatch(tr);
      editor.view.focus();
    }
  };

  return (
    <NodeViewWrapper
      data-screenplay-element="dualDialogue"
      data-testid="screenplay-dual-dialogue-block"
      className="scr-el-dual-dialogue-wrapper relative group"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between mb-1 text-[9.5px] font-sans uppercase tracking-wider text-slate-400 select-none"
      >
        <span className="inline-flex items-center gap-1">
          <Columns2 className="w-3 h-3" />
          <span>Dual Dialogue</span>
        </span>
        <button
          type="button"
          onClick={handleUnwrapDual}
          title="Split back into sequential dialogue"
          aria-label="Unwrap dual dialogue into single dialogue blocks"
          data-testid="screenplay-unwrap-dual-btn"
          className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
        >
          Single Column
        </button>
      </div>
      <NodeViewContent className="scr-el-dual-dialogue-grid" />
    </NodeViewWrapper>
  );
};

export const DualDialogueNode = Node.create({
  name: 'dualDialogue',
  group: 'block',
  content: 'dualDialogueColumn dualDialogueColumn',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-screenplay-element="dualDialogue"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-screenplay-element': 'dualDialogue',
        class: 'scr-el scr-el-dual-dialogue',
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DualDialogueComponent);
  },
});

/**
 * Predictable Keyboard & Element Transitions Extension (Section 12)
 */
export const ScreenplayKeyboardExtension = Extension.create({
  name: 'screenplayKeyboardTransitions',

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { selection, schema } = state;
        const { $from, empty } = selection;

        // If a node selection (e.g. screenplayImage) is active, insert an Action block below it
        if (!empty && selection.node?.type.name === 'screenplayImage') {
          const afterPos = selection.to;
          const actionNode = schema.nodes.action.create();
          const tr = state.tr.insert(afterPos, actionNode);
          tr.setSelection(TextSelection.near(tr.doc.resolve(afterPos + 1)));
          view.dispatch(tr.scrollIntoView());
          return true;
        }

        if (!empty) {
          return false;
        }

        const parentBlock = $from.parent;
        const currentType = parentBlock.type.name;
        const isBlockEmpty = parentBlock.textContent.length === 0;
        const isAtEnd = $from.parentOffset === parentBlock.content.size;

        // Check if inside a Dual Dialogue Column
        let dualDialogueDepth = -1;
        let dualColumnDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          const ancestor = $from.node(d);
          if (ancestor.type.name === 'dualDialogueColumn') {
            dualColumnDepth = d;
          } else if (ancestor.type.name === 'dualDialogue') {
            dualDialogueDepth = d;
          }
        }

        if (dualColumnDepth !== -1 && dualDialogueDepth !== -1) {
          // Inside a dualDialogueColumn
          if (isBlockEmpty) {
            // If current block is empty dialogue, exit Dual Dialogue into an Action block after dualDialogue
            const afterDualPos = $from.after(dualDialogueDepth);
            const actionNode = schema.nodes.action.create();
            let tr = state.tr;
            // If column has more than 1 child, remove the trailing empty block first
            const columnNode = $from.node(dualColumnDepth);
            if (columnNode.childCount > 1) {
              const blockStart = $from.before($from.depth);
              const blockEnd = $from.after($from.depth);
              tr = tr.delete(blockStart, blockEnd);
              const mappedAfterDual = tr.mapping.map(afterDualPos);
              tr = tr.insert(mappedAfterDual, actionNode);
              tr.setSelection(TextSelection.near(tr.doc.resolve(mappedAfterDual + 1)));
            } else {
              tr = tr.insert(afterDualPos, actionNode);
              tr.setSelection(TextSelection.near(tr.doc.resolve(afterDualPos + 1)));
            }
            view.dispatch(tr.scrollIntoView());
            return true;
          }

          if (isAtEnd) {
            // Inside Dual Dialogue column: character -> dialogue, parenthetical -> dialogue, dialogue -> dialogue
            const nextInColumn = schema.nodes.dialogue.create();
            const insertPos = $from.after($from.depth);
            const tr = state.tr.insert(insertPos, nextInColumn);
            tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
            view.dispatch(tr.scrollIntoView());
            return true;
          }

          return false;
        }

        // Top-level screenplay blocks:
        // 1. If block is empty and not already Action, convert it to Action so the writer is never trapped
        if (isBlockEmpty && currentType !== 'action') {
          return editor.commands.setNode('action');
        }

        // 2. When at the end of a non-empty block, transition to its configured next element type
        if (!isBlockEmpty && isAtEnd) {
          const targetNextType = ENTER_PROGRESSION_MAP[currentType] || 'action';
          const nextNodeType = schema.nodes[targetNextType] || schema.nodes.action;
          if (nextNodeType) {
            const insertPos = $from.after($from.depth);
            const nextNode = nextNodeType.create();
            const tr = state.tr.insert(insertPos, nextNode);
            tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
            view.dispatch(tr.scrollIntoView());
            return true;
          }
        }

        return false;
      },

      'Shift-Enter': ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type.name === 'lyrics') {
          return editor.commands.setHardBreak();
        }
        return false;
      },

      Tab: ({ editor }) => {
        const { $from } = editor.state.selection;
        const currentType = $from.parent.type.name;

        // Check if inside Dual Dialogue Column
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'dualDialogueColumn') {
            if (currentType === 'dialogue') {
              return editor.commands.setNode('parenthetical');
            }
            if (currentType === 'parenthetical') {
              return editor.commands.setNode('dialogue');
            }
            if (currentType === 'character') {
              return editor.commands.setNode('dialogue');
            }
            return true;
          }
        }

        const tabCycle: Record<string, ScreenplayElementType> = {
          action: 'character',
          character: 'transition',
          transition: 'sceneHeading',
          sceneHeading: 'action',
          dialogue: 'parenthetical',
          parenthetical: 'dialogue',
        };
        const nextType = tabCycle[currentType];
        if (nextType) {
          return editor.commands.setNode(nextType);
        }
        return false;
      },
    };
  },
});

export const SCREENPLAY_SCHEMA_EXTENSIONS = [
  ActionNode,
  SceneHeadingNode,
  CharacterNode,
  ParentheticalNode,
  DialogueNode,
  TransitionNode,
  ShotNode,
  GeneralTextNode,
  ActHeadingNode,
  EndActNode,
  SequenceHeadingNode,
  LyricsNode,
  ScreenplayNoteNode,
  ScreenplayImageNode,
  DualDialogueColumnNode,
  DualDialogueNode,
  ScreenplayKeyboardExtension,
  ScreenplayPaginationExtension,
];
