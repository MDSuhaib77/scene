/**
 * SceneOS — Authoritative Six-Module Navigation Hierarchy
 *
 * Strictly enforces the consolidated six primary modules:
 *   1. Overview
 *   2. Screenplay
 *   3. Breakdown
 *   4. Visualise
 *   5. Production
 *   6. Vault
 */

import React from 'react';
import {
  Terminal,
  FileText,
  Scissors,
  Eye,
  Calendar as CalendarIcon,
  Database,
  Sparkles,
  Camera,
  Layers,
  Users,
  Clapperboard,
  BookOpen,
} from 'lucide-react';

export interface SidebarSubmodule {
  id: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string | number;
  badgeColor?: string;
  submoduleId?: string;
}

export interface SidebarModule {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string | number;
  badgeColor?: string;
  legacyAliases?: string[];
  submodules: SidebarSubmodule[];
}

export const SCENEOS_MODULE_HIERARCHY: SidebarModule[] = [
  // 1. Overview
  {
    id: 'overview',
    name: 'Overview',
    icon: Terminal,
    description: 'Central production status, readiness gauges, and activity insights',
    legacyAliases: ['console', 'telemetry', 'intelligence', 'collaboration'],
    submodules: [],
  },

  // 2. Screenplay
  {
    id: 'screenplay',
    name: 'Screenplay',
    icon: FileText,
    description: 'Screenplay library, version management, and AV script formatting',
    legacyAliases: ['script'],
    submodules: [
      {
        id: 'screenplay-library',
        name: 'Library',
        icon: BookOpen,
        description: 'Canonical script writing, library versions, and document imports',
        submoduleId: 'library',
      },
      {
        id: 'screenplay-av',
        name: 'AV Script',
        icon: Layers,
        description: 'Two-column audio/visual script format',
        submoduleId: 'av-script',
      },
    ],
  },

  // 3. Breakdown
  {
    id: 'breakdown',
    name: 'Breakdown',
    icon: Scissors,
    description: 'Character & script analysis, element catalog, reports, stripboard, and sides',
    submodules: [
      {
        id: 'breakdown-character-analysis',
        name: 'Character & Script Analysis',
        description: 'Character interaction graph and screenplay block distribution',
        submoduleId: 'matrix',
      },
      {
        id: 'breakdown-elements',
        name: 'Element Catalog',
        description: 'Authoritative production elements tagged across scenes',
        submoduleId: 'elements',
      },
      {
        id: 'breakdown-reports',
        name: 'Reports',
        description: 'Breakdown summary, departmental sheets, and shooting schedule exports',
        submoduleId: 'reports',
      },
      {
        id: 'breakdown-stripboard',
        name: 'Stripboard',
        description: 'Scene strip ordering and day breaks',
        submoduleId: 'stripboards',
      },
      {
        id: 'breakdown-sides',
        name: 'Sides',
        description: 'Printable scene and character shooting sides',
        submoduleId: 'sides',
      },
    ],
  },

  // 4. Visualise
  {
    id: 'visualize',
    name: 'Visualise',
    icon: Eye,
    description: 'Storyboards, shots & camera setups, and unified visual boards',
    submodules: [
      {
        id: 'visualize-storyboards',
        name: 'Storyboards',
        icon: Layers,
        description: 'Ordered scene storyboard panels and keyframes',
        submoduleId: 'storyboards',
      },
      {
        id: 'visualize-shot-lists',
        name: 'Shots',
        icon: Camera,
        description: 'Shot lists, lens coverage specs, and reusable camera setups',
        submoduleId: 'shot-lists',
      },
      {
        id: 'visualize-boards',
        name: 'Boards',
        icon: Sparkles,
        description: 'Unified freeform visual composition boards uniting mood boards and lookbooks',
        submoduleId: 'boards',
      },
    ],
  },

  // 5. Production
  {
    id: 'production',
    name: 'Production',
    icon: CalendarIcon,
    description: 'Production calendar, tasks, shoot days, call sheets, and directory',
    legacyAliases: [
      'calendar',
      'schedule',
      'phases',
      'plan',
      'master-calendar',
      'tasks',
      'crew',
      'people',
      'shoot',
      'directory',
    ],
    submodules: [
      {
        id: 'production-calendar',
        name: 'Calendar',
        icon: CalendarIcon,
        description: 'Calendar events, tasks, milestones, and production phases',
        submoduleId: 'calendar',
      },
      {
        id: 'production-shoot',
        name: 'Shoot',
        icon: Clapperboard,
        description: 'Shooting-day records, call sheets, and daily production reports',
        submoduleId: 'shoot',
      },
      {
        id: 'production-directory',
        name: 'Directory',
        icon: Users,
        description: 'Cast, crew, contacts, vendors, and location records',
        submoduleId: 'directory',
      },
    ],
  },

  // 6. Vault
  {
    id: 'vault',
    name: 'Vault',
    icon: Database,
    description: 'Central media workspace across Images, Audio, and Video',
    legacyAliases: ['assets'],
    submodules: [],
  },
];

export function findModuleByTabId(tabId: string): SidebarModule | undefined {
  return SCENEOS_MODULE_HIERARCHY.find(
    (m) => m.id === tabId || (m.legacyAliases && m.legacyAliases.includes(tabId))
  );
}

export interface WorkspaceNavItem {
  id: string;
  legacyId: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string | number;
  badgeColor?: string;
}

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = SCENEOS_MODULE_HIERARCHY.map(
  (m) => ({
    id: m.id,
    legacyId: m.legacyAliases?.[0] || m.id,
    name: m.name,
    icon: m.icon,
    description: m.description,
    badge: m.badge,
    badgeColor: m.badgeColor,
  })
);
