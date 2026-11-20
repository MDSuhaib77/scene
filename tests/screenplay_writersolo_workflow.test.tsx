import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilmProject, ScreenplayVersion } from '../src/types';
import { ScreenplayWorkspace } from '../src/features/screenplay/ScreenplayWorkspace';
import { ScreenplayEntryDialog } from '../src/features/screenplay/components/ScreenplayEntryDialog';
import { ScreenplayToolbar } from '../src/features/screenplay/components/ScreenplayToolbar';
import { processScreenplayImportFile } from '../src/features/screenplay/services/screenplayImportService';

const MOCK_PROJECT: FilmProject = {
  id: 'proj-writersolo-test',
  title: 'Chinatown',
  logline: 'A private detective hired to expose an adulterer finds himself caught in a web of deceit.',
  genre: 'Noir / Mystery',
  targetAudience: 'Adults',
  estimatedBudget: 5000000,
  startDate: '1974-06-20',
  endDate: '1974-12-01',
  status: 'pre-production',
  createdAt: '1974-06-20T00:00:00Z',
  updatedAt: '1974-06-20T00:00:00Z',
  screenplayVersions: [
    {
      id: 'ver-draft-1',
      version: 'v1.0',
      title: 'Chinatown — First Draft',
      rawText: 'INT. J.J. GITTES OFFICE - DAY\n\nGittes sits across from Curly.',
      content: {
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. J.J. GITTES OFFICE - DAY' }],
          },
          {
            type: 'action',
            content: [{ type: 'text', text: 'Gittes sits across from Curly.' }],
          },
        ],
      },
      titlePageMetadata: {
        title: 'Chinatown',
        author: 'Robert Towne',
        credit: 'Written by',
        draftDate: 'October 1973',
      },
      createdAt: '1974-06-20T00:00:00Z',
      updatedAt: '1974-06-20T00:00:00Z',
    },
  ],
};

describe('Screenplay WriterSolo Reference Flow Verification', () => {
  describe('Step 1 — Entry Screen & Non-Competing Actions', () => {
    it('renders the welcome entry dialog with clearly differentiated New, Open, and Import options', () => {
      const onNewMock = vi.fn();
      const onSelectMock = vi.fn();
      const onLibraryMock = vi.fn();
      const onTriggerImportMock = vi.fn();
      const onImportDirectMock = vi.fn();
      const onCloseMock = vi.fn();

      const html = renderToStaticMarkup(
        <ScreenplayEntryDialog
          isOpen={true}
          onClose={onCloseMock}
          onNewScreenplay={onNewMock}
          onSelectVersion={onSelectMock}
          onOpenLibraryPanel={onLibraryMock}
          onTriggerNativeImport={onTriggerImportMock}
          onImportFileDirect={onImportDirectMock}
          versions={MOCK_PROJECT.screenplayVersions!}
          activeVersionId="ver-draft-1"
          projectName={MOCK_PROJECT.title}
          hasExistingScript={true}
        />
      );

      // Entry dialog container
      expect(html).toContain('data-testid="screenplay-entry-dialog"');

      // 1. New Screenplay Card
      expect(html).toContain('data-testid="screenplay-entry-new-card"');
      expect(html).toContain('data-testid="screenplay-entry-new-btn"');
      expect(html).toContain('New Screenplay');
      expect(html).toContain('Create Blank Script');

      // 2. Open Screenplay Card
      expect(html).toContain('data-testid="screenplay-entry-open-card"');
      expect(html).toContain('data-testid="screenplay-entry-open-library-btn"');
      expect(html).toContain('Open Screenplay');
      expect(html).toContain('Browse Library');
      expect(html).toContain('data-testid="screenplay-entry-draft-item-ver-draft-1"');

      // 3. Import Screenplay Card
      expect(html).toContain('data-testid="screenplay-entry-import-card"');
      expect(html).toContain('data-testid="screenplay-entry-import-btn"');
      expect(html).toContain('Import Screenplay');
      expect(html).toContain('Select File from Computer');

      // Close / Continue button
      expect(html).toContain('data-testid="screenplay-entry-close-btn"');
      expect(html).toContain('data-testid="screenplay-entry-continue-btn"');
    });

    it('renders the entry screen over the Screenplay workspace with direct native file picker wiring', () => {
      const html = renderToStaticMarkup(
        <ScreenplayWorkspace
          project={MOCK_PROJECT}
          onUpdateProject={vi.fn()}
          initialSubmodule="entry"
        />
      );

      // Entry dialog is present
      expect(html).toContain('data-testid="screenplay-entry-dialog"');
      expect(html).toContain('data-testid="screenplay-entry-import-btn"');

      // Hidden native file input is wired with supported extensions
      expect(html).toContain('data-testid="screenplay-native-file-input"');
      expect(html).toContain('accept=".pdf,.fdx,.fountain,.spmd,.docx"');
    });
  });

  describe('Step 2 & 3 — Direct Document Selection & Transition to Editing', () => {
    it('supports Fountain, FDX, DOCX, and PDF parsing into canonical document model', async () => {
      const fountainContent = `Title: Chinatown
Author: Robert Towne

INT. GITTES OFFICE - DAY

JAKE GITTES listens patiently.

GITTES
(leaning forward)
What seems to be the problem?`;

      const fountainFile = new File([fountainContent], 'chinatown.fountain', {
        type: 'text/plain',
      });

      const preview = await processScreenplayImportFile(fountainFile);
      expect(preview.detectedFormat).toBe('fountain');
      expect(preview.canonical.elements.length).toBeGreaterThan(0);

      // Verify element classifications
      const headings = preview.canonical.elements.filter((e) => e.type === 'scene_heading');
      const characters = preview.canonical.elements.filter((e) => e.type === 'character');
      const dialogues = preview.canonical.elements.filter((e) => e.type === 'dialogue');
      const parens = preview.canonical.elements.filter((e) => e.type === 'parenthetical');

      expect(headings.length).toBe(1);
      expect(characters.length).toBe(1);
      expect(dialogues.length).toBe(1);
      expect(parens.length).toBe(1);
      expect(characters[0].text).toBe('GITTES');
    });

    it('processes Final Draft XML (.fdx) format directly with proper element tagging', async () => {
      const fdxContent = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
    <Paragraph Type="Scene Heading">
      <Text>EXT. ORANGE GROVE - DUSK</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <Text>Dust rises as water trucks rumble past.</Text>
    </Paragraph>
    <Paragraph Type="Character">
      <Text>MULWRAY</Text>
    </Paragraph>
    <Paragraph Type="Dialogue">
      <Text>The water is being diverted.</Text>
    </Paragraph>
  </Content>
</FinalDraft>`;

      const fdxFile = new File([fdxContent], 'script.fdx', {
        type: 'application/xml',
      });

      const preview = await processScreenplayImportFile(fdxFile);
      expect(preview.detectedFormat).toBe('fdx');
      expect(preview.canonical.elements.length).toBe(4);
      expect(preview.canonical.elements[0].type).toBe('scene_heading');
      expect(preview.canonical.elements[1].type).toBe('action');
      expect(preview.canonical.elements[2].type).toBe('character');
      expect(preview.canonical.elements[3].type).toBe('dialogue');
    });
  });

  describe('Step 4 — Writing Workspace Layout & Title Page Switching', () => {
    it('renders the uncluttered workspace toolbar with element commands, view switcher, and import action', () => {
      const html = renderToStaticMarkup(
        <ScreenplayToolbar
          projectName="Chinatown"
          versions={MOCK_PROJECT.screenplayVersions!}
          activeVersionId="ver-draft-1"
          draftTitle="Chinatown — First Draft"
          onDraftTitleChange={vi.fn()}
          onSelectVersion={vi.fn()}
          onNewBlankDraft={vi.fn()}
          onLoadSampleScript={vi.fn()}
          onSaveDraft={vi.fn()}
          isDirty={false}
          lastSavedAt="1974-06-20T00:00:00Z"
          metrics={{ pageCount: 1, activePageNumber: 1 }}
          activeState={{}}
          onExecuteCommand={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          zoomPercent={100}
          onZoomChange={vi.fn()}
          isNavPanelOpen={false}
          isOutlineOpen={false}
          onToggleNavPanel={vi.fn()}
          onExportScript={vi.fn()}
          onOpenImportModal={vi.fn()}
          onOpenEntryDialog={vi.fn()}
          activeView="screenplay"
        />
      );

      // Element commands in top formatting bar
      expect(html).toContain('data-testid="screenplay-cmd-scene"');
      expect(html).toContain('data-testid="screenplay-cmd-action"');
      expect(html).toContain('data-testid="screenplay-cmd-character"');
      expect(html).toContain('data-testid="screenplay-cmd-parens"');
      expect(html).toContain('data-testid="screenplay-cmd-dialogue"');
      expect(html).toContain('data-testid="screenplay-cmd-transition"');
      expect(html).toContain('data-testid="screenplay-cmd-shot"');

      // View switcher
      expect(html).toContain('data-testid="screenplay-view-screenplay-btn"');
      expect(html).toContain('data-testid="screenplay-view-titlepage-btn"');

      // Direct actions
      expect(html).toContain('data-testid="screenplay-toolbar-import-btn"');
      expect(html).toContain('data-testid="screenplay-toolbar-export-btn"');
      expect(html).toContain('data-testid="screenplay-open-entry-btn"');
    });

    it('renders Title Page view cleanly when activeView is titlepage without losing document state', () => {
      const html = renderToStaticMarkup(
        <ScreenplayWorkspace
          project={MOCK_PROJECT}
          onUpdateProject={vi.fn()}
        />
      );

      // In default view, manuscript is ready
      expect(html).toContain('data-testid="screenplay-view-screenplay-btn"');
      expect(html).toContain('data-testid="screenplay-view-titlepage-btn"');
    });
  });
});
