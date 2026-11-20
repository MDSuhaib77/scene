/**
 * SceneOS — Automated Tests: Cascading Scheduling Math
 * Verifies deterministic cascading of phase start/end dates.
 */

import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatDate,
  addDays,
  getDaysDifference,
  cascadeProjectDates,
} from '../src/utils/scheduler';
import { FilmProject } from '../src/types';

describe('Scheduler Engine — Cascading Dates & Constraints', () => {
  it('accurately parses and formats dates', () => {
    const d = parseDate('2026-06-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // 0-indexed June
    expect(d.getDate()).toBe(15);
    expect(formatDate(d)).toBe('2026-06-15');
  });

  it('calculates date offsets and differences correctly', () => {
    expect(addDays('2026-06-01', 10)).toBe('2026-06-11');
    expect(addDays('2026-06-30', 2)).toBe('2026-07-02');
    expect(getDaysDifference('2026-06-01', '2026-06-11')).toBe(10);
  });

  it('cascades sequential phases consecutively without timeline gaps', () => {
    const mockProj: FilmProject = {
      id: 'cascade-test',
      title: 'Cascade Test',
      logline: '',
      director: '',
      startDate: '2026-06-01',
      finalEndDate: '2026-08-01',
      suggestedEndDate: '2026-08-01',
      isEndDateFixed: false,
      constraints: {
        budgetLimit: 1000000,
        dailyBurnRateCap: 10000,
        screenplayLocked: true,
        castAvailabilityDays: 40,
        permitLeadTimeDays: 10,
        targetRating: 'PG-13',
        weatherContingencyBuffer: 4,
        postOverheadRatio: 15,
      },
      phases: [
        {
          id: 'p-1',
          name: 'Pre-Production',
          category: 'pre',
          color: '',
          textLightColor: '',
          textDarkColor: '',
          durationDays: 15,
          startDate: '2026-06-01',
          endDate: '2026-06-16',
          status: 'pending',
          activities: [],
          crew: [],
        },
        {
          id: 'p-2',
          name: 'Production',
          category: 'prod',
          color: '',
          textLightColor: '',
          textDarkColor: '',
          durationDays: 24, // base 20 + 4 weather buffer
          startDate: '2026-06-17',
          endDate: '2026-07-10',
          status: 'pending',
          activities: [],
          crew: [],
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    const cascaded = cascadeProjectDates(mockProj);
    const pre = cascaded.phases[0];
    const prod = cascaded.phases[1];

    expect(pre.startDate).toBe('2026-06-01');
    // Pre-production duration is at least permitLeadTimeDays (10 days, or current 15)
    expect(pre.durationDays).toBe(15);
    // Production starts immediately after pre-production wrap
    expect(prod.startDate).toBe(addDays(pre.startDate, pre.durationDays));
  });
});
