import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualizeWorkspace } from '../src/features/visualize/VisualizeWorkspace';
import {
  VISUALIZE_WORKSPACES,
  normalizeVisualizeWorkspaceId,
  getCanonicalVisualizeScreenplayContext,
  createPassageReference,
  getProductionVisualizeStore,
  updateProductionVisualizeStore,
  resolveShotForPanel,
  resolveCameraSetupForShot,
  resolveReferenceAssetsForIds,
  canViewVisualizeWorkspace,
  canEditVisualizeWorkspace,
} from '../src/features/visualize/services/visualizeFoundationService';
import { SCENEOS_MODULE_HIERARCHY } from '../src/components/navigation/navigationHierarchy';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Visualise Batch 0: Foundation, Architecture Audit & Cleanup', () => {
  const realScenes: ParsedScene[] = [
    {
      id: 'scn-real-1',
      sceneNumber: '1',
      slugline: 'INT. HARBOR OBSERVATORY - DAWN',
      intExt: 'INT',
      location: 'HARBOR OBSERVATORY',
      timeOfDay: 'DAWN',
      pageLengthEighths: 8,
      pageLengthDisplay: '1 0/8',
      startPage: 1,
      estimatedDurationMinutes: 1,
      characters: ['KARA'],
      dialogueBlocks: [{ character: 'KARA', text: 'The beacon array is alignment-locked.' }],
      actionSnippet: 'Glass condensation catches the pale morning sun.',
      elements: [],
      status: 'reviewed',
    },
  ];

  const realScript: ScreenplayVersion = {
    id: 'ver-harbor-1',
    version: 'v1.0',
    title: 'Harbor Observatory',
    changeDescription: 'Production draft',
    author: 'Writer',
    updatedAt: '2026-11-10T09:00:00Z',
    status: 'Approved',
    scenes: realScenes,
  };

  const baseProject: FilmProject = {
    id: 'proj-alpha',
    title: 'Harbor Observatory',
    logline: 'Coastal telemetry unit uncovers an offshore anomaly.',
    director: 'Kira Vance',
    startDate: '2026-11-15',
    finalEndDate: '2027-01-15',
    suggestedEndDate: '2027-01-15',
    isEndDateFixed: false,
    constraints: {
      maxOvertimeHours: 2,
      turnaroundHours: 12,
      mealBreakFrequency: 6,
      sundayPremiums: true,
      weatherBufferDays: 1,
    } as any,
    phases: [],
    updatedAt: '2026-11-10T09:00:00Z',
    screenplayVersions: [realScript],
    activeScreenplayVersionId: 'ver-harbor-1' as any,
    storyboardRevisions: [
      {
        id: 'vault-sb-1',
        sceneNumber: '1',
        panelNumber: '1A',
        title: 'Observatory Dome',
        description: 'Key frame synced from Vault',
        updatedAt: '2026-11-10T09:05:00Z',
        version: 'v1',
        artist: 'Art Dept',
        status: 'Approved',
        imageUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      },
    ],
  };

  it('1. enforces strictly three Visualise primary workspaces and removes obsolete Visual References destination', () => {
    expect(VISUALIZE_WORKSPACES).toHaveLength(3);
    expect(VISUALIZE_WORKSPACES.map((w) => w.id)).toEqual([
      'storyboards',
      'shot-lists',
      'boards',
    ]);

    const visualizeNav = SCENEOS_MODULE_HIERARCHY.find((m) => m.id === 'visualize');
    expect(visualizeNav).toBeDefined();
    expect(visualizeNav?.submodules).toHaveLength(3);
    const subIds = visualizeNav?.submodules.map((s) => s.id) || [];
    expect(subIds).toEqual([
      'visualize-storyboards',
      'visualize-shot-lists',
      'visualize-boards',
    ]);
    expect(subIds).not.toContain('visualize-refs');

    expect(normalizeVisualizeWorkspaceId('visual-refs')).toBe('storyboards');
    expect(normalizeVisualizeWorkspaceId('references')).toBe('storyboards');
    expect(normalizeVisualizeWorkspaceId('shot-lists')).toBe('shot-lists');
    expect(normalizeVisualizeWorkspaceId('lookbooks')).toBe('boards');
    expect(normalizeVisualizeWorkspaceId('boards')).toBe('boards');
  });

  it('2. renders cleaned VisualizeWorkspace without fabricated scenes, shots, or lookbook placeholders', () => {
    const emptyProject: FilmProject = {
      ...baseProject,
      screenplayVersions: [],
      storyboardRevisions: [],
    };

    const markup = renderToStaticMarkup(
      <VisualizeWorkspace
        project={emptyProject}
        isDark={true}
        activeRole="director"
        onNavigateTab={vi.fn()}
      />
    );

    expect(markup).toContain('data-testid="visualize-navigation-bar"');
    expect(markup).toContain('data-testid="visualize-tab-storyboards"');
    expect(markup).toContain('data-testid="visualize-tab-shot-lists"');
    expect(markup).toContain('data-testid="visualize-tab-boards"');
    expect(markup).not.toContain('visualize-tab-visual-refs');

    // No demo scene/shot/lookbook fabrication
    expect(markup).not.toContain('NEO-DETROIT');
    expect(markup).not.toContain('Blade Runner 2049');
    expect(markup).not.toContain('Ticket Robot');
    expect(markup).toContain('No screenplay attached');
  });

  it('3. anchors canonical screenplay and passage references without duplicating scenes', () => {
    const ctx = getCanonicalVisualizeScreenplayContext(baseProject);
    expect(ctx.hasScreenplay).toBe(true);
    expect(ctx.activeScript?.id).toBe('ver-harbor-1');
    expect(ctx.scenes).toHaveLength(1);
    expect(ctx.sceneMap.get('scn-real-1')?.slugline).toBe('INT. HARBOR OBSERVATORY - DAWN');

    const passage = createPassageReference(ctx.scenes[0], ctx.activeScript!.id);
    expect(passage).toMatchObject({
      screenplayVersionId: 'ver-harbor-1',
      sceneId: 'scn-real-1',
      sceneNumber: '1',
      sceneSlugline: 'INT. HARBOR OBSERVATORY - DAWN',
      excerpt: 'Glass condensation catches the pale morning sun.',
    });
  });

  it('4. enforces production isolation, non-duplication across workspaces, and Vault reference indexing', () => {
    const projectWithCrossContamination: FilmProject = {
      ...baseProject,
      visualizeState: {
        schemaVersion: 1,
        productionId: 'proj-alpha',
        cameraSetups: [
          {
            id: 'setup-a',
            productionId: 'proj-alpha',
            name: 'A-Cam 35mm Package',
            cameraBody: 'ALEXA 35',
            lensSeries: 'Cooke Anamorphic',
            createdAt: '2026-11-10T09:10:00Z',
            updatedAt: '2026-11-10T09:10:00Z',
          },
          {
            id: 'setup-foreign',
            productionId: 'proj-other',
            name: 'Leaked Setup',
            createdAt: '2026-11-10T09:10:00Z',
            updatedAt: '2026-11-10T09:10:00Z',
          },
        ],
        shots: [
          {
            id: 'shot-1',
            productionId: 'proj-alpha',
            sceneId: 'scn-real-1',
            sceneNumber: '1',
            cameraSetupId: 'setup-a',
            shotNumber: '1A',
            sortOrder: 1,
            description: 'Wide dolly push across observatory console.',
            referenceAssetIds: ['vault-ref-vault-sb-1'],
            status: 'planned',
            createdAt: '2026-11-10T09:11:00Z',
            updatedAt: '2026-11-10T09:11:00Z',
          },
        ],
        storyboardPanels: [
          {
            id: 'panel-1',
            productionId: 'proj-alpha',
            sceneId: 'scn-real-1',
            sceneNumber: '1',
            shotId: 'shot-1',
            panelNumber: '1',
            sortOrder: 1,
            title: 'Opening Wide Frame',
            referenceAssetIds: ['vault-ref-vault-sb-1'],
            primaryAssetId: 'vault-ref-vault-sb-1',
            status: 'draft',
            createdAt: '2026-11-10T09:12:00Z',
            updatedAt: '2026-11-10T09:12:00Z',
          },
        ],
        lookbookBoards: [
          {
            id: 'lb-1',
            productionId: 'proj-alpha',
            title: 'Natural Dawn Palette',
            department: 'Cinematography',
            linkedSceneIds: ['scn-real-1'],
            referenceAssetIds: ['vault-ref-vault-sb-1'],
            sortOrder: 1,
            createdAt: '2026-11-10T09:13:00Z',
            updatedAt: '2026-11-10T09:13:00Z',
          },
        ],
        referenceAssets: [],
        updatedAt: '2026-11-10T09:13:00Z',
      },
    };

    const store = getProductionVisualizeStore(projectWithCrossContamination);
    // Foreign production record filtered out
    expect(store.cameraSetups).toHaveLength(1);
    expect(store.cameraSetups[0].id).toBe('setup-a');

    // Vault storyboard image indexed once into shared Visual Reference Library
    expect(store.referenceAssets).toHaveLength(1);
    expect(store.referenceAssets[0].vaultAssetId).toBe('vault-sb-1');

    // Relational resolution without duplicating shots, setups, or assets
    const panel = store.storyboardPanels[0];
    const linkedShot = resolveShotForPanel(panel, store);
    expect(linkedShot?.id).toBe('shot-1');
    expect(resolveCameraSetupForShot(linkedShot!, store)?.name).toBe('A-Cam 35mm Package');

    const panelAssets = resolveReferenceAssetsForIds(panel.referenceAssetIds, store);
    const lookbookAssets = resolveReferenceAssetsForIds(
      store.lookbookBoards[0].referenceAssetIds,
      store
    );
    expect(panelAssets[0].id).toBe(lookbookAssets[0].id);

    // Updating enforces production scope
    const updatedProject = updateProductionVisualizeStore(projectWithCrossContamination, (cur) => ({
      ...cur,
      lookbookBoards: [
        ...cur.lookbookBoards,
        {
          id: 'lb-2',
          productionId: 'wrong-id',
          title: 'Costume Textures',
          department: 'Costume',
          linkedSceneIds: [],
          referenceAssetIds: [],
          sortOrder: 2,
          createdAt: '2026-11-10T09:15:00Z',
          updatedAt: '2026-11-10T09:15:00Z',
        },
      ],
    }));
    expect(updatedProject.visualizeState?.lookbookBoards.every((b) => b.productionId === 'proj-alpha')).toBe(true);
  });

  it('5. respects RBAC view and edit permissions and displays Read-Only badge for viewers', () => {
    expect(canViewVisualizeWorkspace('viewer')).toBe(true);
    expect(canEditVisualizeWorkspace('viewer')).toBe(false);
    expect(canEditVisualizeWorkspace('crew_member')).toBe(false);
    expect(canEditVisualizeWorkspace('department_head')).toBe(true);
    expect(canEditVisualizeWorkspace('director')).toBe(true);
    expect(canEditVisualizeWorkspace('owner')).toBe(true);

    const viewerMarkup = renderToStaticMarkup(
      <VisualizeWorkspace
        project={baseProject}
        isDark={true}
        activeRole="viewer"
        onNavigateTab={vi.fn()}
      />
    );
    expect(viewerMarkup).toContain('data-testid="visualize-readonly-badge"');
    expect(viewerMarkup).toContain('Harbor Observatory');
    expect(viewerMarkup).toContain('1 scene');
  });
});
