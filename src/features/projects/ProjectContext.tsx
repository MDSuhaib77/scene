/**
 * SceneOS — Active Project Workspace Context
 * 
 * Provides centralized project state with strict isolation:
 * - Guarantees that switching projects invalidates and rescopes query states
 *   so data from one project never leaks into another.
 * - Computes the user's verified role and permissions in the active workspace.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { services } from '../../services';
import {
  DiscussionRecordTarget,
  ProjectDomainModel,
  ProjectMemberDomainModel,
  ProjectPersistence,
  ProjectRealtimeHandle,
  RealtimeConnectionStatus,
  RealtimePresenceMember,
  UserSession,
} from '../../services/contracts/types';
import { ProjectRole } from '../../types/database.types';
import { hasPermission, PermissionAction } from '../../services/rbac/permissions';

interface ProjectContextValue {
  projects: ProjectDomainModel[];
  activeProject: ProjectDomainModel | null;
  activeProjectId: string | null;
  projectPersistence: ProjectPersistence | null;
  activeRole: ProjectRole | null;
  members: ProjectMemberDomainModel[];
  membersLoading: boolean;
  membersError: string | null;
  discussionUnreadCount: number;
  isDiscussionOpen: boolean;
  pendingDiscussionTarget: DiscussionRecordTarget | null;
  openDiscussions: (target?: DiscussionRecordTarget) => void;
  closeDiscussions: () => void;
  clearPendingDiscussionTarget: () => void;
  refreshDiscussionUnreadCount: () => Promise<void>;
  notificationUnreadCount: number;
  isNotificationsOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  refreshNotificationUnreadCount: () => Promise<void>;
  isActivityOpen: boolean;
  openActivity: () => void;
  closeActivity: () => void;
  realtimeStatus: RealtimeConnectionStatus;
  onlineMembers: RealtimePresenceMember[];
  collaborationRevision: {
    discussions: number;
    notifications: number;
    activity: number;
    members: number;
    production: number;
  };
  setRealtimeModule: (moduleId: string) => void;
  isLoading: boolean;
  error: string | null;
  currentUser: UserSession['user'];
  logout: () => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  createProject: (input: Partial<Omit<ProjectDomainModel, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>> & { title: string }) => Promise<ProjectDomainModel>;
  updateProject: (id: string, updates: Partial<ProjectDomainModel>) => Promise<ProjectDomainModel>;
  updateActiveProject: (updates: Partial<ProjectDomainModel>) => Promise<ProjectDomainModel>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: (preferredProjectId?: string) => Promise<void>;
  refreshMembers: () => Promise<void>;
  can: (action: PermissionAction) => boolean;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectDomainModel[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectDomainModel | null>(null);
  const [activeRole, setActiveRole] = useState<ProjectRole | null>(null);
  const [members, setMembers] = useState<ProjectMemberDomainModel[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [discussionUnreadCount, setDiscussionUnreadCount] = useState<number>(0);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState<boolean>(false);
  const [pendingDiscussionTarget, setPendingDiscussionTarget] = useState<DiscussionRecordTarget | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState<number>(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isActivityOpen, setIsActivityOpen] = useState<boolean>(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('idle');
  const [onlineMembers, setOnlineMembers] = useState<RealtimePresenceMember[]>([]);
  const [collaborationRevision, setCollaborationRevision] = useState({
    discussions: 0,
    notifications: 0,
    activity: 0,
    members: 0,
    production: 0,
  });
  const [currentUser, setCurrentUser] = useState<UserSession['user']>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const memberRequestSeqRef = useRef(0);
  const projectRealtimeHandleRef = useRef<ProjectRealtimeHandle | null>(null);
  const activeModuleRef = useRef<string>('overview');

  const clearProjectState = useCallback(() => {
    memberRequestSeqRef.current += 1;
    projectRealtimeHandleRef.current?.disconnect();
    projectRealtimeHandleRef.current = null;
    setCurrentUser(null);
    setProjects([]);
    setActiveProject(null);
    setMembers([]);
    setMembersLoading(false);
    setMembersError(null);
    setActiveRole(null);
    setDiscussionUnreadCount(0);
    setIsDiscussionOpen(false);
    setPendingDiscussionTarget(null);
    setNotificationUnreadCount(0);
    setIsNotificationsOpen(false);
    setIsActivityOpen(false);
    setOnlineMembers([]);
    setRealtimeStatus('idle');
    localStorage.removeItem('sceneos_active_project_id');
  }, []);

  const logout = useCallback(async () => {
    try {
      await services.auth.logout();
    } catch (err) {
      console.error('[SceneOS Auth] Logout error in ProjectContext:', err);
    } finally {
      clearProjectState();
    }
  }, [clearProjectState]);

  const refreshMembers = useCallback(async () => {
    const seq = ++memberRequestSeqRef.current;

    if (!activeProject) {
      setMembers([]);
      setMembersLoading(false);
      setMembersError(null);
      setActiveRole(null);
      return;
    }

    // Local-only fallback projects live solely in browser storage and do not expose multi-user membership.
    if (activeProject.persistence === 'local') {
      setMembers([]);
      setMembersLoading(false);
      setMembersError(null);
      const isLocalCreator =
        Boolean(currentUser && activeProject.ownerId === currentUser.id) ||
        Boolean(activeProject.ownerId?.startsWith('usr-'));
      setActiveRole(isLocalCreator ? 'owner' : null);
      return;
    }

    // Unknown persistence or unauthenticated remote access fails closed.
    if (!currentUser) {
      setMembers([]);
      setMembersLoading(false);
      setMembersError(null);
      setActiveRole(null);
      return;
    }

    setMembersLoading(true);
    setMembersError(null);
    try {
      const memList = await services.projects.getProjectMembers(activeProject.id);
      if (memberRequestSeqRef.current !== seq) return;

      setMembers(memList);

      const found =
        activeProject.persistence === 'mock'
          ? memList.find(
              m =>
                m.userId === currentUser.id ||
                m.email.toLowerCase() === currentUser.email.toLowerCase()
            )
          : memList.find(m => m.userId === currentUser.id);

      // Fail closed: unresolved membership yields null (no implicit owner role).
      setActiveRole(found ? found.role : null);
    } catch (err: any) {
      if (memberRequestSeqRef.current !== seq) return;
      console.error('[SceneOS] Failed to refresh project members:', err);
      setMembers([]);
      setActiveRole(null);
      setMembersError(err?.message || 'Unable to verify project membership.');
    } finally {
      if (memberRequestSeqRef.current === seq) {
        setMembersLoading(false);
      }
    }
  }, [activeProject, currentUser]);

  const refreshProjects = useCallback(async (preferredProjectId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await services.projects.getProjects();
      setProjects(list);

      // Restore preferred or saved active project, or pick the first available
      if (list.length > 0) {
        const savedId = preferredProjectId || localStorage.getItem('sceneos_active_project_id');
        const matched = list.find(p => p.id === savedId) || list[0];
        setActiveProject(matched);
        localStorage.setItem('sceneos_active_project_id', matched.id);
      } else {
        setActiveProject(null);
        localStorage.removeItem('sceneos_active_project_id');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = services.auth.onAuthStateChange(session => {
      if (session.user) {
        setCurrentUser(session.user);
        refreshProjects();
      } else {
        clearProjectState();
        setIsLoading(false);
      }
    });
    return unsub;
  }, [refreshProjects, clearProjectState]);

  useEffect(() => {
    refreshMembers();
  }, [refreshMembers]);

  const refreshDiscussionUnreadCount = useCallback(async () => {
    if (!activeProject || activeProject.persistence === 'local' || !currentUser || !activeRole) {
      setDiscussionUnreadCount(0);
      return;
    }
    const count = await services.discussions.getProjectUnreadCount(activeProject.id);
    setDiscussionUnreadCount(count);
  }, [activeProject, currentUser, activeRole]);

  useEffect(() => {
    refreshDiscussionUnreadCount();
  }, [refreshDiscussionUnreadCount]);

  const refreshNotificationUnreadCount = useCallback(async () => {
    if (!currentUser || activeProject?.persistence === 'local') {
      setNotificationUnreadCount(0);
      return;
    }
    const count = await services.notifications.getUnreadCount(activeProject?.id ?? null);
    setNotificationUnreadCount(count);
  }, [activeProject?.id, activeProject?.persistence, currentUser]);

  useEffect(() => {
    refreshNotificationUnreadCount();
  }, [refreshNotificationUnreadCount]);

  // Personal private Realtime channel (notifications & immediate revocation alerts)
  useEffect(() => {
    if (!currentUser || activeProject?.persistence === 'local') {
      return;
    }

    const disconnectUser = services.realtime.connectUserChannel({
      userId: currentUser.id,
      onSignal: signal => {
        if (signal.revoked && (!signal.projectId || signal.projectId === activeProject?.id)) {
          projectRealtimeHandleRef.current?.disconnect();
          projectRealtimeHandleRef.current = null;
          setOnlineMembers([]);
          setRealtimeStatus('disconnected');
          void refreshMembers();
          return;
        }
        if (signal.scope === 'notifications' || signal.scope === 'reconcile') {
          void refreshNotificationUnreadCount();
          setCollaborationRevision(prev => ({
            ...prev,
            notifications: prev.notifications + 1,
          }));
        }
      },
    });

    return () => {
      disconnectUser();
    };
  }, [
    currentUser?.id,
    activeProject?.id,
    activeProject?.persistence,
    refreshNotificationUnreadCount,
    refreshMembers,
  ]);

  // Project-scoped private Realtime channel & restrained Presence lifecycle
  useEffect(() => {
    projectRealtimeHandleRef.current?.disconnect();
    projectRealtimeHandleRef.current = null;

    if (!activeProject) {
      setOnlineMembers([]);
      setRealtimeStatus('idle');
      return;
    }

    if (activeProject.persistence === 'local') {
      setOnlineMembers([]);
      setRealtimeStatus('local');
      return;
    }

    if (!currentUser || !activeRole) {
      setOnlineMembers([]);
      setRealtimeStatus('disconnected');
      return;
    }

    const handle = services.realtime.connectProjectChannel({
      projectId: activeProject.id,
      persistence: activeProject.persistence,
      user: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        role: activeRole,
      },
      activeModule: activeModuleRef.current,
      onPresenceChange: list => {
        setOnlineMembers(list);
      },
      onStatusChange: status => {
        setRealtimeStatus(status);
      },
      onSignal: signal => {
        if (signal.revoked) {
          handle.disconnect();
          if (projectRealtimeHandleRef.current === handle) {
            projectRealtimeHandleRef.current = null;
          }
          setOnlineMembers([]);
          setRealtimeStatus('disconnected');
          void refreshMembers();
          return;
        }

        if (signal.scope === 'reconcile') {
          void refreshMembers();
          void refreshDiscussionUnreadCount();
          void refreshNotificationUnreadCount();
          setCollaborationRevision(prev => ({
            discussions: prev.discussions + 1,
            notifications: prev.notifications + 1,
            activity: prev.activity + 1,
            members: prev.members + 1,
            production: prev.production + 1,
          }));
          return;
        }

        if (signal.scope === 'discussions') {
          void refreshDiscussionUnreadCount();
        } else if (signal.scope === 'members') {
          void refreshMembers();
        } else if (signal.scope === 'notifications') {
          void refreshNotificationUnreadCount();
        }

        setCollaborationRevision(prev => ({
          ...prev,
          [signal.scope]: prev[signal.scope] + 1,
        }));
      },
    });

    projectRealtimeHandleRef.current = handle;

    return () => {
      handle.disconnect();
      if (projectRealtimeHandleRef.current === handle) {
        projectRealtimeHandleRef.current = null;
      }
      setOnlineMembers([]);
    };
  }, [
    activeProject?.id,
    activeProject?.persistence,
    currentUser?.id,
    currentUser?.fullName,
    activeRole,
    refreshMembers,
    refreshDiscussionUnreadCount,
    refreshNotificationUnreadCount,
  ]);

  const setRealtimeModule = useCallback((moduleId: string) => {
    activeModuleRef.current = moduleId;
    projectRealtimeHandleRef.current?.updateModule(moduleId);
  }, []);

  const openDiscussions = useCallback((target?: DiscussionRecordTarget) => {
    if (target) {
      setPendingDiscussionTarget(target);
    }
    setIsNotificationsOpen(false);
    setIsActivityOpen(false);
    setIsDiscussionOpen(true);
  }, []);

  const closeDiscussions = useCallback(() => {
    setIsDiscussionOpen(false);
  }, []);

  const openNotifications = useCallback(() => {
    setIsDiscussionOpen(false);
    setIsActivityOpen(false);
    setIsNotificationsOpen(true);
  }, []);

  const closeNotifications = useCallback(() => {
    setIsNotificationsOpen(false);
  }, []);

  const openActivity = useCallback(() => {
    setIsDiscussionOpen(false);
    setIsNotificationsOpen(false);
    setIsActivityOpen(true);
  }, []);

  const closeActivity = useCallback(() => {
    setIsActivityOpen(false);
  }, []);

  const clearPendingDiscussionTarget = useCallback(() => {
    setPendingDiscussionTarget(null);
  }, []);

  const switchProject = useCallback(async (projectId: string) => {
    const target = projects.find(p => p.id === projectId);
    if (!target) return;

    if (activeProject?.id === target.id) {
      localStorage.setItem('sceneos_active_project_id', target.id);
      return;
    }

    // Strict state isolation: Clear previous project records before loading new
    setMembers([]);
    setActiveRole(null);
    setDiscussionUnreadCount(0);
    setPendingDiscussionTarget(null);
    setIsDiscussionOpen(false);
    setNotificationUnreadCount(0);
    setIsNotificationsOpen(false);
    setIsActivityOpen(false);
    setActiveProject(target);
    localStorage.setItem('sceneos_active_project_id', target.id);
  }, [projects, activeProject?.id]);

  const createProject = useCallback(async (input: Partial<Omit<ProjectDomainModel, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>> & { title: string }) => {
    const created = await services.projects.createProject(input);
    await refreshProjects();
    await switchProject(created.id);
    return created;
  }, [refreshProjects, switchProject]);

  const updateProject = useCallback(async (id: string, updates: Partial<ProjectDomainModel>) => {
    const updated = await services.projects.updateProject(id, updates);
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
    if (activeProject?.id === id) {
      setActiveProject(updated);
    }
    return updated;
  }, [activeProject]);

  const updateActiveProject = useCallback(async (updates: Partial<ProjectDomainModel>) => {
    if (!activeProject) throw new Error('No active project to update');
    const updated = await services.projects.updateProject(activeProject.id, updates);
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
    setActiveProject(updated);
    void refreshNotificationUnreadCount();
    return updated;
  }, [activeProject, refreshNotificationUnreadCount]);

  const deleteProject = useCallback(async (id: string) => {
    await services.projects.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject?.id === id) {
      const remaining = projects.filter(p => p.id !== id);
      const nextActive = remaining[0] || null;
      setActiveProject(nextActive);
      if (nextActive) {
        localStorage.setItem('sceneos_active_project_id', nextActive.id);
      } else {
        localStorage.removeItem('sceneos_active_project_id');
      }
    }
  }, [activeProject, projects]);

  const can = useCallback((action: PermissionAction) => {
    return hasPermission(activeRole, action);
  }, [activeRole]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectId: activeProject?.id || null,
        projectPersistence: activeProject?.persistence ?? null,
        activeRole,
        members,
        membersLoading,
        membersError,
        discussionUnreadCount,
        isDiscussionOpen,
        pendingDiscussionTarget,
        openDiscussions,
        closeDiscussions,
        clearPendingDiscussionTarget,
        refreshDiscussionUnreadCount,
        notificationUnreadCount,
        isNotificationsOpen,
        openNotifications,
        closeNotifications,
        refreshNotificationUnreadCount,
        isActivityOpen,
        openActivity,
        closeActivity,
        realtimeStatus,
        onlineMembers,
        collaborationRevision,
        setRealtimeModule,
        isLoading,
        error,
        currentUser,
        logout,
        switchProject,
        createProject,
        updateProject,
        updateActiveProject,
        deleteProject,
        refreshProjects,
        refreshMembers,
        can,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
