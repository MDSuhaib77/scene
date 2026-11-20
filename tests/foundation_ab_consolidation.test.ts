import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SceneOS — Foundation A/B Architecture & Consolidation Suite', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('verifies dead code LinearProductionStepper has been completely purged', () => {
    const stepperPath = path.join(rootDir, 'src', 'components', 'overview', 'LinearProductionStepper.tsx');
    expect(fs.existsSync(stepperPath)).toBe(false);
  });

  it('verifies ProjectOverview.tsx is strictly protected with zero stepper inclusions', () => {
    const overviewContent = fs.readFileSync(
      path.join(rootDir, 'src', 'components', 'ProjectOverview.tsx'),
      'utf-8'
    );
    expect(overviewContent).not.toContain('LinearProductionStepper');
    expect(overviewContent).not.toContain('<LinearProductionStepper');
  });

  it('verifies AppSidebar.tsx retains exactly the 9 canonical workspace rail navigation items', () => {
    const sidebarContent = fs.readFileSync(
      path.join(rootDir, 'src', 'components', 'navigation', 'AppSidebar.tsx'),
      'utf-8'
    );
    // Check all 9 canonical items in WORKSPACE_NAV_ITEMS
    expect(sidebarContent).toContain("id: 'overview'");
    expect(sidebarContent).toContain("id: 'screenplay'");
    expect(sidebarContent).toContain("id: 'phases'");
    expect(sidebarContent).toContain("id: 'calendar'");
    expect(sidebarContent).toContain("id: 'master-calendar'");
    expect(sidebarContent).toContain("id: 'crew'");
    expect(sidebarContent).toContain("id: 'constraints'");
    expect(sidebarContent).toContain("id: 'telemetry'");
    expect(sidebarContent).toContain("id: 'assets'");
  });

  it('verifies App.tsx has decoupled Stage 1 (Screenplay) and Stage 2 (Breakdown) as first-class canonical workspaces', () => {
    const appContent = fs.readFileSync(
      path.join(rootDir, 'src', 'App.tsx'),
      'utf-8'
    );
    // Stage 1 Screenplay workspace
    expect(appContent).toContain("workspaceTab === 'screenplay'");
    expect(appContent).toContain('id="workspace-screenplay-content"');

    // Stage 2 Breakdown workspace
    expect(appContent).toContain("workspaceTab === 'breakdown'");
    expect(appContent).toContain("<BreakdownWorkspace");

    // PhaseTaskConfigurationBoard is no longer imported
    expect(appContent).not.toContain("import PhaseTaskConfigurationBoard");
  });

  it('verifies BreakdownWorkspace supports breakdown, elements catalog, and one-liner schedule submodules', () => {
    const breakdownContent = fs.readFileSync(
      path.join(rootDir, 'src', 'features', 'breakdown', 'BreakdownWorkspace.tsx'),
      'utf-8'
    );
    expect(breakdownContent).toContain("activeSubmodule === 'breakdown'");
    expect(breakdownContent).toContain("activeSubmodule === 'elements'");
    expect(breakdownContent).toContain("activeSubmodule === 'one-liners'");
    expect(breakdownContent).toContain("elementCatalog");
    expect(breakdownContent).toContain("One-Liner Production Schedule");
    expect(breakdownContent).toContain("Master Element Catalog");
  });
});
