import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualizeWorkspace } from '../src/features/visualize/VisualizeWorkspace';
import { StoryboardPanelEditorDrawer } from '../src/features/visualize/components/StoryboardPanelEditorDrawer';
import {
  createStoryboardPanel,
  deleteStoryboardPanel,
  getCanonicalVisualizeScreenplayContext,
  getProductionVisualizeStore,
  getStoryboardCountsByScene,
  getStoryboardPanelsForScene,
  registerSharedReferenceAsset,
  reorderStoryboardPanels,
  updateStoryboardPanel,
} from '../src/features/visualize/services/visualizeFoundationService';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Visualise Batch 1: Storyboards Workspace', () => {
  const realScenes: ParsedScene[] = [
    {
      id: 'scn-sb-1',
      sceneNumber: '1',
      slugline: 'INT. HARBOR OBSERVATORY - DAWN',
      intExt: 'INT',
      location: 'HARBOR OBSERVATORY',
      timeOfDay: 'DAWN',
      pageLengthEighths: 8,
      pageLengthDisplay: '1 0/8',
      startPage: 1,
      estimatedDurationMinutes: 1,
      characters: ['KARA', 'DEV'],
      dialogueBlocks: [
        { character: 'KARA', text: 'The beacon array is alignment-locked.' },
        { character: 'DEV', text: 'Wait—check the offshore telemetry channel.' },
      ],
      actionSnippet: 'Glass condensation catches the pale morning sun across brass dials.',
      elements: [],
      status: 'reviewed',
    },
    {
      id: 'scn-sb-2',
      sceneNumber: '2',
      slugline: 'EXT. BREAKWATER PIER - CONTINUOUS',
      intExt: 'EXT',
      location: 'BREAKWATER PIER',
      timeOfDay: 'CONTINUOUS',
      pageLengthEighths: 6,
      pageLengthDisplay: '6/8',
      startPage: 2,
      estimatedDurationMinutes: 1,
      characters: ['KARA'],
      dialogueBlocks: [],
      actionSnippet: 'Waves crash over slick basalt pilings.',
      elements: [],
      status: 'reviewed',
    },
  ];

  const realScript: ScreenplayVersion = {
    id: 'ver-harbor-sb-1',
    version: 'v1.0',
    title: 'Harbor Observatory',
    changeDescription: 'Locked shooting script',
    author: 'Writer',
    updatedAt: '2026-11-10T09:00:00Z',
    status: 'Approved',
    scenes: realScenes,
  };

  const makeProject = (id = 'proj-harbor-1', title = 'Harbor Observatory'): FilmProject => ({
    id,
    title,
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
    activeScreenplayVersionId: 'ver-harbor-sb-1' as any,
  });

  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('1. creates sequential panels scoped to production without mutating canonical screenplay', () => {
    const project0 = makeProject();
    const { updatedProject: project1, panel: p1 } = createStoryboardPanel(project0, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Opening Wide on Observatory',
      shotSize: 'WS',
      movement: 'Dolly',
    });
    const { updatedProject: project2, panel: p2 } = createStoryboardPanel(project1, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Close on Brass Dials',
      shotSize: 'CU',
    });

    const store = getProductionVisualizeStore(project2);
    const panels = getStoryboardPanelsForScene(store, 'scn-sb-1');

    expect(panels).toHaveLength(2);
    expect(panels.map((p) => p.id)).toEqual([p1.id, p2.id]);
    expect(panels.map((p) => p.panelNumber)).toEqual(['1', '2']);
    expect(panels.map((p) => p.sortOrder)).toEqual([1, 2]);
    expect(panels.every((p) => p.productionId === 'proj-harbor-1')).toBe(true);

    // Canonical screenplay stays untouched
    const ctx = getCanonicalVisualizeScreenplayContext(project2);
    expect(ctx.scenes).toHaveLength(2);
    expect(ctx.scenes[0].dialogueBlocks).toHaveLength(2);

    const counts = getStoryboardCountsByScene(store);
    expect(counts.get('scn-sb-1')).toBe(2);
    expect(counts.get('scn-sb-2') ?? 0).toBe(0);
  });

  it('2. registers shared reference assets without duplication and reuses them across panels', () => {
    const p0 = makeProject();
    const { updatedProject: p1, asset: a1 } = registerSharedReferenceAsset(p0, {
      originalFilename: 'dawn_frame.png',
      thumbnailDataUrl: tinyPngDataUrl,
      mimeType: 'image/png',
      fileSizeBytes: 96,
      source: 'Storyboards Upload',
      description: 'Observatory Dawn Keyframe',
    });

    // Duplicate registration of same dataUrl returns existing asset rather than duplicating
    const { updatedProject: p2, asset: a1Dup } = registerSharedReferenceAsset(p1, {
      originalFilename: 'dawn_frame.png',
      thumbnailDataUrl: tinyPngDataUrl,
      mimeType: 'image/png',
      fileSizeBytes: 96,
      source: 'Storyboards Upload',
      description: 'Observatory Dawn Keyframe',
    });

    expect(a1Dup.id).toBe(a1.id);
    expect(getProductionVisualizeStore(p2).referenceAssets).toHaveLength(1);

    const { updatedProject: p3, panel: panelA } = createStoryboardPanel(p2, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      primaryAssetId: a1.id,
    });
    const { updatedProject: p4, panel: panelB } = createStoryboardPanel(p3, {
      scene: realScenes[1],
      screenplayVersionId: realScript.id,
      primaryAssetId: a1.id,
    });

    // Deleting panelA leaves shared asset intact for panelB
    const p5 = deleteStoryboardPanel(p4, panelA.id);
    const store5 = getProductionVisualizeStore(p5);
    expect(store5.referenceAssets).toHaveLength(1);
    expect(getStoryboardPanelsForScene(store5, 'scn-sb-2')[0].id).toBe(panelB.id);
    expect(getStoryboardPanelsForScene(store5, 'scn-sb-2')[0].primaryAssetId).toBe(a1.id);
  });

  it('3. updates, reorders, and deletes panels while keeping numbering continuous', () => {
    const p0 = makeProject();
    const { updatedProject: p1, panel: pan1 } = createStoryboardPanel(p0, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Frame A',
    });
    const { updatedProject: p2, panel: pan2 } = createStoryboardPanel(p1, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Frame B',
    });
    const { updatedProject: p3, panel: pan3 } = createStoryboardPanel(p2, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Frame C',
    });

    const pEdited = updateStoryboardPanel(p3, pan2.id, {
      title: 'Frame B Updated',
      shotSize: 'MCU',
      movement: 'Static',
      framingNotes: '35mm anamorphic',
      actionNotes: 'Kara checks pressure gauge.',
      dialogueCue: 'KARA: The beacon array is alignment-locked.',
      directorNotes: 'Hold breath before look-up',
      status: 'approved',
    });

    const pReordered = reorderStoryboardPanels(pEdited, 'scn-sb-1', '1', [
      pan3.id,
      pan1.id,
      pan2.id,
    ]);
    const reorderedPanels = getStoryboardPanelsForScene(
      getProductionVisualizeStore(pReordered),
      'scn-sb-1'
    );
    expect(reorderedPanels.map((p) => `${p.panelNumber}:${p.title}`)).toEqual([
      '1:Frame C',
      '2:Frame A',
      '3:Frame B Updated',
    ]);
    expect(reorderedPanels[2].directorNotes).toBe('Hold breath before look-up');
    expect(reorderedPanels[2].status).toBe('approved');

    // Delete middle panel ("Frame A") -> remaining become 1 and 2 cleanly
    const pDeleted = deleteStoryboardPanel(pReordered, pan1.id);
    const remaining = getStoryboardPanelsForScene(
      getProductionVisualizeStore(pDeleted),
      'scn-sb-1'
    );
    expect(remaining.map((p) => `${p.panelNumber}:${p.title}`)).toEqual([
      '1:Frame C',
      '2:Frame B Updated',
    ]);
  });

  it('4. enforces production isolation across separate FilmProjects', () => {
    const projA = makeProject('proj-alpha', 'Alpha Film');
    const projB = makeProject('proj-beta', 'Beta Film');

    const { updatedProject: projAWithPanel } = createStoryboardPanel(projA, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Alpha Exclusive Beat',
    });

    const storeA = getProductionVisualizeStore(projAWithPanel);
    const storeB = getProductionVisualizeStore(projB);

    expect(storeA.storyboardPanels).toHaveLength(1);
    expect(storeB.storyboardPanels).toHaveLength(0);
    expect(storeA.productionId).toBe('proj-alpha');
    expect(storeB.productionId).toBe('proj-beta');
  });

  it('5. renders empty screenplay, empty scene, populated canvas, RBAC read-only gating, and panel editor drawer accurately', () => {
    // A. Empty screenplay renders honest zero-scene empty state
    const emptyProj: FilmProject = {
      ...makeProject(),
      screenplayVersions: [],
      scenes: [],
    } as any;
    const emptyHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={emptyProj}
        isDark={true}
        activeRole="director"
        onNavigateTab={() => {}}
      />
    );
    expect(emptyHtml).toContain('No screenplay attached');
    expect(emptyHtml).toContain('Open Screenplay Library');

    // B. Canonical script with unstoryboarded Scene 1 renders Scene Navigator & empty scene state
    const unstoryboardedHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={makeProject()}
        isDark={true}
        activeRole="director"
        onNavigateTab={() => {}}
      />
    );
    expect(unstoryboardedHtml).toContain('Scene Navigator');
    expect(unstoryboardedHtml).toContain('INT. HARBOR OBSERVATORY - DAWN');
    expect(unstoryboardedHtml).toContain('EXT. BREAKWATER PIER - CONTINUOUS');
    expect(unstoryboardedHtml).toContain('No storyboard panels yet');
    expect(unstoryboardedHtml).toContain('Add First Panel');

    // C. RBAC Read-Only Viewer role omits write buttons and shows Read-only badge
    const viewerHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={makeProject()}
        isDark={true}
        activeRole="viewer"
        onNavigateTab={() => {}}
      />
    );
    expect(viewerHtml).toContain('Read-only');
    expect(viewerHtml).not.toContain('Add First Panel');

    // D. Populated canvas renders panel card & object-contain artwork
    const { updatedProject: p1, asset } = registerSharedReferenceAsset(makeProject(), {
      originalFilename: 'still.png',
      thumbnailDataUrl: tinyPngDataUrl,
      mimeType: 'image/png',
      fileSizeBytes: 96,
      source: 'Storyboards Upload',
      description: 'Observatory Still',
    });
    const { updatedProject: p2, panel } = createStoryboardPanel(p1, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Establishing Observatory',
      shotSize: 'WS',
      movement: 'Dolly',
      actionNotes: 'Camera glides past frosted barometer.',
      dialogueCue: 'KARA: The beacon array is alignment-locked.',
      primaryAssetId: asset.id,
      status: 'in-review',
    });
    const populatedHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={p2}
        isDark={true}
        activeRole="director"
        onNavigateTab={() => {}}
      />
    );
    expect(populatedHtml).toContain('Panel 1');
    expect(populatedHtml).toContain('Establishing Observatory');
    expect(populatedHtml).toContain('WS');
    expect(populatedHtml).toContain('Dolly');
    expect(populatedHtml).toContain('In Review');
    expect(populatedHtml).toContain('object-contain');

    // E. Panel editor drawer renders metadata fields & dialogue insert picker
    const drawerHtml = renderToStaticMarkup(
      <StoryboardPanelEditorDrawer
        panel={panel}
        scene={realScenes[0]}
        referenceAssets={[asset]}
        canEdit={true}
        onClose={() => {}}
        onSave={() => {}}
        onUploadImage={async () => {}}
        onDeletePanel={() => {}}
      />
    );
    expect(drawerHtml).toContain('Panel 1');
    expect(drawerHtml).toContain('Establishing Observatory');
    expect(drawerHtml).toContain('Insert dialogue line from Scene 1');
    expect(drawerHtml).toContain('Reference Library (1)');
    expect(drawerHtml).toContain('Save Panel');
  });
});
