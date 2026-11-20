-- ==============================================================================
-- SceneOS Migration 004: People, Membership & Invitation Security Hardening
-- Target: PostgreSQL 15+ (Supabase)
-- Additive & non-destructive: preserves existing tables, roles, and project data.
-- Addresses audit findings S1, S2, S3, S4, S7, S8.
-- ==============================================================================

-- 1. ADDITIVE SCHEMA EXTENSIONS (preserving unused legacy department_id)
ALTER TABLE public.project_members
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS directory_entry_id TEXT;

DO $$ BEGIN
    ALTER TABLE public.project_members
        ADD CONSTRAINT project_members_department_len
        CHECK (department IS NULL OR char_length(department) <= 60);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.project_invitations
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS directory_entry_id TEXT;

DO $$ BEGIN
    ALTER TABLE public.project_invitations
        ADD CONSTRAINT project_invitations_department_len
        CHECK (department IS NULL OR char_length(department) <= 60);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_invitations_project_lower_email
    ON public.project_invitations (project_id, lower(email));

-- 2. ROLE HIERARCHY & SERVER-SIDE AUTHORITY HELPERS

CREATE OR REPLACE FUNCTION public.project_role_rank(p_role public.project_role)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE p_role
        WHEN 'owner' THEN 70
        WHEN 'producer' THEN 60
        WHEN 'director' THEN 50
        WHEN 'first_ad' THEN 40
        WHEN 'department_head' THEN 30
        WHEN 'crew_member' THEN 20
        WHEN 'viewer' THEN 10
        ELSE 0
    END;
$$;

-- Authoritative role resolution: projects.owner_id always wins as 'owner';
-- stray 'owner' rows in project_members not matching owner_id are ignored.
CREATE OR REPLACE FUNCTION public.effective_project_role(p_project_id UUID, p_user_id UUID)
RETURNS public.project_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT CASE
        WHEN p_user_id IS NULL OR p_project_id IS NULL THEN NULL
        WHEN EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_project_id AND owner_id = p_user_id
        ) THEN 'owner'::public.project_role
        ELSE (
            SELECT pm.role
            FROM public.project_members pm
            WHERE pm.project_id = p_project_id
              AND pm.user_id = p_user_id
              AND pm.role <> 'owner'::public.project_role
            LIMIT 1
        )
    END;
$$;

REVOKE ALL ON FUNCTION public.effective_project_role(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Harden existing has_project_role() so stray non-owner rows marked 'owner' in project_members
-- cannot satisfy owner checks when projects.owner_id does not match.
CREATE OR REPLACE FUNCTION public.has_project_role(p_project_id UUID, p_user_id UUID, p_roles public.project_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.projects
        WHERE id = p_project_id
          AND owner_id = p_user_id
    ) OR EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_id = p_project_id
          AND user_id = p_user_id
          AND role <> 'owner'::public.project_role
          AND role = ANY(p_roles)
    );
$$;

REVOKE ALL ON FUNCTION public.has_project_role(UUID, UUID, public.project_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_project_role(UUID, UUID, public.project_role[]) TO authenticated;

-- Server-side invitation/assignment hierarchy check (mirrors canInviteRole / canManageRole).
-- Only owner, producer, and first_ad hold invite/assignment capabilities; 'owner' is never assignable.
CREATE OR REPLACE FUNCTION public.can_assign_role(
    p_project_id UUID,
    p_actor_id UUID,
    p_target_role public.project_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_actor_role public.project_role;
BEGIN
    IF p_project_id IS NULL OR p_actor_id IS NULL OR p_target_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Prevent direct RPC probing for another user's authority.
    IF current_user IN ('anon', 'authenticated') AND p_actor_id IS DISTINCT FROM public.current_app_user_id() THEN
        RETURN FALSE;
    END IF;

    IF p_target_role = 'owner'::public.project_role THEN
        RETURN FALSE;
    END IF;

    v_actor_role := public.effective_project_role(p_project_id, p_actor_id);
    IF v_actor_role IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_actor_role NOT IN ('owner'::public.project_role, 'producer'::public.project_role, 'first_ad'::public.project_role) THEN
        RETURN FALSE;
    END IF;

    IF v_actor_role = 'owner'::public.project_role THEN
        RETURN TRUE;
    END IF;

    RETURN public.project_role_rank(p_target_role) < public.project_role_rank(v_actor_role);
END;
$$;

REVOKE ALL ON FUNCTION public.can_assign_role(UUID, UUID, public.project_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_assign_role(UUID, UUID, public.project_role) TO authenticated;

-- Server-side member modification/removal guard (only owner & producer; owner row protected).
CREATE OR REPLACE FUNCTION public.can_modify_member(
    p_project_id UUID,
    p_actor_id UUID,
    p_target_user_id UUID,
    p_target_current_role public.project_role,
    p_new_role public.project_role DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_actor_role public.project_role;
    v_is_project_owner BOOLEAN;
BEGIN
    IF p_project_id IS NULL OR p_actor_id IS NULL OR p_target_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF current_user IN ('anon', 'authenticated') AND p_actor_id IS DISTINCT FROM public.current_app_user_id() THEN
        RETURN FALSE;
    END IF;

    IF p_target_current_role = 'owner'::public.project_role THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = p_project_id AND owner_id = p_target_user_id
    ) INTO v_is_project_owner;

    IF v_is_project_owner THEN
        RETURN FALSE;
    END IF;

    IF p_new_role IS NOT NULL AND p_new_role = 'owner'::public.project_role THEN
        RETURN FALSE;
    END IF;

    v_actor_role := public.effective_project_role(p_project_id, p_actor_id);
    IF v_actor_role NOT IN ('owner'::public.project_role, 'producer'::public.project_role) THEN
        RETURN FALSE;
    END IF;

    IF v_actor_role = 'owner'::public.project_role THEN
        RETURN TRUE;
    END IF;

    -- Non-owner (producer) may only act on ranks strictly below their own.
    IF public.project_role_rank(p_target_current_role) >= public.project_role_rank(v_actor_role) THEN
        RETURN FALSE;
    END IF;

    IF p_new_role IS NOT NULL AND public.project_role_rank(p_new_role) >= public.project_role_rank(v_actor_role) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_modify_member(UUID, UUID, UUID, public.project_role, public.project_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_modify_member(UUID, UUID, UUID, public.project_role, public.project_role) TO authenticated;

-- Enforce member row immutability for identity columns and owner protection even on UPDATE/DELETE.
CREATE OR REPLACE FUNCTION public.enforce_project_member_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    v_actor_id := public.current_app_user_id();

    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'owner'::public.project_role OR EXISTS (
            SELECT 1 FROM public.projects p WHERE p.id = OLD.project_id AND p.owner_id = OLD.user_id
        ) THEN
            RAISE EXCEPTION 'Owner membership cannot be removed.';
        END IF;

        IF v_actor_id IS NOT NULL AND NOT public.can_modify_member(OLD.project_id, v_actor_id, OLD.user_id, OLD.role, NULL) THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient rank to remove this project member.';
        END IF;

        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Membership project_id and user_id cannot be reassigned.';
        END IF;

        IF OLD.role = 'owner'::public.project_role OR EXISTS (
            SELECT 1 FROM public.projects p WHERE p.id = OLD.project_id AND p.owner_id = OLD.user_id
        ) THEN
            RAISE EXCEPTION 'Project owner membership cannot be modified or reassigned.';
        END IF;

        IF NEW.role = 'owner'::public.project_role THEN
            RAISE EXCEPTION 'Owner role cannot be assigned through membership updates.';
        END IF;

        IF v_actor_id IS NOT NULL AND NOT public.can_modify_member(OLD.project_id, v_actor_id, OLD.user_id, OLD.role, NEW.role) THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient role hierarchy rank to modify this member.';
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_member_guard ON public.project_members;
CREATE TRIGGER trg_enforce_project_member_guard
BEFORE UPDATE OR DELETE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_member_guard();

-- Prevent producers/directors from changing projects.owner_id on update.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_owner_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        v_actor_id := public.current_app_user_id();
        IF v_actor_id IS NOT NULL AND v_actor_id IS DISTINCT FROM OLD.owner_id THEN
            RAISE EXCEPTION 'Only the project owner may transfer project ownership.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_owner_transfer ON public.projects;
CREATE TRIGGER trg_prevent_unauthorized_owner_transfer
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_owner_transfer();

-- 3. HARDEN PROJECT_MEMBERS RLS (S4: split broad FOR ALL policy)
DROP POLICY IF EXISTS "Project members manageable by owners and producers" ON public.project_members;
DROP POLICY IF EXISTS "Project members insertable by authorized leaders" ON public.project_members;
DROP POLICY IF EXISTS "Project members updatable by authorized leaders" ON public.project_members;
DROP POLICY IF EXISTS "Project members deletable by authorized leaders" ON public.project_members;

CREATE POLICY "Project members insertable by authorized leaders"
ON public.project_members FOR INSERT
TO authenticated
WITH CHECK (
    (
        role = 'owner'::public.project_role
        AND user_id = public.current_app_user_id()
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id AND p.owner_id = user_id
        )
    )
    OR (
        public.has_project_role(project_id, public.current_app_user_id(), ARRAY['owner', 'producer']::public.project_role[])
        AND public.can_assign_role(project_id, public.current_app_user_id(), role)
        AND NOT EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id AND p.owner_id = user_id
        )
    )
);

CREATE POLICY "Project members updatable by authorized leaders"
ON public.project_members FOR UPDATE
TO authenticated
USING (
    public.can_modify_member(project_id, public.current_app_user_id(), user_id, role, NULL)
)
WITH CHECK (
    public.can_modify_member(project_id, public.current_app_user_id(), user_id, role, role)
);

CREATE POLICY "Project members deletable by authorized leaders"
ON public.project_members FOR DELETE
TO authenticated
USING (
    public.can_modify_member(project_id, public.current_app_user_id(), user_id, role, NULL)
);

-- 4. CORRECT PROFILE VISIBILITY & SECURED PEOPLE RPC (S7)
CREATE OR REPLACE FUNCTION public.shares_project_with(p_other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT CASE
        WHEN public.current_app_user_id() IS NULL OR p_other_user_id IS NULL THEN FALSE
        WHEN p_other_user_id = public.current_app_user_id() THEN TRUE
        ELSE EXISTS (
            SELECT 1
            FROM (
                SELECT pm.project_id
                FROM public.project_members pm
                WHERE pm.user_id = public.current_app_user_id()
                UNION
                SELECT p.id AS project_id
                FROM public.projects p
                WHERE p.owner_id = public.current_app_user_id()
            ) my_projects
            WHERE public.is_project_member(my_projects.project_id, p_other_user_id)
        )
    END;
$$;

DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by self or project colleagues" ON public.profiles;

REVOKE ALL ON FUNCTION public.is_project_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.shares_project_with(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_project_with(UUID) TO authenticated;

CREATE POLICY "Profiles readable by self or project colleagues"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = public.current_app_user_id()
    OR public.shares_project_with(id)
);

-- Secured RPC returning strictly the minimum identity fields required by People UI.
CREATE OR REPLACE FUNCTION public.get_project_members(p_project_id UUID)
RETURNS TABLE (
    member_id UUID,
    project_id UUID,
    user_id UUID,
    role public.project_role,
    department TEXT,
    directory_entry_id TEXT,
    joined_at TIMESTAMPTZ,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    is_owner BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    v_actor_id := public.current_app_user_id();
    IF v_actor_id IS NULL OR NOT public.is_project_member(p_project_id, v_actor_id) THEN
        RAISE EXCEPTION 'Access denied: You are not a member of this project.';
    END IF;

    RETURN QUERY
    SELECT
        pm.id AS member_id,
        pm.project_id,
        pm.user_id,
        CASE WHEN p.owner_id = pm.user_id THEN 'owner'::public.project_role ELSE pm.role END AS role,
        pm.department,
        pm.directory_entry_id,
        pm.joined_at,
        COALESCE(NULLIF(pr.full_name, ''), NULLIF(split_part(pr.email, '@', 1), ''), 'Crew Member') AS full_name,
        COALESCE(pr.email, '') AS email,
        pr.avatar_url,
        (p.owner_id = pm.user_id) AS is_owner
    FROM public.project_members pm
    JOIN public.projects p ON p.id = pm.project_id
    LEFT JOIN public.profiles pr ON pr.id = pm.user_id
    WHERE pm.project_id = p_project_id

    UNION ALL

    -- Synthesize owner row only when projects.owner_id lacks a project_members record
    SELECT
        p.owner_id AS member_id,
        p.id AS project_id,
        p.owner_id AS user_id,
        'owner'::public.project_role AS role,
        NULL::TEXT AS department,
        NULL::TEXT AS directory_entry_id,
        p.created_at AS joined_at,
        COALESCE(NULLIF(pr.full_name, ''), NULLIF(split_part(pr.email, '@', 1), ''), 'Project Owner') AS full_name,
        COALESCE(pr.email, '') AS email,
        pr.avatar_url,
        TRUE AS is_owner
    FROM public.projects p
    LEFT JOIN public.profiles pr ON pr.id = p.owner_id
    WHERE p.id = p_project_id
      AND NOT EXISTS (
          SELECT 1 FROM public.project_members pm2
          WHERE pm2.project_id = p.id AND pm2.user_id = p.owner_id
      )

    ORDER BY is_owner DESC, joined_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_members(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_members(UUID) TO authenticated;

-- 5. HARDEN INVITATIONS & SERVER-SIDE TOKEN LIFECYCLE (S1, S2, S3, S8)

DROP POLICY IF EXISTS "Invitations readable by project leaders or invitee" ON public.project_invitations;
DROP POLICY IF EXISTS "Invitations creatable only by project leaders" ON public.project_invitations;
DROP POLICY IF EXISTS "Invitations updatable by project leaders" ON public.project_invitations;

-- Direct client INSERT is intentionally omitted (deny-by-default under RLS);
-- invitations must be created via create_project_invitation() so tokens use CSPRNG + server hash.
CREATE POLICY "Invitations readable by authorized inviters or matching invitee"
ON public.project_invitations FOR SELECT
TO authenticated
USING (
    public.has_project_role(
        project_id,
        public.current_app_user_id(),
        ARRAY['owner', 'producer', 'first_ad']::public.project_role[]
    )
    OR lower(email) = lower(COALESCE(
        (SELECT pr.email FROM public.profiles pr WHERE pr.id = public.current_app_user_id()),
        ''
    ))
);

CREATE POLICY "Invitations revocable by authorized leaders"
ON public.project_invitations FOR UPDATE
TO authenticated
USING (
    status = 'pending'
    AND public.can_assign_role(project_id, public.current_app_user_id(), role)
)
WITH CHECK (
    status = 'revoked'
    AND public.can_assign_role(project_id, public.current_app_user_id(), role)
);

CREATE OR REPLACE FUNCTION public.mask_email_hint(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE
        WHEN p_email IS NULL OR position('@' IN p_email) < 2 THEN NULL
        ELSE
            left(split_part(p_email, '@', 1), 1)
            || repeat('*', GREATEST(1, LEAST(5, char_length(split_part(p_email, '@', 1)) - 1)))
            || '@'
            || split_part(p_email, '@', 2)
    END;
$$;

CREATE OR REPLACE FUNCTION public.create_project_invitation(
    p_project_id UUID,
    p_email TEXT,
    p_role public.project_role,
    p_department TEXT DEFAULT NULL,
    p_directory_entry_id TEXT DEFAULT NULL,
    p_expires_hours INTEGER DEFAULT 168
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_clean_email TEXT;
    v_clean_dept TEXT;
    v_clean_dir_id TEXT;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
    v_inv public.project_invitations%ROWTYPE;
BEGIN
    v_actor_id := public.current_app_user_id();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION '[unauthenticated] Authentication required to issue invitations.';
    END IF;

    v_clean_email := lower(trim(COALESCE(p_email, '')));
    IF char_length(v_clean_email) < 4 OR position('@' IN v_clean_email) < 2 THEN
        RAISE EXCEPTION 'A valid email address is required.';
    END IF;

    IF p_role = 'owner'::public.project_role THEN
        RAISE EXCEPTION '[inviter_not_authorized] Invitations cannot grant the owner role.';
    END IF;

    IF NOT public.can_assign_role(p_project_id, v_actor_id, p_role) THEN
        RAISE EXCEPTION '[inviter_not_authorized] You are not authorized to invite this role.';
    END IF;

    v_clean_dept := NULLIF(trim(COALESCE(p_department, '')), '');
    IF v_clean_dept IS NOT NULL AND char_length(v_clean_dept) > 60 THEN
        RAISE EXCEPTION 'Department name must be 60 characters or fewer.';
    END IF;

    v_clean_dir_id := NULLIF(trim(COALESCE(p_directory_entry_id, '')), '');
    IF v_clean_dir_id IS NOT NULL AND NOT public.has_project_role(
        p_project_id,
        v_actor_id,
        ARRAY['owner', 'producer']::public.project_role[]
    ) THEN
        RAISE EXCEPTION 'Only project owners and producers can attach Directory links to invitations.';
    END IF;

    -- Expire stale pending invitations for this email before checking duplicates
    UPDATE public.project_invitations
    SET status = 'expired'
    WHERE project_id = p_project_id
      AND lower(email) = v_clean_email
      AND status = 'pending'
      AND expires_at < timezone('utc'::text, now());

    IF EXISTS (
        SELECT 1 FROM public.project_invitations
        WHERE project_id = p_project_id
          AND lower(email) = v_clean_email
          AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'A pending invitation already exists for %.', v_clean_email;
    END IF;

    -- Prevent inviting someone who already belongs to this project
    IF EXISTS (
        SELECT 1
        FROM public.profiles pr
        WHERE lower(pr.email) = v_clean_email
          AND public.is_project_member(p_project_id, pr.id)
    ) THEN
        RAISE EXCEPTION '% is already a member of this project.', v_clean_email;
    END IF;

    -- Cryptographically random 256-bit token; only its SHA-256 digest is persisted.
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
    v_expires_at := timezone('utc'::text, now()) + make_interval(hours => GREATEST(1, COALESCE(p_expires_hours, 168)));

    INSERT INTO public.project_invitations (
        project_id,
        email,
        role,
        department,
        directory_entry_id,
        token_hash,
        invited_by,
        status,
        expires_at
    ) VALUES (
        p_project_id,
        v_clean_email,
        p_role,
        v_clean_dept,
        v_clean_dir_id,
        v_token_hash,
        v_actor_id,
        'pending',
        v_expires_at
    )
    RETURNING * INTO v_inv;

    RETURN jsonb_build_object(
        'id', v_inv.id,
        'project_id', v_inv.project_id,
        'email', v_inv.email,
        'role', v_inv.role,
        'department', v_inv.department,
        'directory_entry_id', v_inv.directory_entry_id,
        'status', v_inv.status,
        'expires_at', v_inv.expires_at,
        'created_at', v_inv.created_at,
        'invitation_token', v_raw_token
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_invitation(UUID, TEXT, public.project_role, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_invitation(UUID, TEXT, public.project_role, TEXT, TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_project_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_inv public.project_invitations%ROWTYPE;
BEGIN
    v_actor_id := public.current_app_user_id();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_inv FROM public.project_invitations WHERE id = p_invitation_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found.';
    END IF;

    IF NOT public.can_assign_role(v_inv.project_id, v_actor_id, v_inv.role) THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to revoke this invitation.';
    END IF;

    IF v_inv.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending invitations can be revoked.';
    END IF;

    UPDATE public.project_invitations
    SET status = 'revoked'
    WHERE id = v_inv.id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_project_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_project_invitation(UUID) TO authenticated;

-- Read-only pre-acceptance check callable from the #invite= landing screen.
CREATE OR REPLACE FUNCTION public.preview_project_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash TEXT;
    v_inv public.project_invitations%ROWTYPE;
    v_project_name TEXT;
    v_inviter_name TEXT;
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    IF p_token IS NULL OR char_length(trim(p_token)) < 16 THEN
        RETURN jsonb_build_object('status', 'invalid');
    END IF;

    v_token_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

    SELECT * INTO v_inv
    FROM public.project_invitations
    WHERE token_hash = v_token_hash
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'invalid');
    END IF;

    SELECT title INTO v_project_name FROM public.projects WHERE id = v_inv.project_id;
    SELECT full_name INTO v_inviter_name FROM public.profiles WHERE id = v_inv.invited_by;

    IF v_inv.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'status', 'revoked',
            'project_name', v_project_name,
            'role', v_inv.role
        );
    END IF;

    IF v_inv.status = 'accepted' THEN
        RETURN jsonb_build_object(
            'status', 'accepted',
            'project_id', v_inv.project_id,
            'project_name', v_project_name,
            'role', v_inv.role
        );
    END IF;

    IF v_inv.status = 'expired' OR v_inv.expires_at < timezone('utc'::text, now()) THEN
        IF v_inv.status = 'pending' THEN
            UPDATE public.project_invitations SET status = 'expired' WHERE id = v_inv.id;
        END IF;
        RETURN jsonb_build_object(
            'status', 'expired',
            'project_name', v_project_name,
            'role', v_inv.role,
            'expires_at', v_inv.expires_at
        );
    END IF;

    IF v_inv.status <> 'pending' THEN
        RETURN jsonb_build_object('status', 'invalid');
    END IF;

    v_user_id := public.current_app_user_id();
    IF v_user_id IS NOT NULL THEN
        SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;

        IF v_user_email IS NULL OR lower(trim(v_user_email)) <> lower(trim(v_inv.email)) THEN
            RETURN jsonb_build_object(
                'status', 'email_mismatch',
                'project_name', v_project_name,
                'role', v_inv.role,
                'department', v_inv.department,
                'inviter_name', v_inviter_name,
                'expires_at', v_inv.expires_at,
                'invited_email_hint', public.mask_email_hint(v_inv.email)
            );
        END IF;

        IF public.is_project_member(v_inv.project_id, v_user_id) THEN
            RETURN jsonb_build_object(
                'status', 'already_member',
                'project_id', v_inv.project_id,
                'project_name', v_project_name,
                'role', public.effective_project_role(v_inv.project_id, v_user_id),
                'department', v_inv.department,
                'inviter_name', v_inviter_name,
                'expires_at', v_inv.expires_at
            );
        END IF;

        RETURN jsonb_build_object(
            'status', 'valid',
            'project_id', v_inv.project_id,
            'project_name', v_project_name,
            'role', v_inv.role,
            'department', v_inv.department,
            'inviter_name', v_inviter_name,
            'expires_at', v_inv.expires_at
        );
    END IF;

    -- Unauthenticated visitor: do not leak project_id or email hints yet.
    RETURN jsonb_build_object(
        'status', 'valid',
        'project_name', v_project_name,
        'role', v_inv.role,
        'department', v_inv.department,
        'inviter_name', v_inviter_name,
        'expires_at', v_inv.expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_project_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_project_invitation(TEXT) TO anon, authenticated;

-- Drop legacy hash-accepting signature so only raw-token server-hashing acceptance exists.
DROP FUNCTION IF EXISTS public.accept_project_invitation(TEXT);

CREATE OR REPLACE FUNCTION public.accept_project_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_invitation public.project_invitations%ROWTYPE;
    v_user_id UUID;
    v_user_email TEXT;
    v_token_hash TEXT;
    v_existing_role public.project_role;
BEGIN
    v_user_id := public.current_app_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '[unauthenticated] Authentication required to accept an invitation.';
    END IF;

    SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;
    IF v_user_email IS NULL THEN
        RAISE EXCEPTION '[invalid] User profile record not found.';
    END IF;

    IF p_token IS NULL OR char_length(trim(p_token)) < 16 THEN
        RAISE EXCEPTION '[invalid] Invalid invitation token.';
    END IF;

    v_token_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

    SELECT * INTO v_invitation
    FROM public.project_invitations
    WHERE token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '[invalid] Invalid invitation token.';
    END IF;

    IF v_invitation.status = 'revoked' THEN
        RAISE EXCEPTION '[revoked] This invitation has been revoked.';
    END IF;

    IF v_invitation.status = 'accepted' THEN
        RAISE EXCEPTION '[accepted] This invitation has already been used.';
    END IF;

    IF v_invitation.status = 'expired' OR v_invitation.expires_at < timezone('utc'::text, now()) THEN
        RAISE EXCEPTION '[expired] This invitation has expired.';
    END IF;

    IF v_invitation.status <> 'pending' THEN
        RAISE EXCEPTION '[invalid] This invitation is no longer active.';
    END IF;

    -- Case-insensitive email verification (fixes audit finding S1)
    IF lower(trim(v_user_email)) <> lower(trim(v_invitation.email)) THEN
        RAISE EXCEPTION '[email_mismatch] This invitation was issued for a different email address.';
    END IF;

    -- Prevent owner grant and re-check inviter authority (fixes audit finding S3)
    IF v_invitation.role = 'owner'::public.project_role THEN
        RAISE EXCEPTION '[inviter_not_authorized] Invitations cannot grant the owner role.';
    END IF;

    IF NOT public.can_assign_role(v_invitation.project_id, v_invitation.invited_by, v_invitation.role) THEN
        RAISE EXCEPTION '[inviter_not_authorized] Inviter no longer holds authority to grant this role.';
    END IF;

    -- If already a member, preserve their existing role and close invitation cleanly
    v_existing_role := public.effective_project_role(v_invitation.project_id, v_user_id);
    IF v_existing_role IS NOT NULL THEN
        UPDATE public.project_invitations
        SET status = 'accepted',
            accepted_at = timezone('utc'::text, now())
        WHERE id = v_invitation.id;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'You are already a member of this project.',
            'project_id', v_invitation.project_id,
            'role', v_existing_role
        );
    END IF;

    INSERT INTO public.project_members (
        project_id,
        user_id,
        role,
        department,
        directory_entry_id
    ) VALUES (
        v_invitation.project_id,
        v_user_id,
        v_invitation.role,
        v_invitation.department,
        v_invitation.directory_entry_id
    );

    UPDATE public.project_invitations
    SET status = 'accepted',
        accepted_at = timezone('utc'::text, now())
    WHERE id = v_invitation.id;

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
            'department', v_invitation.department,
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

REVOKE ALL ON FUNCTION public.accept_project_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation(TEXT) TO authenticated;
