/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FilmProject, FilmPhase, Activity, SubTask } from '../types';
import { addDays, getDaysDifference } from '../utils/scheduler';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  Sliders, 
  Info, 
  FastForward, 
  Film, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Award,
  Clock,
  Calendar,
  Sparkles
} from 'lucide-react';

interface PhaseTaskConfigurationBoardProps {
  project: FilmProject;
  simulatedDate: string;
  isDark: boolean;
  onToggleActivity: (phaseId: string, activityId: string) => void;
  onAddActivity: (phaseId: string, title: string) => void;
  onRemoveActivity: (phaseId: string, activityId: string) => void;
  onUpdateActivity: (phaseId: string, activityId: string, data: Partial<Activity>) => void;
  onAdjustPhaseDays: (phaseId: string, days: number) => void;
  onUpdatePhase: (phaseId: string, data: Partial<FilmPhase>) => void;
  onMovePhaseUp: (idxInPhases: number) => void;
  onMovePhaseDown: (idxInPhases: number) => void;
  onDeletePhase: (phaseId: string) => void;
  onAddPhase: (category: 'pre' | 'prod' | 'post', name: string, durationDays: number) => void;
}

export default function PhaseTaskConfigurationBoard({
  project,
  simulatedDate,
  isDark,
  onToggleActivity,
  onAddActivity,
  onRemoveActivity,
  onUpdateActivity,
  onAdjustPhaseDays,
  onUpdatePhase,
  onMovePhaseUp,
  onMovePhaseDown,
  onDeletePhase,
  onAddPhase
}: PhaseTaskConfigurationBoardProps) {
  const { phases } = project;

  // Inline forms states for appending sub-phases in each column
  const [newPhaseName, setNewPhaseName] = React.useState<{ [key: string]: string }>({ pre: '', prod: '', post: '' });
  const [newPhaseDays, setNewPhaseDays] = React.useState<{ [key: string]: number }>({ pre: 14, prod: 21, post: 30 });
  const [showAddForm, setShowAddForm] = React.useState<{ [key: string]: boolean }>({ pre: false, prod: false, post: false });

  // Inline forms states for appending activities in each sub-phase
  const [newActNames, setNewActNames] = React.useState<{ [key: string]: string }>({});

  // Expanded state for editing nested mini-tasks checklist and custom timeline
  const [expandedActivityId, setExpandedActivityId] = React.useState<string | null>(null);

  // Expanded state for sub-tasks input helper
  const [newSubTaskNames, setNewSubTaskNames] = React.useState<{ [key: string]: string }>({});

  const handleAddPhaseSubmit = (category: 'pre' | 'prod' | 'post') => {
    const name = newPhaseName[category];
    const days = newPhaseDays[category];
    if (name.trim()) {
      onAddPhase(category, name.trim(), days);
      setNewPhaseName(prev => ({ ...prev, [category]: '' }));
      setShowAddForm(prev => ({ ...prev, [category]: false }));
    }
  };

  const handleAddActivitySubmit = (e: React.FormEvent, phaseId: string) => {
    e.preventDefault();
    const text = newActNames[phaseId];
    if (text?.trim()) {
      onAddActivity(phaseId, text.trim());
      setNewActNames(prev => ({ ...prev, [phaseId]: '' }));
    }
  };

  const handleAddSubTask = (phaseId: string, actId: string, act: Activity) => {
    const text = newSubTaskNames[actId];
    if (!text?.trim()) return;

    const currentSubs = act.subTasks || [];
    const newSub: SubTask = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: text.trim(),
      completed: false
    };

    onUpdateActivity(phaseId, actId, {
      subTasks: [...currentSubs, newSub]
    });

    setNewSubTaskNames(prev => ({ ...prev, [actId]: '' }));
  };

  const handleToggleSubTask = (phaseId: string, actId: string, act: Activity, subId: string) => {
    const updatedSubs = (act.subTasks || []).map(s => 
      s.id === subId ? { ...s, completed: !s.completed } : s
    );

    // If all subtasks are completed, maybe auto-tick activity as complete?
    const allDone = updatedSubs.length > 0 && updatedSubs.every(s => s.completed);

    onUpdateActivity(phaseId, actId, {
      subTasks: updatedSubs,
      completed: allDone ? true : act.completed
    });
  };

  const handleRemoveSubTask = (phaseId: string, actId: string, act: Activity, subId: string) => {
    const updatedSubs = (act.subTasks || []).filter(s => s.id !== subId);
    onUpdateActivity(phaseId, actId, {
      subTasks: updatedSubs
    });
  };

  return (
    <div className="space-y-6 animate-fade-in" id="phase-task-configuration-console">
      {/* SECTION HEADER BAR */}
      <div className={`p-5 rounded-2xl border ${
        isDark 
          ? 'bg-zinc-950/80 border-indigo-500/10' 
          : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-mono tracking-widest font-bold uppercase text-indigo-400">
                Operational Planning Console
              </span>
            </div>
            <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
              Phase Weights & Day-to-Day Task Manager
            </h2>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-550'}`}>
              Configure chronological sub-phases, adjust duration weights, and audit granular task checkpoints for day-to-day film operations.
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-start sm:self-center font-mono text-[10px] bg-indigo-500/5 px-3.5 py-2 rounded-xl border border-indigo-500/15">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className={isDark ? 'text-zinc-300' : 'text-zinc-650'}>
              {project.isEndDateFixed ? (
                <span><strong>RIGID TIMELINE BUFFER:</strong> Phase weights shrink tasks to fit release date</span>
              ) : (
                <span><strong>FLEXIBLE MODE:</strong> Duration adjustments shift the projected release</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* THREE-MODULE COLUMN SWIMLANES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="modular-swimlanes-config-root">
        {([
          { 
            key: 'pre', 
            name: 'Pre-Production', 
            desc: 'Creative architecture & scout plans', 
            color: 'text-cyan-400', 
            border: 'border-cyan-500/15', 
            bgBadge: 'bg-cyan-500/10 border-cyan-500/25', 
            accent: 'border-cyan-500/10',
            glow: 'rgba(6,182,212,0.15)',
            btnHover: 'hover:bg-cyan-400/5 hover:text-cyan-300 hover:border-cyan-400/30'
          },
          { 
            key: 'prod', 
            name: 'Production', 
            desc: 'Physical shoot & capture logs', 
            color: 'text-indigo-400', 
            border: 'border-indigo-500/15', 
            bgBadge: 'bg-indigo-500/10 border-indigo-500/25', 
            accent: 'border-indigo-500/10',
            glow: 'rgba(79,70,229,0.15)',
            btnHover: 'hover:bg-indigo-400/5 hover:text-indigo-300 hover:border-indigo-400/30'
          },
          { 
            key: 'post', 
            name: 'Post-Production', 
            desc: 'Cutting room assembly & VFX details', 
            color: 'text-rose-400', 
            border: 'border-rose-500/15', 
            bgBadge: 'bg-rose-500/10 border-rose-500/25', 
            accent: 'border-rose-500/10',
            glow: 'rgba(225,29,72,0.15)',
            btnHover: 'hover:bg-rose-400/5 hover:text-rose-300 hover:border-rose-400/30'
          },
        ] as const).map((module) => {
          const modulePhases = phases.filter(p => {
            if (module.key === 'pre') return !p.category || p.category === 'pre';
            return p.category === module.key;
          });
          
          const isAdding = showAddForm[module.key];

          return (
            <div 
              key={module.key} 
              className={`border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative ${
                isDark 
                  ? `bg-gradient-to-b from-[#0C0E1A] to-[#040509] ${module.border}` 
                  : 'bg-white border-zinc-200 shadow-lg shadow-zinc-200/45'
              }`}
            >
              <div className="space-y-4">
                {/* Column identity block */}
                <div className="flex items-center justify-between pb-2.5 border-b border-zinc-900/60">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${module.key === 'pre' ? 'bg-cyan-400' : module.key === 'prod' ? 'bg-indigo-400' : 'bg-rose-400'}`} />
                      <h4 className={`text-sm font-sans font-black tracking-tight ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{module.name}</h4>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-sans block mt-0.5 leading-none">{module.desc}</span>
                  </div>
                  
                  <span className={`px-2 py-0.5 border rounded-full font-mono text-[9px] font-extrabold uppercase ${module.bgBadge}`}>
                    {modulePhases.length} sub-phases
                  </span>
                </div>

                {/* Subphases Accordion list */}
                {modulePhases.length === 0 ? (
                  <div className="text-center py-10 rounded-xl border border-dashed border-zinc-900/40 text-[10px] font-mono text-zinc-600">
                    No sub-phases declared.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modulePhases.map((phase) => {
                      const idxInAllPhases = phases.findIndex(p => p.id === phase.id);
                      
                      // Calculate phase stats
                      const totalActs = phase.activities.length;
                      const doneActs = phase.activities.filter(a => a.completed).length;
                      const phaseProgress = totalActs > 0 ? Math.round((doneActs / totalActs) * 100) : 0;

                      return (
                        <div 
                          key={phase.id}
                          className={`rounded-xl border p-3.5 space-y-4 transition-all ${
                            isDark 
                              ? 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800' 
                              : 'bg-zinc-50/50 border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          {/* Phase Header */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="truncate-text">
                              <h5 className={`text-xs font-sans font-black tracking-tight flex items-center gap-1 truncate ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                                <span>{phase.name}</span>
                              </h5>
                              <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
                                Sub-Phase ID: {phase.id}
                              </p>
                            </div>

                            {/* Position Shifting Arrows */}
                            <div className="flex items-center gap-0.5 shrink-0 bg-zinc-950/60 p-0.5 border border-zinc-900 rounded-md">
                              <button
                                type="button"
                                disabled={idxInAllPhases === 0}
                                onClick={() => onMovePhaseUp(idxInAllPhases)}
                                className={`p-1 rounded text-zinc-500 hover:text-white transition cursor-pointer disabled:opacity-20 disabled:pointer-events-none`}
                                title="Move up chronological hierarchy"
                              >
                                <ArrowUp className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idxInAllPhases === phases.length - 1}
                                onClick={() => onMovePhaseDown(idxInAllPhases)}
                                className={`p-1 rounded text-zinc-500 hover:text-white transition cursor-pointer disabled:opacity-20 disabled:pointer-events-none`}
                                title="Move down chronological hierarchy"
                              >
                                <ArrowDown className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeletePhase(phase.id)}
                                className="p-1 rounded text-zinc-600 hover:text-rose-400 transition cursor-pointer"
                                title="Delete entire phase"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* 1. allotted timeline days adjust block */}
                          <div className="flex items-center justify-between text-[10px] font-mono p-1.5 bg-zinc-950/45 rounded border border-zinc-900 gap-1.5">
                            <div>
                              <span className="text-zinc-550 block text-[8px] uppercase font-bold">Planned Interval</span>
                              <span className="text-zinc-300 font-bold block text-[9.5px]">{phase.startDate} to {phase.endDate}</span>
                            </div>

                            <div className="flex items-center border border-zinc-800 rounded bg-zinc-950">
                              <button
                                type="button"
                                onClick={() => onAdjustPhaseDays(phase.id, phase.durationDays - 1)}
                                className="px-2 py-0.5 text-zinc-400 hover:text-white transition font-bold"
                              >
                                -
                              </button>
                              <span className="px-1.5 text-cyan-400 font-extrabold text-[10.5px]">{phase.durationDays}d</span>
                              <button
                                type="button"
                                onClick={() => onAdjustPhaseDays(phase.id, phase.durationDays + 1)}
                                className="px-2 py-0.5 text-zinc-400 hover:text-white transition font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* 2. Priority Weight Select List */}
                          <div className={`flex items-center justify-between text-[10px] font-mono p-1.5 rounded border gap-1.5 ${
                            isDark ? 'bg-[#04060c] border-[#1f2945]/30' : 'bg-zinc-50 border-zinc-200'
                          }`}>
                            <div className="flex-1">
                              <span className="text-indigo-400 block text-[8px] uppercase leading-none mb-1 font-black">PHASE PRIORITY WEIGHT</span>
                              <select
                                value={phase.importance || 'medium'}
                                id={`importance-select-${phase.id}`}
                                onChange={(e) => onUpdatePhase(phase.id, { importance: e.target.value as 'critical' | 'high' | 'medium' | 'low' })}
                                className={`w-full font-extrabold focus:outline-none cursor-pointer border p-0.5 rounded text-[9.5px] font-mono focus:ring-1 focus:ring-indigo-500 ${
                                  isDark ? 'bg-zinc-950 text-cyan-400 border-zinc-850' : 'bg-white text-cyan-600 border-zinc-250'
                                }`}
                              >
                                <option value="critical" className="bg-zinc-950 text-rose-450 font-bold">★ Critical (2.0x weight)</option>
                                <option value="high" className="bg-zinc-950 text-indigo-400 font-bold">High (1.5x weight)</option>
                                <option value="medium" className="bg-zinc-950 text-zinc-300">Regular (1.0x weight)</option>
                                <option value="low" className="bg-zinc-950 text-zinc-550">Low (0.6x weight)</option>
                              </select>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <span className="text-zinc-500 block text-[8px] uppercase leading-none mb-1 font-bold">Constraint mode</span>
                              {project.isEndDateFixed ? (
                                <span className="text-[8.5px] font-black font-mono text-cyan-400 uppercase flex items-center justify-end gap-1.5 select-none py-1">
                                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                                  RIGID-SCALED
                                </span>
                              ) : (
                                <span className="text-[8.5px] font-mono text-zinc-500 uppercase block italic py-1 select-none">
                                  FLEX_DRIFT
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3. Task checklists */}
                          <div className="space-y-2 pt-1 border-t border-zinc-900/40">
                            <div className="flex justify-between items-center text-[8.5px] font-mono uppercase text-zinc-400">
                              <span>Checklist: {doneActs}/{totalActs} Done</span>
                              <span className="font-extrabold text-cyan-400 font-sans">{phaseProgress}%</span>
                            </div>

                            {phase.activities.length > 0 ? (
                              <div className="space-y-2 bg-zinc-950/20 p-2 rounded-lg border border-zinc-900/40">
                                {phase.activities.map((act) => {
                                  const isExpanded = expandedActivityId === act.id;
                                  const totalSubs = act.subTasks?.length || 0;
                                  const doneSubs = act.subTasks?.filter(s => s.completed).length || 0;

                                  return (
                                    <div 
                                      key={act.id} 
                                      className={`border rounded-lg p-2.5 transition-all ${
                                        act.isPostponed
                                          ? 'border-amber-500/25 bg-amber-950/5 text-zinc-550'
                                          : isExpanded 
                                          ? 'bg-[#101426]/60 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.05)]' 
                                          : act.completed 
                                          ? 'bg-zinc-900/10 border-transparent text-zinc-500' 
                                          : 'bg-[#0E1120]/30 border-zinc-900/80 text-zinc-300 hover:border-zinc-800'
                                      }`}
                                    >
                                      {/* Row header */}
                                      <div className="flex items-center justify-between gap-1.5 text-[10px]">
                                        <button
                                          type="button"
                                          onClick={() => onToggleActivity(phase.id, act.id)}
                                          className="flex items-center gap-1.5 text-left flex-1 min-w-0 pointer"
                                        >
                                          {act.completed ? (
                                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                                          ) : (
                                            <Square className="w-4 h-4 text-zinc-700 shrink-0" />
                                          )}
                                          <div className="truncate">
                                            <span className={`font-semibold text-[10.5px] tracking-tight block ${act.completed ? 'line-through text-zinc-600' : 'text-gray-105'} ${act.isPostponed ? 'line-through italic text-zinc-550' : ''}`}>
                                              {act.name}
                                            </span>
                                            
                                            {/* Subtask / Date badges */}
                                            <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[8.5px] text-zinc-500 flex-wrap select-none leading-none">
                                              {act.isPostponed ? (
                                                <span className="text-[7.5px] bg-[#3c2a10] text-amber-400 border border-amber-600/20 px-1 py-0.2 rounded font-black uppercase">
                                                  ↳ Postponed Backlog
                                                </span>
                                              ) : (
                                                <span className="flex items-center gap-0.5">
                                                  <Clock className="w-2.5 h-2.5" />
                                                  {act.startDate ? `${act.startDate} to ${act.endDate}` : `${act.estimatedDays || 3}d`}
                                                </span>
                                              )}
                                              {act.priority && (
                                                <span className={`px-1 py-0.1 border rounded text-[7.5px] uppercase font-bold leading-none ${
                                                  act.priority === 'high' 
                                                    ? 'bg-rose-950/40 text-rose-400 border-rose-500/20'
                                                    : act.priority === 'medium'
                                                    ? 'bg-amber-950/45 text-amber-500 border-amber-500/20'
                                                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                                }`}>
                                                  {act.priority}
                                                </span>
                                              )}
                                              {act.isThresholdTask && (
                                                <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-501/20 px-1 py-0.1 rounded text-[7.5px]" title={`Must take at least ${act.minDaysThreshold} days`}>
                                                  Min {act.minDaysThreshold}d
                                                </span>
                                              )}
                                              {totalSubs > 0 && (
                                                <span className="px-1 bg-cyan-950/30 text-cyan-400 border border-cyan-500/10 rounded">
                                                  {doneSubs}/{totalSubs} steps
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                        
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedActivityId(isExpanded ? null : act.id)}
                                            className={`p-1 rounded transition flex items-center justify-center ${isExpanded ? 'text-cyan-400 bg-cyan-950/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            title="Edit timeline & micro-tasks checklist"
                                          >
                                            <Sliders className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => onRemoveActivity(phase.id, act.id)}
                                            className="text-zinc-650 hover:text-rose-400 p-1.5 rounded hover:bg-rose-950/20 transition-all flex items-center justify-center cursor-pointer"
                                            title="Remove task from checkpoint lists"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Granular Task Customization & Call sheet micro-checkpoints */}
                                      {isExpanded && (
                                        <div className="mt-3.5 pt-3.5 border-t border-zinc-900/60 p-0.5 space-y-3 font-sans text-[10px] animate-fade-in text-zinc-300">
                                          {/* Edit label */}
                                          <div className="space-y-1">
                                            <label className="text-[8px] font-mono uppercase text-zinc-500 tracking-wider">Configure Task Label</label>
                                            <input 
                                              type="text" 
                                              value={act.name}
                                              onChange={(e) => onUpdateActivity(phase.id, act.id, { name: e.target.value })}
                                              className="w-full bg-[#030408] border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-200 text-[10px] focus:ring-1 focus:ring-cyan-500 focus:outline-none focus:border-cyan-500 font-medium"
                                            />
                                          </div>

                                          {/* Slider range for days */}
                                          <div className="space-y-1">
                                            <label className="text-[8px] font-mono uppercase text-zinc-500 tracking-wider">Estimated Days (Squeezed dynamically to fit Release Date)</label>
                                            <div className="flex items-center gap-2">
                                              <input 
                                                type="range" 
                                                min="1" 
                                                max="60" 
                                                value={act.estimatedDays || 3}
                                                onChange={(e) => onUpdateActivity(phase.id, act.id, { estimatedDays: parseInt(e.target.value) || 3 })}
                                                className="flex-1 accent-cyan-500 bg-zinc-950"
                                              />
                                              <span className="text-cyan-400 font-extrabold font-mono text-xs w-8 text-right">{act.estimatedDays || 3}d</span>
                                            </div>
                                          </div>

                                          {/* Settings Grid */}
                                          <div className="space-y-2 bg-black/40 p-2.5 rounded-lg border border-zinc-900">
                                            <div className="flex items-center justify-between border-b border-zinc-900 pb-1 mb-1.5">
                                              <span className="text-[8.5px] font-mono font-black uppercase text-indigo-400">Day-to-day Priority & Backlog</span>
                                              <span className="text-[7.5px] text-zinc-550 uppercase font-mono">Control Valves</span>
                                            </div>

                                            {/* Priority button selector */}
                                            <div className="flex items-center justify-between gap-1.5">
                                              <span className="text-zinc-500 text-[8px] font-mono uppercase font-semibold">Priority level</span>
                                              <div className="flex gap-1">
                                                {(['low', 'medium', 'high'] as const).map((prio) => (
                                                  <button
                                                    key={prio}
                                                    type="button"
                                                    id={`board-prio-${act.id}-${prio}`}
                                                    onClick={() => onUpdateActivity(phase.id, act.id, { priority: prio })}
                                                    className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider font-extrabold border transition-all ${
                                                      (act.priority || 'medium') === prio
                                                        ? prio === 'high'
                                                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-455 shadow-sm shadow-rose-950/20'
                                                          : prio === 'medium'
                                                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 shadow-sm shadow-amber-950/20'
                                                          : 'bg-zinc-500/15 border-zinc-550/30 text-zinc-400'
                                                        : 'bg-transparent border-transparent text-zinc-600 hover:text-zinc-400'
                                                    }`}
                                                  >
                                                    {prio}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>

                                            {/* Minimum Threshold toggle */}
                                            <div className="space-y-1.5 pt-1.5 border-t border-zinc-900/60 mt-1.5">
                                              <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                                                <div className="flex items-center gap-1.5">
                                                  <input
                                                    type="checkbox"
                                                    checked={!!act.isThresholdTask}
                                                    onChange={(e) => onUpdateActivity(phase.id, act.id, { isThresholdTask: e.target.checked, minDaysThreshold: e.target.checked ? (act.minDaysThreshold || 3) : undefined })}
                                                    className="rounded bg-zinc-950 border-zinc-800 text-cyan-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                                  />
                                                  <div className="leading-tight">
                                                    <span className="text-zinc-300 font-bold block text-[8px] uppercase">Enforce Non-Negiotiable Minimum Duration</span>
                                                    <span className="text-zinc-500 text-[7.5px] block">Solver cannot squeeze this below threshold</span>
                                                  </div>
                                                </div>
                                              </label>

                                              {act.isThresholdTask && (
                                                <div className="flex items-center gap-3 bg-[#03050b] p-1.5 rounded border border-zinc-900 animate-slide-down">
                                                  <span className="text-zinc-500 font-mono text-[8px] uppercase font-bold shrink-0">Threshold:</span>
                                                  <input 
                                                    type="range"
                                                    min="1"
                                                    max="30"
                                                    value={act.minDaysThreshold || 3}
                                                    onChange={(e) => onUpdateActivity(phase.id, act.id, { minDaysThreshold: parseInt(e.target.value) || 3 })}
                                                    className="flex-1 accent-indigo-500 bg-zinc-950"
                                                  />
                                                  <span className="font-mono font-bold text-indigo-400 text-[10px] w-6 text-right shrink-0">{act.minDaysThreshold || 3}d</span>
                                                </div>
                                              )}
                                            </div>

                                            {/* Postponable Toggle settings */}
                                            <div className="pt-2 border-t border-zinc-900/60 flex items-center justify-between">
                                              <div className="leading-tight">
                                                <span className="text-zinc-300 font-bold block text-[8px] uppercase">Postponable task backlog status</span>
                                                <span className="text-zinc-500 text-[7.5px] block">Sinks this to post-release if schedule slips</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => onUpdateActivity(phase.id, act.id, { canBePostponed: !act.canBePostponed, isPostponed: act.canBePostponed ? false : act.isPostponed })}
                                                  className={`px-2 py-0.5 rounded text-[8px] border font-mono uppercase tracking-wider font-extrabold transition-all ${
                                                    act.canBePostponed
                                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                                      : 'bg-zinc-900 text-zinc-650 border-transparent hover:text-zinc-400'
                                                  }`}
                                                >
                                                  {act.canBePostponed ? 'YES: PLAN DEFERRAL' : 'STRICT LIMIT'}
                                                </button>
                                                {act.canBePostponed && (
                                                  <button
                                                    type="button"
                                                    onClick={() => onUpdateActivity(phase.id, act.id, { isPostponed: !act.isPostponed })}
                                                    className={`px-1.5 py-0.5 rounded text-[7.5px] border font-mono uppercase tracking-wider font-extrabold transition-all ${
                                                      act.isPostponed
                                                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                                        : 'bg-zinc-950 text-zinc-500 border-zinc-900 hover:text-zinc-300'
                                                    }`}
                                                    title="Deletes from active timeline, places into backlog"
                                                  >
                                                    {act.isPostponed ? 'POSTPONED' : 'DEFER NOW'}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* GRANULAR SUB-TASKS (Daily Micro-Checkpoints) */}
                                          <div className="space-y-2 bg-[#020306] p-2.5 rounded-lg border border-zinc-900">
                                            <div className="flex items-center justify-between border-b border-zinc-900 pb-1 mb-1.5">
                                              <span className="text-[8.5px] font-mono font-bold uppercase text-cyan-400 flex items-center gap-1">
                                                <Award className="w-3 h-3 text-cyan-400" />
                                                Daily Audit Checkpoints Checklist
                                              </span>
                                              <span className="text-[7.5px] text-zinc-500 font-mono">
                                                {doneSubs}/{totalSubs} verified
                                              </span>
                                            </div>

                                            {/* Subtasks checklist */}
                                            {(act.subTasks || []).length > 0 ? (
                                              <div className="space-y-1.5">
                                                {(act.subTasks || []).map((sub) => (
                                                  <div key={sub.id} className="flex items-center justify-between gap-1 bg-zinc-950/20 p-1.5 rounded border border-transparent hover:border-zinc-900">
                                                    <label className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1">
                                                      <input 
                                                        type="checkbox"
                                                        checked={sub.completed}
                                                        onChange={() => handleToggleSubTask(phase.id, act.id, act, sub.id)}
                                                        className="rounded bg-zinc-950 border-zinc-800 text-cyan-400 focus:ring-0 w-3 h-3 cursor-pointer shrink-0"
                                                      />
                                                      <span className={`truncate text-[9.5px] ${sub.completed ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                                                        {sub.name}
                                                      </span>
                                                    </label>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleRemoveSubTask(phase.id, act.id, act, sub.id)}
                                                      className="text-zinc-650 hover:text-rose-400 p-0.5 rounded"
                                                    >
                                                      <X className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-[8.5px] text-zinc-600 font-sans italic py-1 text-center">
                                                No daily checkpoints defined for this task. Set up milestones below.
                                              </p>
                                            )}

                                            {/* Add subtask trigger */}
                                            <div className="flex gap-1 mt-2">
                                              <input 
                                                type="text" 
                                                placeholder="Add daily checkpoint e.g. Camera lenses recalibrated"
                                                value={newSubTaskNames[act.id] || ''}
                                                id={`subtask-input-${act.id}`}
                                                onChange={(e) => setNewSubTaskNames(prev => ({ ...prev, [act.id]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddSubTask(phase.id, act.id, act);
                                                  }
                                                }}
                                                className="flex-1 bg-zinc-950 border border-zinc-850 rounded-lg px-2 py-1 text-zinc-350 text-[9px] focus:outline-none focus:border-cyan-500 font-mono"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleAddSubTask(phase.id, act.id, act)}
                                                className="px-2 py-1 bg-zinc-900 border border-zinc-800 hover:text-white hover:border-cyan-550/40 text-zinc-400 rounded-lg text-[9px] font-bold"
                                              >
                                                ADD
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[9.5px] text-zinc-605 italic text-center py-4 text-zinc-550">
                                No checklist checkpoints. Add some tasks below!
                              </p>
                            )}

                            {/* Add checklist item */}
                            <form 
                              onSubmit={(e) => handleAddActivitySubmit(e, phase.id)}
                              className="flex gap-1.5 pt-1"
                            >
                              <input 
                                type="text"
                                placeholder="..."
                                required
                                value={newActNames[phase.id] || ''}
                                id={`task-input-${phase.id}`}
                                onChange={(e) => setNewActNames(prev => ({ ...prev, [phase.id]: e.target.value }))}
                                className={`flex-1 border rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 font-mono text-[9.5px] ${
                                  isDark ? 'bg-[#030408] text-zinc-200 border-zinc-850' : 'bg-white text-zinc-900 border-zinc-200 shadow-inner'
                                }`}
                              />
                              <button
                                type="submit"
                                className={`px-2.5 py-1 text-[9.5px] uppercase font-mono font-bold border rounded-lg transition-all flex items-center justify-center gap-1 ${
                                  isDark 
                                    ? 'bg-zinc-900 border-zinc-800 text-cyan-400 hover:border-cyan-500/40 hover:text-white' 
                                    : 'bg-zinc-150 border-zinc-250 text-indigo-700 hover:bg-zinc-200'
                                }`}
                              >
                                <Plus className="w-3 h-3 shrink-0" />
                                Task
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add form footer inside column */}
              <div className="pt-4 border-t border-zinc-900/40 mt-3 flex flex-col">
                {isAdding ? (
                  <div className={`space-y-3 p-3.5 border rounded-xl animate-fade-in ${
                    isDark ? 'bg-zinc-950/45 border-zinc-900' : 'bg-slate-50 border-slate-250'
                  }`}>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-zinc-500 block uppercase">Sub-Phase Label Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Director Scouting Trip"
                        value={newPhaseName[module.key]}
                        id={`wizard-phase-name-${module.key}`}
                        onChange={(e) => setNewPhaseName(prev => ({ ...prev, [module.key]: e.target.value }))}
                        className={`w-full border rounded-lg px-2.5 py-1.5 font-sans focus:outline-none focus:border-cyan-500 text-xs ${
                          isDark ? 'bg-black text-zinc-200 border-zinc-800' : 'bg-white border-zinc-200'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-zinc-500 block uppercase">Allotted Span Duration (Days)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="90"
                          value={newPhaseDays[module.key]}
                          onChange={(e) => setNewPhaseDays(prev => ({ ...prev, [module.key]: parseInt(e.target.value) || 7 }))}
                          className="flex-1 accent-cyan-400 block h-2 bg-zinc-900 rounded"
                        />
                        <span className="font-mono text-cyan-400 font-extrabold text-xs shrink-0">{newPhaseDays[module.key]} days</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1 font-mono text-[9px] font-extrabold uppercase">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(prev => ({ ...prev, [module.key]: false }))}
                        className={`flex-1 py-1 px-2 border rounded-md border-transparent text-zinc-500 text-center`}
                      >
                        ABORT
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddPhaseSubmit(module.key)}
                        className={`flex-1 py-1.5 px-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-md text-center shadow-md`}
                      >
                        LAUNCH
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(prev => ({ ...prev, [module.key]: true }))}
                    className={`w-full py-2 bg-zinc-950/60 border border-zinc-900 hover:border-indigo-500/25 ${module.color} font-mono text-[9px] font-extrabold uppercase tracking-widest rounded-xl transition duration-300 flex items-center justify-center gap-2 cursor-pointer`}
                    id={`btn-trigger-add-${module.key}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    CREATE NESTED SUB-PHASE
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
