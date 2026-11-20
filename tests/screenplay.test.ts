/**
 * SceneOS — Screenplay Ingestion & Breakdown Test Suite
 * Tests Final Draft (.fdx), Fountain (.fountain), Plain Text (.txt), RTF, validation, and eighths math.
 */

import { describe, it, expect } from 'vitest';
import { FdxAdapter } from '../src/services/screenplay/adapters/FdxAdapter';
import { FountainAdapter } from '../src/services/screenplay/adapters/FountainAdapter';
import { TextAdapter } from '../src/services/screenplay/adapters/TextAdapter';
import { RtfAdapter } from '../src/services/screenplay/adapters/RtfAdapter';
import { parseSlugline } from '../src/services/screenplay/sluglineParser';
import { formatEighths, parseEighths, calculateLineEighths } from '../src/services/screenplay/eighthsHelper';
import { validateScreenplayFile, checkDuplicateScreenplay } from '../src/services/screenplay/validation';

describe('Screenplay Eighths Math & Helpers', () => {
  it('correctly formats eighths into Hollywood standard strings', () => {
    expect(formatEighths(1)).toBe('1/8');
    expect(formatEighths(4)).toBe('4/8');
    expect(formatEighths(7)).toBe('7/8');
    expect(formatEighths(8)).toBe('1');
    expect(formatEighths(11)).toBe('1 3/8');
    expect(formatEighths(16)).toBe('2');
    expect(formatEighths(19)).toBe('2 3/8');
  });

  it('correctly parses eighths string notations back to integers', () => {
    expect(parseEighths('1/8')).toBe(1);
    expect(parseEighths('4/8')).toBe(4);
    expect(parseEighths('1')).toBe(8);
    expect(parseEighths('1 3/8')).toBe(11);
    expect(parseEighths('2')).toBe(16);
    expect(parseEighths('2 3/8')).toBe(19);
  });

  it('calculates eighths from line counts with minimum of 1/8', () => {
    expect(calculateLineEighths(0)).toBe(1);
    expect(calculateLineEighths(5)).toBe(1); // ~5 lines ≈ 1/8
    expect(calculateLineEighths(14)).toBe(2); // ~14 lines ≈ 2/8
    expect(calculateLineEighths(55)).toBe(8); // 55 lines = 1 page (8/8)
  });
});

describe('Slugline & Scene Heading Parser', () => {
  it('correctly identifies standard INT and EXT headings with Day/Night', () => {
    const slug1 = parseSlugline('INT. MONORAIL CAR #4 - NIGHT');
    expect(slug1.isSlugline).toBe(true);
    expect(slug1.intExt).toBe('INT');
    expect(slug1.location).toBe('MONORAIL CAR #4');
    expect(slug1.timeOfDay).toBe('NIGHT');

    const slug2 = parseSlugline('EXT. SKYWAY PLATFORM - DAY');
    expect(slug2.isSlugline).toBe(true);
    expect(slug2.intExt).toBe('EXT');
    expect(slug2.location).toBe('SKYWAY PLATFORM');
    expect(slug2.timeOfDay).toBe('DAY');
  });

  it('handles INT/EXT and I/E variants and dusk/dawn timings', () => {
    const slug1 = parseSlugline('INT./EXT. POLICE CRUISER - DUSK');
    expect(slug1.isSlugline).toBe(true);
    expect(slug1.intExt).toBe('INT/EXT');
    expect(slug1.timeOfDay).toBe('DUSK');

    const slug2 = parseSlugline('I/E. ROOFTOP HELIPAD - DAWN');
    expect(slug2.isSlugline).toBe(true);
    expect(slug2.intExt).toBe('I/E');
    expect(slug2.timeOfDay).toBe('DAWN');
  });

  it('rejects regular dialogue or narrative sentences as sluglines', () => {
    const notSlug1 = parseSlugline('The rain continued to fall heavily over the city.');
    expect(notSlug1.isSlugline).toBe(false);

    const notSlug2 = parseSlugline('DETECTIVE: Where were you at midnight?');
    expect(notSlug2.isSlugline).toBe(false);
  });
});

describe('Final Draft (.fdx) Adapter', () => {
  const fdxXml = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <TitlePage>
    <Content>
      <Paragraph Type="Title">
        <Text>NEO-DETROIT HEIST</Text>
      </Paragraph>
      <Paragraph Type="Author">
        <Text>Kira Vance</Text>
      </Paragraph>
    </Content>
  </TitlePage>
  <Content>
    <Paragraph Type="Scene Heading">
      <SceneProperties Number="1"/>
      <Text>INT. MONORAIL CONTROL ROOM - NIGHT</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <Text>Monitors flicker in green phosphorus light.</Text>
    </Paragraph>
    <Paragraph Type="Character">
      <Text>DETECTIVE</Text>
    </Paragraph>
    <Paragraph Type="Parenthetical">
      <Text>(quietly)</Text>
    </Paragraph>
    <Paragraph Type="Dialogue">
      <Text>Access granted. We have thirty seconds.</Text>
    </Paragraph>
    <Paragraph Type="Scene Heading">
      <SceneProperties Number="2"/>
      <Text>EXT. ROOFTOP - DAWN</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <Text>The helicopter blades spin into motion.</Text>
    </Paragraph>
  </Content>
</FinalDraft>`;

  it('parses structured XML into normalized scenes, characters, and dialogue', async () => {
    const adapter = new FdxAdapter();
    const fakeFile = new File([fdxXml], 'test_script.fdx', { type: 'application/xml' });
    
    expect(adapter.canParse(fakeFile)).toBe(true);
    const result = await adapter.parse(fakeFile, fdxXml);

    expect(result.title).toBe('NEO-DETROIT HEIST');
    expect(result.author).toBe('Kira Vance');
    expect(result.scenes.length).toBe(2);

    // Scene 1
    const scene1 = result.scenes[0];
    expect(scene1.sceneNumber).toBe('1');
    expect(scene1.slugline).toBe('INT. MONORAIL CONTROL ROOM - NIGHT');
    expect(scene1.intExt).toBe('INT');
    expect(scene1.timeOfDay).toBe('NIGHT');
    expect(scene1.characters).toContain('DETECTIVE');
    expect(scene1.dialogueBlocks.length).toBe(1);
    expect(scene1.dialogueBlocks[0].character).toBe('DETECTIVE');
    expect(scene1.dialogueBlocks[0].parenthetical).toBe('(quietly)');

    // Scene 2
    const scene2 = result.scenes[1];
    expect(scene2.sceneNumber).toBe('2');
    expect(scene2.slugline).toBe('EXT. ROOFTOP - DAWN');
    expect(scene2.intExt).toBe('EXT');
    expect(scene2.timeOfDay).toBe('DAWN');
  });
});

describe('Fountain (.fountain) Adapter', () => {
  const fountainContent = `Title: THE MONORAIL ESCAPE
Author: Etienne Dupont

INT. VAULT CHAMBER - NIGHT #10#

= The infiltration begins inside the vault.

The alarm diodes blink amber.

ETIENNE
The security protocol is running backwards.

SYNTHETIC
(checking wrist device)
They have noticed the splice.

EXT. CANAL DOCK - DAWN #11#

Fog curls across the stagnant water.
`;

  it('parses Fountain syntax, synopsis, scene numbers, and boneyard comments', async () => {
    const adapter = new FountainAdapter();
    const fakeFile = new File([fountainContent], 'escape.fountain', { type: 'text/plain' });

    expect(adapter.canParse(fakeFile)).toBe(true);
    const result = await adapter.parse(fakeFile, fountainContent);

    expect(result.title).toBe('THE MONORAIL ESCAPE');
    expect(result.author).toBe('Etienne Dupont');
    expect(result.scenes.length).toBe(2);

    const s1 = result.scenes[0];
    expect(s1.sceneNumber).toBe('10');
    expect(s1.slugline).toBe('INT. VAULT CHAMBER - NIGHT');
    expect(s1.synopsis).toBe('The infiltration begins inside the vault.');
    expect(s1.characters).toContain('ETIENNE');
    expect(s1.characters).toContain('SYNTHETIC');
    expect(s1.dialogueBlocks.length).toBe(2);

    const s2 = result.scenes[1];
    expect(s2.sceneNumber).toBe('11');
    expect(s2.slugline).toBe('EXT. CANAL DOCK - DAWN');
  });
});

describe('Plain Text (.txt) Adapter', () => {
  const textContent = `SCENEPLAY DRAFT
INT. CARGO HOLD - NIGHT

Rain filters through the rusted metal ceiling.

MARCUS
Secure the containers before departure.

CREW HAND
Already done, boss.

EXT. HIGHWAY OVERPASS - DAY

Traffic streams silently below.
`;

  it('parses plaintext screenplay and extracts scene boundaries and cast', async () => {
    const adapter = new TextAdapter();
    const fakeFile = new File([textContent], 'cargo.txt', { type: 'text/plain' });

    expect(adapter.canParse(fakeFile)).toBe(true);
    const result = await adapter.parse(fakeFile, textContent);

    expect(result.scenes.length).toBe(2);
    expect(result.scenes[0].slugline).toBe('INT. CARGO HOLD - NIGHT');
    expect(result.scenes[0].characters).toContain('MARCUS');
    expect(result.scenes[1].slugline).toBe('EXT. HIGHWAY OVERPASS - DAY');
  });
});

describe('File Validation & Duplicate Detection', () => {
  it('validates supported extensions and catches unsupported formats', () => {
    const validFile = new File(['INT. LAB - DAY'], 'script.fountain', { type: 'text/plain' });
    const resValid = validateScreenplayFile(validFile);
    expect(resValid.isValid).toBe(true);
    expect(resValid.format).toBe('fountain');

    const invalidFile = new File(['data'], 'script.exe', { type: 'application/octet-stream' });
    const resInvalid = validateScreenplayFile(invalidFile);
    expect(resInvalid.isValid).toBe(false);
    expect(resInvalid.error).toContain('Unsupported file format');
  });

  it('identifies duplicate filenames and suggests version bumps', () => {
    const existing = [
      {
        id: 'v1',
        version: 'v1.0',
        title: 'Heist Script',
        fileName: 'heist_script.fdx',
        author: 'Kira',
        updatedAt: '2026-01-01',
        changeDescription: 'Initial',
        status: 'Draft' as const
      }
    ];

    const dup = checkDuplicateScreenplay('heist_script.fdx', existing);
    expect(dup.isDuplicate).toBe(true);
    expect(dup.nextVersionTag).toBe('v1.1');

    const noDup = checkDuplicateScreenplay('different_script.fountain', existing);
    expect(noDup.isDuplicate).toBe(false);
  });
});

describe('RTF (.rtf), PDF (.pdf), and DOCX (.docx) Adapters', () => {
  it('RTF adapter strips control words and identifies scene headings', async () => {
    const adapter = new RtfAdapter();
    const rtfContent = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Courier;}}
\\viewkind4\\uc1\\pard\\f0\\fs24 INT. SUBWAY TUNNEL - NIGHT\\par
Water drips rhythmically.\\par
}`;
    const fakeFile = new File([rtfContent], 'subway.rtf', { type: 'application/rtf' });
    expect(adapter.canParse(fakeFile)).toBe(true);

    const result = await adapter.parse(fakeFile, rtfContent);
    expect(result.scenes.length).toBe(1);
    expect(result.scenes[0].slugline).toBe('INT. SUBWAY TUNNEL - NIGHT');
    expect(result.warnings.some(w => w.id === 'rtf-conversion-notice')).toBe(true);
  });
});

