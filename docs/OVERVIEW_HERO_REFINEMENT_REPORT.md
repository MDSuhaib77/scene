# SceneOS — Cinematic Overview Hero & Milestone Redesign Report

**Date:** October 16, 2026  
**System Version:** SceneOS Executive Command Centre 2.4.0  
**Workspace:** Overview (`src/components/ProjectOverview.tsx`)  
**Status:** Verification Passed (27/27 tests passing, 0 TypeScript errors, Production build successful)

---

## 1. Executive Summary & Design Inspiration

The SceneOS Overview workspace has been refined into a futuristic film-production command surface inspired by the polygonal access-hatch geometry from Shankar's *Enthiran* (Robot).

The redesign replaces the standard rectangular card housing with an asymmetrical polygonal chassis featuring:
- A shallow inward-curving top edge dipping toward the center and rising toward the shoulders.
- Angled transitions to sloped upper corners with a prominent clipped/chamfered upper-right corner.
- A broad angular lower body with tapered/chamfered lower corners.
- A dual-layered outer edge combining dark titanium housing strokes with an inner glowing cyan perimeter trace.
- A subtle 20px cyan grid texture with radial gradient depth.
- An integrated precision production milestone visualizer in the lower chassis tier, replacing the legacy duplicate ribbon.
- Discretely discoverable editing for all creative leads (Title, Logline, Director, Producer, DoP, Target Rating) with strict RBAC permission gating.
- Independent floating overlay drawers for Operational Attention and Recent Activity that open without resizing the hero or displacing any timeline elements.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SCENEOS COMMAND CHASSIS                         │
│  [Rating] • [Phase] • [Guild Safety] • [Lock Mode] • [Clock] • [Edit]  │
│                                                                        │
│                      "NEON ODYSSEY: RESURRECTION"                      │
│                  "In a rain-slicked mega-city..."                      │
│            Dir: S. Shankar • Prod: Kalanithi • DoP: Jack Miller        │
│                                                                        │
│  [ Attention: Clean ▾ ]      [ 70 DAYS WRAP IN ]     [ Activity: 3 ▾ ] │
│   (Floating Overlay)         (Visual Anchor)         (Floating Overlay)│
│                                                                        │
│  ────────────────────────────────────────────────────────────────────  │
│              INTEGRATED PRODUCTION MILESTONE VISUALIZER                │
│  ──●───────────────◆──────────────────○───────────────────○─────────── │
│   Dev (45d)     Pre-Prod (74d)      Principal (122d)    Post (91d)     │
│  [Completed]       [ACTIVE]             [Pending]        [Pending]     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Production Identity & Metadata Editing Experience

### 2.1 Supported Fields & Validation Rules
All critical production metadata fields are now fully editable through a unified, accessible modal dialog ([`EditProductionMetadataModal.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/components/overview/EditProductionMetadataModal.tsx)):

| Field | Validation Rules | Character Limit | Fallback Display |
|---|---|---|---|
| **Production Title** | Required; non-empty trimmed string | 100 characters | `"Untitled Production"` |
| **Logline / Synopsis** | Optional; trimmed string | 500 characters | `"Click to define synopsis"` |
| **Director** | Optional; trimmed string | 80 characters | `"Unassigned"` |
| **Producer** | Optional; trimmed string | 80 characters | `"Lead Producer"` |
| **Director of Photography (DoP)** | Optional; trimmed string | 80 characters | `"Jack Miller"` |
| **Target Rating** | Valid rating domain (`G`, `PG`, `PG-13`, `R`, `NC-17`, `Unrated`) | Dropdown selection | `"PG-13"` |

### 2.2 Discoverable, Clutter-Free Affordances
- **No Pencil Clutter:** Pencil icons are hidden by default to keep the cinematic visual field pristine.
- **Subtle Hover/Focus Revelation:** Hovering over or focusing with keyboard on the Title, Logline, Director, Producer, or DoP displays a soft cyan highlight, subtle background glow, and reveals an edit indicator.
- **Global Edit Pill:** An "Edit Identity" affordance badge in the top metadata badge row allows direct one-click access.
- **Direct Focus Triggering:** Clicking any creative lead or badge opens the modal dialog with the cursor automatically focused in that specific field (`initialFocusedField`).

### 2.3 RBAC Permission Gating
- Handled through `canEditProductionMetadata(userRole)`:
  - **Authorized Roles:** `Line Producer`, `Director`, `Executive Producer`, `Production Manager`, admin defaults (`true`).
  - **Restricted Roles:** `viewer`, `read-only`, `crew_member` (`false`).
- For restricted roles, edit badges and hover affordances are suppressed, and interactive controls are set to `disabled`.

### 2.4 State Management & Persistence
- Changes are submitted via `onUpdateProjectMeta(updates)`, which updates the root `FilmProject` model and persists to `localStorage`.
- The modal displays an animated saving spinner (`Loader2`), followed by an emerald checkmark success state before automatically closing.
- If persistence encounters an error, a high-contrast alert displays the error without discarding entered content.
- Changes propagate immediately to the Overview hero and all dependent subviews.

---

## 3. Polygonal Hero Chassis Surface

### 3.1 Geometric Construction
Built with an SVG architectural chassis (`viewBox="0 0 1200 640"`, `preserveAspectRatio="none"`):
- **Top Inward Dip:** `M 120 16 Q 600 42, 1060 16` creates a subtle curved dip toward the optical center.
- **Chamfered Upper-Right Shoulder:** `L 1120 24 L 1192 84` produces the clipped access-hatch profile inspired by the reference image.
- **Vertical Flanks & Tapered Base:** `L 1192 560 L 1136 626 L 64 626 L 8 560 L 8 84 L 64 24 Z`.
- **Dual Edge Treatment:** 
  - Outer housing stroke in dark titanium (`#1e293b`, 2.5px).
  - Inner neon perimeter trace in cyan (`#06b6d4` to `#38bdf8`) with SVG gaussian blur filter (`feGaussianBlur stdDeviation="3"`).
- **Corner Mechanical Rivets & Ticks:** 4 corner rivet fasteners at `(24, 96)`, `(1176, 96)`, `(24, 548)`, and `(1176, 548)` with optical calibration tick marks at the center top.
- **Holographic Hatch Badging:** Subtle monospace markings (`SCENE-OS // COMMAND-HATCH 01`, `SYS.SPEC // 2.4`).

### 3.2 Safe Content Insets & Responsive Scaling
- Inset padding (`px-6 sm:px-10 md:px-14 pt-8 md:pt-10 pb-6`) ensures title, countdown instrument, and controls never collide with the chamfered corners.
- On mobile viewports (`< 640px`), the SVG chassis scales smoothly while badges and creative leads wrap into clean, readable rows without horizontal clipping.

---

## 4. Futuristic Minimalist Production Milestone Visualizer

### 4.1 Architecture & Component Design
The legacy Region 4 ribbon at the bottom of the overview has been superseded by [`ProductionMilestoneVisualizer.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/components/overview/ProductionMilestoneVisualizer.tsx), mounted directly inside the hero console.

### 4.2 Key Visualizer Capabilities
1. **Luminous Baseline & Progress Track:** Thin 2px cyan baseline (`#0e7490`) overlaid with a luminous cyan-to-indigo gradient progress segment.
2. **Animated Traveling Signal Pulse:** A glowing cyan signal line animates across the completed and active segments (`@keyframes signalTravel`). It automatically disables when `prefers-reduced-motion: reduce` is enabled.
3. **Geometric Node Glyphs:**
   - **Completed Phases:** Emerald diamond nodes with white checkmarks.
   - **Active Phase:** Glowing cyan hexagonal node with pulsing concentric beacon rings (`animate-ping`).
   - **Overdue Phases:** Rose octagon node with amber exclamation glyph.
   - **Pending Phases:** Dark titanium circular nodes with subtle cyan borders.
4. **Interactive Progressive Popover Disclosure:**
   - Hovering or focusing (`tabIndex={0}`) on any milestone node reveals a floating inspection popover.
   - Displays: Phase category, date range, total scheduled days, task completion tally (`X / Y deliverables`), and days elapsed / remaining.
5. **Timeline Agreement with Countdown Clock:**
   - The milestone track strictly reflects `project.startDate` and `targetDate`.
   - If the active phase end date extends past the target wrap date, a high-visibility warning banner is rendered.
6. **Workspace Navigation Click-Through:**
   - Clicking any milestone node or the "Roadmap Workspace →" button triggers `onNavigateTab?.('phases')`, transitioning the user directly to the detailed Roadmap workspace.

---

## 5. Hero Controls & Independent Floating Expansion

### 5.1 Zero-Displacement Flanking Design
In previous iterations, expanding Operational Attention or Recent Activity shifted the hero height and pushed lower components down. This has been resolved:
- **Left Flank:** Operational Attention trigger button with status indicator (`"Attention · Clean"` or `"X issues"`).
- **Right Flank:** Recent Activity trigger button with update counter (`"Activity · X updates"`).
- **Floating Overlay Architecture:** When either flank is activated, its drawer renders as an `absolute top-full mt-2 z-40 max-w-sm` panel with `backdrop-blur-md`, dark navy background (`#060c18/98`), and deep shadow (`shadow-[0_16px_48px_rgba(0,0,0,0.85)]`).
- **Result:** Toggling Attention or Activity **never changes the height of the hero** and **never displaces the countdown clock or milestone track**.

### 5.2 Dismissal & Keyboard Navigation
- **Click-Away Listener:** Clicking anywhere outside the open panel closes it.
- **Escape Key:** Pressing `Escape` immediately dismisses any open panel or modal.
- **Focus Rings:** All buttons, nodes, and inputs feature visible cyan focus rings (`focus:ring-1 focus:ring-cyan-400`).

---

## 6. Verification & Automated Test Results

### 6.1 Test Suite Summary
Targeted automated test suites were executed with Vitest:

```
 RUN  v5.0.4 C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main

 ✓ tests/scheduler.test.ts (3 tests) 9ms
 ✓ tests/compliance.test.ts (5 tests) 8ms
 ✓ tests/overview_kpi.test.ts (12 tests) 15ms
 ✓ tests/overview_hero.test.ts (7 tests) 8ms

 Test Files  4 passed (4)
      Tests  27 passed (27)
   Start at  19:10:44
   Duration  857ms
```

### 6.2 TypeScript Compiler Verification
```bash
npx tsc --noEmit
# Exit Code: 0 (0 errors)
```

### 6.3 Production Bundle Compilation
```bash
npm run build
# vite v6.4.4 building for production...
# ✓ 2165 modules transformed.
# dist/index.html                     0.43 kB │ gzip:   0.30 kB
# dist/assets/index-XSoUCz2g.css    163.62 kB │ gzip:  21.19 kB
# dist/assets/index-DPBKDgeA.js   1,182.22 kB │ gzip: 311.23 kB
# ✓ built in 18.94s
```

---

## 7. Modified & Created Files

1. [`src/components/overview/EditProductionMetadataModal.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/components/overview/EditProductionMetadataModal.tsx):
   - Modal component for editing title, logline, director, producer, DoP, and target rating.
   - Includes input validation, length limits, saving states, and RBAC helper `canEditProductionMetadata`.
2. [`src/components/overview/ProductionMilestoneVisualizer.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/components/overview/ProductionMilestoneVisualizer.tsx):
   - Integrated precision timeline with animated signal pulse, phase glyphs, interactive popovers, and roadmap navigation.
3. [`src/components/ProjectOverview.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/components/ProjectOverview.tsx):
   - Installed polygonal SVG command chassis.
   - Connected editable metadata affordances on Title, Logline, and Creative Leads.
   - Converted Operational Attention and Recent Activity into non-displacing floating overlay dropdowns.
   - Embedded `<ProductionMilestoneVisualizer />` in the hero console.
   - Removed redundant legacy Region 4 milestone ribbon.
4. [`tests/overview_hero.test.ts`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/tests/overview_hero.test.ts):
   - Unit tests covering metadata editing RBAC permissions, input boundary validations, milestone sequencing, and timeline alignment.
