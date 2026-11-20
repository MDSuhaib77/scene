import React, { useState, useMemo } from 'react';
import {
  Film,
  Calendar as CalendarIcon,
  Users,
  MessageSquare,
  Activity as ActivityIcon,
  Inbox,
  ArrowLeft,
  Pencil,
  Sparkles,
  MapPin,
  Clapperboard,
  Crosshair,
  Zap,
  Heart,
  Smile,
  Video,
  Search,
  Shield,
  Flame,
} from 'lucide-react';
import type { FilmProject } from '../../../types';
import { useProject } from '../../projects/ProjectContext';
import { getProductionOperationalStore } from '../../production/services/productionStoreService';
import { getVaultStore } from '../../vault/services/vaultMediaService';
import { EditProductionMetadataModal, canEditProductionMetadata } from '../../../components/overview/EditProductionMetadataModal';

// Modular Home & Workspace Cards
import { CoreModulesGrid } from './CoreModulesGrid';
import { VaultVideoPlayerCard } from './VaultVideoPlayerCard';
import { VaultAudioPlayerCard } from './VaultAudioPlayerCard';
import { ExpandedInboxView } from './ExpandedInboxView';
import { ExpandedActivityView } from './ExpandedActivityView';
import { ExpandedPeopleView } from './ExpandedPeopleView';
import { ExpandedDiscussionsView } from './ExpandedDiscussionsView';

export type CollaborationDestination = 'inbox' | 'activity' | 'people' | 'discussions';

export interface CollaborationHomeProps {
  project: FilmProject;
  simulatedDate?: string;
  onSetSimulatedDate?: (date: string) => void;
  metrics?: any;
  isDark?: boolean;
  onNavigateTab?: (tab: string, context?: any) => void;
  onToggleActivity?: (phaseId: string, activityId: string) => void;
  onUpdateProjectMeta: (updates: Partial<FilmProject>) => void;
  userRole: string;
  initialDestination?: CollaborationDestination | null;
  activeDestination?: 'home' | CollaborationDestination;
  onSelectDestination?: (dest: 'home' | CollaborationDestination) => void;
  onOpenTeamModal?: () => void;
}

// -----------------------------------------------------------------------------
// Genre Metadata & Accent Styling
// -----------------------------------------------------------------------------
interface GenreMeta {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeClass: string;
}

const GENRE_REGISTRY: Record<string, GenreMeta> = {
  drama: { label: 'Drama', icon: Clapperboard, accentColor: '#f59e0b', badgeClass: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  thriller: { label: 'Thriller', icon: Crosshair, accentColor: '#f43f5e', badgeClass: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  'science fiction': { label: 'Science Fiction', icon: Sparkles, accentColor: '#06b6d4', badgeClass: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' },
  'sci-fi': { label: 'Science Fiction', icon: Sparkles, accentColor: '#06b6d4', badgeClass: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' },
  action: { label: 'Action', icon: Zap, accentColor: '#f97316', badgeClass: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  romance: { label: 'Romance', icon: Heart, accentColor: '#ec4899', badgeClass: 'text-pink-300 border-pink-500/30 bg-pink-500/10' },
  comedy: { label: 'Comedy', icon: Smile, accentColor: '#10b981', badgeClass: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  documentary: { label: 'Documentary', icon: Video, accentColor: '#0ea5e9', badgeClass: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
  mystery: { label: 'Mystery', icon: Search, accentColor: '#a855f7', badgeClass: 'text-purple-300 border-purple-500/30 bg-purple-500/10' },
  crime: { label: 'Crime', icon: Shield, accentColor: '#ef4444', badgeClass: 'text-red-400 border-red-500/30 bg-red-500/10' },
  horror: { label: 'Horror', icon: Flame, accentColor: '#dc2626', badgeClass: 'text-red-500 border-red-600/30 bg-red-600/10' },
};

function resolveProjectGenre(project: FilmProject): GenreMeta {
  const explicit = ((project as any).genre || (project as any).genres?.[0] || '').toLowerCase().trim();
  if (explicit && GENRE_REGISTRY[explicit]) {
    return GENRE_REGISTRY[explicit];
  }
  const corpus = `${project.title || ''} ${project.logline || ''}`.toLowerCase();
  if (corpus.includes('cyberpunk') || corpus.includes('synthetic') || corpus.includes('sci-fi') || corpus.includes('space')) {
    return GENRE_REGISTRY['science fiction'];
  }
  if (corpus.includes('heist') || corpus.includes('detective') || corpus.includes('conspiracy') || corpus.includes('shadow')) {
    return GENRE_REGISTRY['thriller'];
  }
  if (corpus.includes('comedy') || corpus.includes('humor')) return GENRE_REGISTRY['comedy'];
  if (corpus.includes('romance') || corpus.includes('love')) return GENRE_REGISTRY['romance'];
  if (corpus.includes('action') || corpus.includes('war')) return GENRE_REGISTRY['action'];
  return GENRE_REGISTRY['drama'];
}

export function CollaborationHome({
  project,
  simulatedDate,
  isDark = true,
  onNavigateTab,
  onUpdateProjectMeta,
  userRole,
  initialDestination = null,
  activeDestination,
  onSelectDestination,
  onOpenTeamModal,
}: CollaborationHomeProps) {
  const {
    members = [],
    discussionUnreadCount = 0,
    notificationUnreadCount = 0,
  } = useProject();

  // State A (Production Home: 'home') vs State B (Expanded Workspace: 'inbox' | 'activity' | 'people' | 'discussions')
  const [localWorkspaceState, setLocalWorkspaceState] = useState<'home' | CollaborationDestination>(
    initialDestination || 'home'
  );

  const workspaceState = activeDestination !== undefined ? activeDestination : localWorkspaceState;
  const setWorkspaceState = (dest: 'home' | CollaborationDestination) => {
    setLocalWorkspaceState(dest);
    onSelectDestination?.(dest);
  };

  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const isAuthorized = canEditProductionMetadata(userRole);

  // Authoritative Stores
  const operationalStore = useMemo(() => getProductionOperationalStore(project), [project]);
  const vaultStore = useMemo(() => getVaultStore(project), [project]);
  const genreMeta = useMemo(() => resolveProjectGenre(project), [project]);
  const GenreIcon = genreMeta.icon;

  const productionType = project.productionType || 'Feature Film';

  // Active production phase
  const activePhase = useMemo(() => {
    return (
      project.phases?.find((p) => p.status === 'in_progress') ||
      project.phases?.find((p) => p.category === 'prod') ||
      project.phases?.[0]
    );
  }, [project.phases]);

  const activePhaseName = activePhase?.name || 'Principal Photography';

  // Target Release Date
  const targetReleaseDate = useMemo(() => {
    const raw = project.finalEndDate || project.suggestedEndDate || project.targetWrapDate;
    if (!raw) return null;
    const d = new Date(raw + 'T12:00:00');
    return !isNaN(d.getTime())
      ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : raw;
  }, [project.finalEndDate, project.suggestedEndDate, project.targetWrapDate]);

  return (
    <div
      data-testid="collaboration-home-root"
      className="w-full flex-1 flex flex-col min-h-0 select-none overflow-y-auto overflow-x-hidden p-2.5 sm:p-3.5 lg:p-4 text-slate-100 font-sans space-y-2.5"
      style={{
        background: `
          radial-gradient(1100px circle at 8% 12%, rgba(6, 182, 212, 0.08), transparent 45%),
          radial-gradient(1000px circle at 92% 18%, rgba(168, 85, 247, 0.08), transparent 45%),
          radial-gradient(800px circle at 50% 90%, rgba(245, 158, 11, 0.05), transparent 55%),
          linear-gradient(180deg, #070A12 0%, #060910 50%, #05070D 100%)
        `,
      }}
    >
      {/* -------------------------------------------------------------------
          TOP NAVIGATION BAR
          Clean layout: Back button when expanded; Edit Details on right
         ------------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-3 shrink-0 min-h-[32px]">
        {/* Left: Back to Home trigger (Shown only in State B) */}
        <div>
          {workspaceState !== 'home' ? (
            <button
              type="button"
              onClick={() => setWorkspaceState('home')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-white text-xs font-semibold backdrop-blur-md shadow-sm transition transform hover:-translate-x-0.5 cursor-pointer"
              title="Return to Production Home"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>← Production Home</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Right: Edit Details trigger (Shown only in State A) */}
        <div>
          {isAuthorized && workspaceState === 'home' && (
            <button
              type="button"
              onClick={() => setIsMetadataModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition cursor-pointer"
              title="Edit production identity & details"
            >
              <Pencil className="w-3 h-3 text-cyan-400" />
              <span className="text-[11px]">Edit Details</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================
          STATE B: EXPANDED COLLABORATION WORKSPACE
         =================================================================== */}
      {workspaceState === 'inbox' && (
        <ExpandedInboxView
          onNavigateToRecord={(category, entityId) => {
            if (category === 'production' || category === 'shoot') onNavigateTab?.('production');
            else if (category === 'vault') onNavigateTab?.('vault');
            else if (category === 'discussion') setWorkspaceState('discussions');
          }}
        />
      )}

      {workspaceState === 'activity' && (
        <ExpandedActivityView
          onNavigateToActivity={(act) => {
            if (act.entityType === 'discussion' || act.entityType === 'thread') setWorkspaceState('discussions');
            else if (act.entityType === 'vault') onNavigateTab?.('vault');
            else onNavigateTab?.('production');
          }}
        />
      )}

      {workspaceState === 'people' && (
        <ExpandedPeopleView onOpenTeamModal={onOpenTeamModal} />
      )}

      {workspaceState === 'discussions' && (
        <ExpandedDiscussionsView />
      )}

      {/* ===================================================================
          STATE A: PRODUCTION HOME (Zero Wasted Space, Connected Gradients)
         =================================================================== */}
      {workspaceState === 'home' && (
        <div className="space-y-3 flex-1 min-h-0">
          {/* 1. CINEMATIC HERO BANNER (Connected Genre Gradient) */}
          <section
            aria-labelledby="home-project-identity-title"
            className="px-5 py-3.5 sm:px-6 sm:py-4 rounded-2xl bg-gradient-to-br from-[#0C1524]/90 via-[#0A101C]/95 to-[#070B13]/95 backdrop-blur-2xl border border-cyan-500/25 shadow-[0_8px_32px_rgba(6,182,212,0.1)] relative overflow-hidden group hover:border-cyan-500/40 transition-all"
          >
            <div
              className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-30"
              style={{ background: `radial-gradient(circle, ${genreMeta.accentColor}35, transparent 70%)` }}
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left: Title, Badges & Logline */}
              <div className="space-y-1 min-w-0 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${genreMeta.badgeClass}`}>
                    <GenreIcon className="w-2.5 h-2.5" />
                    <span>{genreMeta.label}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-white/[0.04] border-white/10 text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{project.status === 'paused' ? 'Paused' : 'Active'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-white/[0.04] border-white/10 text-cyan-300">
                    <Film className="w-2.5 h-2.5 text-cyan-400" />
                    <span>{activePhaseName}</span>
                  </span>
                </div>

                <h1
                  id="home-project-identity-title"
                  className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans truncate"
                >
                  {project.title}
                </h1>

                {project.logline && (
                  <p className="text-xs text-slate-300/90 italic font-serif line-clamp-1 border-l-2 border-cyan-500/40 pl-2.5">
                    "{project.logline}"
                  </p>
                )}
              </div>

              {/* Right: Key Chips in Connected Minimalist Stack */}
              <div className="flex flex-wrap lg:flex-col lg:items-end gap-1.5 text-[11px] font-mono text-slate-300 shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.06] pt-2 lg:pt-0 lg:pl-5">
                {targetReleaseDate && (
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <CalendarIcon className="w-3 h-3 text-amber-400" />
                    <span>Release: <strong className="text-white">{targetReleaseDate}</strong></span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-slate-400">
                  {project.director && project.director !== 'Unassigned' && (
                    <span>Dir: <strong className="text-slate-200">{project.director}</strong></span>
                  )}
                  {project.producer && project.producer !== 'Unassigned' && (
                    <span>Prod: <strong className="text-slate-200">{project.producer}</strong></span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  {project.primaryLocation && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-rose-400" />
                      <span>{project.primaryLocation}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Film className="w-2.5 h-2.5" />
                    <span>{productionType}</span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. CORE INTERACTION ROW (6 cols 4 Module Squares in 2x2 Grid / 6 cols Video Dailies) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* 4 Core Module Squares in 2x2 Grid (6 cols) */}
            <div className="lg:col-span-6">
              <CoreModulesGrid
                project={project}
                operationalStore={operationalStore}
                simulatedDate={simulatedDate}
                onNavigateTab={onNavigateTab}
                isDark={isDark}
              />
            </div>

            {/* Latest Video Dailies — Automatic Playback (6 cols) */}
            <div className="lg:col-span-6">
              <VaultVideoPlayerCard
                assets={vaultStore.assets}
                productionId={project.id}
                onNavigateTab={onNavigateTab}
                isDark={isDark}
              />
            </div>
          </div>

          {/* 3. SLEEK HORIZONTAL RECTANGULAR AUDIO DECK (Full Width) */}
          <div className="w-full">
            <VaultAudioPlayerCard
              assets={vaultStore.assets}
              productionId={project.id}
              onNavigateTab={onNavigateTab}
              isDark={isDark}
            />
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------
          PRODUCTION METADATA MODAL (For Title, Leads, Location, Details)
         ------------------------------------------------------------------- */}
      {isMetadataModalOpen && (
        <EditProductionMetadataModal
          project={project}
          isOpen={isMetadataModalOpen}
          onClose={() => setIsMetadataModalOpen(false)}
          onSave={onUpdateProjectMeta}
          userRole={userRole}
          initialFocusedField="title"
        />
      )}
    </div>
  );
}
