/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FilmProject, FilmPhase } from '../types';

/**
 * Parses YYYY-MM-DD string to Date object
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date();
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return new Date();
  }
  let [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return new Date();
  }
  // Clamp any distant past / corrupt year (e.g. < 2020 or <= 99) to current year so UI doesn't break
  if (year < 2020) {
    year = new Date().getFullYear();
  }
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) {
    return new Date();
  }
  return d;
}

/**
 * Formats Date to YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Adds offset days to a date string and returns YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  try {
    const date = parseDate(dateStr);
    date.setDate(date.getDate() + (isNaN(days) ? 0 : days));
    return formatDate(date);
  } catch (e) {
    return formatDate(new Date());
  }
}

/**
 * Returns difference in days between two date strings (end - start)
 */
export function getDaysDifference(startStr: string, endStr: string): number {
  try {
    const start = parseDate(startStr);
    const end = parseDate(endStr);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 0;
  }
}

/**
 * Core cascading function.
 * Given a project, re-computes start and end dates for all phases based on their order and durations.
 */
export function cascadeProjectDates(project: FilmProject): FilmProject {
  const updatedPhases = project.phases.map(p => ({ ...p }));
  
  if (project.constraints) {
    const { permitLeadTimeDays, weatherContingencyBuffer, postOverheadRatio } = project.constraints;
    
    // 1. Adjust Pre-Production days based on permitLeadTimeDays
    const preIndex = updatedPhases.findIndex(p => p.category === 'pre');
    if (preIndex !== -1) {
      updatedPhases[preIndex].durationDays = Math.max(updatedPhases[preIndex].durationDays, permitLeadTimeDays || 1);
    }
    
    // 2. Adjust Production days based on weatherContingencyBuffer (e.g. 20 base days plus weather contingency)
    const prodIndex = updatedPhases.findIndex(p => p.category === 'prod');
    if (prodIndex !== -1) {
      updatedPhases[prodIndex].durationDays = Math.max(updatedPhases[prodIndex].durationDays, (weatherContingencyBuffer || 0) + 20);
    }
    
    // 3. Adjust Post-Production days based on postOverheadRatio relative to other phases
    const postIndex = updatedPhases.findIndex(p => p.category === 'post');
    if (postIndex !== -1) {
      let sumOther = 0;
      for (let i = 0; i < updatedPhases.length; i++) {
        if (i !== postIndex) {
          sumOther += updatedPhases[i].durationDays;
        }
      }
      const ratio = postOverheadRatio || 15;
      if (ratio < 100) {
        const requiredPostDays = Math.ceil((ratio * sumOther) / (100 - ratio));
        updatedPhases[postIndex].durationDays = Math.max(updatedPhases[postIndex].durationDays, requiredPostDays);
      }
    }
  }

  let currentStart = project.startDate;

  for (let i = 0; i < updatedPhases.length; i++) {
    const phase = updatedPhases[i];
    phase.startDate = currentStart;
    
    // Duration must be at least 1 day
    const duration = Math.max(1, phase.durationDays);
    phase.endDate = addDays(currentStart, duration - 1);
    
    // Next phase starts the day after this phase ends
    currentStart = addDays(phase.endDate, 1);
  }

  const suggestedEndDate = updatedPhases.length > 0 
    ? updatedPhases[updatedPhases.length - 1].endDate 
    : project.startDate;

  return {
    ...project,
    phases: updatedPhases,
    suggestedEndDate,
    // If end date is not fixed, finalEndDate tracks suggestedEndDate
    finalEndDate: project.isEndDateFixed ? project.finalEndDate : suggestedEndDate,
  };
}

/**
 * When the end date is FIXED, and a phase duration is changed, we must adjust
 * the durations of subsequent customizable phases so they fit within the finalEndDate.
 *
 * It takes the project, and recalculates subsequent adjustable phases so that the entire
 * duration chain matches the exact gap between project.startDate and project.finalEndDate.
 */
export function shrinkPhasesToFitFixedEnd(project: FilmProject): FilmProject {
  const totalAvailableDays = getDaysDifference(project.startDate, project.finalEndDate) + 1;
  const phases = project.phases.map(p => ({
    ...p,
    activities: p.activities ? p.activities.map(a => ({ ...a })) : []
  }));
  
  if (phases.length === 0 || totalAvailableDays <= 0) return project;

  // Let's identify which phases are already completed, we can't shrink those.
  const fixedPhasesSum = phases
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.durationDays, 0);

  const adjustablePhases = phases.filter(p => p.status !== 'completed');

  if (adjustablePhases.length === 0) {
    // If all are completed, we can't adjust anything. We must expand finalEndDate.
    return cascadeProjectDates({ ...project, isEndDateFixed: false });
  }

  const remainingDays = totalAvailableDays - fixedPhasesSum;
  
  if (remainingDays <= adjustablePhases.length) {
    // Not enough days to give each adjustable phase at least 1 day!
    const updatedPhases = phases.map(p => {
      if (p.status !== 'completed') {
        return { 
          ...p, 
          durationDays: 1,
          activities: p.activities.map(act => ({
            ...act,
            isPostponed: act.canBePostponed ? true : act.isPostponed
          }))
        };
      }
      return p;
    });
    const subProj = { ...project, phases: updatedPhases };
    return cascadeProjectDates(subProj);
  }

  // Importance levels: 'critical' (weight 2.0) | 'high' (weight 1.5) | 'medium' (weight 1.0) | 'low' (weight 0.6)
  const getWeight = (importance?: 'critical' | 'high' | 'medium' | 'low') => {
    switch (importance) {
      case 'critical': return 2.0;
      case 'high': return 1.5;
      case 'low': return 0.6;
      case 'medium':
      default: return 1.0;
    }
  };

  // Compute total adjustable weight based on user importance ratings
  const totalAdjustableWeight = adjustablePhases.reduce((sum, p) => {
    const w = getWeight(p.importance);
    return sum + (p.durationDays * w);
  }, 0);

  // Distribute remainingDays among adjustable phases proportionally to their duration * importance weight
  const updatedPhases = phases.map(p => {
    if (p.status === 'completed') return p;
    
    // Proportion calculation adjusted by Importance rating
    const w = getWeight(p.importance);
    const share = (p.durationDays * w) / (totalAdjustableWeight || 1);
    let newDuration = Math.round(remainingDays * share);
    // Each adjustable phase must be at least 2 days
    newDuration = Math.max(2, newDuration);
    return { ...p, durationDays: newDuration };
  });

  // Adjust routing rounding differences on the last adjustable phase so the aggregate fits perfectly
  const activeAdjustable = updatedPhases.filter(p => p.status !== 'completed');
  if (activeAdjustable.length > 0) {
    const lastAdjustableItem = activeAdjustable[activeAdjustable.length - 1];
    const itemIndex = updatedPhases.findIndex(p => p.id === lastAdjustableItem.id);
    
    // Calculate total duration for all phases now
    const currentTotalAllocated = updatedPhases.reduce((sum, p) => sum + p.durationDays, 0);
    const diff = totalAvailableDays - currentTotalAllocated;
    
    if (diff !== 0) {
      updatedPhases[itemIndex].durationDays = Math.max(2, updatedPhases[itemIndex].durationDays + diff);
    }
  }

  // --- TASK-LEVEL SHRINKING & POSTPONEMENT ---
  // Optimize internal tasks (activities) inside each customizable phase to meet target durations
  const optimizedPhases = updatedPhases.map(phase => {
    if (phase.status === 'completed' || !phase.activities || phase.activities.length === 0) return phase;

    const availablePhaseDays = phase.durationDays;
    
    // 1. Initially set all postponement flags to false to execute clean recalculation
    let currentActs = phase.activities.map(a => ({ ...a, isPostponed: false }));

    // Helper to calculate total active task load duration
    const getEstimatedTotal = () => currentActs.filter(a => !a.isPostponed).reduce((sum, a) => sum + (a.estimatedDays || 3), 0);

    // 2. If active tasks' durations exceed phase limits, remove postponable ones to a future date
    if (getEstimatedTotal() > availablePhaseDays) {
      const postponableActs = currentActs.filter(a => a.canBePostponed);
      
      // Sort postponables: lowest priority first ('low' -> 'medium' -> 'high')
      const priorityScores = { low: 1, medium: 2, high: 3 };
      postponableActs.sort((a, b) => {
        const sa = priorityScores[a.priority || 'medium'];
        const sb = priorityScores[b.priority || 'medium'];
        return sa - sb;
      });

      for (const t of postponableActs) {
        if (getEstimatedTotal() <= availablePhaseDays) break;
        currentActs = currentActs.map(a => {
          if (a.id === t.id) {
            return { ...a, isPostponed: true };
          }
          return a;
        });
      }
    }

    // 3. For non-postponed tasks, apply proportional shrinking down to floors defined by priority & thresholds
    const activeTasks = currentActs.filter(a => !a.isPostponed);
    const activeSum = activeTasks.reduce((sum, a) => sum + (a.estimatedDays || 3), 0);

    if (activeSum > availablePhaseDays && activeTasks.length > 0) {
      const shrinkRatio = availablePhaseDays / activeSum;
      
      currentActs = currentActs.map(act => {
        if (act.isPostponed) return act;
        
        // Establish lowest threshold for shrinking
        let floorLimit = 1;
        if (act.isThresholdTask && act.minDaysThreshold) {
          floorLimit = act.minDaysThreshold;
        } else if (act.priority === 'high') {
          floorLimit = 3;
        } else if (act.priority === 'medium') {
          floorLimit = 2;
        }

        let newDays = Math.round((act.estimatedDays || 3) * shrinkRatio);
        newDays = Math.max(floorLimit, newDays);
        
        return {
          ...act,
          estimatedDays: newDays
        };
      });
    }

    return {
      ...phase,
      activities: currentActs
    };
  });

  // Recalculate all dates based on updated durations & activities
  return cascadeProjectDates({
    ...project,
    phases: optimizedPhases,
  });
}

/**
 * Triggers full state recalculation after any schedule modification
 */
export function recalculateSchedule(project: FilmProject): FilmProject {
  if (project.isEndDateFixed) {
    return shrinkPhasesToFitFixedEnd(project);
  } else {
    return cascadeProjectDates(project);
  }
}

/**
 * Evaluates simulated current date against activity and phase endpoints
 * to mark statuses and calculate late-progress penalties.
 * 
 * If a phase deadline has passed but it is not completed:
 * status becomes 'overdue'.
 */
export function updateProjectStatus(project: FilmProject, simulatedDateStr: string): FilmProject {
  const phases = project?.phases || [];
  const updatedPhases = phases.map(p => {
    const activities = p?.activities || [];
    const totalActivities = activities.length;
    const completedActivities = activities.filter(a => a.completed).length;
    
    let status = p.status;
    const isCompleted = totalActivities > 0 && completedActivities === totalActivities;

    if (isCompleted) {
      status = 'completed';
    } else {
      // If simulated date is greater than phase endDate, it is overdue
      const isPastDeadline = getDaysDifference(p.endDate, simulatedDateStr) > 0;
      const isStarted = getDaysDifference(p.startDate, simulatedDateStr) >= 0;
      
      if (isPastDeadline) {
        status = 'overdue';
      } else if (isStarted) {
        status = 'active';
      } else {
        status = 'pending';
      }
    }

    return {
      ...p,
      activities,
      status,
    } as FilmPhase;
  });

  return {
    ...project,
    phases: updatedPhases,
  };
}

/**
 * Calculates overall metrics:
 * - Specific activity completion (total completed / total)
 * - Project phase completion (completed phases / total phases)
 * - Pipeline progress percentage
 * - Timeline Health/Loss indicator:
 *   If active/overdue phases are running behind their allotted time, health goes down.
 */
export function getPipelineMetrics(project: FilmProject, simulatedDateStr: string) {
  let totalActivities = 0;
  let completedActivities = 0;
  let completedPhases = 0;
  
  const phases = project?.phases || [];
  phases.forEach(p => {
    const activities = p?.activities || [];
    totalActivities += activities.length;
    completedActivities += activities.filter(a => a.completed).length;
    if (p.status === 'completed') {
      completedPhases++;
    }
  });

  const activityProgress = totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;
  const phaseProgress = phases.length > 0 ? (completedPhases / phases.length) * 100 : 0;

  // Let's compute custom pipeline health progress (starts at 100% and drops if overdue tasks exist)
  let healthScore = 100;
  let overdueDaysCount = 0;

  project.phases.forEach(p => {
    if (p.status === 'overdue') {
      const overdueBy = getDaysDifference(p.endDate, simulatedDateStr);
      overdueDaysCount += Math.max(0, overdueBy);
    }
  });

  // Calculate health penalty
  // A penalty of 4% per overdue day, capped at 100% loss (health = 0)
  healthScore = Math.max(0, 100 - (overdueDaysCount * 4));

  return {
    activityProgress: Math.round(activityProgress),
    phaseProgress: Math.round(phaseProgress),
    totalActivities,
    completedActivities,
    completedPhases,
    totalPhases: project.phases.length,
    healthScore,
    overdueDaysCount,
  };
}
