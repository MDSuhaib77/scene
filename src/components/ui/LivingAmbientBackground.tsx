import React from 'react';

interface LivingAmbientBackgroundProps {
  isDark: boolean;
  activeTab?: string;
}

interface ThemeAtmosphere {
  bgColor: string;
  bgGradients: string;
  lightBgColor: string;
  lightGradients: string;
}

const MODULE_ATMOSPHERES: Record<string, ThemeAtmosphere> = {
  screenplay: {
    bgColor: '#070914',
    bgGradients:
      'radial-gradient(circle at 18% 14%, rgba(0, 245, 255, 0.14) 0%, transparent 48%), radial-gradient(circle at 82% 26%, rgba(139, 92, 246, 0.14) 0%, transparent 50%), radial-gradient(circle at 50% 88%, rgba(6, 182, 212, 0.10) 0%, transparent 52%), radial-gradient(circle at 85% 82%, rgba(124, 58, 237, 0.08) 0%, transparent 46%)',
    lightBgColor: '#F4F7FB',
    lightGradients:
      'radial-gradient(circle at 18% 14%, rgba(8, 145, 178, 0.09) 0%, transparent 48%), radial-gradient(circle at 82% 26%, rgba(124, 58, 237, 0.08) 0%, transparent 50%), radial-gradient(circle at 50% 88%, rgba(6, 182, 212, 0.06) 0%, transparent 52%)',
  },
  breakdown: {
    bgColor: '#020B06',
    bgGradients:
      'radial-gradient(circle at 20% 15%, rgba(16, 185, 129, 0.14) 0%, transparent 50%), radial-gradient(circle at 80% 25%, rgba(20, 184, 166, 0.13) 0%, transparent 48%), radial-gradient(circle at 45% 85%, rgba(132, 204, 22, 0.08) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(5, 150, 105, 0.10) 0%, transparent 50%)',
    lightBgColor: '#F0FDF4',
    lightGradients:
      'radial-gradient(circle at 20% 15%, rgba(16, 185, 129, 0.10) 0%, transparent 50%), radial-gradient(circle at 80% 25%, rgba(13, 148, 136, 0.09) 0%, transparent 48%), radial-gradient(circle at 45% 85%, rgba(101, 163, 13, 0.06) 0%, transparent 45%)',
  },
  visualize: {
    bgColor: '#0A0B0D',
    bgGradients:
      'radial-gradient(circle at 22% 16%, rgba(245, 240, 0, 0.11) 0%, transparent 46%), radial-gradient(circle at 80% 28%, rgba(255, 211, 78, 0.12) 0%, transparent 48%), radial-gradient(circle at 42% 86%, rgba(245, 166, 35, 0.09) 0%, transparent 46%), radial-gradient(circle at 85% 82%, rgba(156, 116, 28, 0.08) 0%, transparent 45%)',
    lightBgColor: '#FEFCE8',
    lightGradients:
      'radial-gradient(circle at 22% 16%, rgba(202, 138, 4, 0.09) 0%, transparent 46%), radial-gradient(circle at 80% 28%, rgba(217, 119, 6, 0.08) 0%, transparent 48%), radial-gradient(circle at 42% 86%, rgba(245, 158, 11, 0.06) 0%, transparent 46%)',
  },
  production: {
    bgColor: '#10090D',
    bgGradients:
      'radial-gradient(circle at 20% 16%, rgba(255, 23, 68, 0.14) 0%, transparent 48%), radial-gradient(circle at 82% 26%, rgba(230, 57, 80, 0.12) 0%, transparent 46%), radial-gradient(circle at 45% 85%, rgba(194, 24, 69, 0.11) 0%, transparent 50%), radial-gradient(circle at 85% 80%, rgba(101, 21, 45, 0.16) 0%, transparent 52%)',
    lightBgColor: '#FFF1F2',
    lightGradients:
      'radial-gradient(circle at 20% 16%, rgba(225, 29, 72, 0.09) 0%, transparent 48%), radial-gradient(circle at 82% 26%, rgba(190, 18, 60, 0.08) 0%, transparent 46%), radial-gradient(circle at 45% 85%, rgba(159, 18, 57, 0.06) 0%, transparent 50%)',
  },
  assets: {
    bgColor: '#10091B',
    bgGradients:
      'radial-gradient(circle at 18% 15%, rgba(180, 92, 255, 0.14) 0%, transparent 48%), radial-gradient(circle at 82% 26%, rgba(146, 59, 255, 0.13) 0%, transparent 50%), radial-gradient(circle at 48% 86%, rgba(118, 40, 217, 0.11) 0%, transparent 48%), radial-gradient(circle at 85% 80%, rgba(66, 21, 111, 0.15) 0%, transparent 52%)',
    lightBgColor: '#FAF5FF',
    lightGradients:
      'radial-gradient(circle at 18% 15%, rgba(124, 58, 237, 0.09) 0%, transparent 48%), radial-gradient(circle at 82% 26%, rgba(168, 85, 247, 0.08) 0%, transparent 50%), radial-gradient(circle at 48% 86%, rgba(109, 40, 217, 0.06) 0%, transparent 48%)',
  },
  vault: {
    bgColor: '#10091B',
    bgGradients:
      'radial-gradient(circle at 18% 15%, rgba(180, 92, 255, 0.14) 0%, transparent 48%), radial-gradient(circle at 82% 26%, rgba(146, 59, 255, 0.13) 0%, transparent 50%), radial-gradient(circle at 48% 86%, rgba(118, 40, 217, 0.11) 0%, transparent 48%), radial-gradient(circle at 85% 80%, rgba(66, 21, 111, 0.15) 0%, transparent 52%)',
    lightBgColor: '#FAF5FF',
    lightGradients:
      'radial-gradient(circle at 18% 15%, rgba(124, 58, 237, 0.09) 0%, transparent 48%), radial-gradient(circle at 82% 26%, rgba(168, 85, 247, 0.08) 0%, transparent 50%), radial-gradient(circle at 48% 86%, rgba(109, 40, 217, 0.06) 0%, transparent 48%)',
  },
  overview: {
    bgColor: '#07080D',
    bgGradients:
      'radial-gradient(circle at 20% 15%, rgba(99, 102, 241, 0.10) 0%, transparent 50%), radial-gradient(circle at 80% 25%, rgba(6, 182, 212, 0.08) 0%, transparent 48%), radial-gradient(circle at 35% 82%, rgba(180, 92, 255, 0.07) 0%, transparent 46%), radial-gradient(circle at 82% 80%, rgba(255, 23, 68, 0.06) 0%, transparent 48%)',
    lightBgColor: '#F8FAFC',
    lightGradients:
      'radial-gradient(circle at 20% 15%, rgba(99, 102, 241, 0.07) 0%, transparent 50%), radial-gradient(circle at 80% 25%, rgba(8, 145, 178, 0.06) 0%, transparent 48%), radial-gradient(circle at 35% 82%, rgba(124, 58, 237, 0.05) 0%, transparent 46%), radial-gradient(circle at 82% 80%, rgba(225, 29, 72, 0.05) 0%, transparent 48%)',
  },
  dashboard: {
    bgColor: '#070A12',
    bgGradients:
      'radial-gradient(ellipse 60% 65% at 5% 28%, rgba(6, 182, 212, 0.16) 0%, rgba(14, 116, 144, 0.08) 35%, transparent 68%), radial-gradient(ellipse 60% 65% at 95% 30%, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.07) 35%, transparent 68%), radial-gradient(ellipse 75% 55% at 50% 95%, rgba(29, 78, 216, 0.14) 0%, rgba(30, 58, 138, 0.06) 45%, transparent 75%)',
    lightBgColor: '#F4F6FB',
    lightGradients:
      'radial-gradient(ellipse 60% 65% at 5% 28%, rgba(8, 145, 178, 0.09) 0%, transparent 65%), radial-gradient(ellipse 60% 65% at 95% 30%, rgba(124, 58, 237, 0.08) 0%, transparent 65%), radial-gradient(ellipse 75% 55% at 50% 95%, rgba(29, 78, 216, 0.07) 0%, transparent 70%)',
  },
  landing: {
    bgColor: '#070A12',
    bgGradients:
      'radial-gradient(ellipse 60% 65% at 5% 28%, rgba(6, 182, 212, 0.16) 0%, rgba(14, 116, 144, 0.08) 35%, transparent 68%), radial-gradient(ellipse 60% 65% at 95% 30%, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.07) 35%, transparent 68%), radial-gradient(ellipse 75% 55% at 50% 95%, rgba(29, 78, 216, 0.14) 0%, rgba(30, 58, 138, 0.06) 45%, transparent 75%)',
    lightBgColor: '#F4F6FB',
    lightGradients:
      'radial-gradient(ellipse 60% 65% at 5% 28%, rgba(8, 145, 178, 0.09) 0%, transparent 65%), radial-gradient(ellipse 60% 65% at 95% 30%, rgba(124, 58, 237, 0.08) 0%, transparent 65%), radial-gradient(ellipse 75% 55% at 50% 95%, rgba(29, 78, 216, 0.07) 0%, transparent 70%)',
  },
};

/**
 * Dynamic cinematic radial atmosphere tailored per module.
 * Provides full-workspace ambient illumination transitioning naturally into light and dark environments.
 */
export function LivingAmbientBackground({ isDark, activeTab = 'overview' }: LivingAmbientBackgroundProps) {
  const normalizedTab = activeTab?.toLowerCase() || 'overview';
  const atmosphere = MODULE_ATMOSPHERES[normalizedTab] || MODULE_ATMOSPHERES.overview;

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none transition-all duration-500 ease-out"
      aria-hidden="true"
      style={{
        contain: 'strict',
        backgroundColor: isDark ? atmosphere.bgColor : atmosphere.lightBgColor,
        backgroundImage: isDark ? atmosphere.bgGradients : atmosphere.lightGradients,
      }}
    />
  );
}
