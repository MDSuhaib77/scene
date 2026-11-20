import type { FilmProject } from '../../../types';
import type {
  BoardArrangementPreset,
  BoardCanvasItem,
  BoardSectionRecord,
  LookbookBoardRecord,
  LookbookRecord,
  MoodBoardRecord,
  MoodBoardTileSize,
  UnifiedBoardRecord,
} from '../types';
import {
  getProductionVisualizeStore,
  updateProductionVisualizeStore,
} from './visualizeFoundationService';

export const BOARD_CATEGORY_SUGGESTIONS: string[] = [
  'Mood & Tone',
  'Cinematography',
  'Lighting',
  'Colour Palette',
  'Production Design',
  'Costume & Wardrobe',
  'Locations',
  'Lookbook',
];

function tileDimensions(size?: MoodBoardTileSize): { width: number; height: number } {
  switch (size) {
    case 'compact':
      return { width: 210, height: 155 };
    case 'wide':
      return { width: 350, height: 210 };
    case 'feature':
      return { width: 420, height: 260 };
    case 'medium':
    default:
      return { width: 270, height: 195 };
  }
}

function projectMoodBoardToUnified(
  mb: MoodBoardRecord,
  sortOrder: number
): UnifiedBoardRecord {
  const spacing = 18;
  const cols = 3;
  const colWidths = [280, 280, 280];
  const colHeights = [24, 24, 24];

  const items: BoardCanvasItem[] = [...(mb.items || [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, idx) => {
      const dims = tileDimensions(item.tileSize);
      const col = idx % cols;
      const x = 24 + col * (colWidths[col] + spacing);
      const y = colHeights[col];
      colHeights[col] += dims.height + spacing + 28;
      return {
        id: item.id,
        kind: 'image',
        assetId: item.assetId,
        text: item.caption,
        note: item.note,
        x,
        y,
        width: dims.width,
        height: dims.height,
        zIndex: idx + 1,
        lockAspectRatio: true,
        linkedPanelId: item.linkedPanelId,
        linkedShotId: item.linkedShotId,
      };
    });

  return {
    id: `board-mb-${mb.id}`,
    productionId: mb.productionId,
    title: mb.title,
    description: mb.description,
    categoryTag: mb.theme || 'Mood Board',
    status: 'active',
    sourceLegacyKind: 'mood-board',
    sourceLegacyId: mb.id,
    linkedSceneIds: [...(mb.linkedSceneIds || [])],
    sections: [],
    items,
    spacingPx: spacing,
    borderEnabled: true,
    borderWidthPx: 1,
    borderColor: '#334155',
    sortOrder,
    createdAt: mb.createdAt,
    updatedAt: mb.updatedAt,
  };
}

function projectLookbookToUnified(
  lb: LookbookRecord,
  sortOrder: number
): UnifiedBoardRecord {
  const spacing = 18;
  let cursorY = 24;
  let z = 1;

  const sections: BoardSectionRecord[] = [...(lb.sections || [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((sec, idx) => ({
      id: sec.id,
      title: sec.title,
      summary: sec.summary,
      sortOrder: idx + 1,
    }));

  const items: BoardCanvasItem[] = [];

  if (lb.coverAssetId) {
    items.push({
      id: `cover-${lb.id}`,
      kind: 'image',
      assetId: lb.coverAssetId,
      text: `${lb.title} — Cover Frame`,
      x: 24,
      y: cursorY,
      width: 420,
      height: 250,
      zIndex: z++,
      lockAspectRatio: true,
    });
    cursorY += 276;
  }

  for (const sec of [...(lb.sections || [])].sort((a, b) => a.sortOrder - b.sortOrder)) {
    items.push({
      id: `heading-${sec.id}`,
      kind: 'heading',
      sectionId: sec.id,
      text: sec.title,
      note: sec.summary || sec.creativeNotes,
      x: 24,
      y: cursorY,
      width: 560,
      height: 54,
      zIndex: z++,
    });
    cursorY += 70;

    let rowX = 24;
    let rowMaxH = 0;
    const sortedSecItems = [...sec.items].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < sortedSecItems.length; i++) {
      const it = sortedSecItems[i];
      if (rowX + 270 > 960) {
        rowX = 24;
        cursorY += rowMaxH + spacing;
        rowMaxH = 0;
      }
      const w = 270;
      const h = 195;
      items.push({
        id: it.id,
        kind: 'image',
        sectionId: sec.id,
        assetId: it.assetId,
        text: it.caption,
        note: it.note,
        x: rowX,
        y: cursorY,
        width: w,
        height: h,
        zIndex: z++,
        lockAspectRatio: true,
        linkedPanelId: it.linkedPanelId,
        linkedShotId: it.linkedShotId,
      });
      rowX += w + spacing;
      rowMaxH = Math.max(rowMaxH, h);
    }
    if (sortedSecItems.length > 0) {
      cursorY += rowMaxH + spacing * 2;
    } else {
      cursorY += 16;
    }
  }

  return {
    id: `board-lb-${lb.id}`,
    productionId: lb.productionId,
    title: lb.title,
    description: lb.description,
    categoryTag: lb.department || 'Lookbook',
    department: lb.department,
    status: lb.status === 'published' ? 'published' : 'active',
    sourceLegacyKind: 'lookbook',
    sourceLegacyId: lb.id,
    linkedSceneIds: [...(lb.linkedSceneIds || [])],
    sections,
    items,
    spacingPx: spacing,
    borderEnabled: true,
    borderWidthPx: 1,
    borderColor: '#475569',
    sortOrder,
    createdAt: lb.createdAt,
    updatedAt: lb.updatedAt,
  };
}

function projectLegacyBoardToUnified(
  legacy: LookbookBoardRecord,
  sortOrder: number
): UnifiedBoardRecord {
  const spacing = 18;
  const items: BoardCanvasItem[] = legacy.referenceAssetIds.map((assetId, idx) => ({
    id: `leg-${legacy.id}-${idx}`,
    kind: 'image',
    assetId,
    x: 24 + (idx % 3) * (270 + spacing),
    y: 24 + Math.floor(idx / 3) * (195 + spacing),
    width: 270,
    height: 195,
    zIndex: idx + 1,
    lockAspectRatio: true,
  }));

  return {
    id: `board-leg-${legacy.id}`,
    productionId: legacy.productionId,
    title: legacy.title,
    description: legacy.description,
    categoryTag: legacy.theme || legacy.department || 'Board',
    department: legacy.department,
    status: 'active',
    sourceLegacyKind: 'lookbook-board',
    sourceLegacyId: legacy.id,
    linkedSceneIds: [...(legacy.linkedSceneIds || [])],
    sections: [],
    items,
    spacingPx: spacing,
    borderEnabled: true,
    borderWidthPx: 1,
    borderColor: '#334155',
    sortOrder,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
}

/**
 * Returns the consolidated production-isolated list of Unified Boards, preserving
 * all legacy Mood Boards, Lookbooks, and LookbookBoards without losing any items,
 * descriptions, sections, or scene/panel/shot relationships.
 */
export function getUnifiedBoards(project: FilmProject): UnifiedBoardRecord[] {
  const store = getProductionVisualizeStore(project);
  const existing = [...(store.boards || [])].filter(
    (b) => b.productionId === project.id
  );
  const consolidatedLegacyIds = new Set(
    existing
      .map((b) => b.sourceLegacyId)
      .filter((id): id is string => Boolean(id))
  );

  let nextOrder = existing.length + 1;
  const combined: UnifiedBoardRecord[] = [...existing];

  for (const mb of store.moodBoards || []) {
    if (mb.productionId !== project.id || consolidatedLegacyIds.has(mb.id)) continue;
    combined.push(projectMoodBoardToUnified(mb, nextOrder++));
  }

  for (const lb of store.lookbooks || []) {
    if (lb.productionId !== project.id || consolidatedLegacyIds.has(lb.id)) continue;
    combined.push(projectLookbookToUnified(lb, nextOrder++));
  }

  for (const legacyBoard of store.lookbookBoards || []) {
    if (
      legacyBoard.productionId !== project.id ||
      consolidatedLegacyIds.has(legacyBoard.id)
    ) {
      continue;
    }
    combined.push(projectLegacyBoardToUnified(legacyBoard, nextOrder++));
  }

  return combined.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Materializes all current boards (including non-destructive legacy projections)
 * before applying an update cleanly in `visualizeState.boards`.
 */
function mutateBoards(
  project: FilmProject,
  updater: (boards: UnifiedBoardRecord[]) => UnifiedBoardRecord[]
): FilmProject {
  const materialized = getUnifiedBoards(project);
  const nextBoards = updater(materialized).map((b, idx) => ({
    ...b,
    productionId: project.id,
    sortOrder: idx + 1,
  }));
  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    boards: nextBoards,
  }));
}

export interface CreateUnifiedBoardInput {
  title: string;
  description?: string;
  categoryTag?: string;
  department?: string;
  linkedSceneIds?: string[];
  spacingPx?: number;
  borderEnabled?: boolean;
  borderWidthPx?: number;
  borderColor?: string;
}

export function createUnifiedBoard(
  project: FilmProject,
  input: CreateUnifiedBoardInput
): { updatedProject: FilmProject; board: UnifiedBoardRecord } {
  const cleanTitle = input.title.trim() || 'Untitled Board';
  const now = new Date().toISOString();
  const boardId = `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const existing = getUnifiedBoards(project);

  const board: UnifiedBoardRecord = {
    id: boardId,
    productionId: project.id,
    title: cleanTitle,
    description: input.description?.trim() || undefined,
    categoryTag: input.categoryTag?.trim() || undefined,
    department: input.department?.trim() || undefined,
    status: 'active',
    linkedSceneIds: input.linkedSceneIds ? [...input.linkedSceneIds] : [],
    sections: [],
    items: [],
    spacingPx: typeof input.spacingPx === 'number' ? input.spacingPx : 16,
    borderEnabled: input.borderEnabled ?? true,
    borderWidthPx: typeof input.borderWidthPx === 'number' ? input.borderWidthPx : 1,
    borderColor: input.borderColor || '#334155',
    sortOrder: existing.length + 1,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = mutateBoards(project, (boards) => [...boards, board]);
  return { updatedProject, board };
}

export function updateUnifiedBoard(
  project: FilmProject,
  boardId: string,
  updates: Partial<
    Pick<
      UnifiedBoardRecord,
      | 'title'
      | 'description'
      | 'categoryTag'
      | 'department'
      | 'status'
      | 'linkedSceneIds'
      | 'spacingPx'
      | 'borderEnabled'
      | 'borderWidthPx'
      | 'borderColor'
    >
  >
): FilmProject {
  const now = new Date().toISOString();
  return mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      return {
        ...board,
        ...updates,
        title:
          updates.title !== undefined ? updates.title.trim() || board.title : board.title,
        description:
          updates.description !== undefined
            ? updates.description?.trim() || undefined
            : board.description,
        categoryTag:
          updates.categoryTag !== undefined
            ? updates.categoryTag?.trim() || undefined
            : board.categoryTag,
        department:
          updates.department !== undefined
            ? updates.department?.trim() || undefined
            : board.department,
        spacingPx:
          updates.spacingPx !== undefined
            ? Math.max(0, Math.min(64, updates.spacingPx))
            : board.spacingPx,
        borderWidthPx:
          updates.borderWidthPx !== undefined
            ? Math.max(0, Math.min(12, updates.borderWidthPx))
            : board.borderWidthPx,
        updatedAt: now,
      };
    })
  );
}

export function duplicateUnifiedBoard(
  project: FilmProject,
  boardId: string
): { updatedProject: FilmProject; duplicatedBoard: UnifiedBoardRecord | null } {
  const existing = getUnifiedBoards(project);
  const source = existing.find((b) => b.id === boardId && b.productionId === project.id);
  if (!source) return { updatedProject: project, duplicatedBoard: null };

  const now = new Date().toISOString();
  const newBoardId = `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sectionIdMap = new Map<string, string>();

  const copiedSections: BoardSectionRecord[] = source.sections.map((sec, idx) => {
    const newSecId = `bsec-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
    sectionIdMap.set(sec.id, newSecId);
    return { ...sec, id: newSecId };
  });

  const copiedItems: BoardCanvasItem[] = source.items.map((item, idx) => ({
    ...item,
    id: `bitem-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    sectionId: item.sectionId ? sectionIdMap.get(item.sectionId) : undefined,
  }));

  const clone: UnifiedBoardRecord = {
    ...source,
    id: newBoardId,
    title: `${source.title} (Copy)`,
    sourceLegacyKind: undefined,
    sourceLegacyId: undefined,
    sections: copiedSections,
    items: copiedItems,
    status: source.status === 'archived' ? 'active' : source.status,
    sortOrder: existing.length + 1,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProject = mutateBoards(project, (boards) => [...boards, clone]);
  return { updatedProject, duplicatedBoard: clone };
}

export function archiveUnifiedBoard(
  project: FilmProject,
  boardId: string,
  archived = true
): FilmProject {
  return updateUnifiedBoard(project, boardId, {
    status: archived ? 'archived' : 'active',
  });
}

export function deleteUnifiedBoard(project: FilmProject, boardId: string): FilmProject {
  const target = getUnifiedBoards(project).find(
    (b) => b.id === boardId && b.productionId === project.id
  );
  const nextBoards = getUnifiedBoards(project)
    .filter((b) => b.id !== boardId)
    .map((b, idx) => ({ ...b, sortOrder: idx + 1 }));

  return updateProductionVisualizeStore(project, (cur) => ({
    ...cur,
    boards: nextBoards,
    // If deleting a consolidated legacy record, also prune matching legacy ID so it does not re-project on next read
    moodBoards:
      target?.sourceLegacyKind === 'mood-board' && target.sourceLegacyId
        ? (cur.moodBoards || []).filter((mb) => mb.id !== target.sourceLegacyId)
        : cur.moodBoards,
    lookbooks:
      target?.sourceLegacyKind === 'lookbook' && target.sourceLegacyId
        ? (cur.lookbooks || []).filter((lb) => lb.id !== target.sourceLegacyId)
        : cur.lookbooks,
    lookbookBoards:
      target?.sourceLegacyKind === 'lookbook-board' && target.sourceLegacyId
        ? cur.lookbookBoards.filter((lb) => lb.id !== target.sourceLegacyId)
        : cur.lookbookBoards,
  }));
}

export function addBoardSection(
  project: FilmProject,
  boardId: string,
  input: { title: string; summary?: string }
): { updatedProject: FilmProject; section: BoardSectionRecord | null } {
  const now = new Date().toISOString();
  let created: BoardSectionRecord | null = null;

  const updatedProject = mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      const section: BoardSectionRecord = {
        id: `bsec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: input.title.trim() || `Section ${board.sections.length + 1}`,
        summary: input.summary?.trim() || undefined,
        sortOrder: board.sections.length + 1,
      };
      created = section;
      return {
        ...board,
        sections: [...board.sections, section],
        updatedAt: now,
      };
    })
  );

  return { updatedProject, section: created };
}

export function updateBoardSection(
  project: FilmProject,
  boardId: string,
  sectionId: string,
  updates: Partial<Pick<BoardSectionRecord, 'title' | 'summary'>>
): FilmProject {
  const now = new Date().toISOString();
  return mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      return {
        ...board,
        sections: board.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                title: updates.title !== undefined ? updates.title.trim() || s.title : s.title,
                summary:
                  updates.summary !== undefined ? updates.summary?.trim() || undefined : s.summary,
              }
            : s
        ),
        updatedAt: now,
      };
    })
  );
}

export function deleteBoardSection(
  project: FilmProject,
  boardId: string,
  sectionId: string
): FilmProject {
  const now = new Date().toISOString();
  return mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      return {
        ...board,
        sections: board.sections
          .filter((s) => s.id !== sectionId)
          .map((s, idx) => ({ ...s, sortOrder: idx + 1 })),
        items: board.items.map((item) =>
          item.sectionId === sectionId ? { ...item, sectionId: undefined } : item
        ),
        updatedAt: now,
      };
    })
  );
}

function nextCanvasPlacement(board: UnifiedBoardRecord): { x: number; y: number; z: number } {
  const count = board.items.length;
  const maxZ = board.items.reduce((acc, it) => Math.max(acc, it.zIndex || 1), 0);
  const spacing = board.spacingPx ?? 16;
  const col = count % 3;
  const row = Math.floor(count / 3);
  return {
    x: 28 + col * (280 + spacing),
    y: 28 + row * (210 + spacing),
    z: maxZ + 1,
  };
}

export function addImageItemToBoard(
  project: FilmProject,
  boardId: string,
  assetId: string,
  options?: {
    sectionId?: string;
    caption?: string;
    note?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    naturalAspectRatio?: number;
    linkedPanelId?: string;
    linkedShotId?: string;
  }
): { updatedProject: FilmProject; item: BoardCanvasItem | null } {
  const store = getProductionVisualizeStore(project);
  const asset = store.referenceAssets.find(
    (a) => a.id === assetId && a.productionId === project.id
  );
  if (!asset) return { updatedProject: project, item: null };

  const now = new Date().toISOString();
  let created: BoardCanvasItem | null = null;

  const updatedProject = mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      const pos = nextCanvasPlacement(board);
      const ratio =
        options?.naturalAspectRatio && options.naturalAspectRatio > 0
          ? options.naturalAspectRatio
          : 4 / 3;
      const width = options?.width ?? 270;
      const height = options?.height ?? Math.max(90, Math.round(width / ratio));

      const item: BoardCanvasItem = {
        id: `bitem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'image',
        sectionId: options?.sectionId,
        assetId,
        text: options?.caption?.trim() || asset.originalFilename,
        note: options?.note?.trim() || undefined,
        x: options?.x ?? pos.x,
        y: options?.y ?? pos.y,
        width,
        height,
        zIndex: pos.z,
        lockAspectRatio: true,
        naturalAspectRatio: ratio,
        linkedPanelId: options?.linkedPanelId,
        linkedShotId: options?.linkedShotId,
      };
      created = item;
      return {
        ...board,
        items: [...board.items, item],
        updatedAt: now,
      };
    })
  );

  return { updatedProject, item: created };
}

export function addTextItemToBoard(
  project: FilmProject,
  boardId: string,
  input: {
    kind: 'heading' | 'note';
    text: string;
    note?: string;
    sectionId?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }
): { updatedProject: FilmProject; item: BoardCanvasItem | null } {
  const now = new Date().toISOString();
  let created: BoardCanvasItem | null = null;

  const updatedProject = mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      const pos = nextCanvasPlacement(board);
      const item: BoardCanvasItem = {
        id: `bitem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: input.kind,
        sectionId: input.sectionId,
        text: input.text.trim() || (input.kind === 'heading' ? 'Section Heading' : 'Pinboard Note'),
        note: input.note?.trim() || undefined,
        x: input.x ?? pos.x,
        y: input.y ?? pos.y,
        width: input.width ?? (input.kind === 'heading' ? 380 : 250),
        height: input.height ?? (input.kind === 'heading' ? 56 : 110),
        zIndex: pos.z,
      };
      created = item;
      return {
        ...board,
        items: [...board.items, item],
        updatedAt: now,
      };
    })
  );

  return { updatedProject, item: created };
}

export function updateBoardItem(
  project: FilmProject,
  boardId: string,
  itemId: string,
  updates: Partial<
    Omit<BoardCanvasItem, 'id' | 'kind'>
  >
): FilmProject {
  const now = new Date().toISOString();
  return mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      return {
        ...board,
        items: board.items.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            ...updates,
            x: updates.x !== undefined ? Math.max(0, Math.round(updates.x)) : item.x,
            y: updates.y !== undefined ? Math.max(0, Math.round(updates.y)) : item.y,
            width:
              updates.width !== undefined ? Math.max(72, Math.round(updates.width)) : item.width,
            height:
              updates.height !== undefined ? Math.max(44, Math.round(updates.height)) : item.height,
            text:
              updates.text !== undefined ? updates.text : item.text,
            note:
              updates.note !== undefined ? updates.note?.trim() || undefined : item.note,
          };
        }),
        updatedAt: now,
      };
    })
  );
}

export function changeBoardItemZIndex(
  project: FilmProject,
  boardId: string,
  itemId: string,
  action: 'front' | 'back' | 'forward' | 'backward'
): FilmProject {
  const now = new Date().toISOString();
  return mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      const ordered = [...board.items].sort((a, b) => a.zIndex - b.zIndex);
      const idx = ordered.findIndex((i) => i.id === itemId);
      if (idx === -1) return board;

      const [moved] = ordered.splice(idx, 1);
      if (action === 'front') ordered.push(moved);
      else if (action === 'back') ordered.unshift(moved);
      else if (action === 'forward') ordered.splice(Math.min(ordered.length, idx + 1), 0, moved);
      else ordered.splice(Math.max(0, idx - 1), 0, moved);

      return {
        ...board,
        items: ordered.map((it, i) => ({ ...it, zIndex: i + 1 })),
        updatedAt: now,
      };
    })
  );
}

/**
 * Removes an item from a Board WITHOUT deleting the underlying Vault / shared reference asset.
 */
export function removeBoardItem(
  project: FilmProject,
  boardId: string,
  itemId: string
): FilmProject {
  const now = new Date().toISOString();
  return mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      return {
        ...board,
        items: board.items
          .filter((i) => i.id !== itemId)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((it, idx) => ({ ...it, zIndex: idx + 1 })),
        updatedAt: now,
      };
    })
  );
}

/**
 * Arranges items neatly into Side-by-Side, Vertical Stack, or Balanced Grid preserving item dimensions & spacing.
 */
export function arrangeBoardItems(
  project: FilmProject,
  boardId: string,
  preset: Exclude<BoardArrangementPreset, 'freeform'>
): FilmProject {
  const now = new Date().toISOString();
  return mutateBoards(project, (boards) =>
    boards.map((board) => {
      if (board.id !== boardId || board.productionId !== project.id) return board;
      const gap = board.spacingPx ?? 16;
      const ordered = [...board.items].sort((a, b) => a.y - b.y || a.x - b.x || a.zIndex - b.zIndex);

      if (preset === 'side-by-side') {
        let cursorX = 28;
        const laidOut = ordered.map((item) => {
          const next = { ...item, x: cursorX, y: 28 };
          cursorX += item.width + gap;
          return next;
        });
        return { ...board, items: laidOut, updatedAt: now };
      }

      if (preset === 'vertical') {
        let cursorY = 28;
        const laidOut = ordered.map((item) => {
          const next = { ...item, x: 28, y: cursorY };
          cursorY += item.height + gap;
          return next;
        });
        return { ...board, items: laidOut, updatedAt: now };
      }

      // Responsive 3-column masonry grid honoring current item aspect ratios
      const cols = 3;
      const colHeights = [28, 28, 28];
      const targetColWidth = 280;
      const laidOut = ordered.map((item) => {
        let shortest = 0;
        for (let c = 1; c < cols; c++) {
          if (colHeights[c] < colHeights[shortest]) shortest = c;
        }
        const scale = item.kind === 'image' ? targetColWidth / item.width : 1;
        const nextW = item.kind === 'image' ? targetColWidth : Math.min(targetColWidth, item.width);
        const nextH =
          item.kind === 'image' ? Math.max(80, Math.round(item.height * scale)) : item.height;
        const x = 28 + shortest * (targetColWidth + gap);
        const y = colHeights[shortest];
        colHeights[shortest] += nextH + gap;
        return { ...item, x, y, width: nextW, height: nextH };
      });
      return { ...board, items: laidOut, updatedAt: now };
    })
  );
}
