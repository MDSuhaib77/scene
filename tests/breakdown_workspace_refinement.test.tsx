import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BreakdownWorkspace } from '../src/features/breakdown/BreakdownWorkspace';
import { CharacterConstellation } from '../src/features/breakdown/components/CharacterConstellation';
import { BreakdownReportsView } from '../src/features/breakdown/components/BreakdownReportsView';
import { ScriptIntelligenceWorkspace } from '../src/features/screenplay/components/ScriptIntelligenceWorkspace';
import { extractScriptIntelligenceFromDoc } from '../src/features/screenplay/services/scriptIntelligenceService';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Breakdown Workspace Refinement & 4 Primary Functional Areas', () => {
  const mockScenes: ParsedScene[] = [
    {
      id: 'scn-1',
      sceneNumber: '1',
      heading: 'INT. DETECTIVE OFFICE - NIGHT',
      slugline: 'INT. DETECTIVE OFFICE - NIGHT',
      location: 'DETECTIVE OFFICE',
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      pageNumber: 1,
      pageCountFraction: '1 2/8',
      summary: 'Miller examines the mysterious ledger under a desk lamp.',
      characters: ['MILLER', 'KANE'],
      dialogueBlocks: [
        { character: 'MILLER', text: 'You were not supposed to find this.' },
        { character: 'KANE', text: 'The ledger belongs to the city now, Miller.' },
      ],
      elements: {
        props: ['Black Leather Ledger', 'Desk Lamp', '.38 Snub Revolver'],
        wardrobe: ['Trench Coat', 'Fedora'],
        locations: ['Detective Office'],
      },
    },
    {
      id: 'scn-2',
      sceneNumber: '2',
      heading: 'EXT. RAINY ALLEY - NIGHT',
      slugline: 'EXT. RAINY ALLEY - NIGHT',
      location: 'RAINY ALLEY',
      intExt: 'EXT',
      timeOfDay: 'NIGHT',
      pageNumber: 3,
      pageCountFraction: '2 1/8',
      summary: 'Kane flees into the rain as Miller pursues on foot.',
      characters: ['MILLER', 'KANE', 'INFORMANT'],
      dialogueBlocks: [
        { character: 'KANE', text: 'Where is the car?!' },
        { character: 'INFORMANT', text: 'Parked behind the warehouse.' },
      ],
      elements: {
        props: ['Getaway Keys'],
        vehicles: ['1974 Dodge Sedan'],
        stunts: ['Foot chase across wet pavement'],
      },
    },
    {
      id: 'scn-3',
      sceneNumber: '3',
      heading: 'INT. WAREHOUSE - DAWN',
      slugline: 'INT. WAREHOUSE - DAWN',
      location: 'WAREHOUSE',
      intExt: 'INT',
      timeOfDay: 'DAWN',
      pageNumber: 5,
      pageCountFraction: '3/8',
      summary: 'Final standoff at daybreak.',
      characters: ['MILLER', 'KANE'],
      dialogueBlocks: [
        { character: 'MILLER', text: 'Drop the ledger, Kane.' },
      ],
      elements: {
        props: ['Black Leather Ledger'],
      },
    },
  ];

  const mockVersion: ScreenplayVersion = {
    id: 'ver-canonical-1',
    version: 'v1.0',
    title: 'The Rainmaker Noir',
    rawText: `INT. DETECTIVE OFFICE - NIGHT\nMiller and Kane argue.\nMILLER\nYou were not supposed to find this.\nKANE\nThe ledger belongs to the city now.`,
    extractedScenes: mockScenes,
    scenes: mockScenes,
    sourceFormat: 'fountain',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProject: FilmProject = {
    id: 'proj-breakdown-1',
    title: 'The Rainmaker Noir',
    description: 'Feature noir detective thriller.',
    scenes: mockScenes,
    screenplayVersions: [mockVersion],
    activeScreenplayVersionId: 'ver-canonical-1',
    elementCatalog: [
      {
        id: 'elem-ledger',
        name: 'Black Leather Ledger',
        category: 'props',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'elem-revolver',
        name: '.38 Snub Revolver',
        category: 'props',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'elem-dodge',
        name: '1974 Dodge Sedan',
        category: 'vehicles',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ],
    sceneBreakdownAssociations: [
      {
        id: 'assoc-1',
        sceneId: 'scn-1',
        elementId: 'elem-ledger',
        quantity: 1,
        reviewState: 'reviewed',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'assoc-2',
        sceneId: 'scn-1',
        elementId: 'elem-revolver',
        quantity: 1,
        reviewState: 'unreviewed',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'assoc-3',
        sceneId: 'scn-2',
        elementId: 'elem-dodge',
        quantity: 1,
        reviewState: 'reviewed',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ],
  };

  it('1. verifies the Breakdown workspace establishes exactly five primary functional areas', () => {
    const markup = renderToStaticMarkup(
      <BreakdownWorkspace
        project={mockProject}
        onUpdateProject={vi.fn()}
        initialSubmodule="characters"
      />
    );

    // Primary functional area tabs (strictly 5 sections)
    expect(markup).toContain('Character &amp; Script Analysis');
    expect(markup).toContain('Element Catalog');
    expect(markup).toContain('Reports');
    expect(markup).toContain('Stripboard');
    expect(markup).toContain('Sides');

    // Data badges
    expect(markup).toContain('The Rainmaker Noir');
  });

  it('2. verifies Character & Script Analysis renders confirmed characters with dialogue and metrics', () => {
    const markup = renderToStaticMarkup(
      <BreakdownWorkspace
        project={mockProject}
        onUpdateProject={vi.fn()}
        initialSubmodule="characters"
      />
    );

    expect(markup).toContain('Character &amp; Script Analysis');
    expect(markup).toContain('MILLER');
    expect(markup).toContain('KANE');
  });

  it('3. verifies Character & Script Analysis embeds Relationship Graph and Script Breakdown', () => {
    const intel = extractScriptIntelligenceFromDoc({
      doc: mockVersion.rawText,
      sourceDocumentId: mockVersion.id,
      priorScenes: mockScenes,
    });

    const markup = renderToStaticMarkup(
      <ScriptIntelligenceWorkspace
        project={mockProject}
        activeScreenplayVersion={mockVersion}
        intelligenceResult={intel}
        onApplyManualOverride={vi.fn()}
        onResetManualOverride={vi.fn()}
        onToggleSceneReviewed={vi.fn()}
        onRefreshAnalysis={vi.fn()}
      />
    );

    // Header tabs and options
    expect(markup).toContain('Character &amp; Script Analysis');
    expect(markup).toContain('Relationship Graph');
    expect(markup).toContain('Script Breakdown');
    expect(markup).toContain('MILLER');
    expect(markup).toContain('KANE');
  });

  it('4. verifies Character Constellation 2D network renders nodes, interactions, and inspector panel', () => {
    const markup = renderToStaticMarkup(
      <CharacterConstellation
        scenes={mockScenes}
        characters={['MILLER', 'KANE', 'INFORMANT']}
      />
    );

    // Network canvas and node tags
    expect(markup).toContain('Character Constellation');
    expect(markup).toContain('MILLER');
    expect(markup).toContain('KANE');
    expect(markup).toContain('INFORMANT');

    // Filter controls for dialogue vs co-presence
    expect(markup).toContain('Direct Dialogue Only');
    expect(markup).toContain('All Connections');

    // Inspector
    expect(markup).toContain('Relationship Evidence Inspector');
  });

  it('5. verifies Element Catalog displays categorized production items and scene associations', () => {
    const markup = renderToStaticMarkup(
      <BreakdownWorkspace
        project={mockProject}
        onUpdateProject={vi.fn()}
        initialSubmodule="elements"
      />
    );

    expect(markup).toContain('Black Leather Ledger');
    expect(markup).toContain('.38 Snub Revolver');
    expect(markup).toContain('1974 Dodge Sedan');
  });

  it('6. verifies Breakdown Reports renders all 6 standard production reports and export options', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={mockProject}
        scenes={mockScenes}
        initialReport="scene_summary"
      />
    );

    // Report Type Switcher
    expect(markup).toContain('Scene Summary');
    expect(markup).toContain('Character Appearances');
    expect(markup).toContain('Departmental Elements');
    expect(markup).toContain('Locations');
    expect(markup).toContain('One-Liner Production Schedule');
    expect(markup).toContain('Needs Review Audit');

    // Export buttons
    expect(markup).toContain('CSV');
    expect(markup).toContain('JSON');
    expect(markup).toContain('Print');

    // Report contents
    expect(markup).toContain('INT. DETECTIVE OFFICE - NIGHT');
  });

  it('7. verifies One-Liner Schedule report format renders scene synopses and cast', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={mockProject}
        scenes={mockScenes}
        initialReport="one_liner"
      />
    );

    expect(markup).toContain('One-Liner Production Schedule');
    expect(markup).toContain('MILLER, KANE');
    expect(markup).toContain('Miller examines the mysterious ledger under a desk lamp.');
  });

  it('8. verifies Needs Review Audit surfaces unreviewed elements', () => {
    const markup = renderToStaticMarkup(
      <BreakdownReportsView
        project={mockProject}
        scenes={mockScenes}
        initialReport="unreviewed_audit"
      />
    );

    expect(markup).toContain('Breakdown Review &amp; Audit');
    expect(markup).toContain('.38 Snub Revolver');
    expect(markup).toContain('(Unreviewed Element)');
  });
});
