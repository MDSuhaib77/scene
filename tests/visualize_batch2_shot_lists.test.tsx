import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualizeWorkspace } from '../src/features/visualize/VisualizeWorkspace';
import { ShotEditorDrawer } from '../src/features/visualize/components/ShotEditorDrawer';
import { CameraSetupEditorDrawer } from '../src/features/visualize/components/CameraSetupEditorDrawer';
import {
  assignCameraSetupToShots,
  createCameraSetup,
  createShot,
  createShotFromStoryboardPanel,
  createStoryboardPanel,
  deleteCameraSetup,
  deleteShot,
  duplicateShot,
  getCanonicalVisualizeScreenplayContext,
  getProductionVisualizeStore,
  getShotCountsByScene,
  getShotsForCameraSetup,
  getShotsForScene,
  getUnresolvedSceneShots,
  moveShotToScene,
  removeShotCameraSetupAssociation,
  reorderShotsInScene,
  resolveCameraSetupForShot,
  resolveStoryboardPanelForShot,
  updateCameraSetup,
  updateShot,
} from '../src/features/visualize/services/visualizeFoundationService';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Visualise Batch 2: Shot Lists & Camera Setups', () => {
  const realScenes: ParsedScene[] = [
    {
      id: 'scn-shot-1',
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
      dialogueBlocks: [{ character: 'KARA', text: 'The beacon array is alignment-locked.' }],
      actionSnippet: 'Glass condensation catches the pale morning sun.',
      elements: [],
      status: 'reviewed',
    },
    {
      id: 'scn-shot-2',
      sceneNumber: '2',
      slugline: 'EXT. BREAKWATER PIER - DAY',
      intExt: 'EXT',
      location: 'BREAKWATER PIER',
      timeOfDay: 'DAY',
      pageLengthEighths: 6,
      pageLengthDisplay: '6/8',
      startPage: 2,
      estimatedDurationMinutes: 1,
      characters: ['KARA'],
      dialogueBlocks: [],
      actionSnippet: 'Cold swells hammer wet basalt pilings.',
      elements: [],
      status: 'reviewed',
    },
  ];

  const realScript: ScreenplayVersion = {
    id: 'ver-harbor-shots-1',
    version: 'v1.0',
    title: 'Harbor Observatory',
    changeDescription: 'Shooting script',
    author: 'Writer',
    updatedAt: '2026-11-10T10:00:00Z',
    status: 'Approved',
    scenes: realScenes,
  };

  const makeProject = (id = 'proj-harbor-2', title = 'Harbor Observatory'): FilmProject => ({
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
    updatedAt: '2026-11-10T10:00:00Z',
    screenplayVersions: [realScript],
    activeScreenplayVersionId: 'ver-harbor-shots-1' as any,
  });

  it('1. creates, edits, duplicates, reorders, moves across scenes, and deletes shots with predictable numbering', () => {
    const p0 = makeProject();
    const { updatedProject: p1, shot: s1 } = createShot(p0, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      description: 'Wide establishing of Observatory dome',
      shotSize: 'WS',
      cameraAngle: 'Eye-Level',
      movement: 'Dolly',
      focalLengthMm: '28mm',
    });
    const { updatedProject: p2, shot: s2 } = createShot(p1, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      description: 'Kara approaches brass sonar console',
      shotSize: 'MS',
      cameraAngle: 'Low Angle',
      movement: 'Static',
      linkedCharacters: ['KARA'],
    });

    // Edit s2
    const pEdited = updateShot(p2, s2.id, {
      framingNotes: 'Hold headroom for glass reflection',
      cameraNotes: '85mm T1.4 pull from gauge to face',
      status: 'ready',
    });

    // Duplicate s1 -> inserts immediately after s1, total 3 shots (1, 2, 3)
    const { updatedProject: pDup, duplicatedShot: sDup } = duplicateShot(pEdited, s1.id);
    expect(sDup).not.toBeNull();
    expect(sDup!.id).not.toBe(s1.id);

    let sc1Shots = getShotsForScene(getProductionVisualizeStore(pDup), 'scn-shot-1');
    expect(sc1Shots.map((s) => `${s.shotNumber}:${s.description}`)).toEqual([
      '1:Wide establishing of Observatory dome',
      '2:Wide establishing of Observatory dome (Copy)',
      '3:Kara approaches brass sonar console',
    ]);

    // Reorder: move s2 to front
    const pReordered = reorderShotsInScene(pDup, 'scn-shot-1', '1', [
      s2.id,
      s1.id,
      sDup!.id,
    ]);
    sc1Shots = getShotsForScene(getProductionVisualizeStore(pReordered), 'scn-shot-1');
    expect(sc1Shots.map((s) => `${s.shotNumber}:${s.id}`)).toEqual([
      `1:${s2.id}`,
      `2:${s1.id}`,
      `3:${sDup!.id}`,
    ]);
    expect(sc1Shots[0].framingNotes).toBe('Hold headroom for glass reflection');
    expect(sc1Shots[0].linkedCharacters).toEqual(['KARA']);

    // Move sDup from Scene 1 to Scene 2 -> both scenes renumber cleanly
    const pMoved = moveShotToScene(pReordered, sDup!.id, realScenes[1], realScript.id);
    const storeMoved = getProductionVisualizeStore(pMoved);
    expect(getShotsForScene(storeMoved, 'scn-shot-1').map((s) => s.shotNumber)).toEqual(['1', '2']);
    const sc2Shots = getShotsForScene(storeMoved, 'scn-shot-2');
    expect(sc2Shots).toHaveLength(1);
    expect(sc2Shots[0].id).toBe(sDup!.id);
    expect(sc2Shots[0].sceneNumber).toBe('2');
    expect(sc2Shots[0].shotNumber).toBe('1');

    // Delete s2 -> Scene 1 shot s1 automatically becomes Shot 1
    const pDeleted = deleteShot(pMoved, s2.id);
    const remainingSc1 = getShotsForScene(getProductionVisualizeStore(pDeleted), 'scn-shot-1');
    expect(remainingSc1.map((s) => `${s.shotNumber}:${s.id}`)).toEqual([`1:${s1.id}`]);

    // Canonical screenplay remained strictly untouched
    expect(getCanonicalVisualizeScreenplayContext(pDeleted).scenes).toHaveLength(2);
    expect(getShotCountsByScene(getProductionVisualizeStore(pDeleted)).get('scn-shot-2')).toBe(1);
  });

  it('2. creates reusable Camera Setups, assigns multiple shots cleanly, updates without breaking links, and unlinks/deletes safely', () => {
    const p0 = makeProject();

    // Only setup name required; optional fields may be blank
    expect(() => createCameraSetup(p0, { name: '   ' })).toThrow();

    const { updatedProject: p1, setup: setupA } = createCameraSetup(p0, {
      name: 'Setup A — North Window Track',
      cameraBody: 'ARRI Alexa 35',
      lensSeries: 'Cooke Anamorphic',
      focalLengthMm: '40mm',
      supportRig: '12ft Chapman Track',
      placementNotes: 'North window pointing SW',
      movementConfig: 'Smooth lateral push',
    });

    const { updatedProject: p2, shot: shot1 } = createShot(p1, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      description: 'Master pan across console',
    });
    const { updatedProject: p3, shot: shot2 } = createShot(p2, {
      scene: realScenes[1],
      screenplayVersionId: realScript.id,
      description: 'Window reflection exterior pickup',
    });

    // Assign single setup to BOTH shots across different scenes (zero duplicate setups)
    const pAssigned = assignCameraSetupToShots(p3, setupA.id, [shot1.id, shot2.id]);
    const storeAssigned = getProductionVisualizeStore(pAssigned);
    expect(storeAssigned.cameraSetups).toHaveLength(1);
    expect(getShotsForCameraSetup(storeAssigned, setupA.id).map((s) => s.id)).toEqual([
      shot1.id,
      shot2.id,
    ]);

    // Edit CameraSetup -> associated shots retain link and resolve updated specs
    const pSetupEdited = updateCameraSetup(pAssigned, setupA.id, {
      name: 'Setup A — Revised 50mm',
      focalLengthMm: '50mm',
    });
    const storeSetupEdited = getProductionVisualizeStore(pSetupEdited);
    const updatedShot1 = storeSetupEdited.shots.find((s) => s.id === shot1.id)!;
    expect(resolveCameraSetupForShot(updatedShot1, storeSetupEdited)?.focalLengthMm).toBe('50mm');

    // Remove association from shot1 without deleting setup or shot
    const pUnlinked = removeShotCameraSetupAssociation(pSetupEdited, shot1.id);
    const storeUnlinked = getProductionVisualizeStore(pUnlinked);
    expect(storeUnlinked.shots).toHaveLength(2);
    expect(storeUnlinked.cameraSetups).toHaveLength(1);
    expect(getShotsForCameraSetup(storeUnlinked, setupA.id).map((s) => s.id)).toEqual([shot2.id]);

    // Deleting setup leaves shot2 intact and clears its cameraSetupId safely
    const pSetupDeleted = deleteCameraSetup(pUnlinked, setupA.id);
    const storeAfterDelete = getProductionVisualizeStore(pSetupDeleted);
    expect(storeAfterDelete.cameraSetups).toHaveLength(0);
    expect(storeAfterDelete.shots).toHaveLength(2);
    expect(storeAfterDelete.shots.find((s) => s.id === shot2.id)?.cameraSetupId).toBeUndefined();
  });

  it('3. integrates with Storyboards cleanly without merging entities or mutating panel data', () => {
    const p0 = makeProject();
    const { updatedProject: pWithPanel, panel } = createStoryboardPanel(p0, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Observatory Glass Silhouette',
      shotSize: 'WS',
      movement: 'Dolly',
      framingNotes: 'Frame lighthouse beacon at left third',
      directorNotes: 'Keep lens flare subtle',
    });

    const { updatedProject: pWithShot, shot } = createShotFromStoryboardPanel(
      pWithPanel,
      realScenes[0],
      panel,
      realScript.id
    );

    const store = getProductionVisualizeStore(pWithShot);
    expect(store.storyboardPanels).toHaveLength(1);
    expect(store.shots).toHaveLength(1);
    expect(shot.id).not.toBe(panel.id);
    expect(shot.storyboardPanelId).toBe(panel.id);
    expect(shot.shotSize).toBe('WS');
    expect(shot.movement).toBe('Dolly');
    expect(resolveStoryboardPanelForShot(shot, store)?.id).toBe(panel.id);

    // Deleting the shot NEVER deletes or alters the Storyboard panel
    const pAfterShotDelete = deleteShot(pWithShot, shot.id);
    const storeAfter = getProductionVisualizeStore(pAfterShotDelete);
    expect(storeAfter.shots).toHaveLength(0);
    expect(storeAfter.storyboardPanels).toHaveLength(1);
    expect(storeAfter.storyboardPanels[0].title).toBe('Observatory Glass Silhouette');
  });

  it('4. flags unresolved scene references without deleting shots and enforces production isolation', () => {
    const projA = makeProject('proj-alpha', 'Alpha Film');
    const projB = makeProject('proj-beta', 'Beta Film');

    const { updatedProject: pA1 } = createCameraSetup(projA, { name: 'Alpha Rig' });
    const { updatedProject: pA2 } = createShot(pA1, {
      scene: realScenes[1],
      screenplayVersionId: realScript.id,
      description: 'Shot in Scene 2 before rewrite',
    });

    // If canonical scenes list no longer includes Scene 2, shot stays safe & gets flagged
    const unresolved = getUnresolvedSceneShots(getProductionVisualizeStore(pA2), [realScenes[0]]);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].description).toBe('Shot in Scene 2 before rewrite');

    // Beta project store stays completely isolated
    const storeB = getProductionVisualizeStore(projB);
    expect(storeB.shots).toHaveLength(0);
    expect(storeB.cameraSetups).toHaveLength(0);
  });

  it('5. renders empty screenplay, Shot List workspace, populated shots/links, RBAC gating, and editors accurately', () => {
    // Empty screenplay
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
        initialSubmodule="shot-lists"
        onNavigateTab={() => {}}
      />
    );
    expect(emptyHtml).toContain('No screenplay attached');

    // Build populated store with panel + setup + linked shot
    const { updatedProject: p1, panel } = createStoryboardPanel(makeProject(), {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      title: 'Window Reflection',
    });
    const { updatedProject: p2, setup } = createCameraSetup(p1, {
      name: 'Setup A — Dolly 35mm',
      cameraBody: 'ARRI Alexa 35',
      lensSeries: 'Master Anamorphic',
    });
    const { updatedProject: p3, shot } = createShot(p2, {
      scene: realScenes[0],
      screenplayVersionId: realScript.id,
      description: 'Dolly push past condensation window onto Kara',
      shotSize: 'MS',
      cameraAngle: 'Eye-Level',
      movement: 'Dolly',
      focalLengthMm: '35mm',
      cameraSetupId: setup.id,
      storyboardPanelId: panel.id,
    });

    // Populated Shot Lists UI
    const shotListHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={p3}
        isDark={true}
        activeRole="director"
        initialSubmodule="shot-lists"
        onNavigateTab={() => {}}
      />
    );
    expect(shotListHtml).toContain('Shot List');
    expect(shotListHtml).toContain('Camera Setups');
    expect(shotListHtml).toContain('Dolly push past condensation window onto Kara');
    expect(shotListHtml).toContain('Setup A — Dolly 35mm');
    expect(shotListHtml).toContain('Panel 1');
    expect(shotListHtml).toContain('Add Shot');

    // Viewer RBAC Read-Only gating omits Add Shot & shows Read-only badge
    const viewerHtml = renderToStaticMarkup(
      <VisualizeWorkspace
        project={p3}
        isDark={true}
        activeRole="viewer"
        initialSubmodule="shot-lists"
        onNavigateTab={() => {}}
      />
    );
    expect(viewerHtml).toContain('Read-only');
    expect(viewerHtml).not.toContain('Add Shot');

    // Shot Editor Drawer & Camera Setup Editor Drawer render clean forms
    const shotDrawerHtml = renderToStaticMarkup(
      <ShotEditorDrawer
        shot={shot}
        scene={realScenes[0]}
        allScenes={realScenes}
        cameraSetups={[setup]}
        sceneStoryboardPanels={[panel]}
        referenceAssets={[]}
        canEdit={true}
        onClose={() => {}}
        onSave={() => {}}
        onDeleteShot={() => {}}
        onMoveShotToScene={() => {}}
      />
    );
    expect(shotDrawerHtml).toContain('Shot 1');
    expect(shotDrawerHtml).toContain('Save Shot');
    expect(shotDrawerHtml).toContain('Camera Setup Association');
    expect(shotDrawerHtml).toContain('Storyboard Panel Reference');

    const setupDrawerHtml = renderToStaticMarkup(
      <CameraSetupEditorDrawer
        setup={setup}
        isCreating={false}
        associatedShots={[shot]}
        allProductionShots={[shot]}
        canEdit={true}
        onClose={() => {}}
        onCreate={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
        onAssignShot={() => {}}
        onUnlinkShot={() => {}}
        onJumpToShot={() => {}}
      />
    );
    expect(setupDrawerHtml).toContain('Setup A — Dolly 35mm');
    expect(setupDrawerHtml).toContain('Associated Shots (1)');
    expect(setupDrawerHtml).toContain('Save Setup');
  });
});
