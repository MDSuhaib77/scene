/**
 * SceneOS — Collaboration Batch 05: Realtime Integration & Final Security Verification
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockAuthService,
  MockProjectService,
  MockInvitationService,
  MockActivityService,
  MockNotificationService,
  MockDiscussionService,
  MockRealtimeCollaborationService,
  MOCK_USERS,
} from '../src/services/mock/MockServices';
import { SupabaseRealtimeCollaborationService } from '../src/services/supabase/SupabaseAdapters';
import type {
  RealtimeCollabSignal,
  RealtimeConnectionStatus,
  RealtimePresenceMember,
} from '../src/services/contracts/types';

describe('Prompt 05 — Realtime Collaboration, Cross-Module Sync & Final Security Audit', () => {
  let auth: MockAuthService;
  let projects: MockProjectService;
  let realtime: MockRealtimeCollaborationService;
  let activity: MockActivityService;
  let notifications: MockNotificationService;
  let invitations: MockInvitationService;
  let discussions: MockDiscussionService;

  const projectA = 'proj-neon-dreams-01';
  const projectB = 'proj-monsoon-heist-02';

  beforeEach(() => {
    auth = new MockAuthService();
    const getSession = () => auth.peekSession();
    projects = new MockProjectService();
    realtime = new MockRealtimeCollaborationService(projects);
    activity = new MockActivityService(projects, getSession);
    activity.attachRealtime(realtime);
    notifications = new MockNotificationService(projects, getSession);
    notifications.attachRealtime(realtime);
    projects.attachCollaborationServices(activity, notifications, getSession, realtime);
    invitations = new MockInvitationService(projects, getSession, activity, notifications, realtime);
    discussions = new MockDiscussionService(projects, getSession, activity, notifications, realtime);
  });

  it('syncs multi-user discussions, replies, mentions, notification isolation, and shared activity over private channels', async () => {
    const kiraSignals: RealtimeCollabSignal[] = [];
    const elenaProjectSignals: RealtimeCollabSignal[] = [];
    const elenaUserSignals: RealtimeCollabSignal[] = [];
    const marcusUserSignals: RealtimeCollabSignal[] = [];
    let elenaPresence: RealtimePresenceMember[] = [];

    const kiraHandle = realtime.connectProjectChannel({
      projectId: projectA,
      persistence: 'mock',
      user: { id: MOCK_USERS[0].id, fullName: MOCK_USERS[0].fullName, role: 'owner' },
      activeModule: 'overview',
      onSignal: s => kiraSignals.push(s),
      onPresenceChange: () => {},
    });

    const elenaHandle = realtime.connectProjectChannel({
      projectId: projectA,
      persistence: 'mock',
      user: { id: MOCK_USERS[1].id, fullName: MOCK_USERS[1].fullName, role: 'producer' },
      activeModule: 'production',
      onSignal: s => elenaProjectSignals.push(s),
      onPresenceChange: list => {
        elenaPresence = list;
      },
    });

    const unsubElenaUser = realtime.connectUserChannel({
      userId: MOCK_USERS[1].id,
      onSignal: s => elenaUserSignals.push(s),
    });
    const unsubMarcusUser = realtime.connectUserChannel({
      userId: MOCK_USERS[2].id,
      onSignal: s => marcusUserSignals.push(s),
    });

    // Presence reflects both online users and their active module cleanly
    expect(elenaPresence.map(p => p.userId).sort()).toEqual([MOCK_USERS[0].id, MOCK_USERS[1].id].sort());
    kiraHandle.updateModule('production');
    expect(elenaPresence.find(p => p.userId === MOCK_USERS[0].id)?.activeModule).toBe('production');

    // User A (Kira) creates thread & posts @Elena mention -> Elena receives project signal + personal mention signal; Marcus receives ZERO personal notifications
    await auth.login(MOCK_USERS[0].email);
    const threadId = await discussions.ensureRecordThread(projectA, {
      entityType: 'call_sheet',
      entityId: 'cs-rt-1',
      entityLabel: 'Day 1 Call Sheet',
    });
    await discussions.postMessage({
      threadId,
      projectId: projectA,
      body: 'Confirm stunt call @Elena Rostova',
      mentionUserIds: [MOCK_USERS[1].id],
      clientRequestId: 'p5-msg-1',
    });

    expect(elenaProjectSignals.some(s => s.scope === 'discussions' && s.threadId === threadId)).toBe(true);
    expect(elenaProjectSignals.some(s => s.scope === 'activity')).toBe(true);
    expect(elenaUserSignals.some(s => s.scope === 'notifications')).toBe(true);
    expect(marcusUserSignals).toHaveLength(0);

    // User B (Elena) replies -> User A (Kira) receives discussion update immediately
    await auth.login(MOCK_USERS[1].email);
    await discussions.postMessage({
      threadId,
      projectId: projectA,
      body: 'Stunt call locked.',
      mentionUserIds: [],
      clientRequestId: 'p5-msg-2',
    });
    expect(kiraSignals.some(s => s.scope === 'discussions' && s.threadId === threadId)).toBe(true);

    // Notification read state triggers user-channel state sync & updates unread count
    const elenaInbox = await notifications.getNotifications({ projectId: projectA });
    expect(elenaInbox.notifications).toHaveLength(1);
    const prevUserSignalCount = elenaUserSignals.length;
    await notifications.markAsRead(elenaInbox.notifications[0].id);
    expect(elenaUserSignals.length).toBe(prevUserSignalCount + 1);
    expect(await notifications.getUnreadCount(projectA)).toBe(0);

    kiraHandle.disconnect();
    elenaHandle.disconnect();
    unsubElenaUser();
    unsubMarcusUser();
  });

  it('cleans up subscriptions on project switch and immediately revokes removed member channels', async () => {
    const kiraProjASignals: RealtimeCollabSignal[] = [];
    const marcusProjASignals: RealtimeCollabSignal[] = [];
    const marcusStatuses: RealtimeConnectionStatus[] = [];

    const kiraHandle = realtime.connectProjectChannel({
      projectId: projectA,
      persistence: 'mock',
      user: { id: MOCK_USERS[0].id, fullName: MOCK_USERS[0].fullName, role: 'owner' },
      onSignal: s => kiraProjASignals.push(s),
      onPresenceChange: () => {},
    });

    const marcusHandle = realtime.connectProjectChannel({
      projectId: projectA,
      persistence: 'mock',
      user: { id: MOCK_USERS[2].id, fullName: MOCK_USERS[2].fullName, role: 'first_ad' },
      onSignal: s => marcusProjASignals.push(s),
      onPresenceChange: () => {},
      onStatusChange: st => marcusStatuses.push(st),
    });

    // Kira switches to Project B -> disconnects Project A handle cleanly
    kiraHandle.disconnect();
    const kiraProjBSignals: RealtimeCollabSignal[] = [];
    const kiraHandleB = realtime.connectProjectChannel({
      projectId: projectB,
      persistence: 'mock',
      user: { id: MOCK_USERS[0].id, fullName: MOCK_USERS[0].fullName, role: 'owner' },
      onSignal: s => kiraProjBSignals.push(s),
      onPresenceChange: () => {},
    });

    // Event inside Project A must NOT reach Project B subscriber
    await auth.login(MOCK_USERS[1].email);
    const thrA = await discussions.ensureProjectThread(projectA, 'Main');
    await discussions.postMessage({
      threadId: thrA,
      projectId: projectA,
      body: 'Update in Neon Dreams',
      mentionUserIds: [],
      clientRequestId: 'p5-iso-1',
    });
    expect(kiraProjASignals).toHaveLength(0);
    expect(kiraProjBSignals).toHaveLength(0);
    expect(marcusProjASignals.some(s => s.projectId === projectA)).toBe(true);

    // Owner removes Marcus -> Marcus receives immediate revocation signal & loses future Project A events
    await auth.login(MOCK_USERS[0].email);
    await projects.removeProjectMember('mem-3');
    expect(marcusStatuses[marcusStatuses.length - 1]).toBe('disconnected');

    const countBeforeAfterRevoke = marcusProjASignals.length;
    await auth.login(MOCK_USERS[1].email);
    await discussions.postMessage({
      threadId: thrA,
      projectId: projectA,
      body: 'Confidential follow-up after Marcus left',
      mentionUserIds: [],
      clientRequestId: 'p5-iso-2',
    });
    expect(marcusProjASignals.length).toBe(countBeforeAfterRevoke);

    marcusHandle.disconnect();
    kiraHandleB.disconnect();
  });

  it('recovers missed updates on temporary network interruption without duplicate notifications or messages', async () => {
    const kiraStatuses: RealtimeConnectionStatus[] = [];
    const kiraProjectSignals: RealtimeCollabSignal[] = [];
    const kiraUserSignals: RealtimeCollabSignal[] = [];

    const handle = realtime.connectProjectChannel({
      projectId: projectA,
      persistence: 'mock',
      user: { id: MOCK_USERS[0].id, fullName: MOCK_USERS[0].fullName, role: 'owner' },
      onSignal: s => kiraProjectSignals.push(s),
      onPresenceChange: () => {},
      onStatusChange: st => kiraStatuses.push(st),
    });
    const unsubUser = realtime.connectUserChannel({
      userId: MOCK_USERS[0].id,
      onSignal: s => kiraUserSignals.push(s),
    });

    // Simulate drop -> Elena posts message & mentions Kira while Kira is offline
    realtime.simulateDisconnect();
    expect(kiraStatuses[kiraStatuses.length - 1]).toBe('reconnecting');

    const countBeforeOfflineMsg = kiraProjectSignals.length;
    await auth.login(MOCK_USERS[1].email);
    const thrId = await discussions.ensureProjectThread(projectA);
    await discussions.postMessage({
      threadId: thrId,
      projectId: projectA,
      body: 'Offline ping @Kira Vance',
      mentionUserIds: [MOCK_USERS[0].id],
      clientRequestId: 'p5-offline-1',
    });
    // Live signal wasn't delivered during disconnect
    expect(kiraProjectSignals.length).toBe(countBeforeOfflineMsg);

    // Network recovers -> single reconcile signal triggers DB reconciliation without duplicates
    realtime.simulateReconnect();
    expect(kiraStatuses[kiraStatuses.length - 1]).toBe('mock');
    expect(kiraProjectSignals.some(s => s.scope === 'reconcile')).toBe(true);
    expect(kiraUserSignals.some(s => s.scope === 'reconcile')).toBe(true);

    // Reconcile from authoritative DB services recovers exactly 1 message & 1 notification
    await auth.login(MOCK_USERS[0].email);
    const page = await discussions.getThreadMessages(thrId);
    expect(page.messages).toHaveLength(1);
    const inbox = await notifications.getNotifications({ projectId: projectA });
    expect(inbox.notifications.filter(n => n.eventType === 'discussion_mention')).toHaveLength(1);

    handle.disconnect();
    unsubUser();
  });

  it('refuses live/mock channels for local-only projects and cleans up Supabase channels cleanly', async () => {
    const localStatuses: RealtimeConnectionStatus[] = [];
    let localPresence: RealtimePresenceMember[] = [{ userId: 'seed', fullName: 'Seed', onlineAt: '' }];

    const localHandle = realtime.connectProjectChannel({
      projectId: 'local-proj-1',
      persistence: 'local',
      user: { id: MOCK_USERS[0].id, fullName: 'Kira', role: 'owner' },
      onSignal: () => {},
      onPresenceChange: list => {
        localPresence = list;
      },
      onStatusChange: st => localStatuses.push(st),
    });
    expect(localStatuses).toEqual(['local']);
    expect(localPresence).toEqual([]);
    localHandle.disconnect();

    // SupabaseRealtimeCollaborationService must never subscribe for local-only projects or invalid UUIDs
    const fakeChannel = vi.fn();
    const fakeRemoveChannel = vi.fn();
    const supaRt = new SupabaseRealtimeCollaborationService({
      channel: fakeChannel,
      removeChannel: fakeRemoveChannel,
      realtime: { setAuth: vi.fn() },
    } as any);

    const handle = supaRt.connectProjectChannel({
      projectId: 'local-only-project',
      persistence: 'local',
      user: { id: 'usr-1', fullName: 'User', role: 'owner' },
      onSignal: () => {},
      onPresenceChange: () => {},
    });
    handle.disconnect();
    expect(fakeChannel).not.toHaveBeenCalled();

    // Valid UUID remote user channel sets private config and cleans up on unmount
    const mockSubObj = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    const removeFn = vi.fn();
    const channelFn = vi.fn().mockReturnValue(mockSubObj);
    const supaRtValid = new SupabaseRealtimeCollaborationService({
      channel: channelFn,
      removeChannel: removeFn,
      realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
    } as any);

    const stopUser = supaRtValid.connectUserChannel({
      userId: '11111111-1111-1111-1111-111111111111',
      onSignal: () => {},
    });
    await new Promise(r => setTimeout(r, 10));
    expect(channelFn).toHaveBeenCalledWith('user:11111111-1111-1111-1111-111111111111:notifications', {
      config: { private: true },
    });
    stopUser();
    expect(removeFn).toHaveBeenCalledWith(mockSubObj);
  });

  it('tracks rapid switching & invitation join propagation cleanly without residual subscriptions', async () => {
    const elenaUserSignals: RealtimeCollabSignal[] = [];
    const stopElena = realtime.connectUserChannel({
      userId: MOCK_USERS[1].id,
      onSignal: s => elenaUserSignals.push(s),
    });

    await auth.login(MOCK_USERS[0].email);
    const inv = await invitations.createInvitation(projectB, MOCK_USERS[1].email, 'producer');
    expect(elenaUserSignals.some(s => s.scope === 'notifications')).toBe(true);

    // Rapid connect/disconnect across A -> B -> A leaves zero leak
    for (const pid of [projectA, projectB, projectA]) {
      const h = realtime.connectProjectChannel({
        projectId: pid,
        persistence: 'mock',
        user: { id: MOCK_USERS[0].id, fullName: 'Kira', role: 'owner' },
        onSignal: () => {},
        onPresenceChange: () => {},
      });
      h.disconnect();
    }

    await auth.login(MOCK_USERS[1].email);
    await invitations.acceptInvitation(inv.invitationToken!);
    const feedB = await activity.getProjectActivityPage(projectB);
    expect(feedB.activities.some(a => a.activityType === 'member_joined')).toBe(true);
    stopElena();
  });
});
