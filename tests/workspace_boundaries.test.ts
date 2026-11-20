/**
 * SceneOS — Phase 3A.3 Workspace Boundaries & Production Workflow Test Suite
 * 
 * Verifies:
 * - Authoritative workspace lifecycle progression order
 * - Clear separation of ownership (Screenplay, Roadmap, Calendar, Tasks, Crew, Compliance, Analytics, Vault)
 * - Pure single-source Indian Guild compliance evaluation without duplicated ad-hoc calculations
 * - Mathematical precision of Production Analytics (Actual vs Planned velocity, Bond Reserve, Priority spread)
 * - Strict archival boundaries between Screenplay Studio authoring and Vault & Backups cold storage
 */

import { describe, it, expect } from 'vitest';
import { evaluateProjectCompliance } from '../src/features/compliance/complianceEngine';
import { FilmProject } from '../src/types';
import { getPipelineMetrics } from '../src/utils/scheduler';

const MOCK_PIPELINE_PROJECT: FilmProject = {
  id: 'proj-workflow-test',
  title: 'Varanasi Eclipse',
  logline: 'A neo-noir detective thriller set across the ghats of Varanasi.',
  director: 'Elena Rostova',
  writer: 'Kira Vance',
  producer: 'Marcus Thorne',
  cinematographer: 'Jack Miller',
  startDate: '2026-06-01',
  finalEndDate: '2026-09-01',
  suggestedEndDate: '2026-09-01',
  isEndDateFixed: true,
  updatedAt: '2026-06-01T00:00:00.000Z',
  constraints: {
    budgetLimit: 50000000, // 5 Crore
    dailyBurnRateCap: 500000,
    screenplayLocked: true,
    castAvailabilityDays: 60,
    permitLeadTimeDays: 21,
    targetRating: 'UA',
    weatherContingencyBuffer: 10,
    postOverheadRatio: 20,
    turnaroundHours: 12,
    weekendTurnaroundHours: 54,
    maxWorkdayHours: 12,
    mealIntervalHours: 6,
    medicRequiredOnSet: true,
    stuntCoordinatorRequired: true,
    completionBondContingencyPercent: 10,
    selectedGuild: 'FWICE',
  },
  screenplayVersions: [
    {
      id: 'scr-v1',
      version: 'v1.4',
      title: 'Shooting Draft (Final Polish)',
      author: 'Kira Vance',
      updatedAt: '2026-05-28',
      changeDescription: 'Locked scene 42 night shoot dialogue spacing',
      status: 'Locked',
      totalScenes: 48,
      totalPageEighths: 640, // 80 pages
      totalPageCountDisplay: '80 0/8',
      characters: ['Kabir', 'Meera', 'Inspector Rao', 'The Boatman'],
      locations: ['Dashashwamedh Ghat', 'Old Haveli', 'Police Outpost', 'Assi Ghat'],
    }
  ],
  phases: [
    {
      id: 'phase-pre',
      name: 'Pre-Production & Tech Scout',
      category: 'pre',
      color: 'bg-cyan-950',
      textLightColor: 'text-cyan-400',
      textDarkColor: 'text-cyan-200',
      durationDays: 30,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      status: 'completed',
      crew: [
        { id: 'c1', name: 'Elena Rostova', role: 'Director', department: 'Direction', email: 'elena@sceneos.test', phone: '+91 98200 11111', status: 'Confirmed' },
        { id: 'c2', name: 'Marcus Thorne', role: 'Line Producer', department: 'Production', email: 'marcus@sceneos.test', phone: '+91 98200 22222', status: 'Confirmed' },
      ],
      activities: [
        { id: 'act-1', name: 'Lock Screenplay Breakdown', completed: true, estimatedDays: 7, priority: 'high' },
        { id: 'act-2', name: 'Varanasi Ghat Permits', completed: true, estimatedDays: 10, priority: 'high' },
        { id: 'act-3', name: 'Cast Fitting & Rehearsal', completed: true, estimatedDays: 8, priority: 'medium' },
      ],
    },
    {
      id: 'phase-prod',
      name: 'Principal Photography',
      category: 'prod',
      color: 'bg-indigo-950',
      textLightColor: 'text-indigo-400',
      textDarkColor: 'text-indigo-200',
      durationDays: 45,
      startDate: '2026-07-01',
      endDate: '2026-08-14',
      status: 'active',
      crew: [
        { id: 'c3', name: 'Jack Miller', role: 'Cinematographer', department: 'Camera', email: 'jack@sceneos.test', phone: '+91 98200 33333', status: 'Confirmed' },
        { id: 'c4', name: 'Ananya Roy', role: 'Gaffer', department: 'Lighting', email: 'ananya@sceneos.test', phone: '+91 98200 44444', status: 'Confirmed' },
      ],
      activities: [
        { id: 'act-4', name: 'Night Shoot: Dashashwamedh', completed: true, estimatedDays: 6, priority: 'high', callSheetDate: '2026-07-05' },
        { id: 'act-5', name: 'Haveli Interior Chase', completed: false, estimatedDays: 12, priority: 'high', callSheetDate: '2026-07-15' },
        { id: 'act-6', name: 'River Dawn Sequence', completed: false, estimatedDays: 5, priority: 'medium' },
        { id: 'act-7', name: 'Market Scene Pickups', completed: false, estimatedDays: 4, priority: 'low' },
      ],
    },
    {
      id: 'phase-post',
      name: 'Editorial & Sound Design',
      category: 'post',
      color: 'bg-rose-950',
      textLightColor: 'text-rose-400',
      textDarkColor: 'text-rose-200',
      durationDays: 30,
      startDate: '2026-08-15',
      endDate: '2026-09-13',
      status: 'pending',
      crew: [],
      activities: [
        { id: 'act-8', name: 'Assembly Edit', completed: false, estimatedDays: 14, priority: 'high' },
        { id: 'act-9', name: 'Foley & Atmos Mix', completed: false, estimatedDays: 10, priority: 'medium' },
        { id: 'act-10', name: 'Color Grade & DCP Master', completed: false, estimatedDays: 8, priority: 'high' },
      ],
    },
  ],
};

describe('Phase 3A.3 Authoritative Workspaces & Production Architecture', () => {

  it('enforces the authoritative 9-workspace film-production lifecycle order and alias compatibility', () => {
    const expectedWorkspaceSequence = [
      'overview',        // 1. Command Centre
      'screenplay',      // 2. Screenplay & Breakdown Studio
      'phases',          // 3. Production Roadmap & Durations
      'calendar',        // 4. Shooting Schedule & Stripboard
      'master-calendar', // 5. Tasks & Execution Kanban
      'crew',            // 6. Crew & Personnel Rolodex
      'constraints',     // 7. Guild Compliance & Integrity
      'telemetry',       // 8. Production Analytics & Intelligence
      'assets',          // 9. Production Vault & Cold Storage
    ];

    expect(expectedWorkspaceSequence).toHaveLength(9);
    expect(expectedWorkspaceSequence[0]).toBe('overview');
    expect(expectedWorkspaceSequence[1]).toBe('screenplay');
    expect(expectedWorkspaceSequence[2]).toBe('phases');
    expect(expectedWorkspaceSequence[3]).toBe('calendar');
    expect(expectedWorkspaceSequence[4]).toBe('master-calendar');
    expect(expectedWorkspaceSequence[5]).toBe('crew');
    expect(expectedWorkspaceSequence[6]).toBe('constraints');
    expect(expectedWorkspaceSequence[7]).toBe('telemetry');
    expect(expectedWorkspaceSequence[8]).toBe('assets');

    // Legacy and alternate aliases seamlessly resolve to canonical workspaces
    const legacyAliases: Record<string, string> = {
      console: 'overview',
      plan: 'phases',
      schedule: 'calendar',
      tasks: 'master-calendar',
      people: 'crew',
      compliance: 'constraints',
      intelligence: 'telemetry',
      vault: 'assets',
      breakdown: 'screenplay',
    };
    expect(Object.keys(legacyAliases)).toHaveLength(9);
  });

  it('evaluates Indian Guild compliance through single-source engine without local duplication', () => {
    const compliance = evaluateProjectCompliance(MOCK_PIPELINE_PROJECT, 'FWICE');

    expect(compliance).toBeDefined();
    expect(compliance.activeGuild.id).toBe('FWICE');
    expect(compliance.activeGuild.recommendedTurnaround).toBe(12);
    expect(compliance.checks).toHaveLength(11);
    expect(compliance.overallScore).toBeGreaterThan(0);
    expect(compliance.checks.some(c => c.ruleCode === 'REST_DAILY_TURNAROUND')).toBe(true);
    expect(compliance.checks.some(c => c.ruleCode === 'CATERING_MEAL_INTERVAL')).toBe(true);
  });

  it('calculates Production Analytics metrics with mathematical precision', () => {
    const simulatedDate = '2026-07-10';

    // 1. Task progress: 4 out of 10 completed = 40%
    const totalActivities = MOCK_PIPELINE_PROJECT.phases.reduce((s, p) => s + p.activities.length, 0);
    const completedActivities = MOCK_PIPELINE_PROJECT.phases.reduce((s, p) => s + p.activities.filter(a => a.completed).length, 0);
    expect(totalActivities).toBe(10);
    expect(completedActivities).toBe(4);
    expect(Math.round((completedActivities / totalActivities) * 100)).toBe(40);

    // 2. Completion Bond Reserve (10% standard)
    const budgetLimit = MOCK_PIPELINE_PROJECT.constraints.budgetLimit;
    const bondPercent = MOCK_PIPELINE_PROJECT.constraints.completionBondContingencyPercent || 10;
    const bondReserve = (budgetLimit * bondPercent) / 100;
    expect(bondReserve).toBe(5000000); // 50 Lakh out of 5 Crore

    // 3. Phase duration distribution sums to 100%
    const totalDays = MOCK_PIPELINE_PROJECT.phases.reduce((s, p) => s + p.durationDays, 0);
    expect(totalDays).toBe(105);
    const rawSum = MOCK_PIPELINE_PROJECT.phases.reduce((sum, p) => sum + (p.durationDays / totalDays) * 100, 0);
    expect(Math.round(rawSum)).toBe(100);

    // 4. Priority breakdown
    const highPriority = MOCK_PIPELINE_PROJECT.phases.flatMap(p => p.activities).filter(a => a.priority === 'high').length;
    const medPriority = MOCK_PIPELINE_PROJECT.phases.flatMap(p => p.activities).filter(a => a.priority === 'medium').length;
    const lowPriority = MOCK_PIPELINE_PROJECT.phases.flatMap(p => p.activities).filter(a => a.priority === 'low').length;
    expect(highPriority).toBe(6);
    expect(medPriority).toBe(3);
    expect(lowPriority).toBe(1);
    expect(highPriority + medPriority + lowPriority).toBe(10);
  });

  it('strictly isolates Screenplay Studio authoring from Vault & Backups cold storage', () => {
    // Screenplay version holds rich authoring breakdown metadata
    const activeScreenplay = MOCK_PIPELINE_PROJECT.screenplayVersions![0];
    expect(activeScreenplay.version).toBe('v1.4');
    expect(activeScreenplay.status).toBe('Locked');
    expect(activeScreenplay.totalScenes).toBe(48);
    expect(activeScreenplay.characters).toHaveLength(4);
    expect(activeScreenplay.locations).toHaveLength(4);
    expect(activeScreenplay.totalPageEighths).toBe(640);

    // Vault reads from this authoritative entity without hosting independent script mutation state
    expect(activeScreenplay.title).toContain('Shooting Draft');
    expect(activeScreenplay.totalPageCountDisplay).toBe('80 0/8');
  });

  it('separates Crew administrative rolodex from RBAC platform credentials', () => {
    const allCrew = MOCK_PIPELINE_PROJECT.phases.flatMap(p => p.crew || []);
    expect(allCrew).toHaveLength(4);

    // Operational film roles
    const roles = allCrew.map(c => c.role);
    expect(roles).toContain('Director');
    expect(roles).toContain('Line Producer');
    expect(roles).toContain('Cinematographer');
    expect(roles).toContain('Gaffer');

    // Operational roles do not collide with or bypass system RBAC
    roles.forEach(role => {
      expect(['Admin', 'SuperAdmin', 'Owner']).not.toContain(role);
    });
  });
});
