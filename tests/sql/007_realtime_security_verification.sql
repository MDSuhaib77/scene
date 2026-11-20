-- ==============================================================================
-- SceneOS SQL Verification Suite: Migration 007 (Realtime Authorization & Hardening)
-- Safe to run against staging/local Postgres: wraps everything in ROLLBACK.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_owner_id UUID := '11111111-1111-1111-1111-111111111201';
    v_member_id UUID := '11111111-1111-1111-1111-111111111202';
    v_proj_id UUID := '22222222-2222-2222-2222-222222222209';
    v_thread_id UUID;
    v_cfg TEXT[];
    v_pol_count INTEGER;
BEGIN
    -- 1. Verify legacy 001 functions now enforce fixed search_path = public, pg_temp
    SELECT proconfig INTO v_cfg
    FROM pg_proc
    WHERE oid = 'public.is_project_member(uuid,uuid)'::regprocedure;
    IF v_cfg IS NULL OR NOT ('search_path=public, pg_temp' = ANY(v_cfg)) THEN
        RAISE EXCEPTION 'Assertion failed: is_project_member missing hardened search_path';
    END IF;

    SELECT proconfig INTO v_cfg
    FROM pg_proc
    WHERE oid = 'public.log_project_audit_trail()'::regprocedure;
    IF v_cfg IS NULL OR NOT ('search_path=public, pg_temp' = ANY(v_cfg)) THEN
        RAISE EXCEPTION 'Assertion failed: log_project_audit_trail missing hardened search_path';
    END IF;

    -- 2. Verify Realtime trigger dispatcher & policies when realtime.messages is available
    IF to_regclass('realtime.messages') IS NOT NULL THEN
        SELECT count(*) INTO v_pol_count
        FROM pg_policies
        WHERE schemaname = 'realtime'
          AND tablename = 'messages'
          AND policyname IN (
              'SceneOS members read project collab broadcasts',
              'SceneOS users read own notification broadcasts',
              'SceneOS members read project presence',
              'SceneOS members publish project presence'
          );
        IF v_pol_count <> 4 THEN
            RAISE EXCEPTION 'Assertion failed: expected 4 SceneOS realtime.messages RLS policies, found %', v_pol_count;
        END IF;

        -- Ensure NO client INSERT policy grants broadcast injection
        SELECT count(*) INTO v_pol_count
        FROM pg_policies
        WHERE schemaname = 'realtime'
          AND tablename = 'messages'
          AND cmd = 'INSERT'
          AND policyname LIKE 'SceneOS%'
          AND policyname NOT LIKE '%presence%';
        IF v_pol_count <> 0 THEN
            RAISE EXCEPTION 'Assertion failed: unexpected client INSERT policy on broadcast channel';
        END IF;
    END IF;

    -- 3. Verify triggers run safely without aborting transactions when messages/members/notifications mutate
    INSERT INTO public.profiles (id, email, full_name) VALUES
        (v_owner_id, 'rt-owner@sceneos.test', 'RT Owner'),
        (v_member_id, 'rt-member@sceneos.test', 'RT Member')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.projects (id, title, owner_id, status) VALUES
        (v_proj_id, 'Realtime Audit Film', v_owner_id, 'pre-production')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.project_members (project_id, user_id, role) VALUES
        (v_proj_id, v_member_id, 'producer')
    ON CONFLICT (project_id, user_id) DO NOTHING;

    PERFORM set_config('app.current_user_id', v_owner_id::TEXT, true);
    v_thread_id := public.ensure_project_discussion_thread(v_proj_id, 'RT Thread');
    PERFORM public.post_discussion_message(
        v_thread_id,
        'Testing @RT Member realtime signal safety',
        NULL,
        ARRAY[v_member_id],
        'rt-req-1'
    );

    -- Delete member -> tests trg_rt_broadcast_project_member DELETE path safely
    DELETE FROM public.project_members
    WHERE project_id = v_proj_id AND user_id = v_member_id;
END
$$;

ROLLBACK;
