import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parsePdf } from '../src/features/screenplay/model/pdfParser';
import { exportScreenplayToPdf } from '../src/features/screenplay/services/pdfExportService';
import { buildScreenplayVersionFromCanonical } from '../src/features/screenplay/services/screenplayImportService';
import { FilmProject } from '../src/types';

describe('Real PDF File Source-Faithful Import & Editable Workflow', () => {
  const pdfPath = path.resolve(__dirname, '../SceneOS_Midterm_Review.pdf');

  it('imports SceneOS_Midterm_Review.pdf with source-faithful page geometry and lines', async () => {
    expect(fs.existsSync(pdfPath)).toBe(true);

    const pdfBuffer = fs.readFileSync(pdfPath);
    const canonical = await parsePdf(pdfBuffer, {
      fileName: 'SceneOS_Midterm_Review.pdf',
      fileSize: pdfBuffer.byteLength,
    });

    expect(canonical).toBeDefined();
    expect(canonical.provenance.sourceFormat).toBe('pdf');
    expect(canonical.pdfLayout).toBeDefined();

    const layout = canonical.pdfLayout!;
    expect(layout.pages.length).toBeGreaterThan(0);
    expect(layout.pageWidth).toBeGreaterThan(500);
    expect(layout.pageHeight).toBeGreaterThan(300);

    const page1 = layout.pages[0];
    expect(page1.pageNumber).toBe(1);
    expect(page1.lines.length).toBeGreaterThan(0);

    const firstLine = page1.lines[0];
    expect(firstLine.text.length).toBeGreaterThan(0);
    expect(firstLine.x).toBeGreaterThanOrEqual(0);
    expect(firstLine.top).toBeGreaterThanOrEqual(0);
    expect(firstLine.fontSize).toBeGreaterThan(0);

    // Build ScreenplayVersion
    const mockProject: FilmProject = {
      id: 'proj-test',
      title: 'SceneOS Test Project',
      owner: 'writer-1',
      collaborators: [],
      permissions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      screenplayVersions: [],
    };

    const version = buildScreenplayVersionFromCanonical(
      canonical,
      mockProject,
      undefined,
      'data:application/pdf;base64,mock'
    );

    expect(version.pdfLayout).toBeDefined();
    expect(version.pdfLayout!.pages.length).toBe(layout.pages.length);
    expect(version.sourcePdfDataUrl).toBe('data:application/pdf;base64,mock');

    // Test genuine PDF export with pdfLayout
    const exportedPdfBytes = exportScreenplayToPdf(
      { type: 'doc', content: [] },
      {
        title: version.title,
        pdfLayout: version.pdfLayout,
      }
    );

    expect(exportedPdfBytes).toBeInstanceOf(Uint8Array);
    expect(exportedPdfBytes.length).toBeGreaterThan(1000);

    const exportedPdfString = new TextDecoder('latin1').decode(exportedPdfBytes);
    expect(exportedPdfString).toContain('%PDF-1.4');
    // Ensure text from the real PDF is present in the exported stream
    expect(exportedPdfString).toContain(firstLine.text.slice(0, 15));
  });
});
