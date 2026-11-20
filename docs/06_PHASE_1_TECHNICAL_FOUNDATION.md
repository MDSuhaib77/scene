# SceneOS — Phase 1: Technical Foundation & Modular Scaffold
**Status:** Completed & Verified  
**Milestone:** Phase 1 Foundation Complete  
**Date:** 2026-10-14  

---

## 1. Actual Directory Structure

```
pl-an-project-main/
├── .env.example                     # Safe environment template (zero secrets)
├── package.json                     # Scripts: dev, build, preview, clean, lint, test
├── tsconfig.json                    # Strict ES2022 / React-JSX compiler options
├── vite.config.ts                   # Vite bundler configuration
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_foundation.sql  # Core tables, RLS policies, indexes, audit trigger
│   └── seed.sql                     # Deterministic local dev & test seed records
│
├── docs/
│   ├── 01_ARCHITECTURE_SPECIFICATION.md
│   ├── 02_DATABASE_SCHEMA_AND_RLS.md
│   ├── 03_IMPLEMENTATION_ROADMAP_AND_RISKS.md
│   ├── 04_DESIGN_SYSTEM.md
│   ├── 05_BACKEND_VALIDATION_AND_ADR.md
│   └── 06_PHASE_1_TECHNICAL_FOUNDATION.md (This Document)
│
├── src/
│   ├── config/
│   │   └── env.ts                   # Startup validator & secret leak detection
│   ├── types/
│   │   ├── database.types.ts        # Supabase/PostgreSQL schema definitions
│   │   └── index.ts                 # Preserved domain types (FilmProject, INDIAN_GUILDS)
│   ├── services/
│   │   ├── contracts/
│   │   │   └── types.ts             # IAuthService, IProjectService, IActivityService, etc.
│   │   ├── mock/
│   │   │   └── MockServices.ts      # Offline mock providers with rich film data
│   │   ├── supabase/
│   │   │   ├── supabaseClient.ts    # Safe typed client instance
│   │   │   └── SupabaseAdapters.ts  # PostgREST and GoTrue adapter implementations
│   │   └── index.ts                 # Central service factory (deterministic selection)
│   ├── features/
│   │   └── compliance/
│   │       └── complianceEngine.ts  # Pure 11-point safety evaluator (FWICE, FEFSI, etc.)
│   ├── components/
│   │   ├── ui/
│   │   │   └── ConnectionStatusBadge.tsx # Real-time backend telemetry indicator
│   │   ├── CalendarModule.tsx       # Preserved PLÁN interactive calendar
│   │   ├── ConstraintIntegrityPanel.tsx # Preserved compliance UI
│   │   ├── CrewRolodex.tsx          # Preserved crew roster
│   │   ├── FilmAssetsModule.tsx     # Preserved assets module
│   │   ├── FilmKanbanBoard.tsx      # Preserved kanban board
│   │   ├── PhaseTaskConfigurationBoard.tsx # Preserved task configuration
│   │   ├── ProjectProgressionGraph.tsx # Preserved custom SVG Gantt engine
│   │   ├── SpeedometerGauge.tsx     # Preserved radial gauge telemetry
│   │   └── UserProfilePage.tsx      # Preserved profile controls
│   ├── utils/
│   │   └── scheduler.ts             # Preserved cascading date mathematics
│   ├── App.tsx                      # Master application controller with status banner
│   ├── main.tsx                     # React application entry point
│   ├── index.css                    # Tailwind v4 theme variables & dot-matrix glow
│   └── vite-env.d.ts                # TypeScript Vite environment declarations
│
└── tests/
    ├── compliance.test.ts           # 5 automated tests for 11-point safety engine
    ├── scheduler.test.ts            # 3 automated tests for cascading date calculations
    └── services.test.ts             # 5 automated tests for mock services & security validation
```

---

## 2. Environment Setup & Provider Modes

SceneOS supports two runtime modes:

### 2.1 Mode A: Local Mock Mode (Default Offline)
* **Configuration:** `VITE_DATA_PROVIDER=mock` in `.env` (or completely absent).
* **Behavior:** Zero network calls or external credentials required. App launches instantly with sample projects (*Neon Dreams: Chapter One*, *Monsoon Shadow*), pre-authenticated mock users (*Kira Vance*, *Elena Rostova*), and full interactive UI functionality.
* **Telemetry Badge:** Displays a distinct amber indicator: `🟡 Mock Mode (Offline)`.

### 2.2 Mode B: Live Supabase Backend
* **Configuration:**
  ```bash
  VITE_DATA_PROVIDER=supabase
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
  ```
* **Behavior:** Connects to live PostgreSQL database via PostgREST and GoTrue. Enforces PostgreSQL Row Level Security based on `auth.uid()`.
* **Telemetry Badge:** Displays a green indicator: `🟢 Live (Supabase) (24ms)`.
* **Failure Handling:** If credentials are invalid or the host is unreachable, the badge turns red: `🔴 Connection Error` and displays the exact reason. **The application never silently falls back to mock data.**

---

## 3. Database Migration & Seed Workflow

### 3.1 Migration File: `supabase/migrations/001_initial_foundation.sql`
Implements the foundational schema:
- `profiles`: User identity linked to `auth.users(id)` via ON DELETE CASCADE.
- `projects`: Film productions with budget caps, burn rates, status enums, and ownership.
- `project_members`: Project-level RBAC (`owner`, `producer`, `director`, `first_ad`, `department_head`, `crew_member`, `viewer`).
- `audit_logs`: Append-only audit trail logging table mutations and actor identity.
- `project_activity`: Production milestone updates feed.
- **Portability Shim:** `public.current_app_user_id()` supports standard session variables (`app.current_user_id`) for non-Supabase vanilla PostgreSQL migration.
- **RLS Policies:** Explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies on all tables.

### 3.2 Applying Migrations Locally
```bash
# Using Supabase CLI (if installed locally):
supabase db reset

# Or applying directly to any PostgreSQL instance:
psql -h localhost -U postgres -d sceneos -f supabase/migrations/001_initial_foundation.sql
psql -h localhost -U postgres -d sceneos -f supabase/seed.sql
```

---

## 4. Verification & Automated Test Commands

```bash
# Run strict TypeScript typecheck (Zero errors required):
npm run lint

# Run automated unit & integration test suite (Vitest):
npm run test

# Run production asset bundling:
npm run build
```

### Verification Results Summary (Prompt 02 Verification Run):
* **TypeScript Compilation (`npm run lint`):** `PASSED (Exit Code: 0)`
* **Test Suite (`npm run test`):** `13 / 13 PASSED (100% Pass Rate across 3 test suites)`
  - `tests/compliance.test.ts` (5 passed)
  - `tests/scheduler.test.ts` (3 passed)
  - `tests/services.test.ts` (5 passed)
* **Production Build (`npm run build`):** `PASSED (Exit Code: 0, Built in 7.38s)`

---

## 5. Security Boundaries Enforced

1. **Zero Client Secret Exposure:**
   - Startup security scan in `src/config/env.ts` detects and fails if `VITE_SUPABASE_SERVICE_ROLE_KEY` or `VITE_GEMINI_API_KEY` are detected.
2. **PostgreSQL RLS Deny-by-Default:**
   - Any query attempting to read projects without matching `is_project_member(project_id, current_app_user_id())` returns zero rows.
3. **Audit Immutability:**
   - Table mutations trigger the `log_project_audit_trail()` database trigger, recording the timestamp and actor.

---

## 6. Preserved Assets from PLÁN

* **Compliance Rules:** All 6 regional guild rule packages (`FWICE`, `FEFSI`, `TFIEF`, `FEFKA`, `KFWF`, `none`) are preserved in `src/types/index.ts` and encapsulated in `src/features/compliance/complianceEngine.ts`.
* **Visual Telemetry:** `SpeedometerGauge.tsx` radial SVG calculation and `ProjectProgressionGraph.tsx` Gantt line rendering math are 100% intact.
* **Cascading Scheduler:** `src/utils/scheduler.ts` date cascade logic verified via automated test suite.

---

## 7. Next Implementation Phase: Prompt 03

With the technical foundation, typed service adapters, database migration, and test suite locked in, the next phase is **Phase 2: Identity, Projects & RBAC**:
* Implement registration, login, and profile switching UI using `services.auth`.
* Implement multi-project creation, editing, and switching using `services.projects`.
* Implement project team invitations and role management (`owner`, `producer`, `director`, `1st AD`, `HOD`).
* Test live RLS isolation between two distinct user sessions.
