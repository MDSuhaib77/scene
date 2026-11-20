import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScreenplayWorkspace } from '../src/features/screenplay/ScreenplayWorkspace';
import { FilmProject } from '../src/types';

describe('Diagnose Black Screen', () => {
  it('checks if ScreenplayWorkspace renders or crashes on new draft', () => {
    const mockProject: FilmProject = {
      id: 'proj-test-1',
      title: 'Test Movie',
      logline: '',
      genre: 'Drama',
      targetAudience: 'Adults',
      estimatedBudget: 1000000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'development',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      screenplayVersions: [],
    };

    let updatedProject: any = null;
    const html = renderToStaticMarkup(
      <ScreenplayWorkspace
        project={mockProject}
        onUpdateProject={(p) => {
          updatedProject = p;
        }}
        initialSubmodule="library"
      />
    );
    expect(html).toContain('data-testid="screenplay-workspace-root"');
  });
});
