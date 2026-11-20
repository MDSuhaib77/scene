# SceneOS — Product-Wide UX, Visual Design & Screenplay Ingestion Audit

**Milestone:** Product-Wide UX Elevation & Screenplay Ingestion Architecture  
**Date:** 2026-10-15  
**Product Mandate:** Elevate SceneOS into a coherent, streamlined, production-grade SaaS film operating system.  
**Test Suite Status:** 54 / 54 Unit Tests Passed (100% across 7 suites)  
**TypeScript Status:** Clean Compilation (`npx tsc --noEmit` — 0 Errors)  
**Build Status:** Production Bundle Succeeded in 8.92s  

---

## 1. Executive Summary & Product Design Direction

SceneOS is an operating system for film production designed for producers, directors, 1st ADs, department heads, and crew. Previously, the interface suffered from redundant elements, excessive marketing copy, student-project visual cliches (neon gradients, continuous oscillating canvas loops, tech-jargon headers), and narrowly scoped screenplay handling.

This release executes a comprehensive product-wide refinement:
1. **Applied the Design Test:** Every visible element was audited to ensure it aids in understanding, deciding, or performing a concrete action.
2. **Eliminated Decorative Distraction:** Replaced continuous 6,912-circle canvas animation loops with zero-overhead, elegant CSS dot grids; stripped tri-color text gradients, glowing borders, and uppercase tech-jargon badges.
3. **Elevated Screenplay to First-Class Workspace Status:** Built a practical, extensible screenplay ingestion pipeline supporting six industry formats (**Final Draft .fdx, Fountain .fountain/.spmd, Plain Text .txt, PDF .pdf, Word .docx, and Rich Text .rtf**) paired with an interactive Scene Breakdown & Metadata Catalog.

---

## 2. Complete UI and Content Audit Inventory

| Interface Area | Classification | Pre-Audit Problem | Implementation & Solution |
| :--- | :---: | :--- | :--- |
| **Workspace Canvas** | **REMOVE** | `DotWaveBackground` ran a 96x72 continuous math loop (6,912 circles per frame) on `requestAnimationFrame`, causing laptop fan spin and visual distraction. | Replaced with a zero-overhead, static CSS dot-matrix pattern (`opacity-0.035`) with zero CPU/GPU cost and crisp readability. |
| **Dashboard HUD** | **CONSOLIDATE** | Labeled *"MASTER OPERATOR GREETING HUD"* with tri-color neon text gradient, pulsating cyan blur circles, and promotional marketing slogans. | Streamlined into a refined **Studio Dashboard** with clean typography, active project count, user role indicator, and high signal-to-noise ratio. |
| **Project Creation & Import Cards** | **CONSOLIDATE** | Oversized cards with verbose copy: *"Establish release targets, loglines, and launch pre-calculated milestones."* | Consolidated into sharp action cards: **New Production** and **Import Configuration** with clear microcopy. |
| **Top Global Navigation** | **CONSOLIDATE** | Crammed with multiple high-contrast badges, uppercase labels, and redundant session buttons. | Refined into an uncluttered studio bar: Project Switcher with active role pill, Team & Roles modal trigger, Connection Status badge, Theme toggle, and Profile avatar. |
| **Workspace Tabs** | **CONSOLIDATE** | 8 dense tabs where screenplay was buried as a minor sub-tab inside *"Content & Backups"*. | Elevated to 9 first-class tabs, introducing **Screenplay & Scenes** directly alongside Roadmap & Tasks, Safety Rules, Crew, Calendar, Kanban, and Vault. |
| **Screenplay Ingestion** | **CONSOLIDATE** | Previously only manual mock snippet cards with zero parser support for industry formats. | Built extensible modular parser pipeline supporting `.fdx`, `.fountain`, `.txt`, `.pdf`, `.docx`, `.rtf` with pre-import preview and validation. |
| **Scene Breakdown & Tagging** | **CONSOLIDATE** | Scene details were scattered across storyboard cards without structured breakdown metadata. | Created a dedicated **Scene Catalog & Breakdown Inspector** supporting filtering by INT/EXT, DAY/NIGHT, characters, page eighths, and department tagging. |
| **Indian Guild Compliance Engine** | **KEEP** | Core calculation engine enforcing FWICE, FEFSI, TFIEF, FEFKA, and KFWF rest turnaround, workday, and meal rules. | Retained 100% operational in `src/features/compliance/` and `src/components/ConstraintIntegrityPanel.tsx`. |
| **Scheduler & Date Cascade** | **KEEP** | Backward and forward date math cascading across pre-production, principal photography, and post. | Preserved with all 3 scheduler tests passing. |
| **SVG Progression Graph** | **KEEP** | Interactive sequential timeline and critical path visualizer. | Preserved with full interactive milestone management. |
| **Authentication & RBAC** | **KEEP** | Google OAuth PKCE flow, Email registration/login, Supabase RLS policies, and project isolation. | Preserved with demo personas secured against unauthorized live bypass. |

---

## 3. Screenplay Ingestion Architecture

### Pipeline Flow:
```text
Uploaded File
     │
     ▼
[Step 1: Validation] ──> Size check (≤25MB), format detection, extension & magic bytes
     │
     ▼
[Step 2: Format Adapter]
     ├─ FdxAdapter        ──> Final Draft XML (DOMParser & regex fallback)
     ├─ FountainAdapter   ──> Fountain spec (sluglines, character cues, dialogue)
     ├─ TextAdapter       ──> Plain text heuristic breakdown
     ├─ PdfAdapter        ──> PDF text stream extraction & fidelity warning
     ├─ DocxAdapter       ──> Word XML paragraph extraction
     └─ RtfAdapter        ──> RTF control code stripping
     │
     ▼
[Step 3: Normalization & Eighths Math]
     ├─ Slugline Parser (INT/EXT, Location, Time of Day)
     ├─ Eighths Calculator (~55 lines/page, standard 1/8th increments)
     ├─ Character & Location Aggregator
     └─ Parsing Warnings Logger
     │
     ▼
[Step 4: Human Review Modal] ──> Preview scenes, correct sluglines, check duplicate tag
     │
     ▼
[Step 5: Persistence] ──> Project state updated with versioned Screenplay Document
```

### Supported Formats & Capabilities:
1. **Final Draft (.fdx):** Extracts `<Paragraph Type="Scene Heading">`, `<SceneProperties Number="...">`, `<Character>`, `<Dialogue>`, `<Parenthetical>`, and `<Action>`. Accurately preserves writer's original scene numbers and dialogue attribution.
2. **Fountain (.fountain, .spmd):** Full support for Fountain specification including standard sluglines (`INT.`, `EXT.`), forced sluglines (`.LOCATION`), scene numbers (`#12#`), character cues, dialogue, parentheticals, and synopses (`= Synopsis`).
3. **Plain Text (.txt):** Robust regex parsing of industry sluglines with Day/Night classification and front-matter detection.
4. **PDF (.pdf):** Extracts text streams from vector PDFs. Explicitly flags formatting notices to alert users that complex PDF layouts should be reviewed.
5. **Word (.docx):** Extracts `<w:p>` paragraphs and text blocks from DOCX packages.
6. **Rich Text Format (.rtf):** Strips font/color tables and control codes, recovering script structure.

---

## 4. Scene Management & Breakdown Experience

The **Screenplay & Scene Breakdown Workspace** (`src/features/screenplay/ScreenplayWorkspace.tsx`) delivers an intuitive, focused environment:
- **Top Metrics Row:** Total Scenes, Total Pages in 8ths (`42 3/8 pgs`), Review Completion Progress (`%`), Speaking Cast Count, Environment Breakdown (`14 INT / 8 EXT`), and Lighting Breakdown (`16 DAY / 6 NIGHT`).
- **Unified Filter Toolbar:** Real-time search across scene numbers, locations, and synopsis; filters for INT/EXT, Time of Day (DAY/NIGHT/DUSK/DAWN), Character presence, and Review Status.
- **Dual View Modes:** 
  - **Dense Table View:** Compact overview of scene numbers, sluglines, page lengths in eighths, lighting, speaking characters, and review status buttons.
  - **Grid Cards View:** Visual cards with synopsis snippets, character counts, and status pills.
- **Scene Detail Drawer / Modal:**
  - Editable slugline, environment, time of day, and page length in eighths (e.g. `1 3/8`).
  - Scene synopsis and director notes.
  - Interactive character chips with add/remove capability.
  - Department breakdown elements (Props, Wardrobe, Vehicles, Stunts, VFX).
  - Original script excerpt viewer.
  - One-click **"Mark as Reviewed"** workflow.

---

## 5. Automated Verification & Quality Report

### 5.1 Unit Tests (Vitest)
```text
✓ tests/projects.test.ts (8 tests)
✓ tests/services.test.ts (7 tests)
✓ tests/compliance.test.ts (5 tests)
✓ tests/rbac.test.ts (13 tests)
✓ tests/invitations.test.ts (6 tests)
✓ tests/scheduler.test.ts (3 tests)
✓ tests/screenplay.test.ts (12 tests)

Test Files  7 passed (7)
     Tests  54 passed (54)
  Duration  548ms
```

### 5.2 TypeScript Compilation
```text
npx tsc --noEmit
Exit code: 0 (Zero errors across all source files)
```

### 5.3 Production Build
```text
npm run build
vite v6.4.4 building for production...
✓ 2154 modules transformed.
dist/index.html                  0.43 kB │ gzip:  0.29 kB
dist/assets/index-DqaemRjl.css 159.13 kB │ gzip: 20.68 kB
dist/assets/index-BIGmBBuF.js 1,119.26 kB │ gzip: 292.49 kB
✓ built in 8.92s
```

---

## 6. Known Limitations & Intentionally Deferred Items

1. **Scanned Image-Only PDFs (OCR):** PDFs without an embedded text stream (e.g., photocopied or scanned scripts) require Optical Character Recognition. Rather than bloating client-side bundles with heavyweight multi-megabyte WASM models, SceneOS detects image-only PDFs and cleanly warns the user to upload a digital text export (`.fdx`, `.fountain`, or text `.pdf`).
2. **Live Multi-User Collaborative Screenwriting:** Real-time concurrent document editing (Google Docs style) is deferred to future milestones; the current focus is authoritative screenplay breakdown, version locking, and production scheduling.
