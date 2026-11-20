/**
 * SceneOS — Production Lifecycle & Workspace Architecture Rebuild Tests
 * Verifies single source of truth, clean initial state, production isolation,
 * switching without cross-contamination, operational persistence, and no auto-seeding.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockProjectService, MockAuthService, MOCK_USERS } from '../src/services/mock/MockServices';
import { FilmProject } from '../src/types';

describe('SceneOS Production Lifecycle & Unified Architecture', () => {
  let projectService: MockProjectService;
  let authService: MockAuthService;

  beforeEach(() => {
    projectService = new MockProjectService();
    authService = new MockAuthService();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('1. Initializes new productions with clean, empty operational collections (no dummy data)', async () => {
    const created = await projectService.createProject({
      title: 'Solaris Protocol',
      logline: 'An orbital station researcher encounters sentient solar phenomena.',
      director: 'Andrei Chen',
      producer: 'Mira Nair',
      status: 'pre-production',
      budgetTotal: 12000000,
      dailyBurnCap: 150000,
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Solaris Protocol');
    // Strict empty initial operational collections
    expect(created.screenplayVersions).toEqual([]);
    expect(created.elementCatalog).toEqual([]);
    expect(created.sceneBreakdownAssociations).toEqual([]);
    expect(created.phases).toEqual([]);
    expect(created.footageBackups).toEqual([]);
    expect(created.storyboardRevisions).toEqual([]);
    expect(created.status).toBe('pre-production');
  });

  it('2. Enforces multi-production isolation without data leakage between workspaces', async () => {
    const prodA = await projectService.createProject({
      title: 'Project Alpha (Sci-Fi)',
      director: 'Director A',
      status: 'pre-production',
    });

    const prodB = await projectService.createProject({
      title: 'Project Beta (Noir)',
      director: 'Director B',
      status: 'production',
    });

    // Populate operational data specifically for Project A
    const updatedA = await projectService.updateProject(prodA.id, {
      screenplayVersions: [
        {
          id: 'sc-v1-alpha',
          version: 'Draft 1',
          title: 'Alpha Script',
          author: 'Director A',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'Draft',
          rawText: 'EXT. SPACE - NIGHT\nStars gleam.',
          documentJson: '[]',
        }
      ],
      elementCatalog: [
        {
          id: 'el-starship-01',
          name: 'Nostromo Vessel',
          category: 'Vehicles',
          color: '#22d3ee',
          tags: ['hero', 'spacecraft'],
          scenesCount: 12,
          createdDate: new Date().toISOString(),
        }
      ],
    });

    expect(updatedA.screenplayVersions?.length).toBe(1);
    expect(updatedA.elementCatalog?.length).toBe(1);

    // Fetch Project B and verify zero data contamination
    const fetchedB = await projectService.getProjectById(prodB.id);
    expect(fetchedB).toBeDefined();
    expect(fetchedB?.id).toBe(prodB.id);
    expect(fetchedB?.title).toBe('Project Beta (Noir)');
    expect(fetchedB?.screenplayVersions).toEqual([]);
    expect(fetchedB?.elementCatalog).toEqual([]);
  });

  it('3. Successfully updates project settings and metadata without losing operational records', async () => {
    const prod = await projectService.createProject({
      title: 'Chronos Paradox',
      director: 'Elena Rostova',
      budgetTotal: 3000000,
    });

    // Add element to catalog
    await projectService.updateProject(prod.id, {
      elementCatalog: [
        {
          id: 'el-time-machine',
          name: 'Chronos Capsule',
          category: 'Props',
          color: '#ec4899',
          tags: ['hero'],
          scenesCount: 4,
          createdDate: new Date().toISOString(),
        }
      ],
    });

    // Update metadata
    const updated = await projectService.updateProject(prod.id, {
      title: 'Chronos Paradox: Director Cut',
      status: 'post-production',
      budgetTotal: 3500000,
    });

    expect(updated.title).toBe('Chronos Paradox: Director Cut');
    expect(updated.status).toBe('post-production');
    expect(updated.budgetTotal).toBe(3500000);
    // Operational data preserved
    expect(updated.elementCatalog?.length).toBe(1);
    expect(updated.elementCatalog?.[0].name).toBe('Chronos Capsule');
  });

  it('4. Deletes a production cleanly and purges it from project list', async () => {
    const prod = await projectService.createProject({
      title: 'Scrapped Feature',
      director: 'Temp Director',
    });

    const beforeDelete = await projectService.getProjects();
    expect(beforeDelete.some(p => p.id === prod.id)).toBe(true);

    await projectService.deleteProject(prod.id);

    const afterDelete = await projectService.getProjects();
    expect(afterDelete.some(p => p.id === prod.id)).toBe(false);

    const fetched = await projectService.getProjectById(prod.id);
    expect(fetched).toBeNull();
  });

  it('5. User member assignment designates creator as owner with correct permissions', async () => {
    const prod = await projectService.createProject({
      title: 'Neon Odyssey',
      director: 'Kira Vance',
    });

    const members = await projectService.getProjectMembers(prod.id);
    expect(members.length).toBe(1);
    expect(members[0].role).toBe('owner');
    expect(members[0].userId).toBe(MOCK_USERS[0].id);
  });
});
