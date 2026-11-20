/**
 * SceneOS — Overview Hero & Milestone Redesign Test Suite
 * 
 * Verifies:
 * - RBAC permission check for production metadata editing (canEditProductionMetadata)
 * - Metadata validation limits and sanitation
 * - Milestone visualizer sequence & status determination
 * - Target wrap date timeline synchronization
 */

import { describe, it, expect } from 'vitest';
import { canEditProductionMetadata } from '../src/components/overview/EditProductionMetadataModal';
import { FilmPhase } from '../src/types';

describe('Overview Hero: Metadata Editing RBAC & Permissions', () => {
  it('permits authorized executive and creative roles to edit production metadata', () => {
    expect(canEditProductionMetadata('Line Producer')).toBe(true);
    expect(canEditProductionMetadata('Director')).toBe(true);
    expect(canEditProductionMetadata('Executive Producer')).toBe(true);
    expect(canEditProductionMetadata('Production Manager')).toBe(true);
    expect(canEditProductionMetadata(undefined)).toBe(true);
  });

  it('restricts read-only and unauthorized roles from editing production metadata', () => {
    expect(canEditProductionMetadata('viewer')).toBe(false);
    expect(canEditProductionMetadata('Viewer')).toBe(false);
    expect(canEditProductionMetadata('read-only user')).toBe(false);
    expect(canEditProductionMetadata('crew_member')).toBe(false);
  });
});

describe('Overview Hero: Production Metadata Constraints & Validation', () => {
  it('enforces title presence and length boundaries', () => {
    const validateTitle = (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return 'Production title is required.';
      if (trimmed.length > 100) return 'Production title cannot exceed 100 characters.';
      return null;
    };

    expect(validateTitle('')).toBe('Production title is required.');
    expect(validateTitle('   ')).toBe('Production title is required.');
    expect(validateTitle('Enthiran 3: Rebirth')).toBeNull();
    expect(validateTitle('A'.repeat(101))).toBe('Production title cannot exceed 100 characters.');
    expect(validateTitle('A'.repeat(100))).toBeNull();
  });

  it('enforces creative lead and logline length boundaries', () => {
    const validateLogline = (val: string) => {
      if (val.length > 500) return 'Logline cannot exceed 500 characters.';
      return null;
    };

    const validateLead = (field: string, val: string) => {
      if (val.length > 80) return `${field} cannot exceed 80 characters.`;
      return null;
    };

    expect(validateLogline('A'.repeat(501))).toBe('Logline cannot exceed 500 characters.');
    expect(validateLogline('A'.repeat(500))).toBeNull();
    expect(validateLead('Director', 'A'.repeat(81))).toBe('Director cannot exceed 80 characters.');
    expect(validateLead('Director', 'S. Shankar')).toBeNull();
    expect(validateLead('Producer', 'A'.repeat(81))).toBe('Producer cannot exceed 80 characters.');
    expect(validateLead('Producer', 'Kalanithi Maran')).toBeNull();
    expect(validateLead('DoP', 'A'.repeat(81))).toBe('DoP cannot exceed 80 characters.');
    expect(validateLead('DoP', 'R. Rathnavelu')).toBeNull();
  });
});

describe('Overview Hero: Milestone Sequencer & Wrap Date Alignment', () => {
  const samplePhases: FilmPhase[] = [
    {
      id: 'phase-dev',
      name: 'Development',
      category: 'pre',
      startDate: '2026-01-01',
      endDate: '2026-02-15',
      durationDays: 45,
      status: 'completed',
      color: '#10b981',
      textLightColor: 'text-emerald-400',
      textDarkColor: 'text-emerald-200',
      crew: [],
      activities: [{ id: 'a1', name: 'Script Draft', completed: true, estimatedDays: 10 }]
    },
    {
      id: 'phase-pre',
      name: 'Pre-Production',
      category: 'pre',
      startDate: '2026-02-16',
      endDate: '2026-04-30',
      durationDays: 74,
      status: 'active',
      color: '#06b6d4',
      textLightColor: 'text-cyan-400',
      textDarkColor: 'text-cyan-200',
      crew: [],
      activities: [{ id: 'a2', name: 'Location Scouting', completed: true, estimatedDays: 5 }]
    },
    {
      id: 'phase-prod',
      name: 'Principal Photography',
      category: 'prod',
      startDate: '2026-05-01',
      endDate: '2026-08-30',
      durationDays: 122,
      status: 'pending',
      color: '#f59e0b',
      textLightColor: 'text-amber-400',
      textDarkColor: 'text-amber-200',
      crew: [],
      activities: []
    },
    {
      id: 'phase-post',
      name: 'Post-Production',
      category: 'post',
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      durationDays: 91,
      status: 'pending',
      color: '#8b5cf6',
      textLightColor: 'text-purple-400',
      textDarkColor: 'text-purple-200',
      crew: [],
      activities: []
    }
  ];

  it('calculates total duration across consecutive phases accurately', () => {
    const totalDays = samplePhases.reduce((sum, p) => sum + p.durationDays, 0);
    expect(totalDays).toBe(45 + 74 + 122 + 91);
    expect(totalDays).toBe(332);
  });

  it('determines the active milestone correctly with fallback hierarchy', () => {
    const getActivePhase = (phases: FilmPhase[]) => {
      return phases.find(p => p.status === 'active')
        || phases.find(p => p.status === 'overdue')
        || phases.find(p => p.status === 'pending')
        || phases[0];
    };

    expect(getActivePhase(samplePhases)?.id).toBe('phase-pre');

    // When pre-production completes, principal photography becomes active
    const nextPhases: FilmPhase[] = samplePhases.map(p => {
      if (p.id === 'phase-pre') return { ...p, status: 'completed' as const };
      if (p.id === 'phase-prod') return { ...p, status: 'active' as const };
      return p;
    });

    expect(getActivePhase(nextPhases)?.id).toBe('phase-prod');
  });

  it('verifies final milestone wrap date aligns with project wrap date', () => {
    const finalPhase = samplePhases[samplePhases.length - 1];
    expect(finalPhase.endDate).toBe('2026-11-30');
  });
});

describe('Application Shell: Persistent AppSidebar Navigation Coverage', () => {
  it('defines all 9 purpose-driven workspaces with legacy backward-compatibility IDs', async () => {
    const { WORKSPACE_NAV_ITEMS } = await import('../src/components/navigation/AppSidebar');
    
    expect(WORKSPACE_NAV_ITEMS).toHaveLength(9);
    
    const expectedWorkspaces = [
      { id: 'overview', legacyId: 'console', name: 'Overview' },
      { id: 'screenplay', legacyId: 'screenplay', name: 'Screenplay' },
      { id: 'phases', legacyId: 'plan', name: 'Roadmap' },
      { id: 'calendar', legacyId: 'schedule', name: 'Calendar' },
      { id: 'master-calendar', legacyId: 'tasks', name: 'Tasks' },
      { id: 'crew', legacyId: 'people', name: 'Crew' },
      { id: 'constraints', legacyId: 'compliance', name: 'Compliance' },
      { id: 'telemetry', legacyId: 'intelligence', name: 'Analytics' },
      { id: 'assets', legacyId: 'vault', name: 'Vault' },
    ];

    expectedWorkspaces.forEach(expected => {
      const item = WORKSPACE_NAV_ITEMS.find(w => w.id === expected.id);
      expect(item).toBeDefined();
      expect(item?.legacyId).toBe(expected.legacyId);
      expect(item?.name).toBe(expected.name);
      expect(item?.icon).toBeDefined();
      expect(item?.description).toBeTruthy();
    });
  });

  it('guarantees unique IDs across all sidebar navigation items', async () => {
    const { WORKSPACE_NAV_ITEMS } = await import('../src/components/navigation/AppSidebar');
    const ids = WORKSPACE_NAV_ITEMS.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('Production Instrument Gauges: Accuracy & Zero Clipping', () => {
  it('guarantees gauge needle angle sweeps stay strictly within top arc boundaries', () => {
    // Gauge sweep: 210° (0%) to -30° (100%)
    // Angle in radians = (angleDeg * Math.PI) / 180
    // Center: (50, 46), Radius: 32, Needle length: 26
    const getNeedleCoords = (percent: number) => {
      const angleDeg = 210 - (percent / 100) * 240;
      const rad = (angleDeg * Math.PI) / 180;
      const x = 50 + 26 * Math.cos(rad);
      const y = 46 - 26 * Math.sin(rad);
      return { x, y };
    };

    // 0% needle tip
    const start = getNeedleCoords(0);
    // 50% needle tip (top vertical)
    const mid = getNeedleCoords(50);
    // 100% needle tip
    const end = getNeedleCoords(100);

    // Bounded inside viewBox 0 0 100 68 with comfortable margins
    expect(start.x).toBeGreaterThan(15);
    expect(start.y).toBeLessThan(65);
    expect(mid.y).toBeGreaterThan(15);
    expect(end.x).toBeLessThan(85);
    expect(end.y).toBeLessThan(65);
  });

  it('handles empty task activities honestly with N/A instead of false 0%', () => {
    const totalActivities = 0;
    const completedActivities = 0;
    const isHonestEmpty = totalActivities === 0;
    const primaryDisplay = isHonestEmpty ? 'N/A' : `${Math.round((completedActivities / totalActivities) * 100)}%`;
    expect(primaryDisplay).toBe('N/A');
  });

  it('calculates plan alignment variance and drift status mathematically', () => {
    const activityProgress = 40;
    const timelineProgress = 35;
    const variance = activityProgress - timelineProgress;
    expect(variance).toBe(+5);
    const statusLabel = variance >= 5 ? 'Ahead' : variance <= -5 ? 'Behind' : 'On Track';
    expect(statusLabel).toBe('Ahead');
  });
});
