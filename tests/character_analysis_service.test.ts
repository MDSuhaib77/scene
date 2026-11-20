import { describe, it, expect } from 'vitest';
import {
  analyzeScreenplayCharacters,
  cleanCharacterCue,
  countWords,
  resolveCanonicalName,
} from '../src/features/breakdown/services/characterAnalysisService';
import {
  parseFountainToCanonical,
} from '../src/features/screenplay/model/fountainParser';
import {
  canonicalToParsedScenes,
} from '../src/features/screenplay/model/canonicalConverters';
import { ParsedScene } from '../src/types';

describe('SceneOS — Character Analysis Engine & Extraction Pipeline', () => {
  it('1. correctly cleans character cue extensions without altering canonical identity', () => {
    expect(cleanCharacterCue('DETECTIVE BLAKE (O.S.)')).toEqual({
      canonicalName: 'DETECTIVE BLAKE',
      extensions: ['O.S.'],
    });

    expect(cleanCharacterCue('SARAH (CONT\'D)')).toEqual({
      canonicalName: 'SARAH',
      extensions: ['CONT\'D'],
    });

    expect(cleanCharacterCue('RADIO ANNOUNCER (V.O.) (FILTERED)')).toEqual({
      canonicalName: 'RADIO ANNOUNCER',
      extensions: ['V.O.', 'FILTERED'],
    });

    expect(cleanCharacterCue('@SPECIAL AGENT')).toEqual({
      canonicalName: 'SPECIAL AGENT',
      extensions: [],
    });
  });

  it('2. accurately counts words in dialogue excluding cues and parentheticals', () => {
    expect(countWords('Where was the ledger found?')).toBe(5);
    expect(countWords('   ')).toBe(0);
    expect(countWords('No, sir. Not here! Look over there...')).toBe(7);
  });

  it('3. processes complete screenplay fixture covering all required edge cases', () => {
    const mockScenes: ParsedScene[] = [
      {
        id: 'scn-1',
        sceneNumber: '1',
        heading: 'INT. DETECTIVE PRECINCT - DAY',
        slugline: 'INT. DETECTIVE PRECINCT - DAY',
        location: 'DETECTIVE PRECINCT',
        intExt: 'INT',
        timeOfDay: 'DAY',
        pageLengthEighths: 8,
        pageLengthDisplay: '1 0/8',
        startPage: 1,
        estimatedDurationMinutes: 1,
        characters: ['DETECTIVE BLAKE', 'SERGEANT CROSS', 'OFFICER PETERSON'],
        dialogueBlocks: [
          { character: 'DETECTIVE BLAKE', text: 'Where was the ledger found?' },
          { character: 'SERGEANT CROSS (CONT\'D)', text: 'In the trunk of the Dodge.' },
          { character: 'DETECTIVE BLAKE (O.S.)', text: 'Did Peterson dust it for prints?' },
          { character: 'SERGEANT CROSS', text: 'He is working on it now.' },
        ],
      },
      {
        id: 'scn-2',
        sceneNumber: '2',
        heading: 'EXT. HARBOR DOCKS - NIGHT',
        slugline: 'EXT. HARBOR DOCKS - NIGHT',
        location: 'HARBOR DOCKS',
        intExt: 'EXT',
        timeOfDay: 'NIGHT',
        pageLengthEighths: 16,
        pageLengthDisplay: '2 0/8',
        startPage: 2,
        estimatedDurationMinutes: 2,
        characters: ['DETECTIVE BLAKE', 'SMUGGLER', 'MYSTERIOUS INFORMANT'],
        dialogueBlocks: [
          // Blake speaks to Smuggler
          { character: 'DETECTIVE BLAKE', text: 'Hands where I can see them.' },
          { character: 'SMUGGLER', text: 'You have no jurisdiction on these docks, detective.' },
          { character: 'DETECTIVE BLAKE', text: 'Step back from the container.' },
        ],
      },
      {
        id: 'scn-3',
        sceneNumber: '3',
        heading: 'INT. SUBWAY CAR - NIGHT',
        slugline: 'INT. SUBWAY CAR - NIGHT',
        location: 'SUBWAY CAR',
        intExt: 'INT',
        timeOfDay: 'NIGHT',
        pageLengthEighths: 6,
        pageLengthDisplay: '6/8',
        startPage: 4,
        estimatedDurationMinutes: 1,
        characters: ['LONE COMMUTER'],
        dialogueBlocks: [
          // Solitary speaker (no interaction partner)
          { character: 'LONE COMMUTER', text: 'I should have taken the express bus.' },
        ],
      },
    ];

    const result = analyzeScreenplayCharacters(mockScenes, 'Neon Harbor Script');

    // 1. All confirmed speakers are present
    const speakerNames = result.characters.map(c => c.canonicalName);
    expect(speakerNames).toContain('DETECTIVE BLAKE');
    expect(speakerNames).toContain('SERGEANT CROSS');
    expect(speakerNames).toContain('SMUGGLER');
    expect(speakerNames).toContain('LONE COMMUTER');

    // 2. Mentioned characters who never speak (OFFICER PETERSON, MYSTERIOUS INFORMANT)
    const mentionedNames = result.mentionedCharacters.map(m => m.name);
    expect(mentionedNames).toContain('OFFICER PETERSON');
    expect(mentionedNames).toContain('MYSTERIOUS INFORMANT');
    expect(speakerNames).not.toContain('OFFICER PETERSON');

    // 3. Exact metric reconciliation for DETECTIVE BLAKE:
    // Scene 1: 2 dialogue blocks ("Where was the ledger found?" [5 words], "Did Peterson dust it for prints?" [6 words])
    // Scene 2: 2 dialogue blocks ("Hands where I can see them." [6 words], "Step back from the container." [5 words])
    // Total blocks = 4, Total words = 22, Avg length = 22 / 4 = 5.5, Speaking scenes = 2
    const blake = result.characters.find(c => c.canonicalName === 'DETECTIVE BLAKE')!;
    expect(blake.totalDialogueBlocks).toBe(4);
    expect(blake.totalDialogueWords).toBe(22);
    expect(blake.averageDialogueLength).toBe(5.5);
    expect(blake.speakingScenesCount).toBe(2);
    expect(blake.extensionsSeen).toContain('O.S.');

    // 4. Interaction Engine Verification:
    // Scene 1:
    // Turn 1: BLAKE -> CROSS (exchange 1)
    // Turn 2: CROSS -> BLAKE (exchange 2)
    // Turn 3: BLAKE -> CROSS (exchange 3)
    // Total BLAKE <-> CROSS exchanges = 3
    const blakeCrossEdge = result.interactions.find(
      i => (i.source === 'DETECTIVE BLAKE' && i.target === 'SERGEANT CROSS') ||
           (i.source === 'SERGEANT CROSS' && i.target === 'DETECTIVE BLAKE')
    );
    expect(blakeCrossEdge).toBeDefined();
    expect(blakeCrossEdge!.exchangeCount).toBe(3);

    // Scene 2:
    // Turn 1: BLAKE -> SMUGGLER (exchange 1)
    // Turn 2: SMUGGLER -> BLAKE (exchange 2)
    // Total BLAKE <-> SMUGGLER exchanges = 2
    const blakeSmugglerEdge = result.interactions.find(
      i => (i.source === 'DETECTIVE BLAKE' && i.target === 'SMUGGLER') ||
           (i.source === 'SMUGGLER' && i.target === 'DETECTIVE BLAKE')
    );
    expect(blakeSmugglerEdge).toBeDefined();
    expect(blakeSmugglerEdge!.exchangeCount).toBe(2);

    // 5. Lone speaker has 0 interactions
    const lone = result.characters.find(c => c.canonicalName === 'LONE COMMUTER')!;
    expect(lone.totalInteractionCount).toBe(0);
    expect(lone.interactions).toHaveLength(0);

    // 6. No cross-scene interactions between Scene 1 end (CROSS) and Scene 2 start (BLAKE)
    const crossSmugglerEdge = result.interactions.find(
      i => (i.source === 'SERGEANT CROSS' && i.target === 'SMUGGLER') ||
           (i.source === 'SMUGGLER' && i.target === 'SERGEANT CROSS')
    );
    expect(crossSmugglerEdge).toBeUndefined();

    // 7. Completeness Audit
    expect(result.audit.totalParsedScenes).toBe(3);
    expect(result.audit.totalDetectedCues).toBe(8);
    expect(result.audit.totalDialogueBlocks).toBe(8);
    expect(result.audit.status).toBe('complete');
  });

  it('4. persists manual alias overrides and merges across re-analysis', () => {
    const mockScenes: ParsedScene[] = [
      {
        id: 'scn-1',
        sceneNumber: '1',
        heading: 'INT. OFFICE - DAY',
        slugline: 'INT. OFFICE - DAY',
        location: 'OFFICE',
        intExt: 'INT',
        timeOfDay: 'DAY',
        pageLengthEighths: 8,
        pageLengthDisplay: '1 0/8',
        startPage: 1,
        estimatedDurationMinutes: 1,
        characters: ['BLAKE', 'DETECTIVE BLAKE'],
        dialogueBlocks: [
          { character: 'BLAKE', text: 'First line.' },
          { character: 'SARAH', text: 'Second line.' },
          { character: 'DETECTIVE BLAKE', text: 'Third line.' },
        ],
      },
    ];

    // Without override, BLAKE and DETECTIVE BLAKE are separate
    const initial = analyzeScreenplayCharacters(mockScenes, 'Test');
    expect(initial.characters.map(c => c.canonicalName)).toContain('BLAKE');
    expect(initial.characters.map(c => c.canonicalName)).toContain('DETECTIVE BLAKE');

    // With alias override mapping BLAKE -> DETECTIVE BLAKE
    const merged = analyzeScreenplayCharacters(mockScenes, 'Test', {
      aliases: {
        BLAKE: 'DETECTIVE BLAKE',
      },
    });

    const mergedSpeakers = merged.characters.map(c => c.canonicalName);
    expect(mergedSpeakers).toContain('DETECTIVE BLAKE');
    expect(mergedSpeakers).not.toContain('BLAKE');

    const canonicalBlake = merged.characters.find(c => c.canonicalName === 'DETECTIVE BLAKE')!;
    expect(canonicalBlake.totalDialogueBlocks).toBe(2);
    expect(canonicalBlake.aliases).toContain('BLAKE');
  });

  it('5. extracts dialogue blocks, parentheticals, extensions, and dual dialogue from canonical documents', () => {
    const fountain = `INT. CONTROL ROOM - NIGHT

RAIN POUNDS AGAINST THE GLASS.

ELENA (V.O.)
(tense)
Check the perimeter sensors.

MARCUS
Right away.

ELENA
Watch the east gate!

MARCUS ^
Already locked down!
`;
    const canonical = parseFountainToCanonical(fountain);
    const scenes = canonicalToParsedScenes(canonical);
    const dataset = analyzeScreenplayCharacters(scenes, 'Control Room Script');

    expect(scenes.length).toBe(1);
    expect(scenes[0].dialogueBlocks.length).toBeGreaterThanOrEqual(4);

    // Uppercase action line "RAIN POUNDS AGAINST THE GLASS." must NOT be treated as a speaker
    const names = dataset.characters.map(c => c.canonicalName);
    expect(names).not.toContain('RAIN POUNDS AGAINST THE GLASS.');
    expect(names).toContain('ELENA');
    expect(names).toContain('MARCUS');

    const elena = dataset.characters.find(c => c.canonicalName === 'ELENA')!;
    const marcus = dataset.characters.find(c => c.canonicalName === 'MARCUS')!;
    expect(elena.extensionsSeen).toContain('V.O.');
    // Parenthetical "(tense)" excluded from word count: "Check the perimeter sensors." (4) + "Watch the east gate!" (4) = 8
    expect(elena.totalDialogueWords).toBe(8);
    expect(marcus.totalDialogueBlocks).toBe(2);
    expect(dataset.audit.status).toBe('complete');
  });

  it('6. tracks unassigned dialogue blocks in audit and resolves them when assigned via override', () => {
    const scenes: ParsedScene[] = [
      {
        id: 'scn-unassigned',
        sceneNumber: '1',
        slugline: 'INT. HALLWAY - DAY',
        intExt: 'INT',
        location: 'HALLWAY',
        timeOfDay: 'DAY',
        pageLengthEighths: 4,
        pageLengthDisplay: '4/8',
        startPage: 1,
        estimatedDurationMinutes: 0.5,
        characters: [],
        dialogueBlocks: [
          { character: '', text: 'Who turned off the corridor lights?' },
        ],
        elements: [],
        status: 'unreviewed',
      },
    ];

    const reviewNeeded = analyzeScreenplayCharacters(scenes, 'Mystery Script');
    expect(reviewNeeded.audit.status).toBe('review_required');
    expect(reviewNeeded.audit.unassignedDialogueBlocks.length).toBe(1);

    const key = reviewNeeded.audit.unassignedDialogueBlocks[0].blockKey;
    const assigned = analyzeScreenplayCharacters(scenes, 'Mystery Script', {
      assignedBlocks: {
        [key]: 'GUARD',
      },
    });
    expect(assigned.audit.status).toBe('complete');
    expect(assigned.characters.map(c => c.canonicalName)).toContain('GUARD');
  });
});
