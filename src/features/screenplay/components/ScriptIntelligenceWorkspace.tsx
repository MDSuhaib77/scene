import React from 'react';
import {
  FilmProject,
  ScreenplayVersion,
  ParsedScene,
  SceneManualOverrides,
} from '../../../types';
import { ScriptIntelligenceExtractionResult } from '../services/scriptIntelligenceService';
import { CharacterAnalysisWorkspace } from '../../breakdown/components/CharacterAnalysisWorkspace';

export interface ScriptIntelligenceWorkspaceProps {
  project: FilmProject;
  activeScreenplayVersion?: ScreenplayVersion | null;
  intelligenceResult?: ScriptIntelligenceExtractionResult;
  onApplyManualOverride?: (
    sceneId: string,
    patch: Partial<SceneManualOverrides> & { markReviewed?: boolean }
  ) => void;
  onResetManualOverride?: (sceneId: string) => void;
  onToggleSceneReviewed?: (sceneId: string) => void;
  onRefreshAnalysis?: () => void;
  isAnalysisOutdated?: boolean;
  onNavigateTab?: (tab: string, submodule?: string) => void;
  onSelectSceneInEditor?: (scene: ParsedScene) => void;
  initialView?: string;
  readOnly?: boolean;
}

/**
 * ScriptIntelligenceWorkspace
 * Fully revamped and absorbed into Character Analysis.
 */
export const ScriptIntelligenceWorkspace: React.FC<
  ScriptIntelligenceWorkspaceProps
> = ({
  project,
  activeScreenplayVersion,
  intelligenceResult,
  onNavigateTab,
  onSelectSceneInEditor,
  readOnly = false,
}) => {
  const scenes = intelligenceResult?.scenes || project.scenes || [];

  return (
    <CharacterAnalysisWorkspace
      project={project}
      activeScreenplayVersion={activeScreenplayVersion}
      scenes={scenes}
      onNavigateTab={onNavigateTab}
      onSelectScene={(sceneId) => {
        const scn = scenes.find((s) => s.id === sceneId);
        if (scn && onSelectSceneInEditor) {
          onSelectSceneInEditor(scn);
        }
      }}
      readOnly={readOnly}
    />
  );
};
