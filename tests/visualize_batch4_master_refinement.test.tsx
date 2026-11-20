import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualizeWorkspace } from '../src/features/visualize/VisualizeWorkspace';
import {
  VISUALIZE_WORKSPACES,
  addAssetToLookbookSection,
  addAssetToMoodBoard,
  addLookbookSection,
  createCameraSetup,
  createLookbook,
  createMoodBoard,
  createShot,
  createStoryboardPanel,
  getProductionVisualizeStore,
  normalizeVisualizeWorkspaceId,
  registerSharedReferenceAsset,
} from '../src/features/visualize/services/visualizeFoundationService';
import {
  addBoardSection,
  addImageItemToBoard,
  addTextItemToBoard,
  archiveUnifiedBoard,
  arrangeBoardItems,
  changeBoardItemZIndex,
  createUnifiedBoard,
  deleteUnifiedBoard,
  duplicateUnifiedBoard,
  getUnifiedBoards,
  removeBoardItem,
  updateBoardItem,
  updateUnifiedBoard,
} from '../src/features/visualize/services/boardService';
import {
  auditVisualiseWorkflow,
  runVisualiseWorkflowAssistantQuery,
} from '../src/features/visualize/services/visualizeWorkflowAssistantService';
import { SCENEOS_MODULE_HIERARCHY } from '../src/components/navigation/navigationHierarchy';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

function makeProject(id = 'proj-b4', title = 'Harbor Telemetry'): FilmProject {
  const scenes: ParsedScene[] = [
    {
      id: `scn-${id}-1`,
      sceneNumber: '1',
      slugline: 'EXT. PIER DUSK - FOG',
      intExt: 'EXT',
      location: 'PIER',
      timeOfDay: 'DUSK',
      pageLengthEighths: 8,
      pageLengthDisplay: '1 0/8',
      startPage: 1,
      estimatedDurationMinutes: 1,
      characters: ['MARA'],
      dialogueBlocks: [],
      actionSnippet: 'Sodium lamps pierce mist over dark pilings.',
      elements: [],
      status: 'reviewed',
    },
    {
      id: `scn-${id}-2`,
      sceneNumber: '2',
      slugline: 'INT. CONTROL ROOM - NIGHT',
      intExt: 'INT',
      location: 'CONTROL ROOM',
      timeOfDay: 'NIGHT',
      pageLengthEighths: 6,
      pageLengthDisplay: '0 6/8',
      startPage: 2,
      estimatedDurationMinutes: 1,
      characters: ['MARA', 'ELIAS'],
      dialogueBlocks: [],
      actionSnippet: 'Oscilloscope traces pulse green across amber gauges.',
      elements: [],
      status: 'reviewed',
    },
  ];

  const script: ScreenplayVersion = {
    id: `ver-${id}-1`,
    version: 'v1.0',
    title: 'Harbor Master Script',
    changeDescription: 'Shooting draft',
    author: 'Writer',
    updatedAt: '2026-11-10T10:00:00.000Z',
    status: 'Approved',
    scenes,
  };

  return {
    id,
    title,
    logline: 'Coastal telemetry investigation.',
    director: 'Soren Bell',
    startDate: '2026-12-01',
    finalEndDate: '2027-02-01',
    suggestedEndDate: '2027-02-01',
    isEndDateFixed: false,
    constraints: {
      maxOvertimeHours: 2,
      turnaroundHours: 12,
      mealBreakFrequency: 6,
      sundayPremiums: true,
      weatherBufferDays: 1,
    } as any,
    phases: [],
    updatedAt: '2026-11-10T10:00:00.000Z',
    screenplayVersions: [script],
  };
}

const PNG_A =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_B =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('SceneOS — Batch 04: Unified Boards, Freeform Canvas & Deterministic Workflow Check', () => {

  it('1. consolidates Mood Boards and Lookbooks into a single "Boards" destination without losing legacy records', () => {
    // Only 3 Visualise tabs: Storyboards, Shot Lists & Camera Setups, Boards
    expect(VISUALIZE_WORKSPACES.map((w) => w.id)).toEqual([
      'storyboards',
      'shot-lists',
      'boards',
    ]);
    expect(VISUALIZE_WORKSPACES[2].name).toBe('Boards');
    expect(normalizeVisualizeWorkspaceId('lookbooks')).toBe('boards');
    expect(normalizeVisualizeWorkspaceId('moodboards')).toBe('boards');
    expect(normalizeVisualizeWorkspaceId('mood-boards')).toBe('boards');
    expect(normalizeVisualizeWorkspaceId('boards')).toBe('boards');

    const visualizeNav = SCENEOS_MODULE_HIERARCHY.find((m) => m.id === 'visualize');
    expect(visualizeNav?.submodules.map((s) => s.name)).toEqual([
      'Storyboards',
      'Shots',
      'Boards',
    ]);

    // Legacy Mood Boards & Lookbooks materialize intact inside getUnifiedBoards without duplicating Vault assets
    let project = makeProject();
    const a1 = registerSharedReferenceAsset(project, {
      originalFilename: 'sodium_pier.png',
      thumbnailDataUrl: PNG_A,
    });
    project = a1.updatedProject;
    const a2 = registerSharedReferenceAsset(project, {
      originalFilename: 'gauge_tungsten.png',
      thumbnailDataUrl: PNG_B,
    });
    project = a2.updatedProject;

    const mb = createMoodBoard(project, {
      title: 'Pier Atmosphere',
      theme: 'Lighting',
      description: 'Low mist & sodium lamps',
      linkedSceneIds: ['scn-proj-b4-1'],
    });
    project = addAssetToMoodBoard(mb.updatedProject, mb.board.id, a1.asset.id, {
      caption: 'Sodium Halo',
      note: 'Match key backlight',
      tileSize: 'wide',
    });

    const lb = createLookbook(project, {
      title: 'Production Design Lookbook',
      department: 'Production Design',
      coverAssetId: a1.asset.id,
      status: 'published',
      linkedSceneIds: ['scn-proj-b4-2'],
    });
    const sec = addLookbookSection(lb.updatedProject, lb.lookbook.id, {
      title: 'Instrument Panels',
      summary: 'Analog green CRT hues',
    });
    project = addAssetToLookbookSection(
      sec.updatedProject,
      lb.lookbook.id,
      sec.section!.id,
      a2.asset.id,
      { caption: 'Phosphor Gauge' }
    );

    const boards = getUnifiedBoards(project);
    expect(boards).toHaveLength(2);
    expect(boards[0].title).toBe('Pier Atmosphere');
    expect(boards[0].items.some((i) => i.assetId === a1.asset.id && i.text === 'Sodium Halo')).toBe(
      true
    );
    expect(boards[1].title).toBe('Production Design Lookbook');
    expect(boards[1].sections).toHaveLength(1);
    expect(boards[1].items.some((i) => i.assetId === a2.asset.id && i.text === 'Phosphor Gauge')).toBe(
      true
    );
    // Shared reference library count stays exactly 2 (zero duplicates)
    expect(getProductionVisualizeStore(project).referenceAssets).toHaveLength(2);

    const html = renderToStaticMarkup(
      <VisualizeWorkspace
        project={project}
        isDark={true}
        activeRole="director"
        initialSubmodule="lookbooks"
        onNavigateTab={() => {}}
      />
    );
    expect(html).toContain('data-testid="visualize-tab-boards"');
    expect(html).not.toContain('data-testid="lookbooks-subview-mood-boards"');
    expect(html).not.toContain('data-testid="lookbooks-subview-lookbooks"');
    expect(html).toContain('Pier Atmosphere');
    expect(html).toContain('Production Design Lookbook');
  });

  it('2. supports board management, freeform coordinates, resizing, z-index layering, borders, spacing, text notes, and non-destructive removal', () => {
    let project = makeProject();
    const r1 = registerSharedReferenceAsset(project, {
      originalFilename: 'frame_one.png',
      thumbnailDataUrl: PNG_A,
    });
    project = r1.updatedProject;
    const r2 = registerSharedReferenceAsset(project, {
      originalFilename: 'frame_two.png',
      thumbnailDataUrl: PNG_B,
    });
    project = r2.updatedProject;

    const created = createUnifiedBoard(project, {
      title: 'Camera Lighting Pinboard',
      categoryTag: 'Cinematography',
      spacingPx: 20,
      borderEnabled: true,
      borderWidthPx: 2,
      borderColor: '#e8e3d9',
    });
    project = created.updatedProject;
    const boardId = created.board.id;

    // Add section + images + headings/notes
    const sec = addBoardSection(project, boardId, { title: 'Key Light Tests' });
    project = sec.updatedProject;

    const img1 = addImageItemToBoard(project, boardId, r1.asset.id, {
      sectionId: sec.section!.id,
      caption: 'Key Frame 1',
      x: 40,
      y: 60,
      width: 300,
      height: 169,
      naturalAspectRatio: 16 / 9,
    });
    project = img1.updatedProject;

    const img2 = addImageItemToBoard(project, boardId, r2.asset.id, {
      x: 160,
      y: 120,
      width: 240,
      height: 240,
    });
    project = img2.updatedProject;

    const txt = addTextItemToBoard(project, boardId, {
      kind: 'note',
      text: 'Practical tungsten spill from right corridor.',
    });
    project = txt.updatedProject;

    // Resize, move, adjust z-order, spacing & border width
    project = updateBoardItem(project, boardId, img1.item!.id, {
      x: 95,
      y: 80,
      width: 360,
      height: 202,
    });
    project = changeBoardItemZIndex(project, boardId, img1.item!.id, 'front');
    project = updateUnifiedBoard(project, boardId, {
      spacingPx: 28,
      borderWidthPx: 4,
      borderEnabled: true,
    });

    const board = getUnifiedBoards(project).find((b) => b.id === boardId)!;
    const movedImg1 = board.items.find((i) => i.id === img1.item!.id)!;
    const img2Item = board.items.find((i) => i.id === img2.item!.id)!;
    expect(movedImg1.x).toBe(95);
    expect(movedImg1.width).toBe(360);
    expect(movedImg1.zIndex).toBeGreaterThan(img2Item.zIndex);
    expect(board.spacingPx).toBe(28);
    expect(board.borderWidthPx).toBe(4);

    // Side-by-side & vertical arrangement honors spacingPx
    project = arrangeBoardItems(project, boardId, 'side-by-side');
    const rowItems = getUnifiedBoards(project).find((b) => b.id === boardId)!.items;
    expect(rowItems[1].x).toBe(rowItems[0].x + rowItems[0].width + 28);

    // Duplicate & Archive
    const dup = duplicateUnifiedBoard(project, boardId);
    project = dup.updatedProject;
    expect(getUnifiedBoards(project)).toHaveLength(2);
    expect(dup.duplicatedBoard?.title).toBe('Camera Lighting Pinboard (Copy)');
    // Duplicating a board never duplicates Vault reference assets
    expect(getProductionVisualizeStore(project).referenceAssets).toHaveLength(2);

    project = archiveUnifiedBoard(project, dup.duplicatedBoard!.id, true);
    expect(
      getUnifiedBoards(project).find((b) => b.id === dup.duplicatedBoard!.id)?.status
    ).toBe('archived');

    // Remove item from board MUST NOT delete underlying Vault / ReferenceAsset
    project = removeBoardItem(project, boardId, img1.item!.id);
    expect(getProductionVisualizeStore(project).referenceAssets).toHaveLength(2);

    // Delete duplicated board
    project = deleteUnifiedBoard(project, dup.duplicatedBoard!.id);
    expect(getUnifiedBoards(project)).toHaveLength(1);
  });

  it('3. Workflow Assistant detects missing links, broken Vault refs & setup inconsistencies deterministically without mutating records', async () => {
    let project = makeProject();
    const script = project.screenplayVersions![0];
    const scene1 = script.scenes![0];
    const scene2 = script.scenes![1];

    const asset1 = registerSharedReferenceAsset(project, {
      originalFilename: 'pier_fog.png',
      thumbnailDataUrl: PNG_A,
    });
    project = asset1.updatedProject;
    const unusedAsset = registerSharedReferenceAsset(project, {
      originalFilename: 'unused_costume_swatch.png',
      thumbnailDataUrl: PNG_B,
    });
    project = unusedAsset.updatedProject;

    // 1. Panel with missing reference & panel with valid scene
    const p1 = createStoryboardPanel(project, {
      scene: scene1,
      screenplayVersionId: script.id,
      title: 'Opening Pier Wide',
    });
    project = p1.updatedProject;

    // 2. Unused Camera Setup + Setup with focal mismatch against a Shot
    const unusedSetup = createCameraSetup(project, {
      name: 'Setup B — Crane High Angle',
    });
    project = unusedSetup.updatedProject;

    const mainSetup = createCameraSetup(project, {
      name: 'Setup A — 35mm Master',
      cameraBody: 'ARRI Alexa Mini',
      focalLengthMm: '35mm',
    });
    project = mainSetup.updatedProject;

    const shot1 = createShot(project, {
      scene: scene2,
      screenplayVersionId: script.id,
      description: 'Push onto console gauges',
      cameraSetupId: mainSetup.setup.id,
      focalLengthMm: '50mm', // deliberate spec mismatch vs Setup A (35mm)
      storyboardPanelId: p1.panel.id, // deliberate cross-scene mismatch (Shot in Scene 2 linked to Scene 1 panel!)
    });
    project = shot1.updatedProject;

    // 3. Inject a Board item pointing to a missing Vault asset ID
    const b1 = createUnifiedBoard(project, { title: 'Lookboard With Broken Ref' });
    project = b1.updatedProject;
    // Direct inject broken asset reference
    project = {
      ...project,
      visualizeState: {
        ...getProductionVisualizeStore(project),
        boards: getUnifiedBoards(project).map((b) =>
          b.id === b1.board.id
            ? {
                ...b,
                items: [
                  {
                    id: 'broken-item-1',
                    kind: 'image' as const,
                    assetId: 'missing-vault-id-999',
                    text: 'Removed Ref',
                    x: 20,
                    y: 20,
                    width: 240,
                    height: 160,
                    zIndex: 1,
                  },
                ],
              }
            : b
        ),
      },
    };

    const snapshotBefore = JSON.stringify(project);
    const audit = auditVisualiseWorkflow(project);

    const codes = audit.issues.map((i) => i.code);
    expect(codes).toContain('PANEL_MISSING_REFERENCE');
    expect(codes).toContain('CAMERA_SETUP_UNUSED');
    expect(codes).toContain('CAMERA_SETUP_INCOMPLETE_SPECS');
    expect(codes).toContain('SHOT_SETUP_SPEC_MISMATCH');
    expect(codes).toContain('SHOT_PANEL_SCENE_MISMATCH');
    expect(codes).toContain('BOARD_BROKEN_ASSET_REF');
    expect(codes).toContain('VAULT_UNUSED_ASSETS');

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const checkRes = runVisualiseWorkflowAssistantQuery(
      project,
      'Check mismatches and unused Vault references'
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(checkRes.audit.confirmedFacts.shotCount).toBe(1);
    expect(checkRes.audit.confirmedFacts.boardCount).toBe(1);
    expect(checkRes.matchedIssues.length).toBeGreaterThan(0);

    // Canonical project MUST remain completely unmutated
    expect(JSON.stringify(project)).toBe(snapshotBefore);
    fetchSpy.mockRestore();
  });

  it('4. enforces cross-project isolation and read-only RBAC boundaries on Boards', () => {
    const projA = makeProject('proj-alpha', 'Alpha Film');
    const projB = makeProject('proj-beta', 'Beta Film');
    const { updatedProject: updatedA } = createUnifiedBoard(projA, {
      title: 'Alpha Secret Board',
    });

    expect(getUnifiedBoards(updatedA)).toHaveLength(1);
    expect(getUnifiedBoards(projB)).toHaveLength(0);

    const viewerHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={updatedA}
        isDark={true}
        activeRole="viewer"
        initialSubmodule="boards"
        onNavigateTab={() => {}}
      />
    );
    expect(viewerHtml).toContain('Read-only');
    expect(viewerHtml).not.toContain('data-testid="boards-create-btn"');
  });
});
