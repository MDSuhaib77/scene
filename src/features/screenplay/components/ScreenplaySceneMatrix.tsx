import React, { useState, useMemo } from 'react';
import {
  Search,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  ArrowUpRight,
  Clapperboard,
  SlidersHorizontal,
  MapPin,
  Clock,
  Users,
  Sparkles,
  Check,
  X,
  Columns2,
  Maximize2,
  FileText,
} from 'lucide-react';
import {
  ParsedScene,
  SceneIntExt,
  SceneTimeOfDay,
  SceneManualOverrides,
} from '../../../types';
import {
  SceneMatrixFilterCriteria,
  filterExtractedScenes,
} from '../services/scriptIntelligenceService';

export interface ScreenplaySceneMatrixProps {
  projectTitle: string;
  draftTitle: string;
  versionLabel?: string;
  sourceDocumentId: string;
  sourceDocFingerprint?: string;
  scenes: ParsedScene[];
  selectedSceneId?: string | null;
  onSelectScene: (scene: ParsedScene) => void;
  onApplyManualOverride: (
    sceneId: string,
    patch: Partial<SceneManualOverrides> & { markReviewed?: boolean }
  ) => void;
  onResetManualOverride: (sceneId: string) => void;
  onToggleSceneReviewed: (sceneId: string) => void;
  onInsertFirstSceneHeading?: () => void;
  layoutMode: 'split' | 'full';
  onChangeLayoutMode: (mode: 'split' | 'full') => void;
  onCloseMatrix: () => void;
  onNavigateToBreakdown?: () => void;
  readOnly?: boolean;
}

const INT_EXT_OPTIONS: SceneIntExt[] = ['INT', 'EXT', 'INT/EXT', 'I/E', 'UNKNOWN'];

const TIME_OF_DAY_OPTIONS: SceneTimeOfDay[] = [
  'DAY',
  'NIGHT',
  'DUSK',
  'DAWN',
  'MORNING',
  'EVENING',
  'AFTERNOON',
  'CONTINUOUS',
  'LATER',
  'SAME TIME',
  'UNSPECIFIED',
];

export const ScreenplaySceneMatrix: React.FC<ScreenplaySceneMatrixProps> = ({
  projectTitle,
  draftTitle,
  versionLabel,
  sourceDocumentId,
  sourceDocFingerprint,
  scenes,
  selectedSceneId,
  onSelectScene,
  onApplyManualOverride,
  onResetManualOverride,
  onToggleSceneReviewed,
  onInsertFirstSceneHeading,
  layoutMode,
  onChangeLayoutMode,
  onCloseMatrix,
  onNavigateToBreakdown,
  readOnly = false,
}) => {
  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [intExtFilter, setIntExtFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [timeOfDayFilter, setTimeOfDayFilter] = useState<string>('ALL');
  const [characterFilter, setCharacterFilter] = useState<string>('ALL');
  const [reviewStateFilter, setReviewStateFilter] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Inline manual correction editor state
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editIntExt, setEditIntExt] = useState<SceneIntExt>('INT');
  const [editLocation, setEditLocation] = useState<string>('');
  const [editTimeOfDay, setEditTimeOfDay] = useState<SceneTimeOfDay>('UNSPECIFIED');
  const [editCharactersInput, setEditCharactersInput] = useState<string>('');

  const uniqueLocations = useMemo(
    () =>
      Array.from(
        new Set(scenes.map((s) => s.location).filter(Boolean))
      ).sort(),
    [scenes]
  );

  const uniqueTimesOfDay = useMemo(
    () =>
      Array.from(
        new Set(scenes.map((s) => s.timeOfDay).filter(Boolean))
      ).sort(),
    [scenes]
  );

  const uniqueCharacters = useMemo(
    () =>
      Array.from(
        new Set(scenes.flatMap((s) => s.characters || []).filter(Boolean))
      ).sort(),
    [scenes]
  );

  const criteria = useMemo<SceneMatrixFilterCriteria>(
    () => ({
      searchQuery,
      intExt: intExtFilter,
      location: locationFilter,
      timeOfDay: timeOfDayFilter,
      character: characterFilter,
      reviewState: reviewStateFilter,
    }),
    [
      searchQuery,
      intExtFilter,
      locationFilter,
      timeOfDayFilter,
      characterFilter,
      reviewStateFilter,
    ]
  );

  const filteredScenes = useMemo(
    () => filterExtractedScenes(scenes, criteria),
    [scenes, criteria]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    intExtFilter !== 'ALL' ||
    locationFilter !== 'ALL' ||
    timeOfDayFilter !== 'ALL' ||
    characterFilter !== 'ALL' ||
    reviewStateFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setIntExtFilter('ALL');
    setLocationFilter('ALL');
    setTimeOfDayFilter('ALL');
    setCharacterFilter('ALL');
    setReviewStateFilter('ALL');
  };

  const handleStartEditing = (scene: ParsedScene) => {
    if (readOnly) return;
    setEditingSceneId(scene.id);
    setEditIntExt(scene.intExt);
    setEditLocation(scene.location);
    setEditTimeOfDay(scene.timeOfDay);
    setEditCharactersInput((scene.characters || []).join(', '));
  };

  const handleSaveEditing = (scene: ParsedScene) => {
    if (readOnly) return;
    const parsedChars = editCharactersInput
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const patch: Partial<SceneManualOverrides> & { markReviewed?: boolean } = {};
    if (editIntExt !== (scene.extractedIntExt ?? scene.intExt)) {
      patch.intExt = editIntExt;
    } else if (scene.manualOverrides?.intExt !== undefined) {
      patch.intExt = editIntExt;
    }

    const trimmedLoc = editLocation.trim().toUpperCase() || 'UNKNOWN LOCATION';
    if (trimmedLoc !== (scene.extractedLocation ?? scene.location)) {
      patch.location = trimmedLoc;
    } else if (scene.manualOverrides?.location !== undefined) {
      patch.location = trimmedLoc;
    }

    if (editTimeOfDay !== (scene.extractedTimeOfDay ?? scene.timeOfDay)) {
      patch.timeOfDay = editTimeOfDay;
    } else if (scene.manualOverrides?.timeOfDay !== undefined) {
      patch.timeOfDay = editTimeOfDay;
    }

    const extractedCharStr = (scene.extractedCharacters || []).join(',');
    if (parsedChars.join(',') !== extractedCharStr) {
      patch.characters = parsedChars;
    } else if (scene.manualOverrides?.characters !== undefined) {
      patch.characters = parsedChars;
    }

    // Even if user confirmed values that match or refine fields, apply override patch
    if (Object.keys(patch).length === 0) {
      patch.location = trimmedLoc;
      patch.timeOfDay = editTimeOfDay;
      patch.intExt = editIntExt;
    }

    onApplyManualOverride(scene.id, patch);
    setEditingSceneId(null);
  };

  const needsReviewTotal = useMemo(
    () => scenes.filter((s) => s.reviewState === 'needs_review').length,
    [scenes]
  );
  const correctedTotal = useMemo(
    () => scenes.filter((s) => s.reviewState === 'manually_corrected').length,
    [scenes]
  );

  const renderReviewBadge = (scene: ParsedScene) => {
    const state = scene.reviewState || 'extracted';
    if (state === 'manually_corrected') {
      return (
        <span
          data-testid={`screenplay-matrix-state-${scene.id}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 text-[10px] font-mono uppercase tracking-wider"
          title="Metadata manually corrected by user (original screenplay text preserved)"
        >
          <Edit3 className="w-2.5 h-2.5" />
          <span>Manually Corrected</span>
        </span>
      );
    }
    if (state === 'reviewed') {
      return (
        <span
          data-testid={`screenplay-matrix-state-${scene.id}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono uppercase tracking-wider"
          title="Verified by user"
        >
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>Reviewed</span>
        </span>
      );
    }
    if (state === 'needs_review') {
      return (
        <span
          data-testid={`screenplay-matrix-state-${scene.id}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 text-[10px] font-mono uppercase tracking-wider"
          title={(scene.reviewReasons || []).join('; ') || 'Needs human review'}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>Needs Review</span>
        </span>
      );
    }
    return (
      <span
        data-testid={`screenplay-matrix-state-${scene.id}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/[0.1] text-[10px] font-mono uppercase tracking-wider"
        title="Deterministically extracted from screenplay elements"
      >
        <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
        <span>Extracted</span>
      </span>
    );
  };

  return (
    <section
      aria-label="Script Intelligence Scene Matrix"
      data-testid="screenplay-scene-matrix"
      className="flex flex-col h-full min-h-0 select-none border-l"
      style={{
        backgroundColor: 'var(--scr-bg-panel)',
        borderColor: 'var(--scr-border-strong)',
        color: 'var(--scr-text-primary)',
      }}
    >
      {/* Top Bar: Document Traceability Context & View Controls */}
      <div
        className="px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0"
        style={{ borderColor: 'var(--scr-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clapperboard className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Script Intelligence — Scene Matrix
              </h2>
              <span
                className="text-[11px] font-medium truncate max-w-[200px] text-emerald-300"
                data-testid="screenplay-matrix-doc-title"
              >
                {draftTitle || projectTitle}
              </span>
              {versionLabel && (
                <span className="px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] font-mono text-slate-300">
                  {versionLabel}
                </span>
              )}
              {sourceDocFingerprint && (
                <span
                  className="hidden md:inline-block px-1.5 py-0.2 rounded bg-black/30 text-[10px] font-mono text-slate-400"
                  title={`Source document ID: ${sourceDocumentId} · Fingerprint: ${sourceDocFingerprint}`}
                  data-testid="screenplay-matrix-fingerprint"
                >
                  #{sourceDocFingerprint}
                </span>
              )}
            </div>
            <div
              className="text-[10px] font-mono flex items-center gap-2 mt-0.5"
              style={{ color: 'var(--scr-text-muted)' }}
            >
              <span data-testid="screenplay-matrix-scene-count">
                {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
              </span>
              <span>•</span>
              <span>{uniqueLocations.length} locations</span>
              <span>•</span>
              <span>{uniqueCharacters.length} characters</span>
              {needsReviewTotal > 0 && (
                <>
                  <span>•</span>
                  <span className="text-cyan-300">
                    {needsReviewTotal} needs review
                  </span>
                </>
              )}
              {correctedTotal > 0 && (
                <>
                  <span>•</span>
                  <span className="text-cyan-300">
                    {correctedTotal} corrected
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              onChangeLayoutMode(layoutMode === 'split' ? 'full' : 'split')
            }
            data-testid="screenplay-matrix-layout-toggle-btn"
            title={
              layoutMode === 'split'
                ? 'Expand Scene Matrix to full width'
                : 'Show Split View alongside manuscript editor'
            }
            className="h-7 px-2 rounded text-[11px] font-medium bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {layoutMode === 'split' ? (
              <>
                <Maximize2 className="w-3 h-3 text-cyan-400" />
                <span>Full Matrix</span>
              </>
            ) : (
              <>
                <Columns2 className="w-3 h-3 text-emerald-400" />
                <span>Split Editor</span>
              </>
            )}
          </button>

          {onNavigateToBreakdown && (
            <button
              type="button"
              onClick={onNavigateToBreakdown}
              data-testid="screenplay-matrix-breakdown-btn"
              title="Open Scene Breakdown with extracted scenes"
              className="h-7 px-2.5 rounded text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Breakdown</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={onCloseMatrix}
            aria-label="Close Scene Matrix"
            data-testid="screenplay-matrix-close-btn"
            title="Return to full manuscript view"
            className="h-7 w-7 rounded inline-flex items-center justify-center text-[#9ba3b4] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar with Progressive Disclosure */}
      {scenes.length > 0 && (
        <div
          className="px-4 py-2 border-b flex flex-col gap-2 shrink-0 bg-black/20"
          style={{ borderColor: 'var(--scr-border)' }}
          data-testid="screenplay-matrix-filter-bar"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#6b7385] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scene #, heading, location..."
                aria-label="Search extracted scenes"
                data-testid="screenplay-matrix-search-input"
                className="w-full h-7 pl-8 pr-2.5 rounded text-xs bg-white/[0.04] border border-white/[0.09] text-slate-100 placeholder:text-[#6b7385] focus:outline-none focus:border-cyan-400/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`h-7 px-2.5 rounded text-[11px] font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                  showFilters || hasActiveFilters
                    ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
                    : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Filters</span>
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  data-testid="screenplay-matrix-reset-filters-btn"
                  className="h-7 px-2.5 rounded text-[11px] font-medium bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {(showFilters || hasActiveFilters) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.04] animate-fade-in">
              <select
                value={intExtFilter}
                onChange={(e) => setIntExtFilter(e.target.value)}
                aria-label="Filter by interior or exterior"
                data-testid="screenplay-matrix-filter-intext"
                className="h-7 px-2 rounded text-[11px] bg-white/[0.04] border border-white/[0.09] text-slate-200 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="ALL" className="bg-[#11151f]">All INT/EXT</option>
                {INT_EXT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-[#11151f]">{opt}</option>
                ))}
              </select>

              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                aria-label="Filter by location"
                data-testid="screenplay-matrix-filter-location"
                className="h-7 px-2 rounded text-[11px] bg-white/[0.04] border border-white/[0.09] text-slate-200 max-w-[160px] truncate focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="ALL" className="bg-[#11151f]">All Locations ({uniqueLocations.length})</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc} className="bg-[#11151f]">{loc}</option>
                ))}
              </select>

              <select
                value={timeOfDayFilter}
                onChange={(e) => setTimeOfDayFilter(e.target.value)}
                aria-label="Filter by time of day"
                data-testid="screenplay-matrix-filter-timeofday"
                className="h-7 px-2 rounded text-[11px] bg-white/[0.04] border border-white/[0.09] text-slate-200 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="ALL" className="bg-[#11151f]">All Times</option>
                {uniqueTimesOfDay.map((tod) => (
                  <option key={tod} value={tod} className="bg-[#11151f]">{tod}</option>
                ))}
              </select>

              <select
                value={characterFilter}
                onChange={(e) => setCharacterFilter(e.target.value)}
                aria-label="Filter by character"
                data-testid="screenplay-matrix-filter-character"
                className="h-7 px-2 rounded text-[11px] bg-white/[0.04] border border-white/[0.09] text-slate-200 max-w-[150px] truncate focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="ALL" className="bg-[#11151f]">All Characters ({uniqueCharacters.length})</option>
                {uniqueCharacters.map((charName) => (
                  <option key={charName} value={charName} className="bg-[#11151f]">{charName}</option>
                ))}
              </select>

              <select
                value={reviewStateFilter}
                onChange={(e) => setReviewStateFilter(e.target.value)}
                aria-label="Filter by review status"
                data-testid="screenplay-matrix-filter-status"
                className="h-7 px-2 rounded text-[11px] bg-white/[0.04] border border-white/[0.09] text-slate-200 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="ALL" className="bg-[#11151f]">All Statuses</option>
                <option value="needs_review" className="bg-[#11151f]">Needs Review</option>
                <option value="manually_corrected" className="bg-[#11151f]">Manually Corrected</option>
                <option value="extracted" className="bg-[#11151f]">Extracted</option>
                <option value="reviewed" className="bg-[#11151f]">Reviewed</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Matrix Body */}
      <div className="flex-1 overflow-auto scrollbar-cinema">
        {scenes.length === 0 ? (
          <div
            data-testid="screenplay-matrix-empty-state"
            className="max-w-md mx-auto my-12 p-6 rounded-xl border border-dashed text-center space-y-3"
            style={{
              borderColor: 'var(--scr-border-strong)',
              color: 'var(--scr-text-secondary)',
            }}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">
              No Scene Headings Detected in Active Document
            </h3>
            <p className="text-xs leading-relaxed">
              Script Intelligence extracts scenes exclusively from semantic{' '}
              <strong>Scene Heading</strong> blocks (such as{' '}
              <code>INT. STUDIO - NIGHT</code>) and never fabricates placeholder
              scenes from ordinary action text.
            </p>
            <p className="text-[11px] font-mono text-slate-400">
              Use the <strong>Scene</strong> button in the authoring toolbar (or
              press <code>Alt+1</code>) to add a Scene Heading to your script.
            </p>
            {onInsertFirstSceneHeading && !readOnly && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onInsertFirstSceneHeading}
                  data-testid="screenplay-matrix-insert-scene-btn"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Clapperboard className="w-3.5 h-3.5" />
                  <span>Add Scene Heading in Editor</span>
                </button>
              </div>
            )}
          </div>
        ) : filteredScenes.length === 0 ? (
          <div
            data-testid="screenplay-matrix-no-filter-matches"
            className="max-w-md mx-auto my-12 p-6 rounded-xl border border-dashed text-center space-y-3"
            style={{
              borderColor: 'var(--scr-border)',
              color: 'var(--scr-text-secondary)',
            }}
          >
            <SlidersHorizontal className="w-5 h-5 text-cyan-400 mx-auto" />
            <p className="text-xs text-slate-200 font-medium">
              No extracted scenes match your active filter criteria.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded bg-white/[0.07] hover:bg-white/[0.12] text-xs text-emerald-300 font-medium cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <table
            className="w-full text-left border-collapse"
            data-testid="screenplay-scene-matrix-table"
          >
            <thead
              className="sticky top-0 z-10 text-[10px] font-mono uppercase tracking-wider border-b"
              style={{
                backgroundColor: 'var(--scr-bg-toolbar)',
                borderColor: 'var(--scr-border-strong)',
                color: 'var(--scr-text-muted)',
              }}
            >
              <tr>
                <th className="py-2.5 px-3 w-16">Scene #</th>
                <th className="py-2.5 px-3 min-w-[200px]">Scene Heading</th>
                <th className="py-2.5 px-2.5 w-20">INT/EXT</th>
                <th className="py-2.5 px-3 min-w-[150px]">Location</th>
                <th className="py-2.5 px-2.5 w-28">Time</th>
                <th className="py-2.5 px-3 min-w-[160px]">Characters</th>
                <th className="py-2.5 px-3 w-44 text-right">Status &amp; Review</th>
              </tr>
            </thead>
            <tbody
              className="divide-y text-xs"
              style={{ borderColor: 'var(--scr-border)' }}
            >
              {filteredScenes.map((scene) => {
                const isSelected = selectedSceneId === scene.id;
                const isEditing = editingSceneId === scene.id;
                const hasOverrides = Boolean(scene.manualOverrides);
                const charAppearances = scene.characterAppearances || [];
                const charAmbiguities = charAppearances.filter((c) => c.isAmbiguous);

                return (
                  <React.Fragment key={scene.id}>
                    <tr
                      data-testid={`screenplay-matrix-row-${scene.id}`}
                      onClick={() => onSelectScene(scene)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/[0.11]'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* 1. Scene Number & Manuscript Page */}
                      <td className="py-2.5 px-3 align-top font-mono">
                        <div className="flex flex-col gap-0.5">
                          <span
                            data-testid={`screenplay-matrix-scenenumber-${scene.id}`}
                            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold text-[11px] w-fit"
                          >
                            #{scene.sceneNumber}
                          </span>
                          <span
                            className="text-[10px] text-slate-400"
                            title={`Starts on manuscript page ${scene.startPage} · Length: ${scene.pageLengthDisplay} pg`}
                          >
                            p. {scene.startPage} · {scene.pageLengthDisplay}
                          </span>
                        </div>
                      </td>

                      {/* 2. Original Scene Heading (Preserved Verbatim) */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="space-y-1">
                          {(scene.actHeading || scene.sequenceHeading) && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {scene.actHeading && (
                                <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-mono text-[9px] uppercase">
                                  {scene.actHeading}
                                </span>
                              )}
                              {scene.sequenceHeading && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-mono text-[9px] uppercase">
                                  {scene.sequenceHeading}
                                </span>
                              )}
                            </div>
                          )}
                          <div
                            data-testid={`screenplay-matrix-heading-${scene.id}`}
                            className="font-mono font-semibold text-slate-100 uppercase tracking-tight leading-snug"
                          >
                            {scene.originalHeading || scene.slugline}
                          </div>
                          {scene.synopsis && (
                            <p
                              className="text-[11px] line-clamp-1"
                              style={{ color: 'var(--scr-text-secondary)' }}
                            >
                              {scene.synopsis}
                            </p>
                          )}
                          {scene.reviewReasons && scene.reviewReasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {scene.reviewReasons.map((reason, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] text-cyan-300/90 bg-cyan-500/10 px-1.5 py-0.2 rounded"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. INT./EXT. Classification */}
                      <td className="py-2.5 px-2.5 align-top font-mono">
                        <span
                          data-testid={`screenplay-matrix-intext-${scene.id}`}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            scene.intExt === 'UNKNOWN'
                              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                              : scene.intExt === 'INT'
                                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                : scene.intExt === 'EXT'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {scene.intExt}
                          {scene.manualOverrides?.intExt && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-cyan-300"
                              title={`Manually corrected from "${scene.extractedIntExt}"`}
                            />
                          )}
                        </span>
                      </td>

                      {/* 4. Normalized Location */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span
                              data-testid={`screenplay-matrix-location-${scene.id}`}
                              className={`font-mono text-[11px] font-medium break-words ${
                                scene.location === 'UNKNOWN LOCATION'
                                  ? 'text-cyan-300 italic'
                                  : 'text-slate-200'
                              }`}
                            >
                              {scene.location}
                            </span>
                            {scene.manualOverrides?.location &&
                              scene.extractedLocation &&
                              scene.manualOverrides.location !==
                                scene.extractedLocation && (
                                <span className="block text-[9px] font-mono text-cyan-300/80">
                                  Extracted: {scene.extractedLocation}
                                </span>
                              )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Time of Day */}
                      <td className="py-2.5 px-2.5 align-top font-mono">
                        <span
                          data-testid={`screenplay-matrix-time-${scene.id}`}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase ${
                            scene.timeOfDay === 'UNSPECIFIED'
                              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                              : scene.timeOfDay === 'NIGHT'
                                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/25'
                                : 'bg-white/[0.06] text-slate-200 border border-white/[0.1]'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5 opacity-75" />
                          <span>{scene.timeOfDay}</span>
                        </span>
                      </td>

                      {/* 6. Character Appearances */}
                      <td className="py-2.5 px-3 align-top">
                        {scene.characters.length === 0 ? (
                          <span className="text-[11px] text-slate-500 italic">
                            No speaking characters
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <div
                              className="flex flex-wrap gap-1"
                              data-testid={`screenplay-matrix-characters-${scene.id}`}
                            >
                              {scene.characters.map((charName) => {
                                const app = charAppearances.find(
                                  (a) => a.normalizedName === charName
                                );
                                return (
                                  <span
                                    key={charName}
                                    title={
                                      app
                                        ? `Cues: ${app.rawCues.join(', ')} (${app.dialogueCount} speaking turn${app.dialogueCount === 1 ? '' : 's'})`
                                        : charName
                                    }
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                      app?.isAmbiguous
                                        ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/35'
                                        : 'bg-white/[0.06] text-slate-200 border border-white/[0.09]'
                                    }`}
                                  >
                                    <Users className="w-2.5 h-2.5 opacity-60" />
                                    <span>{charName}</span>
                                    {app && app.dialogueCount > 1 && (
                                      <span className="text-[9px] opacity-65">
                                        ×{app.dialogueCount}
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                            {charAmbiguities.length > 0 && (
                              <p className="text-[9px] text-cyan-300/90 font-mono">
                                Ambiguous cue variant flagged for review
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Review Status & Correction Controls */}
                      <td
                        className="py-2.5 px-3 align-top text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col items-end gap-1.5">
                          {renderReviewBadge(scene)}

                          {!readOnly && (
                            <div className="flex items-center gap-1">
                              {onNavigateToBreakdown && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectScene(scene);
                                    onNavigateToBreakdown();
                                  }}
                                  title="Open this scene in Scene Breakdown"
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/25 inline-flex items-center gap-0.5 cursor-pointer transition"
                                >
                                  <span>Breakdown</span>
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  isEditing
                                    ? setEditingSceneId(null)
                                    : handleStartEditing(scene)
                                }
                                data-testid={`screenplay-matrix-edit-btn-${scene.id}`}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>{isEditing ? 'Cancel' : 'Correct'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onToggleSceneReviewed(scene.id)}
                                data-testid={`screenplay-matrix-review-btn-${scene.id}`}
                                title={
                                  scene.status === 'reviewed'
                                    ? 'Mark as unreviewed'
                                    : 'Confirm scene metadata as reviewed'
                                }
                                className={`px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1 cursor-pointer ${
                                  scene.status === 'reviewed'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-white/[0.05] hover:bg-emerald-500/15 text-slate-300 hover:text-emerald-300'
                                }`}
                              >
                                <Check className="w-2.5 h-2.5" />
                                <span>
                                  {scene.status === 'reviewed'
                                    ? 'Verified'
                                    : 'Verify'}
                                </span>
                              </button>

                              {hasOverrides && (
                                <button
                                  type="button"
                                  onClick={() => onResetManualOverride(scene.id)}
                                  data-testid={`screenplay-matrix-reset-override-${scene.id}`}
                                  title="Reset manual corrections back to extracted screenplay values"
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  <span>Reset</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline Metadata Correction Row */}
                    {isEditing && !readOnly && (
                      <tr
                        data-testid={`screenplay-matrix-edit-row-${scene.id}`}
                        className="bg-[#101622] border-b border-cyan-500/35"
                      >
                        <td colSpan={7} className="p-3.5">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                                  Correct Extracted Scene Metadata — Scene #{scene.sceneNumber}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  (Original screenplay heading is preserved verbatim:{' '}
                                  <strong className="text-slate-200">
                                    {scene.originalHeading || scene.slugline}
                                  </strong>
                                  )
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                  INT./EXT. Classification
                                </label>
                                <select
                                  value={editIntExt}
                                  onChange={(e) =>
                                    setEditIntExt(e.target.value as SceneIntExt)
                                  }
                                  data-testid={`screenplay-matrix-edit-intext-${scene.id}`}
                                  className="w-full h-7 px-2 rounded text-xs bg-black/40 border border-white/[0.15] text-white focus:outline-none focus:border-cyan-400"
                                >
                                  {INT_EXT_OPTIONS.map((opt) => (
                                    <option
                                      key={opt}
                                      value={opt}
                                      className="bg-[#11151f]"
                                    >
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                  Location (Normalized)
                                </label>
                                <input
                                  type="text"
                                  value={editLocation}
                                  onChange={(e) => setEditLocation(e.target.value)}
                                  data-testid={`screenplay-matrix-edit-location-${scene.id}`}
                                  placeholder="e.g. SOUNDSTAGE 4"
                                  className="w-full h-7 px-2 rounded text-xs font-mono bg-black/40 border border-white/[0.15] text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                  Time of Day
                                </label>
                                <select
                                  value={editTimeOfDay}
                                  onChange={(e) =>
                                    setEditTimeOfDay(
                                      e.target.value as SceneTimeOfDay
                                    )
                                  }
                                  data-testid={`screenplay-matrix-edit-time-${scene.id}`}
                                  className="w-full h-7 px-2 rounded text-xs bg-black/40 border border-white/[0.15] text-white focus:outline-none focus:border-cyan-400"
                                >
                                  {TIME_OF_DAY_OPTIONS.map((opt) => (
                                    <option
                                      key={opt}
                                      value={opt}
                                      className="bg-[#11151f]"
                                    >
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                  Characters (Comma-separated)
                                </label>
                                <input
                                  type="text"
                                  value={editCharactersInput}
                                  onChange={(e) =>
                                    setEditCharactersInput(e.target.value)
                                  }
                                  data-testid={`screenplay-matrix-edit-characters-${scene.id}`}
                                  placeholder="MARA, JULIAN, COLE"
                                  className="w-full h-7 px-2 rounded text-xs font-mono bg-black/40 border border-white/[0.15] text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] font-mono text-slate-400">
                                Extracted defaults: {scene.extractedIntExt || scene.intExt} ·{' '}
                                {scene.extractedLocation || scene.location} ·{' '}
                                {scene.extractedTimeOfDay || scene.timeOfDay}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingSceneId(null)}
                                  className="px-2.5 py-1 rounded text-xs text-slate-300 hover:text-white cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditing(scene)}
                                  data-testid={`screenplay-matrix-save-override-${scene.id}`}
                                  className="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs cursor-pointer"
                                >
                                  Save Metadata Correction
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
