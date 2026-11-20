import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  FileDown,
  ImageOff,
  ImagePlus,
  Plus,
  Presentation,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { FilmProject, ParsedScene } from '../../../types';
import type {
  LookbookRecord,
  LookbookSectionItemRecord,
  LookbookSectionRecord,
  VisualReferenceAsset,
  VisualizeProductionStore,
} from '../types';
import {
  LOOKBOOK_DEPARTMENT_SUGGESTIONS,
  addAssetToLookbookSection,
  addLookbookSection,
  compressStoryboardImageFile,
  createLookbook,
  deleteLookbook,
  deleteLookbookSection,
  registerSharedReferenceAsset,
  removeLookbookSectionItem,
  reorderLookbookSectionItems,
  reorderLookbookSections,
  updateLookbook,
  updateLookbookSection,
  updateLookbookSectionItem,
} from '../services/visualizeFoundationService';
import { SharedReferencePickerModal } from './SharedReferencePickerModal';
import { LookbookPresentationModal } from './LookbookPresentationModal';

interface LookbooksViewProps {
  project: FilmProject;
  scenes: ParsedScene[];
  visualizeStore: VisualizeProductionStore;
  canEdit: boolean;
  onUpdateProject?: (updated: FilmProject) => void;
}

export const LookbooksView: React.FC<LookbooksViewProps> = ({
  project,
  scenes,
  visualizeStore,
  canEdit,
  onUpdateProject,
}) => {
  const lookbooks = useMemo(
    () =>
      [...(visualizeStore.lookbooks || [])].sort(
        (a, b) => a.sortOrder - b.sortOrder
      ),
    [visualizeStore.lookbooks]
  );

  const assetMap = useMemo(() => {
    const map = new Map<string, VisualReferenceAsset>();
    visualizeStore.referenceAssets.forEach((a) => map.set(a.id, a));
    return map;
  }, [visualizeStore.referenceAssets]);

  const sceneMap = useMemo(() => {
    const map = new Map<string, ParsedScene>();
    scenes.forEach((s) => map.set(s.id, s));
    return map;
  }, [scenes]);

  const [activeLookbookId, setActiveLookbookId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [confirmDeleteLookbook, setConfirmDeleteLookbook] = useState(false);
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(
    null
  );
  const [pickerTargetSectionId, setPickerTargetSectionId] = useState<string | null>(null);
  const [showPresentation, setShowPresentation] = useState(false);
  const [brokenAssetIds, setBrokenAssetIds] = useState<Record<string, boolean>>({});

  // Create/Edit Lookbook Metadata State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formCoverAssetId, setFormCoverAssetId] = useState('');
  const [formStatus, setFormStatus] = useState<LookbookRecord['status']>('draft');
  const [formSceneIds, setFormSceneIds] = useState<string[]>([]);

  const projectRef = useRef(project);
  projectRef.current = project;

  const applyProjectUpdate = (transform: (latest: FilmProject) => FilmProject) => {
    if (!canEdit || !onUpdateProject) return;
    const next = transform(projectRef.current);
    projectRef.current = next;
    onUpdateProject(next);
  };

  const activeLookbook: LookbookRecord | null = useMemo(
    () => lookbooks.find((lb) => lb.id === activeLookbookId) || null,
    [lookbooks, activeLookbookId]
  );

  const openCreateForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormDepartment('');
    setFormCoverAssetId('');
    setFormStatus('draft');
    setFormSceneIds([]);
    setShowCreateModal(true);
  };

  const openEditMeta = (lb: LookbookRecord) => {
    setFormTitle(lb.title);
    setFormDescription(lb.description || '');
    setFormDepartment(lb.department || '');
    setFormCoverAssetId(lb.coverAssetId || '');
    setFormStatus(lb.status);
    setFormSceneIds(lb.linkedSceneIds || []);
    setEditingMeta(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onUpdateProject) return;
    const { updatedProject, lookbook } = createLookbook(project, {
      title: formTitle.trim() || 'Untitled Lookbook',
      description: formDescription,
      department: formDepartment,
      coverAssetId: formCoverAssetId || undefined,
      status: formStatus,
      linkedSceneIds: formSceneIds,
    });
    onUpdateProject(updatedProject);
    setShowCreateModal(false);
    setActiveLookbookId(lookbook.id);
  };

  const handleSaveMetaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onUpdateProject || !activeLookbook) return;
    onUpdateProject(
      updateLookbook(project, activeLookbook.id, {
        title: formTitle,
        description: formDescription,
        department: formDepartment,
        coverAssetId: formCoverAssetId || undefined,
        status: formStatus,
        linkedSceneIds: formSceneIds,
      })
    );
    setEditingMeta(false);
  };

  const handleToggleStatus = () => {
    if (!canEdit || !onUpdateProject || !activeLookbook) return;
    onUpdateProject(
      updateLookbook(project, activeLookbook.id, {
        status: activeLookbook.status === 'draft' ? 'published' : 'draft',
      })
    );
  };

  const handleDeleteLookbook = () => {
    if (!canEdit || !onUpdateProject || !activeLookbook) return;
    onUpdateProject(deleteLookbook(project, activeLookbook.id));
    setConfirmDeleteLookbook(false);
    setActiveLookbookId(null);
  };

  const handleAddSection = () => {
    if (!canEdit || !onUpdateProject || !activeLookbook) return;
    const { updatedProject } = addLookbookSection(project, activeLookbook.id, {
      title: `Section ${activeLookbook.sections.length + 1}`,
    });
    onUpdateProject(updatedProject);
  };

  const handleReorderSections = (sectionId: string, direction: -1 | 1) => {
    if (!canEdit || !onUpdateProject || !activeLookbook) return;
    const sorted = [...activeLookbook.sections].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((s) => s.id === sectionId);
    const nextIdx = idx + direction;
    if (idx === -1 || nextIdx < 0 || nextIdx >= sorted.length) return;
    const ids = sorted.map((s) => s.id);
    const [moved] = ids.splice(idx, 1);
    ids.splice(nextIdx, 0, moved);
    applyProjectUpdate((latest) => reorderLookbookSections(latest, activeLookbook.id, ids));
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!canEdit || !onUpdateProject || !activeLookbook) return;
    applyProjectUpdate((latest) => deleteLookbookSection(latest, activeLookbook.id, sectionId));
    setConfirmDeleteSectionId(null);
  };

  const handleAttachExistingToSection = (assetId: string) => {
    if (!canEdit || !onUpdateProject || !activeLookbook || !pickerTargetSectionId) return;
    const targetSecId = pickerTargetSectionId;
    applyProjectUpdate((latest) =>
      addAssetToLookbookSection(latest, activeLookbook.id, targetSecId, assetId)
    );
  };

  const handleUploadNewToSection = async (file: File) => {
    if (!canEdit || !onUpdateProject || !activeLookbook || !pickerTargetSectionId) return;
    const targetSecId = pickerTargetSectionId;
    const compressed = await compressStoryboardImageFile(file);
    applyProjectUpdate((latest) => {
      const { updatedProject, asset } = registerSharedReferenceAsset(latest, {
        originalFilename: compressed.originalFilename,
        thumbnailDataUrl: compressed.dataUrl,
        mimeType: compressed.mimeType,
        fileSizeBytes: compressed.fileSizeBytes,
        description: `Lookbook: ${activeLookbook.title}`,
        tags: [
          'lookbook',
          activeLookbook.department
            ? activeLookbook.department.toLowerCase()
            : 'presentation',
        ],
        source: 'Lookbook Upload',
      });
      return addAssetToLookbookSection(updatedProject, activeLookbook.id, targetSecId, asset.id);
    });
  };

  const handleReorderSectionItems = (
    section: LookbookSectionRecord,
    itemId: string,
    direction: -1 | 1
  ) => {
    if (!canEdit || !onUpdateProject || !activeLookbook) return;
    const sorted = [...section.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((i) => i.id === itemId);
    const nextIdx = idx + direction;
    if (idx === -1 || nextIdx < 0 || nextIdx >= sorted.length) return;
    const ids = sorted.map((i) => i.id);
    const [moved] = ids.splice(idx, 1);
    ids.splice(nextIdx, 0, moved);
    applyProjectUpdate((latest) =>
      reorderLookbookSectionItems(latest, activeLookbook.id, section.id, ids)
    );
  };

  // --- LANDING INDEX VIEW ---
  if (!activeLookbook) {
    return (
      <div
        id="lookbooks-landing-view"
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-sm md:text-base font-semibold text-yellow-100">
              Lookbooks
            </h2>
            <p className="text-xs text-slate-400">
              Curated, section-structured visual direction presentations for department heads and key collaborators.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              data-testid="create-lookbook-btn"
              onClick={openCreateForm}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Lookbook
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {lookbooks.length === 0 ? (
            <div
              id="lookbooks-empty-state"
              className="h-full min-h-[320px] flex items-center justify-center"
            >
              <div className="max-w-md w-full rounded-2xl border border-dashed border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20/80 p-8 text-center space-y-4">
                <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-yellow-100">
                    No lookbooks created yet
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Organise curated visual references into structured chapters for camera, lighting, production design, or costume in{' '}
                    <span className="text-slate-200 font-medium">{project.title}</span>.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    data-testid="create-first-lookbook-btn"
                    onClick={openCreateForm}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Lookbook
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              id="lookbooks-cards-grid"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8"
            >
              {lookbooks.map((lb) => {
                const coverAsset = lb.coverAssetId
                  ? assetMap.get(lb.coverAssetId) || null
                  : null;
                const fallbackFirstItem = lb.sections[0]?.items[0]?.assetId
                  ? assetMap.get(lb.sections[0].items[0].assetId) || null
                  : null;
                const hero = coverAsset || fallbackFirstItem;
                const totalPlates = lb.sections.reduce(
                  (sum, s) => sum + s.items.length,
                  0
                );

                return (
                  <button
                    key={lb.id}
                    type="button"
                    data-lookbook-id={lb.id}
                    onClick={() => setActiveLookbookId(lb.id)}
                    className="group rounded-2xl border border-[#FFD34E]/25 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 hover:border-[#F5F000]/45 overflow-hidden text-left flex flex-col transition-all cursor-pointer"
                  >
                    {/* Editorial Cover Slate */}
                    <div className="aspect-[16/9] w-full bg-[#0A0B0D] border-b border-[#FFD34E]/20 flex items-center justify-center overflow-hidden p-2">
                      {hero && (hero.thumbnailDataUrl || hero.storageRef) ? (
                        <img
                          src={hero.thumbnailDataUrl || hero.storageRef}
                          alt={lb.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-600">
                          <BookOpen className="w-5 h-5" />
                          <span className="text-[11px]">No cover plate selected</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-400 truncate">
                            {lb.department || 'Production Lookbook'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${
                              lb.status === 'published'
                                ? 'border-emerald-400/25 bg-emerald-950/50 text-emerald-200'
                                : 'border-white/10 bg-[#15171A] border border-[#FFD34E]/20 text-slate-300'
                            }`}
                          >
                            {lb.status === 'published' ? 'Presentation Ready' : 'Draft'}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-yellow-100 group-hover:text-white leading-snug">
                          {lb.title}
                        </h3>
                        {lb.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">
                            {lb.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span>
                          {lb.sections.length}{' '}
                          {lb.sections.length === 1 ? 'section' : 'sections'} · {totalPlates}{' '}
                          {totalPlates === 1 ? 'plate' : 'plates'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {showCreateModal && (
          <LookbookFormModal
            heading="New Curated Lookbook"
            submitLabel="Create Lookbook"
            title={formTitle}
            description={formDescription}
            department={formDepartment}
            coverAssetId={formCoverAssetId}
            status={formStatus}
            linkedSceneIds={formSceneIds}
            scenes={scenes}
            referenceAssets={visualizeStore.referenceAssets}
            onChangeTitle={setFormTitle}
            onChangeDescription={setFormDescription}
            onChangeDepartment={setFormDepartment}
            onChangeCoverAssetId={setFormCoverAssetId}
            onChangeStatus={setFormStatus}
            onToggleScene={(id) =>
              setFormSceneIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateSubmit}
          />
        )}
      </div>
    );
  }

  // --- ACTIVE LOOKBOOK SECTION EDITOR ---
  const sortedSections = [...activeLookbook.sections].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <div
      id="lookbooks-editor-view"
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
    >
      {/* Editorial Top Bar */}
      <div className="px-5 py-3 border-b border-[#FFD34E]/20 bg-[#15171A]/85 backdrop-blur-xl border-b border-[#FFD34E]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            data-testid="lookbook-back-btn"
            onClick={() => {
              setActiveLookbookId(null);
              setConfirmDeleteLookbook(false);
              setConfirmDeleteSectionId(null);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-xs text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            All Lookbooks
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm md:text-base font-semibold text-yellow-100 truncate">
                {activeLookbook.title}
              </h2>
              {activeLookbook.department && (
                <span className="px-2 py-0.5 rounded-full border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 text-[10px] font-medium text-yellow-400">
                  {activeLookbook.department}
                </span>
              )}
              {canEdit ? (
                <button
                  type="button"
                  data-testid="lookbook-toggle-status-btn"
                  onClick={handleToggleStatus}
                  title="Toggle Draft / Presentation Ready status"
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-medium cursor-pointer ${
                    activeLookbook.status === 'published'
                      ? 'border-emerald-400/25 bg-emerald-950/50 text-emerald-200'
                      : 'border-white/10 bg-[#15171A] border border-[#FFD34E]/20 text-slate-300'
                  }`}
                >
                  {activeLookbook.status === 'published' ? 'Presentation Ready' : 'Draft'}
                </button>
              ) : (
                <span className="px-2 py-0.5 rounded-full border border-white/10 bg-[#15171A] border border-[#FFD34E]/20 text-[10px] text-slate-300">
                  {activeLookbook.status === 'published' ? 'Presentation Ready' : 'Draft'}
                </span>
              )}
              {activeLookbook.linkedSceneIds.map((scId) => {
                const sc = sceneMap.get(scId);
                if (!sc) return null;
                return (
                  <span
                    key={scId}
                    className="px-1.5 py-0.5 rounded border border-white/10 bg-[#0A0B0D] border-b border-[#FFD34E]/20 font-mono text-[10px] text-slate-300"
                  >
                    SC {sc.sceneNumber}
                  </span>
                );
              })}
            </div>
            {activeLookbook.description && (
              <p className="text-[11px] text-slate-400 truncate max-w-2xl">
                {activeLookbook.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <button
              type="button"
              data-testid="lookbook-edit-meta-btn"
              onClick={() => openEditMeta(activeLookbook)}
              className="px-2.5 py-1.5 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-xs text-slate-300 hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Details & Cover
            </button>
          )}

          <button
            type="button"
            data-testid="lookbook-present-btn"
            onClick={() => setShowPresentation(true)}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Presentation className="w-3.5 h-3.5" />
            Present
          </button>

          <button
            type="button"
            data-testid="lookbook-direct-pdf-btn"
            onClick={() => {
              setShowPresentation(true);
              setTimeout(() => window.print(), 120);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#FFD34E]/30 bg-[#1F2226] text-yellow-200 text-xs text-yellow-100 hover:border-white/30 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export PDF
          </button>

          {canEdit &&
            (confirmDeleteLookbook ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="lookbook-confirm-delete-btn"
                  onClick={handleDeleteLookbook}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-xs font-medium text-rose-200 cursor-pointer"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteLookbook(false)}
                  className="px-2 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="lookbook-delete-btn"
                onClick={() => setConfirmDeleteLookbook(true)}
                title="Delete Lookbook (preserves shared assets)"
                className="p-2 rounded-lg border border-[#FFD34E]/25 bg-[#1F2226] text-amber-200 hover:border-[#F5F000]/50 text-slate-400 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ))}
        </div>
      </div>

      {/* Sections Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
          {sortedSections.length === 0 ? (
            <div
              id="lookbook-empty-sections-state"
              className="rounded-2xl border border-dashed border-white/15 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20/80 p-10 text-center space-y-4"
            >
              <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-[#1F2226] border border-[#FFD34E]/25 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-yellow-100">
                  No sections in this lookbook yet
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Add your first section (for example: Camera & Optics, Lighting & Contrast, or Location References) and populate it with curated visual plates.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  data-testid="lookbook-add-first-section-btn"
                  onClick={handleAddSection}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Section
                </button>
              )}
            </div>
          ) : (
            sortedSections.map((section, secIdx) => {
              const sortedItems = [...section.items].sort(
                (a, b) => a.sortOrder - b.sortOrder
              );
              return (
                <section
                  key={section.id}
                  data-lookbook-section-id={section.id}
                  className="rounded-2xl border border-[#FFD34E]/25 bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 overflow-hidden"
                >
                  {/* Section Header & Editorial Text */}
                  <div className="p-5 border-b border-[#FFD34E]/20 bg-[#131824] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-white/[0.07] text-yellow-400 shrink-0">
                          {String(secIdx + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          value={section.title}
                          disabled={!canEdit}
                          data-testid={`lookbook-section-title-${secIdx + 1}`}
                          onChange={(e) =>
                            applyProjectUpdate((latest) =>
                              updateLookbookSection(
                                latest,
                                activeLookbook.id,
                                section.id,
                                { title: e.target.value }
                              )
                            )
                          }
                          className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-sm font-semibold text-yellow-100 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 focus:outline-none disabled:opacity-75"
                        />
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={secIdx === 0}
                            onClick={() => handleReorderSections(section.id, -1)}
                            title="Move section up"
                            className="p-1.5 rounded-lg border border-white/10 bg-[#0e121a] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={secIdx === sortedSections.length - 1}
                            onClick={() => handleReorderSections(section.id, 1)}
                            title="Move section down"
                            className="p-1.5 rounded-lg border border-white/10 bg-[#0e121a] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            data-testid={`lookbook-section-add-ref-${secIdx + 1}`}
                            onClick={() => setPickerTargetSectionId(section.id)}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] hover:from-[#FFF1A8] hover:to-[#FFD34E] text-stone-950 font-bold shadow-[0_0_16px_rgba(245,240,0,0.35)] font-bold shadow-[0_0_12px_rgba(250,204,21,0.35)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ImagePlus className="w-3.5 h-3.5" />
                            Add Reference
                          </button>

                          {confirmDeleteSectionId === section.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                data-testid={`lookbook-confirm-del-sec-${secIdx + 1}`}
                                onClick={() => handleDeleteSection(section.id)}
                                className="px-2 py-1 rounded bg-rose-500/20 border border-rose-400/40 text-[11px] font-medium text-rose-200 cursor-pointer"
                              >
                                Remove Section
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSectionId(null)}
                                className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              data-testid={`lookbook-del-sec-${secIdx + 1}`}
                              onClick={() => setConfirmDeleteSectionId(section.id)}
                              title="Remove section"
                              className="p-1.5 rounded-lg border border-white/10 bg-[#0e121a] text-slate-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <textarea
                        rows={2}
                        value={section.summary || ''}
                        disabled={!canEdit}
                        data-testid={`lookbook-section-summary-${secIdx + 1}`}
                        onChange={(e) =>
                          applyProjectUpdate((latest) =>
                            updateLookbookSection(
                              latest,
                              activeLookbook.id,
                              section.id,
                              { summary: e.target.value }
                            )
                          )
                        }
                        placeholder="Short explanatory direction for this chapter..."
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 focus:outline-none resize-none"
                      />
                      <textarea
                        rows={2}
                        value={section.creativeNotes || ''}
                        disabled={!canEdit}
                        data-testid={`lookbook-section-notes-${secIdx + 1}`}
                        onChange={(e) =>
                          applyProjectUpdate((latest) =>
                            updateLookbookSection(
                              latest,
                              activeLookbook.id,
                              section.id,
                              { creativeNotes: e.target.value }
                            )
                          )
                        }
                        placeholder="Creative direction notes (lighting ratio, lens texture, tonal rules)..."
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-slate-300 font-mono text-[11px] placeholder:text-slate-600 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 focus:outline-none resize-none"
                      />
                    </div>
                  </div>

                  {/* Curated Section Visual Plates */}
                  <div className="p-5">
                    {sortedItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
                        No visual plates in this section yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortedItems.map((item: LookbookSectionItemRecord, itemIdx) => {
                          const asset = assetMap.get(item.assetId) || null;
                          const src = asset?.thumbnailDataUrl || asset?.storageRef;
                          const isBroken = !asset || Boolean(brokenAssetIds[asset.id]);

                          return (
                            <div
                              key={item.id}
                              data-lb-item-id={item.id}
                              className="rounded-xl border border-[#FFD34E]/25 bg-[#0A0B0D] border-b border-[#FFD34E]/20 overflow-hidden flex flex-col"
                            >
                              <div className="aspect-[16/10] w-full bg-[#07090d] border-b border-[#FFD34E]/20 flex items-center justify-center p-2 overflow-hidden">
                                {src && !isBroken ? (
                                  <img
                                    src={src}
                                    alt={item.caption || asset?.originalFilename || 'Lookbook plate'}
                                    onError={() =>
                                      asset &&
                                      setBrokenAssetIds((prev) => ({
                                        ...prev,
                                        [asset.id]: true,
                                      }))
                                    }
                                    className="max-w-full max-h-full w-auto h-auto object-contain rounded"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-1 text-slate-500">
                                    <ImageOff className="w-5 h-5" />
                                    <span className="text-[11px]">Image unavailable</span>
                                  </div>
                                )}
                              </div>

                              <div className="p-3 space-y-2 text-xs">
                                <input
                                  type="text"
                                  value={item.caption || ''}
                                  disabled={!canEdit}
                                  data-testid={`lookbook-item-caption-${secIdx + 1}-${itemIdx + 1}`}
                                  onChange={(e) =>
                                    applyProjectUpdate((latest) =>
                                      updateLookbookSectionItem(
                                        latest,
                                        activeLookbook.id,
                                        section.id,
                                        item.id,
                                        { caption: e.target.value }
                                      )
                                    )
                                  }
                                  placeholder="Plate caption..."
                                  className="w-full px-2.5 py-1.5 rounded bg-[#15171A]/85 backdrop-blur-xl border border-[#FFD34E]/20 border border-white/10 text-yellow-100 text-xs focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 focus:outline-none"
                                />

                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <span className="text-[10px] font-mono text-slate-500 truncate">
                                    {asset?.originalFilename || 'Unavailable asset'}
                                  </span>

                                  {canEdit && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        disabled={itemIdx === 0}
                                        onClick={() =>
                                          handleReorderSectionItems(section, item.id, -1)
                                        }
                                        aria-label={`Move section ${secIdx + 1} image ${
                                          itemIdx + 1
                                        } earlier`}
                                        className="p-1 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                      >
                                        <ArrowLeft className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={itemIdx === sortedItems.length - 1}
                                        onClick={() =>
                                          handleReorderSectionItems(section, item.id, 1)
                                        }
                                        aria-label={`Move section ${secIdx + 1} image ${
                                          itemIdx + 1
                                        } later`}
                                        className="p-1 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                      >
                                        <ArrowRight className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateProject?.(
                                            removeLookbookSectionItem(
                                              project,
                                              activeLookbook.id,
                                              section.id,
                                              item.id
                                            )
                                          )
                                        }
                                        title="Remove plate from section (preserves shared asset)"
                                        aria-label={`Remove section ${secIdx + 1} image ${
                                          itemIdx + 1
                                        }`}
                                        className="p-1 rounded border border-white/10 text-slate-400 hover:text-rose-300 cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })
          )}

          {canEdit && sortedSections.length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                data-testid="lookbook-add-section-btn"
                onClick={handleAddSection}
                className="px-4 py-2 rounded-xl border border-[#FFD34E]/30 bg-[#1F2226] text-yellow-200 hover:border-[#F5F000]/40 text-xs font-medium text-yellow-100 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Section
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shared Reference Picker Modal for active Section */}
      <SharedReferencePickerModal
        isOpen={Boolean(pickerTargetSectionId)}
        title="Add Visual Reference to Section"
        referenceAssets={visualizeStore.referenceAssets}
        alreadyAttachedAssetIds={
          sortedSections
            .find((s) => s.id === pickerTargetSectionId)
            ?.items.map((i) => i.assetId) || []
        }
        canEdit={canEdit}
        onClose={() => setPickerTargetSectionId(null)}
        onSelectAsset={handleAttachExistingToSection}
        onUploadNewAsset={handleUploadNewToSection}
      />

      {editingMeta && (
        <LookbookFormModal
          heading="Lookbook Details & Cover"
          submitLabel="Save Lookbook"
          title={formTitle}
          description={formDescription}
          department={formDepartment}
          coverAssetId={formCoverAssetId}
          status={formStatus}
          linkedSceneIds={formSceneIds}
          scenes={scenes}
          referenceAssets={visualizeStore.referenceAssets}
          onChangeTitle={setFormTitle}
          onChangeDescription={setFormDescription}
          onChangeDepartment={setFormDepartment}
          onChangeCoverAssetId={setFormCoverAssetId}
          onChangeStatus={setFormStatus}
          onToggleScene={(id) =>
            setFormSceneIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onClose={() => setEditingMeta(false)}
          onSubmit={handleSaveMetaSubmit}
        />
      )}

      {showPresentation && (
        <LookbookPresentationModal
          lookbook={activeLookbook}
          productionTitle={project.title}
          scenes={scenes}
          referenceAssets={visualizeStore.referenceAssets}
          onClose={() => setShowPresentation(false)}
        />
      )}
    </div>
  );
};

interface LookbookFormModalProps {
  heading: string;
  submitLabel: string;
  title: string;
  description: string;
  department: string;
  coverAssetId: string;
  status: LookbookRecord['status'];
  linkedSceneIds: string[];
  scenes: ParsedScene[];
  referenceAssets: VisualReferenceAsset[];
  onChangeTitle: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeDepartment: (v: string) => void;
  onChangeCoverAssetId: (v: string) => void;
  onChangeStatus: (v: LookbookRecord['status']) => void;
  onToggleScene: (sceneId: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const LookbookFormModal: React.FC<LookbookFormModalProps> = ({
  heading,
  submitLabel,
  title,
  description,
  department,
  coverAssetId,
  status,
  linkedSceneIds,
  scenes,
  referenceAssets,
  onChangeTitle,
  onChangeDescription,
  onChangeDepartment,
  onChangeCoverAssetId,
  onChangeStatus,
  onToggleScene,
  onClose,
  onSubmit,
}) => (
  <div
    data-testid="lookbook-form-modal"
    className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-text"
  >
    <form
      onSubmit={onSubmit}
      className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#120f06]/95 backdrop-blur-2xl border border-[#F5F000]/35 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
    >
      <div className="px-5 py-3.5 border-b border-[#FFD34E]/25 bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-yellow-100">{heading}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4 text-xs overflow-y-auto">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Lookbook Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            data-testid="lookbook-input-title"
            placeholder="e.g. Harbor Nocturne — Photography Lookbook"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-yellow-100 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Department / Creative Discipline (Optional)
          </label>
          <input
            type="text"
            value={department}
            onChange={(e) => onChangeDepartment(e.target.value)}
            data-testid="lookbook-input-department"
            placeholder="e.g. Cinematography, Production Design..."
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-yellow-100 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {LOOKBOOK_DEPARTMENT_SUGGESTIONS.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => onChangeDepartment(dept)}
                className={`px-2 py-0.5 rounded-full border text-[10px] cursor-pointer ${
                  department === dept
                    ? 'border-[#F5F000]/50 bg-[#F5F000]/15 text-yellow-100'
                    : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
            data-testid="lookbook-input-description"
            placeholder="Statement of visual direction for department heads..."
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-yellow-100 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 focus:outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Cover Image (Shared Library)
            </label>
            <select
              value={coverAssetId}
              onChange={(e) => onChangeCoverAssetId(e.target.value)}
              data-testid="lookbook-select-cover"
              className="w-full px-2.5 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-slate-200 focus:outline-none"
            >
              <option value="">Auto / None</option>
              {referenceAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.originalFilename}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Presentation State
            </label>
            <select
              value={status}
              onChange={(e) => onChangeStatus(e.target.value as LookbookRecord['status'])}
              data-testid="lookbook-select-status"
              className="w-full px-2.5 py-2 rounded-lg bg-black/40 border border-[#FFD34E]/20 border border-white/10 text-slate-200 focus:outline-none"
            >
              <option value="draft">Draft</option>
              <option value="published">Presentation Ready</option>
            </select>
          </div>
        </div>

        {scenes.length > 0 && (
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
              Associated Screenplay Scenes (Optional)
            </label>
            <div className="max-h-24 overflow-y-auto rounded-lg border border-white/10 bg-black/40 border border-[#FFD34E]/20 p-2 space-y-1">
              {scenes.map((sc) => {
                const active = linkedSceneIds.includes(sc.id);
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => onToggleScene(sc.id)}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center justify-between cursor-pointer ${
                      active
                        ? 'bg-[#F5F000]/15 text-yellow-100'
                        : 'text-slate-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="truncate">
                      SC {sc.sceneNumber} — {sc.slugline}
                    </span>
                    {active && <span className="text-[10px] font-mono">Linked</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-3.5 border-t border-[#FFD34E]/25 bg-[#15171A] border border-[#FFD34E]/20 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="lookbook-submit-btn"
          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)] text-xs font-semibold cursor-pointer"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  </div>
);
