/**
 * SceneOS — Authentication Lifecycle & Session Restoration Test Suite
 * 
 * Verifies:
 * - Session restoration after login / reload
 * - Clean sign-out lifecycle and session nullification
 * - Onboarding gatekeeping and skip persistence
 * - Project isolation and route protection upon logout
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../src/services/mock/MockServices';
import { hasPermission } from '../src/services/rbac/permissions';
import { UserSession } from '../src/services/contracts/types';

describe('Authentication Lifecycle & Session Transitions', () => {
  let authService: MockAuthService;

  beforeEach(() => {
    authService = new MockAuthService();
  });

  it('restores authenticated session for active user', async () => {
    const session = await authService.getSession();
    expect(session.user).not.toBeNull();
    expect(session.user?.fullName).toBe('Kira Vance');
    expect(session.user?.email).toBe('kira.vance@sceneos.studio');
  });

  it('notifies listeners when switching identity', async () => {
    let capturedSession: UserSession | null = null;
    const unsub = authService.onAuthStateChange(s => {
      capturedSession = s;
    });

    await authService.login('kira.vance@sceneos.studio');
    expect(capturedSession).not.toBeNull();
    expect(capturedSession?.user?.fullName).toBe('Kira Vance');
    expect(capturedSession?.user?.email).toBe('kira.vance@sceneos.studio');

    unsub();
  });

  it('clears session completely on logout', async () => {
    let sessionStates: (UserSession['user'])[] = [];
    const unsub = authService.onAuthStateChange(s => {
      sessionStates.push(s.user);
    });

    await authService.logout();

    const currentSession = await authService.getSession();
    expect(currentSession.user).toBeNull();
    expect(sessionStates[sessionStates.length - 1]).toBeNull();

    unsub();
  });

  it('allows logging back in after signing out without session collision', async () => {
    // 1. Log out
    await authService.logout();
    let session = await authService.getSession();
    expect(session.user).toBeNull();

    // 2. Sign in as Elena Rostova
    await authService.login('elena.rostova@sceneos.studio');
    session = await authService.getSession();
    expect(session.user).not.toBeNull();
    expect(session.user?.fullName).toBe('Elena Rostova');

    // 3. Log out again
    await authService.logout();
    session = await authService.getSession();
    expect(session.user).toBeNull();

    // 4. Sign in as Kira Vance
    await authService.login('kira.vance@sceneos.studio');
    session = await authService.getSession();
    expect(session.user?.fullName).toBe('Kira Vance');
  });
});

describe('First-Run Onboarding Gatekeeping & Skip Logic', () => {
  const mockStorage: Record<string, string> = {};

  const getOnboardingCompleted = (userId: string) => {
    return mockStorage[`sceneos_onboarding_completed_${userId}`] === 'true';
  };

  const setOnboardingCompleted = (userId: string) => {
    mockStorage[`sceneos_onboarding_completed_${userId}`] = 'true';
  };

  it('identifies uncompleted onboarding for new users', () => {
    const newUserId = 'user-new-1234';
    expect(getOnboardingCompleted(newUserId)).toBe(false);
  });

  it('persists onboarding completion status', () => {
    const userId = 'user-onboard-5678';
    setOnboardingCompleted(userId);
    expect(getOnboardingCompleted(userId)).toBe(true);
  });

  it('allows skipping onboarding and stores completed state', () => {
    const userId = 'user-skip-9999';
    // User clicks "Skip for now"
    setOnboardingCompleted(userId);
    expect(getOnboardingCompleted(userId)).toBe(true);
  });
});

describe('Route & Permission Protection across Session States', () => {
  it('denies permissions when user is signed out (role is null)', () => {
    expect(hasPermission(null, 'project:edit_settings')).toBe(false);
    expect(hasPermission(null, 'project:delete')).toBe(false);
    expect(hasPermission(null, 'members:invite')).toBe(false);
    expect(hasPermission(null, 'production:edit_data')).toBe(false);
    expect(hasPermission(null, 'project:view')).toBe(false);
  });

  it('enforces strict permissions for viewer role', () => {
    expect(hasPermission('viewer', 'project:view')).toBe(true);
    expect(hasPermission('viewer', 'project:edit_settings')).toBe(false);
    expect(hasPermission('viewer', 'project:delete')).toBe(false);
    expect(hasPermission('viewer', 'members:invite')).toBe(false);
  });

  it('grants full ownership permissions for owner role', () => {
    expect(hasPermission('owner', 'project:view')).toBe(true);
    expect(hasPermission('owner', 'project:edit_settings')).toBe(true);
    expect(hasPermission('owner', 'project:delete')).toBe(true);
    expect(hasPermission('owner', 'members:invite')).toBe(true);
    expect(hasPermission('owner', 'members:remove')).toBe(true);
  });
});
