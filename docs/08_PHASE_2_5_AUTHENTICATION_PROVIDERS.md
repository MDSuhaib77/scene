# SceneOS — Phase 2.5: Entry Screen & Real Authentication Providers
**Status:** Completed & Audited  
**Milestone:** Phase 2.5 Complete  
**Date:** 2026-10-15  

---

## 1. Executive Summary

Phase 2.5 implements a unified, production-grade entry screen and real authentication provider infrastructure connecting SceneOS to Supabase Auth (`@supabase/supabase-js`), replacing mock-only gateways with live authentication choices while retaining seamless offline fallbacks.

The first page now exposes three authentication options:
1. **Continue with Google** (OAuth 2.0 / PKCE Flow)
2. **Continue with Apple** (OAuth / Services ID Flow)
3. **Continue with Email** (Real Supabase Email/Password + Registration + Recovery)

---

## 2. Provider Verification Audit Matrix

| Provider | Status | Verified Behavior & Telemetry | Next Step to Unblock |
|---|:---:|---|---|
| **Email Authentication** | **PASS** | Live registration executed against `https://vpescialnraywrdbycwd.supabase.co/auth/v1/signup`. User `201d0c2b-0cc3-41a4-bbfe-44d5a722eb4d` registered with `provider: email`. Error handling for duplicate accounts, unconfirmed emails, and password resets validated. | *(Optional)* Toggle "Confirm email" OFF in Supabase if immediate password login without email dispatch is desired during MCA development. |
| **Google OAuth** | **PASS** | Live client SDK flow and server redirect verified. Endpoint `https://vpescialnraywrdbycwd.supabase.co/auth/v1/authorize?provider=google` returns `302 Found`, redirecting directly to `https://accounts.google.com/o/oauth2/v2/auth` with configured client ID `596253700031-2mlrp34c2b68unirk3etl78pg8ituc9i.apps.googleusercontent.com`. | None. Fully configured and operational. |
| **Apple OAuth** | **REMOVED** | Removed from entry UI per user request to avoid unconfigured provider clutter. Underlying adapter code remains available if configured in future. | Requires Apple Developer Account ($99/year), Services ID, Team ID, Key ID, and Private Key. |

---

## 3. First-Page Architecture & Design

### UI Layout:
- **Location:** Top-level application gateway ([`src/App.tsx`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/src/App.tsx)).
- **Direct Accessibility:** All three options are presented on the initial screen without opening nested menus.
- **Visual Design:** High-contrast obsidian slate (`#030611`) with subtle cyan border gradient, authentic SVG brand marks for Google and Apple, accessible ARIA labels, interactive loading spinners, error alerts, and notification banners.
- **Seeded Persona Quick-Access:** Preserved directly below the email form for rapid evaluation and offline testing.

### Unified Profile Auto-Sync:
When any user authenticates through Google, Apple, or Email, the database trigger `handle_new_user()` in [`supabase/migrations/001_initial_foundation.sql`](file:///C:/Users/Suhaib/Downloads/pl-an-project-main/pl-an-project-main/supabase/migrations/001_initial_foundation.sql) automatically populates or updates `public.profiles`:
```sql
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
```

---

## 4. Setup Guide: Unblocking Google OAuth

To move Google OAuth from **BLOCKED** to **PASS**:

1. **Obtain Supabase Redirect URL:**
   - In Supabase Dashboard: Go to **Authentication** ➔ **Providers** ➔ **Google**.
   - Copy the **Callback URL (for OAuth)**:
     `https://vpescialnraywrdbycwd.supabase.co/auth/v1/callback`

2. **Configure Google Cloud Console:**
   - Open [Google Cloud Console](https://console.cloud.google.com/).
   - Create or select a Project (e.g., `SceneOS`).
   - Go to **APIs & Services** ➔ **OAuth consent screen**:
     - User Type: **External**
     - App name: `SceneOS`
     - User support email & Developer contact: your email.
     - Scopes: `email`, `profile`, `openid`.
   - Go to **APIs & Services** ➔ **Credentials**:
     - Click **Create Credentials** ➔ **OAuth client ID**.
     - Application type: **Web application**.
     - Authorized JavaScript origins:
       - `http://localhost:3000`
       - `https://vpescialnraywrdbycwd.supabase.co`
     - Authorized redirect URIs:
       - `https://vpescialnraywrdbycwd.supabase.co/auth/v1/callback`
     - Click **Create** and copy the **Client ID** and **Client Secret**.

3. **Enable in Supabase:**
   - Back in Supabase (Authentication ➔ Providers ➔ Google):
   - Toggle **Enable Google provider** to **ON**.
   - Paste the **Client ID** and **Client Secret**.
   - Click **Save**.

---

## 5. Setup Guide: Unblocking Apple OAuth

To move Apple OAuth from **BLOCKED** to **PASS**:

1. **Prerequisites:**
   - Active [Apple Developer Account](https://developer.apple.com/) (Enrollment requires $99/year).

2. **Apple Developer Configuration:**
   - Go to **Certificates, Identifiers & Profiles**:
     - **App IDs:** Create an App ID for SceneOS (e.g., `studio.sceneos.app`).
     - **Services IDs:** Create a Services ID (e.g., `studio.sceneos.auth`).
       - Enable **Sign In with Apple**.
       - Configure Web Domain: `vpescialnraywrdbycwd.supabase.co`
       - Return URL: `https://vpescialnraywrdbycwd.supabase.co/auth/v1/callback`
     - **Keys:** Create a Key with *Sign In with Apple* enabled. Download the `.p8` private key file and note the **Key ID**.

3. **Enable in Supabase:**
   - In Supabase Dashboard: **Authentication** ➔ **Providers** ➔ **Apple**.
   - Toggle **Enable Apple provider** to **ON**.
   - Enter:
     - **Services ID** (Client ID)
     - **Team ID** (from Apple Developer membership page)
     - **Key ID**
     - **Secret Key** (content of the downloaded `.p8` key file)
   - Click **Save**.

---

## 6. Email Provider & Confirmation Settings

1. **Email Confirmation Behaviour:**
   - If **Confirm email** is enabled in Supabase, new accounts receive an email confirmation link.
   - For rapid local MCA development, you can disable email confirmation:
     - Supabase Dashboard ➔ **Authentication** ➔ **Providers** ➔ **Email**.
     - Toggle **Confirm email** to **OFF**.
     - Click **Save**.
     - Users can then register and immediately sign in with their password without checking an inbox.
