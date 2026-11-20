import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualizeWorkspace } from '../src/features/visualize/VisualizeWorkspace';
import { LookbookPresentationModal } from '../src/features/visualize/components/LookbookPresentationModal';
import { SharedReferencePickerModal } from '../src/features/visualize/components/SharedReferencePickerModal';
import {
  addAssetToLookbookSection,
  addAssetToMoodBoard,
  addLookbookSection,
  createLookbook,
  createMoodBoard,
  createStoryboardPanel,
  deleteLookbook,
  deleteLookbookSection,
  deleteMoodBoard,
  getProductionVisualizeStore,
  registerSharedReferenceAsset,
  removeLookbookSectionItem,
  removeMoodBoardItem,
  reorderLookbookSectionItems,
  reorderLookbookSections,
  reorderMoodBoardItems,
  updateLookbook,
  updateLookbookSection,
  updateLookbookSectionItem,
  updateMoodBoard,
  updateMoodBoardItem,
} from '../src/features/visualize/services/visualizeFoundationService';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Visualise Batch 3: Lookbooks & Mood Boards', () => {
  const realScenes: ParsedScene[] = [
    {
      id: 'scn-lb-1',
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
    id: 'ver-harbor-lb-1',
    version: 'v1.0',
    title: 'Harbor Observatory',
    changeDescription: 'Director prep draft',
    author: 'Writer',
    updatedAt: '2026-11-10T11:00:00Z',
    status: 'Approved',
    scenes: realScenes,
  };

  const makeProject = (id = 'proj-harbor-3', title = 'Harbor Observatory'): FilmProject => ({
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
    updatedAt: '2026-11-10T11:00:00Z',
    screenplayVersions: [realScript],
    activeScreenplayVersionId: 'ver-harbor-lb-1' as any,
  });

  const tinyPngA =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const tinyPngB =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('1. creates Mood Boards, pins/reorders/edits shared references, and preserves shared assets on unlink/delete', () => {
    const p0 = makeProject();
    const { updatedProject: p1, asset: a1 } = registerSharedReferenceAsset(p0, {
      originalFilename: 'fog_horizon.png',
      thumbnailDataUrl: tinyPngA,
      mimeType: 'image/png',
      source: 'Mood Board Upload',
    });
    const { updatedProject: p2, asset: a2 } = registerSharedReferenceAsset(p1, {
      originalFilename: 'tungsten_gauge.png',
      thumbnailDataUrl: tinyPngB,
      mimeType: 'image/png',
      source: 'Storyboards Upload',
    });

    const { updatedProject: p3, board } = createMoodBoard(p2, {
      title: 'Dusk & Maritime Fog',
      theme: 'Atmosphere',
      description: 'Low-contrast sea horizon textures',
      linkedSceneIds: ['scn-lb-1'],
    });

    const p4 = addAssetToMoodBoard(p3, board.id, a1.id, {
      caption: 'Horizon Mist',
      tileSize: 'wide',
    });
    const p5 = addAssetToMoodBoard(p4, board.id, a2.id, {
      caption: 'Warm Brass Counterpoint',
      tileSize: 'compact',
    });

    let store = getProductionVisualizeStore(p5);
    expect(store.moodBoards).toHaveLength(1);
    const createdBoard = store.moodBoards![0];
    expect(createdBoard.items.map((i) => i.assetId)).toEqual([a1.id, a2.id]);

    // Update caption & tileSize, then reorder
    const item2Id = createdBoard.items[1].id;
    const item1Id = createdBoard.items[0].id;
    const p6 = updateMoodBoardItem(p5, board.id, item2Id, {
      caption: 'Amber Dial Glow',
      note: 'Reference 2900K practical key',
      tileSize: 'feature',
    });
    const p7 = reorderMoodBoardItems(p6, board.id, [item2Id, item1Id]);

    store = getProductionVisualizeStore(p7);
    expect(store.moodBoards![0].items.map((i) => i.caption)).toEqual([
      'Amber Dial Glow',
      'Horizon Mist',
    ]);
    expect(store.moodBoards![0].items[0].sortOrder).toBe(1);

    // Update board metadata
    const p8 = updateMoodBoard(p7, board.id, { theme: 'Lighting' });
    expect(getProductionVisualizeStore(p8).moodBoards![0].theme).toBe('Lighting');

    // Remove item & delete board -> underlying shared referenceAssets MUST stay intact
    const p9 = removeMoodBoardItem(p8, board.id, item1Id);
    expect(getProductionVisualizeStore(p9).moodBoards![0].items).toHaveLength(1);
    expect(getProductionVisualizeStore(p9).referenceAssets).toHaveLength(2);

    const p10 = deleteMoodBoard(p9, board.id);
    expect(getProductionVisualizeStore(p10).moodBoards).toHaveLength(0);
    expect(getProductionVisualizeStore(p10).referenceAssets).toHaveLength(2);
  });

  it('2. creates structured Lookbooks with sections, curates shared assets, and preserves assets cleanly', () => {
    const p0 = makeProject();
    const { updatedProject: p1, asset: a1 } = registerSharedReferenceAsset(p0, {
      originalFilename: 'cinema_ref.png',
      thumbnailDataUrl: tinyPngA,
      source: 'Lookbook Upload',
    });
    const { updatedProject: p2, asset: a2 } = registerSharedReferenceAsset(p1, {
      originalFilename: 'palette_ref.png',
      thumbnailDataUrl: tinyPngB,
      source: 'Lookbook Upload',
    });

    const { updatedProject: p3, lookbook } = createLookbook(p2, {
      title: 'Harbor Observatory — Cinematography Bible',
      department: 'Cinematography',
      description: 'Lens, negative fill, and practical lighting rules.',
      coverAssetId: a1.id,
      linkedSceneIds: ['scn-lb-1'],
      status: 'draft',
    });

    const { updatedProject: p4, section: sec1 } = addLookbookSection(p3, lookbook.id, {
      title: 'Optical & Anamorphic Texture',
      summary: 'Soft spherical aberration at T2.',
      creativeNotes: '40mm + 75mm primary prime pair',
    });
    const { updatedProject: p5, section: sec2 } = addLookbookSection(p4, lookbook.id, {
      title: 'Colour Separation',
      summary: 'Warm tungsten dials against slate twilight.',
    });

    const p6 = addAssetToLookbookSection(p5, lookbook.id, sec1!.id, a1.id, {
      caption: 'Soft flare falloff',
    });
    const p7 = addAssetToLookbookSection(p6, lookbook.id, sec1!.id, a2.id, {
      caption: 'Shadow density ratio 4:1',
    });

    // Reorder sections & items, rename section, toggle status -> published
    const p8 = reorderLookbookSections(p7, lookbook.id, [sec2!.id, sec1!.id]);
    const p9 = updateLookbookSection(p8, lookbook.id, sec1!.id, {
      title: 'Optics & Glass Falloff',
    });
    const s1Items = getProductionVisualizeStore(p9).lookbooks![0].sections[1].items;
    const p10 = reorderLookbookSectionItems(p9, lookbook.id, sec1!.id, [
      s1Items[1].id,
      s1Items[0].id,
    ]);
    const p11 = updateLookbookSectionItem(p10, lookbook.id, sec1!.id, s1Items[1].id, {
      note: 'Hold cyan spill off skin tones',
    });
    const p12 = updateLookbook(p11, lookbook.id, { status: 'published' });

    let store = getProductionVisualizeStore(p12);
    const lb = store.lookbooks![0];
    expect(lb.status).toBe('published');
    expect(lb.sections.map((s) => `${s.sortOrder}:${s.title}`)).toEqual([
      '1:Colour Separation',
      '2:Optics & Glass Falloff',
    ]);
    expect(lb.sections[1].items.map((i) => i.caption)).toEqual([
      'Shadow density ratio 4:1',
      'Soft flare falloff',
    ]);

    // Remove item & section & lookbook -> shared referenceAssets remain intact!
    const p13 = removeLookbookSectionItem(p12, lookbook.id, sec1!.id, s1Items[0].id);
    expect(
      getProductionVisualizeStore(p13).lookbooks![0].sections[1].items
    ).toHaveLength(1);
    expect(getProductionVisualizeStore(p13).referenceAssets).toHaveLength(2);

    const p14 = deleteLookbookSection(p13, lookbook.id, sec2!.id);
    expect(getProductionVisualizeStore(p14).lookbooks![0].sections).toHaveLength(1);

    const p15 = deleteLookbook(p14, lookbook.id);
    expect(getProductionVisualizeStore(p15).lookbooks).toHaveLength(0);
    expect(getProductionVisualizeStore(p15).referenceAssets).toHaveLength(2);
  });

  it('3. shares reference assets across Storyboards, Mood Boards, and Lookbooks without duplication and enforces production isolation', () => {
    const projA = makeProject('proj-alpha', 'Alpha Film');
    const projB = makeProject('proj-beta', 'Beta Film');

    const { updatedProject: p1, asset } = registerSharedReferenceAsset(projA, {
      originalFilename: 'shared_master_key.png',
      thumbnailDataUrl: tinyPngA,
      source: 'Storyboards Upload',
    });
    const { updatedProject: p2 } = createStoryboardPanel(p1, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      primaryAssetId: asset.id,
    });
    const { updatedProject: p3, board } = createMoodBoard(p2, {
      title: 'Shared Board',
    });
    const p4 = addAssetToMoodBoard(p3, board.id, asset.id);
    const { updatedProject: p5, lookbook } = createLookbook(p4, {
      title: 'Shared Lookbook',
      coverAssetId: asset.id,
    });
    const { updatedProject: p6, section } = addLookbookSection(p5, lookbook.id, {
      title: 'Key Frame Direction',
    });
    const p7 = addAssetToLookbookSection(p6, lookbook.id, section!.id, asset.id);

    const storeA = getProductionVisualizeStore(p7);
    expect(storeA.referenceAssets).toHaveLength(1);
    expect(storeA.storyboardPanels[0].primaryAssetId).toBe(asset.id);
    expect(storeA.moodBoards![0].items[0].assetId).toBe(asset.id);
    expect(storeA.lookbooks![0].coverAssetId).toBe(asset.id);
    expect(storeA.lookbooks![0].sections[0].items[0].assetId).toBe(asset.id);

    // Beta stays completely isolated
    const storeB = getProductionVisualizeStore(projB);
    expect(storeB.moodBoards).toHaveLength(0);
    expect(storeB.lookbooks).toHaveLength(0);
    expect(storeB.referenceAssets).toHaveLength(0);
  });

  it('4. renders Lookbooks & Mood Boards landing UI, RBAC gating, shared picker, and distraction-free presentation + print PDF container', () => {
    // Empty initial state renders clean empty prompts without fake sample boards
    const emptyHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={makeProject()}
        isDark={true}
        activeRole="director"
        initialSubmodule="boards"
        onNavigateTab={() => {}}
      />
    );
    expect(emptyHtml).toContain('Boards');
    expect(emptyHtml).toContain('No visual boards yet');
    expect(emptyHtml).toContain('Create First Board');

    // Viewer RBAC omits write actions
    const viewerHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={makeProject()}
        isDark={true}
        activeRole="viewer"
        initialSubmodule="boards"
        onNavigateTab={() => {}}
      />
    );
    expect(viewerHtml).toContain('Read-only');
    expect(viewerHtml).not.toContain('Create First Board');

    // Presentation mode renders clean editorial view & dedicated #lookbook-printable-document without edit buttons
    const { updatedProject: p1, asset } = registerSharedReferenceAsset(makeProject(), {
      originalFilename: 'plate_one.png',
      thumbnailDataUrl: tinyPngA,
    });
    const { updatedProject: p2, lookbook } = createLookbook(p1, {
      title: 'Monolith Visual Identity',
      department: 'Production Design',
      description: 'Brutalist maritime concrete & warm tungsten accents.',
      coverAssetId: asset.id,
      linkedSceneIds: ['scn-lb-1'],
      status: 'published',
    });
    const { updatedProject: p3, section } = addLookbookSection(p2, lookbook.id, {
      title: 'Material Palette',
      summary: 'Salt-weathered basalt and brushed copper.',
      creativeNotes: 'Avoid specular plastic surfaces',
    });
    const p4 = addAssetToLookbookSection(p3, lookbook.id, section!.id, asset.id, {
      caption: 'Basalt Pier Texture',
    });

    const finalLb = getProductionVisualizeStore(p4).lookbooks![0];
    const presHtml = renderToStaticMarkup(
      <LookbookPresentationModal
        lookbook={finalLb}
        productionTitle="Harbor Observatory"
        scenes={realScenes}
        referenceAssets={[asset]}
        onClose={() => {}}
      />
    );
    expect(presHtml).toContain('Monolith Visual Identity');
    expect(presHtml).toContain('Material Palette');
    expect(presHtml).toContain('Basalt Pier Texture');
    expect(presHtml).toContain('Export PDF');
    expect(presHtml).toContain('id="lookbook-printable-document"');
    expect(presHtml).not.toContain('Add Reference');

    const pickerHtml = renderToStaticMarkup(
      <SharedReferencePickerModal
        isOpen={true}
        title="Add References"
        referenceAssets={[asset]}
        alreadyAttachedAssetIds={[asset.id]}
        canEdit={true}
        onClose={() => {}}
        onSelectAsset={() => {}}
        onUploadNewAsset={async () => {}}
      />
    );
    expect(pickerHtml).toContain('plate_one.png');
    expect(pickerHtml).toContain('Linked');
  });
});
