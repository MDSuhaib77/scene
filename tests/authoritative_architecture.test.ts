import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WORKSPACE_NAV_ITEMS } from '../src/components/navigation/AppSidebar';

describe('Authoritative Product Architecture & Submodule Integration', () => {
  const root = path.resolve(__dirname, '..');

  it('verifies BreakdownWorkspace incorporates Stripboard reordering without duplicating CalendarModule', () => {
    const breakdownContent = fs.readFileSync(
      path.join(root, 'src/features/breakdown/BreakdownWorkspace.tsx'),
      'utf-8'
    );
    // Submodule registered and activated
    expect(breakdownContent).toContain("id: 'stripboards'");
    expect(breakdownContent).toContain("status: 'active'");
    expect(breakdownContent).toContain("handleMoveStripUp");
    expect(breakdownContent).toContain("handleMoveStripDown");
    expect(breakdownContent).toContain("Transfer to Calendar Schedule");
    // Industry strip standards
    expect(breakdownContent).toContain("INT DAY (White)");
    expect(breakdownContent).toContain("EXT DAY (Yellow)");
    expect(breakdownContent).toContain("INT NIGHT (Green)");
    expect(breakdownContent).toContain("EXT NIGHT (Blue)");
  });

  it('verifies VisualizeWorkspace establishes strictly three foundation workspaces with no fake sample data', () => {
    const visualizeContent = fs.readFileSync(
      path.join(root, 'src/features/visualize/VisualizeWorkspace.tsx'),
      'utf-8'
    );
    expect(visualizeContent).toContain('visualize-navigation-bar');
    expect(visualizeContent).toContain('visualize-tab-${ws.id}');
    expect(visualizeContent).not.toContain('DEMO_PARSED_SCENES');
    expect(visualizeContent).not.toContain('Blade Runner 2049');
    expect(visualizeContent).not.toContain("id: 'visual-refs'");
  });

  it('verifies ShootWorkspace incorporates DPR and Variance Tracking distinct from planned schedule', () => {
    const shootContent = fs.readFileSync(
      path.join(root, 'src/features/shoot/ShootWorkspace.tsx'),
      'utf-8'
    );
    expect(shootContent).toContain("id: 'dpr'");
    expect(shootContent).toContain("status: 'active'");
    expect(shootContent).toContain("Daily Production Report (DPR)");
    expect(shootContent).toContain("Audit log comparing planned schedule expectations with verified on-set execution");
    expect(shootContent).toContain("CAMERA SETUPS");
    expect(shootContent).toContain("SHIFT OVERTIME");
    expect(shootContent).toContain("Logged Set Delays & Incidents");
    expect(shootContent).toContain("DIT & Media Vault Sync");
  });

  it('verifies ProjectOverview.tsx is strictly untouched and intact', () => {
    const overviewContent = fs.readFileSync(
      path.join(root, 'src/components/ProjectOverview.tsx'),
      'utf-8'
    );
    expect(overviewContent).not.toContain('LinearProductionStepper');
    expect(overviewContent).not.toContain('PhaseTaskConfigurationBoard');
    expect(overviewContent).toContain('Execution Telemetry');
    expect(overviewContent).toContain('Production Readiness');
    expect(overviewContent).toContain('Schedule Forecast');
    expect(overviewContent).toContain('integrated-production-pulse');
  });

  it('verifies AppSidebar.tsx strictly retains all 9 standard navigation items in their canonical order', () => {
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
      'assets',
    ]);
  });
});
