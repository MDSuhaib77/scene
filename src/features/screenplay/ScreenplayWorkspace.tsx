import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Editor, JSONContent } from '@tiptap/react';
import { Minimize2, BookOpen, Columns2, Sparkles, Table } from 'lucide-react';
import {
  FilmProject,
  ScreenplayVersion,
  ScreenplayTitlePageMetadata,
  ParsedScene,
  SceneIntExt,
  SceneTimeOfDay,
} from '../../types';
import {
  ScreenplayEditor,
  ScreenplayEditorMetrics,
  extractPlainText,
  computeEditorMetrics,
} from './components/ScreenplayEditor';
import { ScreenplayPage } from './components/ScreenplayPage';
import { ScreenplayDocumentViewport } from './components/ScreenplayDocumentViewport';
import { ScreenplayToolbar } from './components/ScreenplayToolbar';
import { ScreenplayPanelSection } from './components/ScreenplayNavigationRail';
import { ScreenplayNavigationPanel } from './components/ScreenplayNavigationPanel';
import { ScreenplaySceneMatrix } from './components/ScreenplaySceneMatrix';
import { AVScriptWorkspace } from './components/AVScriptWorkspace';
import { ScriptIntelligenceWorkspace } from './components/ScriptIntelligenceWorkspace';
import {
  ScreenplayToolbarCommandId,
  ScreenplayOutlineEntry,
  ActiveScreenplayState,
  setScreenplayElement,
  executeSceneCommand,
  applySceneHeadingAssist,
  executeNoteCommand,
  executeNewActCommand,
  executeEndActCommand,
  executeSequenceCommand,
  executeDualDialogueCommand,
  processScreenplayImageFile,
  insertScreenplayImage,
  extractScreenplayOutline,
  navigateToOutlineEntry,
  deserializeScreenplayDocument,
} from './commands/screenplayCommands';
import {
  ScreenplayPaginationResult,
  getPageNumberForPos,
} from './layout/screenplayPaginationEngine';
import {
  ScreenplaySaveStatus,
  ScreenplayExportFormat,
  ScreenplayImportPreview,
  resolveScriptText,
  resolveScriptDoc,
  extractScriptSnippet,
  computeDocumentQuickStats,
  createEmptyScriptDocument,
  duplicateScriptDocument,
  renameScriptDocument,
  createScriptCheckpoint,
  restoreScriptRevision,
  buildScriptVersionFromImport,
  exportScreenplayToFountain,
  exportScreenplayToFdx,
  exportScreenplayToPlainText,
  exportScreenplayToPdf,
  formatScreenplayExportFilename,
  triggerScreenplayDownload,
} from './services/screenplayDocumentLifecycle';
import {
  extractScriptIntelligenceFromDoc,
  applySceneManualOverride,
  resetSceneManualOverride,
  toggleSceneReviewedStatus,
} from './services/scriptIntelligenceService';
import { ScreenplayImportModal } from './components/ScreenplayImportModal';
import { ScreenplayEntryDialog } from './components/ScreenplayEntryDialog';
import { ScreenplayTitlePageView } from './components/ScreenplayTitlePageView';
import { ScreenplayPdfViewer } from './components/ScreenplayPdfViewer';
import { ScreenplayPdfEditableManuscript } from './components/ScreenplayPdfEditableManuscript';
import { ScreenplayErrorBoundary } from './components/ScreenplayErrorBoundary';
import {
  ScreenplayPdfDocumentLayout,
  ScreenplayPdfPageLayout,
} from '../../types';
import {
  buildScreenplayVersionFromCanonical,
  processScreenplayImportFile,
} from './services/screenplayImportService';
import { CanonicalScreenplayDocument } from './model/canonicalScreenplay';

export interface ScreenplayWorkspaceProps {
  project: FilmProject;
  isDark?: boolean;
  onUpdateProject: (project: FilmProject) => void;
  onNavigateTab?: (tab: string) => void;
  initialSubmodule?: string;
  readOnly?: boolean;
}

export const DEFAULT_SAMPLE_SCREENPLAY = `ACT I

SEQUENCE A

INT. SOUNDSTAGE 4 - NIGHT

A single sodium work-light hums above the rain towers. Coils of heavy feeder cable snake across wet concrete toward the camera dolly.

MARA VANCE (38), script supervisor, stands beside the monitor cart with a grease pencil and a battered continuity binder.

MARA
(quietly, into headset)
Roll sound. Slate Mark 14-Bravo.

ACROSS THE STAGE

DIRECTOR JULIAN KANE steps clear of the lens light. Rain begins to fall in a controlled curtain across the practical street set.

JULIAN
Frame is set. Hold traffic on the north lockup.

MARA
Speed. Marker.

CLOSE ON THE DIGITAL SLATE

The red timecode numbers lock at 01:14:22:08. The clapper sticks snap shut in a sharp spray of artificial rain.

EXT. BACKLOT ALLEY - CONTINUOUS

Rain sheets off rusted fire escapes onto glistening cobblestones. A black sedan idles at the far end of the lane, tail-lights reflecting crimson in the puddles.

DETECTIVE COLE (40s) steps beneath the sodium streetlamp, collar turned up against the downpour. He checks his wristwatch, then glances up toward the third-floor warehouse window.

COLE
(into radio)
South perimeter is quiet. Give me thirty seconds before you cut the main breaker.

MARA (O.S.)
(over comm)
Copy that, Unit Two. Camera B is tracking from the fire escape landing.

INT. SOUNDSTAGE 4 - CONTROL BOOTH - NIGHT

Through the soundproof glass, the entire rain-slicked street set glows in high-contrast chiaroscuro. Technicians monitor waveforms on dual oscilloscopes.

JULIAN
(leaning over the console)
Hold the crane at mark three. Let the headlights sweep the brick wall before Cole turns.

MARA
(marking script binder)
Take four is a circle print. Moving on to Setup 14C.

CUT TO:`;

const INITIAL_METRICS: ScreenplayEditorMetrics = {
  wordCount: 0,
  characterCount: 0,
  paragraphCount: 0,
  pageCount: 1,
  activePageNumber: 1,
  canUndo: false,
  canRedo: false,
  activeElement: 'action',
  isInsideDualDialogue: false,
};

const INITIAL_ACTIVE_STATE: ActiveScreenplayState = {
  activeElement: 'action',
  isInsideDualDialogue: false,
};

const AUTOSAVE_DEBOUNCE_MS = 1800;

export type ScreenplaySubmodule = 'library' | 'av-script';

export function resolveScreenplaySubmodule(sub?: string): ScreenplaySubmodule {
  if (sub === 'av-script' || sub === 'screenplay-av' || sub === 'write-av') return 'av-script';
  return 'library';
}

export const ScreenplayWorkspace: React.FC<ScreenplayWorkspaceProps> = ({
  project,
  isDark = true,
  onUpdateProject,
  onUpdateProject: _onUpdateProjectAlias,
  onNavigateTab,
  initialSubmodule,
  readOnly = false,
}) => {
  const projectTitle = project.title || 'Screenplay';
  const versions = project.screenplayVersions ?? [];
  const activeScript =
    versions.find((v) => v.id === project.activeScreenplayVersionId) ??
    (versions.length > 0 ? versions[versions.length - 1] : null);

  const [activeSubmodule, setActiveSubmodule] = useState<ScreenplaySubmodule>(() => {
    if (
      initialSubmodule === 'intelligence' ||
      initialSubmodule === 'screenplay-intelligence' ||
      initialSubmodule === 'matrix'
    ) {
      onNavigateTab?.('breakdown', 'matrix');
    }
    return resolveScreenplaySubmodule(initialSubmodule);
  });

  const [activeVersionId, setActiveVersionId] = useState<string>(
    activeScript?.id ?? 'working-draft'
  );
  const [draftTitle, setDraftTitle] = useState<string>(
    activeScript?.title ?? `${projectTitle} — Working Draft`
  );
  const [initialEditorDoc, setInitialEditorDoc] = useState<JSONContent>(() =>
    resolveScriptDoc(activeScript, '')
  );
  const [currentText, setCurrentText] = useState<string>(() =>
    resolveScriptText(activeScript, '')
  );
  const [currentDocJson, setCurrentDocJson] = useState<string>(() =>
    activeScript?.documentJson ??
      JSON.stringify(resolveScriptDoc(activeScript, ''))
  );
  const [draftRevisionKey, setDraftRevisionKey] = useState<string>(
    `${project.id}:${activeScript?.id ?? 'working-draft'}:0`
  );

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<ScreenplaySaveStatus>('saved');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    activeScript?.lastSavedAt ?? activeScript?.updatedAt ?? null
  );
  const [metrics, setMetrics] = useState<ScreenplayEditorMetrics>(INITIAL_METRICS);
  const [activeState, setActiveState] =
    useState<ActiveScreenplayState>(INITIAL_ACTIVE_STATE);
  const [outlineEntries, setOutlineEntries] = useState<ScreenplayOutlineEntry[]>([]);
  const [pagination, setPagination] = useState<ScreenplayPaginationResult | null>(
    null
  );
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const [isNavPanelOpen, setIsNavPanelOpen] = useState<boolean>(false);
  const [activePanelSection, setActivePanelSection] = useState<ScreenplayPanelSection>('drafts');
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(
    initialSubmodule === 'upload'
  );
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState<boolean>(() => {
    if (initialSubmodule === 'entry' || initialSubmodule === 'upload') return true;
    if (typeof window === 'undefined') return false;
    try {
      const dismissed = sessionStorage.getItem(`sceneos_entry_dismissed_${project.id}`);
      return !dismissed;
    } catch {
      return false;
    }
  });
  const [importProgress, setImportProgress] = useState<{
    isLoading: boolean;
    fileName?: string;
    error?: string | null;
  }>({ isLoading: false });
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'screenplay' | 'titlepage' | 'pdf'>('screenplay');

  // Script Intelligence & Scene Matrix state
  const [isMatrixOpen, setIsMatrixOpen] = useState<boolean>(
    initialSubmodule === 'intelligence' ||
      initialSubmodule === 'screenplay-intelligence'
  );
  const [matrixLayoutMode, setMatrixLayoutMode] = useState<'split' | 'full'>('split');
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedOutlinePos, setSelectedOutlinePos] = useState<number | null>(null);
  const [storedScenesByDoc, setStoredScenesByDoc] = useState<
    Record<string, ParsedScene[]>
  >(() => {
    const map: Record<string, ParsedScene[]> = {};
    for (const ver of project.screenplayVersions ?? []) {
      if (ver.scenes && ver.scenes.length > 0) {
        map[ver.id] = ver.scenes;
      }
    }
    return map;
  });

  const editorRef = useRef<Editor | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const activeProjectIdRef = useRef<string>(project.id);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Concurrency & autosave refs to prevent stale async overwrites
  const saveGenerationRef = useRef<number>(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestProjectRef = useRef<FilmProject>(project);
  latestProjectRef.current = project;

  const activeVersionRecord = useMemo(
    () => versions.find((v) => v.id === activeVersionId) ?? null,
    [versions, activeVersionId]
  );

  const priorScenesForActiveDoc = useMemo<ParsedScene[] | undefined>(() => {
    return storedScenesByDoc[activeVersionId] ?? activeVersionRecord?.scenes;
  }, [storedScenesByDoc, activeVersionId, activeVersionRecord]);

  // Single Authoritative Script Intelligence Extraction Pipeline
  const intelligenceResult = useMemo(() => {
    return extractScriptIntelligenceFromDoc({
      doc: activeVersionRecord?.pdfLayout || currentDocJson,
      sourceDocumentId: activeVersionId,
      pagination,
      priorScenes: priorScenesForActiveDoc,
      format: activeVersionRecord?.sourceFormat ?? 'fountain',
    });
  }, [
    currentDocJson,
    activeVersionRecord?.pdfLayout,
    activeVersionId,
    pagination,
    priorScenesForActiveDoc,
    activeVersionRecord?.sourceFormat,
  ]);

  // Enrich outline entries with their calculated manuscript page numbers
  const paginatedOutlineEntries = useMemo<ScreenplayOutlineEntry[]>(() => {
    if (activeVersionRecord?.pdfLayout && activeVersionRecord.pdfLayout.pages.length > 0) {
      const pdfOutline: ScreenplayOutlineEntry[] = [];
      let sceneCounter = 1;
      activeVersionRecord.pdfLayout.pages.forEach((page) => {
        page.lines.forEach((line) => {
          if (line.type === 'sceneHeading' || line.type === 'scene_heading') {
            pdfOutline.push({
              id: line.id,
              sceneNumber: line.sceneNumber ? parseInt(line.sceneNumber, 10) || sceneCounter++ : sceneCounter++,
              text: line.text,
              pos: 0,
              type: 'sceneHeading',
              pageNumber: page.pageNumber,
            });
          }
        });
      });
      if (pdfOutline.length > 0) {
        return pdfOutline;
      }
    }
    if (!pagination) return outlineEntries;
    return outlineEntries.map((entry) => ({
      ...entry,
      pageNumber: getPageNumberForPos(pagination, entry.pos),
    }));
  }, [activeVersionRecord?.pdfLayout, outlineEntries, pagination]);

  const pageCount =
    activeVersionRecord?.pdfLayout?.pages.length ??
    (pagination?.pageCount ?? metrics.pageCount ?? 1);
  const activePageNumber = metrics.activePageNumber ?? 1;

  const [lastAnalyzedFingerprint, setLastAnalyzedFingerprint] = useState<string>(
    intelligenceResult.sourceDocFingerprint
  );

  const isAnalysisOutdated =
    lastAnalyzedFingerprint !== intelligenceResult.sourceDocFingerprint;

  // Respond to submodule navigation requests from the global sidebar hierarchy
  useEffect(() => {
    if (initialSubmodule) {
      if (
        initialSubmodule === 'intelligence' ||
        initialSubmodule === 'screenplay-intelligence' ||
        initialSubmodule === 'matrix'
      ) {
        onNavigateTab?.('breakdown', 'matrix');
        return;
      }
      setActiveSubmodule(resolveScreenplaySubmodule(initialSubmodule));
      if (initialSubmodule === 'upload') {
        setIsImportModalOpen(true);
      } else if (initialSubmodule === 'screenplay-library') {
        setActivePanelSection('drafts');
        setIsNavPanelOpen(true);
      }
    }
  }, [initialSubmodule, onNavigateTab]);

  // Synchronize draft state when switching to a different project
  useEffect(() => {
    if (activeProjectIdRef.current !== project.id) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      saveGenerationRef.current += 1;
      activeProjectIdRef.current = project.id;
      const nextVersions = project.screenplayVersions ?? [];
      const nextLatest =
        nextVersions.length > 0 ? nextVersions[nextVersions.length - 1] : null;
      const nextId = nextLatest?.id ?? 'working-draft';
      const nextTitle = nextLatest?.title ?? `${projectTitle} — Working Draft`;
      const nextDoc = resolveScriptDoc(nextLatest, '');
      const nextText = resolveScriptText(nextLatest, '');

      const nextSceneMap: Record<string, ParsedScene[]> = {};
      for (const ver of nextVersions) {
        if (ver.scenes && ver.scenes.length > 0) {
          nextSceneMap[ver.id] = ver.scenes;
        }
      }

      setActiveVersionId(nextId);
      setDraftTitle(nextTitle);
      setInitialEditorDoc(nextDoc);
      setCurrentText(nextText);
      setCurrentDocJson(nextLatest?.documentJson ?? JSON.stringify(nextDoc));
      setDraftRevisionKey(`${project.id}:${nextId}:${Date.now()}`);
      setStoredScenesByDoc(nextSceneMap);
      setSelectedSceneId(null);
      setSelectedOutlinePos(null);
      setIsDirty(false);
      setSaveStatus('saved');
      setSaveErrorMessage(null);
      setLastSavedAt(nextLatest?.lastSavedAt ?? nextLatest?.updatedAt ?? null);
    }
  }, [project.id, projectTitle, project.screenplayVersions]);

  // Warn before closing browser window/tab if unsaved changes exist
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
    setEditorInstance(editor);
  }, []);

  /**
   * Core persistence routine used by both explicit Save Draft and debounced Autosave.
   * Returns the updated versions array so callers (like switching/creating scripts)
   * can chain updates without losing unsaved edits.
   */
  const persistCurrentScript = useCallback(
    (options?: {
      overrideText?: string;
      overrideDocJson?: string;
      overrideTitle?: string;
      overrideScenes?: ParsedScene[];
      commitToProject?: boolean;
    }): { updatedVersions: ScreenplayVersion[]; savedId: string } => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      const currentGen = ++saveGenerationRef.current;
      const liveEditor = editorRef.current;
      const liveText =
        options?.overrideText !== undefined
          ? options.overrideText
          : liveEditor
            ? extractPlainText(liveEditor)
            : currentText;
      const liveDocJson =
        options?.overrideDocJson !== undefined
          ? options.overrideDocJson
          : liveEditor
            ? JSON.stringify(liveEditor.getJSON())
            : currentDocJson;
      const effectiveTitle = (options?.overrideTitle ?? draftTitle).trim();

      const nowIso = new Date().toISOString();
      const baseProject = latestProjectRef.current;
      const existingVersions = baseProject.screenplayVersions ?? [];
      const existingIdx = existingVersions.findIndex(
        (v) => v.id === activeVersionId
      );
      const snippet = extractScriptSnippet(liveText);
      const stats = computeDocumentQuickStats(liveDocJson, liveText);

      let updatedVersions: ScreenplayVersion[];
      let savedVersionId = activeVersionId;

      if (existingIdx >= 0) {
        const existing = existingVersions[existingIdx];
        const priorScenes =
          options?.overrideScenes ??
          storedScenesByDoc[activeVersionId] ??
          existing.scenes;
        const extracted = extractScriptIntelligenceFromDoc({
          doc: liveDocJson,
          sourceDocumentId: existing.id,
          pagination,
          priorScenes,
          format: existing.sourceFormat ?? 'fountain',
        });
        const finalScenes = options?.overrideScenes ?? extracted.scenes;
        const finalCharacters = Array.from(
          new Set(finalScenes.flatMap((s) => s.characters || []))
        );
        const finalLocations = Array.from(
          new Set(
            finalScenes
              .map((s) => s.location)
              .filter((loc) => loc && loc !== 'UNSPECIFIED LOCATION')
          )
        );
        const updatedVersion: ScreenplayVersion = {
          ...existing,
          title: effectiveTitle || existing.title,
          rawText: liveText,
          documentJson: liveDocJson,
          contentSnippet: snippet,
          totalScenes: finalScenes.length || stats.sceneCount || existing.totalScenes,
          totalPageEighths: extracted.totalPageEighths,
          totalPageCountDisplay: extracted.totalPageCountDisplay,
          characters: finalCharacters,
          locations: finalLocations,
          scenes: finalScenes,
          updatedAt: nowIso,
          lastSavedAt: nowIso,
        };
        updatedVersions = [...existingVersions];
        updatedVersions[existingIdx] = updatedVersion;
      } else {
        savedVersionId =
          activeVersionId && activeVersionId !== 'working-draft'
            ? activeVersionId
            : `scr-ver-${Date.now()}`;
        const nextVersionNum = existingVersions.length + 1;
        const resolvedTitle =
          effectiveTitle || `${projectTitle} Draft ${nextVersionNum}`;
        const priorScenes =
          options?.overrideScenes ?? storedScenesByDoc[activeVersionId];
        const extracted = extractScriptIntelligenceFromDoc({
          doc: liveDocJson,
          sourceDocumentId: savedVersionId,
          pagination,
          priorScenes,
          format: 'fountain',
        });
        const finalScenes = options?.overrideScenes ?? extracted.scenes;
        const finalCharacters = Array.from(
          new Set(finalScenes.flatMap((s) => s.characters || []))
        );
        const finalLocations = Array.from(
          new Set(
            finalScenes
              .map((s) => s.location)
              .filter((loc) => loc && loc !== 'UNSPECIFIED LOCATION')
          )
        );
        const resolvedAuthor =
          activeVersionRecord?.titlePageMetadata?.author ||
          activeVersionRecord?.author ||
          '';
        const newVersion: ScreenplayVersion = {
          id: savedVersionId,
          version: `v1.${nextVersionNum}`,
          title: resolvedTitle,
          author: resolvedAuthor,
          owner: baseProject.owner,
          createdAt: nowIso,
          updatedAt: nowIso,
          lastSavedAt: nowIso,
          changeDescription: 'Saved from Screenplay Workspace',
          contentSnippet: snippet,
          status: 'Draft',
          sourceFormat: 'fountain',
          totalScenes: finalScenes.length || stats.sceneCount,
          totalPageEighths: extracted.totalPageEighths,
          totalPageCountDisplay: extracted.totalPageCountDisplay,
          characters: finalCharacters,
          locations: finalLocations,
          rawText: liveText,
          documentJson: liveDocJson,
          scenes: finalScenes,
          revisions: [
            {
              id: `rev-${Date.now()}-init`,
              versionLabel: `v1.${nextVersionNum}`,
              title: resolvedTitle,
              author: resolvedAuthor,
              createdAt: nowIso,
              changeDescription: 'Initial saved draft',
              rawText: liveText,
              documentJson: liveDocJson,
              wordCount: stats.wordCount,
              sceneCount: finalScenes.length || stats.sceneCount,
            },
          ],
        };
        updatedVersions = [...existingVersions, newVersion];
      }

      if (options?.commitToProject !== false && !readOnly) {
        try {
          setSaveStatus('saving');
          const activeSaved = updatedVersions.find((v) => v.id === savedVersionId);
          onUpdateProject({
            ...baseProject,
            screenplayVersions: updatedVersions,
            activeScreenplayVersionId: savedVersionId,
            scenes: activeSaved?.scenes || activeSaved?.extractedScenes || baseProject.scenes || [],
          });
          if (currentGen === saveGenerationRef.current) {
            setActiveVersionId(savedVersionId);
            setLastSavedAt(nowIso);
            setIsDirty(false);
            setSaveStatus('saved');
            setSaveErrorMessage(null);
          }
        } catch (err: any) {
          setSaveStatus('error');
          setSaveErrorMessage(err?.message || 'Failed to save screenplay changes.');
        }
      }

      return { updatedVersions, savedId: savedVersionId };
    },
    [
      activeVersionId,
      currentDocJson,
      currentText,
      draftTitle,
      onUpdateProject,
      pagination,
      projectTitle,
      readOnly,
      storedScenesByDoc,
    ]
  );

  const handleSaveDraft = useCallback(() => {
    if (readOnly) return;
    persistCurrentScript({ commitToProject: true });
  }, [persistCurrentScript, readOnly]);

  // Debounced autosave while editing an active script
  useEffect(() => {
    if (!isDirty || readOnly) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      persistCurrentScript({ commitToProject: true });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [currentDocJson, currentText, draftTitle, isDirty, persistCurrentScript, readOnly]);

  const handleDocumentChange = useCallback(
    (payload: {
      plainText: string;
      documentJson: string;
      metrics: ScreenplayEditorMetrics;
      outline: ScreenplayOutlineEntry[];
      pagination: ScreenplayPaginationResult;
    }) => {
      setCurrentText(payload.plainText);
      setCurrentDocJson(payload.documentJson);
      setMetrics(payload.metrics);
      setOutlineEntries(payload.outline);
      setPagination(payload.pagination);
      setIsDirty(true);
      setSaveStatus('dirty');
    },
    []
  );

  const handleDraftTitleChange = useCallback((nextTitle: string) => {
    setDraftTitle(nextTitle);
    setIsDirty(true);
    setSaveStatus('dirty');
  }, []);

  /**
   * Opens a saved script from the library. Automatically flushes any unsaved edits
   * on the previously open script so user work is never lost when switching documents.
   */
  const handleSelectVersion = useCallback(
    (versionId: string) => {
      if (versionId === activeVersionId && !isDirty) return;

      let sourceVersions = latestProjectRef.current.screenplayVersions ?? [];
      if (isDirty && !readOnly) {
        const flushed = persistCurrentScript({ commitToProject: true });
        sourceVersions = flushed.updatedVersions;
      }

      const target = sourceVersions.find((v) => v.id === versionId);
      if (!target) return;

      saveGenerationRef.current += 1;
      const resolvedText = resolveScriptText(target, '');
      const resolvedDoc = resolveScriptDoc(target, '');

      setActiveVersionId(target.id);
      setDraftTitle(target.title);
      setInitialEditorDoc(resolvedDoc);
      setCurrentText(resolvedText);
      setCurrentDocJson(target.documentJson ?? JSON.stringify(resolvedDoc));
      setDraftRevisionKey(`${project.id}:${target.id}:${Date.now()}`);
      setIsDirty(false);
      setSaveStatus('saved');
      setSaveErrorMessage(null);
      setLastSavedAt(target.lastSavedAt ?? target.updatedAt);
      if (activeView === 'pdf' && !target.sourcePdfDataUrl) {
        setActiveView('screenplay');
      }
      onUpdateProject({
        ...latestProjectRef.current,
        activeScreenplayVersionId: target.id,
        scenes: target.extractedScenes || target.scenes || latestProjectRef.current.scenes || [],
      });
    },
    [activeVersionId, activeView, isDirty, onUpdateProject, persistCurrentScript, project.id, readOnly]
  );

  /**
   * Creates a genuinely empty screenplay document in the Script Library and opens it.
   */
  const handleNewBlankDraft = useCallback(
    (customTitle?: string) => {
      if (readOnly) return;

      let baseVersions = latestProjectRef.current.screenplayVersions ?? [];
      if (isDirty) {
        const flushed = persistCurrentScript({ commitToProject: false });
        baseVersions = flushed.updatedVersions;
      }

      const newTitle =
        typeof customTitle === 'string' && customTitle.trim().length > 0
          ? customTitle.trim()
          : `${projectTitle} — Blank Draft`;

      const blankScript = createEmptyScriptDocument({
        title: newTitle,
        author: '',
        owner: project.owner,
        existingCount: baseVersions.length,
      });

      const blankDoc = resolveScriptDoc(blankScript, '');
      const updatedVersions = [...baseVersions, blankScript];

      saveGenerationRef.current += 1;
      onUpdateProject({
        ...latestProjectRef.current,
        screenplayVersions: updatedVersions,
        activeScreenplayVersionId: blankScript.id,
        scenes: [],
      });

      setActiveVersionId(blankScript.id);
      setDraftTitle(blankScript.title);
      setInitialEditorDoc(blankDoc);
      setCurrentText('');
      setCurrentDocJson(blankScript.documentJson || JSON.stringify(blankDoc));
      setDraftRevisionKey(`${project.id}:${blankScript.id}:${Date.now()}`);
      setIsDirty(false);
      setSaveStatus('saved');
      setSaveErrorMessage(null);
      setLastSavedAt(blankScript.updatedAt);
    },
    [isDirty, onUpdateProject, persistCurrentScript, project, projectTitle, readOnly]
  );

  const handleLoadSampleScript = useCallback(() => {
    if (readOnly) return;
    const sampleId = `sample-${Date.now()}`;
    const sampleTitle = `${projectTitle} — Sample Scene`;
    const sampleDoc = deserializeScreenplayDocument(null, DEFAULT_SAMPLE_SCREENPLAY);
    saveGenerationRef.current += 1;
    setActiveVersionId(sampleId);
    setDraftTitle(sampleTitle);
    setInitialEditorDoc(sampleDoc);
    setCurrentText(DEFAULT_SAMPLE_SCREENPLAY);
    setCurrentDocJson(JSON.stringify(sampleDoc));
    setDraftRevisionKey(`${project.id}:${sampleId}:${Date.now()}`);
    setIsDirty(true);
    setSaveStatus('dirty');
  }, [project.id, projectTitle, readOnly]);

  const handleImportScriptFile = useCallback(
    (importedTitle: string, importedContent: string) => {
      if (readOnly) return;
      const importId = `import-${Date.now()}`;
      const importedDoc = deserializeScreenplayDocument(null, importedContent);
      saveGenerationRef.current += 1;
      setActiveVersionId(importId);
      setDraftTitle(importedTitle);
      setInitialEditorDoc(importedDoc);
      setCurrentText(importedContent);
      setCurrentDocJson(JSON.stringify(importedDoc));
      setDraftRevisionKey(`${project.id}:${importId}:${Date.now()}`);
      setIsDirty(true);
      setSaveStatus('dirty');
    },
    [project.id, readOnly]
  );

  /**
   * Handles validated multi-format (.fountain, .fdx, .txt) import confirmation.
   * Supports either creating a new independent script or replacing the active script
   * while preserving revision history.
   */
  const handleImportPreviewConfirm = useCallback(
    (preview: ScreenplayImportPreview, mode: 'new' | 'replace') => {
      if (readOnly) return;

      let baseVersions = latestProjectRef.current.screenplayVersions ?? [];
      if (isDirty) {
        const flushed = persistCurrentScript({ commitToProject: false });
        baseVersions = flushed.updatedVersions;
      }

      const activeIdx = baseVersions.findIndex((v) => v.id === activeVersionId);
      let targetVersion: ScreenplayVersion;
      let updatedVersions: ScreenplayVersion[];

      if (mode === 'replace' && activeIdx >= 0) {
        targetVersion = buildScriptVersionFromImport(preview, {
          existingScript: baseVersions[activeIdx],
          author:
            preview.titlePageMetadata?.author ||
            activeVersionRecord?.titlePageMetadata?.author ||
            activeVersionRecord?.author ||
            '',
          owner: project.owner,
        });
        updatedVersions = [...baseVersions];
        updatedVersions[activeIdx] = targetVersion;
      } else {
        targetVersion = buildScriptVersionFromImport(preview, {
          existingScript: null,
          author: preview.titlePageMetadata?.author || '',
          owner: project.owner,
        });
        updatedVersions = [...baseVersions, targetVersion];
      }

      saveGenerationRef.current += 1;
      const targetScenes =
        targetVersion.extractedScenes || targetVersion.scenes || latestProjectRef.current.scenes || [];
      onUpdateProject({
        ...latestProjectRef.current,
        screenplayVersions: updatedVersions,
        activeScreenplayVersionId: targetVersion.id,
        scenes: targetScenes,
      });

      setActiveVersionId(targetVersion.id);
      setDraftTitle(targetVersion.title);
      setInitialEditorDoc(preview.doc);
      setCurrentText(preview.rawText);
      setCurrentDocJson(preview.documentJson);
      setDraftRevisionKey(`${project.id}:${targetVersion.id}:${Date.now()}`);
      setIsDirty(false);
      setSaveStatus('saved');
      setSaveErrorMessage(null);
      setLastSavedAt(targetVersion.updatedAt);
      setActiveView('screenplay');
    },
    [activeVersionId, isDirty, onUpdateProject, persistCurrentScript, project, readOnly]
  );

  /**
   * Handles confirmed canonical imports from the modern universal ScreenplayImportModal.
   */
  const handleConfirmCanonicalImport = useCallback(
    (
      canonical: CanonicalScreenplayDocument,
      originalRawText: string,
      options?: { openView?: 'screenplay' | 'pdf' }
    ) => {
      if (readOnly) return;

      let baseVersions = latestProjectRef.current.screenplayVersions ?? [];
      if (isDirty) {
        const flushed = persistCurrentScript({ commitToProject: false });
        baseVersions = flushed.updatedVersions;
      }

      const newVersion = buildScreenplayVersionFromCanonical(
        canonical,
        latestProjectRef.current,
        originalRawText,
        canonical.provenance?.sourcePdfDataUrl
      );
      const updatedVersions = [...baseVersions, newVersion];

      saveGenerationRef.current += 1;
      const newScenes =
        newVersion.extractedScenes || newVersion.scenes || latestProjectRef.current.scenes || [];
      onUpdateProject({
        ...latestProjectRef.current,
        screenplayVersions: updatedVersions,
        activeScreenplayVersionId: newVersion.id,
        scenes: newScenes,
      });

      const docContent = (newVersion.content as JSONContent) || resolveScriptDoc(newVersion, '');
      setActiveVersionId(newVersion.id);
      setDraftTitle(newVersion.title);
      setInitialEditorDoc(docContent);
      setCurrentText(newVersion.rawText || originalRawText);
      setCurrentDocJson(newVersion.documentJson || JSON.stringify(docContent));
      setDraftRevisionKey(`${project.id}:${newVersion.id}:${Date.now()}`);
      setIsDirty(false);
      setSaveStatus('saved');
      setSaveErrorMessage(null);
      setLastSavedAt(newVersion.updatedAt);
      setActiveView(options?.openView || 'screenplay');
    },
    [isDirty, onUpdateProject, persistCurrentScript, project.id, readOnly]
  );

  /**
   * Direct Native File Picker trigger (WriterSolo flow Step 2)
   */
  const handleTriggerNativeImport = useCallback(() => {
    if (readOnly) return;
    if (nativeFileInputRef.current) {
      nativeFileInputRef.current.value = '';
      nativeFileInputRef.current.click();
    }
  }, [readOnly]);

  /**
   * Direct Intake and Transition to Editing (WriterSolo flow Step 3)
   * Directly processes file with processScreenplayImportFile and opens into Tiptap editor
   * without secondary clicks, wizards, or reroutes.
   */
  const handleProcessAndOpenImportedFile = useCallback(
    async (file: File) => {
      if (readOnly || !file) return;
      setImportProgress({ isLoading: true, fileName: file.name, error: null });
      setIsEntryDialogOpen(false);
      setIsImportModalOpen(false);

      try {
        const previewData = await processScreenplayImportFile(file);

        // Check if scanned PDF with no text
        const isScannedPdf =
          previewData.detectedFormat === 'pdf' &&
          previewData.warnings.some((w) => w.id === 'pdf-scanned-image') &&
          previewData.totalScenes === 0 &&
          (!previewData.plainTextPreview || previewData.plainTextPreview.length < 40);

        if (isScannedPdf) {
          throw new Error(
            'This PDF appears to be a scanned document without a selectable text layer. Please import a text-based PDF, Fountain, or Final Draft (.fdx) file.'
          );
        }

        handleConfirmCanonicalImport(
          previewData.canonical,
          previewData.plainTextPreview || '',
          { openView: 'screenplay' }
        );
        setImportProgress({ isLoading: false });
      } catch (err: any) {
        setImportProgress({
          isLoading: false,
          fileName: file.name,
          error: err?.message || 'Failed to import screenplay document.',
        });
      }
    },
    [handleConfirmCanonicalImport, readOnly]
  );

  const handleNativeFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleProcessAndOpenImportedFile(file);
      }
    },
    [handleProcessAndOpenImportedFile]
  );

  /**
   * Persists Title Page metadata changes directly into activeVersionRecord.titlePageMetadata
   */
  const handleChangeTitlePageMetadata = useCallback(
    (patch: any) => {
      if (readOnly) return;
      if (patch.title) {
        handleDraftTitleChange(patch.title);
      }
      const baseProject = latestProjectRef.current;
      const existingVersions = baseProject.screenplayVersions ?? [];
      const activeIdx = existingVersions.findIndex((v) => v.id === activeVersionId);
      if (activeIdx >= 0) {
        const existing = existingVersions[activeIdx];
        const mergedTitleMetadata: ScreenplayTitlePageMetadata = {
          ...existing.titlePageMetadata,
          title: patch.title ?? existing.titlePageMetadata?.title ?? existing.title,
          author: patch.author ?? existing.titlePageMetadata?.author ?? existing.author,
          basedOn: patch.source ?? patch.basedOn ?? existing.titlePageMetadata?.basedOn,
          draftDate: patch.draftDate ?? existing.titlePageMetadata?.draftDate,
          contact: patch.contact ?? existing.titlePageMetadata?.contact,
          notes: patch.notes ?? existing.titlePageMetadata?.notes,
          copyright: patch.copyright ?? existing.titlePageMetadata?.copyright,
        };
        const updatedVersion: ScreenplayVersion = {
          ...existing,
          titlePageMetadata: mergedTitleMetadata,
          author: patch.author || existing.author,
        };
        const updatedVersions = [...existingVersions];
        updatedVersions[activeIdx] = updatedVersion;
        onUpdateProject({
          ...baseProject,
          screenplayVersions: updatedVersions,
        });
        setIsDirty(true);
        setSaveStatus('dirty');
      }
    },
    [activeVersionId, handleDraftTitleChange, onUpdateProject, readOnly]
  );

  /**
   * Updates page layout and plain text when the user directly edits lines in the PDF manuscript.
   */
  const handlePdfLayoutChange = useCallback(
    (updatedLayout: ScreenplayPdfDocumentLayout, newText: string) => {
      if (readOnly) return;
      setCurrentText(newText);
      setIsDirty(true);
      setSaveStatus('dirty');

      const baseProject = latestProjectRef.current;
      const existingVersions = baseProject.screenplayVersions ?? [];
      const activeIdx = existingVersions.findIndex((v) => v.id === activeVersionId);
      if (activeIdx >= 0) {
        const existing = existingVersions[activeIdx];
        const updated: ScreenplayVersion = {
          ...existing,
          pdfLayout: updatedLayout,
          rawText: newText,
          updatedAt: new Date().toISOString(),
          lastSavedAt: new Date().toISOString(),
        };
        const updatedVersions = [...existingVersions];
        updatedVersions[activeIdx] = updated;
        onUpdateProject({
          ...baseProject,
          screenplayVersions: updatedVersions,
        });
      }
    },
    [activeVersionId, onUpdateProject, readOnly]
  );

  /**
   * Updates Title Page layout when edited on the authentic title page canvas.
   */
  const handleTitlePageLayoutChange = useCallback(
    (updatedTitlePage: ScreenplayPdfPageLayout) => {
      if (readOnly || !activeVersionRecord?.pdfLayout) return;
      const nextLayout: ScreenplayPdfDocumentLayout = {
        ...activeVersionRecord.pdfLayout,
        hasTitlePage: true,
        titlePage: updatedTitlePage,
      };
      handlePdfLayoutChange(nextLayout, currentText);
    },
    [activeVersionRecord?.pdfLayout, currentText, handlePdfLayoutChange, readOnly]
  );

  /**
   * Renames a script in the library without changing its ID or content.
   */
  const handleRenameScript = useCallback(
    (versionId: string, nextTitle: string) => {
      if (readOnly) return;
      const trimmed = nextTitle.trim();
      if (!trimmed) return;

      const existingVersions = latestProjectRef.current.screenplayVersions ?? [];
      const updatedVersions = existingVersions.map((ver) =>
        ver.id === versionId ? renameScriptDocument(ver, trimmed) : ver
      );

      onUpdateProject({
        ...latestProjectRef.current,
        screenplayVersions: updatedVersions,
      });

      if (versionId === activeVersionId) {
        setDraftTitle(trimmed);
      }
    },
    [activeVersionId, onUpdateProject, readOnly]
  );

  /**
   * Duplicates a script into a new independent script document with its own ID and history.
   */
  const handleDuplicateScript = useCallback(
    (versionId: string) => {
      if (readOnly) return;

      let baseVersions = latestProjectRef.current.screenplayVersions ?? [];
      if (isDirty) {
        const flushed = persistCurrentScript({ commitToProject: false });
        baseVersions = flushed.updatedVersions;
      }

      const source = baseVersions.find((v) => v.id === versionId);
      if (!source) return;

      const duplicated = duplicateScriptDocument(source);
      const updatedVersions = [...baseVersions, duplicated];
      const dupDoc = resolveScriptDoc(duplicated, '');
      const dupText = resolveScriptText(duplicated, '');

      saveGenerationRef.current += 1;
      onUpdateProject({
        ...latestProjectRef.current,
        screenplayVersions: updatedVersions,
      });

      setActiveVersionId(duplicated.id);
      setDraftTitle(duplicated.title);
      setInitialEditorDoc(dupDoc);
      setCurrentText(dupText);
      setCurrentDocJson(duplicated.documentJson || JSON.stringify(dupDoc));
      setDraftRevisionKey(`${project.id}:${duplicated.id}:${Date.now()}`);
      setIsDirty(false);
      setSaveStatus('saved');
      setLastSavedAt(duplicated.updatedAt);
    },
    [isDirty, onUpdateProject, persistCurrentScript, project.id, readOnly]
  );

  /**
   * Deletes a script from the library after user confirmation.
   * If the deleted script was active, transitions cleanly to the next available script.
   */
  const handleDeleteScript = useCallback(
    (versionId: string) => {
      if (readOnly) return;
      const existingVersions = latestProjectRef.current.screenplayVersions ?? [];
      const remaining = existingVersions.filter((v) => v.id !== versionId);

      saveGenerationRef.current += 1;
      onUpdateProject({
        ...latestProjectRef.current,
        screenplayVersions: remaining,
      });

      if (versionId === activeVersionId) {
        if (remaining.length > 0) {
          const nextActive = remaining[remaining.length - 1];
          const nextDoc = resolveScriptDoc(nextActive, '');
          const nextText = resolveScriptText(nextActive, '');
          setActiveVersionId(nextActive.id);
          setDraftTitle(nextActive.title);
          setInitialEditorDoc(nextDoc);
          setCurrentText(nextText);
          setCurrentDocJson(nextActive.documentJson ?? JSON.stringify(nextDoc));
          setDraftRevisionKey(`${project.id}:${nextActive.id}:${Date.now()}`);
          setIsDirty(false);
          setSaveStatus('saved');
          setLastSavedAt(nextActive.updatedAt);
        } else {
          const blankDoc: JSONContent = {
            type: 'doc',
            content: [{ type: 'action' }],
          };
          const fallbackId = `working-draft-${Date.now()}`;
          setActiveVersionId(fallbackId);
          setDraftTitle(`${projectTitle} — Blank Draft`);
          setInitialEditorDoc(blankDoc);
          setCurrentText('');
          setCurrentDocJson(JSON.stringify(blankDoc));
          setDraftRevisionKey(`${project.id}:${fallbackId}:${Date.now()}`);
          setIsDirty(false);
          setSaveStatus('saved');
          setLastSavedAt(null);
        }
      }
    },
    [activeVersionId, onUpdateProject, project.id, projectTitle, readOnly]
  );

  /**
   * Creates an intentional version checkpoint snapshot in the active script's revision history.
   */
  const handleCreateCheckpoint = useCallback(
    (changeDescription: string) => {
      if (readOnly) return;

      const flushed = persistCurrentScript({ commitToProject: false });
      const baseVersions = flushed.updatedVersions;
      const targetIdx = baseVersions.findIndex((v) => v.id === flushed.savedId);
      if (targetIdx < 0) return;

      const liveEditor = editorRef.current;
      const liveText = liveEditor ? extractPlainText(liveEditor) : currentText;
      const liveDocJson = liveEditor
        ? JSON.stringify(liveEditor.getJSON())
        : currentDocJson;

      const checkpointed = createScriptCheckpoint({
        script: baseVersions[targetIdx],
        liveText,
        liveDocJson,
        changeDescription,
        author:
          activeVersionRecord?.titlePageMetadata?.author ||
          activeVersionRecord?.author ||
          '',
        titleOverride: draftTitle,
      });

      const updatedVersions = [...baseVersions];
      updatedVersions[targetIdx] = checkpointed;

      saveGenerationRef.current += 1;
      onUpdateProject({
        ...latestProjectRef.current,
        screenplayVersions: updatedVersions,
      });

      setActiveVersionId(checkpointed.id);
      setLastSavedAt(checkpointed.updatedAt);
      setIsDirty(false);
      setSaveStatus('saved');
    },
    [
      activeVersionRecord?.author,
      activeVersionRecord?.titlePageMetadata?.author,
      currentDocJson,
      currentText,
      draftTitle,
      onUpdateProject,
      persistCurrentScript,
      readOnly,
    ]
  );

  /**
   * Restores a saved revision snapshot into the active editor while preserving newer history.
   */
  const handleRestoreRevision = useCallback(
    (revisionId: string) => {
      if (readOnly) return;
      const existingVersions = latestProjectRef.current.screenplayVersions ?? [];
      const activeIdx = existingVersions.findIndex((v) => v.id === activeVersionId);
      if (activeIdx < 0) return;

      const liveEditor = editorRef.current;
      const liveText = liveEditor ? extractPlainText(liveEditor) : currentText;
      const liveDocJson = liveEditor
        ? JSON.stringify(liveEditor.getJSON())
        : currentDocJson;

      const result = restoreScriptRevision({
        script: existingVersions[activeIdx],
        revisionId,
        currentLiveText: liveText,
        currentLiveDocJson: liveDocJson,
      });
      if (!result) return;

      const { updatedScript } = result;
      const restoredDoc = resolveScriptDoc(updatedScript, '');
      const restoredText = resolveScriptText(updatedScript, '');

      const updatedVersions = [...existingVersions];
      updatedVersions[activeIdx] = updatedScript;

      saveGenerationRef.current += 1;
      onUpdateProject({
        ...latestProjectRef.current,
        screenplayVersions: updatedVersions,
      });

      setInitialEditorDoc(restoredDoc);
      setCurrentText(restoredText);
      setCurrentDocJson(
        updatedScript.documentJson || JSON.stringify(restoredDoc)
      );
      setDraftRevisionKey(
        `${project.id}:${updatedScript.id}:restore:${Date.now()}`
      );
      setLastSavedAt(updatedScript.updatedAt);
      setIsDirty(false);
      setSaveStatus('saved');
    },
    [
      activeVersionId,
      currentDocJson,
      currentText,
      onUpdateProject,
      project.id,
      readOnly,
    ]
  );

  /**
   * Exports the current live document (including any unsaved edits, excluding internal
   * screenplayNote blocks and pagination decorations) to .fountain, .fdx, or .txt.
   */
  const handleExportScript = useCallback(
    (format: ScreenplayExportFormat) => {
      const liveEditor = editorRef.current;
      const docSource: JSONContent | string = liveEditor
        ? liveEditor.getJSON()
        : currentDocJson;
      const meta = {
        title: draftTitle.trim() || activeVersionRecord?.title || projectTitle,
        author:
          activeVersionRecord?.titlePageMetadata?.author ||
          activeVersionRecord?.author ||
          '',
      };

      const filename = formatScreenplayExportFilename(meta.title, format);

      if (format === 'pdf') {
        const bytes = exportScreenplayToPdf(docSource, {
          title: meta.title,
          author: meta.author,
          draftDate: new Date().toISOString().slice(0, 10),
          contact: project.productionCompany || undefined,
          pdfLayout: activeVersionRecord?.pdfLayout,
        });
        triggerScreenplayDownload(bytes, filename, 'application/pdf');
      } else if (format === 'fountain') {
        const content = exportScreenplayToFountain(docSource, meta);
        triggerScreenplayDownload(content, filename, 'text/plain;charset=utf-8');
      } else if (format === 'fdx') {
        const content = exportScreenplayToFdx(docSource, meta);
        triggerScreenplayDownload(
          content,
          filename,
          'application/xml;charset=utf-8'
        );
      }
    },
    [
      activeVersionRecord?.author,
      activeVersionRecord?.title,
      activeVersionRecord?.titlePageMetadata?.author,
      currentDocJson,
      draftTitle,
      project.productionCompany,
      projectTitle,
    ]
  );

  const handleUndo = useCallback(() => {
    if (!editorRef.current || readOnly) return;
    editorRef.current.chain().focus().undo().run();
    setMetrics(computeEditorMetrics(editorRef.current, pagination));
  }, [pagination, readOnly]);

  const handleRedo = useCallback(() => {
    if (!editorRef.current || readOnly) return;
    editorRef.current.chain().focus().redo().run();
    setMetrics(computeEditorMetrics(editorRef.current, pagination));
  }, [pagination, readOnly]);

  const handleToggleNavPanel = useCallback(() => {
    setIsNavPanelOpen((prev) => !prev);
  }, []);

  const handleOpenLibraryPanel = useCallback(() => {
    setActivePanelSection('drafts');
    setIsNavPanelOpen(true);
  }, []);

  const handleOpenRevisionsPanel = useCallback(() => {
    setActivePanelSection('revisions');
    setIsNavPanelOpen(true);
  }, []);

  const handleExecuteCommand = useCallback(
    (commandId: ScreenplayToolbarCommandId) => {
      setImageUploadError(null);

      if (commandId === 'outline') {
        setIsNavPanelOpen((prev) => !prev);
        return;
      }

      if (readOnly) return;

      if (commandId === 'image') {
        imageInputRef.current?.click();
        return;
      }

      const editor = editorRef.current;
      if (!editor) return;

      switch (commandId) {
        case 'scene':
          executeSceneCommand(editor);
          break;
        case 'action':
          setScreenplayElement(editor, 'action');
          break;
        case 'character':
          setScreenplayElement(editor, 'character');
          break;
        case 'parens':
          setScreenplayElement(editor, 'parenthetical');
          break;
        case 'dialogue':
          setScreenplayElement(editor, 'dialogue');
          break;
        case 'transition':
          setScreenplayElement(editor, 'transition');
          break;
        case 'shot':
          setScreenplayElement(editor, 'shot');
          break;
        case 'text':
          setScreenplayElement(editor, 'generalText');
          break;
        case 'note':
          executeNoteCommand(editor);
          break;
        case 'newAct':
          executeNewActCommand(editor);
          break;
        case 'endAct':
          executeEndActCommand(editor);
          break;
        case 'lyrics':
          setScreenplayElement(editor, 'lyrics');
          break;
        case 'sequence':
          executeSequenceCommand(editor);
          break;
        case 'dual':
          executeDualDialogueCommand(editor);
          break;
        default:
          break;
      }

      setMetrics(computeEditorMetrics(editor, pagination));
      setOutlineEntries(extractScreenplayOutline(editor.state.doc));
    },
    [activePanelSection, isNavPanelOpen, pagination, readOnly]
  );

  const handleSceneHeadingAssist = useCallback(
    (
      token:
        | 'INT. '
        | 'EXT. '
        | 'INT./EXT. '
        | ' - DAY'
        | ' - NIGHT'
        | ' - CONTINUOUS'
    ) => {
      if (!editorRef.current || readOnly) return;
      applySceneHeadingAssist(editorRef.current, token);
      setOutlineEntries(extractScreenplayOutline(editorRef.current.state.doc));
    },
    [readOnly]
  );

  const handleImageFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || readOnly) return;

      const editor = editorRef.current;
      if (!editor) return;

      try {
        setImageUploadError(null);
        const processed = await processScreenplayImageFile(file);
        insertScreenplayImage(editor, processed);
        setMetrics(computeEditorMetrics(editor, pagination));
      } catch (err: any) {
        setImageUploadError(
          err?.message || 'Unable to insert the selected image file.'
        );
      }
    },
    [pagination, readOnly]
  );

  const handleNavigateOutlineEntry = useCallback(
    (pos: number) => {
      setSelectedOutlinePos(pos);
      const matchingScene = intelligenceResult.scenes.find(
        (s) => s.sourcePos === pos
      );
      if (matchingScene) {
        setSelectedSceneId(matchingScene.id);
      }
      if (!editorRef.current) return;
      navigateToOutlineEntry(editorRef.current, pos);
    },
    [intelligenceResult.scenes]
  );

  const handleToggleMatrix = useCallback(() => {
    setActiveSubmodule((prev) => (prev === 'intelligence' ? 'library' : 'intelligence'));
    setIsMatrixOpen((prev) => !prev);
  }, []);

  const handleOpenMatrix = useCallback(() => {
    setActiveSubmodule('intelligence');
    setIsMatrixOpen(true);
  }, []);

  const handleSelectMatrixScene = useCallback((scene: ParsedScene) => {
    setSelectedSceneId(scene.id);
    if (typeof scene.sourcePos === 'number') {
      setSelectedOutlinePos(scene.sourcePos);
    }
    setMatrixLayoutMode((prev) => (prev === 'full' ? 'split' : prev));
    if (typeof scene.sourcePos === 'number' && editorRef.current) {
      navigateToOutlineEntry(editorRef.current, scene.sourcePos);
    }
    if (typeof scene.startPage === 'number' && typeof document !== 'undefined') {
      const pageSurface = document.getElementById(`screenplay-page-surface-${scene.startPage}`);
      if (pageSurface && typeof pageSurface.scrollIntoView === 'function') {
        pageSurface.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  /**
   * Commits an updated scenes array (from manual metadata correction, reset, or review toggle)
   * into both local state and the persisted project.screenplayVersions record without mutating
   * the underlying screenplay prose.
   */
  const commitUpdatedScenesToProject = useCallback(
    (nextScenes: ParsedScene[]) => {
      setStoredScenesByDoc((prev) => ({
        ...prev,
        [activeVersionId]: nextScenes,
      }));
      if (!readOnly) {
        const result = persistCurrentScript({
          overrideScenes: nextScenes,
          commitToProject: true,
        });
        if (result.savedId !== activeVersionId) {
          setStoredScenesByDoc((prev) => ({
            ...prev,
            [result.savedId]: nextScenes,
          }));
        }
      }
    },
    [activeVersionId, persistCurrentScript, readOnly]
  );

  const handleRefreshAnalysis = useCallback(() => {
    setLastAnalyzedFingerprint(intelligenceResult.sourceDocFingerprint);
    commitUpdatedScenesToProject(intelligenceResult.scenes);
  }, [commitUpdatedScenesToProject, intelligenceResult.scenes, intelligenceResult.sourceDocFingerprint]);

  const handleApplySceneOverride = useCallback(
    (
      sceneId: string,
      patch: {
        intExt?: SceneIntExt;
        location?: string;
        timeOfDay?: SceneTimeOfDay;
        characters?: string[];
        markReviewed?: boolean;
      }
    ) => {
      if (readOnly) return;
      const nextScenes = applySceneManualOverride(
        intelligenceResult.scenes,
        sceneId,
        patch
      );
      commitUpdatedScenesToProject(nextScenes);
    },
    [commitUpdatedScenesToProject, intelligenceResult.scenes, readOnly]
  );

  const handleResetSceneOverride = useCallback(
    (sceneId: string) => {
      if (readOnly) return;
      const nextScenes = resetSceneManualOverride(
        intelligenceResult.scenes,
        sceneId
      );
      commitUpdatedScenesToProject(nextScenes);
    },
    [commitUpdatedScenesToProject, intelligenceResult.scenes, readOnly]
  );

  const handleToggleSceneReviewed = useCallback(
    (sceneId: string) => {
      if (readOnly) return;
      const nextScenes = toggleSceneReviewedStatus(
        intelligenceResult.scenes,
        sceneId
      );
      commitUpdatedScenesToProject(nextScenes);
    },
    [commitUpdatedScenesToProject, intelligenceResult.scenes, readOnly]
  );

  const handleNavigateToPage = useCallback(
    (targetPageNumber: number) => {
      if (!pagination) return;
      const targetPage = pagination.pages.find(
        (p) => p.pageNumber === targetPageNumber
      );
      if (!targetPage) return;

      if (editorRef.current) {
        navigateToOutlineEntry(editorRef.current, targetPage.startPos + 1);
      }

      if (typeof document !== 'undefined') {
        const pageSurface = document.getElementById(
          `screenplay-page-surface-${targetPageNumber}`
        );
        if (pageSurface && typeof pageSurface.scrollIntoView === 'function') {
          pageSurface.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [pagination]
  );

  // Support Ctrl+S / Cmd+S to save draft, Alt+F to toggle focus mode, Escape to exit focus mode, and Alt+1..9 for core screenplay elements
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSaveDraft();
        return;
      }
      if (event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setIsFocusMode((prev) => !prev);
        return;
      }
      if (event.key === 'Escape' && isFocusMode) {
        event.preventDefault();
        setIsFocusMode(false);
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const keyMap: Record<string, ScreenplayToolbarCommandId> = {
          '1': 'scene',
          '2': 'action',
          '3': 'character',
          '4': 'parens',
          '5': 'dialogue',
          '6': 'transition',
          '7': 'shot',
          '8': 'text',
          '9': 'note',
        };
        const cmd = keyMap[event.key];
        if (cmd) {
          event.preventDefault();
          handleExecuteCommand(cmd);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExecuteCommand, handleSaveDraft, isFocusMode]);

  return (
    <ScreenplayErrorBoundary onResetToBlank={() => handleNewBlankDraft('')}>
      <section
        aria-label="Screenplay writing workspace"
        data-testid="screenplay-workspace-root"
      className="relative flex flex-col w-full h-[calc(100dvh-57px)] min-h-[540px] overflow-hidden select-none"
      style={{
        background: `
          radial-gradient(1200px 700px at 50% -5%, rgba(0, 242, 254, 0.08) 0%, transparent 60%),
          radial-gradient(800px 500px at 10% 25%, rgba(139, 92, 246, 0.09) 0%, transparent 55%),
          radial-gradient(900px 600px at 90% 65%, rgba(59, 7, 100, 0.22) 0%, transparent 60%),
          radial-gradient(700px 450px at 50% 100%, rgba(6, 182, 212, 0.06) 0%, transparent 50%),
          linear-gradient(180deg, #070914 0%, #0a0e22 45%, #080a18 100%)
        `,
        color: 'var(--scr-text-primary, #eef1f6)',
      }}
    >
      {/* Hidden validated image input for the Image toolbar command */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleImageFileSelected}
        className="hidden"
        data-testid="screenplay-image-file-input"
      />

      {/* 2 Peer Sibling Sub-Modules Navigation Bar */}
      {!isFocusMode && (
        <nav
          data-testid="screenplay-submodules-navbar"
          aria-label="Screenplay Workspaces"
          className="h-11 px-4 bg-[#080b18]/80 backdrop-blur-2xl border-b border-cyan-500/15 flex items-center justify-between shrink-0 select-none z-10 transition-all gap-2 overflow-x-auto scrollbar-none shadow-sm"
        >
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/[0.08] shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubmodule('library')}
              data-testid="screenplay-submodule-library-btn"
              title="Manage, import, edit, and export screenplays."
              aria-label="Script Library: Manage, import, edit, and export screenplays."
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
                activeSubmodule === 'library'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold shadow-[0_0_16px_rgba(6,182,212,0.4)] border border-cyan-300/40'
                  : 'text-slate-400 hover:text-cyan-200 hover:bg-white/[0.06]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Script Library</span>
              {versions.length > 0 && (
                <span className={`text-[10px] font-mono ${activeSubmodule === 'library' ? 'opacity-80' : 'opacity-60'}`}>
                  ({versions.length})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubmodule('av-script')}
              data-testid="screenplay-submodule-av-btn"
              title="Write visual cues alongside audio, narration, and dialogue."
              aria-label="AV Script: Write visual cues alongside audio, narration, and dialogue."
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
                activeSubmodule === 'av-script'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold shadow-[0_0_16px_rgba(6,182,212,0.4)] border border-cyan-300/40'
                  : 'text-slate-400 hover:text-cyan-200 hover:bg-white/[0.06]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>AV Script</span>
            </button>
          </div>
        </nav>
      )}

      {activeSubmodule === 'av-script' ? (
        /* Submodule 2: AV Script */
        <AVScriptWorkspace
          project={project}
          activeScreenplayVersion={activeVersionRecord}
          onNavigateTab={onNavigateTab}
          readOnly={readOnly}
        />
      ) : (
        /* Submodule 1: Script Library (Manuscript Writing Workspace) */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Contextual Application & Authoring Toolbar or Minimalist Focus Mode Exit */}
          {isFocusMode ? (
            <div className="absolute top-3 right-6 z-50 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFocusMode(false)}
                aria-label="Exit Focus Mode"
                className="px-3.5 py-1.5 rounded-full bg-[#090d20]/90 hover:bg-[#0f1530] text-cyan-300 hover:text-cyan-100 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)] text-xs font-mono flex items-center gap-1.5 backdrop-blur-md transition-all"
              >
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Exit Focus (Esc)</span>
              </button>
            </div>
          ) : (
            <ScreenplayToolbar
              projectName={projectTitle}
              versions={versions}
              activeVersionId={activeVersionId}
              draftTitle={draftTitle}
              onDraftTitleChange={handleDraftTitleChange}
              onSelectVersion={handleSelectVersion}
              onNewBlankDraft={handleNewBlankDraft}
              onLoadSampleScript={handleLoadSampleScript}
              onSaveDraft={handleSaveDraft}
              isDirty={isDirty}
              saveStatus={saveStatus}
              saveErrorMessage={saveErrorMessage}
              lastSavedAt={lastSavedAt}
              metrics={metrics}
              activeState={activeState}
              pageCount={pageCount}
              activePageNumber={activePageNumber}
              onNavigateToPage={handleNavigateToPage}
              onExecuteCommand={handleExecuteCommand}
              onSceneHeadingAssist={handleSceneHeadingAssist}
              onUndo={handleUndo}
              onRedo={handleRedo}
              zoomPercent={zoomPercent}
              onZoomChange={setZoomPercent}
              isNavPanelOpen={isNavPanelOpen}
              isOutlineOpen={isNavPanelOpen}
              isMatrixOpen={isMatrixOpen}
              sceneCount={intelligenceResult.totalScenes}
              needsReviewCount={intelligenceResult.needsReviewCount}
              onToggleNavPanel={handleToggleNavPanel}
              onToggleMatrix={handleToggleMatrix}
              onOpenLibraryPanel={handleOpenLibraryPanel}
              onOpenRevisionsPanel={handleOpenRevisionsPanel}
              onExportScript={handleExportScript}
              onOpenImportModal={handleTriggerNativeImport}
              onOpenEntryDialog={() => setIsEntryDialogOpen(true)}
              isFocusMode={isFocusMode}
              onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
              activeView={activeView}
              onSelectView={setActiveView}
              hasOriginalPdf={Boolean(activeVersionRecord?.sourcePdfDataUrl)}
              onNavigateToBreakdown={
                onNavigateTab ? () => onNavigateTab('breakdown') : undefined
              }
              readOnly={readOnly}
            />
          )}

          {/* Inline Image Validation Banner (only visible if an invalid image file was chosen) */}
          {imageUploadError && (
            <div
              role="alert"
              data-testid="screenplay-image-error-banner"
              className="px-4 py-1.5 bg-rose-950/90 border-b border-rose-500/40 text-rose-200 text-xs flex items-center justify-between"
            >
              <span>{imageUploadError}</span>
              <button
                type="button"
                onClick={() => setImageUploadError(null)}
                className="text-rose-300 hover:text-white underline text-[11px] ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main Workspace Body: Expandable Secondary Panel Overlay + Scene Matrix + Centered Document Viewport */}
          <div className="relative flex-1 min-h-0 flex w-full overflow-hidden">
            {!isFocusMode && (
              <ScreenplayNavigationPanel
                isOpen={isNavPanelOpen}
                activeSection={activePanelSection}
                onSelectSection={setActivePanelSection}
                onClose={() => setIsNavPanelOpen(false)}
                projectName={projectTitle}
                versions={versions}
                activeVersionId={activeVersionId}
                currentLiveText={currentText}
                onSelectVersion={handleSelectVersion}
                onNewBlankDraft={handleNewBlankDraft}
                onLoadSampleScript={handleLoadSampleScript}
                onImportScriptFile={handleImportScriptFile}
                onImportFileDirect={handleProcessAndOpenImportedFile}
                onImportPreviewConfirm={handleImportPreviewConfirm}
                onOpenImportModal={handleTriggerNativeImport}
                onRenameScript={handleRenameScript}
                onDuplicateScript={handleDuplicateScript}
                onDeleteScript={handleDeleteScript}
                onCreateCheckpoint={handleCreateCheckpoint}
                onRestoreRevision={handleRestoreRevision}
                onExportScript={handleExportScript}
                outlineEntries={paginatedOutlineEntries}
                selectedOutlinePos={selectedOutlinePos}
                onNavigateOutlineEntry={handleNavigateOutlineEntry}
                onOpenSceneMatrix={handleOpenMatrix}
                pageCount={pageCount}
                activePageNumber={activePageNumber}
                onNavigateToPage={handleNavigateToPage}
                onNavigateTab={onNavigateTab}
                readOnly={readOnly}
              />
            )}

            {!isFocusMode && isMatrixOpen && (
              <div
                className={
                  matrixLayoutMode === 'full'
                    ? 'flex-1 min-w-0 h-full overflow-hidden'
                    : 'w-[54%] min-w-[440px] max-w-[780px] h-full overflow-hidden shrink-0'
                }
              >
                <ScreenplaySceneMatrix
                  projectTitle={projectTitle}
                  draftTitle={draftTitle}
                  versionLabel={activeVersionRecord?.version || 'Working Draft'}
                  sourceDocumentId={activeVersionId}
                  sourceDocFingerprint={intelligenceResult.sourceDocFingerprint}
                  scenes={intelligenceResult.scenes}
                  selectedSceneId={selectedSceneId}
                  onSelectScene={handleSelectMatrixScene}
                  onApplyManualOverride={handleApplySceneOverride}
                  onResetManualOverride={handleResetSceneOverride}
                  onToggleSceneReviewed={handleToggleSceneReviewed}
                  onInsertFirstSceneHeading={() => {
                    if (matrixLayoutMode === 'full') {
                      setMatrixLayoutMode('split');
                    }
                    handleExecuteCommand('scene');
                  }}
                  layoutMode={matrixLayoutMode}
                  onChangeLayoutMode={setMatrixLayoutMode}
                  onCloseMatrix={() => setIsMatrixOpen(false)}
                  onNavigateToBreakdown={
                    onNavigateTab ? () => onNavigateTab('breakdown') : undefined
                  }
                  readOnly={readOnly}
                />
              </div>
            )}

            {/* 1. Original Source PDF Viewer */}
            {activeView === 'pdf' && activeVersionRecord?.sourcePdfDataUrl && (
              <div className="flex-1 min-w-0 h-full overflow-hidden">
                <ScreenplayPdfViewer
                  pdfData={activeVersionRecord.sourcePdfDataUrl}
                  fileName={
                    activeVersionRecord.sourcePdfFileName ||
                    activeVersionRecord.fileName ||
                    'source.pdf'
                  }
                  onSwitchToEditor={() => setActiveView('screenplay')}
                />
              </div>
            )}

            {/* 2. Distinct Title Page View */}
            {activeView === 'titlepage' && (
              <div className="flex-1 min-w-0 h-full overflow-y-auto bg-stone-900/60 p-6 flex justify-center">
                <ScreenplayTitlePageView
                  metadata={{
                    title: draftTitle || activeVersionRecord?.title || '',
                    credit: 'written by',
                    draftDate:
                      activeVersionRecord?.lastSavedAt ||
                      activeVersionRecord?.updatedAt ||
                      '',
                    contact: '',
                    notes: '',
                    ...activeVersionRecord?.titlePageMetadata,
                    author:
                      activeVersionRecord?.titlePageMetadata?.author ??
                      activeVersionRecord?.author ??
                      '',
                  }}
                  pdfLayout={activeVersionRecord?.pdfLayout}
                  onChangeMetadata={handleChangeTitlePageMetadata}
                  onChangeTitlePageLayout={handleTitlePageLayoutChange}
                  readOnly={readOnly}
                />
              </div>
            )}

            {/* 3. Live Manuscript View (PDF Page-Based or Dynamic Tiptap) */}
            <div
              className={
                (activeView === 'pdf' && activeVersionRecord?.sourcePdfDataUrl) ||
                activeView === 'titlepage' ||
                (!isFocusMode && isMatrixOpen && matrixLayoutMode === 'full')
                  ? 'hidden'
                  : 'flex-1 min-w-0 h-full flex overflow-hidden'
              }
            >
              <ScreenplayErrorBoundary onResetToBlank={() => handleNewBlankDraft('')}>
                {activeVersionRecord?.pdfLayout &&
                activeVersionRecord.pdfLayout.pages.length > 0 ? (
                  <ScreenplayPdfEditableManuscript
                    layout={activeVersionRecord.pdfLayout}
                    zoomPercent={zoomPercent}
                    activePageNumber={activePageNumber}
                    onPageChange={handleNavigateToPage}
                    onChangeLayout={handlePdfLayoutChange}
                    readOnly={readOnly}
                  />
                ) : (
                  <ScreenplayDocumentViewport
                    zoomPercent={zoomPercent}
                    pageCount={pageCount}
                    viewportRef={viewportRef}
                  >
                    <ScreenplayPage
                      editor={editorInstance}
                      pageNumber={1}
                      pages={pagination?.pages}
                      pageConfig={pagination?.config}
                    >
                      <ScreenplayEditor
                        initialContent={initialEditorDoc}
                        draftKey={draftRevisionKey}
                        onDocumentChange={handleDocumentChange}
                        onMetricsChange={setMetrics}
                        onOutlineChange={setOutlineEntries}
                        onActiveStateChange={setActiveState}
                        onPaginationChange={setPagination}
                        onEditorReady={handleEditorReady}
                      />
                    </ScreenplayPage>
                  </ScreenplayDocumentViewport>
                )}
              </ScreenplayErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Native File Picker Input for Zero-Intermediary Direct Import */}
      <input
        type="file"
        ref={nativeFileInputRef}
        accept=".pdf,.fdx,.fountain,.spmd,.docx"
        style={{ display: 'none' }}
        data-testid="screenplay-native-file-input"
        onChange={handleNativeFileChange}
      />

      {/* Concise Direct Import Loading Indicator */}
      {importProgress.isLoading && (
        <div
          role="status"
          aria-live="polite"
          data-testid="screenplay-import-loading-overlay"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white animate-fade-in"
        >
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#090d22]/90 backdrop-blur-2xl border border-cyan-500/20 shadow-2xl max-w-sm text-center">
            <div className="w-9 h-9 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin flex items-center justify-center" />
            <div className="font-semibold text-sm">Importing Screenplay</div>
            <div className="text-xs text-slate-400 truncate max-w-[260px]">
              {importProgress.fileName || 'Processing document...'}
            </div>
            <p className="text-[11px] text-slate-500">
              Parsing structure, scene headings, and character dialogue...
            </p>
          </div>
        </div>
      )}

      {/* Import Error Banner */}
      {importProgress.error && (
        <div
          role="alert"
          data-testid="screenplay-import-error-banner"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 py-3 rounded-xl bg-rose-950/95 border border-rose-500/50 text-rose-200 text-xs shadow-2xl flex items-center justify-between gap-3 animate-fade-in"
        >
          <span>{importProgress.error}</span>
          <button
            type="button"
            onClick={() => setImportProgress((prev) => ({ ...prev, error: null }))}
            className="text-rose-300 hover:text-white underline text-[11px] shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* WriterSolo Reference Flow Step 1: Entry Welcome Dialog */}
      <ScreenplayEntryDialog
        isOpen={isEntryDialogOpen}
        onClose={() => {
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`sceneos_entry_dismissed_${project.id}`, 'true');
            } catch {
              // ignore
            }
          }
          setIsEntryDialogOpen(false);
        }}
        onNewScreenplay={() => {
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`sceneos_entry_dismissed_${project.id}`, 'true');
            } catch {
              // ignore
            }
          }
          handleNewBlankDraft();
          setActiveView('screenplay');
          setIsEntryDialogOpen(false);
        }}
        onSelectVersion={(vId) => {
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`sceneos_entry_dismissed_${project.id}`, 'true');
            } catch {
              // ignore
            }
          }
          handleSelectVersion(vId);
          setActiveView('screenplay');
          setIsEntryDialogOpen(false);
        }}
        onOpenLibraryPanel={() => {
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`sceneos_entry_dismissed_${project.id}`, 'true');
            } catch {
              // ignore
            }
          }
          handleOpenLibraryPanel();
          setIsEntryDialogOpen(false);
        }}
        onTriggerNativeImport={handleTriggerNativeImport}
        onImportFileDirect={handleProcessAndOpenImportedFile}
        versions={versions}
        activeVersionId={activeVersionId}
        projectName={projectTitle}
        hasExistingScript={Boolean(activeVersionRecord || currentText)}
      />

      {/* Script Import Modal (Kept for Drag-Drop or Alternative Invocation) */}
      <ScreenplayImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmImport={handleConfirmCanonicalImport}
        projectTitle={projectTitle}
      />
    </section>
  </ScreenplayErrorBoundary>
);
};

export default ScreenplayWorkspace;
