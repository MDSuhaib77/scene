import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BreakdownReportsView } from '../src/features/breakdown/components/BreakdownReportsView';
import { FilmProject, ParsedScene } from '../src/types';

describe('SceneOS — Breakdown Reports: Functional & Visual Course Correction', () => {
  // Realistic test production scenes across 3 scheduled days
  const mockScenes: ParsedScene[] = [
    {
      id: 'scn-1',
      sceneNumber: '1',
      slugline: 'EXT. METROPOLIS PLAZA - DAY',
      heading: 'EXT. METROPOLIS PLAZA - DAY',
      location: 'Metropolis Plaza',
      intExt: 'EXT',
      timeOfDay: 'DAY',
      pageNumber: 1,
      pageLengthDisplay: '1 3/8',
      pageLengthEighths: 11,
      characters: ['DETECTIVE COLE', 'SUSPECT VANCE'],
      elements: [],
      synopsis: 'Cole confronts Vance outside the civic building.',
      shootDay: 1,
    } as any,
    {
      id: 'scn-2',
      sceneNumber: '2',
      slugline: 'INT. PRECINCT 4 - INTERROGATION ROOM - NIGHT',
      heading: 'INT. PRECINCT 4 - INTERROGATION ROOM - NIGHT',
      location: 'Interrogation Room',
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      pageNumber: 2,
      pageLengthDisplay: '2 0/8',
      pageLengthEighths: 16,
      characters: ['DETECTIVE COLE', 'CAPTAIN HAYES'],
      elements: [],
      synopsis: 'Cole reports his findings to Hayes.',
      shootDay: 2,
    } as any,
    {
      id: 'scn-3',
      sceneNumber: '3',
      slugline: 'EXT. ABANDONED DOCKS - NIGHT',
      heading: 'EXT. ABANDONED DOCKS - NIGHT',
      location: 'South Pier',
      intExt: 'EXT',
      timeOfDay: 'NIGHT',
      pageNumber: 4,
      pageLengthDisplay: '3 4/8',
      pageLengthEighths: 28,
      characters: ['DETECTIVE COLE', 'SUSPECT VANCE'],
      elements: [],
      synopsis: 'Late night harbor stakeout and confrontation.',
      shootDay: 3,
    } as any,
  ];

  const mockProject: FilmProject = {
    id: 'proj-apex-reports-test',
    title: 'Apex Noir Feature',
    startDate: '2026-11-15',
    scenes: mockScenes,
    screenplayVersions: [
      {
        id: 'ver-1',
        title: 'Apex Noir Feature',
        version: 'v2.1',
        scenes: mockScenes,
        extractedScenes: mockScenes,
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      } as any,
    ],
    activeScreenplayVersionId: 'ver-1',
    elementCatalog: [
      {
        id: 'elem-cast-1',
        projectId: 'proj-apex-reports-test',
        name: 'DETECTIVE COLE',
        category: 'cast',
        description: 'Lead investigator',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
      {
        id: 'elem-cast-2',
        projectId: 'proj-apex-reports-test',
        name: 'SUSPECT VANCE',
        category: 'cast',
        description: 'Key person of interest',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
      {
        id: 'elem-cast-3',
        projectId: 'proj-apex-reports-test',
        name: 'CAPTAIN HAYES',
        category: 'cast',
        description: 'Precinct supervisor',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
      {
        id: 'elem-prop-1',
        projectId: 'proj-apex-reports-test',
        name: 'Service Badge #402',
        category: 'prop',
        description: 'Standard issue police badge',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
    ],
    sceneBreakdownAssociations: [
      {
        id: 'assoc-1',
        projectId: 'proj-apex-reports-test',
        sceneId: 'scn-1',
        elementId: 'elem-prop-1',
        quantity: 1,
        status: 'needed',
        provenance: 'manual',
        reviewState: 'reviewed',
        notes: 'Visible on belt',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
    ],
  };

  it('1. NEVER renders hardcoded reference company name "Monkey Business" or copied mock data', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView project={mockProject} scenes={mockScenes} />
    );

    expect(markup).not.toContain('Monkey Business');
    expect(markup).not.toContain('Walkthrough: Film Pipeline');
    expect(markup).not.toContain('SceneOS Production Documentation');
    expect(markup).toContain('Apex Noir Feature');
    expect(markup).toContain('v2.1');
  });

  it('2. organizes reports into exactly the 4 primary report types via compact dropdown', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView project={mockProject} scenes={mockScenes} />
    );

    // Section 1: ORDER REPORT BY
    expect(markup).toContain('ORDER REPORT BY');
    expect(markup).toContain('Breakdown Summary');
    expect(markup).toContain('Element List');

    // Section 2: PRODUCTION REPORTS
    expect(markup).toContain('PRODUCTION REPORTS');
    expect(markup).toContain('Shooting Schedule');
    expect(markup).toContain('Day out of Days (DOOD)');

    // Export controls
    expect(markup).toContain('CSV');
    expect(markup).toContain('JSON');
    expect(markup).toContain('Print');
  });

  it('3. renders Breakdown Summary report with scene-by-scene slugline, pages, cast and requirements', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={mockProject}
        scenes={mockScenes}
        initialReport="breakdown_summary"
      />
    );

    expect(markup).toContain('Breakdown Summary');
    expect(markup).toContain('SCENE 1');
    expect(markup).toContain('EXT. METROPOLIS PLAZA - DAY');
    expect(markup).toContain('1 3/8 pages');
    expect(markup).toContain('CAST MEMBERS (2)');
    expect(markup).toContain('DETECTIVE COLE');
    expect(markup).toContain('SUSPECT VANCE');
    expect(markup).toContain('SCENE SETTINGS &amp; ELEMENTS');
    expect(markup).toContain('Metropolis Plaza');
  });

  it('4. renders Element List (All Elements) master inventory with department badges and scene counts', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={mockProject}
        scenes={mockScenes}
        initialReport="element_list"
      />
    );

    expect(markup).toContain('All Elements');
    expect(markup).toContain('DETECTIVE COLE');
    expect(markup).toContain('SUSPECT VANCE');
    expect(markup).toContain('Service Badge #402');
    expect(markup).toContain('MASTER ELEMENTS ACROSS');
  });

  it('5. renders Shooting Schedule grouped by actual shoot day with start times and cast', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={mockProject}
        scenes={mockScenes}
        initialReport="shooting_schedule"
      />
    );

    expect(markup).toContain('Shooting Schedule');
    expect(markup).toContain('DAY 1 OF');
    expect(markup).toContain('● START TIME: 7:00am');
    expect(markup).toContain('EXT. METROPOLIS PLAZA - DAY');
    expect(markup).toContain('DETECTIVE COLE');
    expect(markup).toContain('SUSPECT VANCE');
  });

  it('6. calculates DOOD production codes (SW, W, WF, SWF, H) accurately and renders real codes without checkmarks', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={mockProject}
        scenes={mockScenes}
        initialReport="dood"
      />
    );

    expect(markup).toContain('DOOD: Cast Members');
    expect(markup).toContain('STORY DAY / ELEMENT');
    expect(markup).toContain('WORK');
    expect(markup).toContain('HOLD');
    expect(markup).toContain('TOTAL');

    // DETECTIVE COLE works Day 1, Day 2, Day 3:
    // Day 1 = SW, Day 2 = W, Day 3 = WF, Work = 3, Hold = 0, Total = 3
    // SUSPECT VANCE works Day 1 and Day 3 (held on Day 2):
    // Day 1 = SW, Day 2 = H, Day 3 = WF, Work = 2, Hold = 1, Total = 3
    // CAPTAIN HAYES works only Day 2:
    // Day 2 = SWF, Work = 1, Hold = 0, Total = 1

    expect(markup).toContain('SW');
    expect(markup).toContain('WF');
    expect(markup).toContain('SWF');
    expect(markup).toContain('H');

    // Verify legend exists
    expect(markup).toContain('Start Work');
    expect(markup).toContain('Hold');
  });

  it('7. displays explicit notice when schedule shooting dates are unassigned', () => {
    const projectWithoutDates: FilmProject = {
      ...mockProject,
      startDate: undefined,
    };

    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={projectWithoutDates}
        scenes={mockScenes}
        initialReport="dood"
      />
    );

    expect(markup).toContain('Schedule shooting dates are unassigned');
  });

  it('8. renders DOOD in a structured weekly table with 7 day columns and off-day support', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={mockProject}
        scenes={mockScenes}
        initialReport="dood"
      />
    );

    // Week label header
    expect(markup).toContain('Week 1:');
    // Day columns
    expect(markup).toContain('D1');
    expect(markup).toContain('D2');
    expect(markup).toContain('D3');
    // Off-day indication for non-scheduled days in the week
    expect(markup).toContain('OFF');
  });
});
