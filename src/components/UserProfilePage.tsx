/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Briefcase, 
  FileText, 
  Award, 
  Sliders, 
  Save, 
  ArrowLeft, 
  Film, 
  Sparkles, 
  Clock, 
  Settings, 
  ShieldAlert, 
  Camera, 
  Scissors, 
  Volume2, 
  Tv, 
  UserCheck 
} from 'lucide-react';
import { FilmProject } from '../types';

interface UserProfilePageProps {
  userName: string;
  userRole: string;
  userEmail?: string;
  userBio?: string;
  isDark?: boolean;
  activeProject: FilmProject | null;
  projects: FilmProject[];
  onUpdateProfile: (name: string, role: string, email: string, bio: string, avatar: string, department: string) => void;
  onBack: () => void;
}

const AVATARS = [
  { id: 'director', label: 'Director', icon: Film, color: 'text-indigo-400 border-indigo-500/30 bg-indigo-950/25' },
  { id: 'producer', label: 'Producer', icon: UserCheck, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/25' },
  { id: 'camera', label: 'Cinematographer', icon: Camera, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/25' },
  { id: 'editor', label: 'Lead Editor', icon: Scissors, color: 'text-rose-400 border-rose-500/30 bg-rose-950/25' },
  { id: 'sound', label: 'Audio Engineer', icon: Volume2, color: 'text-amber-400 border-amber-500/30 bg-amber-950/25' },
  { id: 'actor', label: 'Lead Talent', icon: Tv, color: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-950/25' }
];

export default function UserProfilePage({
  userName,
  userRole,
  userEmail = 'mdsuhaib2004@gmail.com',
  userBio = 'Lead Creative Supervisor specializing in cinematic scheduling optimization, multi-phase project pipelines, and structural constraint verification.',
  isDark = true,
  activeProject,
  projects,
  onUpdateProfile,
  onBack
}: UserProfilePageProps) {
  const [editedName, setEditedName] = React.useState(userName || 'GUEST');
  const [editedEmail, setEditedEmail] = React.useState(() => localStorage.getItem('cp_uemail') || userEmail);
  const [editedBio, setEditedBio] = React.useState(() => localStorage.getItem('cp_ubio') || userBio);
  const [editedRole, setEditedRole] = React.useState(userRole || 'Executive Producer');
  const [editedDept, setEditedDept] = React.useState(() => localStorage.getItem('cp_udept') || 'Creative Development');
  const [activeAvatar, setActiveAvatar] = React.useState(() => localStorage.getItem('cp_uavatar') || 'director');
  const [customAvatarData, setCustomAvatarData] = React.useState(() => localStorage.getItem('cp_custom_avatar') || '');

  const [experienceLevel, setExperienceLevel] = React.useState(() => localStorage.getItem('cp_uexp') || 'Senior Supervisor');
  const [guildAffiliation, setGuildAffiliation] = React.useState(() => localStorage.getItem('cp_uguild') || 'FWICE');
  const [notificationToggle, setNotificationToggle] = React.useState(() => localStorage.getItem('cp_unotif') !== 'false');
  const [realtimeAuditToggle, setRealtimeAuditToggle] = React.useState(() => localStorage.getItem('cp_urealtime_audit') !== 'false');

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Compute stats
  const ownedProjectsCount = projects.filter(p => p.owner === userName).length;
  const totalPhasesCompleted = projects.reduce((sum, p) => 
    sum + p.phases.filter(ph => ph.status === 'completed').length, 0
  );
  
  const totalTasksCount = activeProject 
    ? activeProject.phases.reduce((sum, ph) => sum + ph.activities.length, 0)
    : 0;
  const completedTasksCount = activeProject
    ? activeProject.phases.reduce((sum, ph) => sum + ph.activities.filter(a => a.completed).length, 0)
    : 0;
  const taskCompletionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save locally
    localStorage.setItem('cp_uname', editedName);
    localStorage.setItem('cp_urole', editedRole);
    localStorage.setItem('cp_uemail', editedEmail);
    localStorage.setItem('cp_ubio', editedBio);
    localStorage.setItem('cp_udept', editedDept);
    localStorage.setItem('cp_uavatar', activeAvatar);
    localStorage.setItem('cp_uexp', experienceLevel);
    localStorage.setItem('cp_uguild', guildAffiliation);
    localStorage.setItem('cp_unotif', String(notificationToggle));
    localStorage.setItem('cp_urealtime_audit', String(realtimeAuditToggle));

    // Propagate up
    onUpdateProfile(editedName, editedRole, editedEmail, editedBio, activeAvatar, editedDept);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const selectedAvatarObj = AVATARS.find(a => a.id === activeAvatar) || AVATARS[0];
  const AvatarIconComponent = selectedAvatarObj.icon;

  return (
    <div className={`space-y-6 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`} id="user-profile-screen-container">
      {/* Back Header navigation */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-900/60">
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-2 text-xs font-mono font-bold tracking-tight py-1.5 px-3 rounded-lg border transition duration-200 cursor-pointer ${
            isDark 
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800' 
              : 'bg-zinc-50 border-zinc-250 text-indigo-750 hover:bg-zinc-100'
          }`}
          id="profile-back-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </button>
        <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-extrabold block">
          Studio User Command Station
        </span>
      </div>

      {/* Profile Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Summary Stats, Avatar Viewer */}
        <div className={`lg:col-span-4 p-5 rounded-2xl border space-y-5 relative overflow-hidden ${
          isDark ? 'bg-zinc-950/70 border-indigo-500/10' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          {/* Subtle glow effect */}
          {isDark && (
            <div className="absolute -top-16 -left-16 w-36 h-36 bg-indigo-550/10 rounded-full blur-2xl pointer-events-none" />
          )}

          {/* Avatar display frame */}
          <div className="flex flex-col items-center text-center space-y-3 pt-3 relative z-10">
            <div className={`w-24 h-24 rounded-full border flex items-center justify-center relative p-1 shadow-lg overflow-hidden ${
              activeAvatar === 'custom' && customAvatarData ? 'border-cyan-500 bg-cyan-950/20' : selectedAvatarObj.color
            }`}>
              {activeAvatar === 'custom' && customAvatarData ? (
                <img src={customAvatarData} alt="Custom Profile" className="w-full h-full object-cover rounded-full referrer-policy" referrerPolicy="no-referrer" />
              ) : (
                <AvatarIconComponent className="w-12 h-12" />
              )}
              {/* Overlay edit badge */}
              <div className="absolute bottom-0 right-0 p-1 bg-cyan-500 rounded-full border border-black/80 text-zinc-955 animate-pulse" title="Custom Avatar Selected">
                <Sparkles className="w-3 h-3" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-sans font-black tracking-tight">{editedName}</h3>
              <p className="text-xs text-indigo-400 font-mono font-semibold uppercase">{editedRole}</p>
              <p className="text-[10px] text-zinc-550 font-mono mt-0.5">{editedEmail}</p>
            </div>
          </div>

          <hr className={isDark ? 'border-zinc-900' : 'border-zinc-150'} />

          {/* User Bio readout */}
          <div className="space-y-1.5 text-xs">
            <span className="text-[9px] font-mono text-zinc-500 uppercase block font-bold">Creative Bio Overview</span>
            <p className={`italic leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              "{editedBio}"
            </p>
          </div>

          <hr className={isDark ? 'border-zinc-900' : 'border-zinc-150'} />

          {/* Activity Statistics stats summary */}
          <div className="space-y-3">
            <span className="text-[9px] font-mono text-zinc-500 uppercase block font-bold">Production Analytics</span>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/40 border-zinc-850/50' : 'bg-slate-50 border-zinc-200'}`}>
                <span className="text-zinc-450 text-[9px] block uppercase font-mono">My Projects</span>
                <span className="text-lg font-bold font-mono text-white block mt-1">{ownedProjectsCount}</span>
              </div>
              
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/40 border-zinc-850/50' : 'bg-slate-50 border-zinc-200'}`}>
                <span className="text-zinc-450 text-[9px] block uppercase font-mono">Completed Phases</span>
                <span className="text-lg font-bold font-mono text-white block mt-1">{totalPhasesCompleted}</span>
              </div>
            </div>

            {activeProject && (
              <div className={`p-3.5 rounded-xl border space-y-2 ${isDark ? 'bg-zinc-900/40 border-zinc-850/50' : 'bg-slate-50 border-zinc-200'}`}>
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-zinc-400 uppercase">Active Project Completion Rate</span>
                  <span className="text-indigo-400 font-bold">{taskCompletionRate}%</span>
                </div>
                
                {/* Visual mini-bar progress */}
                <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-900">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${taskCompletionRate}%` }}
                  />
                </div>
                <span className="text-[8.5px] font-mono text-zinc-500 block leading-tight">
                  {completedTasksCount} of {totalTasksCount} tasks validated on {activeProject.title} scheduler.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Form Container: Profile inputs, avatar grid selector, toggles */}
        <div className="lg:col-span-8 space-y-6">
          
          <form onSubmit={handleSave} className={`p-5 rounded-2xl border space-y-6 ${
            isDark ? 'bg-zinc-950/70 border-indigo-500/10' : 'bg-white border-zinc-200 shadow-sm'
          }`}>
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div>
                <h4 className="text-sm font-sans font-black tracking-tight flex items-center gap-1.5 uppercase">
                  <Settings className="w-4 h-4 text-indigo-400" />
                  Edit User & Department Profile
                </h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">Custom identity properties saved securely in your local environment.</p>
              </div>
              
              {savedSuccess && (
                <span className="text-[10px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg uppercase animate-pulse">
                  Changes Locked ✓
                </span>
              )}
            </div>

            {/* Form Fields: Name, Email, Role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="block font-mono text-[9px] text-zinc-505 uppercase font-bold">Full Display Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-zinc-200 focus:outline-none focus:border-indigo-550 font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-[9px] text-zinc-505 uppercase font-bold">Primary Notification Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    required
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-zinc-205 focus:outline-none focus:border-indigo-550 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-[9px] text-zinc-505 uppercase font-bold">Studio Role Simulation Profile</label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  <select
                    value={editedRole}
                    onChange={(e) => setEditedRole(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-zinc-200 focus:outline-none focus:border-indigo-550 font-sans cursor-pointer"
                  >
                    <option value="Executive Producer">Executive Producer</option>
                    <option value="Line Producer">Line Producer</option>
                    <option value="Director">Director</option>
                    <option value="VFX Lead Coordinator">VFX Lead Coordinator</option>
                    <option value="Post-Production Supervisor">Post-Production Supervisor</option>
                    <option value="Assistant Director (1st AD)">Assistant Director (1st AD)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-[9px] text-zinc-505 uppercase font-bold">Primary Crew Department</label>
                <div className="relative">
                  <Award className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  <select
                    value={editedDept}
                    onChange={(e) => setEditedDept(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-zinc-200 focus:outline-none focus:border-indigo-550 font-sans cursor-pointer"
                  >
                    <option value="Creative Development">Creative Development</option>
                    <option value="Production Management">Production Management</option>
                    <option value="Camera & Lighting">Camera & Lighting</option>
                    <option value="Art Department">Art Department</option>
                    <option value="VFX & Post-Production">VFX & Post-Production</option>
                    <option value="Sound Department">Sound Department</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-[9px] text-zinc-505 uppercase font-bold">Administrative Grade / Exp</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-550 font-sans cursor-pointer"
                >
                  <option value="Junior Coordinator">Junior Coordinator (1-2 yrs)</option>
                  <option value="Mid-Level Specialist">Mid-Level Specialist (3-5 yrs)</option>
                  <option value="Senior Supervisor">Senior Supervisor (6-10 yrs)</option>
                  <option value="Master Executive Advisor">Master Executive Advisor (10+ yrs)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-[9px] text-zinc-505 uppercase font-bold">Indian Filmmaking Association / Guild</label>
                <select
                  value={guildAffiliation}
                  onChange={(e) => setGuildAffiliation(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-550 font-sans cursor-pointer"
                >
                  <optgroup label="Bollywood & General India">
                    <option value="FWICE">FWICE (Federation of Western India Cine Employees)</option>
                    <option value="WICA">WICA (Western India Cinematographers' Association)</option>
                    <option value="IFDA">IFDA (Indian Film Directors' Association)</option>
                    <option value="IMPPA">IMPPA (Indian Motion Picture Producers' Association)</option>
                  </optgroup>
                  <optgroup label="Kollywood (Tamil Cinema)">
                    <option value="FEFSI">FEFSI (Film Employees Federation of South India)</option>
                    <option value="TFPC">TFPC (Tamil Film Producers Council)</option>
                    <option value="SIAA">SIAA / Nadigar Sangam (South Indian Artists Association)</option>
                  </optgroup>
                  <optgroup label="Tollywood (Telugu Cinema)">
                    <option value="TFIEF">TFIEF (Telugu Film Industry Employees Federation)</option>
                    <option value="TFCC">TFCC (Telugu Film Chamber of Commerce)</option>
                  </optgroup>
                  <optgroup label="Mollywood (Malayalam Cinema)">
                    <option value="FEFKA">FEFKA (Film Employees Federation of Kerala)</option>
                    <option value="AMMA">AMMA (Association of Malayalam Movie Artists)</option>
                  </optgroup>
                  <optgroup label="Sandalwood (Kannada Cinema)">
                    <option value="KFCC">KFCC (Kannada Film Chamber of Commerce)</option>
                    <option value="KFWF">KFWF (Karnataka Film Workers Federation)</option>
                  </optgroup>
                  <optgroup label="Other Regional / South India">
                    <option value="SICA">SICA (South Indian Cinematographers Association)</option>
                  </optgroup>
                  <optgroup label="No Affiliation">
                    <option value="none">Independent / Without any Guild or Federation</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Custom Avatar selection grid */}
            <div className="space-y-3">
              <span className="block font-mono text-[9px] text-zinc-505 uppercase font-bold">Select Active Profile Icon</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {AVATARS.map((av) => {
                  const Icon = av.icon;
                  const isSelected = activeAvatar === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setActiveAvatar(av.id)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer ${
                        isSelected 
                          ? 'border-cyan-400 bg-cyan-950/20 text-cyan-300 shadow-md ring-1 ring-cyan-400' 
                          : 'border-zinc-850 bg-zinc-900/30 text-zinc-400 hover:text-white hover:border-zinc-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[9px] font-mono leading-none tracking-tight">{av.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Upload Custom Profile Image */}
              <div className="p-4 bg-zinc-900/45 border border-zinc-850/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="block text-[10px] font-mono font-bold text-indigo-400 uppercase">Or Upload Custom Profile Photo</span>
                  <p className="text-[9px] text-zinc-400">Supports PNG, JPG, or JPEG. File will be cached in your local workspace.</p>
                </div>
                <div className="flex items-center gap-2">
                  {customAvatarData && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAvatar('custom');
                      }}
                      className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase cursor-pointer transition ${
                        activeAvatar === 'custom'
                          ? 'bg-cyan-500 text-zinc-950 border border-cyan-400'
                          : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-350 border border-zinc-700'
                      }`}
                    >
                      Use Custom Photo
                    </button>
                  )}
                  <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded text-[10px] font-mono font-bold uppercase cursor-pointer transition">
                    Choose Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          setCustomAvatarData(base64);
                          localStorage.setItem('cp_custom_avatar', base64);
                          setActiveAvatar('custom');
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Bio configuration */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-mono text-[9px] text-zinc-505 uppercase font-bold">Creative Bio & Department Goal Statement</label>
              <div className="relative">
                <FileText className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-zinc-200 focus:outline-none focus:border-indigo-550 font-sans resize-none"
                />
              </div>
            </div>

            {/* Preferences Section (Notif, auditing toggles) */}
            <div className="space-y-3.5 bg-zinc-900/20 p-4 border border-zinc-900 rounded-xl">
              <span className="block font-mono text-[9px] text-zinc-400 uppercase font-black">Simulation & System Settings</span>
              
              <div className="space-y-2.5 text-xs">
                {/* Checkbox A */}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={notificationToggle}
                    onChange={() => setNotificationToggle(!notificationToggle)}
                    className="mt-0.5 rounded bg-zinc-950 border-zinc-800 text-cyan-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="leading-tight">
                    <span className="font-semibold text-zinc-200 block">Enforce Union Rest period & Overtime Alerts</span>
                    <span className="text-[9px] text-zinc-505 block font-mono mt-0.5">
                      Triggers instant warning banners when phase duration changes violate labor crew contract parameters.
                    </span>
                  </div>
                </label>

                {/* Checkbox B */}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={realtimeAuditToggle}
                    onChange={() => setRealtimeAuditToggle(!realtimeAuditToggle)}
                    className="mt-0.5 rounded bg-zinc-950 border-zinc-800 text-cyan-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="leading-tight">
                    <span className="font-semibold text-zinc-200 block">Automatic Constraint Alignment Check</span>
                    <span className="text-[9px] text-zinc-505 block font-mono mt-0.5">
                      Recalculates resiliency metrics instantly on any project modifications to lock high-priority safety clearances.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              id="profile-save-submit-btn"
            >
              <Save className="w-4 h-4" />
              Lock Credentials & Commit Settings
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}
