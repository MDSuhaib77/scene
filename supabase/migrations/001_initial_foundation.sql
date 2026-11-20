-- ==============================================================================
-- SceneOS Migration 001: Technical Foundation & Security Baseline
-- Target: PostgreSQL 15+ (Supabase)
-- Reversible: Yes
-- ==============================================================================

-- 1. EXTENSIONS & UTILITIES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE public.project_role AS ENUM (
        'owner',
        'producer',
        'director',
        'first_ad',
        'department_head',
        'crew_member',
        'viewer'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.project_status AS ENUM (
        'development',
        'pre-production',
        'production',
        'post-production',
        'wrapped',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. CORE TABLES

-- 3.1 Profiles Table (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Auto-sync new Supabase Auth users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        )
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3.2 Projects Table (The Core Production Container)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    logline TEXT,
    director TEXT,
    producer TEXT,
    status public.project_status NOT NULL DEFAULT 'development',
    budget_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (budget_total >= 0),
    daily_burn_cap NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (daily_burn_cap >= 0),
    target_start_date DATE,
    target_wrap_date DATE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT valid_project_dates CHECK (
        target_wrap_date IS NULL OR 
        target_start_date IS NULL OR 
        target_wrap_date >= target_start_date
    )
);

-- 3.3 Project Members Table (RBAC Mapping)
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.project_role NOT NULL DEFAULT 'crew_member',
    department_id UUID,
    custom_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_project_member UNIQUE (project_id, user_id)
);

-- 3.4 Audit Logs Table (Append-Only System Log)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.5 Project Activity Table (User-Facing Production Feed)
CREATE TABLE IF NOT EXISTS public.project_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_date ON public.audit_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_project_date ON public.project_activity(project_id, created_at DESC);

-- 5. PORTABLE SECURITY & AUTHORIZATION SHIMS

-- 5.1 Portable current user id extractor
-- Works with Supabase auth.uid() or standard PostgreSQL session variables (for local tests/migration)
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT coalesce(
        nullif(current_setting('app.current_user_id', true), '')::uuid,
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid,
        auth.uid()
    );
$$;

-- 5.2 Membership verification helper
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.project_members
        WHERE project_id = p_project_id 
          AND user_id = p_user_id
    ) OR EXISTS (
        SELECT 1 
        FROM public.projects
        WHERE id = p_project_id 
          AND owner_id = p_user_id
    );
$$;

-- 5.3 Role hierarchy verification helper
CREATE OR REPLACE FUNCTION public.has_project_role(p_project_id UUID, p_user_id UUID, p_roles public.project_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
          AND role = ANY(p_roles)
    );
$$;

-- 6. ROW-LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

-- 6.1 Profiles Policies
CREATE POLICY "Public profiles are readable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = public.current_app_user_id())
WITH CHECK (id = public.current_app_user_id());

-- 6.2 Projects Policies
-- Read: Only project members or project owner can read the project
CREATE POLICY "Projects readable by members and owners"
ON public.projects FOR SELECT
TO authenticated
USING (
    public.is_project_member(id, public.current_app_user_id())
);

-- Insert: Any authenticated user can create a new project (they become owner)
CREATE POLICY "Authenticated users can create projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
    owner_id = public.current_app_user_id()
);

-- Update: Only owner, producer, or director can update project metadata
CREATE POLICY "Projects updatable by owners, producers, directors"
ON public.projects FOR UPDATE
TO authenticated
USING (
    public.has_project_role(id, public.current_app_user_id(), ARRAY['owner', 'producer', 'director']::public.project_role[])
)
WITH CHECK (
    public.has_project_role(id, public.current_app_user_id(), ARRAY['owner', 'producer', 'director']::public.project_role[])
);

-- Delete: Strictly project owner
CREATE POLICY "Projects deletable only by owner"
ON public.projects FOR DELETE
TO authenticated
USING (
    owner_id = public.current_app_user_id()
);

-- 6.3 Project Members Policies
CREATE POLICY "Project members readable by colleagues"
ON public.project_members FOR SELECT
TO authenticated
USING (
    public.is_project_member(project_id, public.current_app_user_id())
);

CREATE POLICY "Project members manageable by owners and producers"
ON public.project_members FOR ALL
TO authenticated
USING (
    public.has_project_role(project_id, public.current_app_user_id(), ARRAY['owner', 'producer']::public.project_role[])
);

-- 6.4 Audit Logs Policies
-- Read: Only project owners and producers can inspect audit history
CREATE POLICY "Audit logs readable by owners and producers"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
    project_id IS NOT NULL AND 
    public.has_project_role(project_id, public.current_app_user_id(), ARRAY['owner', 'producer']::public.project_role[])
);

-- Insert: Automated system trigger or authenticated service
CREATE POLICY "Audit logs insertable by authenticated users"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6.5 Project Activity Policies
CREATE POLICY "Project activity readable by members"
ON public.project_activity FOR SELECT
TO authenticated
USING (
    public.is_project_member(project_id, public.current_app_user_id())
);

CREATE POLICY "Project activity insertable by members"
ON public.project_activity FOR INSERT
TO authenticated
WITH CHECK (
    public.is_project_member(project_id, public.current_app_user_id()) AND
    user_id = public.current_app_user_id()
);

-- 7. AUDIT TRAIL TRIGGER
CREATE OR REPLACE FUNCTION public.log_project_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        project_id,
        user_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        public.current_app_user_id(),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id)::TEXT,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_projects ON public.projects;
CREATE TRIGGER trg_audit_projects
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.log_project_audit_trail();
