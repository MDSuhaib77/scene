import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { FilmProject, ScreenplayVersion } from '../src/types';
import { ParsedScene } from '../src/features/screenplay/types/screenplay';
import {
  PRODUCTION_ELEMENT_TAXONOMY,
  ProductionElementCategory,
  normalizeElementCategory,
  MasterElement,
  SceneElementAssociation,
} from '../src/features/breakdown/types/breakdownTypes';
import {
  initializeBreakdownFromProject,
  createMasterElement,
  updateMasterElement,
  archiveMasterElement,
  deleteMasterElement,
  associateElementWithScene,
  removeElementAssociation,
  updateElementAssociation,
  createAndAssociateElement,
  reconcileBreakdownWithScript,
  getEnrichedSceneAssociations,
  getEnrichedCatalog,
} from '../src/features/breakdown/services/breakdownService';
import { BreakdownWorkspace } from '../src/features/breakdown/BreakdownWorkspace';
import { BreakdownEmptyState } from '../src/features/breakdown/components/BreakdownEmptyState';
import { SceneBreakdownView } from '../src/features/breakdown/components/SceneBreakdownView';
import { ElementMasterCatalogView } from '../src/features/breakdown/components/ElementMasterCatalogView';

const createMockProject = (options: {
  hasScenes?: boolean;
  withBreakdown?: boolean;
} = {}): FilmProject => {
  const { hasScenes = true, withBreakdown = false } = options;

  const mockScenes: ParsedScene[] = hasScenes
    ? [
        {
          id: 'scene-1',
          sceneNumber: '1',
          heading: 'INT. DETECTIVE PRECINCT - NIGHT',
          slugline: 'INT. DETECTIVE PRECINCT - NIGHT',
          originalHeading: 'INT. DETECTIVE PRECINCT - NIGHT',
          intExt: 'INT',
          location: 'DETECTIVE PRECINCT',
          timeOfDay: 'NIGHT',
          pageNumber: 1,
          pageLengthEighths: 8,
          characters: ['DETECTIVE MILLER'],
          dialogueSnippet: 'We found the revolver.',
          summary: 'Miller reveals the evidence.',
          status: 'unreviewed',
          isReviewed: false,
          sourceRange: { from: 0, to: 100 },
        },
        {
          id: 'scene-2',
          sceneNumber: '2',
          heading: 'EXT. RAINY ALLEYWAY - NIGHT',
          slugline: 'EXT. RAINY ALLEYWAY - NIGHT',
          originalHeading: 'EXT. RAINY ALLEYWAY - NIGHT',
          intExt: 'EXT',
          location: 'RAINY ALLEYWAY',
          timeOfDay: 'NIGHT',
          pageNumber: 2,
          pageLengthEighths: 4,
          characters: ['DETECTIVE MILLER', 'INFORMANT'],
          dialogueSnippet: 'Watch your back.',
          summary: 'Miller meets with an informant in the shadows.',
          status: 'reviewed',
          isReviewed: true,
          sourceRange: { from: 101, to: 200 },
        },
      ]
    : [];

  const mockVersion: ScreenplayVersion = {
    id: 'ver-1',
    versionNumber: 1,
    title: 'Neon Nights',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'scene_heading',
          content: [{ type: 'text', text: 'INT. DETECTIVE PRECINCT - NIGHT' }],
        },
        {
          type: 'character',
          content: [{ type: 'text', text: 'DETECTIVE MILLER' }],
        },
        {
          type: 'dialogue',
          content: [{ type: 'text', text: 'We found the revolver.' }],
        },
      ],
    },
    extractedScenes: mockScenes,
    scenes: mockScenes,
  };

  const initialElements: MasterElement[] = withBreakdown
    ? [
        {
          id: 'elem-revolver',
          projectId: 'proj-1',
          name: '.38 Snub Revolver',
          category: 'prop',
          description: 'Standard issue police revolver',
          productionNotes: 'Must be cold prop / deactivated replica',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'elem-miller',
          projectId: 'proj-1',
          name: 'DETECTIVE MILLER',
          category: 'cast',
          description: 'Lead investigator',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
    : [];

  const initialAssociations: SceneElementAssociation[] = withBreakdown
    ? [
        {
          id: 'assoc-1',
          projectId: 'proj-1',
          sceneId: 'scene-1',
          elementId: 'elem-revolver',
          quantity: 1,
          notes: 'Drawn from Miller desk holster',
          status: 'needed',
          provenance: 'manual',
          reviewState: 'reviewed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'assoc-2',
          projectId: 'proj-1',
          sceneId: 'scene-1',
          elementId: 'elem-miller',
          quantity: 1,
          status: 'needed',
          provenance: 'extracted',
          reviewState: 'unreviewed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
    : [];

  return {
    id: 'proj-1',
    title: 'Neon Nights',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeScreenplayVersionId: 'ver-1',
    screenplayVersions: [mockVersion],
    elementCatalog: initialElements,
    sceneBreakdownAssociations: initialAssociations,
    scenes: mockScenes,
    characters: [],
  };
};

describe('SceneOS Screenplay — Production Breakdown & Element Master Catalog (Prompt 06)', () => {
  describe('1. Production Taxonomy & Category Normalization', () => {
    it('defines a standardized film production taxonomy of 16 recognized categories', () => {
      const categories = Object.keys(PRODUCTION_ELEMENT_TAXONOMY) as ProductionElementCategory[];
      expect(categories).toContain('cast');
      expect(categories).toContain('background');
      expect(categories).toContain('extras');
      expect(categories).toContain('location');
      expect(categories).toContain('prop');
      expect(categories).toContain('set_dressing');
      expect(categories).toContain('wardrobe');
      expect(categories).toContain('hair_makeup');
      expect(categories).toContain('sfx');
      expect(categories).toContain('vfx');
      expect(categories).toContain('vehicle');
      expect(categories).toContain('animal');
      expect(categories).toContain('stunt');
      expect(categories).toContain('sound');
      expect(categories).toContain('special_equipment');
      expect(categories).toContain('other');
      expect(categories.length).toBe(16);
    });

    it('each category provides human-readable label, description, badge styles, and icon identifier', () => {
      Object.entries(PRODUCTION_ELEMENT_TAXONOMY).forEach(([, conf]) => {
        expect(conf.label).toBeTruthy();
        expect(conf.description).toBeTruthy();
        expect(conf.colorClass).toContain('text-');
        expect(conf.badgeClass).toContain('border-');
        expect(conf.iconName).toBeTruthy();
      });
    });

    it('normalizes arbitrary or legacy category strings safely without data loss', () => {
      expect(normalizeElementCategory('Props')).toBe('prop');
      expect(normalizeElementCategory('CHARACTERS')).toBe('cast');
      expect(normalizeElementCategory('ACTOR')).toBe('cast');
      expect(normalizeElementCategory('cars')).toBe('vehicle');
      expect(normalizeElementCategory('pyro')).toBe('sfx');
      expect(normalizeElementCategory('cgi')).toBe('vfx');
      expect(normalizeElementCategory('costume')).toBe('wardrobe');
      expect(normalizeElementCategory('makeup')).toBe('hair_makeup');
      expect(normalizeElementCategory('horses')).toBe('animal');
      expect(normalizeElementCategory('unknown_xyz')).toBe('other');
    });
  });

  describe('2. Element Master Catalog Operations', () => {
    it('creates a new master element with sanitized name, category, and audit timestamps', () => {
      const project = createMockProject({ withBreakdown: true });
      const { updatedProject: updated, element: coat } = createMasterElement(project, {
        name: '  Trench Coat  ',
        category: 'wardrobe',
        description: 'Dark wool detective overcoat',
        productionNotes: 'Weathered look, size 42R',
      });

      expect(coat).toBeDefined();
      expect(coat.name).toBe('Trench Coat');
      expect(coat.category).toBe('wardrobe');
      expect(coat.description).toBe('Dark wool detective overcoat');
      expect(coat.productionNotes).toBe('Weathered look, size 42R');
      expect(coat.id).toMatch(/^elem-/);
      expect(coat.createdAt).toBeTruthy();
      expect(coat.updatedAt).toBeTruthy();

      expect(updated.elementCatalog?.some(e => e.id === coat.id)).toBe(true);
    });

    it('updates master element attributes without mutating unaffected elements', () => {
      const project = createMockProject({ withBreakdown: true });
      const updated = updateMasterElement(project, 'elem-revolver', {
        name: '.38 Special Snub (Steel)',
        productionNotes: 'Requires armorer sign-off each shoot day',
      });

      const revolver = updated.elementCatalog?.find(e => e.id === 'elem-revolver');
      expect(revolver?.name).toBe('.38 Special Snub (Steel)');
      expect(revolver?.productionNotes).toBe('Requires armorer sign-off each shoot day');

      const miller = updated.elementCatalog?.find(e => e.id === 'elem-miller');
      expect(miller?.name).toBe('DETECTIVE MILLER');
    });

    it('archives and unarchives master elements gracefully', () => {
      const project = createMockProject({ withBreakdown: true });
      const archived = archiveMasterElement(project, 'elem-revolver', true);
      const archivedElem = archived.elementCatalog?.find(e => e.id === 'elem-revolver');
      expect(archivedElem?.isArchived).toBe(true);
      expect(archivedElem?.archivedAt).toBeTruthy();

      const unarchived = archiveMasterElement(archived, 'elem-revolver', false);
      const restoredElem = unarchived.elementCatalog?.find(e => e.id === 'elem-revolver');
      expect(restoredElem?.isArchived).toBe(false);
      expect(restoredElem?.archivedAt).toBeUndefined();
    });

    it('deletes master element and cleans up all scene associations referencing it', () => {
      const project = createMockProject({ withBreakdown: true });
      expect(project.sceneBreakdownAssociations?.length).toBe(2);

      const updated = deleteMasterElement(project, 'elem-revolver');
      expect(updated.elementCatalog?.some(e => e.id === 'elem-revolver')).toBe(false);
      expect(updated.sceneBreakdownAssociations?.some(a => a.elementId === 'elem-revolver')).toBe(false);
      expect(updated.sceneBreakdownAssociations?.length).toBe(1);
    });
  });

  describe('3. Scene Breakdown Associations & Scene Isolation', () => {
    it('associates an existing catalog element with a specific scene', () => {
      const project = createMockProject({ withBreakdown: true });
      const { updatedProject: updated } = associateElementWithScene(project, {
        sceneId: 'scene-2',
        elementId: 'elem-revolver',
        quantity: 2,
        notes: 'Backup revolver in ankle holster',
        status: 'needed',
        provenance: 'manual',
      });

      const assoc = updated.sceneBreakdownAssociations?.find(
        a => a.sceneId === 'scene-2' && a.elementId === 'elem-revolver'
      );
      expect(assoc).toBeDefined();
      expect(assoc?.quantity).toBe(2);
      expect(assoc?.notes).toBe('Backup revolver in ankle holster');
      expect(assoc?.provenance).toBe('manual');
    });

    it('ensures scene-specific quantities and notes are strictly isolated per scene', () => {
      const project = createMockProject({ withBreakdown: true });
      // Add same revolver to scene 2 with quantity 5 and different note
      const { updatedProject: updated } = associateElementWithScene(project, {
        sceneId: 'scene-2',
        elementId: 'elem-revolver',
        quantity: 5,
        notes: 'Crate of revolvers in alley',
      });

      const enriched1 = getEnrichedSceneAssociations(
        updated.sceneBreakdownAssociations || [],
        updated.elementCatalog || [],
        'scene-1'
      );
      const enriched2 = getEnrichedSceneAssociations(
        updated.sceneBreakdownAssociations || [],
        updated.elementCatalog || [],
        'scene-2'
      );

      const s1Revolver = enriched1.find(a => a.elementId === 'elem-revolver');
      const s2Revolver = enriched2.find(a => a.elementId === 'elem-revolver');

      expect(s1Revolver?.quantity).toBe(1);
      expect(s1Revolver?.notes).toBe('Drawn from Miller desk holster');
      expect(s2Revolver?.quantity).toBe(5);
      expect(s2Revolver?.notes).toBe('Crate of revolvers in alley');
      // The master catalog element remains pristine
      const master = updated.elementCatalog?.find(e => e.id === 'elem-revolver');
      expect(master?.name).toBe('.38 Snub Revolver');
    });

    it('updates association review state and status', () => {
      const project = createMockProject({ withBreakdown: true });
      const updated = updateElementAssociation(project, 'assoc-1', {
        reviewState: 'reviewed',
        status: 'confirmed',
        notes: 'Armorer verified safety on set',
      });

      const assoc = updated.sceneBreakdownAssociations?.find(a => a.id === 'assoc-1');
      expect(assoc?.reviewState).toBe('reviewed');
      expect(assoc?.status).toBe('confirmed');
      expect(assoc?.notes).toBe('Armorer verified safety on set');
    });

    it('removes an association from a scene without deleting the master catalog element', () => {
      const project = createMockProject({ withBreakdown: true });
      const updated = removeElementAssociation(project, 'assoc-1');

      expect(updated.sceneBreakdownAssociations?.some(a => a.id === 'assoc-1')).toBe(false);
      // Master element is still in the catalog
      expect(updated.elementCatalog?.some(e => e.id === 'elem-revolver')).toBe(true);
    });

    it('supports direct createAndAssociateElement workflow in one atomic step', () => {
      const project = createMockProject({ withBreakdown: true });
      const { updatedProject: updated, element: car, association: carAssoc } = createAndAssociateElement(
        project,
        'scene-2',
        {
          name: '1978 Crown Victoria',
          category: 'vehicle',
          description: 'Miller unmarked police cruiser',
        },
        {
          quantity: 1,
          notes: 'Parked in alley under sodium light',
        }
      );

      expect(car).toBeDefined();
      expect(car.name).toBe('1978 Crown Victoria');
      expect(car.category).toBe('vehicle');

      expect(carAssoc).toBeDefined();
      expect(carAssoc.sceneId).toBe('scene-2');
      expect(carAssoc.notes).toBe('Parked in alley under sodium light');
      expect(carAssoc.quantity).toBe(1);

      expect(updated.elementCatalog?.some(e => e.name === '1978 Crown Victoria')).toBe(true);
    });
  });

  describe('4. Script Intelligence Ingestion, Traceability & Non-Destructive Reconciliation', () => {
    it('initializes breakdown from project, linking characters and locations without fabricating fake props', () => {
      const bareProject = createMockProject({ withBreakdown: false });
      expect(bareProject.elementCatalog?.length ?? 0).toBe(0);

      const initialized = initializeBreakdownFromProject(bareProject);
      expect(initialized.elementCatalog).toBeDefined();
      expect(initialized.sceneBreakdownAssociations).toBeDefined();

      // Extracted character "DETECTIVE MILLER" should be cataloged under cast
      const miller = initialized.elementCatalog?.find(e => e.name === 'DETECTIVE MILLER');
      expect(miller).toBeDefined();
      expect(miller?.category).toBe('cast');

      // Extracted location "DETECTIVE PRECINCT" should be cataloged under location
      const precinct = initialized.elementCatalog?.find(e => e.name === 'DETECTIVE PRECINCT');
      expect(precinct).toBeDefined();
      expect(precinct?.category).toBe('location');

      // Crucially, NO fake props or vehicles are fabricated from prose
      const props = initialized.elementCatalog?.filter(e => e.category === 'prop');
      expect(props?.length).toBe(0);

      // Associations connect Miller to scene 1 and scene 2
      const millerAssocs = initialized.sceneBreakdownAssociations?.filter(
        a => a.elementId === miller?.id
      );
      expect(millerAssocs?.length).toBe(2);
    });

    it('reconciles breakdown across screenplay edits, preserving manual assignments on stable scene IDs', () => {
      const project = createMockProject({ withBreakdown: true });
      const currentScenes = project.scenes || [];
      
      // Simulate screenplay editing where scene 1 is modified and a new scene 3 is inserted
      const editedScenes: ParsedScene[] = [
        {
          ...currentScenes[0],
          heading: 'INT. DETECTIVE PRECINCT - DAWN',
          slugline: 'INT. DETECTIVE PRECINCT - DAWN',
          timeOfDay: 'DAWN',
        },
        {
          id: 'scene-3-new',
          sceneNumber: '3',
          heading: 'INT. FORENSICS LAB - DAY',
          slugline: 'INT. FORENSICS LAB - DAY',
          originalHeading: 'INT. FORENSICS LAB - DAY',
          intExt: 'INT',
          location: 'FORENSICS LAB',
          timeOfDay: 'DAY',
          pageNumber: 3,
          pageLengthEighths: 6,
          characters: ['DR. CHO'],
          sourceRange: { from: 201, to: 300 },
        },
      ];

      const { reconciledProject: reconciled } = reconcileBreakdownWithScript(project, editedScenes);

      // Reconciled catalog keeps existing manual elements
      expect(reconciled.elementCatalog?.some(e => e.name === '.38 Snub Revolver')).toBe(true);

      // New character DR. CHO is brought into catalog
      expect(reconciled.elementCatalog?.some(e => e.name === 'DR. CHO')).toBe(true);

      // Manual association for the revolver on scene-1 is preserved!
      const revolverAssoc = reconciled.sceneBreakdownAssociations?.find(
        a => a.sceneId === 'scene-1' && a.elementId === 'elem-revolver'
      );
      expect(revolverAssoc).toBeDefined();
      expect(revolverAssoc?.notes).toBe('Drawn from Miller desk holster');
    });

    it('provides enriched catalog metrics with total scene appearance links', () => {
      const project = createMockProject({ withBreakdown: true });
      const scenes = project.scenes || [];
      const enrichedCatalog = getEnrichedCatalog(
        project.elementCatalog || [],
        project.sceneBreakdownAssociations || [],
        scenes
      );

      const miller = enrichedCatalog.find(e => e.name === 'DETECTIVE MILLER');
      expect(miller?.totalAppearances).toBe(1);
      expect(miller?.associatedScenes[0]?.slugline).toBe('INT. DETECTIVE PRECINCT - NIGHT');

      const revolver = enrichedCatalog.find(e => e.name === '.38 Snub Revolver');
      expect(revolver?.totalAppearances).toBe(1);
      expect(revolver?.associatedScenes[0]?.slugline).toBe('INT. DETECTIVE PRECINCT - NIGHT');
    });
  });

  describe('5. Component View Verification', () => {
    it('renders BreakdownEmptyState with directive to Screenplay Studio when zero scenes exist', () => {
      const handleNavigate = vi.fn();
      const markup = renderToStaticMarkup(
        React.createElement(BreakdownEmptyState, { onNavigateTab: handleNavigate })
      );

      expect(markup).toContain('No Screenplay Scenes Extracted');
      expect(markup).toContain('Open Screenplay Studio');
      expect(markup).toContain('Script Intelligence');
    });

    it('renders SceneBreakdownView with scene selector, scene header, and element groups', () => {
      const project = createMockProject({ withBreakdown: true });
      const markup = renderToStaticMarkup(
        React.createElement(SceneBreakdownView, {
          project,
          scenes: project.scenes,
          onUpdateProject: vi.fn(),
          selectedSceneId: 'scene-1',
        })
      );

      // Scene selector list
      expect(markup).toContain('DETECTIVE PRECINCT');
      expect(markup).toContain('RAINY ALLEYWAY');
      // Active scene breakdown details
      expect(markup).toContain('SCENE #1');
      expect(markup).toContain('INT. DETECTIVE PRECINCT - NIGHT');
      expect(markup).toContain('8/8');
      // Element table
      expect(markup).toContain('.38 Snub Revolver');
      expect(markup).toContain('Drawn from Miller desk holster');
      expect(markup).toContain('DETECTIVE MILLER');
      expect(markup).toContain('Add Element');
    });

    it('renders ElementMasterCatalogView with metrics bar, categories, and scene jump chips', () => {
      const project = createMockProject({ withBreakdown: true });
      const markup = renderToStaticMarkup(
        React.createElement(ElementMasterCatalogView, {
          project,
          scenes: project.scenes,
          onUpdateProject: vi.fn(),
          onJumpToScene: vi.fn(),
        })
      );

      expect(markup).toContain('Element Master Catalog');
      expect(markup).toContain('Total Catalog Items');
      expect(markup).toContain('New Element');
      expect(markup).toContain('.38 Snub Revolver');
      expect(markup).toContain('DETECTIVE MILLER');
      expect(markup).toContain('Must be cold prop / deactivated replica');
      expect(markup).toContain('#1');
    });

    it('mounts BreakdownWorkspace with navigation tabs and seamlessly switches views', () => {
      const project = createMockProject({ withBreakdown: true });
      const markup = renderToStaticMarkup(
        React.createElement(BreakdownWorkspace, {
          project,
          onUpdateProject: vi.fn(),
          initialSubmodule: 'breakdown',
        })
      );

      expect(markup).toContain('Scene Breakdown');
      expect(markup).toContain('Element Master Catalog');
      expect(markup).toContain('One-Liner Schedule');
      expect(markup).toContain('Stripboard');
      expect(markup).toContain('Neon Nights');
    });

    it('renders BreakdownEmptyState inside BreakdownWorkspace if project has no extracted scenes', () => {
      const emptyProject = createMockProject({ hasScenes: false, withBreakdown: false });
      const markup = renderToStaticMarkup(
        React.createElement(BreakdownWorkspace, {
          project: emptyProject,
          onUpdateProject: vi.fn(),
        })
      );

      expect(markup).toContain('No Screenplay Scenes Extracted');
      expect(markup).toContain('Open Screenplay Studio');
    });
  });
});
