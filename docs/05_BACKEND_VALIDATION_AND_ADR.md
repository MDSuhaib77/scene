# ADR 001: Backend Architecture Validation & Service Isolation Strategy

**Status:** Proposed & Validated  
**Deciders:** Principal Software Architect, Full-Stack Lead, Database Architect  
**Date:** 2026-10-14  

---

## 1. Context & Problem Statement

SceneOS requires a scalable, relational, secure, and cost-effective backend to orchestrate complex film productions:
- Relational entities with strict constraints (Scenes, Breakdown Items, Shooting Days, Stripboards, Guild Rules).
- Document and media assets (Screenplay PDFs, call sheets, audio/video clips, storyboards).
- Real-time collaboration (Presence on stripboards, instant conflict warnings).
- Multi-tier authorization (Row-Level Security across distinct production roles).
- Initial constraint: **Zero initial infrastructure cost** (development & portfolio phase), with a seamless upgrade or migration path for commercial productions.

We must validate whether **Supabase Free Tier** is appropriate, compare it against modern alternatives (**Neon + Separate Micro-services** and **Cloudflare D1 + R2**), establish strict service-layer isolation to prevent vendor lock-in, and define quota mitigation strategies.

---

## 2. Comparative Analysis of Candidate Stacks

| Evaluation Criteria | Option 1: Supabase Free Tier (Recommended) | Option 2: Neon PostgreSQL + Disaggregated Stack | Option 3: Cloudflare D1 + R2 + Workers |
| :--- | :--- | :--- | :--- |
| **Database Engine** | Managed PostgreSQL 15+ with full ANSI SQL, window functions, and JSONB. | Serverless PostgreSQL 16 with branching support. | Cloudflare D1 (SQLite-based edge database). |
| **SQL Analytics & Reporting** | **Native & Superior:** Complex joins, triggers, views, and future Power BI direct queries. | **Native & Superior:** Full PostgreSQL query capabilities. | **Poor:** SQLite dialect lacks advanced analytical capabilities, stored procedures, and enterprise BI connectors. |
| **Authentication** | **Built-in (GoTrue):** Native JWT directly mapped to Postgres `auth.uid()` and RLS. | **External Required:** Requires Clerk, Auth0, or custom Lucia (separate billing, setup, and JWT sync). | **External / Custom:** Requires custom JWT auth worker or third-party provider. |
| **File Storage** | **Built-in (S3 API):** Integrated RLS policies on private buckets; signed URLs. | **External Required:** AWS S3 or Cloudflare R2 (separate credentials, bucket policies, and SDK). | **Built-in (R2):** S3-compatible, zero egress fees, but requires custom access control workers. |
| **Realtime Collaboration** | **Built-in (Phoenix Engine):** Postgres CDC replication, presence, and broadcast channels. | **External Required:** Pusher, Ably, or PartyKit (separate subscriptions and quotas). | **Durable Objects / WebSockets:** High custom code requirement for state synchronization. |
| **Zero-Cost Feasibility** | **100% Free** for up to 2 active projects, 500MB DB, 1GB Storage, 50k MAU. | **Fragmented Free Tiers:** Neon free + Clerk free + R2 free + Pusher free (complex multi-account overhead). | **Free:** Generous edge compute, but high engineering effort to build missing primitives. |
| **Implementation Complexity** | **Low:** Unified SDK, single CLI, unified local emulation via Docker. | **High:** 4 different vendor SDKs, 4 sets of environment variables, difficult local testing. | **Very High:** Custom backend orchestration, SQLite limitations, custom auth/presence pipelines. |

---

## 3. Strict Architectural Guardrails for SceneOS

To ensure SceneOS remains robust, portable, and secure, the following 6 architectural rules are enforced:

### Rule 1: Clean Separation of Structured Data vs. Object Storage
- **Relational Tables:** PostgreSQL strictly stores structured metadata: file names, MIME types, byte sizes, MD5 hashes, version tags, and object storage keys.
- **Object Storage:** Screenplay PDFs, `.fountain` files, call sheet documents, storyboards, and avatars are stored exclusively in private S3-compatible object buckets.
- **Zero Binary Blobs:** No `bytea` columns are permitted in the operational database.

### Rule 2: Database Schema Portability
- All table structures, check constraints, foreign keys, and indexes are written in portable standard PostgreSQL.
- To prevent vendor lock-in to Supabase's `auth.uid()`, access-control functions utilize a portable fallback pattern:
  ```sql
  CREATE OR REPLACE FUNCTION public.current_app_user_id()
  RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT coalesce(
      nullif(current_setting('app.current_user_id', true), '')::uuid,
      auth.uid()
    );
  $$;
  ```
  *Result:* The entire schema can be exported via standard `pg_dump` and restored onto vanilla PostgreSQL, AWS RDS, Neon, or GCP Cloud SQL without rewriting RLS policies.

### Rule 3: Service-Layer Abstraction (No Direct Client Vendor Coupling)
The frontend UI and business logic never import `@supabase/supabase-js` directly. All operations are mediated through abstract TypeScript interfaces:
- `IAuthService` (`login`, `register`, `logout`, `getUser`, `onAuthStateChange`)
- `IProjectRepository`, `IScriptRepository`, `IScheduleRepository`
- `IStorageService` (`uploadDocument`, `getSignedDownloadUrl`, `deleteDocument`)
- `IRealtimeService` (`subscribeToTable`, `trackPresence`, `broadcast`)

*Result:* If SceneOS ever migrates from Supabase to a custom backend or AWS, only the service adapter layer (`src/services/supabase/`) is modified. Zero component code changes.

### Rule 4: Zero Secret Exposure Guarantee
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are exposed to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are **strictly forbidden** from the Vite client build.
- All AI processing (screenplay parsing, breakdown analysis) and administrative tasks run server-side via Supabase Edge Functions.

### Rule 5: Project-Scoped RLS & Private Storage Policies
- All tables have RLS enabled with explicit `is_project_member(project_id, current_app_user_id())` guards.
- Storage buckets (`scripts`, `production-docs`) are private. Direct public access is rejected; access is granted only via time-limited signed URLs (15-60 minute TTL) issued to authenticated project members.

### Rule 6: Repository-Managed Migrations, Seed & Disaster Recovery
- Every schema change is versioned under `supabase/migrations/` (`001_initial_schema.sql`, etc.).
- Deterministic seed data (`supabase/seed.sql`) provides mock productions and verified guild rules.
- Disaster recovery procedures (`pg_dump` and `pg_restore`) are committed to version control.

---

## 4. Supabase Free Tier: Limits, Risks & Operational Mitigations

### 4.1 Resource Limits vs. SceneOS Requirements
| Resource | Supabase Free Quota | SceneOS MVP Consumption | Headroom Assessment |
| :--- | :--- | :--- | :--- |
| **PostgreSQL DB Size** | 500 MB | ~10–25 MB (for 20 full productions with 2,000 scenes and logs) | **Safe** (20x headroom) |
| **File Storage** | 1.0 GB | ~150–300 MB (300 screenplay PDFs @ ~500KB each) | **Adequate for Dev/MVP** |
| **Auth MAU** | 50,000 monthly active users | <100 active production members | **Massive headroom** |
| **Realtime Messages** | 2,000,000 / month | ~50,000 / month (stripboard edits) | **Safe** |
| **Edge Functions** | 500,000 invocations / month | ~5,000 AI breakdown requests | **Safe** |

### 4.2 Inactivity Pause Risk & Mitigation
* **The Risk:** Supabase free-tier projects enter a paused state if no database queries are made for 7 consecutive days. Restoring takes 1–2 minutes.
* **Mitigation Strategy:**
  1. **Automated Ping:** A lightweight scheduled GitHub Action or cron job executes a simple query (`SELECT 1;`) via the REST endpoint every 5 days during active development.
  2. **Graceful UI Reconnect:** The client service layer detects HTTP 503 / paused state and presents a clear, user-friendly reconnection modal rather than crashing.
  3. **Commercial Upgrade Trigger:** For an active film shoot (principal photography), the production transitions to the **Supabase Pro tier ($25/mo)** to guarantee 100% uptime, eliminate pauses, provide daily backups, and expand storage to 100 GB.

---

## 5. Migration Effort Assessment (If SceneOS Outgrows Supabase)

Because the schema adheres to standard PostgreSQL and the frontend is shielded by service interfaces:
* **Database Migration (to AWS RDS / Neon / GCP):** ~1 day (standard `pg_dump` / `pg_restore` of tables and RLS).
* **Storage Migration (to Cloudflare R2 / AWS S3):** ~0.5 day (re-pointing `IStorageService` adapter).
* **Auth Migration (to Clerk / Auth0):** ~1.5 days (updating JWT claims verification in PostgreSQL).
* **Total Estimated Migration Effort:** **3–4 engineer days**.

---

## 6. Pre-Implementation Blockers & Resolutions

| Item | Status | Action Required Before Implementation |
| :--- | :---: | :--- |
| **Backend Architecture Validation** | **COMPLETED** | Formal recommendation documented and approved. |
| **Supabase Project Credentials** | Pending User Input | User provides `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when ready for live testing. (Safe local mock fallback enabled in the interim). |
| **Database Migrations Script** | Ready to Scaffold | `001_initial_schema.sql` authored and prepared for Phase 1. |
| **Service Layer Interface Contracts** | Ready to Scaffold | TypeScript interfaces prepared to insulate frontend from Supabase SDK. |
