import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { 
  SCENEOS_MODULE_HIERARCHY, 
  findModuleByTabId 
} from '../src/components/navigation/navigationHierarchy';
import { WORKSPACE_NAV_ITEMS } from '../src/components/navigation/AppSidebar';

describe('SceneOS — Master Left Sidebar Information Architecture (A through O)', () => {
  const root = path.resolve(__dirname, '..');

  it('verifies the authoritative 15-module functional hierarchy from A to O', () => {
    const expectedModules = [
      { id: 'overview', name: 'Overview' },
      { id: 'screenplay', name: 'Screenplay' },
      { id: 'breakdown', name: 'Breakdown' },
      { id: 'visualize', name: 'Visualize' },
      { id: 'calendar', name: 'Schedule' },
      { id: 'crew', name: 'People' },
      { id: 'resources', name: 'Resources' },
      { id: 'master-calendar', name: 'Tasks' },
      { id: 'shoot', name: 'Production Day' },
      { id: 'budget', name: 'Budget' },
      { id: 'constraints', name: 'Compliance & Safety' },
      { id: 'telemetry', name: 'Analytics' },
      { id: 'assets', name: 'Vault' },
      { id: 'collaboration', name: 'Collaboration' },
      { id: 'settings', name: 'Project Settings' },
    ];

    expect(SCENEOS_MODULE_HIERARCHY).toHaveLength(expectedModules.length);

    expectedModules.forEach((expected, idx) => {
      const actual = SCENEOS_MODULE_HIERARCHY[idx];
      expect(actual.id).toBe(expected.id);
      expect(actual.name).toBe(expected.name);
      expect(actual.icon).toBeDefined();
      expect(actual.description).toBeTruthy();
    });
  });

  it('verifies progressive disclosure submodules inside core production modules', () => {
    // 1. Screenplay Module (Authoritative 2 Submodules: Script Library, AV Script)
    const screenplayMod = SCENEOS_MODULE_HIERARCHY.find(m => m.id === 'screenplay');
    expect(screenplayMod).toBeDefined();
    expect(screenplayMod?.submodules.length).toBe(2);
    const screenplaySubIds = screenplayMod?.submodules.map(s => s.id) || [];
    expect(screenplaySubIds).toContain('screenplay-library');
    expect(screenplaySubIds).toContain('screenplay-av');
    expect(screenplaySubIds).not.toContain('screenplay-intelligence');

    // 2. Breakdown Module
    const breakdownMod = SCENEOS_MODULE_HIERARCHY.find(m => m.id === 'breakdown');
    expect(breakdownMod).toBeDefined();
    const breakdownSubIds = breakdownMod?.submodules.map(s => s.id) || [];
    expect(breakdownSubIds).toContain('breakdown-scenes');
    expect(breakdownSubIds).toContain('breakdown-intelligence');
    expect(breakdownSubIds).toContain('breakdown-elements');
    expect(breakdownSubIds).toContain('breakdown-reports');
    expect(breakdownSubIds).toContain('breakdown-stripboard');
    expect(breakdownSubIds).toContain('breakdown-sides');

    // 3. Visualize Module
    const visualizeMod = SCENEOS_MODULE_HIERARCHY.find(m => m.id === 'visualize');
    expect(visualizeMod).toBeDefined();
    const visualizeSubIds = visualizeMod?.submodules.map(s => s.id) || [];
    expect(visualizeSubIds).toContain('visualize-storyboards');
    expect(visualizeSubIds).toContain('visualize-shot-lists');
    expect(visualizeSubIds).toContain('visualize-lookbooks');

    // 4. Production Day Module
    const shootMod = SCENEOS_MODULE_HIERARCHY.find(m => m.id === 'shoot');
    expect(shootMod).toBeDefined();
    const shootSubIds = shootMod?.submodules.map(s => s.id) || [];
    expect(shootSubIds).toContain('shoot-call-sheets');
    expect(shootSubIds).toContain('shoot-progress');
    expect(shootSubIds).toContain('shoot-dpr');
    expect(shootSubIds).toContain('shoot-locations');
  });

  it('verifies findModuleByTabId resolves both standard IDs and legacy aliases', () => {
    expect(findModuleByTabId('overview')?.id).toBe('overview');
    expect(findModuleByTabId('console')?.id).toBe('overview');
    expect(findModuleByTabId('screenplay')?.id).toBe('screenplay');
    expect(findModuleByTabId('script')?.id).toBe('screenplay');
    expect(findModuleByTabId('calendar')?.id).toBe('calendar');
    expect(findModuleByTabId('schedule')?.id).toBe('calendar');
    expect(findModuleByTabId('phases')?.id).toBe('calendar');
    expect(findModuleByTabId('plan')?.id).toBe('calendar');
    expect(findModuleByTabId('crew')?.id).toBe('crew');
    expect(findModuleByTabId('people')?.id).toBe('crew');
  });

  it('verifies deep linking initialSubmodule support across child workspaces', () => {
    // Screenplay workspace accepts initialSubmodule (if installed)
    const screenplayPath = path.join(root, 'src/features/screenplay/ScreenplayWorkspace.tsx');
    if (fs.existsSync(screenplayPath)) {
      const screenplaySrc = fs.readFileSync(screenplayPath, 'utf-8');
      expect(screenplaySrc).toContain('initialSubmodule?: string');
      expect(screenplaySrc).toContain("initialSubmodule === 'upload'");
    }

    // Breakdown workspace accepts initialSubmodule
    const breakdownSrc = fs.readFileSync(path.join(root, 'src/features/breakdown/BreakdownWorkspace.tsx'), 'utf-8');
    expect(breakdownSrc).toContain('initialSubmodule?: string');
    expect(breakdownSrc).toContain('setActiveSubmodule(initialSubmodule)');

    // Visualize workspace accepts initialSubmodule
    const visualizeSrc = fs.readFileSync(path.join(root, 'src/features/visualize/VisualizeWorkspace.tsx'), 'utf-8');
    expect(visualizeSrc).toContain('initialSubmodule?: string');
    expect(visualizeSrc).toContain('setActiveSubmodule(initialSubmodule)');

    // Shoot workspace accepts initialSubmodule
    const shootSrc = fs.readFileSync(path.join(root, 'src/features/shoot/ShootWorkspace.tsx'), 'utf-8');
    expect(shootSrc).toContain('initialSubmodule?: string');
    expect(shootSrc).toContain('setActiveSubmodule(initialSubmodule)');

    // App.tsx connects activeSubmoduleId to all workspaces
    const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf-8');
    expect(appSrc).toContain('activeSubmoduleId');
    expect(appSrc).toContain('initialSubmodule={activeSubmoduleId || undefined}');
  });

  it('strictly protects ProjectOverview.tsx from regressions', () => {
    const overviewContent = fs.readFileSync(path.join(root, 'src/components/ProjectOverview.tsx'), 'utf-8');
    expect(overviewContent).not.toContain('LinearProductionStepper');
    expect(overviewContent).not.toContain('<LinearProductionStepper');
    expect(overviewContent).toContain('Execution Telemetry');
    expect(overviewContent).toContain('Production Readiness');
    expect(overviewContent).toContain('Schedule Forecast');
  });
});
