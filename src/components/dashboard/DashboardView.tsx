import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Car, ChevronRight, Globe, Scan, TrendingUp, Wallet, Receipt, Sparkles, Gauge } from 'lucide-react';
import { Card, SectionHeader, Stat, VerdictBadge, EmptyState, ButtonLink, Skeleton, formatUSD, cn } from '../ui';
import { formatVehicleName } from '../../utils/vehicle';

export interface DashboardStats {
  totalVehicles: number;
  portfolioValue: number;
  weekSales: number;
  avgPrice: number;
}

export interface DashboardScan {
  id: string;
  decoded_data: { year?: number | string; make?: string; model?: string };
  recommendation: string;
  max_bid_suggestion?: number | null;
  estimated_profit?: number | null;
  confidence_score?: number | null;
}

interface DashboardViewProps {
  firstName?: string;
  tenantName?: string;
  stats: DashboardStats;
  recentScans: DashboardScan[];
  recommendations: DashboardScan[];
  showOnboarding: boolean;
  onSelectScan: (scan: DashboardScan) => void;
}

const vehicleTitle = (scan: DashboardScan) =>
  `${scan.decoded_data.year ?? ''} ${formatVehicleName(scan.decoded_data.make)} ${formatVehicleName(scan.decoded_data.model)}`.trim();

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Staggered entrance delay for top-level blocks (paired with `animate-enter`). */
const stagger = (i: number): CSSProperties => ({ animationDelay: `${i * 60}ms` });

export function DashboardView({
  firstName,
  tenantName,
  stats,
  recentScans,
  recommendations,
  showOnboarding,
  onSelectScan,
}: DashboardViewProps) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <div style={stagger(0)} className="animate-enter">
        <p className="text-sm text-ink-muted">{tenantName}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
      </div>

      {showOnboarding && (
        <Card style={stagger(1)} className={cn('animate-enter', 'flex flex-col gap-4 sm:flex-row sm:items-center')}>
          <div className="flex-1">
            <p className="font-semibold text-ink">Bring your inventory in</p>
            <p className="mt-1 text-sm text-ink-muted">
              Analyze your website and we&apos;ll track every vehicle, price change, and sale for you.
            </p>
          </div>
          <ButtonLink to="/onboarding" variant="secondary" icon={<Globe className="h-4 w-4" />}>
            Analyze my website
          </ButtonLink>
        </Card>
      )}

      {/* Primary job: scan a VIN */}
      <Link
        to="/scan"
        style={stagger(1)}
        className={cn(
          'animate-enter',
          'spotlight edge-light group relative block overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-6',
          'transition-[transform,border-color] duration-200 ease-out-expo hover:border-accent/40 active:scale-[0.99]'
        )}
      >
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100 sm:opacity-70" />
        <div className="relative flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-[0_10px_24px_-10px_rgb(249_115_22/0.8)]">
            <Scan className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight text-ink">Scan a VIN</p>
            <p className="text-sm text-ink-muted">True cost, max bid and a clear verdict in seconds.</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-ink-subtle transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent" />
        </div>
      </Link>

      <section style={stagger(2)} className={cn('animate-enter', 'grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4')} aria-label="Inventory stats">
        <Stat label="Vehicles in stock" value={stats.totalVehicles} icon={<Car />} />
        <Stat label="Portfolio value" value={stats.portfolioValue} format={compactUSD} icon={<Wallet />} />
        <Stat label="Sold this week" value={stats.weekSales} icon={<Receipt />} />
        <Stat label="Average price" value={stats.avgPrice} format={formatUSD} icon={<Gauge />} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section style={stagger(3)} className={cn('animate-enter', 'lg:col-span-3')}>
          <SectionHeader
            title="Recent scans"
            action={recentScans.length > 0 && <ViewAll to="/recommendations" />}
          />
          <Card padding="none" className="overflow-hidden">
            {recentScans.length === 0 ? (
              <EmptyState
                icon={<Scan />}
                title="No scans yet"
                description="Your first VIN scan shows up here with its verdict and max bid."
                action={<ButtonLink to="/scan" size="sm">Scan your first VIN</ButtonLink>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {recentScans.map((scan) => (
                  <li key={scan.id}>
                    <button
                      onClick={() => onSelectScan(scan)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-ink">{vehicleTitle(scan)}</p>
                          <VerdictBadge verdict={scan.recommendation} />
                        </div>
                        <p className="mt-1 flex gap-3 text-xs text-ink-muted tabular">
                          <span>Max bid {scan.max_bid_suggestion ? formatUSD(scan.max_bid_suggestion) : '—'}</span>
                          <Profit value={scan.estimated_profit} />
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section style={stagger(4)} className={cn('animate-enter', 'lg:col-span-2')}>
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-accent" /> Worth bidding on
              </span>
            }
            action={recommendations.length > 0 && <ViewAll to="/recommendations" />}
          />
          <Card padding="none" className="overflow-hidden">
            {recommendations.length === 0 ? (
              <EmptyState
                icon={<TrendingUp />}
                title="Nothing flagged yet"
                description="High-confidence buys from your scans land here."
              />
            ) : (
              <ul className="divide-y divide-line">
                {recommendations.map((rec) => (
                  <li key={rec.id}>
                    <button
                      onClick={() => onSelectScan(rec)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{vehicleTitle(rec)}</p>
                        <p className="mt-1 text-xs text-ink-muted tabular">
                          Max bid {rec.max_bid_suggestion ? formatUSD(rec.max_bid_suggestion) : '—'}
                        </p>
                      </div>
                      <Confidence value={rec.confidence_score ?? 0} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-10 lg:px-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-[88px] rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[104px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-72 rounded-2xl lg:col-span-3" />
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
      </div>
    </main>
  );
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-0.5 text-sm font-medium text-ink-muted transition-colors hover:text-accent">
      View all <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function Profit({ value }: { value?: number | null }) {
  if (!value) return <span>Profit —</span>;
  return (
    <span className={cn('font-medium', value > 0 ? 'text-success' : 'text-danger')}>
      {value > 0 ? '+' : ''}
      {formatUSD(value)}
    </span>
  );
}

/** Small radial meter for confidence scores. */
function Confidence({ value }: { value: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center" aria-label={`${value}% confidence`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="rgb(var(--success))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(value, 100) / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out-expo"
        />
      </svg>
      <span className="text-[11px] font-semibold text-ink tabular">{value}</span>
    </span>
  );
}

function compactUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: n >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: n >= 100_000 ? 1 : 0,
  }).format(Math.round(n));
}

