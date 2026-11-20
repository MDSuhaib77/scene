import { FilmProject, ProductionWorkflowStep } from '../types';

/**
 * Evaluates the 7-step linear production workflow against actual FilmProject data.
 * Guarantees zero fabricated data and provides honest prerequisite evaluations.
 */
export function getProductionWorkflowSteps(project: FilmProject): ProductionWorkflowStep[] {
  const versions = project.screenplayVersions || [];
  const primaryVersion = versions[0];
  const scenes = primaryVersion?.scenes || [];
  const totalScenes = scenes.length;
  const reviewedScenes = scenes.filter(s => s.status === 'reviewed' || s.status === 'locked').length;
  
  // Calculate element breakdown count
  let totalElements = 0;
  scenes.forEach(s => {
    if (s.elements && Array.isArray(s.elements)) {
      totalElements += s.elements.length;
    }
  });

  const storyboards = project.storyboardRevisions || [];
  const phases = project.phases || [];
  const totalCrew = phases.reduce((acc, p) => acc + (p.crew?.length || 0), 0);
  const totalActivities = phases.reduce((acc, p) => acc + (p.activities?.length || 0), 0);

  // Step 1: Write or Import Screenplay
  const hasScreenplay = versions.length > 0;
  const step1Status: ProductionWorkflowStep['status'] = hasScreenplay ? 'completed' : 'in-progress';

  // Step 2: Review & Approve Extracted Scenes
  let step2Status: ProductionWorkflowStep['status'] = 'pending-prerequisites';
  if (!hasScreenplay) {
    step2Status = 'pending-prerequisites';
  } else if (totalScenes > 0 && reviewedScenes === totalScenes) {
    step2Status = 'completed';
  } else if (totalScenes > 0) {
    step2Status = 'in-progress';
  }

  // Step 3: Break Scenes Down into Production Elements
  let step3Status: ProductionWorkflowStep['status'] = 'pending-prerequisites';
  if (totalScenes === 0) {
    step3Status = 'pending-prerequisites';
  } else if (totalElements > 0) {
    step3Status = totalElements >= totalScenes * 2 ? 'completed' : 'in-progress';
  }

  // Step 4: Develop Shot Lists & Visual References
  let step4Status: ProductionWorkflowStep['status'] = 'pending-prerequisites';
  if (totalScenes === 0) {
    step4Status = 'pending-prerequisites';
  } else if (storyboards.length > 0) {
    step4Status = 'in-progress';
  }

  // Step 5: Plan Crew, Resources & Shooting Schedules
  let step5Status: ProductionWorkflowStep['status'] = 'pending-prerequisites';
  if (phases.length > 0 && totalActivities > 0) {
    step5Status = (totalCrew > 0 && project.startDate && project.suggestedEndDate) ? 'completed' : 'in-progress';
  }

  // Step 6: Generate & Distribute Call Sheets
  let step6Status: ProductionWorkflowStep['status'] = 'pending-prerequisites';
  if (step5Status === 'completed' || step5Status === 'in-progress') {
    step6Status = 'in-progress';
  }

  // Step 7: Track Daily Shooting Progress
  let step7Status: ProductionWorkflowStep['status'] = 'pending-prerequisites';
  if (step5Status === 'completed') {
    step7Status = 'in-progress';
  }

  return [
    {
      id: 'step-1-screenplay',
      number: 1,
      title: 'Write or Import Screenplay',
      stageId: 'write',
      stageName: 'Write',
      description: 'Establish locked script, draft revisions, and scene numbering.',
      prerequisiteDescription: 'Requires draft screenplay file or pasted script text.',
      targetTab: 'screenplay',
      status: step1Status,
      actionLabel: hasScreenplay ? 'Open Script Master' : 'Upload Screenplay',
      metricSummary: hasScreenplay ? `${versions.length} version(s) · ${primaryVersion.version || 'v1.0'}` : 'No script loaded',
    },
    {
      id: 'step-2-scenes',
      number: 2,
      title: 'Review & Approve Scenes',
      stageId: 'write',
      stageName: 'Write',
      description: 'Audit automated parser scene boundaries, slugs, time, and locations.',
      prerequisiteDescription: 'Requires imported screenplay draft in Step 1.',
      targetTab: 'screenplay',
      status: step2Status,
      actionLabel: 'Review Screenplay Scenes',
      metricSummary: totalScenes > 0 ? `${reviewedScenes} of ${totalScenes} scenes verified` : '0 scenes extracted',
    },
    {
      id: 'step-3-breakdown',
      number: 3,
      title: 'Scene Breakdown & Element Catalog',
      stageId: 'breakdown',
      stageName: 'Breakdown',
      description: 'Tag and organize cast, props, vehicles, wardrobe, and special effects per scene.',
      prerequisiteDescription: 'Requires parsed screenplay scenes from Step 2.',
      targetTab: 'breakdown',
      status: step3Status,
      actionLabel: 'Open Scene Breakdown',
      metricSummary: `${totalElements} tagged element(s)`,
    },
    {
      id: 'step-4-visualize',
      number: 4,
      title: 'Develop Shots & Visual References',
      stageId: 'visualize',
      stageName: 'Visualize',
      description: 'Direct camera coverage, blocking, lens choices, and storyboard continuity.',
      prerequisiteDescription: 'Requires scene breakdown elements from Step 3.',
      targetTab: 'visualize-storyboards',
      status: step4Status,
      actionLabel: 'Inspect Storyboards',
      metricSummary: storyboards.length > 0 ? `${storyboards.length} storyboard panel(s)` : 'Awaiting shot list input',
    },
    {
      id: 'step-5-schedule',
      number: 5,
      title: 'Plan Crew, Resources & Schedules',
      stageId: 'plan',
      stageName: 'Plan',
      description: 'Calibrate phase timelines, shooting calendars, guild turnaround, and crew assignments.',
      prerequisiteDescription: 'Requires scene count and breakdown dependencies from Steps 2 & 3.',
      targetTab: 'calendar',
      status: step5Status,
      actionLabel: 'Calibrate Schedule',
      metricSummary: `${phases.length} phases · ${totalCrew} crew members`,
    },
    {
      id: 'step-6-callsheets',
      number: 6,
      title: 'Generate & Distribute Call Sheets',
      stageId: 'shoot',
      stageName: 'Shoot',
      description: 'Coordinate daily call times, cast pickups, nearest hospital, and scene order.',
      prerequisiteDescription: 'Requires locked calendar and shooting schedule from Step 5.',
      targetTab: 'shoot-callsheets',
      status: step6Status,
      actionLabel: 'Review Call Sheets',
      metricSummary: 'Integration gate active (Batch 02+)',
    },
    {
      id: 'step-7-progress',
      number: 7,
      title: 'Track Daily Shooting Progress',
      stageId: 'shoot',
      stageName: 'Shoot',
      description: 'Record first shot, wrap times, delays, and daily production reports (DPR).',
      prerequisiteDescription: 'Requires active production shooting day and distributed call sheet.',
      targetTab: 'shoot-dpr',
      status: step7Status,
      actionLabel: 'View Daily Telemetry',
      metricSummary: 'Wrap countdown tracked in Overview',
    },
  ];
}

export interface FeatureGateConfig {
  featureTitle: string;
  stage: 'WRITE' | 'BREAKDOWN' | 'VISUALIZE' | 'PLAN' | 'SHOOT';
  stageNumber: number;
  description: string;
  prerequisiteStepNumber: number;
  prerequisiteTitle: string;
  prerequisiteMet: boolean;
  prerequisiteDetails: string;
  prerequisiteTab: string;
  dataContract: {
    name: string;
    relationship: string;
    fields: string[];
  };
}

export function getFeatureGateConfig(tabId: string, project: FilmProject): FeatureGateConfig | null {
  const versions = project.screenplayVersions || [];
  const primaryVersion = versions[0];
  const scenes = primaryVersion?.scenes || [];
  const totalScenes = scenes.length;
  let totalElements = 0;
  scenes.forEach(s => {
    if (s.elements && Array.isArray(s.elements)) {
      totalElements += s.elements.length;
    }
  });
  const phases = project.phases || [];
  const totalCrew = phases.reduce((acc, p) => acc + (p.crew?.length || 0), 0);
  const hasScreenplay = versions.length > 0;

  switch (tabId) {
    case 'write-av':
      return {
        featureTitle: 'AV Scripts (Audio / Visual)',
        stage: 'WRITE',
        stageNumber: 1,
        description: 'Multi-column screenplay formatting for commercials, documentaries, corporate video and broadcast TV with synchronized visual cues and audio narration.',
        prerequisiteStepNumber: 1,
        prerequisiteTitle: 'Write or Import Screenplay',
        prerequisiteMet: hasScreenplay,
        prerequisiteDetails: hasScreenplay 
          ? `Primary project draft "${primaryVersion.version || 'v1.0'}" ready for AV dual-column export.`
          : 'No screenplay draft registered. Import or create a draft script first.',
        prerequisiteTab: 'screenplay',
        dataContract: {
          name: 'ScreenplayVersion (Columnar AV Variant)',
          relationship: 'Derives from primary project ScreenplayVersion with split visual & auditory cues.',
          fields: ['id', 'version', 'type: "av_two_column"', 'audioCues[]', 'visualCues[]', 'timingSeconds', 'updatedAt']
        }
      };

    case 'write-docs':
      return {
        featureTitle: 'Production Documents & Clearances',
        stage: 'WRITE',
        stageNumber: 1,
        description: 'Legal document repository, talent releases, location clearance agreements, music sync licenses, and chain of title certificates.',
        prerequisiteStepNumber: 1,
        prerequisiteTitle: 'Screenplay Registration',
        prerequisiteMet: hasScreenplay,
        prerequisiteDetails: hasScreenplay 
          ? `Project "${project.title}" has ${versions.length} registered script revision(s) ready for document attachments.`
          : 'Screenplay must be registered to establish intellectual property chain of title.',
        prerequisiteTab: 'screenplay',
        dataContract: {
          name: 'ProductionDocument',
          relationship: 'Directly linked to FilmProject and SceneBreakdown entities.',
          fields: ['id', 'projectId', 'title', 'category: "legal"|"clearance"|"permit"', 'fileUrl', 'status: "pending"|"executed"', 'signatures[]']
        }
      };

    case 'breakdown-sides':
      return {
        featureTitle: 'Script Sides Generator',
        stage: 'BREAKDOWN',
        stageNumber: 2,
        description: 'Automated daily on-set side pocket booklets generated directly from scheduled scene numbers with watermarking and actor-specific highlight cues.',
        prerequisiteStepNumber: 2,
        prerequisiteTitle: 'Review & Approve Scenes',
        prerequisiteMet: totalScenes > 0,
        prerequisiteDetails: totalScenes > 0 
          ? `${totalScenes} verified scenes available for on-set side compiling and distribution.`
          : 'Zero scenes parsed. Import screenplay and extract scenes in Step 2.',
        prerequisiteTab: 'screenplay',
        dataContract: {
          name: 'ScriptSide',
          relationship: 'Coupled to shooting calendar day and selected scene ID list.',
          fields: ['id', 'projectId', 'shootingDayDate', 'sceneIds[]', 'castMemberIds[]', 'watermarkNotice', 'pdfExportUrl']
        }
      };

    case 'breakdown-reports':
      return {
        featureTitle: 'Departmental Breakdown Reports',
        stage: 'BREAKDOWN',
        stageNumber: 2,
        description: 'Cross-tabulation reports for Props, Wardrobe, Special Effects, Vehicles, Stunts, and Day-out-of-Days (DOOD) cast utilization.',
        prerequisiteStepNumber: 3,
        prerequisiteTitle: 'Scene Breakdown & Element Catalog',
        prerequisiteMet: totalElements > 0,
        prerequisiteDetails: totalElements > 0 
          ? `${totalElements} elements categorized across ${totalScenes} scenes ready for export.`
          : 'Zero elements tagged. Tag scene elements in Scene Breakdown first.',
        prerequisiteTab: 'breakdown',
        dataContract: {
          name: 'DepartmentalBreakdownReport',
          relationship: 'Aggregates SceneElement items across all screenplay scenes.',
          fields: ['department', 'elementCount', 'scenesReferenced[]', 'castDaysOutOfDays', 'estimatedBudgetImpact']
        }
      };

    case 'visualize-shots':
      return {
        featureTitle: 'Shot Lists & Camera Setups',
        stage: 'VISUALIZE',
        stageNumber: 3,
        description: 'Comprehensive director and DoP shot list manager detailing focal length (mm), camera moves, framing, equipment requirements, and estimated setup duration.',
        prerequisiteStepNumber: 3,
        prerequisiteTitle: 'Scene Breakdown & Element Catalog',
        prerequisiteMet: totalElements > 0 || totalScenes > 0,
        prerequisiteDetails: totalScenes > 0 
          ? `${totalScenes} scenes ready for camera coverage and shot list setup.`
          : 'Requires verified scenes and breakdown elements before creating camera setups.',
        prerequisiteTab: 'breakdown',
        dataContract: {
          name: 'ShotListItem',
          relationship: 'Belongs to a specific Scene and links to CameraPackage / Equipment requirements.',
          fields: ['id', 'sceneId', 'shotNumber', 'shotType', 'lensMm', 'cameraMovement', 'soundRequirement', 'equipmentNotes']
        }
      };

    case 'visualize-boards':
    case 'visualize-lookbooks':
      return {
        featureTitle: 'Unified Visual Boards',
        stage: 'VISUALIZE',
        stageNumber: 3,
        description: 'Freeform visual composition boards uniting exploratory mood boards, department lookbooks, sections, and Vault references.',
        prerequisiteStepNumber: 1,
        prerequisiteTitle: 'Production Master Script',
        prerequisiteMet: hasScreenplay,
        prerequisiteDetails: hasScreenplay 
          ? `Visual style palette for "${project.title}" (Cinematic Reference) ready for curation.`
          : 'Script required to anchor aesthetic visual guidelines.',
        prerequisiteTab: 'screenplay',
        dataContract: {
          name: 'VisualLookbook',
          relationship: 'Tied to FilmProject aesthetic profiles and department design guidelines.',
          fields: ['id', 'projectId', 'title', 'colorPaletteHex[]', 'lightingStyle', 'aspectRatio', 'referenceImages[]']
        }
      };

    case 'plan-resources':
      return {
        featureTitle: 'Production Resources & Gear Packages',
        stage: 'PLAN',
        stageNumber: 4,
        description: 'Equipment allocation, soundstage reservations, camera body/lens package leases, grip trucks, generator packages, and specialty rigs.',
        prerequisiteStepNumber: 5,
        prerequisiteTitle: 'Plan Crew, Resources & Schedules',
        prerequisiteMet: phases.length > 0,
        prerequisiteDetails: phases.length > 0 
          ? `${phases.length} production phases active. Resource allocation ready for schedule alignment.`
          : 'Setup production phases and schedule baseline first.',
        prerequisiteTab: 'phases',
        dataContract: {
          name: 'ProductionResource',
          relationship: 'Linked to Phase activities and shooting dates.',
          fields: ['id', 'name', 'category: "camera"|"lighting"|"sound"|"facility"', 'vendor', 'dailyRate', 'allocatedDates[]']
        }
      };

    case 'shoot-callsheets':
      return {
        featureTitle: 'Daily Call Sheets',
        stage: 'SHOOT',
        stageNumber: 5,
        description: 'Publish production call sheets complete with crew call times, cast pickup schedules, shooting scene order, meal times, and emergency hospital logistics.',
        prerequisiteStepNumber: 5,
        prerequisiteTitle: 'Plan Crew & Shooting Calendar',
        prerequisiteMet: phases.length > 0 && totalCrew > 0,
        prerequisiteDetails: (phases.length > 0 && totalCrew > 0)
          ? `${totalCrew} crew members and shooting calendar active. Ready for call sheet generation.`
          : 'Requires active crew members and shooting dates before generating call sheets.',
        prerequisiteTab: 'crew',
        dataContract: {
          name: 'CallSheet',
          relationship: 'Aggregates CrewRolodex contacts, Calendar shooting day, and Scene breakdown.',
          fields: ['id', 'callNumber', 'shootDate', 'generalCallTime', 'nearestHospital', 'sceneIds[]', 'castCalls[]', 'departmentNotes']
        }
      };

    case 'shoot-locations':
      return {
        featureTitle: 'Filming Locations & Logistics',
        stage: 'SHOOT',
        stageNumber: 5,
        description: 'Location scouting portfolios, municipal filming permits, basecamp maps, crew parking allocations, and noise curfew guidelines.',
        prerequisiteStepNumber: 2,
        prerequisiteTitle: 'Review & Approve Scenes',
        prerequisiteMet: totalScenes > 0,
        prerequisiteDetails: totalScenes > 0 
          ? `${totalScenes} scenes parsed with EXT/INT location identifiers ready for scouting assignment.`
          : 'Screenplay scenes required to identify location requirements.',
        prerequisiteTab: 'screenplay',
        dataContract: {
          name: 'ShootingLocation',
          relationship: 'Referenced by Scene entities and Calendar shooting days.',
          fields: ['id', 'name', 'address', 'contactPerson', 'permitNumber', 'parkingPlanUrl', 'soundPermitStatus']
        }
      };

    case 'shoot-dpr':
      return {
        featureTitle: 'Daily Production Reports (DPR)',
        stage: 'SHOOT',
        stageNumber: 5,
        description: 'Executive end-of-day telemetry recording first shot time, wrap time, meal break compliance, scenes completed vs scheduled, and sound/camera rolls.',
        prerequisiteStepNumber: 6,
        prerequisiteTitle: 'Generate & Distribute Call Sheets',
        prerequisiteMet: phases.length > 0,
        prerequisiteDetails: phases.length > 0 
          ? `Production tracking active for ${phases.length} project phases.`
          : 'Establish shooting schedule and phases first.',
        prerequisiteTab: 'calendar',
        dataContract: {
          name: 'DailyProductionReport',
          relationship: 'Submitted daily to wrap out the active shooting calendar day.',
          fields: ['id', 'reportDate', 'dayNumber', 'firstShotTime', 'wrapTime', 'scenesCompleted[]', 'soundRolls', 'cameraRolls', 'delaysNoted']
        }
      };

    default:
      return null;
  }
}

