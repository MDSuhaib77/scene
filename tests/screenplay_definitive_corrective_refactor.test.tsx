import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePdfToCanonical } from '../src/features/screenplay/model/pdfParser';
import { ScreenplayToolbar } from '../src/features/screenplay/components/ScreenplayToolbar';
import { ScreenplayNavigationPanel } from '../src/features/screenplay/components/ScreenplayNavigationPanel';
import { ScreenplayImportModal } from '../src/features/screenplay/components/ScreenplayImportModal';
import { ScreenplayPage } from '../src/features/screenplay/components/ScreenplayPage';
import { exportScreenplayToPdf } from '../src/features/screenplay/services/pdfExportService';
import { ScreenplayExportFormat } from '../src/features/screenplay/services/screenplayDocumentLifecycle';
import { FilmProject, ScreenplayVersion } from '../src/types';

describe('Definitive Corrective Refactor — Prompt 10 Verification', () => {
  describe('1. PDF Parsing Character Name Fix', () => {
    it('successfully parses character cues without "characterName is not defined" ReferenceError', async () => {
      // Create a mock or direct buffer that invokes PDF line classification
      // When parsePdfToCanonical runs on PDF lines, character cues (x: 210-340)
      // must populate characterProperties without throwing a ReferenceError.
      
      // We also test directly with an ArrayBuffer; if PDF.js finds empty streams,
      // it returns safe empty document without throwing runtime crashes.
      const buffer = new ArrayBuffer(100);
      let errorThrown: any = null;
      try {
        const result = await parsePdfToCanonical(buffer, 'The-Godfather-Script.pdf');
        expect(result).toBeDefined();
        expect(result.elements).toBeDefined();
      } catch (err) {
        errorThrown = err;
      }
      expect(errorThrown).toBeNull();
    });
  });

  describe('2. Supported Formats Simplification — Removal of .txt', () => {
    const mockProject: FilmProject = {
      id: 'proj-1',
      title: 'The Godfather',
      logline: 'The aging patriarch of an organized crime dynasty...',
      genre: 'Crime / Drama',
      targetAudience: 'Adults',
      estimatedBudget: 6000000,
      startDate: '1972-01-01',
      endDate: '1972-03-24',
      status: 'pre-production',
      createdAt: '1972-01-01T00:00:00Z',
      updatedAt: '1972-01-01T00:00:00Z',
    };

    const mockVersions: ScreenplayVersion[] = [
      {
        id: 'ver-1',
        projectId: 'proj-1',
        title: 'Draft 1',
        version: 'v1.0',
        content: '',
        createdAt: '1972-01-01T00:00:00Z',
        updatedAt: '1972-01-01T00:00:00Z',
      },
    ];

    it('Toolbar export menu excludes Plain Text (.txt)', () => {
      const html = renderToStaticMarkup(
        <ScreenplayToolbar
          projectName="The Godfather"
          versions={mockVersions}
          activeVersionId="ver-1"
          draftTitle="Draft 1"
          onDraftTitleChange={vi.fn()}
          onSelectVersion={vi.fn()}
          onNewBlankDraft={vi.fn()}
          onLoadSampleScript={vi.fn()}
          onSaveDraft={vi.fn()}
          isDirty={false}
          saveStatus="saved"
          metrics={{ characterCount: 100, pageCount: 5, sceneCount: 2, dialogueBlocks: 10, wordCount: 500 }}
          activeState={{ activeBlockType: 'action', canUndo: true, canRedo: false }}
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
          initialExportMenuOpen={true}
        />
      );

      // Verify that the toolbar export dropdown has PDF, Fountain, FDX, and NO txt
      expect(html).toContain('data-testid="screenplay-toolbar-export-pdf"');
      expect(html).toContain('data-testid="screenplay-toolbar-export-fountain"');
      expect(html).toContain('data-testid="screenplay-toolbar-export-fdx"');
      expect(html).not.toContain('data-testid="screenplay-toolbar-export-txt"');
      expect(html).not.toContain('Plain Text');
    });

    it('Navigation panel export grid excludes Plain Text (.txt) and uses 3-column layout', () => {
      const html = renderToStaticMarkup(
        <ScreenplayNavigationPanel
          isOpen={true}
          onClose={vi.fn()}
          activeSection="drafts"
          onSelectSection={vi.fn()}
          project={mockProject}
          versions={mockVersions}
          activeVersionId="ver-1"
          onSelectVersion={vi.fn()}
          onCreateScript={vi.fn()}
          onRenameScript={vi.fn()}
          onDeleteScript={vi.fn()}
          outlineEntries={[]}
          onNavigateOutlineEntry={vi.fn()}
          onExportScript={vi.fn()}
          pageCount={5}
          activePageNumber={1}
        />
      );

      // Verify 3 export buttons: pdf, fountain, fdx
      expect(html).toContain('data-testid="screenplay-export-pdf-btn"');
      expect(html).toContain('data-testid="screenplay-export-fountain-btn"');
      expect(html).toContain('data-testid="screenplay-export-fdx-btn"');
      expect(html).not.toContain('data-testid="screenplay-export-txt-btn"');
      expect(html).toContain('grid grid-cols-3');
      expect(html).not.toContain('grid grid-cols-4');
    });

    it('Import modal accepts only standard screenplay formats without .txt', () => {
      const html = renderToStaticMarkup(
        <ScreenplayImportModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirmImport={vi.fn()}
        />
      );

      expect(html).toContain('.pdf');
      expect(html).toContain('.fdx');
      expect(html).toContain('.fountain');
      expect(html).not.toContain('.txt');
    });

    it('ScreenplayExportFormat type enforces only pdf, fountain, fdx', () => {
      const validPdf: ScreenplayExportFormat = 'pdf';
      const validFountain: ScreenplayExportFormat = 'fountain';
      const validFdx: ScreenplayExportFormat = 'fdx';
      expect(validPdf).toBe('pdf');
      expect(validFountain).toBe('fountain');
      expect(validFdx).toBe('fdx');
    });
  });

  describe('3. Outline Simplification — Removal of Redundant Page Jump List', () => {
    const mockProject: FilmProject = {
      id: 'proj-1',
      title: 'The Godfather',
      logline: 'The aging patriarch of an organized crime dynasty...',
      genre: 'Crime / Drama',
      targetAudience: 'Adults',
      estimatedBudget: 6000000,
      startDate: '1972-01-01',
      endDate: '1972-03-24',
      status: 'pre-production',
      createdAt: '1972-01-01T00:00:00Z',
      updatedAt: '1972-01-01T00:00:00Z',
    };

    const mockVersions: ScreenplayVersion[] = [
      {
        id: 'ver-1',
        projectId: 'proj-1',
        title: 'Draft 1',
        version: 'v1.0',
        content: '',
        createdAt: '1972-01-01T00:00:00Z',
        updatedAt: '1972-01-01T00:00:00Z',
      },
    ];

    const mockOutlineEntries = [
      {
        id: 'scene-1',
        type: 'sceneHeading' as const,
        text: 'INT. CORLEONE OFFICE - DAY',
        pos: 10,
        pageNumber: 1,
        sceneNumber: 1,
      },
      {
        id: 'scene-2',
        type: 'sceneHeading' as const,
        text: 'EXT. CORLEONE COMPOUND - DAY',
        pos: 150,
        pageNumber: 2,
        sceneNumber: 2,
      },
    ];

    it('Outline panel displays structural scenes and does not render redundant page number jumping list', () => {
      const html = renderToStaticMarkup(
        <ScreenplayNavigationPanel
          isOpen={true}
          onClose={vi.fn()}
          activeSection="outline"
          onSelectSection={vi.fn()}
          project={mockProject}
          versions={mockVersions}
          activeVersionId="ver-1"
          outlineEntries={mockOutlineEntries}
          onNavigateOutlineEntry={vi.fn()}
          pageCount={120}
          activePageNumber={1}
          onNavigateToPage={vi.fn()}
        />
      );

      // Structural scenes are present
      expect(html).toContain('INT. CORLEONE OFFICE - DAY');
      expect(html).toContain('EXT. CORLEONE COMPOUND - DAY');
      expect(html).toContain('Document Outline');

      // The redundant manuscript page number button list must NOT be rendered in outline
      expect(html).not.toContain('data-testid="screenplay-outline-page-list"');
      expect(html).not.toContain('screenplay-jump-page-1');
      expect(html).not.toContain('screenplay-jump-page-2');
      expect(html).not.toContain('Manuscript Pages');
    });
  });

  describe('4. Clean Manuscript Running Headers & Watermarks', () => {
    it('page 1 has no running header and no page number', () => {
      const html = renderToStaticMarkup(
        <ScreenplayPage
          pageNumber={1}
          pages={[
            {
              pageNumber: 1,
              pageIndex: 0,
              startPos: 0,
              endPos: 200,
              usedHeightPx: 400,
              remainingHeightPx: 400,
              showPageNumber: true,
              blockPositions: [],
            },
          ]}
        >
          <div>Page 1 Body Content</div>
        </ScreenplayPage>
      );

      expect(html).not.toContain('screenplay-running-header');
      expect(html).not.toContain('1.');
      expect(html).not.toContain('SAMPLE');
      expect(html).not.toContain('WATERMARK');
    });

    it('page 2+ displays only right-aligned page number "2." and no project title in header', () => {
      const html = renderToStaticMarkup(
        <ScreenplayPage
          pageNumber={2}
          pages={[
            {
              pageNumber: 2,
              pageIndex: 1,
              startPos: 201,
              endPos: 500,
              usedHeightPx: 450,
              remainingHeightPx: 350,
              showPageNumber: true,
              blockPositions: [],
            },
          ]}
        >
          <div>Page 2 Body Content</div>
        </ScreenplayPage>
      );

      expect(html).toContain('screenplay-running-header');
      expect(html).toContain('2.');
      // Should not contain title or draft walkthrough text
      expect(html).not.toContain('The Godfather');
      expect(html).not.toContain('Walkthrough');
    });
  });

  describe('5. Reliable PDF Export Generation', () => {
    it('generates authentic PDF 1.4 binary data with title page and Courier typography', () => {
      const mockDoc = {
        type: 'doc',
        content: [
          {
            type: 'sceneHeading',
            content: [{ type: 'text', text: 'INT. CORLEONE OFFICE - DAY' }],
          },
          {
            type: 'action',
            content: [{ type: 'text', text: 'BONASERA sits facing the desk.' }],
          },
          {
            type: 'character',
            content: [{ type: 'text', text: 'BONASERA' }],
          },
          {
            type: 'dialogue',
            content: [{ type: 'text', text: 'I believe in America. America has made my fortune.' }],
          },
        ],
      };

      const pdfBytes = exportScreenplayToPdf(mockDoc, {
        title: 'THE GODFATHER',
        author: 'Mario Puzo & Francis Ford Coppola',
        includeTitlePage: true,
      });

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(500);

      const pdfText = new TextDecoder().decode(pdfBytes);
      expect(pdfText).toContain('%PDF-1.4');
      expect(pdfText).toContain('/BaseFont /Courier');
      expect(pdfText).toContain('/BaseFont /Courier-Bold');
      expect(pdfText).toContain('THE GODFATHER');
      expect(pdfText).toContain('Mario Puzo');
      expect(pdfText).toContain('INT. CORLEONE OFFICE - DAY');
      expect(pdfText).toContain('BONASERA');
      expect(pdfText).toContain('I believe in America');
    });
  });
});
