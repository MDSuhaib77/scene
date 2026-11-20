import { describe, it, expect } from 'vitest';
import {
  parseFountainToCanonical,
} from '../src/features/screenplay/model/fountainParser';
import {
  parseFdxToCanonical,
} from '../src/features/screenplay/model/fdxParser';
import {
  parsePlainTextToCanonical,
} from '../src/features/screenplay/model/textParser';
import {
  canonicalToTiptapDoc,
  tiptapDocToCanonical,
  canonicalToFountain,
  canonicalToFdx,
  canonicalToPlainText,
  canonicalToParsedScenes,
} from '../src/features/screenplay/model/canonicalConverters';
import {
  inspectScreenplayImportFile,
} from '../src/features/screenplay/services/screenplayImportService';

describe('Screenplay Canonical Reset — Fountain Specification Parser', () => {
  const sampleFountain = `Title: BRICK & STEEL
Credit: Written by
Author: Stu Maschwitz
Draft date: 2026-10-22

EXT. BRICK'S PATIO - DAY #1#

A pool surrounded by dead grass. BRICK (40s), weathered, lounges with a drink.

STEEL (O.S.)
Where were you yesterday?

BRICK
(without turning)
Working on the script.

STEEL
You call that work?

BRICK ^
I call it survival.

> SMASH CUT TO:

.SECRET UNDERGROUND BUNKER - CONTINUOUS #2#

A steel vault door hums.

> THE END <

[[ Check this ending with director ]]
`;

  it('parses title page metadata correctly', () => {
    const doc = parseFountainToCanonical(sampleFountain);
    expect(doc.metadata.title).toBe('BRICK & STEEL');
    expect(doc.metadata.credit).toBe('Written by');
    expect(doc.metadata.author).toBe('Stu Maschwitz');
    expect(doc.metadata.draftDate).toBe('2026-10-22');
  });

  it('parses standard and forced scene headings with scene numbers', () => {
    const doc = parseFountainToCanonical(sampleFountain);
    const sceneElements = doc.elements.filter((e) => e.type === 'scene_heading');
    expect(sceneElements.length).toBe(2);

    expect(sceneElements[0].text).toBe("EXT. BRICK'S PATIO - DAY");
    expect(sceneElements[0].sceneNumber).toBe('1');

    expect(sceneElements[1].text).toBe('SECRET UNDERGROUND BUNKER - CONTINUOUS');
    expect(sceneElements[1].sceneNumber).toBe('2');
  });

  it('parses character cues, extensions, parentheticals, and dialogue correctly', () => {
    const doc = parseFountainToCanonical(sampleFountain);
    const characters = doc.elements.filter((e) => e.type === 'character');
    expect(characters.length).toBe(4);
    expect(characters[0].text).toBe('STEEL (O.S.)');
    expect(characters[1].text).toBe('BRICK');

    const parens = doc.elements.filter((e) => e.type === 'parenthetical');
    expect(parens.length).toBe(1);
    expect(parens[0].text).toBe('(without turning)');

    const dialogues = doc.elements.filter((e) => e.type === 'dialogue');
    expect(dialogues.length).toBe(4);
    expect(dialogues[0].text).toBe('Where were you yesterday?');
    expect(dialogues[1].text).toBe('Working on the script.');
  });

  it('detects dual dialogue markers (^) correctly', () => {
    const doc = parseFountainToCanonical(sampleFountain);
    const dualChar = doc.elements.find(
      (e) => e.type === 'character' && e.isDualDialogue
    );
    expect(dualChar).toBeDefined();
    expect(dualChar?.text).toBe('BRICK');

    const dualDialogue = doc.elements.find(
      (e) => e.type === 'dialogue' && e.isDualDialogue
    );
    expect(dualDialogue).toBeDefined();
    expect(dualDialogue?.text).toBe('I call it survival.');
  });

  it('parses transitions, centered text, and notes', () => {
    const doc = parseFountainToCanonical(sampleFountain);
    const transitions = doc.elements.filter((e) => e.type === 'transition');
    expect(transitions.length).toBe(1);
    expect(transitions[0].text).toBe('SMASH CUT TO:');

    const centered = doc.elements.filter((e) => e.type === 'centered_text');
    expect(centered.length).toBe(1);
    expect(centered[0].text).toBe('THE END');

    const notes = doc.elements.filter((e) => e.type === 'note');
    expect(notes.length).toBe(1);
    expect(notes[0].text).toBe('Check this ending with director');
  });

  it('supports lyrics (~) and forced character (@)', () => {
    const fountainWithLyrics = `
@MCQX4
~ Singing in the rain, just singing in the rain
`;
    const doc = parseFountainToCanonical(fountainWithLyrics);
    const char = doc.elements.find((e) => e.type === 'character');
    const lyrics = doc.elements.find((e) => e.type === 'lyrics');
    expect(char?.text).toBe('MCQX4');
    expect(lyrics?.text).toBe('Singing in the rain, just singing in the rain');
  });
});

describe('Screenplay Canonical Reset — Final Draft FDX Parser', () => {
  const sampleFdx = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <TitlePage>
    <Content>
      <Paragraph Alignment="Center">
        <Text>THE RUNNER</Text>
      </Paragraph>
      <Paragraph Alignment="Center">
        <Text>Written by Jane Doe</Text>
      </Paragraph>
    </Content>
  </TitlePage>
  <Content>
    <Paragraph Type="Scene Heading">
      <SceneProperties Number="1" />
      <Text>INT. CONTROL ROOM - NIGHT</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <Text>Monitors flicker in the dark.</Text>
    </Paragraph>
    <Paragraph Type="Character">
      <Text>COMMANDER</Text>
    </Paragraph>
    <Paragraph Type="Dialogue">
      <Text>All systems operational.</Text>
    </Paragraph>
    <Paragraph Type="Transition">
      <Text>FADE OUT.</Text>
    </Paragraph>
  </Content>
</FinalDraft>`;

  it('parses FDX document into canonical elements without tag residue', () => {
    const doc = parseFdxToCanonical(sampleFdx);
    expect(doc.metadata.title).toBe('THE RUNNER');
    expect(doc.metadata.author).toBe('Jane Doe');

    expect(doc.elements.length).toBe(5);
    expect(doc.elements[0].type).toBe('scene_heading');
    expect(doc.elements[0].text).toBe('INT. CONTROL ROOM - NIGHT');
    expect(doc.elements[0].sceneNumber).toBe('1');

    expect(doc.elements[1].type).toBe('action');
    expect(doc.elements[1].text).toBe('Monitors flicker in the dark.');

    expect(doc.elements[2].type).toBe('character');
    expect(doc.elements[2].text).toBe('COMMANDER');

    expect(doc.elements[3].type).toBe('dialogue');
    expect(doc.elements[3].text).toBe('All systems operational.');

    expect(doc.elements[4].type).toBe('transition');
    expect(doc.elements[4].text).toBe('FADE OUT.');
  });
});

describe('Screenplay Canonical Reset — Plain Text Parser & Warnings', () => {
  it('parses plain text and flags ambiguous elements with high confidence preservation', () => {
    const rawText = `INT. COFFEE SHOP - MORNING

A barista cleans the counter.

SARAH
Good morning.

SOME RANDOM UPPERCASE LINE
`;
    const doc = parsePlainTextToCanonical(rawText);
    expect(doc.elements.length).toBe(5);

    const heading = doc.elements[0];
    expect(heading.type).toBe('scene_heading');
    expect(heading.confidence).toBe('high');

    const ambiguous = doc.elements[4];
    expect(ambiguous.confidence).toBe('ambiguous');
    expect(ambiguous.warnings && ambiguous.warnings.length > 0).toBe(true);
  });
});

describe('Screenplay Canonical Reset — Converters & Round-Trip Fidelity', () => {
  it('converts canonical document to Tiptap JSON and back without element loss', () => {
    const fountain = `INT. LAB - DAY

Doctor enters.

DR. SMITH
It works!
`;
    const canonical = parseFountainToCanonical(fountain);
    const tiptapDoc = canonicalToTiptapDoc(canonical);

    expect(tiptapDoc.type).toBe('doc');
    expect(tiptapDoc.content?.length).toBe(4);
    expect(tiptapDoc.content?.[0].type).toBe('sceneHeading');
    expect(tiptapDoc.content?.[1].type).toBe('action');
    expect(tiptapDoc.content?.[2].type).toBe('character');
    expect(tiptapDoc.content?.[3].type).toBe('dialogue');

    const reconstructed = tiptapDocToCanonical(tiptapDoc, {
      title: 'Lab Test',
      sourceFormat: 'fountain',
    });

    expect(reconstructed.elements.length).toBe(4);
    expect(reconstructed.elements[0].type).toBe('scene_heading');
    expect(reconstructed.elements[0].text).toBe('INT. LAB - DAY');
    expect(reconstructed.elements[2].type).toBe('character');
    expect(reconstructed.elements[2].text).toBe('DR. SMITH');
  });

  it('converts canonical document into Fountain, FDX, and Plain Text serializations', () => {
    const fountain = `INT. LIVING ROOM - NIGHT

Quiet echoes.

JOSH
Hello?
`;
    const canonical = parseFountainToCanonical(fountain, { title: 'Josh Movie' });

    const fountOut = canonicalToFountain(canonical);
    expect(fountOut).toContain('Title: Josh Movie');
    expect(fountOut).toContain('INT. LIVING ROOM - NIGHT');
    expect(fountOut).toContain('JOSH');
    expect(fountOut).toContain('Hello?');

    const fdxOut = canonicalToFdx(canonical);
    expect(fdxOut).toContain('<FinalDraft DocumentType="Script"');
    expect(fdxOut).toContain('<Paragraph Type="Scene Heading">');
    expect(fdxOut).toContain('INT. LIVING ROOM - NIGHT');

    const txtOut = canonicalToPlainText(canonical);
    expect(txtOut).toContain('INT. LIVING ROOM - NIGHT');
    expect(txtOut).toContain('JOSH');
  });

  it('converts canonical document to parsed scenes for Script Intelligence and Breakdown', () => {
    const script = `INT. APARTMENT - DAY

MARK
Wake up.

EXT. STREET - NIGHT

Sirens wail.
`;
    const canonical = parseFountainToCanonical(script);
    const scenes = canonicalToParsedScenes(canonical);

    expect(scenes.length).toBe(2);
    expect(scenes[0].sceneNumber).toBe('1');
    expect(scenes[0].intExt).toBe('INT');
    expect(scenes[0].location).toBe('APARTMENT');
    expect(scenes[0].timeOfDay).toBe('DAY');
    expect(scenes[0].characters).toContain('MARK');

    expect(scenes[1].sceneNumber).toBe('2');
    expect(scenes[1].intExt).toBe('EXT');
    expect(scenes[1].location).toBe('STREET');
    expect(scenes[1].timeOfDay).toBe('NIGHT');
  });
});

describe('Screenplay Canonical Reset — Import Service & Integrity Verification', () => {
  it('detects Fountain format with detailed preview metrics', () => {
    const content = `Title: Test Script\n\nINT. ROOFTOP - NIGHT\n\nRain falls.\n`;
    const preview = inspectScreenplayImportFile('draft.fountain', content);

    expect(preview.format).toBe('fountain');
    expect(preview.title).toBe('Test Script');
    expect(preview.sceneCount).toBe(1);
    expect(preview.estimatedPages).toBeGreaterThanOrEqual(1);
    expect(preview.rawText).toBe(content);
  });

  it('detects FDX format and extracts script title and scene count', () => {
    const fdx = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script">
  <TitlePage><Content><Paragraph><Text>MY FILM</Text></Paragraph></Content></TitlePage>
  <Content>
    <Paragraph Type="Scene Heading"><Text>INT. CAR - DAY</Text></Paragraph>
  </Content>
</FinalDraft>`;
    const preview = inspectScreenplayImportFile('script.fdx', fdx);

    expect(preview.format).toBe('fdx');
    expect(preview.title).toBe('MY FILM');
    expect(preview.sceneCount).toBe(1);
  });

  it('warns honestly on binary PDF / DOCX files without corrupting document state', () => {
    const fakePdf = '%PDF-1.4 binary garbage \x00\x01\x02';
    const preview = inspectScreenplayImportFile('screenplay.pdf', fakePdf);

    expect(preview.format).toBe('pdf');
    expect(preview.warnings.some((w) => w.includes('PDF'))).toBe(true);
    expect(preview.warnings.some((w) => w.includes('lossy'))).toBe(true);
  });
});
