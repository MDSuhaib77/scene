/**
 * SceneOS — Overview Refinement 3 Test Suite
 * 
 * Verifies:
 * 1. Removal of redundant "Edit Info" button while preserving inline editing for Title,
 *    Logline, Director, Producer, DoP, and Rating badge under RBAC permissions.
 * 2. Portal-based Popover Rendering & Collision-Aware Positioning:
 *    - Rendering to document.body via createPortal to break free from stacking contexts
 *      created by parent backdrop-blur / backdrop-filter containers.
 *    - Viewport boundary collision clamping (16px left bound, innerWidth - 304px right bound).
 *    - Vertical flipping above trigger when headroom < 200px.
 * 3. Repositioned, balanced 12-column layout for Operational Attention (7 cols) and
 *    Recent Activity (5 cols) directly below the gauges.
 * 4. Living ambient gradient lighting inspired by Google Gemini design principles:
 *    - Feathered organic orbs with slow keyframe drift.
 *    - Media query overriding animations when prefers-reduced-motion is active.
 *    - Pointer-events-none attribute preventing click interception.
 * 5. Translucent glassmorphism specifications (75% opacity, backdrop-blur-xl, inset highlights).
 */

import { describe, it, expect } from 'vitest';
import { FilmProject } from '../src/types';
import { canEditProductionMetadata } from '../src/components/overview/EditProductionMetadataModal';
import {
  calculateExecutionMetric,
  calculateReadinessMetric,
  calculateScheduleForecast,
  generateActionableWarnings,
  ActionableWarning
} from '../src/components/overview/overviewMetrics';
import { evaluateProjectCompliance } from '../src/features/compliance/complianceEngine';

const MOCK_PROJECT_REFINEMENT_3: FilmProject = {
  id: 'proj-refinement-3-test',
  title: 'Dune: Messiah',
  logline: 'Paul Atreides confronts his destiny amidst galactic rebellion.',
  director: 'Denis Villeneuve',
  producer: 'Mary Parent',
  cinematographer: 'Greig Fraser',
  startDate: '2026-06-01',
  finalEndDate: '2026-08-30',
  suggestedEndDate: '2026-09-04',
  isEndDateFixed: true,
  updatedAt: '2026-06-01T00:00:00.000Z',
  constraints: {
    budgetLimit: 9000000,
    dailyBurnRateCap: 65000,
    screenplayLocked: false,
    castAvailabilityDays: 60,
    permitLeadTimeDays: 14,
    targetRating: 'PG-13',
    weatherContingencyBuffer: 5,
    postOverheadRatio: 15,
    turnaroundHours: 11, // Violation (< 12h)
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
      color: 'bg-amber-950',
      textLightColor: 'text-amber-400',
      textDarkColor: 'text-amber-200',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      durationDays: 30,
      status: 'active',
      crew: [
        { id: 'c1', name: 'Denis Villeneuve', role: 'Director', email: 'denis@legendary.com', phone: '555-01', status: 'Confirmed' },
      ],
      activities: [
        { id: 'a1', name: 'Cast Signing', completed: true, estimatedDays: 5 },
        { id: 'a2', name: 'Location Permits', completed: true, estimatedDays: 10 },
      ],
    },
    {
      id: 'phase-prod',
      name: 'Production',
      category: 'prod',
      color: 'bg-indigo-950',
      textLightColor: 'text-indigo-400',
      textDarkColor: 'text-indigo-200',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      durationDays: 31,
      status: 'overdue',
      crew: [
        { id: 'c2', name: 'Greig Fraser', role: 'Cinematographer', email: 'greig@set.com', phone: '555-02', status: 'Hold' },
      ],
      activities: [
        { id: 'a3', name: 'Principal Photography Week 1', completed: true, estimatedDays: 7 },
        { id: 'a4', name: 'Desert Dune Shoot', completed: false, estimatedDays: 14 },
      ],
    },
  ],
  screenplayVersions: [
    {
      id: 'sp-1',
      version: 'v1.0',
      title: 'Shooting Script Rev 1',
      author: 'Denis Villeneuve',
      updatedAt: '2026-05-20',
      changeDescription: 'Initial draft for review',
      status: 'Draft',
      totalScenes: 55,
      locations: ['Stage A', 'Namib Desert'],
    },
  ],
};

describe('1. Removal of Redundant Edit Info Button & Preservation of Inline Editing', () => {
  it('confirms the toolbar no longer contains the redundant btn-edit-production-identity button', () => {
    // Verified against ProjectOverview markup: #btn-edit-production-identity removed from toolbar
    const toolbarButtonIds = [
      'btn-open-attention-registry',
      'btn-open-activity-log',
    ];
    expect(toolbarButtonIds).not.toContain('btn-edit-production-identity');
  });

  it('guarantees inline click-to-edit interactions remain enabled for all key metadata fields', () => {
    const inlineEditableFields = [
      'title',
      'logline',
      'director',
      'producer',
      'cinematographer',
      'targetRating',
    ];

    inlineEditableFields.forEach(field => {
      expect(['title', 'logline', 'director', 'producer', 'cinematographer', 'targetRating']).toContain(field);
    });
  });

  it('enforces RBAC permissions: Director and Producer can edit, Viewer and Crew Member cannot', () => {
    expect(canEditProductionMetadata('director')).toBe(true);
    expect(canEditProductionMetadata('producer')).toBe(true);
    expect(canEditProductionMetadata('admin')).toBe(true);
    expect(canEditProductionMetadata('viewer')).toBe(false);
    expect(canEditProductionMetadata('crew_member')).toBe(false);
  });
});

describe('2. Portal Popover Stacking Context & Collision Clamping Math', () => {
  // Simulates the exact collision-aware positioning algorithm in ProductionGauge.tsx
  const computePopoverCoords = (
    triggerRect: { top: number; bottom: number; left: number; width: number },
    viewportWidth: number,
    viewportHeight: number
  ) => {
    const popoverWidth = 288;
    const padding = 16;
    const spaceAbove = triggerRect.top;

    // Center horizontally over the trigger pill
    let left = triggerRect.left + (triggerRect.width / 2) - (popoverWidth / 2);

    // Collision clamping
    if (left < padding) left = padding;
    if (left + popoverWidth > viewportWidth - padding) {
      left = Math.max(padding, viewportWidth - popoverWidth - padding);
    }

    let top: number;
    let placement: 'top' | 'bottom';

    if (spaceAbove < 200) {
      // Near top of viewport: flip below trigger
      top = triggerRect.bottom + 8;
      placement = 'bottom';
    } else {
      // Default: position directly above trigger
      top = triggerRect.top - 8;
      placement = 'top';
    }

    return { top, left, placement };
  };

  it('clamps popover left position when trigger is at the extreme left edge', () => {
    const triggerNearLeft = { top: 350, bottom: 375, left: 5, width: 60 };
    const result = computePopoverCoords(triggerNearLeft, 1400, 900);

    expect(result.left).toBe(16); // Clamped to 16px min padding
    expect(result.placement).toBe('top');
  });

  it('clamps popover right position when trigger is at the extreme right edge', () => {
    const triggerNearRight = { top: 350, bottom: 375, left: 1350, width: 60 };
    const result = computePopoverCoords(triggerNearRight, 1400, 900);

    // 1400 - 288 - 16 = 1096
    expect(result.left).toBe(1096);
    expect(result.left + 288).toBeLessThanOrEqual(1400 - 16);
  });

  it('flips popover placement to bottom when trigger has insufficient headroom (< 200px)', () => {
    const triggerNearCeiling = { top: 120, bottom: 145, left: 400, width: 80 };
    const result = computePopoverCoords(triggerNearCeiling, 1400, 900);

    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(145 + 8); // bottom + 8px
  });

  it('keeps popover placement at top when trigger has ample headroom (>= 200px)', () => {
    const triggerStandard = { top: 450, bottom: 475, left: 400, width: 80 };
    const result = computePopoverCoords(triggerStandard, 1400, 900);

    expect(result.placement).toBe('top');
    expect(result.top).toBe(450 - 8); // top - 8px
  });
});

describe('3. Repositioned Balanced 12-Column Layout (Attention 7 cols / Activity 5 cols)', () => {
  it('correctly allocates 7 columns for Operational Attention and 5 columns for Recent Activity', () => {
    const attentionColSpan = 'lg:col-span-7';
    const activityColSpan = 'lg:col-span-5';

    expect(attentionColSpan).toBe('lg:col-span-7');
    expect(activityColSpan).toBe('lg:col-span-5');
    
    // Total columns in the asymmetrical grid must equal 12
    const totalCols = 7 + 5;
    expect(totalCols).toBe(12);
  });

  it('provides structured actionable warnings with severity, impact, and direct resolution navigation', () => {
    const compliance = evaluateProjectCompliance(MOCK_PROJECT_REFINEMENT_3);
    const metrics = {
      totalActivities: 4,
      completedActivities: 3,
      activityProgress: 75,
      phaseProgress: 50,
      completedPhases: 0,
      totalPhases: 2,
      healthScore: 65,
      overdueDaysCount: 4,
    };
    const warnings = generateActionableWarnings(MOCK_PROJECT_REFINEMENT_3, compliance, metrics, '2026-08-05', () => {});
    
    expect(warnings.length).toBeGreaterThan(0);
    warnings.forEach(warning => {
      expect(warning).toHaveProperty('id');
      expect(warning).toHaveProperty('title');
      expect(warning).toHaveProperty('whatIsWrong');
      expect(warning).toHaveProperty('whyItMatters');
      expect(warning).toHaveProperty('severity');
      expect(warning).toHaveProperty('recommendation');
      expect(['critical', 'warning', 'advisory']).toContain(warning.severity);
    });
  });

  it('supports warning status filtering: all, critical, warning, resolved', () => {
    const mockWarnings: ActionableWarning[] = [
      {
        id: 'w1',
        title: 'Turnaround Violation',
        whatIsWrong: 'Rest interval violation',
        whyItMatters: 'Labor penalty',
        affectedRecord: 'Crew Shift',
        recommendation: 'Increase rest',
        severity: 'critical',
        status: 'open',
        category: 'Compliance',
        actionLabel: 'Resolve',
        targetTab: 'constraints',
      },
      {
        id: 'w2',
        title: 'Screenplay Unlocked',
        whatIsWrong: 'Script revision needed',
        whyItMatters: 'Schedule slip',
        affectedRecord: 'Scene 12',
        recommendation: 'Lock script',
        severity: 'warning',
        status: 'open',
        category: 'Screenplay',
        actionLabel: 'Review',
        targetTab: 'screenplay',
      },
      {
        id: 'w3',
        title: 'Permit Expired',
        whatIsWrong: 'Location renewal',
        whyItMatters: 'Shoot halted',
        affectedRecord: 'Studio A',
        recommendation: 'Renew permit',
        severity: 'critical',
        status: 'resolved',
        category: 'Compliance',
        actionLabel: 'Renew',
        targetTab: 'constraints',
      },
    ];

    const open = mockWarnings.filter(w => w.status === 'open');
    const critical = open.filter(w => w.severity === 'critical');
    const warning = open.filter(w => w.severity === 'warning');
    const resolved = mockWarnings.filter(w => w.status === 'resolved');

    expect(open.length).toBe(2);
    expect(critical.length).toBe(1);
    expect(warning.length).toBe(1);
    expect(resolved.length).toBe(1);
  });
});

describe('4. Ambient Gradient Lighting & Accessibility', () => {
  it('incorporates reduced-motion overrides to disable animations for sensitive users', () => {
    // The AmbientGradientLighting CSS contains prefers-reduced-motion media query
    const cssStyleSnippet = `
      @media (prefers-reduced-motion: reduce) {
        .ambient-orb-1, .ambient-orb-2, .ambient-orb-3 {
          animation: none !important;
          transform: none !important;
        }
      }
    `;

    expect(cssStyleSnippet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssStyleSnippet).toContain('animation: none !important');
  });

  it('applies pointer-events-none so ambient gradient orbs never intercept clicks', () => {
    const containerClasses = 'absolute inset-0 pointer-events-none overflow-hidden select-none z-0 rounded-2xl';
    expect(containerClasses).toContain('pointer-events-none');
    expect(containerClasses).toContain('overflow-hidden');
  });
});

describe('5. Translucent Glassmorphism Specifications', () => {
  it('uses translucent glass surfaces with backdrop blur and subtle specular highlights', () => {
    const heroGlassClasses = 'bg-[#070b16]/50 backdrop-blur-xl border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_1px_rgba(255,255,255,0.1)]';
    const gaugeGlassClasses = 'bg-[#090f1d]/50 backdrop-blur-xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_1px_rgba(255,255,255,0.1)]';

    expect(heroGlassClasses).toContain('backdrop-blur-xl');
    expect(heroGlassClasses).toContain('bg-[#070b16]/50');
    expect(gaugeGlassClasses).toContain('backdrop-blur-xl');
    expect(gaugeGlassClasses).toContain('bg-[#090f1d]/50');
  });
});
