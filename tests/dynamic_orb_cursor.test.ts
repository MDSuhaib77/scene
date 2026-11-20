import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SceneOS — Dynamic Inverting Orb Cursor Architecture', () => {
  const root = path.resolve(__dirname, '..');

  it('verifies DynamicOrbCursor component definition and specifications', () => {
    const cursorFile = fs.readFileSync(
      path.join(root, 'src/components/ui/DynamicOrbCursor.tsx'),
      'utf-8'
    );

    // Fine pointer and hover media queries
    expect(cursorFile).toContain('(hover: hover) and (pointer: fine)');
    expect(cursorFile).toContain('(prefers-reduced-motion: reduce)');

    // CSS active class applied only on capable fine-pointer devices
    expect(cursorFile).toContain('sceneos-orb-cursor-active');

    // Touchscreen deactivation fallback
    expect(cursorFile).toContain('touchstart');

    // Context-sensitive interactive and text input detection
    expect(cursorFile).toContain('isInteractive');
    expect(cursorFile).toContain('isTextInput');
    expect(cursorFile).toContain('translate3d');
    expect(cursorFile).toContain('translate(-50%, -50%)');

    // DOM identifier
    expect(cursorFile).toContain('sceneos-dynamic-orb-cursor');
    expect(cursorFile).toContain('sceneos-orb-cursor-element');
  });

  it('verifies optical glass inversion and non-intercepting pointer CSS rules in index.css', () => {
    const cssContent = fs.readFileSync(
      path.join(root, 'src/index.css'),
      'utf-8'
    );

    // 20px resting orb size
    expect(cssContent).toContain('width: 20px;');
    expect(cssContent).toContain('height: 20px;');

    // Difference blend mode on optical white gradient for mathematical colour inversion
    expect(cssContent).toContain('mix-blend-mode: difference;');
    expect(cssContent).toContain('#ffffff 0%');

    // Layered glass specular highlight, bevel rim and soft shadow
    expect(cssContent).toContain('sceneos-orb-cursor-element::before');
    expect(cssContent).toContain('sceneos-orb-cursor-element::after');
    expect(cssContent).toContain('inset 1.5px 2px 2.5px 0 rgba(255, 255, 255, 0.95)');

    // Non-intercepting pointer events
    expect(cssContent).toContain('pointer-events: none !important;');
    expect(cssContent).toContain('z-index: 9999999;');

    // Hide native cursor only when active and on fine-pointer devices
    expect(cssContent).toContain('@media (hover: hover) and (pointer: fine)');
    expect(cssContent).toContain('html.sceneos-orb-cursor-active');
    expect(cssContent).toContain('cursor: none !important;');

    // Preserve native text cursor for precise typing and selection
    expect(cssContent).toContain('cursor: text !important;');
  });

  it('verifies DynamicOrbCursor is mounted in App.tsx shell', () => {
    const appContent = fs.readFileSync(
      path.join(root, 'src/App.tsx'),
      'utf-8'
    );

    expect(appContent).toContain("import { DynamicOrbCursor } from './components/ui/DynamicOrbCursor';");
    expect(appContent).toContain('<DynamicOrbCursor />');
  });
});
