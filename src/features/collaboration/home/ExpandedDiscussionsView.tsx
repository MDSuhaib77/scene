import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MessageSquare,
  Send,
  RefreshCw,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  AtSign,
  User,
  Clock,
} from 'lucide-react';
import { services } from '../../../services';
import type {
  DiscussionThreadDomainModel,
  DiscussionMessageDomainModel,
  ProjectMemberDomainModel,
} from '../../../services/contracts/types';
import { useProject } from '../../projects/ProjectContext';

function getInitials(name?: string, fallback = 'U'): string {
  if (!name || name.trim().toLowerCase() === 'unassigned') return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'recently';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function ExpandedDiscussionsView() {
  const { activeProject, members = [], currentUser, collaborationRevision, refreshDiscussionUnreadCount } = useProject();
  const [threads, setThreads] = useState<DiscussionThreadDomainModel[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messages, setMessages] = useState<DiscussionMessageDomainModel[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadBody, setNewThreadBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load threads
  const loadThreads = useCallback(async () => {
    if (!activeProject?.id || !services?.discussions) return;
    try {
      setThreadsLoading(true);
      const res = await services.discussions.getProjectThreads(activeProject.id);
      const sorted = (res || []).sort(
        (a, b) =>
          new Date(b.lastMessageAt || b.createdAt).getTime() -
          new Date(a.lastMessageAt || a.createdAt).getTime()
      );
      setThreads(sorted);
      if (!selectedThreadId && sorted.length > 0) {
        setSelectedThreadId(sorted[0].id);
      }
    } catch (err) {
      console.warn('[ExpandedDiscussionsView] Failed to load threads:', err);
    } finally {
      setThreadsLoading(false);
    }
  }, [activeProject?.id, selectedThreadId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads, collaborationRevision?.discussions]);

  // Load messages for selected thread
  const loadMessages = useCallback(async (threadId: string) => {
    if (!services?.discussions || !threadId) return;
    try {
      setMessagesLoading(true);
      const res = await services.discussions.getThreadMessages(threadId, { limit: 50 });
      setMessages(res.messages || []);
    } catch (err) {
      console.warn('[ExpandedDiscussionsView] Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      loadMessages(selectedThreadId);
    } else {
      setMessages([]);
    }
  }, [selectedThreadId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedThread = useMemo(() => {
    return threads.find((t) => t.id === selectedThreadId) || null;
  }, [threads, selectedThreadId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThreadId || !activeProject?.id || !services?.discussions) return;

    try {
      setIsSubmitting(true);
      const clientReqId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await services.discussions.postMessage({
        threadId: selectedThreadId,
        projectId: activeProject.id,
        body: replyText.trim(),
        clientRequestId: clientReqId,
      });

      if (res) {
        setMessages((prev) => [...prev, res]);
        setReplyText('');
        refreshDiscussionUnreadCount?.();
      }
    } catch (err) {
      console.warn('[ExpandedDiscussionsView] Failed to send message:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadTitle.trim() || !newThreadBody.trim() || !activeProject?.id || !services?.discussions) return;

    try {
      setIsSubmitting(true);
      const newThreadId = await services.discussions.ensureProjectThread(
        activeProject.id,
        newThreadTitle.trim()
      );

      if (newThreadId) {
        const clientReqId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await services.discussions.postMessage({
          threadId: newThreadId,
          projectId: activeProject.id,
          body: newThreadBody.trim(),
          clientRequestId: clientReqId,
        });

        await loadThreads();
        setSelectedThreadId(newThreadId);
        setIsCreatingThread(false);
        setNewThreadTitle('');
        setNewThreadBody('');
        refreshDiscussionUnreadCount?.();
      }
    } catch (err) {
      console.warn('[ExpandedDiscussionsView] Failed to create thread:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredThreads = useMemo(() => {
    if (!searchQuery) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.creatorName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [threads, searchQuery]);

  return (
    <div
      data-testid="expanded-discussions-workspace"
      className="flex-1 flex flex-col min-h-0 bg-[#0A0D16]/90 rounded-3xl border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-300">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Production Discussions</h2>
            <p className="text-xs text-slate-400 font-mono">
              Threaded creative notes, scene discussions, and department communication
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingThread(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Discussion</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Thread List */}
        <div className="w-80 border-r border-white/[0.08] flex flex-col bg-black/30 shrink-0">
          <div className="p-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search discussions…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {threadsLoading && threads.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-cyan-400" />
                Loading threads…
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-mono">
                No discussions found.
              </div>
            ) : (
              filteredThreads.map((t) => {
                const isSelected = t.id === selectedThreadId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedThreadId(t.id);
                      setIsCreatingThread(false);
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/15 border border-cyan-500/30 shadow-sm'
                        : 'hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {t.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {formatRelativeTime(t.lastMessageAt || t.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 mt-1">
                      <span className="truncate">{t.creatorName || 'Team member'}</span>
                      {t.messageCount !== undefined && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {t.messageCount} msg
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Message Stream or Create Form */}
        <div className="flex-1 flex flex-col min-w-0 bg-transparent">
          {isCreatingThread ? (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-xl mx-auto space-y-4">
                <h3 className="text-base font-bold text-white tracking-tight">Start a New Discussion</h3>
                <form onSubmit={handleCreateThread} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Discussion Subject
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Day 4 Night Shoot Lighting Setup"
                      value={newThreadTitle}
                      onChange={(e) => setNewThreadTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Initial Message
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Write your note or discussion topic here. You can tag team members with @…"
                      value={newThreadBody}
                      onChange={(e) => setNewThreadBody(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingThread(false)}
                      className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-300 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? 'Posting…' : 'Start Discussion'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : selectedThread ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Thread Header */}
              <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3 bg-white/[0.01]">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">{selectedThread.title}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                    <span>Started by {selectedThread.creatorName}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(selectedThread.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messagesLoading && messages.length === 0 ? (
                  <div className="py-16 text-center text-xs font-mono text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading conversation…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400 font-mono">
                    No messages yet in this discussion.
                  </div>
                ) : (
                  messages.map((m) => {
                    const initials = getInitials(m.authorName);
                    const isCurrentUser = m.authorId === currentUser?.id;
                    const timeStr = m.createdAt
                      ? new Date(m.createdAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <div
                        key={m.id}
                        className={`flex items-start gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-inner ${
                            isCurrentUser
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-white/[0.06] text-cyan-200 border border-white/10'
                          }`}
                        >
                          {initials}
                        </div>

                        <div className={`max-w-[75%] space-y-1 ${isCurrentUser ? 'items-end' : ''}`}>
                          <div className={`flex items-center gap-2 text-[11px] ${isCurrentUser ? 'justify-end' : ''}`}>
                            <span className="font-semibold text-white">{m.authorName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{timeStr}</span>
                          </div>

                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                              isCurrentUser
                                ? 'bg-cyan-950/60 text-cyan-50 border border-cyan-500/30'
                                : 'bg-white/[0.03] text-slate-200 border border-white/[0.06]'
                            }`}
                          >
                            {m.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/[0.06] flex items-center gap-2 bg-black/20">
                <input
                  type="text"
                  placeholder="Reply to discussion… (Tag team members with @)"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSubmitting}
                  className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition cursor-pointer disabled:opacity-40"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">No discussion selected</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Choose a thread from the left or create a new discussion.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingThread(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Discussion</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
