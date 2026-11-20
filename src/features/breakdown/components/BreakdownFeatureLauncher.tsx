import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Boxes,
  Sparkles,
  FileSpreadsheet,
  Calendar,
  Film,
  Search,
  X,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Command,
} from 'lucide-react';

export type BreakdownToolId =
  | 'characters'
  | 'elements'
  | 'reports'
  | 'stripboards'
  | 'sides';

export interface BreakdownToolDefinition {
  id: BreakdownToolId;
  name: string;
  shortLabel: string;
  category: 'core' | 'intelligence' | 'documents' | 'handoff';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badge?: string;
  ownerWorkspace?: string;
}

export const BREAKDOWN_TOOLS: BreakdownToolDefinition[] = [
  {
    id: 'characters',
    name: 'Character & Script Analysis',
    shortLabel: 'Character & Script Analysis',
    category: 'intelligence',
    description: 'Interactive character dialogue relationship graph & canonical screenplay block breakdown table',
    icon: Sparkles,
    accentColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  },
  {
    id: 'elements',
    name: 'Element Master Catalog',
    shortLabel: 'Element Catalog',
    category: 'core',
    description: 'Reusable project inventory of props, wardrobe, vehicles & departmental assets across 16+ departments',
    icon: Boxes,
    accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'reports',
    name: 'Breakdown Reports',
    shortLabel: 'Reports',
    category: 'documents',
    description: 'Studio breakdown sheets, cast listings, element requisitions, one-liner schedules & audits',
    icon: FileSpreadsheet,
    accentColor: 'text-teal-400 bg-teal-500/15 border-teal-500/30',
  },
  {
    id: 'stripboards',
    name: 'Production Stripboards',
    shortLabel: 'Stripboard',
    category: 'handoff',
    description: 'Visual scene strips, day breaks and shoot day arrangement (owned by Schedule)',
    icon: Calendar,
    accentColor: 'text-lime-400 bg-lime-500/15 border-lime-500/30',
    badge: 'Schedule Handoff',
    ownerWorkspace: 'Schedule (Calendar)',
  },
  {
    id: 'sides',
    name: 'Script Sides Preparation',
    shortLabel: 'Sides',
    category: 'handoff',
    description: 'Day sides, scene packets and formatted script sides distribution (owned by Production)',
    icon: Film,
    accentColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    badge: 'Production Handoff',
    ownerWorkspace: 'Production (Day)',
  },
];

interface BreakdownFeatureLauncherProps {
  activeToolId: string;
  onSelectTool: (toolId: BreakdownToolId) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const BreakdownFeatureLauncher: React.FC<BreakdownFeatureLauncherProps> = ({
  activeToolId,
  onSelectTool,
  isOpen,
  onClose,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchFilter('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredTools = BREAKDOWN_TOOLS.filter((t) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.shortLabel.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  });

  const coreTools = filteredTools.filter((t) => t.category === 'core');
  const intelligenceTools = filteredTools.filter((t) => t.category === 'intelligence');
  const documentTools = filteredTools.filter((t) => t.category === 'documents');
  const handoffTools = filteredTools.filter((t) => t.category === 'handoff');

  const renderToolItem = (tool: BreakdownToolDefinition) => {
    const Icon = tool.icon;
    const isActive =
      activeToolId === tool.id ||
      (tool.id === 'characters' &&
        (activeToolId === 'matrix' ||
          activeToolId === 'breakdown' ||
          activeToolId === 'breakdown-scenes' ||
          activeToolId === 'intelligence'));

    return (
      <div
        key={tool.id}
        onClick={() => {
          onSelectTool(tool.id);
          onClose();
        }}
        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 text-left ${
          isActive
            ? 'bg-emerald-500/15 border-cyan-500/40 shadow-sm ring-1 ring-cyan-500/20'
            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 border ${tool.accentColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-tight">{tool.name}</span>
              {tool.id === 'characters' && <span className="sr-only">Character Analysis &amp; Matrix</span>}
              {tool.badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                  {tool.badge}
                </span>
              )}
              {isActive && (
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{tool.description}</p>
          </div>
        </div>

        <div className="shrink-0 self-center opacity-60 hover:opacity-100">
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div className="bg-[#0e1118] border border-white/15 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-[#131722]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search Breakdown tools & capabilities (e.g. Scenes, Elements, Matrix, Reports)..."
              className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tools List by Category */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-cinema">
          {filteredTools.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No tools matching "{searchFilter}"
            </div>
          ) : (
            <>
              {coreTools.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1 font-semibold">
                    Core Breakdown &amp; Requirements
                  </div>
                  <div className="space-y-1.5">{coreTools.map(renderToolItem)}</div>
                </div>
              )}

              {intelligenceTools.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1 font-semibold">
                    Analysis &amp; Screenplay Intelligence
                  </div>
                  <div className="space-y-1.5">{intelligenceTools.map(renderToolItem)}</div>
                </div>
              )}

              {documentTools.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1 font-semibold">
                    Production Documentation
                  </div>
                  <div className="space-y-1.5">{documentTools.map(renderToolItem)}</div>
                </div>
              )}

              {handoffTools.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1 font-semibold">
                    Connected Workspaces (Authoritative Stages)
                  </div>
                  <div className="space-y-1.5">{handoffTools.map(renderToolItem)}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-[#090b0e] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">ESC</kbd> to close</span>
          <span>SceneOS Film-Production Breakdown</span>
        </div>
      </div>
    </div>
  );
};
