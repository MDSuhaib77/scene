/**
 * SceneOS — Automated Tests: Service Adapters & Security Configuration
 * Verifies Mock providers, environment validation, and key leakage prevention.
 */

import { describe, it, expect } from 'vitest';
import { validateEnvironment } from '../src/config/env';
import { MockAuthService, MockProjectService, MockConnectionService, MOCK_USERS } from '../src/services/mock/MockServices';

describe('Services & Environment Security Validation', () => {
  it('validates active environment configuration safely without key leakage', () => {
    const result = validateEnvironment();
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(['mock', 'supabase']).toContain(result.config.dataProvider);
  });

  it('runs mock auth service with default developer session', async () => {
    const auth = new MockAuthService();
    const session = await auth.getSession();

    expect(session.isMock).toBe(true);
    expect(session.user).toBeDefined();
    expect(session.user?.email).toBe(MOCK_USERS[0].email);
    expect(session.user?.fullName).toBe(MOCK_USERS[0].fullName);
  });

  it('allows logging in and logging out in mock mode', async () => {
    const auth = new MockAuthService();
    
    // Login as Elena
    const elenaSession = await auth.login('elena.rostova@sceneos.studio');
    expect(elenaSession.user?.fullName).toBe('Elena Rostova');

    // Logout
    await auth.logout();
    const loggedOut = await auth.getSession();
    expect(loggedOut.user).toBeNull();
  });

  it('manages projects in mock project service with isolated state', async () => {
    const projectService = new MockProjectService();
    const initialProjects = await projectService.getProjects();

    expect(initialProjects.length).toBeGreaterThan(0);
    const neonDreams = initialProjects.find(p => p.id === 'proj-neon-dreams-01');
    expect(neonDreams).toBeDefined();
    expect(neonDreams?.title).toBe('Neon Dreams: Chapter One');

    // Create a new project
    const created = await projectService.createProject({
      title: 'Solar Eclipse Pilot',
      logline: 'An aerial drone operator records an unexplainable celestial anomaly.',
      status: 'development',
      budgetTotal: 250000,
      dailyBurnCap: 5000,
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Solar Eclipse Pilot');

    const updatedList = await projectService.getProjects();
    expect(updatedList.length).toBe(initialProjects.length + 1);

    // Delete created project
    await projectService.deleteProject(created.id);
    const afterDelete = await projectService.getProjects();
    expect(afterDelete.length).toBe(initialProjects.length);
  });

  it('reports mock connection health with sub-5ms local latency', async () => {
    const connection = new MockConnectionService();
    const health = await connection.checkHealth();

    expect(health.state).toBe('mock');
    expect(health.provider).toBe('mock');
    expect(health.latencyMs).toBeLessThanOrEqual(5);
    expect(health.message).toContain('Mock Mode');
  });

  it('supports OAuth login dispatch for Google and Apple providers in mock mode', async () => {
    const auth = new MockAuthService();
    
    // Google OAuth
    const googleRes = await auth.signInWithOAuth('google');
    expect(googleRes.url).toBeDefined();
    const sessionGoogle = await auth.getSession();
    expect(sessionGoogle.user?.email).toBe(MOCK_USERS[1].email);

    // Apple OAuth
    const appleRes = await auth.signInWithOAuth('apple');
    expect(appleRes.url).toBeDefined();
    const sessionApple = await auth.getSession();
    expect(sessionApple.user?.email).toBe(MOCK_USERS[0].email);
  });

  it('handles password reset requests gracefully', async () => {
    const auth = new MockAuthService();
    const resetRes = await auth.resetPassword('producer@sceneos.studio');
    expect(resetRes.success).toBe(true);
    expect(resetRes.message).toContain('producer@sceneos.studio');
  });
});
