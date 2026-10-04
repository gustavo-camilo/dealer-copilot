import { motion, useReducedMotion } from 'framer-motion';
import { formatUSD } from './format';
import { cn } from './cn';

interface RollingNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  /** Roll up from zero on first render (the "reveal"). */
  rollOnMount?: boolean;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Odometer-style number: every digit rolls independently on a spring.
 * Columns are keyed from the right so adding a digit doesn't shuffle the rest.
 */
export function RollingNumber({ value, format = formatUSD, className, rollOnMount = true }: RollingNumberProps) {
  const reduce = useReducedMotion();
  const text = format(value);
  const chars = text.split('');

  return (
    <span className={cn('inline-flex items-start leading-none tabular', className)}>
      <span className="sr-only">{text}</span>
      {chars.map((char, i) => {
        const key = chars.length - i;
        if (!/\d/.test(char)) {
          return (
            <span key={`s${key}${char}`} aria-hidden data-c={char} className="h-[1em] select-none leading-none before:content-[attr(data-c)]" />
          );
        }
        const digit = Number(char);
        return (
          <span key={`d${key}`} aria-hidden className="relative inline-block h-[1em] select-none overflow-hidden leading-none">
            {/* Digits are drawn with ::before so they never leak into page text, copy/paste or crawlers. */}
            <span className="invisible before:content-['0']" />
            <motion.span
              className="absolute inset-x-0 top-0 flex flex-col"
              initial={reduce || !rollOnMount ? false : { y: '0%' }}
              animate={{ y: `${-digit * 10}%` }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20, mass: 0.9 }}
            >
              {DIGITS.map((d) => (
                <span key={d} data-d={d} className="block h-[1em] text-center leading-none before:content-[attr(data-d)]" />
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}
