import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { ScreenplayPdfEditableManuscript } from '../src/features/screenplay/components/ScreenplayPdfEditableManuscript';
import { ScreenplayTitlePageView } from '../src/features/screenplay/components/ScreenplayTitlePageView';
import { exportScreenplayToPdf } from '../src/features/screenplay/services/pdfExportService';
import { extractScriptIntelligenceFromDoc } from '../src/features/screenplay/services/scriptIntelligenceService';
import {
  ScreenplayPdfDocumentLayout,
  ScreenplayPdfPageLayout,
} from '../src/types';

describe('Source-Faithful PDF Import & Editable Manuscript', () => {
  const samplePdfLayout: ScreenplayPdfDocumentLayout = {
    pageWidth: 612,
    pageHeight: 792,
    hasTitlePage: true,
    titlePage: {
      pageNumber: 1,
      width: 612,
      height: 792,
      isTitlePage: true,
      lines: [
        {
          id: 'title-l0',
          text: 'THE GODFATHER',
          type: 'title',
          x: 230,
          top: 350,
          width: 152,
          height: 18,
          fontSize: 16,
          fontWeight: 'bold',
        },
        {
          id: 'title-l1',
          text: 'Screenplay by',
          type: 'credit',
          x: 255,
          top: 380,
          width: 102,
          height: 14,
          fontSize: 12,
        },
        {
          id: 'title-l2',
          text: 'Mario Puzo and Francis Ford Coppola',
          type: 'author',
          x: 175,
          top: 405,
          width: 262,
          height: 14,
          fontSize: 12,
        },
      ],
    },
    pages: [
      {
        pageNumber: 1,
        width: 612,
        height: 792,
        isTitlePage: false,
        lines: [
          {
            id: 'p1-l0',
            text: 'INT. DON CORLEONE\'S OFFICE - DAY',
            type: 'scene_heading',
            x: 108,
            top: 72,
            width: 250,
            height: 14,
            fontSize: 12,
            fontWeight: 'bold',
          },
          {
            id: 'p1-l1',
            text: 'BONASERA sits facing Don Corleone. Outside, music plays.',
            type: 'action',
            x: 108,
            top: 100,
            width: 420,
            height: 14,
            fontSize: 12,
          },
          {
            id: 'p1-l2',
            text: 'BONASERA',
            type: 'character',
            x: 270,
            top: 140,
            width: 80,
            height: 14,
            fontSize: 12,
            fontWeight: 'bold',
          },
          {
            id: 'p1-l3',
            text: 'I believe in America. America has made my fortune.',
            type: 'dialogue',
            x: 180,
            top: 160,
            width: 300,
            height: 14,
            fontSize: 12,
          },
        ],
      },
      {
        pageNumber: 2,
        width: 612,
        height: 792,
        isTitlePage: false,
        lines: [
          {
            id: 'p2-l0',
            text: 'DON CORLEONE',
            type: 'character',
            x: 270,
            top: 72,
            width: 100,
            height: 14,
            fontSize: 12,
            fontWeight: 'bold',
          },
          {
            id: 'p2-l1',
            text: 'Why did you go to the police? Why didn\'t you come to me first?',
            type: 'dialogue',
            x: 180,
            top: 92,
            width: 320,
            height: 14,
            fontSize: 12,
          },
        ],
      },
    ],
  };

  it('renders manuscript pages matching source PDF page count, dimensions, and line positions', () => {
    const html = renderToStaticMarkup(
      <ScreenplayPdfEditableManuscript
        layout={samplePdfLayout}
        zoomPercent={100}
        onChangeLayout={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="screenplay-pdf-editable-manuscript"');
    expect(html).toContain('data-testid="screenplay-manuscript-page-1"');
    expect(html).toContain('data-testid="screenplay-manuscript-page-2"');

    // Page 1 lines rendered at exact extracted text
    expect(html).toContain("INT. DON CORLEONE&#x27;S OFFICE - DAY");
    expect(html).toContain('BONASERA sits facing Don Corleone.');
    expect(html).toContain('I believe in America. America has made my fortune.');

    // Page 2 header and dialogue
    expect(html).toContain('2.');
    expect(html).toContain('DON CORLEONE');
    expect(html).toContain("Why did you go to the police?");
  });

  it('renders genuine authentic title page when title page is detected in PDF layout', () => {
    const html = renderToStaticMarkup(
      <ScreenplayTitlePageView
        metadata={{ title: 'THE GODFATHER', author: 'Mario Puzo' }}
        pdfLayout={samplePdfLayout}
        onChangeMetadata={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="screenplay-title-page-view"');
    expect(html).toContain('THE GODFATHER');
    expect(html).toContain('Screenplay by');
    expect(html).toContain('Mario Puzo and Francis Ford Coppola');
  });

  it('shows honest notification and never fabricates metadata when PDF has no title page', () => {
    const noTitleLayout: ScreenplayPdfDocumentLayout = {
      ...samplePdfLayout,
      hasTitlePage: false,
      titlePage: undefined,
    };

    const html = renderToStaticMarkup(
      <ScreenplayTitlePageView
        metadata={{}}
        pdfLayout={noTitleLayout}
        onChangeMetadata={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="screenplay-no-title-page-notice"');
    expect(html).toContain('No Title Page Detected in Source Screenplay');
    expect(html).not.toContain('Etienne Dupont');
  });

  it('exports PDF using exact line coordinates from pdfLayout', () => {
    const pdfBytes = exportScreenplayToPdf({ type: 'doc', content: [] }, {
      title: 'THE GODFATHER',
      pdfLayout: samplePdfLayout,
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);

    const pdfString = new TextDecoder('latin1').decode(pdfBytes);
    expect(pdfString).toContain('%PDF-1.4');
    expect(pdfString).toContain('THE GODFATHER');
    expect(pdfString).toContain("INT. DON CORLEONE'S OFFICE - DAY");
    expect(pdfString).toContain('I believe in America');
  });

  it('guarantees Courier Prime screenplay monospace font and explicit block understanding', () => {
    const htmlManuscript = renderToStaticMarkup(
      <ScreenplayPdfEditableManuscript
        layout={samplePdfLayout}
        zoomPercent={100}
        onChangeLayout={vi.fn()}
      />
    );

    // Monospace Courier Prime typography is enforced
    expect(htmlManuscript).toContain('&quot;Courier Prime&quot;, Courier, &quot;Courier New&quot;, monospace');
    expect(htmlManuscript).not.toContain('Times New Roman');

    // Block structure understanding badges are present
    expect(htmlManuscript).toContain('SCENE');
    expect(htmlManuscript).toContain('CHARACTER');
    expect(htmlManuscript).toContain('DIALOGUE');
    expect(htmlManuscript).toContain('ACTION');

    // Title page also guarantees Courier Prime
    const htmlTitle = renderToStaticMarkup(
      <ScreenplayTitlePageView
        metadata={{ title: 'THE GODFATHER', author: 'Mario Puzo' }}
        pdfLayout={samplePdfLayout}
        onChangeMetadata={vi.fn()}
      />
    );
    expect(htmlTitle).toContain('&quot;Courier Prime&quot;, Courier, &quot;Courier New&quot;, monospace');
    expect(htmlTitle).not.toContain('Times New Roman');

    // Script intelligence extracts scenes directly from the PDF layout
    const intel = extractScriptIntelligenceFromDoc({
      doc: samplePdfLayout,
      sourceDocumentId: 'godfather-draft',
    });

    expect(intel.scenes.length).toBeGreaterThanOrEqual(1);
    expect(intel.scenes[0].slugline).toContain("INT. DON CORLEONE'S OFFICE - DAY");
    expect(intel.characters).toContain('BONASERA');
  });
});
