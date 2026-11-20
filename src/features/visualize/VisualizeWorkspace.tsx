import React, { useState, useEffect, useMemo } from 'react';
import {
  FilmProject,
  StoryboardRevision,
} from '../../types';
import { ProjectRole } from '../../types/database.types';
import type { DiscussionRecordTarget } from '../../services/contracts/types';
import {
  Image,
  Camera,
  Layers,
  FileText,
  Database,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  VISUALIZE_WORKSPACES,
  normalizeVisualizeWorkspaceId,
  getCanonicalVisualizeScreenplayContext,
  getProductionVisualizeStore,
  canEditVisualizeWorkspace,
} from './services/visualizeFoundationService';
import { getUnifiedBoards } from './services/boardService';
import { VisualizeWorkspaceId } from './types';
import { StoryboardsWorkspace } from './components/StoryboardsWorkspace';
import { ShotListsWorkspace } from './components/ShotListsWorkspace';
import { BoardsWorkspace } from './components/BoardsWorkspace';
import { VisualizeWorkflowAssistantDrawer } from './components/VisualizeWorkflowAssistantDrawer';

export interface VisualizeWorkspaceProps {
  project: FilmProject;
  isDark: boolean;
  activeRole?: ProjectRole | null;
  onNavigateTab: (tabId: string, submodule?: string) => void;
  onUpdateProject?: (updated: FilmProject) => void;
  onUpdateStoryboards?: (revisions: StoryboardRevision[]) => void;
  initialSubmodule?: string;
  onOpenDiscussion?: (target: DiscussionRecordTarget) => void;
}

const WORKSPACE_ICONS: Record<VisualizeWorkspaceId, React.ComponentType<{ className?: string }>> = {
  storyboards: Image,
  'shot-lists': Camera,
  boards: Layers,
};

export function VisualizeWorkspace({
  project,
  isDark,
  activeRole,
  onNavigateTab,
  onUpdateProject,
  initialSubmodule,
  onOpenDiscussion,
}: VisualizeWorkspaceProps) {
  const [activeSubmodule, setActiveSubmodule] = useState<VisualizeWorkspaceId>(() =>
    normalizeVisualizeWorkspaceId(initialSubmodule)
  );
  const [focusedPanelRequest, setFocusedPanelRequest] = useState<{
    sceneId: string;
    panelId: string;
  } | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    if (initialSubmodule) {
      setActiveSubmodule(normalizeVisualizeWorkspaceId(initialSubmodule));
    }
  }, [initialSubmodule]);

  // Authoritative canonical screenplay & scene references (no demo fallback or duplication)
  const screenplayCtx = useMemo(
    () => getCanonicalVisualizeScreenplayContext(project),
    [project]
  );

  // Strictly production-isolated Visualize store & shared Visual Reference Library index
  const visualizeStore = useMemo(
    () => getProductionVisualizeStore(project),
    [project]
  );

  const unifiedBoardsCount = useMemo(
    () => getUnifiedBoards(project).length,
    [project]
  );

  // Role-based write check aligned with ProjectContext / RBAC matrix
  const resolvedRole = activeRole ?? project.userRole ?? null;
  const canEdit = canEditVisualizeWorkspace(resolvedRole);

  const workspaceMetricLabel = (id: VisualizeWorkspaceId): string => {
    if (id === 'storyboards') {
      const count = visualizeStore.storyboardPanels.length + (project.storyboardRevisions?.length || 0);
      return `${count}`;
    }
    if (id === 'shot-lists') {
      return `${visualizeStore.shots.length}`;
    }
    return `${unifiedBoardsCount}`;
  };

  return (
    <div
      data-testid="visualize-workspace-container"
      id="workspace-visualize-content"
      className="flex-1 min-h-0 flex flex-col h-full w-full visualize-atmospheric-bg text-slate-100 overflow-hidden select-none"
    >
      {/* Slim Top Navigation Bar: Strictly 3 Primary Visualise Workspaces */}
      <div className="h-11 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl px-4 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            data-testid="visualize-navigation-bar"
            className="flex items-center gap-1 bg-[#0A0B0D]/80 p-0.5 rounded-xl border border-[#FFD34E]/25 shadow-inner whitespace-nowrap overflow-x-auto"
          >
            {VISUALIZE_WORKSPACES.map((ws) => {
              const Icon = WORKSPACE_ICONS[ws.id];
              const isActive = activeSubmodule === ws.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setActiveSubmodule(ws.id)}
                  data-testid={`visualize-tab-${ws.id}`}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_14px_rgba(245,240,0,0.35)] border border-[#FFF1A8]/50'
                      : 'text-amber-100/60 hover:text-white hover:bg-[#9C741C]/25 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-stone-950' : 'text-[#FFD34E]'}`} />
                  <span>{ws.name}</span>
                  <span
                    className={`text-[10px] px-1.5 rounded-full font-mono ${
                      isActive
                        ? 'bg-black/25 text-stone-950 font-bold'
                        : 'bg-white/10 text-amber-200/70'
                    }`}
                  >
                    {workspaceMetricLabel(ws.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Screenplay Link, Shared Reference Library Status & Permission State */}
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <button
            type="button"
            onClick={() => onNavigateTab('screenplay', 'library')}
            data-testid="visualize-screenplay-link"
            title="Open active canonical screenplay"
            className="px-2.5 py-1 rounded-lg bg-[#15171A]/80 hover:bg-[#1F2226] border border-[#FFD34E]/20 text-[11px] text-amber-100 flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#F5F000]" />
            {screenplayCtx.hasScreenplay ? (
              <span>
                <span className="text-amber-300/70 hidden lg:inline">Script: </span>
                <strong className="font-semibold text-white">
                  {screenplayCtx.activeScript?.title || project.title}
                </strong>
                <span className="text-amber-300/70 font-mono ml-1.5">
                  ({screenplayCtx.scenes.length} {screenplayCtx.scenes.length === 1 ? 'scene' : 'scenes'})
                </span>
              </span>
            ) : (
              <span className="text-amber-300/50">No screenplay loaded</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('assets')}
            data-testid="visualize-vault-link"
            title="Shared Visual Reference Library backed by Media Vault"
            className="px-2.5 py-1 rounded-lg bg-[#15171A]/80 hover:bg-[#1F2226] border border-[#FFD34E]/20 text-[11px] text-amber-100 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-[#FFD34E]" />
            <span className="hidden md:inline">Reference Library:</span>
            <span className="font-mono font-semibold text-[#FFF1A8]">
              {visualizeStore.referenceAssets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAssistantOpen((p) => !p)}
            data-testid="visualize-workflow-assistant-btn"
            title="Inspect existing Visualise relationships and missing links"
            className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition cursor-pointer ${
              assistantOpen
                ? 'bg-[#F5F000]/20 border-[#F5F000]/50 text-[#FFF1A8] font-semibold shadow-[0_0_10px_rgba(245,240,0,0.25)]'
                : 'bg-[#15171A]/80 hover:bg-[#1F2226] border-[#FFD34E]/20 text-amber-200/80'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#F5F000]" />
            <span>Workflow Check</span>
          </button>

          {resolvedRole && !canEdit && (
            <span
              data-testid="visualize-readonly-badge"
              className="px-2 py-1 rounded-lg bg-[#1F2226] border border-[#FFD34E]/25 text-[10px] font-mono text-amber-300/70 flex items-center gap-1"
            >
              <Lock className="w-3 h-3 text-[#F5A623]" />
              <span>Read-Only</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace Area: Storyboards (Batch 1), Shot Lists & Camera Setups (Batch 2), Lookbooks & Mood Boards (Batch 3) */}
      {activeSubmodule === 'storyboards' ? (
        <StoryboardsWorkspace
          project={project}
          activeRole={resolvedRole}
          canEdit={canEdit}
          screenplayCtx={screenplayCtx}
          visualizeStore={visualizeStore}
          onUpdateProject={onUpdateProject}
          onNavigateTab={onNavigateTab}
          focusedPanelRequest={focusedPanelRequest}
          onClearFocusedPanelRequest={() => setFocusedPanelRequest(null)}
          onOpenShotListsForScene={() => setActiveSubmodule('shot-lists')}
          onOpenDiscussion={onOpenDiscussion}
        />
      ) : activeSubmodule === 'shot-lists' ? (
        <ShotListsWorkspace
          project={project}
          activeRole={resolvedRole}
          canEdit={canEdit}
          screenplayCtx={screenplayCtx}
          visualizeStore={visualizeStore}
          onUpdateProject={onUpdateProject}
          onNavigateTab={onNavigateTab}
          onOpenStoryboardPanel={(sceneId, panelId) => {
            setFocusedPanelRequest({ sceneId, panelId });
            setActiveSubmodule('storyboards');
          }}
          onOpenDiscussion={onOpenDiscussion}
        />
      ) : (
        <BoardsWorkspace
          project={project}
          activeRole={resolvedRole}
          canEdit={canEdit}
          scenes={screenplayCtx.scenes}
          visualizeStore={visualizeStore}
          onUpdateProject={onUpdateProject}
          onNavigateTab={onNavigateTab}
          onOpenDiscussion={onOpenDiscussion}
        />
      )}

      <VisualizeWorkflowAssistantDrawer
        isOpen={assistantOpen}
        project={project}
        onClose={() => setAssistantOpen(false)}
        onNavigateWorkspace={(area) => {
          setActiveSubmodule(area);
          setAssistantOpen(false);
        }}
        onNavigateVault={() => {
          setAssistantOpen(false);
          onNavigateTab('assets');
        }}
      />
    </div>
  );
}
