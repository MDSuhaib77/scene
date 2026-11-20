/**
 * SceneOS — Production Breakdown & Element Master Catalog Types (Prompt 06)
 * Authoritative models for project-level elements, scene associations, and production taxonomy.
 */

export type ProductionElementCategory =
  | 'cast'
  | 'background'
  | 'extras'
  | 'location'
  | 'prop'
  | 'set_dressing'
  | 'wardrobe'
  | 'hair_makeup'
  | 'sfx'
  | 'vfx'
  | 'vehicle'
  | 'animal'
  | 'stunt'
  | 'sound'
  | 'special_equipment'
  | 'other';

export interface CategoryTaxonomyItem {
  id: ProductionElementCategory;
  name: string;
  shortLabel: string;
  label: string; // Human readable category label for components & tests
  description: string;
  colorClass: string; // Tailwind text/bg classes
  badgeClass: string;
  iconName: string;
}

export const PRODUCTION_ELEMENT_TAXONOMY: Record<ProductionElementCategory, CategoryTaxonomyItem> = {
  cast: {
    id: 'cast',
    name: 'Cast / Characters',
    shortLabel: 'Cast',
    label: 'Cast',
    description: 'Principal speaking and featured characters',
    colorClass: 'text-purple-400',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    iconName: 'Users',
  },
  background: {
    id: 'background',
    name: 'Background Actors',
    shortLabel: 'Background',
    label: 'Background',
    description: 'Atmosphere, crowd, and background actors',
    colorClass: 'text-violet-400',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    iconName: 'UserCheck',
  },
  extras: {
    id: 'extras',
    name: 'Extras / Stand-ins',
    shortLabel: 'Extras',
    label: 'Extras',
    description: 'Non-speaking background and precision stand-ins',
    colorClass: 'text-indigo-400',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    iconName: 'UserPlus',
  },
  location: {
    id: 'location',
    name: 'Location / Setting',
    shortLabel: 'Location',
    label: 'Location',
    description: 'Physical shooting locations, stages, and practical venues',
    colorClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    iconName: 'MapPin',
  },
  prop: {
    id: 'prop',
    name: 'Props / Hand Props',
    shortLabel: 'Props',
    label: 'Props',
    description: 'Interactive hand props, hero props, and weapons',
    colorClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    iconName: 'Box',
  },
  set_dressing: {
    id: 'set_dressing',
    name: 'Set Dressing / Greens',
    shortLabel: 'Set Dressing',
    label: 'Set Dressing',
    description: 'Furniture, practical lighting, foliage, non-interactive dressing',
    colorClass: 'text-lime-400',
    badgeClass: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    iconName: 'Armchair',
  },
  wardrobe: {
    id: 'wardrobe',
    name: 'Wardrobe / Costumes',
    shortLabel: 'Wardrobe',
    label: 'Wardrobe',
    description: 'Costumes, period garments, special uniforms, footwear',
    colorClass: 'text-pink-400',
    badgeClass: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    iconName: 'Shirt',
  },
  hair_makeup: {
    id: 'hair_makeup',
    name: 'Hair / Makeup',
    shortLabel: 'Hair & Makeup',
    label: 'Hair & Makeup',
    description: 'Prosthetics, wounds, beauty, character aging, wigs',
    colorClass: 'text-rose-400',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    iconName: 'Sparkles',
  },
  sfx: {
    id: 'sfx',
    name: 'Special Effects (SFX)',
    shortLabel: 'SFX',
    label: 'Special Effects',
    description: 'Practical pyrotechnics, atmospheric smoke, rain, squibs, rigs',
    colorClass: 'text-orange-400',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    iconName: 'Flame',
  },
  vfx: {
    id: 'vfx',
    name: 'Visual Effects (VFX)',
    shortLabel: 'VFX',
    label: 'Visual Effects',
    description: 'Greenscreen, CGI set extensions, digital doubles, plate shots',
    colorClass: 'text-cyan-400',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    iconName: 'Wand2',
  },
  vehicle: {
    id: 'vehicle',
    name: 'Vehicles / Picture Cars',
    shortLabel: 'Vehicles',
    label: 'Vehicles',
    description: 'Picture cars, aircraft, boats, background traffic',
    colorClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    iconName: 'Car',
  },
  animal: {
    id: 'animal',
    name: 'Animals / Handlers',
    shortLabel: 'Animals',
    label: 'Animals',
    description: 'Live animals, wranglers, trainers, veterinary oversight',
    colorClass: 'text-yellow-400',
    badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    iconName: 'Dog',
  },
  stunt: {
    id: 'stunt',
    name: 'Stunts / Coordinators',
    shortLabel: 'Stunts',
    label: 'Stunts',
    description: 'Combat choreography, wirework, high falls, precision driving',
    colorClass: 'text-red-400',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
    iconName: 'ShieldAlert',
  },
  sound: {
    id: 'sound',
    name: 'Sound / Music',
    shortLabel: 'Sound',
    label: 'Sound',
    description: 'Playback tracks, on-set recording, practical music sources',
    colorClass: 'text-teal-400',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    iconName: 'Volume2',
  },
  special_equipment: {
    id: 'special_equipment',
    name: 'Special Equipment',
    shortLabel: 'Equipment',
    label: 'Special Equipment',
    description: 'Cranes, technocranes, underwater housings, drones, rigs',
    colorClass: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    iconName: 'Camera',
  },
  other: {
    id: 'other',
    name: 'Other Requirements',
    shortLabel: 'Other',
    label: 'Other',
    description: 'Miscellaneous departmental needs and special production items',
    colorClass: 'text-zinc-400',
    badgeClass: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    iconName: 'Tag',
  },
};

/**
 * Normalizes any category string (including legacy ones & common synonyms) to a canonical ProductionElementCategory
 */
export function normalizeElementCategory(raw: string | undefined | null): ProductionElementCategory {
  if (!raw) return 'other';
  const lower = raw.trim().toLowerCase();
  if (lower in PRODUCTION_ELEMENT_TAXONOMY) {
    return lower as ProductionElementCategory;
  }
  // Plurals and common film terminology synonyms
  if (lower === 'props' || lower === 'prop') return 'prop';
  if (lower === 'characters' || lower === 'character' || lower === 'actor' || lower === 'actors' || lower === 'cast') return 'cast';
  if (lower === 'locations' || lower === 'location' || lower === 'setting' || lower === 'settings') return 'location';
  if (lower === 'cars' || lower === 'car' || lower === 'automobile' || lower === 'vehicles' || lower === 'vehicle') return 'vehicle';
  if (lower === 'costume' || lower === 'costumes' || lower === 'wardrobe') return 'wardrobe';
  if (lower === 'pyro' || lower === 'pyrotechnics' || lower === 'sfx' || lower === 'special effects' || lower === 'practical effects') return 'sfx';
  if (lower === 'cgi' || lower === 'visual effects' || lower === 'vfx') return 'vfx';
  if (lower === 'makeup' || lower === 'hair' || lower === 'hair_makeup' || lower === 'hmu' || lower === 'hair & makeup') return 'hair_makeup';
  if (lower === 'horses' || lower === 'horse' || lower === 'animals' || lower === 'animal') return 'animal';
  if (lower === 'stunts' || lower === 'stunt') return 'stunt';
  if (lower === 'sound' || lower === 'music' || lower === 'audio') return 'sound';
  if (lower === 'equipment' || lower === 'special_equipment' || lower === 'camera' || lower === 'gear') return 'special_equipment';
  if (lower === 'set' || lower === 'dressing' || lower === 'set dressing' || lower === 'greens') return 'set_dressing';
  if (lower === 'extras' || lower === 'extra' || lower === 'standin' || lower === 'stand-in') return 'extras';
  if (lower === 'background' || lower === 'atmosphere' || lower === 'crowd') return 'background';
  return 'other';
}

/**
 * Element Master Catalog record (project-level registry)
 */
export interface MasterElement {
  id: string; // Stable UUID/identifier e.g. "elem-123456"
  projectId: string; // Project scoping
  name: string; // Display name e.g. "Silver Monorail Pass", "Mara Vance"
  category: ProductionElementCategory;
  description?: string; // Creative/physical description
  productionNotes?: string; // Departmental/procurement notes
  attachments?: string[]; // Optional URLs or reference attachment IDs
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  createdBy?: string;
  isArchived?: boolean; // Reversible archival flag
  archivedAt?: string;
}

export type BreakdownRequirementStatus = 'needed' | 'acquired' | 'confirmed' | 'omitted';
export type BreakdownProvenance = 'extracted' | 'manual' | 'ai_suggested';
export type BreakdownAssociationReviewState = 'unreviewed' | 'reviewed';

/**
 * Scene-to-Element Association model
 * Multiple scenes can associate with the same MasterElement without duplicating catalog identity.
 */
export interface SceneElementAssociation {
  id: string; // Stable UUID e.g. "assoc-123456"
  projectId: string;
  sceneId: string; // Links to ParsedScene.id (authoritative script intelligence scene)
  elementId: string; // Links to MasterElement.id in the project catalog
  quantity?: number | string; // Scene-specific quantity (e.g. 2, "3 boxes")
  notes?: string; // Scene-specific staging / handling instructions
  status: BreakdownRequirementStatus; // Operational status for this scene
  provenance: BreakdownProvenance; // How this requirement was added
  reviewState: BreakdownAssociationReviewState; // Line Producer / AD review status
  createdAt: string;
  updatedAt: string;
}

/**
 * Joined representation for Scene Breakdown UI views
 */
export interface EnrichedSceneAssociation extends SceneElementAssociation {
  element: MasterElement;
}

/**
 * Enriched MasterElement with usage across the screenplay
 */
export interface EnrichedMasterElement extends MasterElement {
  totalAppearances: number;
  associatedScenes: Array<{
    associationId: string;
    sceneId: string;
    sceneNumber: string;
    slugline: string;
    quantity?: number | string;
    notes?: string;
    status: BreakdownRequirementStatus;
    reviewState: BreakdownAssociationReviewState;
  }>;
}
