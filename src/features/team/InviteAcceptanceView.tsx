/**
 * SceneOS — Invitation Validation & Acceptance View (#invite=<token>)
 *
 * Handles live and mock invitation redemption safely:
 * - Validates token server-side via previewInvitation() before allowing acceptance.
 * - Handles invalid, expired, revoked, already accepted, already-member, and email-mismatch states.
 * - Lets unauthenticated visitors sign in, create an account, or use Google OAuth while retaining the token.
 * - Refreshes project list and verified membership on acceptance.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Film,
  LogOut,
  Mail,
  Shield,
  UserPlus,
  X,
  Lock,
} from 'lucide-react';
import { services } from '../../services';
import {
  InvitationError,
  InvitationPreview,
} from '../../services/contracts/types';
import {
  ROLE_LABELS,
  ROLE_PLAIN_SUMMARY,
} from '../../services/rbac/permissions';
import { MOCK_USERS } from '../../services/mock/MockServices';
import { useProject } from '../projects/ProjectContext';

export const PENDING_INVITE_STORAGE_KEY = 'sceneos_pending_invite_token';

export function parseInviteTokenFromHash(hash: string): string | null {
  if (!hash) return null;
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized.toLowerCase().startsWith('invite=')) return null;
  const raw = normalized.slice('invite='.length).split('&')[0];
  try {
    const decoded = decodeURIComponent(raw).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return raw.trim() || null;
  }
}

export function resolveInitialInviteToken(
  hash: string,
  storage?: Pick<Storage, 'getItem'> | null
): string | null {
  const fromHash = parseInviteTokenFromHash(hash);
  if (fromHash) return fromHash;
  try {
    return storage?.getItem(PENDING_INVITE_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

interface InviteAcceptanceViewProps {
  token: string;
  onDismiss: () => void;
  onAccepted: (projectId: string) => Promise<void> | void;
}

export function InviteAcceptanceView({
  token,
  onDismiss,
  onAccepted,
}: InviteAcceptanceViewProps) {
  const { currentUser, logout, projects, switchProject } = useProject();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Embedded auth state when invitee arrives signed out
  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const isMockProvider = services.provider === 'mock';

  const loadPreview = useCallback(async () => {
    setIsValidating(true);
    setActionError(null);
    try {
      const res = await services.invitations.previewInvitation(token);
      setPreview(res);
    } catch {
      setPreview({ status: 'invalid' });
    } finally {
      setIsValidating(false);
    }
  }, [token]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview, currentUser?.id, currentUser?.email]);

  const handleAccept = async () => {
    setIsAccepting(true);
    setActionError(null);
    try {
      const result = await services.invitations.acceptInvitation(token);
      if (result.success) {
        await onAccepted(result.projectId);
      }
    } catch (err: any) {
      const message =
        err instanceof InvitationError
          ? err.message
          : err?.message || 'Unable to accept this invitation.';
      setActionError(message);
      await loadPreview();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleOpenExistingProject = async () => {
    if (preview?.projectId && projects.some(p => p.id === preview.projectId)) {
      await switchProject(preview.projectId);
    }
    onDismiss();
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setAuthMessage(null);
    setAuthSubmitting(true);
    try {
      if (authTab === 'signin') {
        await services.auth.login(email.trim(), password);
      } else {
        if (!fullName.trim()) {
          throw new Error('Full name is required.');
        }
        await services.auth.register(email.trim(), password, fullName.trim());
        if (!isMockProvider) {
          setAuthMessage(
            'Account created. If email confirmation is required, confirm your email and reopen this invitation link.'
          );
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'Authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setActionError(null);
    setAuthSubmitting(true);
    try {
      try {
        sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
      } catch {
        // Ignore sessionStorage restrictions
      }
      const res = await services.auth.signInWithOAuth('google');
      if (res.url && !isMockProvider) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setActionError(err?.message || 'Google sign-in failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const roleMeta = preview?.role ? ROLE_LABELS[preview.role] : null;
  const roleSummary = preview?.role ? ROLE_PLAIN_SUMMARY[preview.role] : null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans"
      data-testid="invite-acceptance-overlay"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B0E17] border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                Project Invitation
              </h2>
              <p className="text-[11px] text-slate-400">
                {isMockProvider ? 'Offline Mock Mode' : 'Verified SceneOS Access'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close invitation screen"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isValidating ? (
            <div className="py-10 text-center space-y-2" data-testid="invite-validating">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Validating invitation…</p>
            </div>
          ) : !preview || preview.status === 'invalid' ? (
            <div className="space-y-4" data-testid="invite-state-invalid">
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-rose-200">
                    Invitation link is invalid
                  </h3>
                  <p className="text-xs text-rose-300/80">
                    This link may be incomplete, mistyped, or from an incompatible environment. Ask a project owner or producer for a new invitation link.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
                >
                  Continue to SceneOS
                </button>
              </div>
            </div>
          ) : preview.status === 'expired' || preview.status === 'revoked' || preview.status === 'accepted' ? (
            <div className="space-y-4" data-testid={`invite-state-${preview.status}`}>
              <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/30 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-amber-200">
                    {preview.status === 'expired'
                      ? 'This invitation has expired'
                      : preview.status === 'revoked'
                        ? 'This invitation was revoked'
                        : 'This invitation has already been used'}
                  </h3>
                  {preview.projectName && (
                    <p className="text-xs text-slate-300">
                      Production: <span className="font-semibold text-white">{preview.projectName}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    {preview.status === 'expired'
                      ? 'Invitations expire after their validity window. Ask a producer or owner to issue a fresh link.'
                      : preview.status === 'revoked'
                        ? 'A project leader cancelled this invitation before it was accepted.'
                        : 'Single-use invitation links cannot be redeemed more than once.'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
                >
                  Return to Workspace
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Project & Role Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Film className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 block">
                        Production
                      </span>
                      <h3 className="text-sm font-semibold text-white truncate">
                        {preview.projectName || 'SceneOS Production'}
                      </h3>
                    </div>
                  </div>

                  {roleMeta && (
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-medium shrink-0 ${roleMeta.badgeColor}`}>
                      {roleMeta.label}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/70 text-[11px] text-slate-400">
                  {preview.inviterName && (
                    <div>
                      Invited by <span className="text-slate-200 font-medium">{preview.inviterName}</span>
                    </div>
                  )}
                  {preview.department && (
                    <div>
                      Department <span className="text-slate-200 font-medium">{preview.department}</span>
                    </div>
                  )}
                  {preview.expiresAt && (
                    <div>
                      Valid until{' '}
                      <span className="text-slate-300 font-mono">
                        {new Date(preview.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {roleSummary && (
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-800/70 text-[11px] text-slate-300">
                    <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{roleSummary}</span>
                  </div>
                )}
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-950/35 border border-rose-500/35 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Email Mismatch */}
              {preview.status === 'email_mismatch' && currentUser && (
                <div className="space-y-4" data-testid="invite-state-email-mismatch">
                  <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-200 font-semibold">
                      <Lock className="w-4 h-4 text-rose-400" />
                      <span>Signed in with a different email</span>
                    </div>
                    <p className="text-slate-300">
                      You are signed in as{' '}
                      <span className="font-mono text-white">{currentUser.email}</span>
                      {preview.invitedEmailHint ? (
                        <>
                          , but this invitation was issued to{' '}
                          <span className="font-mono text-amber-300">{preview.invitedEmailHint}</span>.
                        </>
                      ) : (
                        '.'
                      )}
                    </p>
                    <p className="text-slate-400">
                      Sign out and sign in with the invited email address to accept.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onDismiss}
                      className="px-3.5 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out & Switch Account</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Already Member */}
              {preview.status === 'already_member' && currentUser && (
                <div className="space-y-4" data-testid="invite-state-already-member">
                  <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      You are already a member of this project as{' '}
                      <span className="font-semibold">{currentUser.email}</span>.
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={onDismiss}
                      className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenExistingProject}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white transition cursor-pointer"
                    >
                      Open Project
                    </button>
                  </div>
                </div>
              )}

              {/* Valid & Unauthenticated */}
              {preview.status === 'valid' && !currentUser && (
                <div className="space-y-4" data-testid="invite-state-unauthenticated">
                  <p className="text-xs text-slate-300">
                    Sign in with the email address that received this invitation to join the project.
                  </p>

                  {isMockProvider && (
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">
                        Mock Mode Quick Account Switch
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {MOCK_USERS.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => services.auth.login(u.email)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 transition cursor-pointer"
                          >
                            {u.fullName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex border-b border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setAuthTab('signin')}
                      className={`px-3 py-1.5 font-medium border-b-2 -mb-px transition cursor-pointer ${
                        authTab === 'signin'
                          ? 'border-cyan-400 text-cyan-300'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthTab('register')}
                      className={`px-3 py-1.5 font-medium border-b-2 -mb-px transition cursor-pointer ${
                        authTab === 'register'
                          ? 'border-cyan-400 text-cyan-300'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  {authMessage && (
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300">
                      {authMessage}
                    </div>
                  )}

                  <form onSubmit={handleSignInSubmit} className="space-y-2.5">
                    {authTab === 'register' && (
                      <input
                        type="text"
                        required
                        placeholder="Full name"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                      />
                    )}
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="Invited email address"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={authSubmitting}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 transition cursor-pointer disabled:opacity-50"
                      >
                        Continue with Google
                      </button>
                      <button
                        type="submit"
                        disabled={authSubmitting}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white transition cursor-pointer disabled:opacity-50"
                      >
                        {authSubmitting
                          ? 'Please wait…'
                          : authTab === 'signin'
                            ? 'Sign In'
                            : 'Create Account'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Valid & Authenticated */}
              {preview.status === 'valid' && currentUser && (
                <div className="space-y-4" data-testid="invite-state-ready">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400">Accepting as </span>
                      <span className="font-semibold text-white">{currentUser.fullName}</span>
                      <span className="text-slate-400"> ({currentUser.email})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      Switch
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onDismiss}
                      className="px-3.5 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                    >
                      Not now
                    </button>
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={isAccepting}
                      data-testid="accept-invitation-btn"
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white transition cursor-pointer disabled:opacity-50"
                    >
                      {isAccepting ? 'Joining project…' : 'Accept Invitation'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
