/**
 * SceneOS — Central Service Registry & Provider Factory
 * Deterministically constructs and exports the active services based on environment.
 * 
 * Strict Principle:
 * Never silently fall back from failed Supabase connection to Mock mode.
 * Provider choice is explicit and deterministic.
 */

import { config } from '../config/env';
import {
  IAuthService,
  IProjectService,
  IInvitationService,
  IActivityService,
  IConnectionService,
  IDiscussionService,
  INotificationService,
  IRealtimeCollaborationService,
} from './contracts/types';
import {
  MockAuthService,
  MockProjectService,
  MockInvitationService,
  MockActivityService,
  MockConnectionService,
  MockDiscussionService,
  MockNotificationService,
  MockRealtimeCollaborationService,
} from './mock/MockServices';
import { getSupabaseClient } from './supabase/supabaseClient';
import {
  SupabaseAuthService,
  SupabaseProjectService,
  SupabaseInvitationService,
  SupabaseActivityService,
  SupabaseConnectionService,
  SupabaseDiscussionService,
  SupabaseNotificationService,
  SupabaseRealtimeCollaborationService,
} from './supabase/SupabaseAdapters';

interface ServiceBundle {
  auth: IAuthService;
  projects: IProjectService;
  invitations: IInvitationService;
  activity: IActivityService;
  discussions: IDiscussionService;
  notifications: INotificationService;
  realtime: IRealtimeCollaborationService;
  connection: IConnectionService;
  provider: 'mock' | 'supabase';
}

function buildMockServicesBundle(): Omit<ServiceBundle, 'provider' | 'connection'> {
  const mockAuth = new MockAuthService();
  const getSession = () => mockAuth.peekSession();
  const mockProjects = new MockProjectService();
  const mockRealtime = new MockRealtimeCollaborationService(mockProjects);
  const mockActivity = new MockActivityService(mockProjects, getSession);
  mockActivity.attachRealtime(mockRealtime);
  const mockNotifications = new MockNotificationService(mockProjects, getSession);
  mockNotifications.attachRealtime(mockRealtime);
  mockProjects.attachCollaborationServices(mockActivity, mockNotifications, getSession, mockRealtime);

  return {
    auth: mockAuth,
    projects: mockProjects,
    invitations: new MockInvitationService(
      mockProjects,
      getSession,
      mockActivity,
      mockNotifications,
      mockRealtime
    ),
    activity: mockActivity,
    discussions: new MockDiscussionService(
      mockProjects,
      getSession,
      mockActivity,
      mockNotifications,
      mockRealtime
    ),
    notifications: mockNotifications,
    realtime: mockRealtime,
  };
}

function initializeServices(): ServiceBundle {
  if (config.dataProvider === 'supabase') {
    const client = getSupabaseClient();
    if (!client) {
      console.error('[SceneOS] VITE_DATA_PROVIDER is "supabase" but client initialization failed. Check credentials.');
      const fallbackBundle = buildMockServicesBundle();
      return {
        ...fallbackBundle,
        connection: {
          checkHealth: async () => ({
            state: 'error',
            provider: 'supabase',
            message: 'Supabase configuration error: Missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
            lastChecked: new Date().toISOString(),
          }),
        },
        provider: 'supabase',
      };
    }

    return {
      auth: new SupabaseAuthService(client),
      projects: new SupabaseProjectService(client),
      invitations: new SupabaseInvitationService(client),
      activity: new SupabaseActivityService(client),
      discussions: new SupabaseDiscussionService(client),
      notifications: new SupabaseNotificationService(client),
      realtime: new SupabaseRealtimeCollaborationService(client),
      connection: new SupabaseConnectionService(client),
      provider: 'supabase',
    };
  }

  // Default: Explicit Mock Mode
  return {
    ...buildMockServicesBundle(),
    connection: new MockConnectionService(),
    provider: 'mock',
  };
}

export const services = initializeServices();

export type {
  IAuthService,
  IProjectService,
  IInvitationService,
  IActivityService,
  IDiscussionService,
  INotificationService,
  IRealtimeCollaborationService,
  IConnectionService,
};
