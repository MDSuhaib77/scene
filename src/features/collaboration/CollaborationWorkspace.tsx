/**
 * SceneOS — Collaboration, Decisions & Project Activity Workspace
 * 
 * Central coordination hub:
 * - Real activity stream powered by IActivityService (Mock & Supabase)
 * - Authoritative Decision Log (Milestone freezes, locked drafts, guild selections)
 * - Department notices and crew communications with explicit refresh indicators
 * - Transparent update model without fabricated realtime claims
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  Activity as ActivityIcon, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Send, 
  Users, 
  ShieldCheck, 
  FileText, 
  Layers, 
  Calendar,
  AlertCircle,
  Tag
} from 'lucide-react';
import { FilmProject } from '../../types';
import { ActivityDomainModel } from '../../services/contracts/types';
import { services } from '../../services';

interface CollaborationWorkspaceProps {
  project: FilmProject;
  isDark: boolean;
  currentUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  onNavigateTab: (tab: any) => void;
}

export function CollaborationWorkspace({
  project,
  isDark,
  currentUser,
  onNavigateTab,
}: CollaborationWorkspaceProps) {
  const [activities, setActivities] = useState<ActivityDomainModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeMessage, setNewNoticeMessage] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<'decision' | 'announcement' | 'safety'>('announcement');
  const [isPosting, setIsPosting] = useState(false);

  // Fetch activities from authoritative service
  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await services.activity.getProjectActivity(project.id, 25);
      setActivities(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load project activity:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Post a new announcement or decision
  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeMessage.trim()) return;

    setIsPosting(true);
    try {
      await services.activity.logActivity({
        projectId: project.id,
        userId: currentUser?.id || 'usr-local',
        userFullName: currentUser?.fullName || project.director || 'Production Supervisor',
        activityType: noticeCategory === 'decision' ? 'production_decision' : noticeCategory === 'safety' ? 'safety_alert' : 'crew_announcement',
        title: newNoticeTitle.trim(),
        description: newNoticeMessage.trim(),
      });

      setNewNoticeTitle('');
      setNewNoticeMessage('');
      await loadActivities();
    } catch (err) {
      console.error('Failed to log activity notice:', err);
    } finally {
      setIsPosting(false);
    }
  };

  // Decisions extracted from activity or project state
  const decisions = activities.filter(a => 
    a.activityType.includes('locked') || 
    a.activityType.includes('decision') || 
    a.activityType.includes('approved') ||
    a.activityType.includes('bond')
  );

  return (
    <div className="space-y-6 font-sans text-left animate-fade-in" id="collaboration-workspace">
      
      {/* 1. Header Banner */}
      <div className={`p-6 rounded-3xl border transition-all ${
        isDark ? 'bg-[#0B0E17]/95 border-zinc-850 shadow-xl' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-950/70 border border-indigo-500/30 text-indigo-400">
                <MessageSquare className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-black">
                PROJECT COLLABORATION & ACTIVITY LOG
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {project.title} — Production Stream
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Audited project timeline, binding leadership decisions, and department announcements.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-500">
              Synced: <strong className="text-zinc-300">{lastRefreshed}</strong>
            </span>
            <button
              type="button"
              onClick={loadActivities}
              disabled={isLoading}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-indigo-400 font-mono text-xs rounded-xl border border-zinc-800 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Poll Updates</span>
            </button>
          </div>
        </div>

        {/* Status notice on update model */}
        <div className="pt-3 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Audit Service: Connected ({services.provider === 'supabase' ? 'Supabase Database' : 'Mock Local Memory'})</span>
          </div>
          <span>Changes across workspaces are logged deterministically to this timeline.</span>
        </div>
      </div>

      {/* 2. Main Content Grid: Activity Stream on Left, Decisions & Broadcast on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Full Activity Stream */}
        <div className={`lg:col-span-7 p-6 rounded-3xl border space-y-4 ${
          isDark ? 'bg-[#0B0E17]/95 border-zinc-850 shadow-md' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-indigo-400" />
              <span>Recent Production Timeline ({activities.length})</span>
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Chronological</span>
          </div>

          {activities.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-2xl">
              No logged activities recorded for this production yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {activities.map((act) => {
                const isDecision = act.activityType.includes('decision') || act.activityType.includes('locked');
                const isSafety = act.activityType.includes('safety') || act.activityType.includes('alert');

                return (
                  <div
                    key={act.id}
                    className={`p-4 rounded-2xl border transition ${
                      isDecision
                        ? 'bg-purple-950/15 border-purple-800/30'
                        : isSafety
                        ? 'bg-rose-950/15 border-rose-800/30'
                        : 'bg-zinc-950/40 border-zinc-850/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                            isDecision
                              ? 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                              : isSafety
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/40'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}>
                            {act.activityType.replace(/_/g, ' ')}
                          </span>
                          <h4 className="text-xs font-bold text-white">{act.title}</h4>
                        </div>
                        {act.description && (
                          <p className="text-xs text-zinc-300 leading-relaxed font-sans">{act.description}</p>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                        {act.createdAt ? new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2.5 pt-2 border-t border-zinc-850/50">
                      <span>By: <strong className="text-zinc-300">{act.userFullName}</strong></span>
                      <span className="text-zinc-600">ID: {act.id.slice(0, 10)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Decisions Log & Notice Creator */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Post Broadcast Notice Form */}
          <div className={`p-6 rounded-3xl border space-y-4 ${
            isDark ? 'bg-[#0B0E17]/95 border-zinc-850 shadow-md' : 'bg-white border-zinc-200'
          }`}>
            <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Send className="w-4 h-4 text-cyan-400" />
              <span>Broadcast Production Notice</span>
            </h3>

            <form onSubmit={handlePostNotice} className="space-y-3.5 text-xs">
              <div>
                <label className="text-zinc-400 font-mono text-[10px] uppercase block mb-1">Notice Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'announcement', label: 'Announcement' },
                    { id: 'decision', label: 'Decision' },
                    { id: 'safety', label: 'Safety Alert' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNoticeCategory(cat.id as any)}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold border transition cursor-pointer ${
                        noticeCategory === cat.id
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-mono text-[10px] uppercase block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weather Hold for Scene 14 or Call Sheet v2 Distributed"
                  value={newNoticeTitle}
                  onChange={e => setNewNoticeTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-mono text-[10px] uppercase block mb-1">Details / Rationale *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide explicit context, affected departments, and action items..."
                  value={newNoticeMessage}
                  onChange={e => setNewNoticeMessage(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={isPosting}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-mono text-xs font-bold rounded-xl shadow-lg shadow-indigo-950/40 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPosting ? 'Broadcasting...' : 'Broadcast to Production Log'}</span>
              </button>
            </form>
          </div>

          {/* Key Decisions Register */}
          <div className={`p-6 rounded-3xl border space-y-4 ${
            isDark ? 'bg-[#0B0E17]/95 border-zinc-850 shadow-md' : 'bg-white border-zinc-200'
          }`}>
            <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-800 pb-3">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              <span>Binding Decision Log ({decisions.length})</span>
            </h3>

            {decisions.length === 0 ? (
              <div className="py-6 text-center text-zinc-500 font-mono text-xs">
                No formal production sign-offs or locked decisions logged.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {decisions.map(dec => (
                  <div key={dec.id} className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/30 text-xs">
                    <span className="font-bold text-purple-200 block">{dec.title}</span>
                    {dec.description && <p className="text-[11px] text-zinc-300 mt-0.5">{dec.description}</p>}
                    <span className="text-[9px] font-mono text-zinc-500 block mt-1">Authorized by {dec.userFullName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
