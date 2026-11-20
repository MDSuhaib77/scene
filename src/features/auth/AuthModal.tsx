/**
 * SceneOS — Authentication & Session Modal
 * 
 * Supports:
 * - Mock mode rapid account switching (Kira Vance, Elena Rostova, Marcus Thorne).
 * - Live Supabase email/password sign-in and registration.
 * - Password reset requests with truthful messaging.
 * - Explicit labelling of unconfigured third-party OAuth providers.
 */

import React, { useState } from 'react';
import { Film, User, Lock, Mail, AlertCircle, Check, ArrowRight, X } from 'lucide-react';
import { services } from '../../services';
import { MOCK_USERS } from '../../services/mock/MockServices';
import { useProject } from '../projects/ProjectContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { currentUser } = useProject();
  const [tab, setTab] = useState<'signin' | 'register' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const isMock = services.provider === 'mock';

  const handleSwitchMockUser = async (mockEmail: string) => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await services.auth.login(mockEmail);
      onClose();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to switch user.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      if (tab === 'signin') {
        await services.auth.login(email.trim(), password);
        onClose();
      } else if (tab === 'register') {
        if (!fullName.trim()) throw new Error('Full name is required.');
        await services.auth.register(email.trim(), password, fullName.trim());
        setFeedback({
          type: 'success',
          message: isMock
            ? 'Account registered successfully in Mock Mode.'
            : 'Registration complete. Please check your email to verify your account.',
        });
        if (isMock) onClose();
      } else if (tab === 'reset') {
        const res = await services.auth.resetPassword(email.trim());
        setFeedback({ type: 'success', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Authentication error.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await services.auth.logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-[#0B0E17] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                {currentUser ? 'Active Crew Session' : 'SceneOS Gateway'}
              </h2>
              <span className="text-[10px] font-mono text-cyan-400">
                {isMock ? 'SIMULATED MOCK AUTH' : 'SUPABASE SECURE AUTH'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Active Session Info if logged in */}
          {currentUser && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt={currentUser.fullName}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <h4 className="text-xs font-semibold text-slate-100">{currentUser.fullName}</h4>
                  <p className="text-[11px] text-slate-400">{currentUser.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:bg-rose-950/40 border border-rose-800/40 transition"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Rapid Mock User Switcher in Mock Mode */}
          {isMock && (
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                Quick-Switch Simulated Identity:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {MOCK_USERS.map(u => {
                  const isCurrent = currentUser?.email === u.email;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSwitchMockUser(u.email)}
                      className={`p-2 rounded-xl border text-left transition flex flex-col items-center text-center gap-1.5 ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm shadow-cyan-950/50'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <img src={u.avatarUrl} alt={u.fullName} className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                      <div>
                        <span className="text-[11px] font-semibold text-slate-200 block truncate max-w-[80px]">
                          {u.fullName.split(' ')[0]}
                        </span>
                        <span className="text-[9px] uppercase font-mono text-cyan-400 block">
                          {u.role}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auth Tabs */}
          <div className="flex border-b border-slate-800 pt-2">
            <button
              onClick={() => { setTab('signin'); setFeedback(null); }}
              className={`pb-2 px-3 text-xs font-medium transition border-b-2 -mb-px ${
                tab === 'signin'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setFeedback(null); }}
              className={`pb-2 px-3 text-xs font-medium transition border-b-2 -mb-px ${
                tab === 'register'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Register
            </button>
            <button
              onClick={() => { setTab('reset'); setFeedback(null); }}
              className={`pb-2 px-3 text-xs font-medium transition border-b-2 -mb-px ${
                tab === 'reset'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Reset Key
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-3.5 pt-1">
            {feedback && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{feedback.message}</span>
              </div>
            )}

            {tab === 'register' && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya Lin"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="director@studio.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            {tab !== 'reset' && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>
                {tab === 'signin' ? 'Enter Cockpit' : tab === 'register' ? 'Register Account' : 'Send Reset Link'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Social OAuth Disclaimer */}
          <div className="pt-2 text-center text-[10px] text-slate-500 font-mono">
            Social OAuth (Google/Apple) requires production callback configuration.
          </div>
        </div>
      </div>
    </div>
  );
}
