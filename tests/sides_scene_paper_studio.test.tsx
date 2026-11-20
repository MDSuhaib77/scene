import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScriptSidesWorkspace } from '../src/features/breakdown/components/ScriptSidesWorkspace';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Sides Scene Paper Preparation Studio', () => {
  const mockScenes: ParsedScene[] = [
    {
      id: 'scn-1',
      sceneNumber: '1',
      heading: 'INT. DETECTIVE PRECINCT - DAY',
      slugline: 'INT. DETECTIVE PRECINCT - DAY',
      location: 'DETECTIVE PRECINCT',
      intExt: 'INT',
      timeOfDay: 'DAY',
      pageNumber: 1,
      pageCountFraction: '1 2/8',
      pageLengthEighths: 10,
      pageLengthDisplay: '1 2/8',
      characters: ['DETECTIVE BLAKE', 'SERGEANT CROSS'],
      dialogueBlocks: [
        { character: 'DETECTIVE BLAKE', text: 'Where was the ledger found?' },
        { character: 'SERGEANT CROSS', text: 'In the trunk of the Dodge.' },
      ],
      synopsis: 'Blake inspects the recovered evidence.',
    },
    {
      id: 'scn-2',
      sceneNumber: '2',
      heading: 'EXT. HARBOR DOCKS - NIGHT',
      slugline: 'EXT. HARBOR DOCKS - NIGHT',
      location: 'HARBOR DOCKS',
      intExt: 'EXT',
      timeOfDay: 'NIGHT',
      pageNumber: 3,
      pageCountFraction: '2 4/8',
      pageLengthEighths: 20,
      pageLengthDisplay: '2 4/8',
      characters: ['DETECTIVE BLAKE', 'SMUGGLER'],
      dialogueBlocks: [
        { character: 'SMUGGLER', text: 'You have no warrant here, Blake.' },
      ],
      synopsis: 'Blake confronts the smuggler at pier 4.',
    },
  ];

  const mockVersion: ScreenplayVersion = {
    id: 'ver-1',
    version: 'v1.0',
    title: 'Neon Harbor',
    rawText: `INT. DETECTIVE PRECINCT - DAY\nDETECTIVE BLAKE\nWhere was the ledger found?`,
    extractedScenes: mockScenes,
    scenes: mockScenes,
    sourceFormat: 'fountain',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProject: FilmProject = {
    id: 'proj-sides-studio-1',
    title: 'Neon Harbor',
    description: 'Noir thriller feature film.',
    scenes: mockScenes,
    screenplayVersions: [mockVersion],
    activeScreenplayVersionId: 'ver-1',
  };

  it('1. renders the Scene Paper Studio with collapsible scene selector and studio controls', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Studio Header & Controls
    expect(markup).toContain('Script Sides Preparation');
    expect(markup).toContain('Watermark: Off');
    expect(markup).not.toContain('Screenplay Window');
    expect(markup).not.toContain('Browse Screenplay');
    expect(markup).toContain('Print / Export Sides');

    // Scene Selector Rows
    expect(markup).toContain('#1');
    expect(markup).toContain('INT. DETECTIVE PRECINCT - DAY');
    expect(markup).toContain('#2');
    expect(markup).toContain('EXT. HARBOR DOCKS - NIGHT');
  });

  it('2. verifies removal of mandatory introductory masthead and forced footers', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Mandatory forced elements MUST NOT be in the document body
    expect(markup).not.toContain('END OF SIDES PACKET · CONFIDENTIAL PRODUCTION MATERIAL');
    expect(markup).not.toContain('END OF TEXT PACKET');
    expect(markup).not.toContain('CONFIDENTIAL PRODUCTION MATERIAL');
    expect(markup).not.toContain('border-b-2 border-black pb-4 text-center'); // old masthead box
  });

  it('3. isolates printing to #sides-printable-document with print stylesheet', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Isolated print styles
    expect(markup).toContain('@media print');
    expect(markup).toContain('#sides-printable-document');
    expect(markup).toContain('sides-no-print');
    expect(markup).toContain('sides-scene-page-break');
  });

  it('4. provides Add Supplementary Block action for production annotations', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Add Block trigger
    expect(markup).toContain('Add Supplementary Block');
  });

  it('5. uses restrained teal/cyan accent styling and avoids orange accents', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Cyan/Teal accents
    expect(markup).toContain('text-teal-400');
    expect(markup).toContain('bg-teal-600');

    // Ensure no bright amber/orange button styling
    expect(markup).not.toContain('bg-amber-500');
    expect(markup).not.toContain('hover:bg-amber-400');
    expect(markup).not.toContain('shadow-amber-500/20');
  });

  it('6. establishes revamped clean and spacious scene navigator with clear visual hierarchy', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Pinned header and count
    expect(markup).toContain('Scene Navigator');
    expect(markup).toContain('Select All');
    expect(markup).toContain('Clear');

    // Unified Search & Jump Bar
    expect(markup).toContain('Jump # or search slugline, cast...');

    // Filter pills and stepper navigation
    expect(markup).toContain('All (2)');
    expect(markup).toContain('Selected (1)');

    // Unmistakable active scene and selection indicators
    expect(markup).toContain('nav-scene-scn-1');
    expect(markup).toContain('nav-scene-scn-2');
    expect(markup).toContain('#1');
    expect(markup).toContain('#2');

    // Selective text block retention & omission option
    expect(markup).toContain('Omit');
  });

  it('7. verifies watermark is OFF by default, has no unwanted default text, and layers behind text', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Watermark OFF by default in toolbar
    expect(markup).toContain('Watermark: Off');

    // No unwanted default placeholder text injected in document
    expect(markup).not.toContain('HERO');
    expect(markup).not.toContain('CONFIDENTIAL SIDES');

    // Print stylesheet suppresses browser URL/date headers via zero margin and enables exact color reproduction
    expect(markup).toContain('margin: 0 !important');
    expect(markup).toContain('print-color-adjust: exact !important');
    expect(markup).toContain('.sides-scene-page');
    expect(markup).toContain('.sides-watermark-layer');
  });

  it('8. provides chatbox-style direct scene jump prompt and interactive scrubber slider', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Chatbox jump prompt
    expect(markup).toContain('What scene do you want to view?');
    expect(markup).toContain('Type scene number...');
    expect(markup).toContain('Go');

    // Scrubber slider
    expect(markup).toContain('Scrub Scenes');
    expect(markup).toContain('type="range"');
  });

  it('9. reclaims horizontal space with expansive widescreen document container and no blackout', () => {
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace project={mockProject} scenes={mockScenes} />
    );

    // Expansive widescreen document container (no narrow cramped 850px container with huge dead black voids)
    expect(markup).toContain('max-w-4xl lg:max-w-5xl');
    expect(markup).toContain('sides-printable-document');
  });
});
