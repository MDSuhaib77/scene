/**
 * SceneOS — Film Production Compliance Engine
 * 
 * Preserves and formalizes the 11-point safety and labor compliance rules
 * originally engineered in the PLÁN prototype across regional Indian guilds
 * (FWICE, FEFSI, TFIEF, FEFKA, KFWF) and Independent productions.
 */

import { FilmProject, INDIAN_GUILDS, GuildRule } from '../../types';

export interface ComplianceCheckResult {
  ruleCode: string;
  name: string;
  category: 'rest' | 'budget' | 'schedule' | 'safety' | 'catering';
  isCompliant: boolean;
  actualValue: number | string | boolean;
  thresholdValue: number | string | boolean;
  unit?: string;
  severity: 'critical' | 'warning' | 'advisory';
  violationMessage?: string;
  guidance?: string;
}

export interface ComplianceEvaluation {
  overallScore: number; // 0 to 100 percentage
  isFullyCompliant: boolean;
  criticalViolationsCount: number;
  warningsCount: number;
  checks: ComplianceCheckResult[];
  activeGuild: GuildRule;
}

/**
 * Pure, deterministic compliance evaluation function.
 * Evaluates a film project's constraints and schedule against guild parameters.
 */
export function evaluateProjectCompliance(
  project: FilmProject,
  guildIdOverride?: string
): ComplianceEvaluation {
  const { constraints, phases } = project;
  const selectedGuildId = guildIdOverride || constraints.selectedGuild || 'FWICE';
  const activeGuild = INDIAN_GUILDS[selectedGuildId] || INDIAN_GUILDS['FWICE'];

  // Resolve values with fallback defaults
  const turnaroundHours = constraints.turnaroundHours ?? 12;
  const weekendTurnaroundHours = constraints.weekendTurnaroundHours ?? 54;
  const maxWorkdayHours = constraints.maxWorkdayHours ?? 12;
  const mealIntervalHours = constraints.mealIntervalHours ?? 6;
  const medicRequiredOnSet = constraints.medicRequiredOnSet ?? true;
  const stuntCoordinatorRequired = constraints.stuntCoordinatorRequired ?? false;
  const completionBondPercent = constraints.completionBondContingencyPercent ?? 10;

  // Phase durations
  const prePhase = phases.find(p => p.name.toLowerCase().includes('pre') || p.id.includes('pre'));
  const preDays = prePhase ? prePhase.durationDays : 20;

  const prodPhase = phases.find(p => p.name.toLowerCase().includes('prod') || p.id.includes('prod'));
  const prodDays = prodPhase ? prodPhase.durationDays : 30;
  const projectedProdCost = prodDays * constraints.dailyBurnRateCap;

  const postPhase = phases.find(p => p.name.toLowerCase().includes('post') || p.id.includes('post'));
  const postDays = postPhase ? postPhase.durationDays : 20;
  const totalDays = preDays + prodDays + postDays || 1;
  const calculatedOverheadPercentage = Math.round((postDays / totalDays) * 100);

  const checks: ComplianceCheckResult[] = [];

  // Check 1: Daily Rest Turnaround Hours
  const isTurnaroundSafe = turnaroundHours >= activeGuild.recommendedTurnaround;
  checks.push({
    ruleCode: 'REST_DAILY_TURNAROUND',
    name: 'Daily Rest Turnaround',
    category: 'rest',
    isCompliant: isTurnaroundSafe,
    actualValue: turnaroundHours,
    thresholdValue: activeGuild.recommendedTurnaround,
    unit: 'hours',
    severity: 'critical',
    violationMessage: activeGuild.turnaroundViolationMessage,
    guidance: `Guild requires minimum ${activeGuild.recommendedTurnaround}h between wrap and next call time.`,
  });

  // Check 2: Weekend Rest Turnaround Hours
  const isWeekendSafe = weekendTurnaroundHours >= activeGuild.recommendedWeekendTurnaround;
  checks.push({
    ruleCode: 'REST_WEEKEND_TURNAROUND',
    name: 'Weekend Rest Turnaround',
    category: 'rest',
    isCompliant: isWeekendSafe,
    actualValue: weekendTurnaroundHours,
    thresholdValue: activeGuild.recommendedWeekendTurnaround,
    unit: 'hours',
    severity: 'critical',
    violationMessage: activeGuild.weekendViolationMessage,
    guidance: `Guild requires minimum ${activeGuild.recommendedWeekendTurnaround}h unbroken weekend rest.`,
  });

  // Check 3: Maximum Workday Shift Length
  const isWorkdaySafe = maxWorkdayHours <= activeGuild.recommendedMaxWorkday;
  checks.push({
    ruleCode: 'HOURS_MAX_WORKDAY',
    name: 'Max Workday Shift Cap',
    category: 'rest',
    isCompliant: isWorkdaySafe,
    actualValue: maxWorkdayHours,
    thresholdValue: activeGuild.recommendedMaxWorkday,
    unit: 'hours',
    severity: 'critical',
    violationMessage: 'Excessive shift hours trigger severe crew fatigue and guild stop-work notices.',
    guidance: `Cap standard shooting day at ${activeGuild.recommendedMaxWorkday} hours before overtime.`,
  });

  // Check 4: Mandatory Meal Interval
  const isMealSafe = mealIntervalHours <= activeGuild.recommendedMealInterval;
  checks.push({
    ruleCode: 'CATERING_MEAL_INTERVAL',
    name: 'Mandatory Meal Interval',
    category: 'catering',
    isCompliant: isMealSafe,
    actualValue: mealIntervalHours,
    thresholdValue: activeGuild.recommendedMealInterval,
    unit: 'hours',
    severity: 'warning',
    violationMessage: activeGuild.mealViolationMessage,
    guidance: `Provide full hot catering within ${activeGuild.recommendedMealInterval} hours of call.`,
  });

  // Check 5: Budget & Completion Bond Safety Buffer
  const bondReserveAmount = (constraints.budgetLimit * completionBondPercent) / 100;
  const remainingBudget = constraints.budgetLimit - projectedProdCost;
  const isBudgetSafe = remainingBudget >= bondReserveAmount;
  checks.push({
    ruleCode: 'FINANCE_COMPLETION_BOND',
    name: 'Completion Bond Reserve',
    category: 'budget',
    isCompliant: isBudgetSafe,
    actualValue: Math.max(0, remainingBudget),
    thresholdValue: bondReserveAmount,
    unit: '$',
    severity: 'critical',
    violationMessage: 'Production burn rate leaves insufficient reserve to satisfy completion bond.',
    guidance: `Maintain at least ${completionBondPercent}% cash buffer above projected production spend.`,
  });

  // Check 6: Pre-production Permit Lead Time
  const isPermitSafe = preDays >= constraints.permitLeadTimeDays;
  checks.push({
    ruleCode: 'SCHEDULE_PERMIT_LEAD',
    name: 'Permit & Location Clearance Window',
    category: 'schedule',
    isCompliant: isPermitSafe,
    actualValue: preDays,
    thresholdValue: constraints.permitLeadTimeDays,
    unit: 'days',
    severity: 'warning',
    violationMessage: 'Pre-production schedule is too compressed to guarantee municipal location permits.',
    guidance: `Allow at least ${constraints.permitLeadTimeDays} days for permit processing.`,
  });

  // Check 7: Cast Hold Window Integrity
  const isCastHoldSafe = prodDays <= constraints.castAvailabilityDays;
  checks.push({
    ruleCode: 'CAST_HOLD_WINDOW',
    name: 'Lead Talent Availability Window',
    category: 'schedule',
    isCompliant: isCastHoldSafe,
    actualValue: prodDays,
    thresholdValue: constraints.castAvailabilityDays,
    unit: 'days',
    severity: 'critical',
    violationMessage: 'Production shooting schedule exceeds contracted actor hold days.',
    guidance: `Re-block scenes or negotiate talent extension beyond ${constraints.castAvailabilityDays} days.`,
  });

  // Check 8: Post-Production Overhead Ratio
  const isOverheadSafe = calculatedOverheadPercentage >= constraints.postOverheadRatio;
  checks.push({
    ruleCode: 'SCHEDULE_POST_OVERHEAD',
    name: 'Post-Production Overhead Ratio',
    category: 'schedule',
    isCompliant: isOverheadSafe,
    actualValue: calculatedOverheadPercentage,
    thresholdValue: constraints.postOverheadRatio,
    unit: '%',
    severity: 'advisory',
    violationMessage: 'Post-production duration ratio is low relative to standard delivery timelines.',
    guidance: `Target post-production allocation of at least ${constraints.postOverheadRatio}%.`,
  });

  // Check 9: Outdoor Weather Contingency Buffer
  const isWeatherSafe = prodDays < 20 || constraints.weatherContingencyBuffer >= activeGuild.recommendedWeatherBuffer;
  checks.push({
    ruleCode: 'SAFETY_WEATHER_BUFFER',
    name: 'Weather & Exterior Contingency Days',
    category: 'safety',
    isCompliant: isWeatherSafe,
    actualValue: constraints.weatherContingencyBuffer,
    thresholdValue: activeGuild.recommendedWeatherBuffer,
    unit: 'days',
    severity: 'warning',
    violationMessage: 'Insufficient weather contingency days for full outdoor principal photography.',
    guidance: `Include at least ${activeGuild.recommendedWeatherBuffer} buffer days for exterior shoots.`,
  });

  // Check 10: Screenplay Lock Status
  const isDevDone = phases.find(p => p.name.toLowerCase().includes('dev'))?.status === 'completed';
  const isScriptLockSafe = !(!constraints.screenplayLocked && isDevDone);
  checks.push({
    ruleCode: 'SCRIPT_LOCK_STATUS',
    name: 'Screenplay Draft Lock Verification',
    category: 'schedule',
    isCompliant: isScriptLockSafe,
    actualValue: constraints.screenplayLocked,
    thresholdValue: true,
    severity: 'advisory',
    violationMessage: 'Development phase completed but screenplay draft remains unlocked.',
    guidance: 'Lock shooting draft before finalizing breakdown item lists.',
  });

  // Check 11: Stunt & Medical Oversight Compatibility
  const isMedicalSafe = !stuntCoordinatorRequired || medicRequiredOnSet;
  checks.push({
    ruleCode: 'SAFETY_MEDICAL_OVERSIGHT',
    name: 'Stunt & Set Medic Safety Pairing',
    category: 'safety',
    isCompliant: isMedicalSafe,
    actualValue: medicRequiredOnSet,
    thresholdValue: true,
    severity: 'critical',
    violationMessage: 'Stunt sequences planned without mandatory on-set certified emergency medical technician.',
    guidance: 'A licensed set medic is required whenever stunt sequences or mechanical rigs are active.',
  });

  // Calculate score
  const passedCount = checks.filter(c => c.isCompliant).length;
  const overallScore = Math.round((passedCount / checks.length) * 100);
  const criticalViolationsCount = checks.filter(c => !c.isCompliant && c.severity === 'critical').length;
  const warningsCount = checks.filter(c => !c.isCompliant && c.severity === 'warning').length;

  return {
    overallScore,
    isFullyCompliant: criticalViolationsCount === 0 && warningsCount === 0,
    criticalViolationsCount,
    warningsCount,
    checks,
    activeGuild,
  };
}

export { INDIAN_GUILDS };
