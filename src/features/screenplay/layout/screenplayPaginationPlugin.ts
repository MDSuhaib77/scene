import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  ScreenplayPaginationResult,
  computeScreenplayPagination,
} from './screenplayPaginationEngine';

export const SCREENPLAY_PAGINATION_PLUGIN_KEY = new PluginKey<DecorationSet>(
  'screenplayPagination'
);

export const SCREENPLAY_PAGINATION_META = 'screenplayPaginationLayout';

function createInlinePageBreakSpacerDom(
  spacerHeightPx: number,
  pageNumber: number
): HTMLElement {
  const span = document.createElement('span');
  span.className = 'scr-inline-page-break-spacer';
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('aria-hidden', 'true');
  span.setAttribute('data-spacer-height', String(Math.round(spacerHeightPx)));
  span.setAttribute('data-continuation-page', String(pageNumber));
  span.style.display = 'block';
  span.style.width = '100%';
  span.style.height = `${Math.round(spacerHeightPx)}px`;
  span.style.pointerEvents = 'none';
  span.style.userSelect = 'none';
  return span;
}

export function buildPaginationDecorationSet(
  doc: ProseMirrorNode,
  pagination: ScreenplayPaginationResult
): DecorationSet {
  const decorations: Decoration[] = [];
  const docSize = doc.content.size;

  pagination.blockBreakOffsets.forEach((offset) => {
    if (offset.pos >= 0 && offset.pos + offset.nodeSize <= docSize) {
      const nodeAtPos = doc.nodeAt(offset.pos);
      if (nodeAtPos && nodeAtPos.nodeSize === offset.nodeSize) {
        decorations.push(
          Decoration.node(offset.pos, offset.pos + offset.nodeSize, {
            style: `margin-top: ${Math.round(offset.marginTopPx)}px !important;`,
            'data-page-start': String(offset.pageNumber),
            class: 'scr-page-break-start-node',
          })
        );
      }
    }
  });

  if (typeof document !== 'undefined') {
    pagination.inlineBreakSpacers.forEach((spacer) => {
      if (spacer.pos > 0 && spacer.pos < docSize) {
        decorations.push(
          Decoration.widget(
            spacer.pos,
            () =>
              createInlinePageBreakSpacerDom(
                spacer.spacerHeightPx,
                spacer.pageNumber
              ),
            {
              side: -1,
              key: `scr-inline-pb-${spacer.pos}-${spacer.pageNumber}-${Math.round(
                spacer.spacerHeightPx
              )}`,
            }
          )
        );
      }
    });
  }

  return DecorationSet.create(doc, decorations);
}

export const ScreenplayPaginationExtension = Extension.create({
  name: 'screenplayPagination',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: SCREENPLAY_PAGINATION_PLUGIN_KEY,
        state: {
          init(_config, state) {
            const initialPagination = computeScreenplayPagination(state.doc);
            return buildPaginationDecorationSet(state.doc, initialPagination);
          },
          apply(tr, oldDecorationSet, _oldState, newState) {
            const metaPagination = tr.getMeta(
              SCREENPLAY_PAGINATION_META
            ) as ScreenplayPaginationResult | undefined;

            if (metaPagination) {
              return buildPaginationDecorationSet(newState.doc, metaPagination);
            }

            if (tr.docChanged) {
              return oldDecorationSet.map(tr.mapping, tr.doc);
            }

            return oldDecorationSet;
          },
        },
        props: {
          decorations(state) {
            return SCREENPLAY_PAGINATION_PLUGIN_KEY.getState(state);
          },
        },
      }),
    ];
  },
});
