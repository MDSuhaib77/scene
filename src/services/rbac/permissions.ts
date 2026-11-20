/**
 * SceneOS — Centralized Role-Based Access Control (RBAC) Permission Matrix
 * 
 * Defines explicit permissions for all 7 production roles:
 * - owner (Production Company / Studio Principal)
 * - producer (Line Producer / Executive Producer / UPM)
 * - director (Creative Lead)
 * - first_ad (1st Assistant Director / Stripboard Logistics)
 * - department_head (Key Heads: Camera, Sound, Art, Grip, Gaffer)
 * - crew_member (General Crew / Talent)
 * - viewer (Investor / External Auditor / Read-only)
 */

import { ProjectRole } from '../../types/database.types';

export type PermissionAction =
  | 'project:view'
  | 'project:edit_settings'
  | 'project:archive'
  | 'project:delete'
  | 'members:view'
  | 'members:invite'
  | 'members:change_role'
  | 'members:remove'
  | 'production:view_data'
  | 'production:edit_data'
  | 'production:edit_dept_data'
  | 'discussions:view'
  | 'discussions:post'
  | 'discussions:moderate'
  | 'audit:view'
  | 'compliance:override';

export const ROLE_PERMISSIONS: Record<ProjectRole, Record<PermissionAction, boolean>> = {
  owner: {
    'project:view': true,
    'project:edit_settings': true,
    'project:archive': true,
    'project:delete': true,
    'members:view': true,
    'members:invite': true,
    'members:change_role': true,
    'members:remove': true,
    'production:view_data': true,
    'production:edit_data': true,
    'production:edit_dept_data': true,
    'discussions:view': true,
    'discussions:post': true,
    'discussions:moderate': true,
    'audit:view': true,
    'compliance:override': true,
  },
  producer: {
    'project:view': true,
    'project:edit_settings': true,
    'project:archive': true,
    'project:delete': false, // Owner only
    'members:view': true,
    'members:invite': true,
    'members:change_role': true,
    'members:remove': true,
    'production:view_data': true,
    'production:edit_data': true,
    'production:edit_dept_data': true,
    'discussions:view': true,
    'discussions:post': true,
    'discussions:moderate': true,
    'audit:view': true,
    'compliance:override': true,
  },
  director: {
    'project:view': true,
    'project:edit_settings': false,
    'project:archive': false,
    'project:delete': false,
    'members:view': true,
    'members:invite': false,
    'members:change_role': false,
    'members:remove': false,
    'production:view_data': true,
    'production:edit_data': true, // Script revisions, scenes, storyboards
    'production:edit_dept_data': true,
    'discussions:view': true,
    'discussions:post': true,
    'discussions:moderate': false,
    'audit:view': false,
    'compliance:override': false,
  },
  first_ad: {
    'project:view': true,
    'project:edit_settings': false,
    'project:archive': false,
    'project:delete': false,
    'members:view': true,
    'members:invite': true, // 1st AD needs to recruit day-players/crew
    'members:change_role': false,
    'members:remove': false,
    'production:view_data': true,
    'production:edit_data': true, // Stripboard, call times, day orders
    'production:edit_dept_data': true,
    'discussions:view': true,
    'discussions:post': true,
    'discussions:moderate': false,
    'audit:view': false,
    'compliance:override': false,
  },
  department_head: {
    'project:view': true,
    'project:edit_settings': false,
    'project:archive': false,
    'project:delete': false,
    'members:view': true,
    'members:invite': false,
    'members:change_role': false,
    'members:remove': false,
    'production:view_data': true,
    'production:edit_data': false,
    'production:edit_dept_data': true, // Scoped to their own department assets/logs
    'discussions:view': true,
    'discussions:post': true,
    'discussions:moderate': false,
    'audit:view': false,
    'compliance:override': false,
  },
  crew_member: {
    'project:view': true,
    'project:edit_settings': false,
    'project:archive': false,
    'project:delete': false,
    'members:view': true,
    'members:invite': false,
    'members:change_role': false,
    'members:remove': false,
    'production:view_data': true, // Read-only access to schedule and call times
    'production:edit_data': false,
    'production:edit_dept_data': false,
    'discussions:view': true,
    'discussions:post': true,
    'discussions:moderate': false,
    'audit:view': false,
    'compliance:override': false,
  },
  viewer: {
    'project:view': true,
    'project:edit_settings': false,
    'project:archive': false,
    'project:delete': false,
    'members:view': true,
    'members:invite': false,
    'members:change_role': false,
    'members:remove': false,
    'production:view_data': true,
    'production:edit_data': false,
    'production:edit_dept_data': false,
    'discussions:view': true,
    'discussions:post': false,
    'discussions:moderate': false,
    'audit:view': false,
    'compliance:override': false,
  },
};

/**
 * Checks if a specific role possesses permission to execute an action.
 */
export function hasPermission(role: ProjectRole | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[action] ?? false;
}

/**
 * Role Hierarchy for Member Management
 * Higher number = higher authority.
 */
export const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  owner: 70,
  producer: 60,
  director: 50,
  first_ad: 40,
  department_head: 30,
  crew_member: 20,
  viewer: 10,
};

/**
 * Evaluates whether an actor can change or assign a role to a target member.
 * Mirrors the SQL helpers can_assign_role() / can_modify_member() in
 * supabase/migrations/004_people_membership_hardening.sql. The server is
 * authoritative; this function only drives interface visibility.
 *
 * Rules:
 * 1. Actor must have 'members:change_role' permission (owner, producer).
 * 2. 'owner' can never be assigned through membership edits or invitations, and an
 *    owner membership can never be altered by anyone.
 * 3. The owner may assign any other role.
 * 4. Everyone else may only manage members strictly below their own rank and may
 *    only assign roles strictly below their own rank.
 */
export function canManageRole(
  actorRole: ProjectRole | undefined | null,
  currentMemberRole: ProjectRole,
  newRole: ProjectRole
): boolean {
  if (!actorRole) return false;
  if (!hasPermission(actorRole, 'members:change_role')) return false;

  // Owner membership is protected and 'owner' is never assignable.
  if (currentMemberRole === 'owner' || newRole === 'owner') return false;

  // Owner can manage anyone else
  if (actorRole === 'owner') return true;

  const actorRank = ROLE_HIERARCHY[actorRole] ?? 0;
  const currentRank = ROLE_HIERARCHY[currentMemberRole] ?? 0;
  const targetRank = ROLE_HIERARCHY[newRole] ?? 0;

  // Actor cannot modify someone with equal or higher rank
  if (currentRank >= actorRank) return false;

  // Actor cannot promote someone to equal or higher rank than actor
  if (targetRank >= actorRank) return false;

  return true;
}

/**
 * Whether an actor may issue an invitation for a role (SQL: can_assign_role()).
 * Requires 'members:invite'; 'owner' is never invitable; non-owners may only invite
 * roles strictly below their own rank.
 */
export function canInviteRole(
  actorRole: ProjectRole | undefined | null,
  targetRole: ProjectRole
): boolean {
  if (!actorRole) return false;
  if (!hasPermission(actorRole, 'members:invite')) return false;
  if (targetRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  return (ROLE_HIERARCHY[targetRole] ?? 0) < (ROLE_HIERARCHY[actorRole] ?? 0);
}

/** Roles an actor can currently invite, ordered from highest to lowest rank. */
export function getInvitableRoles(actorRole: ProjectRole | undefined | null): ProjectRole[] {
  return ASSIGNABLE_ROLES.filter(r => canInviteRole(actorRole, r));
}

/** Roles an actor can currently assign to an existing member whose role is `currentRole`. */
export function getAssignableRolesForMember(
  actorRole: ProjectRole | undefined | null,
  currentRole: ProjectRole
): ProjectRole[] {
  return ASSIGNABLE_ROLES.filter(r => canManageRole(actorRole, currentRole, r));
}

/**
 * Whether an actor may remove a member (SQL: can_modify_member()).
 * Requires 'members:remove'; owner memberships can never be removed; non-owners may only
 * remove members strictly below their own rank.
 */
export function canRemoveMember(
  actorRole: ProjectRole | undefined | null,
  memberRole: ProjectRole
): boolean {
  if (!actorRole) return false;
  if (!hasPermission(actorRole, 'members:remove')) return false;
  if (memberRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  return (ROLE_HIERARCHY[memberRole] ?? 0) < (ROLE_HIERARCHY[actorRole] ?? 0);
}

/**
 * Whether an actor may link/unlink a Production Directory entry or set the department of
 * a member. Same authority as role changes (owner / producer, lower-ranked, non-owner).
 */
export function canEditMemberDetails(
  actorRole: ProjectRole | undefined | null,
  memberRole: ProjectRole
): boolean {
  if (!actorRole) return false;
  if (!hasPermission(actorRole, 'members:change_role')) return false;
  if (memberRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  return (ROLE_HIERARCHY[memberRole] ?? 0) < (ROLE_HIERARCHY[actorRole] ?? 0);
}

/** Roles that can be granted to people (everything except owner), highest rank first. */
export const ASSIGNABLE_ROLES: ProjectRole[] = [
  'producer',
  'director',
  'first_ad',
  'department_head',
  'crew_member',
  'viewer',
];

/** Canonical department list used by the People interface (stored as free text, max 60 chars). */
export const PROJECT_DEPARTMENTS: readonly string[] = [
  'Direction',
  'Production',
  'Assistant Directors',
  'Camera',
  'Lighting & Grip',
  'Sound',
  'Art',
  'Costume',
  'Hair & Makeup',
  'Locations',
  'Cast',
  'Post-Production',
  'Other',
] as const;

/** Plain-language summary of what each preset means in practice (People UI). */
export const ROLE_PLAIN_SUMMARY: Record<ProjectRole, string> = {
  owner: 'Runs the production. Full control, including people and deletion. Cannot be removed or reassigned.',
  producer: 'Manages the production, schedule and people. Can invite and manage roles below Producer.',
  director: 'Edits creative and production material. Can see everyone, but cannot manage people.',
  first_ad: 'Runs the shooting schedule and call sheets. Can invite crew below 1st AD.',
  department_head: 'Edits their own department’s material. Read access elsewhere.',
  crew_member: 'Sees schedules, call times and scripts. Cannot edit production material.',
  viewer: 'Read-only access for executives, partners and auditors.',
};
export const ROLE_LABELS: Record<ProjectRole, { label: string; badgeColor: string; description: string }> = {
  owner: {
    label: 'Owner / Studio Principal',
    badgeColor: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
    description: 'Full administrative control over production, funding, and deletion.',
  },
  producer: {
    label: 'Producer / UPM',
    badgeColor: 'bg-indigo-950/70 border-indigo-500/40 text-indigo-300',
    description: 'Manages budgets, schedules, contracts, crew invites, and compliance audits.',
  },
  director: {
    label: 'Director',
    badgeColor: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300',
    description: 'Creative authority over screenplay, scenes, shots, and storyboards.',
  },
  first_ad: {
    label: '1st Assistant Director',
    badgeColor: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
    description: 'Controls shooting days, stripboard logistics, call times, and crew summons.',
  },
  department_head: {
    label: 'Department Head',
    badgeColor: 'bg-purple-950/70 border-purple-500/40 text-purple-300',
    description: 'Oversees equipment, personnel, and daily logs for their specific department.',
  },
  crew_member: {
    label: 'Crew / Talent',
    badgeColor: 'bg-slate-900 border-slate-700 text-slate-300',
    description: 'Access to shooting schedules, call times, and script sides.',
  },
  viewer: {
    label: 'Viewer / Read-Only',
    badgeColor: 'bg-zinc-900/60 border-zinc-800 text-zinc-400',
    description: 'Read-only access for executive review, partners, and auditors.',
  },
};
