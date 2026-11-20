/**
 * SceneOS — Cinematic Authentication & Entry Gateway
 * 
 * Art Direction: Cinematic Neo-Noir × Premium Gaming × Minimal Editorial Design
 * 
 * Visual Hierarchy (3 major elements only):
 * 1. SCENE branding: Substantially larger central logo with visible outlined marquee behind it
 * 2. Brand caption: "Places, please. Your workspace awaits."
 * 3. Authentication panel: Clean, wide, balanced landscape sign-in experience
 */

import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Info, 
  Clock, 
  X, 
  Check 
} from 'lucide-react';
import { services } from '../../services';
import { envValidation } from '../../config/env';
import { SCENE_LOGO_VIEWBOX, SCENE_LOGO_PATH_D } from '../../assets/sceneLogoPathData';

interface CinematicAuthGatewayProps {
  onSuccess: (displayName: string, role?: string) => void;
  onSelectPersona: (username: string, role: string) => void;
}

export function CinematicAuthGateway({ onSuccess, onSelectPersona }: CinematicAuthGatewayProps) {
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  
  // Form inputs
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status states
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotFeedback, setForgotFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Developer-only personas mechanism (strictly non-visual by default; accessible via ?dev=true or Ctrl+Shift+D)
  const [showDevDrawer, setShowDevDrawer] = useState(() => {
    return typeof window !== 'undefined' && window.location.search.includes('dev=true');
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setShowDevDrawer(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Strong password validation
  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(pass)) return 'Password must contain at least one uppercase letter (A-Z).';
    if (!/[a-z]/.test(pass)) return 'Password must contain at least one lowercase letter (a-z).';
    if (!/[0-9]/.test(pass)) return 'Password must contain at least one numeric digit (0-9).';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return 'Password must contain at least one special character.';
    return null;
  };

  // Google OAuth Handler
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);
    setGoogleLoading(true);

    try {
      if (envValidation.config.isMock) {
        await services.auth.signInWithOAuth('google');
        onSuccess('Elena Rostova', 'Line Producer');
        return;
      }

      const result = await services.auth.signInWithOAuth('google');
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      console.error('[SceneOS Google OAuth]:', err);
      const msg = err.message || '';
      if (msg.includes('Unsupported provider') || msg.includes('provider is not enabled') || msg.includes('validation_failed')) {
        setErrorMessage('Google Sign-In is blocked: Provider is not enabled in your Supabase project. Configure Google Client ID & Secret in Supabase Authentication Providers.');
      } else {
        setErrorMessage(`Google Sign-In failed: ${msg}`);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Email / Password Handler
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Email address is required.');
      return;
    }

    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    setSubmitting(true);

    try {
      if (authMode === 'sign-up') {
        const passErr = validatePassword(password);
        if (passErr) {
          setErrorMessage(passErr);
          setSubmitting(false);
          return;
        }

        if (password !== confirmPassword) {
          setErrorMessage('Password confirmation does not match.');
          setSubmitting(false);
          return;
        }

        const cleanName = fullName.trim() || cleanEmail.split('@')[0];
        const session = await services.auth.register(cleanEmail, password, cleanName);

        if (session.user) {
          onSuccess(session.user.fullName || cleanName, 'Line Producer');
        } else {
          setNoticeMessage('Account registered! If confirmation is enabled on your Supabase project, check your inbox before signing in.');
          setAuthMode('sign-in');
        }
      } else {
        // Sign In
        const session = await services.auth.login(cleanEmail, password);
        if (session.user) {
          onSuccess(session.user.fullName, 'Line Producer');
        }
      }
    } catch (err: any) {
      console.error('[SceneOS Auth]:', err);
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials')) {
        setErrorMessage('Invalid email or password. Please verify your credentials or create an account.');
      } else if (msg.includes('Email not confirmed')) {
        setErrorMessage('Email address not yet confirmed. Please check your inbox for the activation link.');
      } else if (msg.includes('User already registered')) {
        setErrorMessage('An account with this email already exists. Please switch to Sign In.');
      } else {
        setErrorMessage(msg.replace('Supabase Auth Error: ', '').replace('Supabase Registration Error: ', ''));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Forgot Password Handler
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotFeedback(null);
    if (!forgotEmail.trim()) {
      setForgotFeedback({ type: 'error', message: 'Please enter your email address.' });
      return;
    }

    setForgotSubmitting(true);
    try {
      const res = await services.auth.resetPassword(forgotEmail.trim());
      setForgotFeedback({
        type: 'success',
        message: res.message || 'Password recovery instructions dispatched. Please check your inbox.',
      });
    } catch (err: any) {
      setForgotFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch password recovery link.',
      });
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-center items-center relative overflow-hidden bg-[#07090E] text-zinc-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 px-4 py-10 sm:py-16"
      id="scene-auth-page"
    >
      {/* ===================================================================
          1. BACKGROUND ATMOSPHERE & LIGHTING
          Controlled, atmospheric cyan-blue gradient blooms behind branding
         =================================================================== */}
      {/* Primary diffused light bloom behind the central SCENE wordmark */}
      <div 
        className="absolute top-8 sm:top-12 left-1/2 -translate-x-1/2 w-[650px] sm:w-[900px] h-[340px] sm:h-[420px] bg-gradient-to-b from-cyan-500/18 via-indigo-600/12 to-transparent blur-[100px] sm:blur-[120px] pointer-events-none rounded-full" 
        aria-hidden="true"
      />

      {/* Ambient background bloom */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] sm:w-[1100px] h-[550px] bg-gradient-to-tr from-cyan-950/15 via-indigo-950/20 to-transparent blur-[140px] pointer-events-none rounded-full" 
        aria-hidden="true"
      />

      {/* ===================================================================
          2. BACKGROUND OUTLINED SCENE MARQUEE
          Prominently visible, oversized vector contour running in an elegant,
          continuous slow loop behind the primary logo. Pauses on hover.
         =================================================================== */}
      <div 
        className="absolute top-6 sm:top-8 md:top-12 inset-x-0 overflow-hidden pointer-events-auto select-none z-0 opacity-20 sm:opacity-25 transition-opacity duration-300"
        title="SCENE Outline Marquee (Hover to pause)"
        aria-hidden="true"
      >
        <div className="animate-marquee-slow flex items-center">
          {[0, 1, 2, 3, 4, 5].map(idx => (
            <svg
              key={idx}
              viewBox={SCENE_LOGO_VIEWBOX}
              className="h-36 sm:h-52 md:h-64 lg:h-72 w-auto shrink-0 mx-8 sm:mx-14"
              fill="none"
            >
              <defs>
                <linearGradient id={`marqueeOutline-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#818CF8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#00F2FE" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <path
                d={SCENE_LOGO_PATH_D}
                stroke={`url(#marqueeOutline-${idx})`}
                strokeWidth="2.5"
                fill="none"
              />
            </svg>
          ))}
        </div>
      </div>

      {/* ===================================================================
          3. SCENE BRANDING — PRIMARY VISUAL FOCAL POINT
          Substantially larger dimensions, authentic approved vector artwork,
          and single memorable human caption: "Places, please. Your workspace awaits."
         =================================================================== */}
      <header className="relative z-10 text-center mb-8 sm:mb-12 max-w-4xl mx-auto flex flex-col items-center">
        {/* Dominant SCENE Wordmark */}
        <div className="flex justify-center items-center w-full">
          <svg 
            viewBox={SCENE_LOGO_VIEWBOX} 
            className="w-72 sm:w-[480px] md:w-[640px] lg:w-[760px] max-w-full h-auto drop-shadow-[0_8px_50px_rgba(0,242,254,0.32)] transition-all duration-300"
            role="img"
            aria-label="SCENE"
          >
            <defs>
              <linearGradient id="sceneHeroLogoGradient" x1="0%" y1="0%" x2="100%" y2="60%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="30%" stopColor="#F0FDFA" />
                <stop offset="70%" stopColor="#67E8F9" />
                <stop offset="100%" stopColor="#00E5FF" />
              </linearGradient>
            </defs>
            <path d={SCENE_LOGO_PATH_D} fill="url(#sceneHeroLogoGradient)" />
          </svg>
        </div>

        {/* Single Memorable Brand Caption */}
        <p className="text-base sm:text-lg md:text-xl font-medium text-zinc-300 mt-5 sm:mt-6 tracking-wide font-sans text-center">
          Places, please. Your workspace awaits.
        </p>
      </header>

      {/* ===================================================================
          4. REWORKED AUTHENTICATION PANEL — WIDE, CLEAN & BALANCED
          Removed technical columns and metadata in their entirety.
          Top area: Clean heading + Sign In / Create Account switch
          Auth area: Google button + divider + horizontal credentials form
         =================================================================== */}
      <main className="relative z-10 w-full max-w-2xl sm:max-w-3xl mx-auto">
        <div 
          className="w-full bg-[#0A0D15]/85 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 md:p-9 shadow-2xl shadow-black/80 backdrop-blur-xl relative overflow-hidden"
          id="auth-card"
        >
          {/* Subtle top edge lighting highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

          {/* Top Area: Clean Heading & Mode Switcher */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800/70">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {authMode === 'sign-in' ? 'Sign In' : 'Create Account'}
            </h2>

            {/* Mode Switch Tabs */}
            <div className="flex p-0.5 bg-zinc-950/80 border border-zinc-800/90 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('sign-in');
                  setErrorMessage(null);
                  setNoticeMessage(null);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  authMode === 'sign-in'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('sign-up');
                  setErrorMessage(null);
                  setNoticeMessage(null);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  authMode === 'sign-up'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Feedback & Alert Messages */}
          {noticeMessage && (
            <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs flex items-start gap-2 mb-4 leading-relaxed animate-fade-in">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
              <span>{noticeMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 mb-4 leading-relaxed animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google OAuth Action */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || submitting}
            className="w-full h-11 px-4 border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-100 rounded-xl text-xs font-medium tracking-wide flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm group"
            id="btn-google-oauth"
          >
            {googleLoading ? (
              <Clock className="w-4 h-4 animate-spin text-cyan-400" />
            ) : (
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="font-medium">
              {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
            </span>
          </button>

          {/* Subtle Divider */}
          <div className="relative flex items-center justify-center my-4 sm:my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800/80" />
            </div>
            <span className="relative px-3 text-[11px] text-zinc-500 bg-[#0A0D15]">
              or with email
            </span>
          </div>

          {/* Credentials Form (Clean horizontal arrangement on desktop) */}
          <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
            
            {/* SIGN IN: Email and Password horizontally aligned */}
            {authMode === 'sign-in' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 block">
                    Email address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value);
                        setErrorMessage(null);
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                </div>

                {/* Password with inline forgot password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-300 block">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(true);
                        setForgotEmail(email);
                        setForgotFeedback(null);
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* CREATE ACCOUNT: 2x2 Grid */
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      Full name
                    </label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        required
                        placeholder="Your name"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      Email address
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3 w-4 h-4 text-zinc-500" />
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={e => {
                          setEmail(e.target.value);
                          setErrorMessage(null);
                        }}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 block">
                      Confirm password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 text-zinc-500 hover:text-zinc-300"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500">
                  Minimum 8 characters with uppercase, lowercase, numeric digit, and special symbol.
                </p>
              </div>
            )}

            {/* Primary Authentication Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 via-indigo-600 to-cyan-500 hover:from-cyan-400 hover:via-indigo-500 hover:to-cyan-400 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 disabled:opacity-50 cursor-pointer group"
                id="btn-auth-submit"
              >
                {submitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>{authMode === 'sign-in' ? 'Enter Workspace' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* ===================================================================
          DEVELOPER / QA REVIEWER DRAWER (STRICTLY NON-VISUAL UNLESS TRIGGERED)
          Accessible exclusively via ?dev=true or Ctrl+Shift+D keyboard shortcut.
          Completely removed from standard authentication experience.
         =================================================================== */}
      {showDevDrawer && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-zinc-950/95 border border-zinc-700/80 rounded-2xl shadow-2xl animate-fade-in max-w-xs text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              QA Reviewer Personas
            </span>
            <button
              type="button"
              onClick={() => setShowDevDrawer(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onSelectPersona('kira.vance@sceneos.studio', 'Director')}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-left text-xs text-zinc-300 flex justify-between items-center"
            >
              <span>Kira Vance</span>
              <span className="text-[10px] font-mono text-indigo-400">Director</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectPersona('elena.rostova@sceneos.studio', 'Line Producer')}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-left text-xs text-zinc-300 flex justify-between items-center"
            >
              <span>Elena Rostova</span>
              <span className="text-[10px] font-mono text-emerald-400">Line Producer</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectPersona('marcus.ad@sceneos.studio', '1st Assistant Director')}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-left text-xs text-zinc-300 flex justify-between items-center"
            >
              <span>Marcus Thorne</span>
              <span className="text-[10px] font-mono text-amber-400">1st AD</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          FORGOT PASSWORD MODAL (PRESERVED & STREAMLINED)
         =================================================================== */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0B0E17] border border-zinc-800 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white tracking-tight">Recover Account</h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-850 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Enter your email address to receive password recovery instructions.
            </p>

            {forgotFeedback && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 mb-4 leading-relaxed ${
                forgotFeedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                {forgotFeedback.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
                <span>{forgotFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 block">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition rounded-xl hover:bg-zinc-850 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition shadow-lg shadow-cyan-900/30 disabled:opacity-50 cursor-pointer"
                >
                  {forgotSubmitting ? 'Sending...' : 'Send Recovery Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
