import React, { useState, useRef, useEffect } from 'react';
import {
  Save,
  Check,
  AlertCircle,
  Loader2,
  Undo2,
  Redo2,
  ChevronDown,
  ChevronUp,
  FileText,
  SlidersHorizontal,
  Download,
  Upload,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeft,
  ArrowUpRight,
  BookOpen,
  Clapperboard,
  AlignLeft,
  User,
  Parentheses,
  MessageSquare,
  ArrowRightLeft,
  Camera,
  Type,
  StickyNote,
  ListTree,
  BookmarkPlus,
  Flag,
  Music,
  Image as ImageIcon,
  Layers,
  Columns2,
  History,
  Shield,
  Sparkles,
} from 'lucide-react';
import { ScreenplayVersion } from '../../../types';
import { ScreenplayEditorMetrics } from './ScreenplayEditor';
import { ScreenplayElementType } from '../schema/screenplayExtensions';
import {
  SCREENPLAY_AUTHORING_COMMANDS,
  ScreenplayToolbarCommandId,
  ActiveScreenplayState,
} from '../commands/screenplayCommands';
import {
  ScreenplaySaveStatus,
  ScreenplayExportFormat,
} from '../services/screenplayDocumentLifecycle';

export interface ScreenplayToolbarProps {
  projectName: string;
  versions: ScreenplayVersion[];
  activeVersionId: string;
  draftTitle: string;
  onDraftTitleChange: (title: string) => void;
  onSelectVersion: (versionId: string) => void;
  onNewBlankDraft: () => void;
  onLoadSampleScript: () => void;
  onSaveDraft: () => void;
  isDirty: boolean;
  saveStatus?: ScreenplaySaveStatus;
  saveErrorMessage?: string | null;
  lastSavedAt: string | null;
  metrics: ScreenplayEditorMetrics | any;
  activeState: ActiveScreenplayState | any;
  pageCount?: number;
  activePageNumber?: number;
  onNavigateToPage?: (pageNumber: number) => void;
  onExecuteCommand: (commandId: ScreenplayToolbarCommandId) => void;
  onSceneHeadingAssist?: (
    token: 'INT. ' | 'EXT. ' | 'INT./EXT. ' | ' - DAY' | ' - NIGHT' | ' - CONTINUOUS'
  ) => void;
  onUndo: () => void;
  onRedo: () => void;
  zoomPercent: number;
  onZoomChange: (nextZoom: number) => void;
  isNavPanelOpen: boolean;
  isOutlineOpen: boolean;
  onToggleNavPanel: () => void;
  onOpenLibraryPanel?: () => void;
  onOpenRevisionsPanel?: () => void;
  onExportScript?: (format: ScreenplayExportFormat) => void;
  onOpenImportModal?: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  isMatrixOpen?: boolean;
  sceneCount?: number;
  needsReviewCount?: number;
  onToggleMatrix?: () => void;
  onNavigateToBreakdown?: () => void;
  readOnly?: boolean;
  activeView?: 'screenplay' | 'titlepage' | 'pdf';
  onSelectView?: (view: 'screenplay' | 'titlepage' | 'pdf') => void;
  hasOriginalPdf?: boolean;
  initialExportMenuOpen?: boolean;
  onOpenEntryDialog?: () => void;
}

const COMMAND_ICONS: Record<
  ScreenplayToolbarCommandId,
  React.ComponentType<{ className?: string }>
> = {
  scene: Clapperboard,
  action: AlignLeft,
  character: User,
  parens: Parentheses,
  dialogue: MessageSquare,
  transition: ArrowRightLeft,
  shot: Camera,
  text: Type,
  note: StickyNote,
  outline: ListTree,
  newAct: BookmarkPlus,
  endAct: Flag,
  lyrics: Music,
  image: ImageIcon,
  sequence: Layers,
  dual: Columns2,
};

const COMMAND_DESCRIPTIONS: Record<
  ScreenplayToolbarCommandId,
  { name: string; description: string; shortcut?: string }
> = {
  scene: {
    name: 'Scene Heading',
    description: 'Establishes a new scene setting, location, and time of day (INT./EXT.).',
    shortcut: 'Alt+1',
  },
  action: {
    name: 'Action Paragraph',
    description: 'Describes narrative events, character actions, physical surroundings, and camera movement.',
    shortcut: 'Alt+2',
  },
  character: {
    name: 'Character Cue',
    description: 'Formats character name centered in uppercase directly preceding speech.',
    shortcut: 'Alt+3',
  },
  parens: {
    name: 'Parenthetical',
    description: 'Provides delivery tone or brief actor direction enclosed in parentheses.',
    shortcut: 'Alt+4',
  },
  dialogue: {
    name: 'Dialogue',
    description: 'Formats character dialogue with standard screenplay margins and indentation.',
    shortcut: 'Alt+5',
  },
  transition: {
    name: 'Transition',
    description: 'Inserts right-aligned scene change direction (e.g. CUT TO:, FADE OUT.).',
    shortcut: 'Alt+6',
  },
  shot: {
    name: 'Camera / Shot',
    description: 'Specifies a specific camera angle, POV, insert, or framing cue.',
    shortcut: 'Alt+7',
  },
  text: {
    name: 'General Text',
    description: 'Standard unformatted narrative text without strict screenplay indentation.',
    shortcut: 'Alt+8',
  },
  note: {
    name: 'Script Note',
    description: 'Inserts an inline editorial note, revision comment, or production reminder.',
    shortcut: 'Alt+9',
  },
  newAct: {
    name: 'New Act',
    description: 'Inserts centered Roman numeral Act division heading (e.g. ACT I).',
  },
  endAct: {
    name: 'End Act',
    description: 'Inserts centered end-of-act conclusion marker (e.g. END OF ACT I).',
  },
  lyrics: {
    name: 'Lyrics',
    description: 'Formats musical verse or sung lyrics with poetic indentation.',
  },
  sequence: {
    name: 'Sequence',
    description: 'Groups related scenes under a titled sequence breakdown header.',
  },
  dual: {
    name: 'Dual Dialogue',
    description: 'Pairs two character speeches side-by-side for simultaneous dialogue.',
  },
  image: {
    name: 'Reference Image',
    description: 'Inserts visual storyboard reference or concept artwork into manuscript.',
  },
  outline: {
    name: 'Document Outline',
    description: 'Toggles document outline and scene navigation index.',
  },
};

const COMMAND_GROUPS: Array<{
  id: string;
  items: ScreenplayToolbarCommandId[];
}> = [
  {
    id: 'narrative',
    items: ['scene', 'action', 'character', 'parens', 'dialogue', 'transition', 'shot'],
  },
  {
    id: 'editorial',
    items: ['text', 'note', 'lyrics'],
  },
  {
    id: 'structural',
    items: ['newAct', 'endAct', 'sequence', 'dual', 'image'],
  },
  {
    id: 'navigation',
    items: ['outline'],
  },
];

const ELEMENT_LABELS: Record<string, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  generalText: 'General Text',
  screenplayNote: 'Note',
  actHeading: 'Act Heading',
  endAct: 'End Act',
  lyrics: 'Lyrics',
  sequenceHeading: 'Sequence',
  dualDialogue: 'Dual Dialogue',
};

export const ScreenplayToolbar: React.FC<ScreenplayToolbarProps> = ({
  projectName,
  versions,
  activeVersionId,
  draftTitle,
  onDraftTitleChange,
  onSelectVersion,
  onNewBlankDraft,
  onLoadSampleScript,
  onSaveDraft,
  isDirty,
  saveStatus,
  saveErrorMessage,
  lastSavedAt,
  metrics,
  activeState,
  pageCount = 1,
  activePageNumber = 1,
  onNavigateToPage,
  onExecuteCommand,
  onSceneHeadingAssist,
  onUndo,
  onRedo,
  zoomPercent,
  onZoomChange,
  isNavPanelOpen,
  isOutlineOpen,
  onToggleNavPanel,
  onOpenLibraryPanel,
  onOpenRevisionsPanel,
  onExportScript,
  onOpenImportModal,
  isFocusMode = false,
  onToggleFocusMode,
  isMatrixOpen = false,
  sceneCount = 0,
  needsReviewCount = 0,
  onToggleMatrix,
  onNavigateToBreakdown,
  readOnly = false,
  activeView = 'screenplay',
  onSelectView,
  hasOriginalPdf = false,
  initialExportMenuOpen = false,
  onOpenEntryDialog,
}) => {
  const [isDraftMenuOpen, setIsDraftMenuOpen] = useState(false);
  const [isElementPickerOpen, setIsElementPickerOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(initialExportMenuOpen);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(draftTitle);
  const [hoveredCmd, setHoveredCmd] = useState<ScreenplayToolbarCommandId | null>(null);
  const [focusedCmd, setFocusedCmd] = useState<ScreenplayToolbarCommandId | null>(null);

  const draftMenuRef = useRef<HTMLDivElement>(null);
  const elementPickerRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(draftTitle);
  }, [draftTitle]);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (draftMenuRef.current && !draftMenuRef.current.contains(target)) {
        setIsDraftMenuOpen(false);
      }
      if (elementPickerRef.current && !elementPickerRef.current.contains(target)) {
        setIsElementPickerOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== draftTitle) {
      onDraftTitleChange(trimmed);
    } else {
      setTitleInput(draftTitle);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setTitleInput(draftTitle);
      setIsEditingTitle(false);
    }
  };

  const effectiveSaveStatus: ScreenplaySaveStatus =
    saveStatus || (isDirty ? 'dirty' : 'saved');

  // Normalize active element from varied activeState shapes
  const currentElementType: string =
    (activeState as any)?.currentElementType ||
    (activeState as any)?.activeElement ||
    'action';

  const currentElementLabel =
    ELEMENT_LABELS[currentElementType] ||
    currentElementType.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());

  const CurrentElementIcon =
    currentElementType === 'sceneHeading'
      ? Clapperboard
      : currentElementType === 'character'
      ? User
      : currentElementType === 'parenthetical'
      ? Parentheses
      : currentElementType === 'dialogue'
      ? MessageSquare
      : currentElementType === 'transition'
      ? ArrowRightLeft
      : AlignLeft;

  return (
    <header
      data-testid="screenplay-primary-toolbar"
      className="w-full select-none border-b shrink-0 flex flex-col justify-center transition-all"
      style={{
        backgroundColor: 'var(--scr-bg-surface, #090c1a)',
        borderColor: 'var(--scr-border, rgba(0, 242, 254, 0.12))',
      }}
    >
      {/* 1. Refined Manuscript Writing and Editing Formatting Bar — Repositioned All 15 Icons Centered with Liquid Glass */}
      <div
        data-testid="screenplay-formatting-bar"
        className="w-full h-12 px-4 flex items-center justify-center overflow-x-auto scrollbar-none border-b border-cyan-500/15 bg-gradient-to-r from-[#070914]/90 via-[#0c1024]/95 to-[#070914]/90 backdrop-blur-2xl relative shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center justify-center gap-1.5 p-1 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.08)] mx-auto shrink-0">
          {COMMAND_GROUPS.map((group, groupIdx) => (
            <React.Fragment key={group.id}>
              {groupIdx > 0 && (
                <div
                  className="h-5 w-px bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent mx-1 shrink-0"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-center gap-1 shrink-0">
                {group.items.map((cmdId) => {
                  const cmd = SCREENPLAY_AUTHORING_COMMANDS.find((c) => c.id === cmdId);
                  if (!cmd) return null;
                  const Icon = COMMAND_ICONS[cmd.id] || AlignLeft;
                  const desc = COMMAND_DESCRIPTIONS[cmd.id] || {
                    name: cmd.label,
                    description: cmd.title,
                    shortcut: cmd.shortcut,
                  };
                  const isActive =
                    (cmd.elementType && currentElementType === cmd.elementType) ||
                    (cmd.id === 'scene' && currentElementType === 'sceneHeading') ||
                    (cmd.id === 'parens' && currentElementType === 'parenthetical');

                  const isTooltipVisible = hoveredCmd === cmd.id || focusedCmd === cmd.id;

                  return (
                    <div key={cmd.id} className="relative shrink-0">
                      <button
                        type="button"
                        disabled={readOnly}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onExecuteCommand(cmd.id)}
                        onMouseEnter={() => setHoveredCmd(cmd.id)}
                        onMouseLeave={() => setHoveredCmd(null)}
                        onFocus={() => setFocusedCmd(cmd.id)}
                        onBlur={() => setFocusedCmd(null)}
                        data-testid={`screenplay-cmd-${cmd.id}`}
                        aria-label={`${desc.name}${desc.shortcut ? ` (${desc.shortcut})` : ''}`}
                        title={`${desc.name}: ${desc.description}${desc.shortcut ? ` [${desc.shortcut}]` : ''}`}
                        className={`flex flex-col items-center justify-center min-w-[44px] h-9 px-2 rounded-xl transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 group ${
                          isActive
                            ? 'bg-gradient-to-b from-cyan-500/25 to-violet-600/20 text-cyan-200 border border-cyan-400/60 ring-1 ring-cyan-400/40 shadow-[0_0_16px_rgba(6,182,212,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)] font-semibold'
                            : 'text-slate-300 hover:text-cyan-200 hover:bg-cyan-500/10 hover:border-cyan-500/30 border border-transparent hover:shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        } ${readOnly ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 mb-0.5 transition-transform duration-200 group-hover:scale-110 ${
                          isActive
                            ? 'text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]'
                            : 'text-slate-300 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]'
                        }`} />
                        <span className="text-[10px] leading-none tracking-tight font-medium">
                          {cmd.label}
                        </span>
                      </button>

                      {/* Contextual Hover and Focus Tooltip */}
                      {isTooltipVisible && (
                        <div
                          role="tooltip"
                          className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 z-50 pointer-events-none px-3.5 py-2.5 rounded-2xl bg-[#080d1e]/95 backdrop-blur-2xl border border-cyan-500/30 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.15)] min-w-[220px] max-w-xs text-left animate-fade-in"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-1.5">
                            <span className="font-semibold text-xs text-cyan-300">
                              {desc.name}
                            </span>
                            {desc.shortcut && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                                {desc.shortcut}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 leading-snug">
                            {desc.description}
                          </p>
                          {isActive && (
                            <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-cyan-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                              <span>Currently Active</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 2. Sub-Toolbar Row: Navigation, Draft Selector, View Switcher & Actions with Liquid Glass Refinement */}
      <div className="h-11 w-full px-4 flex items-center justify-between gap-2 border-b border-cyan-500/10 bg-[#080b18]/80 backdrop-blur-xl">
        {/* Left Section: Navigator, Draft Selector, Contextual Element Picker, Undo/Redo */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Navigator Toggle Button */}
          <button
            type="button"
            onClick={onToggleNavPanel}
            aria-pressed={isNavPanelOpen}
            aria-label={isNavPanelOpen ? 'Hide Navigator' : 'Show Navigator'}
            title="Manuscript Outline & Navigator"
            data-testid="screenplay-toggle-nav-btn"
            className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              isNavPanelOpen
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'text-[#9ba3b4] hover:text-white hover:bg-white/[0.06] border border-white/[0.08]'
            }`}
          >
            {isNavPanelOpen ? (
              <PanelLeftClose className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <PanelLeft className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline text-[11px]">Navigator</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-0.5 shrink-0" aria-hidden="true" />

          {/* Contextual Scene Heading Quick Tokens (Appear only when in a Scene Heading) */}
          {currentElementType === 'sceneHeading' && onSceneHeadingAssist && !readOnly && (
            <div
              className="hidden lg:flex items-center gap-1 ml-1"
              data-testid="screenplay-scene-assist-bar"
            >
              {(['INT. ', 'EXT. ', ' - DAY', ' - NIGHT'] as const).map((token) => (
                <button
                  key={token}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSceneHeadingAssist(token)}
                  className="h-6 px-1.5 rounded-lg text-[10px] font-mono bg-cyan-950/40 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 transition cursor-pointer"
                >
                  {token.trim()}
                </button>
              ))}
            </div>
          )}

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              data-testid="screenplay-undo-btn"
              className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-200 transition cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Y)"
              data-testid="screenplay-redo-btn"
              className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-200 transition cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center Section: View Switcher (Manuscript, Title Page, Original PDF) */}
        <div className="hidden md:flex items-center p-1 rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.08] shadow-inner">
          <button
            type="button"
            onClick={() => onSelectView?.('screenplay')}
            data-testid="screenplay-view-screenplay-btn"
            className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeView === 'screenplay'
                ? 'bg-gradient-to-r from-cyan-500/25 to-violet-600/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-semibold'
                : 'text-slate-400 hover:text-cyan-200'
            }`}
          >
            Manuscript
          </button>
          <button
            type="button"
            onClick={() => onSelectView?.('titlepage')}
            data-testid="screenplay-view-titlepage-btn"
            className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeView === 'titlepage'
                ? 'bg-gradient-to-r from-cyan-500/25 to-violet-600/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-semibold'
                : 'text-slate-400 hover:text-cyan-200'
            }`}
          >
            Title Page
          </button>
          {hasOriginalPdf && (
            <button
              type="button"
              onClick={() => onSelectView?.('pdf')}
              data-testid="screenplay-view-pdf-btn"
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                activeView === 'pdf'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3 h-3 text-violet-400" />
              <span>Source PDF</span>
            </button>
          )}
        </div>

        {/* Right Section: Page Indicator, Import, Export, Focus Mode, Save Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Page Counter Indicator */}
          <div
            className="flex items-center gap-1 text-[11px] font-mono tabular-nums px-2.5 py-1 rounded-xl bg-black/30 border border-white/[0.08] text-slate-300"
            data-testid="screenplay-page-indicator"
          >
            <span>
              Pg {activePageNumber} / {pageCount}
            </span>
            {onNavigateToPage && pageCount > 1 && (
              <div className="flex items-center ml-1">
                <button
                  type="button"
                  onClick={() => onNavigateToPage(Math.max(1, activePageNumber - 1))}
                  disabled={activePageNumber <= 1}
                  aria-label="Previous page"
                  className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToPage(Math.min(pageCount, activePageNumber + 1))}
                  disabled={activePageNumber >= pageCount}
                  aria-label="Next page"
                  className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Start / Welcome Entry Screen */}
          {onOpenEntryDialog && (
            <button
              type="button"
              onClick={onOpenEntryDialog}
              data-testid="screenplay-open-entry-btn"
              title="Open Screenplay Welcome & Quick Start"
              className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-medium text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30 transition cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.15)]"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline text-[11px]">Quick Start</span>
            </button>
          )}

          {/* Universal Import Button */}
          {onOpenImportModal && (
            <button
              type="button"
              onClick={onOpenImportModal}
              disabled={readOnly}
              data-testid="screenplay-toolbar-import-btn"
              title="Import Screenplay (PDF, Final Draft FDX, Fountain, DOCX)"
              className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-200 hover:bg-cyan-500/10 border border-white/[0.08] hover:border-cyan-500/30 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline text-[11px]">Import</span>
            </button>
          )}

          {/* Export Dropdown */}
          {onExportScript && (
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                data-testid="screenplay-toolbar-export-btn"
                title="Export Screenplay"
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-violet-200 hover:bg-violet-500/10 border border-white/[0.08] hover:border-violet-500/30 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-violet-400" />
                <span className="hidden lg:inline text-[11px]">Export</span>
              </button>

              {isExportMenuOpen && (
                <div
                  data-testid="screenplay-toolbar-export-menu"
                  className="absolute right-0 top-8 z-50 w-44 rounded-2xl border border-violet-500/30 bg-[#090d20]/95 backdrop-blur-2xl p-1.5 shadow-2xl space-y-0.5 animate-fade-in"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      onExportScript('pdf');
                    }}
                    data-testid="screenplay-toolbar-export-pdf"
                    className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs text-slate-200 hover:bg-cyan-500/15 hover:text-cyan-300 flex items-center justify-between cursor-pointer"
                  >
                    <span className="font-medium text-cyan-300">PDF Document</span>
                    <span className="font-mono text-[10px] opacity-60">.pdf</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      onExportScript('fountain');
                    }}
                    data-testid="screenplay-toolbar-export-fountain"
                    className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs text-slate-200 hover:bg-violet-500/15 hover:text-violet-300 flex items-center justify-between cursor-pointer"
                  >
                    <span>Fountain</span>
                    <span className="font-mono text-[10px] opacity-60">.fountain</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      onExportScript('fdx');
                    }}
                    data-testid="screenplay-toolbar-export-fdx"
                    className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs text-slate-200 hover:bg-sky-500/15 hover:text-sky-300 flex items-center justify-between cursor-pointer"
                  >
                    <span>Final Draft XML</span>
                    <span className="font-mono text-[10px] opacity-60">.fdx</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Focus Mode Toggle Button */}
          <button
              type="button"
              onClick={onToggleFocusMode || (() => {})}
              data-testid="screenplay-toolbar-focus-btn"
              title={isFocusMode ? 'Exit Focus Mode (Esc or Alt+F)' : 'Focus Mode (Alt+F)'}
              className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                isFocusMode
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'text-slate-300 hover:text-cyan-200 hover:bg-white/[0.06] border border-white/[0.08]'
              }`}
            >
              {isFocusMode ? (
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden xl:inline text-[11px]">Focus</span>
            </button>

          {/* Save Status & Action Button */}
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={readOnly || effectiveSaveStatus === 'saving'}
            data-save-status={effectiveSaveStatus}
            data-testid="screenplay-save-draft-btn"
            title={
              effectiveSaveStatus === 'dirty'
                ? 'Save Changes (Ctrl+S)'
                : effectiveSaveStatus === 'saving'
                ? 'Saving draft...'
                : lastSavedAt
                ? `Saved at ${lastSavedAt}`
                : 'All changes saved'
            }
            className={`h-7 px-3 inline-flex items-center gap-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              effectiveSaveStatus === 'dirty'
                ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold shadow-[0_0_18px_rgba(6,182,212,0.5)]'
                : effectiveSaveStatus === 'saving'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : effectiveSaveStatus === 'error'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08]'
            }`}
          >
            {effectiveSaveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                <span data-testid="screenplay-save-status-label">Saving...</span>
              </>
            ) : effectiveSaveStatus === 'error' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span data-testid="screenplay-save-status-label">Save Failed</span>
              </>
            ) : effectiveSaveStatus === 'dirty' ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span data-testid="screenplay-save-status-label">Save Draft</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span data-testid="screenplay-save-status-label">Saved</span>
              </>
            )}
          </button>


        </div>
      </div>
    </header>
  );
};

export default ScreenplayToolbar;
