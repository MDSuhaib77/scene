/**
 * SceneOS — Automated Tests: Regional Guild Compliance Engine
 * Verifies that the 11-point safety rules evaluate deterministically.
 */

import { describe, it, expect } from 'vitest';
import { evaluateProjectCompliance } from '../src/features/compliance/complianceEngine';
import { FilmProject, INDIAN_GUILDS } from '../src/types';

const BASE_TEST_PROJECT: FilmProject = {
  id: 'test-proj-01',
  title: 'Test Production',
  logline: 'A standard compliance test project',
  director: 'Test Director',
  startDate: '2026-06-01',
  finalEndDate: '2026-07-20',
  suggestedEndDate: '2026-07-20',
  isEndDateFixed: true,
  constraints: {
    budgetLimit: 1000000,
    dailyBurnRateCap: 20000,
    screenplayLocked: true,
    castAvailabilityDays: 40,
    permitLeadTimeDays: 15,
    targetRating: 'PG-13',
    weatherContingencyBuffer: 6,
    postOverheadRatio: 20,
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
      durationDays: 20,
      startDate: '2026-06-01',
      endDate: '2026-06-20',
      status: 'completed',
      activities: [],
      crew: [],
    },
    {
      id: 'phase-prod',
      name: 'Production Shooting',
      category: 'prod',
      color: 'bg-indigo-950',
      textLightColor: 'text-indigo-400',
      textDarkColor: 'text-indigo-200',
      durationDays: 30,
      startDate: '2026-06-21',
      endDate: '2026-07-20',
      status: 'pending',
      activities: [],
      crew: [],
    },
    {
      id: 'phase-post',
      name: 'Post-Production',
      category: 'post',
      color: 'bg-violet-950',
      textLightColor: 'text-violet-400',
      textDarkColor: 'text-violet-200',
      durationDays: 20,
      startDate: '2026-07-21',
      endDate: '2026-08-10',
      status: 'pending',
      activities: [],
      crew: [],
    },
  ],
  updatedAt: new Date().toISOString(),
};

describe('Compliance Engine — 11 Point Safety Evaluator', () => {
  it('passes 100% compliance on a fully conformant FWICE production', () => {
    const result = evaluateProjectCompliance(BASE_TEST_PROJECT, 'FWICE');
    expect(result.overallScore).toBe(100);
    expect(result.isFullyCompliant).toBe(true);
    expect(result.criticalViolationsCount).toBe(0);
    expect(result.warningsCount).toBe(0);
  });

  it('detects critical violation when daily turnaround drops below guild threshold', () => {
    const invalidProject: FilmProject = {
      ...BASE_TEST_PROJECT,
      constraints: {
        ...BASE_TEST_PROJECT.constraints,
        turnaroundHours: 9, // FWICE requires 12h
      },
    };

    const result = evaluateProjectCompliance(invalidProject, 'FWICE');
    const turnaroundCheck = result.checks.find(c => c.ruleCode === 'REST_DAILY_TURNAROUND');

    expect(turnaroundCheck).toBeDefined();
    expect(turnaroundCheck?.isCompliant).toBe(false);
    expect(turnaroundCheck?.severity).toBe('critical');
    expect(result.criticalViolationsCount).toBeGreaterThanOrEqual(1);
    expect(result.isFullyCompliant).toBe(false);
  });

  it('detects critical safety hazard when stunt is planned without set medic', () => {
    const stuntHazardProject: FilmProject = {
      ...BASE_TEST_PROJECT,
      constraints: {
        ...BASE_TEST_PROJECT.constraints,
        stuntCoordinatorRequired: true,
        medicRequiredOnSet: false, // Hazard!
      },
    };

    const result = evaluateProjectCompliance(stuntHazardProject, 'FWICE');
    const medicalCheck = result.checks.find(c => c.ruleCode === 'SAFETY_MEDICAL_OVERSIGHT');

    expect(medicalCheck?.isCompliant).toBe(false);
    expect(medicalCheck?.severity).toBe('critical');
  });

  it('correctly adapts thresholds when switching between regional guilds (FEFSI vs FWICE vs Independent)', () => {
    // FEFSI recommends max 11h workday, while FWICE allows 12h
    const elevenHourDayProject: FilmProject = {
      ...BASE_TEST_PROJECT,
      constraints: {
        ...BASE_TEST_PROJECT.constraints,
        maxWorkdayHours: 12,
      },
    };

    const fwiceEval = evaluateProjectCompliance(elevenHourDayProject, 'FWICE');
    const fefsiEval = evaluateProjectCompliance(elevenHourDayProject, 'FEFSI');

    const fwiceWorkday = fwiceEval.checks.find(c => c.ruleCode === 'HOURS_MAX_WORKDAY');
    const fefsiWorkday = fefsiEval.checks.find(c => c.ruleCode === 'HOURS_MAX_WORKDAY');

    expect(fwiceWorkday?.isCompliant).toBe(true); // 12h is valid under FWICE
    expect(fefsiWorkday?.isCompliant).toBe(false); // 12h exceeds FEFSI 11h limit!
  });

  it('preserves all 6 regional guild rule definitions', () => {
    expect(Object.keys(INDIAN_GUILDS)).toEqual(
      expect.arrayContaining(['FWICE', 'FEFSI', 'TFIEF', 'FEFKA', 'KFWF', 'none'])
    );
  });
});
