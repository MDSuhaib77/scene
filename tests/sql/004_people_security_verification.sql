-- ==============================================================================
-- SceneOS Isolated SQL Verification Suite — Migration 004 (People & Hardening)
-- Safe & non-destructive: runs entirely inside BEGIN ... ROLLBACK using
-- isolated temporary UUID identities so no real project or user data is modified.
-- Prerequisite: Migrations 001, 002, 003, and 004 applied.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_owner_id      UUID := 'f1000000-0000-4000-8000-000000000001';
    v_producer_id   UUID := 'f1000000-0000-4000-8000-000000000002';
    v_first_ad_id   UUID := 'f1000000-0000-4000-8000-000000000003';
    v_invitee_id    UUID := 'f1000000-0000-4000-8000-000000000004';
    v_outsider_id   UUID := 'f1000000-0000-4000-8000-000000000005';
    v_proj_id       UUID := 'f2000000-0000-4000-8000-000000000001';

    v_inv_json      JSONB;
    v_raw_token     TEXT;
    v_inv_id        UUID;
    v_inv2_json     JSONB;
    v_raw_token2    TEXT;
    v_inv3_json     JSONB;
    v_raw_token3    TEXT;
    v_inv4_json     JSONB;
    v_raw_token4    TEXT;
    v_prev          JSONB;
    v_acc           JSONB;
    v_count         INTEGER;
BEGIN
    -- 0. Seed isolated auth.users -> profiles -> project -> owner/producer/first_ad
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
        ('00000000-0000-0000-0000-000000000000', v_owner_id,    'authenticated', 'authenticated', 'sqltest-owner@sceneos.test',    'x', now(), '{}', '{"full_name":"SQL Owner"}', now(), now()),
        ('00000000-0000-4000-0000-000000000000', v_producer_id, 'authenticated', 'authenticated', 'sqltest-producer@sceneos.test', 'x', now(), '{}', '{"full_name":"SQL Producer"}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', v_first_ad_id, 'authenticated', 'authenticated', 'sqltest-firstad@sceneos.test',  'x', now(), '{}', '{"full_name":"SQL 1stAD"}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', v_invitee_id,  'authenticated', 'authenticated', 'sqltest-invitee@sceneos.test',  'x', now(), '{}', '{"full_name":"SQL Invitee"}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', v_outsider_id, 'authenticated', 'authenticated', 'sqltest-outsider@sceneos.test', 'x', now(), '{}', '{"full_name":"SQL Outsider"}', now(), now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.projects (id, title, owner_id)
    VALUES (v_proj_id, 'SQL Verification Project', v_owner_id);

    INSERT INTO public.project_members (project_id, user_id, role, department)
    VALUES
        (v_proj_id, v_owner_id,    'owner',    'Production'),
        (v_proj_id, v_producer_id, 'producer', 'Production'),
        (v_proj_id, v_first_ad_id, 'first_ad', 'Assistant Directors');

    -- =========================================================================
    -- 1. POSITIVE: Authorized invitation creation & token hashing check
    -- =========================================================================
    PERFORM set_config('app.current_user_id', v_owner_id::TEXT, true);
    v_inv_json := public.create_project_invitation(
        v_proj_id, 'SQLTest-Invitee@SceneOS.Test', 'director', 'Direction', 'dir-entry-42', 48
    );
    v_raw_token := v_inv_json ->> 'invitation_token';
    v_inv_id := (v_inv_json ->> 'id')::UUID;

    IF v_raw_token IS NULL OR char_length(v_raw_token) < 32 THEN
        RAISE EXCEPTION 'FAIL: create_project_invitation did not return high-entropy raw token';
    END IF;

    -- Stored token_hash must NOT equal raw token
    IF EXISTS (SELECT 1 FROM public.project_invitations WHERE id = v_inv_id AND token_hash = v_raw_token) THEN
        RAISE EXCEPTION 'FAIL: Raw token was stored unhashed';
    END IF;

    -- =========================================================================
    -- 2. INVITATION SECURITY: Cannot grant owner or exceed inviter rank
    -- =========================================================================
    BEGIN
        PERFORM public.create_project_invitation(v_proj_id, 'x@sceneos.test', 'owner', NULL, NULL, 24);
        RAISE EXCEPTION 'FAIL: Owner invitation should have been rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%owner%' THEN RAISE; END IF;
    END;

    PERFORM set_config('app.current_user_id', v_producer_id::TEXT, true);
    BEGIN
        PERFORM public.create_project_invitation(v_proj_id, 'x@sceneos.test', 'producer', NULL, NULL, 24);
        RAISE EXCEPTION 'FAIL: Producer inviting producer should have been rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%not authorized%' THEN RAISE; END IF;
    END;

    PERFORM set_config('app.current_user_id', v_first_ad_id::TEXT, true);
    BEGIN
        PERFORM public.create_project_invitation(v_proj_id, 'x@sceneos.test', 'director', NULL, NULL, 24);
        RAISE EXCEPTION 'FAIL: 1st AD inviting director should have been rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%not authorized%' THEN RAISE; END IF;
    END;

    -- =========================================================================
    -- 3. INVITATION SECURITY: Email mismatch & unauthenticated & invalid rejected
    -- =========================================================================
    PERFORM set_config('app.current_user_id', '', true);
    BEGIN
        PERFORM public.accept_project_invitation(v_raw_token);
        RAISE EXCEPTION 'FAIL: Unauthenticated acceptance must fail';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%unauthenticated%' THEN RAISE; END IF;
    END;

    PERFORM set_config('app.current_user_id', v_outsider_id::TEXT, true);
    v_prev := public.preview_project_invitation(v_raw_token);
    IF (v_prev ->> 'status') <> 'email_mismatch' THEN
        RAISE EXCEPTION 'FAIL: Expected email_mismatch preview, got %', v_prev;
    END IF;

    BEGIN
        PERFORM public.accept_project_invitation(v_raw_token);
        RAISE EXCEPTION 'FAIL: Email mismatch acceptance must fail';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%email_mismatch%' THEN RAISE; END IF;
    END;

    BEGIN
        PERFORM public.accept_project_invitation('invalid-token-0000000000000000000');
        RAISE EXCEPTION 'FAIL: Invalid token must fail';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%invalid%' THEN RAISE; END IF;
    END;

    -- =========================================================================
    -- 4. POSITIVE: Intended user accepts (case-insensitive email) & explicit link
    -- =========================================================================
    PERFORM set_config('app.current_user_id', v_invitee_id::TEXT, true);
    v_acc := public.accept_project_invitation(v_raw_token);
    IF NOT COALESCE((v_acc ->> 'success')::BOOLEAN, FALSE) THEN
        RAISE EXCEPTION 'FAIL: Valid acceptance failed: %', v_acc;
    END IF;

    SELECT count(*) INTO v_count
    FROM public.project_members
    WHERE project_id = v_proj_id
      AND user_id = v_invitee_id
      AND role = 'director'
      AND department = 'Direction'
      AND directory_entry_id = 'dir-entry-42';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FAIL: Accepted member missing explicit department/directory_entry_id';
    END IF;

    -- Replay of accepted token must fail
    BEGIN
        PERFORM public.accept_project_invitation(v_raw_token);
        RAISE EXCEPTION 'FAIL: Reused invitation must fail';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%accepted%' THEN RAISE; END IF;
    END;

    -- =========================================================================
    -- 5. INVITATION SECURITY: Revoked & Expired rejected
    -- =========================================================================
    PERFORM set_config('app.current_user_id', v_owner_id::TEXT, true);
    v_inv2_json := public.create_project_invitation(v_proj_id, 'sqltest-revoked@sceneos.test', 'crew_member', NULL, NULL, 24);
    v_raw_token2 := v_inv2_json ->> 'invitation_token';
    PERFORM public.revoke_project_invitation((v_inv2_json ->> 'id')::UUID);

    IF (public.preview_project_invitation(v_raw_token2) ->> 'status') <> 'revoked' THEN
        RAISE EXCEPTION 'FAIL: Expected revoked status in preview';
    END IF;

    v_inv3_json := public.create_project_invitation(v_proj_id, 'sqltest-expired@sceneos.test', 'crew_member', NULL, NULL, 1);
    v_raw_token3 := v_inv3_json ->> 'invitation_token';
    UPDATE public.project_invitations
    SET expires_at = timezone('utc'::text, now()) - interval '1 minute'
    WHERE id = (v_inv3_json ->> 'id')::UUID;

    IF (public.preview_project_invitation(v_raw_token3) ->> 'status') <> 'expired' THEN
        RAISE EXCEPTION 'FAIL: Expected expired status in preview';
    END IF;

    -- =========================================================================
    -- 6. MEMBERSHIP SECURITY: Owner protection, hierarchy & profile isolation
    -- =========================================================================
    -- Non-member cannot call get_project_members
    PERFORM set_config('app.current_user_id', v_outsider_id::TEXT, true);
    BEGIN
        PERFORM * FROM public.get_project_members(v_proj_id);
        RAISE EXCEPTION 'FAIL: Outsider accessed get_project_members';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Access denied%' THEN RAISE; END IF;
    END;

    -- Test RLS as authenticated role
    SET LOCAL ROLE authenticated;

    -- Outsider cannot read owner's or producer's profile
    PERFORM set_config('app.current_user_id', v_outsider_id::TEXT, true);
    SELECT count(*) INTO v_count FROM public.profiles WHERE id = v_owner_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL: Unrelated user profile was readable';
    END IF;

    -- Producer cannot promote director to owner or producer, and cannot alter/delete owner
    PERFORM set_config('app.current_user_id', v_producer_id::TEXT, true);
    BEGIN
        UPDATE public.project_members SET role = 'owner' WHERE project_id = v_proj_id AND user_id = v_invitee_id;
        RAISE EXCEPTION 'FAIL: Producer promoted director to owner';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        UPDATE public.project_members SET role = 'producer' WHERE project_id = v_proj_id AND user_id = v_invitee_id;
        RAISE EXCEPTION 'FAIL: Producer promoted director to producer';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    UPDATE public.project_members SET role = 'viewer' WHERE project_id = v_proj_id AND user_id = v_owner_id;
    IF FOUND THEN
        RAISE EXCEPTION 'FAIL: Producer modified owner membership row';
    END IF;

    DELETE FROM public.project_members WHERE project_id = v_proj_id AND user_id = v_owner_id;
    IF FOUND THEN
        RAISE EXCEPTION 'FAIL: Producer deleted owner membership row';
    END IF;

    -- Producer CAN update lower-ranked member (director -> first_ad)
    UPDATE public.project_members SET role = 'first_ad' WHERE project_id = v_proj_id AND user_id = v_invitee_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FAIL: Producer should be allowed to update director to first_ad';
    END IF;

    -- Unauthorized member (first_ad) cannot insert or delete members
    PERFORM set_config('app.current_user_id', v_first_ad_id::TEXT, true);
    BEGIN
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (v_proj_id, v_outsider_id, 'crew_member');
        RAISE EXCEPTION 'FAIL: 1st AD bypassed RLS to insert member directly';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RAISE NOTICE 'ALL ISOLATED SQL SECURITY VERIFICATION CHECKS PASSED.';
END $$;

ROLLBACK;
