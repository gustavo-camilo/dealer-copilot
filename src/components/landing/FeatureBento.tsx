import { useRef, useState, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';
import { Check } from 'lucide-react';
import { DealGauge } from '../scan/DealGauge';
import { CostWaterfall } from '../scan/CostWaterfall';
import { RollingNumber } from '../ui/RollingNumber';
import { VerdictBadge, cn } from '../ui';

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const signedUSD = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

/** Plays its children's entrance animation the first time the tile scrolls into view. */
function Tile({
  index,
  eyebrow,
  title,
  body,
  children,
  className,
}: {
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  children: (visible: boolean) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.35 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'spotlight edge-light flex flex-col overflow-hidden rounded-3xl border border-line bg-surface/60 p-5 sm:p-6',
        className
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-subtle">
        0{index + 1} · {eyebrow}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
      <div className="mt-5 flex flex-1 flex-col justify-end">{children(visible)}</div>
    </motion.div>
  );
}

function BidCeiling() {
  const market = 21400;
  const costs = 600 + 350 + 900;
  const [bid, setBid] = useState(16900);
  const profit = market - bid - costs;
  const verdict = profit >= 1500 ? 'buy' : profit >= 800 ? 'maybe' : 'pass';

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">If you bid</p>
          <p className="text-2xl font-semibold tracking-tight text-ink">
            <RollingNumber value={bid} format={usd} rollOnMount={false} />
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-muted">You make</p>
          <p className={cn('text-2xl font-semibold tracking-tight', profit >= 0 ? 'text-success' : 'text-danger')}>
            <RollingNumber value={profit} format={signedUSD} rollOnMount={false} />
          </p>
        </div>
      </div>
      <input
        type="range"
        min={15000}
        max={20000}
        step={100}
        value={bid}
        onChange={(e) => setBid(Number(e.target.value))}
        aria-label="Bid amount"
        className="w-full accent-[rgb(var(--accent))]"
      />
      <div className="flex items-center justify-between text-xs text-ink-subtle">
        <span>Drag the bid</span>
        <VerdictBadge verdict={verdict} />
      </div>
    </div>
  );
}

// Illustrative 30-day price line for a competitor listing, with a drop near the end.
const PRICE_POINTS = [24, 24, 23.6, 23.6, 23.8, 23.8, 23.8, 23.4, 23.4, 23.4, 23.4, 22.6, 22.6, 22.6];

function CompetitorLine({ play }: { play: boolean }) {
  const w = 260;
  const h = 72;
  const min = 22;
  const max = 24.4;
  const points = PRICE_POINTS.map((v, i) => [(i / (PRICE_POINTS.length - 1)) * w, h - ((v - min) / (max - min)) * h]);
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [dropX, dropY] = points[11];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full overflow-visible" aria-hidden>
        <motion.path
          d={d}
          fill="none"
          stroke="rgb(var(--ink-muted))"
          strokeWidth="2"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: play ? 1 : 0 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.circle
          cx={dropX}
          cy={dropY}
          r="4.5"
          fill="rgb(var(--accent))"
          initial={{ scale: 0, opacity: 0 }}
          animate={play ? { scale: 1, opacity: 1 } : {}}
          transition={{ delay: 1.2, type: 'spring', stiffness: 400, damping: 18 }}
        />
      </svg>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={play ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 1.35 }}
        className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface-2/70 px-3 py-2 text-xs"
      >
        <span className="text-ink-muted">2018 Honda Accord · competitor listing</span>
        <span className="font-semibold text-accent tabular">−$800</span>
      </motion.div>
    </div>
  );
}

const SYNCED = ['2020 Ford F-150 XLT', '2019 Toyota Camry SE', '2017 Honda CR-V EX', '2021 Nissan Rogue SV'];

function InventorySync({ play }: { play: boolean }) {
  return (
    <ul className="space-y-1.5">
      {SYNCED.map((name, i) => (
        <motion.li
          key={name}
          initial={{ opacity: 0, x: -8 }}
          animate={play ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.15 + i * 0.18, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs"
        >
          <span className="text-ink">{name}</span>
          <span className="flex items-center gap-1 text-success">
            <Check className="h-3 w-3" strokeWidth={3} /> Synced
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

/** "What decides the bid": live instruments instead of icon-and-paragraph cards. */
export function FeatureBento() {
  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
      <Tile
        index={0}
        eyebrow="Verdict"
        title="A clear call before the lane moves"
        body="Buy, Maybe or Pass, with how confident we are, from live comps and your own sales history."
        className="md:col-span-2"
      >
        {(visible) => (
          <div className="flex items-center gap-5">
            {visible ? <DealGauge value={86} color="rgb(var(--success))" size="lg" /> : <div className="h-[150px] w-52" />}
            <div>
              <p className="text-4xl font-semibold tracking-[-0.03em] text-success sm:text-5xl">Buy</p>
              <p className="mt-1 text-sm text-ink-muted">Max bid {usd(16900)}</p>
            </div>
          </div>
        )}
      </Tile>

      <Tile index={1} eyebrow="True cost" title="Every fee, before you bid" body="Buy fee, transport and recon stacked against the market price.">
        {(visible) =>
          visible ? (
            <CostWaterfall marketPrice={21400} bid={16900} auctionFee={600} transport={350} recon={900} legendColumns={2} />
          ) : (
            <div className="h-10" />
          )
        }
      </Tile>

      <Tile index={2} eyebrow="Max bid" title="Know your ceiling" body="See exactly where a good deal turns into a bad one.">
        {() => <BidCeiling />}
      </Tile>

      <Tile index={3} eyebrow="Competitors" title="Watch the lot across the street" body="Price drops and new listings from the dealers you compete with.">
        {(visible) => <CompetitorLine play={visible} />}
      </Tile>

      <Tile index={4} eyebrow="Inventory" title="Your lot, on autopilot" body="We read your website and keep every vehicle, price and sale in sync.">
        {(visible) => <InventorySync play={visible} />}
      </Tile>
    </div>
  );
}
