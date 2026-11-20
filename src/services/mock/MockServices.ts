/**
 * SceneOS — Mock Service Implementation
 * Provides high-fidelity, deterministic local offline capabilities
 * without requiring any external credentials or network connections.
 */

import {
  IAuthService,
  IProjectService,
  IInvitationService,
  IActivityService,
  IConnectionService,
  UserSession,
  ProjectDomainModel,
  ProjectMemberDomainModel,
  InvitationDomainModel,
  InvitationPreview,
  InvitationError,
  CreateInvitationOptions,
  ActivityDomainModel,
  ActivityPage,
  ConnectionHealth,
  DiscussionEntityType,
  DiscussionMessageDomainModel,
  DiscussionMessagesPage,
  DiscussionRecordTarget,
  DiscussionThreadDomainModel,
  IDiscussionService,
  INotificationService,
  NotificationCategory,
  NotificationDomainModel,
  NotificationEntityType,
  NotificationEventType,
  NotificationFilter,
  NotificationPage,
  NotificationPreferencesDomainModel,
  NotificationPriority,
  PostDiscussionMessageInput,
  ProjectPersistence,
  ProjectRealtimeHandle,
  RealtimeCollabSignal,
  RealtimeConnectionStatus,
  RealtimePresenceMember,
  IRealtimeCollaborationService,
  UpdateNotificationPreferencesInput
} from '../contracts/types';
import { ProjectRole } from '../../types/database.types';
import { canManageRole, hasPermission } from '../rbac/permissions';

// Preset Mock Users
export const MOCK_USERS = [
  {
    id: 'usr-kira-vance',
    email: 'kira.vance@sceneos.studio',
    fullName: 'Kira Vance',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    phone: '+1-555-0192',
    bio: 'Director & Showrunner specialized in neo-noir science fiction.',
    role: 'director' as ProjectRole,
  },
  {
    id: 'usr-elena-rostova',
    email: 'elena.rostova@sceneos.studio',
    fullName: 'Elena Rostova',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    phone: '+1-555-0144',
    bio: 'Lead Producer with expertise in multi-guild co-productions.',
    role: 'producer' as ProjectRole,
  },
  {
    id: 'usr-marcus-ad',
    email: 'marcus.ad@sceneos.studio',
    fullName: 'Marcus Thorne',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    phone: '+1-555-0177',
    bio: '1st Assistant Director & Stripboard Logistics Specialist.',
    role: 'first_ad' as ProjectRole,
  }
];

// Initial Mock Projects
const INITIAL_MOCK_PROJECTS: ProjectDomainModel[] = [
  {
    id: 'proj-neon-dreams-01',
    title: 'Neon Dreams: Chapter One',
    logline: 'In a rain-slicked cyberpunk metropolis, a rogue synthetic consciousness hires an underground detective before a megacorporation wipes its kernel.',
    director: 'Kira Vance',
    producer: 'Elena Rostova',
    status: 'pre-production',
    budgetTotal: 4500000,
    dailyBurnCap: 50000,
    startDate: '2026-06-01',
    finalEndDate: '2026-08-15',
    suggestedEndDate: '2026-08-15',
    isEndDateFixed: true,
    targetStartDate: '2026-06-01',
    targetWrapDate: '2026-08-15',
    ownerId: 'usr-kira-vance',
    persistence: 'mock',
    memberCount: 3,
    userRole: 'owner',
    constraints: {
      budgetLimit: 4500000,
      dailyBurnRateCap: 50000,
      screenplayLocked: true,
      castAvailabilityDays: 45,
      permitLeadTimeDays: 15,
      targetRating: 'PG-13',
      weatherContingencyBuffer: 8,
      postOverheadRatio: 20,
    },
    phases: [],
    screenplayVersions: [],
    elementCatalog: [],
    sceneBreakdownAssociations: [],
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-03-20T14:30:00Z',
  },
  {
    id: 'proj-monsoon-heist-02',
    title: 'Monsoon Shadow',
    logline: 'A veteran Mumbai sound recordist accidentally captures a conspiracy frequency during an intense monsoon night shoot.',
    director: 'Anand Mohan',
    producer: 'Kira Vance',
    status: 'development',
    budgetTotal: 1800000,
    dailyBurnCap: 28000,
    startDate: '2026-09-10',
    finalEndDate: '2026-11-05',
    suggestedEndDate: '2026-11-05',
    isEndDateFixed: false,
    targetStartDate: '2026-09-10',
    targetWrapDate: '2026-11-05',
    ownerId: 'usr-kira-vance',
    persistence: 'mock',
    memberCount: 1,
    userRole: 'owner',
    constraints: {
      budgetLimit: 1800000,
      dailyBurnRateCap: 28000,
      screenplayLocked: false,
      castAvailabilityDays: 30,
      permitLeadTimeDays: 10,
      targetRating: 'UA',
      weatherContingencyBuffer: 5,
      postOverheadRatio: 15,
    },
    phases: [],
    screenplayVersions: [],
    elementCatalog: [],
    sceneBreakdownAssociations: [],
    createdAt: '2026-02-10T11:00:00Z',
    updatedAt: '2026-03-18T16:45:00Z',
  }
];

// Initial Mock Members
const INITIAL_MOCK_MEMBERS: Record<string, ProjectMemberDomainModel[]> = {
  'proj-neon-dreams-01': [
    {
      id: 'mem-1',
      projectId: 'proj-neon-dreams-01',
      userId: 'usr-kira-vance',
      fullName: 'Kira Vance',
      email: 'kira.vance@sceneos.studio',
      role: 'owner',
      department: 'Direction',
      directoryEntryId: null,
      isOwner: true,
      avatarUrl: MOCK_USERS[0].avatarUrl,
      joinedAt: '2026-01-15T09:00:00Z',
    },
    {
      id: 'mem-2',
      projectId: 'proj-neon-dreams-01',
      userId: 'usr-elena-rostova',
      fullName: 'Elena Rostova',
      email: 'elena.rostova@sceneos.studio',
      role: 'producer',
      department: 'Production',
      directoryEntryId: null,
      isOwner: false,
      avatarUrl: MOCK_USERS[1].avatarUrl,
      joinedAt: '2026-01-16T10:00:00Z',
    },
    {
      id: 'mem-3',
      projectId: 'proj-neon-dreams-01',
      userId: 'usr-marcus-ad',
      fullName: 'Marcus Thorne',
      email: 'marcus.ad@sceneos.studio',
      role: 'first_ad',
      department: 'Assistant Directors',
      directoryEntryId: null,
      isOwner: false,
      avatarUrl: MOCK_USERS[2].avatarUrl,
      joinedAt: '2026-01-20T12:00:00Z',
    }
  ],
  'proj-monsoon-heist-02': [
    {
      id: 'mem-m1',
      projectId: 'proj-monsoon-heist-02',
      userId: 'usr-kira-vance',
      fullName: 'Kira Vance',
      email: 'kira.vance@sceneos.studio',
      role: 'owner',
      department: 'Production',
      directoryEntryId: null,
      isOwner: true,
      avatarUrl: MOCK_USERS[0].avatarUrl,
      joinedAt: '2026-02-10T11:00:00Z',
    }
  ]
};

// Initial Mock Activities
const INITIAL_MOCK_ACTIVITIES: Record<string, ActivityDomainModel[]> = {
  'proj-neon-dreams-01': [
    {
      id: 'act-1',
      projectId: 'proj-neon-dreams-01',
      userId: 'usr-kira-vance',
      userFullName: 'Kira Vance',
      activityType: 'script_locked',
      title: 'Script Locked: Draft v2.4 (Pink Revision)',
      description: 'Locked 114 pages across 84 scenes with zero turnaround violations.',
      createdAt: '2026-03-20T14:30:00Z',
    },
    {
      id: 'act-2',
      projectId: 'proj-neon-dreams-01',
      userId: 'usr-marcus-ad',
      userFullName: 'Marcus Thorne',
      activityType: 'schedule_updated',
      title: 'Stripboard Generated for 32 Shooting Days',
      description: 'Balanced night exterior days with FWICE 12-hour turnaround buffer.',
      createdAt: '2026-03-19T11:15:00Z',
    }
  ]
};

export class MockAuthService implements IAuthService {
  private currentSession: UserSession = {
    user: {
      id: MOCK_USERS[0].id,
      email: MOCK_USERS[0].email,
      fullName: MOCK_USERS[0].fullName,
      avatarUrl: MOCK_USERS[0].avatarUrl,
      phone: MOCK_USERS[0].phone,
      bio: MOCK_USERS[0].bio,
    },
    token: 'mock-jwt-token-kira-vance',
    isMock: true,
  };
  private listeners: ((session: UserSession) => void)[] = [];

  peekSession(): UserSession {
    return { ...this.currentSession };
  }

  async getSession(): Promise<UserSession> {
    return { ...this.currentSession };
  }

  async login(email: string): Promise<UserSession> {
    const matched = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase()) || {
      id: `usr-${Date.now()}`,
      email,
      fullName: email.split('@')[0],
      avatarUrl: null,
      phone: null,
      bio: null,
    };

    this.currentSession = {
      user: matched,
      token: `mock-jwt-token-${matched.id}`,
      isMock: true,
    };
    this.notify();
    return { ...this.currentSession };
  }

  async register(email: string, _password?: string, fullName?: string): Promise<UserSession> {
    const newUser = {
      id: `usr-${Date.now()}`,
      email,
      fullName: fullName || email.split('@')[0],
      avatarUrl: null,
      phone: null,
      bio: null,
    };
    this.currentSession = {
      user: newUser,
      token: `mock-jwt-token-${newUser.id}`,
      isMock: true,
    };
    this.notify();
    return { ...this.currentSession };
  }

  async logout(): Promise<void> {
    this.currentSession = { user: null, isMock: true };
    this.notify();
  }

  async updateProfile(updates: { fullName?: string; avatarUrl?: string | null; phone?: string | null; bio?: string | null }): Promise<UserSession['user']> {
    if (!this.currentSession.user) throw new Error('Not authenticated');

    this.currentSession.user = {
      ...this.currentSession.user,
      fullName: updates.fullName ?? this.currentSession.user.fullName,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : this.currentSession.user.avatarUrl,
      phone: updates.phone !== undefined ? updates.phone : this.currentSession.user.phone,
      bio: updates.bio !== undefined ? updates.bio : this.currentSession.user.bio,
    };

    this.notify();
    return { ...this.currentSession.user };
  }

  async signInWithOAuth(provider: 'google' | 'apple'): Promise<{ url?: string; error?: string }> {
    const targetUser = provider === 'google' ? MOCK_USERS[1] : MOCK_USERS[0];
    this.currentSession = {
      user: { ...targetUser },
      token: `mock-oauth-${provider}-token`,
      isMock: true,
    };
    this.notify();
    return { url: typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000' };
  }

  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `[MOCK MODE] Password reset email simulated for ${email}. (No real email sent).`,
    };
  }

  onAuthStateChange(callback: (session: UserSession) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentSession);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentSession);
    }
  }
}

const MOCK_PROJECTS_STORAGE_KEY = 'sceneos_mock_projects_v1';

function canUseBrowserMockPersistence(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof localStorage !== 'undefined' &&
    !(typeof process !== 'undefined' && Boolean(process.env?.VITEST))
  );
}

export class MockProjectService implements IProjectService {
  private projects: ProjectDomainModel[];
  private members: Record<string, ProjectMemberDomainModel[]>;
  private collabHooks?: {
    activity: MockActivityService;
    notifications: MockNotificationService;
    getCurrentSession: () => UserSession | null;
    realtime?: MockRealtimeCollaborationService;
  };

  attachCollaborationServices(
    activity: MockActivityService,
    notifications: MockNotificationService,
    getCurrentSession: () => UserSession | null,
    realtime?: MockRealtimeCollaborationService
  ): void {
    this.collabHooks = { activity, notifications, getCurrentSession, realtime };
  }

  constructor() {
    if (canUseBrowserMockPersistence()) {
      try {
        const saved = localStorage.getItem(MOCK_PROJECTS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.projects = parsed.map((p: ProjectDomainModel) => ({
              ...p,
              persistence: 'mock' as const,
            }));
            this.members = JSON.parse(JSON.stringify(INITIAL_MOCK_MEMBERS));
            return;
          }
        }
      } catch {
        // Fallback safely to initial mock projects
      }
    }
    this.projects = JSON.parse(JSON.stringify(INITIAL_MOCK_PROJECTS));
    this.members = JSON.parse(JSON.stringify(INITIAL_MOCK_MEMBERS));
  }

  private persistBrowserState(): void {
    if (!canUseBrowserMockPersistence()) return;
    try {
      localStorage.setItem(MOCK_PROJECTS_STORAGE_KEY, JSON.stringify(this.projects));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }

  async getProjects(): Promise<ProjectDomainModel[]> {
    return [...this.projects];
  }

  async getProjectById(id: string): Promise<ProjectDomainModel | null> {
    const match = this.projects.find(p => p.id === id);
    return match ? { ...match } : null;
  }

  async createProject(input: Partial<Omit<ProjectDomainModel, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>> & { title: string }): Promise<ProjectDomainModel> {
    const newId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const today = new Date().toISOString().split('T')[0];
    const in60Days = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

    const newProj: ProjectDomainModel = {
      title: input.title,
      logline: input.logline || '',
      director: input.director || '',
      producer: input.producer || '',
      writer: input.writer || '',
      cinematographer: input.cinematographer || '',
      productionType: input.productionType || 'Feature Film',
      productionCompany: input.productionCompany || input.companyName || '',
      companyName: input.companyName || input.productionCompany || '',
      primaryLocation: (input as any).primaryLocation || '',
      status: input.status || 'pre-production',
      budgetTotal: input.budgetTotal || 0,
      dailyBurnCap: input.dailyBurnCap || 0,
      targetStartDate: input.targetStartDate || null,
      targetWrapDate: input.targetWrapDate || null,
      startDate: input.startDate || input.targetStartDate || today,
      finalEndDate: input.finalEndDate || input.targetWrapDate || in60Days,
      suggestedEndDate: input.suggestedEndDate || input.targetWrapDate || in60Days,
      isEndDateFixed: input.isEndDateFixed ?? false,
      phases: input.phases || [],
      screenplayVersions: input.screenplayVersions || [],
      elementCatalog: input.elementCatalog || [],
      sceneBreakdownAssociations: input.sceneBreakdownAssociations || [],
      footageBackups: input.footageBackups || [],
      storyboardRevisions: input.storyboardRevisions || [],
      constraints: input.constraints || {
        maxOvertimeHours: 2,
        turnaroundHours: 12,
        mealBreakFrequency: 6,
        sundayPremiums: true,
        weatherBufferDays: 1,
      },
      ...input,
      id: newId,
      ownerId: MOCK_USERS[0].id,
      owner: MOCK_USERS[0].fullName,
      persistence: 'mock',
      memberCount: 1,
      userRole: 'owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.projects.unshift(newProj);
    this.persistBrowserState();

    // Add creator as owner member
    this.members[newId] = [
      {
        id: `mem-${Date.now()}`,
        projectId: newId,
        userId: MOCK_USERS[0].id,
        fullName: MOCK_USERS[0].fullName,
        email: MOCK_USERS[0].email,
        avatarUrl: MOCK_USERS[0].avatarUrl,
        role: 'owner',
        department: null,
        directoryEntryId: null,
        isOwner: true,
        joinedAt: new Date().toISOString(),
      }
    ];

    return { ...newProj };
  }

  async updateProject(id: string, updates: Partial<ProjectDomainModel>): Promise<ProjectDomainModel> {
    const idx = this.projects.findIndex(p => p.id === id);
    if (idx === -1) throw new Error(`Project ${id} not found.`);
    const previous = this.projects[idx];
    const updated = {
      ...previous,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.projects[idx] = updated;
    this.persistBrowserState();

    if (this.collabHooks && updated.persistence !== 'local') {
      const actor = this.collabHooks.getCurrentSession()?.user ?? null;
      const members = this.members[id] || [];
      processOperationalStateDiff({
        projectId: id,
        previous,
        next: updated,
        actor,
        members,
        activity: this.collabHooks.activity,
        notifications: this.collabHooks.notifications,
      });
    }

    return { ...updated };
  }

  async archiveProject(id: string): Promise<ProjectDomainModel> {
    return this.updateProject(id, { status: 'archived' });
  }

  async deleteProject(id: string): Promise<void> {
    this.projects = this.projects.filter(p => p.id !== id);
    delete this.members[id];
    this.persistBrowserState();
  }

  async getProjectMembers(projectId: string): Promise<ProjectMemberDomainModel[]> {
    return [...(this.members[projectId] || [])];
  }

  peekProjectSync(projectId: string): ProjectDomainModel | undefined {
    return this.projects.find(p => p.id === projectId);
  }

  peekMembersSync(projectId: string): ProjectMemberDomainModel[] {
    return this.members[projectId] || [];
  }

  async updateMemberRole(
    projectId: string,
    memberId: string,
    newRole: ProjectRole,
    actorRole: ProjectRole
  ): Promise<ProjectMemberDomainModel> {
    const projectMembers = this.members[projectId] || [];
    const memberIdx = projectMembers.findIndex(m => m.id === memberId);
    if (memberIdx === -1) throw new Error(`Member ${memberId} not found in project.`);

    const currentMember = projectMembers[memberIdx];

    if (!canManageRole(actorRole, currentMember.role, newRole)) {
      throw new Error(`Unauthorized: Cannot change role from ${currentMember.role} to ${newRole}.`);
    }

    const updated = {
      ...currentMember,
      role: newRole,
    };
    this.members[projectId][memberIdx] = updated;

    if (this.collabHooks && currentMember.role !== newRole) {
      const actor = this.collabHooks.getCurrentSession()?.user ?? null;
      const proj = this.projects.find(p => p.id === projectId);
      const roleWindow = Math.floor(Date.now() / 15000);
      this.collabHooks.activity.recordSystemEvent({
        projectId,
        userId: actor?.id || updated.userId,
        userFullName: actor?.fullName || updated.fullName,
        avatarUrl: actor?.avatarUrl ?? null,
        activityType: 'member_role_changed',
        title: `${updated.fullName} role changed from ${currentMember.role.replace(/_/g, ' ')} to ${newRole.replace(/_/g, ' ')}`,
        description: null,
        entityType: 'member',
        entityId: updated.userId,
        entityLabel: updated.fullName,
        dedupKey: `mem_role:${updated.id}:${currentMember.role}:${newRole}:${roleWindow}`,
      });
      this.collabHooks.notifications.emitNotification({
        userId: updated.userId,
        projectId,
        projectTitle: proj?.title || null,
        actorId: actor?.id || null,
        actorName: actor?.fullName || null,
        actorAvatarUrl: actor?.avatarUrl || null,
        category: 'people_security',
        eventType: 'role_changed',
        priority: 'attention',
        title: `Your project role changed in ${proj?.title || 'production'}`,
        body: `Updated from ${currentMember.role.replace(/_/g, ' ')} to ${newRole.replace(/_/g, ' ')}.`,
        entityType: 'member',
        entityId: updated.userId,
        entityLabel: proj?.title || 'Project Access',
        dedupKey: `role_chg:${updated.id}:${currentMember.role}:${newRole}:${roleWindow}`,
        metadata: { old_role: currentMember.role, new_role: newRole },
      });
      this.collabHooks.realtime?.emitProjectSignal(projectId, {
        scope: 'members',
        projectId,
        entityId: updated.userId,
        timestamp: new Date().toISOString(),
      });
    }

    return { ...updated };
  }

  async updateMemberDetails(
    projectId: string,
    memberId: string,
    updates: { department?: string | null; directoryEntryId?: string | null }
  ): Promise<ProjectMemberDomainModel> {
    const projectMembers = this.members[projectId] || [];
    const memberIdx = projectMembers.findIndex(m => m.id === memberId);
    if (memberIdx === -1) throw new Error(`Member ${memberId} not found in project.`);

    const currentMember = projectMembers[memberIdx];
    const updated: ProjectMemberDomainModel = {
      ...currentMember,
      ...(updates.department !== undefined
        ? { department: updates.department === null ? null : updates.department.trim().slice(0, 60) || null }
        : {}),
      ...(updates.directoryEntryId !== undefined
        ? { directoryEntryId: updates.directoryEntryId === null ? null : updates.directoryEntryId.trim() || null }
        : {}),
    };
    this.members[projectId][memberIdx] = updated;
    return { ...updated };
  }

  async removeProjectMember(memberId: string): Promise<void> {
    for (const key of Object.keys(this.members)) {
      const target = this.members[key].find(m => m.id === memberId);
      if (target && (target.role === 'owner' || target.isOwner)) {
        throw new Error('Unauthorized: Project owner cannot be removed.');
      }
      if (target) {
        this.members[key] = this.members[key].filter(m => m.id !== memberId);
        (this.collabHooks as any)?.realtime?.emitProjectSignal(key, {
          scope: 'members',
          projectId: key,
          entityId: target.userId,
          timestamp: new Date().toISOString(),
        });
        (this.collabHooks as any)?.realtime?.emitUserSignal(target.userId, {
          scope: 'members',
          projectId: key,
          revoked: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
}

function generateSecureToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    throw new Error('Cryptographically secure random generator unavailable.');
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function maskEmailHint(email: string): string | null {
  const at = email.indexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}${'*'.repeat(Math.min(5, Math.max(1, local.length - 1)))}@${domain}`;
}

export class MockInvitationService implements IInvitationService {
  private invitations: InvitationDomainModel[] = [];
  private invitedByMap = new Map<string, string>();

  constructor(
    private projectService: MockProjectService,
    private getCurrentSession?: () => UserSession | null,
    private activityService?: MockActivityService,
    private notificationService?: MockNotificationService,
    private realtime?: MockRealtimeCollaborationService
  ) {}

  async getProjectInvitations(projectId: string): Promise<InvitationDomainModel[]> {
    const nowMs = Date.now();
    return this.invitations
      .filter(i => i.projectId === projectId)
      .map(i => ({
        ...i,
        status: i.status === 'pending' && new Date(i.expiresAt).getTime() < nowMs ? 'expired' : i.status,
      }));
  }

  async createInvitation(
    projectId: string,
    email: string,
    role: ProjectRole,
    departmentId?: string,
    expiresInHours = 7 * 24,
    options?: CreateInvitationOptions
  ): Promise<InvitationDomainModel> {
    if (role === 'owner') {
      throw new InvitationError('inviter_not_authorized', 'Invitations cannot grant the owner role.');
    }

    const cleanEmail = email.trim().toLowerCase();
    // Check if duplicate pending
    const existing = this.invitations.find(
      i => i.projectId === projectId && i.email.toLowerCase() === cleanEmail && i.status === 'pending'
    );
    if (existing) {
      throw new Error(`A pending invitation already exists for ${email}.`);
    }

    const token = `mock-${generateSecureToken()}`;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    const inv: InvitationDomainModel = {
      id: `inv-${Date.now()}-${generateSecureToken().slice(0, 6)}`,
      projectId,
      email: cleanEmail,
      role,
      departmentId,
      department: options?.department?.trim().slice(0, 60) || null,
      directoryEntryId: options?.directoryEntryId?.trim() || null,
      status: 'pending',
      expiresAt,
      createdAt: new Date().toISOString(),
      invitationToken: token,
      isMock: true,
    };

    this.invitations.push(inv);

    const inviter = this.getCurrentSession?.()?.user ?? null;
    if (inviter) {
      this.invitedByMap.set(inv.id, inviter.id);
    }

    if (this.notificationService) {
      const targetUser = MOCK_USERS.find(u => u.email.toLowerCase() === cleanEmail);
      const project = await this.projectService.getProjectById(projectId);
      if (targetUser && project && project.persistence !== 'local') {
        this.notificationService.emitNotification({
          userId: targetUser.id,
          projectId,
          projectTitle: project.title,
          actorId: inviter?.id || null,
          actorName: inviter?.fullName || null,
          actorAvatarUrl: inviter?.avatarUrl || null,
          category: 'people_security',
          eventType: 'invitation_received',
          priority: 'attention',
          title: `Invitation to ${project.title}`,
          body: `${inviter?.fullName || 'A producer'} invited you as ${role.replace(/_/g, ' ')}.`,
          entityType: 'invitation',
          entityId: token,
          entityLabel: project.title,
          dedupKey: `inv_recv:${inv.id}`,
          metadata: { invitation_id: inv.id, role, department: inv.department },
        });
      }
    }

    return { ...inv };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    const match = this.invitations.find(i => i.id === invitationId);
    if (!match) throw new Error('Invitation not found.');
    match.status = 'revoked';
  }

  async previewInvitation(token: string): Promise<InvitationPreview> {
    const clean = token.trim();
    const match = this.invitations.find(i => i.invitationToken === clean);
    if (!match) {
      return { status: 'invalid' };
    }

    const project = await this.projectService.getProjectById(match.projectId);
    const projectName = project?.title || 'Untitled Project';

    if (match.status === 'revoked') {
      return { status: 'revoked', projectName, role: match.role };
    }
    if (match.status === 'accepted') {
      return { status: 'accepted', projectId: match.projectId, projectName, role: match.role };
    }
    if (match.status === 'expired' || new Date(match.expiresAt).getTime() < Date.now()) {
      match.status = 'expired';
      return { status: 'expired', projectName, role: match.role, expiresAt: match.expiresAt };
    }

    const session = this.getCurrentSession?.();
    const actorEmail = session?.user?.email?.trim().toLowerCase();
    if (actorEmail) {
      if (actorEmail !== match.email.toLowerCase()) {
        return {
          status: 'email_mismatch',
          projectName,
          role: match.role,
          department: match.department ?? null,
          expiresAt: match.expiresAt,
          invitedEmailHint: maskEmailHint(match.email),
        };
      }

      const members = await this.projectService.getProjectMembers(match.projectId);
      const existingMember = members.find(
        m => m.userId === session?.user?.id || m.email.toLowerCase() === actorEmail
      );
      if (existingMember) {
        return {
          status: 'already_member',
          projectId: match.projectId,
          projectName,
          role: existingMember.role,
          department: match.department ?? null,
          expiresAt: match.expiresAt,
        };
      }
    }

    return {
      status: 'valid',
      projectId: actorEmail ? match.projectId : undefined,
      projectName,
      role: match.role,
      department: match.department ?? null,
      expiresAt: match.expiresAt,
    };
  }

  async acceptInvitation(token: string): Promise<{ success: boolean; projectId: string; role: ProjectRole }> {
    const clean = token.trim();
    const match = this.invitations.find(i => i.invitationToken === clean && i.status === 'pending');
    if (!match) throw new InvitationError('invalid', 'Invalid or already used invitation token.');

    if (new Date(match.expiresAt) < new Date()) {
      match.status = 'expired';
      throw new InvitationError('expired', 'This invitation has expired.');
    }

    if (match.role === 'owner') {
      throw new InvitationError('inviter_not_authorized', 'Invitations cannot grant the owner role.');
    }

    const session = this.getCurrentSession?.();
    if (session !== undefined) {
      if (!session?.user) {
        throw new InvitationError('unauthenticated', 'Authentication required to accept an invitation.');
      }
      if (session.user.email.trim().toLowerCase() !== match.email.toLowerCase()) {
        throw new InvitationError('email_mismatch', 'This invitation was issued for a different email address.');
      }
    }

    match.status = 'accepted';
    // Add to project members via projectService
    const members = await this.projectService.getProjectMembers(match.projectId);
    const existingMember = members.find(m => m.email.toLowerCase() === match.email.toLowerCase());

    if (!existingMember) {
      const joinedUserId = session?.user?.id || `usr-${Date.now()}`;
      const joinedFullName = session?.user?.fullName || match.email.split('@')[0];
      await (this.projectService as any).members[match.projectId].push({
        id: `mem-${Date.now()}`,
        projectId: match.projectId,
        userId: joinedUserId,
        fullName: joinedFullName,
        email: match.email,
        role: match.role,
        departmentId: match.departmentId,
        department: match.department ?? null,
        directoryEntryId: match.directoryEntryId ?? null,
        isOwner: false,
        joinedAt: new Date().toISOString(),
      });

      const proj = await this.projectService.getProjectById(match.projectId);
      if (proj && proj.persistence !== 'local') {
        this.activityService?.recordSystemEvent({
          projectId: match.projectId,
          userId: joinedUserId,
          userFullName: joinedFullName,
          avatarUrl: session?.user?.avatarUrl ?? null,
          activityType: 'member_joined',
          title: `${joinedFullName} joined as ${match.role.replace(/_/g, ' ')}`,
          description: match.department ? `Department: ${match.department}` : null,
          entityType: 'member',
          entityId: joinedUserId,
          entityLabel: joinedFullName,
          dedupKey: `mem_join:${match.id}`,
        });

        const inviterId = this.invitedByMap.get(match.id);
        if (inviterId) {
          this.notificationService?.emitNotification({
            userId: inviterId,
            projectId: match.projectId,
            projectTitle: proj.title,
            actorId: joinedUserId,
            actorName: joinedFullName,
            actorAvatarUrl: session?.user?.avatarUrl ?? null,
            category: 'people_security',
            eventType: 'invitation_accepted',
            priority: 'normal',
            title: `${joinedFullName} joined ${proj.title}`,
            body: `Accepted role: ${match.role.replace(/_/g, ' ')}`,
            entityType: 'member',
            entityId: joinedUserId,
            entityLabel: joinedFullName,
            dedupKey: `inv_acc:${match.id}`,
            metadata: { invitation_id: match.id, role: match.role },
          });
        }
      }
    }

    return {
      success: true,
      projectId: match.projectId,
      role: match.role,
    };
  }
}

function cloneInitialMockActivities(): Record<string, ActivityDomainModel[]> {
  return JSON.parse(JSON.stringify(INITIAL_MOCK_ACTIVITIES));
}

export class MockActivityService implements IActivityService {
  private activities: Record<string, ActivityDomainModel[]> = cloneInitialMockActivities();
  private dedupKeys = new Set<string>();
  private realtime?: MockRealtimeCollaborationService;

  constructor(
    private projectService?: MockProjectService,
    private getCurrentSession?: () => UserSession | null
  ) {}

  attachAccessScope(
    projectService: MockProjectService,
    getCurrentSession: () => UserSession | null
  ): void {
    this.projectService = projectService;
    this.getCurrentSession = getCurrentSession;
  }

  attachRealtime(realtime: MockRealtimeCollaborationService): void {
    this.realtime = realtime;
  }

  private async assertMemberAccess(projectId: string): Promise<void> {
    if (!this.projectService || !this.getCurrentSession) return;
    const project = await this.projectService.getProjectById(projectId);
    if (!project) {
      throw new Error('Access denied: Project not found.');
    }
    if (project.persistence === 'local') {
      return;
    }
    const user = this.getCurrentSession()?.user;
    if (!user) {
      throw new Error('Access denied: Authentication required to view project activity.');
    }
    const members = await this.projectService.getProjectMembers(projectId);
    const isMember = members.some(
      m => m.userId === user.id || m.email.toLowerCase() === user.email.toLowerCase()
    );
    if (!isMember) {
      throw new Error('Access denied: You are not a member of this project.');
    }
  }

  recordSystemEvent(
    event: Omit<ActivityDomainModel, 'id' | 'createdAt'> & { dedupKey?: string }
  ): ActivityDomainModel | null {
    if (event.dedupKey) {
      const composite = `${event.projectId}:${event.dedupKey}`;
      if (this.dedupKeys.has(composite)) {
        return null;
      }
      this.dedupKeys.add(composite);
    }

    const { dedupKey: _ignored, ...rest } = event;
    const created: ActivityDomainModel = {
      ...rest,
      id: `act-${Date.now()}-${generateSecureToken().slice(0, 6)}`,
      createdAt: new Date().toISOString(),
    };

    if (!this.activities[event.projectId]) {
      this.activities[event.projectId] = [];
    }
    this.activities[event.projectId].unshift(created);
    this.realtime?.emitProjectSignal(event.projectId, {
      scope: 'activity',
      projectId: event.projectId,
      entityId: created.id,
      timestamp: created.createdAt,
    });
    return { ...created };
  }

  async getProjectActivity(projectId: string, limit = 10): Promise<ActivityDomainModel[]> {
    const page = await this.getProjectActivityPage(projectId, { limit });
    return page.activities;
  }

  async getProjectActivityPage(
    projectId: string,
    options?: { beforeCreatedAt?: string; beforeId?: string; limit?: number }
  ): Promise<ActivityPage> {
    await this.assertMemberAccess(projectId);
    const project = this.projectService ? await this.projectService.getProjectById(projectId) : null;
    if (project?.persistence === 'local') {
      return { activities: [], hasMore: false };
    }

    const pageLimit = Math.min(Math.max(options?.limit ?? 25, 1), 50);
    const sorted = [...(this.activities[projectId] || [])].sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt.localeCompare(a.createdAt);
      return b.id.localeCompare(a.id);
    });

    const filtered = options?.beforeCreatedAt
      ? sorted.filter(item => {
          if (item.createdAt < options.beforeCreatedAt!) return true;
          if (item.createdAt > options.beforeCreatedAt!) return false;
          return options.beforeId ? item.id < options.beforeId : false;
        })
      : sorted;

    const hasMore = filtered.length > pageLimit;
    return {
      activities: (hasMore ? filtered.slice(0, pageLimit) : filtered).map(a => ({ ...a })),
      hasMore,
    };
  }

  async logActivity(_input: Omit<ActivityDomainModel, 'id' | 'createdAt'>): Promise<ActivityDomainModel> {
    throw new Error('Activity history is generated server-side from verified project operations.');
  }
}

export interface EmitMockNotificationInput {
  userId: string;
  projectId: string | null;
  projectTitle?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorAvatarUrl?: string | null;
  category: NotificationCategory;
  eventType: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body?: string | null;
  entityType: NotificationEntityType;
  entityId: string;
  entityLabel?: string | null;
  dedupKey: string;
  groupKey?: string | null;
  metadata?: Record<string, any>;
}

function defaultPrefsFor(userId: string): NotificationPreferencesDomainModel {
  return {
    userId,
    mentionsEnabled: true,
    discussionRepliesEnabled: true,
    taskAssignmentsEnabled: true,
    scheduleChangesEnabled: true,
    callSheetsEnabled: true,
    dprReviewsEnabled: true,
    updatedAt: new Date().toISOString(),
  };
}

export class MockNotificationService implements INotificationService {
  private items: NotificationDomainModel[] = [];
  private dedupSet = new Set<string>();
  private preferences = new Map<string, NotificationPreferencesDomainModel>();
  private realtime?: MockRealtimeCollaborationService;

  constructor(
    private projectService: MockProjectService,
    private getCurrentSession?: () => UserSession | null
  ) {}

  attachRealtime(realtime: MockRealtimeCollaborationService): void {
    this.realtime = realtime;
  }

  private requireUser() {
    const user = this.getCurrentSession?.()?.user;
    if (!user) {
      throw new Error('Authentication required.');
    }
    return user;
  }

  private getPrefsSync(userId: string): NotificationPreferencesDomainModel {
    let existing = this.preferences.get(userId);
    if (!existing) {
      existing = defaultPrefsFor(userId);
      this.preferences.set(userId, existing);
    }
    return existing;
  }

  private isEventEnabled(userId: string, eventType: NotificationEventType): boolean {
    if (eventType === 'invitation_received' || eventType === 'role_changed') {
      return true;
    }
    const prefs = this.getPrefsSync(userId);
    switch (eventType) {
      case 'invitation_accepted':
        return true;
      case 'discussion_mention':
        return prefs.mentionsEnabled;
      case 'discussion_reply':
      case 'project_thread_new':
        return prefs.discussionRepliesEnabled;
      case 'task_assigned':
      case 'task_deadline_changed':
        return prefs.taskAssignmentsEnabled;
      case 'schedule_rescheduled':
        return prefs.scheduleChangesEnabled;
      case 'call_sheet_published':
        return prefs.callSheetsEnabled;
      case 'dpr_submitted':
      case 'dpr_approved':
        return prefs.dprReviewsEnabled;
      default:
        return true;
    }
  }

  async emitNotification(input: EmitMockNotificationInput): Promise<NotificationDomainModel | null> {
    if (!input.userId || !input.dedupKey.trim()) return null;
    if (input.actorId && input.actorId === input.userId) return null;

    if (input.projectId) {
      const proj = this.projectService.peekProjectSync(input.projectId);
      if (!proj || proj.persistence === 'local') {
        return null;
      }
      if (input.eventType !== 'invitation_received') {
        const members = this.projectService.peekMembersSync(input.projectId);
        const isMember = members.some(m => m.userId === input.userId);
        if (!isMember) return null;
      }
    }

    if (!this.isEventEnabled(input.userId, input.eventType)) {
      return null;
    }

    const dedupComposite = `${input.userId}:${input.dedupKey}`;
    if (this.dedupSet.has(dedupComposite)) {
      return null;
    }
    this.dedupSet.add(dedupComposite);

    if (input.eventType === 'discussion_reply' && input.groupKey) {
      const existingGroup = this.items.find(
        n =>
          n.userId === input.userId &&
          n.eventType === 'discussion_reply' &&
          n.metadata?.groupKey === input.groupKey &&
          !n.readAt &&
          !n.dismissedAt
      );
      if (existingGroup) {
        const count = Number(existingGroup.metadata?.coalesced_count || 1) + 1;
        existingGroup.actorId = input.actorId ?? null;
        existingGroup.actorName = input.actorName ?? null;
        existingGroup.actorAvatarUrl = input.actorAvatarUrl ?? null;
        existingGroup.title = `${input.entityLabel || 'Discussion'} — ${count} new replies`;
        existingGroup.body = input.body ?? null;
        existingGroup.metadata = {
          ...(input.metadata || {}),
          groupKey: input.groupKey,
          coalesced_count: count,
        };
        existingGroup.createdAt = new Date().toISOString();
        this.realtime?.emitUserSignal(input.userId, {
          scope: 'notifications',
          projectId: input.projectId,
          timestamp: existingGroup.createdAt,
        });
        return { ...existingGroup };
      }
    }

    const created: NotificationDomainModel = {
      id: `notif-${Date.now()}-${generateSecureToken().slice(0, 6)}`,
      userId: input.userId,
      projectId: input.projectId,
      projectTitle: input.projectTitle ?? null,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      actorAvatarUrl: input.actorAvatarUrl ?? null,
      category: input.category,
      eventType: input.eventType,
      priority: input.priority,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel ?? null,
      metadata: {
        ...(input.metadata || {}),
        ...(input.groupKey ? { groupKey: input.groupKey } : {}),
      },
      readAt: null,
      dismissedAt: null,
      createdAt: new Date().toISOString(),
    };

    this.items.unshift(created);
    this.realtime?.emitUserSignal(created.userId, {
      scope: 'notifications',
      projectId: created.projectId,
      timestamp: created.createdAt,
    });
    return { ...created };
  }

  private async isVisibleToUser(notif: NotificationDomainModel, userId: string): Promise<boolean> {
    if (notif.userId !== userId || notif.dismissedAt) return false;
    if (!notif.projectId || notif.eventType === 'invitation_received') return true;
    const proj = await this.projectService.getProjectById(notif.projectId);
    if (!proj || proj.persistence === 'local') return false;
    const members = await this.projectService.getProjectMembers(notif.projectId);
    return members.some(m => m.userId === userId);
  }

  async getNotifications(options?: {
    projectId?: string | null;
    filter?: NotificationFilter;
    beforeCreatedAt?: string;
    beforeId?: string;
    limit?: number;
  }): Promise<NotificationPage> {
    const user = this.requireUser();
    if (options?.projectId) {
      const proj = await this.projectService.getProjectById(options.projectId);
      if (proj?.persistence === 'local') {
        throw new Error('Local-only projects do not support shared notifications or cross-device delivery.');
      }
    }

    const pageLimit = Math.min(Math.max(options?.limit ?? 25, 1), 50);
    const filter = options?.filter ?? 'all';
    const sorted = [...this.items].sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt.localeCompare(a.createdAt);
      return b.id.localeCompare(a.id);
    });

    const visible: NotificationDomainModel[] = [];
    for (const n of sorted) {
      if (!(await this.isVisibleToUser(n, user.id))) continue;
      if (options?.projectId && n.projectId !== options.projectId && n.eventType !== 'invitation_received') {
        continue;
      }
      if (filter === 'unread' && n.readAt) continue;
      if (filter === 'mentions' && n.eventType !== 'discussion_mention') continue;
      if (options?.beforeCreatedAt) {
        if (n.createdAt > options.beforeCreatedAt) continue;
        if (n.createdAt === options.beforeCreatedAt && options.beforeId && n.id >= options.beforeId) continue;
      }
      visible.push({ ...n });
      if (visible.length >= pageLimit + 1) break;
    }

    const hasMore = visible.length > pageLimit;
    return {
      notifications: hasMore ? visible.slice(0, pageLimit) : visible,
      hasMore,
    };
  }

  async getUnreadCount(projectId?: string | null): Promise<number> {
    const user = this.getCurrentSession?.()?.user;
    if (!user) return 0;
    if (projectId) {
      const proj = await this.projectService.getProjectById(projectId);
      if (proj?.persistence === 'local') return 0;
    }

    let count = 0;
    for (const n of this.items) {
      if (n.readAt) continue;
      if (!(await this.isVisibleToUser(n, user.id))) continue;
      if (projectId && n.projectId !== projectId && n.eventType !== 'invitation_received') continue;
      count += 1;
    }
    return count;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const user = this.requireUser();
    const match = this.items.find(n => n.id === notificationId && n.userId === user.id);
    if (!match) {
      throw new Error('Notification not found or access denied.');
    }
    if (!match.readAt) {
      match.readAt = new Date().toISOString();
      this.realtime?.emitUserSignal(user.id, {
        scope: 'notifications',
        projectId: match.projectId,
        timestamp: match.readAt,
      });
    }
  }

  async markAllAsRead(projectId?: string | null): Promise<number> {
    const user = this.requireUser();
    const now = new Date().toISOString();
    let count = 0;
    for (const n of this.items) {
      if (n.userId !== user.id || n.dismissedAt || n.readAt) continue;
      if (projectId && n.projectId !== projectId && n.eventType !== 'invitation_received') continue;
      n.readAt = now;
      count += 1;
    }
    if (count > 0) {
      this.realtime?.emitUserSignal(user.id, {
        scope: 'notifications',
        projectId: projectId ?? null,
        timestamp: now,
      });
    }
    return count;
  }

  async dismissNotification(notificationId: string): Promise<void> {
    const user = this.requireUser();
    const match = this.items.find(n => n.id === notificationId && n.userId === user.id);
    if (!match) {
      throw new Error('Notification not found or access denied.');
    }
    const now = new Date().toISOString();
    match.dismissedAt = match.dismissedAt || now;
    match.readAt = match.readAt || now;
    this.realtime?.emitUserSignal(user.id, {
      scope: 'notifications',
      projectId: match.projectId,
      timestamp: now,
    });
  }

  async getPreferences(): Promise<NotificationPreferencesDomainModel> {
    const user = this.requireUser();
    return { ...this.getPrefsSync(user.id) };
  }

  async updatePreferences(
    updates: UpdateNotificationPreferencesInput
  ): Promise<NotificationPreferencesDomainModel> {
    const user = this.requireUser();
    const current = this.getPrefsSync(user.id);
    const updated: NotificationPreferencesDomainModel = {
      ...current,
      ...(updates.mentionsEnabled !== undefined ? { mentionsEnabled: updates.mentionsEnabled } : {}),
      ...(updates.discussionRepliesEnabled !== undefined
        ? { discussionRepliesEnabled: updates.discussionRepliesEnabled }
        : {}),
      ...(updates.taskAssignmentsEnabled !== undefined
        ? { taskAssignmentsEnabled: updates.taskAssignmentsEnabled }
        : {}),
      ...(updates.scheduleChangesEnabled !== undefined
        ? { scheduleChangesEnabled: updates.scheduleChangesEnabled }
        : {}),
      ...(updates.callSheetsEnabled !== undefined ? { callSheetsEnabled: updates.callSheetsEnabled } : {}),
      ...(updates.dprReviewsEnabled !== undefined ? { dprReviewsEnabled: updates.dprReviewsEnabled } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.preferences.set(user.id, updated);
    return { ...updated };
  }
}

function resolveMemberUserIdByAssignee(
  members: ProjectMemberDomainModel[],
  assignee?: string | null
): string | null {
  const clean = (assignee || '').trim();
  if (!clean) return null;

  const byId = members.find(m => m.userId === clean);
  if (byId) return byId.userId;

  const cleanLower = clean.toLowerCase();
  const byEmail = members.find(m => m.email.toLowerCase() === cleanLower);
  if (byEmail) return byEmail.userId;

  const byName = members.filter(m => m.fullName.trim().toLowerCase() === cleanLower);
  return byName.length === 1 ? byName[0].userId : null;
}

function processOperationalStateDiff(params: {
  projectId: string;
  previous: ProjectDomainModel;
  next: ProjectDomainModel;
  actor: UserSession['user'];
  members: ProjectMemberDomainModel[];
  activity: MockActivityService;
  notifications: MockNotificationService;
}): void {
  const { projectId, previous, next, actor, members, activity, notifications } = params;
  const actorId = actor?.id || '';
  const actorName = actor?.fullName || 'Production Operator';
  const actorAvatar = actor?.avatarUrl ?? null;

  const prevProd: any = previous.productionState || {};
  const nextProd: any = next.productionState || {};

  // A. Call Sheets Published / Revised
  const nextCallSheets: any[] = Array.isArray(nextProd.callSheets) ? nextProd.callSheets : [];
  const prevCallSheets: any[] = Array.isArray(prevProd.callSheets) ? prevProd.callSheets : [];
  const nextShootDays: any[] = Array.isArray(nextProd.shootingDays) ? nextProd.shootingDays : [];

  for (const cs of nextCallSheets) {
    if (!cs?.published) continue;
    const prevCs = prevCallSheets.find(p => p.id === cs.id);
    const rev = Number(cs.revisionNumber || 1);
    const prevRev = Number(prevCs?.revisionNumber || 1);
    if (!prevCs || !prevCs.published || rev > prevRev) {
      const day = nextShootDays.find(d => d.id === cs.shootingDayId);
      const dayNum = day?.dayNumber ?? '?';
      activity.recordSystemEvent({
        projectId,
        userId: actorId,
        userFullName: actorName,
        avatarUrl: actorAvatar,
        activityType: 'call_sheet_published',
        title: `Call Sheet ${rev > 1 ? `Rev ${rev} revised` : 'published'} for Day ${dayNum}`,
        description: day?.date ? `Shoot Date: ${day.date} · General Call: ${cs.generalCallTime || ''}` : null,
        entityType: 'call_sheet',
        entityId: cs.id,
        entityLabel: `Day ${dayNum} Call Sheet`,
        dedupKey: `act_cs:${cs.id}:r${rev}`,
      });

      const dirIds = new Set<string>([
        ...(Array.isArray(cs.directoryEntryIds) ? cs.directoryEntryIds : []),
        ...(Array.isArray(cs.castCalls) ? cs.castCalls.map((c: any) => c.directoryEntryId).filter(Boolean) : []),
      ]);
      for (const m of members) {
        if (m.directoryEntryId && dirIds.has(m.directoryEntryId)) {
          notifications.emitNotification({
            userId: m.userId,
            projectId,
            projectTitle: next.title,
            actorId: actorId || null,
            actorName,
            actorAvatarUrl: actorAvatar,
            category: 'production',
            eventType: 'call_sheet_published',
            priority: 'attention',
            title: `Call Sheet ${rev > 1 ? `Rev ${rev}` : 'Published'} · Day ${dayNum}`,
            body: `${day?.date ? `Date: ${day.date} · ` : ''}General Call ${cs.generalCallTime || 'TBD'}`,
            entityType: 'call_sheet',
            entityId: cs.id,
            entityLabel: `Day ${dayNum} Call Sheet`,
            dedupKey: `cs_pub:${cs.id}:r${rev}`,
            metadata: { shooting_day_id: cs.shootingDayId, revision: rev },
          });
        }
      }
    }
  }

  // B. DPR Submitted / Approved
  const nextDprs: any[] = Array.isArray(nextProd.dailyReports) ? nextProd.dailyReports : [];
  const prevDprs: any[] = Array.isArray(prevProd.dailyReports) ? prevProd.dailyReports : [];
  for (const dpr of nextDprs) {
    const prevDpr = prevDprs.find(p => p.id === dpr.id);
    const oldStatus = prevDpr?.status || 'Draft';
    const newStatus = dpr?.status || 'Draft';
    const dayNum = dpr.shootDayNumber ?? '?';

    if (newStatus === 'Submitted' && oldStatus !== 'Submitted') {
      activity.recordSystemEvent({
        projectId,
        userId: actorId,
        userFullName: actorName,
        avatarUrl: actorAvatar,
        activityType: 'dpr_submitted',
        title: `Day ${dayNum} DPR submitted for review`,
        description: dpr.calendarDate ? `Shoot Date: ${dpr.calendarDate}` : null,
        entityType: 'dpr',
        entityId: dpr.id,
        entityLabel: `Day ${dayNum} DPR`,
        dedupKey: `act_dpr_sub:${dpr.id}:${dpr.updatedAt || dayNum}`,
      });

      for (const m of members) {
        if (m.role === 'owner' || m.role === 'producer' || m.isOwner) {
          notifications.emitNotification({
            userId: m.userId,
            projectId,
            projectTitle: next.title,
            actorId: actorId || null,
            actorName,
            actorAvatarUrl: actorAvatar,
            category: 'production',
            eventType: 'dpr_submitted',
            priority: 'attention',
            title: `DPR ready for review · Day ${dayNum}`,
            body: `${dpr.preparedBy ? `Prepared by ${dpr.preparedBy} · ` : ''}${dpr.calendarDate || ''}`.trim() || null,
            entityType: 'dpr',
            entityId: dpr.id,
            entityLabel: `Day ${dayNum} DPR`,
            dedupKey: `dpr_sub:${dpr.id}:${dpr.updatedAt || ''}`,
            metadata: { shooting_day_id: dpr.shootingDayId },
          });
        }
      }
    } else if (newStatus === 'Approved' && oldStatus !== 'Approved') {
      activity.recordSystemEvent({
        projectId,
        userId: actorId,
        userFullName: actorName,
        avatarUrl: actorAvatar,
        activityType: 'dpr_approved',
        title: `Day ${dayNum} DPR approved`,
        description: null,
        entityType: 'dpr',
        entityId: dpr.id,
        entityLabel: `Day ${dayNum} DPR`,
        dedupKey: `act_dpr_app:${dpr.id}:${dpr.updatedAt || dayNum}`,
      });

      const prepUid = resolveMemberUserIdByAssignee(members, dpr.preparedBy);
      if (prepUid) {
        notifications.emitNotification({
          userId: prepUid,
          projectId,
          projectTitle: next.title,
          actorId: actorId || null,
          actorName,
          actorAvatarUrl: actorAvatar,
          category: 'production',
          eventType: 'dpr_approved',
          priority: 'normal',
          title: `Day ${dayNum} DPR approved`,
          body: dpr.approvedBy ? `Approved by ${dpr.approvedBy}` : 'Production sign-off complete.',
          entityType: 'dpr',
          entityId: dpr.id,
          entityLabel: `Day ${dayNum} DPR`,
          dedupKey: `dpr_app:${dpr.id}:${dpr.updatedAt || ''}`,
          metadata: { shooting_day_id: dpr.shootingDayId },
        });
      }
    }
  }

  // C. Shooting Days Rescheduled
  const prevShootDays: any[] = Array.isArray(prevProd.shootingDays) ? prevProd.shootingDays : [];
  for (const day of nextShootDays) {
    const prevDay = prevShootDays.find(d => d.id === day.id);
    if (prevDay && (prevDay.date !== day.date || prevDay.callTime !== day.callTime)) {
      activity.recordSystemEvent({
        projectId,
        userId: actorId,
        userFullName: actorName,
        avatarUrl: actorAvatar,
        activityType: 'shoot_day_rescheduled',
        title: `Shooting Day ${day.dayNumber} rescheduled to ${day.date}`,
        description: `Call ${day.callTime || ''} (was ${prevDay.date || ''} ${prevDay.callTime || ''})`,
        entityType: 'shooting_day',
        entityId: day.id,
        entityLabel: `Shoot Day ${day.dayNumber}`,
        dedupKey: `act_sd:${day.id}:${day.date}:${day.callTime || ''}`,
      });

      const csForDay = nextCallSheets.find(c => c.shootingDayId === day.id);
      const dayDirIds = new Set<string>(Array.isArray(csForDay?.directoryEntryIds) ? csForDay.directoryEntryIds : []);
      for (const m of members) {
        const isLead = m.isOwner || m.role === 'owner' || m.role === 'producer' || m.role === 'director' || m.role === 'first_ad';
        const isOnCall = Boolean(m.directoryEntryId && dayDirIds.has(m.directoryEntryId));
        if (isLead || isOnCall) {
          notifications.emitNotification({
            userId: m.userId,
            projectId,
            projectTitle: next.title,
            actorId: actorId || null,
            actorName,
            actorAvatarUrl: actorAvatar,
            category: 'production',
            eventType: 'schedule_rescheduled',
            priority: 'attention',
            title: `Shoot Day ${day.dayNumber} schedule updated`,
            body: `Moved to ${day.date}${day.callTime ? ` · Call ${day.callTime}` : ''}`,
            entityType: 'shooting_day',
            entityId: day.id,
            entityLabel: `Shoot Day ${day.dayNumber}`,
            dedupKey: `sd_resched:${day.id}:${day.date}:${day.callTime || ''}`,
            metadata: { date: day.date },
          });
        }
      }
    }
  }

  // D. Production Events Rescheduled
  const nextEvents: any[] = Array.isArray(nextProd.events) ? nextProd.events : [];
  const prevEvents: any[] = Array.isArray(prevProd.events) ? prevProd.events : [];
  for (const ev of nextEvents) {
    const prevEv = prevEvents.find(e => e.id === ev.id);
    if (prevEv && (prevEv.date !== ev.date || prevEv.endDate !== ev.endDate)) {
      activity.recordSystemEvent({
        projectId,
        userId: actorId,
        userFullName: actorName,
        avatarUrl: actorAvatar,
        activityType: 'event_rescheduled',
        title: `Event rescheduled: ${ev.title || 'Production Event'}`,
        description: `New date: ${ev.date || ''} (was ${prevEv.date || ''})`,
        entityType: 'production_event',
        entityId: ev.id,
        entityLabel: ev.title || 'Production Event',
        dedupKey: `act_ev:${ev.id}:${ev.date || ''}`,
      });
    }
  }

  // E. Phase Tasks Assigned / Completed / Deadline Changed
  const prevPhases = Array.isArray(previous.phases) ? previous.phases : [];
  const nextPhases = Array.isArray(next.phases) ? next.phases : [];
  const prevActMap = new Map<string, any>();
  for (const ph of prevPhases) {
    for (const act of ph.activities || []) {
      prevActMap.set(act.id, act);
    }
  }

  for (const ph of nextPhases) {
    for (const act of ph.activities || []) {
      const prevAct = prevActMap.get(act.id);
      const newAssignee = (act.assignedTo || '').trim();
      const oldAssignee = (prevAct?.assignedTo || '').trim();
      const resolvedUid = resolveMemberUserIdByAssignee(members, newAssignee);

      if (newAssignee && newAssignee !== oldAssignee) {
        activity.recordSystemEvent({
          projectId,
          userId: actorId,
          userFullName: actorName,
          avatarUrl: actorAvatar,
          activityType: 'task_assigned',
          title: `Task assigned: ${act.name} -> ${newAssignee}`,
          description: act.endDate ? `Due ${act.endDate}` : null,
          entityType: 'task',
          entityId: act.id,
          entityLabel: act.name,
          dedupKey: `act_tassign:${act.id}:${newAssignee}`,
        });

        if (resolvedUid) {
          notifications.emitNotification({
            userId: resolvedUid,
            projectId,
            projectTitle: next.title,
            actorId: actorId || null,
            actorName,
            actorAvatarUrl: actorAvatar,
            category: 'production',
            eventType: 'task_assigned',
            priority: 'attention',
            title: `Assigned to task: ${act.name}`,
            body: act.endDate ? `Due ${act.endDate}` : `In phase: ${ph.name}`,
            entityType: 'task',
            entityId: act.id,
            entityLabel: act.name,
            dedupKey: `task_assign:${act.id}:${resolvedUid}:${newAssignee}`,
            metadata: { phase_id: ph.id, end_date: act.endDate || null },
          });
        }
      } else if (prevAct && resolvedUid && prevAct.endDate !== act.endDate && act.endDate) {
        notifications.emitNotification({
          userId: resolvedUid,
          projectId,
          projectTitle: next.title,
          actorId: actorId || null,
          actorName,
          actorAvatarUrl: actorAvatar,
          category: 'production',
          eventType: 'task_deadline_changed',
          priority: 'normal',
          title: `Task deadline updated: ${act.name}`,
          body: `New due date: ${act.endDate}${prevAct.endDate ? ` (was ${prevAct.endDate})` : ''}`,
          entityType: 'task',
          entityId: act.id,
          entityLabel: act.name,
          dedupKey: `task_due:${act.id}:${act.endDate}`,
          metadata: { phase_id: ph.id, end_date: act.endDate },
        });
      }

      if (act.completed && !prevAct?.completed) {
        activity.recordSystemEvent({
          projectId,
          userId: actorId,
          userFullName: actorName,
          avatarUrl: actorAvatar,
          activityType: 'task_completed',
          title: `Completed task: ${act.name}`,
          description: `Phase: ${ph.name}`,
          entityType: 'task',
          entityId: act.id,
          entityLabel: act.name,
          dedupKey: `act_tdone:${act.id}:${act.endDate || 'done'}`,
        });
      }
    }
  }
}

export class MockConnectionService implements IConnectionService {
  async checkHealth(): Promise<ConnectionHealth> {
    return {
      state: 'mock',
      provider: 'mock',
      latencyMs: 1,
      message: 'Running in Local Mock Mode (Zero External Credentials Required)',
      lastChecked: new Date().toISOString(),
    };
  }
}

export class MockDiscussionService implements IDiscussionService {
  private threads: DiscussionThreadDomainModel[] = [];
  private messages: DiscussionMessageDomainModel[] = [];
  private idempotencyMap = new Map<string, DiscussionMessageDomainModel>();
  private readCursors = new Map<string, number>();

  constructor(
    private projectService: MockProjectService,
    private getCurrentSession?: () => UserSession | null,
    private activityService?: MockActivityService,
    private notificationService?: MockNotificationService,
    private realtime?: MockRealtimeCollaborationService
  ) {}

  private async resolveActor(projectId: string) {
    const session = this.getCurrentSession?.();
    const user = session?.user;
    if (!user) {
      throw new Error('Authentication required for project discussions.');
    }
    const members = await this.projectService.getProjectMembers(projectId);
    const member = members.find(
      m => m.userId === user.id || m.email.toLowerCase() === user.email.toLowerCase()
    );
    if (!member) {
      throw new Error('Access denied: You are not a member of this project.');
    }
    return { user, member, members };
  }

  async getProjectThreads(
    projectId: string,
    filter?: { entityType?: DiscussionEntityType; entityId?: string }
  ): Promise<DiscussionThreadDomainModel[]> {
    const { user } = await this.resolveActor(projectId);

    const matching = this.threads.filter(t => {
      if (t.projectId !== projectId) return false;
      if (filter?.entityType && t.entityType !== filter.entityType) return false;
      if (filter?.entityId && t.entityId !== filter.entityId) return false;
      return true;
    });

    return matching
      .map(t => {
        const readAt = this.readCursors.get(`${t.id}:${user.id}`) ?? Number.NEGATIVE_INFINITY;
        const threadMsgs = this.messages.filter(m => m.threadId === t.id);
        const unreadCount = threadMsgs.filter(
          m => !m.deletedAt && m.authorId !== user.id && new Date(m.createdAt).getTime() > readAt
        ).length;
        const latest = threadMsgs[threadMsgs.length - 1];
        const latestPreview = latest
          ? latest.deletedAt
            ? '[Message removed]'
            : latest.body.slice(0, 140)
          : null;
        return { ...t, unreadCount, latestPreview };
      })
      .sort((a, b) => {
        if (a.scope !== b.scope) return a.scope === 'project' ? -1 : 1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });
  }

  async ensureProjectThread(projectId: string, title?: string): Promise<string> {
    const { user, member } = await this.resolveActor(projectId);
    const existing = this.threads.find(t => t.projectId === projectId && t.scope === 'project');
    if (existing && !title) return existing.id;

    if (!hasPermission(member.role, 'discussions:post')) {
      throw new Error('Unauthorized: Your role has read-only discussion access.');
    }

    const now = new Date().toISOString();
    const created: DiscussionThreadDomainModel = {
      id: `thr-${Date.now()}-${generateSecureToken().slice(0, 6)}`,
      projectId,
      scope: 'project',
      entityType: null,
      entityId: null,
      entityLabel: null,
      title: (title?.trim() || 'Project Discussion').slice(0, 180),
      createdBy: user.id,
      creatorName: user.fullName,
      resolvedAt: null,
      resolvedBy: null,
      lastMessageAt: now,
      messageCount: 0,
      createdAt: now,
      unreadCount: 0,
      latestPreview: null,
    };
    this.threads.push(created);
    this.activityService?.recordSystemEvent({
      projectId,
      userId: user.id,
      userFullName: user.fullName,
      avatarUrl: user.avatarUrl ?? null,
      activityType: 'discussion_created',
      title: `Started discussion: ${created.title}`,
      description: 'Project-wide discussion',
      entityType: 'thread',
      entityId: created.id,
      entityLabel: created.title,
      dedupKey: `thread_new:${created.id}`,
    });
    return created.id;
  }

  async ensureRecordThread(projectId: string, target: DiscussionRecordTarget): Promise<string> {
    const { user, member } = await this.resolveActor(projectId);
    const existing = this.threads.find(
      t =>
        t.projectId === projectId &&
        t.scope === 'record' &&
        t.entityType === target.entityType &&
        t.entityId === target.entityId
    );
    if (existing) return existing.id;

    if (!hasPermission(member.role, 'discussions:post')) {
      throw new Error('Unauthorized: Your role has read-only discussion access.');
    }

    const now = new Date().toISOString();
    const created: DiscussionThreadDomainModel = {
      id: `thr-${Date.now()}-${generateSecureToken().slice(0, 6)}`,
      projectId,
      scope: 'record',
      entityType: target.entityType,
      entityId: target.entityId,
      entityLabel: target.entityLabel.slice(0, 180),
      title: (target.title?.trim() || target.entityLabel).slice(0, 180),
      createdBy: user.id,
      creatorName: user.fullName,
      resolvedAt: null,
      resolvedBy: null,
      lastMessageAt: now,
      messageCount: 0,
      createdAt: now,
      unreadCount: 0,
      latestPreview: null,
    };
    this.threads.push(created);
    this.activityService?.recordSystemEvent({
      projectId,
      userId: user.id,
      userFullName: user.fullName,
      avatarUrl: user.avatarUrl ?? null,
      activityType: 'discussion_created',
      title: `Started discussion: ${created.entityLabel || created.title}`,
      description: `Attached to ${target.entityType.replace(/_/g, ' ')}`,
      entityType: target.entityType,
      entityId: target.entityId,
      entityLabel: target.entityLabel,
      metadata: { thread_id: created.id },
      dedupKey: `thread_new:${created.id}`,
    });
    return created.id;
  }

  async getThreadMessages(
    threadId: string,
    options?: { before?: string; limit?: number }
  ): Promise<DiscussionMessagesPage> {
    const thread = this.threads.find(t => t.id === threadId);
    if (!thread) throw new Error('Discussion thread not found.');
    await this.resolveActor(thread.projectId);

    const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
    const beforeMs = options?.before ? new Date(options.before).getTime() : Number.POSITIVE_INFINITY;

    const allDesc = this.messages
      .filter(m => m.threadId === threadId && new Date(m.createdAt).getTime() < beforeMs)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const hasMore = allDesc.length > limit;
    const pageDesc = hasMore ? allDesc.slice(0, limit) : allDesc;
    return {
      messages: pageDesc.slice().reverse().map(m => ({ ...m })),
      hasMore,
    };
  }

  async postMessage(input: PostDiscussionMessageInput): Promise<DiscussionMessageDomainModel> {
    const thread = this.threads.find(t => t.id === input.threadId);
    if (!thread) throw new Error('Discussion thread not found.');
    if (thread.projectId !== input.projectId) {
      throw new Error('[cross_project] Message project does not match thread project.');
    }

    const { user, member, members } = await this.resolveActor(thread.projectId);
    if (!hasPermission(member.role, 'discussions:post')) {
      throw new Error('Unauthorized: Your project role does not permit posting discussions.');
    }

    const idemKey = `${input.threadId}:${user.id}:${input.clientRequestId}`;
    const existing = this.idempotencyMap.get(idemKey);
    if (existing) {
      return { ...existing };
    }

    const trimmed = input.body.trim();
    if (!trimmed || trimmed.length > 4000) {
      throw new Error('Message must be between 1 and 4000 characters.');
    }

    if (input.parentMessageId) {
      const parent = this.messages.find(m => m.id === input.parentMessageId);
      if (!parent || parent.threadId !== thread.id || parent.projectId !== thread.projectId) {
        throw new Error('[cross_thread] Parent message must belong to the same thread and project.');
      }
    }

    const memberIds = new Set(members.map(m => m.userId));
    const dedupMentions: string[] = [];
    for (const uid of input.mentionUserIds ?? []) {
      if (!memberIds.has(uid)) {
        throw new Error(`[invalid_mention] Mention target ${uid} is not a member of this project.`);
      }
      if (!dedupMentions.includes(uid)) dedupMentions.push(uid);
    }

    const now = new Date().toISOString();
    const created: DiscussionMessageDomainModel = {
      id: `msg-${Date.now()}-${generateSecureToken().slice(0, 6)}`,
      threadId: thread.id,
      projectId: thread.projectId,
      authorId: user.id,
      authorName: user.fullName,
      authorAvatarUrl: user.avatarUrl ?? null,
      authorRole: member.role,
      parentMessageId: input.parentMessageId ?? null,
      body: trimmed,
      mentionUserIds: dedupMentions,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
    };

    this.messages.push(created);
    this.idempotencyMap.set(idemKey, created);
    const priorCount = this.messages.filter(m => m.threadId === thread.id && m.id !== created.id).length;
    thread.lastMessageAt = now;
    thread.messageCount += 1;
    this.readCursors.set(`${thread.id}:${user.id}`, new Date(now).getTime());

    if (this.notificationService) {
      const proj = await this.projectService.getProjectById(thread.projectId);
      const threadLabel = thread.entityLabel || thread.title || 'Discussion';
      const snippet = trimmed.replace(/\s+/g, ' ').slice(0, 140);
      const groupKey = `thread:${thread.id}:${now.slice(0, 10)}`;

      // Resolve deduplicated targets in priority order: mention > thread_reply > project_thread_new
      const targetMap = new Map<string, 'mention' | 'thread_reply' | 'project_thread_new'>();
      for (const uid of dedupMentions) {
        if (uid !== user.id && memberIds.has(uid)) {
          targetMap.set(uid, 'mention');
        }
      }
      const participantIds = new Set<string>([thread.createdBy]);
      for (const m of this.messages) {
        if (m.threadId === thread.id && !m.deletedAt && m.id !== created.id) {
          participantIds.add(m.authorId);
        }
      }
      for (const pid of participantIds) {
        if (pid !== user.id && memberIds.has(pid) && !targetMap.has(pid)) {
          targetMap.set(pid, 'thread_reply');
        }
      }
      if (
        thread.scope === 'project' &&
        priorCount === 0 &&
        ['owner', 'producer', 'director', 'first_ad'].includes(member.role)
      ) {
        for (const m of members) {
          if (m.userId !== user.id && !targetMap.has(m.userId)) {
            targetMap.set(m.userId, 'project_thread_new');
          }
        }
      }

      for (const [recipientId, kind] of targetMap.entries()) {
        const isMention = kind === 'mention';
        const isReply = kind === 'thread_reply';
        this.notificationService.emitNotification({
          userId: recipientId,
          projectId: thread.projectId,
          projectTitle: proj?.title || null,
          actorId: user.id,
          actorName: user.fullName,
          actorAvatarUrl: user.avatarUrl ?? null,
          category: 'discussions',
          eventType: isMention
            ? 'discussion_mention'
            : isReply
              ? 'discussion_reply'
              : 'project_thread_new',
          priority: isMention ? 'attention' : 'normal',
          title: isMention
            ? `${user.fullName} mentioned you in ${threadLabel}`
            : isReply
              ? `${user.fullName} replied in ${threadLabel}`
              : `${user.fullName} started ${threadLabel}`,
          body: snippet,
          entityType: (thread.entityType || 'thread') as NotificationEntityType,
          entityId: thread.entityId || thread.id,
          entityLabel: threadLabel,
          dedupKey: `msg:${created.id}`,
          groupKey,
          metadata: {
            thread_id: thread.id,
            message_id: created.id,
            entity_type: thread.entityType,
            entity_id: thread.entityId,
          },
        });
      }
    }

    this.realtime?.emitProjectSignal(thread.projectId, {
      scope: 'discussions',
      projectId: thread.projectId,
      threadId: thread.id,
      entityId: created.id,
      timestamp: now,
    });

    return { ...created };
  }

  async editMessage(messageId: string, body: string, mentionUserIds: string[] = []): Promise<void> {
    const msg = this.messages.find(m => m.id === messageId);
    if (!msg) throw new Error('Message not found.');
    if (msg.deletedAt) throw new Error('Deleted messages cannot be edited.');

    const { user, member, members } = await this.resolveActor(msg.projectId);
    if (msg.authorId !== user.id || !hasPermission(member.role, 'discussions:post')) {
      throw new Error('Unauthorized: Only the message author may edit this message.');
    }

    const memberIds = new Set(members.map(m => m.userId));
    const dedupMentions: string[] = [];
    for (const uid of mentionUserIds) {
      if (!memberIds.has(uid)) {
        throw new Error(`[invalid_mention] Mention target ${uid} is not a member of this project.`);
      }
      if (!dedupMentions.includes(uid)) dedupMentions.push(uid);
    }

    msg.body = body.trim();
    msg.mentionUserIds = dedupMentions;
    msg.editedAt = new Date().toISOString();
    this.realtime?.emitProjectSignal(msg.projectId, {
      scope: 'discussions',
      projectId: msg.projectId,
      threadId: msg.threadId,
      entityId: msg.id,
      timestamp: msg.editedAt,
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    const msg = this.messages.find(m => m.id === messageId);
    if (!msg) throw new Error('Message not found.');

    const { user, member } = await this.resolveActor(msg.projectId);
    const canDelete =
      (msg.authorId === user.id && hasPermission(member.role, 'discussions:post')) ||
      hasPermission(member.role, 'discussions:moderate');
    if (!canDelete) {
      throw new Error('Unauthorized: Only the author or an Owner/Producer may remove this message.');
    }

    msg.deletedAt = new Date().toISOString();
    msg.body = '[Message removed]';
    msg.mentionUserIds = [];
    this.realtime?.emitProjectSignal(msg.projectId, {
      scope: 'discussions',
      projectId: msg.projectId,
      threadId: msg.threadId,
      entityId: msg.id,
      timestamp: msg.deletedAt,
    });
  }

  async setThreadResolved(threadId: string, resolved: boolean): Promise<void> {
    const thread = this.threads.find(t => t.id === threadId);
    if (!thread) throw new Error('Discussion thread not found.');

    const { user, member } = await this.resolveActor(thread.projectId);
    const canUpdate =
      (thread.createdBy === user.id && hasPermission(member.role, 'discussions:post')) ||
      hasPermission(member.role, 'discussions:moderate');
    if (!canUpdate) {
      throw new Error('Unauthorized: Only the thread starter or an Owner/Producer may change thread status.');
    }

    thread.resolvedAt = resolved ? new Date().toISOString() : null;
    thread.resolvedBy = resolved ? user.id : null;
    const resWindow = Math.floor(Date.now() / 10000);
    const label = thread.entityLabel || thread.title || 'Discussion';
    this.activityService?.recordSystemEvent({
      projectId: thread.projectId,
      userId: user.id,
      userFullName: user.fullName,
      avatarUrl: user.avatarUrl ?? null,
      activityType: resolved ? 'discussion_resolved' : 'discussion_reopened',
      title: `${resolved ? 'Resolved' : 'Reopened'} discussion: ${label}`,
      description: null,
      entityType: thread.entityType || 'thread',
      entityId: thread.entityId || thread.id,
      entityLabel: label,
      metadata: { thread_id: thread.id, is_resolved: resolved },
      dedupKey: `thread_res:${thread.id}:${resolved}:${resWindow}`,
    });
    this.realtime?.emitProjectSignal(thread.projectId, {
      scope: 'discussions',
      projectId: thread.projectId,
      threadId: thread.id,
      timestamp: new Date().toISOString(),
    });
  }

  async markThreadRead(threadId: string): Promise<void> {
    const thread = this.threads.find(t => t.id === threadId);
    if (!thread) return;
    const { user } = await this.resolveActor(thread.projectId);
    this.readCursors.set(`${thread.id}:${user.id}`, Date.now());
  }

  async getProjectUnreadCount(projectId: string): Promise<number> {
    try {
      const threads = await this.getProjectThreads(projectId);
      return threads.filter(t => t.unreadCount > 0).length;
    } catch {
      return 0;
    }
  }
}

export class MockRealtimeCollaborationService implements IRealtimeCollaborationService {
  private userListeners = new Map<
    string,
    Set<{
      onSignal: (signal: RealtimeCollabSignal) => void;
      onStatusChange?: (status: RealtimeConnectionStatus) => void;
    }>
  >();
  private projectListeners = new Map<
    string,
    Map<
      string,
      {
        user: { id: string; fullName: string; role: ProjectRole | null };
        activeModule: string;
        onlineAt: string;
        onSignal: (signal: RealtimeCollabSignal) => void;
        onPresenceChange: (members: RealtimePresenceMember[]) => void;
        onStatusChange?: (status: RealtimeConnectionStatus) => void;
      }
    >
  >();
  private isDisconnectedSimulated = false;

  constructor(private projectService: MockProjectService) {}

  private notifyPresence(projectId: string): void {
    const subs = this.projectListeners.get(projectId);
    if (!subs) return;
    const members: RealtimePresenceMember[] = Array.from(subs.values()).map(s => ({
      userId: s.user.id,
      fullName: s.user.fullName,
      role: s.user.role,
      activeModule: s.activeModule,
      onlineAt: s.onlineAt,
    }));
    for (const sub of subs.values()) {
      sub.onPresenceChange(members);
    }
  }

  emitUserSignal(userId: string, signal: RealtimeCollabSignal): void {
    if (this.isDisconnectedSimulated) return;
    const subs = this.userListeners.get(userId);
    if (!subs) return;
    for (const sub of subs) {
      sub.onSignal(signal);
    }
  }

  emitProjectSignal(projectId: string, signal: RealtimeCollabSignal): void {
    if (this.isDisconnectedSimulated) return;
    const subs = this.projectListeners.get(projectId);
    if (!subs || subs.size === 0) return;

    const proj = this.projectService.peekProjectSync(projectId);
    if (!proj || proj.persistence === 'local') return;

    const members = this.projectService.peekMembersSync(projectId);
    const activeMemberIds = new Set(members.map(m => m.userId));

    for (const [subKey, sub] of Array.from(subs.entries())) {
      if (!activeMemberIds.has(sub.user.id)) {
        // Immediately drop revoked member from project listeners
        subs.delete(subKey);
        sub.onPresenceChange([]);
        sub.onStatusChange?.('disconnected');
        sub.onSignal({
          scope: 'members',
          projectId,
          revoked: true,
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      sub.onSignal(signal);
    }
    this.notifyPresence(projectId);
  }

  simulateDisconnect(): void {
    this.isDisconnectedSimulated = true;
    for (const subs of this.userListeners.values()) {
      for (const s of subs) s.onStatusChange?.('reconnecting');
    }
    for (const subs of this.projectListeners.values()) {
      for (const s of subs.values()) s.onStatusChange?.('reconnecting');
    }
  }

  simulateReconnect(): void {
    this.isDisconnectedSimulated = false;
    const now = new Date().toISOString();
    for (const subs of this.userListeners.values()) {
      for (const s of subs) {
        s.onStatusChange?.('mock');
        s.onSignal({ scope: 'reconcile', timestamp: now });
      }
    }
    for (const [projectId, subs] of this.projectListeners.entries()) {
      for (const s of subs.values()) {
        s.onStatusChange?.('mock');
        s.onSignal({ scope: 'reconcile', projectId, timestamp: now });
      }
      this.notifyPresence(projectId);
    }
  }

  connectUserChannel(params: {
    userId: string;
    onSignal: (signal: RealtimeCollabSignal) => void;
    onStatusChange?: (status: RealtimeConnectionStatus) => void;
  }): () => void {
    const entry = { onSignal: params.onSignal, onStatusChange: params.onStatusChange };
    let set = this.userListeners.get(params.userId);
    if (!set) {
      set = new Set();
      this.userListeners.set(params.userId, set);
    }
    set.add(entry);
    params.onStatusChange?.(this.isDisconnectedSimulated ? 'reconnecting' : 'mock');

    return () => {
      const current = this.userListeners.get(params.userId);
      if (current) {
        current.delete(entry);
        if (current.size === 0) this.userListeners.delete(params.userId);
      }
    };
  }

  connectProjectChannel(params: {
    projectId: string;
    persistence: ProjectPersistence;
    user: { id: string; fullName: string; role: ProjectRole | null };
    activeModule?: string;
    onSignal: (signal: RealtimeCollabSignal) => void;
    onPresenceChange: (members: RealtimePresenceMember[]) => void;
    onStatusChange?: (status: RealtimeConnectionStatus) => void;
  }): ProjectRealtimeHandle {
    const { projectId, persistence, user, onSignal, onPresenceChange, onStatusChange } = params;
    if (persistence === 'local' || !user.role) {
      onPresenceChange([]);
      onStatusChange?.(persistence === 'local' ? 'local' : 'disconnected');
      return {
        updateModule: () => {},
        disconnect: () => {},
      };
    }

    const subKey = `${user.id}:${Math.random().toString(36).slice(2, 8)}`;
    let subs = this.projectListeners.get(projectId);
    if (!subs) {
      subs = new Map();
      this.projectListeners.set(projectId, subs);
    }

    subs.set(subKey, {
      user,
      activeModule: params.activeModule || 'overview',
      onlineAt: new Date().toISOString(),
      onSignal,
      onPresenceChange,
      onStatusChange,
    });

    onStatusChange?.(this.isDisconnectedSimulated ? 'reconnecting' : 'mock');
    this.notifyPresence(projectId);

    return {
      updateModule: (moduleId: string) => {
        const entry = this.projectListeners.get(projectId)?.get(subKey);
        if (!entry || entry.activeModule === moduleId) return;
        entry.activeModule = moduleId;
        this.notifyPresence(projectId);
      },
      disconnect: () => {
        const current = this.projectListeners.get(projectId);
        if (current) {
          current.delete(subKey);
          if (current.size === 0) {
            this.projectListeners.delete(projectId);
          } else {
            this.notifyPresence(projectId);
          }
        }
        onPresenceChange([]);
      },
    };
  }
}
