/**
 * SceneOS — Project & Contextual Discussions Drawer (Prompt 03)
 *
 * Restrained, production-aware communication layer:
 * - One primary project-wide discussion space + contextual threads anchored to synced records.
 * - 1-level threaded replies, @member mentions (validated against project members),
 *   author editing/deletion, and Owner/Producer moderation.
 * - Cursor pagination for older messages, draft preservation per thread/project,
 *   idempotent clientRequestId submission, and explicit local-only restriction.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  RefreshCw,
  Reply,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  CloudOff,
  ChevronLeft,
  AtSign,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { useProject } from '../projects/ProjectContext';
import { services } from '../../services';
import {
  DiscussionEntityType,
  DiscussionMessageDomainModel,
  DiscussionRecordTarget,
  DiscussionThreadDomainModel,
  ProjectMemberDomainModel,
} from '../../services/contracts/types';
import { ROLE_LABELS } from '../../services/rbac/permissions';

export const DISCUSSION_ENTITY_LABELS: Record<DiscussionEntityType, string> = {
  shooting_day: 'Shoot Day',
  production_event: 'Calendar Event',
  call_sheet: 'Call Sheet',
  dpr: 'DPR',
  directory_entry: 'Directory',
  board: 'Board',
  storyboard_panel: 'Storyboard',
  shot: 'Shot',
};

export function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function filterMentionCandidates(
  members: ProjectMemberDomainModel[],
  query: string,
  excludeUserId?: string
): ProjectMemberDomainModel[] {
  const q = query.trim().toLowerCase();
  return members
    .filter(m => !excludeUserId || m.userId !== excludeUserId)
    .filter(m => {
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 8);
}

/**
 * Resolves validated mention UUIDs strictly from actual project members whose
 * `@FullName` tag remains present in `body`. Never emits non-member IDs.
 */
export function resolveValidatedMentionIds(
  body: string,
  members: ProjectMemberDomainModel[],
  selectedMentionIds?: Iterable<string>
): string[] {
  const memberById = new Map(members.map(m => [m.userId, m]));
  const result = new Set<string>();
  const lowerBody = body.toLowerCase();

  if (selectedMentionIds) {
    for (const uid of selectedMentionIds) {
      const m = memberById.get(uid);
      if (m && lowerBody.includes(`@${m.fullName.toLowerCase()}`)) {
        result.add(uid);
      }
    }
  }

  for (const m of members) {
    if (m.fullName && lowerBody.includes(`@${m.fullName.toLowerCase()}`)) {
      result.add(m.userId);
    }
  }

  return Array.from(result);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderMessageBodyWithMentions(
  body: string,
  mentionUserIds: string[],
  members: ProjectMemberDomainModel[]
): React.ReactNode {
  if (!mentionUserIds.length) return body;
  const mentionedNames = members
    .filter(m => mentionUserIds.includes(m.userId) && m.fullName.trim().length > 0)
    .map(m => m.fullName.trim())
    .sort((a, b) => b.length - a.length);

  if (mentionedNames.length === 0) return body;

  const escaped = mentionedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(@(?:${escaped.join('|')}))`, 'gi');
  const parts = body.split(regex);

  return parts.map((part, idx) => {
    const isMention = mentionedNames.some(n => part.toLowerCase() === `@${n.toLowerCase()}`);
    if (isMention) {
      return (
        <span
          key={idx}
          className="inline-block px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-medium"
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

interface DiscussionsDrawerProps {
  onNavigateToRecord?: (entityType: DiscussionEntityType, entityId: string) => void;
}

export function DiscussionsDrawer({ onNavigateToRecord }: DiscussionsDrawerProps) {
  const {
    activeProject,
    activeRole,
    members,
    currentUser,
    can,
    isDiscussionOpen,
    closeDiscussions,
    pendingDiscussionTarget,
    clearPendingDiscussionTarget,
    refreshDiscussionUnreadCount,
    collaborationRevision,
  } = useProject();

  const [threads, setThreads] = useState<DiscussionThreadDomainModel[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mobileShowConversation, setMobileShowConversation] = useState(false);

  const [messages, setMessages] = useState<DiscussionMessageDomainModel[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Per-thread unsent drafts & active request idempotency state (reset on project switch)
  const [draftsByThread, setDraftsByThread] = useState<Record<string, string>>({});
  const [selectedMentionsByThread, setSelectedMentionsByThread] = useState<Record<string, string[]>>({});
  const [replyTarget, setReplyTarget] = useState<DiscussionMessageDomainModel | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const pendingReqIdRef = useRef<{ threadId: string; id: string } | null>(null);

  // Inline message edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);

  // @Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const isLocalOnly = activeProject?.persistence === 'local';
  const canView = can('discussions:view');
  const canPost = can('discussions:post');
  const canModerate = can('discussions:moderate');

  // Strict project isolation: reset drawer state whenever active project changes
  useEffect(() => {
    setThreads([]);
    setSelectedThreadId(null);
    setMessages([]);
    setDraftsByThread({});
    setSelectedMentionsByThread({});
    setReplyTarget(null);
    setSendError(null);
    setThreadsError(null);
    setMessagesError(null);
    setEditingMessageId(null);
    setMentionQuery(null);
    pendingReqIdRef.current = null;
  }, [activeProject?.id]);

  const loadThreads = useCallback(
    async (preferredThreadId?: string, opts?: { silent?: boolean }) => {
      if (!activeProject || isLocalOnly || !canView) return;
      if (!opts?.silent) setThreadsLoading(true);
      setThreadsError(null);
      try {
        const list = await services.discussions.getProjectThreads(activeProject.id);
        setThreads(list);
        if (preferredThreadId && list.some(t => t.id === preferredThreadId)) {
          setSelectedThreadId(preferredThreadId);
        } else {
          setSelectedThreadId(curr =>
            curr && list.some(t => t.id === curr) ? curr : list[0]?.id ?? null
          );
        }
      } catch (err: any) {
        if (!opts?.silent) {
          setThreadsError(err?.message || 'Failed to load discussions.');
        }
      } finally {
        if (!opts?.silent) setThreadsLoading(false);
      }
    },
    [activeProject, isLocalOnly, canView]
  );

  // Resolve contextual target passed from a Production / Visualise record
  const resolvePendingTarget = useCallback(
    async (target: DiscussionRecordTarget) => {
      if (!activeProject || isLocalOnly || !canView) return;
      setThreadsLoading(true);
      setThreadsError(null);
      try {
        const existing = await services.discussions.getProjectThreads(activeProject.id, {
          entityType: target.entityType,
          entityId: target.entityId,
        });
        let threadId = existing[0]?.id;
        if (!threadId) {
          if (!canPost) {
            setThreadsError('No discussion exists for this record yet (read-only access).');
            clearPendingDiscussionTarget();
            return;
          }
          threadId = await services.discussions.ensureRecordThread(activeProject.id, target);
        }
        clearPendingDiscussionTarget();
        await loadThreads(threadId);
        setMobileShowConversation(true);
      } catch (err: any) {
        setThreadsError(err?.message || 'Unable to open record discussion.');
        clearPendingDiscussionTarget();
      } finally {
        setThreadsLoading(false);
      }
    },
    [activeProject, isLocalOnly, canView, canPost, clearPendingDiscussionTarget, loadThreads]
  );

  useEffect(() => {
    if (!isDiscussionOpen || !activeProject || isLocalOnly || !canView) return;
    if (pendingDiscussionTarget) {
      resolvePendingTarget(pendingDiscussionTarget);
    } else {
      loadThreads();
    }
  }, [isDiscussionOpen, activeProject?.id, isLocalOnly, canView, pendingDiscussionTarget, resolvePendingTarget, loadThreads]);

  const loadMessages = useCallback(
    async (threadId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setMessagesLoading(true);
        setMessagesError(null);
        setHasMoreMessages(false);
      }
      try {
        const page = await services.discussions.getThreadMessages(threadId, { limit: 25 });
        setMessages(page.messages);
        if (!opts?.silent) {
          setHasMoreMessages(page.hasMore);
        }
        await services.discussions.markThreadRead(threadId);
        setThreads(prev =>
          prev.map(t => (t.id === threadId ? { ...t, unreadCount: 0 } : t))
        );
        await refreshDiscussionUnreadCount();
      } catch (err: any) {
        if (!opts?.silent) {
          setMessages([]);
          setMessagesError(err?.message || 'Failed to load messages.');
        }
      } finally {
        if (!opts?.silent) setMessagesLoading(false);
      }
    },
    [refreshDiscussionUnreadCount]
  );

  // Silently reconcile open discussions when Realtime signals arrive (never overwrites drafts/edits)
  const discussionsSyncRev = collaborationRevision?.discussions ?? 0;
  useEffect(() => {
    if (!discussionsSyncRev || !isDiscussionOpen || !activeProject || isLocalOnly || !canView) return;
    void loadThreads(undefined, { silent: true });
    if (selectedThreadId) {
      void loadMessages(selectedThreadId, { silent: true });
    }
  }, [discussionsSyncRev, isDiscussionOpen, activeProject?.id, isLocalOnly, canView, selectedThreadId, loadThreads, loadMessages]);

  useEffect(() => {
    if (isDiscussionOpen && selectedThreadId && !isLocalOnly && canView) {
      setReplyTarget(null);
      setEditingMessageId(null);
      setSendError(null);
      loadMessages(selectedThreadId);
    } else if (!selectedThreadId) {
      setMessages([]);
    }
  }, [isDiscussionOpen, selectedThreadId, isLocalOnly, canView, loadMessages]);

  const handleLoadOlder = async () => {
    if (!selectedThreadId || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0].createdAt;
      const page = await services.discussions.getThreadMessages(selectedThreadId, {
        before: oldest,
        limit: 25,
      });
      setMessages(prev => {
        const seen = new Set(prev.map(m => m.id));
        const prepended = page.messages.filter(m => !seen.has(m.id));
        return [...prepended, ...prev];
      });
      setHasMoreMessages(page.hasMore);
    } catch (err: any) {
      setMessagesError(err?.message || 'Failed to load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleStartProjectThread = async () => {
    if (!activeProject || !canPost) return;
    setThreadsError(null);
    try {
      const threadId = await services.discussions.ensureProjectThread(
        activeProject.id,
        'Project Discussion'
      );
      await loadThreads(threadId);
      setMobileShowConversation(true);
    } catch (err: any) {
      setThreadsError(err?.message || 'Unable to start project discussion.');
    }
  };

  const selectedThread = useMemo(
    () => threads.find(t => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const currentDraft = selectedThreadId ? draftsByThread[selectedThreadId] || '' : '';

  const updateComposerText = (text: string, cursorPos?: number) => {
    if (!selectedThreadId) return;
    setDraftsByThread(prev => ({ ...prev, [selectedThreadId]: text }));
    setSendError(null);

    const pos = cursorPos ?? text.length;
    const beforeCursor = text.slice(0, pos);
    const match = beforeCursor.match(/(?:^|\s)@([^\s@]{0,30})$/);
    if (match) {
      const atIdx = beforeCursor.lastIndexOf('@');
      setMentionTriggerIndex(atIdx);
      setMentionQuery(match[1]);
    } else {
      setMentionTriggerIndex(null);
      setMentionQuery(null);
    }
  };

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    return filterMentionCandidates(members, mentionQuery, currentUser?.id);
  }, [mentionQuery, members, currentUser?.id]);

  const insertMention = (member: ProjectMemberDomainModel) => {
    if (!selectedThreadId || mentionTriggerIndex === null) return;
    const cursor = composerRef.current?.selectionStart ?? currentDraft.length;
    const prefix = currentDraft.slice(0, mentionTriggerIndex);
    const suffix = currentDraft.slice(cursor);
    const tag = `@${member.fullName} `;
    const nextText = `${prefix}${tag}${suffix}`;

    setDraftsByThread(prev => ({ ...prev, [selectedThreadId]: nextText }));
    setSelectedMentionsByThread(prev => ({
      ...prev,
      [selectedThreadId]: Array.from(
        new Set([...(prev[selectedThreadId] || []), member.userId])
      ),
    }));
    setMentionQuery(null);
    setMentionTriggerIndex(null);

    requestAnimationFrame(() => {
      if (composerRef.current) {
        const nextCursor = prefix.length + tag.length;
        composerRef.current.focus();
        composerRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeProject || !selectedThreadId || !canPost || isSending) return;
    const trimmed = currentDraft.trim();
    if (!trimmed) return;

    setIsSending(true);
    setSendError(null);

    if (
      !pendingReqIdRef.current ||
      pendingReqIdRef.current.threadId !== selectedThreadId
    ) {
      pendingReqIdRef.current = {
        threadId: selectedThreadId,
        id: createClientRequestId(),
      };
    }

    const clientRequestId = pendingReqIdRef.current.id;
    const mentionIds = resolveValidatedMentionIds(
      trimmed,
      members,
      selectedMentionsByThread[selectedThreadId] || []
    );

    try {
      const posted = await services.discussions.postMessage({
        threadId: selectedThreadId,
        projectId: activeProject.id,
        body: trimmed,
        parentMessageId: replyTarget?.id ?? null,
        mentionUserIds: mentionIds,
        clientRequestId,
      });

      pendingReqIdRef.current = null;
      setDraftsByThread(prev => ({ ...prev, [selectedThreadId]: '' }));
      setSelectedMentionsByThread(prev => ({ ...prev, [selectedThreadId]: [] }));
      setReplyTarget(null);
      setMentionQuery(null);

      setMessages(prev => {
        if (prev.some(m => m.id === posted.id)) return prev;
        return [...prev, posted];
      });
      setThreads(prev =>
        prev.map(t =>
          t.id === selectedThreadId
            ? {
                ...t,
                lastMessageAt: posted.createdAt,
                messageCount: t.messageCount + 1,
                latestPreview: posted.body.slice(0, 140),
              }
            : t
        )
      );
      await refreshDiscussionUnreadCount();
    } catch (err: any) {
      setSendError(err?.message || 'Message failed to send. Draft preserved — you can retry.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!editingBody.trim()) return;
    setBusyMessageId(msgId);
    setMessagesError(null);
    try {
      const mentions = resolveValidatedMentionIds(editingBody, members);
      await services.discussions.editMessage(msgId, editingBody.trim(), mentions);
      const editedAt = new Date().toISOString();
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, body: editingBody.trim(), mentionUserIds: mentions, editedAt }
            : m
        )
      );
      setEditingMessageId(null);
    } catch (err: any) {
      setMessagesError(err?.message || 'Failed to update message.');
    } finally {
      setBusyMessageId(null);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setBusyMessageId(msgId);
    setMessagesError(null);
    try {
      await services.discussions.deleteMessage(msgId);
      const deletedAt = new Date().toISOString();
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, deletedAt, body: '[Message removed]', mentionUserIds: [] }
            : m
        )
      );
    } catch (err: any) {
      setMessagesError(err?.message || 'Failed to delete message.');
    } finally {
      setBusyMessageId(null);
    }
  };

  const handleToggleResolve = async () => {
    if (!selectedThread) return;
    const nextResolved = !selectedThread.resolvedAt;
    try {
      await services.discussions.setThreadResolved(selectedThread.id, nextResolved);
      setThreads(prev =>
        prev.map(t =>
          t.id === selectedThread.id
            ? {
                ...t,
                resolvedAt: nextResolved ? new Date().toISOString() : null,
                resolvedBy: nextResolved ? currentUser?.id || null : null,
              }
            : t
        )
      );
    } catch (err: any) {
      setMessagesError(err?.message || 'Unable to update thread status.');
    }
  };

  const messageById = useMemo(() => {
    const map = new Map<string, DiscussionMessageDomainModel>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  if (!isDiscussionOpen || !activeProject) return null;

  const canResolveSelected =
    Boolean(selectedThread) &&
    ((selectedThread?.createdBy === currentUser?.id && canPost) || canModerate);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-fade-in font-sans"
      data-testid="discussions-drawer"
    >
      <div className="w-full max-w-4xl h-full bg-[#0B0E17] border-l border-slate-800 shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  Discussions
                </h2>
                <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  · {activeProject.title}
                </span>
                {activeProject.persistence === 'mock' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-500/30 text-amber-300 font-mono">
                    Offline Mock
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Project-wide updates and threads anchored to production records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isLocalOnly && canView && (
              <button
                type="button"
                onClick={() => loadThreads(selectedThreadId || undefined)}
                title="Refresh discussions"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${threadsLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={closeDiscussions}
              aria-label="Close Discussions"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {isLocalOnly ? (
          <div
            className="flex-1 flex items-center justify-center p-8"
            data-testid="discussions-local-only-notice"
          >
            <div className="max-w-md w-full p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/50 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <CloudOff className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Connected Supabase Project Required
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This project lives only in local browser storage and does not sync across devices. Discussions require a remotely persisted project.
              </p>
            </div>
          </div>
        ) : !canView || !activeRole ? (
          <div
            className="flex-1 flex items-center justify-center p-8"
            data-testid="discussions-permission-denied"
          >
            <div className="max-w-md w-full p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-2">
              <Lock className="w-6 h-6 text-rose-400 mx-auto" />
              <h3 className="text-sm font-semibold text-rose-200">
                Membership Verification Required
              </h3>
              <p className="text-xs text-slate-400">
                Only verified members of this project can view project discussions.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex">
            {/* Thread List Sidebar */}
            <div
              className={`${
                mobileShowConversation ? 'hidden md:flex' : 'flex'
              } w-full md:w-72 border-r border-slate-800/80 bg-slate-950/50 flex-col min-h-0 shrink-0`}
            >
              <div className="p-3 border-b border-slate-800/70 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Threads ({threads.length})
                </span>
                {canPost && !threads.some(t => t.scope === 'project') && (
                  <button
                    type="button"
                    data-testid="start-project-discussion-btn"
                    onClick={handleStartProjectThread}
                    className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[11px] font-medium text-white cursor-pointer"
                  >
                    + Project Thread
                  </button>
                )}
              </div>

              {threadsError && (
                <div className="m-3 p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{threadsError}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
                {threadsLoading && threads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Loading threads…
                  </div>
                ) : threads.length === 0 ? (
                  <div className="p-6 text-center space-y-3" data-testid="discussions-empty-threads">
                    <p className="text-xs text-slate-400">
                      No discussions yet on this project.
                    </p>
                    {canPost && (
                      <button
                        type="button"
                        data-testid="empty-start-project-thread-btn"
                        onClick={handleStartProjectThread}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white cursor-pointer"
                      >
                        Start Project Discussion
                      </button>
                    )}
                  </div>
                ) : (
                  threads.map(thread => {
                    const isSelected = thread.id === selectedThreadId;
                    const typeLabel =
                      thread.scope === 'project'
                        ? 'Project'
                        : thread.entityType
                          ? DISCUSSION_ENTITY_LABELS[thread.entityType]
                          : 'Record';

                    return (
                      <button
                        key={thread.id}
                        type="button"
                        data-testid={`thread-item-${thread.id}`}
                        onClick={() => {
                          setSelectedThreadId(thread.id);
                          setMobileShowConversation(true);
                        }}
                        className={`w-full text-left p-3 space-y-1 transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/30 border-l-2 border-cyan-400'
                            : 'hover:bg-slate-900/50 border-l-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                              thread.scope === 'project'
                                ? 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            {typeLabel}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {thread.resolvedAt && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            )}
                            {thread.unreadCount > 0 && (
                              <span
                                data-testid={`thread-unread-${thread.id}`}
                                className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-[#070a12] text-[10px] font-mono font-bold"
                              >
                                {thread.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {thread.title}
                        </div>
                        {thread.latestPreview && (
                          <p className="text-[11px] text-slate-400 truncate">
                            {thread.latestPreview}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Active Thread Conversation */}
            <div
              className={`${
                mobileShowConversation ? 'flex' : 'hidden md:flex'
              } flex-1 min-w-0 flex-col min-h-0`}
            >
              {!selectedThread ? (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-slate-500">
                  Select a thread or open a discussion from a Shoot Day, Call Sheet, Calendar Event, Directory Contact, or Board.
                </div>
              ) : (
                <>
                  {/* Thread Header */}
                  <div className="px-4 py-3 border-b border-slate-800/70 flex items-center justify-between gap-2 bg-slate-950/30 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setMobileShowConversation(false)}
                        className="md:hidden p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                        aria-label="Back to threads"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-semibold text-white truncate">
                            {selectedThread.title}
                          </h3>
                          {selectedThread.resolvedAt && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-mono">
                              Resolved
                            </span>
                          )}
                        </div>
                        {selectedThread.scope === 'record' && selectedThread.entityLabel && (
                          <span className="text-[11px] text-slate-400 truncate block">
                            {selectedThread.entityType
                              ? DISCUSSION_ENTITY_LABELS[selectedThread.entityType]
                              : 'Record'}{' '}
                            · {selectedThread.entityLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {selectedThread.scope === 'record' &&
                        selectedThread.entityType &&
                        selectedThread.entityId &&
                        onNavigateToRecord && (
                          <button
                            type="button"
                            onClick={() => {
                              onNavigateToRecord(
                                selectedThread.entityType!,
                                selectedThread.entityId!
                              );
                              closeDiscussions();
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="hidden sm:inline">View Record</span>
                          </button>
                        )}
                      {canResolveSelected && (
                        <button
                          type="button"
                          onClick={handleToggleResolve}
                          className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                        >
                          {selectedThread.resolvedAt ? (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              <span>Reopen</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Resolve</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messagesError && (
                      <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between gap-2">
                        <span>{messagesError}</span>
                        <button
                          type="button"
                          onClick={() => loadMessages(selectedThread.id)}
                          className="px-2 py-1 rounded bg-slate-800 text-slate-200 cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {hasMoreMessages && (
                      <div className="text-center">
                        <button
                          type="button"
                          disabled={loadingOlder}
                          onClick={handleLoadOlder}
                          data-testid="load-older-messages-btn"
                          className="px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 cursor-pointer disabled:opacity-50"
                        >
                          {loadingOlder ? 'Loading…' : 'Load older messages'}
                        </button>
                      </div>
                    )}

                    {messagesLoading ? (
                      <div className="py-10 text-center text-xs text-slate-500">
                        Loading conversation…
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-500" data-testid="thread-empty-messages">
                        No messages yet. Start the conversation below.
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isOwn = msg.authorId === currentUser?.id;
                        const isDeleted = Boolean(msg.deletedAt);
                        const canEditMsg = isOwn && !isDeleted && canPost;
                        const canDeleteMsg =
                          !isDeleted && ((isOwn && canPost) || canModerate);
                        const parentMsg = msg.parentMessageId
                          ? messageById.get(msg.parentMessageId)
                          : undefined;
                        const roleBadge = msg.authorRole
                          ? ROLE_LABELS[msg.authorRole]?.label
                          : null;

                        return (
                          <div
                            key={msg.id}
                            data-testid={`message-item-${msg.id}`}
                            className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/70 space-y-1.5 group"
                          >
                            {parentMsg && (
                              <div className="pl-2.5 border-l-2 border-cyan-500/40 text-[11px] text-slate-400 truncate">
                                <span className="text-cyan-300 font-medium">
                                  {parentMsg.authorName}:
                                </span>{' '}
                                {parentMsg.deletedAt ? '[Message removed]' : parentMsg.body}
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {msg.authorAvatarUrl ? (
                                  <img
                                    src={msg.authorAvatarUrl}
                                    alt={msg.authorName}
                                    className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-200 shrink-0">
                                    {getInitials(msg.authorName)}
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="text-xs font-semibold text-slate-100">
                                    {msg.authorName}
                                  </span>
                                  {roleBadge && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                                      {roleBadge}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {formatMessageTime(msg.createdAt)}
                                  </span>
                                  {msg.editedAt && !isDeleted && (
                                    <span className="text-[10px] text-slate-500 italic">
                                      (edited)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {canPost && !isDeleted && (
                                  <button
                                    type="button"
                                    onClick={() => setReplyTarget(msg)}
                                    title="Reply to message"
                                    className="p-1 rounded text-slate-500 hover:text-cyan-300 hover:bg-slate-800/80 cursor-pointer"
                                  >
                                    <Reply className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canEditMsg && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditingBody(msg.body);
                                    }}
                                    title="Edit message"
                                    className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800/80 cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canDeleteMsg && (
                                  <button
                                    type="button"
                                    disabled={busyMessageId === msg.id}
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    title="Remove message"
                                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {editingMessageId === msg.id ? (
                              <div className="space-y-2 pt-1">
                                <textarea
                                  rows={2}
                                  value={editingBody}
                                  onChange={e => setEditingBody(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-500/60"
                                />
                                <div className="flex justify-end gap-2 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-2.5 py-1 rounded text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyMessageId === msg.id}
                                    onClick={() => handleSaveEdit(msg.id)}
                                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p
                                className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${
                                  isDeleted ? 'text-slate-500 italic' : 'text-slate-200'
                                }`}
                              >
                                {isDeleted
                                  ? '[Message removed]'
                                  : renderMessageBodyWithMentions(
                                      msg.body,
                                      msg.mentionUserIds,
                                      members
                                    )}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Composer */}
                  <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/70 shrink-0 relative">
                    {!canPost ? (
                      <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Read-only role: you can read discussions, not post messages.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="space-y-2">
                        {replyTarget && (
                          <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-300">
                            <span className="truncate">
                              Replying to{' '}
                              <span className="text-cyan-300 font-medium">
                                {replyTarget.authorName}
                              </span>
                              : {replyTarget.body}
                            </span>
                            <button
                              type="button"
                              onClick={() => setReplyTarget(null)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {sendError && (
                          <div className="px-2.5 py-1.5 rounded-lg bg-rose-950/35 border border-rose-500/30 flex items-center justify-between gap-2 text-[11px] text-rose-300">
                            <span>{sendError}</span>
                            <button
                              type="button"
                              onClick={() => handleSendMessage()}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-100 cursor-pointer shrink-0"
                            >
                              Retry
                            </button>
                          </div>
                        )}

                        {/* @Mention Popover */}
                        {mentionQuery !== null && mentionCandidates.length > 0 && (
                          <div
                            className="absolute bottom-full left-3.5 right-3.5 mb-1 max-h-48 overflow-y-auto rounded-xl bg-[#101524] border border-slate-700 shadow-2xl divide-y divide-slate-800/60 z-20"
                            data-testid="mention-autocomplete"
                          >
                            {mentionCandidates.map(candidate => (
                              <button
                                key={candidate.userId}
                                type="button"
                                onClick={() => insertMention(candidate)}
                                className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-800/70 transition cursor-pointer text-xs"
                              >
                                <span className="text-slate-100 font-medium">
                                  {candidate.fullName}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {ROLE_LABELS[candidate.role]?.label || candidate.role}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex items-end gap-2">
                          <textarea
                            ref={composerRef}
                            rows={2}
                            data-testid="discussion-composer-input"
                            placeholder="Write a note or reply… Use @ to mention a project member"
                            value={currentDraft}
                            onChange={e =>
                              updateComposerText(e.target.value, e.target.selectionStart ?? undefined)
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                          />
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              type="button"
                              title="Mention a project member"
                              onClick={() => {
                                const next = `${currentDraft}${currentDraft && !currentDraft.endsWith(' ') ? ' ' : ''}@`;
                                updateComposerText(next, next.length);
                                requestAnimationFrame(() => composerRef.current?.focus());
                              }}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
                            >
                              <AtSign className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="submit"
                              disabled={isSending || !currentDraft.trim()}
                              data-testid="discussion-send-btn"
                              className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer disabled:opacity-40"
                              title="Send message"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
