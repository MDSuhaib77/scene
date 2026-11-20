/**
 * SceneOS — Collaboration Batch 03: Discussions & Contextual Communication Tests
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  MockAuthService,
  MockDiscussionService,
  MockProjectService,
} from '../src/services/mock/MockServices';
import { SupabaseDiscussionService } from '../src/services/supabase/SupabaseAdapters';
import { hasPermission } from '../src/services/rbac/permissions';
import {
  filterMentionCandidates,
  resolveValidatedMentionIds,
} from '../src/features/collaboration/DiscussionsDrawer';
import { ProductionWorkspace } from '../src/features/production/components/ProductionWorkspace';
import type { FilmProject } from '../src/types';
import type { ProjectMemberDomainModel } from '../src/services/contracts/types';

function makeProject(overrides: Partial<FilmProject> = {}): FilmProject {
  return {
    id: 'proj-neon-dreams-01',
    title: 'Neon Dreams: Chapter One',
    logline: 'Sci-fi noir',
    director: 'Kira Vance',
    startDate: '2026-06-01',
    finalEndDate: '2026-08-15',
    suggestedEndDate: '2026-08-15',
    isEndDateFixed: false,
    updatedAt: '2026-06-01T00:00:00Z',
    constraints: {
      budgetLimit: 1000000,
      dailyBurnRateCap: 25000,
      screenplayLocked: false,
      castAvailabilityDays: 30,
      permitLeadTimeDays: 10,
      targetRating: 'PG-13',
      weatherContingencyBuffer: 5,
      postOverheadRatio: 15,
    },
    phases: [],
    ...overrides,
  };
}

describe('Prompt 03 — Discussion Permissions in Existing RBAC', () => {
  it('assigns view, post, and moderate permissions cleanly across the 7 roles', () => {
    expect(hasPermission('owner', 'discussions:moderate')).toBe(true);
    expect(hasPermission('producer', 'discussions:moderate')).toBe(true);
    expect(hasPermission('director', 'discussions:post')).toBe(true);
    expect(hasPermission('director', 'discussions:moderate')).toBe(false);
    expect(hasPermission('first_ad', 'discussions:post')).toBe(true);
    expect(hasPermission('department_head', 'discussions:post')).toBe(true);
    expect(hasPermission('crew_member', 'discussions:post')).toBe(true);
    expect(hasPermission('viewer', 'discussions:view')).toBe(true);
    expect(hasPermission('viewer', 'discussions:post')).toBe(false);
    expect(hasPermission('viewer', 'discussions:moderate')).toBe(false);
    expect(hasPermission(null, 'discussions:view')).toBe(false);
  });
});

describe('Prompt 03 — MockDiscussionService Security, Mentions, Pagination & Deduplication', () => {
  let authService: MockAuthService;
  let projectService: MockProjectService;
  let discussionService: MockDiscussionService;

  beforeEach(() => {
    authService = new MockAuthService();
    projectService = new MockProjectService();
    discussionService = new MockDiscussionService(projectService, () => authService.peekSession());
  });

  it('creates project-wide and deduplicated record threads and supports replies', async () => {
    const projectThreadId = await discussionService.ensureProjectThread(
      'proj-neon-dreams-01',
      'Project Discussion'
    );
    const sameProjectThreadId = await discussionService.ensureProjectThread('proj-neon-dreams-01');
    expect(sameProjectThreadId).toBe(projectThreadId);

    const recordThreadId = await discussionService.ensureRecordThread('proj-neon-dreams-01', {
      entityType: 'call_sheet',
      entityId: 'cs-day-1',
      entityLabel: 'Call Sheet · Day 1',
    });
    const sameRecordThreadId = await discussionService.ensureRecordThread('proj-neon-dreams-01', {
      entityType: 'call_sheet',
      entityId: 'cs-day-1',
      entityLabel: 'Call Sheet · Day 1',
    });
    expect(sameRecordThreadId).toBe(recordThreadId);

    const m1 = await discussionService.postMessage({
      threadId: recordThreadId,
      projectId: 'proj-neon-dreams-01',
      body: 'Confirming 06:00 call time.',
      clientRequestId: 'req-1',
    });

    await authService.login('marcus.ad@sceneos.studio');
    const reply = await discussionService.postMessage({
      threadId: recordThreadId,
      projectId: 'proj-neon-dreams-01',
      body: 'Copy that, @Kira Vance.',
      parentMessageId: m1.id,
      mentionUserIds: ['usr-kira-vance'],
      clientRequestId: 'req-2',
    });

    expect(reply.parentMessageId).toBe(m1.id);
    expect(reply.mentionUserIds).toEqual(['usr-kira-vance']);

    const threads = await discussionService.getProjectThreads('proj-neon-dreams-01');
    expect(threads.map(t => t.id)).toEqual([projectThreadId, recordThreadId]);
  });

  it('rejects non-member access, cross-project access, cross-thread replies, and invalid mentions', async () => {
    const tId = await discussionService.ensureProjectThread('proj-neon-dreams-01');
    const m1 = await discussionService.postMessage({
      threadId: tId,
      projectId: 'proj-neon-dreams-01',
      body: 'Root message',
      clientRequestId: 'req-root',
    });

    // Reject mention of someone who is NOT a project member
    await expect(
      discussionService.postMessage({
        threadId: tId,
        projectId: 'proj-neon-dreams-01',
        body: 'Ping @Outsider',
        mentionUserIds: ['usr-not-a-member'],
        clientRequestId: 'req-bad-mention',
      })
    ).rejects.toThrow(/invalid_mention/i);

    // Reject cross-project thread posting
    await expect(
      discussionService.postMessage({
        threadId: tId,
        projectId: 'proj-monsoon-heist-02',
        body: 'Cross project attempt',
        clientRequestId: 'req-cross-proj',
      })
    ).rejects.toThrow(/cross_project/i);

    // Reject cross-thread reply parent
    const otherThreadId = await discussionService.ensureRecordThread('proj-neon-dreams-01', {
      entityType: 'shooting_day',
      entityId: 'sd-2',
      entityLabel: 'Day 2',
    });
    await expect(
      discussionService.postMessage({
        threadId: otherThreadId,
        projectId: 'proj-neon-dreams-01',
        body: 'Cross thread parent',
        parentMessageId: m1.id,
        clientRequestId: 'req-cross-thr',
      })
    ).rejects.toThrow(/cross_thread/i);

    // Non-member cannot read or post on Monsoon Shadow
    await authService.login('marcus.ad@sceneos.studio');
    await expect(discussionService.getProjectThreads('proj-monsoon-heist-02')).rejects.toThrow(
      /not a member/i
    );
  });

  it('enforces author edit/delete and Owner/Producer moderation permissions plus viewer restriction', async () => {
    const tId = await discussionService.ensureProjectThread('proj-neon-dreams-01');
    await authService.login('marcus.ad@sceneos.studio'); // first_ad
    const marcusMsg = await discussionService.postMessage({
      threadId: tId,
      projectId: 'proj-neon-dreams-01',
      body: 'Initial rigging note',
      clientRequestId: 'req-marcus-1',
    });

    await expect(discussionService.editMessage(marcusMsg.id, 'Updated rigging note')).resolves.toBeUndefined();

    // Producer (Elena) cannot edit Marcus's text, but CAN moderate/delete Marcus's message
    await authService.login('elena.rostova@sceneos.studio');
    await expect(discussionService.editMessage(marcusMsg.id, 'Tampered text')).rejects.toThrow(
      /Only the message author/i
    );
    await expect(discussionService.deleteMessage(marcusMsg.id)).resolves.toBeUndefined();

    // Viewer cannot create threads or post messages
    const elenaMembers = await projectService.getProjectMembers('proj-neon-dreams-01');
    const marcusMember = elenaMembers.find(m => m.userId === 'usr-marcus-ad')!;
    await projectService.updateMemberRole('proj-neon-dreams-01', marcusMember.id, 'viewer', 'owner');

    await authService.login('marcus.ad@sceneos.studio');
    await expect(
      discussionService.postMessage({
        threadId: tId,
        projectId: 'proj-neon-dreams-01',
        body: 'Viewer trying to post',
        clientRequestId: 'req-viewer',
      })
    ).rejects.toThrow(/does not permit posting/i);
  });

  it('deduplicates duplicate clientRequestId retries, tracks unread counts, and paginates older messages', async () => {
    const tId = await discussionService.ensureProjectThread('proj-neon-dreams-01');

    const first = await discussionService.postMessage({
      threadId: tId,
      projectId: 'proj-neon-dreams-01',
      body: 'Idempotent check',
      clientRequestId: 'same-id-123',
    });
    const retry = await discussionService.postMessage({
      threadId: tId,
      projectId: 'proj-neon-dreams-01',
      body: 'Idempotent check',
      clientRequestId: 'same-id-123',
    });
    expect(retry.id).toBe(first.id);

    // Post additional messages with small timestamp offsets to test pagination
    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, 5));
      await discussionService.postMessage({
        threadId: tId,
        projectId: 'proj-neon-dreams-01',
        body: `Note ${i + 1}`,
        clientRequestId: `req-page-${i}`,
      });
    }

    // Elena has unread notifications for Kira's 5 messages; mark read clears them
    await authService.login('elena.rostova@sceneos.studio');
    expect(await discussionService.getProjectUnreadCount('proj-neon-dreams-01')).toBe(1);
    await discussionService.markThreadRead(tId);
    expect(await discussionService.getProjectUnreadCount('proj-neon-dreams-01')).toBe(0);

    const page1 = await discussionService.getThreadMessages(tId, { limit: 3 });
    expect(page1.hasMore).toBe(true);
    expect(page1.messages).toHaveLength(3);

    const page2 = await discussionService.getThreadMessages(tId, {
      before: page1.messages[0].createdAt,
      limit: 3,
    });
    expect(page2.hasMore).toBe(false);
    expect(page2.messages).toHaveLength(2);
  });
});

describe('Prompt 03 — Mention Filtering & Supabase Adapter Guards', () => {
  it('only emits validated project member mention IDs present in body', () => {
    const members: ProjectMemberDomainModel[] = [
      {
        id: 'm1',
        projectId: 'p1',
        userId: 'u1',
        fullName: 'Kira Vance',
        email: 'kira@studio.com',
        role: 'owner',
        joinedAt: '2026-01-01',
      },
      {
        id: 'm2',
        projectId: 'p1',
        userId: 'u2',
        fullName: 'Marcus Thorne',
        email: 'marcus@studio.com',
        role: 'first_ad',
        joinedAt: '2026-01-01',
      },
    ];

    expect(filterMentionCandidates(members, 'kir', 'u2').map(m => m.userId)).toEqual(['u1']);
    expect(
      resolveValidatedMentionIds('Hello @Kira Vance, please check.', members, ['u1', 'non-member-uid'])
    ).toEqual(['u1']);
  });

  it('rejects local-only projects in SupabaseDiscussionService without faking sync', async () => {
    const rpc = vi.fn();
    const svc = new SupabaseDiscussionService({ rpc } as any);

    // Stub window localStorage with a local-only project
    const origWindow = (globalThis as any).window;
    const origLS = (globalThis as any).localStorage;
    (globalThis as any).window = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) =>
        k === 'sceneos_local_projects_registry'
          ? JSON.stringify([{ id: 'local-uuid-1', persistence: 'local' }])
          : null,
    };

    try {
      await expect(svc.getProjectThreads('local-uuid-1')).rejects.toThrow(/connected Supabase project/i);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      (globalThis as any).window = origWindow;
      (globalThis as any).localStorage = origLS;
    }
  });

  it('renders ProductionWorkspace cleanly without Discuss buttons when onOpenDiscussion is omitted (local/read-only)', () => {
    const html = renderToString(
      <ProductionWorkspace
        project={makeProject()}
        simulatedDate="2026-06-01"
        isDark={true}
        theme={{}}
        activeRole="owner"
        onSetSimulatedDate={() => {}}
        onAddActivity={() => {}}
        onAddActivityWithDetails={() => {}}
        onRemoveActivity={() => {}}
        onUpdateActivity={() => {}}
        onAddCrew={() => {}}
        onDeleteCrew={() => {}}
        onUpdateCrewStatus={() => {}}
        onNavigateTab={() => {}}
      />
    );
    expect(html).not.toContain('discuss-shooting-day-btn');
  });
});

describe('Prompt 03 — Migration 005 SQL Security & Dependency Invariants', () => {
  it('enforces prerequisite checks on 003 & 004, RLS, idempotency, mention membership, and Prompt 04 event foundation without creating notification tables', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/005_discussions_and_threads.sql'),
      'utf8'
    );

    expect(sql).toContain("to_regclass('public.project_operational_states') IS NULL");
    expect(sql).toContain("to_regprocedure('public.effective_project_role(uuid,uuid)') IS NULL");
    expect(sql).toContain('ALTER TABLE public.project_threads ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.project_thread_reads ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('idx_project_messages_idempotency');
    expect(sql).toContain('is_project_member(NEW.project_id, v_uid)');
    expect(sql).toContain('resolve_discussion_notification_targets');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS public.notifications');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS public.notification_preferences');
  });
});
