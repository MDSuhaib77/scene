import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VaultWorkspace } from '../src/features/vault/components/VaultWorkspace';
import { ShotListsWorkspace } from '../src/features/visualize/components/ShotListsWorkspace';
import {
  VAULT_AUDIO_STATUSES,
  VAULT_IMAGE_STATUSES,
  VAULT_PRODUCTION_STATUSES,
  VAULT_VIDEO_STATUSES,
  VaultAssetRecord,
  VaultProductionStatus,
  coerceStatusForVaultCategory,
  getStatusesForVaultCategory,
} from '../src/features/vault/types';
import {
  attachVaultAssetToProject,
  detectVaultCategoryFromFile,
  formatDuration,
  formatFileSize,
  getVaultStore,
  inspectMediaFileHeader,
  removeVaultAssetFromProject,
  updateVaultAssetMetadata,
} from '../src/features/vault/services/vaultMediaService';
import {
  deleteVaultMediaBlob,
  getVaultMediaBlob,
  saveVaultMediaBlob,
} from '../src/features/vault/services/vaultStorageService';
import {
  addAssetToLookbookSection,
  addAssetToMoodBoard,
  addLookbookSection,
  createCameraSetup,
  createLookbook,
  createMoodBoard,
  createShot,
  createStoryboardPanel,
  getProductionVisualizeStore,
  registerSharedReferenceAsset,
  updateShot,
} from '../src/features/visualize/services/visualizeFoundationService';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

function makeProject(id: string, title: string): FilmProject {
  const scene: ParsedScene = {
    id: `scn-${id}-1`,
    sceneNumber: '1',
    slugline: 'EXT. NIGHT ROOFTOP - RAIN',
    intExt: 'EXT',
    location: 'NIGHT ROOFTOP',
    timeOfDay: 'NIGHT',
    pageLengthEighths: 8,
    pageLengthDisplay: '1 0/8',
    startPage: 1,
    estimatedDurationMinutes: 1,
    characters: ['AARYA'],
    dialogueBlocks: [],
    actionSnippet: 'Neon reflections ripple across standing rainwater.',
    elements: [],
    status: 'reviewed',
  };

  const script: ScreenplayVersion = {
    id: `ver-${id}-1`,
    version: 'v1.0',
    title: 'Draft',
    changeDescription: 'Initial vault test draft',
    author: 'Writer',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'Approved',
    scenes: [scene],
  };

  return {
    id,
    title,
    logline: 'Night surveillance thriller.',
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
    updatedAt: '2026-01-01T00:00:00.000Z',
    screenplayVersions: [script],
  };
}

describe('SceneOS — Vault Simplification, Statuses & Visualise Reuse', () => {
  it('supports all four canonical Vault categories and formatting utilities', () => {
    const imgFile = new File([new Uint8Array([1, 2])], 'frame.png', { type: 'image/png' });
    const vidFile = new File([new Uint8Array([1, 2])], 'dailies.webm', { type: 'video/webm' });
    const audFile = new File([new Uint8Array([1, 2])], 'boom_take.wav', { type: 'audio/wav' });
    const gfxFile = new File([new Uint8Array([1, 2])], 'title_card.svg', { type: 'image/svg+xml' });
    const unknownFile = new File([new Uint8Array([1, 2])], 'notes.bin', { type: 'application/octet-stream' });

    expect(detectVaultCategoryFromFile(imgFile)).toBe('images');
    expect(detectVaultCategoryFromFile(imgFile, 'graphics')).toBe('graphics');
    expect(detectVaultCategoryFromFile(vidFile)).toBe('video');
    expect(detectVaultCategoryFromFile(audFile)).toBe('audio');
    expect(detectVaultCategoryFromFile(gfxFile)).toBe('graphics');
    expect(detectVaultCategoryFromFile(unknownFile)).toBeNull();

    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(75)).toBe('01:15');
    expect(formatDuration(3665)).toBe('1:01:05');
    expect(formatDuration(undefined)).toBe('--:--');

    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('persists editable metadata and category-specific Production Statuses strictly without invalid cross-category states', () => {
    expect(VAULT_IMAGE_STATUSES).toEqual(['Raw', 'In Progress', 'Edited', 'Unfinished', 'Final']);
    expect(VAULT_AUDIO_STATUSES).toEqual([
      'Raw',
      'Unedited',
      'In Progress',
      'Unfinished',
      'Dubbing Needed',
      'Dubbing In Progress',
      'Dubbing Done',
      'Final',
    ]);
    expect(VAULT_VIDEO_STATUSES).toEqual([
      'Raw',
      'Unedited',
      'In Progress',
      'Unfinished',
      'Edited',
      'Dubbing Needed',
      'Dubbing In Progress',
      'Dubbing Done',
      'Final',
    ]);

    expect(getStatusesForVaultCategory('images')).toEqual(VAULT_IMAGE_STATUSES);
    expect(getStatusesForVaultCategory('graphics')).toEqual(VAULT_IMAGE_STATUSES);
    expect(getStatusesForVaultCategory('audio')).toEqual(VAULT_AUDIO_STATUSES);
    expect(getStatusesForVaultCategory('video')).toEqual(VAULT_VIDEO_STATUSES);

    // Invalid cross-category statuses coerce safely back to Raw
    expect(coerceStatusForVaultCategory('images', 'Dubbing Needed')).toBe('Raw');
    expect(coerceStatusForVaultCategory('audio', 'Edited')).toBe('Raw');
    expect(coerceStatusForVaultCategory('video', 'Dubbing Done')).toBe('Dubbing Done');

    let project = makeProject('proj-vault-1', 'Neon Rain');
    const videoAsset: VaultAssetRecord = {
      id: 'va-vid-1',
      productionId: project.id,
      category: 'video',
      name: 'rooftop_reel.webm',
      originalFilename: 'rooftop_reel.webm',
      mimeType: 'video/webm',
      fileSizeBytes: 120000,
      tags: ['video', 'vault'],
      productionStatus: 'Raw',
      storageProvider: 'vault-idb',
      storageKey: 'va-vid-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    project = attachVaultAssetToProject(project, videoAsset);

    for (const status of VAULT_VIDEO_STATUSES) {
      const current = getVaultStore(project).assets[0];
      project = updateVaultAssetMetadata(project, current, {
        productionStatus: status as VaultProductionStatus,
        name: `Rooftop Reel (${status})`,
        description: `Reviewed stage: ${status}`,
        tags: ['neon', 'rain', status.toLowerCase().replace(/\s+/g, '-')],
      });
      const updated = getVaultStore(project).assets[0];
      expect(updated.productionStatus).toBe(status);
      expect(updated.storageKey).toBe('va-vid-1');
    }
  });

  it('sniffs binary container headers across wide audio/video production formats cleanly', async () => {
    const wavHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    const flacHeader = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0, 0, 0, 34]);
    const opusHeader = new TextEncoder().encode('OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00\x01OpusHead');
    const aiffHeader = new TextEncoder().encode('FORM\x00\x00\x00\x10AIFF');
    const movHeader = new TextEncoder().encode('\x00\x00\x00\x14ftypqt  \x00\x00\x02\x00');
    const mkvHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]);
    const aviHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]);

    expect(
      (await inspectMediaFileHeader(new File([wavHeader], 'sound.dat', { type: 'application/octet-stream' }))).detectedContainer
    ).toBe('WAV');
    expect(
      (await inspectMediaFileHeader(new File([flacHeader], 'stem.flac', { type: '' }))).detectedContainer
    ).toBe('FLAC');
    expect(
      (await inspectMediaFileHeader(new File([opusHeader], 'comms.opus', { type: '' }))).detectedContainer
    ).toBe('Opus');
    expect(
      (await inspectMediaFileHeader(new File([aiffHeader], 'master.aiff', { type: '' }))).detectedContainer
    ).toBe('AIFF');
    expect(
      (await inspectMediaFileHeader(new File([movHeader], 'camera_b.mov', { type: '' }))).detectedContainer
    ).toBe('QuickTime MOV');
    expect(
      (await inspectMediaFileHeader(new File([mkvHeader], 'archive.mkv', { type: '' }))).detectedContainer
    ).toBe('Matroska MKV');
    expect(
      (await inspectMediaFileHeader(new File([aviHeader], 'legacy.avi', { type: '' }))).detectedContainer
    ).toBe('AVI');
  });

  it('shares Vault Images & Graphics across Storyboards, Shot Lists, Camera Setups, Mood Boards, and Lookbooks without duplication', () => {
    let project = makeProject('proj-vault-shared', 'Harbor Glass');
    const script = project.screenplayVersions![0];
    const scene = script.scenes![0];

    // 1. Upload one Image into Vault
    const vaultImage: VaultAssetRecord = {
      id: 'va-shared-1',
      productionId: project.id,
      category: 'images',
      name: 'anamorphic_flare_ref.png',
      originalFilename: 'anamorphic_flare_ref.png',
      mimeType: 'image/png',
      fileSizeBytes: 24500,
      description: 'Reference lens flare color grade',
      tags: ['anamorphic', 'cobalt'],
      productionStatus: 'Final',
      width: 1600,
      height: 900,
      thumbnailDataUrl: 'data:image/png;base64,AAA111',
      storageProvider: 'vault-idb',
      storageKey: 'va-shared-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    project = attachVaultAssetToProject(project, vaultImage);
    const visStoreAfterUpload = getProductionVisualizeStore(project);

    // Must expose exactly 1 shared reference asset linked via vaultAssetId
    expect(visStoreAfterUpload.referenceAssets).toHaveLength(1);
    const sharedRef = visStoreAfterUpload.referenceAssets[0];
    expect(sharedRef.vaultAssetId).toBe(vaultImage.id);

    // 2. Attach into Storyboard panel
    const sbRes = createStoryboardPanel(project, {
      scene,
      screenplayVersionId: script.id,
      title: 'Panel A',
      primaryAssetId: sharedRef.id,
    });
    project = sbRes.updatedProject;

    // 3. Attach into Shot Plan & Camera Setup
    const setupRes = createCameraSetup(project, {
      name: 'Setup A — 40mm Anamorphic',
      focalLengthMm: '40mm',
      referenceAssetIds: [sharedRef.id],
    });
    project = setupRes.updatedProject;

    const shotRes = createShot(project, {
      scene,
      screenplayVersionId: script.id,
      description: 'Slow push across rain puddles',
      cameraSetupId: setupRes.setup.id,
    });
    project = updateShot(shotRes.updatedProject, shotRes.shot.id, {
      referenceAssetIds: [sharedRef.id],
    });

    // 4. Attach into Mood Board & Lookbook
    const mbRes = createMoodBoard(project, { title: 'Rain Palette' });
    project = addAssetToMoodBoard(mbRes.updatedProject, mbRes.board.id, sharedRef.id, {
      note: 'Lighting cue',
    });

    const lbRes = createLookbook(project, { title: 'Director Pitch Lookbook' });
    const secRes = addLookbookSection(lbRes.updatedProject, lbRes.lookbook.id, { title: 'Optics' });
    project = addAssetToLookbookSection(
      secRes.updatedProject,
      lbRes.lookbook.id,
      secRes.section!.id,
      sharedRef.id
    );

    // Assert zero duplication across the entire shared asset store
    const finalVis = getProductionVisualizeStore(project);
    expect(finalVis.referenceAssets).toHaveLength(1);
    expect(finalVis.storyboardPanels[0].primaryAssetId).toBe(sharedRef.id);
    expect(finalVis.cameraSetups[0].referenceAssetIds).toEqual([sharedRef.id]);
    expect(finalVis.shots[0].referenceAssetIds).toEqual([sharedRef.id]);
    expect(finalVis.moodBoards[0].items[0].assetId).toBe(sharedRef.id);
    expect(finalVis.lookbooks[0].sections[0].items[0].assetId).toBe(sharedRef.id);

    // 5. Reverse projection: Visualise-originated reference shows inside Vault store cleanly
    const rev = registerSharedReferenceAsset(project, {
      originalFilename: 'visualize_diagram.png',
      thumbnailDataUrl: 'data:image/png;base64,BBB222',
      mimeType: 'image/png',
      fileSizeBytes: 8000,
      tags: ['graphic'],
      source: 'Storyboards Upload',
    });
    const vaultStore = getVaultStore(rev.updatedProject);
    expect(vaultStore.assets.map((a) => a.originalFilename)).toContain('visualize_diagram.png');
  });

  it('stores/retrieves binary media blobs safely and cleans up on removal with strict production isolation', async () => {
    let projA = makeProject('proj-iso-a', 'Production A');
    const projB = makeProject('proj-iso-b', 'Production B');

    const blob = new Blob(['RIFFtestaudio'], { type: 'audio/wav' });
    await saveVaultMediaBlob('va-aud-a', projA.id, blob);

    expect(await getVaultMediaBlob('va-aud-a', projA.id)).not.toBeNull();
    expect(await getVaultMediaBlob('va-aud-a', projB.id)).toBeNull();

    projA = attachVaultAssetToProject(projA, {
      id: 'va-aud-a',
      productionId: projA.id,
      category: 'audio',
      name: 'wild_track_01.wav',
      originalFilename: 'wild_track_01.wav',
      mimeType: 'audio/wav',
      fileSizeBytes: blob.size,
      durationSeconds: 12,
      tags: ['audio', 'vault'],
      productionStatus: 'Dubbing Needed',
      storageProvider: 'vault-idb',
      storageKey: 'va-aud-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(getVaultStore(projA).assets).toHaveLength(1);
    expect(getVaultStore(projB).assets).toHaveLength(0);

    const removedProjA = await removeVaultAssetFromProject(projA, getVaultStore(projA).assets[0]);
    expect(getVaultStore(removedProjA).assets).toHaveLength(0);
    expect(await getVaultMediaBlob('va-aud-a', projA.id)).toBeNull();
    await deleteVaultMediaBlob('va-aud-a');
  });

  it('renders strictly Images, Audio, and Video submodules (without All), preserves legacy graphics inside Images, and enforces viewer RBAC', () => {
    let project = makeProject('proj-rbac', 'RBAC Test Film');
    project = attachVaultAssetToProject(project, {
      id: 'va-gfx-legacy-1',
      productionId: project.id,
      category: 'graphics',
      name: 'slate_graphic.svg',
      originalFilename: 'slate_graphic.svg',
      mimeType: 'image/svg+xml',
      fileSizeBytes: 1200,
      tags: ['graphic', 'vault'],
      productionStatus: 'Final',
      thumbnailDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
      storageProvider: 'vault-idb',
      storageKey: 'va-gfx-legacy-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const directorHtml = renderToStaticMarkup(
      <VaultWorkspace project={project} activeRole="director" onUpdateProject={() => {}} />
    );
    expect(directorHtml).toContain('data-testid="vault-cat-images"');
    expect(directorHtml).toContain('data-testid="vault-cat-audio"');
    expect(directorHtml).toContain('data-testid="vault-cat-video"');
    expect(directorHtml).not.toContain('data-testid="vault-cat-all"');
    expect(directorHtml).not.toContain('data-testid="vault-cat-graphics"');
    // Existing graphics item remains visible & preserved inside Images gallery
    expect(directorHtml).toContain('slate_graphic.svg');
    expect(directorHtml).toContain('Upload Files');

    // Audio & Video distinct gallery containers + strictly category-scoped status options
    const audioHtml = renderToStaticMarkup(
      <VaultWorkspace
        project={project}
        activeRole="director"
        initialCategory="audio"
        onUpdateProject={() => {}}
      />
    );
    expect(audioHtml).toContain('Dubbing Needed');
    expect(audioHtml).not.toContain('>Edited<');

    const viewerHtml = renderToStaticMarkup(
      <VaultWorkspace project={project} activeRole="viewer" />
    );
    expect(viewerHtml).toContain('Read-only');
    expect(viewerHtml).not.toContain('Upload Files');

    const script = project.screenplayVersions![0];
    const scenes = script.scenes!;
    const shotListsHtml = renderToStaticMarkup(
      <ShotListsWorkspace
        project={project}
        activeRole="director"
        canEdit={true}
        screenplayCtx={{
          productionId: project.id,
          hasScreenplay: true,
          activeScript: script,
          scenes,
          sceneMap: new Map(scenes.map((s) => [s.id, s])),
        }}
        visualizeStore={getProductionVisualizeStore(project)}
        onNavigateTab={() => {}}
      />
    );
    expect(shotListsHtml).toContain('Shot');
  });
});
