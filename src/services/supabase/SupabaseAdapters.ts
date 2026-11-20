/**
 * SceneOS — Supabase Service Adapters
 * Implements IAuthService, IProjectService, IInvitationService, IActivityService, and IConnectionService
 * using typed PostgREST queries, Supabase GoTrue Auth, and PostgreSQL stored procedures.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Database,
  ProjectMemberRpcRow,
  ProjectRole,
  ProjectStatus,
} from '../../types/database.types';
import type { ScreenplayVersion } from '../../types';
import {
  IAuthService,
  IProjectService,
  IInvitationService,
  IActivityService,
  IConnectionService,
  UserSession,
  ProjectDomainModel,
  ProjectMemberDomainModel,
  InvitationDomainModel,
  InvitationPreview,
  InvitationPreviewStatus,
  InvitationError,
  CreateInvitationOptions,
  ActivityDomainModel,
  ActivityPage,
  ConnectionHealth,
  DiscussionEntityType,
  DiscussionMessageDomainModel,
  DiscussionMessagesPage,
  DiscussionRecordTarget,
  DiscussionThreadDomainModel,
  IDiscussionService,
  INotificationService,
  NotificationCategory,
  NotificationDomainModel,
  NotificationEntityType,
  NotificationEventType,
  NotificationFilter,
  NotificationPage,
  NotificationPreferencesDomainModel,
  NotificationPriority,
  PostDiscussionMessageInput,
  ProjectPersistence,
  ProjectRealtimeHandle,
  RealtimeCollabScope,
  RealtimeCollabSignal,
  RealtimeConnectionStatus,
  RealtimePresenceMember,
  UpdateNotificationPreferencesInput,
  IRealtimeCollaborationService
} from '../contracts/types';
import { canManageRole } from '../rbac/permissions';

export class SupabaseAuthService implements IAuthService {
  constructor(private client: SupabaseClient<Database>) {}

  async getSession(): Promise<UserSession> {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (error || !session) {
      return { user: null, isMock: false };
    }

    const { user } = session;
    // Fetch profile record
    const { data: profile } = await this.client
      .from('profiles')
      .select('full_name, avatar_url, phone, bio')
      .eq('id', user.id)
      .maybeSingle();

    return {
      user: {
        id: user.id,
        email: user.email || '',
        fullName: (profile as any)?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Crew Member',
        avatarUrl: (profile as any)?.avatar_url || user.user_metadata?.avatar_url || null,
        phone: (profile as any)?.phone || null,
        bio: (profile as any)?.bio || null,
      },
      token: session.access_token,
      isMock: false,
    };
  }

  async login(email: string, password = ''): Promise<UserSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Supabase Auth Error: ${error.message}`);
    if (!data.user || !data.session) throw new Error('No session returned after login');

    return {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        fullName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Crew Member',
        avatarUrl: data.user.user_metadata?.avatar_url || null,
      },
      token: data.session.access_token,
      isMock: false,
    };
  }

  async register(email: string, password = '', fullName = ''): Promise<UserSession> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw new Error(`Supabase Registration Error: ${error.message}`);
    if (!data.user) throw new Error('Failed to create user account');

    // Create initial profile record if not auto-created by trigger
    await this.client.from('profiles').upsert({
      id: data.user.id,
      email: data.user.email || email,
      full_name: fullName || email.split('@')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    return {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        fullName: fullName || email.split('@')[0],
        avatarUrl: null,
      },
      token: data.session?.access_token,
      isMock: false,
    };
  }

  async signInWithOAuth(provider: 'google' | 'apple'): Promise<{ url?: string; error?: string }> {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: provider === 'google' ? {
          access_type: 'offline',
          prompt: 'consent',
        } : undefined,
      },
    });

    if (error) throw new Error(`OAuth Error (${provider}): ${error.message}`);
    return { url: data.url };
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }

  async updateProfile(updates: { fullName?: string; avatarUrl?: string | null; phone?: string | null; bio?: string | null }): Promise<UserSession['user']> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const payload: Database['public']['Tables']['profiles']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.bio !== undefined) payload.bio = updates.bio;

    const { data, error } = await this.client
      .from('profiles')
      .update(payload as any)
      .eq('id', user.id)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to update profile: ${error?.message || 'No record returned'}`);

    const row = data as Database['public']['Tables']['profiles']['Row'];
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      phone: row.phone,
      bio: row.bio,
    };
  }

  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/#reset-password` : 'http://localhost:3000/#reset-password';
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw new Error(`Password reset failed: ${error.message}`);
    return {
      success: true,
      message: `Password reset instructions sent to ${email}. Please check your inbox.`,
    };
  }

  onAuthStateChange(callback: (session: UserSession) => void): () => void {
    const { data: { subscription } } = this.client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        callback({ user: null, isMock: false });
      } else {
        callback({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Crew Member',
            avatarUrl: session.user.user_metadata?.avatar_url || null,
          },
          token: session.access_token,
          isMock: false,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }
}

function loadOperationalData(projectId: string): Partial<ProjectDomainModel> {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`sceneos_production_${projectId}`);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn(`[SupabaseAdapter] Failed to load operational data for ${projectId}:`, e);
  }
  return {};
}

function saveOperationalData(projectId: string, data: Partial<ProjectDomainModel>): void {
  try {
    if (typeof window === 'undefined') return;
    const existing = loadOperationalData(projectId);
    const merged = { ...existing, ...data };
    try {
      localStorage.setItem(`sceneos_production_${projectId}`, JSON.stringify(merged));
    } catch (quotaErr) {
      console.warn(`[SupabaseAdapter] Storage quota exceeded while saving production ${projectId}. Pruning large blobs:`, quotaErr);
      if (merged.screenplayVersions && Array.isArray(merged.screenplayVersions)) {
        merged.screenplayVersions = merged.screenplayVersions.map(v => {
          if (v.sourcePdfDataUrl && v.sourcePdfDataUrl.length > 50000) {
            const { sourcePdfDataUrl, ...rest } = v;
            return rest as ScreenplayVersion;
          }
          return v;
        });
        localStorage.setItem(`sceneos_production_${projectId}`, JSON.stringify(merged));
      }
    }
  } catch (e) {
    console.warn(`[SupabaseAdapter] Failed to save operational data for ${projectId}:`, e);
  }
}

function assembleProject(row: Database['public']['Tables']['projects']['Row']): ProjectDomainModel {
  const op = loadOperationalData(row.id);
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const in60Days = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  const screenplayVersions = op.screenplayVersions || [];
  const activeScreenplayVersionId =
    op.activeScreenplayVersionId ||
    (screenplayVersions.length > 0 ? screenplayVersions[screenplayVersions.length - 1]?.id : undefined);

  const activeVersion =
    screenplayVersions.find(v => v.id === activeScreenplayVersionId) ||
    screenplayVersions[0];

  const scenes =
    op.scenes && op.scenes.length > 0
      ? op.scenes
      : activeVersion?.extractedScenes && activeVersion.extractedScenes.length > 0
        ? activeVersion.extractedScenes
        : activeVersion?.scenes && activeVersion.scenes.length > 0
          ? activeVersion.scenes
          : [];

  return {
    ...op,
    id: row.id,
    title: row.title,
    logline: row.logline || op.logline || '',
    director: row.director || op.director || '',
    producer: row.producer || op.producer || '',
    productionType: op.productionType || 'Feature Film',
    productionCompany: op.productionCompany || op.companyName || '',
    companyName: op.companyName || op.productionCompany || '',
    status: row.status,
    budgetTotal: Number(row.budget_total) || 0,
    dailyBurnCap: Number(row.daily_burn_cap) || 0,
    targetStartDate: row.target_start_date,
    targetWrapDate: row.target_wrap_date,
    startDate: op.startDate || row.target_start_date || today,
    finalEndDate: op.finalEndDate || row.target_wrap_date || in60Days,
    suggestedEndDate: op.suggestedEndDate || row.target_wrap_date || in60Days,
    isEndDateFixed: op.isEndDateFixed ?? false,
    ownerId: row.owner_id,
    persistence: 'remote',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    phases: op.phases || [],
    screenplayVersions,
    activeScreenplayVersionId,
    scenes,
    elementCatalog: op.elementCatalog || [],
    sceneBreakdownAssociations: op.sceneBreakdownAssociations || [],
    footageBackups: op.footageBackups || [],
    storyboardRevisions: op.storyboardRevisions || [],
    constraints: op.constraints || {
      maxOvertimeHours: 2,
      turnaroundHours: 12,
      mealBreakFrequency: 6,
      sundayPremiums: true,
      weatherBufferDays: 1,
    },
  };
}

function generateDeterministicUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const hex = Date.now().toString(16).padStart(12, '0').slice(-12);
  return `a0000000-0000-4000-8000-${hex}`;
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getLocalProjectsList(): ProjectDomainModel[] {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('sceneos_local_projects_registry');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((p: ProjectDomainModel) => ({
            ...p,
            persistence: 'local' as const,
          }));
        }
      }
    }
  } catch (e) {
    console.warn('[SupabaseAdapter] Failed to load local projects registry:', e);
  }
  return [];
}

function saveLocalProjectsList(projects: ProjectDomainModel[]): void {
  try {
    if (typeof window === 'undefined') return;
    const normalized = projects.map(p => ({ ...p, persistence: 'local' as const }));
    localStorage.setItem('sceneos_local_projects_registry', JSON.stringify(normalized));
  } catch (e) {
    console.warn('[SupabaseAdapter] Failed to save local projects registry:', e);
  }
}

export class SupabaseProjectService implements IProjectService {
  constructor(private client: SupabaseClient<Database>) {}

  async getProjects(): Promise<ProjectDomainModel[]> {
    const localProjects = getLocalProjectsList().map(p => {
      const op = loadOperationalData(p.id);
      const screenplayVersions = op.screenplayVersions || p.screenplayVersions || [];
      const activeScreenplayVersionId =
        op.activeScreenplayVersionId ||
        p.activeScreenplayVersionId ||
        (screenplayVersions.length > 0 ? screenplayVersions[screenplayVersions.length - 1]?.id : undefined);
      const activeVersion = screenplayVersions.find(v => v.id === activeScreenplayVersionId) || screenplayVersions[0];
      const scenes =
        op.scenes && op.scenes.length > 0
          ? op.scenes
          : p.scenes && p.scenes.length > 0
            ? p.scenes
            : activeVersion?.extractedScenes && activeVersion.extractedScenes.length > 0
              ? activeVersion.extractedScenes
              : activeVersion?.scenes && activeVersion.scenes.length > 0
                ? activeVersion.scenes
                : [];
      return {
        ...p,
        ...op,
        persistence: 'local' as const,
        screenplayVersions,
        activeScreenplayVersionId,
        scenes,
      };
    });
    try {
      const { data, error } = await this.client
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[SupabaseAdapter] Remote projects fetch issue, serving local:', error.message);
        return localProjects;
      }
      if (!data) return localProjects;

      const remoteProjects = (data as Database['public']['Tables']['projects']['Row'][]).map(p => assembleProject(p));
      const remoteIds = new Set(remoteProjects.map(p => p.id));

      // Hydrate remote production/operational state when available
      if (remoteProjects.length > 0) {
        try {
          const { data: opRows } = await this.client
            .from('project_operational_states')
            .select('project_id, production_state, phases_state, visualize_state, updated_at')
            .in('project_id', remoteProjects.map(p => p.id));
          if (Array.isArray(opRows)) {
            const byId = new Map(opRows.map((r: any) => [r.project_id, r]));
            remoteProjects.forEach((proj, idx) => {
              const r: any = byId.get(proj.id);
              if (!r) return;
              const merged: ProjectDomainModel = {
                ...proj,
                ...(r.production_state && Object.keys(r.production_state).length > 0
                  ? { productionState: r.production_state }
                  : {}),
                ...(Array.isArray(r.phases_state) && r.phases_state.length > 0
                  ? { phases: r.phases_state }
                  : {}),
                ...(r.visualize_state && Object.keys(r.visualize_state).length > 0
                  ? { visualizeState: r.visualize_state }
                  : {}),
                persistence: 'remote',
              };
              remoteProjects[idx] = merged;
              saveOperationalData(proj.id, merged);
            });
          }
        } catch {
          // Graceful fallback if operational table is not yet provisioned remotely
        }
      }

      return [...remoteProjects, ...localProjects.filter(p => !remoteIds.has(p.id))];
    } catch (e) {
      return localProjects;
    }
  }

  async getProjectById(id: string): Promise<ProjectDomainModel | null> {
    const local = getLocalProjectsList().find(p => p.id === id);
    if (local) {
      const op = loadOperationalData(id);
      const screenplayVersions = op.screenplayVersions || local.screenplayVersions || [];
      const activeScreenplayVersionId =
        op.activeScreenplayVersionId ||
        local.activeScreenplayVersionId ||
        (screenplayVersions.length > 0 ? screenplayVersions[screenplayVersions.length - 1]?.id : undefined);
      const activeVersion = screenplayVersions.find(v => v.id === activeScreenplayVersionId) || screenplayVersions[0];
      const scenes =
        op.scenes && op.scenes.length > 0
          ? op.scenes
          : local.scenes && local.scenes.length > 0
            ? local.scenes
            : activeVersion?.extractedScenes && activeVersion.extractedScenes.length > 0
              ? activeVersion.extractedScenes
              : activeVersion?.scenes && activeVersion.scenes.length > 0
                ? activeVersion.scenes
                : [];
      return {
        ...local,
        ...op,
        persistence: 'local',
        screenplayVersions,
        activeScreenplayVersionId,
        scenes,
      };
    }

    try {
      const { data, error } = await this.client
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const assembled = assembleProject(data as Database['public']['Tables']['projects']['Row']);
      try {
        const { data: opRow } = await this.client
          .from('project_operational_states')
          .select('production_state, phases_state, visualize_state')
          .eq('project_id', id)
          .maybeSingle();
        if (opRow) {
          const r: any = opRow;
          const merged: ProjectDomainModel = {
            ...assembled,
            ...(r.production_state && Object.keys(r.production_state).length > 0
              ? { productionState: r.production_state }
              : {}),
            ...(Array.isArray(r.phases_state) && r.phases_state.length > 0
              ? { phases: r.phases_state }
              : {}),
            ...(r.visualize_state && Object.keys(r.visualize_state).length > 0
              ? { visualizeState: r.visualize_state }
              : {}),
            persistence: 'remote',
          };
          saveOperationalData(id, merged);
          return merged;
        }
      } catch {
        // Fallback cleanly to local operational storage for this verified remote project
      }
      return assembled;
    } catch (e) {
      return null;
    }
  }

  async createProject(input: Partial<Omit<ProjectDomainModel, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>> & { title: string }): Promise<ProjectDomainModel> {
    const { data: { session } } = await this.client.auth.getSession();
    let user = session?.user;
    if (!user) {
      try {
        const { data: { user: fetchedUser } } = await this.client.auth.getUser();
        user = fetchedUser;
      } catch (e) {
        // network or auth error
      }
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const in60Days = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    const storedUname = typeof localStorage !== 'undefined' ? (localStorage.getItem('cp_uname') || 'Producer') : 'Producer';
    const ownerId = user?.id || `usr-${storedUname.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // If an authenticated Supabase user session exists, try remote creation
    if (user && user.id) {
      try {
        // Ensure profile row exists for this user before project foreign key insertion
        try {
          await this.client.from('profiles').upsert({
            id: user.id,
            email: user.email || '',
            full_name: (user as any).user_metadata?.full_name || (user as any).user_metadata?.name || user.email?.split('@')[0] || 'Producer',
            updated_at: new Date().toISOString()
          } as any);
        } catch (profErr) {
          console.warn('[SupabaseAdapter] Profile self-upsert note:', profErr);
        }

        const insertPayload: Database['public']['Tables']['projects']['Insert'] = {
          title: input.title,
          logline: input.logline || null,
          director: input.director || null,
          producer: input.producer || null,
          status: input.status,
          budget_total: input.budgetTotal,
          daily_burn_cap: input.dailyBurnCap,
          target_start_date: input.targetStartDate || null,
          target_wrap_date: input.targetWrapDate || null,
          owner_id: user.id,
        };

        const { data, error } = await this.client
          .from('projects')
          .insert(insertPayload as any)
          .select()
          .single();

        if (!error && data) {
          const row = data as Database['public']['Tables']['projects']['Row'];

          // Auto-create owner project_members row
          const { error: ownerMemErr } = await this.client.from('project_members').insert({
            project_id: row.id,
            user_id: user.id,
            role: 'owner',
          } as any);
          if (ownerMemErr && ownerMemErr.code !== '23505') {
            console.warn('[Supabase] Member insert notice:', ownerMemErr.message);
          }

          saveOperationalData(row.id, {
            phases: input.phases || [],
            screenplayVersions: input.screenplayVersions || [],
            elementCatalog: input.elementCatalog || [],
            sceneBreakdownAssociations: input.sceneBreakdownAssociations || [],
            footageBackups: input.footageBackups || [],
            storyboardRevisions: input.storyboardRevisions || [],
            productionState: input.productionState,
            visualizeState: input.visualizeState,
            productionType: input.productionType || 'Feature Film',
            productionCompany: input.productionCompany || input.companyName || '',
            companyName: input.companyName || input.productionCompany || '',
            primaryLocation: (input as any).primaryLocation || '',
            startDate: input.startDate || input.targetStartDate,
            finalEndDate: input.finalEndDate || input.targetWrapDate,
            suggestedEndDate: input.suggestedEndDate || input.targetWrapDate,
            isEndDateFixed: input.isEndDateFixed ?? false,
            constraints: input.constraints,
          });

          return assembleProject(row);
        } else if (error) {
          console.error('[SupabaseAdapter] Remote insert blocked by RLS or auth policy; preserving locally:', error);
          alert(`Supabase Cloud Sync Notice: ${error.message} (code: ${error.code})`);
        }
      } catch (err: any) {
        console.error('[SupabaseAdapter] Remote insert exception; preserving locally:', err);
        alert(`Supabase Cloud Sync Error: ${err.message || err}`);
      }
    }

    // Seamless Local & Offline Production Creation (Resilient to RLS and unauthenticated states)
    const newId = generateDeterministicUuid();

    const localProj: ProjectDomainModel = {
      id: newId,
      title: input.title,
      logline: input.logline || '',
      director: input.director || '',
      producer: input.producer || '',
      productionType: input.productionType || 'Feature Film',
      productionCompany: input.productionCompany || input.companyName || '',
      companyName: input.companyName || input.productionCompany || '',
      primaryLocation: (input as any).primaryLocation || '',
      status: input.status || 'development',
      budgetTotal: Number(input.budgetTotal) || 0,
      dailyBurnCap: Number(input.dailyBurnCap) || 0,
      targetStartDate: input.targetStartDate || null,
      targetWrapDate: input.targetWrapDate || null,
      startDate: input.startDate || input.targetStartDate || today,
      finalEndDate: input.finalEndDate || input.targetWrapDate || in60Days,
      suggestedEndDate: input.suggestedEndDate || input.targetWrapDate || in60Days,
      isEndDateFixed: input.isEndDateFixed ?? false,
      ownerId,
      persistence: 'local',
      createdAt: now,
      updatedAt: now,
      phases: input.phases || [],
      screenplayVersions: input.screenplayVersions || [],
      elementCatalog: input.elementCatalog || [],
      sceneBreakdownAssociations: input.sceneBreakdownAssociations || [],
      footageBackups: input.footageBackups || [],
      storyboardRevisions: input.storyboardRevisions || [],
      productionState: input.productionState,
      visualizeState: input.visualizeState,
      vaultState: input.vaultState,
      constraints: input.constraints || {
        maxOvertimeHours: 2,
        turnaroundHours: 12,
        mealBreakFrequency: 6,
        sundayPremiums: true,
        weatherBufferDays: 1,
      },
    };

    saveOperationalData(newId, localProj);
    const existingList = getLocalProjectsList();
    saveLocalProjectsList([localProj, ...existingList.filter(p => p.id !== newId)]);

    return localProj;
  }

  async updateProject(id: string, updates: Partial<ProjectDomainModel>): Promise<ProjectDomainModel> {
    saveOperationalData(id, updates);

    // Update in local registry if present
    const localList = getLocalProjectsList();
    const localIdx = localList.findIndex(p => p.id === id);
    if (localIdx >= 0) {
      const updated = { ...localList[localIdx], ...updates, updatedAt: new Date().toISOString() };
      localList[localIdx] = updated;
      saveLocalProjectsList(localList);
      return updated;
    }

    // Persist operational state remotely for valid UUID projects when schema is provisioned
    if (
      isValidUuid(id) &&
      (updates.productionState !== undefined ||
        updates.phases !== undefined ||
        updates.visualizeState !== undefined)
    ) {
      const mergedOp = loadOperationalData(id);
      this.client
        .from('project_operational_states')
        .upsert(
          {
            project_id: id,
            production_state: (updates.productionState ?? mergedOp.productionState ?? {}) as any,
            phases_state: (updates.phases ?? mergedOp.phases ?? []) as any,
            visualize_state: (updates.visualizeState ?? mergedOp.visualizeState ?? {}) as any,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'project_id' }
        )
        .then(({ error: opErr }) => {
          if (opErr) {
            console.warn('[SupabaseAdapter] Remote operational state upsert notice:', opErr.message);
          }
        });
    }

    try {
      const payload: Database['public']['Tables']['projects']['Update'] = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.logline !== undefined) payload.logline = updates.logline;
      if (updates.director !== undefined) payload.director = updates.director;
      if (updates.producer !== undefined) payload.producer = updates.producer;
      if (updates.status !== undefined) payload.status = updates.status as ProjectStatus;
      if (updates.budgetTotal !== undefined) payload.budget_total = updates.budgetTotal;
      if (updates.dailyBurnCap !== undefined) payload.daily_burn_cap = updates.dailyBurnCap;
      if (updates.targetStartDate !== undefined) payload.target_start_date = updates.targetStartDate;
      if (updates.targetWrapDate !== undefined) payload.target_wrap_date = updates.targetWrapDate;

      if (Object.keys(payload).length > 0) {
        const { data, error } = await this.client
          .from('projects')
          .update(payload as any)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return assembleProject(data as Database['public']['Tables']['projects']['Row']);
        }
      }
    } catch (e) {
      console.warn('[SupabaseAdapter] Remote update failed, operational data preserved:', e);
    }

    const base = await this.getProjectById(id);
    const op = loadOperationalData(id);
    return { ...(base || {}), ...op, ...updates } as ProjectDomainModel;
  }

  async archiveProject(id: string): Promise<ProjectDomainModel> {
    return this.updateProject(id, { status: 'archived' });
  }

  async deleteProject(id: string): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`sceneos_production_${id}`);
    }
    const localList = getLocalProjectsList().filter(p => p.id !== id);
    saveLocalProjectsList(localList);

    try {
      await this.client.from('projects').delete().eq('id', id);
    } catch (e) {
      // Remote delete might fail if local-only or unauthenticated
    }
  }

  async getProjectMembers(projectId: string): Promise<ProjectMemberDomainModel[]> {
    // Local-only fallback projects exist strictly in browser storage and have no multi-user roster.
    if (getLocalProjectsList().some(p => p.id === projectId)) {
      return [];
    }

    const { data, error } = await (this.client as any).rpc('get_project_members', {
      p_project_id: projectId,
    });

    if (error) {
      throw new Error(error.message || 'Failed to load project members from Supabase.');
    }

    const rows = (data as ProjectMemberRpcRow[] | null) || [];
    return rows.map(m => ({
      id: m.member_id,
      projectId: m.project_id,
      userId: m.user_id,
      fullName: m.full_name || 'Crew Member',
      email: m.email || '',
      avatarUrl: m.avatar_url || null,
      role: m.role as ProjectRole,
      department: m.department ?? null,
      directoryEntryId: m.directory_entry_id ?? null,
      isOwner: Boolean(m.is_owner || m.role === 'owner'),
      joinedAt: m.joined_at,
    }));
  }

  async updateMemberRole(
    projectId: string,
    memberId: string,
    newRole: ProjectRole,
    actorRole: ProjectRole
  ): Promise<ProjectMemberDomainModel> {
    const { data: memberData, error: memErr } = await this.client
      .from('project_members')
      .select('role')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .single();

    if (memErr || !memberData) throw new Error('Target project member not found.');

    const currentRole = (memberData as any).role as ProjectRole;
    if (!canManageRole(actorRole, currentRole, newRole)) {
      throw new Error(`Unauthorized: Cannot change role from ${currentRole} to ${newRole}.`);
    }

    const { error } = await this.client
      .from('project_members')
      .update({ role: newRole } as any)
      .eq('id', memberId)
      .eq('project_id', projectId);

    if (error) throw new Error(`Failed to update member role: ${error.message}`);

    const refreshed = await this.getProjectMembers(projectId);
    const updated = refreshed.find(m => m.id === memberId);
    if (!updated) throw new Error('Updated member could not be reloaded.');
    return updated;
  }

  async updateMemberDetails(
    projectId: string,
    memberId: string,
    updates: { department?: string | null; directoryEntryId?: string | null }
  ): Promise<ProjectMemberDomainModel> {
    if (getLocalProjectsList().some(p => p.id === projectId)) {
      throw new Error('Cannot edit member associations on a local-only project.');
    }

    const payload: Database['public']['Tables']['project_members']['Update'] = {};
    if (updates.department !== undefined) {
      const cleanedDept = updates.department === null ? null : updates.department.trim().slice(0, 60) || null;
      payload.department = cleanedDept;
    }
    if (updates.directoryEntryId !== undefined) {
      const cleanedDir = updates.directoryEntryId === null ? null : updates.directoryEntryId.trim() || null;
      payload.directory_entry_id = cleanedDir;
    }

    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from('project_members')
        .update(payload as any)
        .eq('id', memberId)
        .eq('project_id', projectId);

      if (error) {
        throw new Error(`Failed to update member details: ${error.message}`);
      }
    }

    const refreshed = await this.getProjectMembers(projectId);
    const updated = refreshed.find(m => m.id === memberId);
    if (!updated) throw new Error('Updated member could not be reloaded.');
    return updated;
  }

  async removeProjectMember(memberId: string): Promise<void> {
    const { error } = await this.client.from('project_members').delete().eq('id', memberId);
    if (error) throw new Error(`Failed to remove project member: ${error.message}`);
  }
}

function parseInvitationError(rawMessage: string): InvitationError {
  const match = rawMessage.match(/\[([a-z_]+)\]\s*(.*)$/i);
  if (match) {
    return new InvitationError(match[1] as InvitationError['code'], match[2] || rawMessage);
  }
  const lower = rawMessage.toLowerCase();
  if (lower.includes('expired')) return new InvitationError('expired', rawMessage);
  if (lower.includes('revoked')) return new InvitationError('revoked', rawMessage);
  if (lower.includes('already been used')) return new InvitationError('accepted', rawMessage);
  if (lower.includes('different email')) return new InvitationError('email_mismatch', rawMessage);
  if (lower.includes('authentication required')) return new InvitationError('unauthenticated', rawMessage);
  if (lower.includes('authority') || lower.includes('owner')) return new InvitationError('inviter_not_authorized', rawMessage);
  if (lower.includes('invalid')) return new InvitationError('invalid', rawMessage);
  return new InvitationError('unknown', rawMessage);
}

export class SupabaseInvitationService implements IInvitationService {
  constructor(private client: SupabaseClient<Database>) {}

  async getProjectInvitations(projectId: string): Promise<InvitationDomainModel[]> {
    // Explicitly omit token_hash from client reads.
    const { data, error } = await this.client
      .from('project_invitations')
      .select('id, project_id, email, role, department_id, department, directory_entry_id, status, expires_at, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch invitations: ${error.message}`);
    if (!data) return [];

    const nowMs = Date.now();
    return (data as any[]).map(i => {
      const isExpiredPending = i.status === 'pending' && new Date(i.expires_at).getTime() < nowMs;
      return {
        id: i.id,
        projectId: i.project_id,
        email: i.email,
        role: i.role as ProjectRole,
        departmentId: i.department_id ?? null,
        department: i.department ?? null,
        directoryEntryId: i.directory_entry_id ?? null,
        status: isExpiredPending ? 'expired' : i.status,
        expiresAt: i.expires_at,
        createdAt: i.created_at,
        isMock: false,
      };
    });
  }

  async createInvitation(
    projectId: string,
    email: string,
    role: ProjectRole,
    _departmentId?: string,
    expiresInHours = 7 * 24,
    options?: CreateInvitationOptions
  ): Promise<InvitationDomainModel> {
    if (role === 'owner') {
      throw new InvitationError('inviter_not_authorized', 'Invitations cannot grant the owner role.');
    }

    const { data, error } = await (this.client as any).rpc('create_project_invitation', {
      p_project_id: projectId,
      p_email: email.trim(),
      p_role: role,
      p_department: options?.department?.trim().slice(0, 60) || null,
      p_directory_entry_id: options?.directoryEntryId?.trim() || null,
      p_expires_hours: expiresInHours,
    });

    if (error || !data) {
      throw parseInvitationError(error?.message || 'Failed to issue invitation.');
    }

    const row = data as any;
    return {
      id: row.id,
      projectId: row.project_id,
      email: row.email,
      role: row.role as ProjectRole,
      departmentId: null,
      department: row.department ?? null,
      directoryEntryId: row.directory_entry_id ?? null,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      invitationToken: row.invitation_token,
      isMock: false,
    };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    const { error } = await (this.client as any).rpc('revoke_project_invitation', {
      p_invitation_id: invitationId,
    });

    if (error) throw new Error(`Failed to revoke invitation: ${error.message}`);
  }

  async previewInvitation(token: string): Promise<InvitationPreview> {
    const clean = token?.trim() || '';
    if (!clean) return { status: 'invalid' };

    const { data, error } = await (this.client as any).rpc('preview_project_invitation', {
      p_token: clean,
    });

    if (error || !data) {
      return { status: 'invalid' };
    }

    const res = data as any;
    return {
      status: (res.status as InvitationPreviewStatus) || 'invalid',
      projectId: res.project_id ?? undefined,
      projectName: res.project_name ?? undefined,
      role: res.role as ProjectRole | undefined,
      department: res.department ?? null,
      inviterName: res.inviter_name ?? null,
      expiresAt: res.expires_at ?? undefined,
      invitedEmailHint: res.invited_email_hint ?? null,
    };
  }

  async acceptInvitation(token: string): Promise<{ success: boolean; projectId: string; role: ProjectRole }> {
    const { data, error } = await (this.client as any).rpc('accept_project_invitation', {
      p_token: token.trim(),
    });

    if (error) {
      throw parseInvitationError(error.message || 'Invitation acceptance failed.');
    }

    const res = data as any;
    return {
      success: Boolean(res?.success),
      projectId: res.project_id,
      role: res.role as ProjectRole,
    };
  }
}

export class SupabaseActivityService implements IActivityService {
  constructor(private client: SupabaseClient<Database>) {}

  async getProjectActivity(projectId: string, limit = 10): Promise<ActivityDomainModel[]> {
    const page = await this.getProjectActivityPage(projectId, { limit });
    return page.activities;
  }

  async getProjectActivityPage(
    projectId: string,
    options?: { beforeCreatedAt?: string; beforeId?: string; limit?: number }
  ): Promise<ActivityPage> {
    if (!isValidUuid(projectId) || getLocalProjectsList().some(p => p.id === projectId)) {
      return { activities: [], hasMore: false };
    }
    const pageLimit = Math.min(Math.max(options?.limit ?? 25, 1), 50);

    try {
      const { data, error } = await (this.client as any).rpc('get_project_activity_feed', {
        p_project_id: projectId,
        p_cursor_created_at: options?.beforeCreatedAt ?? null,
        p_cursor_id: options?.beforeId ?? null,
        p_limit: pageLimit + 1,
      });

      if (!error && Array.isArray(data)) {
        const hasMore = data.length > pageLimit;
        const rows = hasMore ? data.slice(0, pageLimit) : data;
        return {
          activities: rows.map((a: any) => ({
            id: a.id,
            projectId: a.project_id,
            userId: a.user_id || '',
            userFullName: a.user_full_name || 'System Operator',
            avatarUrl: a.avatar_url || null,
            activityType: a.activity_type,
            title: a.title,
            description: a.description ?? null,
            entityType: a.entity_type ?? null,
            entityId: a.entity_id ?? null,
            entityLabel: a.entity_label ?? null,
            metadata: a.metadata ?? null,
            createdAt: a.created_at,
          })),
          hasMore,
        };
      }
    } catch {
      // Fall back to base table query if migration 006 RPC is not yet deployed remotely
    }

    try {
      const { data, error } = await this.client
        .from('project_activity')
        .select(`
          id,
          project_id,
          user_id,
          activity_type,
          title,
          description,
          created_at,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(pageLimit + 1);

      if (error || !data) return { activities: [], hasMore: false };
      const hasMore = data.length > pageLimit;
      const rows = (hasMore ? data.slice(0, pageLimit) : data) as any[];
      return {
        activities: rows.map(a => ({
          id: a.id,
          projectId: a.project_id,
          userId: a.user_id || '',
          userFullName: a.profiles?.full_name || 'System Operator',
          avatarUrl: a.profiles?.avatar_url || null,
          activityType: a.activity_type,
          title: a.title,
          description: a.description ?? null,
          createdAt: a.created_at,
        })),
        hasMore,
      };
    } catch {
      return { activities: [], hasMore: false };
    }
  }

  async logActivity(_input: Omit<ActivityDomainModel, 'id' | 'createdAt'>): Promise<ActivityDomainModel> {
    throw new Error('Activity history is generated server-side from verified project operations.');
  }
}

export class SupabaseConnectionService implements IConnectionService {
  constructor(private client: SupabaseClient<Database>) {}

  async checkHealth(): Promise<ConnectionHealth> {
    const startTime = performance.now();
    try {
      const { error } = await this.client.from('projects').select('id').limit(1);
      const latencyMs = Math.round(performance.now() - startTime);

      if (error) {
        return {
          state: 'error',
          provider: 'supabase',
          latencyMs,
          message: `Supabase database error: ${error.message}`,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        state: 'connected',
        provider: 'supabase',
        latencyMs,
        message: 'Connected to live Supabase PostgreSQL database',
        lastChecked: new Date().toISOString(),
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        state: 'disconnected',
        provider: 'supabase',
        latencyMs,
        message: err.message || 'Cannot reach Supabase host. Network offline or project paused.',
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

export class SupabaseDiscussionService implements IDiscussionService {
  constructor(private client: SupabaseClient<Database>) {}

  private assertRemoteProject(projectId: string): void {
    if (getLocalProjectsList().some(p => p.id === projectId)) {
      throw new Error('Discussions require a connected Supabase project. Local-only drafts are not shared across devices.');
    }
  }

  async getProjectThreads(
    projectId: string,
    filter?: { entityType?: DiscussionEntityType; entityId?: string }
  ): Promise<DiscussionThreadDomainModel[]> {
    this.assertRemoteProject(projectId);

    const { data, error } = await (this.client as any).rpc('get_project_threads', {
      p_project_id: projectId,
      p_entity_type: filter?.entityType ?? null,
      p_entity_id: filter?.entityId ?? null,
    });

    if (error) {
      throw new Error(error.message || 'Failed to load project discussions.');
    }

    const rows = (data as any[] | null) || [];
    return rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      scope: r.scope,
      entityType: r.entity_type ?? null,
      entityId: r.entity_id ?? null,
      entityLabel: r.entity_label ?? null,
      title: r.title,
      createdBy: r.created_by,
      creatorName: r.creator_name || 'Member',
      resolvedAt: r.resolved_at ?? null,
      resolvedBy: r.resolved_by ?? null,
      lastMessageAt: r.last_message_at,
      messageCount: Number(r.message_count ?? 0),
      createdAt: r.created_at,
      unreadCount: Number(r.unread_count ?? 0),
      latestPreview: r.latest_preview ?? null,
    }));
  }

  async ensureProjectThread(projectId: string, title?: string): Promise<string> {
    this.assertRemoteProject(projectId);

    const { data, error } = await (this.client as any).rpc('ensure_project_discussion_thread', {
      p_project_id: projectId,
      p_scope: 'project',
      p_entity_type: null,
      p_entity_id: null,
      p_entity_label: null,
      p_title: title?.trim() || null,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Unable to open project discussion thread.');
    }
    return data as string;
  }

  async ensureRecordThread(projectId: string, target: DiscussionRecordTarget): Promise<string> {
    this.assertRemoteProject(projectId);

    const { data, error } = await (this.client as any).rpc('ensure_project_discussion_thread', {
      p_project_id: projectId,
      p_scope: 'record',
      p_entity_type: target.entityType,
      p_entity_id: target.entityId,
      p_entity_label: target.entityLabel,
      p_title: target.title?.trim() || target.entityLabel,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Unable to open record discussion thread.');
    }
    return data as string;
  }

  async getThreadMessages(
    threadId: string,
    options?: { before?: string; limit?: number }
  ): Promise<DiscussionMessagesPage> {
    const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
    const { data, error } = await (this.client as any).rpc('get_thread_messages', {
      p_thread_id: threadId,
      p_before: options?.before ?? null,
      p_limit: limit + 1,
    });

    if (error) {
      throw new Error(error.message || 'Failed to load messages.');
    }

    const rows = (data as any[] | null) || [];
    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;

    const chronological = sliced
      .map(
        (m): DiscussionMessageDomainModel => ({
          id: m.id,
          threadId: m.thread_id,
          projectId: m.project_id,
          authorId: m.author_id,
          authorName: m.author_name || 'Member',
          authorAvatarUrl: m.author_avatar_url ?? null,
          authorRole: (m.author_role as ProjectRole) ?? null,
          parentMessageId: m.parent_message_id ?? null,
          body: m.body,
          mentionUserIds: Array.isArray(m.mention_user_ids) ? m.mention_user_ids : [],
          editedAt: m.edited_at ?? null,
          deletedAt: m.deleted_at ?? null,
          createdAt: m.created_at,
        })
      )
      .reverse();

    return { messages: chronological, hasMore };
  }

  async postMessage(input: PostDiscussionMessageInput): Promise<DiscussionMessageDomainModel> {
    this.assertRemoteProject(input.projectId);

    const { data, error } = await (this.client as any).rpc('post_discussion_message', {
      p_thread_id: input.threadId,
      p_body: input.body.trim(),
      p_parent_message_id: input.parentMessageId ?? null,
      p_mention_user_ids: input.mentionUserIds ?? [],
      p_client_request_id: input.clientRequestId,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Failed to post message.');
    }

    const row = data as any;
    const { data: { user } } = await this.client.auth.getUser();
    return {
      id: row.id,
      threadId: row.thread_id,
      projectId: row.project_id,
      authorId: row.author_id,
      authorName: (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'You',
      authorAvatarUrl: (user?.user_metadata?.avatar_url as string) || null,
      authorRole: null,
      parentMessageId: row.parent_message_id ?? null,
      body: row.body,
      mentionUserIds: Array.isArray(row.mention_user_ids) ? row.mention_user_ids : [],
      editedAt: row.edited_at ?? null,
      deletedAt: row.deleted_at ?? null,
      createdAt: row.created_at,
    };
  }

  async editMessage(messageId: string, body: string, mentionUserIds: string[] = []): Promise<void> {
    const { error } = await (this.client as any).rpc('edit_discussion_message', {
      p_message_id: messageId,
      p_body: body.trim(),
      p_mention_user_ids: mentionUserIds,
    });

    if (error) {
      throw new Error(error.message || 'Failed to edit message.');
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await (this.client as any).rpc('delete_discussion_message', {
      p_message_id: messageId,
    });

    if (error) {
      throw new Error(error.message || 'Failed to delete message.');
    }
  }

  async setThreadResolved(threadId: string, resolved: boolean): Promise<void> {
    const { error } = await (this.client as any).rpc('set_discussion_thread_resolved', {
      p_thread_id: threadId,
      p_resolved: resolved,
    });

    if (error) {
      throw new Error(error.message || 'Failed to update thread status.');
    }
  }

  async markThreadRead(threadId: string): Promise<void> {
    const { error } = await (this.client as any).rpc('mark_discussion_thread_read', {
      p_thread_id: threadId,
    });

    if (error) {
      console.warn('[Discussions] markThreadRead notice:', error.message);
    }
  }

  async getProjectUnreadCount(projectId: string): Promise<number> {
    if (getLocalProjectsList().some(p => p.id === projectId)) {
      return 0;
    }
    try {
      const { data, error } = await (this.client as any).rpc(
        'get_project_discussion_unread_count',
        { p_project_id: projectId }
      );
      if (error || typeof data !== 'number') return 0;
      return data;
    } catch {
      return 0;
    }
  }
}

function mapRpcNotification(row: any): NotificationDomainModel {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id ?? null,
    projectTitle: row.project_title ?? null,
    actorId: row.actor_id ?? null,
    actorName: row.actor_name ?? null,
    actorAvatarUrl: row.actor_avatar_url ?? null,
    category: row.category as NotificationCategory,
    eventType: row.event_type as NotificationEventType,
    priority: (row.priority || 'normal') as NotificationPriority,
    title: row.title,
    body: row.body ?? null,
    entityType: row.entity_type as NotificationEntityType,
    entityId: row.entity_id,
    entityLabel: row.entity_label ?? null,
    metadata: row.metadata || {},
    readAt: row.read_at ?? null,
    dismissedAt: row.dismissed_at ?? null,
    createdAt: row.created_at,
  };
}

function mapRpcNotificationPrefs(row: any, userIdFallback: string): NotificationPreferencesDomainModel {
  return {
    userId: row?.user_id || userIdFallback,
    mentionsEnabled: row?.mentions_enabled ?? true,
    discussionRepliesEnabled: row?.discussion_replies_enabled ?? true,
    taskAssignmentsEnabled: row?.task_assignments_enabled ?? true,
    scheduleChangesEnabled: row?.schedule_changes_enabled ?? true,
    callSheetsEnabled: row?.call_sheets_enabled ?? true,
    dprReviewsEnabled: row?.dpr_reviews_enabled ?? true,
    updatedAt: row?.updated_at || new Date().toISOString(),
  };
}

export class SupabaseNotificationService implements INotificationService {
  constructor(private client: SupabaseClient<Database>) {}

  private assertNotLocalProject(projectId?: string | null): void {
    if (projectId && (getLocalProjectsList().some(p => p.id === projectId) || !isValidUuid(projectId))) {
      throw new Error('Local-only projects do not support shared notifications or cross-device delivery.');
    }
  }

  async getNotifications(options?: {
    projectId?: string | null;
    filter?: NotificationFilter;
    beforeCreatedAt?: string;
    beforeId?: string;
    limit?: number;
  }): Promise<NotificationPage> {
    if (options?.projectId) {
      this.assertNotLocalProject(options.projectId);
    }

    const pageLimit = Math.min(Math.max(options?.limit ?? 25, 1), 50);
    const { data, error } = await (this.client as any).rpc('get_my_notifications', {
      p_project_id: options?.projectId ?? null,
      p_filter: options?.filter ?? 'all',
      p_cursor_created_at: options?.beforeCreatedAt ?? null,
      p_cursor_id: options?.beforeId ?? null,
      p_limit: pageLimit + 1,
    });

    if (error) {
      throw new Error(error.message || 'Unable to load notifications.');
    }

    const rows = Array.isArray(data) ? data : [];
    const hasMore = rows.length > pageLimit;
    const sliced = hasMore ? rows.slice(0, pageLimit) : rows;
    return {
      notifications: sliced.map(mapRpcNotification),
      hasMore,
    };
  }

  async getUnreadCount(projectId?: string | null): Promise<number> {
    if (projectId && (getLocalProjectsList().some(p => p.id === projectId) || !isValidUuid(projectId))) {
      return 0;
    }
    try {
      const { data, error } = await (this.client as any).rpc('get_my_unread_notification_count', {
        p_project_id: projectId ?? null,
      });
      if (error || typeof data !== 'number') return 0;
      return data;
    } catch {
      return 0;
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await (this.client as any).rpc('mark_notification_read', {
      p_notification_id: notificationId,
    });
    if (error) {
      throw new Error(error.message || 'Failed to mark notification as read.');
    }
  }

  async markAllAsRead(projectId?: string | null): Promise<number> {
    if (projectId) {
      this.assertNotLocalProject(projectId);
    }
    const { data, error } = await (this.client as any).rpc('mark_all_notifications_read', {
      p_project_id: projectId ?? null,
    });
    if (error) {
      throw new Error(error.message || 'Failed to mark notifications as read.');
    }
    return typeof data === 'number' ? data : 0;
  }

  async dismissNotification(notificationId: string): Promise<void> {
    const { error } = await (this.client as any).rpc('dismiss_notification', {
      p_notification_id: notificationId,
    });
    if (error) {
      throw new Error(error.message || 'Failed to dismiss notification.');
    }
  }

  async getPreferences(): Promise<NotificationPreferencesDomainModel> {
    const { data: { user } } = await this.client.auth.getUser();
    const { data, error } = await (this.client as any).rpc('get_my_notification_preferences');
    if (error) {
      throw new Error(error.message || 'Failed to load notification preferences.');
    }
    return mapRpcNotificationPrefs(data, user?.id || '');
  }

  async updatePreferences(
    updates: UpdateNotificationPreferencesInput
  ): Promise<NotificationPreferencesDomainModel> {
    const { data: { user } } = await this.client.auth.getUser();
    const { data, error } = await (this.client as any).rpc('update_my_notification_preferences', {
      p_mentions_enabled: updates.mentionsEnabled ?? null,
      p_discussion_replies_enabled: updates.discussionRepliesEnabled ?? null,
      p_task_assignments_enabled: updates.taskAssignmentsEnabled ?? null,
      p_schedule_changes_enabled: updates.scheduleChangesEnabled ?? null,
      p_call_sheets_enabled: updates.callSheetsEnabled ?? null,
      p_dpr_reviews_enabled: updates.dprReviewsEnabled ?? null,
    });
    if (error) {
      throw new Error(error.message || 'Failed to update notification preferences.');
    }
    return mapRpcNotificationPrefs(data, user?.id || '');
  }
}

export class SupabaseRealtimeCollaborationService implements IRealtimeCollaborationService {
  constructor(private client: SupabaseClient<Database>) {}

  private createDeduper(windowMs = 250) {
    const recent = new Map<string, number>();
    return (key: string): boolean => {
      const now = Date.now();
      const prev = recent.get(key);
      if (prev !== undefined && now - prev < windowMs) {
        return false;
      }
      recent.set(key, now);
      if (recent.size > 120) {
        for (const [k, ts] of recent.entries()) {
          if (now - ts > windowMs * 4) recent.delete(k);
        }
      }
      return true;
    };
  }

  connectUserChannel(params: {
    userId: string;
    onSignal: (signal: RealtimeCollabSignal) => void;
    onStatusChange?: (status: RealtimeConnectionStatus) => void;
  }): () => void {
    const { userId, onSignal, onStatusChange } = params;
    if (!isValidUuid(userId)) {
      return () => {};
    }

    let disposed = false;
    let activeChannel: ReturnType<SupabaseClient<Database>['channel']> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let hasSubscribedOnce = false;
    let wasDisconnected = false;
    const allowSignal = this.createDeduper();

    const clearTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const cleanupChannel = () => {
      if (activeChannel) {
        const ch = activeChannel;
        activeChannel = null;
        try {
          void this.client.removeChannel(ch);
        } catch {
          // Ignore channel teardown errors
        }
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;
      wasDisconnected = true;
      onStatusChange?.('reconnecting');
      const delay = Math.min(30000, 1000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
      attempt = Math.min(attempt + 1, 5);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!disposed) void subscribe();
      }, delay);
    };

    const subscribe = async () => {
      if (disposed) return;
      clearTimer();
      cleanupChannel();

      try {
        await (this.client.realtime as any).setAuth();
      } catch {
        // Session token may refresh asynchronously
      }

      if (disposed) return;
      const topic = `user:${userId}:notifications`;
      const channel = this.client.channel(topic, {
        config: { private: true },
      });
      activeChannel = channel;

      channel
        .on('broadcast', { event: 'notification_changed' }, (msg: any) => {
          const p = msg?.payload || {};
          const key = `notif:${p.event_type || ''}:${p.project_id || ''}:${p.op || ''}`;
          if (!allowSignal(key)) return;
          onSignal({
            scope: 'notifications',
            projectId: p.project_id ?? null,
            timestamp: p.ts || new Date().toISOString(),
          });
        })
        .on('broadcast', { event: 'membership_revoked' }, (msg: any) => {
          const p = msg?.payload || {};
          onSignal({
            scope: 'members',
            projectId: p.project_id ?? null,
            revoked: true,
            timestamp: p.ts || new Date().toISOString(),
          });
        })
        .subscribe((status: string) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            attempt = 0;
            onStatusChange?.('connected');
            if (hasSubscribedOnce && wasDisconnected) {
              wasDisconnected = false;
              onSignal({
                scope: 'reconcile',
                timestamp: new Date().toISOString(),
              });
            }
            hasSubscribedOnce = true;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            scheduleReconnect();
          }
        });
    };

    const handleOnline = () => {
      if (!disposed && wasDisconnected) {
        attempt = 0;
        void subscribe();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    onStatusChange?.('connecting');
    void subscribe();

    return () => {
      disposed = true;
      clearTimer();
      cleanupChannel();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }

  connectProjectChannel(params: {
    projectId: string;
    persistence: ProjectPersistence;
    user: { id: string; fullName: string; role: ProjectRole | null };
    activeModule?: string;
    onSignal: (signal: RealtimeCollabSignal) => void;
    onPresenceChange: (members: RealtimePresenceMember[]) => void;
    onStatusChange?: (status: RealtimeConnectionStatus) => void;
  }): ProjectRealtimeHandle {
    const { projectId, persistence, user, onSignal, onPresenceChange, onStatusChange } = params;

    if (persistence === 'local' || !isValidUuid(projectId) || !isValidUuid(user.id) || !user.role) {
      onPresenceChange([]);
      onStatusChange?.(persistence === 'local' ? 'local' : 'disconnected');
      return {
        updateModule: () => {},
        disconnect: () => {},
      };
    }

    let disposed = false;
    let currentModule = params.activeModule || 'overview';
    let collabChannel: ReturnType<SupabaseClient<Database>['channel']> | null = null;
    let presenceChannel: ReturnType<SupabaseClient<Database>['channel']> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let hasSubscribedOnce = false;
    let wasDisconnected = false;
    const allowSignal = this.createDeduper();

    const clearTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const cleanupChannels = () => {
      if (collabChannel) {
        const ch = collabChannel;
        collabChannel = null;
        try {
          void this.client.removeChannel(ch);
        } catch {
          // Ignore teardown errors
        }
      }
      if (presenceChannel) {
        const pch = presenceChannel;
        presenceChannel = null;
        try {
          void this.client.removeChannel(pch);
        } catch {
          // Ignore teardown errors
        }
      }
    };

    const syncPresenceSnapshot = () => {
      if (!presenceChannel || disposed) return;
      const state = presenceChannel.presenceState<any>();
      const list: RealtimePresenceMember[] = [];
      for (const [key, metas] of Object.entries(state || {})) {
        if (!Array.isArray(metas) || metas.length === 0) continue;
        const latest = metas[metas.length - 1];
        list.push({
          userId: latest.userId || key,
          fullName: latest.fullName || 'Project Member',
          role: latest.role || null,
          activeModule: latest.activeModule || null,
          onlineAt: latest.onlineAt || new Date().toISOString(),
        });
      }
      onPresenceChange(list);
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;
      wasDisconnected = true;
      onStatusChange?.('reconnecting');
      const delay = Math.min(30000, 1000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
      attempt = Math.min(attempt + 1, 5);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!disposed) void subscribeAll();
      }, delay);
    };

    const emitProjectSignal = (scope: RealtimeCollabScope, payload: any) => {
      const key = `${scope}:${payload?.thread_id || ''}:${payload?.message_id || payload?.activity_id || ''}`;
      if (!allowSignal(key)) return;
      onSignal({
        scope,
        projectId,
        threadId: payload?.thread_id ?? null,
        entityId: payload?.message_id ?? payload?.activity_id ?? null,
        timestamp: payload?.ts || new Date().toISOString(),
      });
    };

    const subscribeAll = async () => {
      if (disposed) return;
      clearTimer();
      cleanupChannels();

      try {
        await (this.client.realtime as any).setAuth();
      } catch {
        // Handled cleanly by retry/reconnect
      }
      if (disposed) return;

      const ch = this.client.channel(`project:${projectId}:collab`, {
        config: { private: true },
      });
      collabChannel = ch;

      ch.on('broadcast', { event: 'discussion_thread' }, (msg: any) =>
        emitProjectSignal('discussions', msg?.payload)
      )
        .on('broadcast', { event: 'discussion_message' }, (msg: any) =>
          emitProjectSignal('discussions', msg?.payload)
        )
        .on('broadcast', { event: 'activity_recorded' }, (msg: any) =>
          emitProjectSignal('activity', msg?.payload)
        )
        .on('broadcast', { event: 'membership_changed' }, (msg: any) =>
          emitProjectSignal('members', msg?.payload)
        )
        .on('broadcast', { event: 'operational_synced' }, (msg: any) =>
          emitProjectSignal('production', msg?.payload)
        )
        .subscribe((status: string) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            attempt = 0;
            onStatusChange?.('connected');
            if (hasSubscribedOnce && wasDisconnected) {
              wasDisconnected = false;
              onSignal({
                scope: 'reconcile',
                projectId,
                timestamp: new Date().toISOString(),
              });
            }
            hasSubscribedOnce = true;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            scheduleReconnect();
          }
        });

      const pch = this.client.channel(`project:${projectId}:presence`, {
        config: {
          private: true,
          presence: { key: user.id },
        },
      });
      presenceChannel = pch;

      pch
        .on('presence', { event: 'sync' }, syncPresenceSnapshot)
        .on('presence', { event: 'join' }, syncPresenceSnapshot)
        .on('presence', { event: 'leave' }, syncPresenceSnapshot)
        .subscribe(async (status: string) => {
          if (disposed || status !== 'SUBSCRIBED') return;
          try {
            await pch.track({
              userId: user.id,
              fullName: user.fullName,
              role: user.role,
              activeModule: currentModule,
              onlineAt: new Date().toISOString(),
            });
          } catch {
            // Presence failure must not disrupt main collaboration channel
          }
        });
    };

    const handleOnline = () => {
      if (!disposed && wasDisconnected) {
        attempt = 0;
        void subscribeAll();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    onStatusChange?.('connecting');
    void subscribeAll();

    return {
      updateModule: (moduleId: string) => {
        if (disposed || currentModule === moduleId) return;
        currentModule = moduleId;
        if (presenceChannel) {
          void presenceChannel.track({
            userId: user.id,
            fullName: user.fullName,
            role: user.role,
            activeModule: currentModule,
            onlineAt: new Date().toISOString(),
          });
        }
      },
      disconnect: () => {
        disposed = true;
        clearTimer();
        cleanupChannels();
        onPresenceChange([]);
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline);
        }
      },
    };
  }
}
