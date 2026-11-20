import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Lock,
  RefreshCw,
  Settings,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { services } from '../../services';
import type {
  NotificationCategory,
  NotificationDomainModel,
  NotificationFilter,
  NotificationPreferencesDomainModel,
  UpdateNotificationPreferencesInput,
} from '../../services/contracts/types';
import { useProject } from '../projects/ProjectContext';

export interface NotificationsDrawerProps {
  /**
   * Navigates to the authoritative source record. Return `false` if the target record
   * is no longer accessible or was deleted so the inbox can show a safe fallback notice.
   */
  onNavigateToNotification?: (notification: NotificationDomainModel) => boolean | Promise<boolean>;
}

export type ChronologyBucket = 'Today' | 'Yesterday' | 'Earlier';

export function getChronologyBucket(isoTimestamp: string, referenceDate: Date = new Date()): ChronologyBucket {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return 'Earlier';

  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (targetDay >= startOfToday) return 'Today';
  if (targetDay >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

export function groupItemsByChronology<T extends { createdAt: string }>(
  items: T[],
  referenceDate: Date = new Date()
): Array<{ bucket: ChronologyBucket; items: T[] }> {
  const buckets: Record<ChronologyBucket, T[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };
  for (const item of items) {
    buckets[getChronologyBucket(item.createdAt, referenceDate)].push(item);
  }
  return (['Today', 'Yesterday', 'Earlier'] as ChronologyBucket[])
    .filter(bucket => buckets[bucket].length > 0)
    .map(bucket => ({ bucket, items: buckets[bucket] }));
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  people_security: 'People & Access',
  discussions: 'Discussions',
  production: 'Production',
};

function formatNotifTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  onNavigateToNotification,
}) => {
  const {
    activeProject,
    activeProjectId,
    isNotificationsOpen,
    closeNotifications,
    refreshNotificationUnreadCount,
    openDiscussions,
    collaborationRevision,
  } = useProject();

  const isLocalOnly = activeProject?.persistence === 'local';
  const isMockMode = activeProject?.persistence === 'mock';

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [items, setItems] = useState<NotificationDomainModel[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<NotificationPreferencesDomainModel | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!isNotificationsOpen || isLocalOnly) return;
    setLoading(true);
    setError(null);
    try {
      const page = await services.notifications.getNotifications({
        projectId: activeProjectId,
        filter,
        limit: 25,
      });
      setItems(page.notifications);
      setHasMore(page.hasMore);
      await refreshNotificationUnreadCount();
    } catch (err: any) {
      setError(err?.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [isNotificationsOpen, isLocalOnly, activeProjectId, filter, refreshNotificationUnreadCount]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      setNavigationNotice(null);
      return;
    }
    if (!isLocalOnly) {
      loadNotifications();
    }
  }, [isNotificationsOpen, isLocalOnly, loadNotifications]);

  const notificationsSyncRev = collaborationRevision?.notifications ?? 0;
  useEffect(() => {
    if (!notificationsSyncRev || !isNotificationsOpen || showPreferences || isLocalOnly) return;
    void loadNotifications();
  }, [notificationsSyncRev, isNotificationsOpen, showPreferences, isLocalOnly, loadNotifications]);

  useEffect(() => {
    setItems([]);
    setHasMore(false);
    setNavigationNotice(null);
    setShowPreferences(false);
  }, [activeProjectId]);

  const loadPreferences = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const result = await services.notifications.getPreferences();
      setPrefs(result);
    } catch (err: any) {
      setError(err?.message || 'Unable to load notification preferences.');
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isNotificationsOpen && showPreferences && !isLocalOnly) {
      loadPreferences();
    }
  }, [isNotificationsOpen, showPreferences, isLocalOnly, loadPreferences]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || items.length === 0) return;
    const last = items[items.length - 1];
    setLoadingMore(true);
    try {
      const page = await services.notifications.getNotifications({
        projectId: activeProjectId,
        filter,
        beforeCreatedAt: last.createdAt,
        beforeId: last.id,
        limit: 25,
      });
      setItems(prev => {
        const seen = new Set(prev.map(i => i.id));
        return [...prev, ...page.notifications.filter(i => !seen.has(i.id))];
      });
      setHasMore(page.hasMore);
    } catch (err: any) {
      setError(err?.message || 'Unable to load older notifications.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (notif: NotificationDomainModel) => {
    if (notif.readAt) return;
    try {
      await services.notifications.markAsRead(notif.id);
      const nowIso = new Date().toISOString();
      setItems(prev =>
        prev
          .map(item => (item.id === notif.id ? { ...item, readAt: nowIso } : item))
          .filter(item => (filter === 'unread' ? !item.readAt : true))
      );
      await refreshNotificationUnreadCount();
    } catch (err: any) {
      setError(err?.message || 'Unable to mark notification as read.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await services.notifications.markAllAsRead(activeProjectId);
      const nowIso = new Date().toISOString();
      setItems(prev =>
        filter === 'unread'
          ? []
          : prev.map(item => (item.readAt ? item : { ...item, readAt: nowIso }))
      );
      await refreshNotificationUnreadCount();
    } catch (err: any) {
      setError(err?.message || 'Unable to mark all notifications as read.');
    }
  };

  const handleDismiss = async (notifId: string) => {
    try {
      await services.notifications.dismissNotification(notifId);
      setItems(prev => prev.filter(item => item.id !== notifId));
      await refreshNotificationUnreadCount();
    } catch (err: any) {
      setError(err?.message || 'Unable to dismiss notification.');
    }
  };

  const handleOpenSource = async (notif: NotificationDomainModel) => {
    setNavigationNotice(null);
    if (!notif.readAt) {
      await handleMarkAsRead(notif);
    }

    if (notif.entityType === 'thread' || notif.entityType === 'message') {
      closeNotifications();
      const targetEntityType = notif.metadata?.entity_type;
      const targetEntityId = notif.metadata?.entity_id;
      if (targetEntityType && targetEntityId) {
        openDiscussions({
          entityType: targetEntityType,
          entityId: targetEntityId,
          entityLabel: notif.entityLabel || 'Discussion',
        });
      } else {
        openDiscussions();
      }
      return;
    }

    if (onNavigateToNotification) {
      const ok = await onNavigateToNotification(notif);
      if (ok === false) {
        setNavigationNotice(
          `"${notif.entityLabel || notif.title}" is no longer accessible or was removed from this project.`
        );
        return;
      }
      closeNotifications();
    }
  };

  const handleTogglePref = async (key: keyof UpdateNotificationPreferencesInput) => {
    if (!prefs || prefsSaving) return;
    const nextValue = !prefs[key];
    setPrefsSaving(true);
    try {
      const updated = await services.notifications.updatePreferences({ [key]: nextValue });
      setPrefs(updated);
    } catch (err: any) {
      setError(err?.message || 'Unable to save preference.');
    } finally {
      setPrefsSaving(false);
    }
  };

  const grouped = useMemo(() => groupItemsByChronology(items), [items]);

  if (!isNotificationsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end select-text"
      role="dialog"
      aria-label="Notifications Inbox"
      data-testid="notifications-drawer"
    >
      <div className="w-full max-w-lg h-full bg-[#0c1018] border-l border-white/[0.1] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#101521] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#f3efe6] truncate">
                  {showPreferences ? 'Notification Preferences' : 'Notifications'}
                </h2>
                {isMockMode && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono text-amber-200">
                    Offline Mock
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {showPreferences
                  ? 'Personal attention controls (in-app only)'
                  : activeProject
                    ? `Items requiring your attention · ${activeProject.title}`
                    : 'Items requiring your attention'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isLocalOnly && (
              <button
                type="button"
                data-testid="notification-prefs-btn"
                onClick={() => setShowPreferences(v => !v)}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  showPreferences
                    ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-white'
                }`}
                title={showPreferences ? 'Back to inbox' : 'Notification preferences'}
                aria-label={showPreferences ? 'Back to inbox' : 'Notification preferences'}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {!isLocalOnly && !showPreferences && (
              <button
                type="button"
                onClick={loadNotifications}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                title="Refresh notifications"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-300' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={closeNotifications}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              aria-label="Close Notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Local-Only Guard */}
        {isLocalOnly ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-sm space-y-3 rounded-2xl border border-amber-500/25 bg-amber-950/20 p-6">
              <Lock className="w-8 h-8 text-amber-300 mx-auto" />
              <h3 className="text-sm font-semibold text-[#f3efe6]">Local-Only Project</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                This project is stored only in browser storage and has no cloud members or shared
                notifications.
              </p>
            </div>
          </div>
        ) : showPreferences ? (
          <div
            className="flex-1 overflow-y-auto p-5 space-y-4"
            data-testid="notification-preferences-panel"
          >
            <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-3.5 text-xs text-cyan-100 space-y-1">
              <div className="font-semibold">In-App Delivery Only</div>
              <p className="text-[11px] text-cyan-200/80 leading-relaxed">
                SceneOS currently delivers notifications inside the workspace inbox. Email, SMS,
                and browser push are not enabled in this release.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#111723] p-4 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                  <span>Security, Invitations & Access</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Project invitations and role or permission changes are always delivered.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono text-emerald-200 shrink-0">
                Always On
              </span>
            </div>

            {prefsLoading || !prefs ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading preferences...</div>
            ) : (
              <div className="space-y-2">
                {(
                  [
                    {
                      key: 'mentionsEnabled',
                      label: 'Direct @Mentions',
                      desc: 'When a teammate directly mentions you in a discussion.',
                    },
                    {
                      key: 'discussionRepliesEnabled',
                      label: 'Discussion Replies & Announcements',
                      desc: 'Replies in threads you started or joined.',
                    },
                    {
                      key: 'taskAssignmentsEnabled',
                      label: 'Task Assignments & Deadlines',
                      desc: 'Tasks assigned to you or deadline shifts on your tasks.',
                    },
                    {
                      key: 'scheduleChangesEnabled',
                      label: 'Schedule Changes',
                      desc: 'Rescheduled shooting days or call times affecting you.',
                    },
                    {
                      key: 'callSheetsEnabled',
                      label: 'Call Sheets',
                      desc: 'Published or revised Call Sheets where you are listed on call.',
                    },
                    {
                      key: 'dprReviewsEnabled',
                      label: 'DPR Reviews & Approvals',
                      desc: 'Daily Production Reports submitted for your review or approved.',
                    },
                  ] as Array<{
                    key: keyof UpdateNotificationPreferencesInput;
                    label: string;
                    desc: string;
                  }>
                ).map(row => {
                  const enabled = prefs[row.key];
                  return (
                    <label
                      key={row.key}
                      className="rounded-xl border border-white/[0.07] bg-[#101520] p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:border-white/[0.15] transition"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-[#f3efe6]">{row.label}</div>
                        <div className="text-[11px] text-slate-400">{row.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        data-testid={`pref-toggle-${row.key}`}
                        checked={Boolean(enabled)}
                        disabled={prefsSaving}
                        onChange={() => handleTogglePref(row.key)}
                        className="w-4 h-4 accent-indigo-500 cursor-pointer shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            <div className="px-5 py-2.5 border-b border-white/[0.06] bg-[#0e131e] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'unread', label: 'Unread' },
                    { id: 'mentions', label: '@Mentions' },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`notification-filter-${tab.id}`}
                    onClick={() => setFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      filter === tab.id
                        ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/35'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-testid="mark-all-notifications-read-btn"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                Mark all read
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-3 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            {navigationNotice && (
              <div
                data-testid="notification-missing-source-notice"
                className="mx-5 mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 flex items-start gap-2 text-xs text-amber-200"
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

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {loading && items.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Loading notifications...
                </div>
              ) : grouped.length === 0 ? (
                <div
                  data-testid="notifications-empty-state"
                  className="py-16 text-center space-y-2 max-w-xs mx-auto"
                >
                  <Bell className="w-7 h-7 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">
                    {filter === 'unread'
                      ? 'All caught up'
                      : filter === 'mentions'
                        ? 'No direct mentions yet'
                        : 'No notifications yet'}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Relevant mentions, thread replies, assignments, invitations, Call Sheets, and DPR
                    reviews will appear here.
                  </p>
                </div>
              ) : (
                grouped.map(section => (
                  <div key={section.bucket} className="space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
                      {section.bucket}
                    </div>
                    {section.items.map(notif => {
                      const isUnread = !notif.readAt;
                      return (
                        <div
                          key={notif.id}
                          data-testid={`notification-item-${notif.id}`}
                          className={`rounded-xl border p-3.5 transition space-y-2 ${
                            isUnread
                              ? 'bg-[#121928] border-indigo-400/35'
                              : 'bg-[#0e131d] border-white/[0.06] opacity-85'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              {isUnread && (
                                <span
                                  data-testid={`notification-unread-dot-${notif.id}`}
                                  className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"
                                />
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] font-mono text-slate-300">
                                {CATEGORY_LABELS[notif.category]}
                              </span>
                              {notif.priority === 'attention' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-[10px] font-mono text-amber-200">
                                  Attention
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-500">
                                {formatNotifTimestamp(notif.createdAt)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isUnread && (
                                <button
                                  type="button"
                                  data-testid={`notification-read-btn-${notif.id}`}
                                  onClick={() => handleMarkAsRead(notif)}
                                  className="p-1 rounded text-slate-400 hover:text-cyan-300 cursor-pointer"
                                  title="Mark as read"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                data-testid={`notification-dismiss-btn-${notif.id}`}
                                onClick={() => handleDismiss(notif.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-300 cursor-pointer"
                                title="Dismiss notification"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-[#f3efe6]">
                              {notif.title}
                            </div>
                            {notif.body && (
                              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                                {notif.body}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                            <span className="text-[11px] text-slate-500 truncate">
                              {notif.actorName ? `By ${notif.actorName}` : notif.projectTitle || 'SceneOS'}
                            </span>
                            <button
                              type="button"
                              data-testid={`notification-open-btn-${notif.id}`}
                              onClick={() => handleOpenSource(notif)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
                            >
                              Open
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                    {loadingMore ? 'Loading...' : 'Load older notifications'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
