-- ==============================================================================
-- SceneOS SQL Verification Suite: Migration 006 (Notifications & Activity)
-- Safe to run against staging/local Postgres: wraps everything in ROLLBACK.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_owner_id UUID := '11111111-1111-1111-1111-111111111101';
    v_producer_id UUID := '11111111-1111-1111-1111-111111111102';
    v_crew_id UUID := '11111111-1111-1111-1111-111111111103';
    v_viewer_id UUID := '11111111-1111-1111-1111-111111111104';
    v_outsider_id UUID := '11111111-1111-1111-1111-111111111199';
    v_proj_id UUID := '22222222-2222-2222-2222-222222222201';
    v_other_proj_id UUID := '22222222-2222-2222-2222-222222222202';
    v_thread_id UUID;
    v_notif_id UUID;
    v_count INTEGER;
BEGIN
    -- Seed profiles
    INSERT INTO public.profiles (id, email, full_name) VALUES
        (v_owner_id, 'owner-006@sceneos.test', 'Kira Owner'),
        (v_producer_id, 'producer-006@sceneos.test', 'Elena Producer'),
        (v_crew_id, 'crew-006@sceneos.test', 'Sam Camera'),
        (v_viewer_id, 'viewer-006@sceneos.test', 'Pat Viewer'),
        (v_outsider_id, 'outsider-006@sceneos.test', 'Eve Outsider')
    ON CONFLICT (id) DO NOTHING;

    -- Seed projects
    INSERT INTO public.projects (id, title, owner_id, status) VALUES
        (v_proj_id, 'Test Feature 006', v_owner_id, 'pre-production'),
        (v_other_proj_id, 'Isolated Project 006', v_outsider_id, 'development')
    ON CONFLICT (id) DO NOTHING;

    -- Seed members (Crew has explicit directory_entry_id = 'dir-cam-01')
    INSERT INTO public.project_members (project_id, user_id, role, directory_entry_id) VALUES
        (v_proj_id, v_producer_id, 'producer', NULL),
        (v_proj_id, v_crew_id, 'crew_member', 'dir-cam-01'),
        (v_proj_id, v_viewer_id, 'viewer', NULL)
    ON CONFLICT (project_id, user_id) DO NOTHING;

    -- 1. Activity generated automatically on member join & role change (as owner)
    PERFORM set_config('app.current_user_id', v_owner_id::TEXT, true);
    UPDATE public.project_members
    SET role = 'department_head'
    WHERE project_id = v_proj_id AND user_id = v_crew_id;

    SELECT count(*) INTO v_count
    FROM public.project_activity
    WHERE project_id = v_proj_id AND activity_type = 'member_role_changed';
    IF v_count < 1 THEN
        RAISE EXCEPTION 'Assertion failed: member_role_changed activity not logged.';
    END IF;

    -- Crew member should receive essential role_changed notification
    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_crew_id AND project_id = v_proj_id AND event_type = 'role_changed';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Assertion failed: crew member did not receive role_changed notification.';
    END IF;

    -- 2. Discussion mention + reply coalescing + author exclusion
    PERFORM set_config('app.current_user_id', v_owner_id::TEXT, true);
    v_thread_id := public.ensure_project_discussion_thread(v_proj_id, '006 Test Thread');
    PERFORM public.post_discussion_message(
        v_thread_id,
        'Heads up @Elena Producer on budget lock',
        NULL,
        ARRAY[v_producer_id],
        'req-006-1'
    );

    -- Producer receives discussion_mention; owner (author) does not notify self
    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_producer_id AND event_type = 'discussion_mention';
    IF v_count < 1 THEN
        RAISE EXCEPTION 'Assertion failed: mentioned producer did not receive discussion_mention.';
    END IF;

    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_owner_id AND entity_type = 'message';
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Assertion failed: author received self-notification.';
    END IF;

    -- 3. Operational state trigger: Call Sheet publish targets ONLY linked directory member (v_crew_id)
    INSERT INTO public.project_operational_states (project_id, production_state, phases_state)
    VALUES (
        v_proj_id,
        jsonb_build_object(
            'shootingDays', jsonb_build_array(
                jsonb_build_object('id', 'sd-1', 'dayNumber', 1, 'date', '2026-07-01', 'callTime', '06:30')
            ),
            'callSheets', jsonb_build_array(
                jsonb_build_object(
                    'id', 'cs-1',
                    'shootingDayId', 'sd-1',
                    'revisionNumber', 1,
                    'generalCallTime', '06:30',
                    'published', true,
                    'directoryEntryIds', jsonb_build_array('dir-cam-01')
                )
            ),
            'dailyReports', jsonb_build_array(
                jsonb_build_object(
                    'id', 'dpr-1',
                    'shootingDayId', 'sd-1',
                    'shootDayNumber', 1,
                    'calendarDate', '2026-07-01',
                    'preparedBy', 'Elena Producer',
                    'status', 'Submitted',
                    'updatedAt', '2026-07-01T19:00:00Z'
                )
            )
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'ph-1',
                'name', 'Pre-Production',
                'activities', jsonb_build_array(
                    jsonb_build_object(
                        'id', 'task-1',
                        'name', 'Confirm camera package',
                        'assignedTo', 'Sam Camera',
                        'endDate', '2026-06-25',
                        'completed', false
                    )
                )
            )
        )
    );

    -- Crew member got call_sheet_published & task_assigned; Viewer did NOT get either!
    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_crew_id AND event_type IN ('call_sheet_published', 'task_assigned');
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Assertion failed: expected 2 targeted notifications for crew member, got %', v_count;
    END IF;

    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_viewer_id AND event_type IN ('call_sheet_published', 'task_assigned', 'dpr_submitted');
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Assertion failed: unrelated viewer received production notification.';
    END IF;

    -- Producer (reviewer role) receives DPR submitted notification; Owner (actor) does not notify self
    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_producer_id AND event_type = 'dpr_submitted';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Assertion failed: producer did not receive dpr_submitted notification.';
    END IF;

    -- 4. Preferences test: disabling call_sheets_enabled blocks Rev 2 notification for crew member,
    --    while role_changed remains immune (security invariant).
    PERFORM set_config('app.current_user_id', v_crew_id::TEXT, true);
    PERFORM public.update_my_notification_preferences(p_call_sheets_enabled := false);

    PERFORM set_config('app.current_user_id', v_owner_id::TEXT, true);
    UPDATE public.project_operational_states
    SET production_state = jsonb_set(
        production_state,
        '{callSheets,0,revisionNumber}',
        '2'::jsonb
    )
    WHERE project_id = v_proj_id;

    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = v_crew_id AND event_type = 'call_sheet_published';
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Assertion failed: opted-out crew member received Rev 2 Call Sheet notification.';
    END IF;

    -- 5. Security Isolation: Outsider CANNOT access project activity or crew member notifications
    SELECT id INTO v_notif_id FROM public.notifications WHERE user_id = v_crew_id LIMIT 1;
    PERFORM set_config('app.current_user_id', v_outsider_id::TEXT, true);

    BEGIN
        PERFORM public.mark_notification_read(v_notif_id);
        RAISE EXCEPTION 'Assertion failed: outsider marked crew notification as read!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%not found or access denied%' THEN
            RAISE;
        END IF;
    END;

    BEGIN
        PERFORM * FROM public.get_project_activity_feed(v_proj_id);
        RAISE EXCEPTION 'Assertion failed: non-member accessed project activity feed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Access denied%' THEN
            RAISE;
        END IF;
    END;
END
$$;

ROLLBACK;
