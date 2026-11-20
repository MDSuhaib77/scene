import React, { useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  Clapperboard,
  Eye,
  Film,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { CrewMember, FilmProject } from '../../../types';
import type { DiscussionRecordTarget } from '../../../services/contracts/types';
import type {
  DirectoryEntryKind,
  DirectoryEntryRecord,
  ProductionWorkspaceStore,
} from '../types';
import {
  createDirectoryEntry,
  deleteDirectoryEntry,
  getCanonicalProductionScenes,
  resolvePhaseCrewEntries,
  toggleArchiveDirectoryEntry,
  updateDirectoryEntry,
} from '../services/productionStoreService';

interface ProductionDirectoryViewProps {
  project: FilmProject;
  productionStore: ProductionWorkspaceStore;
  canEdit: boolean;
  onUpdateProject?: (updated: FilmProject) => void;
  onAddCrew?: (phaseId: string, member: Omit<CrewMember, 'id'>) => void;
  onDeleteCrew?: (phaseId: string, crewId: string) => void;
  onUpdateCrewStatus?: (phaseId: string, crewId: string, status: CrewMember['status']) => void;
  onOpenDiscussion?: (target: DiscussionRecordTarget) => void;
}

type DirectoryFilterTab = 'all' | DirectoryEntryKind;

const KIND_LABELS: Record<DirectoryEntryKind, string> = {
  cast: 'Cast',
  crew: 'Crew',
  contact: 'Contact',
  vendor: 'Vendor',
  location: 'Location',
};

export const ProductionDirectoryView: React.FC<ProductionDirectoryViewProps> = ({
  project,
  productionStore,
  canEdit,
  onUpdateProject,
  onDeleteCrew,
  onUpdateCrewStatus,
  onOpenDiscussion,
}) => {
  const [filterKind, setFilterKind] = useState<DirectoryFilterTab>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [inspectingEntry, setInspectingEntry] = useState<DirectoryEntryRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create / Edit Form Draft State
  const [kind, setKind] = useState<DirectoryEntryKind>('crew');
  const [name, setName] = useState('');
  const [roleOrCategory, setRoleOrCategory] = useState('');
  const [secondaryRolesInput, setSecondaryRolesInput] = useState<string[]>([]);
  const [newExtraRole, setNewExtraRole] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [services, setServices] = useState('');
  const [address, setAddress] = useState('');
  const [nearestHospital, setNearestHospital] = useState('');
  const [parkingNotes, setParkingNotes] = useState('');
  const [status, setStatus] = useState<NonNullable<DirectoryEntryRecord['status']>>('Confirmed');
  const [notes, setNotes] = useState('');

  const phaseCrew = useMemo(() => resolvePhaseCrewEntries(project), [project]);
  const canonicalScenes = useMemo(
    () => getCanonicalProductionScenes(project),
    [project]
  );

  // Live cross-module references: which scenes & shooting days each Directory entry touches
  const entryReferencesMap = useMemo(() => {
    const map = new Map<string, { sceneNumbers: string[]; shootDays: number[] }>();
    productionStore.directoryEntries.forEach((entry) => {
      const nameLower = entry.name.toLowerCase();
      const matchedScenes = canonicalScenes
        .filter((sc) => {
          if (entry.kind === 'location') {
            return (sc.location || '').toLowerCase().includes(nameLower) ||
              nameLower.includes((sc.location || '').toLowerCase());
          }
          if (entry.kind === 'cast') {
            const roleUpper = (entry.roleOrCategory || '').toUpperCase();
            return (sc.characters || []).some(
              (c) =>
                c.toLowerCase() === nameLower ||
                (roleUpper && c.toUpperCase() === roleUpper)
            );
          }
          return false;
        })
        .map((sc) => sc.sceneNumber);

      const shootDays = productionStore.shootingDays
        .filter((day) => {
          if (day.locationId === entry.id) return true;
          const cs = productionStore.callSheets.find((c) => c.shootingDayId === day.id);
          if (!cs) return false;
          return cs.locationId === entry.id || cs.directoryEntryIds.includes(entry.id);
        })
        .map((d) => d.dayNumber);

      map.set(entry.id, {
        sceneNumbers: Array.from(new Set(matchedScenes)),
        shootDays: Array.from(new Set(shootDays)),
      });
    });
    return map;
  }, [
    productionStore.directoryEntries,
    productionStore.shootingDays,
    productionStore.callSheets,
    canonicalScenes,
  ]);

  const canonicalLocationHints = useMemo(() => {
    const existingLocNames = new Set(
      productionStore.directoryEntries
        .filter((e) => e.kind === 'location')
        .map((e) => e.name.toLowerCase())
    );
    const locs = new Set<string>();
    canonicalScenes.forEach((s) => {
      if (s.location && !existingLocNames.has(s.location.toLowerCase())) {
        locs.add(s.location);
      }
    });
    return Array.from(locs).slice(0, 8);
  }, [canonicalScenes, productionStore.directoryEntries]);

  const filteredDirectory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productionStore.directoryEntries.filter((entry) => {
      const isArchived = Boolean(entry.archived);
      if (showArchived !== isArchived) return false;
      if (filterKind !== 'all' && entry.kind !== filterKind) return false;
      if (!q) return true;
      return [
        entry.name,
        entry.roleOrCategory,
        ...(entry.secondaryRoles || []),
        entry.department,
        entry.company,
        entry.services,
        entry.address,
        entry.parkingNotes,
        entry.email,
        entry.phone,
        entry.notes,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [productionStore.directoryEntries, filterKind, showArchived, query]);

  const filteredLegacyCrew = useMemo(() => {
    if (showArchived) return [];
    if (filterKind !== 'all' && filterKind !== 'crew') return [];
    const q = query.trim().toLowerCase();
    if (!q) return phaseCrew;
    return phaseCrew.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        (c.department || '').toLowerCase().includes(q)
    );
  }, [phaseCrew, showArchived, filterKind, query]);

  const activeCount =
    productionStore.directoryEntries.filter((e) => !e.archived).length + phaseCrew.length;
  const archivedCount = productionStore.directoryEntries.filter((e) => e.archived).length;

  const openAddModalWithPreset = (presetKind: DirectoryEntryKind, presetName = '') => {
    setEditingEntryId(null);
    setKind(presetKind);
    setName(presetName);
    setRoleOrCategory(
      presetKind === 'location'
        ? 'Primary Set Location'
        : presetKind === 'vendor'
        ? 'Equipment / Production Vendor'
        : ''
    );
    setSecondaryRolesInput([]);
    setNewExtraRole('');
    setDepartment('');
    setEmail('');
    setPhone('');
    setCompany('');
    setServices('');
    setAddress('');
    setNearestHospital('');
    setParkingNotes('');
    setStatus('Confirmed');
    setNotes('');
    setShowFormModal(true);
  };

  const openEditModalForEntry = (entry: DirectoryEntryRecord) => {
    setEditingEntryId(entry.id);
    setKind(entry.kind);
    setName(entry.name);
    setRoleOrCategory(entry.roleOrCategory);
    setSecondaryRolesInput(entry.secondaryRoles || []);
    setNewExtraRole('');
    setDepartment(entry.department || '');
    setEmail(entry.email || '');
    setPhone(entry.phone || '');
    setCompany(entry.company || '');
    setServices(entry.services || '');
    setAddress(entry.address || '');
    setNearestHospital(entry.nearestHospital || '');
    setParkingNotes(entry.parkingNotes || '');
    setStatus(entry.status || 'Confirmed');
    setNotes(entry.notes || '');
    setShowFormModal(true);
  };

  const handleAddSecondaryRole = () => {
    const trimmed = newExtraRole.trim();
    if (!trimmed) return;
    if (!secondaryRolesInput.includes(trimmed) && trimmed !== roleOrCategory.trim()) {
      setSecondaryRolesInput((prev) => [...prev, trimmed]);
    }
    setNewExtraRole('');
  };

  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onUpdateProject || !name.trim()) return;

    const cleanSecondary = secondaryRolesInput.map((r) => r.trim()).filter(Boolean);

    if (editingEntryId) {
      const updatedProject = updateDirectoryEntry(project, editingEntryId, {
        kind,
        name: name.trim(),
        roleOrCategory: roleOrCategory.trim() || KIND_LABELS[kind],
        secondaryRoles: cleanSecondary.length > 0 ? cleanSecondary : undefined,
        department: department.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        services: services.trim() || undefined,
        address: address.trim() || undefined,
        nearestHospital: nearestHospital.trim() || undefined,
        parkingNotes: parkingNotes.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
      });
      onUpdateProject(updatedProject);
    } else {
      const { updatedProject } = createDirectoryEntry(project, {
        kind,
        name: name.trim(),
        roleOrCategory: roleOrCategory.trim() || KIND_LABELS[kind],
        secondaryRoles: cleanSecondary,
        department,
        email,
        phone,
        company,
        services,
        address,
        nearestHospital,
        parkingNotes,
        status,
        notes,
      });
      onUpdateProject(updatedProject);
    }

    setShowFormModal(false);
    setEditingEntryId(null);
  };

  return (
    <div
      id="production-directory-section"
      className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6"
    >
      <div className="max-w-6xl mx-auto space-y-5 pb-10">
        {/* Top Controls & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap items-center rounded-xl bg-[#10090D]/80 border border-[#E63950]/25 border border-[#E63950]/20 p-1 gap-1">
              {(
                [
                  { id: 'all', label: `All (${activeCount})` },
                  { id: 'cast', label: 'Cast' },
                  { id: 'crew', label: 'Crew' },
                  { id: 'contact', label: 'Contacts' },
                  { id: 'vendor', label: 'Vendors' },
                  { id: 'location', label: 'Locations' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`directory-filter-${tab.id}`}
                  onClick={() => setFilterKind(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                    filterKind === tab.id
                      ? 'bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_12px_rgba(255,23,68,0.35)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-testid="directory-toggle-archived-btn"
              onClick={() => setShowArchived((v) => !v)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer transition ${
                showArchived
                  ? 'border-[#FF1744]/60 bg-[#65152D]/70 text-white shadow-[0_0_12px_rgba(255,23,68,0.25)]'
                  : 'border-[#E63950]/20 bg-[#10090D]/80 text-rose-300/70 hover:text-white'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? `Archived (${archivedCount})` : `Archive (${archivedCount})`}
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search directory..."
                className="w-52 rounded-lg border border-white/10 bg-[#10090D] border border-[#E63950]/25 pl-8 pr-2.5 py-1.5 text-xs text-rose-100 placeholder:text-slate-600 focus:outline-none"
              />
            </div>

            {canEdit && (
              <button
                type="button"
                data-testid="directory-add-btn"
                onClick={() =>
                  openAddModalWithPreset(filterKind === 'all' ? 'crew' : filterKind)
                }
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white hover:from-[#FF5368] hover:to-[#FF1744] shadow-[0_0_10px_rgba(255,23,68,0.35)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Entry
              </button>
            )}
          </div>
        </div>

        {/* Helpful Screenplay Location Suggestions (read-only hints; zero auto-seeding) */}
        {!showArchived &&
          canEdit &&
          canonicalLocationHints.length > 0 &&
          (filterKind === 'all' || filterKind === 'location') && (
            <div className="rounded-xl border border-[#E63950]/15 bg-[#26151F]/70 border border-[#E63950]/20 p-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-mono text-slate-400">
                Script Locations:
              </span>
              {canonicalLocationHints.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => openAddModalWithPreset('location', loc)}
                  className="px-2 py-1 rounded-lg border border-[#E63950]/30 bg-[#26151F] hover:border-[#FF1744]/50 text-[11px] text-rose-200 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-[#FF8A9B]" />
                  {loc}
                </button>
              ))}
            </div>
          )}

        {/* Directory Entries Grid */}
        {filteredDirectory.length === 0 && filteredLegacyCrew.length === 0 ? (
          <div
            id="production-directory-empty-state"
            className="rounded-2xl border border-dashed border-white/15 bg-[#1A1017]/85 border border-dashed border-[#E63950]/30 p-10 text-center space-y-3"
          >
            <Users className="w-6 h-6 text-[#FF8A9B] mx-auto" />
            <h3 className="text-sm font-semibold text-rose-100">
              {showArchived ? 'No archived directory entries' : 'No directory entries yet'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {showArchived
                ? 'Archived cast, crew, vendors, contacts, and locations can be restored at any time.'
                : 'Add cast, crew, contacts, vendors, and shooting locations here. Call sheets in Shoot reference these exact records directly.'}
            </p>
            {canEdit && !showArchived && (
              <button
                type="button"
                data-testid="directory-empty-add-btn"
                onClick={() =>
                  openAddModalWithPreset(filterKind === 'all' ? 'crew' : filterKind)
                }
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_10px_rgba(255,23,68,0.3)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add First Entry
              </button>
            )}
          </div>
        ) : (
          <div
            id="production-directory-list"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"
          >
            {filteredDirectory.map((entry: DirectoryEntryRecord) => {
              const refs = entryReferencesMap.get(entry.id) || {
                sceneNumbers: [],
                shootDays: [],
              };
              return (
                <div
                  key={entry.id}
                  data-directory-entry-id={entry.id}
                  className="rounded-xl border border-[#E63950]/20 bg-[#1A1017]/85 border border-[#E63950]/20 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-white/[0.07] font-mono text-[10px] uppercase tracking-wider text-[#FF8A9B]">
                          {KIND_LABELS[entry.kind]}
                        </span>
                        {entry.status && (
                          <span className="px-1.5 py-0.5 rounded border border-white/10 text-[9px] font-mono text-slate-400">
                            {entry.status}
                          </span>
                        )}
                      </div>
                      {entry.department && (
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          {entry.department}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-semibold text-rose-100">{entry.name}</h4>
                    <div className="text-xs text-slate-400">
                      {entry.roleOrCategory}
                      {entry.company ? ` · ${entry.company}` : ''}
                    </div>

                    {entry.secondaryRoles && entry.secondaryRoles.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {entry.secondaryRoles.map((role, rIdx) => (
                          <span
                            key={`${entry.id}-sr-${rIdx}`}
                            className="px-1.5 py-0.5 rounded bg-[#26151F] border border-[#E63950]/30 border border-white/10 text-[10px] text-slate-300"
                          >
                            + {role}
                          </span>
                        ))}
                      </div>
                    )}

                    {entry.kind === 'vendor' && entry.services && (
                      <div className="pt-1 flex items-start gap-1.5 text-[11px] text-slate-300">
                        <Wrench className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span>{entry.services}</span>
                      </div>
                    )}

                    {entry.kind === 'location' &&
                      (entry.address || entry.nearestHospital || entry.parkingNotes) && (
                        <div className="pt-1 space-y-1 text-[11px] text-slate-300">
                          {entry.address && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span>{entry.address}</span>
                            </div>
                          )}
                          {entry.nearestHospital && (
                            <div className="flex items-start gap-1.5 text-slate-400">
                              <Building2 className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>Hospital: {entry.nearestHospital}</span>
                            </div>
                          )}
                          {entry.parkingNotes && (
                            <div className="text-[10.5px] text-slate-400">
                              Access: {entry.parkingNotes}
                            </div>
                          )}
                        </div>
                      )}

                    {(entry.phone || entry.email) && (
                      <div className="pt-1 space-y-0.5 text-[11px] text-slate-400 font-mono">
                        {entry.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            <span>{entry.phone}</span>
                          </div>
                        )}
                        {entry.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{entry.email}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {(refs.sceneNumbers.length > 0 || refs.shootDays.length > 0) && (
                      <div className="pt-1.5 flex flex-wrap gap-1.5 text-[10px] font-mono">
                        {refs.shootDays.map((dayNum) => (
                          <span
                            key={`sd-${dayNum}`}
                            className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-400/20 text-emerald-200 inline-flex items-center gap-1"
                          >
                            <Clapperboard className="w-2.5 h-2.5" />
                            Day {dayNum}
                          </span>
                        ))}
                        {refs.sceneNumbers.slice(0, 4).map((scNum) => (
                          <span
                            key={`sc-${scNum}`}
                            className="px-1.5 py-0.5 rounded bg-indigo-950/40 border border-indigo-400/20 text-indigo-200 inline-flex items-center gap-1"
                          >
                            <Film className="w-2.5 h-2.5" />
                            SC {scNum}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid={`dir-view-btn-${entry.id}`}
                        onClick={() => setInspectingEntry(entry)}
                        className="px-2 py-1 rounded border border-white/10 text-[11px] text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>

                      {onOpenDiscussion && (
                        <button
                          type="button"
                          data-testid={`dir-discuss-btn-${entry.id}`}
                          onClick={() =>
                            onOpenDiscussion({
                              entityType: 'directory_entry',
                              entityId: entry.id,
                              entityLabel: `${entry.name} (${entry.roleOrCategory})`,
                            })
                          }
                          className="px-2 py-1 rounded border border-cyan-500/30 bg-cyan-950/30 text-[11px] text-cyan-200 hover:bg-cyan-950/50 inline-flex items-center gap-1 cursor-pointer"
                          title="Discuss this Directory entry"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Discuss
                        </button>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`dir-edit-btn-${entry.id}`}
                          onClick={() => openEditModalForEntry(entry)}
                          className="p-1.5 rounded border border-white/10 text-slate-400 hover:text-[#FF8A9B] cursor-pointer"
                          title="Edit record"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          data-testid={`dir-archive-btn-${entry.id}`}
                          onClick={() =>
                            onUpdateProject?.(toggleArchiveDirectoryEntry(project, entry.id))
                          }
                          className="p-1.5 rounded border border-white/10 text-slate-400 hover:text-amber-200 cursor-pointer"
                          title={entry.archived ? 'Restore to active directory' : 'Archive record'}
                        >
                          {entry.archived ? (
                            <RotateCcw className="w-3 h-3" />
                          ) : (
                            <Archive className="w-3 h-3" />
                          )}
                        </button>

                        {confirmDeleteId === entry.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateProject?.(deleteDirectoryEntry(project, entry.id));
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-500/20 border border-rose-400/40 text-[11px] text-rose-200 cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-1 text-[11px] text-slate-400 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(entry.id)}
                            className="p-1.5 rounded border border-white/10 text-slate-400 hover:text-rose-300 cursor-pointer"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Existing Legacy Phase Crew projection (reuses CrewRolodex phase.crew directly) */}
            {filteredLegacyCrew.map((member) => (
              <div
                key={`phase-crew-${member.phaseId}-${member.id}`}
                className="rounded-xl border border-[#E63950]/20 bg-[#1A1017]/85 border border-[#E63950]/20 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/[0.07] font-mono text-[10px] uppercase tracking-wider text-[#FF8A9B]">
                      Crew
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 truncate">
                      {member.phaseName}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-rose-100">{member.name}</h4>
                  <div className="text-xs text-slate-400">{member.role}</div>
                  <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                    {member.phone && member.phone !== 'n/a' && <div>{member.phone}</div>}
                    {member.email && member.email !== 'n/a' && (
                      <div className="truncate">{member.email}</div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2">
                  <select
                    value={member.status}
                    disabled={!canEdit}
                    onChange={(e) =>
                      onUpdateCrewStatus?.(
                        member.phaseId,
                        member.id,
                        e.target.value as CrewMember['status']
                      )
                    }
                    className="px-2 py-1 rounded bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-[11px] text-slate-200"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Negotiating">Negotiating</option>
                    <option value="Hold">Hold</option>
                  </select>
                  {canEdit && onDeleteCrew && (
                    <button
                      type="button"
                      onClick={() => onDeleteCrew(member.phaseId, member.id)}
                      className="p-1.5 rounded border border-white/10 text-slate-400 hover:text-rose-300 cursor-pointer"
                      title="Remove crew member"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Record Detail Modal */}
      {inspectingEntry && (
        <div
          data-testid="directory-detail-modal"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-text"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#1A1017] border border-[#E63950]/20 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-5 py-3.5 border-b border-[#E63950]/20 bg-[#26151F]/80 border border-[#E63950]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-white/[0.08] font-mono text-[10px] uppercase text-[#FF8A9B]">
                  {KIND_LABELS[inspectingEntry.kind]}
                </span>
                <h3 className="text-sm font-semibold text-rose-100">
                  {inspectingEntry.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingEntry(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-500">
                  Primary Role / Classification
                </div>
                <div className="text-sm text-rose-100 mt-0.5">
                  {inspectingEntry.roleOrCategory}
                </div>
              </div>

              {inspectingEntry.secondaryRoles && inspectingEntry.secondaryRoles.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">
                    Additional Roles (Unified Record)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inspectingEntry.secondaryRoles.map((r, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-[#26151F] border border-[#E63950]/30 border border-white/10 text-slate-200"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">
                    Department / Company
                  </span>
                  <span className="text-slate-200">
                    {inspectingEntry.company || inspectingEntry.department || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">
                    Status
                  </span>
                  <span className="text-slate-200">{inspectingEntry.status || 'Confirmed'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Phone</span>
                  <span className="text-slate-200">{inspectingEntry.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Email</span>
                  <span className="text-slate-200 break-all">{inspectingEntry.email || '—'}</span>
                </div>
              </div>

              {inspectingEntry.kind === 'vendor' && inspectingEntry.services && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">
                    Services Provided
                  </span>
                  <p className="text-slate-200 mt-0.5">{inspectingEntry.services}</p>
                </div>
              )}

              {inspectingEntry.kind === 'location' && (
                <div className="space-y-2 rounded-xl border border-[#E63950]/15 bg-[#10090D]/80 border border-[#E63950]/25 p-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      Address
                    </span>
                    <span className="text-slate-200">{inspectingEntry.address || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      Access & Parking Notes
                    </span>
                    <span className="text-slate-200">{inspectingEntry.parkingNotes || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      Nearest Hospital
                    </span>
                    <span className="text-slate-200">
                      {inspectingEntry.nearestHospital || '—'}
                    </span>
                  </div>
                </div>
              )}

              {inspectingEntry.notes && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">
                    Notes
                  </span>
                  <p className="text-slate-300 whitespace-pre-wrap mt-0.5">
                    {inspectingEntry.notes}
                  </p>
                </div>
              )}

              {(() => {
                const refs = entryReferencesMap.get(inspectingEntry.id);
                if (!refs || (refs.sceneNumbers.length === 0 && refs.shootDays.length === 0)) {
                  return null;
                }
                return (
                  <div className="pt-2 border-t border-[#E63950]/15">
                    <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5">
                      Associated Production References ({project.title})
                    </div>
                    <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                      {refs.shootDays.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-400/20 text-emerald-200"
                        >
                          Shoot Day {d}
                        </span>
                      ))}
                      {refs.sceneNumbers.map((sc) => (
                        <span
                          key={sc}
                          className="px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-400/20 text-indigo-200"
                        >
                          Scene {sc}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-5 py-3 border-t border-[#E63950]/20 bg-[#26151F]/80 border border-[#E63950]/20 flex justify-end gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectingEntry;
                    setInspectingEntry(null);
                    openEditModalForEntry(target);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_10px_rgba(255,23,68,0.3)] text-xs font-semibold cursor-pointer"
                >
                  Edit Record
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectingEntry(null)}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Directory Entry Modal */}
      {showFormModal && (
        <div
          data-testid="directory-add-modal"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-text"
        >
          <form
            onSubmit={handleSubmitEntry}
            className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#1A1017] border border-[#E63950]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-3.5 border-b border-[#E63950]/20 bg-[#26151F]/80 border border-[#E63950]/20 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-rose-100">
                {editingEntryId ? 'Edit Directory Entry' : 'Add Directory Entry'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  setEditingEntryId(null);
                }}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Classification
                  </label>
                  <select
                    value={kind}
                    data-testid="dir-input-kind"
                    onChange={(e) => setKind(e.target.value as DirectoryEntryKind)}
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                  >
                    <option value="cast">Cast</option>
                    <option value="crew">Crew</option>
                    <option value="contact">Contact</option>
                    <option value="vendor">Vendor</option>
                    <option value="location">Location</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    {kind === 'location'
                      ? 'Location Name'
                      : kind === 'vendor'
                      ? 'Vendor / Company Name'
                      : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    data-testid="dir-input-name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      kind === 'location' ? 'e.g. Harbor Observatory Pier' : 'e.g. Ananya Rao'
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    {kind === 'vendor' ? 'Vendor Category' : 'Primary Role / Type'}
                  </label>
                  <input
                    type="text"
                    value={roleOrCategory}
                    data-testid="dir-input-role"
                    onChange={(e) => setRoleOrCategory(e.target.value)}
                    placeholder={kind === 'location' ? 'e.g. Exterior Dock' : 'e.g. Gaffer / KARA'}
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    {kind === 'vendor' ? 'Primary Contact Person' : 'Department / Company'}
                  </label>
                  <input
                    type="text"
                    value={kind === 'vendor' ? company : department}
                    onChange={(e) =>
                      kind === 'vendor' ? setCompany(e.target.value) : setDepartment(e.target.value)
                    }
                    placeholder={kind === 'vendor' ? 'Rep name' : 'Department'}
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                  />
                </div>
              </div>

              {/* Multi-role support on single person record */}
              {(kind === 'cast' || kind === 'crew' || kind === 'contact') && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-slate-400 block">
                    Additional Roles (Same Record, No Duplicates)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      data-testid="dir-input-extra-role"
                      value={newExtraRole}
                      onChange={(e) => setNewExtraRole(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSecondaryRole();
                        }
                      }}
                      placeholder="e.g. 2nd Unit Camera Operator"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    />
                    <button
                      type="button"
                      data-testid="dir-add-extra-role-btn"
                      onClick={handleAddSecondaryRole}
                      className="px-3 py-1.5 rounded-lg border border-white/15 bg-[#26151F] border border-[#E63950]/30 text-rose-100 text-slate-200 text-xs cursor-pointer"
                    >
                      Add Role
                    </button>
                  </div>
                  {secondaryRolesInput.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {secondaryRolesInput.map((role, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-[#26151F] border border-[#E63950]/30 border border-white/15 text-[11px] text-slate-200 inline-flex items-center gap-1"
                        >
                          {role}
                          <button
                            type="button"
                            onClick={() =>
                              setSecondaryRolesInput((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-slate-400 hover:text-rose-300 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {kind === 'vendor' && (
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Vendor Details & Services Provided
                  </label>
                  <input
                    type="text"
                    data-testid="dir-input-services"
                    value={services}
                    onChange={(e) => setServices(e.target.value)}
                    placeholder="e.g. ARRI Alexa 35 packages, grip truck, 18k HMI lighting"
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    data-testid="dir-input-phone"
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 ..."
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    data-testid="dir-input-email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@production.com"
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as NonNullable<DirectoryEntryRecord['status']>)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Active">Active</option>
                    <option value="Hold">Hold</option>
                    <option value="Negotiating">Negotiating</option>
                  </select>
                </div>
              </div>

              {kind === 'location' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Physical Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      data-testid="dir-input-address"
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Full shooting location address"
                      className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Access & Parking Notes
                      </label>
                      <input
                        type="text"
                        value={parkingNotes}
                        data-testid="dir-input-parking"
                        onChange={(e) => setParkingNotes(e.target.value)}
                        placeholder="Gate code, dock clearance, load-in hours"
                        className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Nearest Hospital (for Call Sheets)
                      </label>
                      <input
                        type="text"
                        value={nearestHospital}
                        data-testid="dir-input-hospital"
                        onChange={(e) => setNearestHospital(e.target.value)}
                        placeholder="Hospital name & distance"
                        className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#10090D] border border-[#E63950]/25 border border-white/10 text-rose-100 resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-[#E63950]/20 bg-[#26151F]/80 border border-[#E63950]/20 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  setEditingEntryId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="dir-submit-btn"
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_10px_rgba(255,23,68,0.3)] text-xs font-semibold cursor-pointer"
              >
                {editingEntryId ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
