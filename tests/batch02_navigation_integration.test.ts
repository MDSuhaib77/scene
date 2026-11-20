import { describe, it, expect } from 'vitest';
import { WORKSPACE_NAV_ITEMS } from '../src/components/navigation/AppSidebar';
import { getProductionWorkflowSteps, getFeatureGateConfig } from '../src/utils/productionWorkflow';
import { INITIAL_PROJECTS } from '../src/data/mockProjects';

describe('Batch 02: Sidebar Baseline & Navigation Integrity', () => {
  it('strictly retains the 9 established core sidebar navigation items', () => {
    expect(WORKSPACE_NAV_ITEMS).toHaveLength(9);
    expect(WORKSPACE_NAV_ITEMS.map(item => item.id)).toEqual([
      'overview',
      'screenplay',
      'phases',
      'calendar',
      'master-calendar',
      'crew',
      'constraints',
      'telemetry',
      'assets',
    ]);
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

describe('Batch 02: Five Production Workspaces & Submodule Mapping', () => {
  const project = INITIAL_PROJECTS[0];

  it('evaluates the 7-step linear production workflow against actual FilmProject data', () => {
    const steps = getProductionWorkflowSteps(project);
    expect(steps).toHaveLength(7);

    // Verify all 5 conceptual stages are represented across the workflow steps
    const stages = new Set(steps.map(s => s.stageId));
    expect(stages.has('write')).toBe(true);
    expect(stages.has('breakdown')).toBe(true);
    expect(stages.has('visualize')).toBe(true);
    expect(stages.has('plan')).toBe(true);
    expect(stages.has('shoot')).toBe(true);
  });

  it('verifies genuine prerequisites for planned StudioBinder submodules', () => {
    // 1. AV Scripts (WRITE)
    const avGate = getFeatureGateConfig('write-av', project);
    expect(avGate).not.toBeNull();
    expect(avGate?.stage).toBe('WRITE');
    expect(avGate?.stageNumber).toBe(1);
    expect(avGate?.prerequisiteMet).toBe(true); // Initial project has screenplay draft
    expect(avGate?.dataContract.fields).toContain('audioCues[]');

    // 2. Script Sides (BREAKDOWN)
    const sidesGate = getFeatureGateConfig('breakdown-sides', project);
    expect(sidesGate).not.toBeNull();
    expect(sidesGate?.stage).toBe('BREAKDOWN');
    expect(sidesGate?.stageNumber).toBe(2);
    expect(sidesGate?.prerequisiteMet).toBe(true); // Project has parsed scenes

    // 3. Shot Lists (VISUALIZE)
    const shotsGate = getFeatureGateConfig('visualize-shots', project);
    expect(shotsGate).not.toBeNull();
    expect(shotsGate?.stage).toBe('VISUALIZE');
    expect(shotsGate?.stageNumber).toBe(3);
    expect(shotsGate?.dataContract.name).toBe('ShotListItem');

    // 4. Resources / Gear Packages (PLAN)
    const resourcesGate = getFeatureGateConfig('plan-resources', project);
    expect(resourcesGate).not.toBeNull();
    expect(resourcesGate?.stage).toBe('PLAN');
    expect(resourcesGate?.stageNumber).toBe(4);

    // 5. Daily Call Sheets (SHOOT)
    const callSheetsGate = getFeatureGateConfig('shoot-callsheets', project);
    expect(callSheetsGate).not.toBeNull();
    expect(callSheetsGate?.stage).toBe('SHOOT');
    expect(callSheetsGate?.stageNumber).toBe(5);

    // 6. Daily Production Reports (SHOOT)
    const dprGate = getFeatureGateConfig('shoot-dpr', project);
    expect(dprGate).not.toBeNull();
    expect(dprGate?.stage).toBe('SHOOT');
    expect(dprGate?.stageNumber).toBe(5);
  });

  it('honestly reports unmet prerequisites when dependencies are absent', () => {
    const emptyProject = {
      ...project,
      screenplayVersions: [],
      phases: [],
    };

    const avGate = getFeatureGateConfig('write-av', emptyProject);
    expect(avGate?.prerequisiteMet).toBe(false);

    const sidesGate = getFeatureGateConfig('breakdown-sides', emptyProject);
    expect(sidesGate?.prerequisiteMet).toBe(false);

    const callSheetsGate = getFeatureGateConfig('shoot-callsheets', emptyProject);
    expect(callSheetsGate?.prerequisiteMet).toBe(false);
  });
});

describe('Batch 02: Overview Command Centre Protection', () => {
  it('confirms the 9 sidebar navigation items do not alter overview destination', () => {
    const overviewItem = WORKSPACE_NAV_ITEMS.find(i => i.id === 'overview');
    expect(overviewItem).toBeDefined();
    expect(overviewItem?.legacyId).toBe('console');
    expect(overviewItem?.name).toBe('Overview');
  });
});
