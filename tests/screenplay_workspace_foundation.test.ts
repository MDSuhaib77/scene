import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { plainTextToHtml } from '../src/features/screenplay/components/ScreenplayEditor';

const ROOT = path.resolve(__dirname, '..');

describe('Screenplay Workspace Foundation (Prompt 01)', () => {
  const requiredFiles = [
    'src/features/screenplay/ScreenplayWorkspace.tsx',
    'src/features/screenplay/components/ScreenplayToolbar.tsx',
    'src/features/screenplay/components/ScreenplayNavigationRail.tsx',
    'src/features/screenplay/components/ScreenplayNavigationPanel.tsx',
    'src/features/screenplay/components/ScreenplayDocumentViewport.tsx',
    'src/features/screenplay/components/ScreenplayPage.tsx',
    'src/features/screenplay/components/ScreenplayEditor.tsx',
  ];

  it('provides all modular screenplay workspace foundation components', () => {
    for (const relPath of requiredFiles) {
      const fullPath = path.join(ROOT, relPath);
      expect(fs.existsSync(fullPath), `Expected ${relPath} to exist`).toBe(true);
    }
  });

  it('converts plain screenplay text into clean paragraph HTML for Tiptap StarterKit', () => {
    expect(plainTextToHtml('')).toBe('<p></p>');
    const sample = 'INT. STUDIO - NIGHT\n\nA single light hums.';
    expect(plainTextToHtml(sample)).toBe(
      '<p>INT. STUDIO - NIGHT</p><p></p><p>A single light hums.</p>'
    );
  });

  it('contains no fake coming-soon alerts, dead placeholder callbacks, or offline badges in screenplay files', () => {
    for (const relPath of requiredFiles) {
      const source = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      expect(source).not.toMatch(/Coming soon/i);
      expect(source).not.toMatch(/Screenplay Module Offline/i);
      expect(source).not.toMatch(/onClick=\{\(\)\s*=>\s*\{\s*\}\}/);
    }
  });

  it('mounts ScreenplayWorkspace inside App.tsx and keeps AppSidebar hover expansion in an overlay slot', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    expect(appSource).toContain("import { ScreenplayWorkspace } from './features/screenplay/ScreenplayWorkspace'");
    expect(appSource).toContain('<ScreenplayWorkspace');
    expect(appSource).not.toContain('Screenplay Module Offline');

    const sidebarSource = fs.readFileSync(
      path.join(ROOT, 'src/components/navigation/AppSidebar.tsx'),
      'utf8'
    );
    expect(sidebarSource).toContain("isPinned ? 'w-64' : 'w-[68px]'");
    expect(sidebarSource).toContain('absolute top-0 left-0 h-full');
  });
});
