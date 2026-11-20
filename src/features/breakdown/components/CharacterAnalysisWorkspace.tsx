import React, { useState, useMemo, useCallback } from 'react';
import {
  FilmProject,
  ScreenplayVersion,
  ParsedScene,
} from '../../../types';
import {
  analyzeScreenplayCharacters,
  CharacterAnalysisDataset,
  CharacterAnalysisOverrides,
  ConfirmedCharacterRecord,
} from '../services/characterAnalysisService';
import {
  analyzeScriptBreakdown,
  ScriptBreakdownDataset,
} from '../services/scriptBreakdownService';
import {
  canonicalToParsedScenes,
  tiptapDocToCanonical,
} from '../../screenplay/model/canonicalConverters';
import { CharacterRelationshipGraph } from './CharacterRelationshipGraph';
import { ScriptBreakdownTable } from './ScriptBreakdownTable';
import { CharacterDetailDrawer } from './CharacterDetailDrawer';
import { CharacterExtractionAuditModal } from './CharacterExtractionAuditModal';
import {
  Network,
  Table as TableIcon,
  Search,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface CharacterAnalysisWorkspaceProps {
  project: FilmProject;
  activeScreenplayVersion?: ScreenplayVersion | null;
  scenes?: ParsedScene[];
  onUpdateProject?: (updated: FilmProject) => void;
  onNavigateTab?: (tab: string, submodule?: string) => void;
  onSelectScene?: (sceneId: string) => void;
  initialViewMode?: 'graph' | 'breakdown' | 'table';
  readOnly?: boolean;
}

export const CharacterAnalysisWorkspace: React.FC<CharacterAnalysisWorkspaceProps> = ({
  project,
  activeScreenplayVersion,
  scenes: propScenes,
  onUpdateProject,
  onNavigateTab,
  onSelectScene,
  initialViewMode = 'graph',
  readOnly = false,
}) => {
  const normalizedInitial = initialViewMode === 'table' ? 'breakdown' : initialViewMode;
  const [viewMode, setViewMode] = useState<'graph' | 'breakdown'>(normalizedInitial);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isMentionedSectionOpen, setIsMentionedSectionOpen] = useState<boolean>(false);

  // Effective screenplay version
  const activeScript = useMemo(() => {
    return (
      activeScreenplayVersion ||
      project.screenplayVersions?.find((v) => v.id === project.activeScreenplayVersionId) ||
      project.screenplayVersions?.[0]
    );
  }, [activeScreenplayVersion, project.screenplayVersions, project.activeScreenplayVersionId]);

  // Screenplay scenes (reconciled with canonical document if dialogue blocks are absent)
  const scenes = useMemo(() => {
    let baseScenes: ParsedScene[] = [];
    if (propScenes && propScenes.length > 0) baseScenes = propScenes;
    else if (activeScript?.extractedScenes && activeScript.extractedScenes.length > 0) {
      baseScenes = activeScript.extractedScenes;
    } else if (activeScript?.scenes && activeScript.scenes.length > 0) {
      baseScenes = activeScript.scenes;
    } else {
      baseScenes = project.scenes || [];
    }

    const needsDialogueEnrichment =
      baseScenes.length === 0 ||
      baseScenes.every((s) => !s.dialogueBlocks || s.dialogueBlocks.length === 0);

    if (needsDialogueEnrichment && activeScript?.documentJson) {
      try {
        const parsedJson = JSON.parse(activeScript.documentJson);
        const canonical = parsedJson?.elements
          ? parsedJson
          : tiptapDocToCanonical(parsedJson);
        const canonicalScenes = canonicalToParsedScenes(canonical);

        if (baseScenes.length === 0 && canonicalScenes.length > 0) {
          return canonicalScenes;
        }

        if (canonicalScenes.length > 0) {
          return baseScenes.map((scene, idx) => {
            if (scene.dialogueBlocks && scene.dialogueBlocks.length > 0) return scene;
            const matched =
              canonicalScenes.find(
                (cs) =>
                  (scene.sceneNumber && cs.sceneNumber === scene.sceneNumber) ||
                  (scene.slugline && cs.slugline === scene.slugline)
              ) || canonicalScenes[idx];
            if (!matched) return scene;
            return {
              ...scene,
              dialogueBlocks: matched.dialogueBlocks || [],
              characters:
                scene.characters && scene.characters.length > 0
                  ? scene.characters
                  : matched.characters || [],
            };
          });
        }
      } catch {
        // Fallback safely to baseScenes
      }
    }

    return baseScenes;
  }, [propScenes, activeScript, project.scenes]);

  const scriptTitle = activeScript?.title || project.title || 'Screenplay';

  // Analysis Overrides from project
  const overrides: CharacterAnalysisOverrides = useMemo(() => {
    return (project as any).characterAnalysisOverrides || {};
  }, [(project as any).characterAnalysisOverrides]);

  // Authoritative Character Intelligence Extraction
  const dataset: CharacterAnalysisDataset = useMemo(() => {
    return analyzeScreenplayCharacters(scenes, scriptTitle, overrides);
  }, [scenes, scriptTitle, overrides]);

  // Authoritative Script Structural Composition Analysis (same canonical screenplay source)
  const scriptBreakdown: ScriptBreakdownDataset = useMemo(() => {
    return analyzeScriptBreakdown(activeScript, scenes, scriptTitle);
  }, [activeScript, scenes, scriptTitle]);

  const handleJumpToSceneFromAnalysis = useCallback(
    (sceneId: string) => {
      if (onSelectScene) {
        onSelectScene(sceneId);
      } else if (onNavigateTab) {
        onNavigateTab('screenplay', 'editor');
      }
    },
    [onSelectScene, onNavigateTab]
  );

  // Selected Character Object
  const selectedCharacter: ConfirmedCharacterRecord | null = useMemo(() => {
    if (!selectedCharacterId) return null;
    return (
      dataset.characters.find((c) => c.canonicalName === selectedCharacterId) || null
    );
  }, [selectedCharacterId, dataset.characters]);

  // Handle saving overrides
  const handleSaveOverrides = useCallback(
    (updatedOverrides: CharacterAnalysisOverrides) => {
      if (!onUpdateProject) return;
      onUpdateProject({
        ...project,
        characterAnalysisOverrides: updatedOverrides,
      } as any);
    },
    [project, onUpdateProject]
  );

  return (
    <div
      data-testid="character-analysis-workspace"
      className="flex-1 min-h-0 h-full w-full bg-transparent text-slate-100 flex flex-col overflow-hidden select-none"
    >
      {/* Refined Liquid Glass Workspace Toolbar */}
      <div className="h-11 border-b border-emerald-500/15 bg-[#030e09]/60 backdrop-blur-xl px-5 flex items-center justify-between shrink-0 gap-3">
        {/* Left: View Switcher & Compact Count */}
        <div className="flex items-center gap-3">
          <span className="sr-only">Character &amp; Script Analysis</span>
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <button
              type="button"
              onClick={() => {
                setViewMode('graph');
                setSearchQuery('');
              }}
              data-testid="character-view-graph-btn"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'graph'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_0_14px_rgba(16,185,129,0.35)] border border-emerald-300/40'
                  : 'text-slate-300 hover:text-emerald-200 hover:bg-emerald-500/10'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Relationship Graph</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('breakdown');
                setSearchQuery('');
              }}
              data-testid="character-view-breakdown-btn"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'breakdown'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_0_14px_rgba(16,185,129,0.35)] border border-emerald-300/40'
                  : 'text-slate-300 hover:text-emerald-200 hover:bg-emerald-500/10'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Script Breakdown</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-emerald-300 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-500/25 shadow-sm">
            {viewMode === 'graph'
              ? `${dataset.characters.length} speaking`
              : `${scriptBreakdown.totalClassifiedInstances} blocks`}
          </span>
        </div>

        {/* Right: Search Input & Audit Status Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                viewMode === 'graph' ? 'Filter characters...' : 'Filter block types...'
              }
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 focus:outline-none transition"
            />
          </div>

          {viewMode === 'graph' && (
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              data-testid="character-audit-status-btn"
              title="Open Screenplay Extraction & Completeness Audit"
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
                dataset.audit.status === 'complete'
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : 'bg-lime-500/15 hover:bg-lime-500/25 border-lime-500/30 text-lime-300 shadow-[0_0_12px_rgba(163,230,53,0.15)]'
              }`}
            >
              {dataset.audit.status === 'complete' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-lime-400" />
              )}
              <span className="hidden md:inline font-semibold">
                {dataset.audit.status === 'complete'
                  ? 'Extraction Complete'
                  : 'Review Required'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Analysis Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Visual / Table View Area */}
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden relative">
          {viewMode === 'graph' ? (
            <CharacterRelationshipGraph
              characters={dataset.characters}
              interactions={dataset.interactions}
              selectedCharacterId={selectedCharacterId}
              onSelectCharacter={(id) => setSelectedCharacterId(id)}
              onJumpToScene={handleJumpToSceneFromAnalysis}
              searchQuery={searchQuery}
            />
          ) : (
            <ScriptBreakdownTable
              dataset={scriptBreakdown}
              searchQuery={searchQuery}
              onJumpToScene={handleJumpToSceneFromAnalysis}
            />
          )}

          {/* Collapsible Mentioned-Only Characters Inventory (Graph View only) */}
          {viewMode === 'graph' && dataset.mentionedCharacters.length > 0 && (
            <div className="border-t border-emerald-500/15 bg-[#04160f]/80 backdrop-blur-xl shrink-0 transition-all">
              <button
                type="button"
                onClick={() => setIsMentionedSectionOpen((prev) => !prev)}
                className="w-full px-6 py-2 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Mentioned-Only
                  </span>
                  <span className="font-semibold text-slate-300">
                    ({dataset.mentionedCharacters.length})
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Identified in action text without speaking cues
                  </span>
                </div>
                {isMentionedSectionOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {isMentionedSectionOpen && (
                <div className="px-6 pb-3 pt-1 max-h-36 overflow-y-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    {dataset.mentionedCharacters.map((mentioned) => (
                      <div
                        key={mentioned.name}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2 text-xs"
                      >
                        <span className="font-bold text-slate-300 font-mono">
                          {mentioned.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          in {mentioned.detectionCount} {mentioned.detectionCount === 1 ? 'scene' : 'scenes'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Character Detail Drawer (Graph View only) */}
        {viewMode === 'graph' && selectedCharacter && (
          <CharacterDetailDrawer
            character={selectedCharacter}
            onClose={() => setSelectedCharacterId(null)}
            onSelectPartner={(partner) => setSelectedCharacterId(partner)}
            onJumpToScene={handleJumpToSceneFromAnalysis}
            onOpenAuditReview={() => setIsAuditModalOpen(true)}
          />
        )}
      </div>

      {/* Extraction Audit & Manual Override Modal */}
      <CharacterExtractionAuditModal
        audit={dataset.audit}
        characters={dataset.characters}
        overrides={overrides}
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onSaveOverrides={handleSaveOverrides}
      />
    </div>
  );
};
