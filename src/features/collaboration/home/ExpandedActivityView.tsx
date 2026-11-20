import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity as ActivityIcon,
  RefreshCw,
  Clock,
  User,
  Film,
  Calendar,
  MessageSquare,
  Shield,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { services } from '../../../services';
import type { ActivityDomainModel } from '../../../services/contracts/types';
import { useProject } from '../../projects/ProjectContext';
import { groupItemsByChronology, ChronologyBucket } from '../NotificationsDrawer';

interface ExpandedActivityViewProps {
  onNavigateToActivity?: (activity: ActivityDomainModel) => void;
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  member_joined: User,
  member_role_changed: Shield,
  discussion_created: MessageSquare,
  discussion_resolved: CheckCircle2,
  call_sheet_published: FileText,
  dpr_submitted: FileText,
  shoot_day_rescheduled: Film,
  event_rescheduled: Calendar,
  task_completed: CheckCircle2,
  schedule_updated: Calendar,
};

export function ExpandedActivityView({ onNavigateToActivity }: ExpandedActivityViewProps) {
  const { activeProject } = useProject();
  const [activities, setActivities] = useState<ActivityDomainModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadActivity = useCallback(async () => {
    if (!activeProject?.id || !services?.activity) return;
    try {
      setIsLoading(true);
      let list: ActivityDomainModel[] = [];
      if (typeof services.activity.getProjectActivityPage === 'function') {
        const page = await services.activity.getProjectActivityPage(activeProject.id, { limit: 50 });
        list = page?.activities || [];
      } else if (typeof (services.activity as any).getProjectActivity === 'function') {
        list = (await (services.activity as any).getProjectActivity(activeProject.id, 50)) || [];
      }
      setActivities(list);
    } catch (err) {
      console.warn('[ExpandedActivityView] Failed to load activity:', err);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const grouped = useMemo(() => {
    return groupItemsByChronology(activities);
  }, [activities]);

  return (
    <div
      data-testid="expanded-activity-workspace"
      className="flex-1 flex flex-col min-h-0 bg-[#0A0D16]/90 rounded-3xl border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      {/* Workspace Header */}
      <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-300">
            <ActivityIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Production Activity Log</h2>
            <p className="text-xs text-slate-400 font-mono">
              Audit log of shoot schedule updates, crew events, and workflow milestones
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadActivity}
          disabled={isLoading}
          className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
          title="Refresh activity feed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Activity Chronological Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading && activities.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
            Loading production activity…
          </div>
        ) : activities.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-500 mx-auto">
              <ActivityIcon className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-sm font-semibold text-white">No activity yet</p>
            <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto">
              Activity events will be recorded here as team members update schedules, create call sheets, and complete tasks.
            </p>
          </div>
        ) : (
          (['Today', 'Yesterday', 'Earlier'] as ChronologyBucket[]).map((bucket) => {
            const bucketItems = grouped[bucket] || [];
            if (bucketItems.length === 0) return null;

            return (
              <div key={bucket} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    {bucket}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                <div className="space-y-2">
                  {bucketItems.map((act) => {
                    const IconComp = (act.actionType && ACTIVITY_ICONS[act.actionType]) || ActivityIcon;
                    const timeStr = act.createdAt
                      ? new Date(act.createdAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <div
                        key={act.id}
                        onClick={() => onNavigateToActivity?.(act)}
                        className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] transition-all flex items-start gap-3.5 group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
                          <IconComp className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white truncate">
                              {act.actorName || 'Production Member'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {timeStr}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                            {act.description || act.title || 'Updated production record.'}
                          </p>

                          {act.entityType && (
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-slate-400">
                              <span className="px-1.5 py-0.2 rounded bg-black/40 border border-white/10 uppercase">
                                {act.entityType}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
