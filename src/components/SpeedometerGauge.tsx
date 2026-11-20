import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon, Info, ShieldAlert } from 'lucide-react';

interface SpeedometerGaugeProps {
  value: number;
  max?: number;
  title: string;
  subtitle: string;
  unitText?: string;
  centerLabel: string;
  isDark: boolean;
  colorStyle?: 'classic-green-red' | 'cyan-blue' | 'purple-rose' | 'auto-health';
  icon?: LucideIcon;
  onClick?: () => void;
  id?: string;
}

export default function SpeedometerGauge({
  value,
  max = 100,
  title,
  subtitle,
  unitText = '%',
  centerLabel,
  isDark,
  colorStyle = 'classic-green-red',
  icon: Icon,
  onClick,
  id
}: SpeedometerGaugeProps) {
  // Normalize percentage
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  // Gauge angles matching full sweep 
  // Start angle is 210 degrees (bottom-left) and end angle is -30 degrees (bottom-right)
  const startAngle = 210;
  const endAngle = -30;
  const totalSweep = startAngle - endAngle; // 240 degrees
  const targetAngle = startAngle - (percentage / 100) * totalSweep;

  // Let's create sub-ticks (41 ticks for every 2.5% progression)
  const tickCount = 41;
  const tickArray = Array.from({ length: tickCount }, (_, i) => {
    const pct = (i / (tickCount - 1)) * 100;
    const angle = startAngle - (pct / 100) * totalSweep;
    return { pct, angle };
  });

  // Decide colors based on style and tick percentage
  const getTickColor = (pct: number, isActive: boolean) => {
    if (!isActive) {
      return isDark ? 'rgba(30, 41, 59, 0.35)' : 'rgba(219, 234, 254, 0.45)';
    }

    // Active colors depending on style
    let style = colorStyle;
    if (colorStyle === 'auto-health') {
      if (value >= 80) style = 'classic-green-red';
      else if (value >= 50) style = 'cyan-blue';
      else style = 'purple-rose'; // Low health triggers rose warning style
    }

    if (style === 'classic-green-red') {
      if (pct <= 65) return '#10b981'; // Emerald Green
      if (pct <= 85) return '#fbbf24'; // Warning Amber
      return '#ef4444'; // Danger Neon Red/Crimson
    } else if (style === 'cyan-blue') {
      if (pct <= 60) return '#06b6d4'; // Fluorescent Cyan
      if (pct <= 85) return '#3b82f6'; // Bright Indigo-Blue
      return '#a855f7'; // Light Purple
    } else {
      // purple-rose
      if (pct <= 50) return '#6366f1'; // Indigo-Purple
      if (pct <= 80) return '#ec4899'; // Punchy Pink
      return '#f43f5e'; // Deep Rose Neon
    }
  };

  // Determine global theme settings
  let activeThemeColor = '#10b981';
  let themeStyle = colorStyle;
  if (colorStyle === 'auto-health') {
    if (value >= 80) themeStyle = 'classic-green-red';
    else if (value >= 50) themeStyle = 'cyan-blue';
    else themeStyle = 'purple-rose';
  }

  if (themeStyle === 'classic-green-red') {
    activeThemeColor = percentage > 85 ? '#ef4444' : percentage > 65 ? '#fbbf24' : '#10b981';
  } else if (themeStyle === 'cyan-blue') {
    activeThemeColor = percentage > 85 ? '#a855f7' : '#06b6d4';
  } else {
    activeThemeColor = '#f43f5e';
  }

  // Create unique filter ID for the glowing needle shadow
  const uniqueGlowId = `needle-glow-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div 
      id={id}
      onClick={onClick}
      role="meter"
      aria-label={`${title}: ${value}${unitText}`}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`border-2 rounded-3xl p-5 flex flex-col items-center justify-between transition-all duration-300 group cursor-pointer hover:scale-[1.03] active:scale-[0.98] hover:-translate-y-1 relative select-none w-full ${
        isDark 
          ? 'bg-[#03050c] border-[#1e1b4b]/40 hover:border-indigo-500/50 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] hover:shadow-[rgba(99,102,241,0.12)_0px_0px_30px]' 
          : 'bg-white border-indigo-100/70 hover:border-indigo-400/80 shadow-[rgba(31,38,135,0.04)_0px_8px_24px] hover:shadow-[rgba(79,70,229,0.1)_0px_12px_28px]'
      }`}
      style={{
        backgroundImage: isDark
          ? 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)'
          : 'linear-gradient(rgba(99,102,241,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.015) 1px, transparent 1px)',
        backgroundSize: '14px 14px'
      }}
    >
      {/* Glossy Reflection Card Overlay (Dark Mode Only) */}
      {isDark && (
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none opacity-[0.03] bg-gradient-to-tr from-white via-transparent to-transparent z-0" />
      )}

      {/* Header Info */}
      <div className="w-full flex items-start justify-between gap-2 z-10 mb-4 pb-2 border-b border-zinc-500/10">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
          <span className={`font-mono text-[10px] tracking-widest uppercase font-black pl-0.5 select-none ${
            isDark ? 'text-zinc-400' : 'text-indigo-900/80'
          }`}>
            {title}
          </span>
        </div>
        <div className={`text-[10px] flex items-center justify-center gap-1 font-mono uppercase px-2 py-0.5 rounded-full ${
          isDark ? 'bg-zinc-900/60 text-zinc-400' : 'bg-indigo-50/50 text-indigo-700'
        }`}>
          <span>{centerLabel}</span>
        </div>
      </div>

      {/* Main Large Visual Speedometer */}
      <div className="relative w-full flex flex-col items-center justify-center py-2 h-[170px]">
        
        {/* Neon SVG Canvas container */}
        <svg 
          className="w-full h-full max-w-[220px] max-h-[150px] overflow-visible drop-shadow-[0_0_12px_rgba(0,0,0,0.15)]" 
          viewBox="0 0 240 160"
        >
          <defs>
            {/* Soft bloom filter for ticks & accents */}
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Custom glowing paint for the needle */}
            <filter id={uniqueGlowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feColorMatrix type="matrix" values="
                1 0 0 0 0
                0 0.5 0 0 0
                0 0 0.5 0 0
                0 0 0 1 0"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtly illuminated circular gauge backing */}
          <path 
            d="M 30 130 A 100 100 0 0 1 210 130" 
            fill="none" 
            stroke={isDark ? '#040715' : '#f1f5f9'} 
            strokeWidth="18" 
            strokeLinecap="round" 
            className="opacity-70"
          />

          {/* Smooth color gradient outline ring - representing progress background track */}
          <path 
            d="M 33 127 A 96 96 0 0 1 207 127" 
            fill="none" 
            stroke={isDark ? 'rgba(30, 41, 59, 0.45)' : '#e2e8f0'} 
            strokeWidth="2" 
            strokeLinecap="round"
          />

          {/* Glowing active progress background track arc segment */}
          {percentage > 0 && (
            <path 
              d="M 33 127 A 96 96 0 0 1 207 127" 
              fill="none" 
              stroke={activeThemeColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeDasharray="274"
              strokeDashoffset={274 * (1 - percentage / 100)}
              className="transition-all duration-1000 ease-out opacity-80"
              filter="url(#neon-glow)"
            />
          )}

          {/* Analogue Indicator Ticks loop (Just like supercar dashboards) */}
          {tickArray.map((t, idx) => {
            const isActive = t.pct <= percentage;
            const color = getTickColor(t.pct, isActive);
            
            // Major tick mark or minor tick mark
            const isMajor = idx % 4 === 0;
            const rOuter = 100;
            const rInner = isMajor ? 86 : 91;
            const strokeW = isMajor ? 2.5 : 1.2;

            const angleRad = (t.angle * Math.PI) / 180;
            const x1 = 120 + rOuter * Math.cos(angleRad);
            const y1 = 110 - rOuter * Math.sin(angleRad);
            const x2 = 120 + rInner * Math.cos(angleRad);
            const y2 = 110 - rInner * Math.sin(angleRad);

            return (
              <line 
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={strokeW}
                className="transition-colors duration-550"
                style={{
                  filter: isDark && isActive ? `drop-shadow(0 0 1.5px ${color})` : 'none'
                }}
              />
            );
          })}

          {/* Numeric speed indicators around the outer arc */}
          {[0, 20, 40, 60, 80, 100].map((num) => {
            const numAngle = startAngle - (num / 100) * totalSweep;
            const angleRad = (numAngle * Math.PI) / 180;
            
            // Placed beautifully inside the tick ring
            const numRadius = 72;
            const tx = 118 + numRadius * Math.cos(angleRad);
            const ty = 112 - numRadius * Math.sin(angleRad);
            const isPassed = percentage >= num;

            return (
              <text
                key={num}
                x={tx}
                y={ty}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isPassed ? "900" : "500"}
                className={`font-digital select-none transition-all duration-300 ${
                  isPassed
                    ? isDark ? 'text-white' : 'text-indigo-950'
                    : 'text-zinc-500/60'
                }`}
                style={{
                  fill: isPassed 
                    ? (isDark ? '#f8fafc' : '#1e1b4b') 
                    : (isDark ? '#4b5563' : '#94a3b8'),
                  textShadow: isDark && isPassed ? '0 0 6px rgba(255, 255, 255, 0.4)' : 'none'
                }}
              >
                {num}
              </text>
            );
          })}

          {/* Center Hub Core Base Chassis backplate */}
          <circle cx="120" cy="110" r="13" fill={isDark ? '#020409' : '#ffffff'} stroke={isDark ? '#2e1065' : '#e2e8f0'} strokeWidth="1.5" />
          <circle cx="120" cy="110" r="10" fill={isDark ? '#1e1b4b' : '#f1f5f9'} />

          {/* Glimmering sweeps analog Needle (Rotates under framer-motion) */}
          <g 
            style={{ transformOrigin: "120px 110px" }}
            className="transition-all duration-1000 ease-out"
          >
            {/* Animating line with custom glow */}
            <motion.line
              x1="120"
              y1="110"
              x2={120 + 94 * Math.cos((targetAngle * Math.PI) / 180)}
              y2={110 - 94 * Math.sin((targetAngle * Math.PI) / 180)}
              stroke="#ef4444"
              strokeWidth="3.2"
              strokeLinecap="round"
              initial={{ x2: 120 + 94 * Math.cos((startAngle * Math.PI) / 180), y2: 110 - 94 * Math.sin((startAngle * Math.PI) / 180) }}
              animate={{
                x2: 120 + 94 * Math.cos((targetAngle * Math.PI) / 180),
                y2: 110 - 94 * Math.sin((targetAngle * Math.PI) / 180)
              }}
              transition={{ type: "spring", stiffness: 75, damping: 14 }}
              filter={`url(#${uniqueGlowId})`}
            />

            {/* Inner tiny red core pointer needle cover */}
            <motion.line
              x1="120"
              y1="110"
              x2={120 + 93 * Math.cos((targetAngle * Math.PI) / 180)}
              y2={110 - 93 * Math.sin((targetAngle * Math.PI) / 180)}
              stroke="#ffedd5"
              strokeWidth="1.2"
              strokeLinecap="round"
              initial={{ x2: 120 + 93 * Math.cos((startAngle * Math.PI) / 180), y2: 110 - 93 * Math.sin((startAngle * Math.PI) / 180) }}
              animate={{
                x2: 120 + 93 * Math.cos((targetAngle * Math.PI) / 180),
                y2: 110 - 93 * Math.sin((targetAngle * Math.PI) / 180)
              }}
              transition={{ type: "spring", stiffness: 75, damping: 14 }}
            />
          </g>

          {/* Central hub metallic cap cover pin */}
          <circle cx="120" cy="110" r="5" fill="#ef4444" className="shadow" />
          <circle cx="120" cy="110" r="2.5" fill="#fef08a" />

          {/* Bottom Dial Center tag label  */}
          <text 
            x="120" 
            y="142" 
            textAnchor="middle" 
            fontSize="8" 
            fontWeight="bold" 
            className="font-mono tracking-widest select-none uppercase opacity-85"
            fill={isDark ? '#818cf8' : '#4f46e5'}
          >
            {unitText}
          </text>
        </svg>

        {/* Floating Digital Console HUD Readout beneath needle hub */}
        <div className={`absolute bottom-0 px-4 py-1.5 rounded-xl border font-digital text-center overflow-hidden flex flex-col items-center justify-center min-w-[100px] shadow-inner ${
          isDark 
            ? 'bg-[#020409]/95 border-indigo-500/25 shadow-black' 
            : 'bg-indigo-50/50 border-indigo-100 shadow-indigo-100'
        }`}>
          {/* Glass glare line */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-white/10 z-0" />
          <div className="flex items-baseline gap-0.5 relative z-10">
            <span 
              className={`text-2xl font-black tracking-tight leading-none ${
                isDark ? 'text-white' : 'text-indigo-950 font-black'
              }`}
              style={{
                textShadow: isDark 
                  ? `0 0 10px ${activeThemeColor}` 
                  : 'none'
              }}
            >
              {value}
            </span>
            <span className={`text-[10px] font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>{unitText}</span>
          </div>
        </div>
      </div>

      {/* Footer Text Details */}
      <div className="w-full text-center mt-3 space-y-1 z-10">
        <p className={`text-xs font-semibold leading-relaxed tracking-normal transition-colors group-hover:text-indigo-500 ${
          isDark ? 'text-zinc-250' : 'text-zinc-800'
        }`}>
          {subtitle}
        </p>
        
        {/* Decorative dynamic neon indicator bar on card bottom edge */}
        <div className="w-12 h-1 mx-auto rounded-full mt-2 transition-all duration-300 group-hover:w-20" 
          style={{
            backgroundColor: activeThemeColor,
            boxShadow: isDark ? `0 0 8px ${activeThemeColor}` : `0 0 4px ${activeThemeColor}`
          }}
        />
      </div>
    </div>
  );
}
