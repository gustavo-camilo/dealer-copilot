import { motion } from 'framer-motion';
import { CheckCircle2, CircleSlash, HelpCircle } from 'lucide-react';
import { RollingNumber } from '../ui/RollingNumber';
import { formatUSD, cn } from '../ui';
import { DealGauge } from './DealGauge';
import { CostWaterfall, type CostBreakdown } from './CostWaterfall';

type Verdict = 'buy' | 'maybe' | 'pass';

interface VerdictHeroProps {
    verdict: Verdict;
    confidence: number;
    maxBid: number | null;
    profit: number | null;
    /** When provided, renders the true-cost bar under the numbers. */
    costs?: CostBreakdown | null;
    className?: string;
}

const config: Record<Verdict, { label: string; line: string; icon: typeof CheckCircle2; text: string; glow: string; color: string }> = {
    buy: {
        label: 'Buy',
        line: 'The numbers work at or under the max bid.',
        icon: CheckCircle2,
        text: 'text-success',
        glow: 'bg-success/20',
        color: 'rgb(var(--success))',
    },
    maybe: {
        label: 'Maybe',
        line: 'Thin margin. Only worth it below the max bid.',
        icon: HelpCircle,
        text: 'text-warning',
        glow: 'bg-warning/20',
        color: 'rgb(var(--warning))',
    },
    pass: {
        label: 'Pass',
        line: 'True cost eats the profit on this one.',
        icon: CircleSlash,
        text: 'text-danger',
        glow: 'bg-danger/20',
        color: 'rgb(var(--danger))',
    },
};

const signedUSD = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatUSD(Math.abs(n))}`;

/** The answer first: verdict, confidence gauge, max bid, profit, and the true-cost bar. */
export function VerdictHero({ verdict, confidence, maxBid, profit, costs, className }: VerdictHeroProps) {
    const v = config[verdict] ?? config.maybe;
    const Icon = v.icon;

    return (
        <section
            className={cn('edge-light relative mb-6 overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-6', className)}
            aria-label={`Verdict: ${v.label}`}
        >
            <div className={cn('pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full blur-3xl transition-colors duration-700', v.glow)} />

            <div className="relative flex items-center gap-4 sm:gap-6">
                <DealGauge value={confidence} color={v.color} size="auto" className="shrink-0" />

                <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-subtle">Verdict</p>
                    <motion.p
                        key={verdict}
                        initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                        className={cn('mt-0.5 flex items-center gap-2 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl', v.text)}
                    >
                        <Icon className="h-7 w-7 sm:h-9 sm:w-9" strokeWidth={2.25} />
                        {v.label}
                    </motion.p>
                    <p className="mt-1 text-sm text-ink-muted">{v.line}</p>
                </div>
            </div>

            <dl className="relative mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface-2/80 px-4 py-3 ring-1 ring-inset ring-line/60">
                    <dt className="text-xs text-ink-muted">Max bid</dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                        {maxBid ? <RollingNumber value={maxBid} /> : '—'}
                    </dd>
                </div>
                <div className="rounded-2xl bg-surface-2/80 px-4 py-3 ring-1 ring-inset ring-line/60">
                    <dt className="text-xs text-ink-muted">Est. profit</dt>
                    <dd
                        className={cn(
                            'mt-1 text-2xl font-semibold tracking-tight',
                            profit == null ? 'text-ink' : profit > 0 ? 'text-success' : 'text-danger'
                        )}
                    >
                        {profit != null ? <RollingNumber value={profit} format={signedUSD} /> : '—'}
                    </dd>
                </div>
            </dl>

            {costs && costs.marketPrice > 0 && <CostWaterfall {...costs} className="relative mt-5" />}
        </section>
    );
}
