import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).window = globalThis;

import App from '../src/App';
import { ProjectProvider } from '../src/features/projects/ProjectContext';

describe('App mounting diagnosis', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('checks what renders when screen is dashboard and projects is empty array', () => {
    localStorage.setItem('cp_uname', 'Muhammad Suhaib');
    localStorage.setItem('cp_urole', 'Line Producer');
    localStorage.setItem('cp_screen', 'dashboard');

    const html = renderToString(
      <ProjectProvider>
        <App />
      </ProjectProvider>
    );

    console.log('--- DASHBOARD EMPTY PROJECTS ---');
    console.log('HTML length:', html.length);
    console.log('Contains dashboard-screen:', html.includes('id="dashboard-screen"'));
    console.log('Contains Your productions will appear here:', html.includes('Your productions will appear here'));
    console.log('Contains Create Production:', html.includes('Create Production'));
    expect(html).toContain('id="dashboard-screen"');
  });

  it('checks what renders when screen was saved as onboarding - safely routes to dashboard', () => {
    localStorage.setItem('cp_uname', 'Muhammad Suhaib');
    localStorage.setItem('cp_urole', 'Line Producer');
    localStorage.setItem('cp_screen', 'onboarding');

    const html = renderToString(
      <ProjectProvider>
        <App />
      </ProjectProvider>
    );

    console.log('--- ONBOARDING FALLBACK TO DASHBOARD ---');
    console.log('HTML length:', html.length);
    console.log('Contains dashboard-screen:', html.includes('id="dashboard-screen"'));
    console.log('Contains Create Production:', html.includes('Create Production'));
    expect(html).toContain('id="dashboard-screen"');
    expect(html).toContain('Create Production');
  });

  it('renders Dashboard with active project card cleanly without throwing', () => {
    localStorage.setItem('cp_uname', 'Muhammad Suhaib');
    localStorage.setItem('cp_urole', 'Line Producer');
    localStorage.setItem('cp_screen', 'dashboard');

    const html = renderToString(
      <ProjectProvider>
        <App />
      </ProjectProvider>
    );
    expect(html).toContain('PRODUCTION STUDIO');
    expect(html).toContain('Welcome back');
    expect(html).toContain('Muhammad Suhaib');
  });
});
