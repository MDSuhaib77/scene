import React, { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent, Editor, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  SCREENPLAY_SCHEMA_EXTENSIONS,
  ScreenplayElementType,
} from '../schema/screenplayExtensions';
import {
  extractScreenplayPlainText,
  extractScreenplayOutline,
  getActiveScreenplayState,
  ScreenplayOutlineEntry,
  ActiveScreenplayState,
} from '../commands/screenplayCommands';
import {
  ScreenplayPaginationResult,
  computeScreenplayPagination,
  extractDomBlockMeasurements,
  getPageNumberForPos,
} from '../layout/screenplayPaginationEngine';
import { SCREENPLAY_PAGINATION_META } from '../layout/screenplayPaginationPlugin';

export interface ScreenplayEditorMetrics {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  pageCount?: number;
  activePageNumber?: number;
  canUndo: boolean;
  canRedo: boolean;
  activeElement?: ScreenplayElementType;
  isInsideDualDialogue?: boolean;
}

export interface ScreenplayEditorProps {
  initialContent: JSONContent | string;
  draftKey: string;
  onDocumentChange?: (payload: {
    plainText: string;
    documentJson: string;
    metrics: ScreenplayEditorMetrics;
    outline: ScreenplayOutlineEntry[];
    pagination: ScreenplayPaginationResult;
  }) => void;
  onTextChange?: (plainText: string, metrics: ScreenplayEditorMetrics) => void;
  onMetricsChange?: (metrics: ScreenplayEditorMetrics) => void;
  onOutlineChange?: (outline: ScreenplayOutlineEntry[]) => void;
  onActiveStateChange?: (state: ActiveScreenplayState) => void;
  onPaginationChange?: (pagination: ScreenplayPaginationResult) => void;
  onEditorReady?: (editor: Editor | null) => void;
}

/**
 * Converts plain screenplay text into clean paragraph HTML for compatibility
 */
export function plainTextToHtml(text: string): string {
  if (!text || text.trim().length === 0) {
    return '<p></p>';
  }
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  return lines
    .map((line) => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<p>${escaped}</p>`;
    })
    .join('');
}

/**
 * Extracts plain text from the Tiptap editor document excluding internal screenplay notes
 */
export function extractPlainText(editor: Editor): string {
  return extractScreenplayPlainText(editor.state.doc);
}

export function computeEditorMetrics(
  editor: Editor,
  pagination?: ScreenplayPaginationResult | null
): ScreenplayEditorMetrics {
  const text = extractPlainText(editor);
  const trimmed = text.trim();
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const characterCount = text.length;
  let paragraphCount = 0;
  editor.state.doc.forEach((node) => {
    if (node.textContent.trim().length > 0 || node.type.name === 'screenplayImage') {
      paragraphCount += 1;
    }
  });
  const activeState = getActiveScreenplayState(editor);
  const resolvedPagination =
    pagination ?? computeScreenplayPagination(editor.state.doc);
  const activePageNumber = getPageNumberForPos(
    resolvedPagination,
    editor.state.selection.from
  );

  return {
    wordCount,
    characterCount,
    paragraphCount,
    pageCount: resolvedPagination.pageCount,
    activePageNumber,
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    activeElement: activeState.activeElement,
    isInsideDualDialogue: activeState.isInsideDualDialogue,
  };
}

export const ScreenplayEditor: React.FC<ScreenplayEditorProps> = ({
  initialContent,
  draftKey,
  onDocumentChange,
  onTextChange,
  onMetricsChange,
  onOutlineChange,
  onActiveStateChange,
  onPaginationChange,
  onEditorReady,
}) => {
  const paginationRef = useRef<ScreenplayPaginationResult | null>(null);
  const lastAppliedSignatureRef = useRef<string>('');
  const rafHandleRef = useRef<number | null>(null);
  const heavyDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPaginationPass = useCallback(
    (currentEditor: Editor, emitDocumentChange = false) => {
      if (!currentEditor || currentEditor.isDestroyed) return;

      let domBlockHeights: Map<number, number> | undefined;
      try {
        const viewDom = (currentEditor as any).editorView?.dom as
          | HTMLElement
          | undefined;
        if (viewDom) {
          domBlockHeights = extractDomBlockMeasurements(
            viewDom,
            currentEditor.state.doc
          );
        }
      } catch {
        // Headless fallback
      }

      const nextPagination = computeScreenplayPagination(currentEditor.state.doc, {
        domBlockHeights,
      });
      paginationRef.current = nextPagination;

      if (nextPagination.signature !== lastAppliedSignatureRef.current) {
        lastAppliedSignatureRef.current = nextPagination.signature;
        try {
          const tr = currentEditor.state.tr
            .setMeta(SCREENPLAY_PAGINATION_META, nextPagination)
            .setMeta('addToHistory', false);
          currentEditor.view.dispatch(tr);
        } catch {
          // Safe guard if view is unmounting
        }
        onPaginationChange?.(nextPagination);
      }

      const metrics = computeEditorMetrics(currentEditor, nextPagination);
      const activeState = getActiveScreenplayState(currentEditor);
      onMetricsChange?.(metrics);
      onActiveStateChange?.(activeState);

      if (emitDocumentChange) {
        const plainText = extractPlainText(currentEditor);
        const documentJson = JSON.stringify(currentEditor.getJSON());
        const outline = extractScreenplayOutline(currentEditor.state.doc);
        onTextChange?.(plainText, metrics);
        onOutlineChange?.(outline);
        onDocumentChange?.({
          plainText,
          documentJson,
          metrics,
          outline,
          pagination: nextPagination,
        });
      }
    },
    [
      onActiveStateChange,
      onDocumentChange,
      onMetricsChange,
      onOutlineChange,
      onPaginationChange,
      onTextChange,
    ]
  );

  const scheduleBatchedPaginationPass = useCallback(
    (currentEditor: Editor) => {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        runPaginationPass(currentEditor, false);
        return;
      }
      if (rafHandleRef.current !== null) {
        window.cancelAnimationFrame(rafHandleRef.current);
      }
      rafHandleRef.current = window.requestAnimationFrame(() => {
        rafHandleRef.current = null;
        runPaginationPass(currentEditor, false);
      });
    },
    [runPaginationPass]
  );

  const flushHeavyUpdates = useCallback(
    (currentEditor: Editor) => {
      if (!currentEditor || currentEditor.isDestroyed) return;
      if (heavyDebounceTimerRef.current !== null) {
        clearTimeout(heavyDebounceTimerRef.current);
        heavyDebounceTimerRef.current = null;
      }

      const plainText = extractPlainText(currentEditor);
      const documentJson = JSON.stringify(currentEditor.getJSON());
      const outline = extractScreenplayOutline(currentEditor.state.doc);
      const activeState = getActiveScreenplayState(currentEditor);

      const immediatePagination = computeScreenplayPagination(
        currentEditor.state.doc
      );
      paginationRef.current = immediatePagination;
      if (immediatePagination.signature !== lastAppliedSignatureRef.current) {
        lastAppliedSignatureRef.current = immediatePagination.signature;
        try {
          const tr = currentEditor.state.tr
            .setMeta(SCREENPLAY_PAGINATION_META, immediatePagination)
            .setMeta('addToHistory', false);
          currentEditor.view.dispatch(tr);
        } catch {}
      }
      onPaginationChange?.(immediatePagination);

      const metrics = computeEditorMetrics(currentEditor, immediatePagination);
      onTextChange?.(plainText, metrics);
      onMetricsChange?.(metrics);
      onOutlineChange?.(outline);
      onActiveStateChange?.(activeState);
      onDocumentChange?.({
        plainText,
        documentJson,
        metrics,
        outline,
        pagination: immediatePagination,
      });

      scheduleBatchedPaginationPass(currentEditor);
    },
    [
      onActiveStateChange,
      onDocumentChange,
      onMetricsChange,
      onOutlineChange,
      onPaginationChange,
      onTextChange,
      scheduleBatchedPaginationPass,
    ]
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          paragraph: false,
          heading: false,
          blockquote: false,
          codeBlock: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          horizontalRule: false,
          bold: {},
          italic: {},
          strike: false,
          code: false,
        }),
        ...SCREENPLAY_SCHEMA_EXTENSIONS,
      ],
      content:
        typeof initialContent === 'string'
          ? plainTextToHtml(initialContent)
          : initialContent,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Screenplay manuscript editor',
          spellcheck: 'true',
          'data-testid': 'screenplay-prosemirror-editor',
        },
        handleDOMEvents: {
          blur: () => {
            if (editor && heavyDebounceTimerRef.current !== null) {
              flushHeavyUpdates(editor);
            }
            return false;
          },
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        // Instant response for cursor & current element type
        const activeState = getActiveScreenplayState(currentEditor);
        onActiveStateChange?.(activeState);

        const isTestEnv =
          typeof process !== 'undefined' &&
          (process.env?.NODE_ENV === 'test' || (process.env as any)?.VITEST === 'true');

        if (isTestEnv) {
          flushHeavyUpdates(currentEditor);
          return;
        }

        // Debounce expensive document serialization & full pagination pass by 180ms
        if (heavyDebounceTimerRef.current !== null) {
          clearTimeout(heavyDebounceTimerRef.current);
        }

        heavyDebounceTimerRef.current = setTimeout(() => {
          heavyDebounceTimerRef.current = null;
          flushHeavyUpdates(currentEditor);
        }, 180);
      },
      onSelectionUpdate: ({ editor: currentEditor }) => {
        const metrics = computeEditorMetrics(currentEditor, paginationRef.current);
        const activeState = getActiveScreenplayState(currentEditor);
        onMetricsChange?.(metrics);
        onActiveStateChange?.(activeState);
      },
      onTransaction: ({ editor: currentEditor, transaction }) => {
        // Ignore pagination-only meta transactions to prevent redundant state updates
        if (transaction.getMeta(SCREENPLAY_PAGINATION_META)) {
          return;
        }
        const metrics = computeEditorMetrics(currentEditor, paginationRef.current);
        const activeState = getActiveScreenplayState(currentEditor);
        onMetricsChange?.(metrics);
        onActiveStateChange?.(activeState);
      },
    },
    [draftKey]
  );

  useEffect(() => {
    lastAppliedSignatureRef.current = '';
    onEditorReady?.(editor);
    if (editor) {
      const initialPagination = computeScreenplayPagination(editor.state.doc);
      paginationRef.current = initialPagination;
      onPaginationChange?.(initialPagination);

      const metrics = computeEditorMetrics(editor, initialPagination);
      const outline = extractScreenplayOutline(editor.state.doc);
      const activeState = getActiveScreenplayState(editor);
      onMetricsChange?.(metrics);
      onOutlineChange?.(outline);
      onActiveStateChange?.(activeState);

      scheduleBatchedPaginationPass(editor);

      // Section 8: Recalculate pagination once web fonts (Courier Prime) finish loading
      let cancelled = false;
      const handleFontsReady = () => {
        if (!cancelled && editor && !editor.isDestroyed) {
          scheduleBatchedPaginationPass(editor);
        }
      };

      if (typeof document !== 'undefined' && (document as any).fonts) {
        const fontSet = (document as any).fonts;
        if (fontSet.ready && typeof fontSet.ready.then === 'function') {
          fontSet.ready.then(handleFontsReady).catch(() => {});
        }
        if (typeof fontSet.addEventListener === 'function') {
          fontSet.addEventListener('loadingdone', handleFontsReady);
        }
      }

      return () => {
        cancelled = true;
        if (rafHandleRef.current !== null && typeof window !== 'undefined') {
          window.cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        if (heavyDebounceTimerRef.current !== null) {
          clearTimeout(heavyDebounceTimerRef.current);
          heavyDebounceTimerRef.current = null;
        }
        if (
          typeof document !== 'undefined' &&
          typeof (document as any).fonts?.removeEventListener === 'function'
        ) {
          (document as any).fonts.removeEventListener(
            'loadingdone',
            handleFontsReady
          );
        }
        onEditorReady?.(null);
      };
    }

    return () => {
      onEditorReady?.(null);
    };
  }, [
    editor,
    onEditorReady,
    onMetricsChange,
    onOutlineChange,
    onActiveStateChange,
    onPaginationChange,
    scheduleBatchedPaginationPass,
  ]);

  if (!editor) {
    return (
      <div
        className="scr-manuscript-editor min-h-[864px] select-text"
        aria-busy="true"
      />
    );
  }

  return (
    <div
      className="scr-manuscript-editor"
      data-testid="screenplay-editor-root"
    >
      <EditorContent editor={editor} />
    </div>
  );
};
