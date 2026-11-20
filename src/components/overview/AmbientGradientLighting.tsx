import React from 'react';

/**
 * AmbientGradientLighting
 *
 * Static, zero-CPU directional radial atmosphere behind Overview surfaces.
 * Eliminates continuous GPU blur(100px) animation behind backdrop-blur surfaces.
 */
export function AmbientGradientLighting({ isDark = true }: { isDark?: boolean }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden"
      aria-hidden="true"
      style={{
        contain: 'strict',
        backgroundImage: isDark
          ? 'radial-gradient(ellipse 680px 520px at 14% 12%, rgba(6, 182, 212, 0.14) 0%, transparent 72%), radial-gradient(ellipse 720px 540px at 86% 12%, rgba(99, 102, 241, 0.13) 0%, transparent 72%), radial-gradient(ellipse 880px 460px at 50% 78%, rgba(16, 185, 129, 0.10) 0%, transparent 72%)'
          : 'radial-gradient(ellipse 680px 520px at 14% 12%, rgba(6, 182, 212, 0.10) 0%, transparent 70%), radial-gradient(ellipse 720px 540px at 86% 12%, rgba(99, 102, 241, 0.09) 0%, transparent 70%)',
      }}
    />
  );
}
