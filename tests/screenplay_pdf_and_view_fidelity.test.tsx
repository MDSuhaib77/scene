import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  classifyPdfLineByPosition,
  parsePdfToCanonical,
} from '../src/features/screenplay/model/pdfParser';
import { ScreenplayTitlePageView } from '../src/features/screenplay/components/ScreenplayTitlePageView';
import { ScreenplayPdfViewer } from '../src/features/screenplay/components/ScreenplayPdfViewer';
import { ScreenplayToolbar } from '../src/features/screenplay/components/ScreenplayToolbar';
import { ScreenplayPage } from '../src/features/screenplay/components/ScreenplayPage';
import { processScreenplayImportFile } from '../src/features/screenplay/services/screenplayImportService';
import { FilmProject, ScreenplayVersion } from '../src/types';

describe('Screenplay PDF Support & Positional Extraction', () => {
  it('correctly classifies screenplay elements based on horizontal indentation positions', () => {
    // Left margin (~108pt or 1.5 in) = Scene Heading or Action
    const sceneHeading = classifyPdfLineByPosition('INT. COFFEE SHOP - DAY', 108);
    expect(sceneHeading).toBe('scene_heading');

    const action = classifyPdfLineByPosition('Sarah puts down her steaming porcelain cup.', 108);
    expect(action).toBe('action');

    // Indented ~250pt (character dialogue cue)
    const character = classifyPdfLineByPosition('SARAH', 250);
    expect(character).toBe('character');

    // Indented ~200pt (parenthetical)
    const parenthetical = classifyPdfLineByPosition('(whispering softly)', 200);
    expect(parenthetical).toBe('parenthetical');

    // Indented ~150pt (dialogue text)
    const dialogue = classifyPdfLineByPosition('We cannot talk here. They are watching.', 150);
    expect(dialogue).toBe('dialogue');

    // Indented ~380pt (transition)
    const transition = classifyPdfLineByPosition('DISSOLVE TO:', 380);
    expect(transition).toBe('transition');
  });

  it('detects scanned / image-only PDFs when extracted character count is low', async () => {
    // ArrayBuffer with no text content
    const emptyPdfBuffer = new ArrayBuffer(50);
    const result = await parsePdfToCanonical(emptyPdfBuffer, 'scanned_script.pdf');

    expect(result.warnings.some((w) => w.id === 'pdf-scanned-image')).toBe(true);
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('processes PDF file with Mode A and Mode B options preserving original PDF data', async () => {
    // Mock minimal PDF file with arrayBuffer
    const fakePdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // '%PDF-1.4'
    const fakeFile = {
      name: 'Chinatown_Draft.pdf',
      size: 1024,
      arrayBuffer: async () => fakePdfBytes.buffer,
    } as unknown as File;

    const result = await processScreenplayImportFile(fakeFile);
    expect(result.detectedFormat).toBe('pdf');
    expect(result.pdfPageCount).toBeGreaterThanOrEqual(1);
    expect(result.originalPdfData).toContain('data:application/pdf;base64,');
  });
});

describe('Screenplay Title Page Separation', () => {
  it('renders dedicated US letter title page without polluting manuscript body', () => {
    const metadata = {
      title: 'CHINATOWN',
      credit: 'written by',
      author: 'Robert Towne',
      source: 'Original Screenplay',
      draftDate: 'October 9, 1973',
      contact: 'Agency: ICM Partners\nLos Angeles, CA',
    };

    const html = renderToStaticMarkup(
      <ScreenplayTitlePageView
        metadata={metadata}
        onChangeMetadata={vi.fn()}
        readOnly={false}
      />
    );

    expect(html).toContain('data-testid="screenplay-title-page-view"');
    expect(html).toContain('CHINATOWN');
    expect(html).toContain('Robert Towne');
    expect(html).toContain('October 9, 1973');
    expect(html).toContain('ICM Partners');
    // Title page is styled with standard US Letter dimensions
    expect(html).toContain('width:816px');
    expect(html).toContain('min-height:1056px');
  });
});

describe('Screenplay Manuscript Page 1 Cleanliness', () => {
  it('never displays running header or page number on page 1', () => {
    const page1Config = {
      pageWidth: 816,
      pageHeight: 1056,
      topMargin: 96,
      bottomMargin: 96,
      leftMargin: 144,
      rightMargin: 96,
      usableHeight: 864,
      usableWidth: 576,
      headerBaseline: 48,
    };

    const pages = [
      {
        pageNumber: 1,
        startPos: 0,
        endPos: 100,
        sceneNumber: '1',
        isSceneBreak: false,
      },
    ];

    const html = renderToStaticMarkup(
      <ScreenplayPage
        pageNumber={1}
        pages={pages}
        pageConfig={page1Config}
        titleHeader="SHOULD NEVER DISPLAY ON PAGE 1"
      >
        <div data-testid="test-content">Page 1 Content</div>
      </ScreenplayPage>
    );

    // Page 1 must NOT contain a running header or page number
    expect(html).not.toContain('screenplay-running-header');
    expect(html).not.toContain('SHOULD NEVER DISPLAY ON PAGE 1');
    expect(html).toContain('Page 1 Content');
  });

  it('displays running header and page number on page 2 and subsequent pages', () => {
    const page2Config = {
      pageWidth: 816,
      pageHeight: 1056,
      topMargin: 96,
      bottomMargin: 96,
      leftMargin: 144,
      rightMargin: 96,
      usableHeight: 864,
      usableWidth: 576,
      headerBaseline: 48,
    };

    const pages = [
      {
        pageNumber: 2,
        startPos: 101,
        endPos: 250,
        sceneNumber: '2',
        isSceneBreak: false,
      },
    ];

    const html = renderToStaticMarkup(
      <ScreenplayPage
        pageNumber={2}
        pages={pages}
        pageConfig={page2Config}
        titleHeader="CHINATOWN"
      >
        <div>Page 2 Content</div>
      </ScreenplayPage>
    );

    expect(html).toContain('screenplay-running-header');
    expect(html).toContain('CHINATOWN');
    expect(html).toContain('2.');
  });
});

describe('Screenplay Workspace Quiet Toolbar', () => {
  it('renders a compact single-row toolbar without secondary button clutter', () => {
    const mockVersion: ScreenplayVersion = {
      id: 'ver-1',
      version: 'v1.0',
      title: 'The Great American Screenplay — Final Polish Locked Production Draft with Long Subtitle',
      author: 'Jane Screenwriter',
      updatedAt: '2026-10-22T00:00:00Z',
      changeDescription: 'Initial draft',
      status: 'Draft',
    };

    const html = renderToStaticMarkup(
      <ScreenplayToolbar
        projectName="Film Project"
        versions={[mockVersion]}
        activeVersionId="ver-1"
        draftTitle={mockVersion.title}
        onDraftTitleChange={vi.fn()}
        onSelectVersion={vi.fn()}
        onNewBlankDraft={vi.fn()}
        onLoadSampleScript={vi.fn()}
        onSaveDraft={vi.fn()}
        isDirty={false}
        saveStatus="saved"
        lastSavedAt="2026-10-22T00:00:00Z"
        metrics={{ characterCount: 100, dialogueCount: 50, sceneCount: 10, pageCount: 5, readTimeMinutes: 5 }}
        activeState={{ currentElementType: 'action', canUndo: true, canRedo: false }}
        pageCount={5}
        activePageNumber={1}
        onNavigateToPage={vi.fn()}
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
        activeView="screenplay"
        onSelectView={vi.fn()}
        hasOriginalPdf={true}
      />
    );

    // Primary toolbar present
    expect(html).toContain('data-testid="screenplay-primary-toolbar"');
    // Truncates long title cleanly
    expect(html).toContain('data-testid="screenplay-draft-selector-btn"');
    // Contextual element picker present
    expect(html).toContain('data-testid="screenplay-element-selector-btn"');
    // View switcher present (Screenplay, Title Page, Original PDF)
    expect(html).toContain('data-testid="screenplay-view-screenplay-btn"');
    expect(html).toContain('data-testid="screenplay-view-titlepage-btn"');
    expect(html).toContain('data-testid="screenplay-view-pdf-btn"');
    // Save status present
    expect(html).toContain('data-testid="screenplay-save-status-label"');
    // Navigation & focus buttons present
    expect(html).toContain('data-testid="screenplay-page-indicator"');
    expect(html).toContain('data-testid="screenplay-toolbar-focus-btn"');

    // Must NOT contain the old secondary horizontal bar with 16 duplicate buttons
    expect(html).not.toContain('screenplay-secondary-formatting-bar');
  });
});

describe('Source-Faithful PDF Viewer Component', () => {
  it('renders Mode A viewer with zoom controls and switch button', () => {
    const html = renderToStaticMarkup(
      <ScreenplayPdfViewer
        pdfData="data:application/pdf;base64,JVBERi0xLjQK"
        fileName="Chinatown_Original.pdf"
        onSwitchToEditor={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="screenplay-pdf-viewer"');
    expect(html).toContain('Chinatown_Original.pdf');
    expect(html).toContain('data-testid="screenplay-pdf-zoom-in"');
    expect(html).toContain('data-testid="screenplay-pdf-zoom-out"');
    expect(html).toContain('data-testid="screenplay-pdf-switch-editor-btn"');
  });
});
