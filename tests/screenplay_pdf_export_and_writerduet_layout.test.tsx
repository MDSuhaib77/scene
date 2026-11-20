import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  exportScreenplayToPdf,
} from '../src/features/screenplay/services/pdfExportService';
import { ScreenplayToolbar } from '../src/features/screenplay/components/ScreenplayToolbar';
import { ScreenplayNavigationPanel } from '../src/features/screenplay/components/ScreenplayNavigationPanel';
import { JSONContent } from '@tiptap/react';

describe('Screenplay PDF Export Service', () => {
  const sampleDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'sceneHeading',
        content: [{ type: 'text', text: 'INT. BANK VAULT - DAY' }],
      },
      {
        type: 'action',
        content: [
          {
            type: 'text',
            text: 'A heavy steel door swings open slowly, revealing stacks of cash in the shadows.',
          },
        ],
      },
      {
        type: 'character',
        content: [{ type: 'text', text: 'DOPEY' }],
      },
      {
        type: 'parenthetical',
        content: [{ type: 'text', text: '(whispering)' }],
      },
      {
        type: 'dialogue',
        content: [
          {
            type: 'text',
            text: "Three of a kind. Let's do this fast.",
          },
        ],
      },
      {
        type: 'transition',
        content: [{ type: 'text', text: 'CUT TO:' }],
      },
    ],
  };

  it('generates a valid, binary-compliant PDF 1.4 document', () => {
    const pdfBytes = exportScreenplayToPdf(sampleDoc, {
      title: 'The Dark Knight',
      author: 'Jonathan Nolan & Christopher Nolan',
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);

    // Verify PDF header magic bytes (%PDF-1.4)
    const header = new TextDecoder().decode(pdfBytes.slice(0, 8));
    expect(header).toContain('%PDF-1.4');

    // Verify PDF trailer and EOF
    const tail = new TextDecoder().decode(pdfBytes.slice(-60));
    expect(tail).toContain('%%EOF');
    expect(tail).toContain('startxref');
    expect(tail).toContain('/Root 1 0 R');
  });

  it('includes standard Type 1 Courier and Courier-Bold fonts', () => {
    const pdfBytes = exportScreenplayToPdf(sampleDoc, {
      title: 'Inception',
      author: 'Christopher Nolan',
    });

    const fullPdfText = new TextDecoder().decode(pdfBytes);
    expect(fullPdfText).toContain('/BaseFont /Courier');
    expect(fullPdfText).toContain('/BaseFont /Courier-Bold');
    expect(fullPdfText).toContain('/MediaBox [0 0 612 792]'); // US Letter 8.5 x 11 inches
  });

  it('embeds Title Page and manuscript body text with correct styling', () => {
    const pdfBytes = exportScreenplayToPdf(sampleDoc, {
      title: 'The Dark Knight',
      author: 'Christopher Nolan',
      draftDate: '2026-10-24',
      includeTitlePage: true,
    });

    const fullPdfText = new TextDecoder().decode(pdfBytes);

    // Title page contains title and author
    expect(fullPdfText).toContain('THE DARK KNIGHT');
    expect(fullPdfText).toContain('Written by');
    expect(fullPdfText).toContain('Christopher Nolan');

    // Manuscript body contains screenplay elements
    expect(fullPdfText).toContain('INT. BANK VAULT - DAY');
    expect(fullPdfText).toContain('DOPEY');
    expect(fullPdfText).toContain('\\(whispering\\)');
    expect(fullPdfText).toContain("Three of a kind. Let's do this");
    expect(fullPdfText).toContain('CUT TO:');
  });

  it('paginates long screenplays and adds running headers on page 2+', () => {
    // Construct a document with enough scenes and action to span across multiple pages
    const multiPageDoc: JSONContent = {
      type: 'doc',
      content: Array.from({ length: 40 }, (_, i) => [
        {
          type: 'sceneHeading',
          content: [{ type: 'text', text: `INT. SCENE ${i + 1} - DAY` }],
        },
        {
          type: 'action',
          content: [
            {
              type: 'text',
              text: `Detailed action description for scene ${i + 1}. Characters move across the room and prepare the equipment for the next sequence.`,
            },
          ],
        },
      ]).flat(),
    };

    const pdfBytes = exportScreenplayToPdf(multiPageDoc, {
      title: 'Epic Script',
      includeTitlePage: false,
    });

    const fullPdfText = new TextDecoder().decode(pdfBytes);
    // Page 2 header check
    expect(fullPdfText).toContain('(2.) Tj');
  });
});

describe('WriterDuet-Style Top Element Bar & Navigation Reconstructions', () => {
  it('renders all 16 screenplay authoring element buttons on the top bar', () => {
    const html = renderToStaticMarkup(
      <ScreenplayToolbar
        projectName="The Dark Knight"
        versions={[{ id: 'v1', title: 'Draft 1', createdAt: '2026-10-24' } as any]}
        activeVersionId="v1"
        draftTitle="Draft 1"
        onDraftTitleChange={vi.fn()}
        onSelectVersion={vi.fn()}
        onNewBlankDraft={vi.fn()}
        onLoadSampleScript={vi.fn()}
        onSaveDraft={vi.fn()}
        isDirty={false}
        lastSavedAt="12:00 PM"
        metrics={{} as any}
        activeState={{ currentElementType: 'action' } as any}
        pageCount={2}
        activePageNumber={1}
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
      />
    );

    // 16 element command buttons
    const expectedCommands = [
      'scene',
      'action',
      'character',
      'parens',
      'dialogue',
      'transition',
      'shot',
      'text',
      'note',
      'outline',
      'newAct',
      'endAct',
      'lyrics',
      'image',
      'sequence',
      'dual',
    ];

    for (const cmd of expectedCommands) {
      expect(html).toContain(`data-testid="screenplay-cmd-${cmd}"`);
    }

    // Top formatting element bar container
    expect(html).toContain('data-testid="screenplay-formatting-bar"');
  });

  it('renders Quick Export (PDF) and PDF export format options in the document navigation sidebar', () => {
    const html = renderToStaticMarkup(
      <ScreenplayNavigationPanel
        isOpen={true}
        activeSection="drafts"
        onSelectSection={vi.fn()}
        onClose={vi.fn()}
        projectName="The Dark Knight"
        versions={[{ id: 'v1', title: 'Draft 1', createdAt: '2026-10-24' } as any]}
        activeVersionId="v1"
        onSelectVersion={vi.fn()}
        onNewBlankDraft={vi.fn()}
        onLoadSampleScript={vi.fn()}
        onImportScriptFile={vi.fn()}
        onExportScript={vi.fn()}
        outlineEntries={[]}
        onNavigateOutlineEntry={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="screenplay-quick-export-pdf-btn"');
    expect(html).toContain('data-testid="screenplay-export-pdf-btn"');
    expect(html).toContain('data-testid="screenplay-export-fountain-btn"');
    expect(html).toContain('data-testid="screenplay-export-fdx-btn"');
    expect(html).not.toContain('data-testid="screenplay-export-txt-btn"');
  });
});
