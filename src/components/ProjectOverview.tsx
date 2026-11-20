import React from 'react';
import type { FilmProject } from '../types';
import { CollaborationHome, CollaborationDestination } from '../features/collaboration/home/CollaborationHome';

export interface NavigationTargetContext {
  sourceView?: string;
  sourceWarningId?: string;
  sourceLabel?: string;
}

export interface ProjectOverviewProps {
  project: FilmProject;
  simulatedDate?: string;
  onSetSimulatedDate?: (date: string) => void;
  metrics?: any;
  isDark: boolean;
  onNavigateTab?: (tab: string, context?: NavigationTargetContext) => void;
  onToggleActivity?: (phaseId: string, activityId: string) => void;
  onUpdateProjectMeta: (updates: Partial<FilmProject>) => void;
  userRole: string;
  initialHeroView?: string;
  activitySyncRevision?: number;
  onOpenTeamModal?: () => void;
  activeDestination?: 'home' | CollaborationDestination;
  onSelectDestination?: (dest: 'home' | CollaborationDestination) => void;
}

/**
 * SCENE — Collaboration Home (Repurposed Overview Module)
 *
 * Implements the Apple-inspired production home & dynamically expanding collaboration
 * workspaces (Inbox, Activity, People, Discussions) with real project records, Vault
 * audio/video players with automatic muted playback, calendar focus, and milestone tracking.
 */
export function ProjectOverview({
  project,
  simulatedDate,
  onSetSimulatedDate,
  metrics,
  isDark,
  onNavigateTab,
  onToggleActivity,
  onUpdateProjectMeta,
  userRole,
  initialHeroView,
  onOpenTeamModal,
  activeDestination,
  onSelectDestination,
}: ProjectOverviewProps) {
  // Map initialHeroView to collaboration destination if provided
  const initialDest: CollaborationDestination | null =
    initialHeroView === 'inbox' ||
    initialHeroView === 'activity' ||
    initialHeroView === 'people' ||
    initialHeroView === 'discussions'
      ? initialHeroView
      : null;

  return (
    <div data-testid="project-overview-root" className="w-full flex-1 flex flex-col min-h-0">
      <CollaborationHome
        project={project}
        simulatedDate={simulatedDate}
        onSetSimulatedDate={onSetSimulatedDate}
        metrics={metrics}
        isDark={isDark}
        onNavigateTab={onNavigateTab}
        onToggleActivity={onToggleActivity}
        onUpdateProjectMeta={onUpdateProjectMeta}
        userRole={userRole}
        initialDestination={initialDest}
        activeDestination={activeDestination}
        onSelectDestination={onSelectDestination}
        onOpenTeamModal={onOpenTeamModal}
      />
    </div>
  );
}
