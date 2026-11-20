import { describe, it, expect } from 'vitest';
import { WORKSPACE_NAV_ITEMS } from '../src/components/navigation/AppSidebar';
import { canEditProductionMetadata } from '../src/components/overview/EditProductionMetadataModal';
import { INITIAL_PROJECTS } from '../src/data/mockProjects';
import { screenplayParserService } from '../src/services/screenplay/screenplayParserService';
import { formatEighths, parseEighths } from '../src/services/screenplay/eighthsHelper';

describe('Batch 01R: Sidebar Navigation Restoration & Clean 9-Item Baseline', () => {
  it('strictly preserves the 9 established core workspace navigation items', () => {
    expect(WORKSPACE_NAV_ITEMS).toHaveLength(9);
    expect(WORKSPACE_NAV_ITEMS.map(i => i.id)).toEqual([
      'overview',
      'screenplay',
      'phases',
      'calendar',
      'master-calendar',
      'crew',
      'constraints',
      'telemetry',
      'assets'
    ]);
  });

  it('preserves legacy tab identifiers for backwards compatibility', () => {
    const legacyMap = Object.fromEntries(WORKSPACE_NAV_ITEMS.map(i => [i.id, i.legacyId]));
    expect(legacyMap).toEqual({
      overview: 'console',
      screenplay: 'screenplay',
      phases: 'plan',
      calendar: 'schedule',
      'master-calendar': 'tasks',
      crew: 'people',
      constraints: 'compliance',
      telemetry: 'intelligence',
      assets: 'vault'
    });
  });

  it('guarantees unique IDs and valid icons across all navigation items', () => {
    const ids = WORKSPACE_NAV_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    WORKSPACE_NAV_ITEMS.forEach(item => {
      expect(item.icon).toBeDefined();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
    });
  });
});

describe('Batch 01R: Screenplay Parsing & Scene Extraction Workflow Integrity', () => {
  const sampleFountain = `
Title: THE RESTORED PROTOCOL
Author: Screenplay Engine

EXT. ROOFTOP COMM TOWER - DUSK

Rain lashes against the satellite dish. KARRAN adjusts his headset.

KARRAN
The baseline is restored. All telemetry channels are clear.

INT. ARCHIVE VAULT - CONTINUOUS

MAYA checks the glowing server racks.

MAYA
Confirming zero data loss.
`;

  it('correctly parses screenplay scenes and assigns valid scene properties', async () => {
    const file = new File([sampleFountain], 'test-script.fountain', { type: 'text/plain' });
    const preview = await screenplayParserService.generatePreview(file);
    expect(preview.detectedScenes.length).toBe(2);

    const scene1 = preview.detectedScenes[0];
    expect(scene1.slugline).toBe('EXT. ROOFTOP COMM TOWER - DUSK');
    expect(scene1.intExt).toBe('EXT');
    expect(scene1.timeOfDay).toBe('DUSK');
    expect(scene1.characters).toContain('KARRAN');

    const scene2 = preview.detectedScenes[1];
    expect(scene2.slugline).toBe('INT. ARCHIVE VAULT - CONTINUOUS');
    expect(scene2.intExt).toBe('INT');
    expect(scene2.characters).toContain('MAYA');
  });

  it('links parsed scenes to finalized screenplay document version', async () => {
    const file = new File([sampleFountain], 'test-script.fountain', { type: 'text/plain' });
    const preview = await screenplayParserService.generatePreview(file);
    const doc = screenplayParserService.finalizeDocument(preview, {
      projectId: 'proj-001',
      customTitle: 'Production Master Draft',
      versionTag: 'v1.0-locked',
      approvedScenes: preview.detectedScenes
    });

    expect(doc.version).toBe('v1.0-locked');
    expect(doc.scenes.length).toBe(2);
    expect(doc.scenes[0].id).toBeTruthy();
    expect(doc.totalScenes).toBe(2);
  });

  it('accurately calculates and formats page eighths without precision drift', () => {
    expect(parseEighths('1 3/8')).toBe(11);
    expect(formatEighths(11)).toBe('1 3/8');
    expect(parseEighths('4/8')).toBe(4);
    expect(formatEighths(4)).toBe('4/8');
    expect(parseEighths('2')).toBe(16);
    expect(formatEighths(16)).toBe('2');
  });
});

describe('Batch 01R: Core Production Permissions & RBAC Enforcement', () => {
  it('permits authorized roles to edit production metadata', () => {
    expect(canEditProductionMetadata('Producer')).toBe(true);
    expect(canEditProductionMetadata('Director')).toBe(true);
    expect(canEditProductionMetadata('Executive Producer')).toBe(true);
    expect(canEditProductionMetadata('Line Producer')).toBe(true);
    expect(canEditProductionMetadata(undefined)).toBe(true);
  });

  it('restricts read-only and unauthorized roles from modifying metadata', () => {
    expect(canEditProductionMetadata('viewer')).toBe(false);
    expect(canEditProductionMetadata('Viewer')).toBe(false);
    expect(canEditProductionMetadata('crew_member')).toBe(false);
    expect(canEditProductionMetadata('read-only user')).toBe(false);
  });
});

describe('Batch 01R: Preserved Core Project Data Models', () => {
  it('preserves existing mock projects with complete phase, crew, and activity hierarchies', () => {
    expect(INITIAL_PROJECTS.length).toBeGreaterThan(0);
    const primary = INITIAL_PROJECTS[0];
    expect(primary.id).toBeTruthy();
    expect(primary.title).toBeTruthy();
    expect(primary.director).toBeTruthy();
    expect(primary.phases.length).toBeGreaterThan(0);
    expect(primary.constraints).toBeDefined();
    expect(primary.constraints.budgetLimit).toBeGreaterThan(0);
  });
});
