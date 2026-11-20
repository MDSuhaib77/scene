import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clapperboard, Lock, Users } from 'lucide-react';
import type { Activity, CrewMember, FilmPhase, FilmProject } from '../../../types';
import type { ProjectRole } from '../../../types/database.types';
import type { DiscussionRecordTarget } from '../../../services/contracts/types';
import { hasPermission } from '../../../services/rbac/permissions';
import {
  PRODUCTION_SECTIONS,
  getProductionOperationalStore,
  normalizeProductionSectionId,
} from '../services/productionStoreService';
import type { ProductionSectionId } from '../types';
import { CalendarSubView, ProductionCalendarView } from './ProductionCalendarView';
import { ProductionShootView } from './ProductionShootView';
import { ProductionDirectoryView } from './ProductionDirectoryView';

export interface ProductionWorkspaceProps {
  project: FilmProject;
  simulatedDate: string;
  isDark: boolean;
  theme: any;
  activeRole?: ProjectRole | null;
  projectMembers?: Array<{ fullName: string }>;
  initialSubmodule?: string;
  initialCalendarSubView?: CalendarSubView;
  onUpdateProject?: (updated: FilmProject) => void;
  onSetSimulatedDate: (d: string) => void;
  onAddActivity: (phaseId: string, name: string) => void;
  onAddActivityWithDetails: (phaseId: string, activity: Activity) => void;
  onRemoveActivity: (phaseId: string, activityId: string) => void;
  onUpdateActivity: (phaseId: string, activityId: string, data: Partial<Activity>) => void;
  onAdjustPhaseDays?: (phaseId: string, days: number) => void;
  onUpdatePhase?: (phaseId: string, data: Partial<FilmPhase>) => void;
  onMovePhaseUp?: (idx: number) => void;
  onMovePhaseDown?: (idx: number) => void;
  onDeletePhase?: (phaseId: string) => void;
  onAddPhase?: (category: 'pre' | 'prod' | 'post', name: string, durationDays: number) => void;
  onAddCrew: (phaseId: string, member: Omit<CrewMember, 'id'>) => void;
  onDeleteCrew: (phaseId: string, crewId: string) => void;
  onUpdateCrewStatus: (phaseId: string, crewId: string, status: CrewMember['status']) => void;
  onNavigateTab: (tabId: string, submodule?: string) => void;
  onOpenDiscussion?: (target: DiscussionRecordTarget) => void;
}

const SECTION_ICONS: Record<
  ProductionSectionId,
  React.ComponentType<{ className?: string }>
> = {
  calendar: CalendarIcon,
  shoot: Clapperboard,
  directory: Users,
};

export const ProductionWorkspace: React.FC<ProductionWorkspaceProps> = ({
  project,
  simulatedDate,
  isDark,
  theme,
  activeRole,
  projectMembers = [],
  initialSubmodule,
  initialCalendarSubView,
  onUpdateProject,
  onSetSimulatedDate,
  onAddActivity,
  onAddActivityWithDetails,
  onRemoveActivity,
  onUpdateActivity,
  onAdjustPhaseDays,
  onUpdatePhase,
  onMovePhaseUp,
  onMovePhaseDown,
  onDeletePhase,
  onAddPhase,
  onAddCrew,
  onDeleteCrew,
  onUpdateCrewStatus,
  onNavigateTab,
  onOpenDiscussion,
}) => {
  const [activeSection, setActiveSection] = useState<ProductionSectionId>(() =>
    normalizeProductionSectionId(initialSubmodule)
  );
  const [focusedShootDayId, setFocusedShootDayId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSubmodule) {
      setActiveSection(normalizeProductionSectionId(initialSubmodule));
    }
  }, [initialSubmodule]);

  const productionStore = useMemo(
    () => getProductionOperationalStore(project),
    [project]
  );

  const resolvedRole =
    activeRole !== undefined
      ? activeRole
      : (project as { persistence?: string }).persistence === 'mock'
        ? (project.userRole ?? null)
        : null;
  const canEdit =
    hasPermission(resolvedRole, 'production:edit_data') ||
    hasPermission(resolvedRole, 'production:edit_dept_data');

  return (
    <div
      id="workspace-production-content"
      data-testid="production-workspace-root"
      className="flex-1 min-h-0 flex flex-col h-full w-full production-atmospheric-bg text-slate-100 overflow-hidden select-none"
    >
      {/* Top Section Bar: Strictly Calendar, Shoot, Directory */}
      <div className="h-11 border-b border-[#E63950]/20 bg-[#1A1017]/85 backdrop-blur-xl px-4 flex items-center justify-between shrink-0 gap-3">
        <div
          data-testid="production-navigation-bar"
          className="flex items-center gap-1 bg-[#10090D]/80 p-0.5 rounded-xl border border-[#E63950]/25 shadow-inner"
        >
          {PRODUCTION_SECTIONS.map((sec) => {
            const Icon = SECTION_ICONS[sec.id];
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                data-testid={`production-tab-${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FF1744] via-[#E63950] to-[#C21845] text-white font-bold shadow-[0_0_14px_rgba(255,23,68,0.4)] border border-[#FF5368]/40'
                    : 'text-rose-200/60 hover:text-white hover:bg-[#65152D]/30 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-rose-400'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-rose-300/80">
          {!canEdit && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-[#E63950]/30 bg-[#26151F]/90 text-rose-300">
              <Lock className="w-3 h-3 text-[#FF5368]" />
              Read-only
            </span>
          )}
          <span className="hidden sm:inline font-semibold text-rose-200">{project.title}</span>
        </div>
      </div>

      {activeSection === 'calendar' && (
        <ProductionCalendarView
          project={project}
          productionStore={productionStore}
          simulatedDate={simulatedDate}
          isDark={isDark}
          theme={theme}
          canEdit={canEdit}
          initialSubView={initialCalendarSubView}
          projectMembers={projectMembers}
          onUpdateProject={onUpdateProject}
          onSetSimulatedDate={onSetSimulatedDate}
          onAddActivity={onAddActivity}
          onAddActivityWithDetails={onAddActivityWithDetails}
          onRemoveActivity={onRemoveActivity}
          onUpdateActivity={onUpdateActivity}
          onOpenShootDay={(dayId) => {
            if (dayId) setFocusedShootDayId(dayId);
            setActiveSection('shoot');
          }}
          onNavigateTab={(tab, sub) => onNavigateTab(tab, sub)}
          onOpenDiscussion={onOpenDiscussion}
        />
      )}

      {activeSection === 'shoot' && (
        <ProductionShootView
          project={project}
          productionStore={productionStore}
          simulatedDate={simulatedDate}
          canEdit={canEdit}
          initialDayId={focusedShootDayId}
          onUpdateProject={onUpdateProject}
          onOpenDirectory={() => setActiveSection('directory')}
          onOpenStripboard={() => onNavigateTab('breakdown', 'breakdown-stripboard')}
          onOpenDiscussion={onOpenDiscussion}
        />
      )}

      {activeSection === 'directory' && (
        <ProductionDirectoryView
          project={project}
          productionStore={productionStore}
          canEdit={canEdit}
          onUpdateProject={onUpdateProject}
          onAddCrew={onAddCrew}
          onDeleteCrew={onDeleteCrew}
          onUpdateCrewStatus={onUpdateCrewStatus}
          onOpenDiscussion={onOpenDiscussion}
        />
      )}
    </div>
  );
};
