import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Car, Check, Home, Loader2, Package, Scan, TrendingUp } from 'lucide-react';
import { VinPlate } from '../scan/VinPlate';
import { DealGauge } from '../scan/DealGauge';
import { CostWaterfall } from '../scan/CostWaterfall';
import { RollingNumber } from '../ui/RollingNumber';
import { cn } from '../ui';

type Verdict = 'buy' | 'pass';

interface Example {
  vin: string;
  title: string;
  detail: string;
  comps: number;
  verdict: Verdict;
  confidence: number;
  market: number;
  bid: number;
  fee: number;
  transport: number;
  recon: number;
}

// Illustrative numbers only (labelled as an example under the phone).
const EXAMPLES: Example[] = [
  { vin: '4T1B11HK5KU208364', title: '2019 Toyota Camry SE', detail: '41,200 mi · Clean title', comps: 38, verdict: 'buy', confidence: 86, market: 21400, bid: 16900, fee: 600, transport: 350, recon: 900 },
  { vin: '1HGCV1F30JA051727', title: '2018 Honda Accord LX', detail: '88,900 mi · 1 accident', comps: 52, verdict: 'pass', confidence: 78, market: 17800, bid: 15600, fee: 600, transport: 350, recon: 1450 },
];

type Phase = 'typing' | 'analyzing' | 'verdict';
const STEPS = ['Decoded', 'Market comps', 'True cost'];

const signedUSD = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Auto-playing product demo: a VIN is typed, analyzed, and the verdict lands.
 * Runs only while visible; reduced-motion users get the finished verdict screen.
 */
export function DemoPhone({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [exampleIndex, setExampleIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(reduce ? 'verdict' : 'typing');
  const [typed, setTyped] = useState(reduce ? 17 : 0);
  const [stepsDone, setStepsDone] = useState(reduce ? STEPS.length : 0);
  const example = EXAMPLES[exampleIndex];

  useEffect(() => {
    if (reduce || !inView) return;
    let timer: number;

    if (phase === 'typing') {
      if (typed < example.vin.length) {
        timer = window.setTimeout(() => setTyped((n) => n + 1), typed === 0 ? 700 : 65);
      } else {
        timer = window.setTimeout(() => setPhase('analyzing'), 450);
      }
    } else if (phase === 'analyzing') {
      if (stepsDone < STEPS.length) {
        timer = window.setTimeout(() => setStepsDone((n) => n + 1), 520);
      } else {
        timer = window.setTimeout(() => setPhase('verdict'), 350);
      }
    } else {
      timer = window.setTimeout(() => {
        setExampleIndex((i) => (i + 1) % EXAMPLES.length);
        setTyped(0);
        setStepsDone(0);
        setPhase('typing');
      }, 5200);
    }
    return () => window.clearTimeout(timer);
  }, [phase, typed, stepsDone, inView, reduce, example.vin.length]);

  const profit = example.market - (example.bid + example.fee + example.transport + example.recon);
  const good = example.verdict === 'buy';

  return (
    <figure ref={ref} className={cn('relative mx-auto w-[272px] sm:w-[300px]', className)}>
      {/* Frame */}
      <div className="rounded-[46px] bg-gradient-to-b from-slate-600/80 via-slate-800 to-slate-900 p-[2px] shadow-[0_40px_80px_-24px_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.04)]">
        <div className="rounded-[44px] bg-black p-[8px]">
          <div className="dark relative h-[540px] overflow-hidden rounded-[36px] bg-canvas text-ink sm:h-[590px]">
            {/* Dynamic Island doubles as the status pill */}
            <div className="absolute inset-x-0 top-2.5 z-20 flex justify-center">
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="flex h-[26px] items-center justify-center gap-1.5 overflow-hidden rounded-full bg-black px-3 text-[10px] font-medium text-white"
                style={{ minWidth: 92 }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {phase === 'analyzing' && (
                    <motion.span key="a" className="flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="h-3 w-3 animate-spin text-orange-400" /> Analyzing…
                    </motion.span>
                  )}
                  {phase === 'verdict' && (
                    <motion.span key="v" className="flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', good ? 'bg-emerald-400' : 'bg-red-400')} />
                      {good ? 'BUY' : 'PASS'} · {example.confidence}%
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Status bar */}
            <div className="flex h-11 items-center justify-between px-7 pt-1 text-[11px] font-semibold">
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-3.5 rounded-[2px] border border-current opacity-80" />
              </span>
            </div>

            {/* App header */}
            <div className="flex items-center gap-2 px-4 pb-3 pt-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-orange-500 to-red-600">
                <Scan className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="text-[13px] font-semibold tracking-tight">{phase === 'verdict' ? 'Scan result' : 'Scan a VIN'}</span>
            </div>

            <div className="px-4">
              <AnimatePresence mode="wait" initial={false}>
                {phase !== 'verdict' ? (
                  <motion.div
                    key={`scan-${exampleIndex}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <VinPlate value={example.vin.slice(0, typed)} readOnly compact scanning={phase === 'analyzing'} />

                    <div className="space-y-2">
                      {STEPS.map((step, i) => {
                        const done = i < stepsDone;
                        const active = phase === 'analyzing' && i === stepsDone;
                        const detail = [example.title, `${example.comps} listings · 100 mi`, 'Fees · transport · recon'][i];
                        return (
                          <div
                            key={step}
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 transition-opacity duration-300',
                              phase === 'typing' ? 'opacity-40' : 'opacity-100'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                                done ? 'bg-success/15 text-success' : 'bg-surface-2 text-ink-subtle'
                              )}
                            >
                              {done ? <Check className="h-3 w-3" strokeWidth={3} /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-medium">{step}</span>
                              <span className="block truncate text-[10px] text-ink-muted">{done ? detail : '—'}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className={cn(
                        'flex h-10 items-center justify-center rounded-xl text-[12px] font-semibold transition-colors',
                        typed === example.vin.length ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-subtle'
                      )}
                    >
                      {phase === 'analyzing' ? 'Analyzing…' : 'Analyze vehicle'}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`verdict-${exampleIndex}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-3"
                  >
                    <div>
                      <p className="text-[13px] font-semibold tracking-tight">{example.title}</p>
                      <p className="text-[10px] text-ink-muted">{example.detail}</p>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-3">
                      <div className={cn('pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full blur-2xl', good ? 'bg-success/25' : 'bg-danger/25')} />
                      <div className="relative flex items-center gap-3">
                        <DealGauge value={example.confidence} color={good ? 'rgb(var(--success))' : 'rgb(var(--danger))'} size="sm" />
                        <div>
                          <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-subtle">Verdict</p>
                          <p className={cn('text-[26px] font-semibold leading-tight tracking-[-0.03em]', good ? 'text-success' : 'text-danger')}>
                            {good ? 'Buy' : 'Pass'}
                          </p>
                        </div>
                      </div>
                      <div className="relative mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-surface-2 px-2.5 py-2">
                          <p className="text-[9px] text-ink-muted">Max bid</p>
                          <p className="mt-0.5 text-[15px] font-semibold">
                            <RollingNumber value={example.bid} format={usd} />
                          </p>
                        </div>
                        <div className="rounded-xl bg-surface-2 px-2.5 py-2">
                          <p className="text-[9px] text-ink-muted">Est. profit</p>
                          <p className={cn('mt-0.5 text-[15px] font-semibold', profit >= 0 ? 'text-success' : 'text-danger')}>
                            <RollingNumber value={profit} format={signedUSD} />
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-line bg-surface p-3 text-[10px] [&_.text-xs]:text-[9px]">
                      <CostWaterfall
                        marketPrice={example.market}
                        bid={example.bid}
                        auctionFee={example.fee}
                        transport={example.transport}
                        recon={example.recon}
                        legend={false}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mini dock, to show the app around the moment */}
            <div className="glass absolute inset-x-3 bottom-3 flex h-[52px] items-center justify-around rounded-[22px] border border-line/70 px-2 text-ink-subtle">
              <Home className="h-4 w-4" />
              <Car className="h-4 w-4" />
              <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-gradient-to-br from-orange-500 to-red-600 text-white">
                <Scan className="h-4 w-4" />
              </span>
              <Package className="h-4 w-4" />
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[11px] text-slate-500">Example scan · illustrative numbers</figcaption>
    </figure>
  );
}
