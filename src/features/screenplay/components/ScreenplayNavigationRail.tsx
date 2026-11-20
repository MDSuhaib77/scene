import React from 'react';
import {
  Files,
  Upload,
  FilePlus2,
  BookOpen,
  Clapperboard,
  LayoutDashboard,
} from 'lucide-react';

export type ScreenplayPanelSection = 'outline' | 'drafts' | 'revisions' | 'upload';

export interface ScreenplayNavigationRailProps {
  activeSection: ScreenplayPanelSection | null;
  isPanelOpen: boolean;
  onSelectSection: (section: ScreenplayPanelSection) => void;
  onNewBlankDraft: () => void;
  onLoadSampleScript: () => void;
  onNavigateTab?: (tab: string) => void;
  versionCount: number;
}

export const ScreenplayNavigationRail: React.FC<ScreenplayNavigationRailProps> = ({
  activeSection,
  isPanelOpen,
  onSelectSection,
  onNewBlankDraft,
  onLoadSampleScript,
  onNavigateTab,
  versionCount,
}) => {
  return (
    <nav
      aria-label="Screenplay tools rail"
      data-testid="screenplay-navigation-rail"
      className="w-12 shrink-0 h-full flex flex-col items-center justify-between py-3 select-none border-r border-cyan-500/15 z-20 bg-[#080b18]/85 backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-2 w-full px-1.5">
        <button
          type="button"
          onClick={() => onSelectSection('drafts')}
          aria-label="Project screenplay drafts"
          aria-expanded={isPanelOpen && activeSection === 'drafts'}
          title={`Project Drafts (${versionCount})`}
          data-testid="screenplay-rail-drafts-btn"
          className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            isPanelOpen && activeSection === 'drafts'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'text-[#9ba3b4] hover:text-cyan-200 hover:bg-cyan-500/10 border border-transparent'
          }`}
        >
          <Files className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('upload')}
          aria-label="Import script file"
          aria-expanded={isPanelOpen && activeSection === 'upload'}
          title="Import Script (.fountain / .txt)"
          data-testid="screenplay-rail-upload-btn"
          className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            isPanelOpen && activeSection === 'upload'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'text-[#9ba3b4] hover:text-cyan-200 hover:bg-cyan-500/10 border border-transparent'
          }`}
        >
          <Upload className="w-4 h-4" />
        </button>

        <div
          className="w-5 h-px my-1"
          style={{ backgroundColor: 'var(--scr-border)' }}
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={onNewBlankDraft}
          aria-label="Start new blank page"
          title="New Blank Page"
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#9ba3b4] hover:text-white hover:bg-white/[0.06] transition-colors focus-ring-cinema"
        >
          <FilePlus2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onLoadSampleScript}
          aria-label="Load formatted sample scene"
          title="Load Sample Scene"
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#9ba3b4] hover:text-white hover:bg-white/[0.06] transition-colors focus-ring-cinema"
        >
          <BookOpen className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom real workspace destinations */}
      {onNavigateTab && (
        <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
          <div
            className="w-5 h-px my-1"
            style={{ backgroundColor: 'var(--scr-border)' }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => onNavigateTab('breakdown')}
            aria-label="Go to Scene Breakdown"
            title="Scene Breakdown"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#9ba3b4] hover:text-white hover:bg-white/[0.06] transition-colors focus-ring-cinema"
          >
            <Clapperboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('overview')}
            aria-label="Go to Project Overview"
            title="Project Overview"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#9ba3b4] hover:text-white hover:bg-white/[0.06] transition-colors focus-ring-cinema"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        </div>
      )}
    </nav>
  );
};
