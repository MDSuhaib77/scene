import type { FilmProject } from '../../types';
import type { DiscussionEntityType } from '../../services/contracts/types';

export interface ResolvedRecordDestination {
  tab: string;
  submodule?: string;
  focusDate?: string;
}

/**
 * Validates that a target collaboration entity still exists on the authoritative project state
 * and returns its destination route, or null if the record was deleted or is inaccessible.
 */
export function resolveRecordDestination(
  project: FilmProject | null | undefined,
  entityType: string | null | undefined,
  entityId: string | null | undefined
): ResolvedRecordDestination | null {
  if (!project || !entityType || !entityId) return null;

  const ps: any = (project as any).productionState || {};
  const vs: any = (project as any).visualizeState || {};

  switch (entityType) {
    case 'task': {
      const act = (project.phases || [])
        .flatMap(ph => ph.activities || [])
        .find(a => a.id === entityId);
      if (!act) return null;
      return {
        tab: 'production',
        submodule: 'calendar',
        focusDate: act.endDate || act.startDate,
      };
    }
    case 'production_event': {
      const ev = (ps.events || []).find((e: any) => e.id === entityId);
      if (!ev) return null;
      return {
        tab: 'production',
        submodule: 'calendar',
        focusDate: ev.date,
      };
    }
    case 'shooting_day': {
      const day = (ps.shootingDays || []).find((d: any) => d.id === entityId);
      if (!day) return null;
      return {
        tab: 'production',
        submodule: 'shoot',
        focusDate: day.date,
      };
    }
    case 'call_sheet': {
      const cs = (ps.callSheets || []).find((c: any) => c.id === entityId);
      if (!cs) return null;
      return { tab: 'production', submodule: 'shoot' };
    }
    case 'dpr': {
      const dpr = (ps.dailyReports || []).find((r: any) => r.id === entityId);
      if (!dpr) return null;
      return { tab: 'production', submodule: 'shoot' };
    }
    case 'directory_entry': {
      const dir = (ps.directoryEntries || []).find((e: any) => e.id === entityId);
      if (!dir) return null;
      return { tab: 'production', submodule: 'directory' };
    }
    case 'board': {
      if (!(vs.boards || []).some((b: any) => b.id === entityId)) return null;
      return { tab: 'visualize', submodule: 'boards' };
    }
    case 'storyboard_panel': {
      if (!(vs.storyboardPanels || []).some((p: any) => p.id === entityId)) return null;
      return { tab: 'visualize', submodule: 'storyboards' };
    }
    case 'shot': {
      if (!(vs.shots || []).some((s: any) => s.id === entityId)) return null;
      return { tab: 'visualize', submodule: 'shot-lists' };
    }
    case 'project': {
      return project.id === entityId ? { tab: 'overview' } : null;
    }
    default:
      return null;
  }
}

export function fallbackTabForDiscussionEntity(entityType: DiscussionEntityType): ResolvedRecordDestination {
  if (entityType === 'production_event') return { tab: 'production', submodule: 'calendar' };
  if (entityType === 'shooting_day' || entityType === 'call_sheet' || entityType === 'dpr') {
    return { tab: 'production', submodule: 'shoot' };
  }
  if (entityType === 'directory_entry') return { tab: 'production', submodule: 'directory' };
  if (entityType === 'board') return { tab: 'visualize', submodule: 'boards' };
  if (entityType === 'storyboard_panel') return { tab: 'visualize', submodule: 'storyboards' };
  return { tab: 'visualize', submodule: 'shot-lists' };
}
