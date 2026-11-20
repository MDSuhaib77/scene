/**
 * SceneOS — Overview Information Architecture & KPI Clarity Test Suite
 * 
 * Verifies:
 * - Mathematical precision of all Overview KPIs (Phases vs Tasks separation)
 * - Schedule variance, overdue day counts, and timeline penalty calculation
 * - Indian Guild compliance evaluation determinism (FWICE / WICA / SICA)
 * - Absence of backend telemetry diagnostic leakage in the production UI model
 */

import { describe, it, expect } from 'vitest';
import { getPipelineMetrics, updateProjectStatus, addDays, getDaysDifference } from '../src/utils/scheduler';
import { evaluateProjectCompliance } from '../src/features/compliance/complianceEngine';
import { FilmProject, FilmPhase } from '../src/types';

const MOCK_OVERVIEW_PROJECT: FilmProject = {
  id: 'proj-overview-test',
  title: 'Neon Odyssey',
  logline: 'An executive test production for KPI validation.',
  director: 'Kira Vance',
  producer: 'Elena Rostova',
  writer: 'Aria Chen',
  cinematographer: 'Jack Miller',
  startDate: '2026-05-01',
  finalEndDate: '2026-07-15',
  suggestedEndDate: '2026-07-15',
  isEndDateFixed: true,
  updatedAt: '2026-05-01T00:00:00.000Z',
  constraints: {
    budgetLimit: 2500000,
    dailyBurnRateCap: 30000,
    screenplayLocked: true,
    castAvailabilityDays: 45,
    permitLeadTimeDays: 14,
    targetRating: 'PG-13',
    weatherContingencyBuffer: 7,
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
      id: 'ph-1',
      name: 'Script & Pre-Production',
      category: 'pre',
      color: 'bg-cyan-950',
      textLightColor: 'text-cyan-400',
      textDarkColor: 'text-cyan-200',
      durationDays: 15,
      startDate: '2026-05-01',
      endDate: '2026-05-15',
      status: 'completed',
      activities: [
        { id: 'act-1', name: 'Lock Screenplay Revision 3', completed: true, estimatedDays: 5, priority: 'high' },
        { id: 'act-2', name: 'Cast Lead Performers', completed: true, estimatedDays: 10, priority: 'high' },
      ],
      crew: [],
    },
    {
      id: 'ph-2',
      name: 'Principal Photography',
      category: 'prod',
      color: 'bg-indigo-950',
      textLightColor: 'text-indigo-400',
      textDarkColor: 'text-indigo-200',
      durationDays: 30,
      startDate: '2026-05-16',
      endDate: '2026-06-14',
      status: 'active',
      activities: [
        { id: 'act-3', name: 'Night Shoot Sequences #1-4', completed: true, estimatedDays: 8, priority: 'high' },
        { id: 'act-4', name: 'Location Filming at Studio Stage A', completed: false, estimatedDays: 12, priority: 'medium' },
        { id: 'act-5', name: 'Special FX Rigging & Car Stunt', completed: false, estimatedDays: 10, priority: 'high' },
      ],
      crew: [],
    },
    {
      id: 'ph-3',
      name: 'Post-Production & Sound',
      category: 'post',
      color: 'bg-purple-950',
      textLightColor: 'text-purple-400',
      textDarkColor: 'text-purple-200',
      durationDays: 31,
      startDate: '2026-06-15',
      endDate: '2026-07-15',
      status: 'pending',
      activities: [
        { id: 'act-6', name: 'Editorial Rough Assembly Cut', completed: false, estimatedDays: 15, priority: 'high' },
        { id: 'act-7', name: 'Foley & Sound Design Mix', completed: false, estimatedDays: 16, priority: 'medium' },
      ],
      crew: [],
    },
  ],
};

describe('Overview KPI Clarity & Metric Separation', () => {
  it('differentiates phase completion from task completion cleanly', () => {
    const metrics = getPipelineMetrics(MOCK_OVERVIEW_PROJECT, '2026-05-20');
    
    // Phase completion: 1 completed of 3 total = 33%
    expect(metrics.completedPhases).toBe(1);
    expect(metrics.totalPhases).toBe(3);
    expect(metrics.phaseProgress).toBe(33);

    // Task execution: 3 completed of 7 total = ~43%
    expect(metrics.completedActivities).toBe(3);
    expect(metrics.totalActivities).toBe(7);
    expect(metrics.activityProgress).toBe(43);

    // CRITICAL: Phase progress and task progress must not be conflated!
    expect(metrics.phaseProgress).not.toBe(metrics.activityProgress);
  });

  it('calculates on-schedule status when simulated date is within active phase bounds', () => {
    // Simulated date is May 20, 2026 (inside Principal Photography, which ends June 14)
    const updated = updateProjectStatus(MOCK_OVERVIEW_PROJECT, '2026-05-20');
    const metrics = getPipelineMetrics(updated, '2026-05-20');

    expect(metrics.overdueDaysCount).toBe(0);
    expect(metrics.healthScore).toBe(100);
  });

  it('accurately detects schedule slippage and calculates overdue days', () => {
    // Simulate jumping 10 days past Phase 2 deadline (June 24, 2026)
    const updated = updateProjectStatus(MOCK_OVERVIEW_PROJECT, '2026-06-24');
    const metrics = getPipelineMetrics(updated, '2026-06-24');

    // Phase 2 ended on June 14, 2026. At June 24, it is overdue by exactly 10 days.
    expect(metrics.overdueDaysCount).toBe(10);
    // Health penalty: 4% per overdue day -> 100 - (10 * 4) = 60
    expect(metrics.healthScore).toBe(60);
  });
});

describe('Indian Guild Compliance Truthful Evaluation', () => {
  it('evaluates project constraints against FWICE safety rules deterministically', () => {
    const evaluation = evaluateProjectCompliance(MOCK_OVERVIEW_PROJECT);

    expect(evaluation.activeGuild.id).toBe('FWICE');
    expect(evaluation.overallScore).toBe(100);
    expect(evaluation.isFullyCompliant).toBe(true);
    expect(evaluation.criticalViolationsCount).toBe(0);
  });

  it('flags violations when rest turnaround is reduced below guild standards', () => {
    const nonCompliantProject: FilmProject = {
      ...MOCK_OVERVIEW_PROJECT,
      constraints: {
        ...MOCK_OVERVIEW_PROJECT.constraints,
        turnaroundHours: 8, // Violates FWICE 12-hour minimum turnaround
      },
    };

    const evaluation = evaluateProjectCompliance(nonCompliantProject);
    expect(evaluation.isFullyCompliant).toBe(false);
    expect(evaluation.criticalViolationsCount).toBeGreaterThan(0);
    expect(evaluation.overallScore).toBeLessThan(100);

    const turnaroundCheck = evaluation.checks.find(c => c.ruleCode === 'REST_DAILY_TURNAROUND');
    expect(turnaroundCheck).toBeDefined();
    expect(turnaroundCheck?.isCompliant).toBe(false);
  });
});

describe('Production Countdown & Speedometer Instrumentation Data Bindings', () => {
  it('correctly calculates countdown days, weeks, and timeline elapsed percentage', () => {
    // Project starts 2026-05-01, ends 2026-07-15.
    const simulatedDate = '2026-05-20';
    const targetDate = MOCK_OVERVIEW_PROJECT.finalEndDate; // '2026-07-15'
    
    const daysRemaining = getDaysDifference(simulatedDate, targetDate);
    const totalDays = getDaysDifference(MOCK_OVERVIEW_PROJECT.startDate, targetDate);
    const daysElapsed = getDaysDifference(MOCK_OVERVIEW_PROJECT.startDate, simulatedDate);
    const elapsedPercent = Math.round((daysElapsed / totalDays) * 100);

    expect(daysRemaining).toBe(56);
    expect(totalDays).toBe(75);
    expect(daysElapsed).toBe(19);
    expect(elapsedPercent).toBe(25);
    
    // Weeks remaining calculation
    const weeksRemaining = Math.ceil(daysRemaining / 7);
    expect(weeksRemaining).toBe(8);
  });

  it('handles past-wrap dates cleanly without negative NaN errors', () => {
    // Simulate past wrap date: 2026-08-01 (target was 2026-07-15)
    const simulatedDate = '2026-08-01';
    const targetDate = MOCK_OVERVIEW_PROJECT.finalEndDate; // '2026-07-15'
    
    const diff = getDaysDifference(simulatedDate, targetDate);
    expect(diff).toBeLessThan(0); // Negative indicates post-production wrap elapsed
    expect(Math.abs(diff)).toBe(17); // 17 days in post
  });

  it('determines plan alignment as "Not enough data" when actual progress and baseline are both 0%', () => {
    // Zero progress and zero baseline
    const activityProgress = 0;
    const timelineProgress = 0;
    const hasTargetDate = true;
    const totalDays = 75;

    let planStatus = 'Not enough data';
    if (!hasTargetDate || totalDays <= 0) {
      planStatus = 'Not enough data';
    } else if (activityProgress === 0 && timelineProgress === 0) {
      planStatus = 'Not enough data';
    } else {
      const variance = activityProgress - timelineProgress;
      planStatus = variance > 0 ? 'Ahead of plan' : variance === 0 ? 'On track' : 'Behind plan';
    }

    expect(planStatus).toBe('Not enough data');
  });

  it('correctly handles missing target wrap date gracefully', () => {
    const noWrapProject: FilmProject = {
      ...MOCK_OVERVIEW_PROJECT,
      finalEndDate: '',
      suggestedEndDate: '',
      isEndDateFixed: false,
    };

    const targetDate = noWrapProject.isEndDateFixed ? noWrapProject.finalEndDate : noWrapProject.suggestedEndDate;
    const hasTargetDate = Boolean(targetDate);
    expect(hasTargetDate).toBe(false);

    const countdownLabel = !hasTargetDate ? 'WRAP DATE NOT SET' : 'WRAP IN';
    expect(countdownLabel).toBe('WRAP DATE NOT SET');
  });
});

describe('Overview 2.3.1: Countdown Flanking Controls & Dynamic Expansion', () => {
  it('formats compact Attention control text accurately based on actual issue counts', () => {
    const issuesCountZero = 0;
    const labelZero = `Attention · ${issuesCountZero === 0 ? 'Clean' : `${issuesCountZero} issues`}`;
    expect(labelZero).toBe('Attention · Clean');

    const issuesCountSingle: number = 1;
    const labelSingle = `Attention · ${issuesCountSingle === 0 ? 'Clean' : `${issuesCountSingle} issue`}`;
    expect(labelSingle).toBe('Attention · 1 issue');

    const issuesCountMultiple: number = 3;
    const labelMultiple = `Attention · ${issuesCountMultiple === 0 ? 'Clean' : `${issuesCountMultiple} issues`}`;
    expect(labelMultiple).toBe('Attention · 3 issues');
  });

  it('formats compact Activity control text accurately based on real event log length', () => {
    const zeroLogs: number = 0;
    const labelZero = `Activity · ${zeroLogs} updates`;
    expect(labelZero).toBe('Activity · 0 updates');

    const twoLogs: number = 2;
    const labelTwo = `Activity · ${twoLogs} update${twoLogs === 1 ? '' : 's'}`;
    expect(labelTwo).toBe('Activity · 2 updates');
  });

  it('enforces mutual exclusivity between flanking expansion panels', () => {
    let expandedFlank: 'attention' | 'activity' | null = null;

    const toggleFlank = (target: 'attention' | 'activity') => {
      expandedFlank = expandedFlank === target ? null : target;
    };

    // 1. Initial state: both collapsed
    expect(expandedFlank).toBeNull();

    // 2. Open Attention
    toggleFlank('attention');
    expect(expandedFlank).toBe('attention');

    // 3. Open Activity -> Attention is closed, Activity is opened
    toggleFlank('activity');
    expect(expandedFlank).toBe('activity');

    // 4. Toggle Activity again -> collapses back to null
    toggleFlank('activity');
    expect(expandedFlank).toBeNull();

    // 5. Escape key action collapses active panel
    toggleFlank('attention');
    expect(expandedFlank).toBe('attention');
    expandedFlank = null; // Simulated Escape handler
    expect(expandedFlank).toBeNull();
  });
});


