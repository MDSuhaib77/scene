import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BreakdownReportsView } from '../src/features/breakdown/components/BreakdownReportsView';
import { FilmProject, ParsedScene } from '../src/types';
import { SupabaseProjectService } from '../src/services/supabase/SupabaseAdapters';

// Polyfill window & localStorage for Node testing environment
const memoryStore = new Map<string, string>();
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  key: (index: number) => Array.from(memoryStore.keys())[index] || null,
  get length() {
    return memoryStore.size;
  },
};

describe('Breakdown Reports Scene Selection & Print Zoom Specs', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  const mockScenes: ParsedScene[] = [
    {
      id: 'scn-101',
      sceneNumber: '1',
      slugline: 'INT. DETECTIVE OFFICE - NIGHT',
      heading: 'INT. DETECTIVE OFFICE - NIGHT',
      location: 'Detective Office',
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      pageNumber: 1,
      pageLengthDisplay: '1 2/8',
      pageLengthEighths: 10,
      characters: ['KANE', 'MILLER'],
      elements: [],
      synopsis: 'Kane reviews the case ledger.',
    } as any,
    {
      id: 'scn-102',
      sceneNumber: '2',
      slugline: 'EXT. HARBOR DOCKS - DAWN',
      heading: 'EXT. HARBOR DOCKS - DAWN',
      location: 'Pier 9',
      intExt: 'EXT',
      timeOfDay: 'DAWN',
      pageNumber: 2,
      pageLengthDisplay: '2 0/8',
      pageLengthEighths: 16,
      characters: ['MILLER'],
      elements: [],
      synopsis: 'Miller meets a contact on the misty pier.',
    } as any,
    {
      id: 'scn-103',
      sceneNumber: '3',
      slugline: 'INT. WAREHOUSE - DAY',
      heading: 'INT. WAREHOUSE - DAY',
      location: 'Abandoned Warehouse',
      intExt: 'INT',
      timeOfDay: 'DAY',
      pageNumber: 4,
      pageLengthDisplay: '1 4/8',
      pageLengthEighths: 12,
      characters: ['KANE'],
      elements: [],
      synopsis: 'Kane discovers the hidden contraband.',
    } as any,
  ];

  const mockProject: FilmProject = {
    id: 'proj-persistence-reports-test',
    title: 'Persistence Test Production',
    startDate: '2026-12-01',
    scenes: mockScenes,
    screenplayVersions: [
      {
        id: 'ver-alpha',
        title: 'Draft Alpha',
        version: 'v1.0',
        scenes: mockScenes,
        extractedScenes: mockScenes,
        createdAt: '2026-11-10T00:00:00Z',
        updatedAt: '2026-11-10T00:00:00Z',
      } as any,
    ],
    activeScreenplayVersionId: 'ver-alpha',
    elementCatalog: [
      {
        id: 'elem-kane',
        projectId: 'proj-persistence-reports-test',
        name: 'KANE',
        category: 'cast',
        createdAt: '2026-11-10T00:00:00Z',
        updatedAt: '2026-11-10T00:00:00Z',
      },
    ],
    sceneBreakdownAssociations: [],
  };

  it('renders scene selector button in toolbar for Breakdown Summary and Shooting Schedule', () => {
    const htmlSummary = renderToStaticMarkup(
      <BreakdownReportsView project={mockProject} initialReport="breakdown_summary" />
    );
    expect(htmlSummary).toContain('data-testid="breakdown-report-scene-selector-btn"');
    expect(htmlSummary).toContain('Scenes:');
    expect(htmlSummary).toContain('All (3)');

    const htmlSchedule = renderToStaticMarkup(
      <BreakdownReportsView project={mockProject} initialReport="shooting_schedule" />
    );
    expect(htmlSchedule).toContain('data-testid="breakdown-report-scene-selector-btn"');
  });

  it('contains print stylesheet preventing scale/zoom distortion and configuring standard pt sizing', () => {
    const html = renderToStaticMarkup(
      <BreakdownReportsView project={mockProject} initialReport="breakdown_summary" />
    );
    expect(html).toContain('zoom: 100% !important');
    expect(html).toContain('transform: none !important');
    expect(html).toContain('box-sizing: border-box !important');
    expect(html).toContain('font-size: 9.5pt !important');
  });

  it('persists and restores operational screenplay data across assembleProject and getProjects', async () => {
    const projectId = 'proj-verify-reload';
    const fakeScriptVersion = {
      id: 'ver-imported-superman',
      title: 'SUPERMAN - Shooting Draft',
      version: 'v2.0',
      rawText: 'INT. FORTRESS OF SOLITUDE - DAY\nSuperman stands tall.',
      scenes: [
        {
          id: 'scn-sup-1',
          sceneNumber: '1',
          slugline: 'INT. FORTRESS OF SOLITUDE - DAY',
          heading: 'INT. FORTRESS OF SOLITUDE - DAY',
          characters: ['SUPERMAN'],
        },
      ],
      createdAt: '2026-11-10T00:00:00Z',
      updatedAt: '2026-11-10T00:00:00Z',
    };

    localStorage.setItem(
      `sceneos_production_${projectId}`,
      JSON.stringify({
        activeScreenplayVersionId: 'ver-imported-superman',
        screenplayVersions: [fakeScriptVersion],
        scenes: fakeScriptVersion.scenes,
      })
    );

    localStorage.setItem(
      'sceneos_local_projects_registry',
      JSON.stringify([
        {
          id: projectId,
          title: 'Superman Production',
          status: 'development',
        },
      ])
    );

    const mockClient: any = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('mock fallback') }),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
    };

    const service = new SupabaseProjectService(mockClient);
    const projects = await service.getProjects();
    expect(projects.length).toBeGreaterThan(0);

    const target = projects.find((p) => p.id === projectId);
    expect(target).toBeDefined();
    expect(target?.activeScreenplayVersionId).toBe('ver-imported-superman');
    expect(target?.screenplayVersions?.length).toBe(1);
    expect(target?.screenplayVersions?.[0].title).toBe('SUPERMAN - Shooting Draft');
    expect(target?.scenes?.length).toBe(1);
    expect(target?.scenes?.[0].slugline).toBe('INT. FORTRESS OF SOLITUDE - DAY');
  });
});
