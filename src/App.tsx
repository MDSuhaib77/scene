/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Layers, 
  Inbox,
  Calendar as CalendarIcon, 
  Users, 
  Play, 
  FolderOpen, 
  Download, 
  Upload, 
  Lock, 
  Unlock, 
  ArrowUp, 
  ArrowDown, 
  Activity as ActivityIcon, 
  Film, 
  User, 
  Sliders, 
  Info, 
  HelpCircle, 
  Trash2, 
  CheckSquare, 
  Square, 
  TrendingUp, 
  AlertCircle, 
  AlertTriangle, 
  LogOut,
  ChevronRight,
  BookOpen,
  Sparkles,
  Clock,
  Sun,
  Moon,
  ArrowLeft,
  ArrowRight,
  X,
  BarChart3,
  Terminal,
  Database,
  Shield,
  Gauge,
  FileText,
  Box,
  MessageSquare,
  Bell,
  Menu
} from 'lucide-react';
import { FilmProject, FilmPhase, CrewMember, Activity, FootageBackup, ScreenplayVersion, StoryboardRevision } from './types';
import { INITIAL_PROJECTS, WALKTHROUGH_PROJECT } from './data/mockProjects';
import { ScreenplayWorkspace } from './features/screenplay/ScreenplayWorkspace';
import { ScreenplayErrorBoundary } from './features/screenplay/components/ScreenplayErrorBoundary';
import { 
  recalculateSchedule, 
  updateProjectStatus, 
  getPipelineMetrics, 
  addDays, 
  formatDate, 
  parseDate,
  getDaysDifference 
} from './utils/scheduler';

import SpeedometerGauge from './components/SpeedometerGauge';
import UserProfilePage from './components/UserProfilePage';
import { BreakdownWorkspace } from './features/breakdown/BreakdownWorkspace';
import { ProjectOverview } from './components/ProjectOverview';
import { envValidation } from './config/env';
import { useProject } from './features/projects/ProjectContext';
import { ProjectSwitcherModal } from './features/projects/ProjectSwitcherModal';
import { CreateProjectModal } from './features/projects/CreateProjectModal';
import { TeamManagementModal } from './features/team/TeamManagementModal';
import { DiscussionsDrawer } from './features/collaboration/DiscussionsDrawer';
import { NotificationsDrawer } from './features/collaboration/NotificationsDrawer';
import { ActivityFeedDrawer } from './features/collaboration/ActivityFeedDrawer';
import {
  fallbackTabForDiscussionEntity,
  resolveRecordDestination,
} from './features/collaboration/navigationHelpers';
import type {
  ActivityDomainModel,
  DiscussionEntityType,
  NotificationDomainModel,
} from './services/contracts/types';
import {
  InviteAcceptanceView,
  PENDING_INVITE_STORAGE_KEY,
  parseInviteTokenFromHash,
  resolveInitialInviteToken,
} from './features/team/InviteAcceptanceView';
import { hasPermission } from './services/rbac/permissions';
import { AuthModal } from './features/auth/AuthModal';
import { AccountSettingsModal, SettingsSectionId } from './features/profile/AccountSettingsModal';
import { HelpModal } from './features/profile/HelpModal';
import { AccountDropdown } from './features/profile/AccountDropdown';
import { CinematicAuthGateway } from './features/auth/CinematicAuthGateway';
import { LivingAmbientBackground } from './components/ui/LivingAmbientBackground';
import { DynamicOrbCursor } from './components/ui/DynamicOrbCursor';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { services } from './services';
import { AppSidebar } from './components/navigation/AppSidebar';
import { VisualizeWorkspace } from './features/visualize/VisualizeWorkspace';
import { ProductionWorkspace } from './features/production/components/ProductionWorkspace';
import type { CalendarSubView } from './features/production/components/ProductionCalendarView';
import { VaultWorkspace } from './features/vault/components/VaultWorkspace';
import sceneLogoUrl from './assets/scene-logo.svg';

export function DotWaveBackground({ isDark }: { isDark: boolean }) {
  return (
    <div 
      className={`absolute inset-0 pointer-events-none z-0 transition-opacity duration-500 ${
        isDark ? 'opacity-[0.035]' : 'opacity-[0.025]'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle, ${isDark ? '#6366f1' : '#4f46e5'} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    />
  );
}

export function CinematicGradientWaves({ isDark }: { isDark: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const mouseRef = React.useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const getParentSize = () => {
      const parent = canvas.parentElement;
      return {
        width: parent ? parent.clientWidth : window.innerWidth,
        height: parent ? Math.max(parent.clientHeight, window.innerHeight) : window.innerHeight
      };
    };

    let { width, height } = getParentSize();
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      const size = getParentSize();
      width = canvas.width = size.width;
      height = canvas.height = size.height;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = e.clientX - rect.left;
      mouseRef.current.targetY = e.clientY - rect.top;
    };

    // Initialize target coords
    mouseRef.current.targetX = width / 2;
    mouseRef.current.targetY = height / 2;
    mouseRef.current.x = width / 2;
    mouseRef.current.y = height / 2;

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Grid details (Upgraded to the full vivid & expanded dot wave pattern)
    const cols = 96;
    const rows = 72;
    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Damp mouse tracking
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      time += 0.008;

      const mouseFactorX = (mouse.x - width / 2) / width;
      const mouseFactorY = (mouse.y - height / 2) / height;

      const yaw = 0.12 + mouseFactorX * 0.15 + Math.sin(time * 0.08) * 0.03;
      const pitch = 0.5 + mouseFactorY * 0.12 + Math.cos(time * 0.07) * 0.04;

      const fov = 400;
      const cameraZ = 550;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          // Normalize grid coordinates from center with expanded spacing matching main DotWaveBackground
          const px = (c - cols / 2) * 26;
          const pz = (r - rows / 2) * 26;

          // Mouse proximity height wave factor
          const distToMouse = Math.sqrt((px - (mouse.x - width/2))*(px - (mouse.x - width/2)) + (pz - (mouse.y - height/2))*(pz - (mouse.y - height/2)));
          const mouseLift = Math.max(0, 150 - distToMouse * 0.2) * 0.4;

          // 3D waves calculation
          const wave1 = Math.sin(px * 0.006 + time) * 45;
          const wave2 = Math.cos(pz * 0.005 + time * 1.2) * 35;
          const wave3 = Math.sin((px + pz) * 0.003 - time * 0.8) * 25;
          const py = wave1 + wave2 + wave3 + mouseLift;

          // Yaw & Pitch
          const x1 = px * Math.cos(yaw) - pz * Math.sin(yaw);
          const z1 = px * Math.sin(yaw) + pz * Math.cos(yaw);

          const y1 = py * Math.cos(pitch) - z1 * Math.sin(pitch);
          const z2 = py * Math.sin(pitch) + z1 * Math.cos(pitch);

          const screenZ = z2 + cameraZ;

          if (screenZ > 50) {
            const scale = fov / screenZ;
            const screenX = x1 * scale + width / 2;
            const screenY = y1 * scale + height * 0.58;

            if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
              const depthFade = Math.min(1, Math.max(0.01, 1.2 - screenZ / 1100));
              
              // 2D sine wave boundary vignette fade
              const edgeFade = Math.sin((screenX / width) * Math.PI) * Math.sin((screenY / height) * Math.PI);
              const clampedEdgeFade = Math.max(0, Math.min(1, edgeFade));

              const heightFactor = (py + 105) / 210;
              const baseWidth = isDark ? 2.5 : 2.2;
              const radius = Math.max(0.5, (0.6 + heightFactor * baseWidth) * scale * 0.95);

              ctx.beginPath();
              ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);

              if (isDark) {
                // Brighter glow values to match updated DotWaveBackground
                const redVal = Math.floor(6 + heightFactor * 10);
                const greenVal = Math.floor(182 + (1 - heightFactor) * 60);
                const blueVal = Math.floor(212 + heightFactor * 40);
                const alpha = depthFade * (0.35 + heightFactor * 0.5) * clampedEdgeFade;
                ctx.fillStyle = `rgba(${redVal}, ${greenVal}, ${blueVal}, ${alpha})`;
              } else {
                // Brightened elegant blue/indigo/emerald on light template
                const redVal = Math.floor(79 + heightFactor * 20);
                const greenVal = Math.floor(70 + (1 - heightFactor) * 115);
                const blueVal = Math.floor(229 + heightFactor * 26);
                const alpha = depthFade * (0.16 + heightFactor * 0.28) * clampedEdgeFade;
                ctx.fillStyle = `rgba(${redVal}, ${greenVal}, ${blueVal}, ${alpha})`;
              }

              ctx.fill();
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDark]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />;
}

export function PlanLogo({ className = "h-11" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center justify-start select-none ${className}`} style={{ minHeight: '32px' }}>
      <img 
        src={sceneLogoUrl}
        alt="SCENE Logo" 
        className="h-full w-auto max-h-full opacity-100 hover:opacity-95 transition-all duration-200 object-contain" 
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const fallback = document.getElementById('plan-fallback-text-logo');
          if (fallback) {
            fallback.classList.remove('hidden');
            fallback.classList.add('inline-block');
          }
        }}
      />
      <span 
        id="plan-fallback-text-logo"
        className="hidden font-display text-2xl font-black text-white tracking-widest uppercase"
      >
        SCENE
      </span>
    </div>
  );
}

function sanitizeProjects(input: any): FilmProject[] {
  if (!Array.isArray(input)) return [];
  return input.map(proj => {
    const id = typeof proj.id === 'string' ? proj.id : 'proj-' + Date.now() + Math.random().toString(36).substring(2, 7);
    const owner = typeof proj.owner === 'string' ? proj.owner : undefined;
    const title = typeof proj.title === 'string' ? proj.title : 'Untitled Project';
    const logline = typeof proj.logline === 'string' ? proj.logline : 'No logline available.';
    const director = typeof proj.director === 'string' ? proj.director : 'Unknown Director';
    const startDate = typeof proj.startDate === 'string' ? proj.startDate : '2026-06-03';
    const finalEndDate = typeof proj.finalEndDate === 'string' ? proj.finalEndDate : '2026-08-16';
    const suggestedEndDate = typeof proj.suggestedEndDate === 'string' ? proj.suggestedEndDate : '2026-08-16';
    const isEndDateFixed = typeof proj.isEndDateFixed === 'boolean' ? proj.isEndDateFixed : false;
    const updatedAt = typeof proj.updatedAt === 'string' ? proj.updatedAt : new Date().toISOString();

    // Constraints safety
    const c = proj.constraints || {};
    const constraints = {
      budgetLimit: typeof c.budgetLimit === 'number' ? c.budgetLimit : 500000,
      dailyBurnRateCap: typeof c.dailyBurnRateCap === 'number' ? c.dailyBurnRateCap : 3500,
      screenplayLocked: typeof c.screenplayLocked === 'boolean' ? c.screenplayLocked : false,
      castAvailabilityDays: typeof c.castAvailabilityDays === 'number' ? c.castAvailabilityDays : 45,
      permitLeadTimeDays: typeof c.permitLeadTimeDays === 'number' ? c.permitLeadTimeDays : 15,
      targetRating: (['G', 'PG', 'PG-13', 'R', 'NC-17'].includes(c.targetRating) ? c.targetRating : 'PG-13') as any,
      weatherContingencyBuffer: typeof c.weatherContingencyBuffer === 'number' ? c.weatherContingencyBuffer : 5,
      postOverheadRatio: typeof c.postOverheadRatio === 'number' ? c.postOverheadRatio : 15,
    };

    // Phases validation
    const rawPhases = Array.isArray(proj.phases) ? proj.phases : [];
    const phases = rawPhases.map((phase: any) => {
      const pId = typeof phase.id === 'string' ? phase.id : 'phase-' + Math.random().toString(36).substring(2, 7);
      const pName = typeof phase.name === 'string' ? phase.name : 'Unnamed Phase';
      const category = ['pre', 'prod', 'post'].includes(phase.category) ? phase.category : 'pre';
      const color = typeof phase.color === 'string' ? phase.color : 'bg-zinc-800';
      const textLightColor = typeof phase.textLightColor === 'string' ? phase.textLightColor : 'text-zinc-100';
      const textDarkColor = typeof phase.textDarkColor === 'string' ? phase.textDarkColor : 'text-zinc-400';
      const durationDays = typeof phase.durationDays === 'number' ? phase.durationDays : 15;
      const pStartDate = typeof phase.startDate === 'string' ? phase.startDate : startDate;
      const pEndDate = typeof phase.endDate === 'string' ? phase.endDate : startDate;
      const status = ['pending', 'active', 'completed', 'overdue'].includes(phase.status) ? phase.status : 'pending';
      const importance = ['critical', 'high', 'medium', 'low'].includes(phase.importance) ? phase.importance : 'medium';

      const rawActivities = Array.isArray(phase.activities) ? phase.activities : [];
      const activities = rawActivities.map((act: any) => {
        const actId = typeof act.id === 'string' ? act.id : 'act-' + Math.random().toString(36).substring(2, 7);
        const actName = typeof act.name === 'string' ? act.name : 'Unnamed Task';
        const completed = typeof act.completed === 'boolean' ? act.completed : false;
        const estimatedDays = typeof act.estimatedDays === 'number' ? act.estimatedDays : 5;
        const actStartDate = typeof act.startDate === 'string' ? act.startDate : pStartDate;
        const actEndDate = typeof act.endDate === 'string' ? act.endDate : pEndDate;
        const priority = ['high', 'medium', 'low'].includes(act.priority) ? act.priority : 'medium';
        const isThresholdTask = typeof act.isThresholdTask === 'boolean' ? act.isThresholdTask : false;
        const minDaysThreshold = typeof act.minDaysThreshold === 'number' ? act.minDaysThreshold : 1;
        const canBePostponed = typeof act.canBePostponed === 'boolean' ? act.canBePostponed : false;
        const isPostponed = typeof act.isPostponed === 'boolean' ? act.isPostponed : false;

        const rawSubTasks = Array.isArray(act.subTasks) ? act.subTasks : [];
        const subTasks = rawSubTasks.map((st: any) => ({
          id: typeof st.id === 'string' ? st.id : 'st-' + Math.random().toString(36).substring(2, 7),
          name: typeof st.name === 'string' ? st.name : 'Subtask',
          completed: typeof st.completed === 'boolean' ? st.completed : false,
        }));

        return {
          id: actId,
          name: actName,
          completed,
          estimatedDays,
          startDate: actStartDate,
          endDate: actEndDate,
          priority,
          isThresholdTask,
          minDaysThreshold,
          canBePostponed,
          isPostponed,
          subTasks,
        };
      });

      const rawCrew = Array.isArray(phase.crew) ? phase.crew : [];
      const crew = rawCrew.map((cr: any) => {
        const crId = typeof cr.id === 'string' ? cr.id : 'cr-' + Math.random().toString(36).substring(2, 7);
        const crName = typeof cr.name === 'string' ? cr.name : 'Unknown Crew Member';
        const role = typeof cr.role === 'string' ? cr.role : 'Crew';
        const email = typeof cr.email === 'string' ? cr.email : 'n/a';
        const phone = typeof cr.phone === 'string' ? cr.phone : 'n/a';
        const crStatus = ['Confirmed', 'Negotiating', 'Hold'].includes(cr.status) ? cr.status : 'Confirmed';

        return {
          id: crId,
          name: crName,
          role,
          email,
          phone,
          status: crStatus,
        };
      });

      return {
        id: pId,
        name: pName,
        category,
        color,
        textLightColor,
        textDarkColor,
        durationDays,
        startDate: pStartDate,
        endDate: pEndDate,
        status,
        importance,
        activities,
        crew,
      };
    });

    const footageBackups = Array.isArray(proj.footageBackups) ? proj.footageBackups : [];
    const screenplayVersions = Array.isArray(proj.screenplayVersions) ? proj.screenplayVersions : [];
    const storyboardRevisions = Array.isArray(proj.storyboardRevisions) ? proj.storyboardRevisions : [];

    let parsedDesignations = Array.isArray(proj.userDesignations)
      ? proj.userDesignations
      : typeof proj.userDesignation === 'string'
        ? proj.userDesignation.split(',').map((s: string) => s.trim()).filter(Boolean)
        : ['Line Producer'];

    // Clean up any occurrences of "Director of Photography" for operator role representation
    parsedDesignations = parsedDesignations.filter((r: string) => r !== "Director of Photography");
    if (parsedDesignations.length === 0) {
      if (id.includes('neon-dreams') || title.toLowerCase().includes('neon dreams')) {
        parsedDesignations = ['Director'];
      } else {
        parsedDesignations = ['Line Producer'];
      }
    }

    // CRITICAL RE-ALIGNMENT FOR NEON DREAMS KIRA VANCE DIRECTOR REQUIREMENT
    if (id.includes('neon-dreams') || title.toLowerCase().includes('neon dreams')) {
      parsedDesignations = ['Director'];
    }

    return {
      id,
      owner,
      title,
      logline,
      director,
      startDate,
      finalEndDate,
      suggestedEndDate,
      isEndDateFixed,
      constraints,
      phases,
      updatedAt,
      footageBackups,
      screenplayVersions,
      storyboardRevisions,
      userDesignation: parsedDesignations.join(', '),
      userDesignations: parsedDesignations,
    };
  });
}

const WALKTHROUGH_INFOS: Record<string, { title: string; description: string }> = {
  'tab-console': {
    title: 'Console Dashboard & Production KPIs',
    description: 'The Console Tab acts as your Central Production Command Center. It displays real-time key performance indicators (KPIs) like overall completion percentages, active milestones, crew readiness, and scheduling health scores. This ensures every operational decision is backed by live production projections.'
  },
  'tab-phases': {
    title: 'Roadmap & Production Phase Board',
    description: 'The Roadmap & Tasks Board lets you configure the core phases of your film production (Pre-Production, Production, Post-Production). Here you can toggle task completion, inspect scheduled start/end dates, assign crew members, and observe how phase changes automatically cascade downstream.'
  },
  'tab-constraints': {
    title: 'Production Schedule Constraints',
    description: 'The Schedule Constraints module monitors working parameters in real-time, warning you immediately about turnaround violations, maximum workday overruns, and timeline conflicts.'
  },
  'tab-crew': {
    title: 'Crew Directory & Rolodex',
    description: 'The Crew Rolodex manages the entire cast and technical crew assigned to your production. You can track contact information, union roles, assign specific members to schedule phases, and adjust assignment commitment tiers (Confirmed, Hold, Negotiating).'
  },
  'tab-calendar': {
    title: 'Visual Schedule Calendar',
    description: 'The Visual Calendar organizes all active schedules, shooting blocks, and task deadlines into a clean monthly calendar grid. It allows rapid identification of timeline overlaps, phase boundaries, and critical milestones.'
  },
  'tab-master-calendar': {
    title: 'Production Kanban List',
    description: 'The Production Kanban compile list aggregates all scheduled milestones and tasks from all phases into a single chronological view. This provides a unified checkable list of everything currently happening across your active timeline.'
  },
  'tab-telemetry': {
    title: 'Progressive Analytics & Gantt Chart',
    description: 'Progressive Analytics maps your entire production lifecycle onto a detailed visual timeline. It calculates start/end spreads and helps production managers identify potential timeline bottlenecks or phase slippages before they cause delays.'
  },
  'tab-assets': {
    title: 'Content Assets & Files Vault',
    description: 'The Assets Vault is where digital files and backups are cataloged. You can manage on-set raw footage backups with automatic MD5 integrity checksum generation, manage screenwriter screenplay drafts, and catalog scene storyboard panels.'
  },
  'feature-title': {
    title: 'Inline Title Editor',
    description: 'The Project Title Editor lets you customize your film pipeline name inline. Changes to the project title automatically propagate through all reports, PDFs, print sheets, and metadata layers.'
  },
  'feature-logline': {
    title: 'Screenplay Logline Editor',
    description: 'The Logline Editor lets you craft and save your film\'s core dramatic premise. The logline is crucial for crew alignment and is automatically embedded inside exported project outlines.'
  },
  'feature-director': {
    title: 'Director Assignment',
    description: 'Assign the creative visionary leading your project. Modifying the Director field updates the active project credits and correlates automatically with crew permissions.'
  },
  'feature-producer': {
    title: 'Lead Producer Assignment',
    description: 'Assign the Lead Producer responsible for the project\'s production and scheduling governance.'
  },
  'feature-writer': {
    title: 'Screenwriter Assignment',
    description: 'Assign the primary author of the screenplay. This allows seamless tracking of script revisions and screenplay draft releases in the Assets Vault.'
  },
  'feature-cinematographer': {
    title: 'Cinematographer (DP) Assignment',
    description: 'Assign the Director of Photography who oversees the visual aesthetic and camera crews. This designation coordinates with on-set safety buffers and daily camera footage backups.'
  },
  'feature-start-date': {
    title: 'Start Shooting Date (Genesis)',
    description: 'The Start Shooting Date sets the temporal genesis point of your timeline. Changing this date will automatically shift every subsequent phase and milestone downstream via the cascading calendar engine.'
  },
  'feature-target-date': {
    title: 'Target Release Lock',
    description: 'The Target Release Date sets a hard lock on when the final project must be delivered. This is crucial for distributing schedules and calculating safety buffers relative to theater/broadcast dates.'
  },
  'feature-rigidity': {
    title: 'Rigid vs Flexible Release Target',
    description: 'The Rigid Schedule engine dictates how scheduling delays cascade. Set to FLEXIBLE, any delay in early tasks pushes the final release date out. Set to RIGID, early delays automatically compress downstream phases to guarantee you meet the release deadline.'
  },
  'feature-burn-rate': {
    title: 'Production Pace Analyzer',
    description: 'The Production Pace Analyzer estimates your daily operational velocity and scene coverage based on scheduled crew calls.'
  },
  'feature-health-score': {
    title: 'Pipeline Health & Overdue Index',
    description: 'The Pipeline Health Score mathematically combines task completion, schedule tracking, and milestone deadlines into a single index. Maintain it at 100% by resolving overdue tasks.'
  },
  'feature-time-travel': {
    title: 'Simulated Time Travel Clock',
    description: 'The Time Travel Clock is a powerful planning simulator. By jumping days or weeks into the future, you can preview how your project\'s schedule, pace, and overdue tasks shift dynamically over time.'
  },
  'feature-add-task': {
    title: 'Add Milestone Activity',
    description: 'Add new tasks and milestones to a phase. You can define estimated days and priority levels, and watch as the calendar engine seamlessly schedules it alongside existing tasks.'
  },
  'feature-add-crew': {
    title: 'Add Crew Member',
    description: 'Add new specialists to your crew rolodex. You can specify their name, department, email, contact phone, and assignment status to build out your active production roster.'
  },
  'feature-add-asset': {
    title: 'Register Digital File Asset',
    description: 'Register a new digital asset. This simulates uploading raw media takes, script drafts, or storyboard sheets, verifying file integrity using MD5 checksum validation.'
  }
};

export default function App() {
  const [walkthroughPopup, setWalkthroughPopup] = React.useState<{
    title: string;
    description: string;
    onConfirm?: () => void;
  } | null>(null);

  const handleWalkthroughIntercept = (_featureKey: string, onConfirm?: () => void) => {
    if (onConfirm) onConfirm();
    return false;
  };
  // Navigation Screens: 'welcome' | 'dashboard' | 'create-project' | 'editor'
  const [screen, setScreen] = React.useState<'welcome' | 'onboarding' | 'dashboard' | 'create-project' | 'editor'>(() => {
    const savedScreen = localStorage.getItem('cp_screen') as 'welcome' | 'onboarding' | 'dashboard' | 'create-project' | 'editor' | null;
    const hasActiveProject = !!localStorage.getItem('sceneos_active_project_id');
    const hasUser = !!localStorage.getItem('cp_uname');
    if (!hasUser) return 'welcome';
    if (savedScreen === 'editor' && hasActiveProject) return 'editor';
    if (savedScreen === 'create-project') return 'create-project';
    return 'dashboard';
  });

  React.useEffect(() => {
    localStorage.setItem('cp_screen', screen);
  }, [screen]);
  const [showProfile, setShowProfile] = React.useState<boolean>(false);
  
  // Unified Workspace & RBAC context hooks (Single Source of Truth)
  const {
    projects,
    activeProject: contextActiveProject,
    activeProjectId,
    activeRole: workspaceRole,
    members: workspaceMembers,
    discussionUnreadCount,
    openDiscussions,
    notificationUnreadCount,
    openNotifications,
    openActivity,
    realtimeStatus,
    onlineMembers,
    collaborationRevision,
    setRealtimeModule,
    currentUser: workspaceUser,
    isLoading: isProjectsLoading,
    logout: projectLogout,
    switchProject,
    refreshProjects,
    createProject: createProjectService,
    updateProject: updateProjectService,
    updateActiveProject,
    deleteProject: deleteProjectService,
  } = useProject();

  const [pendingInviteToken, setPendingInviteToken] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return resolveInitialInviteToken(
      window.location.hash,
      typeof sessionStorage !== 'undefined' ? sessionStorage : null
    );
  });

  React.useEffect(() => {
    if (!pendingInviteToken) return;
    try {
      sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, pendingInviteToken);
    } catch {
      // Ignore storage errors
    }
  }, [pendingInviteToken]);

  React.useEffect(() => {
    const syncFromHash = () => {
      const token = parseInviteTokenFromHash(window.location.hash);
      if (token) {
        setPendingInviteToken(token);
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const clearInviteRoute = React.useCallback(() => {
    setPendingInviteToken(null);
    try {
      sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    if (typeof window !== 'undefined' && window.location.hash.toLowerCase().startsWith('#invite=')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const handleInviteAccepted = React.useCallback(
    async (projectId: string) => {
      clearInviteRoute();
      await refreshProjects(projectId);
      await switchProject(projectId);
      setScreen('editor');
    },
    [clearInviteRoute, refreshProjects, switchProject]
  );

  const [showProjectSwitcher, setShowProjectSwitcher] = React.useState(false);
  const [showCreateProject, setShowCreateProject] = React.useState(false);
  const [showTeamManagement, setShowTeamManagement] = React.useState(false);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = React.useState<SettingsSectionId>('profile');
  const [collaborationDestination, setCollaborationDestination] = React.useState<'home' | 'inbox' | 'activity' | 'people' | 'discussions'>('home');
  const [showPresenceMenu, setShowPresenceMenu] = React.useState(false);
  
  // Theme state: dark-neon (glowing, high-contrast) vs. light-cinematic (paper screenplay look)
  const [theme, setTheme] = React.useState<'dark-neon' | 'light-cinematic'>(() => {
    return (localStorage.getItem('cp_theme') as 'dark-neon' | 'light-cinematic') || 'dark-neon';
  });

  // User Authentication States
  const [authMode, setAuthMode] = React.useState<'sign-in' | 'sign-up'>('sign-in');
  const [userName, setUserName] = React.useState<string>(() => localStorage.getItem('cp_uname') || '');
  const [userRole, setUserRole] = React.useState<string>(() => localStorage.getItem('cp_urole') || 'Line Producer');

  // Isolated form input states (to avoid premature state updates as user is typing)
  const [inputName, setInputName] = React.useState<string>('');
  const [inputPassword, setInputPassword] = React.useState<string>('');
  const [inputConfirmPassword, setInputConfirmPassword] = React.useState<string>('');
  const [authError, setAuthError] = React.useState<string | null>(null);

  // Real OAuth and Email Auth States (Phase 2.5)
  const [oauthLoading, setOauthLoading] = React.useState<'google' | 'apple' | null>(null);
  const [authSubmitting, setAuthSubmitting] = React.useState<boolean>(false);
  const [inputFullName, setInputFullName] = React.useState<string>('');
  const [showForgotPassword, setShowForgotPassword] = React.useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = React.useState<string>('');
  const [forgotSubmitting, setForgotSubmitting] = React.useState<boolean>(false);
  const [authNotification, setAuthNotification] = React.useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

  // Restore authenticated session automatically from Supabase (e.g. on OAuth callback or page reload)
  React.useEffect(() => {
    if (workspaceUser) {
      const displayName = workspaceUser.fullName || workspaceUser.email;
      setUserName(displayName);
      localStorage.setItem('cp_uname', displayName);
      if (screen === 'welcome' || (screen === 'editor' && !contextActiveProject)) {
        setScreen('dashboard');
      }
    }
  }, [workspaceUser, contextActiveProject, screen]);

  // Safety Guard: If user is on editor screen without an active project, redirect to dashboard
  React.useEffect(() => {
    if (!isProjectsLoading && screen === 'editor' && !contextActiveProject) {
      setScreen('dashboard');
    }
  }, [screen, contextActiveProject, isProjectsLoading]);

  const [showGoogleChooser, setShowGoogleChooser] = React.useState<boolean>(false);
  const [googleEmailInput, setGoogleEmailInput] = React.useState<string>('');
  const [showCustomGoogleInput, setShowCustomGoogleInput] = React.useState<boolean>(false);

  // Google Multi-step Auth & Password Protection States
  const [googleAuthStep, setGoogleAuthStep] = React.useState<'chooser' | 'register' | 'verify'>('chooser');
  const [googleSelectedEmail, setGoogleSelectedEmail] = React.useState<string>('');
  const [googleSelectedDisplayName, setGoogleSelectedDisplayName] = React.useState<string>('');
  const [googleUsernameInput, setGoogleUsernameInput] = React.useState<string>('');
  const [googlePasswordInput, setGooglePasswordInput] = React.useState<string>('');
  const [googleConfirmPasswordInput, setGoogleConfirmPasswordInput] = React.useState<string>('');
  const [googleError, setGoogleError] = React.useState<string | null>(null);

  // Simulated Time Travel System Clock
  const [simulatedDate, setSimulatedDate] = React.useState<string>(() => {
    return formatDate(new Date()); // default is real today
  });

  // Active workspace selection strictly consolidated to six primary modules
  const [workspaceTab, setWorkspaceTab] = React.useState<string>('overview');
  const [activeSubmoduleId, setActiveSubmoduleId] = React.useState<string | null>(null);
  const [productionCalendarSubView, setProductionCalendarSubView] = React.useState<CalendarSubView | undefined>(undefined);

  const resolveConsolidatedRoute = (
    rawTab: string,
    rawSub?: string | null
  ): { tab: string; sub: string | null; calSub?: CalendarSubView } => {
    const t = (rawTab || 'overview').trim().toLowerCase();
    if (t === 'screenplay' || t === 'script') return { tab: 'screenplay', sub: rawSub || null };
    if (t === 'breakdown') return { tab: 'breakdown', sub: rawSub || null };
    if (t === 'visualize') return { tab: 'visualize', sub: rawSub || null };
    if (t === 'production') {
      return { tab: 'production', sub: rawSub || 'calendar', calSub: 'month' };
    }
    if (t === 'calendar' || t === 'schedule') {
      return { tab: 'production', sub: 'calendar', calSub: 'month' };
    }
    if (t === 'master-calendar' || t === 'tasks' || t === 'phases' || t === 'plan') {
      return { tab: 'production', sub: 'calendar', calSub: 'agenda' };
    }
    if (t === 'shoot' || t === 'shoot-callsheets' || t === 'shoot-call-sheets') {
      return { tab: 'production', sub: 'shoot' };
    }
    if (t === 'crew' || t === 'people' || t === 'directory') {
      return { tab: 'production', sub: 'directory' };
    }
    if (t === 'vault' || t === 'assets') return { tab: 'vault', sub: rawSub || null };
    return { tab: 'overview', sub: null };
  };

  React.useEffect(() => {
    setShowPresenceMenu(false);
  }, [activeProjectId]);

  React.useEffect(() => {
    setRealtimeModule(workspaceTab);
  }, [workspaceTab, setRealtimeModule]);

  const navigateToModule = (
    rawTab: string,
    rawSub?: string | null,
    historyMeta?: { fromOverview?: boolean; sourceView?: any; sourceLabel?: string }
  ) => {
    const resolved = resolveConsolidatedRoute(rawTab, rawSub);
    setActiveSubmoduleId(resolved.sub);
    setProductionCalendarSubView(resolved.calSub);
    window.history.pushState(
      {
        workspaceTab: resolved.tab,
        activeSubmoduleId: resolved.sub,
        fromOverview: Boolean(historyMeta?.fromOverview),
        sourceView: historyMeta?.sourceView,
        sourceLabel: historyMeta?.sourceLabel,
      },
      ''
    );
    setWorkspaceTab(resolved.tab);
  };

  // Contextual Return Navigation state (from Overview actions to target workspaces)
  const [overviewReturnContext, setOverviewReturnContext] = React.useState<{
    from: 'overview';
    sourceView?: 'overview' | 'execution' | 'readiness' | 'schedule' | 'attention' | 'activity';
    sourceWarningId?: string;
    sourceLabel?: string;
  } | null>(null);
  const [overviewHeroInitialView, setOverviewHeroInitialView] = React.useState<'overview' | 'execution' | 'readiness' | 'schedule' | 'attention' | 'activity'>('overview');

  // Synchronize browser back/forward history for workspace navigation
  React.useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.workspaceTab) {
        setWorkspaceTab(e.state.workspaceTab);
        setActiveSubmoduleId(e.state.activeSubmoduleId || null);
        if (e.state.fromOverview) {
          setOverviewReturnContext({
            from: 'overview',
            sourceView: e.state.sourceView || 'overview',
            sourceLabel: e.state.sourceLabel,
          });
        } else {
          setOverviewReturnContext(null);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Persistent application sidebar states (collapsible desktop rail, mobile drawer)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState<boolean>(() => {
    return localStorage.getItem('sceneos_sidebar_collapsed') === 'true';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState<boolean>(false);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sceneos_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Direct project mutation helper (for screenplay, scenes, metadata)
  const handleUpdateProjectDirect = (updated: Partial<FilmProject>) => {
    if (!activeProject) return;
    const modified: FilmProject = {
      ...activeProject,
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    updateActiveProject(modified);
  };

  // Active Dashboard subsection selection: 'pipelines' | 'active-tracks'
  const [dashboardTab, setDashboardTab] = React.useState<'pipelines' | 'active-tracks'>('pipelines');

  // Project Id currently slated for deletion warning context option box
  const [deletingProjectId, setDeletingProjectId] = React.useState<string | null>(null);

  // Active project title editing states
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editingTitleValue, setEditingTitleValue] = React.useState('');

  // Active project logline editing states
  const [isEditingLogline, setIsEditingLogline] = React.useState(false);
  const [editingLoglineValue, setEditingLoglineValue] = React.useState('');

  // Active project technician editing states
  const [isEditingDirector, setIsEditingDirector] = React.useState(false);
  const [editingDirectorValue, setEditingDirectorValue] = React.useState('');

  const [isEditingProducer, setIsEditingProducer] = React.useState(false);
  const [editingProducerValue, setEditingProducerValue] = React.useState('');

  const [isEditingWriter, setIsEditingWriter] = React.useState(false);
  const [editingWriterValue, setEditingWriterValue] = React.useState('');

  const [isEditingCinematographer, setIsEditingCinematographer] = React.useState(false);
  const [editingCinematographerValue, setEditingCinematographerValue] = React.useState('');

  // Collapsed state for the Project Overview Master Header Card HUD
  const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false);

  // Active speedometer KPI audit modal state: 'completions' | 'phases' | 'health' | null
  const [activeKpiModal, setActiveKpiModal] = React.useState<'completions' | 'phases' | 'health' | null>(null);

  // Input states for creating manual project
  const [newTitle, setNewTitle] = React.useState('');
  const [newLogline, setNewLogline] = React.useState('');
  const [newDirector, setNewDirector] = React.useState('');
  const [newStartDate, setNewStartDate] = React.useState(() => formatDate(new Date()));
  const [newIsFixed, setNewIsFixed] = React.useState(true);
  const [newEndDate, setNewEndDate] = React.useState(() => addDays(formatDate(new Date()), 75)); // Default 75-day cascading duration
  const [newDesignation, setNewDesignation] = React.useState('Line Producer');
  const [newDesignations, setNewDesignations] = React.useState<string[]>(['Line Producer']);

  // User-specific quick scratchpad notes state
  const [quickNotes, setQuickNotes] = React.useState(() => {
    return localStorage.getItem('cp_notes_global') || '';
  });

  // Keep notes state synchronized when userName is established/shifted
  React.useEffect(() => {
    if (userName) {
      setQuickNotes(localStorage.getItem(`cp_notes_${userName}`) || '');
    }
  }, [userName]);

  const handleSaveNotes = (val: string) => {
    setQuickNotes(val);
    localStorage.setItem(`cp_notes_${userName || 'global'}`, val);
  };

  // Keep the create-project wizard designations in sync with the user's active/login role
  React.useEffect(() => {
    if (userRole) {
      const roles = userRole.split(',').map(s => s.trim()).filter(Boolean);
      if (roles.length > 0) {
        setNewDesignations(roles);
      }
    }
  }, [userRole]);

  // Handle Drag & Drop / Upload Simulation
  const [dragActive, setDragActive] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [designationChangeConfirm, setDesignationChangeConfirm] = React.useState<{
    role: string;
    action: 'add' | 'remove';
    projectRoles: string[];
  } | null>(null);
  const [designationWarningMessage, setDesignationWarningMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Persistent theme management
  React.useEffect(() => {
    localStorage.setItem('cp_theme', theme);
    const isDarkTheme = theme.startsWith('dark');
    const targetBg = isDarkTheme ? '#04050a' : '#f3f5f4';
    document.documentElement.style.backgroundColor = targetBg;
    document.body.style.backgroundColor = targetBg;
    if (isDarkTheme) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.body.classList.remove('light');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    }
  }, [theme]);

  // Lock root document scrolling during full-height studio workspaces
  React.useEffect(() => {
    if (screen === 'editor' && workspaceTab !== 'overview') {
      const origHtmlOverflow = document.documentElement.style.overflow;
      const origBodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = origHtmlOverflow;
        document.body.style.overflow = origBodyOverflow;
      };
    }
  }, [screen, workspaceTab]);

  React.useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem('cp_active_id', activeProjectId);
      // Automatically keep the user role synchronized with the designations of the selected project
      const proj = projects.find(p => p.id === activeProjectId);
      if (proj) {
        let activeDesignations = proj.userDesignations && proj.userDesignations.length > 0
          ? proj.userDesignations
          : (proj.userDesignation ? proj.userDesignation.split(',').map(s => s.trim()).filter(Boolean) : []);
        
        // Remove DP operator contradiction
        activeDesignations = activeDesignations.filter(r => r !== "Director of Photography");
        if (activeDesignations.length === 0) {
          activeDesignations = ["Line Producer"];
        }

        // CRITICAL NEON DREAMS CORRECTION FOR KIRA VANCE
        if (proj.id.includes('neon-dreams') || proj.title.toLowerCase().includes('neon dreams')) {
          activeDesignations = ["Director"];
        }

        const activeDesignationString = activeDesignations.join(', ') || 'Line Producer';
        setUserRole(activeDesignationString);
        localStorage.setItem('cp_urole', activeDesignationString);
      }
    } else {
      localStorage.removeItem('cp_active_id');
    }
  }, [activeProjectId, projects]);

  // All accessible productions for the authenticated user
  const userProjects = React.useMemo(() => {
    return projects;
  }, [projects]);

  const activeProject = React.useMemo(() => {
    if (!contextActiveProject) return null;
    return updateProjectStatus(contextActiveProject, simulatedDate);
  }, [contextActiveProject, simulatedDate]);

  // Compute overall pipeline statistics
  const metrics = React.useMemo(() => {
    if (!activeProject) return null;
    return getPipelineMetrics(activeProject, simulatedDate);
  }, [activeProject, simulatedDate]);

  // Default system mock personas for immediate developer/reviewer evaluation
  const DEFAULT_SYSTEM_USERS = [
    {
      username: 'kira.vance@sceneos.studio',
      displayName: 'Kira Vance',
      password: 'password123',
      role: 'Director',
      isGoogle: false,
    },
    {
      username: 'elena.rostova@sceneos.studio',
      displayName: 'Elena Rostova',
      password: 'password123',
      role: 'Line Producer',
      isGoogle: false,
    },
    {
      username: 'marcus.ad@sceneos.studio',
      displayName: 'Marcus Thorne',
      password: 'password123',
      role: '1st Assistant Director',
      isGoogle: false,
    },
    {
      username: 'Suhaib',
      displayName: 'Suhaib',
      password: 'password123',
      role: 'Executive Producer',
      isGoogle: false,
    },
  ];

  // Get users database from localStorage pre-seeded with system mock users
  const getRegisteredUsers = () => {
    const local = localStorage.getItem('cp_users');
    let storedUsers: any[] = [];
    if (local) {
      try {
        storedUsers = JSON.parse(local);
      } catch (e) {
        storedUsers = [];
      }
    }
    const userMap = new Map<string, any>();
    for (const u of DEFAULT_SYSTEM_USERS) {
      userMap.set(u.username.toLowerCase(), u);
    }
    for (const u of storedUsers) {
      if (u && u.username) {
        userMap.set(u.username.toLowerCase(), u);
      }
    }
    return Array.from(userMap.values());
  };

  // Save users database
  const saveRegisteredUsers = (users: any[]) => {
    localStorage.setItem('cp_users', JSON.stringify(users));
  };

  // Instant 1-click persona switch from Welcome Gateway (enforcing Supabase auth in live mode)
  const handleQuickPersonaLogin = async (username: string, role: string) => {
    setAuthError(null);
    setAuthNotification(null);

    // In live mode, verify real Supabase session or require genuine authentication
    if (!envValidation.config.isMock) {
      try {
        setAuthSubmitting(true);
        const session = await services.auth.login(username, 'password123');
        setUserName(session.user?.fullName || username);
        setUserRole(role);
        localStorage.setItem('cp_uname', username);
        localStorage.setItem('cp_urole', role);
        setScreen('dashboard');
      } catch (err: any) {
        setAuthError(
          `Security Notice: Development personas cannot bypass Supabase authentication in live mode. Please sign in with your verified Supabase credentials or Continue with Google.`
        );
      } finally {
        setAuthSubmitting(false);
      }
      return;
    }

    setUserName(username);
    setUserRole(role);
    localStorage.setItem('cp_uname', username);
    localStorage.setItem('cp_urole', role);
    services.auth.login(username).catch(console.error);
    setScreen('dashboard');
  };

  // Enforce stricter password requirements
  const validatePasswordStrength = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter (A-Z).";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter (a-z).";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one numeric digit (0-9).";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character (e.g. !, @, #, $, %, ^, &, *).";
    }
    return null;
  };

  // Phase 2.5: Real OAuth & Email Auth Handlers
  const handleGoogleOAuth = async () => {
    setAuthError(null);
    setAuthNotification(null);
    setOauthLoading('google');
    try {
      if (envValidation.config.isMock) {
        await services.auth.signInWithOAuth('google');
        setUserName('Elena Rostova');
        setUserRole('Line Producer');
        localStorage.setItem('cp_uname', 'Elena Rostova');
        localStorage.setItem('cp_urole', 'Line Producer');
        setScreen('dashboard');
        return;
      }

      const result = await services.auth.signInWithOAuth('google');
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      console.error('[Google OAuth Error]:', err);
      const msg = err.message || '';
      if (msg.includes('Unsupported provider') || msg.includes('provider is not enabled') || msg.includes('validation_failed')) {
        setAuthError('Google Sign-In is BLOCKED: Provider is not yet enabled in your Supabase Project. Please configure your Google Client ID & Secret in Supabase Dashboard (Authentication ➔ Providers ➔ Google).');
      } else {
        setAuthError(`Google Sign-In failed: ${msg}`);
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleAppleOAuth = async () => {
    setAuthError(null);
    setAuthNotification(null);
    setOauthLoading('apple');
    try {
      if (envValidation.config.isMock) {
        await services.auth.signInWithOAuth('apple');
        setUserName('Kira Vance');
        setUserRole('Director');
        localStorage.setItem('cp_uname', 'Kira Vance');
        localStorage.setItem('cp_urole', 'Director');
        setScreen('dashboard');
        return;
      }

      const result = await services.auth.signInWithOAuth('apple');
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      console.error('[Apple OAuth Error]:', err);
      const msg = err.message || '';
      if (msg.includes('Unsupported provider') || msg.includes('provider is not enabled') || msg.includes('validation_failed')) {
        setAuthError('Apple Sign-In is BLOCKED: Provider is not yet enabled in your Supabase Project. Please configure your Apple Services ID, Team ID, Key ID & Private Key in Supabase Dashboard (Authentication ➔ Providers ➔ Apple).');
      } else {
        setAuthError(`Apple Sign-In failed: ${msg}`);
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setAuthError('Please enter your email to receive recovery instructions.');
      return;
    }
    setForgotSubmitting(true);
    setAuthError(null);
    try {
      const res = await services.auth.resetPassword(forgotEmail.trim());
      setAuthNotification({
        type: 'success',
        message: res.message || 'Password reset link dispatched! Check your email inbox.',
      });
      setShowForgotPassword(false);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to dispatch password recovery email.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  // Real Email Authentication (Sign In & Registration)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotification(null);

    const email = inputName.trim();
    if (!email) {
      setAuthError("Email address is required.");
      return;
    }

    const password = inputPassword;
    if (!password) {
      setAuthError("Password is required.");
      return;
    }

    setAuthSubmitting(true);
    try {
      if (authMode === 'sign-up') {
        const strengthError = validatePasswordStrength(password);
        if (strengthError) {
          setAuthError(strengthError);
          setAuthSubmitting(false);
          return;
        }
        if (password !== inputConfirmPassword) {
          setAuthError("Password confirmation does not match!");
          setAuthSubmitting(false);
          return;
        }

        const fullName = inputFullName.trim() || email.split('@')[0];
        const session = await services.auth.register(email, password, fullName);

        if (session.user) {
          setUserName(session.user.fullName);
          localStorage.setItem('cp_uname', session.user.fullName);
          setScreen('dashboard');
        } else {
          setAuthNotification({
            type: 'info',
            message: 'Registration initiated! If email confirmation is enabled on your Supabase project, check your inbox to confirm your account before logging in.'
          });
          setAuthMode('sign-in');
        }
      } else {
        // Sign-in
        const session = await services.auth.login(email, password);
        if (session.user) {
          setUserName(session.user.fullName);
          localStorage.setItem('cp_uname', session.user.fullName);
          setScreen('dashboard');
        }
      }
    } catch (err: any) {
      console.error('[SceneOS Auth Error]:', err);
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials')) {
        setAuthError('Invalid email or password. Please verify your credentials or register a new account.');
      } else if (msg.includes('Email not confirmed')) {
        setAuthError('Email address has not been confirmed yet. Please verify your email via the confirmation link or disable email confirmations in Supabase (Authentication ➔ Providers ➔ Email ➔ Confirm email).');
      } else if (msg.includes('User already registered')) {
        setAuthError('An account with this email address already exists. Please sign in instead.');
      } else {
        setAuthError(msg.replace('Supabase Auth Error: ', ''));
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Google OAuth login simulator
  const handleContinueWithGoogle = () => {
    setAuthError(null);
    setGoogleError(null);
    setGoogleAuthStep('chooser');
    setGoogleSelectedEmail('');
    setGoogleSelectedDisplayName('');
    setGoogleUsernameInput('');
    setGooglePasswordInput('');
    setGoogleConfirmPasswordInput('');
    setShowGoogleChooser(true);
    setGoogleEmailInput('');
    setShowCustomGoogleInput(false);
  };

  const handleSelectGoogleAccount = (email: string, displayName: string) => {
    setAuthError(null);
    setGoogleError(null);
    const users = getRegisteredUsers();
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists with this googleEmail
    const existingUser = users.find((u: any) => 
      u.googleEmail && u.googleEmail.toLowerCase() === normalizedEmail
    );

    setGoogleSelectedEmail(email);
    setGoogleSelectedDisplayName(displayName);

    if (existingUser) {
      // Prompt for password verification to fulfill "enforce password protection for google account sign-ins too"
      setGoogleAuthStep('verify');
      setGooglePasswordInput('');
    } else {
      // Prompt for registration (asks for a custom username instead of registering the email as username)
      setGoogleAuthStep('register');
      const prefix = email.split('@')[0];
      let suggested = prefix;
      let counter = 1;
      while (users.some((u: any) => u.username.toLowerCase() === suggested.toLowerCase())) {
        suggested = `${prefix}${counter}`;
        counter++;
      }
      setGoogleUsernameInput(suggested);
      setGooglePasswordInput('');
      setGoogleConfirmPasswordInput('');
    }
  };

  const handleGoogleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);

    const username = googleUsernameInput.trim();
    if (!username) {
      setGoogleError("Username is required.");
      return;
    }

    const users = getRegisteredUsers();
    if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
      setGoogleError("This username is already taken. Please choose another.");
      return;
    }

    const password = googlePasswordInput;
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setGoogleError(strengthError);
      return;
    }

    if (password !== googleConfirmPasswordInput) {
      setGoogleError("Password confirmation does not match!");
      return;
    }

    // Create new Google-linked user
    const newUser = {
      username: username,
      password: password,
      role: "Executive Producer",
      isGoogle: true,
      googleEmail: googleSelectedEmail,
      displayName: googleSelectedDisplayName
    };

    users.push(newUser);
    saveRegisteredUsers(users);

    // Log them in
    setUserName(username);
    setUserRole("Executive Producer");
    localStorage.setItem('cp_uname', username);
    localStorage.setItem('cp_urole', "Executive Producer");
    
    // Reset states and close modal
    setScreen('dashboard');
    setShowGoogleChooser(false);
    setGoogleAuthStep('chooser');
    setGoogleSelectedEmail('');
    setGoogleSelectedDisplayName('');
  };

  const handleGoogleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);

    const users = getRegisteredUsers();
    const normalizedEmail = googleSelectedEmail.toLowerCase();
    const user = users.find((u: any) => 
      u.googleEmail && u.googleEmail.toLowerCase() === normalizedEmail
    );

    if (!user) {
      setGoogleError("Account mapping error. Please select account again.");
      setGoogleAuthStep('chooser');
      return;
    }

    if (user.password !== googlePasswordInput) {
      setGoogleError("Incorrect password. Please try again.");
      return;
    }

    // Verification successful! Log them in
    setUserName(user.username);
    setUserRole(user.role || "Executive Producer");
    localStorage.setItem('cp_uname', user.username);
    localStorage.setItem('cp_urole', user.role || "Executive Producer");

    // Reset states and close modal
    setScreen('dashboard');
    setShowGoogleChooser(false);
    setGoogleAuthStep('chooser');
    setGoogleSelectedEmail('');
    setGoogleSelectedDisplayName('');
  };

  const handleCanonicalSignOut = async () => {
    try {
      if (projectLogout) {
        await projectLogout();
      } else {
        await services.auth.logout();
      }
    } catch (err) {
      console.error('[SceneOS Auth] Error during logout:', err);
    }
    setUserName('');
    setInputPassword('');
    setInputConfirmPassword('');
    setUserRole('Line Producer');
    localStorage.removeItem('cp_uname');
    localStorage.removeItem('cp_urole');
    localStorage.removeItem('sceneos_active_project_id');
    setScreen('welcome');
    setShowLogoutModal(false);
    setShowProfileModal(false);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    handleCanonicalSignOut();
  };

  const confirmLogout = () => {
    handleCanonicalSignOut();
  };

  const toggleProjectDesignation = (role: string) => {
    if (!activeProject) return;
    
    // Lock Neon Dreams strictly for Kira Vance as creative director
    if (activeProject.id.includes('neon-dreams') || activeProject.title.toLowerCase().includes('neon dreams')) {
      setDesignationWarningMessage("System Lock: Kira Vance is the registered creative Director of Neon Dreams. This fundamental pipeline designation cannot be altered.");
      return;
    }

    const currentDesignations = activeProject.userDesignations || [];
    let updated: string[];
    if (currentDesignations.includes(role)) {
      if (currentDesignations.length <= 1) {
        setDesignationWarningMessage("You must retain at least one project designation. Action canceled.");
        return;
      }
      updated = currentDesignations.filter(r => r !== role);
    } else {
      updated = [...currentDesignations, role];
    }

    const joinedRoles = updated.join(', ');
    setUserRole(joinedRoles);
    localStorage.setItem('cp_urole', joinedRoles);

    // Sync corresponding crew member on first phase, and update designations in one single payload
    const updatedPhases = activeProject.phases.map((p, idx) => {
      if (idx === 0) {
        return {
          ...p,
          crew: p.crew.map(c => 
            c.name === (userName || 'Lead Creator') ? { ...c, role: joinedRoles } : c
          )
        };
      }
      return p;
    });

    const modifiedProject = {
      ...activeProject,
      userDesignation: joinedRoles,
      userDesignations: updated,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    const finalProject = recalculateSchedule(modifiedProject);
    handleUpdateProjectDirect(finalProject);
  };

  // Quick select an existing project template
  const handleSelectProject = (id: string) => {
    switchProject(id);
    const proj = projects.find(p => p.id === id);
    if (proj) {
      if (proj.startDate && parseInt(proj.startDate.split('-')[0], 10) >= 2020) {
        setSimulatedDate(proj.startDate); // Sync simulation clock to initial project date for logical consistency
      } else {
        setSimulatedDate(formatDate(new Date()));
      }
      let activeDesignations = proj.userDesignations && proj.userDesignations.length > 0
        ? proj.userDesignations
        : (proj.userDesignation ? proj.userDesignation.split(',').map(s => s.trim()).filter(Boolean) : []);
      
      // Force-fix the Kira Neon Dreams contradiction
      if (id.includes('neon-dreams') || (proj.title && proj.title.toLowerCase().includes('neon dreams'))) {
        activeDesignations = ['Director'];
      }

      const activeDesignationString = activeDesignations.join(', ') || 'Line Producer';
      setUserRole(activeDesignationString);
      localStorage.setItem('cp_urole', activeDesignationString);
    }
    setScreen('editor');
  };

  const handleDeleteProject = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingProjectId(id);
  };

  const handleProceedDelete = async () => {
    if (!deletingProjectId) return;
    const proj = projects.find(p => p.id === deletingProjectId);
    if (!proj) {
      setDeletingProjectId(null);
      return;
    }

    // 1. Create a structured JSON string of full project pipeline state, and trigger automatic download (skip for walkthrough)
    if (!proj.isWalkthrough) {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(proj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${proj.title.replace(/\s+/g, '_')}_backup_calibration.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    // 2. Authoritative deletion through ProjectService
    await deleteProjectService(deletingProjectId);
    setDeletingProjectId(null);
  };

  const handleGlobalToggleActivity = (projectId: string, phaseId: string, activityId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const updatedPhases = proj.phases.map(ph => {
      if (ph.id === phaseId) {
        const updatedActs = ph.activities.map(a => {
          if (a.id === activityId) {
            return { ...a, completed: !a.completed };
          }
          return a;
        });
        return { ...ph, activities: updatedActs };
      }
      return ph;
    });
    updateProjectService(projectId, { phases: updatedPhases });
  };

  // Compute global milestones for the Master Schedule dashboard tab
  const allGlobalMilestones = React.useMemo(() => {
    const list: Array<{
      projectId: string;
      projectTitle: string;
      phaseId: string;
      phaseName: string;
      phaseCategory: 'pre' | 'prod' | 'post';
      activityId: string;
      activityName: string;
      date: string;
      completed: boolean;
    }> = [];

    projects.forEach(p => {
      let phaseStartOffset = 0;
      p.phases.forEach(ph => {
        const numActs = ph.activities.length;
        ph.activities.forEach((act, idx) => {
          const actOffset = phaseStartOffset + (numActs > 1 ? (idx / (numActs - 1)) * ph.durationDays : ph.durationDays / 2);
          const actDate = addDays(p.startDate, Math.round(actOffset));
          
          list.push({
            projectId: p.id,
            projectTitle: p.title,
            phaseId: ph.id,
            phaseName: ph.name,
            phaseCategory: ph.category as 'pre' | 'prod' | 'post',
            activityId: act.id,
            activityName: act.name,
            date: actDate,
            completed: act.completed,
          });
        });
        phaseStartOffset += ph.durationDays;
      });
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [projects]);

  // Compute milestones specific to the current active project
  const activeMilestones = React.useMemo(() => {
    if (!activeProject) return [];
    return allGlobalMilestones.filter(m => m.projectId === activeProject.id);
  }, [allGlobalMilestones, activeProject]);

  // Initialize a new production via authoritative ProjectService
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await createProjectService({
        title: newTitle.trim(),
        logline: newLogline.trim() || 'No logline added.',
        director: newDirector.trim() || (userName || 'Director'),
        producer: '',
        status: 'pre-production',
        budgetTotal: 2500000,
        dailyBurnCap: 30000,
        startDate: newStartDate,
        finalEndDate: newIsFixed ? newEndDate : addDays(newStartDate, 74),
        suggestedEndDate: addDays(newStartDate, 74),
        isEndDateFixed: newIsFixed,
        productionType: 'Feature Film',
        productionCompany: '',
        companyName: '',
        phases: [],
        screenplayVersions: [],
        elementCatalog: [],
        sceneBreakdownAssociations: [],
        footageBackups: [],
        storyboardRevisions: [],
        constraints: {
          budgetLimit: 2500000,
          dailyBurnRateCap: 30000,
          screenplayLocked: true,
          castAvailabilityDays: 45,
          permitLeadTimeDays: 14,
          targetRating: 'PG-13',
          weatherContingencyBuffer: 7,
          postOverheadRatio: 15
        },
      });

      setSimulatedDate(created.startDate || newStartDate);
      setUserRole(newDesignations.join(', ') || 'Line Producer');
      localStorage.setItem('cp_urole', newDesignations.join(', ') || 'Line Producer');
      
      // Reset wizard variables
      setNewTitle('');
      setNewLogline('');
      setNewDirector('');
      setScreen('editor');
    } catch (err: any) {
      console.error('Failed to create project:', err);
    }
  };

  // Reorder Phases Up and cascade dates
  const handleMovePhaseUp = (phaseIndex: number) => {
    if (!activeProject || phaseIndex === 0) return;
    const updatedPhases = [...activeProject.phases];
    // swap
    const temp = updatedPhases[phaseIndex];
    updatedPhases[phaseIndex] = updatedPhases[phaseIndex - 1];
    updatedPhases[phaseIndex - 1] = temp;

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    const finalProject = recalculateSchedule(modifiedProject);
    handleUpdateProjectDirect(finalProject);
  };

  // Reorder Phases Down and cascade dates
  const handleMovePhaseDown = (phaseIndex: number) => {
    if (!activeProject || phaseIndex === activeProject.phases.length - 1) return;
    const updatedPhases = [...activeProject.phases];
    // swap
    const temp = updatedPhases[phaseIndex];
    updatedPhases[phaseIndex] = updatedPhases[phaseIndex + 1];
    updatedPhases[phaseIndex + 1] = temp;

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    const finalProject = recalculateSchedule(modifiedProject);
    handleUpdateProjectDirect(finalProject);
  };

  // Modify individual phase duration (days selector)
  const handleAdjustPhaseDays = (phaseId: string, value: number) => {
    if (!activeProject) return;
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        return { ...p, durationDays: Math.max(1, value) };
      }
      return p;
    });

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    // Calculate dates with shrinking / slide logic
    const finalProject = recalculateSchedule(modifiedProject);
    handleUpdateProjectDirect(finalProject);
  };

  // Modify any other attribute of an individual phase (e.g. importance)
  const handleUpdatePhase = (phaseId: string, updatedData: Partial<FilmPhase>) => {
    if (!activeProject) return;
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        return { ...p, ...updatedData };
      }
      return p;
    });

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    // Calculate dates with shrinking / slide logic
    const finalProject = recalculateSchedule(modifiedProject);
    handleUpdateProjectDirect(finalProject);
  };

  // Add customized task/activity into specified phase
  const handleAddActivity = (phaseId: string, activityName: string) => {
    if (!activeProject || !activityName.trim()) return;
    
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        const newAct: Activity = {
          id: 'act-' + Date.now() + Math.random().toString(36).substr(2, 4),
          name: activityName.trim(),
          completed: false,
          estimatedDays: 3
        };
        return {
          ...p,
          activities: [...p.activities, newAct]
        };
      }
      return p;
    });

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    handleUpdateProjectDirect(modifiedProject);
  };

  // Add customized activity with specific configurations (like priorities and custom dates)
  const handleAddActivityWithDetails = (phaseId: string, customAct: Activity) => {
    if (!activeProject) return;

    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          activities: [...p.activities, customAct]
        };
      }
      return p;
    });

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    handleUpdateProjectDirect(modifiedProject);
  };

  // Toggle tasks completion inside a phase
  const handleToggleActivity = (phaseId: string, activityId: string) => {
    if (!activeProject) return;
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        const updatedActs = p.activities.map(a => {
          if (a.id === activityId) {
            return { ...a, completed: !a.completed };
          }
          return a;
        });
        return {
          ...p,
          activities: updatedActs
        };
      }
      return p;
    });

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    handleUpdateProjectDirect(modifiedProject);
  };

  // Remove activity from a phase
  const handleRemoveActivity = (phaseId: string, activityId: string) => {
    if (!activeProject) return;
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          activities: p.activities.filter(a => a.id !== activityId)
        };
      }
      return p;
    });

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    handleUpdateProjectDirect(modifiedProject);
  };

  // Update activity details (timeline, checklists, name)
  const handleUpdateActivity = (phaseId: string, activityId: string, updatedData: Partial<Activity>) => {
    if (!activeProject) return;
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        const updatedActs = p.activities.map(a => {
          if (a.id === activityId) {
            return { ...a, ...updatedData };
          }
          return a;
        });
        return {
          ...p,
          activities: updatedActs
        };
      }
      return p;
    });

    const modifiedProject = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    handleUpdateProjectDirect(modifiedProject);
  };

  // Change project constraints variables
  const handleUpdateConstraints = (newConstraints: FilmProject['constraints']) => {
    if (!activeProject) return;
    const modifiedProject = {
      ...activeProject,
      constraints: newConstraints,
      updatedAt: new Date().toISOString()
    };
    
    // Check constraints and adapt
    handleUpdateProjectDirect(modifiedProject);
  };

  // Toggle End Date fixed state
  const handleToggleEndDateFixed = () => {
    if (!activeProject) return;
    const modified = {
      ...activeProject,
      isEndDateFixed: !activeProject.isEndDateFixed,
      updatedAt: new Date().toISOString()
    };
    const calculated = recalculateSchedule(modified);
    handleUpdateProjectDirect(calculated);
  };

  // Edit final end date manually
  const handleEditFinalEndDate = (val: string) => {
    if (!activeProject) return;
    const modified = {
      ...activeProject,
      finalEndDate: val,
      updatedAt: new Date().toISOString()
    };
    const calculated = recalculateSchedule(modified);
    handleUpdateProjectDirect(calculated);
  };

  // Add customized phase to active three-phase pipeline category
  const handleAddPhase = (category: 'pre' | 'prod' | 'post', name: string, durationDays: number) => {
    if (!activeProject || !name.trim()) return;

    let color = '';
    let textLightColor = '';
    let textDarkColor = '';

    if (category === 'pre') {
      color = 'bg-cyan-950/80 border-cyan-550/40 hover:bg-cyan-900/40';
      textLightColor = 'text-cyan-400';
      textDarkColor = 'text-cyan-200';
    } else if (category === 'prod') {
      color = 'bg-indigo-950/80 border-indigo-550/30 hover:bg-indigo-900/40';
      textLightColor = 'text-indigo-400';
      textDarkColor = 'text-indigo-200';
    } else {
      color = 'bg-rose-950/80 border-rose-550/40 hover:bg-rose-900/40';
      textLightColor = 'text-rose-400';
      textDarkColor = 'text-rose-200';
    }

    const newPhase: FilmPhase = {
      id: 'phase-' + Date.now() + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      category,
      color,
      textLightColor,
      textDarkColor,
      durationDays: Math.max(1, durationDays),
      startDate: '',
      endDate: '',
      status: 'pending',
      activities: [],
      crew: []
    };

    const modified = {
      ...activeProject,
      phases: [...activeProject.phases, newPhase],
      updatedAt: new Date().toISOString()
    };

    const calculated = recalculateSchedule(modified);
    handleUpdateProjectDirect(calculated);
  };

  // Remove customized phase from active pipeline
  const handleDeletePhase = (phaseId: string) => {
    if (!activeProject) return;
    if (activeProject.phases.length <= 1) {
      alert("At least one operational phase must be maintained!");
      return;
    }
    const modified = {
      ...activeProject,
      phases: activeProject.phases.filter(p => p.id !== phaseId),
      updatedAt: new Date().toISOString()
    };
    const calculated = recalculateSchedule(modified);
    handleUpdateProjectDirect(calculated);
  };

  // Edit project metadata (Title, Logline, Director, Base Start Date, technicians)
  const handleUpdateProjectMeta = (meta: Partial<FilmProject>) => {
    if (!activeProject) return;
    const modified = {
      ...activeProject,
      ...meta,
      updatedAt: new Date().toISOString()
    };
    if (meta.userDesignation) {
      setUserRole(meta.userDesignation);
      localStorage.setItem('cp_urole', meta.userDesignation);
    }
    const calculated = recalculateSchedule(modified);
    handleUpdateProjectDirect(calculated);
  };

  const handleSaveTitle = () => {
    if (editingTitleValue.trim() && activeProject) {
      handleUpdateProjectMeta({ title: editingTitleValue.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleSaveLogline = () => {
    if (editingLoglineValue.trim() && activeProject) {
      handleUpdateProjectMeta({ logline: editingLoglineValue.trim() });
    }
    setIsEditingLogline(false);
  };

  const handleSaveDirector = () => {
    if (editingDirectorValue.trim() && activeProject) {
      handleUpdateProjectMeta({ director: editingDirectorValue.trim() });
    }
    setIsEditingDirector(false);
  };

  const handleSaveProducer = () => {
    if (editingProducerValue.trim() && activeProject) {
      handleUpdateProjectMeta({ producer: editingProducerValue.trim() });
    }
    setIsEditingProducer(false);
  };

  const handleSaveWriter = () => {
    if (editingWriterValue.trim() && activeProject) {
      handleUpdateProjectMeta({ writer: editingWriterValue.trim() });
    }
    setIsEditingWriter(false);
  };

  const handleSaveCinematographer = () => {
    if (editingCinematographerValue.trim() && activeProject) {
      handleUpdateProjectMeta({ cinematographer: editingCinematographerValue.trim() });
    }
    setIsEditingCinematographer(false);
  };

  // Add crew member (Rolodex)
  const handleAddCrew = (phaseId: string, member: Omit<CrewMember, 'id'>) => {
    if (!activeProject) return;
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        const newMember: CrewMember = {
          id: 'c-' + Date.now() + Math.random().toString(36).substr(2, 4),
          ...member
        };
        return {
          ...p,
          crew: [...p.crew, newMember]
        };
      }
      return p;
    });

    const modified = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    handleUpdateProjectDirect(modified);
  };

  // Remove crew member
  const handleDeleteCrew = (phaseId: string, crewId: string) => {
    if (!activeProject) return;
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          crew: p.crew.filter(c => c.id !== crewId)
        };
      }
      return p;
    });

    const modified = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    handleUpdateProjectDirect(modified);
  };

  // Change contract status on rolodex
  const handleUpdateCrewStatus = (phaseId: string, crewId: string, status: CrewMember['status']) => {
    if (!activeProject) return;
    const updatedPhases = activeProject.phases.map(p => {
      if (p.id === phaseId) {
        const updatedCrew = p.crew.map(c => {
          if (c.id === crewId) {
            return { ...c, status };
          }
          return c;
        });
        return { ...p, crew: updatedCrew };
      }
      return p;
    });

    const modified = {
      ...activeProject,
      phases: updatedPhases,
      updatedAt: new Date().toISOString()
    };

    handleUpdateProjectDirect(modified);
  };

  // Update handlers for Film Content & Backups System
  const handleUpdateFootageBackups = (backups: FootageBackup[]) => {
    if (!activeProject) return;
    const modified: FilmProject = {
      ...activeProject,
      footageBackups: backups,
      updatedAt: new Date().toISOString()
    };
    handleUpdateProjectDirect(modified);
  };

  const handleUpdateScreenplayVersions = (versions: ScreenplayVersion[]) => {
    if (!activeProject) return;
    const modified: FilmProject = {
      ...activeProject,
      screenplayVersions: versions,
      updatedAt: new Date().toISOString()
    };
    handleUpdateProjectDirect(modified);
  };

  const handleUpdateStoryboardRevisions = (storyboards: StoryboardRevision[]) => {
    if (!activeProject) return;
    const modified: FilmProject = {
      ...activeProject,
      storyboardRevisions: storyboards,
      updatedAt: new Date().toISOString()
    };
    handleUpdateProjectDirect(modified);
  };

  // Export current active project state as a downloadable JSON file
  const handleExportProjectJson = () => {
    if (!activeProject) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeProject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${activeProject.title.replace(/\s+/g, '_')}_config_state.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Drag-and-drop / select files file parsing
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleJsonStringImport = async (rawText: string) => {
    try {
      const parsed = JSON.parse(rawText);
      // Crude validation
      if (!parsed || !parsed.id || !parsed.title || !Array.isArray(parsed.phases)) {
        throw new Error("Missing required fields. File is not a valid CinePipeline project file.");
      }
      
      const [sanitized] = sanitizeProjects([parsed]);
      if (!sanitized) {
        throw new Error("Sanitization failed. File contains invalid CinePipeline configuration.");
      }
      
      // Set owner to the active logged-in user
      sanitized.owner = userName;
      
      // Authoritative creation and switch via ProjectService
      const created = await createProjectService(sanitized);
      switchProject(created.id);
      setSimulatedDate(created.startDate || sanitized.startDate);
      setScreen('editor');
      setUploadError(null);
    } catch (err: any) {
      setUploadError(`Failed to parse config file: ${err.message || err}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleJsonStringImport(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleJsonStringImport(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const isDark = theme.startsWith('dark');
  const isDashboardScreen = screen === 'dashboard' || (screen === 'editor' && !contextActiveProject);

  return (
    <div className={`relative font-sans antialiased transition-colors duration-250 isolate ${
      screen === 'editor' && workspaceTab !== 'overview'
        ? "h-screen h-[100dvh] max-h-screen max-h-[100dvh] overflow-hidden flex flex-col"
        : "min-h-screen"
    } ${
      isDark 
        ? "bg-transparent text-zinc-100 selection:bg-cyan-500/20 selection:text-cyan-200" 
        : "bg-[#F3F5F4] text-zinc-800 selection:bg-indigo-100 selection:text-zinc-900"
    }`}>
      {/* 1. Fluid Living Ambient Background (Continuously Evolving Gradients) */}
      <LivingAmbientBackground isDark={isDark} activeTab={isDashboardScreen ? 'dashboard' : workspaceTab} />

      {/* 2. SceneOS Dynamic Inverting Orb Cursor */}
      <DynamicOrbCursor />
      
      {/* Environment Config Warnings / Errors Banner */}
      {envValidation.errors.length > 0 && (
        <div className="bg-rose-950/90 border-b border-rose-500/50 px-4 py-2 text-rose-200 text-xs font-mono flex items-center justify-between z-50 sticky top-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span><strong>Configuration Error:</strong> {envValidation.errors.join(' | ')}</span>
          </div>
        </div>
      )}

      {/* HEADER BAR FOR LOGGED USERS */}
      {screen !== 'welcome' && (() => {
        const isScreenplayTab = workspaceTab === 'screenplay';
        const isBreakdownTab = workspaceTab === 'breakdown';
        const isVisualizeTab = workspaceTab === 'visualize';
        const isProductionTab = workspaceTab === 'production';
        const isVaultTab = workspaceTab === 'assets' || workspaceTab === 'vault';

        const moduleDisplayName = isScreenplayTab
          ? 'Screenplay'
          : isBreakdownTab
          ? 'Breakdown'
          : isVisualizeTab
          ? 'Visualise'
          : isProductionTab
          ? 'Production'
          : isVaultTab
          ? 'Vault'
          : 'Overview';

        const moduleBadgeDotClass = isDark
          ? isScreenplayTab
            ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.85)]'
            : isBreakdownTab
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.85)]'
            : isVisualizeTab
            ? 'bg-[#F5F000] shadow-[0_0_8px_rgba(245,240,0,0.85)]'
            : isProductionTab
            ? 'bg-[#FF1744] shadow-[0_0_8px_rgba(255,23,68,0.85)]'
            : isVaultTab
            ? 'bg-[#B45CFF] shadow-[0_0_8px_rgba(180,92,255,0.85)]'
            : 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
          : isScreenplayTab
            ? 'bg-cyan-600 shadow-[0_0_8px_rgba(8,145,178,0.6)]'
            : isBreakdownTab
            ? 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.6)]'
            : isVisualizeTab
            ? 'bg-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.6)]'
            : isProductionTab
            ? 'bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.6)]'
            : isVaultTab
            ? 'bg-purple-600 shadow-[0_0_8px_rgba(124,58,237,0.6)]'
            : 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]';

        const headerBorderAndBgClass = isDark
          ? isScreenplayTab
            ? 'border-cyan-500/20 bg-[#070914]/85'
            : isBreakdownTab
            ? 'border-emerald-500/20 bg-[#020B06]/85'
            : isVisualizeTab
            ? 'border-[#F5F000]/20 bg-[#0A0B0D]/85'
            : isProductionTab
            ? 'border-[#FF1744]/20 bg-[#10090D]/85'
            : isVaultTab
            ? 'border-[#B45CFF]/20 bg-[#10091B]/85'
            : 'border-zinc-800/80 bg-slate-950/85'
          : isScreenplayTab
            ? 'border-cyan-600/15 bg-white/90 shadow-sm shadow-cyan-100/50'
            : isBreakdownTab
            ? 'border-emerald-600/15 bg-white/90 shadow-sm shadow-emerald-100/50'
            : isVisualizeTab
            ? 'border-amber-500/20 bg-white/90 shadow-sm shadow-amber-100/50'
            : isProductionTab
            ? 'border-rose-600/15 bg-white/90 shadow-sm shadow-rose-100/50'
            : isVaultTab
            ? 'border-purple-600/15 bg-white/90 shadow-sm shadow-purple-100/50'
            : 'border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/50';

        return (
        <header className={`shrink-0 border-b sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 ${headerBorderAndBgClass}`}>
          <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile menu toggle for sidebar in editor screen */}
              {screen === 'editor' && (
                <button
                  type="button"
                  id="btn-open-mobile-sidebar"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  aria-label="Open navigation sidebar"
                  className={`md:hidden p-2 rounded-xl border transition cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:text-slate-950 shadow-sm'
                  }`}
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setScreen('dashboard')}>
                <PlanLogo className={`h-6 text-current transition-all duration-300 ${
                  workspaceTab === 'production' 
                    ? isDark ? 'drop-shadow-[0_0_10px_rgba(255,23,68,0.55)]' : 'drop-shadow-[0_0_8px_rgba(225,29,72,0.3)]'
                    : workspaceTab === 'visualize'
                      ? isDark ? 'drop-shadow-[0_0_10px_rgba(245,240,0,0.45)]' : 'drop-shadow-[0_0_8px_rgba(217,119,6,0.3)]'
                      : (workspaceTab === 'assets' || workspaceTab === 'vault')
                        ? isDark ? 'drop-shadow-[0_0_10px_rgba(180,92,255,0.50)]' : 'drop-shadow-[0_0_8px_rgba(124,58,237,0.3)]'
                        : isBreakdownTab
                          ? isDark ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.50)]' : 'drop-shadow-[0_0_8px_rgba(5,150,105,0.3)]'
                          : isScreenplayTab
                            ? isDark ? 'drop-shadow-[0_0_10px_rgba(6,182,212,0.50)]' : 'drop-shadow-[0_0_8px_rgba(8,145,178,0.3)]'
                            : ''
                }`} />
              </div>

              {/* Active Workspace Project Switcher */}
              {activeProject && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProjectSwitcher(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer select-none ${
                      isDark
                        ? workspaceTab === 'production'
                          ? 'bg-[#1A1017]/90 border-[#E63950]/35 hover:border-[#FF1744]/60 text-rose-100 shadow-[0_0_12px_rgba(255,23,68,0.15)]'
                          : workspaceTab === 'visualize'
                            ? 'bg-[#15171A]/90 border-[#FFD34E]/35 hover:border-[#F5F000]/60 text-amber-100 shadow-[0_0_12px_rgba(245,240,0,0.15)]'
                            : (workspaceTab === 'assets' || workspaceTab === 'vault')
                              ? 'bg-[#191126]/90 border-[#B45CFF]/35 hover:border-[#D18AFF]/60 text-purple-100 shadow-[0_0_12px_rgba(180,92,255,0.18)]'
                              : isBreakdownTab
                                ? 'bg-[#021A0F]/90 border-[#10B981]/35 hover:border-[#10B981]/60 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                                : isScreenplayTab
                                  ? 'bg-[#090D22]/90 border-cyan-500/35 hover:border-cyan-400/60 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                                  : 'bg-zinc-900/90 border-zinc-800 hover:border-cyan-500/40 text-zinc-200'
                        : workspaceTab === 'production'
                          ? 'bg-rose-50/90 border-rose-200 hover:border-rose-400 text-rose-950 shadow-sm'
                          : workspaceTab === 'visualize'
                            ? 'bg-amber-50/90 border-amber-200 hover:border-amber-400 text-amber-950 shadow-sm'
                            : (workspaceTab === 'assets' || workspaceTab === 'vault')
                              ? 'bg-purple-50/90 border-purple-200 hover:border-purple-400 text-purple-950 shadow-sm'
                              : isBreakdownTab
                                ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400 text-emerald-950 shadow-sm'
                                : isScreenplayTab
                                  ? 'bg-cyan-50/90 border-cyan-200 hover:border-cyan-400 text-cyan-950 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-indigo-400 text-slate-800 shadow-sm'
                    }`}
                    title="Switch production workspace"
                  >
                    <Film className={`w-3.5 h-3.5 shrink-0 ${
                      workspaceTab === 'production' 
                        ? isDark ? 'text-[#FF1744]' : 'text-rose-600'
                        : workspaceTab === 'visualize'
                          ? isDark ? 'text-[#F5F000]' : 'text-amber-600'
                          : (workspaceTab === 'assets' || workspaceTab === 'vault')
                            ? isDark ? 'text-[#B45CFF]' : 'text-purple-600'
                            : isBreakdownTab
                              ? isDark ? 'text-[#10B981]' : 'text-emerald-600'
                              : isDark ? 'text-cyan-400' : 'text-cyan-700'
                    }`} />
                    <span className="font-semibold truncate max-w-[130px] sm:max-w-[200px]">
                      {activeProject.title}
                    </span>
                    {workspaceRole ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono font-bold ${
                        isDark
                          ? workspaceTab === 'production'
                            ? 'bg-[#65152D]/80 text-[#FF8A9B] border border-[#E63950]/40'
                            : workspaceTab === 'visualize'
                              ? 'bg-[#9C741C]/60 text-[#FFF1A8] border border-[#FFD34E]/40'
                              : (workspaceTab === 'assets' || workspaceTab === 'vault')
                                ? 'bg-[#42156F]/80 text-[#E6C2FF] border border-[#B45CFF]/40'
                                : isBreakdownTab
                                  ? 'bg-[#064E3B]/80 text-[#6EE7B7] border border-[#10B981]/40'
                                  : 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                          : workspaceTab === 'production'
                            ? 'bg-rose-100 text-rose-900 border border-rose-300'
                            : workspaceTab === 'visualize'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : (workspaceTab === 'assets' || workspaceTab === 'vault')
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : isBreakdownTab
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                      }`}>
                        {workspaceRole}
                      </span>
                    ) : activeProject.persistence === 'local' ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono font-bold ${
                        isDark ? 'bg-amber-950/70 text-amber-300 border border-amber-700/60' : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        Local Only
                      </span>
                    ) : null}
                    <ChevronRight className="w-3 h-3 text-slate-500 rotate-90 shrink-0" />
                  </button>

                  {/* Active Module Location Indicator Badge */}
                  {screen === 'editor' && (
                    <div className={`hidden md:flex items-center gap-2 pl-3 border-l ${isDark ? 'border-white/10' : 'border-slate-300'} select-none`}>
                      <span className={`w-2 h-2 rounded-full ${moduleBadgeDotClass} animate-pulse`} />
                      <span className={`text-xs font-semibold tracking-wide ${isDark ? 'text-zinc-300' : 'text-slate-800'}`}>
                        {moduleDisplayName}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5">
              {/* Restrained Presence & Realtime Connection Pill */}
              {activeProject && activeProject.persistence !== 'local' && workspaceRole && (
                <div className="relative">
                  <button
                    type="button"
                    data-testid="collab-presence-pill"
                    onClick={() => setShowPresenceMenu(v => !v)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono transition cursor-pointer ${
                      isDark
                        ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                        : 'bg-zinc-100 border-zinc-250 text-zinc-700 hover:bg-zinc-200'
                    }`}
                    title={
                      realtimeStatus === 'reconnecting'
                        ? 'Collaboration reconnecting...'
                        : realtimeStatus === 'mock'
                          ? 'Offline Mock collaboration session'
                          : 'Active project members online'
                    }
                    aria-label="Collaborators online and connection status"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        realtimeStatus === 'connected'
                          ? 'bg-emerald-400'
                          : realtimeStatus === 'reconnecting' || realtimeStatus === 'connecting'
                            ? 'bg-amber-400'
                            : realtimeStatus === 'mock'
                              ? 'bg-cyan-400'
                              : 'bg-zinc-500'
                      }`}
                    />
                    <span className="hidden lg:inline">
                      {realtimeStatus === 'reconnecting'
                        ? 'Reconnecting'
                        : `${onlineMembers.length} online`}
                    </span>
                  </button>

                  {showPresenceMenu && (
                    <div
                      data-testid="collab-presence-popover"
                      className="absolute right-0 mt-1.5 w-60 rounded-xl border border-white/[0.1] bg-[#101521] shadow-2xl p-3 z-50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/[0.06] pb-1.5">
                        <span>
                          {realtimeStatus === 'mock'
                            ? 'Mock Session Presence'
                            : realtimeStatus === 'connected'
                              ? 'Live Sync Connected'
                              : realtimeStatus === 'reconnecting'
                                ? 'Reconnecting...'
                                : 'Presence'}
                        </span>
                        <span>{onlineMembers.length}</span>
                      </div>
                      {onlineMembers.length === 0 ? (
                        <div className="text-[11px] text-slate-400 py-1">
                          No active presence tracked right now.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {onlineMembers.map(pm => (
                            <div
                              key={pm.userId}
                              className="flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span className="text-slate-100 truncate font-medium">
                                  {pm.fullName}
                                </span>
                              </div>
                              {pm.activeModule && (
                                <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] font-mono text-slate-400 capitalize shrink-0">
                                  {pm.activeModule}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Authoritative Collaboration Navigation (Inbox, Activity, People, Discussions) */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-sm">
                {/* 1. INBOX: Warm Amber / Gold */}
                <button
                  type="button"
                  data-testid="dest-btn-inbox"
                  onClick={() => {
                    if (workspaceTab !== 'overview') {
                      setWorkspaceTab('overview');
                      setCollaborationDestination('inbox');
                    } else {
                      setCollaborationDestination(prev => prev === 'inbox' ? 'home' : 'inbox');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    workspaceTab === 'overview' && collaborationDestination === 'inbox'
                      ? 'bg-amber-500/25 border border-amber-500/60 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                      : 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 border border-transparent'
                  }`}
                  title="Collaboration Inbox"
                >
                  <Inbox className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Inbox</span>
                  {notificationUnreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono font-black shadow-[0_0_6px_rgba(245,158,11,0.6)]">
                      {notificationUnreadCount}
                    </span>
                  )}
                </button>

                {/* 2. ACTIVITY: Electric Teal / Cyan */}
                <button
                  type="button"
                  data-testid="dest-btn-activity"
                  onClick={() => {
                    if (workspaceTab !== 'overview') {
                      setWorkspaceTab('overview');
                      setCollaborationDestination('activity');
                    } else {
                      setCollaborationDestination(prev => prev === 'activity' ? 'home' : 'activity');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    workspaceTab === 'overview' && collaborationDestination === 'activity'
                      ? 'bg-cyan-500/25 border border-cyan-500/60 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                      : 'text-cyan-300/80 hover:text-cyan-200 hover:bg-cyan-500/10 border border-transparent'
                  }`}
                  title="Team Activity Feed"
                >
                  <ActivityIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Activity</span>
                </button>

                {/* 3. PEOPLE: Emerald / Jade */}
                <button
                  type="button"
                  data-testid="dest-btn-people"
                  onClick={() => {
                    if (workspaceTab !== 'overview') {
                      setWorkspaceTab('overview');
                      setCollaborationDestination('people');
                    } else {
                      setCollaborationDestination(prev => prev === 'people' ? 'home' : 'people');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    workspaceTab === 'overview' && collaborationDestination === 'people'
                      ? 'bg-emerald-500/25 border border-emerald-500/60 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                      : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-emerald-500/10 border border-transparent'
                  }`}
                  title="Production Team & People"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">People</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-mono border border-emerald-500/30">
                    {workspaceMembers.length}
                  </span>
                </button>

                {/* 4. DISCUSSIONS: Purple / Violet */}
                <button
                  type="button"
                  data-testid="dest-btn-discussions"
                  onClick={() => {
                    if (workspaceTab !== 'overview') {
                      setWorkspaceTab('overview');
                      setCollaborationDestination('discussions');
                    } else {
                      setCollaborationDestination(prev => prev === 'discussions' ? 'home' : 'discussions');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    workspaceTab === 'overview' && collaborationDestination === 'discussions'
                      ? 'bg-purple-500/25 border border-purple-500/60 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                      : 'text-purple-300/80 hover:text-purple-200 hover:bg-purple-500/10 border border-transparent'
                  }`}
                  title="Team Discussions"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Discussions</span>
                  {discussionUnreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-purple-400 text-slate-950 text-[10px] font-mono font-black shadow-[0_0_6px_rgba(168,85,247,0.6)]">
                      {discussionUnreadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Dynamic Theme Toggle in Header */}
              <button
                type="button"
                onClick={() => setTheme(isDark ? 'light-cinematic' : 'dark-neon')}
                className={`p-1.5 border rounded-lg transition cursor-pointer ${
                  isDark 
                    ? 'bg-zinc-900 border-zinc-800 text-indigo-400 hover:text-white hover:bg-zinc-800' 
                    : 'bg-zinc-50 border-zinc-250 text-indigo-550 hover:text-zinc-950 hover:bg-zinc-100'
                }`}
                title="Switch Light/Dark Terminal view"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Canonical User Account & Session Control */}
              <AccountDropdown
                userName={userName}
                userRole={userRole}
                isDark={isDark}
                onOpenProfile={() => {
                  setSettingsInitialSection('profile');
                  setShowProfileModal(true);
                }}
                onOpenPersonalization={() => {
                  setSettingsInitialSection('appearance');
                  setShowProfileModal(true);
                }}
                onOpenSettings={() => {
                  setSettingsInitialSection('security');
                  setShowProfileModal(true);
                }}
                onSignOut={handleCanonicalSignOut}
                onSwitchPersona={(u, r) => handleQuickPersonaLogin(u, r)}
              />
              </div>
            </div>
        </header>
        );
      })()}

      {/* RENDER ACTIVE SCREEN */}
      <main className={
        screen === 'welcome'
          ? "w-full min-h-screen relative z-10 p-0 m-0"
          : (screen === 'editor' && contextActiveProject) && workspaceTab !== 'overview'
          ? "w-full flex-1 min-h-0 flex flex-col overflow-hidden relative z-10"
          : (screen === 'editor' && contextActiveProject)
          ? "w-full relative z-10"
          : "max-w-7xl mx-auto px-4 py-6 relative z-10"
      }>

        {showProfile ? (
          <UserProfilePage
            userName={userName}
            userRole={userRole}
            isDark={isDark}
            activeProject={activeProject}
            projects={projects}
            onUpdateProfile={(name, role, email, bio, avatar, department) => {
              setUserName(name);
              setUserRole(role);
            }}
            onBack={() => setShowProfile(false)}
          />
        ) : (
          <>
            {/* CINEMATIC WELCOME / ENTRY GATEWAY */}
            {screen === 'welcome' && (
              <CinematicAuthGateway
                onSuccess={(displayName, role) => {
                  setUserName(displayName);
                  if (role) setUserRole(role);
                  localStorage.setItem('cp_uname', displayName);
                  if (role) localStorage.setItem('cp_urole', role);
                  setScreen('dashboard');
                }}
                onSelectPersona={(uname, role) => handleQuickPersonaLogin(uname, role)}
              />
            )}

            {/* FIRST-RUN ONBOARDING WIZARD */}
            {screen === 'onboarding' && (
              <OnboardingWizard
                userName={userName}
                userEmail={workspaceUser?.email}
                onComplete={({ roles, goal, scale }) => {
                  const primaryRole = roles[0] || 'Line Producer';
                  setUserRole(primaryRole);
                  localStorage.setItem('cp_urole', primaryRole);
                  localStorage.setItem(`sceneos_onboarding_completed_${workspaceUser?.id || userName}`, 'true');

                  if (goal === 'start-project') {
                    setScreen('create-project');
                  } else {
                    setScreen('dashboard');
                  }
                }}
                onSkip={() => {
                  localStorage.setItem(`sceneos_onboarding_completed_${workspaceUser?.id || userName}`, 'true');
                  setScreen('dashboard');
                }}
              />
            )}

        {/* DASHBOARD GRID SELECTOR: Start, Continue or Import */}
        {(screen === 'dashboard' || (screen === 'editor' && !contextActiveProject)) && (
          <div className="space-y-6 animate-fade-in" id="dashboard-screen">
            {/* 1. COMPACT BLADE RUNNER-INSPIRED NEO-NOIR WELCOME HEADER */}
            <div 
              id="dashboard-user-hud"
              className={`p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden backdrop-blur-2xl ${
                isDark 
                  ? 'bg-[#0a0d16]/75 border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)]' 
                  : 'bg-white/85 border-slate-200/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)]'
              }`}
            >
              {/* Subtle Atmospheric Radial Reflection */}
              <div
                className="absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-30 transition-opacity"
                style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)' }}
                aria-hidden="true"
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Left: User Identity, Role & Production Count */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border select-none ${
                    isDark
                      ? 'bg-gradient-to-br from-cyan-500/20 to-indigo-600/30 text-cyan-300 border-cyan-500/30 shadow-[0_0_14px_rgba(6,182,212,0.2)]'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    {userName ? userName.charAt(0).toUpperCase() : 'P'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className={`text-lg sm:text-xl font-bold tracking-tight font-sans truncate ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}>
                        Welcome back, {userName || 'Producer'}
                      </h1>
                      <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        isDark
                          ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/30'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {userRole || 'Line Producer'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className={isDark ? 'text-slate-400 font-mono text-[11px]' : 'text-slate-600 font-mono text-[11px]'}>
                        <span className={`font-semibold ${isDark ? 'text-cyan-300' : 'text-indigo-600'}`}>{userProjects.length}</span> Active {userProjects.length === 1 ? 'Production' : 'Productions'}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Studio Workspace &amp; Pipelines
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Direct Actions (Import Configuration & New Production) */}
                <div className="flex items-center gap-2.5 shrink-0" id="quick-actions-bar">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 transition cursor-pointer ${
                      isDark
                        ? 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border-white/10 hover:border-white/20'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    id="panel-import-project"
                    title="Upload a saved SceneOS project backup file (.json)"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Import Configuration</span>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      accept=".json" 
                      onChange={handleFileInputChange} 
                      className="hidden" 
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCreateProject(true)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 via-sky-600 to-indigo-600 hover:brightness-110 flex items-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.35)]"
                    id="panel-start-project"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Production</span>
                  </button>
                </div>
              </div>
            </div>

            {/* UNIFIED FULL-WIDTH DASHBOARD LAYOUT */}
            <div className="space-y-8" id="unified-pipeline-dashboard">
              


              {/* SECTION B: ACTIVE PROJECTS DIRECTORY */}
              <div className="space-y-4">
                <div className={`flex justify-between items-center pb-2 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <Layers className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-indigo-600'}`} />
                    <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      Active Production Pipelines
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      isDark ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-500/25' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {userProjects.length}
                    </span>
                  </div>
                </div>

                {userProjects.length === 0 ? (
                  <div className={`border rounded-3xl p-12 sm:p-16 text-center max-w-xl mx-auto space-y-4 backdrop-blur-2xl ${
                    isDark ? 'bg-[#0a0d16]/75 border-white/[0.08] text-slate-400' : 'bg-white/85 border-slate-200 text-slate-600 shadow-sm'
                  }`}>
                    <FolderOpen className={`w-12 h-12 mx-auto ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                    <div>
                      <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>No active productions</p>
                      <p className="text-xs text-slate-400 mt-1">Get started by creating your first production pipeline or importing an existing script.</p>
                    </div>
                    <div>
                      <button
                        onClick={() => setShowCreateProject(true)}
                        className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 via-sky-600 to-indigo-600 hover:brightness-110 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-[0_0_16px_rgba(6,182,212,0.3)] inline-flex items-center gap-2"
                        id="btn-empty-create-production"
                      >
                        <Plus className="w-4 h-4" /> Create Production
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" id="compartment-active-tracks">
                    {userProjects.map(p => {
                      const phases = p.phases || [];
                      const totalActCount = phases.reduce((sum, ph) => sum + (ph.activities || []).length, 0);
                      const completedActCount = phases.reduce((sum, ph) => sum + (ph.activities || []).filter(a => a.completed).length, 0);
                      const actPercentage = totalActCount > 0 ? Math.round((completedActCount / totalActCount) * 100) : 0;
                      
                      // Active Phase Identification
                      const activePhase = phases.find(ph => ph.status === 'active') || phases.find(ph => ph.status === 'pending') || phases[phases.length - 1];
                      const activePhaseName = activePhase ? activePhase.name : 'Development';

                      // Planned Release / Wrap Target
                      const plannedDate = p.isEndDateFixed
                        ? (p.finalEndDate || 'TBD')
                        : (p.suggestedEndDate || p.targetWrapDate || 'TBD');

                      const primaryDesignation = (p.userDesignations && p.userDesignations[0]) || p.userDesignation || userRole || 'Line Producer';

                      return (
                        <div 
                          key={p.id}
                          id={`active-track-card-${p.id}`}
                          className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between relative group overflow-hidden ${
                            isDark 
                              ? 'bg-[#0a0d16]/75 backdrop-blur-2xl border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:border-cyan-500/40 hover:shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_24px_rgba(6,182,212,0.12)]' 
                              : 'bg-white/85 backdrop-blur-xl border-slate-200/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:border-indigo-400 hover:shadow-md'
                          } p-5 sm:p-6`}
                        >
                          {/* Ambient Corner Illumination */}
                          <div
                            className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-25 group-hover:opacity-40 transition-opacity"
                            style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)' }}
                            aria-hidden="true"
                          />

                          <div className="relative z-10 space-y-4">
                            {/* Card Header: Status, Phase, Rating & Designation */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                {/* Status Pill */}
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-white/[0.04] border-white/10 text-slate-300">
                                  <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'paused' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]'}`} />
                                  <span>{p.status === 'paused' ? 'Paused' : 'Active'}</span>
                                </span>

                                {/* Phase Badge */}
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                                  isDark
                                    ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30'
                                    : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                }`}>
                                  <Film className="w-3 h-3" />
                                  <span>{activePhaseName}</span>
                                </span>

                                {/* Rating */}
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/10 text-slate-400">
                                  {p.constraints?.targetRating || 'PG-13'}
                                </span>
                              </div>

                              {/* User Role Designation */}
                              <span className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                                isDark
                                  ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                {primaryDesignation}
                              </span>
                            </div>

                            {/* Production Title & Director */}
                            <div>
                              <h3 
                                onClick={() => handleSelectProject(p.id)}
                                className={`text-xl font-bold tracking-tight transition-colors line-clamp-1 cursor-pointer ${
                                  isDark ? 'text-white group-hover:text-cyan-300' : 'text-slate-900 group-hover:text-indigo-600'
                                }`}
                              >
                                {p.title}
                              </h3>
                              <p className={`text-xs font-mono mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Directed by: <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{p.director || 'Unassigned'}</span>
                                {p.productionCompany && (
                                  <span className="opacity-80"> · {p.productionCompany}</span>
                                )}
                              </p>
                              
                              {p.logline && (
                                <p className={`text-xs mt-2.5 leading-relaxed line-clamp-2 italic font-serif border-l-2 pl-3 ${
                                  isDark ? 'text-slate-300 border-cyan-500/40' : 'text-slate-600 border-indigo-500/40'
                                }`}>
                                  "{p.logline}"
                                </p>
                              )}
                            </div>

                            {/* Pipeline Progress Indicator */}
                            <div className={`space-y-1.5 pt-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-150'}`}>
                              <div className="flex justify-between items-center text-xs font-mono">
                                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                  Pipeline Progress: <strong className={isDark ? 'text-cyan-300' : 'text-indigo-600'}>{activePhaseName}</strong>
                                </span>
                                <span className={`font-semibold ${isDark ? 'text-cyan-200' : 'text-indigo-700'}`}>
                                  {completedActCount}/{totalActCount} tasks ({actPercentage}%)
                                </span>
                              </div>
                              <div className={`w-full h-1.5 rounded-full overflow-hidden border ${
                                isDark ? 'bg-black/40 border-white/10' : 'bg-slate-100 border-slate-200'
                              }`}>
                                <div 
                                  className="h-full bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                                  style={{ width: `${actPercentage}%` }}
                                />
                              </div>
                            </div>

                            {/* Planned Wrap Target Date */}
                            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 pt-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Target: <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{plannedDate}</strong></span>
                            </div>
                          </div>

                          {/* Card Actions: Scrap & Enter Workspace */}
                          <div className={`relative z-10 mt-5 pt-4 border-t flex items-center gap-3 ${
                            isDark ? 'border-white/[0.06]' : 'border-slate-150'
                          }`}>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteProject(p.id, e)}
                              className={`p-2 rounded-xl border transition flex items-center justify-center shrink-0 cursor-pointer ${
                                isDark
                                  ? 'bg-white/[0.03] hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 border-white/[0.08] hover:border-rose-500/30'
                                  : 'bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200 hover:border-rose-200'
                              }`}
                              title="Scrap Project Pipeline"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectProject(p.id)}
                              className="flex-1 py-2 px-4 bg-gradient-to-r from-cyan-500 via-sky-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs rounded-xl shadow-[0_0_16px_rgba(6,182,212,0.25)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Enter Direct Workspace</span>
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CREATE PROJECT FLOW (Unified Canonical Flow) */}
        {screen === 'create-project' && (
          <CreateProjectModal
            isOpen={true}
            onClose={() => setScreen('dashboard')}
            onCreated={() => setScreen('editor')}
          />
        )}

        {/* ACTIVE PROJECT WORKSPACE SCREEN */}
        {screen === 'editor' && activeProject && metrics && (
          <div
            className={`flex w-full animate-fade-in ${
              workspaceTab !== 'overview'
                ? 'flex-1 min-h-0 h-full max-h-full overflow-hidden'
                : 'min-h-[calc(100vh-57px)] min-h-[calc(100dvh-57px)]'
            }`}
            id="project-workspace-shell"
          >
            {/* 1. PERSISTENT APPLICATION NAVIGATION SIDEBAR */}
            <AppSidebar
              activeTab={workspaceTab}
              onSelectTab={(tabId, subId) => {
                setOverviewReturnContext(null);
                handleWalkthroughIntercept(`tab-${tabId}`, () => {
                  navigateToModule(tabId, subId, { fromOverview: false });
                });
              }}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={handleToggleSidebarCollapse}
              isMobileOpen={isMobileSidebarOpen}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
              isDark={isDark}
              activeProject={activeProject}
              workspaceRole={workspaceRole}
              onOpenProjectSwitcher={() => setShowProjectSwitcher(true)}
              onOpenTeamManagement={() => setShowTeamManagement(true)}
              onBackToDashboard={() => setScreen('dashboard')}
              onToggleTheme={() => setTheme(isDark ? 'light-cinematic' : 'dark-neon')}
            />

            {/* 2. MAIN WORKSPACE CANVAS */}
            <div
              className="flex-1 min-w-0 w-full relative z-10 overflow-hidden h-full max-h-full flex flex-col min-h-0"
              id="project-workspace"
            >
              {/* ELEGANT DOT WAVE BACKGROUND OVERLAY */}
              {workspaceTab === 'overview' && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden z-0 pointer-events-none" style={{ minHeight: "100%" }}>
                  <DotWaveBackground isDark={isDark} />
                </div>
              )}
              
              {/* Contextual Return Control: Rendered ONLY when redirected through an Overview action outside overview */}
              {overviewReturnContext && (workspaceTab !== 'overview' && workspaceTab !== 'console') && (
                <div className="flex items-center justify-between pb-1 px-4 pt-2 flex-wrap gap-2" id="workspace-navigation-header">
                  <button
                    type="button"
                    id="btn-return-to-overview"
                    onClick={() => {
                      const returnView = (overviewReturnContext.sourceView || 'overview') as any;
                      setOverviewHeroInitialView(returnView);
                      setOverviewReturnContext(null);
                      window.history.pushState({ workspaceTab: 'overview', fromOverview: false }, '');
                      setWorkspaceTab('overview');
                    }}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 hover:border-cyan-400 transition cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.18)]"
                    title="Return to Production Command Centre"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      Back to Overview
                      {overviewReturnContext.sourceLabel ? ` · ${overviewReturnContext.sourceLabel}` : ''}
                    </span>
                  </button>
                </div>
              )}

            {/* 1. OVERVIEW */}
            {(workspaceTab === 'console' || workspaceTab === 'overview') && (
              <ProjectOverview
                project={activeProject}
                simulatedDate={simulatedDate}
                onSetSimulatedDate={setSimulatedDate}
                metrics={metrics}
                isDark={isDark}
                initialHeroView={overviewHeroInitialView}
                onNavigateTab={(tab, context) => {
                  setOverviewReturnContext({
                    from: 'overview',
                    sourceView: context?.sourceView || 'overview',
                    sourceWarningId: context?.sourceWarningId,
                    sourceLabel: context?.sourceLabel,
                  });
                  navigateToModule(tab, null, {
                    fromOverview: true,
                    sourceView: context?.sourceView,
                    sourceLabel: context?.sourceLabel,
                  });
                }}
                onToggleActivity={handleToggleActivity}
                onUpdateProjectMeta={handleUpdateProjectMeta}
                userRole={workspaceRole ?? 'viewer'}
                activitySyncRevision={collaborationRevision.activity}
                onOpenTeamModal={() => setShowTeamManagement(true)}
                activeDestination={collaborationDestination}
                onSelectDestination={setCollaborationDestination}
              />
            )}

            {/* TAB WRAPPER WORKSPACE ELEMENT */}
            <div className={workspaceTab !== 'overview' ? 'w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden' : 'space-y-6'}>

              {/* 2. SCREENPLAY */}
              {workspaceTab === 'screenplay' && activeProject && (
                <div id="workspace-screenplay-content" className="w-full h-full">
                  <ScreenplayErrorBoundary>
                    <ScreenplayWorkspace
                      project={activeProject}
                      isDark={isDark}
                      onUpdateProject={handleUpdateProjectDirect}
                      onNavigateTab={(tab) => navigateToModule(tab)}
                      initialSubmodule={activeSubmoduleId || undefined}
                      readOnly={
                        !hasPermission(workspaceRole, 'production:edit_data') &&
                        !hasPermission(workspaceRole, 'production:edit_dept_data')
                      }
                    />
                  </ScreenplayErrorBoundary>
                </div>
              )}

              {/* 3. BREAKDOWN */}
              {workspaceTab === 'breakdown' && activeProject && (
                <div className="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden animate-fade-in" id="workspace-breakdown-content">
                  <BreakdownWorkspace
                    project={activeProject}
                    isDark={isDark}
                    initialSubmodule={activeSubmoduleId || undefined}
                    onUpdateProject={handleUpdateProjectDirect}
                    onNavigateTab={(tab, sub) => navigateToModule(tab, sub)}
                  />
                </div>
              )}

              {/* 4. VISUALISE */}
              {workspaceTab === 'visualize' && activeProject && (
                <div className="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden animate-fade-in" id="workspace-visualize-content">
                  <VisualizeWorkspace
                    project={activeProject}
                    isDark={isDark}
                    activeRole={workspaceRole}
                    initialSubmodule={activeSubmoduleId || undefined}
                    onUpdateProject={handleUpdateProjectDirect}
                    onNavigateTab={(tab, sub) => navigateToModule(tab, sub)}
                    onUpdateStoryboards={handleUpdateStoryboardRevisions}
                    onOpenDiscussion={
                      activeProject.persistence !== 'local' && hasPermission(workspaceRole, 'discussions:view')
                        ? openDiscussions
                        : undefined
                    }
                  />
                </div>
              )}

              {/* 5. PRODUCTION (Calendar, Shoot, Directory) */}
              {workspaceTab === 'production' && activeProject && (
                <ProductionWorkspace
                  project={activeProject}
                  simulatedDate={simulatedDate}
                  isDark={isDark}
                  theme={theme}
                  activeRole={workspaceRole}
                  projectMembers={workspaceMembers}
                  initialSubmodule={activeSubmoduleId || undefined}
                  initialCalendarSubView={productionCalendarSubView}
                  onUpdateProject={handleUpdateProjectDirect}
                  onSetSimulatedDate={setSimulatedDate}
                  onAddActivity={handleAddActivity}
                  onAddActivityWithDetails={handleAddActivityWithDetails}
                  onRemoveActivity={handleRemoveActivity}
                  onUpdateActivity={handleUpdateActivity}
                  onAdjustPhaseDays={handleAdjustPhaseDays}
                  onUpdatePhase={handleUpdatePhase}
                  onMovePhaseUp={handleMovePhaseUp}
                  onMovePhaseDown={handleMovePhaseDown}
                  onDeletePhase={handleDeletePhase}
                  onAddPhase={handleAddPhase}
                  onAddCrew={handleAddCrew}
                  onDeleteCrew={handleDeleteCrew}
                  onUpdateCrewStatus={handleUpdateCrewStatus}
                  onNavigateTab={(tab, sub) => navigateToModule(tab, sub)}
                  onOpenDiscussion={
                    activeProject.persistence !== 'local' && hasPermission(workspaceRole, 'discussions:view')
                      ? openDiscussions
                      : undefined
                  }
                />
              )}

              {/* 6. VAULT (Central Media Library: Video, Audio, Images, Graphics) */}
              {workspaceTab === 'vault' && activeProject && (
                <VaultWorkspace
                  project={activeProject}
                  isDark={isDark}
                  activeRole={workspaceRole}
                  onUpdateProject={handleUpdateProjectDirect}
                  onUpdateFootage={handleUpdateFootageBackups}
                  onNavigateTab={(tab, sub) => navigateToModule(tab, sub)}
                />
              )}

            </div>
          </div>
        </div>
      )}

          </>
        )}

      </main>

      {/* COMPARTMENTALIZED WARNING DELETION DIALOG OVERLAY */}
      {deletingProjectId && (() => {
        const targetProj = projects.find(p => p.id === deletingProjectId);
        if (!targetProj) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in" id="project-abandon-warning-layer">
            <div className="bg-[#0b0c16] border border-rose-500/30 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5 animate-scale-up" id="abandonment-card-interior">
              
              {/* Header section with Alert logo */}
              <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-sans font-black text-rose-400 uppercase tracking-widest text-left">CRITICAL PIPELINE DISCARD WARNING</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider text-left">Scrap Project Process</p>
                </div>
              </div>

              {/* Warnings details text info */}
              <div className="space-y-3 font-sans text-xs text-zinc-300 leading-relaxed text-left">
                <p>
                  You are instructing the station engine to wipe and scrap <strong className="text-white border-b border-rose-500/10 pb-0.5 font-mono">{targetProj.title}</strong>, designed by <span className="font-mono text-zinc-400 font-bold">{targetProj.director}</span>.
                </p>

                {/* SHOW MULTIPLE DESIGNATIONS AS REQUESTED BY THE USER */}
                <div className="p-3 bg-cyan-950/15 border border-cyan-500/20 rounded-xl space-y-1.5">
                  <span className="text-cyan-400 font-mono text-[9px] uppercase tracking-wider block font-bold">Active Roles on Project:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(targetProj.userDesignations && targetProj.userDesignations.length > 0
                      ? targetProj.userDesignations
                      : (targetProj.userDesignation ? targetProj.userDesignation.split(',').map(s => s.trim()).filter(Boolean) : ['Line Producer'])
                    ).map((role) => (
                      <span key={role} className="text-[10px] font-sans font-extrabold text-cyan-400 bg-cyan-950/50 border border-cyan-500/25 px-2.5 py-0.5 rounded shadow-[0_0_6px_rgba(34,211,238,0.05)]">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/50 border border-rose-950/20 rounded-lg space-y-1.5 font-mono text-[10px] text-zinc-400">
                  <span className="text-indigo-400 font-bold block uppercase text-[8.5px] tracking-wider">Station Alert Payload:</span>
                  <p>✔ Active crew rosters will be unassigned ({targetProj.phases.reduce((acc, p) => acc + (p.crew?.length || 0), 0)} members).</p>
                  <p>✔ Dynamic milestone phases and cascading timelines will be deleted.</p>
                </div>

                <div className="p-3 border border-cyan-500/20 bg-cyan-950/15 text-cyan-300 rounded-xl space-y-1 font-mono text-[9.5px]">
                  <strong className="text-cyan-400 uppercase tracking-wider block text-[8.5px]">Auto Backup Calibration Drop:</strong>
                  <p>Proceeding will trigger an automatic download of <strong className="text-white">{targetProj.title}</strong> configuration payload. You can drop this calibration file into the hub at any time to resume track.</p>
                </div>
              </div>

              {/* Action Operations elements buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-900 text-xs font-mono font-bold">
                <button
                  type="button"
                  onClick={() => setDeletingProjectId(null)}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl border border-zinc-850 transition cursor-pointer"
                >
                  ABORT & SAFEKEEP
                </button>
                <button
                  type="button"
                  onClick={handleProceedDelete}
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl shadow-lg shadow-rose-950/40 transition cursor-pointer"
                  id="btn-abandon-confirm"
                >
                  BACK UP & SCRAP
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {showLogoutModal && (
        <div className={`fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in ${
          isDark ? 'bg-zinc-950/80' : 'bg-slate-900/40'
        }`} id="logout-confirmation-layer">
          <div className={`rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-5 animate-scale-up border ${
            isDark 
              ? 'bg-[#0b0c16]/95 border-rose-500/30' 
              : 'bg-white border-zinc-200'
          }`} id="logout-card-interior">
            
            {/* Header section */}
            <div className={`flex items-center gap-3 pb-3 border-b ${isDark ? 'border-zinc-905' : 'border-zinc-150'}`}>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <LogOut className="w-5 h-5 text-rose-450" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-sans font-black text-rose-500 uppercase tracking-widest">Confirm Logout</h3>
                <p className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Leave session</p>
              </div>
            </div>

            {/* Warn message details */}
            <p className={`text-xs leading-relaxed font-sans text-left ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
              Are you absolutely sure you want to log out of the active session?
            </p>

            {/* Actions button */}
            <div className="flex gap-2 pt-2 text-xs font-mono font-bold">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className={`flex-1 py-2.5 rounded-xl border transition cursor-pointer ${
                  isDark 
                    ? 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border-zinc-c850' 
                    : 'bg-zinc-100 hover:bg-zinc-150 text-zinc-600 hover:text-zinc-900 border-zinc-200'
                }`}
              >
                ABORT
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl shadow-lg transition cursor-pointer"
                id="btn-logout-confirm"
              >
                LOG OUT
              </button>
            </div>

          </div>
        </div>
      )}



      {designationWarningMessage && (
        <div className={`fixed inset-0 z-[160] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in ${
          isDark ? 'bg-zinc-950/80' : 'bg-slate-900/40'
        }`} id="designation-warning-layer">
          <div className={`rounded-2xl p-6 max-w-sm w-full space-y-4 animate-scale-up border-2 ${
            isDark 
              ? 'bg-[#120a0f]/95 border-rose-500/30 shadow-[0_0_25px_rgba(239,68,68,0.15)]' 
              : 'bg-white border-zinc-200 shadow-xl'
          }`} id="designation-warning-card">
            
            {/* Header section */}
            <div className={`flex items-center gap-3 pb-3 border-b ${isDark ? 'border-zinc-900' : 'border-zinc-150'}`}>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <span className="text-lg font-black font-mono">⚠️</span>
              </div>
              <div className="text-left">
                <h3 className="text-sm font-sans font-black text-rose-500 uppercase tracking-widest">Notice</h3>
                <p className="text-[10px] font-mono text-rose-455 uppercase tracking-wider font-extrabold">Boundary Limit Violation</p>
              </div>
            </div>

            {/* Message */}
            <p className={`text-xs leading-relaxed font-sans text-left ${isDark ? 'text-zinc-300' : 'text-zinc-650'}`}>
              {designationWarningMessage}
            </p>

            {/* Close button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDesignationWarningMessage(null)}
                className={`w-full py-2.5 rounded-xl border font-mono text-xs font-bold transition cursor-pointer ${
                  isDark 
                    ? 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border-zinc-850' 
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border-zinc-200'
                }`}
              >
                ACKNOWLEDGE & DISMISS
              </button>
            </div>

          </div>
        </div>
      )}

      {/* OVERALL PIPELINE SPEEDOMETER DETAIL MODALS */}
      {activeKpiModal && metrics && activeProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="kpi-detail-modal">
          <div className={`w-full max-w-2xl rounded-2xl border-2 p-6 shadow-2xl relative animate-scale-up ${
            isDark 
              ? 'bg-zinc-950 border-indigo-500/30 text-zinc-100' 
              : 'bg-white border-zinc-200 text-zinc-900'
          }`}>
            {/* Close button placement */}
            <button
              onClick={() => setActiveKpiModal(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors font-bold cursor-pointer ${
                isDark ? 'hover:bg-zinc-900 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-550'
              }`}
              title="Close Panel"
            >
              <X className="w-5 h-5 pointer-events-none" />
            </button>

            {/* COMPLETIONS MODAL */}
            {activeKpiModal === 'completions' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-zinc-500/10 pb-3">
                  <span className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Layers className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className={`text-base font-sans font-black uppercase tracking-wider ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                      Pipeline Task Completion Breakdown
                    </h3>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-zinc-550'}`}>Live review of scheduled work packages and complete delivery states</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* Left Column: Big Custom Speedometer */}
                  <div className="md:col-span-2 flex flex-col items-center justify-center">
                    <div className="w-full max-w-[240px]">
                      <SpeedometerGauge
                        value={metrics.activityProgress}
                        title="Pipeline Completions"
                        subtitle={`${metrics.completedActivities}/${metrics.totalActivities} Tasks`}
                        centerLabel="COMP%"
                        isDark={isDark}
                        colorStyle="classic-green-red"
                        icon={CheckSquare}
                      />
                    </div>
                  </div>

                  {/* Right Column: Breakdown checklist */}
                  <div className="md:col-span-3 space-y-4 flex flex-col">
                    <div className={`grid grid-cols-3 gap-3 p-4 rounded-xl border ${isDark ? 'bg-zinc-900/30 border-zinc-900' : 'bg-slate-50 border-indigo-100'}`}>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Total Tasks</span>
                        <span className={`text-2xl font-digital font-bold ${isDark ? 'text-zinc-100' : 'text-indigo-950'}`}>{metrics.totalActivities}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Completed</span>
                        <span className="text-2xl font-digital font-bold text-emerald-500">{metrics.completedActivities}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Progress</span>
                        <span className="text-2xl font-digital font-bold text-indigo-600">{metrics.activityProgress}%</span>
                      </div>
                    </div>

                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {activeProject.phases.map((ph) => {
                        const total = ph.activities.length;
                        const done = ph.activities.filter(a => a.completed).length;
                        
                        return (
                          <div key={ph.id} className={`p-3 border rounded-lg space-y-2 ${isDark ? 'bg-zinc-950 border-zinc-900/60' : 'bg-slate-50 border-zinc-200'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold font-sans text-indigo-950 dark:text-zinc-100">{ph.name}</span>
                              <span className="text-[10px] font-mono text-zinc-400">{done} of {total} done</span>
                            </div>
                            <div className="space-y-1.5">
                              {ph.activities.map((act) => (
                                <div key={act.id} className={`flex items-center justify-between text-[11px] p-2 rounded ${isDark ? 'bg-zinc-900/40' : 'bg-white border border-zinc-150'}`}>
                                  <span className={act.completed ? 'line-through text-zinc-500' : 'text-zinc-750 dark:text-zinc-300'}>{act.name}</span>
                                  <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded font-extrabold tracking-wide uppercase ${
                                    act.completed ? 'bg-emerald-950 text-emerald-400' : isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {act.completed ? 'COMPLETED' : 'PENDING'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PHASES MODAL */}
            {activeKpiModal === 'phases' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-zinc-500/10 pb-3">
                  <span className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                    <CheckSquare className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className={`text-base font-sans font-black uppercase tracking-wider ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                      Cascaded Production Phases Status
                    </h3>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-zinc-550'}`}>Current roadmap sequence and core project block configurations</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* Left Column: Big Custom Speedometer */}
                  <div className="md:col-span-2 flex flex-col items-center justify-center">
                    <div className="w-full max-w-[240px]">
                      <SpeedometerGauge
                        value={metrics.phaseProgress}
                        title="Phases Completed"
                        subtitle={`${metrics.completedPhases}/${metrics.totalPhases} Blocks`}
                        centerLabel="LOCK%"
                        isDark={isDark}
                        colorStyle="cyan-blue"
                        icon={Layers}
                      />
                    </div>
                  </div>

                  {/* Right Column: Breakdown list */}
                  <div className="md:col-span-3 space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {activeProject.phases.map((ph) => {
                      const total = ph.activities.length;
                      const done = ph.activities.filter(a => a.completed).length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      
                      let catName = 'Pre-Production';
                      let catColor = 'text-cyan-400';
                      if (ph.category === 'prod') { catName = 'Production Shoot'; catColor = 'text-indigo-400'; }
                      else if (ph.category === 'post') { catName = 'Post Assembly'; catColor = 'text-rose-400'; }

                      return (
                        <div key={ph.id} className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'bg-zinc-900/10 border-zinc-900' : 'bg-slate-50 border-zinc-200'}`}>
                          <div className="space-y-1 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-sans font-extrabold text-xs text-indigo-950 dark:text-zinc-100">{ph.name}</span>
                              <span className={`text-[8px] font-mono uppercase font-black px-1.5 py-0.5 bg-zinc-950 rounded ${catColor}`}>
                                {catName}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block">
                              TIMELINE: {ph.startDate} to {ph.endDate} ({ph.durationDays} days duration)
                            </span>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-start">
                            <div className="text-right">
                              <span className="text-[10px] text-zinc-450 block font-mono">PHASE PROGRESS</span>
                              <span className="text-sm font-digital font-black text-indigo-650 dark:text-zinc-350">{pct}% Complete</span>
                            </div>

                            <div className="w-16 bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-850 shrink-0">
                              <div className="h-full bg-cyan-400" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* HEALTH SCORE MODAL */}
            {activeKpiModal === 'health' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-zinc-500/10 pb-3">
                  <span className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  </span>
                  <div>
                    <h3 className={`text-base font-sans font-black uppercase tracking-wider ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                      Strategic Pipeline Health System Audit
                    </h3>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-zinc-550'}`}>Diagnostic formula log and structural resilience verification scoring</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* Left Column: Big Custom Speedometer */}
                  <div className="md:col-span-2 flex flex-col items-center justify-center">
                    <div className="w-full max-w-[240px]">
                      <SpeedometerGauge
                        value={metrics.healthScore}
                        title="Pipeline Health Score"
                        subtitle={metrics.overdueDaysCount > 0 ? `${metrics.overdueDaysCount}D SLIPPED` : 'ON TIME'}
                        centerLabel="HLTH%"
                        isDark={isDark}
                        colorStyle="auto-health"
                        icon={TrendingUp}
                      />
                    </div>
                  </div>

                  {/* Right Column: Formula Logs and Information list */}
                  <div className="md:col-span-3 space-y-4">
                    <div className={`p-4 border rounded-xl space-y-4 ${isDark ? 'bg-zinc-900/30 border-zinc-900' : 'bg-slate-50 border-indigo-100'}`}>
                      <div className="flex items-center justify-between border-b border-indigo-950/20 dark:border-zinc-900/40 pb-2">
                        <span className="text-xs font-mono text-zinc-550 dark:text-zinc-400">FINAL STRUCTURAL HEALTH CALCULATED:</span>
                        <span className="text-3xl font-digital font-black text-emerald-500">{metrics.healthScore}%</span>
                      </div>

                      {/* Progressive Formula Explanation */}
                      <div className="text-[11px] space-y-2.5 text-zinc-650 dark:text-zinc-300 font-sans leading-relaxed text-left">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-650 dark:text-indigo-400 font-extrabold block">DIAGNOSTIC MATRIX AUDIT LOGS:</span>
                        
                        <div className="flex items-center justify-between border-b border-zinc-450/20 dark:border-zinc-900/20 pb-1.5 text-zinc-550 dark:text-zinc-400">
                          <span>🟢 Raw tasks completion base weight</span>
                          <span className="font-mono text-emerald-500 font-bold">+{metrics.activityProgress} pts</span>
                        </div>

                        <div className="flex items-center justify-between border-b border-zinc-450/20 dark:border-zinc-900/20 pb-1.5 text-zinc-550 dark:text-zinc-400">
                          <span>🟢 Screenplay Lock stability check</span>
                          <span className="font-mono text-emerald-500 font-bold">
                            {activeProject.constraints.screenplayLocked ? '+10 pts bonus (Locked)' : '+0 pts (Unlocked screenplay)'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-b border-zinc-450/20 dark:border-zinc-900/20 pb-1.5 text-zinc-550 dark:text-zinc-400">
                          <span>🔴 Overdue scheduled phase delays penalty</span>
                          <span className="font-mono text-rose-500 font-bold">
                            -{metrics.overdueDaysCount * 10} pts ({metrics.overdueDaysCount} Days Slipped)
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-zinc-550 dark:text-zinc-400">
                          <span>🟢 Production schedule buffer status</span>
                          <span className="font-mono text-emerald-500 font-bold">+10 pts bonus (Healthy)</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-950/10 border border-emerald-500/10 rounded-lg text-xs leading-normal space-y-1 text-left">
                      <span className="font-semibold block text-emerald-600 dark:text-emerald-400">💡 STRATEGIC ACTIONABLE INSIGHTS</span>
                      <span className={`text-[10px] block leading-normal ${isDark ? 'text-zinc-400' : 'text-zinc-650'}`}>
                        To optimize this pipeline score, lock your remaining screenplay drafting, verify that active location permits are applied for sooner, and mark pending tasks as completed as soon as delivery reports are signed off by the director.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Close button at bottom */}
            <div className="pt-4 border-t border-zinc-900/40 flex justify-end">
              <button
                onClick={() => setActiveKpiModal(null)}
                className={`py-2 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition ${
                  isDark ? 'bg-zinc-900 hover:bg-zinc-850 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                }`}
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 Feature Modals */}
      <ProjectSwitcherModal
        isOpen={showProjectSwitcher}
        onClose={() => setShowProjectSwitcher(false)}
        onOpenCreate={() => setShowCreateProject(true)}
      />

      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={() => {
          setScreen('editor');
          setShowCreateProject(false);
        }}
      />

      <TeamManagementModal
        isOpen={showTeamManagement}
        onClose={() => setShowTeamManagement(false)}
      />

      <DiscussionsDrawer
        onNavigateToRecord={(entityType: DiscussionEntityType) => {
          const dest = fallbackTabForDiscussionEntity(entityType);
          setScreen('editor');
          navigateToModule(dest.tab, dest.submodule);
        }}
      />

      <NotificationsDrawer
        onNavigateToNotification={async (notif: NotificationDomainModel) => {
          if (notif.entityType === 'invitation') {
            if (!notif.entityId) return false;
            setPendingInviteToken(notif.entityId);
            return true;
          }
          if (notif.projectId && notif.projectId !== activeProjectId) {
            await switchProject(notif.projectId);
          }
          if (notif.entityType === 'member') {
            setShowTeamManagement(true);
            return true;
          }
          const targetProj =
            (notif.projectId ? projects.find(p => p.id === notif.projectId) : null) || activeProject;
          const dest = resolveRecordDestination(targetProj, notif.entityType, notif.entityId);
          if (!dest) return false;
          if (dest.focusDate) setSimulatedDate(dest.focusDate);
          setScreen('editor');
          navigateToModule(dest.tab, dest.submodule);
          return true;
        }}
      />

      <ActivityFeedDrawer
        onNavigateToActivity={async (item: ActivityDomainModel) => {
          if (!item.entityType || !item.entityId) return false;
          if (item.entityType === 'thread' || item.entityType === 'message') {
            openDiscussions();
            return true;
          }
          if (item.entityType === 'member') {
            setShowTeamManagement(true);
            return true;
          }
          const dest = resolveRecordDestination(activeProject, item.entityType, item.entityId);
          if (!dest) return false;
          if (dest.focusDate) setSimulatedDate(dest.focusDate);
          setScreen('editor');
          navigateToModule(dest.tab, dest.submodule);
          return true;
        }}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <AccountSettingsModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        initialSection={settingsInitialSection}
        theme={theme}
        onThemeChange={(newTheme) => setTheme(newTheme)}
        onUpdateName={(name) => setUserName(name)}
        onOpenTeamManagement={() => setShowTeamManagement(true)}
      />

      {pendingInviteToken && (
        <InviteAcceptanceView
          token={pendingInviteToken}
          onDismiss={clearInviteRoute}
          onAccepted={handleInviteAccepted}
        />
      )}
    </div>
  );
}

/**
 * Small inline helper to add new activities to a phase
 */
function PhaseActivityAdder({ onAdd, phaseColor, phaseId }: { onAdd: (t: string) => void, phaseColor: string, phaseId: string }) {
  const [val, setVal] = React.useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (val.trim()) {
      onAdd(val);
      setVal('');
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2" id={`add-activity-form-${phaseId}`}>
      <input
        type="text"
        placeholder="Recruit task activity milestone..."
        value={val}
        onChange={e => setVal(e.target.value)}
        className="flex-1 bg-zinc-950 font-sans border border-zinc-850 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        className={`px-3 py-1.5 font-mono text-[10px] font-bold rounded-lg border border-zinc-800 bg-zinc-900 transition hover:bg-zinc-850 cursor-pointer ${phaseColor}`}
      >
        ADD TASK
      </button>
    </form>
  );
}

/**
 * Minimal static log levels icon representing system logs
 */
function LogLevelIcon({ className }: { className?: string }) {
  return (
    <div className={`w-4 h-4 flex flex-col justify-between items-center opacity-80 hover:opacity-100 ${className || ''}`}>
      <span className="w-full h-0.5 bg-current rounded" />
      <span className="w-4/5 h-0.5 bg-current rounded" />
      <span className="w-1/2 h-0.5 bg-current rounded" />
    </div>
  );
}

/**
 * Minimal inline form helper to add a sub-phase to a category stage
 */
interface PhaseCreatorInlineProps {
  category: 'pre' | 'prod' | 'post';
  onAdd: (name: string, duration: number) => void;
  isDark: boolean;
  colorClass: string;
}

function PhaseCreatorInline({ category, onAdd, isDark, colorClass }: PhaseCreatorInlineProps) {
  const [name, setName] = React.useState('');
  const [days, setDays] = React.useState(15);
  const [open, setOpen] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim(), days);
      setName('');
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`px-3 py-1 text-[10px] uppercase font-mono font-bold tracking-wider border rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
          isDark 
            ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800' 
            : 'bg-zinc-50 border-zinc-250 text-zinc-650 hover:bg-zinc-100 hover:text-zinc-900'
        }`}
      >
        <Plus className="w-3.5 h-3.5" />
        New Phase
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 animate-fade-in text-zinc-200">
      <input
        type="text"
        required
        placeholder="e.g. Casting scouting..."
        value={name}
        onChange={e => setName(e.target.value)}
        className={`px-2.5 py-1 text-xs font-sans rounded-lg border focus:outline-none focus:ring-1 ${
          isDark 
            ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:ring-cyan-500' 
            : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-indigo-500'
        }`}
      />
      <div className="flex items-center gap-1">
        <label className="text-[10px] font-mono text-zinc-500 uppercase">Days:</label>
        <input
          type="number"
          required
          min={1}
          value={days}
          onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
          className={`w-12 px-1.5 py-1 text-xs text-center font-mono rounded-lg border focus:outline-none ${
            isDark ? 'bg-zinc-950 border-[#1F2937] text-zinc-200' : 'bg-transparent border-zinc-200 text-zinc-900'
          }`}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border transition cursor-pointer ${
            isDark 
              ? 'bg-cyan-500 border-cyan-400 text-slate-950 hover:bg-cyan-400' 
              : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'
          }`}
        >
          CONFIRM
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`px-2 py-1 text-[10px] font-mono rounded-lg transition cursor-pointer ${
            isDark ? 'text-zinc-500 hover:text-zinc-350' : 'text-zinc-400 hover:text-zinc-700'
          }`}
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}
