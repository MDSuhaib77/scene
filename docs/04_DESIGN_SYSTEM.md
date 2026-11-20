# SceneOS — Design System Specification
**Document Version:** 1.0.0  
**Aesthetic Theme:** Dark Cockpit & High-Contrast Cinematic  

---

## 1. Visual Philosophy & Design Principles

SceneOS is designed for production environments ranging from dimly lit video villages, editing bays, and stage production offices to bright outdoor exterior shoots.

* **Cinematic but Restrained:** High-contrast dark surfaces with deliberate, functional neon accents (Amber, Emerald, Cyan, Rose) denoting status, hazard, and phase without gratuitous glow or distracting eye-candy.
* **Information Density with Breathing Room:** Dense, tabular stripboard data when needed, paired with spacious milestone cards and legible metrics.
* **Typographic Hierarchy:** Monospace for technical coordinates, scene codes, timecodes, and page counts; high-legibility geometric sans-serif for UI labels and titles.

---

## 2. Color System & Design Tokens

### 2.1 Base Canvas & Neutral Surfaces
| Token | Hex / HSL | Usage |
| :--- | :--- | :--- |
| `--surface-canvas` | `#080A0F` (Zinc-950 deep) | Main application viewport backdrop |
| `--surface-panel` | `#0F131D` (Slate-900 tint) | Cards, sidebars, modals, stripboard containers |
| `--surface-elevated` | `#171D2B` | Hover states, active dropdowns, elevated tooltips |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Standard card and section dividing lines |
| `--border-active` | `rgba(255, 255, 255, 0.20)` | Active input borders, focused containers |

### 2.2 Functional & Film Domain Tokens
| Token | Hex | Cinematic Meaning |
| :--- | :--- | :--- |
| `--film-preprod` | `#06B6D4` (Cyan-500) | Pre-production planning, permits, script drafts |
| `--film-prod` | `#6366F1` (Indigo-500) | Principal photography, shooting days, active set |
| `--film-post` | `#8B5CF6` (Violet-500) | Post-production, editing, VFX, sound lock |
| `--film-hazard` | `#EF4444` (Rose-500) | Guild violations, turnaround shortfalls, budget breach |
| `--film-warning` | `#F59E0B` (Amber-500) | Weather contingency risk, pending permit, cast hold tight |
| `--film-safe` | `#10B981` (Emerald-500) | 100% compliant, locked script, confirmed cast |

---

## 3. Typography Scale

* **Display / Headings:** `Plus Jakarta Sans` or `Space Grotesk` (600/700 weight)
* **Body / UI Labels:** `Plus Jakarta Sans` (400/500 weight)
* **Metadata, Slugs, Timecodes, Page Eighths:** `JetBrains Mono` or `Share Tech Mono` (Tabular figures)

| Style | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-display` | 24px (1.5rem) | Bold (700) | 1.2 | Page title, active production header |
| `text-title` | 18px (1.125rem) | SemiBold (600) | 1.3 | Module headers, stripboard day headers |
| `text-body` | 14px (0.875rem) | Regular (400) | 1.5 | General UI, descriptions, form inputs |
| `text-caption` | 12px (0.75rem) | Medium (500) | 1.4 | Badges, timestamps, secondary labels |
| `text-code` | 13px (0.8125rem) | Regular (400) | 1.4 | Scene slugs (`INT. OFFICE - DAY`), timecodes |

---

## 4. UI Components & Interaction Standards

1. **Stripboard Strips:**
   - Color-coded by `Day/Night` and `INT/EXT` according to classic studio color standards:
     - INT. DAY: White / Light Gray border
     - EXT. DAY: Yellow / Amber accent
     - INT. NIGHT: Green / Emerald accent
     - EXT. NIGHT: Blue / Indigo accent
   - Monospaced scene numbers and page count fractions (`3 4/8`).
2. **Buttons & Controls:**
   - Primary: High-contrast emerald or indigo fill with subtle border shine.
   - Secondary: Translucent dark slate with subtle white border.
   - Destructive: Dark rose with high-contrast warning icon.
3. **Empty States:**
   - Illustrated with subtle film-reel or script-slate iconography, concise explanation, and a single, direct Call-to-Action (e.g. "Upload First Script", "Create Shooting Day").
4. **Loading States:**
   - Skeleton pulse animations maintaining exact component dimensions to eliminate layout shifts.
