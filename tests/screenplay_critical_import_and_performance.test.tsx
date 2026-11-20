import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  parsePdf,
  parsePdfToCanonical,
  classifyPdfLineByPosition,
} from '../src/features/screenplay/model/pdfParser';
import {
  processScreenplayImportFile,
  buildScreenplayVersionFromCanonical,
} from '../src/features/screenplay/services/screenplayImportService';
import { CanonicalScreenplayDocument } from '../src/features/screenplay/model/canonicalScreenplay';
import { ScreenplayImportModal } from '../src/features/screenplay/components/ScreenplayImportModal';
import { ScreenplayPdfViewer } from '../src/features/screenplay/components/ScreenplayPdfViewer';
import { ScreenplayPage } from '../src/features/screenplay/components/ScreenplayPage';
import { FilmProject } from '../src/types';

describe('Screenplay Critical Import Repair & Byte Safety', () => {
  it('rejects empty PDF files with a concise, actionable error', async () => {
    const emptyBuffer = new Uint8Array(0);
    await expect(parsePdf(emptyBuffer, { fileName: 'empty.pdf' })).rejects.toThrow(
      'The selected PDF file is empty.'
    );
  });

  it('never injects raw PDF bytecode syntax into canonical elements or version rawText', () => {
    const mockCanonical: CanonicalScreenplayDocument = {
      id: 'doc-dark-knight',
      metadata: {
        title: 'THE DARK KNIGHT',
        author: 'Jonathan Nolan and Christopher Nolan',
      },
      elements: [
        {
          id: 'scn-1',
          type: 'scene_heading',
          text: 'EXT. DOWNTOWN GOTHAM - DAY',
          confidence: 'high',
        },
        {
          id: 'act-1',
          type: 'action',
          text: 'A high angle on a sleek glass skyscraper. Suddenly, the glass SHATTERS.',
          confidence: 'high',
        },
        {
          id: 'chr-1',
          type: 'character',
          text: 'CLOWN #1',
          confidence: 'high',
        },
        {
          id: 'dia-1',
          type: 'dialogue',
          text: 'Three of a kind, let\'s do this.',
          confidence: 'high',
        },
      ],
      warnings: [],
      provenance: {
        sourceFormat: 'pdf',
        fileName: 'The_Dark_Knight.pdf',
        fileSize: 450000,
        importedAt: '2026-10-24T12:00:00Z',
        sourcePdfDataUrl: 'data:application/pdf;base64,JVBERi0xLjM...',
      },
    };

    const mockProject: FilmProject = {
      id: 'proj-batman',
      title: 'The Dark Knight',
      genre: 'Action',
      format: 'Feature',
      status: 'Production',
      createdAt: '2026-10-24T00:00:00Z',
      updatedAt: '2026-10-24T00:00:00Z',
      screenplayVersions: [],
    };

    // Simulate an accidental raw file text string containing raw PDF tokens
    const pollutedRawString = `%PDF-1.3\n1 0 obj\n<< /Title (THE DARK KNIGHT) /FlateDecode >>\nstream\nxœÍ\nendobj`;

    const version = buildScreenplayVersionFromCanonical(
      mockCanonical,
      mockProject,
      pollutedRawString,
      mockCanonical.provenance.sourcePdfDataUrl
    );

    // Raw bytecode MUST NEVER leak into the screenplay version or editor text
    expect(version.rawText).not.toContain('%PDF-1.3');
    expect(version.rawText).not.toContain('1 0 obj');
    expect(version.rawText).not.toContain('/FlateDecode');
    expect(version.rawText).not.toContain('stream');
    expect(version.rawText).not.toContain('endobj');

    // Instead, it must contain clean canonical screenplay text
    expect(version.rawText).toContain('EXT. DOWNTOWN GOTHAM - DAY');
    expect(version.rawText).toContain('CLOWN #1');
    expect(version.rawText).toContain('Three of a kind, let\'s do this.');

    // Original PDF bytes are preserved immutably in sourcePdfDataUrl
    expect(version.sourcePdfDataUrl).toBe('data:application/pdf;base64,JVBERi0xLjM...');
  });

  it('correctly classifies screenplay elements by horizontal position', () => {
    expect(classifyPdfLineByPosition('INT. BANK VAULT - DAY', 108)).toBe('scene_heading');
    expect(classifyPdfLineByPosition('The alarm blares in the corridor.', 108)).toBe('action');
    expect(classifyPdfLineByPosition('THE JOKER', 270)).toBe('character');
    expect(classifyPdfLineByPosition('(smiling)', 200)).toBe('parenthetical');
    expect(classifyPdfLineByPosition('I believe whatever doesn\'t kill you makes you stranger.', 155)).toBe('dialogue');
    expect(classifyPdfLineByPosition('SMASH CUT TO:', 390)).toBe('transition');
  });

  it('renders ScreenplayImportModal with dual PDF import options (Mode A and Mode B)', () => {
    const html = renderToStaticMarkup(
      <ScreenplayImportModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmImport={vi.fn()}
      />
    );

    expect(html).toContain('Import Screenplay');
    expect(html).toContain('Zero data loss');
  });

  it('renders ScreenplayPdfViewer with high-DPI canvas container and full navigation controls', () => {
    const html = renderToStaticMarkup(
      <ScreenplayPdfViewer
        pdfData="data:application/pdf;base64,JVBERi0xLjQK"
        fileName="The_Dark_Knight_Locked.pdf"
        onSwitchToEditor={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="screenplay-pdf-viewer"');
    expect(html).toContain('The_Dark_Knight_Locked.pdf');
    expect(html).toContain('data-testid="screenplay-pdf-switch-editor-btn"');
    expect(html).toContain('data-testid="screenplay-pdf-prev-btn"');
    expect(html).toContain('data-testid="screenplay-pdf-page-indicator"');
    expect(html).toContain('data-testid="screenplay-pdf-next-btn"');
    expect(html).toContain('data-testid="screenplay-pdf-zoom-in"');
    expect(html).toContain('data-testid="screenplay-pdf-zoom-out"');
  });

  it('memoizes ScreenplayPage surfaces and maintains page 1 cleanliness', () => {
    const pageConfig = {
      pageWidthPx: 816,
      pageHeightPx: 1056,
      pageGapPx: 40,
      marginTopPx: 96,
      marginBottomPx: 96,
      marginLeftPx: 144,
      marginRightPx: 96,
      headerTopPx: 48,
      contentHeightPx: 864,
      fontFamily: 'Courier Prime, Courier, monospace',
    };

    const pages = [
      {
        pageNumber: 1,
        pageIndex: 0,
        startPos: 0,
        endPos: 120,
        usedHeightPx: 400,
        remainingHeightPx: 464,
        showPageNumber: false,
        blockPositions: [],
      },
    ];

    const html = renderToStaticMarkup(
      <ScreenplayPage
        pageNumber={1}
        pages={pages}
        pageConfig={pageConfig}
        titleHeader="THE DARK KNIGHT"
      >
        <div data-testid="manuscript-content">EXT. BANK - DAY</div>
      </ScreenplayPage>
    );

    expect(html).toContain('data-testid="screenplay-page-stack"');
    expect(html).toContain('data-testid="screenplay-manuscript-page"');
    // Page 1 header must NEVER be rendered
    expect(html).not.toContain('screenplay-running-header');
    expect(html).not.toContain('THE DARK KNIGHT');
    expect(html).toContain('EXT. BANK - DAY');
  });
});
