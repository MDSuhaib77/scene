# SceneOS — Phase 3A.5: Product Architecture Restructure & Purpose-Driven Workspaces

## Executive Summary

Phase 3A.5 completes the structural reorganization of SceneOS from loosely overlapping dashboards into **11 distinct, purpose-driven film-production workspaces**. Every workspace has an authoritative domain boundary, single-source data ownership, and contextual cross-workspace navigation.

---

## 1. The 11 Purpose-Driven Workspaces

| Index | Canonical ID | Legacy Alias | Label | Purpose & Domain Responsibility |
|:---:|:---:|:---:|:---:|:---|
| 1 | `overview` | `console` | **Overview** | **Executive Command Centre**: 3-second production orientation, production countdown clock, speedometers, active blockers, guild health, and operational entry points. |
| 2 | `screenplay` | `screenplay` | **Screenplay** | **Screenplay Studio**: Multi-format script ingestion (.FDX, .FOUNTAIN, .PDF, .DOCX, .RTF, .TXT), locked version tree, scene reviews, sluglines, dialogue, and eighths tally. |
| 3 | `breakdown` | `breakdown` | **Breakdown** | **Breakdown & Resources**: Scene-centric resource matrix linking scenes to cast, locations, props, wardrobe, vehicles, stunts, and VFX with review completion toggling. |
| 4 | `plan` | `phases` | **Plan** | **Production Plan & Roadmap**: High-level timeline, phase duration chains, milestones, and critical path progression without duplicating task Kanbans. |
| 5 | `schedule` | `calendar` | **Schedule** | **Shooting Schedule**: Stripboard shooting day sequence, call sheets, day/night shoots, location schedules, and automated 12h turnaround conflict alerts. |
| 6 | `tasks` | `master-calendar` | **Tasks** | **Tasks & Execution**: Operational Kanban lifecycle, department ownership, priorities, subtask milestones, blockers, and deliverable tracking. |
| 7 | `people` | `crew` | **People** | **People & Departments**: Master crew rolodex organized by department (Direction, Production, Camera, Lighting, Sound, Art, etc.), contact details, and contract status. |
| 8 | `compliance` | `constraints` | **Compliance** | **Guild Compliance**: 11-point safety evaluator supporting Indian film federations (FWICE, FEFSI, TFIEF, FEFKA, KFWF) and independent productions with remediation paths. |
| 9 | `intelligence` | `telemetry` | **Intelligence** | **Production Intelligence**: Analytics cockpit calculating actual vs planned velocity, 10% Completion Bond contingency reserve, phase duration distributions, and scenario simulation. |
| 10 | `collaboration` | `collaboration` | **Collaboration** | **Collaboration & Activity**: Project activity stream (`IActivityService`), formal decision log (script locks, bond reserves, guild selection), and notice broadcasting. |
| 11 | `vault` | `assets` | **Vault** | **Production Vault**: Immutable cold storage, camera card logs, genuine cryptographic Web Crypto SHA-256 byte digests, backup manifests, and blueprint JSON recovery. |

---

## 2. Information Architecture & De-Cluttering

### 2.1 Decoupling Production Plan from Task Kanban
Previously, `App.tsx` embedded `PhaseTaskConfigurationBoard` directly below `ProjectProgressionGraph` inside the Roadmap tab. This caused massive redundancy between Roadmap and Kanban.
- **Resolution**: Removed `PhaseTaskConfigurationBoard` from the Plan workspace. High-level milestone progression and duration chains now live purely in **Plan** (`ProjectProgressionGraph`), while operational day-to-day execution lives exclusively in **Tasks** (`FilmKanbanBoard`).

### 2.2 Dedicated Breakdown & Resources Matrix
Previously, scene elements were buried inside screenplay parsing models without a dedicated breakdown view.
- **Resolution**: Implemented [`src/features/breakdown/BreakdownWorkspace.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/features/breakdown/BreakdownWorkspace.tsx). Crew and department heads can inspect elements by scene or category (Props, Wardrobe, Vehicles, Stunts, VFX), filter requirements, toggle review status, and navigate directly into Screenplay or Schedule.

### 2.3 Shooting Schedule with Turnaround Conflict Detection
- **Resolution**: Extended [`src/components/CalendarModule.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/components/CalendarModule.tsx) with a dual sub-tab layout:
  1. **Monthly Calendar**: Traditional visual grid for dates and milestone deadlines.
  2. **Stripboard & Call Times**: Sequential day-by-day stripboard listing scene number, day/night lighting, eighths count, call times, and rest interval conflict detection (< 12 hours turnaround warning with quick-link to Guild Compliance).

### 2.4 Cryptographic Vault Integrity
- **Resolution**: Upgraded [`src/components/FilmAssetsModule.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/components/FilmAssetsModule.tsx) to compute genuine cryptographic SHA-256 digests using the browser's `window.crypto.subtle.digest('SHA-256', ...)` API, replacing fabricated pseudo-random hash strings.

### 2.5 Single-Source Indian Guild Compliance
- **Resolution**: The 11-point safety evaluator (`src/features/compliance/complianceEngine.ts`) serves as the single authoritative source of truth. Both the Executive Overview and Shooting Schedule link directly to the Compliance workspace.

---

## 3. Verification & Validation Results

### 3.1 TypeScript Type Completeness
- Command: `npx tsc --noEmit`
- Result: **0 errors**

### 3.2 Vitest Automated Test Suite
- Command: `npm test -- --run`
- Result: **10 test files passed, 76 tests passed (0 failures)**
  - `tests/workspace_boundaries.test.ts` (Phase 3A.5 workspace sequence & alias resolution)
  - `tests/screenplay.test.ts`
  - `tests/compliance.test.ts`
  - `tests/overview_kpi.test.ts`
  - `tests/services.test.ts`
  - `tests/rbac.test.ts`
  - `tests/invitations.test.ts`
  - `tests/projects.test.ts`
  - `tests/auth_lifecycle.test.ts`
  - `tests/scheduler.test.ts`

### 3.3 Vite Production Bundle
- Command: `npm run build`
- Result: **Built successfully in 8.79s**

### 3.4 Dev Server Probe
- URL: `http://localhost:3000/`
- Status: **HTTP 200 OK**
