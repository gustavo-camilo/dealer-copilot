/**
 * DEV ONLY — mounted at /design when `import.meta.env.DEV` is true (see App.tsx),
 * so it never ships in production builds. It renders the design system and real
 * view components with hard-coded sample data; it does not touch auth or Supabase.
 */
import { useState } from 'react';
import { Car, Moon, RotateCcw, Scan, Sun } from 'lucide-react';
import Header from '../../components/Header';
import { DashboardView, type DashboardScan } from '../../components/dashboard/DashboardView';
import { VerdictHero } from '../../components/scan/VerdictHero';
import { DealGauge } from '../../components/scan/DealGauge';
import { VinPlate } from '../../components/scan/VinPlate';
import { RollingNumber } from '../../components/ui/RollingNumber';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SectionHeader,
  Sheet,
  Skeleton,
  Stat,
  VerdictBadge,
  formatUSD,
} from '../../components/ui';
import { useTheme } from '../../contexts/ThemeContext';
import toast from 'react-hot-toast';

const sampleUser = { full_name: 'Sample Dealer', email: 'sample@example.test', role: 'dealer' };
const sampleTenant = { name: 'Sample Motors' };

const scans: DashboardScan[] = [
  { id: '1', decoded_data: { year: 2019, make: 'TOYOTA', model: 'CAMRY' }, recommendation: 'buy', max_bid_suggestion: 14200, estimated_profit: 2350, confidence_score: 86 },
  { id: '2', decoded_data: { year: 2017, make: 'HONDA', model: 'CR-V' }, recommendation: 'maybe', max_bid_suggestion: 15800, estimated_profit: 640, confidence_score: 61 },
  { id: '3', decoded_data: { year: 2015, make: 'BMW', model: '328I' }, recommendation: 'pass', max_bid_suggestion: 9100, estimated_profit: -420, confidence_score: 74 },
  { id: '4', decoded_data: { year: 2020, make: 'FORD', model: 'F-150' }, recommendation: 'buy', max_bid_suggestion: 27400, estimated_profit: 3900, confidence_score: 91 },
];

const MARKET = 17900;
const TRANSPORT = 250;

function LabSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium text-ink tabular">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--accent))]"
      />
    </label>
  );
}

const swatches = ['canvas', 'surface', 'surface-2', 'line', 'ink', 'ink-muted', 'ink-subtle', 'accent', 'success', 'warning', 'danger'];

export default function DesignPlayground() {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [replay, setReplay] = useState(0);
  const [bid, setBid] = useState(13200);
  const [recon, setRecon] = useState(800);
  const [confidence, setConfidence] = useState(86);
  const [vin, setVin] = useState('');
  const [vinScanning, setVinScanning] = useState(false);
  const labFee = bid >= 10000 ? 500 : bid >= 5000 ? 350 : 200;
  const labProfit = MARKET - (bid + labFee + TRANSPORT + recon);
  const labVerdict = labProfit >= 1500 ? 'buy' : labProfit >= 800 ? 'maybe' : 'pass';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <Header
        user={sampleUser}
        tenant={sampleTenant}
        signOut={async () => { toast('Sign out (playground)'); }}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="sticky top-14 z-30 border-b border-line bg-canvas/90 backdrop-blur md:top-16">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <Badge tone="accent">Design playground · dev only</Badge>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setReplay((n) => n + 1)} icon={<RotateCcw className="h-4 w-4" />}>
              <span className="hidden sm:inline">Replay</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={toggleTheme} icon={theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}>
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </Button>
          </div>
        </div>
      </div>

      <div key={replay}>
        <DashboardView
          firstName="Sample"
          tenantName={sampleTenant.name}
          stats={{ totalVehicles: 48, portfolioValue: 812400, weekSales: 6, avgPrice: 16925 }}
          recentScans={scans}
          recommendations={scans.filter((s) => s.recommendation === 'buy')}
          showOnboarding
          onSelectScan={() => setSheetOpen(true)}
        />

        <div className="mx-auto max-w-7xl space-y-10 px-4 pb-16 sm:px-6 lg:px-8">
          <section>
            <SectionHeader title="Scan result lab" />
            <p className="-mt-1 mb-4 text-sm text-ink-muted">
              Drag the sliders: the verdict, gauge, rolling numbers and true-cost bar all respond. (Playground-only verdict logic:
              profit ≥ $1,500 Buy, ≥ $800 Maybe, otherwise Pass.)
            </p>
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <VerdictHero
                verdict={labVerdict}
                confidence={confidence}
                maxBid={bid}
                profit={labProfit}
                costs={{ marketPrice: MARKET, bid, auctionFee: labFee, transport: TRANSPORT, recon }}
                className="mb-0"
              />
              <Card className="space-y-5">
                <LabSlider label="Bid" value={bid} min={9000} max={17000} step={100} onChange={setBid} format={formatUSD} />
                <LabSlider label="Recon" value={recon} min={0} max={2500} step={50} onChange={setRecon} format={formatUSD} />
                <LabSlider label="Confidence" value={confidence} min={0} max={100} step={1} onChange={setConfidence} format={(n) => `${n}%`} />
                <p className="text-xs text-ink-subtle">
                  Market {formatUSD(MARKET)} · Buy fee {formatUSD(labFee)} · Transport {formatUSD(TRANSPORT)}
                </p>
              </Card>
            </div>
          </section>

          <section>
            <SectionHeader title="VIN plate" />
            <Card className="max-w-xl space-y-4">
              <VinPlate value={vin} onChange={setVin} scanning={vinScanning} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setVin('1HGCM82633A004352')}>
                  Fill a valid VIN
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setVin('1HGCM82623A004352')}>
                  Fill a bad check digit
                </Button>
                <Button
                  size="sm"
                  disabled={vin.length !== 17 || vinScanning}
                  onClick={() => {
                    setVinScanning(true);
                    window.setTimeout(() => setVinScanning(false), 2600);
                  }}
                >
                  Simulate scan
                </Button>
              </div>
            </Card>
          </section>

          <section>
            <SectionHeader title="Instruments" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="flex flex-col items-center gap-2">
                <DealGauge value={confidence} color="rgb(var(--success))" size="md" />
              </Card>
              <Card className="flex flex-col items-center justify-center gap-2">
                <span className="text-xs text-ink-muted">Rolling digits</span>
                <span className="text-4xl font-semibold tracking-tight text-ink">
                  <RollingNumber value={bid} />
                </span>
              </Card>
              <Card className="spotlight flex flex-col justify-center gap-1">
                <span className="text-xs text-ink-muted">Spotlight card</span>
                <span className="text-sm text-ink">Move the cursor over this card (desktop).</span>
              </Card>
            </div>
          </section>

          <section>
            <SectionHeader title="Tokens" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11">
              {swatches.map((name) => (
                <div key={name} className="space-y-1.5">
                  <div className="h-12 rounded-xl ring-1 ring-line" style={{ background: `rgb(var(--${name}))` }} />
                  <p className="font-mono text-[11px] text-ink-muted">{name}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="Type" />
            <Card className="space-y-2">
              <p className="text-3xl font-semibold tracking-tight text-ink">Know the true cost before you bid.</p>
              <p className="text-lg font-semibold tracking-tight text-ink">Section title, 18 / semibold</p>
              <p className="text-sm text-ink-muted">Body muted. Used for supporting copy under titles and in list rows.</p>
              <p className="font-mono text-sm tracking-[0.12em] text-ink">1HGCV1F30LA012345</p>
              <p className="text-2xl font-semibold text-ink tabular">{formatUSD(14200)}</p>
            </Card>
          </section>

          <section>
            <SectionHeader title="Buttons & badges" />
            <Card className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button icon={<Scan className="h-4 w-4" />}>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="inverse">Inverse</Button>
                <Button variant="danger">Danger</Button>
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <VerdictBadge verdict="buy" />
                <VerdictBadge verdict="maybe" />
                <VerdictBadge verdict="pass" />
                <Badge>Neutral</Badge>
                <Badge tone="accent">Accent</Badge>
              </div>
            </Card>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div>
              <SectionHeader title="Inputs" />
              <Card className="space-y-4">
                <Input label="VIN" placeholder="1HGCV1F30LA012345" className="font-mono tracking-[0.12em]" trailing="0/17" />
                <Input label="Mileage" inputMode="numeric" hint="Optional, improves accuracy" />
                <Input label="ZIP code" defaultValue="303" error="Enter a 5-digit ZIP code" />
              </Card>
            </div>
            <div className="space-y-6">
              <div>
                <SectionHeader title="Stats & loading" />
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Vehicles" value={48} icon={<Car />} />
                  <Skeleton className="h-[104px] rounded-2xl" />
                </div>
              </div>
              <div>
                <SectionHeader title="Overlays & feedback" />
                <Card className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open sheet</Button>
                  <Button variant="secondary" onClick={() => setConfirmOpen(true)}>Confirm dialog</Button>
                  <Button variant="secondary" onClick={() => toast.success('Costs saved successfully')}>Toast</Button>
                </Card>
              </div>
              <Card padding="none">
                <EmptyState icon={<Scan />} title="No scans yet" description="Your first VIN scan shows up here." />
              </Card>
            </div>
          </section>
        </div>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="2019 Toyota Camry" size="lg" bodyClassName="p-4 sm:p-6">
        <VerdictHero verdict="buy" confidence={86} maxBid={14200} profit={2350} />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      </Sheet>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel="Discard & Leave"
        cancelLabel="Save and Stay"
      />
    </div>
  );
}
