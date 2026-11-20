import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BreakdownWorkspace } from '../src/features/breakdown/BreakdownWorkspace';
import {
  BreakdownFeatureLauncher,
  BREAKDOWN_TOOLS,
} from '../src/features/breakdown/components/BreakdownFeatureLauncher';
import {
  analyzeScreenplayCharacters,
  cleanCharacterCue,
} from '../src/features/breakdown/services/characterAnalysisService';
import {
  analyzeScriptBreakdown,
} from '../src/features/breakdown/services/scriptBreakdownService';
import { CharacterRelationshipGraph } from '../src/features/breakdown/components/CharacterRelationshipGraph';
import { ScriptBreakdownTable } from '../src/features/breakdown/components/ScriptBreakdownTable';
import { CharacterDetailDrawer } from '../src/features/breakdown/components/CharacterDetailDrawer';
import { parseFountainToCanonical } from '../src/features/screenplay/model/fountainParser';
import { FilmProject, ParsedScene, ScreenplayVersion } from '../src/types';

describe('SceneOS — Breakdown Architecture Correction & Character Analysis Reconstruction', () => {
  const mockScenes: ParsedScene[] = [
    {
      id: 'scn-1',
      sceneNumber: '1',
      heading: 'INT. DETECTIVE PRECINCT - DAY',
      slugline: 'INT. DETECTIVE PRECINCT - DAY',
      location: 'DETECTIVE PRECINCT',
      intExt: 'INT',
      timeOfDay: 'DAY',
      pageLengthEighths: 8,
      pageLengthDisplay: '1 0/8',
      startPage: 1,
      estimatedDurationMinutes: 1,
      characters: ['DETECTIVE BLAKE', 'SERGEANT CROSS', 'OFFICER PETERSON'],
      dialogueBlocks: [
        { character: 'DETECTIVE BLAKE', text: 'Where was the ledger found?' },
        { character: 'SERGEANT CROSS (CONT\'D)', text: 'In the trunk of the Dodge.' },
        { character: 'DETECTIVE BLAKE (O.S.)', text: 'Did Peterson dust it for prints?' },
        { character: 'SERGEANT CROSS', text: 'He is working on it now.' },
      ],
    },
    {
      id: 'scn-2',
      sceneNumber: '2',
      heading: 'EXT. HARBOR DOCKS - NIGHT',
      slugline: 'EXT. HARBOR DOCKS - NIGHT',
      location: 'HARBOR DOCKS',
      intExt: 'EXT',
      timeOfDay: 'NIGHT',
      pageLengthEighths: 16,
      pageLengthDisplay: '2 0/8',
      startPage: 2,
      estimatedDurationMinutes: 2,
      characters: ['DETECTIVE BLAKE', 'SMUGGLER'],
      dialogueBlocks: [
        { character: 'DETECTIVE BLAKE', text: 'Hands where I can see them.' },
        { character: 'SMUGGLER', text: 'You have no warrant here, Blake.' },
      ],
    },
  ];

  const mockVersion: ScreenplayVersion = {
    id: 'ver-1',
    version: 'v1.0',
    title: 'Neon Harbor',
    changeDescription: 'Initial draft',
    author: 'Screenwriter',
    updatedAt: new Date().toISOString(),
    status: 'Approved',
    scenes: mockScenes,
    extractedScenes: mockScenes,
  };

  const mockProject: FilmProject = {
    id: 'proj-1',
    title: 'Neon Harbor',
    logline: 'A detective unravels a conspiracy at the city docks.',
    director: 'Director Name',
    startDate: '2026-11-01',
    finalEndDate: '2027-02-01',
    suggestedEndDate: '2027-02-01',
    isEndDateFixed: false,
    constraints: {
      budgetLimit: 5000000,
      dailyBurnRateCap: 50000,
      screenplayLocked: true,
      castAvailabilityDays: 45,
      permitLeadTimeDays: 14,
      targetRating: 'PG-13',
      weatherContingencyBuffer: 5,
      postOverheadRatio: 15,
    },
    phases: [],
    updatedAt: new Date().toISOString(),
    scenes: mockScenes,
    screenplayVersions: [mockVersion],
    activeScreenplayVersionId: 'ver-1',
  };

  it('1. verifies Breakdown workspace contains strictly five navigation sections', () => {
    const markup = renderToStaticMarkup(
      <BreakdownWorkspace
        project={mockProject}
        onUpdateProject={vi.fn()}
      />
    );

    // 1. Character & Script Analysis
    expect(markup).toContain('Character &amp; Script Analysis');
    expect(markup).toContain('data-testid="breakdown-submodule-characters-btn"');

    // 2. Element Catalog
    expect(markup).toContain('Element Catalog');
    expect(markup).toContain('data-testid="breakdown-submodule-elements-btn"');

    // 3. Reports
    expect(markup).toContain('Reports');
    expect(markup).toContain('data-testid="breakdown-submodule-reports-btn"');

    // 4. Stripboard
    expect(markup).toContain('Stripboard');
    expect(markup).toContain('data-testid="breakdown-submodule-stripboard-btn"');

    // 5. Sides
    expect(markup).toContain('Sides');
    expect(markup).toContain('data-testid="breakdown-submodule-sides-btn"');

    // Strictly removed sections
    expect(markup).not.toContain('data-testid="breakdown-submodule-scenes-btn"');
    expect(markup).not.toContain('Continuity Intelligence');
  });

  it('2. verifies Breakdown Feature Launcher has exactly five registered tools', () => {
    expect(BREAKDOWN_TOOLS).toHaveLength(5);
    const toolIds = BREAKDOWN_TOOLS.map((t) => t.id);
    expect(toolIds).toEqual(['characters', 'elements', 'reports', 'stripboards', 'sides']);

    const markup = renderToStaticMarkup(
      <BreakdownFeatureLauncher
        activeToolId="characters"
        onSelectTool={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(markup).toContain('Character &amp; Script Analysis');
    expect(markup).toContain('Element Master Catalog');
    expect(markup).toContain('Breakdown Reports');
    expect(markup).toContain('Production Stripboards');
    expect(markup).toContain('Script Sides Preparation');

    // No Scene Breakdown tool in launcher
    expect(markup).not.toContain('Script Breakdowns');
  });

  it('3. verifies canonical character analysis extraction and dialogue-turn interactions', () => {
    const dataset = analyzeScreenplayCharacters(mockScenes, 'Neon Harbor');

    // Confirmed speakers
    const speakers = dataset.characters.map((c) => c.canonicalName);
    expect(speakers).toEqual(['DETECTIVE BLAKE', 'SERGEANT CROSS', 'SMUGGLER']);

    // Non-speaking mentioned character
    const mentioned = dataset.mentionedCharacters.map((m) => m.name);
    expect(mentioned).toContain('OFFICER PETERSON');
    expect(speakers).not.toContain('OFFICER PETERSON');

    // Detective Blake metrics
    const blake = dataset.characters.find((c) => c.canonicalName === 'DETECTIVE BLAKE')!;
    expect(blake.totalDialogueBlocks).toBe(3);
    expect(blake.speakingScenesCount).toBe(2);
    expect(blake.extensionsSeen).toContain('O.S.');

    // Consecutive dialogue turn interaction counts:
    // Scene 1: BLAKE <-> CROSS exchanges:
    // 1: BLAKE -> CROSS
    // 2: CROSS -> BLAKE
    // 3: BLAKE -> CROSS
    // Total BLAKE <-> CROSS turns = 3
    const blakeCross = dataset.interactions.find(
      (i) =>
        (i.source === 'DETECTIVE BLAKE' && i.target === 'SERGEANT CROSS') ||
        (i.source === 'SERGEANT CROSS' && i.target === 'DETECTIVE BLAKE')
    );
    expect(blakeCross).toBeDefined();
    expect(blakeCross!.exchangeCount).toBe(3);

    // Scene 2: BLAKE <-> SMUGGLER exchanges = 1
    const blakeSmuggler = dataset.interactions.find(
      (i) =>
        (i.source === 'DETECTIVE BLAKE' && i.target === 'SMUGGLER') ||
        (i.source === 'SMUGGLER' && i.target === 'DETECTIVE BLAKE')
    );
    expect(blakeSmuggler).toBeDefined();
    expect(blakeSmuggler!.exchangeCount).toBe(1);

    // Cross-scene interaction does NOT exist between CROSS and SMUGGLER
    const crossSmuggler = dataset.interactions.find(
      (i) =>
        (i.source === 'SERGEANT CROSS' && i.target === 'SMUGGLER') ||
        (i.source === 'SMUGGLER' && i.target === 'SERGEANT CROSS')
    );
    expect(crossSmuggler).toBeUndefined();
  });

  it('4. verifies Relationship Graph focus highlights selected/neighbor nodes and Script Breakdown analyzes block types distinctly', () => {
    const dataset = analyzeScreenplayCharacters(mockScenes, 'Neon Harbor');

    // Graph markup with isolated character + selected focus
    const extendedScenes: ParsedScene[] = [
      ...mockScenes,
      {
        id: 'scn-3',
        sceneNumber: '3',
        heading: 'INT. DINER - NIGHT',
        slugline: 'INT. DINER - NIGHT',
        location: 'DINER',
        intExt: 'INT',
        timeOfDay: 'NIGHT',
        pageLengthEighths: 4,
        pageLengthDisplay: '4/8',
        startPage: 3,
        estimatedDurationMinutes: 0.5,
        characters: ['WAITRESS'],
        dialogueBlocks: [{ character: 'WAITRESS', text: 'Refill on coffee?' }],
        elements: [],
        status: 'unreviewed',
      },
    ];
    const focusedDataset = analyzeScreenplayCharacters(extendedScenes, 'Neon Harbor');

    const graphMarkup = renderToStaticMarkup(
      <CharacterRelationshipGraph
        characters={focusedDataset.characters}
        interactions={focusedDataset.interactions}
        selectedCharacterId="DETECTIVE BLAKE"
        onSelectCharacter={vi.fn()}
      />
    );
    expect(graphMarkup).toContain('DETECTIVE BLAKE');
    expect(graphMarkup).toContain('SERGEANT CROSS');
    expect(graphMarkup).toContain('data-testid="character-relationship-graph"');
    expect(graphMarkup).toContain('data-focused="selected"');
    expect(graphMarkup).toContain('data-focused="neighbor"');
    expect(graphMarkup).toContain('data-focused="default"');
    expect(graphMarkup).toContain('data-testid="graph-reset-focus-btn"');

    // Script Breakdown Table markup (repurposed structural block composition)
    const fountain = `INT. PRECINCT - DAY

Thunder shakes the glass.

DETECTIVE BLAKE
(rubbing temples)
Where was the ledger found?

> CUT TO:

EXT. HARBOR - NIGHT

~We sing in the rain tonight.
`;
    const breakdownDataset = analyzeScriptBreakdown(
      {
        ...mockVersion,
        rawText: fountain,
      },
      mockScenes,
      'Neon Harbor'
    );

    expect(breakdownDataset.categories.find((c) => c.key === 'scene_heading')?.instances).toBe(2);
    expect(breakdownDataset.categories.find((c) => c.key === 'character')?.instances).toBe(1);
    expect(breakdownDataset.categories.find((c) => c.key === 'parenthetical')?.instances).toBe(1);
    expect(breakdownDataset.categories.find((c) => c.key === 'dialogue')?.instances).toBe(1);
    expect(breakdownDataset.categories.find((c) => c.key === 'transition')?.instances).toBe(1);
    expect(breakdownDataset.categories.find((c) => c.key === 'lyrics')?.instances).toBe(1);

    const sumInstances = breakdownDataset.categories.reduce((acc, c) => acc + c.instances, 0);
    expect(sumInstances).toBe(breakdownDataset.totalClassifiedInstances);

    const breakdownMarkup = renderToStaticMarkup(
      <ScriptBreakdownTable dataset={breakdownDataset} />
    );
    expect(breakdownMarkup).toContain('data-testid="script-breakdown-table"');
    expect(breakdownMarkup).toContain('Block Type');
    expect(breakdownMarkup).toContain('Instances');
    expect(breakdownMarkup).toContain('Percentage');
    expect(breakdownMarkup).toContain('Word Count');
    expect(breakdownMarkup).toContain('Scene Coverage');
    expect(breakdownMarkup).toContain('Scene Headings');
    expect(breakdownMarkup).toContain('Parentheticals');
    expect(breakdownMarkup).toContain('Transitions');
    expect(breakdownMarkup).toContain('Lyrics');
    expect(breakdownMarkup).toContain('Total Classified Blocks');

    // Drawer markup
    const blake = dataset.characters.find((c) => c.canonicalName === 'DETECTIVE BLAKE')!;
    const drawerMarkup = renderToStaticMarkup(
      <CharacterDetailDrawer
        character={blake}
        onClose={vi.fn()}
      />
    );
    expect(drawerMarkup).toContain('Dialogue Blocks');
    expect(drawerMarkup).toContain('Dialogue Words');
    expect(drawerMarkup).toContain('Avg Turn Length');
    expect(drawerMarkup).toContain('Speaking Scenes');
    expect(drawerMarkup).toContain('SERGEANT CROSS');
    expect(drawerMarkup).toContain('SMUGGLER');
  });

  it('5. verifies large 67-character cast graph separates all nodes without overlapping circles', () => {
    const largeCastScenes: ParsedScene[] = [
      {
        id: 'scn-large',
        sceneNumber: '1',
        heading: 'INT. METROPOLIS BRIEFING HALL - DAY',
        slugline: 'INT. METROPOLIS BRIEFING HALL - DAY',
        location: 'METROPOLIS BRIEFING HALL',
        intExt: 'INT',
        timeOfDay: 'DAY',
        pageLengthEighths: 40,
        pageLengthDisplay: '5 0/8',
        startPage: 1,
        estimatedDurationMinutes: 5,
        characters: Array.from({ length: 67 }, (_, i) => `SPEAKER_${i + 1}`),
        dialogueBlocks: [
          ...Array.from({ length: 67 }, (_, i) => ({
            character: `SPEAKER_${i + 1}`,
            text: 'Confirmed initial turn across the briefing room.',
          })),
          ...Array.from({ length: 80 }, (_, i) => ({
            character: i % 2 === 0 ? 'SPEAKER_1' : `SPEAKER_${(i % 20) + 2}`,
            text: 'Follow-up dialogue turn with main speaker.',
          })),
        ],
        elements: [],
        status: 'unreviewed',
      },
    ];

    const dataset = analyzeScreenplayCharacters(largeCastScenes, 'Metropolis Ensemble');
    expect(dataset.characters).toHaveLength(67);

    const markup = renderToStaticMarkup(
      <CharacterRelationshipGraph
        characters={dataset.characters}
        interactions={dataset.interactions}
        selectedCharacterId={null}
        onSelectCharacter={vi.fn()}
      />
    );

    // Extract rendered circle coordinates and verify no two node centers overlap their circle radii
    const circleMatches = Array.from(
      markup.matchAll(/<g data-character="([^"]+)"[^>]*>.*?<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)
    ).map((m) => ({
      name: m[1],
      cx: parseFloat(m[2]),
      cy: parseFloat(m[3]),
      r: parseFloat(m[4]),
    }));

    expect(circleMatches).toHaveLength(67);

    for (let i = 0; i < circleMatches.length; i++) {
      for (let j = i + 1; j < circleMatches.length; j++) {
        const a = circleMatches[i];
        const b = circleMatches[j];
        const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        expect(dist).toBeGreaterThan(a.r + b.r);
      }
    }
  });
});
