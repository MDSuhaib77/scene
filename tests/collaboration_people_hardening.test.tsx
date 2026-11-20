/**
 * SceneOS — Collaboration Batch 02: People, Membership & Security Hardening Tests
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  MockAuthService,
  MockInvitationService,
  MockProjectService,
} from '../src/services/mock/MockServices';
import {
  SupabaseInvitationService,
  SupabaseProjectService,
} from '../src/services/supabase/SupabaseAdapters';
import {
  InvitationError,
  ProjectDomainModel,
} from '../src/services/contracts/types';
import {
  canEditMemberDetails,
  canInviteRole,
  canManageRole,
  canRemoveMember,
  getAssignableRolesForMember,
  getInvitableRoles,
  hasPermission,
} from '../src/services/rbac/permissions';
import {
  PENDING_INVITE_STORAGE_KEY,
  parseInviteTokenFromHash,
  resolveInitialInviteToken,
} from '../src/features/team/InviteAcceptanceView';
import { ProductionWorkspace } from '../src/features/production/components/ProductionWorkspace';
import { VaultWorkspace } from '../src/features/vault/components/VaultWorkspace';
import { canEditVisualizeWorkspace } from '../src/features/visualize/services/visualizeFoundationService';
import type { FilmProject } from '../src/types';

function makeMinimalProject(overrides: Partial<ProjectDomainModel> = {}): ProjectDomainModel {
  return {
    id: 'proj-test-1',
    title: 'Test Production',
    logline: 'Test logline',
    director: 'Kira Vance',
    producer: 'Elena Rostova',
    startDate: '2026-06-01',
    finalEndDate: '2026-07-01',
    suggestedEndDate: '2026-07-01',
    isEndDateFixed: false,
    updatedAt: '2026-06-01T00:00:00.000Z',
    persistence: 'remote',
    constraints: {
      budgetLimit: 1000000,
      dailyBurnRateCap: 20000,
      screenplayLocked: false,
      castAvailabilityDays: 20,
      permitLeadTimeDays: 7,
      targetRating: 'PG-13',
      weatherContingencyBuffer: 3,
      postOverheadRatio: 15,
    },
    phases: [],
    ...overrides,
  };
}

describe('Prompt 02 — Role Hierarchy & Invitation Authority Rules', () => {
  it('never permits assigning or inviting the owner role', () => {
    expect(canInviteRole('owner', 'owner')).toBe(false);
    expect(canInviteRole('producer', 'owner')).toBe(false);
    expect(canManageRole('owner', 'producer', 'owner')).toBe(false);
    expect(canManageRole('producer', 'director', 'owner')).toBe(false);
    expect(getInvitableRoles('owner')).not.toContain('owner');
    expect(getAssignableRolesForMember('owner', 'producer')).not.toContain('owner');
  });

  it('protects the owner membership from edits or removal by anyone', () => {
    expect(canManageRole('owner', 'owner', 'producer')).toBe(false);
    expect(canManageRole('producer', 'owner', 'viewer')).toBe(false);
    expect(canRemoveMember('owner', 'owner')).toBe(false);
    expect(canRemoveMember('producer', 'owner')).toBe(false);
    expect(canEditMemberDetails('owner', 'owner')).toBe(false);
    expect(canEditMemberDetails('producer', 'owner')).toBe(false);
    expect(getAssignableRolesForMember('owner', 'owner')).toEqual([]);
  });

  it('bounds producer and first_ad strictly to lower ranks', () => {
    expect(getInvitableRoles('producer')).toEqual([
      'director',
      'first_ad',
      'department_head',
      'crew_member',
      'viewer',
    ]);
    expect(canInviteRole('producer', 'producer')).toBe(false);
    expect(canRemoveMember('producer', 'producer')).toBe(false);
    expect(canRemoveMember('producer', 'director')).toBe(true);

    expect(getInvitableRoles('first_ad')).toEqual([
      'department_head',
      'crew_member',
      'viewer',
    ]);
    expect(canInviteRole('first_ad', 'director')).toBe(false);
    expect(canInviteRole('first_ad', 'first_ad')).toBe(false);
    expect(canRemoveMember('first_ad', 'crew_member')).toBe(false);
  });

  it('blocks lower roles and unresolved roles from all membership controls', () => {
    for (const role of ['director', 'department_head', 'crew_member', 'viewer', null, undefined] as const) {
      expect(getInvitableRoles(role)).toEqual([]);
      expect(canEditMemberDetails(role, 'crew_member')).toBe(false);
      expect(canRemoveMember(role, 'crew_member')).toBe(false);
    }
    expect(hasPermission(null, 'members:view')).toBe(false);
    expect(hasPermission(null, 'production:edit_data')).toBe(false);
  });
});

describe('Prompt 02 — Mock Invitation Security & Explicit Directory Association', () => {
  let authService: MockAuthService;
  let projectService: MockProjectService;
  let invitationService: MockInvitationService;

  beforeEach(() => {
    authService = new MockAuthService();
    projectService = new MockProjectService();
    invitationService = new MockInvitationService(projectService, () => authService.peekSession());
  });

  it('rejects owner invitations and generates high-entropy tokens', async () => {
    await expect(
      invitationService.createInvitation('proj-neon-dreams-01', 'new@studio.com', 'owner')
    ).rejects.toThrow(/owner/i);

    const inv = await invitationService.createInvitation(
      'proj-neon-dreams-01',
      'Cam.Lead@Studio.com',
      'department_head',
      undefined,
      24,
      { department: 'Camera', directoryEntryId: 'dir-cam-01' }
    );

    expect(inv.invitationToken).toMatch(/^mock-[0-9a-f]{48}$/);
    expect(inv.email).toBe('cam.lead@studio.com');
    expect(inv.department).toBe('Camera');
    expect(inv.directoryEntryId).toBe('dir-cam-01');
  });

  it('enforces case-insensitive email match on preview and acceptance', async () => {
    const inv = await invitationService.createInvitation(
      'proj-monsoon-heist-02',
      'ELENA.ROSTOVA@sceneos.studio',
      'producer',
      undefined,
      24,
      { department: 'Production', directoryEntryId: 'dir-elena-1' }
    );

    // Currently logged in as Kira -> must show email_mismatch and reject accept
    const mismatchPreview = await invitationService.previewInvitation(inv.invitationToken!);
    expect(mismatchPreview.status).toBe('email_mismatch');
    expect(mismatchPreview.invitedEmailHint).toMatch(/^e\*+@sceneos\.studio$/);

    await expect(invitationService.acceptInvitation(inv.invitationToken!)).rejects.toThrow(
      /different email/i
    );

    // Log out -> unauthenticated preview keeps project info without leaking email hint
    await authService.logout();
    const anonPreview = await invitationService.previewInvitation(inv.invitationToken!);
    expect(anonPreview.status).toBe('valid');
    expect(anonPreview.projectName).toBe('Monsoon Shadow');
    expect(anonPreview.invitedEmailHint).toBeUndefined();

    await expect(invitationService.acceptInvitation(inv.invitationToken!)).rejects.toThrow(
      /authentication required/i
    );

    // Log in with matching email (mixed case) -> succeeds and preserves explicit links
    await authService.login('Elena.Rostova@SceneOS.Studio');
    const readyPreview = await invitationService.previewInvitation(inv.invitationToken!);
    expect(readyPreview.status).toBe('valid');

    const accepted = await invitationService.acceptInvitation(inv.invitationToken!);
    expect(accepted.success).toBe(true);
    expect(accepted.role).toBe('producer');

    const members = await projectService.getProjectMembers('proj-monsoon-heist-02');
    const elena = members.find(m => m.email === 'elena.rostova@sceneos.studio');
    expect(elena?.department).toBe('Production');
    expect(elena?.directoryEntryId).toBe('dir-elena-1');
  });

  it('links and unlinks a Directory entry explicitly without email auto-matching', async () => {
    const members = await projectService.getProjectMembers('proj-neon-dreams-01');
    const marcus = members.find(m => m.role === 'first_ad')!;
    expect(marcus.directoryEntryId ?? null).toBeNull();

    const linked = await projectService.updateMemberDetails('proj-neon-dreams-01', marcus.id, {
      department: 'Assistant Directors',
      directoryEntryId: 'dir-marcus-ad',
    });
    expect(linked.directoryEntryId).toBe('dir-marcus-ad');

    const unlinked = await projectService.updateMemberDetails('proj-neon-dreams-01', marcus.id, {
      directoryEntryId: null,
    });
    expect(unlinked.directoryEntryId).toBeNull();

    // Protects owner row from removal
    const owner = members.find(m => m.role === 'owner')!;
    await expect(projectService.removeProjectMember(owner.id)).rejects.toThrow(/owner/i);
  });
});

describe('Prompt 02 — Supabase Adapter Hardening & Fail-Closed Behavior', () => {
  it('does not fabricate @sceneos.local members when get_project_members RPC fails', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'RLS permission denied for get_project_members' },
      }),
    } as any;

    const projectSvc = new SupabaseProjectService(mockClient);
    await expect(
      projectSvc.getProjectMembers('a0000000-0000-4000-8000-000000000001')
    ).rejects.toThrow('RLS permission denied');
  });

  it('passes raw tokens (never token_hash) to Supabase invitation RPCs and parses InvitationError', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: 'inv-1',
          project_id: 'a0000000-0000-4000-8000-000000000001',
          email: 'dp@studio.com',
          role: 'department_head',
          department: 'Camera',
          directory_entry_id: 'dir-99',
          status: 'pending',
          expires_at: '2026-12-01T00:00:00Z',
          created_at: '2026-11-11T00:00:00Z',
          invitation_token: 'raw-secret-token-from-pgcrypto',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: '[email_mismatch] This invitation was issued for a different email address.' },
      });

    const invSvc = new SupabaseInvitationService({ rpc } as any);

    const created = await invSvc.createInvitation(
      'a0000000-0000-4000-8000-000000000001',
      'dp@studio.com',
      'department_head',
      undefined,
      48,
      { department: 'Camera', directoryEntryId: 'dir-99' }
    );
    expect(created.invitationToken).toBe('raw-secret-token-from-pgcrypto');
    expect(rpc).toHaveBeenCalledWith('create_project_invitation', {
      p_project_id: 'a0000000-0000-4000-8000-000000000001',
      p_email: 'dp@studio.com',
      p_role: 'department_head',
      p_department: 'Camera',
      p_directory_entry_id: 'dir-99',
      p_expires_hours: 48,
    });

    await expect(invSvc.acceptInvitation('raw-secret-token-from-pgcrypto')).rejects.toBeInstanceOf(
      InvitationError
    );
    expect(rpc).toHaveBeenLastCalledWith('accept_project_invitation', {
      p_token: 'raw-secret-token-from-pgcrypto',
    });
  });

  it('prevents owner invitations client-side in SupabaseInvitationService', async () => {
    const rpc = vi.fn();
    const invSvc = new SupabaseInvitationService({ rpc } as any);
    await expect(
      invSvc.createInvitation('a0000000-0000-4000-8000-000000000001', 'a@b.com', 'owner')
    ).rejects.toThrow(InvitationError);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('Prompt 02 — Invite Hash Parsing & Workspace Fail-Closed Guards', () => {
  it('parses #invite= tokens cleanly', () => {
    expect(parseInviteTokenFromHash('#invite=abc123def')).toBe('abc123def');
    expect(parseInviteTokenFromHash('#invite=tok%20with%2Bchars&next=1')).toBe('tok with+chars');
    expect(parseInviteTokenFromHash('#invite=')).toBeNull();
    expect(parseInviteTokenFromHash('#reset-password')).toBeNull();
  });

  it('fails closed in Production, Vault, and Visualise when activeRole is null', () => {
    const project: FilmProject = makeMinimalProject({ userRole: 'owner' });

    const prodHtml = renderToString(
      <ProductionWorkspace
        project={project}
        simulatedDate="2026-06-10"
        isDark={true}
        theme={{}}
        activeRole={null}
        onSetSimulatedDate={() => {}}
        onAddActivity={() => {}}
        onAddActivityWithDetails={() => {}}
        onRemoveActivity={() => {}}
        onUpdateActivity={() => {}}
        onAddCrew={() => {}}
        onDeleteCrew={() => {}}
        onUpdateCrewStatus={() => {}}
        onNavigateTab={() => {}}
      />
    );
    expect(prodHtml).toContain('Read-only');

    const vaultHtml = renderToString(
      <VaultWorkspace
        project={project}
        activeRole={null}
        onUpdateProject={() => {}}
        onNavigateTab={() => {}}
      />
    );
    expect(vaultHtml).toContain('Read-only');
    expect(canEditVisualizeWorkspace(null)).toBe(false);
  });

  it('preserves pending invite token across OAuth hash redirects and prioritizes explicit hash', () => {
    const fakeStorage = {
      getItem: (k: string) => (k === PENDING_INVITE_STORAGE_KEY ? 'stored-token-123' : null),
    };
    expect(resolveInitialInviteToken('#access_token=oauth_jwt&token_type=bearer', fakeStorage)).toBe(
      'stored-token-123'
    );
    expect(resolveInitialInviteToken('#invite=fresh-token-456', fakeStorage)).toBe(
      'fresh-token-456'
    );
  });
});

describe('Prompt 02.1 — Migration 004 SQL Security Invariants', () => {
  it('enforces SECURITY DEFINER search_path, raw-token hashing, email match, owner protection, and restricted grants', () => {
    const sqlPath = path.resolve(
      __dirname,
      '../supabase/migrations/004_people_membership_hardening.sql'
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toContain('DROP FUNCTION IF EXISTS public.accept_project_invitation(TEXT);');
    expect(sql).toContain('encode(gen_random_bytes(32), \'hex\')');
    expect(sql).toContain('encode(digest(trim(p_token), \'sha256\'), \'hex\')');
    expect(sql).toContain('lower(trim(v_user_email)) <> lower(trim(v_invitation.email))');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.effective_project_role(UUID, UUID) FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_project_members(UUID) FROM PUBLIC;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.preview_project_invitation(TEXT) TO anon, authenticated;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Project members manageable by owners and producers" ON public.project_members;');
    expect(sql).not.toContain('app.invitation_accepting');
    expect(sql).toContain('SET search_path = public');
  });
});

