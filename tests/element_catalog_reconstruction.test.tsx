import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ElementMasterCatalogView } from '../src/features/breakdown/components/ElementMasterCatalogView';
import { FilmProject, ParsedScene } from '../src/types';
import {
  createMasterElement,
  updateMasterElement,
  deleteMasterElement,
  associateElementWithScene,
  removeElementAssociation,
  findDuplicateElements,
  mergeMasterElements,
} from '../src/features/breakdown/services/breakdownService';

describe('SceneOS — Element Catalog Reconstruction', () => {
  const mockScenes: ParsedScene[] = [
    {
      id: 'scn-1',
      sceneNumber: '1',
      slugline: 'INT. DETECTIVE PRECINCT - DAY',
      heading: 'INT. DETECTIVE PRECINCT - DAY',
      location: 'DETECTIVE PRECINCT',
      intExt: 'INT',
      timeOfDay: 'DAY',
      pageNumber: 1,
      pageLengthDisplay: '2 1/8',
      pageLengthEighths: 17,
      characters: ['DETECTIVE BLAKE', 'SERGEANT CROSS'],
      elements: [],
    },
    {
      id: 'scn-2',
      sceneNumber: '2',
      slugline: 'EXT. HARBOR DOCKS - NIGHT',
      heading: 'EXT. HARBOR DOCKS - NIGHT',
      location: 'HARBOR DOCKS',
      intExt: 'EXT',
      timeOfDay: 'NIGHT',
      pageNumber: 3,
      pageLengthDisplay: '1 4/8',
      pageLengthEighths: 12,
      characters: ['DETECTIVE BLAKE', 'SMUGGLER'],
      elements: [],
    },
    {
      id: 'scn-3',
      sceneNumber: '3',
      slugline: 'INT. WAREHOUSE - NIGHT',
      heading: 'INT. WAREHOUSE - NIGHT',
      location: 'ABANDONED WAREHOUSE',
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      pageNumber: 5,
      pageLengthDisplay: '3 2/8',
      pageLengthEighths: 26,
      characters: ['DETECTIVE BLAKE'],
      elements: [],
    },
  ];

  const mockProject: FilmProject = {
    id: 'proj-elem-test-1',
    title: 'Neon Harbor',
    scenes: mockScenes,
    screenplayVersions: [
      {
        id: 'ver-1',
        title: 'Neon Harbor',
        version: 'v1.0',
        scenes: mockScenes,
        extractedScenes: mockScenes,
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      } as any,
    ],
    activeScreenplayVersionId: 'ver-1',
    elementCatalog: [
      {
        id: 'elem-prop-1',
        projectId: 'proj-elem-test-1',
        name: 'Antique Gold Pocket Watch',
        category: 'prop',
        description: 'Engraved pocket watch handed down by grandfather',
        productionNotes: 'Hero prop; keep safe with prop master',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
      {
        id: 'elem-prop-2',
        projectId: 'proj-elem-test-1',
        name: '.38 Snub Revolver',
        category: 'prop',
        description: 'Standard detective firearm',
        productionNotes: 'Deactivated cold prop only',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
      {
        id: 'elem-cast-1',
        projectId: 'proj-elem-test-1',
        name: 'DETECTIVE BLAKE',
        category: 'cast',
        description: 'Lead protagonist',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
      {
        id: 'elem-veh-1',
        projectId: 'proj-elem-test-1',
        name: '1974 Dodge Monaco Sedan',
        category: 'vehicle',
        description: 'Unmarked detective sedan',
        productionNotes: 'Picture car; keys with transport coordinator',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
    ],
    sceneBreakdownAssociations: [
      {
        id: 'assoc-1',
        projectId: 'proj-elem-test-1',
        sceneId: 'scn-1',
        elementId: 'elem-prop-1',
        quantity: 1,
        notes: 'Held in hand while reviewing crime scene files',
        status: 'needed',
        provenance: 'manual',
        reviewState: 'reviewed',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
      {
        id: 'assoc-2',
        projectId: 'proj-elem-test-1',
        sceneId: 'scn-2',
        elementId: 'elem-prop-1',
        quantity: 1,
        notes: 'Checked before entering the foggy pier',
        status: 'needed',
        provenance: 'manual',
        reviewState: 'reviewed',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
      {
        id: 'assoc-3',
        projectId: 'proj-elem-test-1',
        sceneId: 'scn-3',
        elementId: 'elem-prop-1',
        quantity: 1,
        notes: 'Pocketed during foot pursuit',
        status: 'needed',
        provenance: 'manual',
        reviewState: 'reviewed',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
      },
    ],
  };

  it('1. renders landing page with departmental compartment cards, not a table-first layout', () => {
    const markup = renderToStaticMarkup(
      <ElementMasterCatalogView
        project={mockProject}
        scenes={mockScenes}
        onUpdateProject={vi.fn()}
      />
    );

    // Primary workspace title & registration markers
    expect(markup).toContain('Element Catalog');
    expect(markup).toContain('Element Master Catalog');
    expect(markup).toContain('Total Catalog Items');
    expect(markup).toContain('New Element');

    // Departmental card compartments
    expect(markup).toContain('Cast Members');
    expect(markup).toContain('Props');
    expect(markup).toContain('Set Dressing &amp; Greens');
    expect(markup).toContain('Costumes / Wardrobe');
    expect(markup).toContain('Hair &amp; Makeup');
    expect(markup).toContain('Vehicles / Picture Cars');
    expect(markup).toContain('Stunts');
    expect(markup).toContain('Special Effects (SFX)');
    expect(markup).toContain('Visual Effects (VFX)');
    expect(markup).toContain('Sound / Music');
    expect(markup).toContain('Animals / Greenery');

    // Element preview within cards
    expect(markup).toContain('Antique Gold Pocket Watch');
    expect(markup).toContain('.38 Snub Revolver');
    expect(markup).toContain('DETECTIVE BLAKE');
    expect(markup).toContain('1974 Dodge Monaco Sedan');

    // Confirms NO StudioBinder table headers on the landing page
    expect(markup).not.toContain('<th class="py-2.5 px-6 min-w-[200px]">Element Name</th>');
  });

  it('2. associates one single master element across multiple screenplay scenes without duplication', () => {
    // Antique Gold Pocket Watch has id "elem-prop-1"
    const masterElem = mockProject.elementCatalog!.find((e) => e.id === 'elem-prop-1');
    expect(masterElem).toBeDefined();

    // Verify exactly 1 master record exists
    const matchingRecords = mockProject.elementCatalog!.filter((e) => e.name === 'Antique Gold Pocket Watch');
    expect(matchingRecords.length).toBe(1);

    // Verify the same element is linked to Scene 1, Scene 2, and Scene 3
    const linkedAssocs = mockProject.sceneBreakdownAssociations!.filter((a) => a.elementId === 'elem-prop-1');
    expect(linkedAssocs.length).toBe(3);
    expect(linkedAssocs.map((a) => a.sceneId)).toEqual(['scn-1', 'scn-2', 'scn-3']);
  });

  it('3. associates a new scene to an existing master element', () => {
    // Add association to scene 4
    const res = associateElementWithScene(
      mockProject,
      {
        sceneId: 'scn-4',
        elementId: 'elem-prop-1',
        quantity: 1,
        notes: 'Placed on table during interrogation',
      },
      mockScenes
    );

    // Master catalog size must NOT increase
    expect(res.updatedProject.elementCatalog?.length).toBe(mockProject.elementCatalog?.length);

    // Associations count increases to 4
    const updatedAssocs = res.updatedProject.sceneBreakdownAssociations?.filter((a) => a.elementId === 'elem-prop-1');
    expect(updatedAssocs?.length).toBe(4);
    expect(updatedAssocs?.some((a) => a.sceneId === 'scn-4')).toBe(true);
  });

  it('4. removes an association from a scene without deleting the master element record', () => {
    const updated = removeElementAssociation(mockProject, 'assoc-1', mockScenes);

    // Master record is still intact
    expect(updated.elementCatalog?.some((e) => e.id === 'elem-prop-1')).toBe(true);

    // Associations reduced to 2
    const remainingAssocs = updated.sceneBreakdownAssociations?.filter((a) => a.elementId === 'elem-prop-1');
    expect(remainingAssocs?.length).toBe(2);
    expect(remainingAssocs?.some((a) => a.id === 'assoc-1')).toBe(false);
  });

  it('5. deleting a master element removes all its scene associations cleanly with no orphaned records', () => {
    const updated = deleteMasterElement(mockProject, 'elem-prop-1', mockScenes);

    // Master element deleted
    expect(updated.elementCatalog?.some((e) => e.id === 'elem-prop-1')).toBe(false);

    // All associations with that elementId removed
    const remainingAssocs = updated.sceneBreakdownAssociations?.filter((a) => a.elementId === 'elem-prop-1');
    expect(remainingAssocs?.length).toBe(0);
  });

  it('6. detects duplicate master elements and supports safe consolidation', () => {
    const projectWithDuplicates: FilmProject = {
      ...mockProject,
      elementCatalog: [
        ...mockProject.elementCatalog!,
        {
          id: 'elem-prop-dup',
          projectId: mockProject.id,
          name: 'antique gold pocket watch', // Lowercase duplicate
          category: 'prop',
          description: 'Duplicate watch record',
          createdAt: '2026-11-09T01:00:00Z',
          updatedAt: '2026-11-09T01:00:00Z',
        },
      ],
      sceneBreakdownAssociations: [
        ...mockProject.sceneBreakdownAssociations!,
        {
          id: 'assoc-dup',
          projectId: mockProject.id,
          sceneId: 'scn-4',
          elementId: 'elem-prop-dup',
          quantity: 1,
          status: 'needed',
          provenance: 'manual',
          reviewState: 'unreviewed',
          createdAt: '2026-11-09T01:00:00Z',
          updatedAt: '2026-11-09T01:00:00Z',
        },
      ],
    };

    const duplicates = findDuplicateElements(projectWithDuplicates.elementCatalog!);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].elements.length).toBe(2);

    // Merge into primary
    const merged = mergeMasterElements(projectWithDuplicates, 'elem-prop-1', 'elem-prop-dup', mockScenes);
    expect(merged.elementCatalog?.find((e) => e.id === 'elem-prop-dup')).toBeUndefined();
    expect(merged.sceneBreakdownAssociations?.find((a) => a.id === 'assoc-dup')?.elementId).toBe('elem-prop-1');
  });

  it('7. renders element detail view with scene appearances and jump links when targetElementId is provided', () => {
    const onJumpToScene = vi.fn();
    const markup = renderToStaticMarkup(
      <ElementMasterCatalogView
        project={mockProject}
        scenes={mockScenes}
        targetElementId="elem-prop-1"
        onUpdateProject={vi.fn()}
        onJumpToScene={onJumpToScene}
      />
    );

    // Element identity & descriptions
    expect(markup).toContain('Antique Gold Pocket Watch');
    expect(markup).toContain('Engraved pocket watch handed down by grandfather');
    expect(markup).toContain('Hero prop; keep safe with prop master');

    // Associated screenplay scenes
    expect(markup).toContain('Screenplay Scene Associations');
    expect(markup).toContain('SCENE #1');
    expect(markup).toContain('INT. DETECTIVE PRECINCT - DAY');
    expect(markup).toContain('SCENE #2');
    expect(markup).toContain('EXT. HARBOR DOCKS - NIGHT');
    expect(markup).toContain('SCENE #3');
    expect(markup).toContain('INT. WAREHOUSE - NIGHT');
    expect(markup).toContain('View in Breakdown');
  });
});
