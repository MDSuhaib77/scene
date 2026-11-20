-- ==============================================================================
-- SceneOS Migration 007: Realtime Private Channels, Broadcast Triggers & Security Audit Fixes
-- Target: PostgreSQL 15+ (Supabase Realtime v2 Private Channels)
-- Non-destructive & additive: secures realtime.messages with strict RLS, adds
-- server-side minimal Broadcast triggers via realtime.send(), and hardens
-- search_path on legacy 001 SECURITY DEFINER helpers.
-- ==============================================================================

-- 1. PREREQUISITE & DEPENDENCY READINESS GATE (001 -> 002 -> 003 -> 004 -> 005 -> 006)
DO $$
BEGIN
    IF to_regclass('public.projects') IS NULL
       OR to_regclass('public.project_members') IS NULL
       OR to_regclass('public.project_activity') IS NULL THEN
        RAISE EXCEPTION 'Migration 007 prerequisite failure: 001_initial_foundation objects are missing.';
    END IF;

    IF to_regclass('public.project_invitations') IS NULL THEN
        RAISE EXCEPTION 'Migration 007 prerequisite failure: 002_invitations_and_rbac objects are missing.';
    END IF;

    IF to_regclass('public.project_operational_states') IS NULL THEN
        RAISE EXCEPTION 'Migration 007 prerequisite failure: 003_production_and_operational_state must be applied before 007.';
    END IF;

    IF to_regprocedure('public.effective_project_role(uuid,uuid)') IS NULL THEN
        RAISE EXCEPTION 'Migration 007 prerequisite failure: 004_people_membership_hardening must be applied before 007.';
    END IF;

    IF to_regclass('public.project_threads') IS NULL
       OR to_regclass('public.project_messages') IS NULL
       OR to_regprocedure('public.resolve_discussion_notification_targets(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Migration 007 prerequisite failure: 005_discussions_and_threads must be applied before 007.';
    END IF;

    IF to_regclass('public.notifications') IS NULL
       OR to_regclass('public.notification_preferences') IS NULL
       OR to_regprocedure('public.get_my_notifications(uuid,text,timestamptz,uuid,integer)') IS NULL THEN
        RAISE EXCEPTION 'Migration 007 prerequisite failure: 006_notifications_and_activity must be applied before 007.';
    END IF;
END
$$;

-- 2. FINAL SECURITY AUDIT HARDENING ON LEGACY 001 SECURITY DEFINER FUNCTIONS
ALTER FUNCTION public.is_project_member(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_project_audit_trail() SET search_path = public, pg_temp;

-- 3. REALTIME AUTHORIZATION RLS POLICIES (realtime.messages)
-- Note: RLS is already enabled on realtime.messages by Supabase; never ALTER TABLE realtime.messages.
-- Broadcast INSERT from clients is intentionally omitted so clients cannot spoof server events.
-- Presence INSERT/SELECT is strictly scoped to verified members on project:<uuid>:presence.
DO $$
BEGIN
    IF to_regclass('realtime.messages') IS NOT NULL THEN
        DROP POLICY IF EXISTS "SceneOS members read project collab broadcasts" ON realtime.messages;
        CREATE POLICY "SceneOS members read project collab broadcasts"
        ON realtime.messages
        FOR SELECT
        TO authenticated
        USING (
            extension = 'broadcast'
            AND realtime.topic() ~ '^project:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:collab$'
            AND public.is_project_member(
                split_part(realtime.topic(), ':', 2)::uuid,
                public.current_app_user_id()
            )
        );

        DROP POLICY IF EXISTS "SceneOS users read own notification broadcasts" ON realtime.messages;
        CREATE POLICY "SceneOS users read own notification broadcasts"
        ON realtime.messages
        FOR SELECT
        TO authenticated
        USING (
            extension = 'broadcast'
            AND realtime.topic() ~ '^user:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:notifications$'
            AND split_part(realtime.topic(), ':', 2)::uuid = public.current_app_user_id()
        );

        DROP POLICY IF EXISTS "SceneOS members read project presence" ON realtime.messages;
        CREATE POLICY "SceneOS members read project presence"
        ON realtime.messages
        FOR SELECT
        TO authenticated
        USING (
            extension = 'presence'
            AND realtime.topic() ~ '^project:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:presence$'
            AND public.is_project_member(
                split_part(realtime.topic(), ':', 2)::uuid,
                public.current_app_user_id()
            )
        );

        DROP POLICY IF EXISTS "SceneOS members publish project presence" ON realtime.messages;
        CREATE POLICY "SceneOS members publish project presence"
        ON realtime.messages
        FOR INSERT
        TO authenticated
        WITH CHECK (
            extension = 'presence'
            AND realtime.topic() ~ '^project:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:presence$'
            AND public.is_project_member(
                split_part(realtime.topic(), ':', 2)::uuid,
                public.current_app_user_id()
            )
        );
    END IF;
END
$$;

-- 4. SAFE SERVER-SIDE REALTIME SIGNAL DISPATCHER (MINIMAL PAYLOADS ONLY)
-- Never fails the source database transaction if WebSocket partition is unavailable.
CREATE OR REPLACE FUNCTION public.emit_collab_realtime_signal(
    p_topic TEXT,
    p_event TEXT,
    p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_topic IS NULL OR p_event IS NULL THEN
        RETURN;
    END IF;

    IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
        BEGIN
            PERFORM realtime.send(
                COALESCE(p_payload, '{}'::jsonb),
                p_event,
                p_topic,
                true
            );
        EXCEPTION WHEN OTHERS THEN
            -- Realtime delivery must never roll back persisted operational transactions
            NULL;
        END;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_collab_realtime_signal(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- 5. BROADCAST TRIGGERS ON AUTHORITATIVE TABLES (NO SENSITIVE PAYLOAD DATA)

-- 5.1 Discussions Threads & Messages -> project:<id>:collab
CREATE OR REPLACE FUNCTION public.broadcast_discussion_thread_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.emit_collab_realtime_signal(
        'project:' || NEW.project_id::text || ':collab',
        'discussion_thread',
        jsonb_build_object(
            'scope', 'discussions',
            'thread_id', NEW.id,
            'is_resolved', NEW.is_resolved,
            'ts', timezone('utc'::text, now())
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rt_broadcast_discussion_thread ON public.project_threads;
CREATE TRIGGER trg_rt_broadcast_discussion_thread
AFTER INSERT OR UPDATE OF is_resolved ON public.project_threads
FOR EACH ROW EXECUTE FUNCTION public.broadcast_discussion_thread_signal();

CREATE OR REPLACE FUNCTION public.broadcast_discussion_message_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.emit_collab_realtime_signal(
        'project:' || NEW.project_id::text || ':collab',
        'discussion_message',
        jsonb_build_object(
            'scope', 'discussions',
            'thread_id', NEW.thread_id,
            'message_id', NEW.id,
            'op', TG_OP,
            'ts', timezone('utc'::text, now())
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rt_broadcast_discussion_message ON public.project_messages;
CREATE TRIGGER trg_rt_broadcast_discussion_message
AFTER INSERT OR UPDATE OF body, edited_at, deleted_at ON public.project_messages
FOR EACH ROW EXECUTE FUNCTION public.broadcast_discussion_message_signal();

-- 5.2 Shared Activity Feed -> project:<id>:collab
CREATE OR REPLACE FUNCTION public.broadcast_project_activity_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.emit_collab_realtime_signal(
        'project:' || NEW.project_id::text || ':collab',
        'activity_recorded',
        jsonb_build_object(
            'scope', 'activity',
            'activity_id', NEW.id,
            'activity_type', NEW.activity_type,
            'ts', NEW.created_at
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rt_broadcast_project_activity ON public.project_activity;
CREATE TRIGGER trg_rt_broadcast_project_activity
AFTER INSERT ON public.project_activity
FOR EACH ROW EXECUTE FUNCTION public.broadcast_project_activity_signal();

-- 5.3 Membership Join, Role Change & Revocation -> project:<id>:collab + revoked user's private channel
CREATE OR REPLACE FUNCTION public.broadcast_project_member_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_project_id UUID := COALESCE(NEW.project_id, OLD.project_id);
    v_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
    PERFORM public.emit_collab_realtime_signal(
        'project:' || v_project_id::text || ':collab',
        'membership_changed',
        jsonb_build_object(
            'scope', 'members',
            'op', TG_OP,
            'ts', timezone('utc'::text, now())
        )
    );

    IF TG_OP = 'DELETE' THEN
        PERFORM public.emit_collab_realtime_signal(
            'user:' || v_user_id::text || ':notifications',
            'membership_revoked',
            jsonb_build_object(
                'scope', 'notifications',
                'project_id', v_project_id,
                'ts', timezone('utc'::text, now())
            )
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_rt_broadcast_project_member ON public.project_members;
CREATE TRIGGER trg_rt_broadcast_project_member
AFTER INSERT OR UPDATE OF role OR DELETE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.broadcast_project_member_signal();

-- 5.4 Operational State Updates -> project:<id>:collab
CREATE OR REPLACE FUNCTION public.broadcast_operational_state_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.emit_collab_realtime_signal(
        'project:' || NEW.project_id::text || ':collab',
        'operational_synced',
        jsonb_build_object(
            'scope', 'production',
            'ts', NEW.updated_at
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rt_broadcast_operational_state ON public.project_operational_states;
CREATE TRIGGER trg_rt_broadcast_operational_state
AFTER INSERT OR UPDATE ON public.project_operational_states
FOR EACH ROW EXECUTE FUNCTION public.broadcast_operational_state_signal();

-- 5.5 Personal Notifications -> user:<id>:notifications (isolated strictly to recipient)
CREATE OR REPLACE FUNCTION public.broadcast_personal_notification_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.emit_collab_realtime_signal(
        'user:' || NEW.user_id::text || ':notifications',
        'notification_changed',
        jsonb_build_object(
            'scope', 'notifications',
            'op', TG_OP,
            'event_type', NEW.event_type,
            'project_id', NEW.project_id,
            'ts', timezone('utc'::text, now())
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rt_broadcast_personal_notification ON public.notifications;
CREATE TRIGGER trg_rt_broadcast_personal_notification
AFTER INSERT OR UPDATE OF read_at, dismissed_at, created_at ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.broadcast_personal_notification_signal();
