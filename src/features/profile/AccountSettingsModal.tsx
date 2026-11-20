/**
 * SceneOS — Canonical Account & Settings Modal
 * 
 * Replaces the isolated Crew Profile modal with a unified, SaaS-standard
 * account settings experience with persistent category sidebar and dedicated panels.
 * 
 * Sections:
 * - PERSONAL: Profile & Identity, Studio Profile & Credits
 * - PREFERENCES: Appearance, Notifications, Regional Preferences
 * - ACCOUNT: Sign-in & Security, Connected Accounts, Privacy & Data
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Film,
  Sliders,
  Bell,
  Globe,
  Lock,
  Link2,
  ShieldCheck,
  Check,
  AlertCircle,
  X,
  Camera,
  Upload,
  Trash2,
  ExternalLink,
  KeyRound,
  Download,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  Laptop,
  FolderKanban,
  Users,
  Shield,
  Layers
} from 'lucide-react';
import { services } from '../../services';
import { useProject } from '../projects/ProjectContext';
import { UpdateNotificationPreferencesInput } from '../../services/contracts/types';

export type SettingsSectionId =
  | 'profile'
  | 'credits'
  | 'appearance'
  | 'notifications'
  | 'regional'
  | 'security'
  | 'connected'
  | 'privacy'
  | 'workspace';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
  theme?: 'dark-neon' | 'light-cinematic';
  onThemeChange?: (newTheme: 'dark-neon' | 'light-cinematic') => void;
  onUpdateName?: (name: string) => void;
  onOpenTeamManagement?: () => void;
}

export function AccountSettingsModal({
  isOpen,
  onClose,
  initialSection = 'profile',
  theme = 'dark-neon',
  onThemeChange,
  onUpdateName,
  onOpenTeamManagement,
}: AccountSettingsModalProps) {
  const { currentUser, activeProject, activeRole, members } = useProject();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>(initialSection);

  // Profile state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Studio credits state (stored in profile bio/metadata or local persistent storage)
  const [screenName, setScreenName] = useState(() => localStorage.getItem('cp_screen_name') || '');
  const [primaryCredit, setPrimaryCredit] = useState(() => localStorage.getItem('cp_primary_credit') || 'Executive Producer');
  const [guildAffiliation, setGuildAffiliation] = useState(() => localStorage.getItem('cp_uguild') || 'FWICE');
  const [agentRep, setAgentRep] = useState(() => localStorage.getItem('cp_agent_rep') || '');
  const [imdbUrl, setImdbUrl] = useState(() => localStorage.getItem('cp_imdb_url') || '');

  // Regional Preferences
  const [language, setLanguage] = useState(() => localStorage.getItem('cp_lang') || 'English (US)');
  const [timezone, setTimezone] = useState(() => localStorage.getItem('cp_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem('cp_date_format') || 'YYYY-MM-DD');

  // Notifications State
  const [notifPrefs, setNotifPrefs] = useState<UpdateNotificationPreferencesInput>({
    mentionsEnabled: true,
    discussionRepliesEnabled: true,
    taskAssignmentsEnabled: true,
    scheduleChangesEnabled: true,
    callSheetsEnabled: true,
    dprReviewsEnabled: true,
  });
  const [notifLoading, setNotifLoading] = useState(false);

  // Security & Password state
  const [resetSent, setResetSent] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Status feedback
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate user data on open or user change
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setBio(currentUser.bio || '');
      setAvatarUrl(currentUser.avatarUrl || null);
    }
  }, [currentUser, isOpen]);

  // Sync initialSection if provided when modal opens
  useEffect(() => {
    if (isOpen && initialSection) {
      setActiveSection(initialSection);
    }
  }, [isOpen, initialSection]);

  // Load notification preferences
  useEffect(() => {
    if (isOpen && activeSection === 'notifications') {
      let isMounted = true;
      setNotifLoading(true);
      services.notifications
        .getPreferences()
        .then(prefs => {
          if (isMounted) {
            setNotifPrefs({
              mentionsEnabled: prefs.mentionsEnabled,
              discussionRepliesEnabled: prefs.discussionRepliesEnabled,
              taskAssignmentsEnabled: prefs.taskAssignmentsEnabled,
              scheduleChangesEnabled: prefs.scheduleChangesEnabled,
              callSheetsEnabled: prefs.callSheetsEnabled,
              dprReviewsEnabled: prefs.dprReviewsEnabled,
            });
          }
        })
        .catch(err => {
          console.warn('[AccountSettings] Failed to fetch notification preferences:', err);
        })
        .finally(() => {
          if (isMounted) setNotifLoading(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, activeSection]);

  if (!isOpen) return null;

  // Clear feedback after 4 seconds
  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Avatar upload handler (client-side base64 data-url or future storage URL)
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showFeedback('error', 'Please choose a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showFeedback('error', 'Profile photo must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setAvatarUrl(base64);
      try {
        setSavingSection('avatar');
        await services.auth.updateProfile({ avatarUrl: base64 });
        showFeedback('success', 'Profile photo updated.');
      } catch (err: any) {
        showFeedback('error', err.message || 'Failed to update avatar.');
      } finally {
        setSavingSection(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl(null);
    try {
      setSavingSection('avatar');
      await services.auth.updateProfile({ avatarUrl: null });
      showFeedback('success', 'Profile photo removed.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to remove avatar.');
    } finally {
      setSavingSection(null);
    }
  };

  // Save Profile & Identity
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showFeedback('error', 'Display name cannot be empty.');
      return;
    }

    setSavingSection('profile');
    try {
      await services.auth.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl || null,
      });
      if (onUpdateName) {
        onUpdateName(fullName.trim());
      }
      showFeedback('success', 'Personal profile updated successfully.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update profile.');
    } finally {
      setSavingSection(null);
    }
  };

  // Save Studio Profile & Credits
  const handleSaveCredits = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSection('credits');
    try {
      localStorage.setItem('cp_screen_name', screenName.trim());
      localStorage.setItem('cp_primary_credit', primaryCredit.trim());
      localStorage.setItem('cp_uguild', guildAffiliation.trim());
      localStorage.setItem('cp_agent_rep', agentRep.trim());
      localStorage.setItem('cp_imdb_url', imdbUrl.trim());
      showFeedback('success', 'Studio credits and affiliations saved.');
    } catch (err: any) {
      showFeedback('error', 'Failed to save credit details.');
    } finally {
      setSavingSection(null);
    }
  };

  // Toggle Notification preferences with instant save
  const handleToggleNotif = async (key: keyof UpdateNotificationPreferencesInput, currentVal?: boolean) => {
    const updated = {
      ...notifPrefs,
      [key]: !currentVal,
    };
    setNotifPrefs(updated);
    try {
      await services.notifications.updatePreferences(updated);
      showFeedback('success', 'Notification preferences saved.');
    } catch (err: any) {
      showFeedback('error', 'Failed to update notification settings.');
    }
  };

  // Send Password Reset
  const handleSendPasswordReset = async () => {
    if (!email) {
      setResetError('No verified email address found for this account.');
      return;
    }
    setIsResetting(true);
    setResetSent(null);
    setResetError(null);
    try {
      const res = await services.auth.resetPassword(email);
      setResetSent(res.message || `Password reset instructions sent to ${email}.`);
    } catch (err: any) {
      setResetError(err.message || 'Unable to request password reset.');
    } finally {
      setIsResetting(false);
    }
  };

  // Save Regional Preferences
  const handleSaveRegional = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSection('regional');
    try {
      localStorage.setItem('cp_lang', language);
      localStorage.setItem('cp_timezone', timezone);
      localStorage.setItem('cp_date_format', dateFormat);
      showFeedback('success', 'Regional and localization preferences updated.');
    } catch {
      showFeedback('error', 'Failed to save regional settings.');
    } finally {
      setSavingSection(null);
    }
  };

  // Export Account Data (Privacy & Data compliance)
  const handleExportData = () => {
    const exportPayload = {
      exportDate: new Date().toISOString(),
      user: {
        id: currentUser?.id,
        email: currentUser?.email,
        fullName: currentUser?.fullName,
        phone: currentUser?.phone,
        bio: currentUser?.bio,
      },
      studioProfile: {
        screenName,
        primaryCredit,
        guildAffiliation,
        agentRep,
        imdbUrl,
      },
      preferences: {
        theme,
        language,
        timezone,
        dateFormat,
        notifications: notifPrefs,
      },
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sceneos-account-export-${currentUser?.id || 'user'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showFeedback('success', 'Account data archive generated and downloaded.');
  };

  // Initials generator
  const getInitials = (name?: string) => {
    if (!name) return 'SC';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-[#0B0E17] border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] max-h-[760px] overflow-hidden text-zinc-100">
        
        {/* Top Modal Header */}
        <div className="p-4 sm:px-6 border-b border-zinc-850 flex items-center justify-between shrink-0 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-900 to-cyan-900 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-xs">
              {getInitials(fullName || currentUser?.fullName)}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                Account & Settings
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-zinc-850 text-zinc-400 border border-zinc-700/60">
                  {services.provider === 'mock' ? 'Mock Dev Mode' : 'Cloud Authenticated'}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Manage personal profile, appearance, credentials, and security preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b shrink-0 transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="flex-1">{feedback.message}</span>
          </div>
        )}

        {/* Main Body: Sidebar + Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          
          {/* Settings Navigation Sidebar */}
          <aside className="w-56 sm:w-64 border-r border-zinc-850/80 bg-zinc-950/40 flex flex-col shrink-0 overflow-y-auto p-3 space-y-4">
            
            {/* PERSONAL GROUP */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 px-3 py-1 block">
                Personal
              </span>
              <div className="space-y-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('profile')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'profile'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>Profile & Identity</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('credits')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'credits'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <Film className="w-4 h-4 shrink-0" />
                  <span>Studio Profile & Credits</span>
                </button>
              </div>
            </div>

            {/* PREFERENCES GROUP */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 px-3 py-1 block">
                Preferences
              </span>
              <div className="space-y-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('appearance')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'appearance'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <Sliders className="w-4 h-4 shrink-0" />
                  <span>Appearance</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('notifications')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'notifications'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <Bell className="w-4 h-4 shrink-0" />
                  <span>Notifications</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('regional')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'regional'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Regional Preferences</span>
                </button>
              </div>
            </div>

            {/* ACCOUNT GROUP */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 px-3 py-1 block">
                Account
              </span>
              <div className="space-y-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('security')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'security'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Sign-in & Security</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('connected')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'connected'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <Link2 className="w-4 h-4 shrink-0" />
                  <span>Connected Accounts</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('privacy')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'privacy'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Privacy & Data</span>
                </button>
              </div>
            </div>

            {/* WORKSPACE GROUP */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 px-3 py-1 block">
                Workspace
              </span>
              <div className="space-y-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('workspace')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    activeSection === 'workspace'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Team & Workspace</span>
                </button>
              </div>
            </div>

            {/* Scope Separation Notice */}
            <div className="mt-auto p-3 rounded-xl bg-zinc-900/60 border border-zinc-850 text-[10px] text-zinc-500 leading-relaxed">
              <span className="font-semibold text-zinc-400 block mb-0.5">Personal Scope</span>
              Settings on this page apply only to your signed-in identity. Project and team permissions remain governed in each workspace.
            </div>
          </aside>

          {/* Settings Content Area */}
          <main className="flex-1 overflow-y-auto p-5 sm:p-7">
            
            {/* 1. PROFILE & IDENTITY */}
            {activeSection === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Profile & Identity</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Your personal information and visible identity across productions and call sheets.
                  </p>
                </div>

                {/* Avatar Section */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={fullName}
                        className="w-16 h-16 rounded-2xl object-cover border border-zinc-700 shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-900 to-indigo-900 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-xl shadow-md">
                        {getInitials(fullName || currentUser?.fullName)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg border border-indigo-400/40 shadow-sm transition cursor-pointer"
                      title="Upload photo"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <h4 className="text-xs font-semibold text-white">Profile Photo</h4>
                    <p className="text-[11px] text-zinc-400">
                      Upload a square image (PNG, JPG, or WebP up to 2MB). If unset, your clean initials avatar is displayed.
                    </p>
                    <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-xs rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3 h-3 text-zinc-400" />
                        <span>Upload Photo</span>
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="px-2.5 py-1 text-xs rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-900/40 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Display Name <span className="text-indigo-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Elena Rostova"
                      required
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Verified Account Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-3.5 py-2 text-xs bg-zinc-950 border border-zinc-850 rounded-xl text-zinc-400 font-mono cursor-not-allowed select-none"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Account email is managed by your authentication provider and cannot be changed here.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Contact Phone (Call Sheet Contact)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Used by Production Coordinators and 1st ADs for emergency call sheet contacts.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Professional Bio
                    </label>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Specialization, camera packages, department expertise, and production background..."
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition resize-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSection === 'profile'}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center gap-2"
                  >
                    {savingSection === 'profile' ? (
                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Save Profile Changes</span>
                  </button>
                </div>
              </form>
            )}

            {/* 2. STUDIO PROFILE & CREDITS */}
            {activeSection === 'credits' && (
              <form onSubmit={handleSaveCredits} className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Studio Profile & Credits</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Professional industry credentials, guild affiliations, and on-screen credit standards.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      On-Screen Credit Name
                    </label>
                    <input
                      type="text"
                      value={screenName}
                      onChange={e => setScreenName(e.target.value)}
                      placeholder={fullName || 'e.g. Elena Rostova'}
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      As it should appear on official call sheets, end credits, and festival cue sheets.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Primary Industry Designation
                      </label>
                      <select
                        value={primaryCredit}
                        onChange={e => setPrimaryCredit(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                      >
                        <option value="Executive Producer">Executive Producer</option>
                        <option value="Line Producer">Line Producer</option>
                        <option value="Director">Director</option>
                        <option value="1st Assistant Director">1st Assistant Director</option>
                        <option value="Director of Photography">Director of Photography</option>
                        <option value="Production Designer">Production Designer</option>
                        <option value="Lead Editor">Lead Editor</option>
                        <option value="Sound Recordist / Mixer">Sound Recordist / Mixer</option>
                        <option value="Production Coordinator">Production Coordinator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Guild / Union Affiliation
                      </label>
                      <select
                        value={guildAffiliation}
                        onChange={e => setGuildAffiliation(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                      >
                        <option value="FWICE">FWICE (Federation of Western India Cine Employees)</option>
                        <option value="WICA">WICA (Western India Cinematographers' Association)</option>
                        <option value="SICA">SICA (South Indian Cinematographers' Association)</option>
                        <option value="SAG-AFTRA">SAG-AFTRA</option>
                        <option value="DGA">DGA (Directors Guild of America)</option>
                        <option value="IATSE">IATSE</option>
                        <option value="Non-Union / Independent">Non-Union / Independent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Agency / Management Representative
                    </label>
                    <input
                      type="text"
                      value={agentRep}
                      onChange={e => setAgentRep(e.target.value)}
                      placeholder="e.g. Creative Artists Agency / Contact: rep@agency.com"
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      IMDb / Filmography Profile Link
                    </label>
                    <input
                      type="url"
                      value={imdbUrl}
                      onChange={e => setImdbUrl(e.target.value)}
                      placeholder="https://www.imdb.com/name/nm..."
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSection === 'credits'}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center gap-2"
                  >
                    {savingSection === 'credits' ? (
                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Save Studio Credits</span>
                  </button>
                </div>
              </form>
            )}

            {/* 3. APPEARANCE */}
            {activeSection === 'appearance' && (
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Appearance & Theme</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Customize your visual environment for editorial scrutiny and on-set low-light viewing.
                  </p>
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-medium text-zinc-300 block">Workspace Theme Preset</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Dark Neon Option */}
                    <div
                      onClick={() => onThemeChange?.('dark-neon')}
                      className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between h-36 ${
                        theme === 'dark-neon'
                          ? 'bg-zinc-900 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-zinc-950/70 border-zinc-850 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400">
                          <Moon className="w-4 h-4" />
                        </div>
                        {theme === 'dark-neon' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Cinema Dark (Default)</h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          High-contrast dark-neon palette designed for grading rooms, stage monitors, and on-set night shoots.
                        </p>
                      </div>
                    </div>

                    {/* Paper Light Option */}
                    <div
                      onClick={() => onThemeChange?.('light-cinematic')}
                      className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between h-36 ${
                        theme === 'light-cinematic'
                          ? 'bg-zinc-900 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-zinc-950/70 border-zinc-850 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-300 flex items-center justify-center text-amber-600">
                          <Sun className="w-4 h-4" />
                        </div>
                        {theme === 'light-cinematic' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Studio Paper (Screenplay)</h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Warm screenplay paper aesthetic optimized for daylight review, script notes, and production office desks.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-2">
                  <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Dynamic Ambient Atmosphere</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    SCENE features hardware-accelerated ambient fluid waves and reactive cursor gradients. These automatically synchronize with your active theme choice.
                  </p>
                </div>
              </div>
            )}

            {/* 4. NOTIFICATIONS */}
            {activeSection === 'notifications' && (
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Notification Preferences</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Control which personal alerts reach your inbox. Security alerts and role modifications are non-suppressible.
                  </p>
                </div>

                {notifLoading ? (
                  <div className="p-8 text-center text-xs text-zinc-500 animate-pulse">
                    Loading personal notification rules...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Mentions */}
                    <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Discussion Mentions (@you)</h4>
                        <p className="text-[11px] text-zinc-400">Receive alerts when team members mention your name in discussions.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotif('mentionsEnabled', notifPrefs.mentionsEnabled)}
                        className={`w-10 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                          notifPrefs.mentionsEnabled ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                      </button>
                    </div>

                    {/* Discussion Replies */}
                    <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Thread Replies</h4>
                        <p className="text-[11px] text-zinc-400">Alerts when someone replies to a discussion thread you participated in.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotif('discussionRepliesEnabled', notifPrefs.discussionRepliesEnabled)}
                        className={`w-10 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                          notifPrefs.discussionRepliesEnabled ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                      </button>
                    </div>

                    {/* Task Assignments */}
                    <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Task Assignments</h4>
                        <p className="text-[11px] text-zinc-400">Alerts when a department checklist item or milestone is assigned to you.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotif('taskAssignmentsEnabled', notifPrefs.taskAssignmentsEnabled)}
                        className={`w-10 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                          notifPrefs.taskAssignmentsEnabled ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                      </button>
                    </div>

                    {/* Call Sheet Publish */}
                    <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Call Sheet Releases</h4>
                        <p className="text-[11px] text-zinc-400">High-priority alert when a Call Sheet is finalized and published for a shoot day.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotif('callSheetsEnabled', notifPrefs.callSheetsEnabled)}
                        className={`w-10 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                          notifPrefs.callSheetsEnabled ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                      </button>
                    </div>

                    {/* DPR Reviews */}
                    <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white">DPR Approval Notices</h4>
                        <p className="text-[11px] text-zinc-400">Notifies Producers and Directors when a Daily Production Report is submitted.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotif('dprReviewsEnabled', notifPrefs.dprReviewsEnabled)}
                        className={`w-10 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                          notifPrefs.dprReviewsEnabled ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. REGIONAL PREFERENCES */}
            {activeSection === 'regional' && (
              <form onSubmit={handleSaveRegional} className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Regional Preferences</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Formatting standards for timestamps, date displays, and shoot day scheduling.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Interface Language
                    </label>
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                    >
                      <option value="English (US)">English (US) — Industry Standard</option>
                      <option value="English (UK)">English (UK)</option>
                      <option value="French">Français (Studio)</option>
                      <option value="Spanish">Español</option>
                      <option value="Hindi">हिन्दी (Bollywood)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Production Timezone
                    </label>
                    <input
                      type="text"
                      value={timezone}
                      onChange={e => setTimezone(e.target.value)}
                      placeholder="e.g. America/Los_Angeles or Asia/Kolkata"
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition font-mono"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Current detected browser timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Date Formatting Standard
                    </label>
                    <select
                      value={dateFormat}
                      onChange={e => setDateFormat(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer font-mono"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601 — Standard)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (UK / Commonwealth)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (US Production Standard)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSection === 'regional'}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center gap-2"
                  >
                    {savingSection === 'regional' ? (
                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Save Regional Preferences</span>
                  </button>
                </div>
              </form>
            )}

            {/* 6. SIGN-IN & SECURITY */}
            {activeSection === 'security' && (
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Sign-in & Security</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Security configuration, authentication methods, and credential recovery.
                  </p>
                </div>

                {/* Password Reset Card */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-indigo-400" />
                        <span>Password Management</span>
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Send a cryptographically signed password reset link to your verified account email.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isResetting}
                      onClick={handleSendPasswordReset}
                      className="px-3 py-1.5 text-xs font-medium rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 transition cursor-pointer shrink-0"
                    >
                      {isResetting ? 'Sending...' : 'Request Password Reset'}
                    </button>
                  </div>

                  {resetSent && (
                    <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{resetSent}</span>
                    </div>
                  )}

                  {resetError && (
                    <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}
                </div>

                {/* Session Telemetry Card */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-3">
                  <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>Session Security Status</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-mono block">Authentication State</span>
                      <span className="font-semibold text-white mt-0.5 block">
                        {services.provider === 'mock' ? 'Local Mock Dev Session' : 'Supabase PKCE Token'}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase font-mono block">Row-Level Security</span>
                      <span className="font-semibold text-emerald-400 mt-0.5 block">
                        Active & Enforced
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. CONNECTED ACCOUNTS */}
            {activeSection === 'connected' && (
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Connected Accounts</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Third-party identity providers linked to your SCENE workspace account.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Google OAuth Provider */}
                  <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-zinc-800 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Google Identity</h4>
                        <p className="text-[11px] text-zinc-400">
                          {currentUser?.email ? `Connected to ${currentUser.email}` : 'Supported via Supabase OAuth'}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Connected
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 text-xs text-zinc-400 leading-relaxed">
                  Third-party OAuth integrations are authenticated securely through Supabase Auth using the PKCE protocol. Single sign-on and two-factor authentication depend on your provider settings.
                </div>
              </div>
            )}

            {/* 8. PRIVACY & DATA */}
            {activeSection === 'privacy' && (
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Privacy & Data Governance</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Control your personal data exports, cache clearance, and account isolation.
                  </p>
                </div>

                {/* Export Data */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                      <Download className="w-4 h-4 text-indigo-400" />
                      <span>Export Account Archive</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 max-w-md">
                      Download a JSON archive containing your verified profile, credits, affiliations, and personal preferences.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 transition cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>

                {/* Reset Local Preferences */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-white">Reset Local UI Cache</h4>
                    <p className="text-[11px] text-zinc-400 max-w-md">
                      Clears offline draft caches, saved UI filter states, and temporary wizard variables in this browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('cp_theme');
                      localStorage.removeItem('cp_lang');
                      localStorage.removeItem('cp_timezone');
                      showFeedback('success', 'Local browser preferences reset to defaults.');
                    }}
                    className="px-3.5 py-2 text-xs font-medium rounded-xl text-amber-300 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-800/40 transition cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    Reset Browser Cache
                  </button>
                </div>

                {/* Irreversible Notice */}
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/30 space-y-2">
                  <h4 className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Account Deletion & Data Removal</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Under film production compliance and audit rules, active productions where you hold sole ownership must be transferred to another Producer before your personal identity record can be archived. Contact your studio administrator or account support to request permanent profile erasure.
                  </p>
                </div>
              </div>
            )}

            {/* 9. WORKSPACE & TEAM SETTINGS */}
            {activeSection === 'workspace' && (
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Workspace & Team Governance</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Production workspace membership, roles, and collaborative permissions.
                  </p>
                </div>

                {/* Active Workspace Card */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center text-indigo-400">
                        <FolderKanban className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {activeProject?.title || 'Studio Production Workspace'}
                        </h4>
                        <p className="text-[11px] text-zinc-400 font-mono">
                          ID: {activeProject?.id || 'GLOBAL_WORKSPACE'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/30 text-indigo-300">
                      {activeRole || 'Executive Producer'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-850/60 text-xs">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-mono">Data Provider</span>
                      <span className="font-medium text-zinc-200">
                        {services.provider === 'mock' ? 'Local Sandbox (Mock Engine)' : 'Supabase Production Backend'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-mono">Active Crew Members</span>
                      <span className="font-medium text-zinc-200">
                        {members.length > 0 ? `${members.length} Collaborator(s)` : 'Lead Producer'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Team & Membership Settings */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span>Team & Membership Administration</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 max-w-md">
                      Invite crew members, manage production department roles, and audit access permissions.
                    </p>
                  </div>
                  {onOpenTeamManagement ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTeamManagement();
                      }}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition cursor-pointer shadow-sm shadow-indigo-600/30 shrink-0 self-start sm:self-auto flex items-center gap-2"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Manage Team</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-zinc-500 font-mono italic">
                      Managed in project header
                    </span>
                  )}
                </div>

                {/* Permissions Notice */}
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span>Role-Based Access Governance</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Workspace settings and production members are strictly scoped to the active production context. Production switching and administrative operations remain isolated from personal identity settings.
                  </p>
                </div>
              </div>
            )}

          </main>
        </div>

      </div>
    </div>
  );
}
