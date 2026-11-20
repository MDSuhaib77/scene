/**
 * SceneOS — Core Domain Contracts & Service Interfaces
 */

import { ProjectRole, ProjectStatus } from '../../types/database.types';
import type { FilmProject } from '../../types';

export interface UserSession {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
    phone?: string | null;
    bio?: string | null;
  } | null;
  token?: string;
  isMock: boolean;
}

/**
 * Where a project's authoritative record lives.
 * - 'remote': persisted in Supabase (membership enforced by RLS, collaboration available).
 * - 'local':  created in this browser only (live mode fallback). Not shared across devices.
 * - 'mock':   offline development provider.
 */
export type ProjectPersistence = 'remote' | 'local' | 'mock';

// Unified Production Domain Model — completely eliminates dual-state divergence
export type ProjectDomainModel = FilmProject & {
  targetStartDate?: string | null;
  targetWrapDate?: string | null;
  /** Explicit persistence marker. Never infer remote persistence from the shape of the id. */
  persistence?: ProjectPersistence;
};

export interface ProjectMemberDomainModel {
  id: string;
  projectId: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role: ProjectRole;
  departmentId?: string | null;
  /** Canonical department text (free text, max 60 chars). */
  department?: string | null;
  /** Explicit, optional link to a Production Directory entry (never inferred from email). */
  directoryEntryId?: string | null;
  /** True for the project's owner (projects.owner_id). */
  isOwner?: boolean;
  joinedAt: string;
}

export interface ActivityDomainModel {
  id: string;
  projectId: string;
  userId: string;
  userFullName: string;
  avatarUrl?: string | null;
  activityType: string;
  title: string;
  description?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface ActivityPage {
  activities: ActivityDomainModel[];
  hasMore: boolean;
}

export interface InvitationDomainModel {
  id: string;
  projectId: string;
  email: string;
  role: ProjectRole;
  departmentId?: string | null;
  department?: string | null;
  directoryEntryId?: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  invitationToken?: string;
  isMock: boolean;
}

export type ConnectionState = 'connected' | 'disconnected' | 'mock' | 'connecting' | 'error';

export interface ConnectionHealth {
  state: ConnectionState;
  provider: 'mock' | 'supabase';
  latencyMs?: number;
  message: string;
  lastChecked: string;
}

export interface IAuthService {
  getSession(): Promise<UserSession>;
  login(email: string, password?: string): Promise<UserSession>;
  register(email: string, password?: string, fullName?: string): Promise<UserSession>;
  signInWithOAuth(provider: 'google' | 'apple'): Promise<{ url?: string; error?: string }>;
  logout(): Promise<void>;
  updateProfile(updates: { fullName?: string; avatarUrl?: string | null; phone?: string | null; bio?: string | null }): Promise<UserSession['user']>;
  resetPassword(email: string): Promise<{ success: boolean; message: string }>;
  onAuthStateChange(callback: (session: UserSession) => void): () => void;
}

export interface IProjectService {
  getProjects(): Promise<ProjectDomainModel[]>;
  getProjectById(id: string): Promise<ProjectDomainModel | null>;
  createProject(project: Partial<Omit<ProjectDomainModel, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>> & { title: string }): Promise<ProjectDomainModel>;
  updateProject(id: string, updates: Partial<ProjectDomainModel>): Promise<ProjectDomainModel>;
  archiveProject(id: string): Promise<ProjectDomainModel>;
  deleteProject(id: string): Promise<void>;
  getProjectMembers(projectId: string): Promise<ProjectMemberDomainModel[]>;
  updateMemberRole(projectId: string, memberId: string, newRole: ProjectRole, actorRole: ProjectRole): Promise<ProjectMemberDomainModel>;
  removeProjectMember(memberId: string): Promise<void>;
  /** Sets the canonical department and/or the explicit Directory link (null to unlink). */
  updateMemberDetails(
    projectId: string,
    memberId: string,
    updates: { department?: string | null; directoryEntryId?: string | null }
  ): Promise<ProjectMemberDomainModel>;
}

export type InvitationPreviewStatus =
  | 'valid'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'accepted'
  | 'email_mismatch'
  | 'already_member';

export interface InvitationPreview {
  status: InvitationPreviewStatus;
  projectId?: string;
  projectName?: string;
  role?: ProjectRole;
  department?: string | null;
  inviterName?: string | null;
  expiresAt?: string;
  /** Masked invited address, shown only for email_mismatch. */
  invitedEmailHint?: string | null;
}

/** Business-rule failure while accepting an invitation (carries a stable code). */
export class InvitationError extends Error {
  constructor(public code: InvitationPreviewStatus | 'inviter_not_authorized' | 'unauthenticated' | 'unknown', message: string) {
    super(message);
    this.name = 'InvitationError';
  }
}

export interface CreateInvitationOptions {
  /** Canonical department text (max 60 chars). */
  department?: string;
  /** Explicit Production Directory entry id to associate on acceptance (owner/producer only). */
  directoryEntryId?: string;
}

export interface IInvitationService {
  getProjectInvitations(projectId: string): Promise<InvitationDomainModel[]>;
  /**
   * Creates an invitation. departmentId is the legacy (unused) UUID slot and is ignored by
   * the Supabase provider; use options.department for the canonical department text.
   * The raw token is returned exactly once in invitationToken.
   */
  createInvitation(
    projectId: string,
    email: string,
    role: ProjectRole,
    departmentId?: string,
    expiresInHours?: number,
    options?: CreateInvitationOptions
  ): Promise<InvitationDomainModel>;
  revokeInvitation(invitationId: string): Promise<void>;
  /** Read-only validation shown before the user is asked to accept. */
  previewInvitation(token: string): Promise<InvitationPreview>;
  /** Accepts atomically for the authenticated user. Throws InvitationError on rule failures. */
  acceptInvitation(token: string): Promise<{ success: boolean; projectId: string; role: ProjectRole }>;
}

export interface IActivityService {
  getProjectActivity(projectId: string, limit?: number): Promise<ActivityDomainModel[]>;
  getProjectActivityPage(
    projectId: string,
    options?: { beforeCreatedAt?: string; beforeId?: string; limit?: number }
  ): Promise<ActivityPage>;
  logActivity(activity: Omit<ActivityDomainModel, 'id' | 'createdAt'>): Promise<ActivityDomainModel>;
}

export interface IConnectionService {
  checkHealth(): Promise<ConnectionHealth>;
}

/** Synced production/visualise record types that support shared contextual discussions. */
export type DiscussionEntityType =
  | 'shooting_day'
  | 'production_event'
  | 'call_sheet'
  | 'dpr'
  | 'directory_entry'
  | 'board'
  | 'storyboard_panel'
  | 'shot';

export interface DiscussionRecordTarget {
  entityType: DiscussionEntityType;
  entityId: string;
  entityLabel: string;
  title?: string;
}

export interface DiscussionThreadDomainModel {
  id: string;
  projectId: string;
  scope: 'project' | 'record';
  entityType: DiscussionEntityType | null;
  entityId: string | null;
  entityLabel: string | null;
  title: string;
  createdBy: string;
  creatorName: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  lastMessageAt: string;
  messageCount: number;
  createdAt: string;
  unreadCount: number;
  latestPreview: string | null;
}

export interface DiscussionMessageDomainModel {
  id: string;
  threadId: string;
  projectId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: ProjectRole | null;
  parentMessageId: string | null;
  body: string;
  mentionUserIds: string[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface DiscussionMessagesPage {
  messages: DiscussionMessageDomainModel[];
  hasMore: boolean;
}

export interface PostDiscussionMessageInput {
  threadId: string;
  projectId: string;
  body: string;
  parentMessageId?: string | null;
  mentionUserIds?: string[];
  clientRequestId: string;
}

export interface IDiscussionService {
  getProjectThreads(
    projectId: string,
    filter?: { entityType?: DiscussionEntityType; entityId?: string }
  ): Promise<DiscussionThreadDomainModel[]>;
  ensureProjectThread(projectId: string, title?: string): Promise<string>;
  ensureRecordThread(projectId: string, target: DiscussionRecordTarget): Promise<string>;
  getThreadMessages(
    threadId: string,
    options?: { before?: string; limit?: number }
  ): Promise<DiscussionMessagesPage>;
  postMessage(input: PostDiscussionMessageInput): Promise<DiscussionMessageDomainModel>;
  editMessage(messageId: string, body: string, mentionUserIds?: string[]): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
  setThreadResolved(threadId: string, resolved: boolean): Promise<void>;
  markThreadRead(threadId: string): Promise<void>;
  getProjectUnreadCount(projectId: string): Promise<number>;
}

export type NotificationCategory = 'people_security' | 'discussions' | 'production';

export type NotificationEventType =
  | 'invitation_received'
  | 'invitation_accepted'
  | 'role_changed'
  | 'discussion_mention'
  | 'discussion_reply'
  | 'project_thread_new'
  | 'task_assigned'
  | 'task_deadline_changed'
  | 'schedule_rescheduled'
  | 'call_sheet_published'
  | 'dpr_submitted'
  | 'dpr_approved';

export type NotificationPriority = 'attention' | 'normal';

export type NotificationEntityType =
  | 'project'
  | 'member'
  | 'invitation'
  | 'thread'
  | 'message'
  | 'shooting_day'
  | 'production_event'
  | 'call_sheet'
  | 'dpr'
  | 'directory_entry'
  | 'task'
  | 'board'
  | 'storyboard_panel'
  | 'shot';

export type NotificationFilter = 'all' | 'unread' | 'mentions';

export interface NotificationDomainModel {
  id: string;
  userId: string;
  projectId: string | null;
  projectTitle: string | null;
  actorId: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  category: NotificationCategory;
  eventType: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  entityType: NotificationEntityType;
  entityId: string;
  entityLabel: string | null;
  metadata: Record<string, any>;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  notifications: NotificationDomainModel[];
  hasMore: boolean;
}

export interface NotificationPreferencesDomainModel {
  userId: string;
  mentionsEnabled: boolean;
  discussionRepliesEnabled: boolean;
  taskAssignmentsEnabled: boolean;
  scheduleChangesEnabled: boolean;
  callSheetsEnabled: boolean;
  dprReviewsEnabled: boolean;
  updatedAt: string;
}

export interface UpdateNotificationPreferencesInput {
  mentionsEnabled?: boolean;
  discussionRepliesEnabled?: boolean;
  taskAssignmentsEnabled?: boolean;
  scheduleChangesEnabled?: boolean;
  callSheetsEnabled?: boolean;
  dprReviewsEnabled?: boolean;
}

export interface INotificationService {
  getNotifications(options?: {
    projectId?: string | null;
    filter?: NotificationFilter;
    beforeCreatedAt?: string;
    beforeId?: string;
    limit?: number;
  }): Promise<NotificationPage>;
  getUnreadCount(projectId?: string | null): Promise<number>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(projectId?: string | null): Promise<number>;
  dismissNotification(notificationId: string): Promise<void>;
  getPreferences(): Promise<NotificationPreferencesDomainModel>;
  updatePreferences(
    updates: UpdateNotificationPreferencesInput
  ): Promise<NotificationPreferencesDomainModel>;
}

export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'local'
  | 'mock';

export type RealtimeCollabScope =
  | 'discussions'
  | 'notifications'
  | 'activity'
  | 'members'
  | 'production'
  | 'reconcile';

export interface RealtimeCollabSignal {
  scope: RealtimeCollabScope;
  projectId?: string | null;
  threadId?: string | null;
  entityId?: string | null;
  revoked?: boolean;
  timestamp: string;
}

export interface RealtimePresenceMember {
  userId: string;
  fullName: string;
  role?: ProjectRole | null;
  activeModule?: string | null;
  onlineAt: string;
}

export interface ProjectRealtimeHandle {
  updateModule: (moduleId: string) => void;
  disconnect: () => void;
}

export interface IRealtimeCollaborationService {
  connectUserChannel(params: {
    userId: string;
    onSignal: (signal: RealtimeCollabSignal) => void;
    onStatusChange?: (status: RealtimeConnectionStatus) => void;
  }): () => void;

  connectProjectChannel(params: {
    projectId: string;
    persistence: ProjectPersistence;
    user: {
      id: string;
      fullName: string;
      role: ProjectRole | null;
    };
    activeModule?: string;
    onSignal: (signal: RealtimeCollabSignal) => void;
    onPresenceChange: (members: RealtimePresenceMember[]) => void;
    onStatusChange?: (status: RealtimeConnectionStatus) => void;
  }): ProjectRealtimeHandle;
}
