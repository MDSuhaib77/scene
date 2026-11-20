/**
 * SceneOS — Help & Documentation Modal
 * 
 * Provides production crew with immediate reference guides, workflow documentation,
 * keyboard shortcuts, and support links.
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  Keyboard,
  Shield,
  MessageSquare,
  FileText,
  ExternalLink,
  X,
  Sparkles,
  Layers,
  ChevronRight,
  LifeBuoy
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'shortcuts' | 'workflow' | 'support'>('quickstart');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-[#0B0E17] border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col h-[80vh] max-h-[640px] overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-zinc-850 flex items-center justify-between shrink-0 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-900 to-indigo-900 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold">
              <LifeBuoy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                SCENE Help & Documentation
              </h2>
              <p className="text-[11px] text-zinc-400">
                Studio reference guides, keyboard shortcuts, and workflow manuals
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer"
            aria-label="Close Help"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-zinc-850 bg-zinc-950/40 px-4 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('quickstart')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'quickstart'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Quick Start Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Keyboard Shortcuts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'workflow'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Production Workflow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('support')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'support'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Support & Verification
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'quickstart' && (
            <div className="space-y-4 text-xs text-zinc-300">
              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1.5">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-[10px]">1</span>
                  Screenplay Ingestion & Automated Eighths
                </h4>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Navigate to <strong>Screenplay</strong> to drag-and-drop your script (.FDX, .FOUNTAIN, or PDF). SCENE parses character dialogue and calculates scene lengths in industry-standard 1/8th increments.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1.5">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-[10px]">2</span>
                  Multi-Department Breakdown
                </h4>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Open <strong>Breakdown</strong> to tag Cast, Extras, Props, Wardrobe, Vehicles, and Stunts per scene. Elements link directly to shooting schedule requirements.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1.5">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-[10px]">3</span>
                  Production Stripboard & Daily Operations
                </h4>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Under <strong>Production</strong>, organize scenes onto shooting days via the Stripboard, generate Call Sheets, and log Daily Production Reports (DPR).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1.5">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-950 border border-purple-500/30 text-purple-400 flex items-center justify-center text-[10px]">4</span>
                  Realtime Multi-User Collaboration
                </h4>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Use the top navigation bar to invite crew members (<strong>People</strong>), start contextual threads on records (<strong>Discussions</strong>), and track activity (<strong>Activity</strong>).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                  <span className="text-zinc-300">Close open drawers / modals</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">Esc</kbd>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                  <span className="text-zinc-300">Toggle Command Search</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">⌘ / Ctrl + K</kbd>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                  <span className="text-zinc-300">Hard Refresh UI Cache</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">Ctrl + F5</kbd>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between">
                  <span className="text-zinc-300">Mention Member in Chat</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">@</kbd>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="space-y-3 text-xs text-zinc-400 leading-relaxed">
              <p>
                SCENE enforces strict film industry governance based on union standards (SAG-AFTRA turnaround rules, FWICE 12-hour turnaround buffers, and mandatory rest periods).
              </p>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1">
                <h5 className="font-semibold text-white">Call Sheet Approval Cycle</h5>
                <p className="text-[11px]">
                  1st AD drafts Call Sheet ➔ Producer approves and publishes ➔ Instant notifications dispatched to cast and crew directory members.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1">
                <h5 className="font-semibold text-white">DPR Wrap Workflow</h5>
                <p className="text-[11px]">
                  End-of-day logging of scenes shot, pages completed, camera rolls, and meal penalties ➔ Locked for Producer sign-off.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-2">
                <h4 className="font-semibold text-white">Production Technical Support</h4>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  For database synchronization, custom studio deployment, or production server integration assistance:
                </p>
                <div className="pt-1">
                  <span className="text-indigo-400 font-mono text-xs">support@sceneos.studio</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-850 text-[10px] text-zinc-500 font-mono">
                SCENE Build v0.2.0 · Supabase Realtime v2 Engine Active
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
