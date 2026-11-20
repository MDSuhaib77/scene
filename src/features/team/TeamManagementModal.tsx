/**
 * SceneOS — People & Project Access Modal
 *
 * Manages authenticated project members, role presets, invitations, and explicit
 * Production Directory associations while keeping Directory contacts distinct from
 * authenticated project access.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Clock,
  Copy,
  Check,
  AlertCircle,
  X,
  Link2,
  Unlink,
  RefreshCw,
  Crown,
  CloudOff,
  RotateCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useProject } from '../projects/ProjectContext';
import { services } from '../../services';
import { ProjectRole } from '../../types/database.types';
import {
  PROJECT_DEPARTMENTS,
  ROLE_LABELS,
  ROLE_PLAIN_SUMMARY,
  canEditMemberDetails,
  canInviteRole,
  canRemoveMember,
  getAssignableRolesForMember,
  getInvitableRoles,
} from '../../services/rbac/permissions';
import {
  InvitationDomainModel,
  ProjectMemberDomainModel,
} from '../../services/contracts/types';
import { getProductionOperationalStore } from '../production/services/productionStoreService';

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function TeamManagementModal({ isOpen, onClose }: TeamManagementModalProps) {
  const {
    activeProject,
    activeRole,
    members,
    membersLoading,
    membersError,
    refreshMembers,
    can,
  } = useProject();

  const [invitations, setInvitations] = useState<InvitationDomainModel[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('crew_member');
  const [inviteDepartment, setInviteDepartment] = useState('');
  const [inviteDirectoryEntryId, setInviteDirectoryEntryId] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    tokenUrl?: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sessionInviteUrls, setSessionInviteUrls] = useState<Record<string, string>>({});

  // Inline association/department editor state per member
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [draftDepartment, setDraftDepartment] = useState('');
  const [draftDirectoryId, setDraftDirectoryId] = useState('');
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

  const [showRolePresets, setShowRolePresets] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const isLocalOnly = activeProject?.persistence === 'local';
  const isMockMode =
    services.provider === 'mock' || activeProject?.persistence === 'mock';

  const invitableRoles = useMemo(
    () => getInvitableRoles(activeRole),
    [activeRole]
  );

  useEffect(() => {
    if (invitableRoles.length > 0 && !invitableRoles.includes(inviteRole)) {
      setInviteRole(invitableRoles.includes('crew_member') ? 'crew_member' : invitableRoles[0]);
    }
  }, [invitableRoles, inviteRole]);

  const directoryPeople = useMemo(() => {
    if (!activeProject) return [];
    const store = getProductionOperationalStore(activeProject);
    return store.directoryEntries.filter(
      e => !e.archived && (e.kind === 'cast' || e.kind === 'crew' || e.kind === 'contact')
    );
  }, [activeProject]);

  const directoryById = useMemo(() => {
    const map = new Map<string, (typeof directoryPeople)[number]>();
    for (const entry of directoryPeople) {
      map.set(entry.id, entry);
    }
    return map;
  }, [directoryPeople]);

  const loadInvitations = useCallback(async () => {
    if (!activeProject || isLocalOnly || !can('members:view')) {
      setInvitations([]);
      setInvitationsError(null);
      return;
    }

    setInvitationsLoading(true);
    setInvitationsError(null);
    try {
      const list = await services.invitations.getProjectInvitations(activeProject.id);
      setInvitations(list);
    } catch (err: any) {
      setInvitationsError(err?.message || 'Failed to load project invitations.');
    } finally {
      setInvitationsLoading(false);
    }
  }, [activeProject, isLocalOnly, can]);

  useEffect(() => {
    if (isOpen && activeProject) {
      setFeedback(null);
      setEditingMemberId(null);
      loadInvitations();
    }
  }, [isOpen, activeProject?.id, loadInvitations]);

  if (!isOpen || !activeProject) return null;

  const canAttachDirectoryOnInvite = activeRole === 'owner' || activeRole === 'producer';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(curr => (curr === key ? null : curr)), 2000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!inviteEmail.trim() || isLocalOnly) return;

    setIsInviting(true);
    try {
      const inv = await services.invitations.createInvitation(
        activeProject.id,
        inviteEmail.trim(),
        inviteRole,
        undefined,
        7 * 24,
        {
          department: inviteDepartment.trim() || undefined,
          directoryEntryId:
            canAttachDirectoryOnInvite && inviteDirectoryEntryId
              ? inviteDirectoryEntryId
              : undefined,
        }
      );

      const inviteUrl = `${window.location.origin}/#invite=${encodeURIComponent(
        inv.invitationToken || inv.id
      )}`;

      setSessionInviteUrls(prev => ({ ...prev, [inv.id]: inviteUrl }));
      setInvitations(prev => [inv, ...prev.filter(x => x.id !== inv.id)]);
      setFeedback({
        type: 'success',
        message: inv.isMock
          ? 'Mock invitation link ready. SceneOS does not send emails automatically in offline mode.'
          : 'Invitation link generated. Share this single-use link directly with the recipient — SceneOS does not send emails automatically.',
        tokenUrl: inviteUrl,
      });

      setInviteEmail('');
      setInviteDepartment('');
      setInviteDirectoryEntryId('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to issue invitation.',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (
    member: ProjectMemberDomainModel,
    newRole: ProjectRole
  ) => {
    if (!activeRole || newRole === member.role) return;
    setFeedback(null);
    setBusyActionId(member.id);
    try {
      await services.projects.updateMemberRole(
        activeProject.id,
        member.id,
        newRole,
        activeRole
      );
      await refreshMembers();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to update member role.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const startEditingDetails = (member: ProjectMemberDomainModel) => {
    setEditingMemberId(member.id);
    setDraftDepartment(member.department || '');
    setDraftDirectoryId(member.directoryEntryId || '');
  };

  const saveMemberDetails = async (memberId: string) => {
    setSavingMemberId(memberId);
    setFeedback(null);
    try {
      await services.projects.updateMemberDetails(activeProject.id, memberId, {
        department: draftDepartment.trim() || null,
        directoryEntryId: draftDirectoryId || null,
      });
      await refreshMembers();
      setEditingMemberId(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to save member details.',
      });
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleRemoveMember = async (member: ProjectMemberDomainModel) => {
    if (member.isOwner || member.role === 'owner') return;
    if (!confirm(`Remove ${member.fullName} from ${activeProject.title}?`)) return;
    setBusyActionId(member.id);
    setFeedback(null);
    try {
      await services.projects.removeProjectMember(member.id);
      await refreshMembers();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to remove member.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRevokeInvitation = async (invId: string) => {
    setBusyActionId(invId);
    setFeedback(null);
    try {
      await services.invitations.revokeInvitation(invId);
      setInvitations(prev =>
        prev.map(i => (i.id === invId ? { ...i, status: 'revoked' } : i))
      );
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to revoke invitation.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleReissueInvitation = async (inv: InvitationDomainModel) => {
    setBusyActionId(inv.id);
    setFeedback(null);
    try {
      await services.invitations.revokeInvitation(inv.id);
      const fresh = await services.invitations.createInvitation(
        activeProject.id,
        inv.email,
        inv.role,
        undefined,
        7 * 24,
        {
          department: inv.department || undefined,
          directoryEntryId:
            canAttachDirectoryOnInvite && inv.directoryEntryId
              ? inv.directoryEntryId
              : undefined,
        }
      );
      const inviteUrl = `${window.location.origin}/#invite=${encodeURIComponent(
        fresh.invitationToken || fresh.id
      )}`;
      setSessionInviteUrls(prev => ({ ...prev, [fresh.id]: inviteUrl }));
      setInvitations(prev => [
        fresh,
        ...prev.map(i => (i.id === inv.id ? { ...i, status: 'revoked' as const } : i)),
      ]);
      setFeedback({
        type: 'success',
        message: `New single-use link generated for ${fresh.email}. Previous link revoked.`,
        tokenUrl: inviteUrl,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to reissue invitation link.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const pendingCount = invitations.filter(i => i.status === 'pending').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans"
      data-testid="people-modal"
    >
      <div className="bg-[#0B0E17] border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-950/70 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  People
                </h2>
                <span className="text-[11px] text-slate-400 truncate max-w-[220px]">
                  · {activeProject.title}
                </span>
                {!isLocalOnly && !membersLoading && !membersError && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {members.length} {members.length === 1 ? 'Member' : 'Members'}
                  </span>
                )}
                {isMockMode && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-500/30 text-amber-300 font-mono">
                    Offline Mock
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Project access, role presets, and Production Directory links
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close People panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Local-only fallback notice */}
          {isLocalOnly ? (
            <div
              className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-3"
              data-testid="people-local-only-notice"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-950/50 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <CloudOff className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Connected Supabase Project Required
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                This project exists only in your browser&apos;s local storage and is not synced to Supabase. People, invitations, and shared membership are available only on cloud-persisted projects.
              </p>
            </div>
          ) : !activeRole && !membersLoading && !membersError ? (
            /* Unresolved membership / permission denied */
            <div
              className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-2"
              data-testid="people-permission-denied"
            >
              <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
              <h3 className="text-sm font-semibold text-rose-200">
                Membership Could Not Be Verified
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your verified role on this project is unavailable. Access remains read-only until membership is confirmed.
              </p>
              <button
                type="button"
                onClick={() => refreshMembers()}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-check Access</span>
              </button>
            </div>
          ) : (
            <>
              {/* Feedback Banner */}
              {feedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{feedback.message}</span>
                  </div>
                  {feedback.tokenUrl && (
                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px] bg-black/50 p-2 rounded-lg border border-slate-800">
                      <span className="truncate flex-1 text-slate-200" data-testid="generated-invite-url">
                        {feedback.tokenUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(feedback.tokenUrl!, 'latest-feedback')}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedKey === 'latest-feedback' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedKey === 'latest-feedback' ? 'Copied' : 'Copy Link'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Invite Form (Authorized inviters only) */}
              {can('members:invite') && invitableRoles.length > 0 && (
                <div
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                  data-testid="invite-form-section"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                      <UserPlus className="w-4 h-4 text-cyan-400" />
                      <span>Invite Person to Project</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRolePresets(v => !v)}
                      className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Shield className="w-3 h-3" />
                      <span>Role presets</span>
                      {showRolePresets ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {showRolePresets && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px]">
                      {(Object.keys(ROLE_PLAIN_SUMMARY) as ProjectRole[]).map(r => (
                        <div key={r} className="space-y-0.5">
                          <span className="font-semibold text-slate-200">
                            {ROLE_LABELS[r].label}
                          </span>
                          <p className="text-slate-400 leading-snug">
                            {ROLE_PLAIN_SUMMARY[r]}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleInvite} className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="relative flex-1">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          placeholder="colleague@studio.com"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>

                      <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as ProjectRole)}
                        aria-label="Invitation role"
                        className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500/50"
                      >
                        {invitableRoles.map(r => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r].label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="submit"
                        disabled={isInviting}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isInviting ? 'Creating…' : 'Create Invite Link'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <select
                        value={inviteDepartment}
                        onChange={e => setInviteDepartment(e.target.value)}
                        aria-label="Optional department"
                        className="px-3 py-1.5 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="">Department (optional)</option>
                        {PROJECT_DEPARTMENTS.map(dept => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>

                      {canAttachDirectoryOnInvite && (
                        <select
                          value={inviteDirectoryEntryId}
                          onChange={e => setInviteDirectoryEntryId(e.target.value)}
                          aria-label="Optional Directory contact link"
                          className="px-3 py-1.5 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                        >
                          <option value="">Link Directory entry (optional)</option>
                          {directoryPeople.map(entry => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} · {entry.roleOrCategory}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400">
                      <span className="text-slate-300 font-medium">
                        {ROLE_LABELS[inviteRole]?.label}:
                      </span>{' '}
                      {ROLE_PLAIN_SUMMARY[inviteRole]}
                    </p>
                  </form>
                </div>
              )}

              {/* Project Members Roster */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    Project Members
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Directory contacts do not receive access until invited
                  </span>
                </div>

                {membersLoading ? (
                  <div
                    className="p-6 rounded-xl border border-slate-800/60 bg-slate-950/30 text-center text-xs text-slate-400"
                    data-testid="members-loading"
                  >
                    Loading verified project members…
                  </div>
                ) : membersError ? (
                  <div
                    className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 flex items-center justify-between gap-3 text-xs text-rose-300"
                    data-testid="members-error"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="truncate">{membersError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => refreshMembers()}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : members.length === 0 ? (
                  <div className="p-6 rounded-xl border border-slate-800/60 bg-slate-950/30 text-center text-xs text-slate-500">
                    No project members found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50 border border-slate-800/70 rounded-xl overflow-hidden bg-slate-950/40">
                    {members.map(member => {
                      const roleConfig =
                        ROLE_LABELS[member.role] || ROLE_LABELS['crew_member'];
                      const isOwnerMember =
                        Boolean(member.isOwner) || member.role === 'owner';
                      const assignableRoles = getAssignableRolesForMember(
                        activeRole,
                        member.role
                      );
                      const showRoleSelect =
                        can('members:change_role') && assignableRoles.length > 0;
                      const showRemove = canRemoveMember(activeRole, member.role);
                      const showDetailsEditor = canEditMemberDetails(
                        activeRole,
                        member.role
                      );
                      const linkedDir = member.directoryEntryId
                        ? directoryById.get(member.directoryEntryId)
                        : undefined;
                      const isEditingDetails = editingMemberId === member.id;

                      return (
                        <div
                          key={member.id}
                          className="p-3.5 space-y-2.5"
                          data-testid={`member-row-${member.userId}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {member.avatarUrl ? (
                                <img
                                  src={member.avatarUrl}
                                  alt={member.fullName}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
                                  {getInitials(member.fullName)}
                                </div>
                              )}

                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-100 truncate">
                                    {member.fullName}
                                  </span>

                                  {isOwnerMember ? (
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${ROLE_LABELS.owner.badgeColor}`}
                                    >
                                      <Crown className="w-2.5 h-2.5" />
                                      Project Owner
                                    </span>
                                  ) : (
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${roleConfig.badgeColor}`}
                                    >
                                      {roleConfig.label}
                                    </span>
                                  )}

                                  {member.department && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-slate-300">
                                      {member.department}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                                  <span className="truncate">{member.email}</span>
                                  {member.directoryEntryId && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300/90 font-mono">
                                      <Link2 className="w-3 h-3" />
                                      {linkedDir
                                        ? `Directory: ${linkedDir.name}`
                                        : 'Directory entry linked (not in list)'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {showDetailsEditor && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditingDetails
                                      ? setEditingMemberId(null)
                                      : startEditingDetails(member)
                                  }
                                  className="px-2 py-1 rounded-lg text-[11px] text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/70 transition cursor-pointer"
                                >
                                  {isEditingDetails ? 'Close' : 'Dept / Link'}
                                </button>
                              )}

                              {showRoleSelect && (
                                <select
                                  value={member.role}
                                  disabled={busyActionId === member.id}
                                  aria-label={`Role for ${member.fullName}`}
                                  onChange={e =>
                                    handleRoleChange(
                                      member,
                                      e.target.value as ProjectRole
                                    )
                                  }
                                  className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none disabled:opacity-50"
                                >
                                  {assignableRoles.map(r => (
                                    <option key={r} value={r}>
                                      {ROLE_LABELS[r].label}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {showRemove && (
                                <button
                                  type="button"
                                  disabled={busyActionId === member.id}
                                  onClick={() => handleRemoveMember(member)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer disabled:opacity-50"
                                  title="Remove from project"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Explicit Department & Directory Association Drawer */}
                          {isEditingDetails && showDetailsEditor && (
                            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                              <div className="space-y-1">
                                <label className="text-[10px] font-mono uppercase text-slate-400 block">
                                  Department
                                </label>
                                <select
                                  value={draftDepartment}
                                  onChange={e => setDraftDepartment(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                                >
                                  <option value="">None</option>
                                  {PROJECT_DEPARTMENTS.map(dept => (
                                    <option key={dept} value={dept}>
                                      {dept}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-mono uppercase text-slate-400 block">
                                  Production Directory Contact
                                </label>
                                <div className="flex gap-1.5">
                                  <select
                                    value={draftDirectoryId}
                                    onChange={e => setDraftDirectoryId(e.target.value)}
                                    className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                                  >
                                    <option value="">Not linked</option>
                                    {directoryPeople.map(entry => (
                                      <option key={entry.id} value={entry.id}>
                                        {entry.name} ({entry.roleOrCategory})
                                      </option>
                                    ))}
                                  </select>
                                  {draftDirectoryId && (
                                    <button
                                      type="button"
                                      onClick={() => setDraftDirectoryId('')}
                                      title="Unlink Directory entry"
                                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                    >
                                      <Unlink className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberId(null)}
                                  className="px-3 py-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingMemberId === member.id}
                                  onClick={() => saveMemberDetails(member.id)}
                                  className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium cursor-pointer disabled:opacity-50"
                                >
                                  {savingMemberId === member.id ? 'Saving…' : 'Save Association'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Invitations List */}
              {(invitationsLoading || invitationsError || invitations.length > 0) && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Invitations ({pendingCount} Pending)
                      </span>
                    </h3>
                  </div>

                  {invitationsLoading ? (
                    <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-950/30 text-xs text-slate-400">
                      Loading invitations…
                    </div>
                  ) : invitationsError ? (
                    <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 flex items-center justify-between gap-2">
                      <span>{invitationsError}</span>
                      <button
                        type="button"
                        onClick={loadInvitations}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/50 border border-slate-800/70 rounded-xl overflow-hidden bg-slate-950/40">
                      {invitations.map(inv => {
                        const roleCfg = ROLE_LABELS[inv.role] || ROLE_LABELS.crew_member;
                        const cachedUrl =
                          sessionInviteUrls[inv.id] ||
                          (inv.invitationToken
                            ? `${window.location.origin}/#invite=${encodeURIComponent(
                                inv.invitationToken
                              )}`
                            : null);
                        const canManageThisInvite = canInviteRole(activeRole, inv.role);
                        const dirMatch = inv.directoryEntryId
                          ? directoryById.get(inv.directoryEntryId)
                          : undefined;

                        const statusClasses =
                          inv.status === 'pending'
                            ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                            : inv.status === 'accepted'
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                              : inv.status === 'revoked'
                                ? 'bg-rose-950/40 text-rose-300 border-rose-800/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700';

                        return (
                          <div
                            key={inv.id}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-slate-100 font-medium truncate">
                                  {inv.email}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                  {roleCfg.label}
                                </span>
                                {inv.department && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                    {inv.department}
                                  </span>
                                )}
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase ${statusClasses}`}
                                >
                                  {inv.status}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3 flex-wrap">
                                <span>
                                  Expires {new Date(inv.expiresAt).toLocaleDateString()}
                                </span>
                                {dirMatch && (
                                  <span className="text-cyan-400/80">
                                    Linked Directory: {dirMatch.name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {inv.status === 'pending' && canManageThisInvite && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {cachedUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(cachedUrl, inv.id)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedKey === inv.id ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                    <span>{copiedKey === inv.id ? 'Copied' : 'Copy Link'}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busyActionId === inv.id}
                                    onClick={() => handleReissueInvitation(inv)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    title="Original raw link is not stored in database; revoke and issue a fresh single-use link"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    <span>Reissue Link</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={busyActionId === inv.id}
                                  onClick={() => handleRevokeInvitation(inv.id)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition cursor-pointer disabled:opacity-50"
                                >
                                  Revoke
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
