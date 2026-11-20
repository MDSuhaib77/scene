/**
 * SceneOS — Project Switcher Modal
 * Enables swift switching between multi-production workspaces with query scoping.
 */

import React, { useState } from 'react';
import { Film, Check, Plus, Search, Calendar, DollarSign, Users, X } from 'lucide-react';
import { useProject } from './ProjectContext';
import { ProjectDomainModel } from '../../services/contracts/types';

interface ProjectSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreate: () => void;
}

export function ProjectSwitcherModal({ isOpen, onClose, onOpenCreate }: ProjectSwitcherModalProps) {
  const { projects, activeProject, switchProject } = useProject();
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.director && p.director.toLowerCase().includes(search.toLowerCase())) ||
    (p.producer && p.producer.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusBadge = (status: ProjectDomainModel['status']) => {
    switch (status) {
      case 'pre-production':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60';
      case 'production':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60';
      case 'post-production':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'wrapped':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      case 'archived':
        return 'bg-zinc-900 text-zinc-500 border-zinc-800';
      default:
        return 'bg-slate-900 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0B0E17] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Production Slate</h2>
              <p className="text-xs text-slate-400">Switch workspace or initialize a new project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 border-b border-slate-800/50 flex gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by title, director, or producer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            onClick={() => {
              onClose();
              onOpenCreate();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition cursor-pointer shrink-0 shadow-lg shadow-cyan-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>New Production</span>
          </button>
        </div>

        {/* Project List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-800/30">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No productions matched "{search}".
            </div>
          ) : (
            filtered.map(proj => {
              const isActive = activeProject?.id === proj.id;
              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    switchProject(proj.id);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isActive
                      ? 'bg-cyan-950/20 border-cyan-500/50 shadow-md shadow-cyan-950/30'
                      : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/50'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100 group-hover:text-cyan-300 transition">
                        {proj.title}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-mono font-medium ${getStatusBadge(proj.status)}`}>
                        {proj.status}
                      </span>
                    </div>

                    {proj.logline && (
                      <p className="text-xs text-slate-400 line-clamp-1 font-sans">
                        {proj.logline}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono pt-1">
                      {proj.targetStartDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {proj.targetStartDate}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        {proj.memberCount || 1} Crew
                      </span>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono shrink-0">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition shrink-0">
                      Switch $\rightarrow$
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
