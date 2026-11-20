/**
 * SceneOS — Synthetic Demonstration Screenplay & Sample Scenes
 * 
 * Provides an original, copyright-free cyberpunk noir synthetic screenplay
 * and pre-populated parsed scenes with tagged breakdown resources.
 * Used for demo purposes so Overview -> Screenplay -> Breakdown -> Plan works out of the box.
 */

import { ParsedScene } from '../services/screenplay/types';

export const DEMO_SCREENPLAY_RAW_TEXT = `Title: NEON DREAMS: CHAPTER ONE
Author: Kira Vance
Format: Feature Screenplay Draft

EXT. NEO-DETROIT SKYWAY - NIGHT #1#

Heavy rain lashes against the elevated monorail transit line. Neon skyscrapers pierce the mist like luminous ribcages.

The sleek metallic train shrieks along the magnetic rail.

DETECTIVE
Tell your creator the servers are locked down. But it is going to cost double.

SYNTHETIC
Money is an execution detail, Detective. Just do not let them trace the kernel.

DETECTIVE
(wiping water from eyelids)
I do not like dancing in the deluge.

INT. MONORAIL CAR #4 - NIGHT #2#

Inside the carriage, the fluorescent panels flicker with intermittent amber flashes.

Commuters in heavy protective coats avoid eye contact. 

A silver-plated TICKET ROBOT rolls down the central aisle, scanning transit chips with a low hum.

TICKET ROBOT
Fares validated. Please remain seated during deceleration.

The Detective slides a sub-neural scanner into his coat.

DETECTIVE
Security grid is scanning biometrics at the next terminal. We have two minutes.

SYNTHETIC
Then we breach through the roof hatch.

INT. SERVER JUNCTION TOWER - DAWN #3#

Columns of liquid-cooled mainframes hum in unison. The chamber glows deep indigo.

A security laser grid sweeps the perimeter in rhythmic blue pulses.

HACKER
Thirty seconds until automated lockout. I am disabling the coolant valves.

SYNTHETIC
Do it now. Before the sentinel drones reboot.
`;

export const DEMO_PARSED_SCENES: ParsedScene[] = [
  {
    id: 'scn-demo-1',
    sceneNumber: '1',
    slugline: 'EXT. NEO-DETROIT SKYWAY - NIGHT',
    intExt: 'EXT',
    location: 'NEO-DETROIT SKYWAY',
    timeOfDay: 'NIGHT',
    pageLengthEighths: 12,
    pageLengthDisplay: '1 4/8',
    startPage: 1,
    estimatedDurationMinutes: 1.5,
    synopsis: 'Heavy rain lashes across the elevated monorail transit line. Detective and Synthetic confront megacorp pursuers.',
    characters: ['DETECTIVE', 'SYNTHETIC'],
    dialogueBlocks: [
      {
        character: 'DETECTIVE',
        text: 'Tell your creator the servers are locked down. But it is going to cost double.',
      },
      {
        character: 'SYNTHETIC',
        text: 'Money is an execution detail, Detective. Just do not let them trace the kernel.',
      },
      {
        character: 'DETECTIVE',
        parenthetical: '(wiping water from eyelids)',
        text: 'I do not like dancing in the deluge.',
      },
    ],
    elements: [
      { id: 'el-1', category: 'vehicle', name: 'Monorail Car #4' },
      { id: 'el-2', category: 'prop', name: 'Holographic Keycard' },
      { id: 'el-3', category: 'stunt', name: 'Platform leap across rainy tracks' },
    ],
    status: 'reviewed',
    scriptSnippet: 'EXT. NEO-DETROIT SKYWAY - NIGHT\n\nRain hammers against the polycarbonate monorail hull.',
    contentHash: 'd1a2b3c4',
  },
  {
    id: 'scn-demo-2',
    sceneNumber: '2',
    slugline: 'INT. MONORAIL CAR #4 - NIGHT',
    intExt: 'INT',
    location: 'MONORAIL CAR #4',
    timeOfDay: 'NIGHT',
    pageLengthEighths: 17,
    pageLengthDisplay: '2 1/8',
    startPage: 3,
    estimatedDurationMinutes: 2.1,
    synopsis: 'Inside the train, Detective and Synthetic prepare an escape while a Ticket Robot sweeps biometric chips.',
    characters: ['DETECTIVE', 'SYNTHETIC', 'TICKET ROBOT'],
    dialogueBlocks: [
      {
        character: 'TICKET ROBOT',
        text: 'Fares validated. Please remain seated during deceleration.',
      },
      {
        character: 'DETECTIVE',
        text: 'Security grid is scanning biometrics at the next terminal. We have two minutes.',
      },
      {
        character: 'SYNTHETIC',
        text: 'Then we breach through the roof hatch.',
      },
    ],
    elements: [
      { id: 'el-4', category: 'wardrobe', name: 'Wet trenchcoat' },
      { id: 'el-5', category: 'prop', name: 'Sub-neural scanner' },
    ],
    status: 'unreviewed',
    scriptSnippet: 'INT. MONORAIL CAR #4 - NIGHT\n\nFlickering fluorescent strips hum overhead.',
    contentHash: 'e5f6a7b8',
  },
  {
    id: 'scn-demo-3',
    sceneNumber: '3',
    slugline: 'INT. SERVER JUNCTION TOWER - DAWN',
    intExt: 'INT',
    location: 'SERVER JUNCTION TOWER',
    timeOfDay: 'DAWN',
    pageLengthEighths: 7,
    pageLengthDisplay: '7/8',
    startPage: 5,
    estimatedDurationMinutes: 0.9,
    synopsis: 'The team infiltrates the server vault before the security grid re-arms and sentinels reboot.',
    characters: ['SYNTHETIC', 'HACKER'],
    dialogueBlocks: [
      {
        character: 'HACKER',
        text: 'Thirty seconds until automated lockout. I am disabling the coolant valves.',
      },
      {
        character: 'SYNTHETIC',
        text: 'Do it now. Before the sentinel drones reboot.',
      },
    ],
    elements: [
      { id: 'el-6', category: 'vfx', name: 'Server rack laser grid' },
      { id: 'el-7', category: 'prop', name: 'Optical data siphon cable' },
    ],
    status: 'unreviewed',
    scriptSnippet: 'INT. SERVER JUNCTION TOWER - DAWN\n\nRows of liquid-cooled servers pulse with amber light.',
    contentHash: '9c8b7a6f',
  },
];
