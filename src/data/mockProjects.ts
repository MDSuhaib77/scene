/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FilmProject } from '../types';
import { DEMO_PARSED_SCENES, DEMO_SCREENPLAY_RAW_TEXT } from './sampleScreenplay';

export const INITIAL_PROJECTS: FilmProject[] = [
  {
    id: 'proj-neon-dreams',
    title: 'Neon Dreams: Chapter One',
    userDesignation: 'Director',
    logline: 'In a rain-slicked cyberpunk metropolis, a rogue synthetic consciousness hires a detective to delete its backup servers before a megacorporation wipes its kernel.',
    director: 'Kira Vance',
    startDate: '2026-06-01',
    finalEndDate: '2026-08-10',
    suggestedEndDate: '2026-08-10',
    isEndDateFixed: true,
    constraints: {
      budgetLimit: 4500000,
      dailyBurnRateCap: 50000,
      screenplayLocked: true,
      castAvailabilityDays: 45,
      permitLeadTimeDays: 15,
      targetRating: 'PG-13',
      weatherContingencyBuffer: 8,
      postOverheadRatio: 20
    },
    phases: [
      {
        id: 'phase-pre-1',
        name: 'Pre-Production Planning',
        category: 'pre',
        color: 'bg-cyan-950/80 border-cyan-550/40 hover:bg-cyan-900/40',
        textLightColor: 'text-cyan-400',
        textDarkColor: 'text-cyan-200',
        durationDays: 25,
        startDate: '2026-06-01',
        endDate: '2026-06-25',
        status: 'completed',
        activities: [
          { id: 'act-pre-1', name: 'Cast Elena Rostova for lead role', completed: true, estimatedDays: 10 },
          { id: 'act-pre-2', name: 'Secure monorail shooting permit', completed: true, estimatedDays: 8 },
          { id: 'act-pre-3', name: 'Lock scene script changes', completed: true, estimatedDays: 7 }
        ],
        crew: [
          { id: 'c-1', name: 'Kira Vance', role: 'Director', email: 'kira@studio-plan.io', phone: '+1-555-1029', status: 'Confirmed' },
          { id: 'c-2', name: 'Elena Rostova', role: 'Lead Actor', email: 'elena@studio-plan.io', phone: '+1-555-4089', status: 'Confirmed' }
        ]
      },
      {
        id: 'phase-prod-1',
        name: 'Production Shooting',
        category: 'prod',
        color: 'bg-indigo-950/80 border-indigo-505/30 hover:bg-indigo-900/40',
        textLightColor: 'text-indigo-400',
        textDarkColor: 'text-indigo-200',
        durationDays: 30,
        startDate: '2026-06-26',
        endDate: '2026-07-25',
        status: 'active',
        activities: [
          { id: 'act-prod-1', name: 'Principal Photography - Heist Scene', completed: false, estimatedDays: 15 },
          { id: 'act-prod-2', name: 'Alleyway rain combat choreography', completed: false, estimatedDays: 15 }
        ],
        crew: [
          { id: 'c-3', name: 'Jack Miller', role: 'Director of Photography', email: 'jack@studio-plan.io', phone: '+1-555-8711', status: 'Confirmed' }
        ]
      },
      {
        id: 'phase-post-1',
        name: 'Post-Production Integration',
        category: 'post',
        color: 'bg-rose-950/80 border-rose-550/40 hover:bg-rose-900/40',
        textLightColor: 'text-rose-400',
        textDarkColor: 'text-rose-200',
        durationDays: 16,
        startDate: '2026-07-26',
        endDate: '2026-08-10',
        status: 'pending',
        activities: [
          { id: 'act-post-1', name: 'Color grading and digital look sync', completed: false, estimatedDays: 8 },
          { id: 'act-post-2', name: 'Audio SFX & soundtrack overlay mix', completed: false, estimatedDays: 8 }
        ],
        crew: [
          { id: 'c-4', name: 'Aiden Sparks', role: 'Film Editor', email: 'sparks@studio-plan.io', phone: '+1-555-1212', status: 'Confirmed' }
        ]
      }
    ],
    updatedAt: '2026-05-31T12:00:00Z',
    footageBackups: [
      {
        id: 'foot-nd-1',
        name: 'Scene 4 Heist - Night Rain A-Roll',
        date: '2026-06-01',
        storageLocation: 'Local on-set NAS RAID-5 & AWS S3 Glacier',
        fileCount: 48,
        totalSizeGB: 184.5,
        hashMD5: '2ea3fc45a19001ee824c9ef89cf181ff',
        status: 'Verified',
        notes: 'Shot on RED V-Raptor 8K. All takes verified clean, rain machinery background hum is minimized.'
      },
      {
        id: 'foot-nd-2',
        name: 'Scene 12 Alley Combat - B-Roll Stunts',
        date: '2026-06-02',
        storageLocation: 'On-set Thunderbolt SSD clone #1 (Unsync)',
        fileCount: 22,
        totalSizeGB: 95.2,
        hashMD5: '7da1cff9ea36109924c9ef77cc12349f',
        status: 'Uploading',
        notes: 'Elena Rostova double stunt sequences. Some flare anomalies on lens C, check color correction guidelines.'
      }
    ],
    screenplayVersions: [
      {
        id: 'scr-nd-1',
        version: 'v1.0',
        title: 'Neon Dreams: Chapter One',
        author: 'Kira Vance',
        updatedAt: '2026-05-24 14:30',
        changeDescription: 'Initial locked shooting draft with Scenes 1-3.',
        contentSnippet: 'DETECTIVE\nTell your creator that the servers are secured. But it is going to cost double.\n\nSYNTHETIC\nMoney is an execution detail, Detective.',
        status: 'Locked',
        fileName: 'neon_dreams_ch1.fountain',
        sourceFormat: 'fountain',
        totalScenes: 3,
        totalPageEighths: 36,
        totalPageCountDisplay: '4 4/8',
        characters: ['DETECTIVE', 'SYNTHETIC', 'TICKET ROBOT', 'HACKER'],
        locations: ['NEO-DETROIT SKYWAY', 'MONORAIL CAR #4', 'SERVER JUNCTION TOWER'],
        scenes: DEMO_PARSED_SCENES,
        rawText: DEMO_SCREENPLAY_RAW_TEXT,
      },
      {
        id: 'scr-nd-2',
        version: 'v1.1',
        title: 'Alley combat choreography optimization dialogue adjustments',
        author: 'Kira Vance',
        updatedAt: '2026-06-01 09:15',
        changeDescription: 'Refined character interaction lines prior to active shooting window.',
        contentSnippet: 'DETECTIVE\n(wiping water from eyelids)\nI do not like dancing in the deluge.\n\nSYNTHETIC\nThen adapt, or short-circuits.',
        status: 'Approved',
        fileName: 'neon_dreams_ch1_rev1.fountain',
        sourceFormat: 'fountain',
        totalScenes: 3,
        totalPageEighths: 36,
        totalPageCountDisplay: '4 4/8',
        characters: ['DETECTIVE', 'SYNTHETIC', 'TICKET ROBOT', 'HACKER'],
        locations: ['NEO-DETROIT SKYWAY', 'MONORAIL CAR #4', 'SERVER JUNCTION TOWER'],
        scenes: DEMO_PARSED_SCENES,
        rawText: DEMO_SCREENPLAY_RAW_TEXT,
      }
    ],
    storyboardRevisions: [
      {
        id: 'stb-nd-1',
        sceneNumber: 'Scene 4',
        panelNumber: 'Panel 1A',
        title: 'Wide Angle Monorail Approach',
        description: 'Tracking shot of the elevated train slicing through neon skyscrapers. Rain spray reflecting backlight.',
        updatedAt: '2026-05-20',
        version: 'v1',
        artist: 'Sarah Lin',
        status: 'Approved'
      },
      {
        id: 'stb-nd-2',
        sceneNumber: 'Scene 4',
        panelNumber: 'Panel 2B',
        title: 'Detective Eye Close-Up',
        description: 'Extreme close up of Detective staring at holographic decryption drive with green terminal code casting over skin.',
        updatedAt: '2026-05-22',
        version: 'v2',
        artist: 'Sarah Lin',
        status: 'Approved'
      }
    ]
  },
  {
    id: 'proj-louvre-heist',
    title: 'Shadows of the Louvre',
    userDesignation: 'Executive Producer',
    logline: 'An elegant French art conservator orchestrates the double-theft of a neglected masterpiece to expose a high-society laundering cartel.',
    director: 'Etienne Dupont',
    startDate: '2026-05-15',
    finalEndDate: '2026-07-28',
    suggestedEndDate: '2026-07-28',
    isEndDateFixed: false,
    constraints: {
      budgetLimit: 12000000,
      dailyBurnRateCap: 120000,
      screenplayLocked: true,
      castAvailabilityDays: 30,
      permitLeadTimeDays: 30,
      targetRating: 'R',
      weatherContingencyBuffer: 5,
      postOverheadRatio: 15
    },
    phases: [
      {
        id: 'phase-pre-2',
        name: 'Pre-Production Casting & Visuals',
        category: 'pre',
        color: 'bg-cyan-950/80 border-cyan-550/40 hover:bg-cyan-900/40',
        textLightColor: 'text-cyan-400',
        textDarkColor: 'text-cyan-200',
        durationDays: 25,
        startDate: '2026-05-15',
        endDate: '2026-06-08',
        status: 'completed',
        activities: [
          { id: 'act-pre2-1', name: 'Paris shooting permit validation', completed: true, estimatedDays: 15 },
          { id: 'act-pre2-2', name: 'Draft heist blueprints coordination', completed: true, estimatedDays: 10 }
        ],
        crew: [
          { id: 'c-lh1', name: 'Etienne Dupont', role: 'Director', email: 'dupont@studio-plan.io', phone: '+33-6555-0912', status: 'Confirmed' },
          { id: 'c-lh2', name: 'Pierre Gasly', role: 'Location Scout', email: 'gasly@studio-plan.io', phone: '+33-6555-1100', status: 'Confirmed' }
        ]
      },
      {
        id: 'phase-prod-2',
        name: 'Production Filming',
        category: 'prod',
        color: 'bg-indigo-950/80 border-indigo-505/30 hover:bg-indigo-900/40',
        textLightColor: 'text-indigo-400',
        textDarkColor: 'text-indigo-200',
        durationDays: 30,
        startDate: '2026-06-09',
        endDate: '2026-07-08',
        status: 'active',
        activities: [
          { id: 'act-prod2-1', name: 'Paris Museum Grand Gallery filming', completed: false, estimatedDays: 20 },
          { id: 'act-prod2-2', name: 'Seine night chases shooting', completed: false, estimatedDays: 10 }
        ],
        crew: [
          { id: 'c-lh3', name: 'Benoit Poelvoorde', role: 'DP', email: 'poel@studio-plan.io', phone: '+33-7555-2244', status: 'Confirmed' }
        ]
      },
      {
        id: 'phase-post-2',
        name: 'Post-Production Mastering',
        category: 'post',
        color: 'bg-rose-950/80 border-rose-550/40 hover:bg-rose-900/40',
        textLightColor: 'text-rose-400',
        textDarkColor: 'text-rose-200',
        durationDays: 20,
        startDate: '2026-07-09',
        endDate: '2026-07-28',
        status: 'pending',
        activities: [
          { id: 'act-post2-1', name: 'Color correct Parisian warm color palette', completed: false, estimatedDays: 10 },
          { id: 'act-post2-2', name: 'Orchestral chamber soundtrack fusion', completed: false, estimatedDays: 10 }
        ],
        crew: [
          { id: 'c-lh4', name: 'Maurice Jarre Jr.', role: 'Composer', email: 'jarre@studio-plan.io', phone: '+43-1555-2980', status: 'Hold' }
        ]
      }
    ],
    updatedAt: '2026-05-31T12:00:00Z',
    footageBackups: [
      {
        id: 'foot-lh-1',
        name: 'Opening Museum Setup - Louvre Vault Ambient',
        date: '2026-05-20',
        storageLocation: 'Paris Studio NAS Backup System',
        fileCount: 30,
        totalSizeGB: 112.0,
        hashMD5: '9fa1be34e0011bb2c38ddee32aa90ff4',
        status: 'Verified',
        notes: 'Arri Alexa 35 footage. Warm lighting setup inside historical gallery, exceptional sharpness.'
      }
    ],
    screenplayVersions: [
      {
        id: 'scr-lh-1',
        version: 'v1.0',
        title: 'Original Submission Script (Louvre Entry)',
        author: 'Etienne Dupont',
        updatedAt: '2026-05-10 11:15',
        changeDescription: 'Casting script submission draft for Pierre Gasly and main crew review.',
        contentSnippet: 'ETIENNE\n(whispering below the framing)\nThe masterpiece is not what they guard. It is what they have forgotten in the vaults.',
        status: 'Locked'
      }
    ],
    storyboardRevisions: [
      {
        id: 'stb-lh-1',
        sceneNumber: 'Scene 2',
        panelNumber: 'Panel A1',
        title: 'The Vault Entrance Infiltration',
        description: 'Low-angle tracking shot of Pierre bypassing keys at the security desk.',
        updatedAt: '2026-05-12',
        version: 'v1',
        artist: 'Jean-Luc Godard',
        status: 'Approved'
      }
    ]
  }
];

export const WALKTHROUGH_PROJECT: FilmProject = {
  id: 'proj-walkthrough',
  title: '🎬 Walkthrough: Film Pipeline Scheduler',
  userDesignation: 'Line Producer',
  userDesignations: ['Line Producer'],
  logline: 'Learn how to utilize plan to optimize daily burn rates, coordinate technical crews, and balance rigid box-office release targets with flexible downstream schedules.',
  director: 'Etienne Dupont',
  startDate: '2026-06-10',
  finalEndDate: '2026-08-20',
  suggestedEndDate: '2026-08-20',
  isEndDateFixed: false,
  isWalkthrough: true,
  constraints: {
    budgetLimit: 500000,
    dailyBurnRateCap: 5000,
    screenplayLocked: true,
    castAvailabilityDays: 45,
    permitLeadTimeDays: 14,
    targetRating: 'PG-13',
    weatherContingencyBuffer: 5,
    postOverheadRatio: 15
  },
  phases: [
    {
      id: 'wt-phase-pre',
      name: 'Pre-Production Setup',
      category: 'pre',
      color: 'bg-cyan-950/80 border-cyan-550/40 hover:bg-cyan-900/40',
      textLightColor: 'text-cyan-400',
      textDarkColor: 'text-cyan-200',
      durationDays: 20,
      startDate: '2026-06-10',
      endDate: '2026-06-30',
      status: 'active',
      activities: [
        { id: 'wt-act-pre-1', name: 'Lock screenplay shooting draft', completed: false, estimatedDays: 10 },
        { id: 'wt-act-pre-2', name: 'Secure monorail filming permits', completed: false, estimatedDays: 10 }
      ],
      crew: [
        { id: 'wt-crew-1', name: 'Sarah Lin', role: 'Art Director', email: 'sarah@studio-plan.io', phone: '+1-555-1200', status: 'Confirmed' }
      ]
    },
    {
      id: 'wt-phase-prod',
      name: 'Production Phase',
      category: 'prod',
      color: 'bg-indigo-950/80 border-indigo-505/30 hover:bg-indigo-900/40',
      textLightColor: 'text-indigo-400',
      textDarkColor: 'text-indigo-200',
      durationDays: 30,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      status: 'pending',
      activities: [
        { id: 'wt-act-prod-1', name: 'Shoot core dialog in studio', completed: false, estimatedDays: 30 }
      ],
      crew: []
    }
  ],
  updatedAt: new Date().toISOString(),
  footageBackups: [
    {
      id: 'wt-foot-1',
      name: 'A-Roll Cam: Day 1 Storyline',
      date: '2026-06-10',
      storageLocation: 'Local on-set NAS',
      fileCount: 15,
      totalSizeGB: 65.4,
      hashMD5: '5fa3bc45a19001ee824c9ef89cf181aa',
      status: 'Verified',
      notes: 'Sample footage'
    }
  ],
  screenplayVersions: [
    {
      id: 'wt-scr-1',
      version: 'v1.0',
      title: 'Walkthrough Script Locked Draft',
      author: 'Kira Vance',
      updatedAt: '2026-06-10 10:00',
      changeDescription: 'Initial tutorial locked screenplay snippet.',
      contentSnippet: 'OPERATOR\nWelcome to the production scheduler. Let us calculate our first release date constraint.',
      status: 'Locked'
    }
  ],
  storyboardRevisions: [
    {
      id: 'wt-stb-1',
      sceneNumber: 'Scene 1',
      panelNumber: 'Panel 1',
      title: 'Opening Shot Concept',
      description: 'Camera slow pans over empty canvas board displaying timeline data lines.',
      updatedAt: '2026-06-10',
      version: 'v1',
      artist: 'Walkthrough Artist',
      status: 'Approved'
    }
  ]
};
