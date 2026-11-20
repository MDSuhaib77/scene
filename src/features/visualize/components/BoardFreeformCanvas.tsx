import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageOff,
  Lock,
  Move,
  Unlock,
} from 'lucide-react';
import type {
  BoardCanvasItem,
  UnifiedBoardRecord,
  VisualReferenceAsset,
} from '../types';

interface TransientGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ActivePointerDrag {
  mode: 'move' | 'resize';
  itemId: string;
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  lockAspectRatio: boolean;
  ratio: number;
}

interface BoardFreeformCanvasProps {
  board: UnifiedBoardRecord;
  referenceAssets: VisualReferenceAsset[];
  selectedItemId: string | null;
  sectionFilterId: string;
  canEdit: boolean;
  onSelectItem: (itemId: string | null) => void;
  onCommitGeometry: (
    itemId: string,
    geometry: { x: number; y: number; width: number; height: number }
  ) => void;
  onUpdateItemText?: (itemId: string, text: string) => void;
}

export const BoardFreeformCanvas: React.FC<BoardFreeformCanvasProps> = ({
  board,
  referenceAssets,
  selectedItemId,
  sectionFilterId,
  canEdit,
  onSelectItem,
  onCommitGeometry,
  onUpdateItemText,
}) => {
  const dragRef = useRef<ActivePointerDrag | null>(null);
  const transientRef = useRef<TransientGeometry | null>(null);
  const [transient, setTransient] = useState<TransientGeometry | null>(null);
  const [brokenAssetIds, setBrokenAssetIds] = useState<Record<string, boolean>>({});
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const assetMap = useMemo(() => {
    const map = new Map<string, VisualReferenceAsset>();
    referenceAssets.forEach((a) => map.set(a.id, a));
    return map;
  }, [referenceAssets]);

  const sectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    board.sections.forEach((s) => map.set(s.id, s.title));
    return map;
  }, [board.sections]);

  const visibleItems = useMemo(() => {
    const filtered =
      sectionFilterId === 'all'
        ? board.items
        : board.items.filter((i) => i.sectionId === sectionFilterId);
    return [...filtered].sort((a, b) => a.zIndex - b.zIndex);
  }, [board.items, sectionFilterId]);

  const canvasBounds = useMemo(() => {
    let maxRight = 1040;
    let maxBottom = 640;
    visibleItems.forEach((item) => {
      const geo = transient && transient.id === item.id ? transient : item;
      maxRight = Math.max(maxRight, geo.x + geo.width + 80);
      maxBottom = Math.max(maxBottom, geo.y + geo.height + 80);
    });
    return { width: maxRight, height: maxBottom };
  }, [visibleItems, transient]);

  useEffect(() => {
    const handlePointerMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = ev.clientX - drag.startClientX;
      const dy = ev.clientY - drag.startClientY;

      let next: TransientGeometry;
      if (drag.mode === 'move') {
        next = {
          id: drag.itemId,
          x: Math.max(0, Math.round(drag.origX + dx)),
          y: Math.max(0, Math.round(drag.origY + dy)),
          width: drag.origW,
          height: drag.origH,
        };
      } else {
        const nextW = Math.max(84, Math.round(drag.origW + dx));
        const useAspect = drag.lockAspectRatio && !ev.shiftKey;
        const nextH = useAspect
          ? Math.max(48, Math.round(nextW / Math.max(0.1, drag.ratio)))
          : Math.max(48, Math.round(drag.origH + dy));
        next = {
          id: drag.itemId,
          x: drag.origX,
          y: drag.origY,
          width: nextW,
          height: nextH,
        };
      }
      transientRef.current = next;
      setTransient(next);
    };

    const finishDrag = () => {
      const active = dragRef.current;
      const latest = transientRef.current;
      dragRef.current = null;
      transientRef.current = null;
      setTransient(null);

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);

      if (active && latest && latest.id === active.itemId) {
        onCommitGeometry(active.itemId, {
          x: latest.x,
          y: latest.y,
          width: latest.width,
          height: latest.height,
        });
      }
    };

    // Only attach listeners synchronously during pointerdown via helper ref
    (dragHandlersRef.current as any).attach = () => {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', finishDrag);
      window.addEventListener('pointercancel', finishDrag);
    };

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [onCommitGeometry]);

  const dragHandlersRef = useRef<{ attach?: () => void }>({});

  const startDrag = (
    e: React.PointerEvent,
    item: BoardCanvasItem,
    mode: 'move' | 'resize'
  ) => {
    if (!canEdit || editingTextId === item.id) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelectItem(item.id);

    const ratio =
      item.naturalAspectRatio && item.naturalAspectRatio > 0
        ? item.naturalAspectRatio
        : item.width / Math.max(1, item.height);

    const initialGeo: TransientGeometry = {
      id: item.id,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    };

    dragRef.current = {
      mode,
      itemId: item.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: item.x,
      origY: item.y,
      origW: item.width,
      origH: item.height,
      lockAspectRatio: item.kind === 'image' ? item.lockAspectRatio !== false : false,
      ratio,
    };
    transientRef.current = initialGeo;
    setTransient(initialGeo);
    dragHandlersRef.current.attach?.();
  };

  return (
    <div
      data-testid="board-freeform-canvas-scroll"
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement)?.dataset?.canvasSurface) {
          onSelectItem(null);
          setEditingTextId(null);
        }
      }}
      className="flex-1 min-h-0 overflow-auto bg-transparent relative select-none"
      style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <div
        data-canvas-surface="true"
        data-testid="board-freeform-canvas-surface"
        className="relative"
        style={{
          width: `${canvasBounds.width}px`,
          height: `${canvasBounds.height}px`,
        }}
      >
        {visibleItems.map((item) => {
          const geo = transient && transient.id === item.id ? transient : item;
          const isSelected = selectedItemId === item.id;
          const isDraggingThis = transient?.id === item.id;
          const borderActive =
            item.borderStyle === 'none'
              ? false
              : item.borderStyle
                ? true
                : board.borderEnabled;
          const borderWidth = borderActive
            ? item.borderWidthPx ?? board.borderWidthPx ?? 1
            : 0;
          const borderColor = item.borderColor || board.borderColor || '#334155';

          const asset = item.kind === 'image' && item.assetId ? assetMap.get(item.assetId) : undefined;
          const src = asset?.thumbnailDataUrl || asset?.storageRef || '';
          const isMissingAsset =
            item.kind === 'image' &&
            (!asset || brokenAssetIds[asset.id] || !src || src.startsWith('vault://'));

          return (
            <div
              key={item.id}
              data-testid={`board-canvas-item-${item.id}`}
              onPointerDown={(e) => startDrag(e, item, 'move')}
              onClick={(e) => {
                e.stopPropagation();
                onSelectItem(item.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (canEdit && item.kind !== 'image') {
                  setEditingTextId(item.id);
                }
              }}
              style={{
                transform: `translate3d(${geo.x}px, ${geo.y}px, 0)`,
                width: `${geo.width}px`,
                height: `${geo.height}px`,
                zIndex: item.zIndex,
                borderWidth: `${borderWidth}px`,
                borderColor: borderWidth > 0 ? borderColor : 'transparent',
                borderStyle: borderWidth > 0 ? 'solid' : 'none',
              }}
              className={`absolute top-0 left-0 rounded-lg overflow-hidden ${
                canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
              } ${
                isSelected
                  ? 'ring-2 ring-yellow-400 shadow-[0_0_24px_rgba(250,204,21,0.35)]'
                  : 'shadow-md hover:ring-1 hover:ring-white/30'
              } ${isDraggingThis ? 'opacity-95' : ''} ${
                item.kind === 'heading'
                  ? 'bg-[#141005]/90 border border-[#FFD34E]/25 px-3 py-2 flex flex-col justify-center'
                  : item.kind === 'note'
                    ? 'bg-[#181308]/95 border border-[#FFD34E]/25 p-3 flex flex-col'
                    : 'bg-[#0b0e14]'
              }`}
            >
              {item.kind === 'image' ? (
                <>
                  {!isMissingAsset ? (
                    <img
                      src={src}
                      alt={item.text || asset?.originalFilename || 'Board reference'}
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                      onError={() =>
                        asset &&
                        setBrokenAssetIds((prev) => ({ ...prev, [asset.id]: true }))
                      }
                      className="w-full h-full object-contain pointer-events-none select-none block bg-[#0A0B0D] border border-[#FFD34E]/25"
                    />
                  ) : (
                    <div
                      data-testid={`board-broken-ref-${item.id}`}
                      className="w-full h-full flex flex-col items-center justify-center gap-1 p-3 text-center bg-amber-950/20 text-amber-200"
                    >
                      <ImageOff className="w-5 h-5 text-amber-400" />
                      <span className="text-[11px] font-medium">
                        Missing Vault Reference
                      </span>
                      <span className="text-[10px] text-amber-300/75 truncate max-w-full">
                        {item.text || item.assetId}
                      </span>
                    </div>
                  )}

                  {(item.text || item.sectionId) && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 py-1.5 pointer-events-none flex items-center justify-between gap-2">
                      <span className="text-[11px] text-yellow-100 truncate">
                        {item.text}
                      </span>
                      {item.sectionId && sectionNameById.get(item.sectionId) && (
                        <span className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-[9px] font-mono text-slate-300 shrink-0">
                          {sectionNameById.get(item.sectionId)}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col justify-between overflow-hidden select-text">
                  {editingTextId === item.id && canEdit && onUpdateItemText ? (
                    <textarea
                      autoFocus
                      value={item.text || ''}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateItemText(item.id, e.target.value)}
                      onBlur={() => setEditingTextId(null)}
                      className="w-full h-full bg-[#0A0B0D] border border-[#FFD34E]/25 border border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 rounded px-2 py-1 text-xs text-yellow-100 resize-none focus:outline-none"
                    />
                  ) : (
                    <div className="overflow-hidden">
                      <div
                        className={
                          item.kind === 'heading'
                            ? 'text-sm font-semibold text-yellow-100 tracking-tight truncate'
                            : 'text-xs text-slate-200 leading-relaxed whitespace-pre-wrap break-words'
                        }
                      >
                        {item.text || (item.kind === 'heading' ? 'Heading' : 'Note')}
                      </div>
                      {item.note && (
                        <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {item.note}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1">
                    <span>{item.kind === 'heading' ? 'HEADING' : 'NOTE'}</span>
                    <span>z{item.zIndex}</span>
                  </div>
                </div>
              )}

              {/* Selection Badges & Corner Resize Handle */}
              {isSelected && canEdit && (
                <>
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#0b0e14]/85 border border-white/20 text-[9px] font-mono text-yellow-300 inline-flex items-center gap-1 pointer-events-none">
                    <Move className="w-2.5 h-2.5" />
                    z{item.zIndex}
                    {item.kind === 'image' &&
                      (item.lockAspectRatio !== false ? (
                        <Lock className="w-2.5 h-2.5" />
                      ) : (
                        <Unlock className="w-2.5 h-2.5" />
                      ))}
                  </span>

                  <button
                    type="button"
                    data-testid={`board-resize-handle-${item.id}`}
                    aria-label="Resize item"
                    title="Drag corner to resize (hold Shift to unlock aspect ratio)"
                    onPointerDown={(e) => startDrag(e, item, 'resize')}
                    className="absolute bottom-0 right-0 w-4 h-4 bg-gradient-to-br from-yellow-400 to-amber-400 text-slate-950 font-bold rounded-tl cursor-nwse-resize flex items-center justify-center shadow-[0_0_10px_rgba(250,204,21,0.4)]"
                  >
                    <span className="w-1.5 h-1.5 border-r-2 border-b-2 border-[#0b0e14]" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
