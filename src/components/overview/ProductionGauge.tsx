import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface GaugeSubmetricItem {
  id: string;
  label: string;
  value: string;
  statusType?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  popover: {
    title: string;
    badge?: string;
    badgeType?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    whatItIs: string;
    whyItMatters: string;
    formulaOrEvidence?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
}

export interface ProductionGaugeProps {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  primaryValue: string;
  primaryLabel?: string;
  secondaryValue?: string;
  statusLabel: string;
  statusType: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  progressPercent: number | null; // null represents N/A or uncalibrated
  footerNote: string;
  submetrics?: GaugeSubmetricItem[];
  primaryPopover?: {
    title: string;
    badge?: string;
    badgeType?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    whatItIs: string;
    whyItMatters: string;
    formulaOrEvidence?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  isInteractive?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  ariaLabel: string;
  isDark?: boolean;
}

/**
 * Portal-based Collision-Aware Popover Overlay
 * 
 * Renders into document.body to guarantee:
 * 1. Zero parent container clipping (escapes all overflow: hidden ancestors).
 * 2. Zero stacking-context occlusion from sibling gauge cards or hero elements.
 * 3. Collision-aware positioning: horizontally clamped to viewport, vertically flips if insufficient headroom.
 * 4. Zero layout shifts or parent card resizing.
 */
function PortalPopoverOverlay({
  triggerRect,
  title,
  badge,
  badgeType = 'info',
  whatItIs,
  whyItMatters,
  formulaOrEvidence,
  actionLabel,
  onAction,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  triggerRect: DOMRect;
  title: string;
  badge?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  whatItIs: string;
  whyItMatters: string;
  formulaOrEvidence?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const [popoverHeight, setPopoverHeight] = React.useState(240);
  const popoverWidth = 288; // w-72 = 18rem = 288px
  const padding = 16;

  React.useLayoutEffect(() => {
    if (popoverRef.current) {
      setPopoverHeight(popoverRef.current.offsetHeight);
    }
  }, []);

  // Horizontal placement: Center on trigger, but clamp within workspace/sidebar & viewport boundaries
  const targetLeft = triggerRect.left + (triggerRect.width / 2) - (popoverWidth / 2);
  const workspaceEl = typeof document !== 'undefined' ? document.getElementById('project-workspace') : null;
  const canvasLeft = workspaceEl ? workspaceEl.getBoundingClientRect().left : 0;
  const minLeft = Math.max(padding, canvasLeft + 12);
  const maxLeft = typeof window !== 'undefined' ? window.innerWidth - popoverWidth - padding : 800;
  const clampedLeft = Math.max(minLeft, Math.min(maxLeft, targetLeft));

  // Vertical placement: Prefer above trigger; flip below if near top of viewport
  const showBelow = triggerRect.top < popoverHeight + padding;
  const topPos = showBelow 
    ? triggerRect.bottom + 8 
    : triggerRect.top - popoverHeight - 8;

  const badgeStyles = {
    success: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40',
    warning: 'bg-amber-950/90 text-amber-300 border-amber-500/40',
    danger: 'bg-rose-950/90 text-rose-300 border-rose-500/40',
    info: 'bg-cyan-950/90 text-cyan-300 border-cyan-500/40',
    neutral: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  }[badgeType];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="tooltip"
      style={{
        position: 'fixed',
        top: `${Math.max(padding, topPos)}px`,
        left: `${clampedLeft}px`,
        zIndex: 9999,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose?.();
      }}
      className="w-72 p-3.5 rounded-2xl border border-white/[0.18] bg-[#080d1a]/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.15)] text-left text-xs pointer-events-auto animate-fade-in"
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.08]">
        <span className="font-bold text-white text-xs tracking-wide">{title}</span>
        {badge && (
          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeStyles}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Popover Body */}
      <div className="py-2 space-y-2 text-zinc-300 text-[11px] leading-relaxed">
        <div>
          <span className="text-zinc-400 font-semibold uppercase tracking-wider block text-[10px] font-mono mb-0.5">What this measures</span>
          <p>{whatItIs}</p>
        </div>

        <div>
          <span className="text-zinc-400 font-semibold uppercase tracking-wider block text-[10px] font-mono mb-0.5">Operational impact</span>
          <p className="text-zinc-200">{whyItMatters}</p>
        </div>

        {formulaOrEvidence && (
          <div className="pt-1.5 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400">
            <span className="text-cyan-400/90 font-semibold">Evidence / Source: </span>
            <span>{formulaOrEvidence}</span>
          </div>
        )}
      </div>

      {/* Action button */}
      {actionLabel && onAction && (
        <div className="pt-2 border-t border-white/[0.08] flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction();
              onClose?.();
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 transition flex items-center gap-1 cursor-pointer"
          >
            <span>{actionLabel}</span>
            <span className="text-[10px]">→</span>
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

/**
 * ProductionGauge — Instrument-Grade Automotive Production Instrument
 * 
 * Features:
 * - Refined translucent glassmorphism revealing background gradient fields.
 * - Precise 240° graduated arc with calibrated major/minor scale markings.
 * - Perimeter needle pointing inward from scale ring (never intersects central typography).
 * - Centralized primary reading with large high-contrast font-mono value.
 * - Interactive submetric capsules with Portal-based collision-aware popovers.
 * - Functions as a primary interactive selector for its contextual metric detail view.
 */
export function ProductionGauge({
  id,
  title,
  icon: Icon,
  description,
  primaryValue,
  primaryLabel,
  secondaryValue,
  statusLabel,
  statusType,
  progressPercent,
  footerNote,
  submetrics,
  primaryPopover,
  isInteractive = true,
  isActive = false,
  onClick,
  ariaLabel,
  isDark = true,
}: ProductionGaugeProps) {
  // Popover state management
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [activeTriggerRect, setActiveTriggerRect] = useState<DOMRect | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const primaryRef = useRef<HTMLDivElement | null>(null);
  const submetricRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleMouseEnter = (popoverId: string, rect: DOMRect) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setActiveTriggerRect(rect);
    setActivePopoverId(popoverId);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = window.setTimeout(() => {
      setActivePopoverId(null);
      setActiveTriggerRect(null);
    }, 180);
  };

  const handlePopoverMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  // Clamp gauge needle value between 0 and 100
  const clamped = progressPercent === null ? 0 : Math.min(100, Math.max(0, progressPercent));

  // Gauge Geometry: 240° sweep from 210° (bottom-left) to -30° (bottom-right)
  const cx = 120;
  const cy = 100;
  const r = 78;

  // Arc length calculations: 240° of full circle
  const totalArcLength = (240 / 360) * 2 * Math.PI * r; // ~326.72
  const strokeOffset = progressPercent === null 
    ? totalArcLength 
    : totalArcLength - (clamped / 100) * totalArcLength;

  // Color mapping based on statusType
  const statusColors = {
    success: {
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/80',
      badgeBorder: 'border-emerald-500/40',
      badgeText: 'text-emerald-300',
      arcStroke: '#10b981',
      needleStroke: '#34d399',
    },
    warning: {
      text: 'text-amber-400',
      badgeBg: 'bg-amber-950/80',
      badgeBorder: 'border-amber-500/40',
      badgeText: 'text-amber-300',
      arcStroke: '#f59e0b',
      needleStroke: '#fbbf24',
    },
    danger: {
      text: 'text-rose-400',
      badgeBg: 'bg-rose-950/80',
      badgeBorder: 'border-rose-500/40',
      badgeText: 'text-rose-300',
      arcStroke: '#ef4444',
      needleStroke: '#f87171',
    },
    info: {
      text: 'text-cyan-400',
      badgeBg: 'bg-cyan-950/80',
      badgeBorder: 'border-cyan-500/40',
      badgeText: 'text-cyan-300',
      arcStroke: '#06b6d4',
      needleStroke: '#38bdf8',
    },
    neutral: {
      text: 'text-zinc-400',
      badgeBg: 'bg-zinc-800',
      badgeBorder: 'border-zinc-700',
      badgeText: 'text-zinc-400',
      arcStroke: '#64748b',
      needleStroke: '#94a3b8',
    },
  }[statusType];

  // SVG Graduated Ticks (Every 5% with differentiated major/minor marks)
  const tickMarks = React.useMemo(() => {
    const ticks = [];
    for (let pct = 0; pct <= 100; pct += 5) {
      const isMajor = pct % 25 === 0;
      const tDeg = 210 - (pct / 100) * 240;
      const tRad = (tDeg * Math.PI) / 180;
      const tickInnerR = isMajor ? r - 7.5 : r - 4;
      const tickOuterR = r + 1;

      ticks.push(
        <line
          key={pct}
          x1={cx + Math.cos(tRad) * tickInnerR}
          y1={cy - Math.sin(tRad) * tickInnerR}
          x2={cx + Math.cos(tRad) * tickOuterR}
          y2={cy - Math.sin(tRad) * tickOuterR}
          stroke={isMajor ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.2)'}
          strokeWidth={isMajor ? 1.4 : 0.75}
        />
      );
    }
    return ticks;
  }, [cx, cy, r]);

  // Indicator Needle coordinates (Positioned on dial scale ring, pointing inwards)
  const needleDeg = 210 - (clamped / 100) * 240;
  const needleRad = (needleDeg * Math.PI) / 180;
  
  const tipR = r - 9;
  const baseR = r + 4;
  const needleTipX = cx + Math.cos(needleRad) * tipR;
  const needleTipY = cy - Math.sin(needleRad) * tipR;
  
  const radDelta = 0.06;
  const baseLeftX = cx + Math.cos(needleRad + radDelta) * baseR;
  const baseLeftY = cy - Math.sin(needleRad + radDelta) * baseR;
  const baseRightX = cx + Math.cos(needleRad - radDelta) * baseR;
  const baseRightY = cy - Math.sin(needleRad - radDelta) * baseR;

  // Selected submetric for active popover
  const activeSubmetric = submetrics?.find(s => s.id === activePopoverId);

  return (
    <div
      id={`gauge-card-${id}`}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? 'button' : undefined}
      aria-label={ariaLabel}
      aria-selected={isInteractive ? isActive : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group p-4 rounded-2xl border transition-all duration-200 select-none flex flex-col justify-between min-h-[250px] ${
        activePopoverId ? 'relative z-40' : 'relative z-10'
      } ${
        isInteractive ? 'cursor-pointer' : 'cursor-default'
      } ${
        isActive
          ? 'bg-[#0d1830]/75 backdrop-blur-xl border-cyan-400/80 ring-1 ring-cyan-400/50 shadow-[0_8px_32px_rgba(6,182,212,0.22),inset_0_1px_1px_rgba(255,255,255,0.2)]'
          : isDark
            ? 'bg-[#090f1d]/50 backdrop-blur-xl border-white/[0.12] hover:border-cyan-400/40 hover:bg-[#0c1426]/65 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_1px_rgba(255,255,255,0.1)]'
            : 'bg-white/80 backdrop-blur-xl border-zinc-200/80 hover:border-zinc-300 shadow-sm'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400`}
    >
      {/* 1. TOP HEADER: TITLE, ICON & STATUS BADGE */}
      <div className="flex items-center justify-between gap-2 pb-1 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${statusColors.text}`} />
          <span className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-200 truncate">
            {title}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive && (
            <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/40">
              ● ACTIVE
            </span>
          )}
          <span 
            className={`text-[10px] font-sans font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${statusColors.badgeBg} ${statusColors.badgeBorder} ${statusColors.badgeText}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* 2. AUTOMOTIVE INSTRUMENT CLUSTER DIAL WITH UNCLUTTERED CENTER */}
      <div className="relative w-full flex items-center justify-center my-0.5 py-0.5">
        
        {/* SVG Dial Arc & Needle (Zero-Clipping Math) */}
        <div className="w-full max-w-[230px] h-[135px] relative flex items-center justify-center">
          <svg
            className="w-full h-full"
            viewBox="0 0 240 150"
            aria-hidden="true"
          >
            {/* Background Track Arc (240° Sweep) */}
            <path
              d="M 52.45 139 A 78 78 0 1 1 187.55 139"
              fill="none"
              stroke="#131d2e"
              strokeWidth="4.5"
              strokeLinecap="round"
            />

            {/* Subtle Scale Range Zones (Restrained colored track guides) */}
            <path
              d="M 52.45 139 A 78 78 0 0 1 68 62"
              fill="none"
              stroke="rgba(239, 68, 68, 0.15)"
              strokeWidth="2.5"
            />
            <path
              d="M 68 62 A 78 78 0 0 1 172 62"
              fill="none"
              stroke="rgba(245, 158, 11, 0.15)"
              strokeWidth="2.5"
            />
            <path
              d="M 172 62 A 78 78 0 0 1 187.55 139"
              fill="none"
              stroke="rgba(16, 185, 129, 0.15)"
              strokeWidth="2.5"
            />

            {/* Precision Graduated Scale Ticks */}
            {tickMarks}

            {/* Active Luminous Progress Arc (when calibrated) */}
            {progressPercent !== null && (
              <path
                d="M 52.45 139 A 78 78 0 1 1 187.55 139"
                fill="none"
                stroke={statusColors.arcStroke}
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={totalArcLength}
                strokeDashoffset={strokeOffset}
                className="transition-all duration-500 ease-out motion-reduce:transition-none"
              />
            )}

            {/* Automotive Perimeter Needle Pointer (Riding the scale without crossing center) */}
            {progressPercent !== null ? (
              <g className="transition-all duration-500 ease-out motion-reduce:transition-none">
                {/* Needle Triangular Indicator Tip */}
                <polygon
                  points={`${needleTipX},${needleTipY} ${baseLeftX},${baseLeftY} ${baseRightX},${baseRightY}`}
                  fill={statusColors.needleStroke}
                  stroke="#070c17"
                  strokeWidth="1"
                />
                {/* Luminous Core Marker */}
                <circle
                  cx={cx + Math.cos(needleRad) * r}
                  cy={cy - Math.sin(needleRad) * r}
                  r="2.5"
                  fill="#ffffff"
                  stroke={statusColors.needleStroke}
                  strokeWidth="1.5"
                />
              </g>
            ) : (
              /* Uncalibrated / Missing Data Indicator Dot at Origin */
              <circle cx={52.45} cy={139} r="3" fill="#64748b" />
            )}
          </svg>

          {/* Centered Readout Surface (Unobstructed by Needle, High Contrast) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 text-center pointer-events-auto">
            <div
              ref={primaryRef}
              tabIndex={primaryPopover ? 0 : undefined}
              role={primaryPopover ? 'button' : undefined}
              aria-label={primaryPopover ? `${primaryPopover.title}: ${primaryValue}` : undefined}
              onMouseEnter={() => {
                if (primaryPopover && primaryRef.current) {
                  handleMouseEnter('primary', primaryRef.current.getBoundingClientRect());
                }
              }}
              onMouseLeave={handleMouseLeave}
              onFocus={() => {
                if (primaryPopover && primaryRef.current) {
                  handleMouseEnter('primary', primaryRef.current.getBoundingClientRect());
                }
              }}
              onBlur={handleMouseLeave}
              onClick={(e) => {
                if (primaryPopover && primaryRef.current) {
                  e.stopPropagation();
                  if (activePopoverId === 'primary') {
                    setActivePopoverId(null);
                  } else {
                    handleMouseEnter('primary', primaryRef.current.getBoundingClientRect());
                  }
                }
              }}
              onKeyDown={(e) => {
                if (primaryPopover && (e.key === 'Enter' || e.key === ' ') && primaryRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activePopoverId === 'primary') {
                    setActivePopoverId(null);
                  } else {
                    handleMouseEnter('primary', primaryRef.current.getBoundingClientRect());
                  }
                }
              }}
              className={`inline-flex flex-col items-center rounded-lg px-2 py-0.5 transition ${
                primaryPopover ? 'cursor-help hover:bg-white/[0.04]' : ''
              }`}
            >
              <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight leading-none drop-shadow-sm ${statusColors.text}`}>
                {primaryValue}
              </span>

              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400 mt-1">
                {primaryLabel || (secondaryValue ? secondaryValue : 'METRIC READOUT')}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. SUBMETRICS SECTION: DATA-RICH CAPSULES */}
      {submetrics && submetrics.length > 0 && (
        <div className="w-full grid grid-cols-3 gap-1.5 pt-1 relative z-20">
          {submetrics.map((item) => (
            <div
              key={item.id}
              ref={(el) => { submetricRefs.current[item.id] = el; }}
              tabIndex={0}
              role="button"
              aria-label={`${item.label}: ${item.value}. Press enter or hover to inspect.`}
              onMouseEnter={() => {
                const el = submetricRefs.current[item.id];
                if (el) handleMouseEnter(item.id, el.getBoundingClientRect());
              }}
              onMouseLeave={handleMouseLeave}
              onFocus={() => {
                const el = submetricRefs.current[item.id];
                if (el) handleMouseEnter(item.id, el.getBoundingClientRect());
              }}
              onBlur={handleMouseLeave}
              onClick={(e) => {
                e.stopPropagation();
                const el = submetricRefs.current[item.id];
                if (el) {
                  if (activePopoverId === item.id) {
                    setActivePopoverId(null);
                  } else {
                    handleMouseEnter(item.id, el.getBoundingClientRect());
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  const el = submetricRefs.current[item.id];
                  if (el) {
                    if (activePopoverId === item.id) {
                      setActivePopoverId(null);
                    } else {
                      handleMouseEnter(item.id, el.getBoundingClientRect());
                    }
                  }
                }
              }}
              className={`px-1.5 py-1 rounded-xl border text-center transition-all cursor-help flex flex-col justify-center items-center ${
                activePopoverId === item.id
                  ? 'bg-cyan-950/70 border-cyan-400/70 ring-1 ring-cyan-400/50 shadow-sm'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.1] hover:border-white/[0.22]'
              }`}
            >
              <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-zinc-400 block truncate w-full">
                {item.label}
              </span>
              <span className={`text-[11px] font-mono font-bold truncate w-full mt-0.5 ${
                item.statusType === 'danger' ? 'text-rose-400' :
                item.statusType === 'warning' ? 'text-amber-400' :
                item.statusType === 'success' ? 'text-emerald-400' :
                item.statusType === 'info' ? 'text-cyan-300' :
                'text-zinc-200'
              }`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 4. FOOTER: OPERATIONAL CONTEXT & SELECTOR PROMPT */}
      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono relative z-10">
        <span className="text-zinc-400 text-[11px] truncate max-w-[170px]" title={footerNote}>
          {footerNote}
        </span>

        {isInteractive && (
          <div className="shrink-0 flex items-center gap-1">
            {isActive ? (
              <span className="text-cyan-300 font-sans font-semibold text-[11px]">
                Showing Detail
              </span>
            ) : (
              <span className="text-zinc-400 group-hover:text-cyan-300 font-sans font-medium text-[11px] transition flex items-center gap-1">
                <span>Select</span>
                <span>→</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 5. PORTAL POPOVER OVERLAY (Rendered to document.body, collision-aware, zero-clipping) */}
      {activePopoverId === 'primary' && primaryPopover && activeTriggerRect && (
        <PortalPopoverOverlay
          triggerRect={activeTriggerRect}
          title={primaryPopover.title}
          badge={primaryPopover.badge}
          badgeType={primaryPopover.badgeType}
          whatItIs={primaryPopover.whatItIs}
          whyItMatters={primaryPopover.whyItMatters}
          formulaOrEvidence={primaryPopover.formulaOrEvidence}
          actionLabel={primaryPopover.actionLabel}
          onAction={primaryPopover.onAction}
          onClose={() => setActivePopoverId(null)}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}

      {activeSubmetric && activeTriggerRect && (
        <PortalPopoverOverlay
          triggerRect={activeTriggerRect}
          title={activeSubmetric.popover.title}
          badge={activeSubmetric.popover.badge}
          badgeType={activeSubmetric.popover.badgeType}
          whatItIs={activeSubmetric.popover.whatItIs}
          whyItMatters={activeSubmetric.popover.whyItMatters}
          formulaOrEvidence={activeSubmetric.popover.formulaOrEvidence}
          actionLabel={activeSubmetric.popover.actionLabel}
          onAction={activeSubmetric.popover.onAction}
          onClose={() => setActivePopoverId(null)}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}
    </div>
  );
}
