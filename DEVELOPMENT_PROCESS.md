# Executive Summary: Development Process of "plan"

This document provides a neat, concise, and professional executive overview of the development lifecycle, system components, and architectural interactions for **plan**, a professional film production pipeline scheduler.

---

## 1. Development Process & Chronology

The development of **plan** followed a structured, modular, and component-driven workflow to transition from an initial template to a production-ready system prototype:

### Phase 1: Conceptual Alignment & Core State Modeling
*   **Aesthetic Branding**: Set up a clean, high-contrast, dual-theme aesthetic (**Dark Neon** for creative workflows and **Light Cinematic** for screenplay review).
*   **State Architecture**: Structured the underlying TypeScript definitions for film projects, scheduling phases (`pre`, `prod`, `post`), checkpoints (activities with priority level and completed state), and user team designations.

### Phase 2: Dynamic Scheduling Engine (Gantt-like Logic)
*   **Automated Timeline Summation**: Engineered a deterministic scheduling algorithm that sums up durations of individual film checkpoints and projects a recommended end date based on a given start date.
*   **Rigid vs. Flexible Constraints**: Added a constraint toggle (`RIGID` and `FLEX`) to let coordinators manually lock target release dates. When toggled to `RIGID`, any delay in upstream checkpoints automatically flags timeline overflows; under `FLEX`, dates automatically cascade downstream.

### Phase 3: Interactive Project Customization (Renaming & Metadata)
*   **Inline Context Controls**: Built lightweight state controls for editing active project properties (Title, Logline) in real-time.
*   **Technician & Crew Management**: Enabled interactive fields for updating key technician metadata (`PROD`, `WRITER`, `DP`), and a togglable matrix for selecting active user-specific project designations.

### Phase 4: Full User Authentication (Secure Client-Side Persistence)
*   **State-Backed Database**: Implemented a local users registry in `localStorage` to handle standard sign-up, password validations, and secure login checking.
*   **Simulated Google OAuth**: Programmed an interactive Google Account Chooser modal complete with rapid account switching (`mdsuhaib2004@gmail.com`, `kira.vance@neonstudios.com`, `plan.creator@gmail.com`) or custom Google email entry.

---

## 2. Tools & Models Implemented

*   **Runtime Environment**: React 18, TypeScript, Vite.
*   **Styling & Theme Framework**: Tailwind CSS (with utility overrides for custom glows and paper aesthetics).
*   **Animation Engine**: `motion/react` (framer-motion) for smooth screen transitions and dropdown scale-ups.
*   **Visual Assets**: Vector graphics from `lucide-react` for high rendering accuracy on all screen types.
*   **Persistence**: `localStorage` (safely serializing active projects, session tokens, and registered account profiles).

---

## 3. Lucidchart Architecture Diagram Code (Mermaid Format)

The following diagram represents the core functional modules, interactive layers, and storage synchronization of **plan**. You can copy this code and import it directly into **Lucidchart** (using the *Import > Mermaid* option) or render it using any Mermaid viewer:

```mermaid
graph TD
    %% Styling Definitions
    classDef user fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#1e1b4b;
    classDef client fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#052e16;
    classDef logic fill:#f0f9ff,stroke:#0284c7,stroke-width:2px,color:#0c4a6e;
    classDef storage fill:#fff1f2,stroke:#e11d48,stroke-width:2px,color:#4c0519;

    %% Elements
    User([Film Producer / Operator]) :::user
    
    subgraph Client_App [Client Presentation Layer]
        AuthGate[Workspace Gateway / Auth Screen] :::client
        Dashboard[Portfolio Dashboard] :::client
        Editor[Pipeline Editor Workspace] :::client
        GoogleChooser[Google Account Chooser Modal] :::client
    end

    subgraph State_Engine [Core Processing & Scheduler Logic]
        UserSession[User Session State] :::logic
        Scheduler[Cascading Durations recalculateSchedule] :::logic
        InlineEdits[Inline Metadata Save Handlers] :::logic
    end

    subgraph Persistence [Local Database & Storage]
        LocalUsers[(cp_users Database)] :::storage
        LocalProjects[(cp_projects Database)] :::storage
        LocalTheme[(cp_theme Configuration)] :::storage
    end

    %% Interactions & Flows
    User -->|Access System| AuthGate
    AuthGate -->|1. Sign Up / Login| LocalUsers
    AuthGate -->|2. Continue with Google| GoogleChooser
    GoogleChooser -->|Select Google Account| UserSession
    
    UserSession -->|Established| Dashboard
    Dashboard -->|Select / Create Project| Editor
    
    Editor -->|Modify Title / Logline| InlineEdits
    Editor -->|Adjust Start Date / Durations| Scheduler
    Editor -->|Assign Designation Roles| InlineEdits
    
    InlineEdits -->|Write State Backups| LocalProjects
    Scheduler -->|Recalculate Release Timeline| LocalProjects
    LocalProjects -->|Reactive Updates| Dashboard
    
    %% Connections to DB
    UserSession -.->|Read/Write Role| LocalUsers
    
    %% Note styling and layouts
    style Client_App fill:#fdfdfd,stroke:#71717a,stroke-dasharray: 5 5
    style State_Engine fill:#fdfdfd,stroke:#71717a,stroke-dasharray: 5 5
```
