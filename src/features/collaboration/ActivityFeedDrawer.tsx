import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ExternalLink,
  Lock,
  RefreshCw,
  X,
} from 'lucide-react';
import { services } from '../../services';
import type { ActivityDomainModel } from '../../services/contracts/types';
import { useProject } from '../projects/ProjectContext';
import { groupItemsByChronology } from './NotificationsDrawer';

export interface ActivityFeedDrawerProps {
  onNavigateToActivity?: (activity: ActivityDomainModel) => boolean | Promise<boolean>;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  member_joined: 'Member Joined',
  member_role_changed: 'Role Updated',
  discussion_created: 'Discussion Started',
  discussion_resolved: 'Discussion Resolved',
  discussion_reopened: 'Discussion Reopened',
  call_sheet_published: 'Call Sheet',
  dpr_submitted: 'DPR Submitted',
  dpr_approved: 'DPR Approved',
  shoot_day_rescheduled: 'Shoot Schedule',
  event_rescheduled: 'Calendar Event',
  task_assigned: 'Task Assigned',
  task_completed: 'Task Completed',
  script_locked: 'Script Locked',
  schedule_updated: 'Schedule',
};

function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ActivityFeedDrawer: React.FC<ActivityFeedDrawerProps> = ({
  onNavigateToActivity,
}) => {
  const { activeProject, activeProjectId, isActivityOpen, closeActivity, collaborationRevision } =
    useProject();
  const isLocalOnly = activeProject?.persistence === 'local';
  const isMockMode = activeProject?.persistence === 'mock';

  const [items, setItems] = useState<ActivityDomainModel[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    if (!isActivityOpen || !activeProjectId || isLocalOnly) return;
    setLoading(true);
    setError(null);
    try {
      const page = await services.activity.getProjectActivityPage(activeProjectId, { limit: 25 });
      setItems(page.activities);
      setHasMore(page.hasMore);
    } catch (err: any) {
      setError(err?.message || 'Unable to load project activity.');
    } finally {
      setLoading(false);
    }
  }, [isActivityOpen, activeProjectId, isLocalOnly]);

  useEffect(() => {
    if (!isActivityOpen) {
      setNavigationNotice(null);
      return;
    }
    if (!isLocalOnly) {
      loadFeed();
    }
  }, [isActivityOpen, isLocalOnly, loadFeed]);

  const activitySyncRev = collaborationRevision?.activity ?? 0;
  useEffect(() => {
    if (!activitySyncRev || !isActivityOpen || isLocalOnly) return;
    void loadFeed();
  }, [activitySyncRev, isActivityOpen, isLocalOnly, loadFeed]);

  useEffect(() => {
    setItems([]);
    setHasMore(false);
    setNavigationNotice(null);
  }, [activeProjectId]);

  const handleLoadMore = async () => {
    if (!activeProjectId || !hasMore || loadingMore || items.length === 0) return;
    const last = items[items.length - 1];
    setLoadingMore(true);
    try {
      const page = await services.activity.getProjectActivityPage(activeProjectId, {
        beforeCreatedAt: last.createdAt,
        beforeId: last.id,
        limit: 25,
      });
      setItems(prev => {
        const seen = new Set(prev.map(i => i.id));
        return [...prev, ...page.activities.filter(i => !seen.has(i.id))];
      });
      setHasMore(page.hasMore);
    } catch (err: any) {
      setError(err?.message || 'Unable to load older activity.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpenSource = async (item: ActivityDomainModel) => {
    setNavigationNotice(null);
    if (!onNavigateToActivity) return;
    const ok = await onNavigateToActivity(item);
    if (ok === false) {
      setNavigationNotice(
        `"${item.entityLabel || item.title}" is no longer accessible or was removed.`
      );
      return;
    }
    closeActivity();
  };

  const grouped = useMemo(() => groupItemsByChronology(items), [items]);

  if (!isActivityOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end select-text"
      role="dialog"
      aria-label="Production Activity"
      data-testid="activity-drawer"
    >
      <div className="w-full max-w-lg h-full bg-[#0c1018] border-l border-white/[0.1] flex flex-col shadow-2xl">
        <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#101521] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shrink-0">
              <ActivityIcon className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#f3efe6] truncate">
                  Production Activity
                </h2>
                {isMockMode && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono text-amber-200">
                    Offline Mock
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {activeProject
                  ? `Meaningful changes across ${activeProject.title}`
                  : 'Shared chronological production log'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isLocalOnly && (
              <button
                type="button"
                onClick={loadFeed}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                title="Refresh activity"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={closeActivity}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              aria-label="Close Activity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLocalOnly ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-sm space-y-3 rounded-2xl border border-amber-500/25 bg-amber-950/20 p-6">
              <Lock className="w-8 h-8 text-amber-300 mx-auto" />
              <h3 className="text-sm font-semibold text-[#f3efe6]">Local-Only Project</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Local-only projects keep operations in this browser only and do not publish a shared
                production history feed.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            {navigationNotice && (
              <div
                data-testid="activity-missing-source-notice"
                className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 flex items-start gap-2 text-xs text-amber-200"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                <span className="flex-1">{navigationNotice}</span>
                <button
                  type="button"
                  onClick={() => setNavigationNotice(null)}
                  className="text-amber-300 hover:text-white cursor-pointer"
                  aria-label="Dismiss notice"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {loading && items.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Loading production history...
              </div>
            ) : grouped.length === 0 ? (
              <div
                data-testid="activity-empty-state"
                className="py-16 text-center space-y-2 max-w-xs mx-auto"
              >
                <ActivityIcon className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No recorded activity yet</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Membership changes, Call Sheets, DPR submissions, schedule shifts, tasks, and
                  discussions will appear here automatically.
                </p>
              </div>
            ) : (
              grouped.map(section => (
                <div key={section.bucket} className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
                    {section.bucket}
                  </div>
                  {section.items.map(item => (
                    <div
                      key={item.id}
                      data-testid={`activity-item-${item.id}`}
                      className="rounded-xl border border-white/[0.07] bg-[#101521] p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-white truncate">
                            {item.userFullName || 'Production Member'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] font-mono text-slate-300">
                            {ACTIVITY_TYPE_LABELS[item.activityType] || item.activityType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {formatActivityTime(item.createdAt)}
                        </span>
                      </div>

                      <div className="text-xs text-[#f3efe6] font-medium">{item.title}</div>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      {item.entityType && item.entityId && onNavigateToActivity && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            data-testid={`activity-open-btn-${item.id}`}
                            onClick={() => handleOpenSource(item)}
                            className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
                          >
                            View {item.entityLabel ? item.entityLabel : 'Record'}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}

            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-slate-300 cursor-pointer"
                >
                  {loadingMore ? 'Loading...' : 'Load older activity'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
