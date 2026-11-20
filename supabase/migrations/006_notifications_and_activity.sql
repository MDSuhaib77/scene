-- ==============================================================================
-- SceneOS Migration 006: Notifications & Production Activity Layer
-- Target: PostgreSQL 15+ (Supabase)
-- Non-destructive & additive: extends public.project_activity (001) and adds
-- notifications & notification_preferences with database-driven triggers,
-- idempotency keys, ownership RLS, and cursor-paginated RPCs.
-- ==============================================================================

-- 1. PREREQUISITE & DEPENDENCY READINESS GATE
DO $$
BEGIN
    IF to_regclass('public.projects') IS NULL
       OR to_regclass('public.project_members') IS NULL
       OR to_regclass('public.project_activity') IS NULL THEN
        RAISE EXCEPTION 'Migration 006 prerequisite failure: 001_initial_foundation objects are missing.';
    END IF;

    IF to_regclass('public.project_invitations') IS NULL THEN
        RAISE EXCEPTION 'Migration 006 prerequisite failure: 002_invitations_and_rbac objects are missing.';
    END IF;

    IF to_regclass('public.project_operational_states') IS NULL THEN
        RAISE EXCEPTION 'Migration 006 prerequisite failure: 003_production_and_operational_state must be applied before 006.';
    END IF;

    IF to_regprocedure('public.effective_project_role(uuid,uuid)') IS NULL THEN
        RAISE EXCEPTION 'Migration 006 prerequisite failure: 004_people_membership_hardening must be applied before 006.';
    END IF;

    IF to_regclass('public.project_threads') IS NULL
       OR to_regclass('public.project_messages') IS NULL
       OR to_regprocedure('public.resolve_discussion_notification_targets(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Migration 006 prerequisite failure: 005_discussions_and_threads must be applied before 006.';
    END IF;
END
$$;

-- 2. EXTEND AND HARDEN EXISTING public.project_activity (Reuse 001 Infrastructure)
ALTER TABLE public.project_threads
    ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN GENERATED ALWAYS AS (resolved_at IS NOT NULL) STORED;

ALTER TABLE public.project_activity
    ADD COLUMN IF NOT EXISTS entity_type TEXT,
    ADD COLUMN IF NOT EXISTS entity_id TEXT,
    ADD COLUMN IF NOT EXISTS entity_label TEXT,
    ADD COLUMN IF NOT EXISTS dedup_key TEXT;

ALTER TABLE public.project_activity
    ALTER COLUMN user_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_activity_dedup
    ON public.project_activity(project_id, dedup_key)
    WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_activity_project_type_date
    ON public.project_activity(project_id, activity_type, created_at DESC, id DESC);

ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

-- Replace permissive insert policy: ordinary clients must NEVER fabricate system activity.
DROP POLICY IF EXISTS "Project activity insertable by members" ON public.project_activity;
DROP POLICY IF EXISTS "Project activity readable by members" ON public.project_activity;

CREATE POLICY "Project activity readable by members"
ON public.project_activity FOR SELECT
TO authenticated
USING (public.is_project_member(project_id, public.current_app_user_id()));

REVOKE INSERT, UPDATE, DELETE ON public.project_activity FROM authenticated, anon;

-- 3. NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentions_enabled BOOLEAN NOT NULL DEFAULT true,
    discussion_replies_enabled BOOLEAN NOT NULL DEFAULT true,
    task_assignments_enabled BOOLEAN NOT NULL DEFAULT true,
    schedule_changes_enabled BOOLEAN NOT NULL DEFAULT true,
    call_sheets_enabled BOOLEAN NOT NULL DEFAULT true,
    dpr_reviews_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users read own notification preferences"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users insert own notification preferences"
ON public.notification_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "Users update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users update own notification preferences"
ON public.notification_preferences FOR UPDATE
TO authenticated
USING (user_id = public.current_app_user_id())
WITH CHECK (user_id = public.current_app_user_id());

REVOKE DELETE ON public.notification_preferences FROM authenticated, anon;

-- 4. PERSONAL NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('people_security', 'discussions', 'production')),
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'invitation_received',
            'invitation_accepted',
            'role_changed',
            'discussion_mention',
            'discussion_reply',
            'project_thread_new',
            'task_assigned',
            'task_deadline_changed',
            'schedule_rescheduled',
            'call_sheet_published',
            'dpr_submitted',
            'dpr_approved'
        )
    ),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('attention', 'normal')),
    title TEXT NOT NULL,
    body TEXT,
    entity_type TEXT NOT NULL CHECK (
        entity_type IN (
            'project',
            'member',
            'invitation',
            'thread',
            'message',
            'shooting_day',
            'production_event',
            'call_sheet',
            'dpr',
            'directory_entry',
            'task',
            'board',
            'storyboard_panel',
            'shot'
        )
    ),
    entity_id TEXT NOT NULL,
    entity_label TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    dedup_key TEXT NOT NULL,
    group_key TEXT,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_notifications_user_dedup UNIQUE (user_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
    ON public.notifications(user_id, dismissed_at, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_project_unread
    ON public.notifications(user_id, project_id, read_at, dismissed_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_group
    ON public.notifications(user_id, group_key, created_at DESC)
    WHERE group_key IS NOT NULL AND read_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
    user_id = public.current_app_user_id()
    AND (
        project_id IS NULL
        OR event_type = 'invitation_received'
        OR public.is_project_member(project_id, public.current_app_user_id())
    )
);

DROP POLICY IF EXISTS "Users update own notifications state" ON public.notifications;
CREATE POLICY "Users update own notifications state"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = public.current_app_user_id())
WITH CHECK (user_id = public.current_app_user_id());

REVOKE INSERT, DELETE ON public.notifications FROM authenticated, anon;

-- Protect immutable notification fields when owner updates read_at / dismissed_at
CREATE OR REPLACE FUNCTION public.enforce_notification_state_only_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Bypass check for trusted internal definer/service updates without session jwt/app user mismatch
    IF NEW.id <> OLD.id
       OR NEW.user_id <> OLD.user_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
       OR NEW.category <> OLD.category
       OR NEW.event_type <> OLD.event_type
       OR NEW.priority <> OLD.priority
       OR NEW.dedup_key <> OLD.dedup_key
       OR NEW.entity_type <> OLD.entity_type
       OR NEW.entity_id <> OLD.entity_id
       OR NEW.created_at <> OLD.created_at THEN
        -- Allow internal coalescing trigger/helper (flagged via pg_trigger_depth / local guc)
        IF current_setting('app.allow_notification_coalesce', true) <> 'true' THEN
            RAISE EXCEPTION 'Only read_at and dismissed_at may be modified on notifications.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_notification_state_only ON public.notifications;
CREATE TRIGGER trg_enforce_notification_state_only
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_state_only_update();

-- 5. INTERNAL SERVER-SIDE ACTIVITY & NOTIFICATION HELPERS

CREATE OR REPLACE FUNCTION public.record_project_activity_event(
    p_project_id UUID,
    p_actor_id UUID,
    p_activity_type TEXT,
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id TEXT DEFAULT NULL,
    p_entity_label TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_dedup_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_project_id IS NULL OR p_activity_type IS NULL OR p_title IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.project_activity (
        project_id,
        user_id,
        activity_type,
        title,
        description,
        entity_type,
        entity_id,
        entity_label,
        metadata,
        dedup_key
    ) VALUES (
        p_project_id,
        p_actor_id,
        p_activity_type,
        p_title,
        p_description,
        p_entity_type,
        p_entity_id,
        p_entity_label,
        COALESCE(p_metadata, '{}'::jsonb),
        p_dedup_key
    )
    ON CONFLICT (project_id, dedup_key) WHERE dedup_key IS NOT NULL
    DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_project_activity_event(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_notification_category_enabled(
    p_user_id UUID,
    p_event_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_prefs public.notification_preferences%ROWTYPE;
BEGIN
    -- Essential security & access notifications cannot be suppressed
    IF p_event_type IN ('invitation_received', 'role_changed') THEN
        RETURN true;
    END IF;

    SELECT * INTO v_prefs
    FROM public.notification_preferences
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN true;
    END IF;

    CASE p_event_type
        WHEN 'invitation_accepted' THEN RETURN true;
        WHEN 'discussion_mention' THEN RETURN v_prefs.mentions_enabled;
        WHEN 'discussion_reply' THEN RETURN v_prefs.discussion_replies_enabled;
        WHEN 'project_thread_new' THEN RETURN v_prefs.discussion_replies_enabled;
        WHEN 'task_assigned' THEN RETURN v_prefs.task_assignments_enabled;
        WHEN 'task_deadline_changed' THEN RETURN v_prefs.task_assignments_enabled;
        WHEN 'schedule_rescheduled' THEN RETURN v_prefs.schedule_changes_enabled;
        WHEN 'call_sheet_published' THEN RETURN v_prefs.call_sheets_enabled;
        WHEN 'dpr_submitted' THEN RETURN v_prefs.dpr_reviews_enabled;
        WHEN 'dpr_approved' THEN RETURN v_prefs.dpr_reviews_enabled;
        ELSE RETURN true;
    END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_notification_category_enabled(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_user_notification(
    p_user_id UUID,
    p_project_id UUID,
    p_actor_id UUID,
    p_category TEXT,
    p_event_type TEXT,
    p_priority TEXT,
    p_title TEXT,
    p_body TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_entity_label TEXT,
    p_dedup_key TEXT,
    p_group_key TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_id UUID;
    v_coalesced_count INTEGER;
BEGIN
    IF p_user_id IS NULL OR p_dedup_key IS NULL OR trim(p_dedup_key) = '' THEN
        RETURN;
    END IF;

    -- Do not notify users about actions they performed themselves
    IF p_actor_id IS NOT NULL AND p_user_id = p_actor_id THEN
        RETURN;
    END IF;

    -- Verify project membership for project-scoped events (except pending invitations before acceptance)
    IF p_project_id IS NOT NULL AND p_event_type <> 'invitation_received' THEN
        IF NOT public.is_project_member(p_project_id, p_user_id) THEN
            RETURN;
        END IF;
    END IF;

    -- Respect personal category preferences (security events always allowed)
    IF NOT public.is_notification_category_enabled(p_user_id, p_event_type) THEN
        RETURN;
    END IF;

    -- Coalesce rapid unread discussion replies in the same thread/day so inbox stays restrained
    IF p_event_type = 'discussion_reply' AND p_group_key IS NOT NULL THEN
        SELECT id, COALESCE((metadata ->> 'coalesced_count')::INTEGER, 1)
        INTO v_existing_id, v_coalesced_count
        FROM public.notifications
        WHERE user_id = p_user_id
          AND group_key = p_group_key
          AND event_type = 'discussion_reply'
          AND read_at IS NULL
          AND dismissed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            PERFORM set_config('app.allow_notification_coalesce', 'true', true);
            UPDATE public.notifications
            SET actor_id = p_actor_id,
                title = COALESCE(NULLIF(p_entity_label, ''), 'Discussion') || ' — ' || (v_coalesced_count + 1)::TEXT || ' new replies',
                body = p_body,
                metadata = COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('coalesced_count', v_coalesced_count + 1),
                created_at = timezone('utc'::text, now())
            WHERE id = v_existing_id;
            PERFORM set_config('app.allow_notification_coalesce', 'false', true);
            RETURN;
        END IF;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        project_id,
        actor_id,
        category,
        event_type,
        priority,
        title,
        body,
        entity_type,
        entity_id,
        entity_label,
        metadata,
        dedup_key,
        group_key
    ) VALUES (
        p_user_id,
        p_project_id,
        p_actor_id,
        p_category,
        p_event_type,
        COALESCE(p_priority, 'normal'),
        p_title,
        p_body,
        p_entity_type,
        p_entity_id,
        p_entity_label,
        COALESCE(p_metadata, '{}'::jsonb),
        p_dedup_key,
        p_group_key
    )
    ON CONFLICT (user_id, dedup_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_user_notification(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- Resolve a single authoritative project member from an assignee text string (UUID, email, or exact unique full_name).
CREATE OR REPLACE FUNCTION public.resolve_project_member_by_assignee(
    p_project_id UUID,
    p_assignee TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_clean TEXT := trim(COALESCE(p_assignee, ''));
    v_match_id UUID;
    v_count INTEGER;
BEGIN
    IF v_clean = '' THEN
        RETURN NULL;
    END IF;

    -- 1. Direct UUID check
    IF v_clean ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        IF public.is_project_member(p_project_id, v_clean::UUID) THEN
            RETURN v_clean::UUID;
        END IF;
    END IF;

    -- 2. Exact email match within verified project members
    SELECT pr.id INTO v_match_id
    FROM (
        SELECT pm.user_id FROM public.project_members pm WHERE pm.project_id = p_project_id
        UNION
        SELECT p.owner_id AS user_id FROM public.projects p WHERE p.id = p_project_id
    ) roster
    JOIN public.profiles pr ON pr.id = roster.user_id
    WHERE lower(trim(pr.email)) = lower(v_clean)
    LIMIT 1;

    IF v_match_id IS NOT NULL THEN
        RETURN v_match_id;
    END IF;

    -- 3. Unique normalized full_name match within verified project members
    SELECT count(*), min(pr.id) INTO v_count, v_match_id
    FROM (
        SELECT pm.user_id FROM public.project_members pm WHERE pm.project_id = p_project_id
        UNION
        SELECT p.owner_id AS user_id FROM public.projects p WHERE p.id = p_project_id
    ) roster
    JOIN public.profiles pr ON pr.id = roster.user_id
    WHERE lower(trim(pr.full_name)) = lower(v_clean);

    IF v_count = 1 THEN
        RETURN v_match_id;
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_project_member_by_assignee(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- 6. DATABASE TRIGGERS FOR AUTHORITATIVE EVENTS

-- 6.1 Invitations (received + accepted)
CREATE OR REPLACE FUNCTION public.handle_invitation_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_proj_title TEXT;
    v_inviter_name TEXT;
    v_target_user_id UUID;
    v_acceptor_name TEXT;
    v_acceptor_id UUID;
BEGIN
    SELECT title INTO v_proj_title FROM public.projects WHERE id = NEW.project_id;

    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        SELECT id INTO v_target_user_id
        FROM public.profiles
        WHERE lower(trim(email)) = lower(trim(NEW.email))
        LIMIT 1;

        IF v_target_user_id IS NOT NULL THEN
            SELECT full_name INTO v_inviter_name FROM public.profiles WHERE id = NEW.invited_by;
            PERFORM public.enqueue_user_notification(
                v_target_user_id,
                NEW.project_id,
                NEW.invited_by,
                'people_security',
                'invitation_received',
                'attention',
                'Invitation to ' || COALESCE(v_proj_title, 'production'),
                COALESCE(v_inviter_name, 'A producer') || ' invited you as ' || replace(NEW.role::TEXT, '_', ' ') || '.',
                'invitation',
                NEW.id::TEXT,
                COALESCE(v_proj_title, 'Project Invitation'),
                'inv_recv:' || NEW.id::TEXT,
                NULL,
                jsonb_build_object('role', NEW.role, 'department', NEW.department)
            );
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
        v_acceptor_id := public.current_app_user_id();
        SELECT full_name INTO v_acceptor_name FROM public.profiles WHERE id = v_acceptor_id;
        PERFORM public.enqueue_user_notification(
            NEW.invited_by,
            NEW.project_id,
            v_acceptor_id,
            'people_security',
            'invitation_accepted',
            'normal',
            COALESCE(v_acceptor_name, NEW.email) || ' joined ' || COALESCE(v_proj_title, 'the production'),
            'Accepted role: ' || replace(NEW.role::TEXT, '_', ' ') || COALESCE(' · ' || NULLIF(NEW.department, ''), ''),
            'member',
            COALESCE(v_acceptor_id::TEXT, NEW.id::TEXT),
            COALESCE(v_acceptor_name, NEW.email),
            'inv_acc:' || NEW.id::TEXT,
            NULL,
            jsonb_build_object('role', NEW.role, 'invitation_id', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invitations_events ON public.project_invitations;
CREATE TRIGGER trg_invitations_events
AFTER INSERT OR UPDATE OF status ON public.project_invitations
FOR EACH ROW EXECUTE FUNCTION public.handle_invitation_events();

-- 6.2 Membership Join & Role Change Events
CREATE OR REPLACE FUNCTION public.handle_project_member_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := public.current_app_user_id();
    v_member_name TEXT;
    v_proj_title TEXT;
BEGIN
    SELECT full_name INTO v_member_name FROM public.profiles WHERE id = NEW.user_id;
    SELECT title INTO v_proj_title FROM public.projects WHERE id = NEW.project_id;

    IF TG_OP = 'INSERT' THEN
        PERFORM public.record_project_activity_event(
            NEW.project_id,
            COALESCE(v_actor_id, NEW.user_id),
            'member_joined',
            COALESCE(v_member_name, 'Production Member') || ' joined as ' || replace(NEW.role::TEXT, '_', ' '),
            CASE WHEN NEW.department IS NOT NULL THEN 'Department: ' || NEW.department ELSE NULL END,
            'member',
            NEW.user_id::TEXT,
            COALESCE(v_member_name, 'Member'),
            jsonb_build_object('role', NEW.role, 'department', NEW.department),
            'mem_join:' || NEW.id::TEXT
        );
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
        PERFORM public.record_project_activity_event(
            NEW.project_id,
            COALESCE(v_actor_id, NEW.user_id),
            'member_role_changed',
            COALESCE(v_member_name, 'Member') || ' role changed from ' || replace(OLD.role::TEXT, '_', ' ') || ' to ' || replace(NEW.role::TEXT, '_', ' '),
            NULL,
            'member',
            NEW.user_id::TEXT,
            COALESCE(v_member_name, 'Member'),
            jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role),
            'mem_role:' || NEW.id::TEXT || ':' || OLD.role::TEXT || ':' || NEW.role::TEXT || ':' || floor(extract(epoch FROM timezone('utc'::text, now())) / 15)::TEXT
        );

        PERFORM public.enqueue_user_notification(
            NEW.user_id,
            NEW.project_id,
            v_actor_id,
            'people_security',
            'role_changed',
            'attention',
            'Your project role changed in ' || COALESCE(v_proj_title, 'production'),
            'Updated from ' || replace(OLD.role::TEXT, '_', ' ') || ' to ' || replace(NEW.role::TEXT, '_', ' ') || '.',
            'member',
            NEW.user_id::TEXT,
            COALESCE(v_proj_title, 'Project Access'),
            'role_chg:' || NEW.id::TEXT || ':' || OLD.role::TEXT || ':' || NEW.role::TEXT || ':' || floor(extract(epoch FROM timezone('utc'::text, now())) / 15)::TEXT,
            NULL,
            jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_members_events ON public.project_members;
CREATE TRIGGER trg_project_members_events
AFTER INSERT OR UPDATE OF role ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.handle_project_member_events();

-- 6.3 Discussions Activity & Mention/Reply Notifications (Reuses 005 resolve_discussion_notification_targets)
CREATE OR REPLACE FUNCTION public.handle_discussion_thread_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_label TEXT;
    v_actor UUID;
BEGIN
    v_label := COALESCE(
        NULLIF(NEW.entity_label, ''),
        NULLIF(NEW.title, ''),
        CASE WHEN NEW.scope = 'project' THEN 'Project Discussion' ELSE 'Contextual Thread' END
    );

    IF TG_OP = 'INSERT' THEN
        PERFORM public.record_project_activity_event(
            NEW.project_id,
            NEW.created_by,
            'discussion_created',
            'Started discussion: ' || v_label,
            CASE WHEN NEW.entity_type IS NOT NULL THEN 'Attached to ' || replace(NEW.entity_type, '_', ' ') ELSE 'Project-wide discussion' END,
            COALESCE(NEW.entity_type, 'thread'),
            COALESCE(NEW.entity_id, NEW.id::TEXT),
            v_label,
            jsonb_build_object('thread_id', NEW.id, 'scope', NEW.scope),
            'thread_new:' || NEW.id::TEXT
        );
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.is_resolved IS DISTINCT FROM NEW.is_resolved THEN
        v_actor := COALESCE(public.current_app_user_id(), NEW.resolved_by, NEW.created_by);
        PERFORM public.record_project_activity_event(
            NEW.project_id,
            v_actor,
            CASE WHEN NEW.is_resolved THEN 'discussion_resolved' ELSE 'discussion_reopened' END,
            CASE WHEN NEW.is_resolved THEN 'Resolved discussion: ' ELSE 'Reopened discussion: ' END || v_label,
            NULL,
            COALESCE(NEW.entity_type, 'thread'),
            COALESCE(NEW.entity_id, NEW.id::TEXT),
            v_label,
            jsonb_build_object('thread_id', NEW.id, 'is_resolved', NEW.is_resolved),
            'thread_res:' || NEW.id::TEXT || ':' || NEW.is_resolved::TEXT || ':' || floor(extract(epoch FROM timezone('utc'::text, now())) / 10)::TEXT
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discussion_thread_activity ON public.project_threads;
CREATE TRIGGER trg_discussion_thread_activity
AFTER INSERT OR UPDATE OF is_resolved ON public.project_threads
FOR EACH ROW EXECUTE FUNCTION public.handle_discussion_thread_activity();

CREATE OR REPLACE FUNCTION public.handle_discussion_message_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target RECORD;
    v_thread public.project_threads%ROWTYPE;
    v_author_name TEXT;
    v_thread_label TEXT;
    v_snippet TEXT;
    v_ev_type TEXT;
    v_prio TEXT;
    v_title TEXT;
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_thread FROM public.project_threads WHERE id = NEW.thread_id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    SELECT full_name INTO v_author_name FROM public.profiles WHERE id = NEW.author_id;
    v_thread_label := COALESCE(
        NULLIF(v_thread.entity_label, ''),
        NULLIF(v_thread.title, ''),
        CASE WHEN v_thread.scope = 'project' THEN 'Project Discussion' ELSE 'Discussion' END
    );
    v_snippet := left(regexp_replace(NEW.body, '\s+', ' ', 'g'), 140);

    FOR v_target IN
        SELECT recipient_user_id, event_kind
        FROM public.resolve_discussion_notification_targets(NEW.id)
    LOOP
        IF v_target.event_kind = 'mention' THEN
            v_ev_type := 'discussion_mention';
            v_prio := 'attention';
            v_title := COALESCE(v_author_name, 'A member') || ' mentioned you in ' || v_thread_label;
        ELSIF v_target.event_kind = 'thread_reply' THEN
            v_ev_type := 'discussion_reply';
            v_prio := 'normal';
            v_title := COALESCE(v_author_name, 'A member') || ' replied in ' || v_thread_label;
        ELSE
            v_ev_type := 'project_thread_new';
            v_prio := 'normal';
            v_title := COALESCE(v_author_name, 'A production lead') || ' started ' || v_thread_label;
        END IF;

        PERFORM public.enqueue_user_notification(
            v_target.recipient_user_id,
            NEW.project_id,
            NEW.author_id,
            'discussions',
            v_ev_type,
            v_prio,
            v_title,
            v_snippet,
            COALESCE(v_thread.entity_type, 'thread'),
            COALESCE(v_thread.entity_id, v_thread.id::TEXT),
            v_thread_label,
            'msg:' || NEW.id::TEXT,
            'thread:' || v_thread.id::TEXT || ':' || timezone('utc'::text, NEW.created_at)::DATE::TEXT,
            jsonb_build_object(
                'thread_id', v_thread.id,
                'message_id', NEW.id,
                'entity_type', v_thread.entity_type,
                'entity_id', v_thread.entity_id
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discussion_message_notifications ON public.project_messages;
CREATE TRIGGER trg_discussion_message_notifications
AFTER INSERT ON public.project_messages
FOR EACH ROW EXECUTE FUNCTION public.handle_discussion_message_notifications();

-- 6.4 Operational State Transitions (Call Sheets, DPR, Shoot Days, Calendar Events, Tasks)
CREATE OR REPLACE FUNCTION public.handle_operational_state_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := public.current_app_user_id();
    v_old_prod JSONB := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.production_state, '{}'::jsonb) ELSE '{}'::jsonb END;
    v_new_prod JSONB := COALESCE(NEW.production_state, '{}'::jsonb);
    v_old_phases JSONB := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.phases_state, '[]'::jsonb) ELSE '[]'::jsonb END;
    v_new_phases JSONB := COALESCE(NEW.phases_state, '[]'::jsonb);

    v_new_cs JSONB;
    v_old_cs JSONB;
    v_cs_id TEXT;
    v_cs_rev INTEGER;
    v_day_id TEXT;
    v_day_num TEXT;
    v_day_date TEXT;
    v_recipient UUID;

    v_new_dpr JSONB;
    v_old_dpr JSONB;
    v_dpr_id TEXT;
    v_dpr_day TEXT;
    v_old_dpr_status TEXT;
    v_new_dpr_status TEXT;

    v_new_day JSONB;
    v_old_day JSONB;

    v_new_ev JSONB;
    v_old_ev JSONB;

    v_new_ph JSONB;
    v_new_act JSONB;
    v_old_act JSONB;
    v_act_id TEXT;
    v_old_assignee TEXT;
    v_new_assignee TEXT;
    v_assignee_uid UUID;
BEGIN
    IF jsonb_typeof(v_new_prod) = 'object' THEN
        -- A. Call Sheets Published / Revised
        IF jsonb_typeof(v_new_prod -> 'callSheets') = 'array' THEN
            FOR v_new_cs IN SELECT value FROM jsonb_array_elements(v_new_prod -> 'callSheets')
            LOOP
                IF COALESCE((v_new_cs ->> 'published')::BOOLEAN, false) IS NOT TRUE THEN
                    CONTINUE;
                END IF;

                v_cs_id := v_new_cs ->> 'id';
                v_cs_rev := COALESCE((v_new_cs ->> 'revisionNumber')::INTEGER, 1);
                v_day_id := v_new_cs ->> 'shootingDayId';

                SELECT elem INTO v_old_cs
                FROM jsonb_array_elements(COALESCE(v_old_prod -> 'callSheets', '[]'::jsonb)) elem
                WHERE elem ->> 'id' = v_cs_id
                LIMIT 1;

                IF v_old_cs IS NULL
                   OR COALESCE((v_old_cs ->> 'published')::BOOLEAN, false) IS NOT TRUE
                   OR COALESCE((v_old_cs ->> 'revisionNumber')::INTEGER, 1) < v_cs_rev THEN

                    SELECT elem ->> 'dayNumber', elem ->> 'date'
                    INTO v_day_num, v_day_date
                    FROM jsonb_array_elements(COALESCE(v_new_prod -> 'shootingDays', '[]'::jsonb)) elem
                    WHERE elem ->> 'id' = v_day_id
                    LIMIT 1;

                    PERFORM public.record_project_activity_event(
                        NEW.project_id,
                        v_actor_id,
                        'call_sheet_published',
                        'Call Sheet ' || CASE WHEN v_cs_rev > 1 THEN 'Rev ' || v_cs_rev::TEXT || ' revised' ELSE 'published' END || COALESCE(' for Day ' || v_day_num, ''),
                        CASE WHEN v_day_date IS NOT NULL THEN 'Shoot Date: ' || v_day_date || ' · General Call: ' || COALESCE(v_new_cs ->> 'generalCallTime', '') ELSE NULL END,
                        'call_sheet',
                        v_cs_id,
                        'Day ' || COALESCE(v_day_num, '?') || ' Call Sheet',
                        jsonb_build_object('shooting_day_id', v_day_id, 'revision', v_cs_rev),
                        'act_cs:' || v_cs_id || ':r' || v_cs_rev::TEXT
                    );

                    -- Notify only members explicitly linked via directory_entry_id on this Call Sheet
                    FOR v_recipient IN
                        SELECT DISTINCT pm.user_id
                        FROM public.project_members pm
                        WHERE pm.project_id = NEW.project_id
                          AND pm.directory_entry_id IS NOT NULL
                          AND (
                              pm.directory_entry_id IN (
                                  SELECT jsonb_array_elements_text(COALESCE(v_new_cs -> 'directoryEntryIds', '[]'::jsonb))
                              )
                              OR pm.directory_entry_id IN (
                                  SELECT c ->> 'directoryEntryId'
                                  FROM jsonb_array_elements(COALESCE(v_new_cs -> 'castCalls', '[]'::jsonb)) c
                                  WHERE c ->> 'directoryEntryId' IS NOT NULL
                              )
                          )
                    LOOP
                        PERFORM public.enqueue_user_notification(
                            v_recipient,
                            NEW.project_id,
                            v_actor_id,
                            'production',
                            'call_sheet_published',
                            'attention',
                            'Call Sheet ' || CASE WHEN v_cs_rev > 1 THEN 'Rev ' || v_cs_rev::TEXT ELSE 'Published' END || COALESCE(' · Day ' || v_day_num, ''),
                            COALESCE('Date: ' || v_day_date || ' · ', '') || 'General Call ' || COALESCE(v_new_cs ->> 'generalCallTime', 'TBD'),
                            'call_sheet',
                            v_cs_id,
                            'Day ' || COALESCE(v_day_num, '?') || ' Call Sheet',
                            'cs_pub:' || v_cs_id || ':r' || v_cs_rev::TEXT,
                            NULL,
                            jsonb_build_object('shooting_day_id', v_day_id, 'revision', v_cs_rev)
                        );
                    END LOOP;
                END IF;
            END LOOP;
        END IF;

        -- B. DPR Submitted for Review / Approved
        IF jsonb_typeof(v_new_prod -> 'dailyReports') = 'array' THEN
            FOR v_new_dpr IN SELECT value FROM jsonb_array_elements(v_new_prod -> 'dailyReports')
            LOOP
                v_dpr_id := v_new_dpr ->> 'id';
                v_new_dpr_status := COALESCE(v_new_dpr ->> 'status', 'Draft');
                v_dpr_day := COALESCE(v_new_dpr ->> 'shootDayNumber', '?');

                SELECT elem INTO v_old_dpr
                FROM jsonb_array_elements(COALESCE(v_old_prod -> 'dailyReports', '[]'::jsonb)) elem
                WHERE elem ->> 'id' = v_dpr_id
                LIMIT 1;
                v_old_dpr_status := COALESCE(v_old_dpr ->> 'status', 'Draft');

                IF v_new_dpr_status = 'Submitted' AND v_old_dpr_status <> 'Submitted' THEN
                    PERFORM public.record_project_activity_event(
                        NEW.project_id,
                        v_actor_id,
                        'dpr_submitted',
                        'Day ' || v_dpr_day || ' DPR submitted for review',
                        COALESCE('Shoot Date: ' || (v_new_dpr ->> 'calendarDate'), NULL),
                        'dpr',
                        v_dpr_id,
                        'Day ' || v_dpr_day || ' DPR',
                        jsonb_build_object('shooting_day_id', v_new_dpr ->> 'shootingDayId', 'status', 'Submitted'),
                        'act_dpr_sub:' || v_dpr_id || ':' || COALESCE(v_new_dpr ->> 'updatedAt', v_dpr_day)
                    );

                    -- Notify only project owners/producers with review authority
                    FOR v_recipient IN
                        SELECT uid FROM (
                            SELECT p.owner_id AS uid FROM public.projects p WHERE p.id = NEW.project_id
                            UNION
                            SELECT pm.user_id AS uid FROM public.project_members pm
                            WHERE pm.project_id = NEW.project_id AND pm.role IN ('owner', 'producer')
                        ) reviewers
                    LOOP
                        PERFORM public.enqueue_user_notification(
                            v_recipient,
                            NEW.project_id,
                            v_actor_id,
                            'production',
                            'dpr_submitted',
                            'attention',
                            'DPR ready for review · Day ' || v_dpr_day,
                            COALESCE('Prepared by ' || NULLIF(v_new_dpr ->> 'preparedBy', '') || ' · ', '') || COALESCE(v_new_dpr ->> 'calendarDate', ''),
                            'dpr',
                            v_dpr_id,
                            'Day ' || v_dpr_day || ' DPR',
                            'dpr_sub:' || v_dpr_id || ':' || COALESCE(v_new_dpr ->> 'updatedAt', ''),
                            NULL,
                            jsonb_build_object('shooting_day_id', v_new_dpr ->> 'shootingDayId')
                        );
                    END LOOP;
                ELSIF v_new_dpr_status = 'Approved' AND v_old_dpr_status <> 'Approved' THEN
                    PERFORM public.record_project_activity_event(
                        NEW.project_id,
                        v_actor_id,
                        'dpr_approved',
                        'Day ' || v_dpr_day || ' DPR approved',
                        NULL,
                        'dpr',
                        v_dpr_id,
                        'Day ' || v_dpr_day || ' DPR',
                        jsonb_build_object('shooting_day_id', v_new_dpr ->> 'shootingDayId', 'status', 'Approved'),
                        'act_dpr_app:' || v_dpr_id || ':' || COALESCE(v_new_dpr ->> 'updatedAt', v_dpr_day)
                    );

                    v_assignee_uid := public.resolve_project_member_by_assignee(NEW.project_id, v_new_dpr ->> 'preparedBy');
                    IF v_assignee_uid IS NOT NULL THEN
                        PERFORM public.enqueue_user_notification(
                            v_assignee_uid,
                            NEW.project_id,
                            v_actor_id,
                            'production',
                            'dpr_approved',
                            'normal',
                            'Day ' || v_dpr_day || ' DPR approved',
                            COALESCE('Approved by ' || NULLIF(v_new_dpr ->> 'approvedBy', ''), 'Production sign-off complete.'),
                            'dpr',
                            v_dpr_id,
                            'Day ' || v_dpr_day || ' DPR',
                            'dpr_app:' || v_dpr_id || ':' || COALESCE(v_new_dpr ->> 'updatedAt', ''),
                            NULL,
                            jsonb_build_object('shooting_day_id', v_new_dpr ->> 'shootingDayId')
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;

        -- C. Shooting Days Rescheduled (Existing day date or callTime changes)
        IF TG_OP = 'UPDATE' AND jsonb_typeof(v_new_prod -> 'shootingDays') = 'array' THEN
            FOR v_new_day IN SELECT value FROM jsonb_array_elements(v_new_prod -> 'shootingDays')
            LOOP
                v_day_id := v_new_day ->> 'id';
                SELECT elem INTO v_old_day
                FROM jsonb_array_elements(COALESCE(v_old_prod -> 'shootingDays', '[]'::jsonb)) elem
                WHERE elem ->> 'id' = v_day_id
                LIMIT 1;

                IF v_old_day IS NOT NULL AND (
                    (v_old_day ->> 'date') IS DISTINCT FROM (v_new_day ->> 'date')
                    OR (v_old_day ->> 'callTime') IS DISTINCT FROM (v_new_day ->> 'callTime')
                ) THEN
                    v_day_num := COALESCE(v_new_day ->> 'dayNumber', '?');
                    v_day_date := COALESCE(v_new_day ->> 'date', '');

                    PERFORM public.record_project_activity_event(
                        NEW.project_id,
                        v_actor_id,
                        'shoot_day_rescheduled',
                        'Shooting Day ' || v_day_num || ' rescheduled to ' || v_day_date,
                        'Call ' || COALESCE(v_new_day ->> 'callTime', '') || ' (was ' || COALESCE(v_old_day ->> 'date', '') || ' ' || COALESCE(v_old_day ->> 'callTime', '') || ')',
                        'shooting_day',
                        v_day_id,
                        'Shoot Day ' || v_day_num,
                        jsonb_build_object('date', v_day_date, 'callTime', v_new_day ->> 'callTime'),
                        'act_sd:' || v_day_id || ':' || v_day_date || ':' || COALESCE(v_new_day ->> 'callTime', '')
                    );

                    -- Notify only production scheduling leads & participants on this day's Call Sheet
                    FOR v_recipient IN
                        SELECT DISTINCT uid FROM (
                            SELECT p.owner_id AS uid FROM public.projects p WHERE p.id = NEW.project_id
                            UNION
                            SELECT pm.user_id AS uid FROM public.project_members pm
                            WHERE pm.project_id = NEW.project_id AND pm.role IN ('owner', 'producer', 'director', 'first_ad')
                            UNION
                            SELECT pm.user_id AS uid
                            FROM public.project_members pm
                            JOIN jsonb_array_elements(COALESCE(v_new_prod -> 'callSheets', '[]'::jsonb)) cs ON cs ->> 'shootingDayId' = v_day_id
                            WHERE pm.project_id = NEW.project_id
                              AND pm.directory_entry_id IS NOT NULL
                              AND pm.directory_entry_id IN (
                                  SELECT jsonb_array_elements_text(COALESCE(cs -> 'directoryEntryIds', '[]'::jsonb))
                              )
                        ) affected
                    LOOP
                        PERFORM public.enqueue_user_notification(
                            v_recipient,
                            NEW.project_id,
                            v_actor_id,
                            'production',
                            'schedule_rescheduled',
                            'attention',
                            'Shoot Day ' || v_day_num || ' schedule updated',
                            'Moved to ' || v_day_date || COALESCE(' · Call ' || NULLIF(v_new_day ->> 'callTime', ''), ''),
                            'shooting_day',
                            v_day_id,
                            'Shoot Day ' || v_day_num,
                            'sd_resched:' || v_day_id || ':' || v_day_date || ':' || COALESCE(v_new_day ->> 'callTime', ''),
                            NULL,
                            jsonb_build_object('date', v_day_date)
                        );
                    END LOOP;
                END IF;
            END LOOP;
        END IF;

        -- D. Production Events Rescheduled
        IF TG_OP = 'UPDATE' AND jsonb_typeof(v_new_prod -> 'events') = 'array' THEN
            FOR v_new_ev IN SELECT value FROM jsonb_array_elements(v_new_prod -> 'events')
            LOOP
                SELECT elem INTO v_old_ev
                FROM jsonb_array_elements(COALESCE(v_old_prod -> 'events', '[]'::jsonb)) elem
                WHERE elem ->> 'id' = (v_new_ev ->> 'id')
                LIMIT 1;

                IF v_old_ev IS NOT NULL AND (
                    (v_old_ev ->> 'date') IS DISTINCT FROM (v_new_ev ->> 'date')
                    OR (v_old_ev ->> 'endDate') IS DISTINCT FROM (v_new_ev ->> 'endDate')
                ) THEN
                    PERFORM public.record_project_activity_event(
                        NEW.project_id,
                        v_actor_id,
                        'event_rescheduled',
                        'Event rescheduled: ' || COALESCE(v_new_ev ->> 'title', 'Production Event'),
                        'New date: ' || COALESCE(v_new_ev ->> 'date', '') || ' (was ' || COALESCE(v_old_ev ->> 'date', '') || ')',
                        'production_event',
                        v_new_ev ->> 'id',
                        v_new_ev ->> 'title',
                        jsonb_build_object('date', v_new_ev ->> 'date', 'category', v_new_ev ->> 'category'),
                        'act_ev:' || COALESCE(v_new_ev ->> 'id', '') || ':' || COALESCE(v_new_ev ->> 'date', '')
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- E. Phase Tasks Assigned / Completed / Rescheduled
    IF jsonb_typeof(v_new_phases) = 'array' THEN
        FOR v_new_ph IN SELECT value FROM jsonb_array_elements(v_new_phases)
        LOOP
            IF jsonb_typeof(v_new_ph -> 'activities') <> 'array' THEN
                CONTINUE;
            END IF;

            FOR v_new_act IN SELECT value FROM jsonb_array_elements(v_new_ph -> 'activities')
            LOOP
                v_act_id := v_new_act ->> 'id';
                IF v_act_id IS NULL THEN CONTINUE; END IF;

                SELECT act_elem INTO v_old_act
                FROM jsonb_array_elements(v_old_phases) ph_elem,
                     jsonb_array_elements(COALESCE(ph_elem -> 'activities', '[]'::jsonb)) act_elem
                WHERE act_elem ->> 'id' = v_act_id
                LIMIT 1;

                v_new_assignee := NULLIF(trim(COALESCE(v_new_act ->> 'assignedTo', '')), '');
                v_old_assignee := NULLIF(trim(COALESCE(v_old_act ->> 'assignedTo', '')), '');
                v_assignee_uid := public.resolve_project_member_by_assignee(NEW.project_id, v_new_assignee);

                -- 1) Assignment change
                IF v_new_assignee IS NOT NULL AND v_new_assignee IS DISTINCT FROM v_old_assignee THEN
                    PERFORM public.record_project_activity_event(
                        NEW.project_id,
                        v_actor_id,
                        'task_assigned',
                        'Task assigned: ' || COALESCE(v_new_act ->> 'name', 'Task') || ' -> ' || v_new_assignee,
                        CASE WHEN v_new_act ->> 'endDate' IS NOT NULL THEN 'Due ' || (v_new_act ->> 'endDate') ELSE NULL END,
                        'task',
                        v_act_id,
                        v_new_act ->> 'name',
                        jsonb_build_object('phase_id', v_new_ph ->> 'id', 'assigned_to', v_new_assignee),
                        'act_tassign:' || v_act_id || ':' || v_new_assignee
                    );

                    IF v_assignee_uid IS NOT NULL THEN
                        PERFORM public.enqueue_user_notification(
                            v_assignee_uid,
                            NEW.project_id,
                            v_actor_id,
                            'production',
                            'task_assigned',
                            'attention',
                            'Assigned to task: ' || COALESCE(v_new_act ->> 'name', 'Production Task'),
                            COALESCE('Due ' || NULLIF(v_new_act ->> 'endDate', ''), 'In phase: ' || COALESCE(v_new_ph ->> 'name', 'Schedule')),
                            'task',
                            v_act_id,
                            v_new_act ->> 'name',
                            'task_assign:' || v_act_id || ':' || v_assignee_uid::TEXT || ':' || v_new_assignee,
                            NULL,
                            jsonb_build_object('phase_id', v_new_ph ->> 'id', 'end_date', v_new_act ->> 'endDate')
                        );
                    END IF;
                -- 2) Deadline changed on an already-assigned task
                ELSIF v_old_act IS NOT NULL
                  AND v_assignee_uid IS NOT NULL
                  AND (v_old_act ->> 'endDate') IS DISTINCT FROM (v_new_act ->> 'endDate')
                  AND (v_new_act ->> 'endDate') IS NOT NULL THEN
                    PERFORM public.enqueue_user_notification(
                        v_assignee_uid,
                        NEW.project_id,
                        v_actor_id,
                        'production',
                        'task_deadline_changed',
                        'normal',
                        'Task deadline updated: ' || COALESCE(v_new_act ->> 'name', 'Task'),
                        'New due date: ' || (v_new_act ->> 'endDate') || COALESCE(' (was ' || NULLIF(v_old_act ->> 'endDate', '') || ')', ''),
                        'task',
                        v_act_id,
                        v_new_act ->> 'name',
                        'task_due:' || v_act_id || ':' || COALESCE(v_new_act ->> 'endDate', ''),
                        NULL,
                        jsonb_build_object('phase_id', v_new_ph ->> 'id', 'end_date', v_new_act ->> 'endDate')
                    );
                END IF;

                -- 3) Task completed (factual shared activity only)
                IF COALESCE((v_new_act ->> 'completed')::BOOLEAN, false) IS TRUE
                   AND COALESCE((v_old_act ->> 'completed')::BOOLEAN, false) IS NOT TRUE THEN
                    PERFORM public.record_project_activity_event(
                        NEW.project_id,
                        v_actor_id,
                        'task_completed',
                        'Completed task: ' || COALESCE(v_new_act ->> 'name', 'Task'),
                        'Phase: ' || COALESCE(v_new_ph ->> 'name', 'Schedule'),
                        'task',
                        v_act_id,
                        v_new_act ->> 'name',
                        jsonb_build_object('phase_id', v_new_ph ->> 'id'),
                        'act_tdone:' || v_act_id || ':' || COALESCE(v_new_act ->> 'endDate', 'done')
                    );
                END IF;
            END LOOP;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operational_state_events ON public.project_operational_states;
CREATE TRIGGER trg_operational_state_events
AFTER INSERT OR UPDATE ON public.project_operational_states
FOR EACH ROW EXECUTE FUNCTION public.handle_operational_state_events();

-- 7. CLIENT-CALLABLE RPCS (CURSOR PAGINATED, OWNER/MEMBER SCOPED)

CREATE OR REPLACE FUNCTION public.get_my_notifications(
    p_project_id UUID DEFAULT NULL,
    p_filter TEXT DEFAULT 'all',
    p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
    p_cursor_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    project_id UUID,
    project_title TEXT,
    actor_id UUID,
    actor_name TEXT,
    actor_avatar_url TEXT,
    category TEXT,
    event_type TEXT,
    priority TEXT,
    title TEXT,
    body TEXT,
    entity_type TEXT,
    entity_id TEXT,
    entity_label TEXT,
    metadata JSONB,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 25), 50));
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_project_id IS NOT NULL AND NOT public.is_project_member(p_project_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: You are not a member of this project.';
    END IF;

    RETURN QUERY
    SELECT
        n.id,
        n.user_id,
        n.project_id,
        proj.title AS project_title,
        n.actor_id,
        prof.full_name AS actor_name,
        prof.avatar_url AS actor_avatar_url,
        n.category,
        n.event_type,
        n.priority,
        n.title,
        n.body,
        n.entity_type,
        n.entity_id,
        n.entity_label,
        n.metadata,
        n.read_at,
        n.dismissed_at,
        n.created_at
    FROM public.notifications n
    LEFT JOIN public.projects proj ON proj.id = n.project_id
    LEFT JOIN public.profiles prof ON prof.id = n.actor_id
    WHERE n.user_id = v_user_id
      AND n.dismissed_at IS NULL
      AND (
          n.project_id IS NULL
          OR n.event_type = 'invitation_received'
          OR public.is_project_member(n.project_id, v_user_id)
      )
      AND (
          p_project_id IS NULL
          OR n.project_id = p_project_id
          OR (n.event_type = 'invitation_received')
      )
      AND (
          COALESCE(p_filter, 'all') = 'all'
          OR (p_filter = 'unread' AND n.read_at IS NULL)
          OR (p_filter = 'mentions' AND n.event_type = 'discussion_mention')
      )
      AND (
          p_cursor_created_at IS NULL
          OR (n.created_at, n.id) < (p_cursor_created_at, COALESCE(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_notifications(UUID, TEXT, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_notifications(UUID, TEXT, TIMESTAMPTZ, UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_unread_notification_count(p_project_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT count(*)::INTEGER INTO v_count
    FROM public.notifications n
    WHERE n.user_id = v_user_id
      AND n.dismissed_at IS NULL
      AND n.read_at IS NULL
      AND (
          n.project_id IS NULL
          OR n.event_type = 'invitation_received'
          OR public.is_project_member(n.project_id, v_user_id)
      )
      AND (
          p_project_id IS NULL
          OR n.project_id = p_project_id
          OR n.event_type = 'invitation_received'
      );

    RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_unread_notification_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_unread_notification_count(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    UPDATE public.notifications
    SET read_at = COALESCE(read_at, timezone('utc'::text, now()))
    WHERE id = p_notification_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Notification not found or access denied.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_project_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_updated INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    WITH upd AS (
        UPDATE public.notifications
        SET read_at = timezone('utc'::text, now())
        WHERE user_id = v_user_id
          AND dismissed_at IS NULL
          AND read_at IS NULL
          AND (p_project_id IS NULL OR project_id = p_project_id)
        RETURNING 1
    )
    SELECT count(*)::INTEGER INTO v_updated FROM upd;

    RETURN COALESCE(v_updated, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_notification(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    UPDATE public.notifications
    SET dismissed_at = COALESCE(dismissed_at, timezone('utc'::text, now())),
        read_at = COALESCE(read_at, timezone('utc'::text, now()))
    WHERE id = p_notification_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Notification not found or access denied.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_notification(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_notification(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_notification_preferences()
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_row public.notification_preferences%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    INSERT INTO public.notification_preferences (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_row FROM public.notification_preferences WHERE user_id = v_user_id;
    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_notification_preferences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_notification_preferences() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_notification_preferences(
    p_mentions_enabled BOOLEAN DEFAULT NULL,
    p_discussion_replies_enabled BOOLEAN DEFAULT NULL,
    p_task_assignments_enabled BOOLEAN DEFAULT NULL,
    p_schedule_changes_enabled BOOLEAN DEFAULT NULL,
    p_call_sheets_enabled BOOLEAN DEFAULT NULL,
    p_dpr_reviews_enabled BOOLEAN DEFAULT NULL
)
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_row public.notification_preferences%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    INSERT INTO public.notification_preferences (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.notification_preferences
    SET mentions_enabled = COALESCE(p_mentions_enabled, mentions_enabled),
        discussion_replies_enabled = COALESCE(p_discussion_replies_enabled, discussion_replies_enabled),
        task_assignments_enabled = COALESCE(p_task_assignments_enabled, task_assignments_enabled),
        schedule_changes_enabled = COALESCE(p_schedule_changes_enabled, schedule_changes_enabled),
        call_sheets_enabled = COALESCE(p_call_sheets_enabled, call_sheets_enabled),
        dpr_reviews_enabled = COALESCE(p_dpr_reviews_enabled, dpr_reviews_enabled),
        updated_at = timezone('utc'::text, now())
    WHERE user_id = v_user_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_notification_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_notification_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_activity_feed(
    p_project_id UUID,
    p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
    p_cursor_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    user_id UUID,
    user_full_name TEXT,
    avatar_url TEXT,
    activity_type TEXT,
    title TEXT,
    description TEXT,
    entity_type TEXT,
    entity_id TEXT,
    entity_label TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 25), 50));
BEGIN
    IF v_user_id IS NULL OR NOT public.is_project_member(p_project_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: Project membership required to view activity.';
    END IF;

    RETURN QUERY
    SELECT
        pa.id,
        pa.project_id,
        pa.user_id,
        COALESCE(prof.full_name, 'System Operator') AS user_full_name,
        prof.avatar_url,
        pa.activity_type,
        pa.title,
        pa.description,
        pa.entity_type,
        pa.entity_id,
        pa.entity_label,
        pa.metadata,
        pa.created_at
    FROM public.project_activity pa
    LEFT JOIN public.profiles prof ON prof.id = pa.user_id
    WHERE pa.project_id = p_project_id
      AND (
          p_cursor_created_at IS NULL
          OR (pa.created_at, pa.id) < (p_cursor_created_at, COALESCE(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
    ORDER BY pa.created_at DESC, pa.id DESC
    LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_activity_feed(UUID, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_activity_feed(UUID, TIMESTAMPTZ, UUID, INTEGER) TO authenticated;
