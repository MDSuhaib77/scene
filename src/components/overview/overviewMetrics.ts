/**
 * SceneOS — Overview Metrics & Actionable Warning Engine
 * 
 * Provides pure, deterministic, authoritative calculations for:
 * 1. Execution Metric (Actual task completion against recorded tasks)
 * 2. Production Readiness Metric (Explicit phase prerequisites verification)
 * 3. Schedule Forecast Metric (Defensible temporal variance against baseline wrap)
 * 4. Actionable Warnings Registry (Contextual issues with target workspace destinations)
 */

import { FilmProject, FilmPhase, Activity, CrewMember } from '../../types';
import { ComplianceEvaluation } from '../../features/compliance/complianceEngine';
import { getDaysDifference } from '../../utils/scheduler';

// ---------------------------------------------------------------------------
// 1. DATA CONTRACTS
// ---------------------------------------------------------------------------

export interface PrerequisiteItem {
  id: string;
  name: string;
  category: 'Writing' | 'Crew' | 'Safety' | 'Breakdown' | 'Finance';
  status: 'met' | 'blocked' | 'in_review';
  department: string;
  responsibleRole: string;
  detail: string;
  targetTab: 'screenplay' | 'crew' | 'constraints' | 'phases' | 'calendar' | 'master-calendar';
  actionLabel: string;
}

export interface ExecutionMetricData {
  totalActivities: number;
  completedActivities: number;
  remainingActivities: number;
  overdueActivities: number;
  percentage: number | null;
  primaryValue: string;
  secondaryValue?: string;
  statusLabel: string;
  statusType: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  description: string;
}

export interface ReadinessMetricData {
  prerequisites: PrerequisiteItem[];
  metCount: number;
  totalCount: number;
  percentage: number | null;
  primaryValue: string;
  secondaryValue?: string;
  statusLabel: string;
  statusType: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  description: string;
}

export interface ScheduleForecastData {
  hasTargetDate: boolean;
  targetDate?: string;
  startDate: string;
  forecastDate?: string;
  varianceDays: number;
  totalDriftDays: number;
  isOverdue: boolean;
  statusLabel: string;
  statusType: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  primaryValue: string;
  secondaryValue?: string;
  description: string;
  activePhase?: FilmPhase;
}

export interface ActionableWarning {
  id: string;
  severity: 'critical' | 'warning' | 'advisory';
  status: 'open' | 'in_progress' | 'resolved';
  category: 'Compliance' | 'Schedule' | 'Safety' | 'Screenplay' | 'Crew' | 'Deliverables';
  title: string;
  whatIsWrong: string;
  whyItMatters: string;
  affectedRecord: string;
  recommendation: string;
  actionLabel: string;
  targetTab: 'constraints' | 'calendar' | 'phases' | 'screenplay' | 'crew' | 'master-calendar';
  secondaryActionLabel?: string;
  targetRecordId?: string;
  resolveAction?: () => void;
}

// ---------------------------------------------------------------------------
// 2. EXECUTION METRIC CALCULATION
// ---------------------------------------------------------------------------

export function calculateExecutionMetric(
  project: FilmProject,
  metrics: { totalActivities: number; completedActivities: number; activityProgress: number },
  simulatedDate: string
): ExecutionMetricData {
  const total = metrics.totalActivities;
  const completed = metrics.completedActivities;
  const remaining = Math.max(0, total - completed);

  // Calculate activities in overdue phases or past phase deadlines
  let overdueActivities = 0;
  project.phases.forEach(ph => {
    const isPastDeadline = ph.status === 'overdue' || (Boolean(ph.endDate) && getDaysDifference(ph.endDate, simulatedDate) > 0 && ph.status !== 'completed');
    if (isPastDeadline) {
      overdueActivities += ph.activities.filter(a => !a.completed).length;
    }
  });

  if (total === 0) {
    return {
      totalActivities: 0,
      completedActivities: 0,
      remainingActivities: 0,
      overdueActivities: 0,
      percentage: null,
      primaryValue: 'N/A',
      secondaryValue: undefined,
      statusLabel: 'No Tasks',
      statusType: 'neutral',
      description: 'No deliverables cataloged in production roadmap',
    };
  }

  const percentage = Math.round((completed / total) * 100);

  let statusLabel = 'In Progress';
  let statusType: 'success' | 'warning' | 'danger' | 'info' = 'info';

  if (percentage === 100) {
    statusLabel = 'Complete';
    statusType = 'success';
  } else if (overdueActivities > 0) {
    statusLabel = `${overdueActivities} Overdue`;
    statusType = 'warning';
  }

  const description = overdueActivities > 0
    ? `${overdueActivities} overdue · ${remaining} remaining`
    : `${remaining} task${remaining === 1 ? '' : 's'} remaining across phases`;

  return {
    totalActivities: total,
    completedActivities: completed,
    remainingActivities: remaining,
    overdueActivities,
    percentage,
    primaryValue: `${percentage}%`,
    secondaryValue: `${completed}/${total} tasks`,
    statusLabel,
    statusType,
    description,
  };
}

// ---------------------------------------------------------------------------
// 3. PRODUCTION READINESS METRIC CALCULATION
// ---------------------------------------------------------------------------

export function calculateReadinessMetric(
  project: FilmProject,
  compliance: ComplianceEvaluation
): ReadinessMetricData {
  const prerequisites: PrerequisiteItem[] = [];

  // Prerequisite 1: Screenplay Locked for Filming
  const isScriptLocked = Boolean(project.constraints?.screenplayLocked);
  prerequisites.push({
    id: 'prereq-script-locked',
    name: 'Screenplay Draft Lock',
    category: 'Writing',
    status: isScriptLocked ? 'met' : 'blocked',
    department: 'Screenwriting & Directing',
    responsibleRole: project.director || 'Director',
    detail: isScriptLocked
      ? 'Master shooting script draft is locked and version-controlled'
      : 'Master screenplay is currently unlocked; revisions risk continuity disruption',
    targetTab: 'screenplay',
    actionLabel: isScriptLocked ? 'Review Script' : 'Lock Screenplay',
  });

  // Prerequisite 2: Key Crew Roster Confirmation
  const allCrew: CrewMember[] = project.phases.flatMap(p => p.crew || []);
  const confirmedCrew = allCrew.filter(c => c.status === 'Confirmed');
  let crewStatus: 'met' | 'blocked' | 'in_review' = 'met';
  let crewDetail = 'All assigned departmental crew members confirmed';

  if (allCrew.length === 0) {
    crewStatus = 'in_review';
    crewDetail = 'No key crew members assigned to production roster yet';
  } else if (confirmedCrew.length < allCrew.length) {
    crewStatus = 'blocked';
    crewDetail = `${allCrew.length - confirmedCrew.length} of ${allCrew.length} crew members pending contract confirmation`;
  }

  prerequisites.push({
    id: 'prereq-crew-confirmed',
    name: 'Crew Roster Confirmation',
    category: 'Crew',
    status: crewStatus,
    department: 'Production Office',
    responsibleRole: project.producer || 'Line Producer',
    detail: crewDetail,
    targetTab: 'crew',
    actionLabel: 'Review Crew',
  });

  // Prerequisite 3: Union Rest Turnaround & Safety
  const turnaroundHours = project.constraints?.turnaroundHours ?? 12;
  const isSafetyTurnaroundMet = turnaroundHours >= 12 && compliance.criticalViolationsCount === 0;
  prerequisites.push({
    id: 'prereq-safety-rest',
    name: 'Guild Safety & Rest Turnaround',
    category: 'Safety',
    status: isSafetyTurnaroundMet ? 'met' : 'blocked',
    department: 'Safety & Labor Standards',
    responsibleRole: 'First Assistant Director',
    detail: isSafetyTurnaroundMet
      ? `Full compliance with ${compliance.activeGuild.name} rest windows (${turnaroundHours}h)`
      : `Rest turnaround (${turnaroundHours}h) or labor rules breach mandatory safety threshold`,
    targetTab: 'constraints',
    actionLabel: 'View Compliance',
  });

  // Prerequisite 4: Scene Breakdown & Location Readiness
  const hasParsedScenes = Boolean(
    project.screenplayVersions &&
    project.screenplayVersions.length > 0 &&
    (project.screenplayVersions[0].totalScenes ?? 0) > 0
  );
  prerequisites.push({
    id: 'prereq-scene-breakdown',
    name: 'Scene Breakdown & Locations',
    category: 'Breakdown',
    status: hasParsedScenes ? 'met' : 'in_review',
    department: 'Unit Production Management',
    responsibleRole: 'UPM & Location Manager',
    detail: hasParsedScenes
      ? `${project.screenplayVersions![0].totalScenes} scenes parsed with extracted locations and characters`
      : 'No scene breakdown registered from screenplay drafts yet',
    targetTab: 'screenplay',
    actionLabel: 'Review Breakdown',
  });

  const metCount = prerequisites.filter(p => p.status === 'met').length;
  const totalCount = prerequisites.length;
  const percentage = Math.round((metCount / totalCount) * 100);

  let statusLabel = 'Blocked';
  let statusType: 'success' | 'warning' | 'danger' | 'info' = 'warning';

  if (metCount === totalCount) {
    statusLabel = 'Phase Ready';
    statusType = 'success';
  } else if (metCount >= 4) {
    statusLabel = 'Near Ready';
    statusType = 'info';
  }

  const outstanding = totalCount - metCount;
  const description = metCount === totalCount
    ? 'All 5 phase prerequisites satisfied'
    : `${outstanding} prerequisite${outstanding === 1 ? '' : 's'} outstanding for next phase`;

  return {
    prerequisites,
    metCount,
    totalCount,
    percentage,
    primaryValue: `${percentage}%`,
    secondaryValue: `${metCount}/${totalCount} prereqs`,
    statusLabel,
    statusType,
    description,
  };
}

// ---------------------------------------------------------------------------
// 4. SCHEDULE FORECAST METRIC CALCULATION
// ---------------------------------------------------------------------------

export function calculateScheduleForecast(
  project: FilmProject,
  metrics: { overdueDaysCount: number },
  simulatedDate: string
): ScheduleForecastData {
  const targetDate = project.isEndDateFixed ? project.finalEndDate : project.suggestedEndDate;
  const hasTargetDate = Boolean(targetDate);

  const activePhase = project.phases.find(p => p.status === 'active')
    || project.phases.find(p => p.status === 'overdue')
    || project.phases.find(p => p.status === 'pending')
    || project.phases[0];

  if (!hasTargetDate) {
    return {
      hasTargetDate: false,
      startDate: project.startDate,
      varianceDays: 0,
      totalDriftDays: 0,
      isOverdue: false,
      statusLabel: 'Uncalibrated',
      statusType: 'neutral',
      primaryValue: 'N/A',
      secondaryValue: undefined,
      description: 'No baseline target wrap date configured',
      activePhase,
    };
  }

  // Calculate schedule variance between approved final wrap date and cascading projected date
  const varianceDays = getDaysDifference(project.finalEndDate, project.suggestedEndDate);
  const overdueDays = metrics.overdueDaysCount || 0;
  const totalDriftDays = Math.max(overdueDays, varianceDays > 0 ? varianceDays : 0);

  if (totalDriftDays > 0) {
    const isCritical = totalDriftDays > 5;
    return {
      hasTargetDate: true,
      targetDate,
      startDate: project.startDate,
      forecastDate: project.suggestedEndDate,
      varianceDays,
      totalDriftDays,
      isOverdue: true,
      statusLabel: isCritical ? 'Critical Delay' : 'Behind Schedule',
      statusType: isCritical ? 'danger' : 'warning',
      primaryValue: `+${totalDriftDays}d`,
      secondaryValue: 'forecast delay',
      description: `${totalDriftDays} days delay forecast against baseline wrap`,
      activePhase,
    };
  }

  if (varianceDays < 0) {
    const leadBuffer = Math.abs(varianceDays);
    return {
      hasTargetDate: true,
      targetDate,
      startDate: project.startDate,
      forecastDate: project.suggestedEndDate,
      varianceDays,
      totalDriftDays: 0,
      isOverdue: false,
      statusLabel: 'Ahead of Target',
      statusType: 'success',
      primaryValue: `-${leadBuffer}d`,
      secondaryValue: 'lead buffer',
      description: `${leadBuffer} days lead buffer ahead of delivery deadline`,
      activePhase,
    };
  }

  return {
    hasTargetDate: true,
    targetDate,
    startDate: project.startDate,
    forecastDate: project.suggestedEndDate,
    varianceDays: 0,
    totalDriftDays: 0,
    isOverdue: false,
    statusLabel: 'On Schedule',
    statusType: 'success',
    primaryValue: '0d',
    secondaryValue: 'aligned',
    description: 'Cascading milestones aligned with approved wrap date',
    activePhase,
  };
}

// ---------------------------------------------------------------------------
// 5. ACTIONABLE WARNINGS GENERATOR
// ---------------------------------------------------------------------------

export function generateActionableWarnings(
  project: FilmProject,
  compliance: ComplianceEvaluation,
  metrics: { overdueDaysCount: number },
  simulatedDate: string,
  onUpdateProjectMeta?: (updates: Partial<FilmProject>) => void
): ActionableWarning[] {
  const warnings: ActionableWarning[] = [];

  const activePhase = project.phases.find(p => p.status === 'active')
    || project.phases.find(p => p.status === 'overdue')
    || project.phases.find(p => p.status === 'pending')
    || project.phases[0];

  // 1. Compliance Rule Violations from authoritative compliance engine
  compliance.checks
    .filter(check => !check.isCompliant)
    .forEach(check => {
      warnings.push({
        id: `warning-comp-${check.ruleCode}`,
        severity: check.severity === 'critical' ? 'critical' : 'warning',
        status: 'open',
        category: 'Compliance',
        title: `${compliance.activeGuild.name}: ${check.name}`,
        whatIsWrong: check.violationMessage || `Configured parameters breach ${check.name}.`,
        whyItMatters: check.guidance || 'Guild safety violations invalidate production completion bonds and risk labor stoppages.',
        affectedRecord: `Rule Code: ${check.ruleCode} (Threshold: ${check.thresholdValue}${check.unit || ''})`,
        recommendation: check.guidance || 'Adjust turnaround parameters or crew provisions in Constraints to meet guild standards.',
        actionLabel: 'View Compliance Rule',
        targetTab: 'constraints',
      });
    });

  // 2. Schedule Drift / Overdue Milestones
  if (metrics.overdueDaysCount > 0) {
    warnings.push({
      id: 'warning-schedule-drift',
      severity: metrics.overdueDaysCount > 5 ? 'critical' : 'warning',
      status: 'open',
      category: 'Schedule',
      title: `Schedule Drift: ${metrics.overdueDaysCount} Days Past Deadline`,
      whatIsWrong: `Active timeline has breached the scheduled deadline for ${activePhase?.name || 'current milestone'} by ${metrics.overdueDaysCount} days.`,
      whyItMatters: 'Compresses post-production delivery buffers and threatens festival or theatrical distribution windows.',
      affectedRecord: `Phase: ${activePhase?.name || 'Active Phase'} (Deadline: ${activePhase?.endDate || 'Unset'})`,
      recommendation: 'Rebalance phase activities, authorize second-unit shooting, or adjust scheduled wrap date.',
      actionLabel: 'Open Schedule',
      targetTab: 'calendar',
    });
  }

  // 3. SAG/IATSE Rest Turnaround Violation
  const turnaroundHours = project.constraints?.turnaroundHours ?? 12;
  if (turnaroundHours < 12) {
    warnings.push({
      id: 'warning-safety-turnaround',
      severity: 'critical',
      status: 'open',
      category: 'Safety',
      title: `Insufficient Turnaround: ${turnaroundHours}h Configured`,
      whatIsWrong: `Rest interval between call sheets is configured at ${turnaroundHours}h (minimum 12h mandatory).`,
      whyItMatters: 'Critical fatigue hazard creating safety liabilities and triggering daily union penalty rates.',
      affectedRecord: `Constraint: turnaroundHours = ${turnaroundHours}h`,
      recommendation: 'Increase minimum rest turnaround to 12 hours in Union & Safety constraints.',
      actionLabel: 'Adjust Turnaround',
      targetTab: 'constraints',
      resolveAction: onUpdateProjectMeta
        ? () => onUpdateProjectMeta({ constraints: { ...project.constraints, turnaroundHours: 12 } })
        : undefined,
    });
  }

  // 4. Screenplay Unlocked During Production Shooting
  if (!project.constraints?.screenplayLocked && activePhase?.category === 'prod') {
    warnings.push({
      id: 'warning-screenplay-unlocked',
      severity: 'warning',
      status: 'open',
      category: 'Screenplay',
      title: 'Screenplay Unlocked During Principal Photography',
      whatIsWrong: 'Master script draft remains marked as unlocked while filming activities are underway.',
      whyItMatters: 'Uncontrolled scene or dialogue revisions create on-set continuity discrepancies and expensive re-shoots.',
      affectedRecord: 'Constraint: screenplayLocked = false',
      recommendation: 'Lock the active shooting draft to preserve dialogue continuity.',
      actionLabel: 'Lock Screenplay',
      targetTab: 'screenplay',
      resolveAction: onUpdateProjectMeta
        ? () => onUpdateProjectMeta({ constraints: { ...project.constraints, screenplayLocked: true } })
        : undefined,
    });
  }

  // 5. Unconfirmed Key Crew Members
  const allCrew = project.phases.flatMap(p => p.crew || []);
  const unconfirmedCrew = allCrew.filter(c => c.status !== 'Confirmed');
  if (unconfirmedCrew.length > 0) {
    warnings.push({
      id: 'warning-crew-unconfirmed',
      severity: 'warning',
      status: 'open',
      category: 'Crew',
      title: `Crew Contracts Pending: ${unconfirmedCrew.length} Unconfirmed`,
      whatIsWrong: `${unconfirmedCrew.length} crew member${unconfirmedCrew.length === 1 ? '' : 's'} remain on Hold or Negotiating status.`,
      whyItMatters: 'Unconfirmed key personnel create last-minute department head vacancies and shoot cancellations.',
      affectedRecord: `Crew: ${unconfirmedCrew.map(c => c.name).slice(0, 2).join(', ')}${unconfirmedCrew.length > 2 ? ` (+${unconfirmedCrew.length - 2} more)` : ''}`,
      recommendation: 'Confirm crew contract commitment tiers in the Crew Rolodex.',
      actionLabel: 'Review Crew',
      targetTab: 'crew',
    });
  }

  // 6. Overdue Activity Deliverables
  let overdueDeliverablesCount = 0;
  project.phases.forEach(ph => {
    if (ph.status === 'overdue' || (ph.endDate && getDaysDifference(ph.endDate, simulatedDate) > 0 && ph.status !== 'completed')) {
      overdueDeliverablesCount += ph.activities.filter(a => !a.completed).length;
    }
  });

  if (overdueDeliverablesCount > 0) {
    warnings.push({
      id: 'warning-overdue-deliverables',
      severity: 'warning',
      status: 'open',
      category: 'Deliverables',
      title: `${overdueDeliverablesCount} Milestone Deliverable${overdueDeliverablesCount === 1 ? '' : 's'} Overdue`,
      whatIsWrong: `${overdueDeliverablesCount} scheduled task${overdueDeliverablesCount === 1 ? '' : 's'} have passed their target completion dates.`,
      whyItMatters: 'Delayed tasks cascade downstream, forcing phase compression or budget overtime.',
      affectedRecord: `Phase: ${activePhase?.name || 'Milestone Tasks'}`,
      recommendation: 'Inspect delayed tasks in the Tasks Kanban board and reassign or update completion status.',
      actionLabel: 'Open Tasks Kanban',
      targetTab: 'master-calendar',
    });
  }

  // Sort critical warnings to the top
  return warnings.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return 0;
  });
}
