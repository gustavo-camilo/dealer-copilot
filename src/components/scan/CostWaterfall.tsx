import { motion } from 'framer-motion';
import { RollingNumber } from '../ui/RollingNumber';
import { formatUSD, cn } from '../ui';

export interface CostBreakdown {
  marketPrice: number;
  bid: number;
  auctionFee: number;
  transport: number;
  recon: number;
}

interface CostWaterfallProps extends CostBreakdown {
  /** Show the itemized legend under the bar. */
  legend?: boolean;
  /** Legend columns from the sm breakpoint up (2 suits narrow cards). */
  legendColumns?: 2 | 3;
  className?: string;
}

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatUSD(Math.abs(n))}`;

/**
 * "True cost" bar: bid + fees + transport + recon stacked against the market
 * price. Whatever is left over is the profit; anything past the market line is the loss.
 */
export function CostWaterfall({ marketPrice, bid, auctionFee, transport, recon, legend = true, legendColumns = 3, className }: CostWaterfallProps) {
  const totalCost = bid + auctionFee + transport + recon;
  const profit = marketPrice - totalCost;
  const scale = Math.max(marketPrice, totalCost, 1);
  const pct = (n: number) => `${(Math.max(n, 0) / scale) * 100}%`;
  const marketPct = (marketPrice / scale) * 100;

  const segments = [
    { key: 'bid', label: 'Bid', value: bid, className: 'bg-ink/25' },
    { key: 'fee', label: 'Buy fee', value: auctionFee, className: 'bg-accent' },
    { key: 'transport', label: 'Transport', value: transport, className: 'bg-accent/65' },
    { key: 'recon', label: 'Recon', value: recon, className: 'bg-accent/40' },
  ];

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-2 flex items-baseline justify-between text-xs text-ink-muted">
        <span>True cost vs. market</span>
        <span className="tabular">Market {formatUSD(marketPrice)}</span>
      </div>

      <div className="relative">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line">
          {segments.map((s, i) => (
            <motion.div
              key={s.key}
              className={cn('h-full first:rounded-l-full', s.className)}
              initial={{ width: 0 }}
              animate={{ width: pct(s.value) }}
              transition={{ duration: 0.55, delay: 0.15 + i * 0.12, ease }}
            />
          ))}
          {profit > 0 && (
            <motion.div
              className="h-full rounded-r-full bg-success shadow-[0_0_12px_rgb(var(--success)/0.6)]"
              initial={{ width: 0 }}
              animate={{ width: pct(profit) }}
              transition={{ duration: 0.6, delay: 0.7, ease }}
            />
          )}
        </div>

        {profit < 0 && (
          <motion.div
            className="pointer-events-none absolute inset-y-0 rounded-r-full ring-1 ring-inset ring-danger/50 [background:repeating-linear-gradient(135deg,rgb(var(--danger)/0.55)_0_3px,transparent_3px_6px)]"
            style={{ left: `${marketPct}%`, right: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.4 }}
          />
        )}

        {/* Market price marker */}
        <div className="absolute -bottom-1 -top-1 w-px bg-ink/70" style={{ left: `calc(${marketPct}% - 0.5px)` }} aria-hidden />
      </div>

      {legend && (
        <dl className={cn('mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm', legendColumns === 3 && 'sm:grid-cols-3')}>
          {segments.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-ink-muted">
                <span className={cn('h-2 w-2 rounded-full', s.className)} />
                {s.label}
              </dt>
              <dd className="tabular text-ink">{formatUSD(s.value)}</dd>
            </div>
          ))}
          <div
            className={cn(
              'col-span-2 flex items-center justify-between gap-2 border-t border-line pt-2',
              legendColumns === 3 && 'sm:col-span-1 sm:border-0 sm:pt-0'
            )}
          >
            <dt className={cn('flex items-center gap-2 font-medium', profit >= 0 ? 'text-success' : 'text-danger')}>
              <span className={cn('h-2 w-2 rounded-full', profit >= 0 ? 'bg-success' : 'bg-danger')} />
              {profit >= 0 ? 'Profit' : 'Loss'}
            </dt>
            <dd className={cn('font-semibold', profit >= 0 ? 'text-success' : 'text-danger')}>
              <RollingNumber value={profit} format={signed} />
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
