import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BreakdownWorkspace } from '../src/features/breakdown/BreakdownWorkspace';
import { BreakdownFeatureLauncher, BREAKDOWN_TOOLS } from '../src/features/breakdown/components/BreakdownFeatureLauncher';
import { StripboardViewer } from '../src/features/breakdown/components/StripboardViewer';
import { ScriptSidesWorkspace } from '../src/features/breakdown/components/ScriptSidesWorkspace';
import { findDuplicateElements, mergeMasterElements, extractMultiCategorySceneRequirements } from '../src/features/breakdown/services/breakdownService';
import { ScriptIntelligenceWorkspace } from '../src/features/screenplay/components/ScriptIntelligenceWorkspace';
import { extractScriptIntelligenceFromDoc } from '../src/features/screenplay/services/scriptIntelligenceService';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Breakdown Master Reconstruction', () => {
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
      elements: {
        props: ['Black Leather Ledger'],
        vehicles: ['1974 Dodge Sedan'],
      },
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
      elements: {
        props: ['.38 Revolver'],
        stunts: ['Dockside foot pursuit'],
      },
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
    id: 'proj-reconstruct-1',
    title: 'Neon Harbor',
    description: 'Noir thriller feature film.',
    scenes: mockScenes,
    screenplayVersions: [mockVersion],
    activeScreenplayVersionId: 'ver-1',
    elementCatalog: [
      {
        id: 'elem-1',
        name: 'Black Leather Ledger',
        category: 'prop',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'elem-1-dup',
        name: 'black leather ledger',
        category: 'prop',
        productionNotes: 'Duplicate entry created during script sync',
        createdAt: '2026-10-02T00:00:00Z',
        updatedAt: '2026-10-02T00:00:00Z',
      },
      {
        id: 'elem-2',
        name: '1974 Dodge Sedan',
        category: 'vehicle',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ],
    sceneBreakdownAssociations: [
      {
        id: 'assoc-1',
        sceneId: 'scn-1',
        elementId: 'elem-1',
        quantity: 1,
        reviewState: 'reviewed',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'assoc-2',
        sceneId: 'scn-2',
        elementId: 'elem-1-dup',
        quantity: 1,
        reviewState: 'unreviewed',
        notes: 'Carried in smuggler jacket',
        createdAt: '2026-10-02T00:00:00Z',
        updatedAt: '2026-10-02T00:00:00Z',
      },
    ],
  };

  it('1. verifies the Breakdown Feature Launcher categorises tools across Core, Intelligence, Documents, and Handoffs', () => {
    const markup = renderToStaticMarkup(
      <BreakdownFeatureLauncher
        activeToolId="characters"
        onSelectTool={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Tool categories
    expect(markup).toContain('Core Breakdown &amp; Requirements');
    expect(markup).toContain('Analysis &amp; Screenplay Intelligence');
    expect(markup).toContain('Production Documentation');
    expect(markup).toContain('Connected Workspaces');

    // Tool entries (strictly 5 sections)
    expect(markup).toContain('Character &amp; Script Analysis');
    expect(markup).toContain('Element Master Catalog');
    expect(markup).toContain('Breakdown Reports');
    expect(markup).toContain('Production Stripboards');
    expect(markup).toContain('Script Sides Preparation');

    // Handoff badges
    expect(markup).toContain('Schedule Handoff');
    expect(markup).toContain('Production Handoff');
  });

  it('2. verifies StripboardViewer renders visual strips with industry standards and Schedule handoff', () => {
    const onNavigateTab = vi.fn();
    const markup = renderToStaticMarkup(
      <StripboardViewer
        project={mockProject}
        scenes={mockScenes}
        onNavigateTab={onNavigateTab}
      />
    );

    // Stripboard header & ownership banner
    expect(markup).toContain('Production Stripboard');
    expect(markup).toContain('Open in Schedule (Calendar)');

    // Visual scene strips
    expect(markup).toContain('INT. DETECTIVE PRECINCT - DAY');
    expect(markup).toContain('EXT. HARBOR DOCKS - NIGHT');
    expect(markup).toContain('DETECTIVE BLAKE');
    expect(markup).toContain('SERGEANT CROSS');

    // Industry strip color markers
    expect(markup).toContain('INT DAY (White)');
    expect(markup).toContain('EXT NIGHT (Blue)');
  });

  it('3. verifies ScriptSidesWorkspace compiles formatted screenplay prose and establishes Production Day handoff', () => {
    const onNavigateTab = vi.fn();
    const markup = renderToStaticMarkup(
      <ScriptSidesWorkspace
        project={mockProject}
        scenes={mockScenes}
        onNavigateTab={onNavigateTab}
      />
    );

    // Sides header & ownership banner
    expect(markup).toContain('Script Sides Preparation');
    expect(markup).toContain('Production Day (Call Sheets)');

    // Formatted prose preview
    expect(markup).toContain('PRODUCTION SIDES');
    expect(markup).toContain('Neon Harbor');
    expect(markup).toContain('DETECTIVE BLAKE');
    expect(markup).toContain('Where was the ledger found?');
  });

  it('4. verifies duplicate element detection and safe cross-scene merging logic', () => {
    // Detect duplicates
    const duplicates = findDuplicateElements(mockProject.elementCatalog!);
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0].normalizedKey).toBe('black leather ledger');
    expect(duplicates[0].elements.length).toBe(2);

    // Perform safe merge
    const mergedProject = mergeMasterElements(mockProject, 'elem-1', 'elem-1-dup', mockScenes);
    expect(mergedProject.elementCatalog?.length).toBe(2);
    expect(mergedProject.elementCatalog?.find(e => e.id === 'elem-1-dup')).toBeUndefined();

    // Verify scene 2 association was safely repointed to elem-1 with preserved notes
    const repointedAssoc = mergedProject.sceneBreakdownAssociations?.find(a => a.sceneId === 'scn-2');
    expect(repointedAssoc?.elementId).toBe('elem-1');
    expect(repointedAssoc?.notes).toContain('Carried in smuggler jacket');
  });

  it('5. verifies BreakdownWorkspace integrates all 5 production tools with active state controls', () => {
    const markup = renderToStaticMarkup(
      <BreakdownWorkspace
        project={mockProject}
        onUpdateProject={vi.fn()}
        onNavigateTab={vi.fn()}
        initialSubmodule="characters"
      />
    );

    // Quick segmented bar (strictly 5 sections)
    expect(markup).toContain('Character &amp; Script Analysis');
    expect(markup).toContain('Element Catalog');
    expect(markup).toContain('Reports');
    expect(markup).toContain('Stripboard');
    expect(markup).toContain('Sides');

    // Feature Launcher keyboard indicator
    expect(markup).toContain('⌘K');

    // Cross-workspace handoffs in header
    expect(markup).toContain('Screenplay');
    expect(markup).toContain('Schedule ↗');
    expect(markup).toContain('Production ↗');
  });

  it('6. verifies Multi-Category Script Extraction scanner extracts grounded requirements with evidence passages', () => {
    const testScene: ParsedScene = {
      id: 'scn-test-extract',
      sceneNumber: '1',
      heading: 'INT. DETECTIVE PRECINCT - NIGHT',
      slugline: 'INT. DETECTIVE PRECINCT - NIGHT',
      location: 'DETECTIVE PRECINCT',
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      pageNumber: 1,
      pageLengthEighths: 8,
      pageLengthDisplay: '1/8',
      actionSnippet: 'Miller grabs his revolver and trench coat. He runs down the alley into the rain.',
      dialogueBlocks: [
        { character: 'MILLER', text: 'Where is the black leather ledger?' },
      ],
      characters: ['MILLER'],
      elements: [],
      status: 'unreviewed',
      startPage: 1,
      estimatedDurationMinutes: 1,
    };

    const extracted = extractMultiCategorySceneRequirements(testScene);
    expect(extracted.length).toBeGreaterThan(0);

    // Props extraction with grounded evidence
    const revolver = extracted.find((r: any) => r.name === '.38 Snub Revolver');
    expect(revolver).toBeDefined();
    expect(revolver.category).toBe('prop');
    expect(revolver.evidenceType).toBe('explicit');
    expect(revolver.evidencePassage).toContain('revolver');

    // Wardrobe extraction
    const trenchCoat = extracted.find((r: any) => r.name === 'Trench Coat');
    expect(trenchCoat).toBeDefined();
    expect(trenchCoat.category).toBe('wardrobe');

    // Inferred Stunt extraction
    const footPursuit = extracted.find((r: any) => r.name === 'Wet Pavement Foot Pursuit');
    expect(footPursuit).toBeDefined();
    expect(footPursuit.evidenceType).toBe('inferred');

    // Dialogue extraction
    const ledger = extracted.find((r: any) => r.name === 'Black Leather Ledger');
    expect(ledger).toBeDefined();
    expect(ledger.evidencePassage).toContain('ledger');
  });

  it('7. verifies StripboardViewer organizes scenes into shooting-day groups and detects company moves', () => {
    const markup = renderToStaticMarkup(
      <StripboardViewer
        project={mockProject}
        scenes={mockScenes}
        onNavigateTab={vi.fn()}
      />
    );

    // Shooting Day Header
    expect(markup).toContain('SHOOT DAY 1');
    expect(markup).toContain('Call:');
    expect(markup).toContain('Wrap:');

    // Operational controllers
    expect(markup).toContain('Reset Script Order');
    expect(markup).toContain('+ Day Break');
    expect(markup).toContain('Select All');

    // Confirms NO invented Company Move From/To logistics fields
    expect(markup).not.toContain('COMPANY MOVE');
    expect(markup).not.toContain('Relocate from');
  });

  it('8. verifies ScriptIntelligenceWorkspace is revamped into Character & Script Analysis with Relationship Graph and Script Breakdown', () => {
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
        initialView="characters"
        onApplyManualOverride={vi.fn()}
        onResetManualOverride={vi.fn()}
        onToggleSceneReviewed={vi.fn()}
        onRefreshAnalysis={vi.fn()}
      />
    );

    // Revamped Character & Script Analysis module
    expect(markup).toContain('Character &amp; Script Analysis');
    expect(markup).toContain('Relationship Graph');
    expect(markup).toContain('Script Breakdown');
    expect(markup).toContain('DETECTIVE BLAKE');

    // Continuity Intelligence removed completely
    expect(markup).not.toContain('Continuity Intelligence');
  });
});
