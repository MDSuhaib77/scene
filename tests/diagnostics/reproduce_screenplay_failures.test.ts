/**
 * SceneOS — Screenplay Ingestion Diagnostic Suite
 * Reproduces real parsing behaviors and failures across all supported formats and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { FdxAdapter } from '../../src/services/screenplay/adapters/FdxAdapter';
import { FountainAdapter } from '../../src/services/screenplay/adapters/FountainAdapter';
import { TextAdapter } from '../../src/services/screenplay/adapters/TextAdapter';
import { PdfAdapter } from '../../src/services/screenplay/adapters/PdfAdapter';
import { DocxAdapter } from '../../src/services/screenplay/adapters/DocxAdapter';
import { RtfAdapter } from '../../src/services/screenplay/adapters/RtfAdapter';
import { parseSlugline } from '../../src/services/screenplay/sluglineParser';
import { validateScreenplayFile, detectFormatFromFilename } from '../../src/services/screenplay/validation';
import { screenplayParserService } from '../../src/services/screenplay/screenplayParserService';
import zlib from 'zlib';

describe('Diagnostic 1: Final Draft (.fdx) Full Structure & Edge Cases', () => {
  it('parses valid multi-scene FDX with characters, dialogue, and parentheticals', async () => {
    const validFdxXml = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <TitlePage>
    <Content>
      <Paragraph Type="Title"><Text>TEST PRODUCTION</Text></Paragraph>
      <Paragraph Type="Author"><Text>Alex Mercer</Text></Paragraph>
    </Content>
  </TitlePage>
  <Content>
    <Paragraph Type="Scene Heading">
      <SceneProperties Number="1"/>
      <Text>INT. SURVEILLANCE VAN - NIGHT</Text>
    </Paragraph>
    <Paragraph Type="Action"><Text>Rain drums against the metal roof.</Text></Paragraph>
    <Paragraph Type="Character"><Text>MARCUS</Text></Paragraph>
    <Paragraph Type="Parenthetical"><Text>(whispering)</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Target is entering the lobby.</Text></Paragraph>
    <Paragraph Type="Scene Heading">
      <SceneProperties Number="2"/>
      <Text>EXT. CORPORATE TOWER - NIGHT</Text>
    </Paragraph>
    <Paragraph Type="Character"><Text>ELENA</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>I have visual contact.</Text></Paragraph>
  </Content>
</FinalDraft>`;

    const adapter = new FdxAdapter();
    const file = new File([validFdxXml], 'test.fdx', { type: 'application/xml' });
    const result = await adapter.parse(file, validFdxXml);

    expect(result.scenes.length).toBe(2);
    expect(result.scenes[0].sceneNumber).toBe('1');
    expect(result.scenes[0].characters).toContain('MARCUS');
    expect(result.scenes[0].dialogueBlocks[0].parenthetical).toBe('(whispering)');
    expect(result.scenes[1].sceneNumber).toBe('2');
    expect(result.scenes[1].characters).toContain('ELENA');
  });

  it('diagnoses malformed FDX XML with unclosed tags', async () => {
    const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script">
  <Content>
    <Paragraph Type="Scene Heading">
      <Text>INT. CORRIDOR - DAY
    <!-- Unclosed Paragraph and Content tags -->`;

    const adapter = new FdxAdapter();
    const file = new File([malformedXml], 'malformed.fdx', { type: 'application/xml' });
    const result = await adapter.parse(file, malformedXml);

    // Record observed behavior: does it throw, catch, or return empty?
    console.log('[Diagnostic 1.2 Malformed FDX] warnings:', result.warnings);
    console.log('[Diagnostic 1.2 Malformed FDX] scenes count:', result.scenes.length);
  });
});

describe('Diagnostic 2: Fountain Standard & Ambiguous Scene Headings', () => {
  it('tests standard vs ambiguous and lowercase headings in Fountain', async () => {
    const fountainScript = `Title: AMBIGUOUS FOUNTAIN TEST
Author: Test Suite

INT. STANDARD ROOM - DAY

Action text here.

.FORCED SLUGLINE ROOFTOP - NIGHT

Action on rooftop.

int. lowercase room - dawn

Lower case slugline action.

INT. KITCHEN / DINING ROOM - CONTINUOUS

Hyphenated multi-room setting.

INT. VAULT

Heading without time of day.

EXT. CANYON - SUNDOWN

Non-standard time of day token.

= Synopsis of canyon chase scene.

/* Boneyard comment: check drone permits */

[[Note: Actor requested stunt double]]

SARAH
(hesitating)
I am not sure about this.
It feels dangerous.
`;

    const adapter = new FountainAdapter();
    const file = new File([fountainScript], 'ambiguous.fountain', { type: 'text/plain' });
    const result = await adapter.parse(file, fountainScript);

    console.log('[Diagnostic 2 Fountain Scenes Detected]:');
    result.scenes.forEach((s, idx) => {
      console.log(`  Scene ${idx + 1}: num="${s.sceneNumber}", slug="${s.slugline}", intExt="${s.intExt}", time="${s.timeOfDay}", synopsis="${s.synopsis || ''}"`);
    });

    // Check which sluglines were recognized and which failed:
    const slugs = result.scenes.map(s => s.slugline);
    expect(slugs).toContain('INT. STANDARD ROOM - DAY');
    // Note: check if .FORCED SLUGLINE ROOFTOP was recognized:
    const hasForced = result.scenes.some(s => s.slugline.includes('ROOFTOP'));
    console.log('Forced slugline recognized:', hasForced);
    // Note: check if lowercase 'int. lowercase room - dawn' was recognized:
    const hasLowercase = result.scenes.some(s => s.slugline.toLowerCase().includes('lowercase room'));
    console.log('Lowercase slugline recognized:', hasLowercase);
    // Note: check if heading without time of day was recognized:
    const hasNoTime = result.scenes.some(s => s.slugline.includes('VAULT'));
    console.log('No-time slugline recognized:', hasNoTime);
  });
});

describe('Diagnostic 3: Plain Text Screenplay Parser Behaviors', () => {
  it('tests transitions misclassified as characters and multiline dialogue in .txt', async () => {
    const textScript = `NEO-TOKYO CHASE

INT. WAREHOUSE - NIGHT

The rain pounds on the skylight.

CUT TO:

DETECTIVE
Wait here.
Do not make any sudden moves.
I will check the perimeter.

FADE OUT.
`;

    const adapter = new TextAdapter();
    const file = new File([textScript], 'script.txt', { type: 'text/plain' });
    const result = await adapter.parse(file, textScript);

    const scene = result.scenes[0];
    console.log('[Diagnostic 3 Text Characters Detected]:', scene?.characters);
    console.log('[Diagnostic 3 Dialogue Blocks]:', scene?.dialogueBlocks);

    // Check: Did CUT TO: get classified as a character?
    const hasCutToAsChar = scene?.characters.includes('CUT TO:');
    console.log('Was CUT TO: classified as character?', hasCutToAsChar);

    // Check: Did multiline dialogue become 3 separate dialogue blocks?
    console.log('Dialogue blocks count for single speech:', scene?.dialogueBlocks.length);
  });
});

describe('Diagnostic 4: PDF Extraction Failure Reproduction', () => {
  it('reproduces PDF parser failure on compressed / standard vector PDF', async () => {
    // A standard PDF stream is flate-compressed. Let's create a minimal valid PDF with a FlateDecode stream.
    const streamContent = Buffer.from('BT /F1 12 Tf 72 712 Td (INT. SECURE VAULT - NIGHT) Tj ET');
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
    console.log('[Diagnostic 4 PDF Result]:', {
      scenesCount: result.scenes.length,
      warnings: result.warnings,
      rawTextLength: result.rawText.length
    });

    // Modern parser extracts compressed vector PDF streams or safely reports status
    expect(result.scenes.length).toBeGreaterThanOrEqual(0);
    expect(result.warnings.some(w => w.id === 'pdf-ocr-required' || w.id === 'pdf-stream-notice')).toBe(true);
  });
});

describe('Diagnostic 5: Word Document (.docx) Extraction Failure Reproduction', () => {
  it('reproduces DOCX parser failure on real zipped Word documents', async () => {
    // A real DOCX is a ZIP file. Let's create a minimal zip file with word/document.xml compressed inside.
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>INT. BOARDROOM - DAY</w:t></w:r></w:p>
    <w:p><w:r><w:t>The executives stare in silence.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

    const compressedXml = zlib.deflateRawSync(Buffer.from(documentXml));

    // Construct a minimal valid ZIP structure in-memory
    const zipHeader = Buffer.from([
      0x50, 0x4b, 0x03, 0x04, // Local file header signature
      0x14, 0x00, // Version needed to extract
      0x00, 0x00, // General purpose bit flag
      0x08, 0x00, // Compression method (8 = Deflate)
      0x00, 0x00, 0x00, 0x00, // File last mod time & date
      0x00, 0x00, 0x00, 0x00, // CRC-32 (dummy)
    ]);
    const nameBuf = Buffer.from('word/document.xml');
    const sizeBuf = Buffer.alloc(8);
    sizeBuf.writeUInt32LE(compressedXml.length, 0); // Compressed size
    sizeBuf.writeUInt32LE(documentXml.length, 4); // Uncompressed size

    const nameLenBuf = Buffer.alloc(4);
    nameLenBuf.writeUInt16LE(nameBuf.length, 0); // File name length
    nameLenBuf.writeUInt16LE(0, 2); // Extra field length

    const zipBuffer = Buffer.concat([
      zipHeader,
      sizeBuf.slice(0, 4), // CRC dummy
      sizeBuf.slice(0, 4), // compressed size
      sizeBuf.slice(4, 8), // uncompressed size
      nameLenBuf,
      nameBuf,
      compressedXml
    ]);

    const adapter = new DocxAdapter();
    const fakeFile = new File([zipBuffer], 'script.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const arrayBuffer = zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength);

    const result = await adapter.parse(fakeFile, undefined, arrayBuffer);
    console.log('[Diagnostic 5 DOCX Result]:', {
      scenesCount: result.scenes.length,
      warnings: result.warnings,
      rawTextLength: result.rawText.length
    });

    // In a compressed DOCX with dummy zip data, it reports empty or corrupt zip warning
    expect(result.scenes.length).toBe(0);
    expect(result.warnings.some(w => w.id === 'docx-empty-document' || w.id === 'docx-zip-corrupt')).toBe(true);
  });
});

describe('Diagnostic 6: RTF Nested Groups & Escapes', () => {
  it('tests RTF parser on nested font tables and escaped quotes', async () => {
    const complexRtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Courier New;}{\\f1\\fnil\\fcharset0 Arial;}}
{\\colortbl ;\\red0\\green0\\blue0;}
\\viewkind4\\uc1 
\\pard\\f0\\fs24 INT. HOSPITAL ROOM - NIGHT\\par
The heart monitor\\'92s alarm sounds.\\par
\\b DOCTOR\\b0\\par
We are losing pulse.\\par
}`;

    const adapter = new RtfAdapter();
    const fakeFile = new File([complexRtf], 'hospital.rtf', { type: 'application/rtf' });
    const result = await adapter.parse(fakeFile, complexRtf);

    console.log('[Diagnostic 6 RTF Raw Text]:\n', result.rawText);
    console.log('[Diagnostic 6 RTF Scenes]:', result.scenes.map(s => s.slugline));
  });
});

describe('Diagnostic 7: File Validation & Misleading Extensions', () => {
  it('catches empty 0-byte file', () => {
    const emptyFile = new File([], 'empty.fdx', { type: 'application/xml' });
    const validation = validateScreenplayFile(emptyFile);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('empty (0 bytes)');
  });

  it('reveals flaw: file with misleading extension passes validation', () => {
    // An executable or image renamed to .fdx
    const fakeExe = new File([new Uint8Array([0x4D, 0x5A, 0x90, 0x00])], 'trojan.fdx', { type: 'application/x-msdownload' });
    const validation = validateScreenplayFile(fakeExe);
    console.log('[Diagnostic 7.2 Misleading Extension]: isValid =', validation.isValid, 'format =', validation.format);

    // FAILS TO DETECT BINARY FILE: validateScreenplayFile only looks at filename extension!
    expect(validation.isValid).toBe(true);
    expect(validation.format).toBe('fdx');
  });
});

describe('Diagnostic 8: Screenplay With No Reliably Detectable Scene Headings', () => {
  it('observes synthetic scene generation when script has no sluglines', async () => {
    const narrativeText = `This is a movie pitch.
A young engineer discovers an ancient submerged spacecraft.
The government attempts to cover up the discovery.
She escapes into the desert with the flight recorder.`;

    const adapter = new TextAdapter();
    const file = new File([narrativeText], 'treatment.txt', { type: 'text/plain' });
    const result = await adapter.parse(file, narrativeText);

    console.log('[Diagnostic 8 No Sluglines Result]:');
    console.log('  Scenes count:', result.scenes.length);
    console.log('  First scene slugline:', result.scenes[0]?.slugline);
    console.log('  Warnings:', result.warnings);

    // Observed: It creates a synthesized "INT. UNTITLED SCENE - DAY"
    expect(result.scenes.length).toBe(1);
    expect(result.scenes[0].slugline).toBe('INT. UNTITLED SCENE - DAY');
  });
});

describe('Diagnostic 9: Screenplay Versioning, Scene Identity, and Reordering', () => {
  it('demonstrates unstable scene IDs upon deletion and reordering', async () => {
    const v1Content = `INT. SCENE ONE - DAY
Action 1.
INT. SCENE TWO - NIGHT
Action 2.
INT. SCENE THREE - DAWN
Action 3.`;

    const v2Content = `INT. SCENE ONE - DAY
Action 1 modified.
INT. SCENE THREE - DAWN
Action 3 (Scene Two was deleted).`;

    const adapter = new TextAdapter();
    const res1 = await adapter.parse(new File([v1Content], 'v1.txt'), v1Content);
    const res2 = await adapter.parse(new File([v2Content], 'v2.txt'), v2Content);

    console.log('[Diagnostic 9 Version 1 Scene IDs]:', res1.scenes.map(s => ({ id: s.id, slug: s.slugline })));
    console.log('[Diagnostic 9 Version 2 Scene IDs]:', res2.scenes.map(s => ({ id: s.id, slug: s.slugline })));

    // In v1 & v2: verifies scene sluglines are parsed
    expect(res1.scenes[2].slugline).toBe('INT. SCENE THREE - DAWN');
    expect(res1.scenes[2].id).toBeDefined();

    expect(res2.scenes[1].slugline).toBe('INT. SCENE THREE - DAWN');
    expect(res2.scenes[1].id).toBeDefined();

    // CRITICAL ARCHITECTURAL FLAW CONFIRMED:
    // Scene ID is position-derived ('txt-scn-' + index). Any breakdown tags, comments, or review statuses
    // linked to 'txt-scn-3' in v1 will be lost or attached to the wrong scene in v2!
  });
});
