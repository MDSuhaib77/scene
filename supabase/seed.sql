-- ==============================================================================
-- SceneOS Database Seed Data
-- ==============================================================================

-- 1. Auth Users Seed (Allows live Supabase email/password login with password123)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'kira.vance@sceneos.studio', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kira Vance"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'elena.rostova@sceneos.studio', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Elena Rostova"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'marcus.ad@sceneos.studio', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcus Thorne"}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 2. Profiles Seed
INSERT INTO public.profiles (id, email, full_name, avatar_url, phone, bio)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'kira.vance@sceneos.studio', 'Kira Vance', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', '+1-555-0192', 'Director & Showrunner specialized in neo-noir science fiction.'),
    ('c0000000-0000-0000-0000-000000000002', 'elena.rostova@sceneos.studio', 'Elena Rostova', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', '+1-555-0144', 'Lead Producer with expertise in multi-guild co-productions.'),
    ('c0000000-0000-0000-0000-000000000003', 'marcus.ad@sceneos.studio', 'Marcus Thorne', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '+1-555-0177', '1st Assistant Director & Stripboard Logistics Specialist.')
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;

-- 2. Projects Seed
INSERT INTO public.projects (id, title, logline, director, producer, status, budget_total, daily_burn_cap, target_start_date, target_wrap_date, owner_id)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Neon Dreams: Chapter One', 'In a rain-slicked cyberpunk metropolis, a rogue synthetic consciousness hires an underground detective before a megacorporation wipes its kernel.', 'Kira Vance', 'Elena Rostova', 'pre-production', 4500000.00, 50000.00, '2026-06-01', '2026-08-15', 'c0000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000002', 'Monsoon Shadow', 'A veteran Mumbai sound recordist accidentally captures a conspiracy frequency during an intense monsoon night shoot.', 'Anand Mohan', 'Kira Vance', 'development', 1800000.00, 28000.00, '2026-09-10', '2026-11-05', 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    status = EXCLUDED.status;

-- 3. Project Members Seed
INSERT INTO public.project_members (id, project_id, user_id, role)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'owner'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'producer'),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'first_ad')
ON CONFLICT (project_id, user_id) DO UPDATE SET
    role = EXCLUDED.role;

-- 4. Initial Project Activity Seed
INSERT INTO public.project_activity (id, project_id, user_id, activity_type, title, description)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'project_created', 'Project Initialized in SceneOS', 'Target shooting slate locked with 32 principal photography days.'),
    ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'budget_approved', 'Production Budget Approved', 'Total cap set to $4,500,000 with a $50,000/day burn rate limit.')
ON CONFLICT (id) DO NOTHING;
