import React, { useState } from 'react';
import { BookOpen, Lock, Sparkles } from 'lucide-react';
import type { FilmProject, ProjectRole } from '../../../types';
import type { VisualizeProductionStore } from '../types';
import type { StoryboardsScreenplayContext } from './StoryboardsWorkspace';
import { MoodBoardsView } from './MoodBoardsView';
import { LookbooksView } from './LookbooksView';

export type LookbooksSubView = 'mood-boards' | 'lookbooks';

interface LookbooksWorkspaceProps {
  project: FilmProject;
  activeRole: ProjectRole | null;
  canEdit: boolean;
  screenplayCtx: StoryboardsScreenplayContext;
  visualizeStore: VisualizeProductionStore;
  onUpdateProject?: (updated: FilmProject) => void;
}

export const LookbooksWorkspace: React.FC<LookbooksWorkspaceProps> = ({
  project,
  activeRole,
  canEdit,
  screenplayCtx,
  visualizeStore,
  onUpdateProject,
}) => {
  const [subView, setSubView] = useState<LookbooksSubView>('mood-boards');

  const moodBoardsCount = (visualizeStore.moodBoards || []).length;
  const lookbooksCount = (visualizeStore.lookbooks || []).length;

  return (
    <div
      id="lookbooks-workspace-root"
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent"
    >
      {/* Connected Creative Sub-Navigation: Mood Boards <-> Lookbooks */}
      <div className="px-4 py-2 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div
            role="tablist"
            aria-label="Mood Boards and Lookbooks Views"
            className="inline-flex items-center rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/[0.07] p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'mood-boards'}
              data-testid="lookbooks-subview-mood-boards"
              onClick={() => setSubView('mood-boards')}
              className={`px-3 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                subView === 'mood-boards'
                  ? 'bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_12px_rgba(245,240,0,0.35)]'
                  : 'text-slate-400 hover:text-amber-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Mood Boards
              <span className="font-mono text-[10px] opacity-75">
                ({moodBoardsCount})
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={subView === 'lookbooks'}
              data-testid="lookbooks-subview-lookbooks"
              onClick={() => setSubView('lookbooks')}
              className={`px-3 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                subView === 'lookbooks'
                  ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-amber-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Lookbooks
              <span className="font-mono text-[10px] opacity-75">
                ({lookbooksCount})
              </span>
            </button>
          </div>

          <span className="hidden md:inline text-[11px] font-mono text-slate-500">
            {project.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!canEdit && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 text-[11px] text-slate-400">
              <Lock className="w-3 h-3" />
              Read-only ({activeRole || 'viewer'})
            </span>
          )}
          <span className="text-[11px] font-mono text-slate-500">
            Shared Reference Library: {visualizeStore.referenceAssets.length}
          </span>
        </div>
      </div>

      {subView === 'mood-boards' ? (
        <MoodBoardsView
          project={project}
          scenes={screenplayCtx.scenes}
          visualizeStore={visualizeStore}
          canEdit={canEdit}
          onUpdateProject={onUpdateProject}
        />
      ) : (
        <LookbooksView
          project={project}
          scenes={screenplayCtx.scenes}
          visualizeStore={visualizeStore}
          canEdit={canEdit}
          onUpdateProject={onUpdateProject}
        />
      )}
    </div>
  );
};
