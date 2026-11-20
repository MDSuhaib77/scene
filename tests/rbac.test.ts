/**
 * SceneOS — Automated Tests: Role-Based Access Control (RBAC) Matrix & Hierarchy
 * Verifies explicit permissions for all 7 production roles and role promotion/demotion governance.
 */

import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, hasPermission, canManageRole, PermissionAction } from '../src/services/rbac/permissions';
import { ProjectRole } from '../src/types/database.types';

describe('RBAC Permission Matrix', () => {
  const ALL_ROLES: ProjectRole[] = [
    'owner',
    'producer',
    'director',
    'first_ad',
    'department_head',
    'crew_member',
    'viewer'
  ];

  it('verifies owner possesses complete administrative permissions', () => {
    const ownerPerms = ROLE_PERMISSIONS['owner'];
    expect(ownerPerms['project:view']).toBe(true);
    expect(ownerPerms['project:edit_settings']).toBe(true);
    expect(ownerPerms['project:archive']).toBe(true);
    expect(ownerPerms['project:delete']).toBe(true);
    expect(ownerPerms['members:invite']).toBe(true);
    expect(ownerPerms['members:change_role']).toBe(true);
    expect(ownerPerms['members:remove']).toBe(true);
    expect(ownerPerms['production:view_data']).toBe(true);
    expect(ownerPerms['production:edit_data']).toBe(true);
    expect(ownerPerms['compliance:override']).toBe(true);
    expect(ownerPerms['audit:view']).toBe(true);
  });

  it('prevents producer from deleting project while granting operational control', () => {
    expect(hasPermission('producer', 'project:delete')).toBe(false);
    expect(hasPermission('producer', 'project:edit_settings')).toBe(true);
    expect(hasPermission('producer', 'project:archive')).toBe(true);
    expect(hasPermission('producer', 'members:invite')).toBe(true);
    expect(hasPermission('producer', 'members:change_role')).toBe(true);
    expect(hasPermission('producer', 'production:edit_data')).toBe(true);
    expect(hasPermission('producer', 'compliance:override')).toBe(true);
  });

  it('verifies director has creative authority without administrative or member alteration rights', () => {
    expect(hasPermission('director', 'production:view_data')).toBe(true);
    expect(hasPermission('director', 'production:edit_data')).toBe(true); // Screenplay, scenes, storyboards
    expect(hasPermission('director', 'members:invite')).toBe(false);
    expect(hasPermission('director', 'members:change_role')).toBe(false);
    expect(hasPermission('director', 'members:remove')).toBe(false);
    expect(hasPermission('director', 'project:delete')).toBe(false);
    expect(hasPermission('director', 'compliance:override')).toBe(false);
  });

  it('allows 1st AD to invite crew and edit stripboards, but prevents member role changes', () => {
    expect(hasPermission('first_ad', 'members:invite')).toBe(true); // 1st AD recruits crew/day players
    expect(hasPermission('first_ad', 'production:edit_data')).toBe(true); // Stripboard & call times
    expect(hasPermission('first_ad', 'members:change_role')).toBe(false);
    expect(hasPermission('first_ad', 'members:remove')).toBe(false);
    expect(hasPermission('first_ad', 'project:delete')).toBe(false);
    expect(hasPermission('first_ad', 'compliance:override')).toBe(false);
  });

  it('scopes department heads to department-specific data and prevents project-wide production edits', () => {
    expect(hasPermission('department_head', 'production:view_data')).toBe(true);
    expect(hasPermission('department_head', 'production:edit_dept_data')).toBe(true);
    expect(hasPermission('department_head', 'production:edit_data')).toBe(false);
    expect(hasPermission('department_head', 'members:invite')).toBe(false);
    expect(hasPermission('department_head', 'project:edit_settings')).toBe(false);
  });

  it('ensures crew members and viewers have strictly read-only capabilities', () => {
    const editActions: PermissionAction[] = [
      'project:edit_settings',
      'project:archive',
      'project:delete',
      'members:invite',
      'members:change_role',
      'members:remove',
      'production:edit_data',
      'production:edit_dept_data',
      'compliance:override',
    ];

    for (const role of ['crew_member', 'viewer'] as ProjectRole[]) {
      expect(hasPermission(role, 'project:view')).toBe(true);
      expect(hasPermission(role, 'production:view_data')).toBe(true);
      for (const action of editActions) {
        expect(hasPermission(role, action)).toBe(false);
      }
    }
  });

  it('handles null, undefined, or unknown roles gracefully', () => {
    expect(hasPermission(null, 'project:view')).toBe(false);
    expect(hasPermission(undefined, 'project:view')).toBe(false);
    expect(hasPermission('' as any, 'project:view')).toBe(false);
  });
});

describe('Role Hierarchy & Management (canManageRole)', () => {
  it('allows owner to manage and assign any role', () => {
    expect(canManageRole('owner', 'producer', 'director')).toBe(true);
    expect(canManageRole('owner', 'crew_member', 'department_head')).toBe(true);
    expect(canManageRole('owner', 'director', 'producer')).toBe(true);
    expect(canManageRole('owner', 'viewer', 'crew_member')).toBe(true);
  });

  it('allows producer to manage roles strictly lower in rank', () => {
    // Producer rank = 60
    // Director = 50, 1st AD = 40, Dept Head = 30, Crew = 20, Viewer = 10
    expect(canManageRole('producer', 'crew_member', 'department_head')).toBe(true);
    expect(canManageRole('producer', 'first_ad', 'director')).toBe(true);
    expect(canManageRole('producer', 'director', 'first_ad')).toBe(true);
  });

  it('prevents producer from promoting anyone to producer or owner', () => {
    expect(canManageRole('producer', 'director', 'producer')).toBe(false);
    expect(canManageRole('producer', 'director', 'owner')).toBe(false);
  });

  it('prevents producer from demoting or altering an owner or peer producer', () => {
    expect(canManageRole('producer', 'owner', 'director')).toBe(false);
    expect(canManageRole('producer', 'producer', 'crew_member')).toBe(false);
  });

  it('prevents lower roles from changing any member roles', () => {
    const lowerRoles: ProjectRole[] = ['director', 'first_ad', 'department_head', 'crew_member', 'viewer'];
    for (const actor of lowerRoles) {
      expect(canManageRole(actor, 'crew_member', 'viewer')).toBe(false);
      expect(canManageRole(actor, 'viewer', 'crew_member')).toBe(false);
    }
  });

  it('returns false when actor role is null or undefined', () => {
    expect(canManageRole(null, 'crew_member', 'viewer')).toBe(false);
    expect(canManageRole(undefined, 'crew_member', 'viewer')).toBe(false);
  });
});
