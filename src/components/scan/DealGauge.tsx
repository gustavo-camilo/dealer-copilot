import { useEffect, useId, useRef } from 'react';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { RollingNumber } from '../ui/RollingNumber';
import { cn } from '../ui';

interface DealGaugeProps {
  /** 0–100 */
  value: number;
  /** CSS color for the live arc, e.g. 'rgb(var(--success))'. */
  color: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'auto';
  /** Hide the numeric readout under the dial (for very small placements). */
  showValue?: boolean;
  className?: string;
}

const CX = 100;
const CY = 100;
const R = 80;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const widths = { sm: 'w-24', md: 'w-40', lg: 'w-52', auto: 'w-36 sm:w-52' };
const readout = { sm: 'text-sm', md: 'text-2xl', lg: 'text-3xl', auto: 'text-2xl sm:text-3xl' };

function polar(p: number, radius: number) {
  const angle = Math.PI - p * Math.PI;
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

// Ticks every 5%, longer every 10% (instrument-cluster style).
const TICKS = Array.from({ length: 21 }, (_, i) => {
  const major = i % 2 === 0;
  return { i, major, outer: polar(i / 20, R - 11), inner: polar(i / 20, R - (major ? 20 : 16)) };
});

/**
 * Tachometer-style meter. The arc fills and the needle sweeps on a spring;
 * one motion value is written straight to the SVG, so animating never re-renders React.
 */
export function DealGauge({ value, color, label = 'Confidence', size = 'md', showValue = true, className }: DealGaugeProps) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(Math.round(value || 0), 100));
  const progress = useMotionValue(0);
  const arcRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const needleRef = useRef<SVGGElement>(null);
  const glowId = useId().replace(/:/g, '');

  const paint = (p: number) => {
    const offset = String(100 - p * 100);
    arcRef.current?.setAttribute('stroke-dashoffset', offset);
    glowRef.current?.setAttribute('stroke-dashoffset', offset);
    needleRef.current?.setAttribute('transform', `rotate(${-90 + p * 180} ${CX} ${CY})`);
  };

  useMotionValueEvent(progress, 'change', paint);

  useEffect(() => {
    if (reduce) {
      progress.jump(clamped / 100);
      paint(clamped / 100);
      return;
    }
    const controls = animate(progress, clamped / 100, { type: 'spring', stiffness: 55, damping: 13, mass: 1 });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, reduce]);

  return (
    <div
      className={cn('flex flex-col items-center', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
    >
      <svg viewBox="0 0 200 108" className={cn('overflow-visible', widths[size])} aria-hidden>
        <defs>
          <filter id={glowId} x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {TICKS.map((t) => (
          <line
            key={t.i}
            x1={t.outer.x}
            y1={t.outer.y}
            x2={t.inner.x}
            y2={t.inner.y}
            stroke="rgb(var(--ink-subtle))"
            strokeOpacity={t.major ? 0.75 : 0.35}
            strokeWidth={t.major ? 1.6 : 1}
            strokeLinecap="round"
          />
        ))}

        <path d={ARC} fill="none" stroke="rgb(var(--line))" strokeWidth="7" strokeLinecap="round" />
        <path
          ref={glowRef}
          d={ARC}
          fill="none"
          stroke={color}
          strokeOpacity="0.5"
          strokeWidth="8"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset="100"
          filter={`url(#${glowId})`}
        />
        <path
          ref={arcRef}
          d={ARC}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset="100"
        />

        <g ref={needleRef} transform={`rotate(-90 ${CX} ${CY})`}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - R + 24} stroke="rgb(var(--ink))" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r="6.5" fill="rgb(var(--surface))" stroke="rgb(var(--ink))" strokeWidth="2.5" />
      </svg>

      {showValue && (
        <div className="mt-1.5 flex flex-col items-center gap-1">
          <span className={cn('font-semibold tracking-tight text-ink', readout[size])}>
            <RollingNumber value={clamped} format={(n) => String(Math.round(n))} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">{label}</span>
        </div>
      )}
    </div>
  );
}
