import { forwardRef, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { VIN_LENGTH, isVinCheckDigitValid, normalizeVin } from '../../utils/vin';
import { cn } from '../ui';

interface VinPlateProps {
  value: string;
  onChange?: (vin: string) => void;
  /** Shows the scan beam while the VIN is being analyzed. */
  scanning?: boolean;
  disabled?: boolean;
  /** Display-only mode (no input), used in demos. */
  readOnly?: boolean;
  /** Small fixed size (ignores breakpoints), e.g. inside a phone mockup. */
  compact?: boolean;
  label?: string;
  className?: string;
}

// WMI (manufacturer) · VDS (vehicle descriptor) · VIS (serial)
const GROUPS = [
  { name: 'WMI', hint: 'Maker', start: 0, length: 3 },
  { name: 'VDS', hint: 'Vehicle', start: 3, length: 6 },
  { name: 'VIS', hint: 'Serial', start: 9, length: 8 },
];

/**
 * 17-slot VIN entry laid out like the VIN itself. A transparent native input
 * sits on top, so typing, pasting, autofill and the mobile keyboard all work normally.
 */
export const VinPlate = forwardRef<HTMLInputElement, VinPlateProps>(
  ({ value, onChange, scanning = false, disabled, readOnly, compact = false, label = 'VIN', className }, ref) => {
    const reduce = useReducedMotion();
    const inputId = useId();
    const [focused, setFocused] = useState(false);
    const check = isVinCheckDigitValid(value);

    const activeIndex = focused && !scanning && value.length < VIN_LENGTH ? value.length : -1;

    return (
      <div className={cn('w-full', className)}>
        {!readOnly && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
            {label}
          </label>
        )}

        <div className="relative">
          {!readOnly && (
            <input
              ref={ref}
              id={inputId}
              value={value}
              onChange={(e) => onChange?.(normalizeVin(e.target.value))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={disabled}
              maxLength={VIN_LENGTH + 4}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-describedby={`${inputId}-status`}
              className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed"
            />
          )}

          <div
            aria-hidden
            className={cn(
              'relative flex overflow-hidden border bg-surface transition-[border-color,box-shadow] duration-200',
              compact ? 'gap-1 rounded-xl p-1' : 'gap-1.5 rounded-2xl p-1.5 sm:gap-2 sm:p-2',
              focused ? 'border-accent/60 ring-4 ring-accent/15' : 'border-line',
              disabled && !scanning && 'opacity-60'
            )}
          >
            {GROUPS.map((group) => (
              <div key={group.name} className={cn('flex min-w-0 flex-[var(--grow)]', compact ? 'gap-[2px]' : 'gap-[3px]')} style={{ ['--grow' as string]: group.length }}>
                {Array.from({ length: group.length }, (_, j) => {
                  const index = group.start + j;
                  const char = value[index];
                  const isActive = index === activeIndex;
                  return (
                    <span
                      key={index}
                      className={cn(
                        'relative flex min-w-0 flex-1 items-center justify-center font-mono font-medium',
                        compact ? 'h-7 rounded-[4px] text-[10px]' : 'h-11 rounded-md text-[15px] sm:h-12 sm:text-lg',
                        char ? 'bg-surface-2 text-ink' : 'bg-surface-2/50 text-ink-subtle',
                        index === 8 && char && 'ring-1 ring-inset ring-ink/15',
                        isActive && 'bg-accent/10 ring-1 ring-inset ring-accent/60'
                      )}
                    >
                      {char ? (
                        <motion.span
                          key={`${index}-${char}`}
                          initial={reduce ? false : { y: 6, opacity: 0, scale: 0.8 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                          className={cn('transition-colors duration-500', scanning && 'text-accent')}
                        >
                          {char}
                        </motion.span>
                      ) : isActive ? (
                        <span className={cn('w-px animate-pulse bg-accent', compact ? 'h-3' : 'h-5')} />
                      ) : (
                        <span className="h-px w-2 bg-ink-subtle/40" />
                      )}
                    </span>
                  );
                })}
              </div>
            ))}

            {scanning && !reduce && (
              <motion.span
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent/25 to-transparent"
                initial={{ left: '-35%' }}
                animate={{ left: '105%' }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
        </div>

        <div className={cn('mt-1.5 flex', compact ? 'gap-1 px-1' : 'gap-1.5 px-1.5 sm:gap-2 sm:px-2')} aria-hidden>
          {GROUPS.map((group) => (
            <span
              key={group.name}
              className={cn(
                'min-w-0 flex-[var(--grow)] truncate font-mono uppercase text-ink-subtle',
                compact ? 'text-[7px] tracking-[0.1em]' : 'text-[9px] tracking-[0.14em] sm:text-[10px]'
              )}
              style={{ ['--grow' as string]: group.length }}
            >
              {group.name}
              {!compact && <span className="hidden sm:inline"> · {group.hint}</span>}
            </span>
          ))}
        </div>

        {!readOnly && (
          <p id={`${inputId}-status`} className="mt-2 flex min-h-[1.25rem] items-center gap-1.5 text-xs" aria-live="polite">
            {check === true ? (
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Check digit verified
              </span>
            ) : check === false ? (
              <span className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Check digit doesn&apos;t match. Double-check the VIN.
              </span>
            ) : (
              <span className="text-ink-subtle tabular">
                {value.length === 0 ? 'Type or paste the 17-character VIN' : `${value.length} / ${VIN_LENGTH}`}
              </span>
            )}
          </p>
        )}
      </div>
    );
  }
);
VinPlate.displayName = 'VinPlate';
