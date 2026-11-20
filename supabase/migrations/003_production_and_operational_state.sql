-- ==============================================================================
-- SceneOS Migration 003: Production & Operational State Persistence
-- Target: PostgreSQL 15+ (Supabase)
-- Non-destructive & additive: retains all existing tables and data.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.project_operational_states (
    project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
    production_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    phases_state JSONB NOT NULL DEFAULT '[]'::jsonb,
    visualize_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_operational_states_updated
    ON public.project_operational_states(updated_at DESC);

ALTER TABLE public.project_operational_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operational state readable by project members" ON public.project_operational_states;
CREATE POLICY "Operational state readable by project members"
ON public.project_operational_states FOR SELECT
TO authenticated
USING (
    public.is_project_member(project_id, public.current_app_user_id())
);

DROP POLICY IF EXISTS "Operational state insertable by editors" ON public.project_operational_states;
CREATE POLICY "Operational state insertable by editors"
ON public.project_operational_states FOR INSERT
TO authenticated
WITH CHECK (
    public.has_project_role(
        project_id,
        public.current_app_user_id(),
        ARRAY['owner', 'producer', 'director', 'first_ad', 'department_head']::public.project_role[]
    )
);

DROP POLICY IF EXISTS "Operational state updatable by editors" ON public.project_operational_states;
CREATE POLICY "Operational state updatable by editors"
ON public.project_operational_states FOR UPDATE
TO authenticated
USING (
    public.has_project_role(
        project_id,
        public.current_app_user_id(),
        ARRAY['owner', 'producer', 'director', 'first_ad', 'department_head']::public.project_role[]
    )
)
WITH CHECK (
    public.has_project_role(
        project_id,
        public.current_app_user_id(),
        ARRAY['owner', 'producer', 'director', 'first_ad', 'department_head']::public.project_role[]
    )
);
