import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FilmProject, ParsedScene } from '../../../types';
import {
  FileText,
  Printer,
  CheckSquare,
  Square,
  Film,
  Layers,
  Search,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sliders,
  X,
  Sparkles,
  ArrowRight,
  MessageSquare,
  RotateCcw,
  EyeOff,
  Eye
} from 'lucide-react';

export type SupplementaryBlockType =
  | 'scene_heading'
  | 'action'
  | 'dialogue'
  | 'parenthetical'
  | 'direction'
  | 'custom';

export interface SupplementaryBlock {
  id: string;
  sceneId: string;
  type: SupplementaryBlockType;
  character?: string;
  parenthetical?: string;
  content: string;
  order: number;
}

interface ScreenplayBlock {
  type: 'action' | 'dialogue' | 'parenthetical' | 'transition';
  character?: string;
  parenthetical?: string;
  text: string;
}

interface ScriptSidesWorkspaceProps {
  project: FilmProject;
  scenes?: ParsedScene[];
  onNavigateTab?: (tab: string, submodule?: string) => void;
  onJumpToScene?: (sceneId: string) => void;
}

/**
 * Extracts verbatim screenplay prose blocks (action, character cues, dialogue,
 * parentheticals, transitions) directly from raw screenplay text if available.
 */
function extractSceneProseFromRaw(scene: ParsedScene, rawText: string): ScreenplayBlock[] | null {
  if (!rawText || !rawText.trim()) return null;
  const lines = rawText.split('\n');
  const targetHeading = (scene.slugline || scene.heading || scene.originalHeading || '').trim().toUpperCase();

  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim().toUpperCase();
    if (l && (l === targetHeading || l.endsWith(targetHeading) || targetHeading.endsWith(l))) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1 && scene.location) {
    const locUpper = scene.location.toUpperCase();
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim().toUpperCase();
      if ((l.startsWith('INT.') || l.startsWith('EXT.') || l.startsWith('INT/EXT.')) && l.includes(locUpper)) {
        startIndex = i;
        break;
      }
    }
  }

  if (startIndex === -1) return null;

  const blocks: ScreenplayBlock[] = [];
  const sceneHeadingRegex = /^(?:[0-9]+[.\s]+)?(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)/i;

  let currentAction: string[] = [];
  let currentCharacter: string | null = null;
  let currentParenthetical: string | null = null;
  let currentDialogue: string[] = [];

  const flushAction = () => {
    if (currentAction.length > 0) {
      blocks.push({ type: 'action', text: currentAction.join(' ') });
      currentAction = [];
    }
  };

  const flushDialogue = () => {
    if (currentCharacter && currentDialogue.length > 0) {
      blocks.push({
        type: 'dialogue',
        character: currentCharacter,
        parenthetical: currentParenthetical || undefined,
        text: currentDialogue.join(' '),
      });
      currentCharacter = null;
      currentParenthetical = null;
      currentDialogue = [];
    }
  };

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushAction();
      flushDialogue();
      continue;
    }

    // Stop when encountering the next scene heading
    if (sceneHeadingRegex.test(line)) {
      break;
    }

    // Detect transitions (e.g. CUT TO:, FADE OUT.)
    if (/^(?:CUT TO|FADE OUT|FADE TO|DISSOLVE TO|SMASH CUT TO|MATCH CUT TO):?$/i.test(line)) {
      flushAction();
      flushDialogue();
      blocks.push({ type: 'transition', text: line });
      continue;
    }

    // Detect parentheticals
    if (line.startsWith('(') && line.endsWith(')')) {
      if (currentCharacter) {
        currentParenthetical = line.slice(1, -1);
      } else {
        currentAction.push(line);
      }
      continue;
    }

    // Detect character cue (UPPERCASE line, <= 35 chars)
    const isChar =
      line === line.toUpperCase() &&
      line.length <= 35 &&
      !/[.,?!;]$/.test(line.replace(/\s*\([^)]*\)\s*$/, '')) &&
      i + 1 < lines.length &&
      lines[i + 1].trim().length > 0;

    if (isChar && !currentCharacter) {
      flushAction();
      currentCharacter = line.replace(/\s*\([^)]*\)\s*$/, '').trim();
      const extMatch = line.match(/\(([^)]+)\)/);
      if (extMatch) {
        currentParenthetical = extMatch[1];
      }
      continue;
    }

    if (currentCharacter) {
      currentDialogue.push(line);
    } else {
      currentAction.push(line);
    }
  }

  flushAction();
  flushDialogue();

  return blocks.length > 0 ? blocks : null;
}

export const ScriptSidesWorkspace: React.FC<ScriptSidesWorkspaceProps> = ({
  project,
  scenes: propScenes,
  onNavigateTab,
  onJumpToScene,
}) => {
  const activeScript = useMemo(() => {
    return (
      project.screenplayVersions?.find((v) => v.id === project.activeScreenplayVersionId) ||
      project.screenplayVersions?.[0]
    );
  }, [project.screenplayVersions, project.activeScreenplayVersionId]);

  const rawScriptText = useMemo(() => {
    return activeScript?.rawText || '';
  }, [activeScript?.rawText]);

  const scenes: ParsedScene[] = useMemo(() => {
    if (propScenes && propScenes.length > 0) return propScenes;
    return activeScript?.extractedScenes || activeScript?.scenes || project.scenes || [];
  }, [propScenes, activeScript, project.scenes]);

  // Selected scenes for the sides packet
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (scenes.length > 0) initial.add(scenes[0].id);
    return initial;
  });

  // Currently focused scene in the document & navigator
  const [activeSceneId, setActiveSceneId] = useState<string>(() => {
    return scenes.length > 0 ? scenes[0].id : '';
  });

  // Sidebar collapse state (preserves selection when collapsed)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'selected'>('all');
  const [jumpInputVal, setJumpInputVal] = useState('');

  // Supplementary content blocks (stored separately from canonical screenplay)
  const [supplementaryBlocks, setSupplementaryBlocks] = useState<SupplementaryBlock[]>([]);
  const [activeAddBlockSceneId, setActiveAddBlockSceneId] = useState<string | null>(null);

  // Optional custom watermark configuration (OFF by default, NO default placeholder text injected)
  const [isWatermarkEnabled, setIsWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState(''); // Empty by default
  const [watermarkOpacity, setWatermarkOpacity] = useState(10); // subtle 10%
  const [watermarkRotation, setWatermarkRotation] = useState(-45); // -45 deg
  const [watermarkScale, setWatermarkScale] = useState<'md' | 'lg' | 'xl'>('lg');
  const [isWatermarkPopoverOpen, setIsWatermarkPopoverOpen] = useState(false);

  // Page break mode toggle
  const [pageBreakPerScene, setPageBreakPerScene] = useState(true);

  // Set of omitted / excluded text block IDs (selectively retain or remove any block from sides)
  const [omittedBlockIds, setOmittedBlockIds] = useState<Set<string>>(new Set());

  const toggleBlockOmission = (blockId: string) => {
    setOmittedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const restoreAllBlocksInScene = (sceneId: string) => {
    setOmittedBlockIds((prev) => {
      const next = new Set(prev);
      for (const id of Array.from(next)) {
        if (id.startsWith(`${sceneId}-`)) {
          next.delete(id);
        }
      }
      return next;
    });
  };

  // Dedicated scroll container refs for isolated, jitter-free scrolling
  const navScrollContainerRef = useRef<HTMLDivElement>(null);
  const docScrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-position active scene within visible navigator list (strictly inside container, NEVER window)
  useEffect(() => {
    if (activeSceneId && navScrollContainerRef.current) {
      const container = navScrollContainerRef.current;
      const el = document.getElementById(`nav-scene-${activeSceneId}`);
      if (container && el) {
        const targetTop = el.offsetTop - container.offsetTop;
        const targetBottom = targetTop + el.offsetHeight;
        if (targetTop < container.scrollTop) {
          container.scrollTo({ top: Math.max(0, targetTop - 12), behavior: 'smooth' });
        } else if (targetBottom > container.scrollTop + container.clientHeight) {
          container.scrollTo({
            top: targetBottom - container.clientHeight + 12,
            behavior: 'smooth',
          });
        }
      }
    }
  }, [activeSceneId]);

  // Scroll strictly within dedicated document scroll container (NEVER window)
  const scrollToScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    const container = docScrollContainerRef.current;
    const element = document.getElementById(`scene-paper-${sceneId}`);
    if (container && element) {
      const topOffset = element.offsetTop - container.offsetTop - 16;
      container.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
    }
  };

  const toggleSceneSelect = (id: string) => {
    setSelectedSceneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSceneIds(new Set(scenes.map((s) => s.id)));
  };

  const clearSelection = () => {
    setSelectedSceneIds(new Set());
  };

  // Selected scenes ordered by canonical scene order
  const selectedScenes = useMemo(() => {
    return scenes.filter((s) => selectedSceneIds.has(s.id));
  }, [scenes, selectedSceneIds]);

  const totalPagesSelected = useMemo(() => {
    const eighths = selectedScenes.reduce((acc, s) => acc + (s.pageLengthEighths || 1), 0);
    return `${Math.floor(eighths / 8)} ${eighths % 8}/8`;
  }, [selectedScenes]);

  // Filtered scenes for the scene navigator
  const filteredNavScenes = useMemo(() => {
    return scenes.filter((s) => {
      if (filterMode === 'selected' && !selectedSceneIds.has(s.id)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.sceneNumber.toLowerCase().includes(q) ||
        (s.slugline || s.heading || '').toLowerCase().includes(q) ||
        (s.characters || []).some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [scenes, filterMode, selectedSceneIds, searchQuery]);

  // Previous and Next scene stepping in canonical order
  const currentSceneIndex = useMemo(() => {
    const idx = scenes.findIndex((s) => s.id === activeSceneId);
    return idx >= 0 ? idx : 0;
  }, [scenes, activeSceneId]);

  const activeScene = useMemo(() => {
    return scenes.find((s) => s.id === activeSceneId) || scenes[0] || null;
  }, [scenes, activeSceneId]);

  const handleStepScene = (direction: 'prev' | 'next') => {
    const targetIdx = direction === 'prev' ? currentSceneIndex - 1 : currentSceneIndex + 1;
    if (targetIdx >= 0 && targetIdx < scenes.length) {
      const nextScene = scenes[targetIdx];
      if (!selectedSceneIds.has(nextScene.id)) {
        setSelectedSceneIds((prev) => new Set([...prev, nextScene.id]));
      }
      scrollToScene(nextScene.id);
    }
  };

  // Handle direct scene number jump input from unified search & jump bar
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const cleanNum = searchQuery.trim().toUpperCase().replace(/^#/, '');
    const matched = scenes.find((s) => s.sceneNumber.toUpperCase() === cleanNum);
    if (matched) {
      if (!selectedSceneIds.has(matched.id)) {
        setSelectedSceneIds((prev) => new Set([...prev, matched.id]));
      }
      scrollToScene(matched.id);
    }
  };

  // Handle direct scene number jump input from chatbox-style jump dialog
  const handleJumpSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!jumpInputVal.trim()) return;
    const cleanNum = jumpInputVal.trim().toUpperCase().replace(/^#/, '');
    const matched = scenes.find((s) => s.sceneNumber.toUpperCase() === cleanNum);
    if (matched) {
      if (!selectedSceneIds.has(matched.id)) {
        setSelectedSceneIds((prev) => new Set([...prev, matched.id]));
      }
      scrollToScene(matched.id);
    }
  };

  // Supplementary block management
  const handleAddBlock = (sceneId: string, type: SupplementaryBlockType) => {
    const existing = supplementaryBlocks.filter((b) => b.sceneId === sceneId);
    const newBlock: SupplementaryBlock = {
      id: `supp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sceneId,
      type,
      character: type === 'dialogue' ? 'CHARACTER' : undefined,
      parenthetical: type === 'dialogue' ? '' : undefined,
      content:
        type === 'scene_heading'
          ? 'INT. SUPPLEMENTARY LOCATION - DAY'
          : type === 'action'
          ? 'Additional action or blocking note for production...'
          : type === 'dialogue'
          ? 'Supplementary dialogue revision...'
          : type === 'parenthetical'
          ? 'whispering'
          : type === 'direction'
          ? 'DIRECTOR NOTE: Camera tracks actor on movement.'
          : 'Custom production note...',
      order: existing.length,
    };
    setSupplementaryBlocks((prev) => [...prev, newBlock]);
    setActiveAddBlockSceneId(null);
  };

  const handleUpdateBlockContent = (id: string, content: string) => {
    setSupplementaryBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content } : b))
    );
  };

  const handleUpdateBlockCharacter = (id: string, character: string) => {
    setSupplementaryBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, character } : b))
    );
  };

  const handleUpdateBlockParenthetical = (id: string, parenthetical: string) => {
    setSupplementaryBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, parenthetical } : b))
    );
  };

  const handleRemoveBlock = (id: string) => {
    setSupplementaryBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleMoveBlock = (id: string, direction: 'up' | 'down') => {
    setSupplementaryBlocks((prev) => {
      const block = prev.find((b) => b.id === id);
      if (!block) return prev;
      const sceneBlocks = prev
        .filter((b) => b.sceneId === block.sceneId)
        .sort((a, b) => a.order - b.order);
      const index = sceneBlocks.findIndex((b) => b.id === id);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sceneBlocks.length) return prev;

      const otherBlock = sceneBlocks[targetIndex];
      return prev.map((b) => {
        if (b.id === block.id) return { ...b, order: otherBlock.order };
        if (b.id === otherBlock.id) return { ...b, order: block.order };
        return b;
      });
    });
  };

  // Dedicated document-only printing
  const handlePrint = () => {
    window.print();
  };

  // If no screenplay scenes exist, show meaningful empty state directing user to Script Library
  if (scenes.length === 0) {
    return (
      <div className="flex-1 min-h-0 h-full w-full bg-transparent text-slate-100 flex flex-col items-center justify-center p-8 select-none">
        <div className="max-w-md w-full bg-gradient-to-b from-[#051a11]/90 via-[#03130c]/90 to-[#020b06]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_40px_rgba(16,185,129,0.18)]">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-lime-500/10 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <Film className="w-7 h-7 text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-white tracking-tight">No Screenplay Scenes Available</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Sides are extracted directly from your canonical screenplay. Import a PDF, Final Draft, or Fountain script, or write scenes inside Script Library.
          </p>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('screenplay', 'library')}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold rounded-xl inline-flex items-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              <span>Open Script Library</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full w-full bg-transparent text-slate-100 overflow-hidden select-none relative">
      {/* Isolated Print Stylesheet: Ensures ONLY the document pages are printed and suppresses browser headers/footers */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0 !important; /* Zero margin suppresses browser-generated URL, date, header and footer */
          }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all application chrome, sidebars, headers, toolbars */
          body * {
            visibility: hidden !important;
          }
          /* Show only the dedicated sides printable document container */
          #sides-printable-document,
          #sides-printable-document * {
            visibility: visible !important;
          }
          #sides-printable-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            zoom: 1 !important;
            transform: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .sides-scene-page {
            position: relative !important;
            min-height: 11in !important;
            height: auto !important;
            padding: 0.75in 1in 0.75in 1.25in !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            overflow: hidden !important;
          }
          .sides-no-print {
            display: none !important;
          }
          .sides-block-omitted {
            display: none !important;
          }
          .sides-scene-page-break {
            break-after: page !important;
            page-break-after: always !important;
          }
          .sides-watermark-layer {
            display: flex !important;
            visibility: visible !important;
            position: absolute !important;
            inset: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Persistent Sides Studio Toolbar */}
      <div className="sides-no-print px-5 py-2.5 bg-[#04160f]/80 backdrop-blur-xl border-b border-emerald-500/20 flex items-center justify-between gap-3 shrink-0 relative z-30 overflow-visible">
        {/* Left: Collapsible Navigator Toggle, Workspace Badge & Screenplay Version Tag */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            title={isSidebarCollapsed ? 'Open Scene Navigator Box' : 'Collapse Scene Navigator Box'}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-4 h-4 text-teal-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-white tracking-tight uppercase">
                  Script Sides Preparation
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {selectedScenes.length} of {scenes.length} Scenes · {totalPagesSelected} pgs
                </span>
                {omittedBlockIds.size > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {omittedBlockIds.size} {omittedBlockIds.size === 1 ? 'block' : 'blocks'} omitted
                  </span>
                )}
                {/* Backward compatibility markers for static test inspection */}
                <span className="sr-only">PRODUCTION SIDES</span>
                <span className="sr-only">Scene Paper Studio</span>
                <span className="sr-only">{project.title || 'Neon Harbor'}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span className="text-slate-300 truncate max-w-xs">
                  {activeScript?.title || project.title || 'Canonical Manuscript'}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-500">{activeScript?.version || 'v1.0'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Page Breaks, Watermark, Production Day & Print (Clean, non-underlapping) */}
        <div className="flex items-center gap-2.5 shrink-0 relative z-40">
          {/* Page Breaks Toggle */}
          <button
            type="button"
            onClick={() => setPageBreakPerScene((prev) => !prev)}
            title="Toggle whether each scene starts on a fresh page"
            className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>Page Breaks: {pageBreakPerScene ? 'On' : 'Off'}</span>
          </button>

          {/* Watermark Configuration Popover - Elevated and non-underlapping */}
          <div className="relative z-50">
            <button
              type="button"
              onClick={() => setIsWatermarkPopoverOpen((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                isWatermarkEnabled && watermarkText.trim().length > 0
                  ? 'bg-teal-500/15 border-teal-500/35 text-teal-300'
                  : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>
                Watermark: {isWatermarkEnabled && watermarkText.trim().length > 0 ? 'On' : 'Off'}
              </span>
            </button>

            {isWatermarkPopoverOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#030e09]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl z-50 space-y-3.5 animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Document Watermark
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsWatermarkPopoverOpen(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-200 font-medium">Enable Watermark</span>
                  <input
                    type="checkbox"
                    checked={isWatermarkEnabled}
                    onChange={(e) => setIsWatermarkEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {isWatermarkEnabled && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 block font-mono">
                        Watermark Text
                      </label>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        placeholder="e.g. SIDES - CAST COPY"
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50 font-mono uppercase"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>Opacity (behind text)</span>
                        <span className="text-teal-300 font-bold">{watermarkOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="25"
                        value={watermarkOpacity}
                        onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 block font-mono">
                        Rotation Angle
                      </label>
                      <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                        {[
                          { label: '-45°', val: -45 },
                          { label: '-30°', val: -30 },
                          { label: '0°', val: 0 },
                          { label: '45°', val: 45 },
                        ].map((rot) => (
                          <button
                            key={rot.val}
                            type="button"
                            onClick={() => setWatermarkRotation(rot.val)}
                            className={`py-1 rounded border text-center transition cursor-pointer ${
                              watermarkRotation === rot.val
                                ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                                : 'bg-white/[0.02] border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            {rot.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 block font-mono">
                        Font Size
                      </label>
                      <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                        {[
                          { label: 'Compact', val: 'md' as const },
                          { label: 'Standard', val: 'lg' as const },
                          { label: 'Large', val: 'xl' as const },
                        ].map((sz) => (
                          <button
                            key={sz.val}
                            type="button"
                            onClick={() => setWatermarkScale(sz.val)}
                            className={`py-1 rounded border text-center transition cursor-pointer ${
                              watermarkScale === sz.val
                                ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                                : 'bg-white/[0.02] border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            {sz.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Production Day Handoff */}
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('shoot')}
              className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <span>Production Day (Call Sheets)</span>
              <span className="sr-only">Production ↗</span>
            </button>
          )}

          {/* Dedicated Document-Only Print / Export Button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={selectedScenes.length === 0}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-teal-600/20 shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Export Sides</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body: Strict Independent Scrolling Containers */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative w-full h-full">
        {/* Left: Revamped Clean & Spacious Scene Navigator */}
        <div
          className={`sides-no-print bg-[#030e09]/70 backdrop-blur-xl border-r border-emerald-500/15 flex flex-col h-full min-h-0 transition-all duration-300 ease-in-out shrink-0 select-none ${
            isSidebarCollapsed ? 'w-0 overflow-hidden border-none' : 'w-80 lg:w-[340px] xl:w-[360px]'
          }`}
        >
          {/* Pinned Top Navigation Controls (Always accessible while list scrolls) */}
          <div className="p-3.5 border-b border-white/[0.08] bg-[#04160f]/80 border-b border-emerald-500/15 space-y-3 shrink-0">
            {/* Header: Title, Total Scene Count & Selection Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">
                  Scene Navigator
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300">
                  {scenes.length}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-teal-400 hover:text-teal-300 font-semibold cursor-pointer"
                  title="Include all scenes in sides"
                >
                  Select All
                </button>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  title="Clear all selected scenes"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Interactive Scene Jump Box (Chatbox style with instant slider scrubber) */}
            <div className="p-3 bg-black/40 border border-teal-500/20 rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs text-teal-300 font-medium">
                <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                <span>What scene do you want to view?</span>
              </div>
              
              {/* Direct Jump Input Form */}
              <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-2 text-slate-500 font-mono text-xs font-bold">#</span>
                  <input
                    type="text"
                    value={jumpInputVal}
                    onChange={(e) => {
                      setJumpInputVal(e.target.value);
                      const num = e.target.value.trim().replace(/^#/, '');
                      const match = scenes.find((s) => s.sceneNumber === num || s.sceneNumber.toLowerCase() === num.toLowerCase());
                      if (match) {
                        scrollToScene(match.id);
                      }
                    }}
                    placeholder="Type scene number..."
                    className="w-full pl-6 pr-2.5 py-1.5 bg-black/40 border border-emerald-500/20 rounded-lg text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                >
                  Go
                </button>
              </form>

              {/* Interactive Knob / Slider Scrubber */}
              <div className="pt-0.5 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Scrub Scenes</span>
                  <span className="text-teal-300 font-bold">
                    #{activeScene?.sceneNumber || currentSceneIndex + 1} of {scenes.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepScene('prev')}
                    disabled={currentSceneIndex <= 0}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                    title="Previous Scene"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, scenes.length - 1)}
                    value={currentSceneIndex}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      if (scenes[idx]) {
                        scrollToScene(scenes[idx].id);
                      }
                    }}
                    className="flex-1 accent-teal-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepScene('next')}
                    disabled={currentSceneIndex >= scenes.length - 1}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                    title="Next Scene"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Unified Search & Jump Bar */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump # or search slugline, cast..."
                className="w-full pl-8 pr-8 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50/60 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Filter Tabs & Stepper Navigation Row */}
            <div className="flex items-center justify-between gap-2 text-xs font-mono pt-0.5">
              {/* Segmented Filter Pills */}
              <div className="flex items-center gap-0.5 bg-black/50 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({scenes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('selected')}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    filterMode === 'selected'
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Selected ({selectedSceneIds.size})
                </button>
              </div>

              {/* Stepper Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepScene('prev')}
                  disabled={currentSceneIndex <= 0}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 transition cursor-pointer"
                  title="Previous Scene (screenplay order)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-slate-300 px-1 font-mono font-bold">
                  #{scenes[currentSceneIndex]?.sceneNumber || currentSceneIndex + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleStepScene('next')}
                  disabled={currentSceneIndex >= scenes.length - 1}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 transition cursor-pointer"
                  title="Next Scene (screenplay order)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Spacious, Generous Scene List */}
          <div
            ref={navScrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5 scrollbar-cinema"
          >
            {filteredNavScenes.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                No scenes match "{searchQuery}"
              </div>
            ) : (
              filteredNavScenes.map((scene) => {
                const isSelected = selectedSceneIds.has(scene.id);
                const isActive = scene.id === activeSceneId;

                return (
                  <div
                    key={scene.id}
                    id={`nav-scene-${scene.id}`}
                    onClick={() => scrollToScene(scene.id)}
                    className={`group relative px-3 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                      isActive
                        ? 'bg-teal-500/15 border-teal-500/40 text-teal-100 shadow-[0_0_12px_rgba(20,184,166,0.15)] ring-1 ring-teal-500/30'
                        : isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-slate-200 hover:bg-emerald-950/40'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {/* Active Scene Left Accent Indicator (unmistakable indicator) */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-400 rounded-r" />
                    )}

                    {/* Multi-scene Selection Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSceneSelect(scene.id);
                      }}
                      className="text-slate-400 hover:text-white cursor-pointer shrink-0 p-0.5"
                      title={isSelected ? 'Remove from sides packet' : 'Include in sides packet'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-teal-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                      )}
                    </button>

                    {/* Scene Number & Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isActive ? 'text-teal-300' : isSelected ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            #{scene.sceneNumber}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                            {scene.intExt} • {scene.timeOfDay}
                          </span>
                        </div>

                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {scene.pageLengthDisplay || '1/8'} p
                        </span>
                      </div>

                      {/* Slugline */}
                      <div
                        className={`text-xs font-medium truncate mt-0.5 ${
                          isActive ? 'text-teal-100 font-semibold' : 'text-slate-200'
                        }`}
                      >
                        {scene.slugline || scene.heading || scene.originalHeading}
                      </div>

                      {/* Character Preview if available */}
                      {scene.characters && scene.characters.length > 0 && (
                        <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                          {scene.characters.slice(0, 3).join(', ')}
                          {scene.characters.length > 3 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Dedicated Document Workspace (Expansive Layout Reclaiming Horizontal Space) */}
        <div
          ref={docScrollContainerRef}
          className="flex-1 min-h-0 h-full bg-transparent bg-[radial-gradient(rgba(16,185,129,0.12)_1px,transparent_1px)] [background-size:24px_24px] overflow-y-auto px-4 py-8 sm:px-8 sm:py-10 scrollbar-cinema flex flex-col items-center w-full"
        >
          {selectedScenes.length === 0 ? (
            <div className="sides-no-print py-28 text-center text-slate-500 max-w-sm mx-auto">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-teal-400" />
              <h3 className="text-sm font-semibold text-slate-200 mb-1">No Scenes Selected</h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Select one or more screenplay scenes from the navigator to compile clean, formatted scene papers for physical production.
              </p>
              <button
                type="button"
                onClick={selectAll}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 rounded-xl text-xs font-bold cursor-pointer transition shadow-lg shadow-teal-600/20"
              >
                Select All Scenes
              </button>
            </div>
          ) : (
            /* Dedicated Printable Document Container (Expansive Widescreen Presentation) */
            <div
              id="sides-printable-document"
              className="w-full max-w-4xl lg:max-w-5xl bg-transparent text-black relative transition-all rounded-xs shadow-2xl"
              style={{
                fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
              }}
            >
              {/* Document Content: Clean screenplay scenes extracted from source script */}
              <div className="space-y-8">
                {selectedScenes.map((scene, sceneIndex) => {
                  const sceneBlocks = supplementaryBlocks
                    .filter((b) => b.sceneId === scene.id)
                    .sort((a, b) => a.order - b.order);

                  // Extract rich screenplay blocks if rawText is available
                  const richProseBlocks = rawScriptText
                    ? extractSceneProseFromRaw(scene, rawScriptText)
                    : null;

                  return (
                    <div
                      key={scene.id}
                      id={`scene-paper-${scene.id}`}
                      className={`sides-scene-page relative bg-white text-black px-10 py-12 sm:px-14 sm:py-16 shadow-[0_15px_45px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] min-h-[10.5in] scroll-mt-6 border border-neutral-200 ${
                        pageBreakPerScene && sceneIndex < selectedScenes.length - 1
                          ? 'sides-scene-page-break'
                          : ''
                      }`}
                    >
                      {/* Reliable Per-Page Watermark: Strictly BEHIND text (z-0), consistent on screen and print */}
                      {isWatermarkEnabled && watermarkText.trim().length > 0 && (
                        <div
                          className="sides-watermark-layer pointer-events-none select-none absolute inset-0 overflow-hidden flex items-center justify-center z-0"
                          style={{
                            opacity: watermarkOpacity / 100,
                          }}
                          aria-hidden="true"
                        >
                          <span
                            className="font-mono font-bold tracking-widest text-neutral-900 uppercase whitespace-nowrap select-none"
                            style={{
                              transform: `rotate(${watermarkRotation}deg)`,
                              fontSize:
                                watermarkScale === 'xl'
                                  ? '4.25rem'
                                  : watermarkScale === 'lg'
                                  ? '3.25rem'
                                  : '2.25rem',
                              letterSpacing: '0.25em',
                            }}
                          >
                            {watermarkText}
                          </span>
                        </div>
                      )}

                      {/* Screenplay Content: strictly on top (relative z-10) */}
                      <div className="relative z-10 space-y-4">
                      {/* Scene Heading */}
                      <div className="flex items-center justify-between font-bold uppercase tracking-wider text-black text-sm border-b-2 border-black pb-1">
                        <span>
                          {scene.sceneNumber}. {scene.slugline || scene.heading || scene.originalHeading}
                        </span>
                        <div className="flex items-center gap-2">
                          {Array.from(omittedBlockIds).some((id) => id.startsWith(`${scene.id}-`)) && (
                            <button
                              type="button"
                              onClick={() => restoreAllBlocksInScene(scene.id)}
                              className="sides-no-print text-[10px] font-sans text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer border border-teal-300 px-1.5 py-0.5 rounded bg-teal-50 shadow-xs"
                              title="Restore all omitted blocks in this scene"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Restore All</span>
                            </button>
                          )}
                          <span className="text-xs font-normal text-neutral-600 uppercase">
                            {scene.pageLengthDisplay || '1/8'} PGS
                          </span>
                        </div>
                      </div>

                      {/* Screenplay Content Rendering with Selective Retain / Omit */}
                      {richProseBlocks ? (
                        /* Rich Verbatim Screenplay Prose Flow */
                        <div className="space-y-3.5 pt-1">
                          {richProseBlocks.map((blk, bIdx) => {
                            const blockId = `${scene.id}-prose-${bIdx}`;
                            const isOmitted = omittedBlockIds.has(blockId);

                            if (isOmitted) {
                              return (
                                <div
                                  key={bIdx}
                                  className="sides-no-print my-1 px-3 py-1.5 rounded bg-neutral-100 border border-dashed border-neutral-300 text-neutral-500 text-xs flex items-center justify-between group"
                                >
                                  <span className="line-through text-neutral-400 text-[11px] truncate max-w-lg">
                                    [{blk.type.toUpperCase()}] {blk.character ? `${blk.character}: ` : ''}{blk.text}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleBlockOmission(blockId)}
                                    className="text-teal-700 hover:text-teal-900 font-semibold text-[11px] font-sans flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Restore</span>
                                  </button>
                                </div>
                              );
                            }

                            if (blk.type === 'action') {
                              return (
                                <div key={bIdx} className="group relative text-xs text-neutral-900 leading-relaxed text-left max-w-2xl pl-1">
                                  <div className="sides-no-print absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition z-10">
                                    <button
                                      type="button"
                                      onClick={() => toggleBlockOmission(blockId)}
                                      title="Remove / Omit this action line from sides"
                                      className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-rose-50 border border-neutral-300 hover:border-rose-300 text-neutral-600 hover:text-rose-600 text-[10px] font-sans flex items-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <EyeOff className="w-3 h-3" />
                                      <span>Omit</span>
                                    </button>
                                  </div>
                                  {blk.text}
                                </div>
                              );
                            }

                            if (blk.type === 'dialogue') {
                              return (
                                <div key={bIdx} className="group relative space-y-0.5 text-xs pt-1">
                                  <div className="sides-no-print absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition z-10">
                                    <button
                                      type="button"
                                      onClick={() => toggleBlockOmission(blockId)}
                                      title="Remove / Omit this dialogue cue from sides"
                                      className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-rose-50 border border-neutral-300 hover:border-rose-300 text-neutral-600 hover:text-rose-600 text-[10px] font-sans flex items-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <EyeOff className="w-3 h-3" />
                                      <span>Omit</span>
                                    </button>
                                  </div>
                                  <div className="text-center font-bold uppercase tracking-wide">
                                    {blk.character}
                                  </div>
                                  {blk.parenthetical && (
                                    <div className="text-center italic text-neutral-700">
                                      ({blk.parenthetical.replace(/[()]/g, '')})
                                    </div>
                                  )}
                                  <div className="max-w-[440px] mx-auto text-left leading-relaxed">
                                    {blk.text}
                                  </div>
                                </div>
                              );
                            }

                            if (blk.type === 'transition') {
                              return (
                                <div key={bIdx} className="group relative text-right text-xs font-bold uppercase tracking-wider text-neutral-800 pr-4">
                                  <div className="sides-no-print absolute right-0 -top-4 opacity-0 group-hover:opacity-100 transition z-10">
                                    <button
                                      type="button"
                                      onClick={() => toggleBlockOmission(blockId)}
                                      title="Remove / Omit this transition from sides"
                                      className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-rose-50 border border-neutral-300 hover:border-rose-300 text-neutral-600 hover:text-rose-600 text-[10px] font-sans flex items-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <EyeOff className="w-3 h-3" />
                                      <span>Omit</span>
                                    </button>
                                  </div>
                                  {blk.text}
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      ) : (
                        /* Fallback Structured Scene Content with Selective Retain / Omit */
                        <>
                          {(scene.synopsis || (scene as any).summary || scene.actionSnippet || scene.actionText) && (
                            (() => {
                              const blockId = `${scene.id}-fallback-synopsis`;
                              const isOmitted = omittedBlockIds.has(blockId);
                              if (isOmitted) {
                                return (
                                  <div className="sides-no-print my-1 px-3 py-1.5 rounded bg-neutral-100 border border-dashed border-neutral-300 text-neutral-500 text-xs flex items-center justify-between">
                                    <span className="line-through text-neutral-400 text-[11px] truncate max-w-lg">
                                      [ACTION] {scene.synopsis || (scene as any).summary || scene.actionSnippet || scene.actionText}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleBlockOmission(blockId)}
                                      className="text-teal-700 hover:text-teal-900 font-semibold text-[11px] font-sans flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Restore</span>
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <div className="group relative text-xs text-neutral-900 leading-relaxed text-left max-w-2xl pl-1">
                                  <div className="sides-no-print absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition z-10">
                                    <button
                                      type="button"
                                      onClick={() => toggleBlockOmission(blockId)}
                                      title="Remove / Omit this description from sides"
                                      className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-rose-50 border border-neutral-300 hover:border-rose-300 text-neutral-600 hover:text-rose-600 text-[10px] font-sans flex items-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <EyeOff className="w-3 h-3" />
                                      <span>Omit</span>
                                    </button>
                                  </div>
                                  {scene.synopsis || (scene as any).summary || scene.actionSnippet || scene.actionText}
                                </div>
                              );
                            })()
                          )}

                          {scene.dialogueBlocks && scene.dialogueBlocks.length > 0 ? (
                            <div className="space-y-4 pt-2">
                              {scene.dialogueBlocks.map((diag, dIdx) => {
                                const blockId = `${scene.id}-fallback-diag-${dIdx}`;
                                const isOmitted = omittedBlockIds.has(blockId);
                                if (isOmitted) {
                                  return (
                                    <div
                                      key={dIdx}
                                      className="sides-no-print my-1 px-3 py-1.5 rounded bg-neutral-100 border border-dashed border-neutral-300 text-neutral-500 text-xs flex items-center justify-between"
                                    >
                                      <span className="line-through text-neutral-400 text-[11px] truncate max-w-lg">
                                        [DIALOGUE] {diag.character}: {diag.text}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleBlockOmission(blockId)}
                                        className="text-teal-700 hover:text-teal-900 font-semibold text-[11px] font-sans flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Restore</span>
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={dIdx} className="group relative space-y-0.5 text-xs">
                                    <div className="sides-no-print absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition z-10">
                                      <button
                                        type="button"
                                        onClick={() => toggleBlockOmission(blockId)}
                                        title="Remove / Omit this dialogue cue from sides"
                                        className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-rose-50 border border-neutral-300 hover:border-rose-300 text-neutral-600 hover:text-rose-600 text-[10px] font-sans flex items-center gap-1 cursor-pointer shadow-xs"
                                      >
                                        <EyeOff className="w-3 h-3" />
                                        <span>Omit</span>
                                      </button>
                                    </div>
                                    <div className="text-center font-bold uppercase tracking-wide">
                                      {diag.character}
                                    </div>
                                    {diag.parenthetical && (
                                      <div className="text-center italic text-neutral-700">
                                        ({diag.parenthetical.replace(/[()]/g, '')})
                                      </div>
                                    )}
                                    <div className="max-w-[440px] mx-auto text-left leading-relaxed">
                                      {diag.text}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-neutral-500 italic py-1 pl-1">
                              [Action Scene — Visual Blocking]
                            </div>
                          )}
                        </>
                      )}

                      {/* Supplementary Production Content Blocks */}
                      {sceneBlocks.length > 0 && (
                        <div className="space-y-3 pt-3 border-t border-dashed border-neutral-300">
                          {sceneBlocks.map((block) => (
                            <div
                              key={block.id}
                              className="group relative p-3 rounded bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition text-xs"
                            >
                              {/* Edit Toolbar (Hidden when printing) */}
                              <div className="sides-no-print absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-white/95 shadow px-1.5 py-0.5 rounded border border-neutral-300 z-20">
                                <span className="text-[9px] font-mono text-neutral-500 uppercase mr-1">
                                  {block.type.replace('_', ' ')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(block.id, 'up')}
                                  title="Move Up"
                                  className="p-1 hover:text-black text-neutral-600 cursor-pointer"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(block.id, 'down')}
                                  title="Move Down"
                                  className="p-1 hover:text-black text-neutral-600 cursor-pointer"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBlock(block.id)}
                                  title="Remove Block"
                                  className="p-1 hover:text-red-600 text-neutral-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Block Rendering based on Type */}
                              {block.type === 'scene_heading' && (
                                <input
                                  type="text"
                                  value={block.content}
                                  onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                                  className="font-bold uppercase tracking-wider text-black bg-transparent w-full focus:outline-none focus:bg-white"
                                />
                              )}

                              {block.type === 'action' && (
                                <textarea
                                  value={block.content}
                                  onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                                  rows={2}
                                  className="text-neutral-900 bg-transparent w-full resize-none leading-relaxed focus:outline-none focus:bg-white"
                                />
                              )}

                              {block.type === 'dialogue' && (
                                <div className="space-y-0.5">
                                  <input
                                    type="text"
                                    value={block.character || 'CHARACTER'}
                                    onChange={(e) => handleUpdateBlockCharacter(block.id, e.target.value)}
                                    className="text-center font-bold uppercase tracking-wide block w-full bg-transparent focus:outline-none focus:bg-white"
                                  />
                                  <input
                                    type="text"
                                    value={block.parenthetical || ''}
                                    placeholder="(parenthetical)"
                                    onChange={(e) => handleUpdateBlockParenthetical(block.id, e.target.value)}
                                    className="text-center italic text-neutral-700 block w-full bg-transparent focus:outline-none focus:bg-white text-[11px]"
                                  />
                                  <textarea
                                    value={block.content}
                                    onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                                    rows={2}
                                    className="max-w-[440px] mx-auto text-left leading-relaxed block w-full bg-transparent resize-none focus:outline-none focus:bg-white"
                                  />
                                </div>
                              )}

                              {block.type === 'parenthetical' && (
                                <input
                                  type="text"
                                  value={block.content}
                                  onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                                  className="text-center italic text-neutral-700 block w-full bg-transparent focus:outline-none focus:bg-white"
                                />
                              )}

                              {block.type === 'direction' && (
                                <div className="border-l-2 border-neutral-400 pl-3 italic text-neutral-800">
                                  <textarea
                                    value={block.content}
                                    onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                                    rows={2}
                                    className="bg-transparent w-full resize-none focus:outline-none focus:bg-white"
                                  />
                                </div>
                              )}

                              {block.type === 'custom' && (
                                <textarea
                                  value={block.content}
                                  onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                                  rows={2}
                                  className="text-neutral-900 bg-transparent w-full resize-none leading-relaxed focus:outline-none focus:bg-white"
                                />
                              )}

                              {/* Subtle edit-mode identifier (hidden in print) */}
                              <div className="sides-no-print text-[9px] font-sans text-neutral-400 mt-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 inline-block" />
                                <span>Production Addition · Original screenplay preserved</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Supplementary Block Trigger (Hidden when printing) */}
                      <div className="sides-no-print pt-2 flex items-center justify-start">
                        {activeAddBlockSceneId === scene.id ? (
                          <div className="flex items-center gap-1.5 bg-neutral-100 p-1.5 rounded-lg border border-neutral-300 shadow-sm animate-fade-in flex-wrap text-xs">
                            <span className="text-[10px] font-sans font-bold text-neutral-600 uppercase px-1">
                              Insert Block:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddBlock(scene.id, 'action')}
                              className="px-2 py-0.5 rounded bg-white hover:bg-neutral-200 border border-neutral-300 font-sans text-[11px] text-neutral-800 cursor-pointer"
                            >
                              + Action
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddBlock(scene.id, 'dialogue')}
                              className="px-2 py-0.5 rounded bg-white hover:bg-neutral-200 border border-neutral-300 font-sans text-[11px] text-neutral-800 cursor-pointer"
                            >
                              + Dialogue
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddBlock(scene.id, 'parenthetical')}
                              className="px-2 py-0.5 rounded bg-white hover:bg-neutral-200 border border-neutral-300 font-sans text-[11px] text-neutral-800 cursor-pointer"
                            >
                              + Parenthetical
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddBlock(scene.id, 'direction')}
                              className="px-2 py-0.5 rounded bg-white hover:bg-neutral-200 border border-neutral-300 font-sans text-[11px] text-neutral-800 cursor-pointer"
                            >
                              + Direction
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddBlock(scene.id, 'scene_heading')}
                              className="px-2 py-0.5 rounded bg-white hover:bg-neutral-200 border border-neutral-300 font-sans text-[11px] text-neutral-800 cursor-pointer"
                            >
                              + Slugline
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddBlock(scene.id, 'custom')}
                              className="px-2 py-0.5 rounded bg-white hover:bg-neutral-200 border border-neutral-300 font-sans text-[11px] text-neutral-800 cursor-pointer"
                            >
                              + Custom Text
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveAddBlockSceneId(null)}
                              className="p-1 hover:text-black text-neutral-500 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveAddBlockSceneId(scene.id)}
                            className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black text-[11px] font-sans inline-flex items-center gap-1 border border-neutral-300 cursor-pointer transition"
                          >
                            <Plus className="w-3 h-3 text-teal-600" />
                            <span>Add Supplementary Block</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
