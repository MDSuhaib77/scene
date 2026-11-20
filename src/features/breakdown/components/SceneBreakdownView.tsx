import React, { useState, useMemo } from 'react';
import {
  FilmProject,
  ParsedScene,
} from '../../../types';
import {
  MasterElement,
  SceneElementAssociation,
  EnrichedSceneAssociation,
  ProductionElementCategory,
  BreakdownRequirementStatus,
  BreakdownAssociationReviewState,
  PRODUCTION_ELEMENT_TAXONOMY,
  normalizeElementCategory,
} from '../types/breakdownTypes';
import {
  getEnrichedSceneAssociations,
  associateElementWithScene,
  removeElementAssociation,
  updateElementAssociation,
  createAndAssociateElement,
  extractMultiCategorySceneRequirements,
  ExtractedSceneRequirement,
} from '../services/breakdownService';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Tag,
  ArrowRight,
  Sparkles,
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
  Check,
  X,
  Eye,
  Calendar,
  Grid,
  List,
} from 'lucide-react';

interface SceneBreakdownViewProps {
  project: FilmProject;
  scenes?: ParsedScene[];
  selectedSceneId?: string | null;
  onSelectScene?: (sceneId: string) => void;
  onUpdateProject: (project: FilmProject) => void;
  onNavigateTab?: (tab: string, submodule?: string) => void;
  onSwitchToCatalog?: (elementId?: string) => void;
  isDark?: boolean;
}

export const SceneBreakdownView: React.FC<SceneBreakdownViewProps> = ({
  project,
  scenes,
  selectedSceneId,
  onSelectScene,
  onUpdateProject,
  onNavigateTab,
  onSwitchToCatalog,
  isDark = true,
}) => {
  const activeScript = useMemo(() => {
    return project.screenplayVersions?.find(v => v.id === project.activeScreenplayVersionId)
      || project.screenplayVersions?.[0];
  }, [project.screenplayVersions, project.activeScreenplayVersionId]);

  const allScenes = useMemo(() => {
    if (scenes && scenes.length > 0) return scenes;
    return activeScript?.extractedScenes || project.scenes || [];
  }, [scenes, activeScript, project.scenes]);

  // Scene filter & search state
  const [sceneSearch, setSceneSearch] = useState('');
  const [sceneFilterStatus, setSceneFilterStatus] = useState<
    'ALL' | 'needs_review' | 'in_progress' | 'reviewed' | 'needs_attention' | 'blocked'
  >('ALL');

  // Sheet view mode: Departmental Compartments vs Linear List
  const [sheetViewMode, setSheetViewMode] = useState<'compartments' | 'list'>('compartments');

  // Element category filter in active scene
  const [elementCategoryFilter, setElementCategoryFilter] = useState<ProductionElementCategory | 'ALL'>('ALL');

  // Shooting location inline editor state
  const [isEditingShootingLoc, setIsEditingShootingLoc] = useState(false);
  const [shootingLocInput, setShootingLocInput] = useState('');

  // Add Element Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'catalog' | 'new'>('catalog');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<ProductionElementCategory | 'ALL'>('ALL');

  // New element form state
  const [newElemName, setNewElemName] = useState('');
  const [newElemCategory, setNewElemCategory] = useState<ProductionElementCategory>('prop');
  const [newElemDesc, setNewElemDesc] = useState('');
  const [newElemNotes, setNewElemNotes] = useState('');
  const [newElemQty, setNewElemQty] = useState<string | number>(1);

  // Edit Association Modal state
  const [editingAssoc, setEditingAssoc] = useState<EnrichedSceneAssociation | null>(null);
  const [editQty, setEditQty] = useState<string | number>(1);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<BreakdownRequirementStatus>('needed');
  const [editReviewState, setEditReviewState] = useState<BreakdownAssociationReviewState>('unreviewed');

  // Confirm delete association modal
  const [confirmDeleteAssoc, setConfirmDeleteAssoc] = useState<EnrichedSceneAssociation | null>(null);

  // Active scene resolution
  const activeScene = useMemo(() => {
    return allScenes.find((s) => s.id === selectedSceneId) || allScenes[0] || null;
  }, [allScenes, selectedSceneId]);

  // Master elements and associations from project
  const catalog = project.elementCatalog || [];
  const associations = project.sceneBreakdownAssociations || [];

  // Multi-category extraction state
  const [dismissedExtractionIds, setDismissedExtractionIds] = useState<Set<string>>(new Set());

  // Grounded multi-category extraction suggestions for active scene
  const extractedSuggestions = useMemo(() => {
    if (!activeScene) return [];
    const allExtracted = extractMultiCategorySceneRequirements(activeScene, catalog, associations);
    return allExtracted.filter((req) => !dismissedExtractionIds.has(req.id));
  }, [activeScene, catalog, associations, dismissedExtractionIds]);

  const handleConfirmExtractedRequirement = (req: ExtractedSceneRequirement) => {
    if (!activeScene) return;
    createAndAssociateElement(
      project,
      activeScene.id,
      {
        name: req.name,
        category: req.category,
        description: req.notes || `Extracted from screenplay: "${req.evidencePassage}"`,
        provenance: 'extracted',
        reviewState: 'reviewed',
        status: 'needed',
        quantity: 1,
      },
      (updated) => {
        onUpdateProject(updated);
        setDismissedExtractionIds((prev) => new Set(prev).add(req.id));
      }
    );
  };

  const handleConfirmAllExtracted = () => {
    if (!activeScene || extractedSuggestions.length === 0) return;
    let currProject = project;
    extractedSuggestions.forEach((req) => {
      createAndAssociateElement(
        currProject,
        activeScene.id,
        {
          name: req.name,
          category: req.category,
          description: req.notes || `Extracted from screenplay: "${req.evidencePassage}"`,
          provenance: 'extracted',
          reviewState: 'reviewed',
          status: 'needed',
          quantity: 1,
        },
        (updated) => {
          currProject = updated;
        }
      );
    });
    onUpdateProject(currProject);
    setDismissedExtractionIds((prev) => {
      const next = new Set(prev);
      extractedSuggestions.forEach((r) => next.add(r.id));
      return next;
    });
  };

  // Enriched associations for the active scene
  const activeSceneAssocs = useMemo(() => {
    if (!activeScene) return [];
    return getEnrichedSceneAssociations(associations, catalog, activeScene.id);
  }, [associations, catalog, activeScene]);

  // Filtered associations for active scene
  const filteredSceneAssocs = useMemo(() => {
    if (elementCategoryFilter === 'ALL') return activeSceneAssocs;
    return activeSceneAssocs.filter((a) => normalizeElementCategory(a.element.category) === elementCategoryFilter);
  }, [activeSceneAssocs, elementCategoryFilter]);

  // Unreviewed / Unresolved requirements count for active scene
  const unreviewedCountInScene = useMemo(() => {
    return activeSceneAssocs.filter((a) => a.status === 'needed' || a.reviewState === 'unreviewed').length;
  }, [activeSceneAssocs]);

  // 5 Auditable Production Review States
  const getSceneReviewState = (s: ParsedScene): 'not_reviewed' | 'in_progress' | 'reviewed' | 'needs_attention' | 'blocked' => {
    if (s.status === 'reviewed') return 'reviewed';
    const custom = (s as any).reviewStatus || (s as any).productionReviewStatus;
    if (custom === 'blocked' || (s as any).status === 'blocked') return 'blocked';
    if (custom === 'in_progress' || (s as any).status === 'in_progress') return 'in_progress';
    if (
      custom === 'needs_attention' ||
      (s as any).status === 'needs_attention' ||
      s.status === ('needs_review' as any) ||
      (s.reviewState as any)?.status === 'needs_review'
    ) {
      return 'needs_attention';
    }
    if (custom === 'not_reviewed') return 'not_reviewed';
    // Non-aggressive defaults: only flag as needs_attention if actual missing parameters exist
    if (!s.slugline && !s.heading) return 'needs_attention';
    return 'not_reviewed';
  };

  // Filtered scenes list
  const filteredScenes = useMemo(() => {
    return allScenes.filter((s) => {
      const state = getSceneReviewState(s);
      if (sceneFilterStatus === 'needs_review' && state === 'reviewed') return false;
      if (sceneFilterStatus === 'reviewed' && state !== 'reviewed') return false;
      if (sceneFilterStatus === 'needs_attention' && state !== 'needs_attention') return false;
      if (sceneFilterStatus === 'in_progress' && state !== 'in_progress') return false;
      if (sceneFilterStatus === 'blocked' && state !== 'blocked') return false;

      if (!sceneSearch.trim()) return true;
      const q = sceneSearch.toLowerCase();
      return (
        s.sceneNumber.toLowerCase().includes(q) ||
        (s.slugline || '').toLowerCase().includes(q) ||
        (s.location || '').toLowerCase().includes(q) ||
        (s.characters || []).some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [allScenes, sceneSearch, sceneFilterStatus]);

  // Strip styling helper
  const getStripColorClass = (intExt: string = '', timeOfDay: string = '') => {
    const isExt = intExt.toUpperCase().includes('EXT');
    const isNight = ['NIGHT', 'DUSK', 'DAWN'].some((t) => timeOfDay.toUpperCase().includes(t));

    if (!isExt && !isNight) {
      return 'bg-zinc-800/90 border-zinc-600/50 text-zinc-100'; // INT DAY
    } else if (isExt && !isNight) {
      return 'bg-amber-950/70 border-amber-600/60 text-amber-200'; // EXT DAY
    } else if (!isExt && isNight) {
      return 'bg-emerald-950/70 border-emerald-600/60 text-emerald-200'; // INT NIGHT
    } else {
      return 'bg-blue-950/70 border-blue-600/60 text-blue-200'; // EXT NIGHT
    }
  };

  // Category Icon helper
  const renderCategoryIcon = (category: ProductionElementCategory, className = 'w-4 h-4') => {
    switch (category) {
      case 'cast': return <Users className={className} />;
      case 'background': return <UserCheck className={className} />;
      case 'extras': return <UserPlus className={className} />;
      case 'location': return <MapPin className={className} />;
      case 'prop': return <Box className={className} />;
      case 'set_dressing': return <Armchair className={className} />;
      case 'wardrobe': return <Shirt className={className} />;
      case 'hair_makeup': return <Sparkles className={className} />;
      case 'sfx': return <Flame className={className} />;
      case 'vfx': return <Wand2 className={className} />;
      case 'vehicle': return <Car className={className} />;
      case 'animal': return <Dog className={className} />;
      case 'stunt': return <ShieldAlert className={className} />;
      case 'sound': return <Volume2 className={className} />;
      case 'special_equipment': return <Camera className={className} />;
      default: return <Tag className={className} />;
    }
  };

  // Requirement status badge helper
  const renderStatusBadge = (status?: BreakdownRequirementStatus) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Confirmed</span>;
      case 'acquired':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Acquired</span>;
      case 'omitted':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">Omitted</span>;
      case 'needed':
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">Needed</span>;
    }
  };

  // Handlers
  const handleOpenAddModal = (defaultCategory?: ProductionElementCategory) => {
    setIsAddModalOpen(true);
    setNewElemName('');
    setNewElemDesc('');
    setNewElemNotes('');
    setNewElemQty(1);
    setCatalogSearch('');
    if (defaultCategory) {
      setNewElemCategory(defaultCategory);
      setCatalogCategoryFilter(defaultCategory);
    }
  };

  const handleAddExistingFromCatalog = (elementId: string) => {
    if (!activeScene) return;
    const { updatedProject } = associateElementWithScene(
      project,
      {
        sceneId: activeScene.id,
        elementId,
        quantity: 1,
        status: 'needed',
        provenance: 'manual',
        reviewState: 'unreviewed',
      },
      allScenes
    );
    onUpdateProject(updatedProject);
    setIsAddModalOpen(false);
  };

  const handleCreateAndAddElement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScene || !newElemName.trim()) return;

    const { updatedProject } = createAndAssociateElement(
      project,
      activeScene.id,
      {
        name: newElemName.trim(),
        category: newElemCategory,
        description: newElemDesc.trim() || undefined,
        productionNotes: newElemNotes.trim() || undefined,
      },
      {
        quantity: newElemQty || 1,
        notes: newElemNotes.trim() || undefined,
        status: 'needed',
      },
      allScenes
    );

    onUpdateProject(updatedProject);
    setIsAddModalOpen(false);
  };

  const handleOpenEditAssoc = (assoc: EnrichedSceneAssociation) => {
    setEditingAssoc(assoc);
    setEditQty(assoc.quantity ?? 1);
    setEditNotes(assoc.notes || '');
    setEditStatus(assoc.status || 'needed');
    setEditReviewState(assoc.reviewState || 'unreviewed');
  };

  const handleSaveEditAssoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssoc) return;

    const updatedProject = updateElementAssociation(
      project,
      editingAssoc.id,
      {
        quantity: editQty,
        notes: editNotes.trim() || undefined,
        status: editStatus,
        reviewState: editReviewState,
      },
      allScenes
    );

    onUpdateProject(updatedProject);
    setEditingAssoc(null);
  };

  const handleConfirmRemoveAssoc = () => {
    if (!confirmDeleteAssoc) return;
    const updatedProject = removeElementAssociation(project, confirmDeleteAssoc.id, allScenes);
    onUpdateProject(updatedProject);
    setConfirmDeleteAssoc(null);
  };

  const handleSetSceneReviewState = (
    newState: 'not_reviewed' | 'in_progress' | 'reviewed' | 'needs_attention' | 'blocked'
  ) => {
    if (!activeScene) return;
    const stdStatus = newState === 'reviewed' ? 'reviewed' : 'unreviewed';
    const updatedScenes = allScenes.map((s) =>
      s.id === activeScene.id
        ? {
            ...s,
            status: stdStatus as any,
            reviewStatus: newState,
            productionReviewStatus: newState,
          }
        : s
    );

    const updatedVersions = (project.screenplayVersions || []).map((ver, idx) => {
      if (idx === (project.screenplayVersions?.length || 1) - 1 || idx === 0) {
        return { ...ver, scenes: updatedScenes };
      }
      return ver;
    });

    onUpdateProject({
      ...project,
      scenes: updatedScenes,
      screenplayVersions: updatedVersions,
    });
  };

  const handleToggleSceneReview = () => {
    if (!activeScene) return;
    const current = getSceneReviewState(activeScene);
    const nextState = current === 'reviewed' ? 'not_reviewed' : 'reviewed';
    handleSetSceneReviewState(nextState);
  };

  const handleSaveShootingLocation = () => {
    if (!activeScene) return;
    const updatedScenes = allScenes.map((s) =>
      s.id === activeScene.id
        ? {
            ...s,
            shootingLocation: shootingLocInput.trim() || undefined,
          }
        : s
    );

    const updatedVersions = (project.screenplayVersions || []).map((ver, idx) => {
      if (idx === (project.screenplayVersions?.length || 1) - 1 || idx === 0) {
        return { ...ver, scenes: updatedScenes };
      }
      return ver;
    });

    onUpdateProject({
      ...project,
      scenes: updatedScenes,
      screenplayVersions: updatedVersions,
    });
    setIsEditingShootingLoc(false);
  };

  // Filter catalog elements available to add
  const availableCatalogElements = useMemo(() => {
    const existingElementIds = new Set(activeSceneAssocs.map((a) => a.elementId));

    return catalog.filter((el) => {
      if (el.isArchived) return false;
      if (existingElementIds.has(el.id)) return false; // Already in this scene
      if (catalogCategoryFilter !== 'ALL' && el.category !== catalogCategoryFilter) return false;
      if (!catalogSearch.trim()) return true;
      const q = catalogSearch.toLowerCase();
      return (
        el.name.toLowerCase().includes(q) ||
        (el.description || '').toLowerCase().includes(q) ||
        (el.productionNotes || '').toLowerCase().includes(q)
      );
    });
  }, [catalog, activeSceneAssocs, catalogCategoryFilter, catalogSearch]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full w-full gap-4 overflow-hidden" data-testid="scene-breakdown-view">
      {/* Left Column (Scene Register): Compact Scene Navigation List */}
      <div
        className={`w-full lg:w-80 xl:w-92 p-4 rounded-3xl border flex flex-col space-y-3 shrink-0 h-full overflow-hidden ${
          isDark ? 'bg-[#0B0E17]/95 border-zinc-800 shadow-md' : 'bg-white border-zinc-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Screenplay Scenes</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                {scenes.length}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">Select a scene to inspect requirements</p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('screenplay')}
            title="Open Screenplay Editor"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>

        {/* Scene Search & Review Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={sceneSearch}
              onChange={(e) => setSceneSearch(e.target.value)}
              placeholder="Search scene #, slug, location..."
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400/50"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSceneFilterStatus('ALL')}
              className={`px-2 py-1 rounded-lg font-mono transition cursor-pointer shrink-0 ${
                sceneFilterStatus === 'ALL'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              All ({allScenes.length})
            </button>
            <button
              type="button"
              onClick={() => setSceneFilterStatus('needs_review')}
              className={`px-2 py-1 rounded-lg font-mono transition cursor-pointer shrink-0 ${
                sceneFilterStatus === 'needs_review'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Unreviewed
            </button>
            <button
              type="button"
              onClick={() => setSceneFilterStatus('in_progress')}
              className={`px-2 py-1 rounded-lg font-mono transition cursor-pointer shrink-0 ${
                sceneFilterStatus === 'in_progress'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              In Progress
            </button>
            <button
              type="button"
              onClick={() => setSceneFilterStatus('reviewed')}
              className={`px-2 py-1 rounded-lg font-mono transition cursor-pointer shrink-0 ${
                sceneFilterStatus === 'reviewed'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Reviewed
            </button>
            <button
              type="button"
              onClick={() => setSceneFilterStatus('needs_attention')}
              className={`px-2 py-1 rounded-lg font-mono transition cursor-pointer shrink-0 ${
                sceneFilterStatus === 'needs_attention'
                  ? 'bg-rose-500/20 text-rose-300 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Needs Attention
            </button>
            <button
              type="button"
              onClick={() => setSceneFilterStatus('blocked')}
              className={`px-2 py-1 rounded-lg font-mono transition cursor-pointer shrink-0 ${
                sceneFilterStatus === 'blocked'
                  ? 'bg-red-500/20 text-red-300 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Blocked
            </button>
          </div>
        </div>

        {/* Scenes Scroll List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-cinema">
          {filteredScenes.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">No scenes match your filter.</div>
          ) : (
            filteredScenes.map((scene) => {
              const isSelected = activeScene?.id === scene.id;
              const sceneAssocs = associations.filter((a) => a.sceneId === scene.id);
              const unreviewedInThisScene = sceneAssocs.filter(
                (a) => a.status === 'needed' || a.reviewState === 'unreviewed'
              ).length;

              return (
                <div
                  key={scene.id}
                  data-testid={`scene-list-item-${scene.id}`}
                  onClick={() => onSelectScene(scene.id)}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/40 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-emerald-300 font-mono font-bold text-xs">
                        #{scene.sceneNumber}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getStripColorClass(
                          scene.intExt,
                          scene.timeOfDay
                        )}`}
                      >
                        {scene.intExt} • {scene.timeOfDay}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {scene.status === 'reviewed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" title="Scene reviewed" />
                      ) : unreviewedInThisScene > 0 ? (
                        <span
                          className="w-2 h-2 rounded-full bg-amber-400"
                          title={`${unreviewedInThisScene} unreviewed requirements`}
                        />
                      ) : null}
                      <span className="text-[11px] font-mono text-zinc-400">
                        {sceneAssocs.length} el
                      </span>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-white truncate mb-1">
                    {scene.slugline || scene.heading || scene.originalHeading}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="truncate max-w-[180px]">{scene.location}</span>
                    <span className="font-mono text-[10px]">{scene.pageLengthDisplay || '1/8'} pgs</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Dedicated Scene Breakdown Worksheet */}
      <div
        className={`flex-1 p-6 rounded-3xl border flex flex-col min-w-0 h-full overflow-y-auto space-y-6 scrollbar-cinema ${
          isDark ? 'bg-[#0B0E17]/95 border-zinc-800 shadow-md' : 'bg-white border-zinc-200'
        }`}
      >
        {activeScene ? (
          <>
            {/* 1. Scene Header & Metadata */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-xs">
                    SCENE #{activeScene.sceneNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-semibold border ${getStripColorClass(
                      activeScene.intExt,
                      activeScene.timeOfDay
                    )}`}
                  >
                    {activeScene.intExt} • {activeScene.timeOfDay}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono">
                    {activeScene.pageLengthDisplay || '1/8'} pgs ({activeScene.pageLengthEighths || 1}/8)
                  </span>
                  {unreviewedCountInScene > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{unreviewedCountInScene} unreviewed</span>
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-white tracking-tight">
                  {activeScene.slugline || activeScene.heading || activeScene.originalHeading}
                </h2>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Script: <strong className="text-zinc-200">{activeScene.location}</strong></span>
                  </span>

                  <span className="text-zinc-600">•</span>

                  <span className="flex items-center gap-1">
                    <span className="text-zinc-400">Shooting:</span>
                    {isEditingShootingLoc ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          value={shootingLocInput}
                          onChange={(e) => setShootingLocInput(e.target.value)}
                          placeholder={activeScene.location}
                          className="px-2 py-0.5 bg-zinc-900 border border-emerald-500/40 rounded text-xs text-white"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveShootingLocation}
                          className="px-1.5 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded text-[10px] cursor-pointer shadow-xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingShootingLoc(false)}
                          className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span
                        onClick={() => {
                          setShootingLocInput((activeScene as any).shootingLocation || activeScene.location);
                          setIsEditingShootingLoc(true);
                        }}
                        className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200 cursor-pointer font-medium"
                        title="Click to edit shooting location"
                      >
                        {(activeScene as any).shootingLocation || activeScene.location} ✎
                      </span>
                    )}
                  </span>

                  {activeScene.characters && activeScene.characters.length > 0 && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        <span>{activeScene.characters.join(', ')}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* 5-State Selector */}
                <select
                  value={getSceneReviewState(activeScene)}
                  onChange={(e) => handleSetSceneReviewState(e.target.value as any)}
                  aria-label="Scene Review Status"
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-400/50 cursor-pointer"
                >
                  <option value="not_reviewed">Not Reviewed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="needs_attention">Needs Attention</option>
                  <option value="blocked">Blocked</option>
                </select>

                <button
                  type="button"
                  onClick={handleToggleSceneReview}
                  data-testid="toggle-scene-review-btn"
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-1.5 cursor-pointer ${
                    getSceneReviewState(activeScene) === 'reviewed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{getSceneReviewState(activeScene) === 'reviewed' ? 'Reviewed' : 'Mark Reviewed'}</span>
                </button>

                {onNavigateTab && (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('screenplay', 'library')}
                      title="Jump to canonical screenplay scene"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Script ↗</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateTab('calendar')}
                      title="Open in Schedule (Stripboard)"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Schedule ↗</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 2. Sheet View Switcher & Departmental Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400 font-mono">View Layout:</span>
                <div className="inline-flex p-0.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setSheetViewMode('compartments')}
                    data-testid="scene-view-compartments-btn"
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer ${
                      sheetViewMode === 'compartments'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Departmental Compartments</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetViewMode('list')}
                    data-testid="scene-view-list-btn"
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer ${
                      sheetViewMode === 'list'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>All Elements (List)</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onSwitchToCatalog && onSwitchToCatalog()}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 text-xs rounded-xl font-mono flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Master Catalog</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAddModal()}
                  data-testid="add-element-to-scene-btn"
                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Element</span>
                </button>
              </div>
            </div>

            {/* Screenplay Multi-Category Extraction Scanner */}
            {extractedSuggestions.length > 0 && (
              <div
                data-testid="multi-category-extraction-panel"
                className="p-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 space-y-3 shadow-md"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-200">
                      Multi-Category Script Scanner ({extractedSuggestions.length} requirements detected)
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Script Grounded
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmAllExtracted}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm All Extracted</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-cinema">
                  {extractedSuggestions.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-black/50 border border-white/10 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white tracking-tight">{req.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-white/10 text-slate-300 border border-white/5">
                              {req.category}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                                req.evidenceType === 'explicit'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {req.evidenceType === 'explicit' ? 'Explicit' : 'Inferred'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 italic font-mono bg-white/[0.03] p-1.5 rounded border border-white/5 line-clamp-2">
                          "{req.evidencePassage}"
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => setDismissedExtractionIds((prev) => new Set(prev).add(req.id))}
                          className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmExtractedRequirement(req)}
                          className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-[11px] flex items-center gap-1 cursor-pointer transition shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Confirm &amp; Add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Sheet Body: Departmental Compartments View */}
            {sheetViewMode === 'compartments' ? (
              <div className="flex-1 overflow-y-auto space-y-4 min-h-[360px] pr-1 scrollbar-cinema">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* Compartment 1: Cast */}
                  <div className="p-3.5 rounded-2xl border border-purple-500/30 bg-[#161224]/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2 mb-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-purple-300 font-mono">
                          <Users className="w-4 h-4 text-purple-400" />
                          <span>Cast Members</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                            {(activeScene.characters || []).length + activeSceneAssocs.filter(a => normalizeElementCategory(a.element.category) === 'cast').length}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenAddModal('cast')}
                            title="Add Cast Member"
                            className="p-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Speaking characters extracted from scene */}
                      {activeScene.characters && activeScene.characters.length > 0 && (
                        <div className="mb-2 space-y-1">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/80">
                            Speaking Characters:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {activeScene.characters.map((charName, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-950/60 text-purple-200 border border-purple-800/60"
                              >
                                {charName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tagged Cast Elements */}
                      {activeSceneAssocs.filter(a => normalizeElementCategory(a.element.category) === 'cast').map(assoc => (
                        <div
                          key={assoc.id}
                          data-testid={`scene-element-card-${assoc.id}`}
                          className="p-2 rounded-xl bg-purple-950/40 border border-purple-800/40 mb-1.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">{assoc.element.name}</span>
                            {assoc.notes && <span className="text-[11px] text-purple-300/80 italic">{assoc.notes}</span>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAssoc(assoc)}
                              data-testid={`edit-assoc-btn-${assoc.id}`}
                              className="p-1 rounded hover:bg-purple-900/60 text-zinc-300"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAssoc(assoc)}
                              data-testid={`remove-assoc-btn-${assoc.id}`}
                              className="p-1 rounded hover:bg-rose-950 text-rose-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddModal('cast')}
                      className="w-full mt-2 py-1 text-[11px] rounded-lg border border-dashed border-purple-500/30 text-purple-300 hover:bg-purple-500/10 font-mono transition text-center cursor-pointer"
                    >
                      + Tag Cast Element
                    </button>
                  </div>

                  {/* Compartments for all other departments */}
                  {[
                    { id: 'background', label: 'Background / Extras', icon: UserCheck, color: 'text-violet-300', border: 'border-violet-500/30', bg: 'bg-[#141220]/80' },
                    { id: 'prop', label: 'Props', icon: Box, color: 'text-amber-300', border: 'border-amber-500/30', bg: 'bg-[#1b1712]/80' },
                    { id: 'set_dressing', label: 'Set Dressing & Greens', icon: Armchair, color: 'text-lime-300', border: 'border-lime-500/30', bg: 'bg-[#141b12]/80' },
                    { id: 'wardrobe', label: 'Costumes / Wardrobe', icon: Shirt, color: 'text-pink-300', border: 'border-pink-500/30', bg: 'bg-[#1b1218]/80' },
                    { id: 'hair_makeup', label: 'Hair & Makeup', icon: Sparkles, color: 'text-rose-300', border: 'border-rose-500/30', bg: 'bg-[#1b1215]/80' },
                    { id: 'vehicle', label: 'Vehicles / Picture Cars', icon: Car, color: 'text-blue-300', border: 'border-blue-500/30', bg: 'bg-[#121620]/80' },
                    { id: 'stunt', label: 'Stunts', icon: ShieldAlert, color: 'text-red-300', border: 'border-red-500/30', bg: 'bg-[#1f1214]/80' },
                    { id: 'sfx', label: 'Special Effects (SFX)', icon: Flame, color: 'text-orange-300', border: 'border-orange-500/30', bg: 'bg-[#1d1512]/80' },
                    { id: 'vfx', label: 'Visual Effects (VFX)', icon: Wand2, color: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-[#121a1f]/80' },
                    { id: 'sound', label: 'Sound / Music', icon: Volume2, color: 'text-teal-300', border: 'border-teal-500/30', bg: 'bg-[#121d1b]/80' },
                    { id: 'animal', label: 'Animals / Greenery', icon: Dog, color: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-[#121c17]/80' },
                    { id: 'special_equipment', label: 'Special Equipment', icon: Camera, color: 'text-indigo-300', border: 'border-indigo-500/30', bg: 'bg-[#141424]/80' },
                    { id: 'other', label: 'Notes / Other Elements', icon: Tag, color: 'text-zinc-300', border: 'border-zinc-700/50', bg: 'bg-[#14161a]/80' },
                  ].map((dept) => {
                    const Icon = dept.icon;
                    const items = activeSceneAssocs.filter(
                      a => normalizeElementCategory(a.element.category) === dept.id
                    );

                    return (
                      <div
                        key={dept.id}
                        className={`p-3.5 rounded-2xl border ${dept.border} ${dept.bg} flex flex-col justify-between`}
                      >
                        <div>
                          <div className={`flex items-center justify-between border-b border-white/10 pb-2 mb-2`}>
                            <span className={`flex items-center gap-1.5 text-xs font-bold ${dept.color} font-mono`}>
                              <Icon className="w-4 h-4" />
                              <span>{dept.label}</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300 font-mono">
                                {items.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenAddModal(dept.id as any)}
                                title={`Add ${dept.label}`}
                                className="p-1 rounded bg-white/10 text-zinc-300 hover:bg-white/20 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {items.length === 0 ? (
                            <div className="py-3 text-center text-[11px] text-zinc-500 italic">
                              None required for this scene
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {items.map((assoc) => (
                                <div
                                  key={assoc.id}
                                  data-testid={`scene-element-card-${assoc.id}`}
                                  className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-white truncate">{assoc.element.name}</span>
                                      {assoc.quantity !== undefined && (
                                        <span className="text-[10px] font-mono text-zinc-400">×{assoc.quantity}</span>
                                      )}
                                    </div>
                                    {assoc.notes && (
                                      <div className="text-[11px] text-amber-300/80 italic truncate">{assoc.notes}</div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditAssoc(assoc)}
                                      data-testid={`edit-assoc-btn-${assoc.id}`}
                                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteAssoc(assoc)}
                                      data-testid={`remove-assoc-btn-${assoc.id}`}
                                      className="p-1 rounded hover:bg-rose-950 text-zinc-400 hover:text-rose-300"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(dept.id as any)}
                          className={`w-full mt-2 py-1 text-[11px] rounded-lg border border-dashed border-white/15 text-zinc-400 hover:text-white hover:bg-white/5 font-mono transition text-center cursor-pointer`}
                        >
                          + Add {dept.label.split(' ')[0]}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* 3. Sheet Body: Linear List View */
              <div className="space-y-4 flex-1 flex flex-col min-h-[360px]">
                {/* Category Pill Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setElementCategoryFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer shrink-0 ${
                      elementCategoryFilter === 'ALL'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    All Elements ({activeSceneAssocs.length})
                  </button>

                  {Object.values(PRODUCTION_ELEMENT_TAXONOMY).map((tax) => {
                    const count = activeSceneAssocs.filter(
                      (a) => normalizeElementCategory(a.element.category) === tax.id
                    ).length;
                    if (count === 0 && elementCategoryFilter !== tax.id) return null;

                    return (
                      <button
                        key={tax.id}
                        type="button"
                        onClick={() => setElementCategoryFilter(tax.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          elementCategoryFilter === tax.id
                            ? 'bg-zinc-100 text-zinc-950 font-bold'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        {renderCategoryIcon(tax.id, 'w-3 h-3')}
                        <span>{tax.shortLabel}</span>
                        <span className="text-[10px] px-1 rounded-full bg-black/30">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Associated Elements List */}
                <div className="flex-1 overflow-y-auto space-y-2.5">
                  {filteredSceneAssocs.length === 0 ? (
                    <div className="py-16 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                        <Box className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-white mb-1">
                        {elementCategoryFilter === 'ALL'
                          ? 'No Production Elements in Scene'
                          : `No ${PRODUCTION_ELEMENT_TAXONOMY[elementCategoryFilter]?.name || 'Elements'}`}
                      </h4>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
                        Tag cast, props, vehicles, wardrobe, or SFX to track requirements for this scene.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal()}
                        className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs rounded-xl font-mono inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tag First Element</span>
                      </button>
                    </div>
                  ) : (
                    filteredSceneAssocs.map((assoc) => {
                      const normalizedCat = normalizeElementCategory(assoc.element.category);
                      const tax = PRODUCTION_ELEMENT_TAXONOMY[normalizedCat] || PRODUCTION_ELEMENT_TAXONOMY.other;
                      const otherSceneCount = associations.filter((a) => a.elementId === assoc.elementId).length;

                      return (
                        <div
                          key={assoc.id}
                          data-testid={`scene-element-card-${assoc.id}`}
                          className="p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-850 hover:border-zinc-750 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`p-2 rounded-xl shrink-0 ${tax.badgeClass}`}>
                              {renderCategoryIcon(normalizedCat, 'w-4 h-4')}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white truncate">
                                  {assoc.element.name}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${tax.badgeClass}`}>
                                  {tax.shortLabel}
                                </span>
                                {renderStatusBadge(assoc.status)}
                                {assoc.provenance === 'extracted' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                                    Script Sync
                                  </span>
                                )}
                                {otherSceneCount > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => onSwitchToCatalog && onSwitchToCatalog(assoc.elementId)}
                                    title="View in Element Master Catalog"
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer"
                                  >
                                    Used in {otherSceneCount} scenes
                                  </button>
                                )}
                              </div>

                              {/* Scene Specific Quantity & Notes */}
                              <div className="text-xs text-zinc-400 mt-1 flex items-center gap-3 flex-wrap">
                                {assoc.quantity !== undefined && (
                                  <span className="font-mono text-zinc-300">
                                    Qty: <strong className="text-white">{assoc.quantity}</strong>
                                  </span>
                                )}
                                {assoc.notes && (
                                  <span className="text-amber-200/90 italic">
                                    Note: {assoc.notes}
                                  </span>
                                )}
                                {assoc.element.description && !assoc.notes && (
                                  <span className="text-zinc-500 truncate max-w-sm">
                                    {assoc.element.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Row Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAssoc(assoc)}
                              data-testid={`edit-assoc-btn-${assoc.id}`}
                              title="Edit scene-specific details"
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAssoc(assoc)}
                              data-testid={`remove-assoc-btn-${assoc.id}`}
                              title="Remove from this scene (remains in Master Catalog)"
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center text-zinc-500">
            Select a scene from the left column to view its breakdown.
          </div>
        )}
      </div>

      {/* MODAL 1: Add Element to Scene */}
      {isAddModalOpen && activeScene && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0E17] border border-zinc-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Add Element to Scene #{activeScene.sceneNumber}
                </h3>
                <p className="text-xs text-zinc-400">Choose from existing catalog or create a new element</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setAddMode('catalog')}
                className={`py-2 rounded-xl transition cursor-pointer font-bold ${
                  addMode === 'catalog' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Pick from Catalog
              </button>
              <button
                type="button"
                onClick={() => setAddMode('new')}
                className={`py-2 rounded-xl transition cursor-pointer font-bold ${
                  addMode === 'new' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Create New Element
              </button>
            </div>

            {addMode === 'catalog' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search Master Catalog..."
                      className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <select
                    value={catalogCategoryFilter}
                    onChange={(e) => setCatalogCategoryFilter(e.target.value as any)}
                    className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-xl px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="ALL">All Categories</option>
                    {Object.values(PRODUCTION_ELEMENT_TAXONOMY).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 scrollbar-cinema">
                  {availableCatalogElements.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      No matching unassociated elements found in catalog. Switch to "Create New Element".
                    </div>
                  ) : (
                    availableCatalogElements.map((el) => {
                      const tax = PRODUCTION_ELEMENT_TAXONOMY[el.category] || PRODUCTION_ELEMENT_TAXONOMY.other;
                      return (
                        <div
                          key={el.id}
                          className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-850 flex items-center justify-between gap-3 text-left"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`p-1.5 rounded-lg ${tax.badgeClass}`}>
                              {renderCategoryIcon(el.category, 'w-3.5 h-3.5')}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{el.name}</div>
                              <div className="text-[10px] text-zinc-400 font-mono">{tax.name}</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddExistingFromCatalog(el.id)}
                            className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAndAddElement} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">Element Name *</label>
                  <input
                    type="text"
                    required
                    value={newElemName}
                    onChange={(e) => setNewElemName(e.target.value)}
                    placeholder="e.g. Hero Revolver, Yellow Raincoat, Stunt Double..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Category *</label>
                    <select
                      value={newElemCategory}
                      onChange={(e) => setNewElemCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                    >
                      {Object.values(PRODUCTION_ELEMENT_TAXONOMY).map((tax) => (
                        <option key={tax.id} value={tax.id}>
                          {tax.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Scene Quantity</label>
                    <input
                      type="text"
                      value={newElemQty}
                      onChange={(e) => setNewElemQty(e.target.value)}
                      placeholder="1, 2, Hero..."
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">Scene Specific Notes</label>
                  <input
                    type="text"
                    value={newElemNotes}
                    onChange={(e) => setNewElemNotes(e.target.value)}
                    placeholder="e.g. Must be soaked in water; Left side only..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">Global Catalog Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={newElemDesc}
                    onChange={(e) => setNewElemDesc(e.target.value)}
                    placeholder="General description for future scenes..."
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create &amp; Add</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Scene Association */}
      {editingAssoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditAssoc}
            className="bg-[#0B0E17] border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl text-left"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Edit Scene Requirement
                </h3>
                <p className="text-xs text-emerald-400 font-mono">{editingAssoc.element.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAssoc(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Scene Quantity</label>
                <input
                  type="text"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  placeholder="1, 2, Pack..."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Requirement Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as BreakdownRequirementStatus)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="needed">Needed</option>
                  <option value="acquired">Acquired</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="omitted">Omitted</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Scene Specific Notes</label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Continuity notes, damage, special preparation for this scene..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Review State</label>
              <select
                value={editReviewState}
                onChange={(e) => setEditReviewState(e.target.value as BreakdownAssociationReviewState)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
              >
                <option value="unreviewed">Unreviewed</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingAssoc(null)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Confirm Remove from Scene */}
      {confirmDeleteAssoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0E17] border border-zinc-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-left">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Remove Element from Scene?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                This removes <strong>"{confirmDeleteAssoc.element.name}"</strong> from Scene #{activeScene?.sceneNumber}.
                The element will <strong>not</strong> be deleted from the project's Element Master Catalog.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setConfirmDeleteAssoc(null)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveAssoc}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Remove from Scene
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
