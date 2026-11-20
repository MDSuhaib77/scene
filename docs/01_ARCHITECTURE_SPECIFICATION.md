# SceneOS — Architecture Specification & System Blueprint
**Document Version:** 1.0.0  
**Status:** Approved Architectural Baseline  
**System Classification:** Professional Film-Production Operating System  

---

## 1. Executive Summary & Product Specification

### 1.1 Product Vision
**SceneOS** is a specialized, intelligent film-production operating system that unifies creative planning, production management, stripboard scheduling, team collaboration, guild compliance, secure script and asset distribution, and operational analytics into a cohesive, high-performance platform.

Unlike traditional studio software (which is siloed, desktop-bound, or tailored only to massive Hollywood studios) or generic project-management boards (which lack film-specific domain models like scenes, shooting days, turnarounds, page counts, call sheets, and guild rules), SceneOS models the genuine physics of film production:
* Scripts define scenes and breakdown assets.
* Scenes dictate shooting days and resource requirements (cast, crew, locations, cameras).
* Shooting days are constrained by labor regulations, turnaround windows, budget caps, and cast holds.
* Changes in dates or shot lists cascade deterministically, instantly triggering compliance warnings and financial re-forecasts.

---

### 1.2 Target Personas & Core Workflows

| Persona | Core Needs & Typical Pain Points | SceneOS Primary Workflows |
| :--- | :--- | :--- |
| **Line Producer / UPM** | Budget control, daily burn rate, guild violation avoidance, vendor & crew contracting. | Budget vs actual tracking, shooting-day cost analysis, compliance audits, role-based export reports. |
| **1st Assistant Director (1st AD)** | Stripboard scheduling, scene grouping, turnaround tracking, actor availability, call sheet generation. | Interactive stripboard, scene drag-and-drop, automated turnaround calculation, cast hold conflict detection. |
| **Director / Showrunner** | Creative vision preservation, scene coverage, script version changes, storyboard alignment. | Script revision side-by-side view, scene breakdown review, visual storyboard progression, shot progress tracking. |
| **Department Heads (HODs)** | Props, wardrobe, lighting, grip, camera asset lists, department crew assignments. | Department breakdown logs, gear check-in/out, activity feeds, scene-to-prop traceability. |
| **Lead Cast & Key Crew** | Clear call times, access to latest locked script sides only, privacy from wider budget data. | Secure mobile-responsive portal, signed watermarked script sides, personalized shooting schedule. |

---

### 1.3 Scope Boundaries: MVP vs Deferred Capabilities

```
+---------------------------------------------------------------------------------------+
|                                    SCENEOS SCOPE                                      |
+-------------------------------------------+-------------------------------------------+
|               IN-SCOPE (MVP)              |             DEFERRED (PHASE 2+)           |
+-------------------------------------------+-------------------------------------------+
| - Supabase Auth (Email + Google OAuth)    | - Native iOS/Android apps (PWA first)     |
| - RBAC (Owner, Producer, AD, HOD, Crew)   | - Direct Power BI embedded iframe         |
| - Relational Project & Membership models  | - Real-time collaborative text editing    |
| - Screenplay import (Fountain / PDF text) |   (Google Docs style simultaneous cursor) |
| - Scene Breakdown & Department Tagging    | - Automated SAG-AFTRA payroll calculation |
| - Dependency-aware Stripboard Scheduling  | - Third-party payroll software sync       |
| - Configurable Multi-Guild Compliance     | - Automated video transcode on cloud      |
| - Supabase Private Storage & Signed URLs  | - Camera raw footage archival to LTO tape |
| - Team Activity Log & Department Feeds    | - Offline-first CRDT local database sync  |
| - Basic AI Breakdown & Schedule Advisor   | - Voice-activated set assistance          |
+-------------------------------------------+-------------------------------------------+
```

---

## 2. System Architecture & Component Interaction

### 2.1 Full-Stack Topology

SceneOS uses a modern, secure, edge-ready architecture:
1. **Client Tier:** React 19 + TypeScript + Vite + Tailwind CSS. Component-driven, typed, utilizing TanStack Query for remote state caching and optimistic updates.
2. **Security & Boundary Tier:** Supabase API Gateway (PostgREST + GoTrue + Storage Engine). All relational access is secured via PostgreSQL Row-Level Security (RLS) driven by `auth.uid()`.
3. **Database Tier:** Managed PostgreSQL 15+ hosted on Supabase, leveraging relational schemas, enum types, trigger-based audit logs, and SQL views for analytics.
4. **Serverless Tier:** Supabase Edge Functions (Deno runtime) for privileged tasks: parsing binary PDF scripts, computing complex schedule optimization graphs, watermarking documents, and securely proxying Gemini AI queries.
5. **Realtime Tier:** Supabase Realtime (WebSockets over Phoenix channels) for presence indicators, live schedule conflict broadcasts, and urgent notification delivery.

### 2.2 System Architecture Diagram (Mermaid)

```mermaid
graph TD
    %% User Clients
    subgraph ClientLayer ["Client Layer (Browser / Tablet)"]
        UI["React 19 + TypeScript SPA (Vite)"]
        QueryCache["TanStack Query (Client Cache)"]
        RealtimeSub["Supabase Realtime Client (WebSockets)"]
        UI <--> QueryCache
        UI <--> RealtimeSub
    end

    %% Edge & Gateway Layer
    subgraph GatewayLayer ["Edge & API Gateway (Supabase)"]
        Kong["Kong API Gateway & SSL"]
        AuthService["GoTrue Auth Service"]
        StorageEngine["Storage API (S3 Compatible)"]
        PostgREST["PostgREST RESTful Data Engine"]
        EdgeFunctions["Supabase Edge Functions (Deno)"]
    end

    %% Database & Storage
    subgraph StorageLayer ["Data & Storage Layer"]
        PG[("PostgreSQL 15+ Database")]
        RLS{"Row-Level Security (RLS) Policies"}
        S3Buckets[("Encrypted Private S3 Buckets")]
    end

    %% External Services
    subgraph ExternalServices ["External Intelligence & Identity"]
        GoogleOAuth["Google Cloud OAuth 2.0"]
        GeminiAPI["Google Gemini 2.5 Flash / Pro API"]
    end

    %% Client to Gateway
    UI -->|HTTPS / REST| Kong
    RealtimeSub <-->|WSS Presence & Broadcast| Kong
    Kong --> AuthService
    Kong --> StorageEngine
    Kong --> PostgREST
    Kong --> EdgeFunctions

    %% Auth to Identity Provider
    AuthService <-->|OAuth Tokens| GoogleOAuth

    %% Edge Functions to AI & DB
    EdgeFunctions -->|Private API Key| GeminiAPI
    EdgeFunctions -->|Service Role / Direct DB| PG

    %% PostgREST & Storage to PG
    PostgREST --> RLS --> PG
    StorageEngine --> S3Buckets
    StorageEngine -->|Access Control Check| RLS

    %% Database Triggers to Realtime
    PG -.->|WAL Logical Replication (wal2json)| RealtimeSub
```

---

## 3. Technology Stack Justification

| Layer | Chosen Technology | Rationale & Trade-off Analysis |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19 + TypeScript 5.8** | Industry standard, robust virtual DOM diffing for complex interactive schedules, immense ecosystem of battle-tested timeline and canvas tools. Strict typing prevents cascading mathematical scheduling bugs. |
| **Build & Tooling** | **Vite 6** | Instantaneous HMR (<50ms), native ES modules, lightweight production bundle splitting, superior DX compared to Webpack. |
| **Styling & Design System** | **Tailwind CSS v4 + Lucide Icons** | Utility-first styling with zero runtime overhead. Strict CSS token variables allow dark-room cinematic high-contrast cockpit aesthetics. |
| **State Management** | **TanStack Query v5 + Zustand** | TanStack Query isolates server state, caching, invalidation, and deduplication. Zustand handles local UI state (modal open/close, timeline zoom scale, active filters) without boilerplate. |
| **Primary Backend** | **Supabase (PostgreSQL 15+)** | Fixed architectural requirement. Provides enterprise-grade relational integrity, foreign keys, triggers, JSONB for rule engine versatility, and rock-solid Row Level Security (RLS). |
| **Authentication** | **Supabase Auth (GoTrue)** | Native JWT integration with Postgres RLS. Out-of-the-box email/password with verification, plus Google OAuth without custom auth server maintenance. |
| **File Storage** | **Supabase Storage (S3 backend)** | Integrated RLS security policies on storage buckets (`scripts`, `call-sheets`, `storyboards`), presigned expiring URLs for sensitive script sides. |
| **AI Integration** | **Google Gemini 2.5 via Edge Functions** | Server-side execution keeps Gemini API keys secure. Long-context window enables whole-screenplay processing for breakdown extraction and schedule analysis. |
