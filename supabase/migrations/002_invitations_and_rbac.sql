-- ==============================================================================
-- SceneOS Migration 002: Project Invitations & RBAC Enhancements
-- Target: PostgreSQL 15+ (Supabase)
-- Reversible: Yes
-- ==============================================================================

-- 1. INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS public.project_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (char_length(trim(email)) > 3),
    role public.project_role NOT NULL DEFAULT 'crew_member',
    department_id UUID,
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    accepted_at TIMESTAMPTZ,
    CONSTRAINT valid_invitation_expiry CHECK (expires_at > created_at)
);

-- 2. INDEXES FOR INVITATIONS
CREATE INDEX IF NOT EXISTS idx_invitations_project ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.project_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.project_invitations(status);

-- 3. ROW-LEVEL SECURITY FOR INVITATIONS
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- 3.1 Invitations are readable by project owners & producers, OR by the invited user themselves (matching email)
CREATE POLICY "Invitations readable by project leaders or invitee"
ON public.project_invitations FOR SELECT
TO authenticated
USING (
    public.has_project_role(project_id, public.current_app_user_id(), ARRAY['owner', 'producer']::public.project_role[])
    OR email = (SELECT email FROM public.profiles WHERE id = public.current_app_user_id())
);

-- 3.2 Invitations can only be created by project owners or producers
CREATE POLICY "Invitations creatable only by project leaders"
ON public.project_invitations FOR INSERT
TO authenticated
WITH CHECK (
    public.has_project_role(project_id, public.current_app_user_id(), ARRAY['owner', 'producer']::public.project_role[])
    AND invited_by = public.current_app_user_id()
);

-- 3.3 Invitations can only be updated (revoked) by project leaders
CREATE POLICY "Invitations updatable by project leaders"
ON public.project_invitations FOR UPDATE
TO authenticated
USING (
    public.has_project_role(project_id, public.current_app_user_id(), ARRAY['owner', 'producer']::public.project_role[])
)
WITH CHECK (
    public.has_project_role(project_id, public.current_app_user_id(), ARRAY['owner', 'producer']::public.project_role[])
);

-- 4. INVITATION ACCEPTANCE ATOMIC STORED FUNCTION
-- Executes atomically with explicit search_path to prevent security hijacking
CREATE OR REPLACE FUNCTION public.accept_project_invitation(
    p_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_invitation RECORD;
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    v_user_id := public.current_app_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to accept an invitation.';
    END IF;

    -- Lookup user email from profiles
    SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;
    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'User profile record not found.';
    END IF;

    -- Find the pending invitation
    SELECT * INTO v_invitation
    FROM public.project_invitations
    WHERE token_hash = p_token_hash
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or already used invitation token.';
    END IF;

    IF v_invitation.expires_at < timezone('utc'::text, now()) THEN
        UPDATE public.project_invitations SET status = 'expired' WHERE id = v_invitation.id;
        RAISE EXCEPTION 'This invitation has expired.';
    END IF;

    -- Check if already a member
    IF EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = v_invitation.project_id AND user_id = v_user_id
    ) THEN
        UPDATE public.project_invitations 
        SET status = 'accepted', accepted_at = timezone('utc'::text, now()) 
        WHERE id = v_invitation.id;
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'You are already a member of this project.',
            'project_id', v_invitation.project_id
        );
    END IF;

    -- Insert membership
    INSERT INTO public.project_members (
        project_id,
        user_id,
        role,
        department_id
    ) VALUES (
        v_invitation.project_id,
        v_user_id,
        v_invitation.role,
        v_invitation.department_id
    );

    -- Mark invitation accepted
    UPDATE public.project_invitations
    SET status = 'accepted',
        accepted_at = timezone('utc'::text, now())
    WHERE id = v_invitation.id;

    -- Audit log record (never records raw invitation secrets)
    INSERT INTO public.audit_logs (
        project_id,
        user_id,
        entity_type,
        entity_id,
        action,
        new_values
    ) VALUES (
        v_invitation.project_id,
        v_user_id,
        'project_members',
        v_user_id::TEXT,
        'INVITATION_ACCEPTED',
        jsonb_build_object(
            'role', v_invitation.role,
            'invited_by', v_invitation.invited_by
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'project_id', v_invitation.project_id,
        'role', v_invitation.role
    );
END;
$$;
