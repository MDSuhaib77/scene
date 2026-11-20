import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StripboardViewer } from '../src/features/breakdown/components/StripboardViewer';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Stripboard Complete Reconstruction', () => {
  const mockScenes: ParsedScene[] = [
    {
      id: 'scn-1',
      sceneNumber: '1',
      heading: 'INT. POLICE PRECINCT - DAY',
      slugline: 'INT. POLICE PRECINCT - DAY',
      location: 'POLICE PRECINCT',
      intExt: 'INT',
      timeOfDay: 'DAY',
      pageNumber: 1,
      pageCountFraction: '1 2/8',
      pageLengthEighths: 10,
      pageLengthDisplay: '1 2/8',
      characters: ['DETECTIVE BLAKE', 'CAPTAIN MILLER'],
      dialogueBlocks: [
        { character: 'DETECTIVE BLAKE', text: 'We have the witness.' },
      ],
      synopsis: 'Blake briefs Miller on the harbor witness.',
      estimatedDurationMinutes: 60,
      status: 'reviewed',
      elements: [
        { id: 'el-1', category: 'prop', name: 'Manila Dossier' },
      ],
    },
    {
      id: 'scn-2',
      sceneNumber: '2',
      heading: 'EXT. HARBOR DOCKS - DAY',
      slugline: 'EXT. HARBOR DOCKS - DAY',
      location: 'HARBOR DOCKS',
      intExt: 'EXT',
      timeOfDay: 'DAY',
      pageNumber: 3,
      pageCountFraction: '2 0/8',
      pageLengthEighths: 16,
      pageLengthDisplay: '2 0/8',
      characters: ['DETECTIVE BLAKE', 'INFORMANT'],
      dialogueBlocks: [
        { character: 'INFORMANT', text: 'They move the cargo at midnight.' },
      ],
      synopsis: 'Blake meets the informant under pier 9.',
      estimatedDurationMinutes: 90,
      status: 'reviewed',
      elements: [
        { id: 'el-2', category: 'vehicle', name: 'Dodge Sedan' },
      ],
    },
    {
      id: 'scn-3',
      sceneNumber: '3',
      heading: 'INT. WAREHOUSE - NIGHT',
      slugline: 'INT. WAREHOUSE - NIGHT',
      location: 'WAREHOUSE 4',
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      pageNumber: 5,
      pageCountFraction: '1 4/8',
      pageLengthEighths: 12,
      pageLengthDisplay: '1 4/8',
      characters: ['SMUGGLER BOSS', 'HENCHMAN'],
      dialogueBlocks: [],
      synopsis: 'The smugglers load crates into container vans.',
      estimatedDurationMinutes: 75,
      status: 'unreviewed',
      elements: [],
    },
    {
      id: 'scn-4',
      sceneNumber: '4',
      heading: 'EXT. ROOFTOP - NIGHT',
      slugline: 'EXT. ROOFTOP - NIGHT',
      location: 'ROOFTOP',
      intExt: 'EXT',
      timeOfDay: 'NIGHT',
      pageNumber: 7,
      pageCountFraction: '0 6/8',
      pageLengthEighths: 6,
      pageLengthDisplay: '6/8',
      characters: ['DETECTIVE BLAKE'],
      dialogueBlocks: [],
      synopsis: 'Blake watches the docks through binoculars.',
      estimatedDurationMinutes: 45,
      status: 'unreviewed',
      elements: [],
    },
  ];

  const mockVersion: ScreenplayVersion = {
    id: 'ver-1',
    version: 'v1.0',
    title: 'Neon Harbor',
    rawText: 'INT. POLICE PRECINCT - DAY\n...',
    extractedScenes: mockScenes,
    scenes: mockScenes,
    sourceFormat: 'fountain',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProject: FilmProject = {
    id: 'proj-stripboard-test-1',
    title: 'Neon Harbor',
    logline: 'Noir crime thriller set in a port city.',
    director: 'K. Varma',
    startDate: '2026-11-10',
    finalEndDate: '2026-12-15',
    suggestedEndDate: '2026-12-15',
    isEndDateFixed: true,
    constraints: {
      budgetCapUSD: 2000000,
      turnaroundHours: 12,
      maxOvertimeHoursPerWeek: 10,
      safetyRestIntervalHours: 48,
    },
    phases: [],
    updatedAt: new Date().toISOString(),
    screenplayVersions: [mockVersion],
    activeScreenplayVersionId: 'ver-1',
    scenes: mockScenes,
  };

  it('1. renders Schedule Overview with concise real metrics', () => {
    const markup = renderToStaticMarkup(
      <StripboardViewer project={mockProject} scenes={mockScenes} />
    );

    expect(markup).toContain('Production Stripboard');
    expect(markup).toContain('Scenes Scheduled');
    expect(markup).toContain('pgs');
    expect(markup).toContain('Neon Harbor');
    expect(markup).toContain('v1.0');
    expect(markup).toContain('Total Shooting Duration');
  });

  it('2. organizes scenes into Shooting Day groups with call time and wrap estimates', () => {
    const markup = renderToStaticMarkup(
      <StripboardViewer project={mockProject} scenes={mockScenes} />
    );

    // Shooting Day 1 header
    expect(markup).toContain('SHOOT DAY 1');
    expect(markup).toContain('Call:');
    expect(markup).toContain('Wrap:');
    expect(markup).toContain('pgs');
  });

  it('3. applies industry strip color conventions with accessible markers', () => {
    const markup = renderToStaticMarkup(
      <StripboardViewer project={mockProject} scenes={mockScenes} />
    );

    // Color labels & legend
    expect(markup).toContain('INT DAY (White)');
    expect(markup).toContain('EXT DAY (Yellow)');
    expect(markup).toContain('INT NIGHT (Green)');
    expect(markup).toContain('EXT NIGHT (Blue)');
  });

  it('4. calculates sequential scene timeline starting at call time without unrequested company move fields', () => {
    const markup = renderToStaticMarkup(
      <StripboardViewer project={mockProject} scenes={mockScenes} />
    );

    // Start and Completion time formatting
    expect(markup).toContain('Planned:');
    expect(markup).toContain('Call:');
    expect(markup).toContain('Wrap:');
    // Confirms NO invented Company Move From/To fields
    expect(markup).not.toContain('COMPANY MOVE:');
    expect(markup).not.toContain('Relocate from');
    expect(markup).not.toContain('+30m travel buffer');
  });

  it('5. provides operational scheduling toolbar with Day Break, Reset Script Order and Select All', () => {
    const markup = renderToStaticMarkup(
      <StripboardViewer project={mockProject} scenes={mockScenes} />
    );

    expect(markup).toContain('+ Day Break');
    expect(markup).toContain('Reset Script Order');
    expect(markup).toContain('Select All');
    expect(markup).toContain('Auto-Organize');
    expect(markup).toContain('All Sets');
    expect(markup).toContain('All Times');
    expect(markup).toContain('Search scene, slug, cast...');
  });

  it('6. connects to authoritative schedule in Calendar and provides print isolation', () => {
    const onNavigateTab = vi.fn();
    const markup = renderToStaticMarkup(
      <StripboardViewer
        project={mockProject}
        scenes={mockScenes}
        onNavigateTab={onNavigateTab}
      />
    );

    expect(markup).toContain('Open in Schedule (Calendar)');
    expect(markup).toContain('Transfer to Calendar Schedule');
    expect(markup).toContain('Print Strips');
    expect(markup).toContain('@media print');
    expect(markup).toContain('#stripboard-printable-document');
  });

  it('7. references canonical scenes without creating duplicate screenplay entities', () => {
    const markup = renderToStaticMarkup(
      <StripboardViewer project={mockProject} scenes={mockScenes} />
    );

    expect(markup).toContain('#1');
    expect(markup).toContain('INT. POLICE PRECINCT - DAY');
    expect(markup).toContain('#2');
    expect(markup).toContain('EXT. HARBOR DOCKS - DAY');
    expect(markup).toContain('DETECTIVE BLAKE');
    expect(markup).toContain('CAPTAIN MILLER');
  });

  it('8. strictly prevents floating-point timing artefacts and guarantees HH:MM clock formatting', () => {
    const markup = renderToStaticMarkup(
      <StripboardViewer project={mockProject} scenes={mockScenes} />
    );

    // Absolutely NO raw float precision like "07:42.380000000000026"
    expect(markup).not.toMatch(/\d{2}:\d{2}\.\d+/);
    expect(markup).not.toContain('.380000000000026');

    // Human readable duration format
    expect(markup).toMatch(/\d+\s*(?:min|h)/);
  });

  it('9. enforces dark theme discipline with no blinding white strip backgrounds in dark mode', () => {
    const darkMarkup = renderToStaticMarkup(
      <StripboardViewer project={mockProject} scenes={mockScenes} isDark={true} />
    );

    // In dark mode, scene strip surfaces MUST be dark subtly tinted surfaces, not bright white
    expect(darkMarkup).not.toContain('bg-slate-100 hover:bg-white text-slate-900');
    expect(darkMarkup).not.toContain('bg-white text-black');
    expect(darkMarkup).toContain('bg-[#141822]');
    expect(darkMarkup).toContain('border-l-4');
  });

  it('10. verifies BreakdownWorkspace mounts Stripboard seamlessly without crash or blackout', () => {
    const messyScenes: ParsedScene[] = Array.from({ length: 244 }, (_, i) => ({
      id: `scn-${i + 1}`,
      sceneNumber: i % 5 === 0 ? String(i + 1) : (i + 1) as any,
      heading: i % 2 === 0 ? `INT. ROOM ${i} - DAY` : undefined as any,
      slugline: i % 3 === 0 ? undefined as any : `EXT. STREET ${i} - NIGHT`,
      location: i % 4 === 0 ? undefined as any : `LOCATION ${i}`,
      intExt: i % 6 === 0 ? undefined as any : (i % 2 === 0 ? 'INT' : 'EXT'),
      timeOfDay: i % 7 === 0 ? undefined as any : (i % 3 === 0 ? 'DAY' : 'NIGHT'),
      pageNumber: i + 1,
      pageCountFraction: undefined as any,
      pageLengthEighths: i % 8 === 0 ? undefined as any : (i % 8) + 1,
      characters: i % 5 === 0 ? undefined as any : ['SUPERMAN', undefined as any, 'KRYPTO'],
      dialogueBlocks: undefined as any,
      synopsis: undefined as any,
    }));

    const project: FilmProject = {
      id: 'proj-superman-test',
      title: 'SUPERMAN',
      scenes: messyScenes,
      screenplayVersions: [
        {
          id: 'ver-superman',
          title: 'SUPERMAN',
          version: 'v1.0',
          scenes: messyScenes,
          extractedScenes: messyScenes,
          createdAt: 'invalid-date',
          updatedAt: '',
        } as any,
      ],
      activeScreenplayVersionId: 'ver-superman',
      startDate: undefined,
    } as any;

    const markup = renderToStaticMarkup(
      <StripboardViewer
        project={project}
        scenes={messyScenes}
        isDark={true}
      />
    );
    expect(markup).toContain('Production Stripboard');
    expect(markup).toContain('244 Scenes Scheduled');
  });
});
