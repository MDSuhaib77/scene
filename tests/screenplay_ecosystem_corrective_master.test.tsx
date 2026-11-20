import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  ScreenplayWorkspace,
  resolveScreenplaySubmodule,
} from '../src/features/screenplay/ScreenplayWorkspace';
import { AVScriptWorkspace } from '../src/features/screenplay/components/AVScriptWorkspace';
import { ScriptIntelligenceWorkspace } from '../src/features/screenplay/components/ScriptIntelligenceWorkspace';
import { BreakdownWorkspace } from '../src/features/breakdown/BreakdownWorkspace';
import { FilmProject, ScreenplayVersion } from '../src/types';
import { extractScriptIntelligenceFromDoc } from '../src/features/screenplay/services/scriptIntelligenceService';
import { SCENEOS_MODULE_HIERARCHY } from '../src/components/navigation/navigationHierarchy';

describe('SceneOS Screenplay Ecosystem Corrective Master (Prompt 11)', () => {
  const mockProject: FilmProject = {
    id: 'proj-corrective-1',
    title: 'The Godfather Part II',
    logline: 'The continuing saga of the Corleone crime family...',
    genre: 'Crime / Drama',
    targetAudience: 'Adults',
    estimatedBudget: 13000000,
    startDate: '1974-01-01',
    endDate: '1974-12-12',
    status: 'pre-production',
    createdAt: '1974-01-01T00:00:00Z',
    updatedAt: '1974-01-01T00:00:00Z',
    screenplayVersions: [
      {
        id: 'draft-godfather-2',
        projectId: 'proj-corrective-1',
        title: 'The Godfather Part II — Shooting Draft',
        version: 'v1.0',
        content: '',
        createdAt: '1974-01-01T00:00:00Z',
        updatedAt: '1974-01-01T00:00:00Z',
        scenes: [
          {
            id: 'scn-1',
            sceneNumber: '1',
            heading: 'INT. CORLEONE COMPOUND - LAKE TAHOE - DAY',
            originalHeading: 'INT. CORLEONE COMPOUND - LAKE TAHOE - DAY',
            intExt: 'INT',
            location: 'CORLEONE COMPOUND - LAKE TAHOE',
            timeOfDay: 'DAY',
            pageEighths: 24,
            characters: ['MICHAEL', 'KAY'],
            dialogueBlocks: [
              {
                character: 'MICHAEL',
                text: 'This is the party for Anthony’s first communion.',
              },
            ],
            reviewState: 'reviewed',
            confidence: 'high',
          },
          {
            id: 'scn-2',
            sceneNumber: '2',
            heading: 'EXT. HAVANA STREETS - NIGHT',
            originalHeading: 'EXT. HAVANA STREETS - NIGHT',
            intExt: 'EXT',
            location: 'HAVANA STREETS',
            timeOfDay: 'NIGHT',
            pageEighths: 16,
            characters: ['MICHAEL', 'FREDO'],
            dialogueBlocks: [
              {
                character: 'FREDO',
                text: 'I know this city. I can handle things here, Mike.',
              },
            ],
            reviewState: 'reviewed',
            confidence: 'high',
          },
        ],
      },
    ],
  };

  describe('1. Screenplay Hierarchy & Exactly 2 Peer Sub-Modules', () => {
    it('defines exactly two peer sub-modules under Screenplay in the authoritative navigation hierarchy', () => {
      const screenplayModule = SCENEOS_MODULE_HIERARCHY.find((m) => m.id === 'screenplay');
      expect(screenplayModule).toBeDefined();
      expect(screenplayModule?.name).toBe('Screenplay');
      
      const submodules = screenplayModule?.submodules || [];
      expect(submodules).toHaveLength(2);

      const [library, av] = submodules;
      expect(library.id).toBe('screenplay-library');
      expect(library.name).toBe('Script Library');
      expect(library.submoduleId).toBe('library');

      expect(av.id).toBe('screenplay-av');
      expect(av.name).toBe('AV Script');
      expect(av.submoduleId).toBe('av-script');
    });

    it('relocates Scene & Character Matrix under Breakdown module', () => {
      const breakdownModule = SCENEOS_MODULE_HIERARCHY.find((m) => m.id === 'breakdown');
      expect(breakdownModule).toBeDefined();
      expect(breakdownModule?.submodules.some((s) => s.submoduleId === 'matrix')).toBe(true);
    });

    it('resolves screenplay submodule IDs accurately to library or av-script', () => {
      expect(resolveScreenplaySubmodule('library')).toBe('library');
      expect(resolveScreenplaySubmodule('screenplay-library')).toBe('library');
      expect(resolveScreenplaySubmodule('av-script')).toBe('av-script');
      expect(resolveScreenplaySubmodule('screenplay-av')).toBe('av-script');
      expect(resolveScreenplaySubmodule(undefined)).toBe('library');
    });

    it('renders the top peer navigation bar with exactly 2 destinations', () => {
      const html = renderToStaticMarkup(
        <ScreenplayWorkspace
          project={mockProject}
          onUpdateProject={vi.fn()}
          initialSubmodule="library"
        />
      );

      expect(html).toContain('data-testid="screenplay-submodules-navbar"');
      expect(html).toContain('data-testid="screenplay-submodule-library-btn"');
      expect(html).toContain('data-testid="screenplay-submodule-av-btn"');
      expect(html).not.toContain('data-testid="screenplay-submodule-intelligence-btn"');
      expect(html).toContain('Script Library');
      expect(html).toContain('AV Script');
    });
  });

  describe('2. AV Script Sub-Module', () => {
    it('renders two-column Audio/Visual format workspace with cues and runtime calculations', () => {
      const html = renderToStaticMarkup(
        <AVScriptWorkspace
          project={mockProject}
          activeScreenplayVersion={mockProject.screenplayVersions?.[0]}
          onNavigateTab={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="screenplay-av-script-workspace"');
      expect(html).toContain('VISUAL / VIDEO DIRECTION');
      expect(html).toContain('AUDIO / NARRATION');
      expect(html).toContain('data-testid="av-script-title-input"');
      expect(html).toContain('data-testid="av-add-cue-btn"');
      expect(html).toContain('data-testid="av-export-btn"');
      expect(html).toContain('data-testid="av-copy-btn"');
      expect(html).toContain('data-testid="av-seed-from-screenplay-btn"');
    });

    it('mounts AV Script workspace directly when initialSubmodule="av-script"', () => {
      const html = renderToStaticMarkup(
        <ScreenplayWorkspace
          project={mockProject}
          onUpdateProject={vi.fn()}
          initialSubmodule="av-script"
        />
      );

      expect(html).toContain('data-testid="screenplay-av-script-workspace"');
      expect(html).toContain('VISUAL / VIDEO DIRECTION');
      expect(html).toContain('AUDIO / NARRATION');
    });
  });

  describe('3. Script Intelligence Sub-Module & Migrated Matrix Views', () => {
    const mockIntelligence = extractScriptIntelligenceFromDoc({
      doc: {
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. CORLEONE COMPOUND - LAKE TAHOE - DAY' }],
          },
          {
            type: 'action',
            content: [{ type: 'text', text: 'Michael stands near the picture window watching Anthony.' }],
          },
          {
            type: 'character',
            content: [{ type: 'text', text: 'MICHAEL' }],
          },
          {
            type: 'dialogue',
            content: [{ type: 'text', text: 'We will protect this family.' }],
          },
        ],
      },
      sourceDocumentId: 'draft-godfather-2',
    });

    it('renders Character & Script Analysis workspace with Relationship Graph and Script Breakdown', () => {
      const html = renderToStaticMarkup(
        <ScriptIntelligenceWorkspace
          project={mockProject}
          activeScreenplayVersion={mockProject.screenplayVersions?.[0]}
          intelligenceResult={mockIntelligence}
          onApplyManualOverride={vi.fn()}
          onResetManualOverride={vi.fn()}
          onToggleSceneReviewed={vi.fn()}
          onRefreshAnalysis={vi.fn()}
          isAnalysisOutdated={false}
          onNavigateTab={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="character-analysis-workspace"');
      expect(html).toContain('data-testid="character-view-graph-btn"');
      expect(html).toContain('data-testid="character-view-breakdown-btn"');
      expect(html).toContain('Character &amp; Script Analysis');
      expect(html).toContain('MICHAEL');
    });

    it('renders Character & Script Analysis in Breakdown when initialSubmodule="characters" or "matrix"', () => {
      const html = renderToStaticMarkup(
        <BreakdownWorkspace
          project={mockProject}
          onUpdateProject={vi.fn()}
          initialSubmodule="characters"
        />
      );

      expect(html).toContain('data-testid="breakdown-submodule-characters-btn"');
      expect(html).toContain('data-testid="character-analysis-workspace"');
      expect(html).toContain('Character &amp; Script Analysis');
    });

    it('redirects intelligence requests from Screenplay to Breakdown matrix', () => {
      const navMock = vi.fn();
      renderToStaticMarkup(
        <ScreenplayWorkspace
          project={mockProject}
          onUpdateProject={vi.fn()}
          onNavigateTab={navMock}
          initialSubmodule="intelligence"
        />
      );

      expect(navMock).toHaveBeenCalledWith('breakdown', 'matrix');
    });
  });
});
