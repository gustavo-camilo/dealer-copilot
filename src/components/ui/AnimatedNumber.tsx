import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  /** Seconds. */
  duration?: number;
  className?: string;
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Counts from the previous value to the new one. The first render counts up
 * from zero, which is the "reveal" moment for verdicts and stats.
 */
export function AnimatedNumber({ value, format = defaultFormat, duration = 0.9, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setDisplay,
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <span className={`tabular ${className ?? ''}`}>{format(display)}</span>;
}
