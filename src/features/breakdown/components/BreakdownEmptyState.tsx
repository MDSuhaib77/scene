import React from 'react';
import { FileText, ArrowRight, Sparkles, Layers } from 'lucide-react';

interface BreakdownEmptyStateProps {
  isDark?: boolean;
  onNavigateTab: (tab: string) => void;
}

export const BreakdownEmptyState: React.FC<BreakdownEmptyStateProps> = ({
  isDark = true,
  onNavigateTab,
}) => {
  return (
    <div
      data-testid="breakdown-empty-state"
      className={`p-10 sm:p-12 rounded-3xl border text-center max-w-2xl mx-auto my-12 transition-all relative overflow-hidden ${
        isDark
          ? 'bg-gradient-to-b from-[#051a11]/90 via-[#03130c]/90 to-[#020b06]/95 backdrop-blur-2xl border-emerald-500/30 text-slate-200 shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_40px_rgba(16,185,129,0.18)]'
          : 'bg-white border-emerald-200 text-slate-700 shadow-xl'
      }`}
    >
      {/* Decorative ambient top glow */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-lime-500/10 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mx-auto mb-5 shadow-[0_0_24px_rgba(16,185,129,0.3)]">
          <Layers className="w-8 h-8 text-emerald-400" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono uppercase tracking-wider mb-4 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
          <Sparkles className="w-3.5 h-3.5 text-lime-400" />
          <span>No Screenplay Scenes Extracted</span>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight mb-2.5">
          Production Breakdown Awaits Script Extraction
        </h2>

        <p className="text-sm text-slate-300/90 leading-relaxed max-w-lg mx-auto mb-7">
          Production breakdowns and the Element Master Catalog are built directly from
          real screenplay scenes extracted by Script Intelligence. To begin tagging cast,
          props, wardrobe, and vehicles, author or import a script in the Screenplay module.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('screenplay')}
            data-testid="breakdown-empty-open-screenplay-btn"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_24px_rgba(16,185,129,0.45)] hover:shadow-[0_0_36px_rgba(16,185,129,0.65)] hover:scale-[1.02]"
          >
            <FileText className="w-4 h-4 text-slate-950" />
            <span>Open Screenplay Studio</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-emerald-500/20 flex items-center justify-center gap-6 text-[11px] font-mono text-emerald-400/90">
          <span>✓ Zero fake data</span>
          <span className="text-emerald-500/40">•</span>
          <span>✓ 100% Traceable to Screenplay</span>
          <span className="text-emerald-500/40">•</span>
          <span>✓ Master Element Catalog</span>
        </div>
      </div>
    </div>
  );
};
