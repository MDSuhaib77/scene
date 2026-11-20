import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  ConfirmedCharacterRecord,
  CharacterInteractionEdge,
} from '../services/characterAnalysisService';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  RotateCcw,
} from 'lucide-react';

interface CharacterRelationshipGraphProps {
  characters: ConfirmedCharacterRecord[];
  interactions: CharacterInteractionEdge[];
  selectedCharacterId: string | null;
  onSelectCharacter: (characterId: string | null) => void;
  onJumpToScene?: (sceneId: string) => void;
  searchQuery?: string;
  className?: string;
}

interface GraphNode {
  id: string;
  name: string;
  displayLabel: string;
  blocks: number;
  words: number;
  speakingScenesCount: number;
  degree: number;
  x: number;
  y: number;
  radius: number;
}

interface ComputedLayout {
  nodes: GraphNode[];
  viewBox: { x: number; y: number; width: number; height: number };
}

/**
 * Deterministic 2D force-directed + bounding-box collision-free layout.
 * Guarantees separated nodes and readable labels across small (5) and large (70+) casts
 * without altering positions when selection changes.
 */
function computeRelationshipLayout(
  characters: ConfirmedCharacterRecord[],
  interactions: CharacterInteractionEdge[]
): ComputedLayout {
  const count = characters.length;
  if (count === 0) {
    return {
      nodes: [],
      viewBox: { x: 0, y: 0, width: 1000, height: 640 },
    };
  }

  const maxBlocks = Math.max(...characters.map((c) => c.totalDialogueBlocks), 1);

  // Degree & neighbor lookup
  const degreeMap = new Map<string, number>();
  const neighborEdges: Array<{ sourceIdx: number; targetIdx: number; weight: number }> = [];
  const idToIndex = new Map<string, number>();

  // Sort deterministically by interaction degree + dialogue blocks so primary hubs seed near center
  const degreePre = new Map<string, number>();
  for (const edge of interactions) {
    degreePre.set(edge.source, (degreePre.get(edge.source) || 0) + 1);
    degreePre.set(edge.target, (degreePre.get(edge.target) || 0) + 1);
  }

  const sortedChars = [...characters].sort((a, b) => {
    const scoreA = (degreePre.get(a.canonicalName) || 0) * 3 + a.totalDialogueBlocks;
    const scoreB = (degreePre.get(b.canonicalName) || 0) * 3 + b.totalDialogueBlocks;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.canonicalName.localeCompare(b.canonicalName);
  });

  sortedChars.forEach((c, idx) => {
    idToIndex.set(c.canonicalName, idx);
    degreeMap.set(c.canonicalName, degreePre.get(c.canonicalName) || 0);
  });

  for (const edge of interactions) {
    const sIdx = idToIndex.get(edge.source);
    const tIdx = idToIndex.get(edge.target);
    if (sIdx !== undefined && tIdx !== undefined && sIdx !== tIdx) {
      neighborEdges.push({
        sourceIdx: sIdx,
        targetIdx: tIdx,
        weight: edge.exchangeCount,
      });
    }
  }

  // Wide widescreen landscape world (~2.25:1) so nodes spread horizontally across desktop viewports
  const worldH = count <= 10 ? 540 : Math.max(600, Math.round(Math.sqrt(count) * 112));
  const worldW = count <= 10 ? 1240 : Math.round(worldH * 2.25);
  const cx = worldW / 2;
  const cy = worldH / 2;

  const baseRadiusMin = count > 35 ? 17 : 20;
  const baseRadiusRange = count > 35 ? 15 : 18;

  // Deterministic golden-angle spiral initial seeding stretched across wide horizontal ellipse
  const goldenAngle = 2.399963229728653;
  const maxSeedRx = worldW * 0.45;
  const maxSeedRy = worldH * 0.36;

  const simNodes: GraphNode[] = sortedChars.map((char, idx) => {
    const deg = degreeMap.get(char.canonicalName) || 0;
    const radius = Math.min(
      34,
      Math.max(baseRadiusMin, baseRadiusMin + Math.sqrt(char.totalDialogueBlocks / maxBlocks) * baseRadiusRange)
    );
    const displayLabel =
      char.canonicalName.length > 20
        ? `${char.canonicalName.slice(0, 18)}…`
        : char.canonicalName;

    const radialFraction = count === 1 ? 0 : Math.sqrt((idx + 0.5) / count);
    const angle = idx * goldenAngle;
    const x = cx + Math.cos(angle) * maxSeedRx * radialFraction;
    const y = cy + Math.sin(angle) * maxSeedRy * radialFraction;

    return {
      id: char.canonicalName,
      name: char.canonicalName,
      displayLabel,
      blocks: char.totalDialogueBlocks,
      words: char.totalDialogueWords,
      speakingScenesCount: char.speakingScenesCount,
      degree: deg,
      x,
      y,
      radius,
    };
  });

  // Approximate label + circle half-extents for collision avoidance
  const halfW = simNodes.map((n) => Math.max(n.radius + 14, n.displayLabel.length * 3.6 + 12));
  const halfH = simNodes.map((n) => n.radius + 22);

  if (count > 1) {
    // 1. Anisotropic Widescreen Force-Directed Pass (expands horizontally, stays compact vertically)
    const forceIterations = count > 45 ? 70 : 90;
    const area = worldW * worldH;
    const k = Math.sqrt(area / count) * 0.72;
    const maxRepelDist = k * 2.35;

    const dispX = new Float64Array(count);
    const dispY = new Float64Array(count);

    for (let iter = 0; iter < forceIterations; iter++) {
      dispX.fill(0);
      dispY.fill(0);
      const cooling = Math.max(0.08, 1 - iter / forceIterations);

      // Local pairwise repulsion weighted toward horizontal spread
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = simNodes[i].x - simNodes[j].x;
          const dy = simNodes[i].y - simNodes[j].y;
          const distSq = dx * dx + dy * dy + 0.01;
          const dist = Math.sqrt(distSq);
          if (dist > maxRepelDist) continue;

          const hubBoost =
            1 + Math.min(0.45, (simNodes[i].degree + simNodes[j].degree) * 0.018);
          const minDesired = (halfW[i] + halfW[j]) * 0.92;
          const repulseK = Math.max(k * 0.86, minDesired) * hubBoost;
          const force = ((repulseK * repulseK) / dist) * (1 - dist / maxRepelDist);

          const fx = (dx / dist) * force * 1.45;
          const fy = (dy / dist) * force * 0.72;
          dispX[i] += fx;
          dispY[i] += fy;
          dispX[j] -= fx;
          dispY[j] -= fy;
        }
      }

      // Spring attraction along dialogue edges
      for (const edge of neighborEdges) {
        const i = edge.sourceIdx;
        const j = edge.targetIdx;
        const dx = simNodes[j].x - simNodes[i].x;
        const dy = simNodes[j].y - simNodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy + 0.01);

        const weightFactor = 1 + Math.min(1.5, Math.log1p(edge.weight) * 0.4);
        const attract = ((dist * dist) / (k * 1.35)) * 0.28 * weightFactor;
        const fx = (dx / dist) * attract;
        const fy = (dy / dist) * attract;

        dispX[i] += fx;
        dispY[i] += fy;
        dispX[j] -= fx;
        dispY[j] -= fy;
      }

      // Stronger vertical centering gravity + wide horizontal freedom
      const minBoundX = halfW[0] + 24;
      const maxBoundX = worldW - halfW[0] - 24;
      const minBoundY = halfH[0] + 28;
      const maxBoundY = worldH - halfH[0] - 28;

      for (let i = 0; i < count; i++) {
        dispX[i] += (cx - simNodes[i].x) * 0.045;
        dispY[i] += (cy - simNodes[i].y) * 0.34;

        const dLen = Math.sqrt(dispX[i] * dispX[i] + dispY[i] * dispY[i]) || 1;
        const maxStep = Math.min(dLen, 46 * cooling);
        simNodes[i].x = Math.min(maxBoundX, Math.max(minBoundX, simNodes[i].x + (dispX[i] / dLen) * maxStep));
        simNodes[i].y = Math.min(maxBoundY, Math.max(minBoundY, simNodes[i].y + (dispY[i] / dLen) * maxStep));
      }
    }

    // 2. Deterministic Bounding-Box Non-Overlap Pass (preferring horizontal separation to keep wide aspect)
    const padX = count > 35 ? 14 : 18;
    const padY = count > 35 ? 9 : 13;

    for (let pass = 0; pass < 60; pass++) {
      let moved = false;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          let dx = simNodes[j].x - simNodes[i].x;
          let dy = simNodes[j].y - simNodes[i].y;

          if (dx === 0 && dy === 0) {
            dx = (i % 2 === 0 ? 1 : -1) * 0.5;
            dy = (j % 2 === 0 ? 1 : -1) * 0.5;
          }

          const reqX = halfW[i] + halfW[j] + padX;
          const reqY = halfH[i] + halfH[j] + padY;
          const penX = reqX - Math.abs(dx);
          const penY = reqY - Math.abs(dy);

          if (penX > 0 && penY > 0) {
            moved = true;
            // Bias separation horizontally so cast spreads across viewport width cleanly
            if (penX / (reqX * 1.55) < penY / reqY) {
              const push = penX * 0.52 * (dx >= 0 ? 1 : -1);
              simNodes[i].x -= push;
              simNodes[j].x += push;
            } else {
              const push = penY * 0.52 * (dy >= 0 ? 1 : -1);
              simNodes[i].y -= push;
              simNodes[j].y += push;
            }
          }
        }
      }
      if (!moved) break;
    }
  }

  // Compute tight fit viewBox covering all circles & labels cleanly
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  simNodes.forEach((n, idx) => {
    minX = Math.min(minX, n.x - halfW[idx] - 18);
    maxX = Math.max(maxX, n.x + halfW[idx] + 18);
    minY = Math.min(minY, n.y - n.radius - 32);
    maxY = Math.max(maxY, n.y + halfH[idx] + 22);
  });

  const rawW = Math.max(760, maxX - minX);
  const rawH = Math.max(460, maxY - minY);

  return {
    nodes: simNodes,
    viewBox: {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(rawW),
      height: Math.round(rawH),
    },
  };
}

export const CharacterRelationshipGraph: React.FC<CharacterRelationshipGraphProps> = ({
  characters,
  interactions,
  selectedCharacterId,
  onSelectCharacter,
  onJumpToScene,
  searchQuery = '',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [minTurnsFilter, setMinTurnsFilter] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; origPanX: number; origPanY: number } | null>(null);

  // Filter edges by minimum dialogue exchange threshold
  const visibleEdges = useMemo(() => {
    if (minTurnsFilter <= 1) return interactions;
    return interactions.filter((e) => e.exchangeCount >= minTurnsFilter);
  }, [interactions, minTurnsFilter]);

  const maxExchanges = useMemo(() => {
    return Math.max(...visibleEdges.map((i) => i.exchangeCount), 1);
  }, [visibleEdges]);

  // Compute stable, selection-independent layout
  const { nodes, viewBox } = useMemo(
    () => computeRelationshipLayout(characters, interactions),
    [characters, interactions]
  );

  // Fast node lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Direct neighbors of currently selected character (for focused highlighting)
  const connectedPartnerIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedCharacterId) return set;
    for (const edge of visibleEdges) {
      if (edge.source === selectedCharacterId) set.add(edge.target);
      else if (edge.target === selectedCharacterId) set.add(edge.source);
    }
    return set;
  }, [selectedCharacterId, visibleEdges]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return visibleEdges.find((i) => i.id === selectedEdgeId) || null;
  }, [selectedEdgeId, visibleEdges]);

  // Navigation handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.5, Math.round((z * 1.2) * 100) / 100));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.5, Math.round((z / 1.2) * 100) / 100));
  const handleResetView = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedEdgeId(null);
    onSelectCharacter(null);
  }, [onSelectCharacter]);

  const handleFitView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoomLevel((z) => Math.min(3.5, Math.max(0.5, Math.round(z * factor * 100) / 100)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origPanX: panOffset.x,
      origPanY: panOffset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = (e.clientX - dragStartRef.current.x) / zoomLevel;
    const dy = (e.clientY - dragStartRef.current.y) / zoomLevel;
    setPanOffset({
      x: dragStartRef.current.origPanX + dx,
      y: dragStartRef.current.origPanY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasActiveFocus = Boolean(selectedCharacterId);
  const showTurnThresholds = interactions.some((i) => i.exchangeCount >= 2);

  return (
    <div
      ref={containerRef}
      data-testid="character-relationship-graph"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative w-full h-full flex flex-col bg-transparent overflow-hidden select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${className}`}
    >
      {/* Minimal Floating Graph Controls */}
      <div
        className="absolute top-2.5 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none"
      >
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-0.5 bg-[#04160f]/80 backdrop-blur-xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-0.5 rounded-lg border border-white/10 shadow">
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-slate-300 px-1 min-w-[36px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In"
              aria-label="Zoom In"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
            <button
              type="button"
              onClick={handleFitView}
              title="Fit Graph to Viewport"
              className="px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1 text-[10px] font-mono"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit</span>
            </button>
          </div>

          {showTurnThresholds && (
            <div className="hidden md:flex items-center gap-0.5 bg-[#04160f]/80 backdrop-blur-xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-0.5 rounded-lg border border-white/10 shadow text-[10px] font-mono">
              <span className="text-slate-500 px-1.5">Min turns:</span>
              {[1, 2, 5].map((thresh) => (
                <button
                  key={thresh}
                  type="button"
                  onClick={() => setMinTurnsFilter(thresh)}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                    minTurnsFilter === thresh
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {thresh === 1 ? 'All' : `${thresh}+`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Return to Full Graph Action when Focused */}
        {hasActiveFocus && (
          <button
            type="button"
            data-testid="graph-reset-focus-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleResetView();
            }}
            className="pointer-events-auto px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow backdrop-blur-md"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Full Graph</span>
          </button>
        )}
      </div>

      {/* Unobtrusive Micro Legend (Bottom Left) */}
      {!selectedEdge && nodes.length > 0 && (
        <div className="absolute bottom-2 left-3 z-10 pointer-events-none text-[10px] font-mono text-slate-600 hidden sm:block">
          Node: Dialogue Blocks · Edge: Consecutive Turns
        </div>
      )}

      {/* Main Interactive SVG Canvas */}
      <div
        className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center"
        onClick={() => {
          if (selectedCharacterId) onSelectCharacter(null);
          if (selectedEdgeId) setSelectedEdgeId(null);
        }}
      >
        {nodes.length === 0 ? (
          <div className="text-center p-8 text-slate-500 text-xs">
            No speaking characters detected in the canonical screenplay.
          </div>
        ) : (
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
          >
            <defs>
              <radialGradient id="nodeActiveGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.04" />
              </radialGradient>
            </defs>

            <g
              transform={`translate(${viewBox.x + viewBox.width / 2 + panOffset.x}, ${
                viewBox.y + viewBox.height / 2 + panOffset.y
              }) scale(${zoomLevel}) translate(${-(viewBox.x + viewBox.width / 2)}, ${-(
                viewBox.y +
                viewBox.height / 2
              )})`}
            >
              {/* Interaction Edges */}
              <g className="edges-layer">
                {visibleEdges.map((edge) => {
                  const sourceNode = nodeMap.get(edge.source);
                  const targetNode = nodeMap.get(edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const isConnectedToSelected =
                    hasActiveFocus &&
                    (edge.source === selectedCharacterId || edge.target === selectedCharacterId);
                  const isSelectedEdge = selectedEdgeId === edge.id;
                  const isConnectedToHovered =
                    !hasActiveFocus &&
                    hoveredNodeId &&
                    (edge.source === hoveredNodeId || edge.target === hoveredNodeId);

                  const strokeWidth = Math.min(
                    5.5,
                    Math.max(1.4, 1.4 + (edge.exchangeCount / maxExchanges) * 4.1)
                  );

                  const strokeColor = isSelectedEdge
                    ? '#38bdf8'
                    : isConnectedToSelected
                    ? '#22d3ee'
                    : isConnectedToHovered
                    ? '#94a3b8'
                    : '#475569';

                  const strokeOpacity = isSelectedEdge
                    ? 0.95
                    : isConnectedToSelected
                    ? 0.85
                    : isConnectedToHovered
                    ? 0.72
                    : hasActiveFocus
                    ? 0.06
                    : characters.length > 30
                    ? 0.24
                    : 0.4;

                  const midX = (sourceNode.x + targetNode.x) / 2;
                  const midY = (sourceNode.y + targetNode.y) / 2;

                  return (
                    <g key={edge.id} className="cursor-pointer">
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke="transparent"
                        strokeWidth={Math.max(14, strokeWidth + 10)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId(edge.id);
                        }}
                      />
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={strokeColor}
                        strokeWidth={
                          isSelectedEdge || isConnectedToSelected
                            ? Math.max(2, strokeWidth)
                            : strokeWidth
                        }
                        strokeOpacity={strokeOpacity}
                        className="transition-opacity duration-200"
                      />

                      {/* Show crisp edge turn count badge only when focused or edge is selected */}
                      {(isConnectedToSelected || isSelectedEdge) && (
                        <g
                          transform={`translate(${midX}, ${midY})`}
                          className="pointer-events-none"
                        >
                          <rect
                            x={-13}
                            y={-9}
                            width={26}
                            height={18}
                            rx={6}
                            fill="#041a12"
                            stroke="#10b981"
                            strokeOpacity={0.5}
                            strokeWidth={1}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#a7f3d0"
                            fontSize="9.5"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {edge.exchangeCount}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Character Nodes */}
              <g className="nodes-layer">
                {nodes.map((node) => {
                  const isSelected = selectedCharacterId === node.id;
                  const isNeighbor = hasActiveFocus && connectedPartnerIds.has(node.id);
                  const isHovered = hoveredNodeId === node.id;
                  const matchesSearch =
                    !normalizedQuery || node.name.toLowerCase().includes(normalizedQuery);

                  // Focus & search opacity calculations (preserve positions; subdue unrelated nodes)
                  let nodeOpacity = 1;
                  if (hasActiveFocus) {
                    if (isSelected || isNeighbor) {
                      nodeOpacity = matchesSearch ? 1 : 0.3;
                    } else {
                      nodeOpacity = isHovered ? 0.55 : 0.16;
                    }
                  } else if (!matchesSearch) {
                    nodeOpacity = 0.16;
                  }

                  const circleFill = isSelected
                    ? '#063d27'
                    : isNeighbor
                    ? '#042b1b'
                    : isHovered
                    ? '#1c2436'
                    : '#131823';

                  const circleStroke = isSelected
                    ? '#10b981'
                    : isNeighbor
                    ? '#34d399'
                    : isHovered
                    ? '#94a3b8'
                    : '#334155';

                  const pillWidth = Math.max(48, node.displayLabel.length * 6.4 + 14);

                  return (
                    <g
                      key={node.id}
                      data-character={node.name}
                      data-focused={isSelected ? 'selected' : isNeighbor ? 'neighbor' : 'default'}
                      className="cursor-pointer transition-opacity duration-200"
                      style={{ opacity: nodeOpacity }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCharacter(isSelected ? null : node.id);
                        setSelectedEdgeId(null);
                      }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      {/* Selection Aura */}
                      {isSelected && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.radius + 9}
                          fill="url(#nodeActiveGradient)"
                          stroke="#10b981"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* Neighbor Indicator Ring */}
                      {isNeighbor && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.radius + 5}
                          fill="none"
                          stroke="#6ee7b7"
                          strokeOpacity="0.45"
                          strokeWidth="1.2"
                        />
                      )}

                      {/* Primary Node Circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius}
                        fill={circleFill}
                        stroke={circleStroke}
                        strokeWidth={isSelected ? 2.5 : isNeighbor ? 2 : 1.4}
                      />

                      {/* Inner Monogram */}
                      <text
                        x={node.x}
                        y={node.y + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isSelected ? '#38bdf8' : isNeighbor ? '#e0f2fe' : '#cbd5e1'}
                        fontSize={Math.max(9.5, Math.min(12.5, node.radius * 0.62))}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {node.name.slice(0, 3)}
                      </text>

                      {/* Crisp Label Pill Backing for Readability */}
                      <rect
                        x={node.x - pillWidth / 2}
                        y={node.y + node.radius + 5}
                        width={pillWidth}
                        height={17}
                        rx={5}
                        fill="#0b0e14"
                        fillOpacity={isSelected || isNeighbor ? 0.94 : 0.82}
                        stroke={isSelected ? '#22d3ee' : isNeighbor ? '#334155' : 'none'}
                        strokeOpacity={0.5}
                        strokeWidth={0.8}
                      />

                      {/* Character Name */}
                      <text
                        x={node.x}
                        y={node.y + node.radius + 13.5}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={
                          isSelected
                            ? '#ffffff'
                            : isNeighbor
                            ? '#e0f2fe'
                            : '#cbd5e1'
                        }
                        fontSize="10"
                        fontWeight={isSelected || isNeighbor ? '700' : '600'}
                        className="pointer-events-none tracking-tight"
                      >
                        {node.displayLabel}
                      </text>

                      {/* Dialogue Cue Count */}
                      <text
                        x={node.x}
                        y={node.y + node.radius + 29}
                        textAnchor="middle"
                        fill={isSelected ? '#67e8f9' : '#64748b'}
                        fontSize="9"
                        fontFamily="monospace"
                        className="pointer-events-none"
                      >
                        {node.blocks} {node.blocks === 1 ? 'block' : 'blocks'}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}
      </div>

      {/* Selected Edge Inspector Popover (Bottom Left) */}
      {selectedEdge && (
        <div
          data-testid="graph-edge-inspector"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-4 z-20 max-w-sm w-full bg-[#04140e]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl space-y-3"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
              Dialogue Interaction Channel
            </span>
            <button
              type="button"
              onClick={() => setSelectedEdgeId(null)}
              aria-label="Close channel details"
              className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-white text-xs truncate max-w-[120px]">
              {selectedEdge.source}
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold shrink-0">
              {selectedEdge.exchangeCount} {selectedEdge.exchangeCount === 1 ? 'turn' : 'turns'}
            </span>
            <div className="font-bold text-white text-xs truncate max-w-[120px] text-right">
              {selectedEdge.target}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 block">
              Recorded across {selectedEdge.sceneReferences.length}{' '}
              {selectedEdge.sceneReferences.length === 1 ? 'scene' : 'scenes'}:
            </span>
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
              {selectedEdge.sceneReferences.map((ref) => (
                <div
                  key={ref.sceneId}
                  onClick={() => onJumpToScene?.(ref.sceneId)}
                  className="p-1.5 rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 flex items-center justify-between text-[11px] cursor-pointer"
                >
                  <span className="font-mono text-emerald-400 font-bold">
                    Sc. {ref.sceneNumber}
                  </span>
                  <span className="text-slate-300 truncate max-w-[160px]">
                    {ref.heading}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {ref.exchangeCount} {ref.exchangeCount === 1 ? 'turn' : 'turns'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
