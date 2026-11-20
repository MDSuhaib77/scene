import React, { useEffect, useState, useRef } from 'react';
import { 
  Terminal, 
  FileText, 
  Scissors, 
  Eye, 
  Calendar as CalendarIcon, 
  Users, 
  Box, 
  CheckSquare, 
  Clapperboard, 
  DollarSign, 
  Shield, 
  Gauge, 
  Database, 
  MessageSquare, 
  Settings,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Film,
  Sun,
  Moon,
  X,
  Pin,
  PinOff,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Calendar,
  Search
} from 'lucide-react';
import { FilmProject } from '../../types';
import { 
  SCENEOS_MODULE_HIERARCHY, 
  SidebarModule, 
  SidebarSubmodule,
  findModuleByTabId
} from './navigationHierarchy';

export interface WorkspaceNavItem {
  id: string;
  legacyId: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string | number;
  badgeColor?: string;
}

// Flat list for backward compatibility with baseline suites
export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    id: 'overview',
    legacyId: 'console',
    name: 'Overview',
    icon: Terminal,
    description: 'Production Overview & Master Timeline',
  },
  {
    id: 'screenplay',
    legacyId: 'screenplay',
    name: 'Screenplay',
    icon: FileText,
    description: 'Screenplay Master & Scene Extraction',
  },
  {
    id: 'phases',
    legacyId: 'plan',
    name: 'Roadmap',
    icon: Sparkles,
    description: 'Production Milestones & Roadmap',
    badge: 'Stage 4',
  },
  {
    id: 'calendar',
    legacyId: 'schedule',
    name: 'Calendar',
    icon: Calendar,
    description: 'Shooting Schedule & Calendar',
  },
  {
    id: 'master-calendar',
    legacyId: 'tasks',
    name: 'Tasks',
    icon: CheckSquare,
    description: 'Deliverables & Kanban Tasks',
  },
  {
    id: 'crew',
    legacyId: 'people',
    name: 'Crew',
    icon: Users,
    description: 'Crew Directory & Cast Contacts',
  },
  {
    id: 'constraints',
    legacyId: 'constraints',
    name: 'Constraints',
    icon: Shield,
    description: 'Guild Rules & Safety Turnarounds',
  },
  {
    id: 'telemetry',
    legacyId: 'intelligence',
    name: 'Analytics',
    icon: Gauge,
    description: 'Production Analytics & Velocity',
  },
  {
    id: 'assets',
    legacyId: 'vault',
    name: 'Vault',
    icon: Database,
    description: 'Raw Media & Production Vault',
  },
];

interface AppSidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string, submoduleId?: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isDark: boolean;
  activeProject: FilmProject | null;
  workspaceRole?: string;
  onOpenProjectSwitcher?: () => void;
  onOpenTeamManagement?: () => void;
  onBackToDashboard: () => void;
  onToggleTheme?: () => void;
}

export function AppSidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  isDark,
  activeProject,
  workspaceRole,
  onOpenProjectSwitcher,
  onOpenTeamManagement,
  onBackToDashboard,
  onToggleTheme,
}: AppSidebarProps) {
  // Pinned state persisted in localStorage
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sceneos_sidebar_pinned') === 'true';
    } catch {
      return false;
    }
  });

  // Hover state for auto-expansion on desktop
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  // Expandable submodules tracking (accordion per parent module)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    // By default expand the module matching current activeTab
    const activeMod = findModuleByTabId(activeTab);
    return activeMod ? { [activeMod.id]: true } : { overview: true };
  });

  // Effective expanded state: If user pinned it, or if user is hovering over the rail
  const isExpanded = isPinned || isHovered;

  // Dynamic module colour identity tokens for sidebar
  const isScreenplayActive = activeTab === 'screenplay';
  const isBreakdownActive = activeTab === 'breakdown';
  const isVisualizeActive = activeTab === 'visualize';
  const isProductionActive = activeTab === 'production';
  const isVaultActive = activeTab === 'assets' || activeTab === 'vault';

  const brandDotClass = isDark
    ? isScreenplayActive
      ? 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.85)]'
      : isBreakdownActive
      ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.85)]'
      : isVisualizeActive
      ? 'bg-[#F5F000] shadow-[0_0_10px_rgba(245,240,0,0.85)]'
      : isProductionActive
      ? 'bg-[#FF1744] shadow-[0_0_10px_rgba(255,23,68,0.85)]'
      : isVaultActive
      ? 'bg-[#B45CFF] shadow-[0_0_10px_rgba(180,92,255,0.85)]'
      : 'bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.6)]'
    : isScreenplayActive
      ? 'bg-cyan-600 shadow-[0_0_8px_rgba(8,145,178,0.6)]'
      : isBreakdownActive
      ? 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.6)]'
      : isVisualizeActive
      ? 'bg-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.6)]'
      : isProductionActive
      ? 'bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.6)]'
      : isVaultActive
      ? 'bg-purple-600 shadow-[0_0_8px_rgba(124,58,237,0.6)]'
      : 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]';

  const sidebarBgClass = isDark
    ? isScreenplayActive
      ? 'bg-[#070914]/95'
      : isBreakdownActive
      ? 'bg-[#020B06]/95'
      : isVisualizeActive
      ? 'bg-[#0A0B0D]/95'
      : isProductionActive
      ? 'bg-[#10090D]/95'
      : isVaultActive
      ? 'bg-[#10091B]/95'
      : 'bg-[#080d1a]/95'
    : 'bg-white/95 backdrop-blur-xl';

  const sidebarBorderClass = isDark
    ? isScreenplayActive
      ? 'border-cyan-500/20'
      : isBreakdownActive
      ? 'border-emerald-500/20'
      : isVisualizeActive
      ? 'border-[#F5F000]/20'
      : isProductionActive
      ? 'border-[#FF1744]/20'
      : isVaultActive
      ? 'border-[#B45CFF]/20'
      : 'border-zinc-800/80'
    : isScreenplayActive
      ? 'border-cyan-600/20'
      : isBreakdownActive
      ? 'border-emerald-600/20'
      : isVisualizeActive
      ? 'border-amber-500/25'
      : isProductionActive
      ? 'border-rose-600/20'
      : isVaultActive
      ? 'border-purple-600/20'
      : 'border-slate-200';

  const searchFocusClass = isDark
    ? isScreenplayActive
      ? 'focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'
      : isBreakdownActive
      ? 'focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30'
      : isVisualizeActive
      ? 'focus-within:border-[#F5F000]/60 focus-within:ring-1 focus-within:ring-[#F5F000]/30'
      : isProductionActive
      ? 'focus-within:border-[#FF1744]/60 focus-within:ring-1 focus-within:ring-[#FF1744]/30'
      : isVaultActive
      ? 'focus-within:border-[#B45CFF]/60 focus-within:ring-1 focus-within:ring-[#B45CFF]/30'
      : 'focus-within:border-cyan-500/60'
    : isScreenplayActive
      ? 'focus-within:border-cyan-600 focus-within:ring-1 focus-within:ring-cyan-600/20'
      : isBreakdownActive
      ? 'focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600/20'
      : isVisualizeActive
      ? 'focus-within:border-amber-600 focus-within:ring-1 focus-within:ring-amber-600/20'
      : isProductionActive
      ? 'focus-within:border-rose-600 focus-within:ring-1 focus-within:ring-rose-600/20'
      : isVaultActive
      ? 'focus-within:border-purple-600 focus-within:ring-1 focus-within:ring-purple-600/20'
      : 'focus-within:border-indigo-600';

  // Auto-expand module when activeTab changes
  useEffect(() => {
    const activeMod = findModuleByTabId(activeTab);
    if (activeMod) {
      setExpandedModules(prev => ({
        ...prev,
        [activeMod.id]: true
      }));
    }
  }, [activeTab]);

  const togglePin = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    try {
      localStorage.setItem('sceneos_sidebar_pinned', String(nextPinned));
    } catch (e) {
      console.warn('Storage error:', e);
    }
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  // Close drawer or hover-expanded sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobileOpen) onCloseMobile();
        if (isHovered) setIsHovered(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile, isHovered]);

  const toggleModuleExpansion = (moduleId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  // Filter modules and submodules based on search query
  const filteredModules = SCENEOS_MODULE_HIERARCHY.filter(mod => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    const modMatch = mod.name.toLowerCase().includes(query) || mod.description.toLowerCase().includes(query);
    const subMatch = mod.submodules.some(sub => sub.name.toLowerCase().includes(query) || sub.description.toLowerCase().includes(query));
    return modMatch || subMatch;
  });

  const renderNavLinks = (isMobile = false, forceExpanded = false) => {
    const expanded = forceExpanded || isExpanded;

    return (
      <ul className="space-y-1 px-2" role="list">
        {filteredModules.map((item) => {
          const Icon = item.icon;
          const isDirectActive = activeTab === item.id;
          const isAliasActive = item.legacyAliases && item.legacyAliases.includes(activeTab);
          const isActive = isDirectActive || isAliasActive;
          const isProduction = item.id === 'production';
          const isVisualize = item.id === 'visualize';
          const isVault = item.id === 'assets' || item.id === 'vault';
          const isBreakdown = item.id === 'breakdown';
          const isScreenplay = item.id === 'screenplay';
          const isAccordionOpen = Boolean(filterQuery) && expanded;
          const hasSubmodules = Boolean(filterQuery && item.submodules && item.submodules.length > 0);

          return (
            <li key={item.id} className="relative group/item">
              <div className="flex items-center">
                <button
                  type="button"
                  id={`sidebar-tab-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (!expandedModules[item.id]) {
                      setExpandedModules(prev => ({ ...prev, [item.id]: true }));
                    }
                    if (isMobile && !hasSubmodules) onCloseMobile();
                  }}
                  aria-label={`${item.name} module`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full relative flex items-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${
                    isProduction 
                      ? isDark ? 'focus-visible:ring-[#FF1744]' : 'focus-visible:ring-rose-500'
                      : isVisualize 
                        ? isDark ? 'focus-visible:ring-[#F5F000]' : 'focus-visible:ring-amber-500'
                        : isVault
                          ? isDark ? 'focus-visible:ring-[#B45CFF]' : 'focus-visible:ring-purple-500'
                          : isBreakdown
                            ? isDark ? 'focus-visible:ring-emerald-400' : 'focus-visible:ring-emerald-500'
                            : isDark ? 'focus-visible:ring-cyan-400' : 'focus-visible:ring-cyan-600'
                  } select-none ${
                    expanded
                      ? 'px-3 py-2 rounded-xl justify-between min-h-[40px]'
                      : 'w-10 h-10 mx-auto rounded-xl justify-center p-0'
                  } ${
                    isActive
                      ? isDark
                        ? isProduction
                          ? 'bg-[#FF1744]/15 text-[#FF5368] font-bold border border-[#FF1744]/35 shadow-[0_0_12px_rgba(255,23,68,0.25)]'
                          : isVisualize
                            ? 'bg-[#F5F000]/15 text-[#FFD34E] font-bold border border-[#F5F000]/35 shadow-[0_0_12px_rgba(245,240,0,0.20)]'
                            : isVault
                              ? 'bg-[#B45CFF]/15 text-[#D18AFF] font-bold border border-[#B45CFF]/35 shadow-[0_0_12px_rgba(180,92,255,0.25)]'
                              : isBreakdown
                                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/35 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                                : isScreenplay
                                  ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                                  : 'bg-white/10 text-white font-bold border border-white/20 shadow-sm'
                        : isProduction
                          ? 'bg-rose-50 text-rose-950 font-bold border border-rose-300 shadow-sm'
                          : isVisualize
                            ? 'bg-amber-50 text-amber-950 font-bold border border-amber-300 shadow-sm'
                            : isVault
                              ? 'bg-purple-50 text-purple-950 font-bold border border-purple-300 shadow-sm'
                              : isBreakdown
                                ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300 shadow-sm'
                                : isScreenplay
                                  ? 'bg-cyan-50 text-cyan-950 font-bold border border-cyan-300 shadow-sm'
                                  : 'bg-slate-100 text-slate-900 font-bold border border-slate-300 shadow-sm'
                      : isDark
                        ? 'text-zinc-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                      isActive
                        ? isDark 
                          ? isProduction 
                            ? 'text-[#FF1744]' 
                            : isVisualize 
                              ? 'text-[#F5F000]' 
                              : isVault
                                ? 'text-[#B45CFF]'
                                : isBreakdown
                                  ? 'text-emerald-400'
                                  : 'text-cyan-400'
                          : isProduction 
                            ? 'text-rose-600' 
                            : isVisualize 
                              ? 'text-amber-600' 
                              : isVault
                                ? 'text-purple-600'
                                : isBreakdown
                                  ? 'text-emerald-600'
                                  : isScreenplay
                                    ? 'text-cyan-700'
                                    : 'text-slate-800'
                        : 'text-current group-hover/item:scale-105'
                    }`} />

                    {expanded && (
                      <span className="truncate text-xs font-semibold tracking-wide">
                        {item.name}
                      </span>
                    )}
                  </div>

                  {expanded && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md border ${
                          isActive
                            ? isProduction
                              ? 'bg-[#FF1744]/20 text-[#FF8A9B] border-[#FF1744]/40'
                              : isVisualize
                                ? 'bg-[#F5F000]/20 text-[#FFF1A8] border-[#F5F000]/40'
                                : isVault
                                  ? 'bg-[#B45CFF]/20 text-[#E6C2FF] border-[#B45CFF]/40'
                                  : isBreakdown
                                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                                    : 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                            : item.badgeColor || (isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-slate-200 text-slate-700 border-slate-300')
                        }`}>
                          {item.badge}
                        </span>
                      )}

                      {hasSubmodules && (
                        <button
                          type="button"
                          onClick={(e) => toggleModuleExpansion(item.id, e)}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                          title={isAccordionOpen ? "Collapse submodules" : "Expand submodules"}
                          aria-label={isAccordionOpen ? `Collapse ${item.name} submodules` : `Expand ${item.name} submodules`}
                        >
                          {isAccordionOpen ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </button>
              </div>

              {/* Floating Tooltip Pill for Collapsed Icon Rail */}
              {!expanded && !isMobile && (
                <div 
                  role="tooltip"
                  className={`pointer-events-none absolute left-[56px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 group-hover/item:opacity-100 transition-all duration-150 scale-95 group-hover/item:scale-100 ${
                    isDark
                      ? 'bg-[#0b0f19] text-zinc-100 border border-zinc-800 shadow-black/80'
                      : 'bg-white text-slate-900 border border-slate-200 shadow-slate-300/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{item.name}</span>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 rounded font-mono bg-cyan-500/20 text-cyan-300 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 font-normal max-w-[200px] truncate">
                    {item.description}
                  </p>
                </div>
              )}

              {/* Progressive Disclosure Nested Submodules */}
              {expanded && isAccordionOpen && hasSubmodules && (
                <ul className="mt-1 ml-4 pl-2 border-l border-zinc-800/80 space-y-0.5 animate-fade-in" role="list">
                  {item.submodules.map((sub) => {
                    const SubIcon = sub.icon;
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          id={`sidebar-sub-${sub.id}`}
                          onClick={() => {
                            onSelectTab(item.id, sub.submoduleId);
                            if (isMobile) onCloseMobile();
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition flex items-center justify-between gap-1.5 cursor-pointer ${
                            isDark
                              ? isProduction
                                ? 'text-zinc-400 hover:text-[#FF8A9B] hover:bg-[#FF1744]/15'
                                : isVisualize
                                  ? 'text-zinc-400 hover:text-[#FFF1A8] hover:bg-[#F5F000]/15'
                                  : isVault
                                    ? 'text-zinc-400 hover:text-[#E6C2FF] hover:bg-[#B45CFF]/15'
                                    : isBreakdown
                                      ? 'text-zinc-400 hover:text-emerald-200 hover:bg-emerald-500/15'
                                      : 'text-zinc-400 hover:text-cyan-300 hover:bg-cyan-950/20'
                              : isProduction
                                ? 'text-slate-600 hover:text-rose-900 hover:bg-rose-50/60'
                                : isVisualize
                                  ? 'text-slate-600 hover:text-amber-900 hover:bg-amber-50/60'
                                  : isVault
                                    ? 'text-slate-600 hover:text-purple-900 hover:bg-purple-50/60'
                                    : isBreakdown
                                      ? 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-50/60'
                                      : 'text-slate-600 hover:text-indigo-900 hover:bg-indigo-50/60'
                          }`}
                          title={sub.description}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {SubIcon ? (
                              <SubIcon className="w-3 h-3 shrink-0 text-zinc-500" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                            )}
                            <span className="truncate">{sub.name}</span>
                          </div>
                          {sub.badge && (
                            <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400 shrink-0">
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      {/* ---------------------------------------------------------------------
          1. DESKTOP SLENDER & DYNAMIC EXPANDING SIDEBAR
         --------------------------------------------------------------------- */}
      <div
        className={`hidden md:block shrink-0 relative z-40 sticky top-[57px] h-[calc(100vh-57px)] h-[calc(100dvh-57px)] ${
          isPinned ? 'w-64' : 'w-[68px]'
        }`}
      >
      <aside
        id="sceneos-sidebar"
        aria-label="Main Application Navigation"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`flex flex-col border-r z-40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] absolute top-0 left-0 h-full select-none backdrop-blur-xl ${
          isDark 
            ? `${sidebarBgClass} ${sidebarBorderClass} text-zinc-300 shadow-[4px_0_24px_rgba(0,0,0,0.3)]` 
            : 'bg-white/95 border-slate-200 text-slate-700 shadow-sm'
        } ${isExpanded ? 'w-64' : 'w-[68px]'}`}
      >
        {/* Sidebar Header: Brand & Pin/Expand Toggles */}
        <div className={`p-3 flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} border-b ${isDark ? 'border-zinc-800/80' : 'border-slate-200'} min-h-[56px]`}>
          {isExpanded ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${brandDotClass}`} />
              <div className="flex flex-col text-left">
                <span className={`font-display text-xs font-black tracking-wider uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  SceneOS
                </span>
                <span className="text-[10px] text-zinc-500 font-medium tracking-wide truncate">
                  Film Production OS
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${brandDotClass}`} title="SceneOS Active" />
            </div>
          )}

          {isExpanded && (
            <div className="flex items-center gap-1">
              {/* Pin / Unpin button */}
              <button
                type="button"
                id="btn-sidebar-pin"
                onClick={togglePin}
                aria-label={isPinned ? "Unpin sidebar (auto-collapse)" : "Pin sidebar open"}
                title={isPinned ? "Unpin sidebar (auto-collapse)" : "Pin sidebar open"}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isPinned
                    ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/60'
                    : isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-850' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
              </button>

              {/* Backward compatibility collapse toggle button */}
              <button
                type="button"
                id="btn-sidebar-collapse"
                onClick={() => {
                  if (isPinned) setIsPinned(false);
                  setIsHovered(false);
                  onToggleCollapse();
                }}
                aria-label={isCollapsed ? "Expand sidebar navigation" : "Collapse sidebar to icon rail"}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isDark ? 'hover:bg-zinc-850 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Quick Search Jump Input in Expanded Mode */}
        {isExpanded && (
          <div className="px-3 pt-3 pb-1">
            <div className={`relative flex items-center rounded-xl border px-2.5 py-1.5 text-xs transition ${
              isDark 
                ? `bg-zinc-900/80 border-zinc-800 ${searchFocusClass} text-zinc-200` 
                : 'bg-slate-50 border-slate-200 focus-within:border-indigo-400 text-slate-800'
            }`}>
              <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0 mr-2" />
              <input
                type="text"
                placeholder="Search modules..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs"
              />
              <span className="text-[10px] font-mono text-zinc-500 shrink-0 px-1 py-0.5 rounded border border-zinc-700/40">
                ⌘K
              </span>
            </div>
          </div>
        )}

        {/* Section Header */}
        {isExpanded && (
          <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold tracking-wider uppercase text-zinc-500 font-mono">
            MODULES
          </div>
        )}

        {/* Navigation Workspaces List */}
        <nav className="flex-1 py-1 overflow-y-auto overflow-x-hidden scrollbar-cinema space-y-1">
          {renderNavLinks(false, isExpanded)}
        </nav>

        {/* Sidebar Footer Utility Actions */}
        <div className={`p-2 border-t ${isDark ? 'border-zinc-800/80 bg-zinc-950/40' : 'border-slate-200 bg-slate-50'} space-y-1`}>
          {/* Back to All Productions */}
          <button
            type="button"
            id="sidebar-btn-back"
            onClick={onBackToDashboard}
            aria-label="Back to all productions dashboard"
            title="All Productions"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition cursor-pointer min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'
            } ${!isExpanded ? 'justify-center px-0' : ''}`}
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            {isExpanded && <span className="truncate font-medium">All Productions</span>}
          </button>

          {/* Theme Toggle in Sidebar */}
          {onToggleTheme && (
            <button
              type="button"
              id="sidebar-btn-theme"
              onClick={onToggleTheme}
              aria-label="Toggle visual theme"
              title={isDark ? "Switch to light theme" : "Switch to dark neon theme"}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition cursor-pointer min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'
              } ${!isExpanded ? 'justify-center px-0' : ''}`}
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              )}
              {isExpanded && <span className="truncate font-medium">{isDark ? 'Light Theme' : 'Dark Neon'}</span>}
            </button>
          )}
        </div>
      </aside>
      </div>

      {/* ---------------------------------------------------------------------
          2. MOBILE NAVIGATION DRAWER & BACKDROP
         --------------------------------------------------------------------- */}
      {isMobileOpen && (
        <div 
          id="sidebar-mobile-drawer"
          className="fixed inset-0 z-50 md:hidden bg-black/75 backdrop-blur-md animate-fade-in flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Drawer"
          onClick={onCloseMobile}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-72 max-w-[85vw] h-full flex flex-col border-r shadow-2xl animate-slide-in-left ${
              isDark 
                ? 'bg-[#080d1a] border-zinc-800 text-zinc-300' 
                : 'bg-white border-zinc-200 text-zinc-800'
            }`}
          >
            {/* Mobile Drawer Header */}
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${brandDotClass}`} />
                <span className="font-mono text-sm font-black uppercase text-white tracking-wider">
                  SceneOS
                </span>
              </div>
              <button
                type="button"
                id="btn-close-mobile-sidebar"
                onClick={onCloseMobile}
                aria-label="Close navigation drawer"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Links */}
            <nav className="flex-1 py-4 overflow-y-auto space-y-1">
              {renderNavLinks(true, true)}
            </nav>

            {/* Mobile Footer */}
            <div className="p-3 border-t border-zinc-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onBackToDashboard();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-zinc-300 hover:bg-zinc-850 min-h-[44px] font-medium"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span>All Productions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
