/**
 * SceneOS — Adaptive Overview & Distinct Metrics Test Suite
 * 
 * Verifies:
 * 1. Execution Metric: task completion vs recorded tasks, honest empty state (N/A)
 * 2. Production Readiness Metric: deterministic evaluation of the 5 phase prerequisites
 * 3. Schedule Forecast Metric: temporal variance against baseline, lead buffer vs delay
 * 4. Actionable Warnings: severity, why it matters, source record, target tab, and in-place resolution
 * 5. Distinctness: proves the 3 metrics evaluate independent, non-duplicated concepts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateExecutionMetric,
  calculateReadinessMetric,
  calculateScheduleForecast,
  generateActionableWarnings
} from '../src/components/overview/overviewMetrics';
import { FilmProject } from '../src/types';
import { evaluateProjectCompliance } from '../src/features/compliance/complianceEngine';

const MOCK_PROJECT: FilmProject = {
  id: 'proj-adaptive-test',
  title: 'Solaris Horizon',
  logline: 'An executive production command surface test.',
  director: 'Denis Villeneuve',
  producer: 'Mary Parent',
  cinematographer: 'Roger Deakins',
  startDate: '2026-06-01',
  finalEndDate: '2026-08-30',
  suggestedEndDate: '2026-08-30',
  isEndDateFixed: true,
  updatedAt: '2026-06-01T00:00:00.000Z',
  constraints: {
    budgetLimit: 5000000,
    dailyBurnRateCap: 45000,
    screenplayLocked: true,
    castAvailabilityDays: 60,
    permitLeadTimeDays: 14,
    targetRating: 'PG-13',
    weatherContingencyBuffer: 5,
    postOverheadRatio: 15,
    turnaroundHours: 12,
    weekendTurnaroundHours: 54,
    maxWorkdayHours: 12,
    mealIntervalHours: 6,
    medicRequiredOnSet: true,
    stuntCoordinatorRequired: false,
    completionBondContingencyPercent: 10,
    selectedGuild: 'FWICE',
  },
  phases: [
    {
      id: 'phase-pre',
      name: 'Pre-Production',
      category: 'pre',
      color: 'bg-cyan-950',
      textLightColor: 'text-cyan-400',
      textDarkColor: 'text-cyan-200',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      durationDays: 30,
      status: 'completed',
      crew: [
        { id: 'c1', name: 'Alex Hunt', role: 'Production Designer', email: 'alex@set.com', phone: '555-01', status: 'Confirmed' },
      ],
      activities: [
        { id: 'a1', name: 'Location Survey', completed: true, estimatedDays: 10 },
        { id: 'a2', name: 'Storyboard Lock', completed: true, estimatedDays: 15 },
      ],
    },
    {
      id: 'phase-prod',
      name: 'Principal Photography',
      category: 'prod',
      color: 'bg-indigo-950',
      textLightColor: 'text-indigo-400',
      textDarkColor: 'text-indigo-200',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      durationDays: 31,
      status: 'active',
      crew: [
        { id: 'c2', name: 'Sarah Lin', role: 'Camera Operator', email: 'sarah@set.com', phone: '555-02', status: 'Confirmed' },
      ],
      activities: [
        { id: 'a3', name: 'Studio Shoot Week 1', completed: true, estimatedDays: 7 },
        { id: 'a4', name: 'Desert Location Shoot', completed: false, estimatedDays: 14 },
      ],
    },
    {
      id: 'phase-post',
      name: 'Post-Production',
      category: 'post',
      color: 'bg-purple-950',
      textLightColor: 'text-purple-400',
      textDarkColor: 'text-purple-200',
      startDate: '2026-08-01',
      endDate: '2026-08-30',
      durationDays: 30,
      status: 'pending',
      crew: [],
      activities: [
        { id: 'a5', name: 'Sound Mix & Color Grade', completed: false, estimatedDays: 20 },
      ],
    },
  ],
  screenplayVersions: [
    {
      id: 'sp-1',
      version: 'v1.0',
      title: 'Locked Shooting Script',
      author: 'Denis Villeneuve',
      updatedAt: '2026-05-20',
      changeDescription: 'Final revision',
      status: 'Locked',
      totalScenes: 42,
      locations: ['Stage 4', 'Dune Vista'],
    },
  ],
};

describe('Execution Metric: Actual Task Completion Measurement', () => {
  it('measures completed vs total activities accurately', () => {
    const metrics = { totalActivities: 5, completedActivities: 3, activityProgress: 60 };
    const result = calculateExecutionMetric(MOCK_PROJECT, metrics, '2026-07-10');

    expect(result.totalActivities).toBe(5);
    expect(result.completedActivities).toBe(3);
    expect(result.remainingActivities).toBe(2);
    expect(result.percentage).toBe(60);
    expect(result.primaryValue).toBe('60%');
    expect(result.secondaryValue).toBe('3/5 tasks');
    expect(result.statusLabel).toBe('In Progress');
    expect(result.statusType).toBe('info');
  });

  it('reports honest N/A when zero activities are cataloged', () => {
    const emptyProject: FilmProject = {
      ...MOCK_PROJECT,
      phases: MOCK_PROJECT.phases.map(p => ({ ...p, activities: [] })),
    };
    const metrics = { totalActivities: 0, completedActivities: 0, activityProgress: 0 };
    const result = calculateExecutionMetric(emptyProject, metrics, '2026-07-10');

    expect(result.percentage).toBeNull();
    expect(result.primaryValue).toBe('N/A');
    expect(result.statusLabel).toBe('No Tasks');
    expect(result.statusType).toBe('neutral');
  });

  it('detects overdue tasks when a phase deadline is breached', () => {
    const metrics = { totalActivities: 5, completedActivities: 3, activityProgress: 60 };
    // Simulated date is 2026-08-10, making phase-prod overdue since its endDate was 2026-07-31
    const result = calculateExecutionMetric(MOCK_PROJECT, metrics, '2026-08-10');

    expect(result.overdueActivities).toBe(1); // a4 is uncompleted in phase-prod
    expect(result.statusLabel).toBe('1 Overdue');
    expect(result.statusType).toBe('warning');
  });
});

describe('Production Readiness Metric: Phase Prerequisites Gate', () => {
  it('evaluates all 5 explicit prerequisites deterministically', () => {
    const compliance = evaluateProjectCompliance(MOCK_PROJECT);
    const result = calculateReadinessMetric(MOCK_PROJECT, compliance);

    expect(result.totalCount).toBe(5);
    expect(result.prerequisites).toHaveLength(5);

    // Screenplay lock: met (screenplayLocked is true)
    const scriptPrereq = result.prerequisites.find(p => p.id === 'prereq-script-locked');
    expect(scriptPrereq?.status).toBe('met');
    expect(scriptPrereq?.targetTab).toBe('screenplay');

    // Crew confirmation: met (both c1 and c2 are Confirmed)
    const crewPrereq = result.prerequisites.find(p => p.id === 'prereq-crew-confirmed');
    expect(crewPrereq?.status).toBe('met');
    expect(crewPrereq?.targetTab).toBe('crew');

    // Safety & turnaround: met (turnaroundHours is 12)
    const safetyPrereq = result.prerequisites.find(p => p.id === 'prereq-safety-rest');
    expect(safetyPrereq?.status).toBe('met');
    expect(safetyPrereq?.targetTab).toBe('constraints');

    // Scene breakdown: met (totalScenes = 42)
    const breakdownPrereq = result.prerequisites.find(p => p.id === 'prereq-scene-breakdown');
    expect(breakdownPrereq?.status).toBe('met');

    // Budget cap: met (budgetLimit > 0, dailyBurnRateCap > 0)
    const budgetPrereq = result.prerequisites.find(p => p.id === 'prereq-budget-contingency');
    expect(budgetPrereq?.status).toBe('met');

    // All 5 met => 100% Phase Ready
    expect(result.metCount).toBe(5);
    expect(result.percentage).toBe(100);
    expect(result.statusLabel).toBe('Phase Ready');
    expect(result.statusType).toBe('success');
  });

  it('marks readiness Blocked when screenplay is unlocked and crew is unconfirmed', () => {
    const unreadyProject: FilmProject = {
      ...MOCK_PROJECT,
      constraints: {
        ...MOCK_PROJECT.constraints,
        screenplayLocked: false,
        turnaroundHours: 10, // breaches 12h
      },
      phases: [
        {
          ...MOCK_PROJECT.phases[0],
          crew: [{ id: 'c1', name: 'John Doe', role: 'Gaffer', email: '', phone: '', status: 'Hold' }],
        },
      ],
    };

    const compliance = evaluateProjectCompliance(unreadyProject);
    const result = calculateReadinessMetric(unreadyProject, compliance);

    expect(result.metCount).toBeLessThan(5);
    expect(result.statusLabel).toBe('Blocked');
    expect(result.statusType).toBe('warning');
  });
});

describe('Schedule Forecast Metric: Temporal Variance vs Baseline', () => {
  it('reports aligned schedule when suggestedEndDate matches finalEndDate', () => {
    const metrics = { overdueDaysCount: 0 };
    const result = calculateScheduleForecast(MOCK_PROJECT, metrics, '2026-06-15');

    expect(result.hasTargetDate).toBe(true);
    expect(result.primaryValue).toBe('0d');
    expect(result.statusLabel).toBe('On Schedule');
    expect(result.statusType).toBe('success');
  });

  it('forecasts delay when suggestedEndDate exceeds finalEndDate', () => {
    const delayedProject: FilmProject = {
      ...MOCK_PROJECT,
      suggestedEndDate: '2026-09-05', // 6 days past 2026-08-30
    };
    const metrics = { overdueDaysCount: 6 };
    const result = calculateScheduleForecast(delayedProject, metrics, '2026-06-15');

    expect(result.primaryValue).toBe('+6d');
    expect(result.statusLabel).toBe('Critical Delay');
    expect(result.statusType).toBe('danger');
    expect(result.description).toContain('6 days delay forecast');
  });

  it('forecasts lead buffer when suggestedEndDate finishes before finalEndDate', () => {
    const aheadProject: FilmProject = {
      ...MOCK_PROJECT,
      suggestedEndDate: '2026-08-20', // 10 days before 2026-08-30
    };
    const metrics = { overdueDaysCount: 0 };
    const result = calculateScheduleForecast(aheadProject, metrics, '2026-06-15');

    expect(result.primaryValue).toBe('-10d');
    expect(result.statusLabel).toBe('Ahead of Target');
    expect(result.statusType).toBe('success');
    expect(result.description).toContain('10 days lead buffer');
  });

  it('reports Uncalibrated state honestly when target wrap date is unset', () => {
    const uncalibratedProject: FilmProject = {
      ...MOCK_PROJECT,
      finalEndDate: '',
      suggestedEndDate: '',
    };
    const metrics = { overdueDaysCount: 0 };
    const result = calculateScheduleForecast(uncalibratedProject, metrics, '2026-06-15');

    expect(result.hasTargetDate).toBe(false);
    expect(result.primaryValue).toBe('N/A');
    expect(result.statusLabel).toBe('Uncalibrated');
    expect(result.statusType).toBe('neutral');
  });
});

describe('Actionable Warnings Registry: Structure & Navigation Destinations', () => {
  it('generates actionable warnings with destination workspaces', () => {
    const violatedProject: FilmProject = {
      ...MOCK_PROJECT,
      constraints: {
        ...MOCK_PROJECT.constraints,
        turnaroundHours: 10, // 10h violates SAG/FWICE rule
        screenplayLocked: false,
      },
    };

    const compliance = evaluateProjectCompliance(violatedProject);
    const metrics = { overdueDaysCount: 4 };
    const warnings = generateActionableWarnings(violatedProject, compliance, metrics, '2026-08-05');

    expect(warnings.length).toBeGreaterThan(0);

    // Verify warning structure
    warnings.forEach(w => {
      expect(w.id).toBeTruthy();
      expect(w.title).toBeTruthy();
      expect(w.whatIsWrong).toBeTruthy();
      expect(w.whyItMatters).toBeTruthy();
      expect(w.affectedRecord).toBeTruthy();
      expect(w.recommendation).toBeTruthy();
      expect(w.actionLabel).toBeTruthy();
      expect(w.targetTab).toBeTruthy();
    });

    // Check specific navigation destinations
    const turnaroundWarn = warnings.find(w => w.id === 'warning-safety-turnaround');
    expect(turnaroundWarn?.targetTab).toBe('constraints');
    expect(turnaroundWarn?.actionLabel).toBe('Adjust Turnaround');

    const scheduleWarn = warnings.find(w => w.id === 'warning-schedule-drift');
    expect(scheduleWarn?.targetTab).toBe('calendar');
    expect(scheduleWarn?.actionLabel).toBe('Open Schedule');

    const scriptWarn = warnings.find(w => w.id === 'warning-screenplay-unlocked');
    expect(scriptWarn?.targetTab).toBe('screenplay');
    expect(scriptWarn?.actionLabel).toBe('Lock Screenplay');
  });

  it('provides direct in-place resolution action where appropriate', () => {
    let updatedPayload: Partial<FilmProject> | null = null;
    const mockUpdateMeta = (updates: Partial<FilmProject>) => {
      updatedPayload = updates;
    };

    const scriptUnlockedProject: FilmProject = {
      ...MOCK_PROJECT,
      constraints: {
        ...MOCK_PROJECT.constraints,
        screenplayLocked: false,
      },
    };

    const compliance = evaluateProjectCompliance(scriptUnlockedProject);
    const metrics = { overdueDaysCount: 0 };
    const warnings = generateActionableWarnings(scriptUnlockedProject, compliance, metrics, '2026-07-15', mockUpdateMeta);

    const scriptWarn = warnings.find(w => w.id === 'warning-screenplay-unlocked');
    expect(scriptWarn?.resolveAction).toBeDefined();

    // Trigger resolution
    scriptWarn?.resolveAction?.();
    expect(updatedPayload).toEqual({
      constraints: {
        ...scriptUnlockedProject.constraints,
        screenplayLocked: true,
      },
    });
  });
});

describe('Metric Concept Independence', () => {
  it('proves Execution, Readiness, and Schedule evaluate distinct, non-overlapping dimensions', () => {
    // Scenario: Execution is 100% complete, but Schedule is delayed (+5d overdue), and Readiness is blocked (unlocked script)
    const metrics = { totalActivities: 5, completedActivities: 5, activityProgress: 100, overdueDaysCount: 5 };
    const customProject: FilmProject = {
      ...MOCK_PROJECT,
      constraints: { ...MOCK_PROJECT.constraints, screenplayLocked: false },
      suggestedEndDate: '2026-09-04',
    };
    const compliance = evaluateProjectCompliance(customProject);

    const exec = calculateExecutionMetric(customProject, metrics, '2026-08-30');
    const ready = calculateReadinessMetric(customProject, compliance);
    const sched = calculateScheduleForecast(customProject, metrics, '2026-08-30');

    // Execution is Complete (100%)
    expect(exec.percentage).toBe(100);
    expect(exec.statusLabel).toBe('Complete');

    // Readiness is Blocked (4/5 prerequisites)
    expect(ready.statusLabel).toBe('Near Ready');
    expect(ready.percentage).toBe(80);

    // Schedule is Behind Schedule (+5d)
    expect(sched.primaryValue).toBe('+5d');
    expect(sched.statusLabel).toBe('Behind Schedule');

    // All three evaluate distinct orthogonal dimensions of the production
    expect(exec.primaryValue).not.toBe(ready.primaryValue);
    expect(exec.primaryValue).not.toBe(sched.primaryValue);
  });
});
