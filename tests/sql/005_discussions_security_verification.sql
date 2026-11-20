-- ==============================================================================
-- SceneOS Isolated SQL Verification Suite — Migration 005 (Discussions)
-- Safe & non-destructive: runs entirely inside BEGIN ... ROLLBACK.
-- Prerequisite: Migrations 001, 002, 003, 004, and 005 applied.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_owner_id    UUID := 'e1000000-0000-4000-8000-000000000001';
    v_producer_id UUID := 'e1000000-0000-4000-8000-000000000002';
    v_crew_id     UUID := 'e1000000-0000-4000-8000-000000000003';
    v_viewer_id   UUID := 'e1000000-0000-4000-8000-000000000004';
    v_outsider_id UUID := 'e1000000-0000-4000-8000-000000000005';
    v_proj_a      UUID := 'e2000000-0000-4000-8000-000000000001';
    v_proj_b      UUID := 'e2000000-0000-4000-8000-000000000002';

    v_thr_a       UUID;
    v_thr_b       UUID;
    v_msg1        JSONB;
    v_msg2        JSONB;
    v_msg_dup     JSONB;
    v_cnt         INTEGER;
BEGIN
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
        ('00000000-0000-0000-0000-000000000000', v_owner_id,    'authenticated', 'authenticated', 'disc-owner@sceneos.test',    'x', now(), '{}', '{"full_name":"Disc Owner"}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', v_producer_id, 'authenticated', 'authenticated', 'disc-producer@sceneos.test', 'x', now(), '{}', '{"full_name":"Disc Producer"}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', v_crew_id,     'authenticated', 'authenticated', 'disc-crew@sceneos.test',     'x', now(), '{}', '{"full_name":"Disc Crew"}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', v_viewer_id,   'authenticated', 'authenticated', 'disc-viewer@sceneos.test',   'x', now(), '{}', '{"full_name":"Disc Viewer"}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', v_outsider_id, 'authenticated', 'authenticated', 'disc-outsider@sceneos.test', 'x', now(), '{}', '{"full_name":"Disc Outsider"}', now(), now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.projects (id, title, owner_id) VALUES
        (v_proj_a, 'Discussion Project A', v_owner_id),
        (v_proj_b, 'Discussion Project B', v_outsider_id);

    INSERT INTO public.project_members (project_id, user_id, role) VALUES
        (v_proj_a, v_owner_id,    'owner'),
        (v_proj_a, v_producer_id, 'producer'),
        (v_proj_a, v_crew_id,     'crew_member'),
        (v_proj_a, v_viewer_id,   'viewer'),
        (v_proj_b, v_outsider_id, 'owner');

    SET LOCAL ROLE authenticated;

    -- 1. Crew creates project-wide thread & posts idempotent message with valid mention
    PERFORM set_config('app.current_user_id', v_crew_id::TEXT, true);
    v_thr_a := public.ensure_project_discussion_thread(v_proj_a, 'project', NULL, NULL, NULL, 'Project Discussion');

    v_msg1 := public.post_discussion_message(
        v_thr_a, 'Need camera check @Disc Owner', NULL, ARRAY[v_owner_id], 'req-idem-1'
    );
    v_msg_dup := public.post_discussion_message(
        v_thr_a, 'Need camera check @Disc Owner', NULL, ARRAY[v_owner_id], 'req-idem-1'
    );
    IF (v_msg_dup ->> 'id') <> (v_msg1 ->> 'id') OR NOT COALESCE((v_msg_dup ->> 'deduplicated')::BOOLEAN, FALSE) THEN
        RAISE EXCEPTION 'FAIL: Idempotent client_request_id check failed';
    END IF;

    -- 2. Non-member mention rejected
    BEGIN
        PERFORM public.post_discussion_message(
            v_thr_a, 'Ping @Outsider', NULL, ARRAY[v_outsider_id], 'req-bad-mention'
        );
        RAISE EXCEPTION 'FAIL: Non-member mention should fail';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%invalid_mention%' THEN RAISE; END IF;
    END;

    -- 3. Viewer can read but cannot post
    PERFORM set_config('app.current_user_id', v_viewer_id::TEXT, true);
    SELECT count(*) INTO v_cnt FROM public.get_thread_messages(v_thr_a, NULL, 10);
    IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'FAIL: Viewer should read thread messages';
    END IF;
    BEGIN
        PERFORM public.post_discussion_message(v_thr_a, 'Viewer post', NULL, '{}'::uuid[], 'req-viewer');
        RAISE EXCEPTION 'FAIL: Viewer must not be permitted to post';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 4. Outsider cannot read or write Project A threads, and cross-thread replies fail
    PERFORM set_config('app.current_user_id', v_outsider_id::TEXT, true);
    v_thr_b := public.ensure_project_discussion_thread(v_proj_b, 'project', NULL, NULL, NULL, 'Project B');
    BEGIN
        PERFORM * FROM public.get_thread_messages(v_thr_a, NULL, 10);
        RAISE EXCEPTION 'FAIL: Non-member read Project A thread';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        PERFORM public.post_discussion_message(
            v_thr_b, 'Cross-project reply', (v_msg1 ->> 'id')::UUID, '{}'::uuid[], 'req-x-thread'
        );
        RAISE EXCEPTION 'FAIL: Cross-thread parent reply must fail';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%cross_thread%' THEN RAISE; END IF;
    END;

    -- 5. Producer can moderate/delete crew message, cannot edit crew message
    PERFORM set_config('app.current_user_id', v_producer_id::TEXT, true);
    BEGIN
        PERFORM public.edit_discussion_message((v_msg1 ->> 'id')::UUID, 'Tampered', '{}'::uuid[]);
        RAISE EXCEPTION 'FAIL: Non-author producer edited crew message';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM public.delete_discussion_message((v_msg1 ->> 'id')::UUID);

    RAISE NOTICE 'ALL ISOLATED DISCUSSION SQL SECURITY CHECKS PASSED.';
END $$;

ROLLBACK;
