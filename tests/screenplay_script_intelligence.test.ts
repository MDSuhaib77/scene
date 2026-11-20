import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { JSONContent } from '@tiptap/react';
import {
  parseSceneHeadingMetadata,
  normalizeCharacterCue,
  buildSceneCharacterAppearances,
  extractScriptIntelligenceFromDoc,
  applySceneManualOverride,
  resetSceneManualOverride,
  toggleSceneReviewedStatus,
  filterExtractedScenes,
} from '../src/features/screenplay/services/scriptIntelligenceService';
import { ScreenplaySceneMatrix } from '../src/features/screenplay/components/ScreenplaySceneMatrix';
import {
  ScreenplayWorkspace,
  DEFAULT_SAMPLE_SCREENPLAY,
} from '../src/features/screenplay/ScreenplayWorkspace';
import { deserializeScreenplayDocument } from '../src/features/screenplay/commands/screenplayCommands';
import { FilmProject } from '../src/types';

describe('SceneOS Script Intelligence, Screenplay Parsing & Scene Matrix (Prompt 05)', () => {
  describe('1. Deterministic Scene Heading Metadata Parser', () => {
    it('parses standard INT/EXT, location, and time of day accurately', () => {
      const parsedInt = parseSceneHeadingMetadata('INT. DETECTIVE PRECINCT - NIGHT');
      expect(parsedInt.originalHeading).toBe('INT. DETECTIVE PRECINCT - NIGHT');
      expect(parsedInt.intExt).toBe('INT');
      expect(parsedInt.location).toBe('DETECTIVE PRECINCT');
      expect(parsedInt.timeOfDay).toBe('NIGHT');
      expect(parsedInt.reviewReasons).toHaveLength(0);

      const parsedExt = parseSceneHeadingMetadata('EXT. DESERT HIGHWAY — DAWN');
      expect(parsedExt.intExt).toBe('EXT');
      expect(parsedExt.location).toBe('DESERT HIGHWAY');
      expect(parsedExt.timeOfDay).toBe('DAWN');
      expect(parsedExt.reviewReasons).toHaveLength(0);

      const parsedIntExt = parseSceneHeadingMetadata('INT./EXT. PATROL CAR - CONTINUOUS');
      expect(parsedIntExt.intExt).toBe('INT/EXT');
      expect(parsedIntExt.location).toBe('PATROL CAR');
      expect(parsedIntExt.timeOfDay).toBe('CONTINUOUS');
      expect(parsedIntExt.reviewReasons).toHaveLength(0);

      const parsedIE = parseSceneHeadingMetadata('I/E. ELEVATOR SHAFT - DUSK');
      expect(parsedIE.intExt).toBe('I/E');
      expect(parsedIE.location).toBe('ELEVATOR SHAFT');
      expect(parsedIE.timeOfDay).toBe('DUSK');
      expect(parsedIE.reviewReasons).toHaveLength(0);
    });

    it('preserves multi-segment sublocations when separated by hyphens', () => {
      const parsed = parseSceneHeadingMetadata(
        'INT. SOUNDSTAGE 4 - CONTROL BOOTH - NIGHT'
      );
      expect(parsed.intExt).toBe('INT');
      expect(parsed.location).toBe('SOUNDSTAGE 4 - CONTROL BOOTH');
      expect(parsed.timeOfDay).toBe('NIGHT');
      expect(parsed.reviewReasons).toHaveLength(0);
    });

    it('never silently defaults to DAY when time of day is omitted, marking UNSPECIFIED for review', () => {
      const parsed = parseSceneHeadingMetadata('INT. ABANDONED WAREHOUSE');
      expect(parsed.intExt).toBe('INT');
      expect(parsed.location).toBe('ABANDONED WAREHOUSE');
      expect(parsed.timeOfDay).toBe('UNSPECIFIED');
      expect(parsed.reviewReasons.length).toBeGreaterThan(0);
      expect(parsed.reviewReasons.join(' ')).toMatch(/Unspecified time of day/i);
    });

    it('handles unusual or incomplete headings gracefully without crashing', () => {
      const unusual = parseSceneHeadingMetadata('MONTAGE - CITY AWAKENS');
      expect(unusual.originalHeading).toBe('MONTAGE - CITY AWAKENS');
      expect(unusual.intExt).toBe('UNKNOWN');
      expect(unusual.reviewReasons.length).toBeGreaterThan(0);

      const prefixOnly = parseSceneHeadingMetadata('EXT.');
      expect(prefixOnly.intExt).toBe('EXT');
      expect(prefixOnly.location).toBe('UNKNOWN LOCATION');
      expect(prefixOnly.timeOfDay).toBe('UNSPECIFIED');
      expect(prefixOnly.reviewReasons.length).toBeGreaterThan(0);
    });
  });

  describe('2. Character Cue Normalization & Per-Scene Appearance Extraction', () => {
    it('strips standard delivery extensions while preserving raw cues', () => {
      const vo = normalizeCharacterCue('MARA (V.O.)');
      expect(vo.normalizedName).toBe('MARA');
      expect(vo.rawCue).toBe('MARA (V.O.)');
      expect(vo.isAmbiguous).toBe(false);

      const osContd = normalizeCharacterCue("DETECTIVE COLE (O.S.) (CONT'D)");
      expect(osContd.normalizedName).toBe('DETECTIVE COLE');
      expect(osContd.isAmbiguous).toBe(false);

      const dualCaret = normalizeCharacterCue('JULIAN (INTO RADIO) ^');
      expect(dualCaret.normalizedName).toBe('JULIAN');
      expect(dualCaret.isAmbiguous).toBe(false);
    });

    it('deduplicates repeated cues within a scene while tracking dialogue counts and raw cues', () => {
      const result = buildSceneCharacterAppearances([
        'MARA',
        'JULIAN',
        'MARA (O.S.)',
        "MARA (CONT'D)",
      ]);
      expect(result.characters).toEqual(['MARA', 'JULIAN']);
      expect(result.appearances).toHaveLength(2);
      expect(result.appearances[0].normalizedName).toBe('MARA');
      expect(result.appearances[0].dialogueCount).toBe(3);
      expect(result.appearances[0].rawCues).toEqual([
        'MARA',
        'MARA (O.S.)',
        "MARA (CONT'D)",
      ]);
      expect(result.appearances[1].normalizedName).toBe('JULIAN');
      expect(result.appearances[1].dialogueCount).toBe(1);
    });

    it('conservatively flags compound cues and potential name variants for review without destructively merging', () => {
      const result = buildSceneCharacterAppearances([
        'MARA',
        'MARA VANCE',
        'COLE / JULIAN',
      ]);
      expect(result.characters).toEqual(['MARA', 'MARA VANCE', 'COLE / JULIAN']);

      const mara = result.appearances.find((a) => a.normalizedName === 'MARA')!;
      const maraVance = result.appearances.find(
        (a) => a.normalizedName === 'MARA VANCE'
      )!;
      const compound = result.appearances.find(
        (a) => a.normalizedName === 'COLE / JULIAN'
      )!;

      expect(mara.isAmbiguous).toBe(true);
      expect(maraVance.isAmbiguous).toBe(true);
      expect(mara.ambiguityReason).toMatch(/Possible character name variants/i);
      expect(compound.isAmbiguous).toBe(true);
      expect(result.ambiguityReasons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Authoritative ProseMirror Document Extraction Pipeline', () => {
    it('detects scenes strictly from semantic sceneHeading nodes and ignores uppercase action blocks', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'actHeading',
            content: [{ type: 'text', text: 'ACT I' }],
          },
          {
            type: 'sequenceHeading',
            content: [{ type: 'text', text: 'SEQUENCE A' }],
          },
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. LAB CORRIDOR - NIGHT' }],
          },
          {
            type: 'action',
            content: [
              {
                type: 'text',
                text: 'WARNING SIRENS BLARE IN UPPERCASE BUT THIS IS AN ACTION BLOCK.',
              },
            ],
          },
          {
            type: 'character',
            content: [{ type: 'text', text: 'DR. CHEN (V.O.)' }],
          },
          {
            type: 'dialogue',
            content: [{ type: 'text', text: 'Seal the inner bulkhead.' }],
          },
          {
            type: 'dualDialogue',
            content: [
              {
                type: 'dualDialogueColumn',
                attrs: { side: 'left' },
                content: [
                  {
                    type: 'character',
                    content: [{ type: 'text', text: 'DR. CHEN' }],
                  },
                  {
                    type: 'dialogue',
                    content: [{ type: 'text', text: 'Override code Delta.' }],
                  },
                ],
              },
              {
                type: 'dualDialogueColumn',
                attrs: { side: 'right' },
                content: [
                  {
                    type: 'character',
                    content: [{ type: 'text', text: 'SECURITY OFFICER ^' }],
                  },
                  {
                    type: 'dialogue',
                    content: [{ type: 'text', text: 'Bulkhead locked!' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'EXT. ROOFTOP HELIPAD - DAWN' }],
          },
          {
            type: 'action',
            content: [{ type: 'text', text: 'Rotors chop through morning mist.' }],
          },
        ],
      };

      const result = extractScriptIntelligenceFromDoc({
        doc,
        sourceDocumentId: 'doc-test-1',
      });

      expect(result.totalScenes).toBe(2);
      expect(result.scenes[0].sceneNumber).toBe('1');
      expect(result.scenes[0].originalHeading).toBe('INT. LAB CORRIDOR - NIGHT');
      expect(result.scenes[0].intExt).toBe('INT');
      expect(result.scenes[0].location).toBe('LAB CORRIDOR');
      expect(result.scenes[0].timeOfDay).toBe('NIGHT');
      expect(result.scenes[0].characters).toEqual(['DR. CHEN', 'SECURITY OFFICER']);
      expect(result.scenes[0].actHeading).toBe('ACT I');
      expect(result.scenes[0].sequenceHeading).toBe('SEQUENCE A');
      expect(typeof result.scenes[0].sourcePos).toBe('number');

      expect(result.scenes[1].sceneNumber).toBe('2');
      expect(result.scenes[1].originalHeading).toBe('EXT. ROOFTOP HELIPAD - DAWN');
      expect(result.scenes[1].intExt).toBe('EXT');
      expect(result.scenes[1].location).toBe('ROOFTOP HELIPAD');
      expect(result.scenes[1].timeOfDay).toBe('DAWN');
      expect(result.scenes[1].characters).toEqual([]);
    });

    it('returns an empty scene array cleanly when the screenplay has no sceneHeading blocks', () => {
      const emptyOrActionOnlyDoc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'action',
            content: [{ type: 'text', text: 'Fade in on a dark screen.' }],
          },
        ],
      };

      const result = extractScriptIntelligenceFromDoc({
        doc: emptyOrActionOnlyDoc,
        sourceDocumentId: 'doc-empty',
      });

      expect(result.totalScenes).toBe(0);
      expect(result.scenes).toEqual([]);
      expect(result.characters).toEqual([]);
      expect(result.locations).toEqual([]);
    });
  });

  describe('4. Non-Destructive Manual Corrections & Document Edit Reconciliation', () => {
    it('applies manual overrides without mutating originalHeading or raw extracted fields, and reconciles across edits', () => {
      const initialDoc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. ARCHIVE ROOM' }],
          },
          {
            type: 'character',
            content: [{ type: 'text', text: 'MARA' }],
          },
          {
            type: 'dialogue',
            content: [{ type: 'text', text: 'Check box seven.' }],
          },
        ],
      };

      const firstPass = extractScriptIntelligenceFromDoc({
        doc: initialDoc,
        sourceDocumentId: 'doc-reconcile',
      });

      expect(firstPass.scenes[0].timeOfDay).toBe('UNSPECIFIED');
      expect(firstPass.scenes[0].reviewState).toBe('needs_review');

      // Apply manual correction
      const correctedList = applySceneManualOverride(
        firstPass.scenes,
        firstPass.scenes[0].id,
        {
          intExt: 'INT',
          location: 'NATIONAL ARCHIVE VAULT',
          timeOfDay: 'NIGHT',
          characters: ['MARA VANCE', 'ARCHIVIST'],
        }
      );
      const correctedScene = correctedList[0];

      expect(correctedScene.reviewState).toBe('manually_corrected');
      expect(correctedScene.location).toBe('NATIONAL ARCHIVE VAULT');
      expect(correctedScene.timeOfDay).toBe('NIGHT');
      expect(correctedScene.characters).toEqual(['MARA VANCE', 'ARCHIVIST']);
      // Original heading and raw extracted values remain intact
      expect(correctedScene.originalHeading).toBe('INT. ARCHIVE ROOM');
      expect(correctedScene.extractedLocation).toBe('ARCHIVE ROOM');
      expect(correctedScene.extractedTimeOfDay).toBe('UNSPECIFIED');

      // Simulate editing dialogue in the screenplay document and re-extracting with priorScenes
      const editedDoc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. ARCHIVE ROOM' }],
          },
          {
            type: 'character',
            content: [{ type: 'text', text: 'MARA' }],
          },
          {
            type: 'dialogue',
            content: [
              {
                type: 'text',
                text: 'Check box seven and bring the microfiche reader.',
              },
            ],
          },
        ],
      };

      const secondPass = extractScriptIntelligenceFromDoc({
        doc: editedDoc,
        sourceDocumentId: 'doc-reconcile',
        priorScenes: correctedList,
      });

      expect(secondPass.scenes[0].id).toBe(correctedScene.id);
      expect(secondPass.scenes[0].reviewState).toBe('manually_corrected');
      expect(secondPass.scenes[0].location).toBe('NATIONAL ARCHIVE VAULT');
      expect(secondPass.scenes[0].timeOfDay).toBe('NIGHT');
      expect(secondPass.scenes[0].characters).toEqual(['MARA VANCE', 'ARCHIVIST']);

      // Resetting override restores raw extracted metadata
      const resetList = resetSceneManualOverride(
        secondPass.scenes,
        secondPass.scenes[0].id
      );
      const resetScene = resetList[0];
      expect(resetScene.location).toBe('ARCHIVE ROOM');
      expect(resetScene.timeOfDay).toBe('UNSPECIFIED');
      expect(resetScene.characters).toEqual(['MARA']);
      expect(resetScene.reviewState).toBe('needs_review');

      // Toggling reviewed status marks scene as reviewed
      const reviewedList = toggleSceneReviewedStatus(resetList, resetScene.id);
      expect(reviewedList[0].reviewState).toBe('reviewed');
    });
  });

  describe('5. Scene Matrix Search, Filtering, Selection & Workspace Integration', () => {
    const sampleDoc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'sceneHeading',
          content: [{ type: 'text', text: 'INT. SOUNDSTAGE 4 - NIGHT' }],
        },
        {
          type: 'character',
          content: [{ type: 'text', text: 'MARA' }],
        },
        {
          type: 'dialogue',
          content: [{ type: 'text', text: 'Roll sound.' }],
        },
        {
          type: 'sceneHeading',
          content: [{ type: 'text', text: 'EXT. BACKLOT ALLEY - DAWN' }],
        },
        {
          type: 'character',
          content: [{ type: 'text', text: 'COLE' }],
        },
        {
          type: 'dialogue',
          content: [{ type: 'text', text: 'South perimeter is clear.' }],
        },
        {
          type: 'sceneHeading',
          content: [{ type: 'text', text: 'INT. CONTROL ROOM' }],
        },
      ],
    };

    it('filters extracted scenes by search query, INT/EXT, location, time of day, character, and review status', () => {
      const intelligence = extractScriptIntelligenceFromDoc({
        doc: sampleDoc,
        sourceDocumentId: 'doc-filter',
      });

      expect(
        filterExtractedScenes(intelligence.scenes, { intExt: 'EXT' })
      ).toHaveLength(1);
      expect(
        filterExtractedScenes(intelligence.scenes, { character: 'COLE' })[0]
          .sceneNumber
      ).toBe('2');
      expect(
        filterExtractedScenes(intelligence.scenes, { reviewState: 'needs_review' })[0]
          .sceneNumber
      ).toBe('3');
      expect(
        filterExtractedScenes(intelligence.scenes, { searchQuery: 'SOUNDSTAGE' })[0]
          .sceneNumber
      ).toBe('1');
    });

    it('renders ScreenplaySceneMatrix empty state when no scene headings exist', () => {
      const html = renderToStaticMarkup(
        React.createElement(ScreenplaySceneMatrix, {
          projectTitle: 'Empty Project',
          draftTitle: 'Empty Script',
          versionLabel: 'v1.0',
          sourceDocumentId: 'empty-doc',
          sourceDocFingerprint: '000000',
          scenes: [],
          selectedSceneId: null,
          onSelectScene: vi.fn(),
          onApplyManualOverride: vi.fn(),
          onResetManualOverride: vi.fn(),
          onToggleSceneReviewed: vi.fn(),
          onCloseMatrix: vi.fn(),
          layoutMode: 'split',
          onChangeLayoutMode: vi.fn(),
        })
      );

      expect(html).toContain('data-testid="screenplay-matrix-empty-state"');
      expect(html).toContain('No Scene Headings Detected in Active Document');
    });

    it('renders populated ScreenplaySceneMatrix and mounts inside ScreenplayWorkspace with initialSubmodule="intelligence"', () => {
      const intelligence = extractScriptIntelligenceFromDoc({
        doc: sampleDoc,
        sourceDocumentId: 'doc-matrix-render',
      });

      const matrixHtml = renderToStaticMarkup(
        React.createElement(ScreenplaySceneMatrix, {
          projectTitle: 'Night Shoot',
          draftTitle: 'Night Shoot — Working Draft',
          versionLabel: 'v1.0',
          sourceDocumentId: 'doc-matrix-render',
          sourceDocFingerprint: intelligence.sourceDocFingerprint,
          scenes: intelligence.scenes,
          selectedSceneId: intelligence.scenes[0].id,
          onSelectScene: vi.fn(),
          onApplyManualOverride: vi.fn(),
          onResetManualOverride: vi.fn(),
          onToggleSceneReviewed: vi.fn(),
          onCloseMatrix: vi.fn(),
          layoutMode: 'split',
          onChangeLayoutMode: vi.fn(),
        })
      );

      expect(matrixHtml).toContain('data-testid="screenplay-scene-matrix"');
      expect(matrixHtml).toContain(
        `data-testid="screenplay-matrix-row-${intelligence.scenes[0].id}"`
      );
      expect(matrixHtml).toContain(
        `data-testid="screenplay-matrix-row-${intelligence.scenes[1].id}"`
      );
      expect(matrixHtml).toContain(
        `data-testid="screenplay-matrix-row-${intelligence.scenes[2].id}"`
      );
      expect(matrixHtml).toContain('INT. SOUNDSTAGE 4 - NIGHT');
      expect(matrixHtml).toContain('EXT. BACKLOT ALLEY - DAWN');
      expect(matrixHtml).toContain('UNSPECIFIED');
      expect(matrixHtml).toContain('Needs Review');

      const mockProject: FilmProject = {
        id: 'proj-matrix-1',
        title: 'Night Shoot',
        logline: 'Test logline',
        genre: 'Thriller',
        format: 'Feature',
        status: 'Pre-Production',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
        screenplayVersions: [
          {
            id: 'v-sample',
            version: 'v1.0',
            title: 'Working Draft',
            author: 'Screenwriter',
            createdAt: '2026-10-19T10:00:00Z',
            updatedAt: '2026-10-19T10:00:00Z',
            status: 'Draft',
            rawText: DEFAULT_SAMPLE_SCREENPLAY,
            documentJson: JSON.stringify(
              deserializeScreenplayDocument(null, DEFAULT_SAMPLE_SCREENPLAY)
            ),
          },
        ],
      };

      const workspaceHtml = renderToStaticMarkup(
        React.createElement(ScreenplayWorkspace, {
          project: mockProject,
          onUpdateProject: vi.fn(),
          initialSubmodule: 'intelligence',
        })
      );

      expect(workspaceHtml).toContain('data-testid="screenplay-scene-matrix"');
      expect(workspaceHtml).toContain('data-testid="screenplay-toggle-matrix-btn"');
      expect(workspaceHtml).toContain('SOUNDSTAGE 4 - CONTROL BOOTH');
    });
  });
});
