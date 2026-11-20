import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  MockAuthService,
  MockProjectService,
  MockInvitationService,
  MockActivityService,
  MockNotificationService,
  MockDiscussionService,
  MOCK_USERS,
} from '../src/services/mock/MockServices';
import { SupabaseNotificationService } from '../src/services/supabase/SupabaseAdapters';
import {
  NotificationsDrawer,
  getChronologyBucket,
  groupItemsByChronology,
} from '../src/features/collaboration/NotificationsDrawer';
import { ActivityFeedDrawer } from '../src/features/collaboration/ActivityFeedDrawer';
import { resolveRecordDestination } from '../src/features/collaboration/navigationHelpers';

const mockUseProject = vi.fn();
vi.mock('../src/features/projects/ProjectContext', () => ({
  useProject: () => mockUseProject(),
}));

const mockServicesState = vi.hoisted(() => ({
  notifications: null as any,
  activity: null as any,
}));

vi.mock('../src/services', () => ({
  services: {
    get notifications() {
      return mockServicesState.notifications;
    },
    get activity() {
      return mockServicesState.activity;
    },
  },
}));

describe('Prompt 04 — Notifications & Activity (Service, Security & UI)', () => {
  let auth: MockAuthService;
  let projects: MockProjectService;
  let activity: MockActivityService;
  let notifications: MockNotificationService;
  let invitations: MockInvitationService;
  let discussions: MockDiscussionService;

  const projectId = 'proj-neon-dreams-01';
  const otherProjectId = 'proj-monsoon-heist-02';

  beforeEach(async () => {
    auth = new MockAuthService();
    const getSession = () => auth.peekSession();
    projects = new MockProjectService();
    activity = new MockActivityService(projects, getSession);
    notifications = new MockNotificationService(projects, getSession);
    projects.attachCollaborationServices(activity, notifications, getSession);
    invitations = new MockInvitationService(projects, getSession, activity, notifications);
    discussions = new MockDiscussionService(projects, getSession, activity, notifications);

    mockServicesState.notifications = notifications;
    mockServicesState.activity = activity;
  });

  it('delivers invitation_received and invitation_accepted without self-notification', async () => {
    await auth.login(MOCK_USERS[0].email); // Kira Vance (owner)
    const inv = await invitations.createInvitation(otherProjectId, MOCK_USERS[1].email, 'producer');
    expect(inv.invitationToken).toBeTruthy();

    // Kira should not receive an invitation_received notification for her own invite
    const kiraInboxBefore = await notifications.getNotifications({ projectId: otherProjectId });
    expect(kiraInboxBefore.notifications.some(n => n.eventType === 'invitation_received')).toBe(false);

    // Elena (invitee) logs in and sees invitation_received
    await auth.login(MOCK_USERS[1].email);
    const elenaInbox = await notifications.getNotifications();
    const recv = elenaInbox.notifications.find(n => n.eventType === 'invitation_received');
    expect(recv).toBeDefined();
    expect(recv?.priority).toBe('attention');

    // Accepting notifies Kira (inviter) and logs member_joined activity
    await invitations.acceptInvitation(inv.invitationToken!);

    await auth.login(MOCK_USERS[0].email);
    const kiraInboxAfter = await notifications.getNotifications({ projectId: otherProjectId });
    expect(kiraInboxAfter.notifications.some(n => n.eventType === 'invitation_accepted')).toBe(true);

    const feed = await activity.getProjectActivityPage(otherProjectId);
    expect(feed.activities.some(a => a.activityType === 'member_joined')).toBe(true);
  });

  it('delivers role_changed even when optional notification categories are turned off (security invariant)', async () => {
    await auth.login(MOCK_USERS[2].email); // Marcus Thorne (first_ad)
    await notifications.updatePreferences({
      mentionsEnabled: false,
      discussionRepliesEnabled: false,
      taskAssignmentsEnabled: false,
      scheduleChangesEnabled: false,
      callSheetsEnabled: false,
      dprReviewsEnabled: false,
    });

    await auth.login(MOCK_USERS[0].email); // Owner updates Marcus's role
    await projects.updateMemberRole(projectId, 'mem-3', 'producer', 'owner');

    await auth.login(MOCK_USERS[2].email);
    const inbox = await notifications.getNotifications({ projectId });
    expect(inbox.notifications.some(n => n.eventType === 'role_changed')).toBe(true);

    // Activity records factual role change
    const act = await activity.getProjectActivityPage(projectId);
    expect(act.activities.some(a => a.activityType === 'member_role_changed')).toBe(true);
  });

  it('prioritizes mention > reply, excludes author & unrelated members, and coalesces rapid thread replies', async () => {
    // Link member 'mem-4' as unrelated viewer who is NOT mentioned and did NOT join thread
    await auth.login(MOCK_USERS[0].email);
    const viewerInv = await invitations.createInvitation(projectId, 'viewer@sceneos.studio', 'viewer');
    // Mock login creates non-preset user or switch session to accept cleanly
    await (projects as any).members[projectId].push({
      id: 'mem-viewer',
      projectId,
      userId: 'usr-viewer-1',
      fullName: 'Pat Viewer',
      email: 'viewer@sceneos.studio',
      role: 'viewer',
      joinedAt: new Date().toISOString(),
    });
    expect(viewerInv.status).toBe('pending');

    await auth.login(MOCK_USERS[0].email);
    const threadId = await discussions.ensureRecordThread(projectId, {
      entityType: 'call_sheet',
      entityId: 'cs-day-1',
      entityLabel: 'Day 1 Call Sheet',
    });

    // Owner mentions Elena and posts follow-up
    await discussions.postMessage({
      threadId,
      projectId,
      body: 'Review stunt safety notes @Elena Rostova',
      mentionUserIds: [MOCK_USERS[1].id],
      clientRequestId: 'c1',
    });

    // Marcus replies in the thread -> Owner (starter) gets coalesced discussion_reply, Elena gets another
    await auth.login(MOCK_USERS[2].email);
    await discussions.postMessage({
      threadId,
      projectId,
      body: 'First confirmation from AD.',
      mentionUserIds: [],
      clientRequestId: 'c2',
    });
    await discussions.postMessage({
      threadId,
      projectId,
      body: 'Second confirmation from AD.',
      mentionUserIds: [],
      clientRequestId: 'c3',
    });

    // Owner should see 1 coalesced unread discussion_reply (NOT 2 separate reply items), and NO self-notification from c1
    await auth.login(MOCK_USERS[0].email);
    const ownerInbox = await notifications.getNotifications({ projectId });
    const ownerReplies = ownerInbox.notifications.filter(n => n.eventType === 'discussion_reply');
    expect(ownerReplies).toHaveLength(1);
    expect(ownerReplies[0].title).toContain('2 new replies');

    // Unrelated viewer who was not mentioned or participating receives ZERO notifications
    (auth as any).currentSession = {
      user: { id: 'usr-viewer-1', email: 'viewer@sceneos.studio', fullName: 'Pat Viewer' },
      token: 'tok-v',
      isMock: true,
    };
    const viewerInbox = await notifications.getNotifications({ projectId });
    expect(viewerInbox.notifications).toHaveLength(0);

    // Elena got mention from c1 + coalesced reply (so priority mention didn't lose anything)
    await auth.login(MOCK_USERS[1].email);
    const elenaInbox = await notifications.getNotifications({ projectId, filter: 'mentions' });
    expect(elenaInbox.notifications).toHaveLength(1);
    expect(elenaInbox.notifications[0].eventType).toBe('discussion_mention');
  });

  it('triggers production notifications ONLY to verified assigned/participating/review members and avoids trivial churn', async () => {
    await auth.login(MOCK_USERS[0].email); // Kira owner

    // Link Marcus specifically to Directory entry 'dir-marcus' (Elena has NO dir link)
    await projects.updateMemberDetails(projectId, 'mem-3', { directoryEntryId: 'dir-marcus' });

    const baseProject = (await projects.getProjectById(projectId))!;
    // Minor metadata edit (title/logline) should emit ZERO activity & ZERO notifications
    await projects.updateProject(projectId, { logline: 'Slightly polished logline copy.' });
    const marcusAfterMinor = await (async () => {
      await auth.login(MOCK_USERS[2].email);
      return notifications.getNotifications({ projectId });
    })();
    expect(marcusAfterMinor.notifications).toHaveLength(0);

    // Kira assigns task to Marcus, publishes Day 1 Call Sheet with 'dir-marcus' on call, and submits DPR for review
    await auth.login(MOCK_USERS[0].email);
    await projects.updateProject(projectId, {
      phases: [
        {
          id: 'ph-pre',
          name: 'Pre-Production',
          color: 'bg-blue-500',
          textLightColor: 'text-blue-200',
          textDarkColor: 'text-blue-700',
          durationDays: 10,
          startDate: '2026-06-01',
          endDate: '2026-06-10',
          status: 'active',
          crew: [],
          activities: [
            {
              id: 'task-cam-1',
              name: 'Lock Steadicam rig',
              completed: false,
              estimatedDays: 2,
              endDate: '2026-06-05',
              assignedTo: 'Marcus Thorne',
            },
          ],
        },
      ],
      productionState: {
        schemaVersion: 1,
        productionId: projectId,
        shootingDays: [
          {
            id: 'sd-1',
            productionId: projectId,
            dayNumber: 1,
            date: '2026-06-15',
            callTime: '06:00',
            wrapTime: '18:00',
            sceneIds: [],
            status: 'scheduled',
            createdAt: baseProject.createdAt,
            updatedAt: baseProject.updatedAt,
          },
        ],
        events: [],
        callSheets: [
          {
            id: 'cs-1',
            productionId: projectId,
            shootingDayId: 'sd-1',
            revisionNumber: 1,
            generalCallTime: '06:00',
            firstShotTime: '07:00',
            estimatedWrapTime: '18:00',
            directoryEntryIds: ['dir-marcus'],
            published: true,
            createdAt: baseProject.createdAt,
            updatedAt: baseProject.updatedAt,
          },
        ],
        dailyReports: [
          {
            id: 'dpr-1',
            productionId: projectId,
            shootingDayId: 'sd-1',
            shootDayNumber: 1,
            calendarDate: '2026-06-15',
            generalCall: '06:00',
            firstShotTime: '07:00',
            mealOutTime: '12:00',
            mealInTime: '13:00',
            wrapTime: '18:00',
            totalScenesScheduled: 3,
            totalScenesCompleted: 3,
            pagesScheduledEighths: 24,
            pagesCompletedEighths: 24,
            setupsCompleted: 12,
            safetyIncidentsReported: 0,
            preparedBy: 'Marcus Thorne',
            submittedBy: 'Marcus Thorne',
            status: 'Submitted',
            updatedAt: '2026-06-15T19:00:00Z',
          },
        ],
        directoryEntries: [],
        updatedAt: '2026-06-15T19:00:00Z',
      },
    });

    // Marcus receives task_assigned + call_sheet_published, NOT dpr_submitted (only owner/producer review DPR)
    await auth.login(MOCK_USERS[2].email);
    const marcusInbox = await notifications.getNotifications({ projectId });
    expect(marcusInbox.notifications.map(n => n.eventType).sort()).toEqual([
      'call_sheet_published',
      'task_assigned',
    ]);

    // Elena (producer, not linked to dir-marcus and not assigned task) receives ONLY dpr_submitted!
    await auth.login(MOCK_USERS[1].email);
    const elenaInbox = await notifications.getNotifications({ projectId });
    expect(elenaInbox.notifications.map(n => n.eventType)).toEqual(['dpr_submitted']);

    // Re-saving same Call Sheet revision 1 MUST NOT duplicate notifications (dedupKey protection)
    await auth.login(MOCK_USERS[0].email);
    await projects.updateProject(projectId, {
      productionState: (await projects.getProjectById(projectId))!.productionState,
    });
    await auth.login(MOCK_USERS[2].email);
    const marcusInboxAfterSave = await notifications.getNotifications({ projectId });
    expect(marcusInboxAfterSave.notifications).toHaveLength(2);
  });

  it('prevents cross-user notification access, non-member activity access, client activity fabrication, and local-only leak', async () => {
    // Non-member (Elena is NOT a member of Monsoon Shadow) cannot read Monsoon activity
    await auth.login(MOCK_USERS[1].email);
    await expect(activity.getProjectActivityPage(otherProjectId)).rejects.toThrow(/Access denied/i);

    // Direct client activity fabrication rejected
    await expect(
      activity.logActivity({
        projectId,
        userId: MOCK_USERS[1].id,
        userFullName: MOCK_USERS[1].fullName,
        activityType: 'fake_event',
        title: 'Forged history',
      })
    ).rejects.toThrow(/server-side/i);

    // Create a notification for Marcus, then verify Elena cannot read, mark read, or dismiss it
    await auth.login(MOCK_USERS[0].email);
    await projects.updateMemberRole(projectId, 'mem-3', 'department_head', 'owner');

    await auth.login(MOCK_USERS[2].email);
    const marcusPage = await notifications.getNotifications({ projectId });
    const marcusNotifId = marcusPage.notifications[0].id;

    await auth.login(MOCK_USERS[1].email);
    const elenaPage = await notifications.getNotifications({ projectId });
    expect(elenaPage.notifications.some(n => n.id === marcusNotifId)).toBe(false);
    await expect(notifications.markAsRead(marcusNotifId)).rejects.toThrow(/access denied|not found/i);
    await expect(notifications.dismissNotification(marcusNotifId)).rejects.toThrow(/access denied|not found/i);

    // Local-only project refuses shared notifications & emits zero shared activity
    const localProj = await projects.createProject({ title: 'Offline Scratchpad' });
    (projects as any).projects.find((p: any) => p.id === localProj.id).persistence = 'local';
    await expect(notifications.getNotifications({ projectId: localProj.id })).rejects.toThrow(/Local-only/i);
    const localAct = await activity.getProjectActivityPage(localProj.id);
    expect(localAct.activities).toHaveLength(0);
  });

  it('supports inbox filter/mark-read/dismiss/preferences, chronology grouping, local-only SSR guards, and Supabase rejection on local projects', async () => {
    await auth.login(MOCK_USERS[0].email);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const earlier = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    // Chronology helper check
    expect(getChronologyBucket(now.toISOString(), now)).toBe('Today');
    expect(getChronologyBucket(yesterday.toISOString(), now)).toBe('Yesterday');
    expect(getChronologyBucket(earlier.toISOString(), now)).toBe('Earlier');
    const grouped = groupItemsByChronology(
      [
        { createdAt: now.toISOString(), id: '1' },
        { createdAt: yesterday.toISOString(), id: '2' },
        { createdAt: earlier.toISOString(), id: '3' },
      ],
      now
    );
    expect(grouped.map(g => g.bucket)).toEqual(['Today', 'Yesterday', 'Earlier']);

    // Emit two real notifications for Kira
    const mentionNotif = await notifications.emitNotification({
      userId: MOCK_USERS[0].id,
      projectId,
      projectTitle: 'Neon Dreams: Chapter One',
      actorId: MOCK_USERS[1].id,
      actorName: 'Elena Rostova',
      category: 'discussions',
      eventType: 'discussion_mention',
      priority: 'attention',
      title: 'Elena Rostova mentioned you in Project Discussion',
      body: 'Need sign-off on Day 4.',
      entityType: 'thread',
      entityId: 'thr-1',
      entityLabel: 'Project Discussion',
      dedupKey: 'ui-test-mention',
    });
    const missingSourceNotif = await notifications.emitNotification({
      userId: MOCK_USERS[0].id,
      projectId,
      projectTitle: 'Neon Dreams: Chapter One',
      actorId: MOCK_USERS[2].id,
      actorName: 'Marcus Thorne',
      category: 'production',
      eventType: 'task_assigned',
      priority: 'attention',
      title: 'Assigned to task: Deleted Scout Task',
      body: 'Due tomorrow',
      entityType: 'task',
      entityId: 'deleted-task-999',
      entityLabel: 'Deleted Scout Task',
      dedupKey: 'ui-test-task',
    });
    expect(mentionNotif).not.toBeNull();
    expect(missingSourceNotif).not.toBeNull();

    // Verify unread count, mentions filter, mark-read, dismiss, mark-all-read, and preference toggle
    expect(await notifications.getUnreadCount(projectId)).toBe(2);
    const mentionsPage = await notifications.getNotifications({ projectId, filter: 'mentions' });
    expect(mentionsPage.notifications).toHaveLength(1);
    expect(mentionsPage.notifications[0].eventType).toBe('discussion_mention');

    await notifications.markAsRead(mentionNotif!.id);
    expect(await notifications.getUnreadCount(projectId)).toBe(1);
    const unreadPage = await notifications.getNotifications({ projectId, filter: 'unread' });
    expect(unreadPage.notifications.map(n => n.id)).toEqual([missingSourceNotif!.id]);

    await notifications.dismissNotification(missingSourceNotif!.id);
    expect(await notifications.getUnreadCount(projectId)).toBe(0);
    const allAfterDismiss = await notifications.getNotifications({ projectId, filter: 'all' });
    expect(allAfterDismiss.notifications.some(n => n.id === missingSourceNotif!.id)).toBe(false);

    const updatedPrefs = await notifications.updatePreferences({ callSheetsEnabled: false });
    expect(updatedPrefs.callSheetsEnabled).toBe(false);

    // Supabase adapter rejects non-UUID / local-only queries safely
    const supaNotif = new SupabaseNotificationService({ rpc: vi.fn(), auth: { getUser: vi.fn() } } as any);
    await expect(supaNotif.getNotifications({ projectId: 'local-project-id' })).rejects.toThrow(/Local-only/i);

    // SSR check: Local-Only project guard renders explanatory state in both drawers
    mockUseProject.mockReturnValue({
      activeProject: { id: 'local-1', title: 'Local Scratch', persistence: 'local' },
      activeProjectId: 'local-1',
      isNotificationsOpen: true,
      isActivityOpen: true,
      closeNotifications: vi.fn(),
      closeActivity: vi.fn(),
      refreshNotificationUnreadCount: vi.fn(),
      openDiscussions: vi.fn(),
    });
    const localNotifHtml = renderToString(<NotificationsDrawer />);
    const localActHtml = renderToString(<ActivityFeedDrawer />);
    expect(localNotifHtml).toContain('Local-Only Project');
    expect(localActHtml).toContain('Local-Only Project');

    // SSR check: Active Inbox & Activity drawers render cleanly
    mockUseProject.mockReturnValue({
      activeProject: { id: projectId, title: 'Neon Dreams: Chapter One', persistence: 'mock' },
      activeProjectId: projectId,
      isNotificationsOpen: true,
      isActivityOpen: true,
      closeNotifications: vi.fn(),
      closeActivity: vi.fn(),
      refreshNotificationUnreadCount: vi.fn(),
      openDiscussions: vi.fn(),
    });
    const activeNotifHtml = renderToString(<NotificationsDrawer />);
    const activeActHtml = renderToString(<ActivityFeedDrawer />);
    expect(activeNotifHtml).toContain('notifications-drawer');
    expect(activeNotifHtml).toContain('Mark all read');
    expect(activeActHtml).toContain('activity-drawer');
    expect(activeActHtml).toContain('Production Activity');
  });

  it('validates record destination resolution including deleted items across Production and Visualise', () => {
    const projStub: any = {
      id: projectId,
      phases: [{ id: 'p1', activities: [{ id: 'act-real', endDate: '2026-07-04' }] }],
      productionState: {
        shootingDays: [{ id: 'sd-real', date: '2026-07-10' }],
        callSheets: [{ id: 'cs-real' }],
        events: [{ id: 'ev-real', date: '2026-06-22' }],
        dailyReports: [{ id: 'dpr-real' }],
        directoryEntries: [{ id: 'dir-real' }],
      },
      visualizeState: { boards: [{ id: 'b-real' }], storyboardPanels: [], shots: [] },
    };
    expect(resolveRecordDestination(projStub, 'task', 'act-real')).toEqual({
      tab: 'production',
      submodule: 'calendar',
      focusDate: '2026-07-04',
    });
    expect(resolveRecordDestination(projStub, 'task', 'deleted-task')).toBeNull();
    expect(resolveRecordDestination(projStub, 'shooting_day', 'sd-real')).toEqual({
      tab: 'production',
      submodule: 'shoot',
      focusDate: '2026-07-10',
    });
    expect(resolveRecordDestination(projStub, 'call_sheet', 'cs-real')).toEqual({
      tab: 'production',
      submodule: 'shoot',
    });
    expect(resolveRecordDestination(projStub, 'dpr', 'dpr-real')).toEqual({
      tab: 'production',
      submodule: 'shoot',
    });
    expect(resolveRecordDestination(projStub, 'directory_entry', 'dir-real')).toEqual({
      tab: 'production',
      submodule: 'directory',
    });
    expect(resolveRecordDestination(projStub, 'board', 'b-real')).toEqual({
      tab: 'visualize',
      submodule: 'boards',
    });
    expect(resolveRecordDestination(projStub, 'board', 'deleted-board')).toBeNull();
  });
});
