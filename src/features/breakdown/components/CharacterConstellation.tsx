import React, { useState, useMemo } from 'react';
import { ParsedScene } from '../../../types';
import {
  Users,
  Search,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  Eye,
  Filter,
  CheckCircle2,
  HelpCircle,
  Maximize2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';

export interface CharacterConstellationProps {
  scenes: ParsedScene[];
  characters: string[];
  onSelectScene?: (sceneId: string) => void;
  className?: string;
}

export interface ConstellationNode {
  id: string;
  name: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[]; // scene IDs
  x: number;
  y: number;
  radius: number;
}

export interface ConstellationLink {
  id: string;
  source: string;
  target: string;
  sharedScenesCount: number;
  isConfirmedDialogue: boolean; // Direct dialogue interaction vs silent co-presence
  sharedScenes: Array<{
    sceneId: string;
    sceneNumber: string;
    slugline: string;
    dialogueCountA: number;
    dialogueCountB: number;
  }>;
}

export const CharacterConstellation: React.FC<CharacterConstellationProps> = ({
  scenes,
  characters,
  onSelectScene,
  className = '',
}) => {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'dialogue_only' | 'frequent'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  // 1. Build Nodes & Connections derived strictly from screenplay evidence
  const { nodes, links, characterStats } = useMemo(() => {
    const charList = (characters || []).slice(0, 35); // Keep readable for up to 35 major cast
    const statsMap = new Map<
      string,
      { sceneCount: number; dialogueCount: number; scenes: string[] }
    >();

    charList.forEach((c) => {
      statsMap.set(c, { sceneCount: 0, dialogueCount: 0, scenes: [] });
    });

    scenes.forEach((scene) => {
      const sceneChars = new Set<string>();
      (scene.characters || []).forEach((c) => sceneChars.add(c.toUpperCase()));
      (scene.dialogueBlocks || []).forEach((d) => {
        if (d.character) sceneChars.add(d.character.toUpperCase());
      });

      sceneChars.forEach((c) => {
        const existing = statsMap.get(c);
        if (existing) {
          existing.sceneCount += 1;
          existing.scenes.push(scene.id);
        }
      });

      (scene.dialogueBlocks || []).forEach((d) => {
        const c = d.character?.toUpperCase();
        if (c && statsMap.has(c)) {
          statsMap.get(c)!.dialogueCount += 1;
        }
      });
    });

    // Compute pairwise links
    const linksList: ConstellationLink[] = [];
    for (let i = 0; i < charList.length; i++) {
      for (let j = i + 1; j < charList.length; j++) {
        const charA = charList[i];
        const charB = charList[j];

        const sharedInScenes: ConstellationLink['sharedScenes'] = [];
        let hasDirectDialogue = false;

        scenes.forEach((scene) => {
          const charsInScene = (scene.characters || []).map((c) => c.toUpperCase());
          const dialoguesInScene = scene.dialogueBlocks || [];
          const speakersInScene = dialoguesInScene.map((d) => d.character?.toUpperCase());

          const presentA = charsInScene.includes(charA) || speakersInScene.includes(charA);
          const presentB = charsInScene.includes(charB) || speakersInScene.includes(charB);

          if (presentA && presentB) {
            const countA = dialoguesInScene.filter((d) => d.character?.toUpperCase() === charA).length;
            const countB = dialoguesInScene.filter((d) => d.character?.toUpperCase() === charB).length;

            if (countA > 0 && countB > 0) {
              hasDirectDialogue = true;
            }

            sharedInScenes.push({
              sceneId: scene.id,
              sceneNumber: scene.sceneNumber,
              slugline: scene.slugline || scene.heading || `Scene ${scene.sceneNumber}`,
              dialogueCountA: countA,
              dialogueCountB: countB,
            });
          }
        });

        if (sharedInScenes.length > 0) {
          linksList.push({
            id: `${charA}---${charB}`,
            source: charA,
            target: charB,
            sharedScenesCount: sharedInScenes.length,
            isConfirmedDialogue: hasDirectDialogue,
            sharedScenes: sharedInScenes,
          });
        }
      }
    }

    // 2D Circular / Orbit layout coordinates with balanced spacing
    const width = 640;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusOrbit = Math.min(width, height) * 0.38;

    const nodesList: ConstellationNode[] = charList.map((name, idx) => {
      const stats = statsMap.get(name) || { sceneCount: 0, dialogueCount: 0, scenes: [] };
      const angle = (idx / Math.max(1, charList.length)) * 2 * Math.PI - Math.PI / 2;
      // Inward pull proportional to character centrality
      const pull = Math.min(0.22, (stats.sceneCount / Math.max(1, scenes.length)) * 0.25);
      const r = radiusOrbit * (1 - pull);

      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      const nodeRadius = Math.max(14, Math.min(26, 14 + stats.sceneCount * 1.4));

      return {
        id: name,
        name,
        sceneCount: stats.sceneCount,
        dialogueCount: stats.dialogueCount,
        scenes: stats.scenes,
        x,
        y,
        radius: nodeRadius,
      };
    });

    return {
      nodes: nodesList,
      links: linksList,
      characterStats: statsMap,
    };
  }, [characters, scenes]);

  // Filter links
  const filteredLinks = useMemo(() => {
    return links.filter((l) => {
      if (filterMode === 'dialogue_only' && !l.isConfirmedDialogue) return false;
      if (filterMode === 'frequent' && l.sharedScenesCount < 2) return false;
      return true;
    });
  }, [links, filterMode]);

  // Filter nodes matching search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toUpperCase();
    return nodes.filter((n) => n.name.includes(q));
  }, [nodes, searchQuery]);

  // Active inspected element
  const activeSelectedChar = nodes.find((n) => n.id === selectedCharId);
  const activeSelectedLink = links.find((l) => l.id === selectedLinkId);

  // Connected nodes to selected character
  const connectedCharIds = useMemo(() => {
    if (!selectedCharId) return new Set<string>();
    const set = new Set<string>();
    set.add(selectedCharId);
    links.forEach((l) => {
      if (l.source === selectedCharId) set.add(l.target);
      if (l.target === selectedCharId) set.add(l.source);
    });
    return set;
  }, [selectedCharId, links]);

  const handleSelectNode = (nodeId: string) => {
    if (selectedCharId === nodeId) {
      setSelectedCharId(null);
    } else {
      setSelectedCharId(nodeId);
      setSelectedLinkId(null);
      setIsInspectorOpen(true);
    }
  };

  const handleSelectLink = (linkId: string) => {
    if (selectedLinkId === linkId) {
      setSelectedLinkId(null);
    } else {
      setSelectedLinkId(linkId);
      setSelectedCharId(null);
      setIsInspectorOpen(true);
    }
  };

  const hasInspectorSelection = Boolean(activeSelectedChar || activeSelectedLink);

  return (
    <div
      data-testid="character-constellation-view"
      className={`flex-1 flex flex-col lg:flex-row h-full bg-[#0d1017] text-slate-100 overflow-hidden select-none ${className}`}
    >
      {/* Main Visual Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full border-b lg:border-b-0 lg:border-r border-white/5 relative">
        {/* Top Control Strip */}
        <div className="h-11 px-4 border-b border-white/[0.06] bg-[#11141c] flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
              Character Network <span className="text-[10px] text-slate-500 font-mono font-normal lowercase">(Character Constellation)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              ({nodes.length} characters, {filteredLinks.length} connections)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter mode switcher */}
            <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-md border border-white/[0.06] text-[11px]">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Connections
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('dialogue_only')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  filterMode === 'dialogue_only'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Direct Dialogue Only
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('frequent')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  filterMode === 'frequent'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Shared &ge; 2 Scenes
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Find character..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-32 lg:w-40 pl-7 pr-2.5 py-1 bg-black/30 border border-white/10 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/60"
              />
            </div>

            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-0.5 bg-black/40 p-0.5 rounded-md border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
                title="Zoom Out"
                className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-white/5 transition cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono px-1 text-slate-400 min-w-[32px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.15))}
                title="Zoom In"
                className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-white/5 transition cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  title="Reset Zoom"
                  className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-white/5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Evidence Inspector Toggle Button */}
            <button
              type="button"
              onClick={() => setIsInspectorOpen((prev) => !prev)}
              data-testid="toggle-evidence-inspector-btn"
              title="Toggle Evidence Inspector Panel"
              className={`h-7 px-2.5 rounded text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                isInspectorOpen
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                  : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Evidence Inspector</span>
            </button>
          </div>
        </div>

        {/* 2D SVG Interactive Network Canvas */}
        <div className="flex-1 w-full h-full flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0d13]">
          {nodes.length === 0 ? (
            <div className="text-center space-y-2 text-slate-500">
              <Users className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs">No character relationships detected in active screenplay.</p>
            </div>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <svg
                viewBox="0 0 640 520"
                className="w-full h-full max-w-[760px] max-h-[580px] select-none"
              >
                {/* Background Orbit Ring */}
                <circle
                  cx="320"
                  cy="260"
                  r="195"
                  fill="none"
                  stroke="rgba(255,255,255,0.03)"
                  strokeDasharray="4 4"
                />

                {/* Connection Lines */}
                <g className="links-layer">
                  {filteredLinks.map((link) => {
                    const nodeA = nodes.find((n) => n.id === link.source);
                    const nodeB = nodes.find((n) => n.id === link.target);
                    if (!nodeA || !nodeB) return null;

                    const isSelected = selectedLinkId === link.id;
                    const isHighlighted =
                      selectedCharId &&
                      (link.source === selectedCharId || link.target === selectedCharId);
                    const isDimmed =
                      selectedCharId &&
                      link.source !== selectedCharId &&
                      link.target !== selectedCharId;

                    const strokeWidth = Math.max(1.2, Math.min(4.5, link.sharedScenesCount * 0.8));
                    const strokeColor = link.isConfirmedDialogue
                      ? isSelected || isHighlighted
                        ? '#f59e0b'
                        : 'rgba(245, 158, 11, 0.55)'
                      : isSelected || isHighlighted
                      ? '#94a3b8'
                      : 'rgba(148, 163, 184, 0.25)';

                    return (
                      <line
                        key={link.id}
                        x1={nodeA.x}
                        y1={nodeA.y}
                        x2={nodeB.x}
                        y2={nodeB.y}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
                        strokeDasharray={link.isConfirmedDialogue ? undefined : '3 3'}
                        opacity={isDimmed ? 0.08 : 1}
                        className="cursor-pointer transition-all duration-150"
                        onClick={() => handleSelectLink(link.id)}
                      />
                    );
                  })}
                </g>

                {/* Character Nodes */}
                <g className="nodes-layer">
                  {nodes.map((node) => {
                    const isSelected = selectedCharId === node.id;
                    const isConnected = connectedCharIds.has(node.id);
                    const isDimmed = selectedCharId && !isConnected;
                    const isSearched =
                      searchQuery.trim().length > 0 &&
                      node.name.includes(searchQuery.toUpperCase());

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer transition-all duration-150"
                        opacity={isDimmed ? 0.2 : 1}
                        onClick={() => handleSelectNode(node.id)}
                      >
                        {/* Node Highlight Ring */}
                        {(isSelected || isSearched) && (
                          <circle
                            r={node.radius + 5}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Main Node Circle */}
                        <circle
                          r={node.radius}
                          fill={
                            isSelected
                              ? '#f59e0b'
                              : isConnected
                              ? '#1c2230'
                              : '#11151f'
                          }
                          stroke={
                            isSelected
                              ? '#ffffff'
                              : isConnected
                              ? '#f59e0b'
                              : 'rgba(255,255,255,0.18)'
                          }
                          strokeWidth={isSelected ? '2.5' : '1.5'}
                          className="transition-colors"
                        />

                        {/* Character Monogram */}
                        <text
                          textAnchor="middle"
                          dy=".35em"
                          fontSize={Math.max(9, node.radius * 0.7)}
                          fontWeight="bold"
                          fontFamily="monospace"
                          fill={isSelected ? '#09090b' : '#f1f5f9'}
                        >
                          {node.name.slice(0, 2)}
                        </text>

                        {/* Character Name Label Badge */}
                        <g transform={`translate(0, ${node.radius + 12})`}>
                          <rect
                            x={-(node.name.length * 3.2 + 6)}
                            y="-7"
                            width={node.name.length * 6.4 + 12}
                            height="14"
                            rx="3"
                            fill="#0d1117"
                            stroke={isSelected ? '#f59e0b' : 'rgba(255,255,255,0.08)'}
                            strokeWidth="1"
                          />
                          <text
                            textAnchor="middle"
                            dy=".3em"
                            fontSize="8.5"
                            fontFamily="sans-serif"
                            fontWeight="600"
                            fill={isSelected ? '#f59e0b' : '#cbd5e1'}
                            className="select-none tracking-tight"
                          >
                            {node.name.length > 14 ? `${node.name.slice(0, 12)}…` : node.name}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}

          {/* Minimal Clean Legend Overlay */}
          <div className="absolute bottom-3 left-4 bg-[#11141c]/90 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 text-[10px] space-y-1 select-none">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 bg-amber-400 inline-block" />
              <span className="text-slate-300">Direct Dialogue Exchange (Confirmed)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 border-t border-dashed border-slate-400 inline-block" />
              <span className="text-slate-400">Scene Co-presence (Inferred)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-amber-400 inline-block" />
              <span className="text-slate-400">Node size = Total Scene Appearances</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Detail Evidence Inspector Drawer */}
      <div
        data-testid="relationship-evidence-inspector"
        className={`bg-[#10131b] border-t lg:border-t-0 border-white/10 flex flex-col shrink-0 select-text overflow-hidden transition-all duration-200 ${
          isInspectorOpen ? 'w-full lg:w-80 h-auto lg:h-full' : 'hidden'
        }`}
      >
        <div className="h-11 px-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold text-slate-200">
              Relationship Evidence Inspector
            </h4>
          </div>
          <div className="flex items-center gap-2">
            {hasInspectorSelection && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCharId(null);
                  setSelectedLinkId(null);
                }}
                className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsInspectorOpen(false)}
              title="Close Inspector"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeSelectedLink ? (
            /* Selected Connection Detail */
            <div className="space-y-3 animate-fade-in">
              <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.08] space-y-2">
                <div className="text-[10px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                  Screenplay Relationship Evidence
                </div>
                <div className="flex items-center justify-between font-bold text-sm text-slate-100">
                  <span>{activeSelectedLink.source}</span>
                  <span className="text-xs text-slate-500 font-normal">&harr;</span>
                  <span>{activeSelectedLink.target}</span>
                </div>
                <div className="text-xs text-slate-300">
                  Appears together in{' '}
                  <strong className="text-amber-300 font-mono">
                    {activeSelectedLink.sharedScenesCount}
                  </strong>{' '}
                  scenes
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border bg-white/[0.04]">
                  {activeSelectedLink.isConfirmedDialogue ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">Confirmed Dialogue Exchange</span>
                    </>
                  ) : (
                    <>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400">Inferred Scene Co-presence</span>
                    </>
                  )}
                </div>
              </div>

              {/* Shared Scenes List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Shared Scenes Evidence</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {activeSelectedLink.sharedScenes.length} scenes
                  </span>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                  {activeSelectedLink.sharedScenes.map((scn) => (
                    <div
                      key={scn.sceneId}
                      className="p-2.5 rounded bg-black/40 border border-white/[0.06] text-xs hover:border-white/20 transition space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-amber-400 font-bold">#{scn.sceneNumber}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {scn.slugline}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/[0.04]">
                        <span>
                          {activeSelectedLink.source}: {scn.dialogueCountA} lines
                        </span>
                        <span>
                          {activeSelectedLink.target}: {scn.dialogueCountB} lines
                        </span>
                      </div>
                      {onSelectScene && (
                        <button
                          type="button"
                          onClick={() => onSelectScene(scn.sceneId)}
                          className="w-full mt-1.5 py-1 text-[10px] text-center text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Open in Scene Breakdown</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeSelectedChar ? (
            /* Selected Character Detail */
            <div className="space-y-3 animate-fade-in">
              <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.08] space-y-2">
                <div className="text-[10px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                  Character Profile
                </div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  {activeSelectedChar.name}
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 rounded bg-black/30 border border-white/[0.05]">
                    <span className="text-[10px] text-slate-400 block">Total Scenes</span>
                    <span className="text-sm font-mono font-bold text-slate-100">
                      {activeSelectedChar.sceneCount}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/30 border border-white/[0.05]">
                    <span className="text-[10px] text-slate-400 block">Dialogue Speeches</span>
                    <span className="text-sm font-mono font-bold text-amber-400">
                      {activeSelectedChar.dialogueCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Relationships */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Key Scene Partners ({connectedCharIds.size - 1})
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                  {links
                    .filter(
                      (l) => l.source === activeSelectedChar.name || l.target === activeSelectedChar.name
                    )
                    .sort((a, b) => b.sharedScenesCount - a.sharedScenesCount)
                    .map((l) => {
                      const partnerName =
                        l.source === activeSelectedChar.name ? l.target : l.source;
                      return (
                        <div
                          key={l.id}
                          onClick={() => handleSelectLink(l.id)}
                          className="p-2 rounded bg-black/30 border border-white/[0.05] hover:border-amber-400/40 cursor-pointer transition text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-slate-200 block">
                              {partnerName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {l.isConfirmedDialogue ? 'Dialogue exchange' : 'Co-present'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-300">
                            {l.sharedScenesCount} scenes
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            /* Default Hint State */
            <div className="text-center py-12 px-2 space-y-3 text-slate-500">
              <Users className="w-8 h-8 mx-auto opacity-30" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Select a character or connection</p>
                <p className="text-[11px] leading-relaxed">
                  Click any character node or connection line to inspect dialogue exchanges and scene-level evidence.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
