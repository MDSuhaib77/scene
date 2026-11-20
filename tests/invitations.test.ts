/**
 * SceneOS — Automated Tests: Crew Invitation Lifecycle
 * Verifies invitation generation, token expiry, acceptance idempotency, and revocation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockProjectService, MockInvitationService } from '../src/services/mock/MockServices';

describe('Crew Invitation Lifecycle', () => {
  let projectService: MockProjectService;
  let invitationService: MockInvitationService;
  const testProjectId = 'proj-neon-dreams-01';

  beforeEach(() => {
    projectService = new MockProjectService();
    invitationService = new MockInvitationService(projectService);
  });

  it('creates a pending invitation with valid 7-day expiration and token', async () => {
    const invite = await invitationService.createInvitation(
      testProjectId,
      'gordon.willis@cinematography.org',
      'department_head',
      'dept-camera'
    );

    expect(invite.id).toBeDefined();
    expect(invite.projectId).toBe(testProjectId);
    expect(invite.email).toBe('gordon.willis@cinematography.org');
    expect(invite.role).toBe('department_head');
    expect(invite.departmentId).toBe('dept-camera');
    expect(invite.status).toBe('pending');
    expect(invite.invitationToken).toBeDefined();
    expect(invite.isMock).toBe(true);

    const expiresAt = new Date(invite.expiresAt).getTime();
    const now = Date.now();
    const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThanOrEqual(7.1);
  });

  it('rejects duplicate pending invitations for the same email within the same project', async () => {
    await invitationService.createInvitation(
      testProjectId,
      'sound.mixer@locationaudio.com',
      'department_head'
    );

    await expect(
      invitationService.createInvitation(
        testProjectId,
        'sound.mixer@locationaudio.com',
        'department_head'
      )
    ).rejects.toThrow('A pending invitation already exists');
  });

  it('allows accepting a valid invitation and registers new member to project', async () => {
    const invite = await invitationService.createInvitation(
      testProjectId,
      'talent.lead@hollywoodagency.com',
      'crew_member'
    );

    const initialMembers = await projectService.getProjectMembers(testProjectId);
    const result = await invitationService.acceptInvitation(invite.invitationToken!);

    expect(result.success).toBe(true);
    expect(result.projectId).toBe(testProjectId);
    expect(result.role).toBe('crew_member');

    // Verify member was added to project
    const updatedMembers = await projectService.getProjectMembers(testProjectId);
    expect(updatedMembers.length).toBe(initialMembers.length + 1);
    const addedMember = updatedMembers.find(m => m.email === 'talent.lead@hollywoodagency.com');
    expect(addedMember).toBeDefined();
    expect(addedMember?.role).toBe('crew_member');
  });

  it('prevents replay attacks on already accepted invitation tokens', async () => {
    const invite = await invitationService.createInvitation(
      testProjectId,
      'gaffer.spark@setlighting.co',
      'crew_member'
    );

    await invitationService.acceptInvitation(invite.invitationToken!);

    // Attempting to accept again must fail
    await expect(
      invitationService.acceptInvitation(invite.invitationToken!)
    ).rejects.toThrow('Invalid or already used invitation token.');
  });

  it('revokes an invitation and prevents acceptance', async () => {
    const invite = await invitationService.createInvitation(
      testProjectId,
      'candidate.fired@production.com',
      'crew_member'
    );

    await invitationService.revokeInvitation(invite.id);

    // Verify status is revoked in list
    const projectInvites = await invitationService.getProjectInvitations(testProjectId);
    const revokedInvite = projectInvites.find(i => i.id === invite.id);
    expect(revokedInvite?.status).toBe('revoked');

    // Attempting to accept revoked invite must fail
    await expect(
      invitationService.acceptInvitation(invite.invitationToken!)
    ).rejects.toThrow('Invalid or already used invitation token.');
  });

  it('rejects expired invitations', async () => {
    const invite = await invitationService.createInvitation(
      testProjectId,
      'late.acceptance@studio.org',
      'crew_member',
      undefined,
      -1 // Created with negative expiry to simulate expiration
    );

    await expect(
      invitationService.acceptInvitation(invite.invitationToken!)
    ).rejects.toThrow('This invitation has expired.');
  });
});
