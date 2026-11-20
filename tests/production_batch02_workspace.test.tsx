import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { FilmProject, ScreenplayVersion } from '../src/types';
import {
  assignSceneToShootingDay,
  createDirectoryEntry,
  createProductionEvent,
  createShootingDay,
  deleteProductionEvent,
  detectDateConflicts,
  getCumulativeDprProgress,
  getDailyCalendarLog,
  getEventPhaseCategory,
  getPhaseCategoryForDate,
  getProductionOperationalStore,
  getProjectScheduleSpan,
  reconcileShootingDaysFromStripboard,
  setProductionPhaseCategoryDates,
  toggleArchiveDirectoryEntry,
  unassignSceneFromShootingDay,
  updateDirectoryEntry,
  updateProductionEvent,
  upsertCallSheetForDay,
  upsertDailyCalendarLog,
  upsertDailyReport,
} from '../src/features/production/services/productionStoreService';
import {
  buildCallSheetPdfBytes,
  buildDprPdfBytes,
} from '../src/features/production/services/productionPdfService';
import { ProductionWorkspace } from '../src/features/production/components/ProductionWorkspace';

describe('SceneOS — Production Workspace · Batch 02 (Calendar, Shoot & Directory)', () => {
  const realScript: ScreenplayVersion = {
    id: 'ver-b02-1',
    version: 'v1.0',
    title: 'Breakwater Horizon',
    author: 'Writer',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    status: 'Draft',
    changeDescription: 'Initial draft',
    rawText: 'INT. HARBOR OBSERVATORY - DAWN',
    documentJson: '{}',
    scenes: [
      {
        id: 'sc-1',
        sceneNumber: '1',
        slugline: 'INT. HARBOR OBSERVATORY - DAWN',
        intExt: 'INT',
        location: 'HARBOR OBSERVATORY',
        timeOfDay: 'DAWN',
        synopsis: 'Instruments align before first light.',
        pageLengthEighths: 10,
        pageLengthDisplay: '1 2/8',
        startPage: 1,
        estimatedDurationMinutes: 40,
        characters: ['KARA'],
        elements: [],
        status: 'Unchecked',
        shootDay: 1,
      } as any,
      {
        id: 'sc-2',
        sceneNumber: '2',
        slugline: 'EXT. BREAKWATER PIER - DAY',
        intExt: 'EXT',
        location: 'BREAKWATER PIER',
        timeOfDay: 'DAY',
        synopsis: 'Buoy bell clears the fog.',
        pageLengthEighths: 12,
        pageLengthDisplay: '1 4/8',
        startPage: 2,
        estimatedDurationMinutes: 55,
        characters: ['KARA', 'DARIUS'],
        elements: [],
        status: 'Unchecked',
        shootDay: 2,
      } as any,
    ],
  };

  const makeProject = (id = 'proj-b02-alpha', title = 'Breakwater Horizon'): FilmProject => ({
    id,
    title,
    logline: 'Maritime observatory mystery',
    director: 'Kira Vance',
    producer: 'Elena Rostova',
    startDate: '2026-06-01',
    finalEndDate: '2026-07-01',
    suggestedEndDate: '2026-07-01',
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
    phases: [
      {
        id: 'ph-pre',
        name: 'Prep & Scouting',
        category: 'pre',
        color: 'bg-cyan-500',
        textLightColor: 'text-cyan-400',
        textDarkColor: 'text-cyan-900',
        durationDays: 14,
        startDate: '2026-06-01',
        endDate: '2026-06-14',
        activities: [
          {
            id: 'act-1',
            name: 'Finalize Harbor Permit',
            completed: false,
            estimatedDays: 3,
            startDate: '2026-06-02',
            endDate: '2026-06-05',
            assignedTo: 'Ananya Rao',
            priority: 'high',
          },
        ],
        crew: [],
        status: 'active',
      },
    ],
    updatedAt: '2026-11-10T10:00:00Z',
    screenplayVersions: [realScript],
    footageBackups: [],
  });

  it('1. reconciles Stripboard day assignments with Shoot Days and supports scene reassignment without duplicates', () => {
    let proj = makeProject();
    proj = reconcileShootingDaysFromStripboard(proj, realScript.scenes || [], {
      1: { date: '2026-06-10', callTime: '05:45' },
      2: { date: '2026-06-11', callTime: '07:00' },
    });

    let store = getProductionOperationalStore(proj);
    expect(store.shootingDays).toHaveLength(2);
    expect(store.shootingDays[0].date).toBe('2026-06-10');
    expect(store.shootingDays[0].callTime).toBe('05:45');
    expect(store.shootingDays[0].sceneIds).toEqual(['sc-1']);
    expect(store.shootingDays[1].sceneIds).toEqual(['sc-2']);

    // Reassign sc-2 into Day 1 -> sc-2 moves cleanly out of Day 2 without duplicating across days
    const day1Id = store.shootingDays[0].id;
    proj = assignSceneToShootingDay(proj, day1Id, 'sc-2');
    store = getProductionOperationalStore(proj);
    expect(store.shootingDays[0].sceneIds).toEqual(['sc-1', 'sc-2']);
    expect(store.shootingDays[1].sceneIds).toEqual([]);

    // Unassign sc-2 from Day 1
    proj = unassignSceneFromShootingDay(proj, day1Id, 'sc-2');
    store = getProductionOperationalStore(proj);
    expect(store.shootingDays[0].sceneIds).toEqual(['sc-1']);
  });

  it('2. manages Production Events & Milestones inside active production cleanly', () => {
    let proj = makeProject();
    const { updatedProject: p1, event: ev } = createProductionEvent(proj, {
      title: 'Pier Tech Scout',
      date: '2026-06-03',
      time: '08:30',
      category: 'tech-scout',
    });
    proj = p1;
    expect(getProductionOperationalStore(proj).events).toHaveLength(1);

    proj = updateProductionEvent(proj, ev.id, { completed: true });
    expect(getProductionOperationalStore(proj).events[0].completed).toBe(true);

    // Cross-production leakage test
    const otherProj = makeProject('proj-b02-beta', 'Other Film');
    expect(getProductionOperationalStore(otherProj).events).toHaveLength(0);

    proj = deleteProductionEvent(proj, ev.id);
    expect(getProductionOperationalStore(proj).events).toHaveLength(0);
  });

  it('3. supports unified Directory multi-role persons, editing, archiving, vendors & Call Sheet linkage', () => {
    let proj = makeProject();
    const locRes = createDirectoryEntry(proj, {
      kind: 'location',
      name: 'Breakwater Harbor Pier',
      roleOrCategory: 'Exterior Dock',
      address: 'Dock 4B, Old Harbor',
      parkingNotes: 'North Gate after 05:00',
      nearestHospital: 'Mercy Coastal Trauma',
      phone: '+91 98200 11223',
    });
    proj = locRes.updatedProject;

    const crewRes = createDirectoryEntry(proj, {
      kind: 'crew',
      name: 'Rohan Nair',
      roleOrCategory: 'Gaffer',
      secondaryRoles: ['2nd Unit Camera Operator'],
      department: 'Lighting & Camera',
      phone: '+91 99111 22334',
    });
    proj = crewRes.updatedProject;

    const vendorRes = createDirectoryEntry(proj, {
      kind: 'vendor',
      name: 'OpticLab Grip',
      roleOrCategory: 'Camera House',
      services: 'Alexa 35 & Underwater Housing',
    });
    proj = vendorRes.updatedProject;

    // Update unified person record with edited phone — zero duplicate created
    proj = updateDirectoryEntry(proj, crewRes.entry.id, {
      phone: '+91 99111 99999',
    });
    const store1 = getProductionOperationalStore(proj);
    expect(store1.directoryEntries).toHaveLength(3);
    const updatedRohan = store1.directoryEntries.find((e) => e.id === crewRes.entry.id);
    expect(updatedRohan?.secondaryRoles).toEqual(['2nd Unit Camera Operator']);
    expect(updatedRohan?.phone).toBe('+91 99111 99999');

    // Archive & restore Vendor safely without deleting record
    proj = toggleArchiveDirectoryEntry(proj, vendorRes.entry.id, true);
    expect(
      getProductionOperationalStore(proj).directoryEntries.find(
        (e) => e.id === vendorRes.entry.id
      )?.archived
    ).toBe(true);
    proj = toggleArchiveDirectoryEntry(proj, vendorRes.entry.id, false);
    expect(
      getProductionOperationalStore(proj).directoryEntries.find(
        (e) => e.id === vendorRes.entry.id
      )?.archived
    ).toBe(false);

    // Create Shooting Day + Call Sheet linked to Directory location & person + DPR
    const dayRes = createShootingDay(proj, {
      date: '2026-06-10',
      sceneIds: ['sc-1'],
      locationId: locRes.entry.id,
    });
    proj = dayRes.updatedProject;

    const csRes = upsertCallSheetForDay(proj, dayRes.day.id, {
      locationId: locRes.entry.id,
      directoryEntryIds: [crewRes.entry.id],
      callTimeOverrides: { [crewRes.entry.id]: '05:45' },
      parkingNotes: 'Dock Gate B',
      published: true,
    });
    proj = csRes.updatedProject;

    const cs = getProductionOperationalStore(proj).callSheets[0];
    expect(cs.published).toBe(true);
    expect(cs.publishedAt).toBeTruthy();
    expect(cs.directoryEntryIds).toEqual([crewRes.entry.id]);
    expect(cs.callTimeOverrides?.[crewRes.entry.id]).toBe('05:45');

    proj = upsertDailyReport(proj, {
      id: `dpr-${dayRes.day.id}`,
      shootingDayId: dayRes.day.id,
      shootDayNumber: dayRes.day.dayNumber,
      calendarDate: dayRes.day.date,
      generalCall: '06:30',
      firstShotTime: '07:40',
      wrapTime: '18:20',
      totalScenesScheduled: 1,
      totalScenesCompleted: 1,
      scenesCompletedIds: ['sc-1'],
      pagesScheduledEighths: 10,
      pagesCompletedEighths: 10,
      setupsCompleted: 9,
      mealOutTime: '12:30',
      mealInTime: '13:30',
      safetyIncidentsReported: 0,
      submittedBy: 'Marcus Thorne',
      status: 'Submitted',
    });
    expect(getProductionOperationalStore(proj).dailyReports[0].scenesCompletedIds).toEqual([
      'sc-1',
    ]);
  });

  it('4. renders Calendar, Shoot & Directory views with Viewer read-only enforcement', () => {
    let proj = makeProject();
    const { updatedProject } = createDirectoryEntry(proj, {
      kind: 'cast',
      name: 'KARA',
      roleOrCategory: 'Lead Role',
      secondaryRoles: ['Voiceover'],
    });
    proj = updatedProject;
    const { updatedProject: pDay } = createShootingDay(proj, {
      date: '2026-06-10',
      sceneIds: ['sc-1'],
    });
    proj = pDay;

    const noop = () => {};
    const viewerHtml = renderToString(
      <ProductionWorkspace
        project={proj}
        simulatedDate="2026-06-02"
        isDark={true}
        theme="dark-neon"
        activeRole="viewer"
        initialSubmodule="calendar"
        onSetSimulatedDate={noop}
        onAddActivity={noop}
        onAddActivityWithDetails={noop}
        onRemoveActivity={noop}
        onUpdateActivity={noop}
        onAdjustPhaseDays={noop}
        onUpdatePhase={noop}
        onMovePhaseUp={noop}
        onMovePhaseDown={noop}
        onDeletePhase={noop}
        onAddPhase={noop}
        onAddCrew={noop}
        onDeleteCrew={noop}
        onUpdateCrewStatus={noop}
        onNavigateTab={noop}
      />
    );
    expect(viewerHtml).toContain('Read-only');
    expect(viewerHtml).toContain('calendar-view-month-btn');
    expect(viewerHtml).toContain('calendar-view-agenda-btn');
    expect(viewerHtml).not.toContain('calendar-toggle-add-event-btn');

    const directoryHtml = renderToString(
      <ProductionWorkspace
        project={proj}
        simulatedDate="2026-06-02"
        isDark={true}
        theme="dark-neon"
        activeRole="producer"
        initialSubmodule="directory"
        onSetSimulatedDate={noop}
        onAddActivity={noop}
        onAddActivityWithDetails={noop}
        onRemoveActivity={noop}
        onUpdateActivity={noop}
        onAdjustPhaseDays={noop}
        onUpdatePhase={noop}
        onMovePhaseUp={noop}
        onMovePhaseDown={noop}
        onDeletePhase={noop}
        onAddPhase={noop}
        onAddCrew={noop}
        onDeleteCrew={noop}
        onUpdateCrewStatus={noop}
        onNavigateTab={noop}
      />
    );
    expect(directoryHtml).toContain('KARA');
    expect(directoryHtml).toContain('Voiceover');
    expect(directoryHtml).toContain('SC');
  });

  it('5. supports daily logs, conflicts, Call Sheet location-clearing/revisions, DPR progress & native multi-page PDF generation', () => {
    let proj = makeProject();
    const loc = createDirectoryEntry(proj, {
      kind: 'location',
      name: 'Observatory Dome',
      roleOrCategory: 'Primary Set',
      address: '100 Coast Rd',
      nearestHospital: 'Bay Medical',
    });
    proj = loc.updatedProject;

    const crew = createDirectoryEntry(proj, {
      kind: 'crew',
      name: 'Samir Patel',
      roleOrCategory: '1st AC',
      department: 'Camera',
      phone: '+91 90000 12345',
    });
    proj = crew.updatedProject;

    const d1 = createShootingDay(proj, { date: '2026-06-15', sceneIds: ['sc-1'], locationId: loc.entry.id });
    proj = d1.updatedProject;
    const d2 = createShootingDay(proj, { date: '2026-06-15', sceneIds: ['sc-2'], locationId: loc.entry.id });
    proj = d2.updatedProject;

    proj = upsertDailyCalendarLog(proj, '2026-06-15', {
      status: 'Delayed',
      notes: 'Sea fog morning alert',
      reminders: 'Bring rain covers',
    });

    const store = getProductionOperationalStore(proj);
    expect(getDailyCalendarLog(store, '2026-06-15')?.status).toBe('Delayed');
    const span = getProjectScheduleSpan(proj, store);
    expect(span.startDate).toBe('2026-06-01');
    expect(span.shootWindowStart).toBe('2026-06-15');
    const conflicts = detectDateConflicts('2026-06-15', proj, store, '2026-06-10');
    expect(conflicts.some((c) => c.severity === 'conflict')).toBe(true);

    // Call sheet revision bump + explicit location clearing
    const cs1 = upsertCallSheetForDay(proj, d1.day.id, {
      locationId: loc.entry.id,
      directoryEntryIds: [crew.entry.id],
      published: true,
    });
    proj = cs1.updatedProject;
    const cs2 = upsertCallSheetForDay(proj, d1.day.id, {
      locationId: undefined,
      bumpRevision: true,
    });
    proj = cs2.updatedProject;
    const finalCs = getProductionOperationalStore(proj).callSheets[0];
    expect(finalCs.revisionNumber).toBe(2);
    expect(finalCs.locationId).toBeUndefined();

    // DPR submitted marks ShootingDay completed without overwriting original sceneIds
    proj = upsertDailyReport(proj, {
      id: `dpr-${d1.day.id}`,
      shootingDayId: d1.day.id,
      shootDayNumber: 1,
      calendarDate: '2026-06-15',
      generalCall: '06:45',
      firstShotTime: '07:50',
      wrapTime: '18:10',
      totalScenesScheduled: 1,
      totalScenesCompleted: 1,
      sceneResults: [
        {
          sceneId: 'sc-1',
          sceneNumber: '1',
          slugline: 'INT. HARBOR OBSERVATORY - DAWN',
          result: 'Completed',
          plannedEighths: 10,
          completedEighths: 10,
        },
      ],
      pagesScheduledEighths: 10,
      pagesCompletedEighths: 10,
      setupsCompleted: 11,
      mealOutTime: '12:30',
      mealInTime: '13:30',
      submittedBy: 'Kira Vance',
      status: 'Submitted',
    });

    const storeAfterDpr = getProductionOperationalStore(proj);
    expect(storeAfterDpr.shootingDays[0].status).toBe('completed');
    expect(storeAfterDpr.shootingDays[0].sceneIds).toEqual(['sc-1']);
    const cum = getCumulativeDprProgress(storeAfterDpr, realScript.scenes || []);
    expect(cum.completedSceneIds).toEqual(['sc-1']);
    expect(cum.completedEighths).toBe(10);

    // Real binary PDF output checks (multi-row Crew/Cast tables -> valid PDF header & content)
    const csBytes = buildCallSheetPdfBytes({
      project: proj,
      day: storeAfterDpr.shootingDays[0],
      callSheet: finalCs,
      location: loc.entry,
      scenes: realScript.scenes || [],
      crewRows: Array.from({ length: 42 }, (_, idx) => ({
        department: 'Camera',
        role: `Technician ${idx + 1}`,
        name: `Crew Member ${idx + 1}`,
        phone: '+91 98000 00000',
        callTime: '06:30',
      })),
      totalShootDays: 2,
      nextShootDay: storeAfterDpr.shootingDays[1],
    });
    const csText = new TextDecoder().decode(csBytes);
    expect(csText.startsWith('%PDF-1.4')).toBe(true);
    expect(csText).toContain('CALL SHEET');
    expect(csText).toContain('Page 1 of 2');
    expect(csText).toContain('Page 2 of 2');

    const dprBytes = buildDprPdfBytes({
      project: proj,
      day: storeAfterDpr.shootingDays[0],
      dpr: storeAfterDpr.dailyReports[0],
      callSheet: finalCs,
      location: loc.entry,
      cumulative: cum,
      totalShootDays: 2,
    });
    const dprText = new TextDecoder().decode(dprBytes);
    expect(dprText.startsWith('%PDF-1.4')).toBe(true);
    expect(dprText).toContain('DAILY PRODUCTION REPORT');
    expect(dprText).toContain('Page 1 of 1');
  });

  it('6. edits, extends and shortens Pre/Prod/Post phase dates without losing events, tasks or logs', () => {
    // Start with empty phases (as newly created wizard projects do)
    let proj: FilmProject = {
      ...makeProject(),
      isEndDateFixed: false,
      phases: [],
    };
    // Add existing shooting day, event, and daily log
    const dayRes = createShootingDay(proj, { date: '2026-06-12', sceneIds: ['sc-1'] });
    proj = dayRes.updatedProject;
    const evRes = createProductionEvent(proj, {
      title: 'Location Permit Deadline',
      date: '2026-06-05',
      category: 'milestone',
    });
    proj = evRes.updatedProject;
    proj = upsertDailyCalendarLog(proj, '2026-06-12', {
      status: 'In Progress',
      notes: 'Basecamp generator arrives 05:30',
      reminders: 'Confirm harbor gate code',
    });

    // 1. Set Pre, Prod, and Post date windows
    proj = setProductionPhaseCategoryDates(proj, 'pre', '2026-06-01', '2026-06-10');
    proj = setProductionPhaseCategoryDates(proj, 'prod', '2026-06-11', '2026-06-16');
    proj = setProductionPhaseCategoryDates(proj, 'post', '2026-06-17', '2026-06-25');

    // Add a task on the newly created Pre phase
    proj = {
      ...proj,
      phases: proj.phases.map((p) =>
        p.category === 'pre'
          ? {
              ...p,
              activities: [
                {
                  id: 'act-keep-1',
                  name: 'Finalize Lock-Off Permits',
                  completed: false,
                  estimatedDays: 1,
                  startDate: '2026-06-04',
                  endDate: '2026-06-04',
                },
              ],
            }
          : p
      ),
    };

    expect(getPhaseCategoryForDate(proj, '2026-06-05')).toBe('pre');
    expect(getPhaseCategoryForDate(proj, '2026-06-12')).toBe('prod');
    expect(getPhaseCategoryForDate(proj, '2026-06-20')).toBe('post');
    expect(getPhaseCategoryForDate(proj, '2026-07-01')).toBeNull();
    expect(getEventPhaseCategory(proj, evRes.event)).toBe('pre');

    // 2. Extend Production phase / shooting schedule by 4 days & extend Post
    proj = setProductionPhaseCategoryDates(proj, 'prod', '2026-06-11', '2026-06-20');
    proj = setProductionPhaseCategoryDates(proj, 'post', '2026-06-21', '2026-06-30');
    let span = getProjectScheduleSpan(proj, getProductionOperationalStore(proj));
    expect(span.prodWindow.end).toBe('2026-06-20');
    expect(span.prodWindow.durationDays).toBe(10);
    expect(span.shootWindowEnd).toBe('2026-06-20');
    expect(span.endDate).toBe('2026-06-30');
    expect(getPhaseCategoryForDate(proj, '2026-06-19')).toBe('prod');

    // 3. Shorten Post-Production phase
    proj = setProductionPhaseCategoryDates(proj, 'post', '2026-06-21', '2026-06-26');
    span = getProjectScheduleSpan(proj, getProductionOperationalStore(proj));
    expect(span.postWindow.end).toBe('2026-06-26');
    expect(span.endDate).toBe('2026-06-26');

    // 4. Verify existing events, tasks, shooting days, and daily logs were NEVER lost
    const store = getProductionOperationalStore(proj);
    expect(store.shootingDays.map((d) => d.id)).toEqual([dayRes.day.id]);
    expect(store.events.map((e) => e.id)).toEqual([evRes.event.id]);
    expect(getDailyCalendarLog(store, '2026-06-12')?.notes).toBe('Basecamp generator arrives 05:30');
    expect(proj.phases.find((p) => p.category === 'pre')?.activities.map((a) => a.id)).toEqual([
      'act-keep-1',
    ]);

    // 5. Render check for visual legend and editable phase date inputs
    const noop = () => {};
    const html = renderToString(
      <ProductionWorkspace
        project={proj}
        simulatedDate="2026-06-12"
        isDark={true}
        theme="dark-neon"
        activeRole="producer"
        initialSubmodule="calendar"
        onSetSimulatedDate={noop}
        onAddActivity={noop}
        onAddActivityWithDetails={noop}
        onRemoveActivity={noop}
        onUpdateActivity={noop}
        onAdjustPhaseDays={noop}
        onUpdatePhase={noop}
        onMovePhaseUp={noop}
        onMovePhaseDown={noop}
        onDeletePhase={noop}
        onAddPhase={noop}
        onAddCrew={noop}
        onDeleteCrew={noop}
        onUpdateCrewStatus={noop}
        onNavigateTab={noop}
      />
    );
    expect(html).toContain('calendar-phase-legend');
    expect(html).toContain('phase-pre-start-input');
    expect(html).toContain('phase-prod-end-input');
    expect(html).toContain('phase-post-end-input');
  });
});
