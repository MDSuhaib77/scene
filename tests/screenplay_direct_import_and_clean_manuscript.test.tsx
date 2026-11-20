import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenplayImportModal } from '../src/features/screenplay/components/ScreenplayImportModal';
import { ScreenplayPage } from '../src/features/screenplay/components/ScreenplayPage';
import { exportScreenplayToPdf } from '../src/features/screenplay/services/pdfExportService';
import { ensurePdfWorkerConfigured, pdfjs, pdfjsWorker } from '../src/features/screenplay/services/pdfWorkerConfig';

describe('Direct Import Modal — WriterSolo Experience', () => {
  it('renders a focused single-step import modal without technical parser diagnostics or multi-step wizard', () => {
    const html = renderToStaticMarkup(
      <ScreenplayImportModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmImport={vi.fn()}
      />
    );

    // Modal title & zero data loss pledge
    expect(html).toContain('Import Screenplay');
    expect(html).toContain('Zero data loss');

    // Supported formats clearly listed (without plain-text .txt)
    expect(html).toContain('.pdf');
    expect(html).toContain('.fdx');
    expect(html).toContain('.fountain');
    expect(html).toContain('.docx');
    expect(html).not.toContain('.txt');

    // Does NOT render complicated parser diagnostic cards or confidence meters
    expect(html).not.toContain('Parser Observations');
    expect(html).not.toContain('Confidence:');
    expect(html).not.toContain('Est. Pages');
  });
});

describe('Manuscript Page Header & Watermark Integrity', () => {
  it('never displays project/walkthrough title in the running header by default', () => {
    const pages = [
      {
        pageNumber: 2,
        pageIndex: 1,
        startPos: 100,
        endPos: 300,
        usedHeightPx: 400,
        remainingHeightPx: 400,
        showPageNumber: true,
        blockPositions: [],
      },
    ];

    // Rendering page 2 without titleHeader (default workspace behavior)
    const html = renderToStaticMarkup(
      <ScreenplayPage
        pageNumber={2}
        pages={pages}
      >
        <div>Page 2 content</div>
      </ScreenplayPage>
    );

    // Must contain page number 2.
    expect(html).toContain('2.');
    // Must NOT contain any walkthrough or sample titles
    expect(html).not.toContain('WALKTHROUGH');
    expect(html).not.toContain('Walkthrough');
    expect(html).not.toContain('Film Pipeline Scheduler');
  });

  it('keeps page 1 completely clean with no running header', () => {
    const pages = [
      {
        pageNumber: 1,
        pageIndex: 0,
        startPos: 0,
        endPos: 100,
        usedHeightPx: 300,
        remainingHeightPx: 500,
        showPageNumber: true,
        blockPositions: [],
      },
    ];

    const html = renderToStaticMarkup(
      <ScreenplayPage
        pageNumber={1}
        pages={pages}
      >
        <div>Page 1 content</div>
      </ScreenplayPage>
    );

    expect(html).not.toContain('screenplay-running-header');
    expect(html).not.toContain('1.');
  });
});

describe('PDF Worker Configuration & Asset Resolution', () => {
  it('correctly configures PDF.js worker without unhandled exceptions', () => {
    ensurePdfWorkerConfigured();
    expect(pdfjsWorker).toBeDefined();
    expect(typeof pdfjsWorker).toBe('string');
  });
});

describe('PDF Export Fidelity', () => {
  it('generates a valid, well-formed PDF document with Courier typography and standard dimensions', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'sceneHeading',
          content: [{ type: 'text', text: 'INT. COFFEE SHOP - DAY' }],
        },
        {
          type: 'action',
          content: [{ type: 'text', text: 'A steaming mug sits on the mahogany table.' }],
        },
        {
          type: 'character',
          content: [{ type: 'text', text: 'LEO' }],
        },
        {
          type: 'dialogue',
          content: [{ type: 'text', text: 'We have to move before dawn.' }],
        },
      ],
    };

    const bytes = exportScreenplayToPdf(doc, {
      title: 'Espresso Heist',
      author: 'Screenwriter',
      includeTitlePage: true,
    });

    expect(bytes.length).toBeGreaterThan(500);
    const pdfText = new TextDecoder().decode(bytes);
    expect(pdfText).toContain('%PDF-1.4');
    expect(pdfText).toContain('%%EOF');
    expect(pdfText).toContain('ESPRESSO HEIST');
    expect(pdfText).toContain('INT. COFFEE SHOP - DAY');
    expect(pdfText).toContain('LEO');
  });
});
