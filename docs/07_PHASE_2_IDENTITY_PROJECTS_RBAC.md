# SceneOS — Phase 2: Identity, Projects & Role-Based Access Control (RBAC)
**Status:** Completed & Fully Verified  
**Milestone:** Phase 2 Complete  
**Date:** 2026-10-14  

---

## 1. Executive Summary

Phase 2 of SceneOS implements the identity foundation, multi-project workspace isolation, and hierarchical Role-Based Access Control (RBAC) across both client and database boundaries.

Key achievements:
- **7 Granular Production Roles:** `owner`, `producer`, `director`, `first_ad`, `department_head`, `crew_member`, and `viewer` with a defined permission matrix and role promotion/demotion hierarchy.
- **Database Security & Migration `002_invitations_and_rbac.sql`:** Incremental migration adding `project_invitations` table with Row Level Security (RLS) policies and a security-definer function `accept_project_invitation` with strict `search_path` isolation to prevent search-path injection.
- **Secure Tokenized Invitations:** Single-use invitation tokens hashed with SHA-256 (via Web Crypto API), expiration tracking (default 7 days, configurable), and full replay attack prevention.
- **Dual-Mode Adapter Architecture:** Complete parity between offline `MockServices` (with fast developer persona switching) and live `SupabaseAdapters` (GoTrue + PostgREST).
- **Workspace Scoping & State Management:** Centralized `ProjectContext` ensuring automatic query scoping, permission recalculation, and cross-project data leakage prevention.
- **Test Suite Expansion:** 40 automated tests across 6 test suites (RBAC, invitations, projects, services, scheduler, compliance), zero TypeScript lint errors, and successful production compilation.

---

## 2. Granular Role-Based Access Control (RBAC) Matrix

SceneOS enforces a domain-specific authorization matrix tailored to real-world film productions:

| Permission Action | `owner` | `producer` | `director` | `first_ad` | `department_head` | `crew_member` | `viewer` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `project:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `project:edit_settings` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `project:archive` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `project:delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `members:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `members:invite` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `members:change_role` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `members:remove` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `production:view_data` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `production:edit_data` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `production:edit_dept_data` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `audit:view` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `compliance:override` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Role Hierarchy & Promotion Governance (`canManageRole`)
A strict numerical hierarchy governs role assignment:
```
owner (70) > producer (60) > director (50) > first_ad (40) > department_head (30) > crew_member (20) > viewer (10)
```
1. **Owner Exclusivity:** Only an `owner` can assign or transfer the `owner` role, or alter an existing owner's status.
2. **Actor Capability:** Actor must hold `members:change_role`.
3. **Subordinate Boundary:** Actors can only promote, demote, or assign roles strictly lower than their own rank (`targetRank < actorRank` and `currentRank < actorRank`).
4. **Peer Protection:** Producers cannot alter or demote other producers.

---

## 3. Database Schema & Migration: `002_invitations_and_rbac.sql`

The migration was created under `supabase/migrations/002_invitations_and_rbac.sql` and includes:

```sql
-- Table: project_invitations
CREATE TABLE IF NOT EXISTS public.project_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.project_role NOT NULL DEFAULT 'crew_member',
    department_id TEXT,
    token_hash TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_pending_project_invite UNIQUE (project_id, email, status)
);
```

### Security-Definer Atomic RPC: `accept_project_invitation`
To prevent race conditions, token replay attacks, or partial writes when accepting invitations:
```sql
CREATE OR REPLACE FUNCTION public.accept_project_invitation(
    p_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
-- Verifies invitation is 'pending' and expires_at > now()
-- Atomically inserts or updates public.project_members
-- Updates invitation status to 'accepted'
-- Records an entry in public.audit_logs
$$;
```

---

## 4. Invitation Lifecycle & Security Mechanics

1. **Token Generation:** A cryptographically random token string is created client-side or server-side.
2. **Secure Hashing:** The raw token is immediately hashed via SHA-256 (`crypto.subtle.digest`) prior to persistence. Only `token_hash` is stored in PostgreSQL.
3. **Delivery Status Transparency:**
   - In **Mock Mode**: Invitations simulate token generation and provide immediate 1-click shareable URLs (`?invite_token=...`). The UI explicitly states no external email was dispatched.
   - In **Supabase Live Mode**: The invitation link is provided for manual copy or outbound transactional email (via SendGrid/Resend/Postmark webhook).
4. **Single-Use Replay Protection:** Once redeemed, the status transitions to `'accepted'`. Any subsequent call with the same token rejects with `Invalid or already used invitation token.`
5. **Expiration Enforcement:** Expired invitations automatically reject with `'This invitation has expired.'` and update status to `'expired'`.
6. **Revocation:** Owners or producers can revoke pending invitations at any time.

---

## 5. UI & Workspace Management Components

| Component | Path | Responsibility |
|---|---|---|
| `ProjectContext` | `src/features/projects/ProjectContext.tsx` | Centralizes active project state, switches projects, calculates permissions (`can()`, `userRole`), and isolates scoped queries. |
| `ProjectSwitcherModal` | `src/features/projects/ProjectSwitcherModal.tsx` | Searchable modal displaying production slate, metadata, active project indicator, and creation shortcut. |
| `CreateProjectModal` | `src/features/projects/CreateProjectModal.tsx` | Project creation modal with production budget, daily burn rate caps, target start/wrap dates, and input validation. |
| `TeamManagementModal` | `src/features/team/TeamManagementModal.tsx` | Crew roster modal with role badges, promotion/demotion dropdowns governed by `canManageRole`, invitation generator, and pending invite list with copyable links. |
| `AuthModal` | `src/features/auth/AuthModal.tsx` | Authentication modal supporting Email/Password sign-in, registration, password reset simulation, and 1-click mock user switcher (Kira Vance, Elena Rostova, Marcus Thorne). |
| `ProfileModal` | `src/features/profile/ProfileModal.tsx` | User profile editor supporting display name, bio, telephone, avatar selection, and read-only verified email display. |

---

## 6. Verification Results

All tests pass cleanly, strict TypeScript compiler emits zero errors, and the production bundle compiles with zero errors.

### Vitest Suite (40 Tests, 6 Suites)
```
 ✓ tests/rbac.test.ts (13 tests)
 ✓ tests/scheduler.test.ts (3 tests)
 ✓ tests/services.test.ts (5 tests)
 ✓ tests/invitations.test.ts (6 tests)
 ✓ tests/projects.test.ts (8 tests)
 ✓ tests/compliance.test.ts (5 tests)

 Test Files  6 passed (6)
      Tests  40 passed (40)
   Duration  466ms
```

### TypeScript Check (`npm run lint`)
```
> tsc --noEmit
Exit code: 0 (Zero errors)
```

### Production Build (`npm run build`)
```
> vite build
✓ 2143 modules transformed.
dist/index.html                   0.43 kB │ gzip:   0.30 kB
dist/assets/index-BX19VOSg.css  157.35 kB │ gzip:  20.29 kB
dist/assets/index-BWTfezgK.js   824.94 kB │ gzip: 217.32 kB
✓ built in 7.59s
```

---

## 7. Configuration & Supabase Deployment Readiness

### To run in Local Mock Mode (Default)
No setup or configuration is required. Launch directly with:
```bash
npm run dev
```
Mock mode automatically provides authenticated developer sessions, mock projects (`Neon Dreams`, `Monsoon Shadow`), and instant crew switching.

### To connect to Live Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in sequence:
   ```bash
   supabase db push
   # Or run via Supabase SQL Editor:
   # 1. supabase/migrations/001_initial_foundation.sql
   # 2. supabase/migrations/002_invitations_and_rbac.sql
   # 3. supabase/seed.sql (optional)
   ```
3. Populate `.env.local` in project root:
   ```env
   VITE_DATA_PROVIDER=supabase
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
4. Restart development server:
   ```bash
   npm run dev
   ```
