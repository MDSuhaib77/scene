import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Info,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { FilmProject } from '../../../types';
import type { VisualizeWorkspaceId } from '../types';
import type {
  WorkflowAssistantResponse,
  WorkflowTargetArea,
} from '../services/visualizeWorkflowAssistantService';
import { runVisualiseWorkflowAssistantQuery } from '../services/visualizeWorkflowAssistantService';

interface VisualizeWorkflowAssistantDrawerProps {
  isOpen: boolean;
  project: FilmProject;
  onClose: () => void;
  onNavigateWorkspace: (area: VisualizeWorkspaceId) => void;
  onNavigateVault: () => void;
}

const QUICK_WORKFLOW_PROMPTS = [
  'Audit missing links and inconsistencies across all Visualise records',
  'Locate shots missing camera setups or scene links',
  'Check unused or broken Vault references across Boards and Storyboards',
  'Check Camera Setup assignments and spec mismatches',
];

function areaToWorkspace(area: WorkflowTargetArea): VisualizeWorkspaceId | 'vault' {
  if (area === 'storyboards') return 'storyboards';
  if (area === 'shot-lists' || area === 'camera-setups') return 'shot-lists';
  if (area === 'boards') return 'boards';
  return 'vault';
}

export const VisualizeWorkflowAssistantDrawer: React.FC<
  VisualizeWorkflowAssistantDrawerProps
> = ({ isOpen, project, onClose, onNavigateWorkspace, onNavigateVault }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<WorkflowAssistantResponse | null>(null);

  useEffect(() => {
    setResponse(null);
  }, [project.id]);

  if (!isOpen) return null;

  const executeQuery = (text: string) => {
    const targetQuery = text.trim() || QUICK_WORKFLOW_PROMPTS[0];
    setQuery(targetQuery);
    const result = runVisualiseWorkflowAssistantQuery(project, targetQuery);
    setResponse(result);
  };

  const handleJump = (area: WorkflowTargetArea) => {
    const dest = areaToWorkspace(area);
    if (dest === 'vault') onNavigateVault();
    else onNavigateWorkspace(dest);
  };

  return (
    <aside
      data-testid="visualize-workflow-assistant-drawer"
      className="fixed top-[57px] bottom-0 right-0 z-40 w-full sm:w-[430px] border-l border-white/[0.1] bg-[#0f131b] shadow-2xl flex flex-col overflow-hidden select-text"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.08] bg-[#131823] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-100">
            <ShieldCheck className="w-4 h-4 text-yellow-400" />
            <span>Visualise Workflow Check</span>
          </div>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">
            Read-only deterministic record lookup & consistency checks
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close workflow check"
          data-testid="workflow-assistant-close-btn"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Query Form + Quick Prompts */}
      <div className="p-4 border-b border-white/[0.06] bg-[#0b0e14] space-y-3 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeQuery(query);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="workflow-assistant-input"
              placeholder="Search panels, shots, setups, boards, Vault links..."
              className="w-full rounded-lg border border-white/10 bg-[#0A0B0D] border border-[#FFD34E]/25 pl-8 pr-2.5 py-1.5 text-xs text-amber-100 placeholder:text-amber-200/40 focus:outline-none focus:border-[#F5F000]/60"
            />
          </div>
          <button
            type="submit"
            data-testid="workflow-assistant-run-btn"
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#F5F000] via-[#FFD34E] to-[#F5A623] text-stone-950 font-bold shadow-[0_0_10px_rgba(245,240,0,0.3)] hover:bg-[#FFF1A8] text-xs font-semibold cursor-pointer shrink-0 inline-flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Inspect
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_WORKFLOW_PROMPTS.map((prompt, idx) => (
            <button
              key={prompt}
              type="button"
              data-testid={`workflow-quick-prompt-${idx}`}
              onClick={() => executeQuery(prompt)}
              className="px-2 py-1 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-[10px] text-slate-300 text-left cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Results Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs">
        {!response && (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#121620]/60 p-5 text-center space-y-2">
            <Info className="w-5 h-5 text-yellow-400 mx-auto" />
            <p className="text-slate-300 font-medium">On-Demand Workflow Verification</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Click <strong>Inspect</strong> or select a check above to scan{' '}
              <span className="text-slate-200">{project.title}</span> for missing scene links, broken Vault assets, unused Camera Setups, or cross-record mismatches.
            </p>
          </div>
        )}

        {response && (
          <div data-testid="workflow-assistant-results" className="space-y-4">
            {/* 1. Confirmed Facts */}
            <div
              data-testid="workflow-confirmed-facts"
              className="rounded-xl border border-emerald-400/20 bg-emerald-950/15 p-3 space-y-1.5"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmed Project Facts
              </div>
              {response.groundedOverviewLines.map((line, i) => (
                <p key={i} className="text-[11px] text-slate-200 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>

            {/* 2. Detected Issues & Inconsistencies */}
            <div data-testid="workflow-detected-issues" className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-300 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Detected Issues & Missing Links ({response.matchedIssues.length})
              </div>

              {response.matchedIssues.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-[#121620] px-3 py-2.5 text-[11px] text-slate-400">
                  No inconsistencies or missing references matched in current records.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {response.matchedIssues.map((issue) => (
                    <div
                      key={issue.id}
                      data-testid={`workflow-issue-${issue.code}`}
                      className="rounded-lg border border-white/[0.08] bg-[#131823] p-2.5 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-amber-100 text-[11px]">
                          {issue.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleJump(issue.area)}
                          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-yellow-300 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {issue.area}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">{issue.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Matched Records */}
            <div data-testid="workflow-matched-records" className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Matched Existing Records ({response.matchedRecords.length})
              </div>
              {response.matchedRecords.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-[#121620] px-3 py-2 text-[11px] text-slate-500">
                  No existing records matched that search filter.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {response.matchedRecords.map((rec) => (
                    <div
                      key={`${rec.area}-${rec.id}`}
                      className="rounded-lg border border-white/[0.07] bg-[#141005]/90 border-b border-[#FFD34E]/25 px-2.5 py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-amber-100 truncate">
                          {rec.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{rec.meta}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJump(rec.area)}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-slate-300 shrink-0 cursor-pointer"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Uncertainties / Unavailable Information */}
            {response.audit.uncertainties.length > 0 && (
              <div
                data-testid="workflow-uncertainties"
                className="rounded-xl border border-white/10 bg-[#11141c] p-3 space-y-1"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Unavailable Information / Context Limits
                </div>
                {response.audit.uncertainties.map((u, idx) => (
                  <p key={idx} className="text-[11px] text-slate-400 leading-relaxed">
                    {u}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
