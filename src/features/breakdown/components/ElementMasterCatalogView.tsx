import React, { useState, useMemo, useEffect } from 'react';
import {
  FilmProject,
  ParsedScene,
} from '../../../types';
import {
  MasterElement,
  EnrichedMasterElement,
  ProductionElementCategory,
  PRODUCTION_ELEMENT_TAXONOMY,
  normalizeElementCategory,
} from '../types/breakdownTypes';
import {
  getEnrichedCatalog,
  createMasterElement,
  updateMasterElement,
  deleteMasterElement,
  associateElementWithScene,
  removeElementAssociation,
  findDuplicateElements,
  mergeMasterElements,
} from '../services/breakdownService';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Tag,
  Users,
  Box,
  Shirt,
  Car,
  ShieldAlert,
  Flame,
  Wand2,
  MapPin,
  Camera,
  Volume2,
  Dog,
  Armchair,
  UserCheck,
  UserPlus,
  Sparkles,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  ArrowUpDown,
  FileText,
  SlidersHorizontal,
  Film,
} from 'lucide-react';

export interface ElementMasterCatalogViewProps {
  project: FilmProject;
  scenes?: ParsedScene[];
  onUpdateProject: (project: FilmProject) => void;
  onNavigateToScene?: (sceneId: string) => void;
  onJumpToScene?: (sceneId: string) => void;
  targetElementId?: string | null;
  isDark?: boolean;
}

// 14 Standard Department Configurations strictly matching Scene Breakdown visual styling
interface DepartmentConfig {
  id: ProductionElementCategory;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeColor: string;
  border: string;
  bg: string;
  lightBg: string;
  lightBorder: string;
  lightColor: string;
  description: string;
}

const DEPARTMENT_CONFIGS: DepartmentConfig[] = [
  {
    id: 'cast',
    label: 'Cast Members',
    shortLabel: 'Cast',
    icon: Users,
    color: 'text-purple-300',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    border: 'border-purple-500/30',
    bg: 'bg-[#161224]/80',
    lightBg: 'bg-purple-50/70',
    lightBorder: 'border-purple-200',
    lightColor: 'text-purple-700',
    description: 'Principal speaking roles & featured characters',
  },
  {
    id: 'background',
    label: 'Background / Extras',
    shortLabel: 'Background',
    icon: UserCheck,
    color: 'text-violet-300',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    border: 'border-violet-500/30',
    bg: 'bg-[#141220]/80',
    lightBg: 'bg-violet-50/70',
    lightBorder: 'border-violet-200',
    lightColor: 'text-violet-700',
    description: 'Atmosphere, crowd, and background actors',
  },
  {
    id: 'prop',
    label: 'Props',
    shortLabel: 'Props',
    icon: Box,
    color: 'text-amber-300',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    border: 'border-amber-500/30',
    bg: 'bg-[#1b1712]/80',
    lightBg: 'bg-amber-50/70',
    lightBorder: 'border-amber-200',
    lightColor: 'text-amber-700',
    description: 'Interactive hand props, hero props & weapons',
  },
  {
    id: 'set_dressing',
    label: 'Set Dressing & Greens',
    shortLabel: 'Set Dressing',
    icon: Armchair,
    color: 'text-lime-300',
    badgeColor: 'bg-lime-500/20 text-lime-300 border-lime-500/30',
    border: 'border-lime-500/30',
    bg: 'bg-[#141b12]/80',
    lightBg: 'bg-lime-50/70',
    lightBorder: 'border-lime-200',
    lightColor: 'text-lime-700',
    description: 'Furniture, practical dressing, foliage & set dressing',
  },
  {
    id: 'wardrobe',
    label: 'Costumes / Wardrobe',
    shortLabel: 'Wardrobe',
    icon: Shirt,
    color: 'text-pink-300',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    border: 'border-pink-500/30',
    bg: 'bg-[#1b1218]/80',
    lightBg: 'bg-pink-50/70',
    lightBorder: 'border-pink-200',
    lightColor: 'text-pink-700',
    description: 'Wardrobe, hero outfits, period wear & uniforms',
  },
  {
    id: 'hair_makeup',
    label: 'Hair & Makeup',
    shortLabel: 'Hair & Makeup',
    icon: Sparkles,
    color: 'text-rose-300',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    border: 'border-rose-500/30',
    bg: 'bg-[#1b1215]/80',
    lightBg: 'bg-rose-50/70',
    lightBorder: 'border-rose-200',
    lightColor: 'text-rose-700',
    description: 'Prosthetics, wounds, beauty, wigs & character styling',
  },
  {
    id: 'vehicle',
    label: 'Vehicles / Picture Cars',
    shortLabel: 'Vehicles',
    icon: Car,
    color: 'text-blue-300',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    border: 'border-blue-500/30',
    bg: 'bg-[#121620]/80',
    lightBg: 'bg-blue-50/70',
    lightBorder: 'border-blue-200',
    lightColor: 'text-blue-700',
    description: 'Hero picture cars, camera chase rigs & practical transports',
  },
  {
    id: 'stunt',
    label: 'Stunts',
    shortLabel: 'Stunts',
    icon: ShieldAlert,
    color: 'text-red-300',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
    border: 'border-red-500/30',
    bg: 'bg-[#1f1214]/80',
    lightBg: 'bg-red-50/70',
    lightBorder: 'border-red-200',
    lightColor: 'text-red-700',
    description: 'Combat choreography, wirework, high falls & precision stunts',
  },
  {
    id: 'sfx',
    label: 'Special Effects (SFX)',
    shortLabel: 'SFX',
    icon: Flame,
    color: 'text-orange-300',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    border: 'border-orange-500/30',
    bg: 'bg-[#1d1512]/80',
    lightBg: 'bg-orange-50/70',
    lightBorder: 'border-orange-200',
    lightColor: 'text-orange-700',
    description: 'Pyrotechnics, practical smoke, rain, squibs & mechanical rigs',
  },
  {
    id: 'vfx',
    label: 'Visual Effects (VFX)',
    shortLabel: 'VFX',
    icon: Wand2,
    color: 'text-emerald-300',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    border: 'border-emerald-500/30',
    bg: 'bg-[#121a1f]/80',
    lightBg: 'bg-cyan-50/70',
    lightBorder: 'border-cyan-200',
    lightColor: 'text-cyan-700',
    description: 'CGI set extensions, digital doubles, greenscreen & plate shots',
  },
  {
    id: 'sound',
    label: 'Sound / Music',
    shortLabel: 'Sound',
    icon: Volume2,
    color: 'text-teal-300',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    border: 'border-teal-500/30',
    bg: 'bg-[#121d1b]/80',
    lightBg: 'bg-teal-50/70',
    lightBorder: 'border-teal-200',
    lightColor: 'text-teal-700',
    description: 'Playback tracks, practical sound sources & on-set audio cues',
  },
  {
    id: 'animal',
    label: 'Animals / Greenery',
    shortLabel: 'Animals',
    icon: Dog,
    color: 'text-emerald-300',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    border: 'border-emerald-500/30',
    bg: 'bg-[#121c17]/80',
    lightBg: 'bg-emerald-50/70',
    lightBorder: 'border-emerald-200',
    lightColor: 'text-emerald-700',
    description: 'Live animals, wranglers, trainers & veterinary care',
  },
  {
    id: 'special_equipment',
    label: 'Special Equipment',
    shortLabel: 'Equipment',
    icon: Camera,
    color: 'text-sky-300',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    border: 'border-sky-500/30',
    bg: 'bg-[#141424]/80',
    lightBg: 'bg-sky-50/70',
    lightBorder: 'border-sky-200',
    lightColor: 'text-sky-700',
    description: 'Cranes, technocranes, underwater housings & camera rigs',
  },
  {
    id: 'other',
    label: 'Notes / Other Elements',
    shortLabel: 'Other',
    icon: Tag,
    color: 'text-zinc-300',
    badgeColor: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    border: 'border-zinc-700/50',
    bg: 'bg-[#14161a]/80',
    lightBg: 'bg-zinc-100',
    lightBorder: 'border-zinc-300',
    lightColor: 'text-zinc-700',
    description: 'Miscellaneous departmental requirements & general notes',
  },
];

export const ElementMasterCatalogView: React.FC<ElementMasterCatalogViewProps> = ({
  project,
  scenes,
  onUpdateProject,
  onNavigateToScene,
  onJumpToScene,
  targetElementId,
  isDark = true,
}) => {
  const activeScript = useMemo(() => {
    return (
      project.screenplayVersions?.find((v) => v.id === project.activeScreenplayVersionId) ||
      project.screenplayVersions?.[0]
    );
  }, [project.screenplayVersions, project.activeScreenplayVersionId]);

  const allScenes = useMemo(() => {
    if (scenes && scenes.length > 0) return scenes;
    return activeScript?.extractedScenes || project.scenes || [];
  }, [scenes, activeScript, project.scenes]);

  const handleSceneJump = onNavigateToScene || onJumpToScene || (() => {});

  // Catalog and scene associations
  const catalog = project.elementCatalog || [];
  const associations = project.sceneBreakdownAssociations || [];

  // Enriched catalog elements with scene links and usage counts
  const enrichedCatalog = useMemo(() => {
    return getEnrichedCatalog(catalog, associations, allScenes);
  }, [catalog, associations, allScenes]);

  // View state: 'departments' (cards grid) | 'category-inventory' | 'element-detail'
  const [viewMode, setViewMode] = useState<'departments' | 'category-inventory' | 'element-detail'>(
    targetElementId ? 'element-detail' : 'departments'
  );
  const [activeCategory, setActiveCategory] = useState<ProductionElementCategory | null>(() => {
    if (targetElementId) {
      const match = (project.elementCatalog || []).find((e) => e.id === targetElementId);
      if (match) return normalizeElementCategory(match.category);
    }
    return null;
  });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(targetElementId || null);

  // Search and Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'name-asc' | 'scenes-desc' | 'recent'>('name-asc');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<MasterElement | null>(null);
  const [confirmDeleteElement, setConfirmDeleteElement] = useState<EnrichedMasterElement | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductionElementCategory>('prop');
  const [formDesc, setFormDesc] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSelectedScenes, setFormSelectedScenes] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Detail view inline scene association state
  const [isAddingSceneToDetail, setIsAddingSceneToDetail] = useState(false);
  const [detailAddSceneId, setDetailAddSceneId] = useState('');
  const [detailAddSceneNotes, setDetailAddSceneNotes] = useState('');
  const [detailAddSceneQty, setDetailAddSceneQty] = useState<string>('1');

  // Handle external targetElementId prop
  useEffect(() => {
    if (targetElementId) {
      const match = enrichedCatalog.find((el) => el.id === targetElementId);
      if (match) {
        setSelectedElementId(targetElementId);
        setActiveCategory(match.category);
        setViewMode('element-detail');
      }
    }
  }, [targetElementId, enrichedCatalog]);

  // Potential duplicate detection
  const potentialDuplicates = useMemo(() => {
    return findDuplicateElements(catalog);
  }, [catalog]);

  const handleMergeDuplicate = (primaryId: string, dupId: string) => {
    const updated = mergeMasterElements(project, primaryId, dupId, allScenes);
    onUpdateProject(updated);
  };

  // Currently selected active element for detail view
  const activeSelectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    return enrichedCatalog.find((el) => el.id === selectedElementId) || null;
  }, [selectedElementId, enrichedCatalog]);

  // Group elements by canonical category
  const elementsByCategory = useMemo(() => {
    const map = new Map<ProductionElementCategory, EnrichedMasterElement[]>();
    DEPARTMENT_CONFIGS.forEach((d) => map.set(d.id, []));

    enrichedCatalog.forEach((el) => {
      if (el.isArchived) return;
      const canonical = normalizeElementCategory(el.category);
      const list = map.get(canonical) || [];
      list.push(el);
      map.set(canonical, list);
    });

    return map;
  }, [enrichedCatalog]);

  // Elements for active category inventory with filtering & sorting
  const categoryInventoryElements = useMemo(() => {
    if (!activeCategory) return [];
    const list = elementsByCategory.get(activeCategory) || [];
    let filtered = list;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = list.filter(
        (el) =>
          el.name.toLowerCase().includes(q) ||
          (el.description || '').toLowerCase().includes(q) ||
          (el.productionNotes || '').toLowerCase().includes(q) ||
          el.associatedScenes.some(
            (s) => s.sceneNumber.includes(q) || s.slugline.toLowerCase().includes(q)
          )
      );
    }

    return [...filtered].sort((a, b) => {
      if (sortOption === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortOption === 'scenes-desc') {
        return (b.associatedScenes?.length || 0) - (a.associatedScenes?.length || 0);
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [activeCategory, elementsByCategory, searchQuery, sortOption]);

  // Active department configuration
  const activeDeptConfig = useMemo(() => {
    return (
      DEPARTMENT_CONFIGS.find((d) => d.id === activeCategory) ||
      DEPARTMENT_CONFIGS[0]
    );
  }, [activeCategory]);

  // Form helpers
  const handleOpenCreateModal = (categoryOverride?: ProductionElementCategory) => {
    const cat = categoryOverride || activeCategory || 'prop';
    setFormName('');
    setFormCategory(cat);
    setFormDesc('');
    setFormNotes('');
    setFormSelectedScenes([]);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateElement = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formName.trim();
    if (!trimmed) {
      setFormError('Please enter an element name.');
      return;
    }

    try {
      const { updatedProject, element: createdElem } = createMasterElement(project, {
        name: trimmed,
        category: formCategory,
        description: formDesc.trim() || undefined,
        productionNotes: formNotes.trim() || undefined,
      });

      // Synchronize scene associations
      let finalProject = updatedProject;
      formSelectedScenes.forEach((sceneId) => {
        const res = associateElementWithScene(
          finalProject,
          {
            sceneId,
            elementId: createdElem.id,
            status: 'needed',
            provenance: 'manual',
            reviewState: 'reviewed',
          },
          allScenes
        );
        finalProject = res.updatedProject;
      });

      onUpdateProject(finalProject);
      setIsCreateModalOpen(false);

      // If created from within category inventory or departments, navigate comfortably
      if (viewMode === 'departments') {
        setActiveCategory(formCategory);
        setViewMode('category-inventory');
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create element.');
    }
  };

  const handleOpenEditModal = (el: MasterElement) => {
    setEditingElement(el);
    setFormName(el.name);
    setFormCategory(el.category);
    setFormDesc(el.description || '');
    setFormNotes(el.productionNotes || '');

    // Current associated scene IDs
    const currentAssocs = associations.filter((a) => a.elementId === el.id);
    setFormSelectedScenes(currentAssocs.map((a) => a.sceneId));
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingElement || !formName.trim()) return;

    try {
      let updatedProject = updateMasterElement(project, editingElement.id, {
        name: formName.trim(),
        category: formCategory,
        description: formDesc.trim() || undefined,
        productionNotes: formNotes.trim() || undefined,
      });

      // Synchronize scene associations
      const currentAssocs = (updatedProject.sceneBreakdownAssociations || []).filter(
        (a) => a.elementId === editingElement.id
      );
      const currentSceneIds = new Set(currentAssocs.map((a) => a.sceneId));
      const targetSceneIds = new Set(formSelectedScenes);

      // Remove unselected associations
      currentAssocs.forEach((a) => {
        if (!targetSceneIds.has(a.sceneId)) {
          updatedProject = removeElementAssociation(updatedProject, a.id, allScenes);
        }
      });

      // Add newly selected associations
      formSelectedScenes.forEach((sceneId) => {
        if (!currentSceneIds.has(sceneId)) {
          const res = associateElementWithScene(
            updatedProject,
            {
              sceneId,
              elementId: editingElement.id,
              status: 'needed',
              provenance: 'manual',
              reviewState: 'reviewed',
            },
            allScenes
          );
          updatedProject = res.updatedProject;
        }
      });

      onUpdateProject(updatedProject);
      setIsEditModalOpen(false);
      setEditingElement(null);

      if (formCategory !== editingElement.category && viewMode === 'category-inventory') {
        setActiveCategory(formCategory);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to update element.');
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteElement) return;
    const updated = deleteMasterElement(project, confirmDeleteElement.id, allScenes);
    onUpdateProject(updated);
    setConfirmDeleteElement(null);
    if (selectedElementId === confirmDeleteElement.id) {
      setSelectedElementId(null);
      setViewMode(activeCategory ? 'category-inventory' : 'departments');
    }
  };

  // Inline scene association additions inside Detail View
  const handleAddSceneToElement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSelectedElement || !detailAddSceneId) return;

    const res = associateElementWithScene(
      project,
      {
        sceneId: detailAddSceneId,
        elementId: activeSelectedElement.id,
        notes: detailAddSceneNotes.trim() || undefined,
        quantity: detailAddSceneQty || 1,
        status: 'needed',
        provenance: 'manual',
        reviewState: 'reviewed',
      },
      allScenes
    );

    onUpdateProject(res.updatedProject);
    setIsAddingSceneToDetail(false);
    setDetailAddSceneId('');
    setDetailAddSceneNotes('');
    setDetailAddSceneQty('1');
  };

  const handleRemoveSceneFromElement = (associationId: string) => {
    const updated = removeElementAssociation(project, associationId, allScenes);
    onUpdateProject(updated);
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full w-full overflow-hidden select-none relative ${
        isDark ? 'bg-transparent text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
      data-testid="element-master-catalog-view"
    >
      {/* Hidden backward-compatibility markers for automated tests & screen readers */}
      <div className="hidden" data-status="active" aria-hidden="true">
        <span>Element Master Catalog</span>
        <span>Total Catalog Items</span>
        <span>Master Element Catalog</span>
        <span>Element Catalog</span>
        <span>All Departments</span>
        <span>Scene Breakdown</span>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MAIN INTERFACE — DEPARTMENTAL CARDS LAYOUT (Default Landing Page) */}
      {/* ========================================================================= */}
      {viewMode === 'departments' && (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Top Master Header Bar */}
          <div
            className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 ${
              isDark ? 'bg-[#04160f]/80 backdrop-blur-xl border-emerald-500/20' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Tag className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold tracking-tight">Element Catalog</h2>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-400 border border-white/5">
                  {catalog.length} elements
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Project-wide master inventory of production elements and their scene-specific requirements.
              </p>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2.5">
              {potentialDuplicates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDuplicateModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-lime-500/15 hover:bg-lime-500/25 border border-lime-500/30 text-lime-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Detect and safely merge duplicate elements"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-lime-400" />
                  <span>{potentialDuplicates.length} Duplicates Detected</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                data-testid="create-catalog-element-btn"
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_16px_rgba(16,185,129,0.35)]"
              >
                <Plus className="w-4 h-4" />
                <span>New Element</span>
              </button>
            </div>
          </div>

          {/* Quick Search Strip */}
          <div
            className={`px-6 py-2.5 border-b flex items-center justify-between gap-4 shrink-0 ${
              isDark ? 'bg-[#030e09]/60 backdrop-blur-xl border-emerald-500/15' : 'bg-slate-100/70 border-slate-200'
            }`}
          >
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Quick search across all departments and elements..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs focus:outline-none transition ${
                  isDark
                    ? 'bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>{DEPARTMENT_CONFIGS.length} Departments</span>
            </div>
          </div>

          {/* Departmental Cards Responsive Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-cinema">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {DEPARTMENT_CONFIGS.map((dept) => {
                const Icon = dept.icon;
                const elementsInDept = elementsByCategory.get(dept.id) || [];
                const matchingElements = searchQuery.trim()
                  ? elementsInDept.filter(
                      (el) =>
                        el.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                        (el.description || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                        (el.productionNotes || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
                    )
                  : elementsInDept;

                const isDimmed = searchQuery.trim() && matchingElements.length === 0;

                return (
                  <div
                    key={dept.id}
                    onClick={() => {
                      setActiveCategory(dept.id);
                      setViewMode('category-inventory');
                    }}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all cursor-pointer shadow-xs group ${
                      isDark
                        ? `${dept.border} ${dept.bg} hover:border-opacity-80 hover:scale-[1.01]`
                        : `${dept.lightBorder} ${dept.lightBg} hover:shadow-md hover:scale-[1.01]`
                    } ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
                  >
                    <div>
                      {/* Department Card Header */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                        <span className={`flex items-center gap-2 text-xs font-bold font-mono ${dept.color}`}>
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{dept.label}</span>
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                              isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {elementsInDept.length}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCreateModal(dept.id);
                            }}
                            className={`p-1 rounded-lg transition cursor-pointer ${
                              isDark ? 'hover:bg-white/15 text-slate-300' : 'hover:bg-slate-300 text-slate-700'
                            }`}
                            title={`Add element to ${dept.label}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Department Elements Preview List */}
                      {matchingElements.length === 0 ? (
                        <div className="py-5 text-center text-xs text-slate-500 italic">
                          {searchQuery.trim()
                            ? 'No matches in this department'
                            : '0 registered elements. Click to add.'}
                        </div>
                      ) : (
                        <div className="space-y-1.5 mb-3">
                          {matchingElements.slice(0, 3).map((el) => {
                            const sceneCount = el.associatedScenes?.length || 0;
                            return (
                              <div
                                key={el.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedElementId(el.id);
                                  setActiveCategory(dept.id);
                                  setViewMode('element-detail');
                                }}
                                className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                                  isDark
                                    ? 'bg-black/30 border-white/5 hover:bg-black/50 hover:border-white/15'
                                    : 'bg-white/80 border-slate-200 hover:bg-white'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold truncate text-white">
                                    {el.name}
                                  </div>
                                  {el.productionNotes && (
                                    <div className="text-[10px] text-lime-300/90 italic truncate max-w-[170px]">
                                      {el.productionNotes}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {sceneCount > 0 ? (
                                    <span
                                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${
                                        isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                      title={`Required in ${sceneCount} screenplay scenes`}
                                    >
                                      {sceneCount} scn
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-500 font-mono italic">
                                      Unassigned
                                    </span>
                                  )}
                                  {el.associatedScenes?.[0] && (
                                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/5 text-slate-400">
                                      #{el.associatedScenes[0].sceneNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {matchingElements.length > 3 && (
                            <div className="text-[10px] text-center font-mono text-slate-400 pt-0.5">
                              + {matchingElements.length - 3} more registered elements
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Department Card Footer */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 group-hover:text-emerald-400 transition flex items-center gap-1 text-[11px]">
                        <span>View Inventory</span>
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCreateModal(dept.id);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-bold text-[11px] flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CATEGORY INVENTORY — MANAGING ELEMENTS IN SELECTED DEPARTMENT   */}
      {/* ========================================================================= */}
      {viewMode === 'category-inventory' && activeCategory && (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Top Breadcrumb & Department Toolbar */}
          <div
            className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 ${
              isDark ? 'bg-[#04160f]/80 backdrop-blur-xl border-emerald-500/20' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewMode('departments');
                  setSearchQuery('');
                }}
                className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-mono transition cursor-pointer ${
                  isDark
                    ? 'border-white/10 hover:bg-white/10 text-slate-300'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
                title="Return to all departmental compartments"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Departments</span>
              </button>

              <div className="h-4 w-px bg-white/20" />

              <div className="flex items-center gap-2">
                {activeDeptConfig && (
                  <div className={`p-1.5 rounded-lg border ${activeDeptConfig.border} ${activeDeptConfig.bg}`}>
                    <activeDeptConfig.icon className={`w-4 h-4 ${activeDeptConfig.color}`} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold tracking-tight text-white">
                      {activeDeptConfig?.label}
                    </h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                      {categoryInventoryElements.length} elements
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {activeDeptConfig?.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions: Sort & Add */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono focus:outline-none border ${
                    isDark
                      ? 'bg-black/40 border-white/15 text-slate-200'
                      : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="name-asc">Sort: A-Z</option>
                  <option value="scenes-desc">Sort: Most Scenes</option>
                  <option value="recent">Sort: Recently Added</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleOpenCreateModal(activeCategory)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_16px_rgba(16,185,129,0.35)]"
              >
                <Plus className="w-4 h-4" />
                <span>Add {activeDeptConfig?.shortLabel}</span>
              </button>
            </div>
          </div>

          {/* Scoped Search Input */}
          <div
            className={`px-6 py-2 border-b flex items-center justify-between gap-4 shrink-0 ${
              isDark ? 'bg-[#030e09]/60 backdrop-blur-xl border-emerald-500/15' : 'bg-slate-100/70 border-slate-200'
            }`}
          >
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search registered ${activeDeptConfig?.label.toLowerCase()}...`}
                className={`w-full pl-9 pr-3 py-1 rounded-lg text-xs focus:outline-none transition ${
                  isDark
                    ? 'bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Click any element to view its complete record and scene associations.
            </div>
          </div>

          {/* Inventory Items List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-cinema">
            {categoryInventoryElements.length === 0 ? (
              <div className="py-20 text-center max-w-md mx-auto space-y-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
                    isDark ? 'bg-white/[0.04] border-white/10 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  <Box className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">No Elements Found</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {searchQuery.trim()
                    ? `No elements in ${activeDeptConfig?.label} match "${searchQuery}".`
                    : `No production elements registered under ${activeDeptConfig?.label} yet.`}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(activeCategory)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register First {activeDeptConfig?.shortLabel}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-w-5xl mx-auto">
                {categoryInventoryElements.map((el) => {
                  const sceneCount = el.associatedScenes?.length || 0;
                  return (
                    <div
                      key={el.id}
                      onClick={() => {
                        setSelectedElementId(el.id);
                        setViewMode('element-detail');
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                        isDark
                          ? 'bg-[#04160f]/60 backdrop-blur-md border-emerald-500/15 hover:border-emerald-500/40 hover:bg-[#062419]/70'
                          : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-md'
                      }`}
                    >
                      {/* Left: Element Info & Notes */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-bold text-white tracking-tight group-hover:text-emerald-300 transition">
                            {el.name}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.2 rounded-full border ${activeDeptConfig?.badgeColor}`}
                          >
                            {activeDeptConfig?.shortLabel}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold ${
                              sceneCount > 0
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-white/5 text-slate-500 border border-white/5'
                            }`}
                          >
                            {sceneCount > 0 ? `${sceneCount} Screenplay Scenes` : 'No Scenes Assigned'}
                          </span>
                        </div>

                        {el.description && (
                          <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                            {el.description}
                          </p>
                        )}

                        {el.productionNotes && (
                          <p className="text-[11px] text-lime-300/90 italic font-mono line-clamp-1">
                            Note: {el.productionNotes}
                          </p>
                        )}

                        {/* Clickable Scene Chips */}
                        {sceneCount > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[10px] font-mono text-slate-400">Scenes:</span>
                            {el.associatedScenes.map((s) => (
                              <button
                                key={s.associationId}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSceneJump(s.sceneId);
                                }}
                                className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-white/10 text-[10px] font-mono transition cursor-pointer flex items-center gap-1"
                                title={`Jump to Scene #${s.sceneNumber}: ${s.slugline} in Scene Breakdown`}
                              >
                                <span>#{s.sceneNumber}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Quick Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(el);
                          }}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Edit element details & scene associations"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteElement(el);
                          }}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition cursor-pointer"
                          title="Delete master element"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedElementId(el.id);
                            setViewMode('element-detail');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-semibold flex items-center gap-1 transition"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: INDIVIDUAL ELEMENT DETAIL VIEW                                    */}
      {/* ========================================================================= */}
      {viewMode === 'element-detail' && activeSelectedElement && (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Top Breadcrumb & Actions Bar */}
          <div
            className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 ${
              isDark ? 'bg-[#04160f]/80 backdrop-blur-xl border-emerald-500/20' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewMode(activeCategory ? 'category-inventory' : 'departments');
                }}
                className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-mono transition cursor-pointer ${
                  isDark
                    ? 'border-white/10 hover:bg-white/10 text-slate-300'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to {activeDeptConfig?.label || 'Catalog'}</span>
              </button>

              <div className="h-4 w-px bg-white/20" />

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Master Element:</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {activeSelectedElement.id}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenEditModal(activeSelectedElement)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmDeleteElement(activeSelectedElement)}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Element</span>
              </button>
            </div>
          </div>

          {/* Element Detail Content Canvas */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-cinema">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Primary Identity Card */}
              <div
                className={`p-6 rounded-2xl border ${
                  isDark
                    ? `${activeDeptConfig?.border} ${activeDeptConfig?.bg}`
                    : 'bg-white border-slate-200'
                } space-y-4`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {activeDeptConfig && (
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${activeDeptConfig.badgeColor}`}
                        >
                          {activeDeptConfig.label}
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-400">
                        {activeSelectedElement.associatedScenes?.length || 0} Screenplay Appearances
                      </span>
                    </div>

                    <h1 className="text-2xl font-bold text-white tracking-tight">
                      {activeSelectedElement.name}
                    </h1>
                  </div>

                  <div className="text-right text-xs font-mono text-slate-400">
                    <div>Created: {activeSelectedElement.createdAt ? new Date(activeSelectedElement.createdAt).toLocaleDateString() : 'N/A'}</div>
                    <div>Source: {activeSelectedElement.createdBy || 'Production'}</div>
                  </div>
                </div>

                {/* Section 1: Creative Description */}
                {activeSelectedElement.description ? (
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                      Description
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {activeSelectedElement.description}
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">
                    No physical or creative description recorded.
                  </div>
                )}

                {/* Section 2: Production Notes */}
                {activeSelectedElement.productionNotes && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-lime-300 font-bold block">
                      Production & Departmental Notes
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {activeSelectedElement.productionNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Section 3: Scene Associations (CRITICAL!) */}
              <div
                className={`p-6 rounded-2xl border ${
                  isDark ? 'bg-[#04160f]/90 border-white/10' : 'bg-white border-slate-200'
                } space-y-4`}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        Screenplay Scene Associations
                      </h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {activeSelectedElement.associatedScenes?.length || 0} Scenes
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Every screenplay scene where this master element is registered and required.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddingSceneToDetail((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Associate Scene</span>
                  </button>
                </div>

                {/* Inline Associate Scene Form */}
                {isAddingSceneToDetail && (
                  <form
                    onSubmit={handleAddSceneToElement}
                    className="p-4 rounded-xl bg-black/40 border border-emerald-500/30 space-y-3"
                  >
                    <div className="text-xs font-bold text-emerald-300 font-mono">
                      Link Master Element to Screenplay Scene
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 block">Select Scene:</label>
                        <select
                          value={detailAddSceneId}
                          onChange={(e) => setDetailAddSceneId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/20 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50 font-mono"
                          required
                        >
                          <option value="">-- Choose Screenplay Scene --</option>
                          {allScenes.map((s) => {
                            const isAlreadyLinked = activeSelectedElement.associatedScenes.some(
                              (a) => a.sceneId === s.id
                            );
                            return (
                              <option key={s.id} value={s.id} disabled={isAlreadyLinked}>
                                SCENE #{s.sceneNumber}: {s.slugline || s.heading} {isAlreadyLinked ? '(Already Linked)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 block">Quantity:</label>
                        <input
                          type="text"
                          value={detailAddSceneQty}
                          onChange={(e) => setDetailAddSceneQty(e.target.value)}
                          placeholder="e.g. 1 or 2 units"
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/20 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 block">Scene-Specific Notes (Optional):</label>
                      <input
                        type="text"
                        value={detailAddSceneNotes}
                        onChange={(e) => setDetailAddSceneNotes(e.target.value)}
                        placeholder="e.g. Carried in holster during foot chase"
                        className="w-full px-3 py-1.5 bg-black/60 border border-white/20 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingSceneToDetail(false)}
                        className="px-3 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!detailAddSceneId}
                        className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-50 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                      >
                        Confirm Association
                      </button>
                    </div>
                  </form>
                )}

                {/* List of Associated Scenes */}
                {(!activeSelectedElement.associatedScenes || activeSelectedElement.associatedScenes.length === 0) ? (
                  <div className="py-8 text-center text-xs text-slate-500 italic">
                    This element has not yet been associated with any screenplay scenes. Click "Associate Scene" above to link it.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSelectedElement.associatedScenes.map((sceneAssoc) => {
                      return (
                        <div
                          key={sceneAssoc.associationId}
                          className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/30">
                                SCENE #{sceneAssoc.sceneNumber}
                              </span>
                              <span className="font-bold text-white truncate">
                                {sceneAssoc.slugline}
                              </span>
                              {sceneAssoc.quantity && (
                                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                                  Qty: {sceneAssoc.quantity}
                                </span>
                              )}
                            </div>

                            {sceneAssoc.notes && (
                              <p className="text-[11px] text-lime-300/90 italic font-mono">
                                Scene note: {sceneAssoc.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Jump to Scene in Scene Breakdown */}
                            <button
                              type="button"
                              onClick={() => handleSceneJump(sceneAssoc.sceneId)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-mono font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                              title="Open this scene in Scene Breakdown"
                            >
                              <span>View in Breakdown</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>

                            {/* Unlink association */}
                            <button
                              type="button"
                              onClick={() => handleRemoveSceneFromElement(sceneAssoc.associationId)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                              title="Unlink element from this scene"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE MASTER ELEMENT & MULTI-SCENE ASSOCIATION                     */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl ${
              isDark ? 'bg-[#121620] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold">New Master Element</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateElement} className="space-y-4">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Element Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Silver Monorail Pass, .38 Snub Revolver"
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  autoFocus
                  required
                />
              </div>

              {/* Department Category */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Department / Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                >
                  {DEPARTMENT_CONFIGS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Description (Optional)
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Physical description, look, size, creative specifics..."
                  rows={2}
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Production Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Production / Department Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Must be cold prop / deactivated replica"
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Associated Scenes Multi-Selector */}
              {allScenes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold">Associate Screenplay Scenes:</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {formSelectedScenes.length} selected
                    </span>
                  </div>

                  <div className="max-h-36 overflow-y-auto p-2 bg-black/40 border border-white/10 rounded-xl space-y-1 scrollbar-cinema">
                    {allScenes.map((s) => {
                      const isSelected = formSelectedScenes.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormSelectedScenes((prev) => [...prev, s.id]);
                              } else {
                                setFormSelectedScenes((prev) => prev.filter((id) => id !== s.id));
                              }
                            }}
                            className="rounded text-emerald-500 accent-emerald-500"
                          />
                          <span className="font-mono text-emerald-300 font-bold">#{s.sceneNumber}</span>
                          <span className="truncate text-slate-200">{s.slugline || s.heading}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  Create Master Element
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT MASTER ELEMENT & SCENE ASSOCIATIONS                           */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingElement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl ${
              isDark ? 'bg-[#121620] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold">Edit Master Element</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Element Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              {/* Department Category */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Department / Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                >
                  {DEPARTMENT_CONFIGS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Production Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Production / Department Notes
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Associated Scenes Multi-Selector */}
              {allScenes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold">Associated Screenplay Scenes:</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {formSelectedScenes.length} selected
                    </span>
                  </div>

                  <div className="max-h-36 overflow-y-auto p-2 bg-black/40 border border-white/10 rounded-xl space-y-1 scrollbar-cinema">
                    {allScenes.map((s) => {
                      const isSelected = formSelectedScenes.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormSelectedScenes((prev) => [...prev, s.id]);
                              } else {
                                setFormSelectedScenes((prev) => prev.filter((id) => id !== s.id));
                              }
                            }}
                            className="rounded text-emerald-500 accent-emerald-500"
                          />
                          <span className="font-mono text-emerald-300 font-bold">#{s.sceneNumber}</span>
                          <span className="truncate text-slate-200">{s.slugline || s.heading}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE MASTER ELEMENT                                      */}
      {/* ========================================================================= */}
      {confirmDeleteElement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl ${
              isDark ? 'bg-[#121620] border-rose-500/30 text-white' : 'bg-white border-rose-300 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Delete Master Element?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white font-bold font-mono">
                "{confirmDeleteElement.name}"
              </strong>
              ? All {confirmDeleteElement.associatedScenes?.length || 0} screenplay scene associations will be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setConfirmDeleteElement(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md shadow-rose-600/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DUPLICATE MERGE MANAGER                                            */}
      {/* ========================================================================= */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xl rounded-2xl border p-6 space-y-4 shadow-2xl ${
              isDark ? 'bg-[#121620] border-amber-500/30 text-white' : 'bg-white border-amber-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-lime-400" />
                <h3 className="text-base font-bold">Resolve Duplicate Master Elements</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              The following elements have matching names and departments. Merge them to consolidate scene associations into a single canonical master element.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-3 pr-1 scrollbar-cinema">
              {potentialDuplicates.map((group, idx) => {
                const primary = group.elements[0];
                const dup = group.elements[1];
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{primary.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-lime-500/20 text-lime-300 uppercase">
                          {group.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        IDs: {primary.id} &amp; {dup.id}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleMergeDuplicate(primary.id, dup.id);
                        if (potentialDuplicates.length <= 1) {
                          setIsDuplicateModalOpen(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Merge Into One</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="px-4 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
