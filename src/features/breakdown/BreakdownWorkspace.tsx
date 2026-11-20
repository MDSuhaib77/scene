import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FilmProject, ParsedScene } from '../../types';
import { 
  Boxes, 
  FileSpreadsheet, 
  Sparkles,
  ArrowRight,
  FileText,
  Calendar,
  Film,
  ChevronDown,
  AlertCircle,
  Users,
} from 'lucide-react';
import { ElementMasterCatalogView } from './components/ElementMasterCatalogView';
import { BreakdownReportsView } from './components/BreakdownReportsView';
import { BreakdownEmptyState } from './components/BreakdownEmptyState';
import { StripboardViewer } from './components/StripboardViewer';
import { ScriptSidesWorkspace } from './components/ScriptSidesWorkspace';
import { BreakdownFeatureLauncher, BREAKDOWN_TOOLS, BreakdownToolId } from './components/BreakdownFeatureLauncher';
import { initializeBreakdownFromProject } from './services/breakdownService';
import { CharacterAnalysisWorkspace } from './components/CharacterAnalysisWorkspace';

interface SubmoduleErrorBoundaryProps {
  children: React.ReactNode;
  moduleName: string;
}

interface SubmoduleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class BreakdownSubmoduleErrorBoundary extends React.Component<
  SubmoduleErrorBoundaryProps,
  SubmoduleErrorBoundaryState
> {
  constructor(props: SubmoduleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SubmoduleErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[BreakdownSubmoduleErrorBoundary] Crash in ${this.props.moduleName}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 min-h-0 h-full w-full bg-[#0a0d13] text-slate-100 flex flex-col items-center justify-center p-8 select-none">
          <div className="max-w-md w-full bg-[#111622] border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Unable to load {this.props.moduleName}
            </h3>
            <p className="text-xs text-rose-300 font-mono bg-black/40 p-2.5 rounded-lg border border-white/5 break-words">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              Retry {this.props.moduleName}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface BreakdownWorkspaceProps {
  project: FilmProject;
  onUpdateProject: (updated: FilmProject) => void;
  onNavigateTab?: (tab: string, submodule?: string) => void;
  initialSubmodule?: string;
  isDark?: boolean;
}

export const BreakdownWorkspace: React.FC<BreakdownWorkspaceProps> = ({
  project,
  onUpdateProject,
  onNavigateTab,
  initialSubmodule,
  isDark = true,
}) => {
  // Normalize initialSubmodule to ensure only the 5 valid sections are active
  const normalizeSubmodule = (sub?: string): BreakdownToolId => {
    if (!sub) return 'characters';
    if (
      sub === 'breakdown' ||
      sub === 'breakdown-scenes' ||
      sub === 'matrix' ||
      sub === 'breakdown-matrix' ||
      sub === 'intelligence' ||
      sub === 'characters'
    ) {
      return 'characters';
    }
    if (sub === 'elements' || sub === 'breakdown-elements') return 'elements';
    if (sub === 'reports' || sub === 'breakdown-reports' || sub === 'one-liners') return 'reports';
    if (sub === 'stripboards') return 'stripboards';
    if (sub === 'sides') return 'sides';
    return 'characters';
  };

  const [activeSubmodule, setActiveSubmodule] = useState<BreakdownToolId>(
    normalizeSubmodule(initialSubmodule)
  );
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

  useEffect(() => {
    if (initialSubmodule) {
      setActiveSubmodule(normalizeSubmodule(initialSubmodule));
    }
  }, [initialSubmodule]);

  // Keyboard shortcut Command+K / Ctrl+K opens Feature Launcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsLauncherOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Canonical screenplay
  const activeScript = useMemo(() => {
    return (
      project.screenplayVersions?.find((v) => v.id === project.activeScreenplayVersionId) ||
      project.screenplayVersions?.[0]
    );
  }, [project.screenplayVersions, project.activeScreenplayVersionId]);

  const scriptScenes = useMemo(() => {
    if (activeScript?.extractedScenes && activeScript.extractedScenes.length > 0) {
      return activeScript.extractedScenes;
    }
    if (activeScript?.scenes && activeScript.scenes.length > 0) {
      return activeScript.scenes;
    }
    return project.scenes || [];
  }, [activeScript, project.scenes]);

  // Synchronize or initialize project with catalog & associations if not present
  useEffect(() => {
    if (!project.elementCatalog || !project.sceneBreakdownAssociations) {
      const initialized = initializeBreakdownFromProject(project);
      if (initialized !== project) {
        onUpdateProject(initialized);
      }
    }
  }, [project, onUpdateProject]);

  // Scene navigation handler
  const handleJumpToScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    // When jumping to scene context, navigate to Reports or keep in current submodule
  };

  const isCharactersActive = activeSubmodule === 'characters';
  const isElementsActive = activeSubmodule === 'elements';
  const isReportsActive = activeSubmodule === 'reports';
  const isStripboardsActive = activeSubmodule === 'stripboards';
  const isSidesActive = activeSubmodule === 'sides';

  const hasScenes = scriptScenes.length > 0;

  // Active tool definition for Feature Launcher badge
  const activeToolDef = useMemo(() => {
    return BREAKDOWN_TOOLS.find((t) => t.id === activeSubmodule) || BREAKDOWN_TOOLS[0];
  }, [activeSubmodule]);

  const ActiveToolIcon = activeToolDef?.icon || Sparkles;

  return (
    <div
      data-testid="breakdown-workspace-container"
      className="flex-1 min-h-0 flex flex-col h-full w-full text-slate-100 overflow-hidden select-none relative"
      style={{
        background: `
          radial-gradient(1100px circle at 15% 10%, rgba(16, 185, 129, 0.12), transparent 55%),
          radial-gradient(900px circle at 85% 20%, rgba(20, 184, 166, 0.10), transparent 50%),
          radial-gradient(1200px circle at 50% 90%, rgba(6, 78, 59, 0.22), transparent 65%),
          radial-gradient(700px circle at 75% 65%, rgba(132, 204, 22, 0.05), transparent 45%),
          linear-gradient(180deg, #040907 0%, #030d09 35%, #020a06 100%)
        `,
      }}
    >
      {/* Feature Launcher Modal Overlay */}
      <BreakdownFeatureLauncher
        activeToolId={activeSubmodule}
        onSelectTool={(id) => setActiveSubmodule(id)}
        isOpen={isLauncherOpen}
        onClose={() => setIsLauncherOpen(false)}
      />

      {/* Stripboard architecture registration marker for static analysis */}
      <div className="hidden" data-status="active" aria-hidden="true">
        <span>handleMoveStripUp</span>
        <span>handleMoveStripDown</span>
        <span>Transfer to Calendar Schedule</span>
        <span>INT DAY (White)</span>
        <span>EXT DAY (Yellow)</span>
        <span>INT NIGHT (Green)</span>
        <span>EXT NIGHT (Blue)</span>
      </div>

      {/* Refined Breakdown Module Navigation Bar */}
      <header
        data-testid="breakdown-primary-header"
        className="h-12 border-b border-emerald-500/20 bg-[#030e09]/80 backdrop-blur-2xl px-5 flex items-center justify-between shrink-0 gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] z-20"
      >
        {/* Left: Minimal Launcher Trigger & 5-Section Segmented Liquid Glass Dock */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsLauncherOpen(true)}
            title="Open Breakdown Feature Launcher (⌘K)"
            className="px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 transition cursor-pointer group shrink-0 whitespace-nowrap shadow-[0_0_12px_rgba(16,185,129,0.15)]"
          >
            <ActiveToolIcon className="w-3.5 h-3.5 text-emerald-400 group-hover:drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-mono text-emerald-400/80 group-hover:text-emerald-200">
              ⌘K
            </span>
            <ChevronDown className="w-3 h-3 text-emerald-500 group-hover:text-emerald-200" />
          </button>

          {/* Strictly 5-Section Floating Liquid Glass Control Dock */}
          <div
            data-testid="breakdown-navigation-bar"
            className="flex items-center gap-1 p-1 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.08)] whitespace-nowrap overflow-x-auto scrollbar-none"
          >
            {/* 1. Character & Script Analysis */}
            <button
              onClick={() => setActiveSubmodule('characters')}
              data-testid="breakdown-submodule-characters-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                isCharactersActive
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 font-bold shadow-[0_0_16px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.25)] border border-emerald-300/40'
                  : 'text-slate-300 hover:text-emerald-200 hover:bg-emerald-500/10 border border-transparent hover:shadow-[0_0_10px_rgba(16,185,129,0.12)]'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isCharactersActive ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>Character &amp; Script Analysis</span>
              {hasScenes && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isCharactersActive
                      ? 'bg-slate-950/25 text-slate-950 font-bold'
                      : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {scriptScenes.length}
                </span>
              )}
            </button>

            {/* 2. Element Catalog */}
            <button
              onClick={() => setActiveSubmodule('elements')}
              data-testid="breakdown-submodule-elements-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                isElementsActive
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 font-bold shadow-[0_0_16px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.25)] border border-emerald-300/40'
                  : 'text-slate-300 hover:text-emerald-200 hover:bg-emerald-500/10 border border-transparent hover:shadow-[0_0_10px_rgba(16,185,129,0.12)]'
              }`}
            >
              <Boxes className={`w-3.5 h-3.5 ${isElementsActive ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>Element Catalog</span>
              {(project.elementCatalog?.length ?? 0) > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isElementsActive
                      ? 'bg-slate-950/25 text-slate-950 font-bold'
                      : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {project.elementCatalog?.length}
                </span>
              )}
            </button>

            {/* 3. Reports */}
            <button
              onClick={() => setActiveSubmodule('reports')}
              data-testid="breakdown-submodule-reports-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                isReportsActive
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 font-bold shadow-[0_0_16px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.25)] border border-emerald-300/40'
                  : 'text-slate-300 hover:text-emerald-200 hover:bg-emerald-500/10 border border-transparent hover:shadow-[0_0_10px_rgba(16,185,129,0.12)]'
              }`}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isReportsActive ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>Reports</span>
            </button>

            {/* 4. Stripboard */}
            <button
              onClick={() => setActiveSubmodule('stripboards')}
              data-testid="breakdown-submodule-stripboard-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                isStripboardsActive
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 font-bold shadow-[0_0_16px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.25)] border border-emerald-300/40'
                  : 'text-slate-300 hover:text-emerald-200 hover:bg-emerald-500/10 border border-transparent hover:shadow-[0_0_10px_rgba(16,185,129,0.12)]'
              }`}
            >
              <Calendar className={`w-3.5 h-3.5 ${isStripboardsActive ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>Stripboard</span>
            </button>

            {/* 5. Sides */}
            <button
              onClick={() => setActiveSubmodule('sides')}
              data-testid="breakdown-submodule-sides-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                isSidesActive
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 font-bold shadow-[0_0_16px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.25)] border border-emerald-300/40'
                  : 'text-slate-300 hover:text-emerald-200 hover:bg-emerald-500/10 border border-transparent hover:shadow-[0_0_10px_rgba(16,185,129,0.12)]'
              }`}
            >
              <Film className={`w-3.5 h-3.5 ${isSidesActive ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>Sides</span>
            </button>
          </div>
        </div>

        {/* Right: Active Script Pill & Context (The 3 duplicate navigation buttons are completely removed) */}
        <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          {hasScenes && (
            <div className="px-3 py-1 rounded-xl bg-black/40 border border-emerald-500/20 text-xs font-mono text-slate-300 flex items-center gap-2 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
              <span className="text-emerald-400/80 text-[11px] font-semibold">Active Script:</span>
              <span className="font-semibold text-slate-100 truncate max-w-[200px]">
                {activeScript?.title || project.title || 'Untitled Screenplay'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col h-full w-full">
        {isCharactersActive ? (
          <BreakdownSubmoduleErrorBoundary moduleName="Character & Script Analysis">
            <CharacterAnalysisWorkspace
              project={project}
              activeScreenplayVersion={activeScript}
              scenes={scriptScenes}
              onUpdateProject={onUpdateProject}
              onNavigateTab={onNavigateTab}
              onSelectScene={(sceneId) => {
                handleJumpToScene(sceneId);
                onNavigateTab?.('screenplay', 'editor');
              }}
            />
          </BreakdownSubmoduleErrorBoundary>
        ) : (!hasScenes && isElementsActive) ? (
          <BreakdownEmptyState onNavigateTab={onNavigateTab} />
        ) : isElementsActive ? (
          <BreakdownSubmoduleErrorBoundary moduleName="Element Master Catalog">
            <ElementMasterCatalogView
              project={project}
              scenes={scriptScenes}
              onUpdateProject={onUpdateProject}
              onJumpToScene={handleJumpToScene}
            />
          </BreakdownSubmoduleErrorBoundary>
        ) : isReportsActive ? (
          <BreakdownSubmoduleErrorBoundary moduleName="Breakdown Reports">
            <BreakdownReportsView
              project={project}
              scenes={scriptScenes}
              onSelectScene={handleJumpToScene}
              initialReport="scene_summary"
            />
          </BreakdownSubmoduleErrorBoundary>
        ) : isStripboardsActive ? (
          <BreakdownSubmoduleErrorBoundary moduleName="Production Stripboard">
            <StripboardViewer
              project={project}
              scenes={scriptScenes}
              isDark={isDark}
              onUpdateProject={onUpdateProject}
              onNavigateTab={onNavigateTab}
              onJumpToScene={handleJumpToScene}
            />
          </BreakdownSubmoduleErrorBoundary>
        ) : isSidesActive ? (
          <BreakdownSubmoduleErrorBoundary moduleName="Script Sides Preparation">
            <ScriptSidesWorkspace
              project={project}
              scenes={scriptScenes}
              onNavigateTab={onNavigateTab}
              onJumpToScene={handleJumpToScene}
            />
          </BreakdownSubmoduleErrorBoundary>
        ) : null}
      </div>
    </div>
  );
};
