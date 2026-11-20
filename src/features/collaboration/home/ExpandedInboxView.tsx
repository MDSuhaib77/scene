import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  RefreshCw,
  Clock,
  Filter,
  User,
  AtSign,
  Briefcase,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { services } from '../../../services';
import type { NotificationDomainModel, NotificationCategory } from '../../../services/contracts/types';
import { useProject } from '../../projects/ProjectContext';

interface ExpandedInboxViewProps {
  onNavigateToRecord?: (category: string, entityId?: string) => void;
}

export function ExpandedInboxView({ onNavigateToRecord }: ExpandedInboxViewProps) {
  const { activeProject, refreshNotificationUnreadCount } = useProject();
  const [notifications, setNotifications] = useState<NotificationDomainModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const loadNotifications = useCallback(async () => {
    if (!activeProject?.id || !services?.notifications) return;
    try {
      setIsLoading(true);
      const res = await services.notifications.getNotifications({
        projectId: activeProject.id,
        limit: 50,
      });
      const items = Array.isArray(res) ? res : (res as any)?.notifications || [];
      setNotifications(items);
    } catch (err) {
      console.warn('[ExpandedInboxView] Failed to load notifications:', err);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    if (!activeProject?.id || !services?.notifications) return;
    try {
      await services.notifications.markAllAsRead(activeProject.id);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      refreshNotificationUnreadCount?.();
    } catch (err) {
      console.warn('[ExpandedInboxView] Failed markAllAsRead:', err);
    }
  };

  const handleMarkRead = async (notifId: string) => {
    if (!activeProject?.id || !services?.notifications) return;
    try {
      await services.notifications.markAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, readAt: new Date().toISOString() } : n))
      );
      refreshNotificationUnreadCount?.();
    } catch (err) {
      console.warn('[ExpandedInboxView] Failed markAsRead:', err);
    }
  };

  const filtered = useMemo(() => {
    if (filterCategory === 'all') return notifications;
    if (filterCategory === 'unread') return notifications.filter((n) => !n.readAt);
    return notifications.filter((n) => (n.category || '').toLowerCase() === filterCategory.toLowerCase());
  }, [notifications, filterCategory]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.readAt).length;
  }, [notifications]);

  return (
    <div
      data-testid="expanded-inbox-workspace"
      className="flex-1 flex flex-col min-h-0 bg-[#0A0D16]/90 rounded-3xl border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      {/* Workspace Sub-Header */}
      <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-300">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Collaboration Inbox</h2>
            <p className="text-xs text-slate-400 font-mono">
              Notifications, mentions, assignment alerts, and schedule changes
            </p>
          </div>
        </div>

        {/* Controls: Mark all read & Refresh */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-xs font-medium transition cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadNotifications}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            title="Refresh inbox"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-2.5 border-b border-white/[0.06] flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
        {[
          { id: 'all', label: `All (${notifications.length})` },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'mention', label: 'Mentions' },
          { id: 'assignment', label: 'Assignments' },
          { id: 'schedule', label: 'Schedule' },
          { id: 'system', label: 'System' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterCategory(tab.id)}
            className={`px-3 py-1 rounded-xl transition cursor-pointer ${
              filterCategory === tab.id
                ? 'bg-white/15 text-white font-medium border border-white/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
        {isLoading && notifications.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
            Loading notifications…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-500 mx-auto">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">All caught up</p>
            <p className="text-xs text-slate-400 font-mono">
              {filterCategory === 'all'
                ? 'No notifications in your production inbox.'
                : `No ${filterCategory} notifications found.`}
            </p>
          </div>
        ) : (
          filtered.map((notif) => {
            const isUnread = !notif.readAt;
            const timeAgo = notif.createdAt
              ? new Date(notif.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent';

            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (isUnread) handleMarkRead(notif.id);
                  if (notif.entityType) {
                    onNavigateToRecord?.(notif.entityType, notif.entityId);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                  isUnread
                    ? 'bg-amber-500/[0.06] border-amber-500/25 hover:border-amber-500/40 shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1] opacity-80'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isUnread
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/[0.05] text-slate-400 border border-white/10'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-white truncate">
                      {notif.title || 'Production Notification'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {timeAgo}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {notif.message || notif.body || 'No details provided.'}
                  </p>

                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04] text-[10px] font-mono text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 uppercase">
                      {notif.category || 'System'}
                    </span>
                    {notif.actorName && (
                      <span>From: <strong className="text-slate-200">{notif.actorName}</strong></span>
                    )}
                  </div>
                </div>

                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-2 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
