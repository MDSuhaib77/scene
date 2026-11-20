/**
 * SceneOS — Canonical User Account & Session Floating Menu
 * 
 * Compact, floating account menu anchored to the user avatar/pill trigger.
 * Designed following SaaS conventions and the Blade Runner-inspired neo-noir aesthetic.
 * 
 * Hierarchy:
 * - Header Row: Avatar, Display Name, Plan/Status ('Free'), ChevronRight (navigates to Profile)
 * - Divider
 * - Options:
 *   1. Personalization (Theme, visual atmosphere)
 *   2. Profile (Identity, credits, avatar upload)
 *   3. Settings (Security, connected accounts, privacy, workspace)
 * - Divider
 * - Options:
 *   4. Help (with chevron >)
 *   5. Log out
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  UserCircle,
  LogOut, 
  Settings, 
  ChevronRight, 
  ChevronDown,
  Sparkles, 
  SlidersHorizontal,
  LifeBuoy,
  HelpCircle,
  Check
} from 'lucide-react';
import { useProject } from '../projects/ProjectContext';
import { services } from '../../services';

export interface AccountDropdownProps {
  userName: string;
  userRole?: string;
  userPlan?: string;
  isDark?: boolean;
  onOpenProfile: () => void;
  onOpenPersonalization: () => void;
  onOpenSettings: () => void;
  onOpenHelp?: () => void;
  onSignOut: () => void;
  onOpenProjectSwitcher?: () => void;
  onSwitchPersona?: (username: string, role: string) => void;
  placement?: 'bottom-end' | 'bottom-start' | 'top-start' | 'top-end';
}

const DEV_PERSONAS = [
  { username: 'kira.vance@sceneos.studio', name: 'Kira Vance', role: 'Director' },
  { username: 'elena.rostova@sceneos.studio', name: 'Elena Rostova', role: 'Line Producer' },
  { username: 'marcus.ad@sceneos.studio', name: 'Marcus Thorne', role: '1st Assistant Director' },
];

export function AccountDropdown({
  userName,
  userRole,
  userPlan = 'Free',
  isDark = true,
  onOpenProfile,
  onOpenPersonalization,
  onOpenSettings,
  onOpenHelp,
  onSignOut,
  onSwitchPersona,
  placement = 'bottom-end',
}: AccountDropdownProps) {
  const { currentUser } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showDevPersonas, setShowDevPersonas] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowConfirmLogout(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setShowConfirmLogout(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const displayName = currentUser?.fullName || userName || 'suhaib97';
  const displayPlan = userPlan || (userRole ? `${userRole}` : 'Free');

  // Compute clean initials for fallback avatar
  const getInitials = (name?: string) => {
    if (!name) return 'SU';
    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const initials = getInitials(displayName);

  // Positioning class based on placement
  const placementClasses = {
    'bottom-end': 'top-full mt-2 right-0',
    'bottom-start': 'top-full mt-2 left-0',
    'top-end': 'bottom-full mb-2 right-0',
    'top-start': 'bottom-full mb-2 left-0',
  }[placement] || 'top-full mt-2 right-0';

  return (
    <div className="relative font-sans inline-block" ref={dropdownRef}>
      {/* ===================================================================
          1. ACCOUNT TRIGGER CAPSULE
          Inspired by SaaS bottom/header user pill (Avatar + Name + Status)
         =================================================================== */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setShowConfirmLogout(false);
        }}
        className={`flex items-center gap-2.5 py-1.5 px-2.5 sm:px-3 rounded-2xl border transition-all cursor-pointer group select-none text-left ${
          isOpen
            ? 'bg-zinc-800/95 border-zinc-700 text-white shadow-lg shadow-black/40'
            : isDark
            ? 'bg-[#151821]/90 hover:bg-[#1c202c] border-zinc-800/90 hover:border-zinc-700 text-zinc-200'
            : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-800 shadow-sm'
        }`}
        id="canonical-account-menu-btn"
        aria-label="User Account Menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {/* Avatar Circle */}
        {currentUser?.avatarUrl ? (
          <img
            src={currentUser.avatarUrl}
            alt={displayName}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-zinc-700/80 shrink-0"
          />
        ) : (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-200 font-semibold text-xs shrink-0 select-none border border-zinc-600/50">
            {initials}
          </div>
        )}

        {/* User Identity Column */}
        <div className="min-w-0 pr-1 hidden xs:block sm:block">
          <div className="font-semibold text-xs text-white truncate max-w-[120px] leading-tight">
            {displayName}
          </div>
        </div>

        <ChevronDown 
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-white' : 'group-hover:text-zinc-200'
          }`} 
        />
      </button>

      {/* ===================================================================
          2. FLOATING ACCOUNT DROPDOWN MENU
          Pixel-crafted after the reference design:
          - Rounded, dark floating panel
          - Account header card with right chevron >
          - Personalization, Profile, Settings
          - Divider
          - Log out
         =================================================================== */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="canonical-account-menu-btn"
          className={`absolute ${placementClasses} w-64 sm:w-72 bg-[#1c1c1f] border border-zinc-800/90 rounded-2xl shadow-2xl shadow-black/80 p-1.5 z-50 animate-fade-in backdrop-blur-xl text-zinc-200 overflow-hidden`}
        >
          {/* Header Card (Avatar + Name + Role + ChevronRight) */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onOpenProfile();
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/80 transition text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={displayName}
                  className="w-9 h-9 rounded-full object-cover border border-zinc-700 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-200 font-semibold text-xs shrink-0 select-none border border-zinc-600/50">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white truncate leading-tight group-hover:text-cyan-300 transition-colors">
                  {displayName}
                </div>
                {userRole && (
                  <div className="text-[11px] text-zinc-400 font-normal truncate mt-0.5">
                    {userRole}
                  </div>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0 ml-2" />
          </button>

          {/* Divider */}
          <div className="h-px bg-zinc-800/90 my-1 mx-2" />

          {/* Primary Action Items */}
          <div className="space-y-0.5">
            {/* 1. Personalization */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenPersonalization();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition text-left cursor-pointer group"
            >
              <SlidersHorizontal className="w-4 h-4 text-zinc-400 group-hover:text-cyan-400 transition-colors shrink-0" />
              <span className="font-medium">Personalization</span>
            </button>

            {/* 2. Profile */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenProfile();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition text-left cursor-pointer group"
            >
              <UserCircle className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors shrink-0" />
              <span className="font-medium">Profile</span>
            </button>

            {/* 3. Settings */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition text-left cursor-pointer group"
            >
              <Settings className="w-4 h-4 text-zinc-400 group-hover:text-amber-400 transition-colors shrink-0" />
              <span className="font-medium">Settings</span>
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-zinc-800/90 my-1 mx-2" />

          {/* Secondary Action Items */}
          <div className="space-y-0.5">
            {/* Log Out / Confirmation */}
            {showConfirmLogout ? (
              <div className="p-2.5 my-1 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-2 animate-fade-in">
                <p className="text-xs text-zinc-300 font-medium">Log out of your account?</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmLogout(false)}
                    className="px-3 py-1 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setShowConfirmLogout(false);
                      onSignOut();
                    }}
                    className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-sm transition"
                  >
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => setShowConfirmLogout(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm text-zinc-300 hover:text-rose-300 hover:bg-rose-950/20 transition text-left cursor-pointer group"
              >
                <LogOut className="w-4 h-4 text-zinc-400 group-hover:text-rose-400 transition-colors shrink-0" />
                <span className="font-medium">Log out</span>
              </button>
            )}
          </div>

          {/* Dev Personas Switcher (discreetly available in mock mode for review/testing) */}
          {services.provider === 'mock' && onSwitchPersona && (
            <>
              <div className="h-px bg-zinc-800/90 my-1 mx-2" />
              <div className="px-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowDevPersonas(!showDevPersonas)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition text-left cursor-pointer rounded-lg"
                >
                  <span>Mock Dev Personas</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showDevPersonas ? 'rotate-180' : ''}`} />
                </button>
                {showDevPersonas && (
                  <div className="space-y-0.5 mt-1 pb-1">
                    {DEV_PERSONAS.map(p => (
                      <button
                        key={p.username}
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setShowDevPersonas(false);
                          onSwitchPersona(p.name, p.role);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition text-left cursor-pointer"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500 ml-2 shrink-0">{p.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
