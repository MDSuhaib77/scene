-- ==============================================================================
-- SceneOS Migration 005: Project & Contextual Discussions (Prompt 03)
-- Target: PostgreSQL 15+ (Supabase)
-- Additive & non-destructive: depends cleanly on Migrations 001–004.
-- ==============================================================================

-- 1. PREREQUISITE DEPENDENCY GATE
DO $$
BEGIN
    IF to_regclass('public.project_operational_states') IS NULL THEN
        RAISE EXCEPTION 'Dependency gate: Migration 003_production_and_operational_state.sql must be applied before 005_discussions_and_threads.sql.';
    END IF;
    IF to_regprocedure('public.effective_project_role(uuid,uuid)') IS NULL
       OR to_regprocedure('public.is_project_member(uuid,uuid)') IS NULL THEN
        RAISE EXCEPTION 'Dependency gate: Migration 004_people_membership_hardening.sql must be applied before 005_discussions_and_threads.sql.';
    END IF;
END $$;

-- 2. DISCUSSIONS TABLES

CREATE TABLE IF NOT EXISTS public.project_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('project', 'record')),
    entity_type TEXT NULL,
    entity_id TEXT NULL,
    entity_label TEXT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 180),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    resolved_at TIMESTAMPTZ NULL,
    resolved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT valid_thread_scope CHECK (
        (scope = 'project' AND entity_type IS NULL AND entity_id IS NULL)
        OR (
            scope = 'record'
            AND entity_type IN (
                'shooting_day',
                'production_event',
                'call_sheet',
                'dpr',
                'directory_entry',
                'board',
                'storyboard_panel',
                'shot'
            )
            AND entity_id IS NOT NULL
            AND char_length(trim(entity_id)) > 0
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_threads_unique_record
    ON public.project_threads (project_id, entity_type, entity_id)
    WHERE scope = 'record';

CREATE INDEX IF NOT EXISTS idx_project_threads_project_recent
    ON public.project_threads (project_id, last_message_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.project_threads(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    parent_message_id UUID NULL REFERENCES public.project_messages(id) ON DELETE SET NULL,
    body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000),
    mention_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    client_request_id TEXT NULL,
    edited_at TIMESTAMPTZ NULL,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_project_messages_thread_page
    ON public.project_messages (thread_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_project_messages_project
    ON public.project_messages (project_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_messages_idempotency
    ON public.project_messages (thread_id, author_id, client_request_id)
    WHERE client_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.project_thread_reads (
    thread_id UUID NOT NULL REFERENCES public.project_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_thread_reads_user_project
    ON public.project_thread_reads (user_id, project_id);

-- 3. DISCUSSION PERMISSION HELPERS

CREATE OR REPLACE FUNCTION public.can_post_discussion(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_role public.project_role;
    v_denied BOOLEAN;
BEGIN
    IF p_project_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF current_user IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM public.current_app_user_id() THEN
        RETURN FALSE;
    END IF;

    v_role := public.effective_project_role(p_project_id, p_user_id);
    IF v_role IS NULL OR v_role = 'viewer'::public.project_role THEN
        RETURN FALSE;
    END IF;

    -- Honor optional per-member custom_permissions deny override if present
    SELECT (pm.custom_permissions ->> 'discussions:post') = 'false'
    INTO v_denied
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id
    LIMIT 1;

    RETURN NOT COALESCE(v_denied, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.can_post_discussion(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_post_discussion(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_moderate_discussion(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_role public.project_role;
BEGIN
    IF p_project_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF current_user IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM public.current_app_user_id() THEN
        RETURN FALSE;
    END IF;

    v_role := public.effective_project_role(p_project_id, p_user_id);
    RETURN v_role IN ('owner'::public.project_role, 'producer'::public.project_role);
END;
$$;

REVOKE ALL ON FUNCTION public.can_moderate_discussion(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_moderate_discussion(UUID, UUID) TO authenticated;

-- 4. DATA INTEGRITY & THREAD SYNC TRIGGERS

CREATE OR REPLACE FUNCTION public.enforce_project_message_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_thread_project_id UUID;
    v_parent_thread_id UUID;
    v_parent_project_id UUID;
    v_uid UUID;
    v_dedup UUID[];
    v_actor_id UUID;
BEGIN
    v_actor_id := public.current_app_user_id();

    IF TG_OP = 'INSERT' THEN
        SELECT project_id INTO v_thread_project_id
        FROM public.project_threads
        WHERE id = NEW.thread_id;

        IF v_thread_project_id IS NULL THEN
            RAISE EXCEPTION 'Discussion thread not found.';
        END IF;

        IF NEW.project_id IS DISTINCT FROM v_thread_project_id THEN
            RAISE EXCEPTION '[cross_project] Message project_id does not match thread project.';
        END IF;

        IF NEW.parent_message_id IS NOT NULL THEN
            SELECT thread_id, project_id
            INTO v_parent_thread_id, v_parent_project_id
            FROM public.project_messages
            WHERE id = NEW.parent_message_id;

            IF v_parent_thread_id IS NULL OR v_parent_thread_id IS DISTINCT FROM NEW.thread_id OR v_parent_project_id IS DISTINCT FROM NEW.project_id THEN
                RAISE EXCEPTION '[cross_thread] Parent message must belong to the same thread and project.';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.thread_id IS DISTINCT FROM OLD.thread_id
           OR NEW.project_id IS DISTINCT FROM OLD.project_id
           OR NEW.author_id IS DISTINCT FROM OLD.author_id
           OR NEW.parent_message_id IS DISTINCT FROM OLD.parent_message_id
           OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Message identity and thread association cannot be altered.';
        END IF;

        IF OLD.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION 'Deleted messages cannot be edited.';
        END IF;

        -- Only author can edit body; author OR Owner/Producer moderator can soft-delete.
        IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
            IF v_actor_id IS NOT NULL
               AND v_actor_id IS DISTINCT FROM OLD.author_id
               AND NOT public.can_moderate_discussion(OLD.project_id, v_actor_id) THEN
                RAISE EXCEPTION 'Unauthorized: Only the author or a project Owner/Producer may delete this message.';
            END IF;
        ELSIF NEW.body IS DISTINCT FROM OLD.body OR NEW.mention_user_ids IS DISTINCT FROM OLD.mention_user_ids THEN
            IF v_actor_id IS NOT NULL AND v_actor_id IS DISTINCT FROM OLD.author_id THEN
                RAISE EXCEPTION 'Unauthorized: Only the message author may edit message content.';
            END IF;
        END IF;
    END IF;

    -- Validate & deduplicate mentions against actual project membership
    v_dedup := '{}'::uuid[];
    IF NEW.mention_user_ids IS NOT NULL AND array_length(NEW.mention_user_ids, 1) IS NOT NULL THEN
        FOREACH v_uid IN ARRAY NEW.mention_user_ids LOOP
            IF v_uid IS NULL THEN
                CONTINUE;
            END IF;
            IF NOT public.is_project_member(NEW.project_id, v_uid) THEN
                RAISE EXCEPTION '[invalid_mention] Mention target % is not a member of this project.', v_uid;
            END IF;
            IF NOT (v_uid = ANY(v_dedup)) THEN
                v_dedup := array_append(v_dedup, v_uid);
            END IF;
        END LOOP;
    END IF;
    NEW.mention_user_ids := v_dedup;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_message_integrity ON public.project_messages;
CREATE TRIGGER trg_enforce_project_message_integrity
BEFORE INSERT OR UPDATE ON public.project_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_message_integrity();

CREATE OR REPLACE FUNCTION public.sync_thread_activity_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.project_threads
        SET last_message_at = GREATEST(last_message_at, NEW.created_at),
            message_count = message_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.thread_id;

        INSERT INTO public.project_thread_reads (thread_id, user_id, project_id, last_read_at)
        VALUES (NEW.thread_id, NEW.author_id, NEW.project_id, NEW.created_at)
        ON CONFLICT (thread_id, user_id) DO UPDATE
        SET last_read_at = GREATEST(public.project_thread_reads.last_read_at, EXCLUDED.last_read_at);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_thread_activity_on_message ON public.project_messages;
CREATE TRIGGER trg_sync_thread_activity_on_message
AFTER INSERT ON public.project_messages
FOR EACH ROW EXECUTE FUNCTION public.sync_thread_activity_on_message();

-- Notification event foundation for Prompt 04 (no notifications table created in Prompt 03).
-- Resolves deduplicated notification targets in priority order: mention > thread_reply > project_thread_new.
CREATE OR REPLACE FUNCTION public.resolve_discussion_notification_targets(p_message_id UUID)
RETURNS TABLE (
    recipient_user_id UUID,
    event_kind TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_msg public.project_messages%ROWTYPE;
    v_thread public.project_threads%ROWTYPE;
    v_author_role public.project_role;
    v_prior_count INTEGER;
BEGIN
    SELECT * INTO v_msg FROM public.project_messages WHERE id = p_message_id;
    IF NOT FOUND OR v_msg.deleted_at IS NOT NULL THEN
        RETURN;
    END IF;

    SELECT * INTO v_thread FROM public.project_threads WHERE id = v_msg.thread_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_author_role := public.effective_project_role(v_msg.project_id, v_msg.author_id);

    SELECT count(*) INTO v_prior_count
    FROM public.project_messages m
    WHERE m.thread_id = v_msg.thread_id
      AND m.id <> v_msg.id
      AND m.created_at <= v_msg.created_at;

    RETURN QUERY
    WITH project_roster AS (
        SELECT pm.user_id
        FROM public.project_members pm
        WHERE pm.project_id = v_msg.project_id
        UNION
        SELECT p.owner_id AS user_id
        FROM public.projects p
        WHERE p.id = v_msg.project_id
    ),
    mentioned AS (
        SELECT DISTINCT u.uid AS recipient_user_id, 'mention'::TEXT AS event_kind, 1 AS prio
        FROM unnest(v_msg.mention_user_ids) AS u(uid)
        WHERE u.uid <> v_msg.author_id
          AND public.is_project_member(v_msg.project_id, u.uid)
    ),
    participants AS (
        SELECT DISTINCT participant_id AS recipient_user_id, 'thread_reply'::TEXT AS event_kind, 2 AS prio
        FROM (
            SELECT v_thread.created_by AS participant_id
            UNION
            SELECT m.author_id AS participant_id
            FROM public.project_messages m
            WHERE m.thread_id = v_msg.thread_id
              AND m.deleted_at IS NULL
              AND m.id <> v_msg.id
        ) raw_p
        WHERE participant_id <> v_msg.author_id
          AND public.is_project_member(v_msg.project_id, participant_id)
    ),
    project_announcement AS (
        SELECT pr.user_id AS recipient_user_id, 'project_thread_new'::TEXT AS event_kind, 3 AS prio
        FROM project_roster pr
        WHERE v_thread.scope = 'project'
          AND v_prior_count = 0
          AND v_author_role IN ('owner', 'producer', 'director', 'first_ad')
          AND pr.user_id <> v_msg.author_id
    ),
    combined AS (
        SELECT * FROM mentioned
        UNION ALL
        SELECT * FROM participants
        UNION ALL
        SELECT * FROM project_announcement
    ),
    ranked AS (
        SELECT DISTINCT ON (c.recipient_user_id)
            c.recipient_user_id,
            c.event_kind
        FROM combined c
        ORDER BY c.recipient_user_id, c.prio ASC
    )
    SELECT r.recipient_user_id, r.event_kind FROM ranked r;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_discussion_notification_targets(UUID) FROM PUBLIC, anon, authenticated;

-- 5. ROW-LEVEL SECURITY POLICIES

ALTER TABLE public.project_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_thread_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Threads readable by project members" ON public.project_threads;
CREATE POLICY "Threads readable by project members"
ON public.project_threads FOR SELECT
TO authenticated
USING (public.is_project_member(project_id, public.current_app_user_id()));

DROP POLICY IF EXISTS "Threads creatable by posting members" ON public.project_threads;
CREATE POLICY "Threads creatable by posting members"
ON public.project_threads FOR INSERT
TO authenticated
WITH CHECK (
    created_by = public.current_app_user_id()
    AND public.can_post_discussion(project_id, public.current_app_user_id())
);

DROP POLICY IF EXISTS "Threads updatable by creator or moderators" ON public.project_threads;
CREATE POLICY "Threads updatable by creator or moderators"
ON public.project_threads FOR UPDATE
TO authenticated
USING (
    (created_by = public.current_app_user_id() AND public.can_post_discussion(project_id, public.current_app_user_id()))
    OR public.can_moderate_discussion(project_id, public.current_app_user_id())
)
WITH CHECK (
    (created_by = public.current_app_user_id() AND public.can_post_discussion(project_id, public.current_app_user_id()))
    OR public.can_moderate_discussion(project_id, public.current_app_user_id())
);

DROP POLICY IF EXISTS "Messages readable by project members" ON public.project_messages;
CREATE POLICY "Messages readable by project members"
ON public.project_messages FOR SELECT
TO authenticated
USING (public.is_project_member(project_id, public.current_app_user_id()));

DROP POLICY IF EXISTS "Messages insertable by posting members" ON public.project_messages;
CREATE POLICY "Messages insertable by posting members"
ON public.project_messages FOR INSERT
TO authenticated
WITH CHECK (
    author_id = public.current_app_user_id()
    AND public.can_post_discussion(project_id, public.current_app_user_id())
);

DROP POLICY IF EXISTS "Messages updatable by author or moderators" ON public.project_messages;
CREATE POLICY "Messages updatable by author or moderators"
ON public.project_messages FOR UPDATE
TO authenticated
USING (
    (author_id = public.current_app_user_id() AND public.can_post_discussion(project_id, public.current_app_user_id()))
    OR public.can_moderate_discussion(project_id, public.current_app_user_id())
)
WITH CHECK (
    (author_id = public.current_app_user_id() AND public.can_post_discussion(project_id, public.current_app_user_id()))
    OR public.can_moderate_discussion(project_id, public.current_app_user_id())
);

DROP POLICY IF EXISTS "Thread read cursors manageable by owner" ON public.project_thread_reads;
CREATE POLICY "Thread read cursors manageable by owner"
ON public.project_thread_reads FOR ALL
TO authenticated
USING (
    user_id = public.current_app_user_id()
    AND public.is_project_member(project_id, public.current_app_user_id())
)
WITH CHECK (
    user_id = public.current_app_user_id()
    AND public.is_project_member(project_id, public.current_app_user_id())
);

-- 6. AUTHORITATIVE DISCUSSION RPCs

CREATE OR REPLACE FUNCTION public.get_project_threads(
    p_project_id UUID,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    scope TEXT,
    entity_type TEXT,
    entity_id TEXT,
    entity_label TEXT,
    title TEXT,
    created_by UUID,
    creator_name TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    last_message_at TIMESTAMPTZ,
    message_count INTEGER,
    created_at TIMESTAMPTZ,
    unread_count BIGINT,
    latest_preview TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := public.current_app_user_id();
    IF v_user_id IS NULL OR NOT public.is_project_member(p_project_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: You are not a member of this project.';
    END IF;

    RETURN QUERY
    SELECT
        t.id,
        t.project_id,
        t.scope,
        t.entity_type,
        t.entity_id,
        t.entity_label,
        t.title,
        t.created_by,
        COALESCE(NULLIF(pr.full_name, ''), NULLIF(split_part(pr.email, '@', 1), ''), 'Member') AS creator_name,
        t.resolved_at,
        t.resolved_by,
        t.last_message_at,
        t.message_count,
        t.created_at,
        (
            SELECT count(*)
            FROM public.project_messages m
            WHERE m.thread_id = t.id
              AND m.deleted_at IS NULL
              AND m.author_id <> v_user_id
              AND m.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)
        ) AS unread_count,
        (
            SELECT CASE WHEN m.deleted_at IS NOT NULL THEN '[Message removed]' ELSE left(m.body, 140) END
            FROM public.project_messages m
            WHERE m.thread_id = t.id
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 1
        ) AS latest_preview
    FROM public.project_threads t
    LEFT JOIN public.profiles pr ON pr.id = t.created_by
    LEFT JOIN public.project_thread_reads r ON r.thread_id = t.id AND r.user_id = v_user_id
    WHERE t.project_id = p_project_id
      AND (p_entity_type IS NULL OR t.entity_type = p_entity_type)
      AND (p_entity_id IS NULL OR t.entity_id = p_entity_id)
    ORDER BY (t.scope = 'project') DESC, t.last_message_at DESC, t.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_threads(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_threads(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_project_discussion_thread(
    p_project_id UUID,
    p_scope TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id TEXT DEFAULT NULL,
    p_entity_label TEXT DEFAULT NULL,
    p_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_existing_id UUID;
    v_new_id UUID;
    v_clean_title TEXT;
BEGIN
    v_user_id := public.current_app_user_id();
    IF v_user_id IS NULL OR NOT public.is_project_member(p_project_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: Project membership required.';
    END IF;

    IF p_scope = 'project' THEN
        SELECT t.id INTO v_existing_id
        FROM public.project_threads t
        WHERE t.project_id = p_project_id
          AND t.scope = 'project'
        ORDER BY t.created_at ASC
        LIMIT 1;

        IF v_existing_id IS NOT NULL AND p_title IS NULL THEN
            RETURN v_existing_id;
        END IF;

        IF NOT public.can_post_discussion(p_project_id, v_user_id) THEN
            RAISE EXCEPTION 'Unauthorized: Your role has read-only discussion access.';
        END IF;

        v_clean_title := COALESCE(NULLIF(trim(COALESCE(p_title, '')), ''), 'Project Discussion');

        INSERT INTO public.project_threads (
            project_id, scope, entity_type, entity_id, entity_label, title, created_by
        ) VALUES (
            p_project_id, 'project', NULL, NULL, NULL, left(v_clean_title, 180), v_user_id
        )
        RETURNING id INTO v_new_id;

        RETURN v_new_id;
    ELSIF p_scope = 'record' THEN
        SELECT t.id INTO v_existing_id
        FROM public.project_threads t
        WHERE t.project_id = p_project_id
          AND t.scope = 'record'
          AND t.entity_type = p_entity_type
          AND t.entity_id = p_entity_id
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;

        IF NOT public.can_post_discussion(p_project_id, v_user_id) THEN
            RAISE EXCEPTION 'Unauthorized: Your role has read-only discussion access.';
        END IF;

        v_clean_title := COALESCE(
            NULLIF(trim(COALESCE(p_title, '')), ''),
            NULLIF(trim(COALESCE(p_entity_label, '')), ''),
            p_entity_type
        );

        INSERT INTO public.project_threads (
            project_id, scope, entity_type, entity_id, entity_label, title, created_by
        ) VALUES (
            p_project_id,
            'record',
            p_entity_type,
            p_entity_id,
            NULLIF(left(trim(COALESCE(p_entity_label, '')), 180), ''),
            left(v_clean_title, 180),
            v_user_id
        )
        ON CONFLICT (project_id, entity_type, entity_id) WHERE scope = 'record'
        DO UPDATE SET updated_at = timezone('utc'::text, now())
        RETURNING id INTO v_new_id;

        RETURN v_new_id;
    ELSE
        RAISE EXCEPTION 'Invalid discussion scope: %', p_scope;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_project_discussion_thread(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_project_discussion_thread(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_thread_messages(
    p_thread_id UUID,
    p_before TIMESTAMPTZ DEFAULT NULL,
    p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (
    id UUID,
    thread_id UUID,
    project_id UUID,
    author_id UUID,
    author_name TEXT,
    author_avatar_url TEXT,
    author_role public.project_role,
    parent_message_id UUID,
    body TEXT,
    mention_user_ids UUID[],
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_project_id UUID;
    v_safe_limit INTEGER;
BEGIN
    v_user_id := public.current_app_user_id();
    SELECT t.project_id INTO v_project_id FROM public.project_threads t WHERE t.id = p_thread_id;

    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'Discussion thread not found.';
    END IF;

    IF v_user_id IS NULL OR NOT public.is_project_member(v_project_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied: You are not a member of this project.';
    END IF;

    v_safe_limit := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);

    RETURN QUERY
    SELECT
        m.id,
        m.thread_id,
        m.project_id,
        m.author_id,
        COALESCE(NULLIF(pr.full_name, ''), NULLIF(split_part(pr.email, '@', 1), ''), 'Member') AS author_name,
        pr.avatar_url AS author_avatar_url,
        public.effective_project_role(m.project_id, m.author_id) AS author_role,
        m.parent_message_id,
        CASE WHEN m.deleted_at IS NOT NULL THEN '[Message removed]' ELSE m.body END AS body,
        CASE WHEN m.deleted_at IS NOT NULL THEN '{}'::uuid[] ELSE m.mention_user_ids END AS mention_user_ids,
        m.edited_at,
        m.deleted_at,
        m.created_at
    FROM public.project_messages m
    LEFT JOIN public.profiles pr ON pr.id = m.author_id
    WHERE m.thread_id = p_thread_id
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT v_safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_thread_messages(UUID, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_thread_messages(UUID, TIMESTAMPTZ, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_discussion_message(
    p_thread_id UUID,
    p_body TEXT,
    p_parent_message_id UUID DEFAULT NULL,
    p_mention_user_ids UUID[] DEFAULT '{}'::uuid[],
    p_client_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_project_id UUID;
    v_existing public.project_messages%ROWTYPE;
    v_inserted public.project_messages%ROWTYPE;
    v_clean_req TEXT;
BEGIN
    v_user_id := public.current_app_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '[unauthenticated] Authentication required.';
    END IF;

    SELECT project_id INTO v_project_id FROM public.project_threads WHERE id = p_thread_id;
    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'Discussion thread not found.';
    END IF;

    IF NOT public.can_post_discussion(v_project_id, v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: Your project role does not permit posting discussions.';
    END IF;

    v_clean_req := NULLIF(trim(COALESCE(p_client_request_id, '')), '');
    IF v_clean_req IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.project_messages
        WHERE thread_id = p_thread_id
          AND author_id = v_user_id
          AND client_request_id = v_clean_req
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'id', v_existing.id,
                'thread_id', v_existing.thread_id,
                'project_id', v_existing.project_id,
                'author_id', v_existing.author_id,
                'parent_message_id', v_existing.parent_message_id,
                'body', v_existing.body,
                'mention_user_ids', v_existing.mention_user_ids,
                'edited_at', v_existing.edited_at,
                'deleted_at', v_existing.deleted_at,
                'created_at', v_existing.created_at,
                'deduplicated', true
            );
        END IF;
    END IF;

    INSERT INTO public.project_messages (
        thread_id,
        project_id,
        author_id,
        parent_message_id,
        body,
        mention_user_ids,
        client_request_id
    ) VALUES (
        p_thread_id,
        v_project_id,
        v_user_id,
        p_parent_message_id,
        trim(COALESCE(p_body, '')),
        COALESCE(p_mention_user_ids, '{}'::uuid[]),
        v_clean_req
    )
    RETURNING * INTO v_inserted;

    RETURN jsonb_build_object(
        'id', v_inserted.id,
        'thread_id', v_inserted.thread_id,
        'project_id', v_inserted.project_id,
        'author_id', v_inserted.author_id,
        'parent_message_id', v_inserted.parent_message_id,
        'body', v_inserted.body,
        'mention_user_ids', v_inserted.mention_user_ids,
        'edited_at', v_inserted.edited_at,
        'deleted_at', v_inserted.deleted_at,
        'created_at', v_inserted.created_at,
        'deduplicated', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.post_discussion_message(UUID, TEXT, UUID, UUID[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_discussion_message(UUID, TEXT, UUID, UUID[], TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.edit_discussion_message(
    p_message_id UUID,
    p_body TEXT,
    p_mention_user_ids UUID[] DEFAULT '{}'::uuid[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_msg public.project_messages%ROWTYPE;
BEGIN
    v_user_id := public.current_app_user_id();
    SELECT * INTO v_msg FROM public.project_messages WHERE id = p_message_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found.';
    END IF;

    IF v_user_id IS DISTINCT FROM v_msg.author_id OR NOT public.can_post_discussion(v_msg.project_id, v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only the message author may edit this message.';
    END IF;

    UPDATE public.project_messages
    SET body = trim(COALESCE(p_body, '')),
        mention_user_ids = COALESCE(p_mention_user_ids, '{}'::uuid[]),
        edited_at = timezone('utc'::text, now())
    WHERE id = p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_discussion_message(UUID, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_discussion_message(UUID, TEXT, UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_discussion_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_msg public.project_messages%ROWTYPE;
BEGIN
    v_user_id := public.current_app_user_id();
    SELECT * INTO v_msg FROM public.project_messages WHERE id = p_message_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found.';
    END IF;

    IF NOT (
        (v_user_id = v_msg.author_id AND public.can_post_discussion(v_msg.project_id, v_user_id))
        OR public.can_moderate_discussion(v_msg.project_id, v_user_id)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the author or an Owner/Producer may remove this message.';
    END IF;

    UPDATE public.project_messages
    SET deleted_at = timezone('utc'::text, now()),
        deleted_by = v_user_id
    WHERE id = p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_discussion_message(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_discussion_message(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_discussion_thread_resolved(
    p_thread_id UUID,
    p_resolved BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_thread public.project_threads%ROWTYPE;
BEGIN
    v_user_id := public.current_app_user_id();
    SELECT * INTO v_thread FROM public.project_threads WHERE id = p_thread_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Discussion thread not found.';
    END IF;

    IF NOT (
        (v_user_id = v_thread.created_by AND public.can_post_discussion(v_thread.project_id, v_user_id))
        OR public.can_moderate_discussion(v_thread.project_id, v_user_id)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only the thread starter or an Owner/Producer may change thread status.';
    END IF;

    UPDATE public.project_threads
    SET resolved_at = CASE WHEN p_resolved THEN timezone('utc'::text, now()) ELSE NULL END,
        resolved_by = CASE WHEN p_resolved THEN v_user_id ELSE NULL END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_discussion_thread_resolved(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_discussion_thread_resolved(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_discussion_thread_read(p_thread_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_project_id UUID;
BEGIN
    v_user_id := public.current_app_user_id();
    SELECT project_id INTO v_project_id FROM public.project_threads WHERE id = p_thread_id;
    IF v_project_id IS NULL THEN
        RETURN;
    END IF;

    IF v_user_id IS NULL OR NOT public.is_project_member(v_project_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    INSERT INTO public.project_thread_reads (thread_id, user_id, project_id, last_read_at)
    VALUES (p_thread_id, v_user_id, v_project_id, timezone('utc'::text, now()))
    ON CONFLICT (thread_id, user_id) DO UPDATE
    SET last_read_at = timezone('utc'::text, now());
END;
$$;

REVOKE ALL ON FUNCTION public.mark_discussion_thread_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_discussion_thread_read(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_discussion_unread_count(p_project_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_cnt INTEGER;
BEGIN
    v_user_id := public.current_app_user_id();
    IF v_user_id IS NULL OR NOT public.is_project_member(p_project_id, v_user_id) THEN
        RETURN 0;
    END IF;

    SELECT count(*)::INTEGER INTO v_cnt
    FROM public.project_threads t
    LEFT JOIN public.project_thread_reads r
        ON r.thread_id = t.id AND r.user_id = v_user_id
    WHERE t.project_id = p_project_id
      AND EXISTS (
          SELECT 1
          FROM public.project_messages m
          WHERE m.thread_id = t.id
            AND m.deleted_at IS NULL
            AND m.author_id <> v_user_id
            AND m.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)
      );

    RETURN COALESCE(v_cnt, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_discussion_unread_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_discussion_unread_count(UUID) TO authenticated;
