import type { FilmProject } from '../../../types';
import { getVaultStore } from '../../vault/services/vaultMediaService';
import type {
  BoardCanvasItem,
  CameraSetup,
  ShotPlanRecord,
  StoryboardPanelRecord,
  UnifiedBoardRecord,
  VisualReferenceAsset,
} from '../types';
import { getUnifiedBoards } from './boardService';
import {
  getCanonicalVisualizeScreenplayContext,
  getProductionVisualizeStore,
} from './visualizeFoundationService';

export type WorkflowIssueSeverity = 'warning' | 'info';
export type WorkflowTargetArea =
  | 'storyboards'
  | 'shot-lists'
  | 'camera-setups'
  | 'boards'
  | 'vault';

export interface WorkflowAuditIssue {
  id: string;
  area: WorkflowTargetArea;
  severity: WorkflowIssueSeverity;
  code: string;
  title: string;
  detail: string;
  recordId?: string;
}

export interface WorkflowMatchedRecord {
  area: WorkflowTargetArea;
  id: string;
  label: string;
  meta: string;
}

export interface WorkflowAssetUsageEntry {
  assetId: string;
  filename: string;
  usedInStoryboards: number;
  usedInShots: number;
  usedInSetups: number;
  usedInBoards: string[];
  totalUsages: number;
}

export interface VisualizeWorkflowAuditResult {
  productionId: string;
  productionTitle: string;
  auditedAt: string;
  confirmedFacts: {
    hasScreenplay: boolean;
    sceneCount: number;
    storyboardPanelCount: number;
    shotCount: number;
    cameraSetupCount: number;
    boardCount: number;
    archivedBoardCount: number;
    vaultVisualAssetCount: number;
  };
  issues: WorkflowAuditIssue[];
  uncertainties: string[];
  assetUsages: WorkflowAssetUsageEntry[];
}

export interface WorkflowAssistantResponse {
  query: string;
  executedAt: string;
  audit: VisualizeWorkflowAuditResult;
  matchedRecords: WorkflowMatchedRecord[];
  matchedIssues: WorkflowAuditIssue[];
  groundedOverviewLines: string[];
}

/**
 * Pure, deterministic workflow audit across Storyboards, Shot Lists, Camera Setups, Boards & Vault.
 * Strictly read-only: never invents facts, never authors creative content, never mutates records.
 */
export function auditVisualiseWorkflow(project: FilmProject): VisualizeWorkflowAuditResult {
  const store = getProductionVisualizeStore(project);
  const vault = getVaultStore(project);
  const screenplay = getCanonicalVisualizeScreenplayContext(project);
  const boards = getUnifiedBoards(project);

  const validAssetIds = new Set<string>(store.referenceAssets.map((a) => a.id));
  const sceneIds = new Set<string>(screenplay.scenes.map((s) => s.id));
  const setupById = new Map<string, CameraSetup>();
  store.cameraSetups.forEach((c) => setupById.set(c.id, c));
  const panelById = new Map<string, StoryboardPanelRecord>();
  store.storyboardPanels.forEach((p) => panelById.set(p.id, p));

  const issues: WorkflowAuditIssue[] = [];
  const uncertainties: string[] = [];

  if (!screenplay.hasScreenplay || screenplay.scenes.length === 0) {
    uncertainties.push(
      'No active canonical screenplay scenes loaded — scene coverage and scene-to-shot consistency checks could not verify scene references.'
    );
  }

  // 1. Storyboards Audit
  for (const panel of store.storyboardPanels) {
    if (!panel.sceneId || (sceneIds.size > 0 && !sceneIds.has(panel.sceneId))) {
      issues.push({
        id: `sb-missing-scene-${panel.id}`,
        area: 'storyboards',
        severity: 'warning',
        code: 'PANEL_MISSING_SCENE',
        title: `Storyboard Panel ${panel.panelNumber} ("${panel.title}") lacks valid scene link`,
        detail: panel.sceneId
          ? `References scene ID "${panel.sceneId}" which is absent from active screenplay scenes.`
          : 'No canonical scene is assigned to this storyboard panel.',
        recordId: panel.id,
      });
    }

    const refs = [
      ...(panel.primaryAssetId ? [panel.primaryAssetId] : []),
      ...(panel.referenceAssetIds || []),
    ];
    if (refs.length === 0) {
      issues.push({
        id: `sb-no-ref-${panel.id}`,
        area: 'storyboards',
        severity: 'info',
        code: 'PANEL_MISSING_REFERENCE',
        title: `Storyboard Panel ${panel.panelNumber} (SC ${panel.sceneNumber}) has no visual frame attached`,
        detail: 'No Vault or shared visual reference image is currently linked to this panel.',
        recordId: panel.id,
      });
    } else {
      for (const refId of refs) {
        if (!validAssetIds.has(refId)) {
          issues.push({
            id: `sb-broken-ref-${panel.id}-${refId}`,
            area: 'storyboards',
            severity: 'warning',
            code: 'PANEL_BROKEN_ASSET_REF',
            title: `Storyboard Panel ${panel.panelNumber} references missing Vault asset`,
            detail: `Asset ID "${refId}" could not be resolved in this production's Reference Library.`,
            recordId: panel.id,
          });
        }
      }
    }
  }

  // 2. Shot Lists Audit
  const shotsPerSetup = new Map<string, ShotPlanRecord[]>();
  store.cameraSetups.forEach((c) => shotsPerSetup.set(c.id, []));

  for (const shot of store.shots) {
    if (!shot.sceneId || (sceneIds.size > 0 && !sceneIds.has(shot.sceneId))) {
      issues.push({
        id: `shot-missing-scene-${shot.id}`,
        area: 'shot-lists',
        severity: 'warning',
        code: 'SHOT_MISSING_SCENE',
        title: `Shot #${shot.shotNumber} lacks a valid canonical scene association`,
        detail: shot.sceneId
          ? `Scene ID "${shot.sceneId}" was not found in active screenplay scenes.`
          : 'Shot record is missing a scene reference.',
        recordId: shot.id,
      });
    }

    if (shot.cameraSetupId) {
      const setup = setupById.get(shot.cameraSetupId);
      if (!setup) {
        issues.push({
          id: `shot-broken-setup-${shot.id}`,
          area: 'shot-lists',
          severity: 'warning',
          code: 'SHOT_BROKEN_CAMERA_SETUP',
          title: `Shot #${shot.shotNumber} (SC ${shot.sceneNumber}) links to deleted Camera Setup`,
          detail: `Camera Setup ID "${shot.cameraSetupId}" no longer exists in this production.`,
          recordId: shot.id,
        });
      } else {
        shotsPerSetup.get(setup.id)?.push(shot);
        if (
          shot.focalLengthMm &&
          setup.focalLengthMm &&
          shot.focalLengthMm.trim().toLowerCase() !== setup.focalLengthMm.trim().toLowerCase()
        ) {
          issues.push({
            id: `shot-focal-mismatch-${shot.id}`,
            area: 'camera-setups',
            severity: 'info',
            code: 'SHOT_SETUP_SPEC_MISMATCH',
            title: `Focal length difference on Shot #${shot.shotNumber} vs "${setup.name}"`,
            detail: `Shot specifies "${shot.focalLengthMm}" while linked setup specifies "${setup.focalLengthMm}".`,
            recordId: shot.id,
          });
        }
      }
    } else {
      issues.push({
        id: `shot-unassigned-setup-${shot.id}`,
        area: 'shot-lists',
        severity: 'info',
        code: 'SHOT_UNASSIGNED_SETUP',
        title: `Shot #${shot.shotNumber} (SC ${shot.sceneNumber}) has no Camera Setup assigned`,
        detail: 'Shot is missing a linked camera setup or rig assignment.',
        recordId: shot.id,
      });
    }

    if (shot.storyboardPanelId) {
      const linkedPanel = panelById.get(shot.storyboardPanelId);
      if (!linkedPanel) {
        issues.push({
          id: `shot-broken-panel-${shot.id}`,
          area: 'shot-lists',
          severity: 'warning',
          code: 'SHOT_BROKEN_PANEL_LINK',
          title: `Shot #${shot.shotNumber} references missing Storyboard Panel`,
          detail: `Storyboard Panel ID "${shot.storyboardPanelId}" does not exist.`,
          recordId: shot.id,
        });
      } else if (linkedPanel.sceneId !== shot.sceneId) {
        issues.push({
          id: `shot-panel-scene-mismatch-${shot.id}`,
          area: 'shot-lists',
          severity: 'warning',
          code: 'SHOT_PANEL_SCENE_MISMATCH',
          title: `Shot #${shot.shotNumber} (SC ${shot.sceneNumber}) links to a Panel from SC ${linkedPanel.sceneNumber}`,
          detail: 'Storyboard panel association crosses different scenes; verify whether intentional.',
          recordId: shot.id,
        });
      }
    }
  }

  // 3. Camera Setups Audit
  for (const setup of store.cameraSetups) {
    const assigned = shotsPerSetup.get(setup.id) || [];
    if (assigned.length === 0) {
      issues.push({
        id: `setup-unused-${setup.id}`,
        area: 'camera-setups',
        severity: 'info',
        code: 'CAMERA_SETUP_UNUSED',
        title: `Camera Setup "${setup.name}" has 0 assigned shots`,
        detail: 'No Shot Plan currently references this camera setup.',
        recordId: setup.id,
      });
    }
    if (!setup.cameraBody && !setup.lensSeries && !setup.focalLengthMm) {
      issues.push({
        id: `setup-incomplete-${setup.id}`,
        area: 'camera-setups',
        severity: 'info',
        code: 'CAMERA_SETUP_INCOMPLETE_SPECS',
        title: `Camera Setup "${setup.name}" is missing technical camera/lens specs`,
        detail: 'Camera body, lens series, and focal length are all blank.',
        recordId: setup.id,
      });
    }
    for (const refId of setup.referenceAssetIds || []) {
      if (!validAssetIds.has(refId)) {
        issues.push({
          id: `setup-broken-ref-${setup.id}-${refId}`,
          area: 'camera-setups',
          severity: 'warning',
          code: 'SETUP_BROKEN_ASSET_REF',
          title: `Camera Setup "${setup.name}" references missing Vault asset`,
          detail: `Asset ID "${refId}" could not be found in production Reference Library.`,
          recordId: setup.id,
        });
      }
    }
  }

  // 4. Boards & Vault Cross-Reference Audit
  const assetUsageMap = new Map<string, WorkflowAssetUsageEntry>();
  const ensureUsage = (asset: VisualReferenceAsset): WorkflowAssetUsageEntry => {
    let entry = assetUsageMap.get(asset.id);
    if (!entry) {
      entry = {
        assetId: asset.id,
        filename: asset.originalFilename,
        usedInStoryboards: 0,
        usedInShots: 0,
        usedInSetups: 0,
        usedInBoards: [],
        totalUsages: 0,
      };
      assetUsageMap.set(asset.id, entry);
    }
    return entry;
  };
  store.referenceAssets.forEach(ensureUsage);

  store.storyboardPanels.forEach((p) => {
    const ids = new Set([
      ...(p.primaryAssetId ? [p.primaryAssetId] : []),
      ...(p.referenceAssetIds || []),
    ]);
    ids.forEach((id) => {
      const usage = assetUsageMap.get(id);
      if (usage) {
        usage.usedInStoryboards++;
        usage.totalUsages++;
      }
    });
  });

  store.shots.forEach((s) => {
    (s.referenceAssetIds || []).forEach((id) => {
      const usage = assetUsageMap.get(id);
      if (usage) {
        usage.usedInShots++;
        usage.totalUsages++;
      }
    });
  });

  store.cameraSetups.forEach((c) => {
    (c.referenceAssetIds || []).forEach((id) => {
      const usage = assetUsageMap.get(id);
      if (usage) {
        usage.usedInSetups++;
        usage.totalUsages++;
      }
    });
  });

  for (const board of boards) {
    const imgItems = board.items.filter((i) => i.kind === 'image');
    if (imgItems.length === 0 && board.status !== 'archived') {
      issues.push({
        id: `board-empty-${board.id}`,
        area: 'boards',
        severity: 'info',
        code: 'BOARD_EMPTY',
        title: `Board "${board.title}" currently has no reference images`,
        detail: 'Active board contains zero image tiles.',
        recordId: board.id,
      });
    }
    for (const item of imgItems) {
      if (!item.assetId || !validAssetIds.has(item.assetId)) {
        issues.push({
          id: `board-broken-ref-${board.id}-${item.id}`,
          area: 'boards',
          severity: 'warning',
          code: 'BOARD_BROKEN_ASSET_REF',
          title: `Board "${board.title}" item references missing Vault asset`,
          detail: `Canvas item "${item.text || item.id}" references unavailable asset ID "${item.assetId || 'unknown'}".`,
          recordId: board.id,
        });
      } else {
        const usage = assetUsageMap.get(item.assetId);
        if (usage && !usage.usedInBoards.includes(board.title)) {
          usage.usedInBoards.push(board.title);
          usage.totalUsages++;
        }
      }
    }
  }

  const assetUsages = Array.from(assetUsageMap.values());
  const unusedVaultAssets = assetUsages.filter((u) => u.totalUsages === 0);
  if (unusedVaultAssets.length > 0) {
    issues.push({
      id: 'vault-unused-assets-summary',
      area: 'vault',
      severity: 'info',
      code: 'VAULT_UNUSED_ASSETS',
      title: `${unusedVaultAssets.length} Vault visual ${unusedVaultAssets.length === 1 ? 'asset is' : 'assets are'} not yet linked in Visualise`,
      detail: unusedVaultAssets
        .slice(0, 6)
        .map((a) => a.filename)
        .join(', '),
    });
  }

  return {
    productionId: project.id,
    productionTitle: project.title,
    auditedAt: new Date().toISOString(),
    confirmedFacts: {
      hasScreenplay: screenplay.hasScreenplay,
      sceneCount: screenplay.scenes.length,
      storyboardPanelCount: store.storyboardPanels.length,
      shotCount: store.shots.length,
      cameraSetupCount: store.cameraSetups.length,
      boardCount: boards.length,
      archivedBoardCount: boards.filter((b) => b.status === 'archived').length,
      vaultVisualAssetCount:
        vault.assets.filter((a) => a.category === 'images' || a.category === 'graphics').length ||
        store.referenceAssets.length,
    },
    issues,
    uncertainties,
    assetUsages,
  };
}

function searchVisualiseRecords(
  project: FilmProject,
  audit: VisualizeWorkflowAuditResult,
  query: string
): {
  matchedRecords: WorkflowMatchedRecord[];
  matchedIssues: WorkflowAuditIssue[];
  groundedOverviewLines: string[];
} {
  const store = getProductionVisualizeStore(project);
  const boards: UnifiedBoardRecord[] = getUnifiedBoards(project);
  const q = query.trim().toLowerCase();

  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9-_]/g, ''))
    .filter((t) => t.length >= 2 && !['find', 'show', 'what', 'which', 'list', 'check', 'audit', 'where', 'with', 'the', 'for', 'are', 'and', 'all'].includes(t));

  const matchesText = (haystack: Array<string | undefined>) => {
    if (tokens.length === 0) return true;
    const joined = haystack.filter(Boolean).join(' ').toLowerCase();
    return tokens.some((tok) => joined.includes(tok));
  };

  const matchedRecords: WorkflowMatchedRecord[] = [];

  for (const panel of store.storyboardPanels) {
    if (matchesText([panel.panelNumber, panel.title, panel.sceneNumber, panel.framingNotes, panel.actionNotes, panel.status])) {
      matchedRecords.push({
        area: 'storyboards',
        id: panel.id,
        label: `Panel ${panel.panelNumber} — ${panel.title}`,
        meta: `Scene ${panel.sceneNumber || '?'} · Status: ${panel.status} · Refs: ${panel.referenceAssetIds.length + (panel.primaryAssetId ? 1 : 0)}`,
      });
    }
  }

  for (const shot of store.shots) {
    if (matchesText([shot.shotNumber, shot.sceneNumber, shot.description, shot.shotSize, shot.focalLengthMm, shot.status])) {
      matchedRecords.push({
        area: 'shot-lists',
        id: shot.id,
        label: `SC ${shot.sceneNumber} · Shot #${shot.shotNumber} — ${shot.description}`,
        meta: `Size: ${shot.shotSize || 'unset'} · Setup: ${shot.cameraSetupId ? 'assigned' : 'unassigned'} · Status: ${shot.status}`,
      });
    }
  }

  for (const setup of store.cameraSetups) {
    const usedByCount = store.shots.filter((s) => s.cameraSetupId === setup.id).length;
    if (matchesText([setup.name, setup.cameraBody, setup.lensSeries, setup.focalLengthMm, setup.supportRig])) {
      matchedRecords.push({
        area: 'camera-setups',
        id: setup.id,
        label: `Setup: ${setup.name}`,
        meta: `${setup.cameraBody || 'Camera unset'} · ${setup.focalLengthMm || 'Lens unset'} · ${usedByCount} assigned ${usedByCount === 1 ? 'shot' : 'shots'}`,
      });
    }
  }

  for (const board of boards) {
    const imgCount = board.items.filter((i: BoardCanvasItem) => i.kind === 'image').length;
    if (matchesText([board.title, board.description, board.categoryTag, board.department, board.status])) {
      matchedRecords.push({
        area: 'boards',
        id: board.id,
        label: `Board: ${board.title}`,
        meta: `Status: ${board.status} · ${imgCount} ${imgCount === 1 ? 'image' : 'images'} · ${board.sections.length} sections`,
      });
    }
  }

  for (const usage of audit.assetUsages) {
    if (matchesText([usage.filename, ...usage.usedInBoards])) {
      matchedRecords.push({
        area: 'vault',
        id: usage.assetId,
        label: `Vault Ref: ${usage.filename}`,
        meta: `Storyboards: ${usage.usedInStoryboards} · Shots: ${usage.usedInShots} · Setups: ${usage.usedInSetups} · Boards: ${usage.usedInBoards.length ? usage.usedInBoards.join(', ') : 'none'}`,
      });
    }
  }

  const matchedIssues =
    tokens.length === 0
      ? audit.issues
      : audit.issues.filter((iss) => matchesText([iss.area, iss.code, iss.title, iss.detail]));

  const f = audit.confirmedFacts;
  const groundedOverviewLines = [
    `Production "${audit.productionTitle}": ${f.sceneCount} canonical screenplay ${f.sceneCount === 1 ? 'scene' : 'scenes'}, ${f.storyboardPanelCount} storyboard panels, ${f.shotCount} planned shots, ${f.cameraSetupCount} camera setups, ${f.boardCount} unified boards (${f.archivedBoardCount} archived), and ${store.referenceAssets.length} Vault/shared visual assets.`,
    audit.issues.length === 0
      ? 'No missing references or workflow inconsistencies were detected across existing Visualise records.'
      : `Detected ${audit.issues.length} organisational/consistency ${audit.issues.length === 1 ? 'item' : 'items'} across existing records (${matchedIssues.length} matching this query).`,
  ];

  return {
    matchedRecords: matchedRecords.slice(0, 25),
    matchedIssues: (matchedIssues.length > 0 ? matchedIssues : audit.issues).slice(0, 25),
    groundedOverviewLines,
  };
}

/**
 * Explicitly invoked read-only Visualise Workflow Assistant query runner.
 * Operates purely through local deterministic checks across canonical project data
 * with zero network calls or AI dependencies.
 */
export function runVisualiseWorkflowAssistantQuery(
  project: FilmProject,
  query: string
): WorkflowAssistantResponse {
  const normalizedQuery = query.trim() || 'Full workflow audit and missing reference check';
  const audit = auditVisualiseWorkflow(project);
  const retrieval = searchVisualiseRecords(project, audit, normalizedQuery);

  return {
    query: normalizedQuery,
    executedAt: new Date().toISOString(),
    audit,
    matchedRecords: retrieval.matchedRecords,
    matchedIssues: retrieval.matchedIssues,
    groundedOverviewLines: retrieval.groundedOverviewLines,
  };
}
