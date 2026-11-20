/**
 * SceneOS — Automated Tests: Multi-Project Workspace & Member Governance
 * Verifies project isolation, member role assignments, hierarchy validation, and project lifecycle.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockProjectService, MockAuthService, MOCK_USERS } from '../src/services/mock/MockServices';

describe('Multi-Project Workspace & Member Governance', () => {
  let projectService: MockProjectService;
  let authService: MockAuthService;

  beforeEach(() => {
    projectService = new MockProjectService();
    authService = new MockAuthService();
  });

  it('lists existing projects with metadata and member counts', async () => {
    const projects = await projectService.getProjects();
    expect(projects.length).toBeGreaterThanOrEqual(2);

    const neonDreams = projects.find(p => p.id === 'proj-neon-dreams-01');
    expect(neonDreams).toBeDefined();
    expect(neonDreams?.title).toBe('Neon Dreams: Chapter One');
    expect(neonDreams?.ownerId).toBe(MOCK_USERS[0].id);
    expect(neonDreams?.budgetTotal).toBe(4500000);
  });

  it('creates a new project and designates creator as owner member', async () => {
    const created = await projectService.createProject({
      title: 'Varanasi Midnight Chronicle',
      logline: 'An independent investigative journalist discovers covert drone surveillance along the ghats.',
      director: 'Kira Vance',
      producer: 'Elena Rostova',
      status: 'development',
      budgetTotal: 850000,
      dailyBurnCap: 15000,
      targetStartDate: '2026-11-01',
      targetWrapDate: '2026-12-15',
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Varanasi Midnight Chronicle');
    expect(created.userRole).toBe('owner');

    const members = await projectService.getProjectMembers(created.id);
    expect(members.length).toBe(1);
    expect(members[0].role).toBe('owner');
    expect(members[0].userId).toBe(MOCK_USERS[0].id);
  });

  it('updates project settings and financial caps', async () => {
    const updated = await projectService.updateProject('proj-neon-dreams-01', {
      budgetTotal: 5000000,
      dailyBurnCap: 55000,
      status: 'production',
    });

    expect(updated.budgetTotal).toBe(5000000);
    expect(updated.dailyBurnCap).toBe(55000);
    expect(updated.status).toBe('production');
  });

  it('allows owner to modify member roles with valid permissions', async () => {
    const members = await projectService.getProjectMembers('proj-neon-dreams-01');
    const firstAdMember = members.find(m => m.role === 'first_ad');
    expect(firstAdMember).toBeDefined();

    const updated = await projectService.updateMemberRole(
      'proj-neon-dreams-01',
      firstAdMember!.id,
      'department_head',
      'owner' // Actor is owner
    );

    expect(updated.role).toBe('department_head');
  });

  it('blocks unauthorized actors from changing member roles', async () => {
    const members = await projectService.getProjectMembers('proj-neon-dreams-01');
    const memberToChange = members.find(m => m.role === 'first_ad');
    expect(memberToChange).toBeDefined();

    // Director has no member:change_role permission
    await expect(
      projectService.updateMemberRole(
        'proj-neon-dreams-01',
        memberToChange!.id,
        'department_head',
        'director' // Actor is director
      )
    ).rejects.toThrow('Unauthorized');
  });

  it('blocks producers from modifying owner role', async () => {
    const members = await projectService.getProjectMembers('proj-neon-dreams-01');
    const ownerMember = members.find(m => m.role === 'owner');
    expect(ownerMember).toBeDefined();

    // Producer cannot demote owner
    await expect(
      projectService.updateMemberRole(
        'proj-neon-dreams-01',
        ownerMember!.id,
        'viewer',
        'producer' // Actor is producer
      )
    ).rejects.toThrow('Unauthorized');
  });

  it('allows removing a member from the project roster', async () => {
    const members = await projectService.getProjectMembers('proj-neon-dreams-01');
    const initialCount = members.length;
    const memberToRemove = members[1];

    await projectService.removeProjectMember(memberToRemove.id);

    const remaining = await projectService.getProjectMembers('proj-neon-dreams-01');
    expect(remaining.length).toBe(initialCount - 1);
    expect(remaining.some(m => m.id === memberToRemove.id)).toBe(false);
  });

  it('archives and deletes a project cleanly', async () => {
    const archived = await projectService.archiveProject('proj-monsoon-heist-02');
    expect(archived.status).toBe('archived');

    await projectService.deleteProject('proj-monsoon-heist-02');
    const project = await projectService.getProjectById('proj-monsoon-heist-02');
    expect(project).toBeNull();
  });
});
