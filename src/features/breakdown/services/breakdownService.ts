/**
 * SceneOS — Production Breakdown & Element Master Catalog Service (Prompt 06)
 * Single authoritative service for managing Master Elements, Scene Associations, and Script Intelligence linking.
 */

import { FilmProject, ParsedScene, SceneElement } from '../../../types';
import {
  MasterElement,
  SceneElementAssociation,
  EnrichedSceneAssociation,
  EnrichedMasterElement,
  ProductionElementCategory,
  BreakdownRequirementStatus,
  BreakdownProvenance,
  BreakdownAssociationReviewState,
  normalizeElementCategory,
} from '../types/breakdownTypes';

/**
 * Normalizes an element's lookup key for deduplication checks
 */
export function getElementLookupKey(category: ProductionElementCategory, name: string): string {
  return `${category}::${name.trim().toLowerCase()}`;
}

/**
 * Initializes or synchronizes the project's Element Master Catalog and Scene Associations
 * with extracted Script Intelligence scenes, while preserving existing manual records.
 */
export function initializeBreakdownFromProject(
  project: FilmProject,
  scenes?: ParsedScene[]
): FilmProject {
  const activeScript = project.screenplayVersions?.find((v) => v.id === project.activeScreenplayVersionId)
    || project.screenplayVersions?.[0];
  const allScenes = (scenes && scenes.length > 0)
    ? scenes
    : (activeScript?.extractedScenes || project.scenes || []);

  const nowIso = new Date().toISOString();
  const existingCatalog = [...(project.elementCatalog || [])];
  const existingAssocs = [...(project.sceneBreakdownAssociations || [])];

  const catalogByKey = new Map<string, MasterElement>();
  existingCatalog.forEach((el) => {
    catalogByKey.set(getElementLookupKey(el.category, el.name), el);
  });

  const assocBySceneAndElem = new Set<string>();
  existingAssocs.forEach((a) => {
    assocBySceneAndElem.add(`${a.sceneId}::${a.elementId}`);
  });

  let hasChanges = false;

  // 1. Ingest legacy scene.elements if they are not yet represented
  allScenes.forEach((scene) => {
    (scene.elements || []).forEach((legacy) => {
      if (!legacy.name || !legacy.name.trim()) return;
      const cat = normalizeElementCategory(legacy.category);
      const key = getElementLookupKey(cat, legacy.name);

      let masterElem = catalogByKey.get(key);
      if (!masterElem) {
        masterElem = {
          id: `elem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          projectId: project.id,
          name: legacy.name.trim(),
          category: cat,
          productionNotes: legacy.notes,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: project.writer || project.director || 'Screenplay Breakdown',
        };
        existingCatalog.push(masterElem);
        catalogByKey.set(key, masterElem);
        hasChanges = true;
      }

      const assocKey = `${scene.id}::${masterElem.id}`;
      if (!assocBySceneAndElem.has(assocKey)) {
        existingAssocs.push({
          id: `assoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          projectId: project.id,
          sceneId: scene.id,
          elementId: masterElem.id,
          notes: legacy.notes,
          status: 'needed',
          provenance: 'manual',
          reviewState: 'reviewed',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        assocBySceneAndElem.add(assocKey);
        hasChanges = true;
      }
    });
  });

  // 2. Link extracted Characters & Locations from Script Intelligence
  allScenes.forEach((scene) => {
    // Characters -> Cast
    (scene.characters || []).forEach((charName) => {
      const trimmed = charName.trim();
      if (!trimmed) return;
      const key = getElementLookupKey('cast', trimmed);

      let masterElem = catalogByKey.get(key);
      if (!masterElem) {
        masterElem = {
          id: `elem-cast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          projectId: project.id,
          name: trimmed,
          category: 'cast',
          description: 'Screenplay speaking role / character',
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: 'Script Intelligence',
        };
        existingCatalog.push(masterElem);
        catalogByKey.set(key, masterElem);
        hasChanges = true;
      }

      const assocKey = `${scene.id}::${masterElem.id}`;
      if (!assocBySceneAndElem.has(assocKey)) {
        existingAssocs.push({
          id: `assoc-cast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          projectId: project.id,
          sceneId: scene.id,
          elementId: masterElem.id,
          quantity: 1,
          status: 'confirmed',
          provenance: 'extracted',
          reviewState: scene.status === 'reviewed' ? 'reviewed' : 'unreviewed',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        assocBySceneAndElem.add(assocKey);
        hasChanges = true;
      }
    });

    // Scene Location -> Location Element
    if (scene.location && scene.location.trim() && scene.location !== 'UNKNOWN LOCATION') {
      const trimmedLoc = scene.location.trim();
      const key = getElementLookupKey('location', trimmedLoc);

      let masterElem = catalogByKey.get(key);
      if (!masterElem) {
        masterElem = {
          id: `elem-loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          projectId: project.id,
          name: trimmedLoc,
          category: 'location',
          description: `${scene.intExt || 'INT/EXT'} physical shooting setting`,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: 'Script Intelligence',
        };
        existingCatalog.push(masterElem);
        catalogByKey.set(key, masterElem);
        hasChanges = true;
      }

      const assocKey = `${scene.id}::${masterElem.id}`;
      if (!assocBySceneAndElem.has(assocKey)) {
        existingAssocs.push({
          id: `assoc-loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          projectId: project.id,
          sceneId: scene.id,
          elementId: masterElem.id,
          notes: `${scene.intExt} • ${scene.timeOfDay}`,
          status: 'confirmed',
          provenance: 'extracted',
          reviewState: scene.status === 'reviewed' ? 'reviewed' : 'unreviewed',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        assocBySceneAndElem.add(assocKey);
        hasChanges = true;
      }
    }
  });

  if (!hasChanges && project.elementCatalog && project.sceneBreakdownAssociations) {
    return project;
  }

  // Synchronize legacy scene.elements for backward compatibility
  const updatedScenes = syncLegacySceneElements(allScenes, existingAssocs, existingCatalog);

  const updatedVersions = (project.screenplayVersions || []).map((ver, idx) => {
    if (idx === (project.screenplayVersions?.length || 1) - 1 || idx === 0) {
      return { ...ver, scenes: updatedScenes };
    }
    return ver;
  });

  return {
    ...project,
    elementCatalog: existingCatalog,
    sceneBreakdownAssociations: existingAssocs,
    screenplayVersions: updatedVersions.length > 0 ? updatedVersions : project.screenplayVersions,
  };
}

/**
 * Creates a new Master Element in the project catalog
 */
export function createMasterElement(
  project: FilmProject,
  data: {
    name: string;
    category: ProductionElementCategory;
    description?: string;
    productionNotes?: string;
    attachments?: string[];
    createdBy?: string;
  }
): { updatedProject: FilmProject; element: MasterElement } {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error('Element name cannot be empty.');
  }

  const nowIso = new Date().toISOString();
  const existingCatalog = [...(project.elementCatalog || [])];

  const newElement: MasterElement = {
    id: `elem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId: project.id,
    name: trimmedName,
    category: data.category,
    description: data.description?.trim() || undefined,
    productionNotes: data.productionNotes?.trim() || undefined,
    attachments: data.attachments || [],
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: data.createdBy || project.writer || project.director || 'Breakdown User',
    isArchived: false,
  };

  const updatedCatalog = [...existingCatalog, newElement];

  return {
    updatedProject: {
      ...project,
      elementCatalog: updatedCatalog,
      updatedAt: nowIso,
    },
    element: newElement,
  };
}

/**
 * Updates a Master Element's project-wide catalog details
 */
export function updateMasterElement(
  project: FilmProject,
  elementId: string,
  updates: Partial<Pick<MasterElement, 'name' | 'category' | 'description' | 'productionNotes' | 'attachments'>>
): FilmProject {
  const nowIso = new Date().toISOString();
  const existingCatalog = [...(project.elementCatalog || [])];

  const updatedCatalog = existingCatalog.map((el) => {
    if (el.id !== elementId) return el;
    return {
      ...el,
      name: updates.name !== undefined ? updates.name.trim() : el.name,
      category: updates.category !== undefined ? updates.category : el.category,
      description: updates.description !== undefined ? updates.description.trim() || undefined : el.description,
      productionNotes: updates.productionNotes !== undefined ? updates.productionNotes.trim() || undefined : el.productionNotes,
      attachments: updates.attachments !== undefined ? updates.attachments : el.attachments,
      updatedAt: nowIso,
    };
  });

  return {
    ...project,
    elementCatalog: updatedCatalog,
    updatedAt: nowIso,
  };
}

/**
 * Archives or restores a Master Element without destroying scene associations
 */
export function archiveMasterElement(
  project: FilmProject,
  elementId: string,
  archive = true
): FilmProject {
  const nowIso = new Date().toISOString();
  const existingCatalog = [...(project.elementCatalog || [])];

  const updatedCatalog = existingCatalog.map((el) => {
    if (el.id !== elementId) return el;
    return {
      ...el,
      isArchived: archive,
      archivedAt: archive ? nowIso : undefined,
      updatedAt: nowIso,
    };
  });

  return {
    ...project,
    elementCatalog: updatedCatalog,
    updatedAt: nowIso,
  };
}

/**
 * Deletes a Master Element from the catalog and removes all of its scene associations
 */
export function deleteMasterElement(
  project: FilmProject,
  elementId: string,
  scenes?: ParsedScene[]
): FilmProject {
  const nowIso = new Date().toISOString();
  const existingCatalog = (project.elementCatalog || []).filter((el) => el.id !== elementId);
  const remainingAssocs = (project.sceneBreakdownAssociations || []).filter((a) => a.elementId !== elementId);

  let updatedVersions = project.screenplayVersions;
  if (scenes && scenes.length > 0) {
    const updatedScenes = syncLegacySceneElements(scenes, remainingAssocs, existingCatalog);
    updatedVersions = (project.screenplayVersions || []).map((ver, idx) => {
      if (idx === (project.screenplayVersions?.length || 1) - 1 || idx === 0) {
        return { ...ver, scenes: updatedScenes };
      }
      return ver;
    });
  }

  return {
    ...project,
    elementCatalog: existingCatalog,
    sceneBreakdownAssociations: remainingAssocs,
    screenplayVersions: updatedVersions,
    updatedAt: nowIso,
  };
}

/**
 * Associates an existing Master Element with a specific scene
 */
export function associateElementWithScene(
  project: FilmProject,
  params: {
    sceneId: string;
    elementId: string;
    quantity?: number | string;
    notes?: string;
    status?: BreakdownRequirementStatus;
    provenance?: BreakdownProvenance;
    reviewState?: BreakdownAssociationReviewState;
  },
  scenes?: ParsedScene[]
): { updatedProject: FilmProject; association: SceneElementAssociation } {
  const nowIso = new Date().toISOString();
  const existingAssocs = [...(project.sceneBreakdownAssociations || [])];

  // Verify element exists in catalog
  const elem = (project.elementCatalog || []).find((e) => e.id === params.elementId);
  if (!elem) {
    throw new Error(`Master element with ID "${params.elementId}" not found in project catalog.`);
  }

  // Check if association already exists
  const existingIdx = existingAssocs.findIndex(
    (a) => a.sceneId === params.sceneId && a.elementId === params.elementId
  );

  let association: SceneElementAssociation;

  if (existingIdx >= 0) {
    // Update existing association
    association = {
      ...existingAssocs[existingIdx],
      quantity: params.quantity !== undefined ? params.quantity : existingAssocs[existingIdx].quantity,
      notes: params.notes !== undefined ? params.notes : existingAssocs[existingIdx].notes,
      status: params.status !== undefined ? params.status : existingAssocs[existingIdx].status,
      reviewState: params.reviewState !== undefined ? params.reviewState : existingAssocs[existingIdx].reviewState,
      updatedAt: nowIso,
    };
    existingAssocs[existingIdx] = association;
  } else {
    // Create new association
    association = {
      id: `assoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      projectId: project.id,
      sceneId: params.sceneId,
      elementId: params.elementId,
      quantity: params.quantity ?? 1,
      notes: params.notes?.trim() || undefined,
      status: params.status || 'needed',
      provenance: params.provenance || 'manual',
      reviewState: params.reviewState || 'unreviewed',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    existingAssocs.push(association);
  }

  // Synchronize legacy scene.elements for backward compatibility
  let updatedVersions = project.screenplayVersions;
  if (scenes && scenes.length > 0) {
    const updatedScenes = syncLegacySceneElements(scenes, existingAssocs, project.elementCatalog || []);
    updatedVersions = (project.screenplayVersions || []).map((ver, idx) => {
      if (idx === (project.screenplayVersions?.length || 1) - 1 || idx === 0) {
        return { ...ver, scenes: updatedScenes };
      }
      return ver;
    });
  }

  return {
    updatedProject: {
      ...project,
      sceneBreakdownAssociations: existingAssocs,
      screenplayVersions: updatedVersions,
      updatedAt: nowIso,
    },
    association,
  };
}

/**
 * Removes an association from a scene without deleting the Master Element from the catalog
 */
export function removeElementAssociation(
  project: FilmProject,
  associationId: string,
  scenes?: ParsedScene[]
): FilmProject {
  const nowIso = new Date().toISOString();
  const existingAssocs = (project.sceneBreakdownAssociations || []).filter((a) => a.id !== associationId);

  let updatedVersions = project.screenplayVersions;
  if (scenes && scenes.length > 0) {
    const updatedScenes = syncLegacySceneElements(scenes, existingAssocs, project.elementCatalog || []);
    updatedVersions = (project.screenplayVersions || []).map((ver, idx) => {
      if (idx === (project.screenplayVersions?.length || 1) - 1 || idx === 0) {
        return { ...ver, scenes: updatedScenes };
      }
      return ver;
    });
  }

  return {
    ...project,
    sceneBreakdownAssociations: existingAssocs,
    screenplayVersions: updatedVersions,
    updatedAt: nowIso,
  };
}

/**
 * Updates scene-specific association attributes (quantity, notes, status, reviewState)
 */
export function updateElementAssociation(
  project: FilmProject,
  associationId: string,
  updates: Partial<Pick<SceneElementAssociation, 'quantity' | 'notes' | 'status' | 'reviewState'>>,
  scenes?: ParsedScene[]
): FilmProject {
  const nowIso = new Date().toISOString();
  const existingAssocs = (project.sceneBreakdownAssociations || []).map((a) => {
    if (a.id !== associationId) return a;
    return {
      ...a,
      quantity: updates.quantity !== undefined ? updates.quantity : a.quantity,
      notes: updates.notes !== undefined ? updates.notes?.trim() || undefined : a.notes,
      status: updates.status !== undefined ? updates.status : a.status,
      reviewState: updates.reviewState !== undefined ? updates.reviewState : a.reviewState,
      updatedAt: nowIso,
    };
  });

  let updatedVersions = project.screenplayVersions;
  if (scenes && scenes.length > 0) {
    const updatedScenes = syncLegacySceneElements(scenes, existingAssocs, project.elementCatalog || []);
    updatedVersions = (project.screenplayVersions || []).map((ver, idx) => {
      if (idx === (project.screenplayVersions?.length || 1) - 1 || idx === 0) {
        return { ...ver, scenes: updatedScenes };
      }
      return ver;
    });
  }

  return {
    ...project,
    sceneBreakdownAssociations: existingAssocs,
    screenplayVersions: updatedVersions,
    updatedAt: nowIso,
  };
}

/**
 * Creates a new Master Element and links it to a scene in a single transaction
 */
export function createAndAssociateElement(
  project: FilmProject,
  sceneId: string,
  elementData: {
    name: string;
    category: ProductionElementCategory;
    description?: string;
    productionNotes?: string;
  },
  associationData?: {
    quantity?: number | string;
    notes?: string;
    status?: BreakdownRequirementStatus;
  },
  scenes?: ParsedScene[]
): { updatedProject: FilmProject; element: MasterElement; association: SceneElementAssociation } {
  // Check if an existing catalog item with identical category and name exists
  const existingKey = getElementLookupKey(elementData.category, elementData.name);
  let matchedElem = (project.elementCatalog || []).find(
    (e) => getElementLookupKey(e.category, e.name) === existingKey
  );

  let currentProject = project;

  if (!matchedElem) {
    const created = createMasterElement(currentProject, elementData);
    currentProject = created.updatedProject;
    matchedElem = created.element;
  }

  const associated = associateElementWithScene(
    currentProject,
    {
      sceneId,
      elementId: matchedElem.id,
      quantity: associationData?.quantity ?? 1,
      notes: associationData?.notes,
      status: associationData?.status || 'needed',
      provenance: 'manual',
      reviewState: 'unreviewed',
    },
    scenes
  );

  return {
    updatedProject: associated.updatedProject,
    element: matchedElem,
    association: associated.association,
  };
}

/**
 * Reconciles breakdown associations against updated scenes after screenplay edits.
 * Associations tied to stable scene IDs are preserved cleanly.
 */
export function reconcileBreakdownWithScript(
  project: FilmProject,
  updatedScenes: ParsedScene[]
): {
  reconciledProject: FilmProject;
  activeCount: number;
  orphanedCount: number;
} {
  const sceneIds = new Set(updatedScenes.map((s) => s.id));
  const assocs = project.sceneBreakdownAssociations || [];

  let activeCount = 0;
  let orphanedCount = 0;

  assocs.forEach((a) => {
    if (sceneIds.has(a.sceneId)) {
      activeCount++;
    } else {
      orphanedCount++;
    }
  });

  const initialized = initializeBreakdownFromProject(project, updatedScenes);
  return {
    reconciledProject: initialized,
    activeCount,
    orphanedCount,
  };
}

/**
 * Joins SceneElementAssociations with MasterElements for a specific scene
 */
export function getEnrichedSceneAssociations(
  associations: SceneElementAssociation[],
  catalog: MasterElement[],
  sceneId: string
): EnrichedSceneAssociation[] {
  const catalogMap = new Map<string, MasterElement>(catalog.map((e) => [e.id, e]));

  return associations
    .filter((a) => a.sceneId === sceneId)
    .map((a) => {
      const el = catalogMap.get(a.elementId) || {
        id: a.elementId,
        projectId: a.projectId,
        name: 'Unknown Element',
        category: 'other',
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
      return {
        ...a,
        element: el,
      };
    })
    .sort((a, b) => {
      if (a.element.category !== b.element.category) {
        return a.element.category.localeCompare(b.element.category);
      }
      return a.element.name.localeCompare(b.element.name);
    });
}

/**
 * Enriches all MasterElements with usage statistics and lists of associated scenes
 */
export function getEnrichedCatalog(
  catalog: MasterElement[],
  associations: SceneElementAssociation[],
  scenes: ParsedScene[]
): EnrichedMasterElement[] {
  const sceneMap = new Map<string, ParsedScene>(scenes.map((s) => [s.id, s]));

  return catalog.map((el) => {
    const elementAssocs = associations.filter((a) => a.elementId === el.id);

    const associatedScenes = elementAssocs.map((a) => {
      const sc = sceneMap.get(a.sceneId);
      return {
        associationId: a.id,
        sceneId: a.sceneId,
        sceneNumber: sc?.sceneNumber || '?',
        slugline: sc?.slugline || sc?.originalHeading || 'Unknown Scene',
        quantity: a.quantity,
        notes: a.notes,
        status: a.status,
        reviewState: a.reviewState,
      };
    }).sort((a, b) => {
      const numA = parseInt(a.sceneNumber, 10) || 0;
      const numB = parseInt(b.sceneNumber, 10) || 0;
      return numA - numB || a.sceneNumber.localeCompare(b.sceneNumber);
    });

    return {
      ...el,
      totalAppearances: associatedScenes.length,
      associatedScenes,
    };
  }).sort((a, b) => {
    // Sort by active vs archived, then most used, then alphabetical
    if (a.isArchived !== b.isArchived) {
      return a.isArchived ? 1 : -1;
    }
    if (b.totalAppearances !== a.totalAppearances) {
      return b.totalAppearances - a.totalAppearances;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Projects relational associations into legacy SceneElement[] for backward compatibility
 */
function syncLegacySceneElements(
  scenes: ParsedScene[],
  associations: SceneElementAssociation[],
  catalog: MasterElement[]
): ParsedScene[] {
  const catalogMap = new Map<string, MasterElement>(catalog.map((e) => [e.id, e]));
  const assocsByScene = new Map<string, SceneElementAssociation[]>();

  associations.forEach((a) => {
    const list = assocsByScene.get(a.sceneId) || [];
    list.push(a);
    assocsByScene.set(a.sceneId, list);
  });

  return scenes.map((scene) => {
    const sceneAssocs = assocsByScene.get(scene.id) || [];
    const elements: SceneElement[] = sceneAssocs.map((a) => {
      const elem = catalogMap.get(a.elementId);
      // Map category to legacy type
      let legacyCat: SceneElement['category'] = 'prop';
      if (elem?.category === 'cast') legacyCat = 'character';
      else if (elem?.category === 'wardrobe') legacyCat = 'wardrobe';
      else if (elem?.category === 'vehicle') legacyCat = 'vehicle';
      else if (elem?.category === 'stunt') legacyCat = 'stunt';
      else if (elem?.category === 'vfx') legacyCat = 'vfx';
      else if (elem?.category === 'sfx') legacyCat = 'sfx';
      else if (elem?.category === 'animal') legacyCat = 'animal';
      else if (elem?.category === 'sound') legacyCat = 'sound';

      return {
        id: a.id,
        category: legacyCat,
        name: elem?.name || 'Item',
        notes: a.notes,
      };
    });

    return {
      ...scene,
      elements,
    };
  });
}

export interface PotentialDuplicateGroup {
  normalizedKey: string;
  elements: MasterElement[];
  reason: 'identical_name' | 'similar_name' | 'cross_category';
}

/**
 * Detects potential duplicate elements across the master catalog
 */
export function findDuplicateElements(catalog: MasterElement[]): PotentialDuplicateGroup[] {
  const active = (catalog || []).filter((e) => !e.isArchived);
  const byNormalized = new Map<string, MasterElement[]>();

  active.forEach((elem) => {
    const norm = (elem.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!norm) return;
    const list = byNormalized.get(norm) || [];
    list.push(elem);
    byNormalized.set(norm, list);
  });

  const duplicates: PotentialDuplicateGroup[] = [];

  byNormalized.forEach((elements, key) => {
    if (elements.length > 1) {
      const sameCategory = elements.every((e) => e.category === elements[0].category);
      duplicates.push({
        normalizedKey: key,
        elements,
        reason: sameCategory ? 'identical_name' : 'cross_category',
      });
    }
  });

  return duplicates;
}

/**
 * Safely merges a duplicate element into a primary element:
 * Re-points all scene associations to the primary element, combines notes,
 * and removes the duplicate element record without losing scene requirements.
 */
export function mergeMasterElements(
  project: FilmProject,
  primaryElementId: string,
  duplicateElementId: string,
  scenes?: ParsedScene[]
): FilmProject {
  const catalog = [...(project.elementCatalog || [])];
  const primaryElem = catalog.find((e) => e.id === primaryElementId);
  const dupElem = catalog.find((e) => e.id === duplicateElementId);

  if (!primaryElem || !dupElem) return project;

  const nowIso = new Date().toISOString();

  // Combine descriptions and production notes
  const updatedPrimary: MasterElement = {
    ...primaryElem,
    description: primaryElem.description || dupElem.description,
    productionNotes: primaryElem.productionNotes
      ? dupElem.productionNotes && !primaryElem.productionNotes.includes(dupElem.productionNotes)
        ? `${primaryElem.productionNotes}\nMerged: ${dupElem.productionNotes}`
        : primaryElem.productionNotes
      : dupElem.productionNotes,
    updatedAt: nowIso,
  };

  // Re-link scene breakdown associations
  const rawAssocs = project.sceneBreakdownAssociations || [];
  const primarySceneIds = new Set(
    rawAssocs.filter((a) => a.elementId === primaryElementId).map((a) => a.sceneId)
  );

  const updatedAssocs: SceneElementAssociation[] = [];
  rawAssocs.forEach((a) => {
    if (a.elementId === duplicateElementId) {
      if (primarySceneIds.has(a.sceneId)) {
        // Scene already has primary element assigned
        return;
      }
      updatedAssocs.push({
        ...a,
        elementId: primaryElementId,
        notes: a.notes ? `[Merged from ${dupElem.name}] ${a.notes}` : undefined,
        updatedAt: nowIso,
      });
    } else {
      updatedAssocs.push(a);
    }
  });

  // Remove duplicate from catalog and update primary
  const updatedCatalog = catalog
    .filter((e) => e.id !== duplicateElementId)
    .map((e) => (e.id === primaryElementId ? updatedPrimary : e));

  const allScenes = (scenes && scenes.length > 0) ? scenes : (project.scenes || []);
  const syncedScenes = syncLegacySceneElements(allScenes, updatedAssocs, updatedCatalog);

  return {
    ...project,
    elementCatalog: updatedCatalog,
    sceneBreakdownAssociations: updatedAssocs,
    scenes: syncedScenes,
    updatedAt: nowIso,
  };
}

export interface ExtractedSceneRequirement {
  id: string;
  name: string;
  category: ProductionElementCategory;
  evidenceType: 'explicit' | 'inferred';
  evidencePassage: string;
  confidence: 'high' | 'medium';
  notes?: string;
}

/**
 * Multi-category extraction service:
 * Analyzes screenplay prose, action lines, and dialogue blocks for an individual scene
 * to detect production requirements across props, vehicles, wardrobe, stunts, SFX, sound, etc.
 * Provides original screenplay passage as grounded evidence.
 */
export function extractMultiCategorySceneRequirements(
  scene: ParsedScene,
  catalog?: MasterElement[],
  existingAssocs?: SceneElementAssociation[]
): ExtractedSceneRequirement[] {
  const existingElementIds = new Set(
    (existingAssocs || [])
      .filter((a) => a.sceneId === scene.id)
      .map((a) => a.elementId)
  );
  const existingNames = new Set(
    (catalog || [])
      .filter((el) => existingElementIds.has(el.id))
      .map((el) => el.name.toLowerCase().trim())
  );

  const results: ExtractedSceneRequirement[] = [];
  const addedKeys = new Set<string>();

  const addReq = (
    name: string,
    category: ProductionElementCategory,
    evidenceType: 'explicit' | 'inferred',
    passage: string,
    confidence: 'high' | 'medium',
    notes?: string
  ) => {
    const key = `${category}::${name.toLowerCase().trim()}`;
    if (addedKeys.has(key) || existingNames.has(name.toLowerCase().trim())) return;
    addedKeys.add(key);
    results.push({
      id: `req-ext-${scene.id}-${results.length + 1}`,
      name,
      category,
      evidenceType,
      evidencePassage: passage.trim(),
      confidence,
      notes,
    });
  };

  // Compile all prose passages from scene action and dialogues
  const passages: string[] = [];
  if (scene.actionSnippet) passages.push(scene.actionSnippet);
  if (scene.summary) passages.push(scene.summary);
  if (scene.scriptSnippet) passages.push(scene.scriptSnippet);
  if ((scene as any).actionText) passages.push((scene as any).actionText);
  (scene.dialogueBlocks || []).forEach((d) => {
    if (d.text) passages.push(`${d.character}: "${d.text}"`);
  });

  // Also split by periods/newlines into sentences for tight evidence
  const allSentences: string[] = [];
  passages.forEach((p) => {
    p.split(/(?<=[.!?])\s+|\n+/).forEach((s) => {
      const clean = s.trim();
      if (clean.length > 5) allSentences.push(clean);
    });
  });

  // Dictionary patterns for multi-category extraction
  const patterns: Array<{
    category: ProductionElementCategory;
    name: string;
    regex: RegExp;
    isInferred?: boolean;
    inferredNote?: string;
  }> = [
    // Props
    { category: 'prop', name: 'Black Leather Ledger', regex: /\b(ledger|black leather ledger)\b/i },
    { category: 'prop', name: '.38 Snub Revolver', regex: /\b(revolver|\.38|pistol|handgun|gun)\b/i },
    { category: 'prop', name: 'Getaway Keys', regex: /\b(keys|car keys|getaway keys)\b/i },
    { category: 'prop', name: 'Desk Lamp', regex: /\b(desk lamp|table lamp|lamp)\b/i },
    { category: 'prop', name: 'Briefcase', regex: /\b(briefcase|attache case)\b/i },
    { category: 'prop', name: 'Smartphone', regex: /\b(phone|smartphone|cellphone|receiver)\b/i },
    { category: 'prop', name: 'Flashlight', regex: /\b(flashlight|torch)\b/i },
    { category: 'prop', name: 'Whiskey Glass', regex: /\b(whiskey|bourbon|glass|bottle)\b/i },
    { category: 'prop', name: 'Cigarette & Lighter', regex: /\b(cigarette|lighter|matches|smoke a)\b/i },
    { category: 'prop', name: 'Detective Badge', regex: /\b(badge|shield|police id)\b/i },
    { category: 'prop', name: 'Envelope / Document', regex: /\b(envelope|sealed letter|dossier|document)\b/i },
    { category: 'prop', name: 'Handcuffs', regex: /\b(handcuffs|cuffs)\b/i },

    // Vehicles
    { category: 'vehicle', name: '1974 Dodge Sedan', regex: /\b(dodge|1974 dodge|sedan)\b/i },
    { category: 'vehicle', name: 'Patrol Car / Cruiser', regex: /\b(police cruiser|patrol car|squad car|cop car)\b/i },
    { category: 'vehicle', name: 'Getaway Van', regex: /\b(getaway van|black van|cargo van)\b/i },
    { category: 'vehicle', name: 'Motorcycle', regex: /\b(motorcycle|chopper|bike)\b/i },
    { category: 'vehicle', name: 'Cab / Taxi', regex: /\b(taxi|yellow cab|taxi cab)\b/i },

    // Wardrobe / Costumes
    { category: 'wardrobe', name: 'Trench Coat', regex: /\b(trench coat|overcoat|raincoat)\b/i },
    { category: 'wardrobe', name: 'Fedora', regex: /\b(fedora|brimmed hat|hat)\b/i },
    { category: 'wardrobe', name: 'Leather Jacket', regex: /\b(leather jacket|jacket)\b/i },
    { category: 'wardrobe', name: 'Dark Suit & Tie', regex: /\b(suit|three-piece suit|necktie|tuxedo)\b/i },
    { category: 'wardrobe', name: 'Rain Boots / Wet Shoes', regex: /\b(boots|shoes|muddy boots)\b/i },
    { category: 'wardrobe', name: 'Police Uniform', regex: /\b(police uniform|uniform|officer dress)\b/i },

    // Stunts
    { category: 'stunt', name: 'Wet Pavement Foot Pursuit', regex: /\b(pursues on foot|flees into the|chase|runs down the alley|sprints)\b/i, isInferred: true, inferredNote: 'High speed foot pursuit requiring stunt coordination' },
    { category: 'stunt', name: 'Fist Fight / Physical Struggle', regex: /\b(punches|tackles|wrestles|struggle for the gun|brawl)\b/i, isInferred: true, inferredNote: 'Stunt double and combat choreo required' },
    { category: 'stunt', name: 'Rooftop Leap / Fall', regex: /\b(falls from|jumps across|edge of roof|dangles)\b/i, isInferred: true, inferredNote: 'Rigger safety harness and pads required' },

    // SFX
    { category: 'sfx', name: 'Gunfire & Muzzle Flash', regex: /\b(fires|shots ring out|gunshot|revolver blast|bullet)\b/i, isInferred: true, inferredNote: 'Blank ammunition & armorer supervision' },
    { category: 'sfx', name: 'Practical Rain / Wetdown', regex: /\b(rain|rainy|downpour|puddle|wet pavement)\b/i, isInferred: true, inferredNote: 'Rain towers and continuous ground wetdown' },
    { category: 'sfx', name: 'Atmospheric Fog / Smoke', regex: /\b(fog|mist|steam|smoke|hazy)\b/i, isInferred: true, inferredNote: 'Fogger machines for noir atmosphere' },

    // Sound / Music
    { category: 'sound', name: 'Distant Police Siren', regex: /\b(siren|sirens wail|echoing horn)\b/i },
    { category: 'sound', name: 'Rain on Asphalt FX', regex: /\b(rain drums|thunder|rumble)\b/i },
    { category: 'sound', name: 'Telephone Ring', regex: /\b(phone rings|receiver clicks)\b/i },

    // Background / Extras
    { category: 'background', name: 'Rainy Alley Pedestrians', regex: /\b(crowd|passersby|pedestrians|bystanders|patrons)\b/i },
    { category: 'background', name: 'Precinct Detectives', regex: /\b(officers at desks|station detectives|sergeants)\b/i },

    // Animals
    { category: 'animal', name: 'Alley Stray Dog', regex: /\b(dog|barking dog|hound|stray cat)\b/i },
  ];

  allSentences.forEach((sentence) => {
    patterns.forEach((pat) => {
      if (pat.regex.test(sentence)) {
        addReq(
          pat.name,
          pat.category,
          pat.isInferred ? 'inferred' : 'explicit',
          sentence,
          pat.isInferred ? 'medium' : 'high',
          pat.inferredNote
        );
      }
    });
  });

  return results;
}
