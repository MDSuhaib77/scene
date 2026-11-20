import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SCENEOS_MODULE_HIERARCHY,
  findModuleByTabId,
} from '../src/components/navigation/navigationHierarchy';
import {
  createDirectoryEntry,
  createShootingDay,
  deleteDirectoryEntry,
  getProductionOperationalStore,
  normalizeProductionSectionId,
  syncShootingDaysFromScreenplay,
  upsertCallSheetForDay,
  upsertDailyReport,
} from '../src/features/production/services/productionStoreService';
import { ProductionWorkspace } from '../src/features/production/components/ProductionWorkspace';
import { VaultWorkspace } from '../src/features/vault/components/VaultWorkspace';
import {
  getProductionVisualizeStore,
  registerSharedReferenceAsset,
} from '../src/features/visualize/services/visualizeFoundationService';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Foundation Reconstruction Batch 01: Six-Module Consolidation', () => {
  const realScenes: ParsedScene[] = [
    {
      id: 'scn-b01-1',
      sceneNumber: '1',
      slugline: 'INT. HARBOR OBSERVATORY - DAWN',
      intExt: 'INT',
      location: 'HARBOR OBSERVATORY',
      timeOfDay: 'DAWN',
      pageLengthEighths: 10,
      pageLengthDisplay: '1 2/8',
      startPage: 1,
      estimatedDurationMinutes: 2,
      characters: ['KARA'],
      dialogueBlocks: [{ character: 'KARA', text: 'Signal locked.' }],
      actionSnippet: 'Rain drums against copper dome.',
      elements: [],
      status: 'reviewed',
    },
    {
      id: 'scn-b01-2',
      sceneNumber: '2',
      slugline: 'EXT. BREAKWATER PIER - NIGHT',
      intExt: 'EXT',
      location: 'BREAKWATER PIER',
      timeOfDay: 'NIGHT',
      pageLengthEighths: 12,
      pageLengthDisplay: '1 4/8',
      startPage: 2,
      estimatedDurationMinutes: 2,
      characters: ['KARA', 'DEV'],
      dialogueBlocks: [{ character: 'DEV', text: 'Check the pier line.' }],
      actionSnippet: 'Sodium lamps cut across fog.',
      elements: [],
      status: 'reviewed',
    },
  ];

  const realScript: ScreenplayVersion = {
    id: 'ver-b01-1',
    version: 'v1.0',
    title: 'Harbor Observatory',
    changeDescription: 'Shooting script',
    author: 'Writer',
    updatedAt: '2026-11-10T10:00:00Z',
    status: 'Approved',
    scenes: realScenes,
  };

  const makeProject = (id = 'proj-recon-1', title = 'Harbor Observatory'): FilmProject => ({
    id,
    title,
    logline: 'Coastal telemetry unit uncovers an offshore anomaly.',
    director: 'Kira Vance',
    startDate: '2026-11-15',
    finalEndDate: '2027-01-15',
    suggestedEndDate: '2027-01-15',
    isEndDateFixed: false,
    constraints: {
      budgetLimit: 1000000,
      dailyBurnRateCap: 25000,
      screenplayLocked: true,
      castAvailabilityDays: 30,
      permitLeadTimeDays: 10,
      targetRating: 'PG-13',
      weatherContingencyBuffer: 3,
      postOverheadRatio: 15,
    },
    phases: [],
    updatedAt: '2026-11-10T10:00:00Z',
    screenplayVersions: [realScript],
    footageBackups: [],
  });

  it('1. enforces strictly six primary navigation modules and eliminates retired destinations and static badges', () => {
    expect(SCENEOS_MODULE_HIERARCHY.map((m) => m.id)).toEqual([
      'overview',
      'screenplay',
      'breakdown',
      'visualize',
      'production',
      'vault',
    ]);

    // No static misleading badges anywhere on primary nav items
    expect(SCENEOS_MODULE_HIERARCHY.every((m) => !m.badge)).toBe(true);

    // Production contains strictly Calendar, Shoot, Directory
    const prodNav = SCENEOS_MODULE_HIERARCHY.find((m) => m.id === 'production');
    expect(prodNav?.submodules.map((s) => s.submoduleId)).toEqual([
      'calendar',
      'shoot',
      'directory',
    ]);

    // Legacy tab IDs resolve cleanly to the 6 primary owners
    expect(findModuleByTabId('calendar')?.id).toBe('production');
    expect(findModuleByTabId('master-calendar')?.id).toBe('production');
    expect(findModuleByTabId('crew')?.id).toBe('production');
    expect(findModuleByTabId('shoot')?.id).toBe('production');
    expect(findModuleByTabId('assets')?.id).toBe('vault');
    expect(findModuleByTabId('telemetry')?.id).toBe('overview');
    expect(findModuleByTabId('collaboration')?.id).toBe('overview');

    // Retired standalone placeholders removed from primary hierarchy
    const allIds = SCENEOS_MODULE_HIERARCHY.map((m) => m.id);
    expect(allIds).not.toContain('resources');
    expect(allIds).not.toContain('budget');
    expect(allIds).not.toContain('settings');
    expect(allIds).not.toContain('constraints');
    expect(allIds).not.toContain('telemetry');
    expect(allIds).not.toContain('collaboration');

    expect(normalizeProductionSectionId('tasks')).toBe('calendar');
    expect(normalizeProductionSectionId('call-sheets')).toBe('shoot');
    expect(normalizeProductionSectionId('crew')).toBe('directory');
  });

  it('2. shares canonical ShootingDays, CallSheets, DPRs, and Directory locations per production with clean FK integrity', () => {
    const p0 = makeProject();

    // Add authoritative location in Directory
    const { updatedProject: p1, entry: dockLoc } = createDirectoryEntry(p0, {
      kind: 'location',
      name: 'Breakwater Harbor Pier',
      roleOrCategory: 'Exterior Waterfront',
      address: '42 Harbor Way, Chennai',
      nearestHospital: 'Apollo Coastal Medical (2.1 km)',
      phone: '+91 44 5550 1122',
    });

    // Derive shooting day from canonical scenes without duplicating scenes
    const p2 = syncShootingDaysFromScreenplay(p1);
    let store = getProductionOperationalStore(p2);
    expect(store.shootingDays).toHaveLength(1);
    expect(store.shootingDays[0].sceneIds).toEqual(['scn-b01-1', 'scn-b01-2']);

    // Add CallSheet referencing shootingDay & Directory location (without duplicating address fields)
    const { updatedProject: p3, callSheet } = upsertCallSheetForDay(
      p2,
      store.shootingDays[0].id,
      {
        locationId: dockLoc.id,
        generalCallTime: '06:00',
        firstShotTime: '07:15',
        estimatedWrapTime: '18:30',
        published: true,
      }
    );
    expect(callSheet?.locationId).toBe(dockLoc.id);
    expect(callSheet?.published).toBe(true);

    // Persist DPR on same production & day
    const p4 = upsertDailyReport(p3, {
      id: `dpr-${store.shootingDays[0].id}`,
      shootingDayId: store.shootingDays[0].id,
      shootDayNumber: 1,
      calendarDate: store.shootingDays[0].date,
      callSheetId: callSheet!.id,
      generalCall: '06:00',
      firstShotTime: '07:20',
      wrapTime: '18:20',
      totalScenesScheduled: 2,
      totalScenesCompleted: 2,
      pagesScheduledEighths: 22,
      pagesCompletedEighths: 22,
      setupsCompleted: 9,
      mealOutTime: '12:30',
      mealInTime: '13:30',
      safetyIncidentsReported: 0,
      submittedBy: 'Kira Vance',
      status: 'Submitted',
    });
    store = getProductionOperationalStore(p4);
    expect(store.dailyReports).toHaveLength(1);
    expect(store.dailyReports[0].setupsCompleted).toBe(9);

    // Deleting Directory location safely clears FK without deleting ShootingDay or CallSheet
    const p5 = deleteDirectoryEntry(p4, dockLoc.id);
    store = getProductionOperationalStore(p5);
    expect(store.directoryEntries).toHaveLength(0);
    expect(store.shootingDays).toHaveLength(1);
    expect(store.callSheets).toHaveLength(1);
    expect(store.callSheets[0].locationId).toBeUndefined();
  });

  it('3. enforces strict production isolation across ProductionStore and shared Vault/Visualise media', () => {
    const projA = makeProject('proj-alpha', 'Alpha Film');
    const projB = makeProject('proj-beta', 'Beta Film');

    const { updatedProject: a1 } = createShootingDay(projA, {
      date: '2026-11-20',
      notes: 'Alpha exclusive shoot day',
    });
    const { updatedProject: a2 } = createDirectoryEntry(a1, {
      kind: 'vendor',
      name: 'Alpha Camera House',
      roleOrCategory: 'Camera Rental',
    });

    // Shared reference asset registered via Vault becomes immediately usable by Visualise
    const { updatedProject: a3, asset } = registerSharedReferenceAsset(a2, {
      originalFilename: 'vault_still.png',
      thumbnailDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      source: 'Vault Media Upload',
      tags: ['vault', 'reference'],
    });

    expect(getProductionOperationalStore(a3).shootingDays).toHaveLength(1);
    expect(getProductionOperationalStore(a3).directoryEntries).toHaveLength(1);
    expect(getProductionVisualizeStore(a3).referenceAssets).toHaveLength(1);
    expect(getProductionVisualizeStore(a3).referenceAssets[0].id).toBe(asset.id);

    // Beta stays completely empty & isolated
    expect(getProductionOperationalStore(projB).shootingDays).toHaveLength(0);
    expect(getProductionOperationalStore(projB).directoryEntries).toHaveLength(0);
    expect(getProductionVisualizeStore(projB).referenceAssets).toHaveLength(0);
  });

  it('4. renders consolidated Production (Calendar, Shoot, Directory) and Vault (Video, Audio, Images, Graphics) workspaces accurately with RBAC', () => {
    const base = makeProject();

    const prodCalendarHtml = renderToStaticMarkup(
      <ProductionWorkspace
        project={base}
        simulatedDate="2026-11-15"
        isDark={true}
        theme="dark-neon"
        activeRole="director"
        initialSubmodule="calendar"
        onSetSimulatedDate={vi.fn()}
        onAddActivity={vi.fn()}
        onAddActivityWithDetails={vi.fn()}
        onRemoveActivity={vi.fn()}
        onUpdateActivity={vi.fn()}
        onAdjustPhaseDays={vi.fn()}
        onUpdatePhase={vi.fn()}
        onMovePhaseUp={vi.fn()}
        onMovePhaseDown={vi.fn()}
        onDeletePhase={vi.fn()}
        onAddPhase={vi.fn()}
        onAddCrew={vi.fn()}
        onDeleteCrew={vi.fn()}
        onUpdateCrewStatus={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );
    expect(prodCalendarHtml).toContain('production-tab-calendar');
    expect(prodCalendarHtml).toContain('production-tab-shoot');
    expect(prodCalendarHtml).toContain('production-tab-directory');
    expect(prodCalendarHtml).toContain('calendar-view-month-btn');
    expect(prodCalendarHtml).toContain('calendar-view-week-btn');
    expect(prodCalendarHtml).toContain('calendar-view-agenda-btn');
    expect(prodCalendarHtml).toContain('calendar-phase-summaries');

    // Viewer RBAC omits write actions inside Vault
    const vaultViewerHtml = renderToStaticMarkup(
      <VaultWorkspace
        project={base}
        activeRole="viewer"
        initialCategory="images"
      />
    );
    expect(vaultViewerHtml).toContain('Read-only');
    expect(vaultViewerHtml).toContain('Video');
    expect(vaultViewerHtml).toContain('Audio');
    expect(vaultViewerHtml).toContain('Images');
    expect(vaultViewerHtml).not.toContain('data-testid="vault-cat-all"');
    expect(vaultViewerHtml).not.toContain('Upload Files');
  });
});
