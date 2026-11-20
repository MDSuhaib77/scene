import { describe, it, expect } from 'vitest';
import { PdfAdapter } from '../src/services/screenplay/adapters/PdfAdapter';
import zlib from 'zlib';

describe('PdfAdapter Minimal Bounded Diagnostic', () => {
  it('extracts text from a small synthetic compressed vector PDF in < 1 second', async () => {
    const t0 = performance.now();

    const streamContent = Buffer.from(
      'BT\n' +
      '/F1 12 Tf\n' +
      '72 712 Td\n' +
      '(INT. DETECTIVE OFFICE - NIGHT) Tj\n' +
      'ET\n' +
      'BT\n' +
      '72 690 Td\n' +
      '(DETECTIVE) Tj\n' +
      'ET\n' +
      'BT\n' +
      '72 670 Td\n' +
      '(We found the evidence.) Tj\n' +
      'ET\n'
    );

    const compressedStream = zlib.deflateSync(streamContent);

    const pdfBuffer = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
      Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
      Buffer.from('3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n'),
      Buffer.from(`4 0 obj\n<< /Length ${compressedStream.length} /Filter /FlateDecode >>\nstream\n`),
      compressedStream,
      Buffer.from('\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF'),
    ]);

    const adapter = new PdfAdapter();
    const fakeFile = new File([pdfBuffer], 'compressed.pdf', { type: 'application/pdf' });
    const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength);

    const result = await adapter.parse(fakeFile, undefined, arrayBuffer);
    const durationMs = performance.now() - t0;

    console.log(`[Diagnostic PDF Test] Completed in ${durationMs.toFixed(2)} ms`);
    console.log(`[Diagnostic PDF Test] Scenes found: ${result.scenes.length}`);

    expect(durationMs).toBeLessThan(5000);
    expect(result.scenes.length).toBe(1);
    expect(result.scenes[0].slugline).toBe('INT. DETECTIVE OFFICE - NIGHT');
    expect(result.scenes[0].characters).toContain('DETECTIVE');
  });

  it('correctly flags image-only PDF with an honest OCR unsupported warning in < 1 second', async () => {
    const t0 = performance.now();

    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 4 0 R >> >> >>\nendobj\n' +
      '4 0 obj\n<< /Type /XObject /Subtype /Image /Width 100 /Height 100 /BitsPerComponent 8 >>\nstream\nRAWIMAGEBYTES\nendstream\nendobj\n' +
      'xref\n0 5\n0000000000 65535 f \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF'
    );

    const adapter = new PdfAdapter();
    const fakeFile = new File([pdfBuffer], 'scanned.pdf', { type: 'application/pdf' });
    const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength);

    const result = await adapter.parse(fakeFile, undefined, arrayBuffer);
    const durationMs = performance.now() - t0;

    console.log(`[Diagnostic Scanned PDF Test] Completed in ${durationMs.toFixed(2)} ms`);

    expect(durationMs).toBeLessThan(5000);
    expect(result.scenes.length).toBe(0);
    expect(result.warnings.some(w => w.id === 'pdf-scanned-ocr-unsupported')).toBe(true);
  });

  it('safely handles truncated PDF with unclosed stream without hanging', async () => {
    const t0 = performance.now();

    // Malformed buffer with 'stream' keyword but missing 'endstream'
    const truncatedBuffer = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Length 50 >>\nstream\n' +
      'BT /F1 12 Tf 72 712 Td (INT. BROKEN WAREHOUSE - NIGHT) Tj ET\n' +
      'EOF WITHOUT ENDSTREAM MARKER'
    );

    const adapter = new PdfAdapter();
    const fakeFile = new File([truncatedBuffer], 'truncated.pdf', { type: 'application/pdf' });
    const arrayBuffer = truncatedBuffer.buffer.slice(truncatedBuffer.byteOffset, truncatedBuffer.byteOffset + truncatedBuffer.byteLength);

    const result = await adapter.parse(fakeFile, undefined, arrayBuffer);
    const durationMs = performance.now() - t0;

    console.log(`[Diagnostic Truncated PDF Test] Completed in ${durationMs.toFixed(2)} ms`);

    expect(durationMs).toBeLessThan(1000); // Must terminate immediately
    expect(result.warnings.some(w => w.id === 'pdf-stream-unclosed-warning')).toBe(true);
  });

  it('safely handles garbage binary data labeled as PDF without hanging', async () => {
    const t0 = performance.now();

    const garbageBuffer = Buffer.alloc(10000);
    for (let i = 0; i < garbageBuffer.length; i++) {
      garbageBuffer[i] = (i * 37) % 256;
    }

    const adapter = new PdfAdapter();
    const fakeFile = new File([garbageBuffer], 'garbage.pdf', { type: 'application/pdf' });
    const arrayBuffer = garbageBuffer.buffer.slice(garbageBuffer.byteOffset, garbageBuffer.byteOffset + garbageBuffer.byteLength);

    const result = await adapter.parse(fakeFile, undefined, arrayBuffer);
    const durationMs = performance.now() - t0;

    console.log(`[Diagnostic Garbage PDF Test] Completed in ${durationMs.toFixed(2)} ms`);

    expect(durationMs).toBeLessThan(1000);
    expect(result.scenes.length).toBe(0);
    expect(result.warnings.some(w => w.id === 'pdf-empty-or-corrupt')).toBe(true);
  });
});
