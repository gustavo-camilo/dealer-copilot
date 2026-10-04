import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Target, Zap, Shield, CheckCircle, AlertTriangle, ArrowRight, Menu, X, Smartphone, Lock } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { AnimatedNumber, formatUSD } from '../components/ui';
import { DotWave } from '../components/landing/DotWave';
import { DemoPhone } from '../components/landing/DemoPhone';
import { FeatureBento } from '../components/landing/FeatureBento';
import { CostWaterfall } from '../components/scan/CostWaterfall';
import { decodeVIN } from '../services/vinDecoder';
import { getMarketPricing } from '../services/marketPricing';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [vinInput, setVinInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<'idle' | 'scanning' | 'success' | 'danger' | 'error' | 'limit'>('idle');
  const [roastRevealed, setRoastRevealed] = useState(false);
  const [scanData, setScanData] = useState<any>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroInView = useInView(heroRef, { margin: '0px 0px -40% 0px' });

  // Scan Logic
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (vinInput.length < 17) {
        // Allow short vins for mock if needed, but for real scan we need 17
        // User asked for "Try 1G..." removal, implies real VINs.
        // But for UX, let's just warn if < 17
        if (vinInput.length < 11) return; // Basic length check
    }
    
    // Check Limit
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `dealer_copilot_scans_${today}`;
    const currentScans = parseInt(localStorage.getItem(storageKey) || '0');
    
    if (currentScans >= 3) {
        setScanResult('limit');
        return;
    }

    setScanResult('scanning');
    setIsScanning(true);
    setScanData(null);
    
    try {
        // Call Real Service
        const decoded = await decodeVIN(vinInput);
        
        if (!decoded.success || !decoded.data) {
             setScanResult('error');
             setIsScanning(false);
             return;
        }

        const market = await getMarketPricing(decoded.data);
        
        // Update Limit
        localStorage.setItem(storageKey, (currentScans + 1).toString());

        setScanData({
            vehicle: decoded.data,
            market: market
        });
        
        // Determine "Green" or "Red" based on ... well we don't have a bid.
        // So we just show "Success" state with the data.
        setScanResult('success');

    } catch (err) {
        console.error(err);
        setScanResult('error');
    } finally {
        setIsScanning(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-slate-950 text-white font-sans selection:bg-orange-500/30">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-orange-500 to-red-600 p-1.5 rounded-lg shadow-lg shadow-orange-500/20">
                <Target className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Dealer Co-Pilot</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#roast" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">The Trap</a>
              <a href="#personas" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">For You</a>
              <a href="#beta" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Beta Access</a>
              <Link to="/signin" className="text-sm font-medium text-white hover:text-orange-400 transition-colors">Sign In</Link>
              <Link
                to="/signup"
                className="bg-white text-slate-950 px-5 py-2 rounded-full text-sm font-bold hover:bg-orange-50 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
              >
                Get Started
              </Link>
            </div>

            <button
              className="md:hidden p-2 text-slate-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-slate-950 border-t border-slate-800 overflow-hidden"
            >
              <div className="px-4 py-6 space-y-4">
                <a href="#roast" className="block text-slate-400 hover:text-white font-medium" onClick={() => setMobileMenuOpen(false)}>The Trap</a>
                <a href="#personas" className="block text-slate-400 hover:text-white font-medium" onClick={() => setMobileMenuOpen(false)}>For You</a>
                <a href="#beta" className="block text-slate-400 hover:text-white font-medium" onClick={() => setMobileMenuOpen(false)}>Beta Access</a>
                <Link to="/signin" className="block text-slate-400 hover:text-white font-medium" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                <Link
                  to="/signup"
                  className="block bg-orange-600 text-white text-center py-3 rounded-xl font-bold hover:bg-orange-700 transition"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-28 pb-16 md:pt-36 lg:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Backdrop: a road of dots running to the horizon + one warm glow */}
        <DotWave className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] w-full [mask-image:linear-gradient(to_bottom,transparent,#000_35%,#000_75%,transparent)]" />
        <div className="absolute top-0 left-1/2 w-[110%] max-w-5xl h-[420px] bg-orange-500/20 blur-[110px] rounded-full pointer-events-none animate-glow" aria-hidden />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
        <div className="text-center lg:text-left">
          <div
            className="animate-enter inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase">Live Auction Intelligence</span>
          </div>

          {/* Headline renders immediately (it is the largest paint), only the accent line animates. */}
          <h1 className="text-[44px] leading-[1.05] sm:text-6xl md:text-7xl font-semibold tracking-[-0.035em] mb-6">
            Stop Guessing. <br />
            <span className="animate-enter inline-block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-red-500" style={{ animationDelay: '80ms' }}>
              Start Profiting.
            </span>
          </h1>

          <p
            className="animate-enter text-lg md:text-xl text-slate-400 max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed"
            style={{ animationDelay: '140ms' }}
          >
            The "Auction Shield" for independent dealers. We calculate hidden fees, reconditioning, and real market days-to-sale in 3 seconds.
          </p>

          {/* Interactive Mock Scan */}
          <motion.div
            layout
            transition={{ layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
            className="animate-enter max-w-md mx-auto lg:mx-0 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl shadow-black/50 ring-1 ring-white/10"
            style={{ animationDelay: '200ms' }}
          >
            {scanResult === 'idle' && (
              <form onSubmit={handleScan} className="relative">
                <input
                  type="text"
                  value={vinInput}
                  onChange={(e) => setVinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="Enter VIN to scan"
                  aria-label="Vehicle VIN"
                  maxLength={17}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-32 py-4 text-base text-white placeholder:text-slate-600 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all font-mono tracking-[0.1em]"
                />
                <span className="pointer-events-none absolute right-[5.5rem] top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-600 tabular" aria-hidden>
                  {vinInput.length}/17
                </span>
                <button
                  type="submit"
                  disabled={vinInput.length < 11}
                  className="absolute right-2 top-2 bottom-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 rounded-lg font-semibold hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
                >
                  Scan
                </button>
              </form>
            )}

            {scanResult === 'scanning' && (
              <div className="h-[72px] flex items-center justify-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
                </span>
                <span className="text-slate-300 text-sm">Pulling live market data…</span>
              </div>
            )}

            {scanResult !== 'idle' && scanResult !== 'scanning' && (
              <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                     {scanResult === 'limit' ? (
                         <div className="text-red-400 font-bold mb-1">Daily Limit Reached</div>
                     ) : scanResult === 'error' ? (
                         <div className="text-red-400 font-bold mb-1">Scan Failed</div>
                     ) : (
                        <>
                            <div className="text-xs text-slate-500 font-mono mb-1">VIN: {vinInput}</div>
                            <div className="text-sm font-medium text-slate-300">
                                {scanData?.vehicle?.year} {scanData?.vehicle?.make} {scanData?.vehicle?.model}
                            </div>
                        </>
                     )}
                  </div>
                  <button 
                    onClick={() => setScanResult('idle')}
                    className="text-slate-500 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                {scanResult === 'success' && scanData && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-slate-400 text-sm">Est. Retail</span>
                        <span className="text-emerald-400 font-bold text-lg">
                            {scanData.market?.average_price
                              ? <AnimatedNumber value={scanData.market.average_price} format={formatUSD} />
                              : 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                         <span className="text-slate-400 text-sm">Market Days Supply</span>
                         <span className="text-white font-mono">{scanData.market?.days_supply || '45'} Days</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-500 text-center">
                            *Estimated values. Unlock full report for exact fee calculation.
                        </p>
                    </div>
                  </div>
                )}
                
                {scanResult === 'limit' && (
                    <div className="text-slate-400 text-sm mb-4">
                        You've reached your 3 free scans for today. Sign up for unlimited access.
                    </div>
                )}
                
                {scanResult === 'error' && (
                     <div className="text-slate-400 text-sm mb-4">
                        Could not decode this VIN. Please check and try again.
                    </div>
                )}

                <Link 
                  to="/signup"
                  className="block w-full bg-white text-slate-950 text-center py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                >
                  {scanResult === 'limit' ? 'Get Unlimited Scans' : 'Unlock Full Auction Shield'}
                </Link>
              </div>
            )}
          </motion.div>
          
          <p className="animate-enter mt-4 text-xs text-slate-500 font-medium" style={{ animationDelay: '260ms' }}>
            <span className="text-orange-500 font-bold">Quick Tip:</span> Enter any VIN to get an instant market estimate. Free for 3 vehicles/day.
          </p>
        </div>

          <DemoPhone className="animate-enter [animation-delay:300ms]" />
        </div>
      </section>

      {/* What decides the bid: live instruments */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="max-w-2xl mb-10 md:mb-14">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-orange-400">How it decides</p>
              <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-[-0.03em]">
                Everything that decides the bid. <span className="text-slate-500">In one scan.</span>
              </h2>
            </div>
          </Reveal>
          <FeatureBento />
        </div>
      </section>

      {/* The Auction Roast (Problem Awareness) */}
      <section id="roast" className="py-24 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950 to-slate-950" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-orange-500 font-bold mb-4">
                <AlertTriangle className="h-5 w-5" />
                <span>The "Good Deal" Trap</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
                Your gut says "Buy". <br />
                <span className="text-slate-500">The math says "Run".</span>
              </h2>
              <p className="text-lg text-slate-400 leading-relaxed mb-8">
                That 2015 Camry looks like a steal at $10k. But after the $600 buy fee, $400 transport, and $800 reconditioning, you're already underwater. <br /><br />
                We calculate the <strong className="text-white">True Cost</strong> instantly, so you never bid on a loser.
              </p>
              
              <ul className="space-y-4 mb-8">
                {['Real-time Auction Fee Calculation', 'Hidden Reconditioning Estimates', 'True Market Days-to-Sale'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Card */}
            <div 
              className="relative group cursor-pointer"
              onMouseEnter={() => setRoastRevealed(true)}
              onMouseLeave={() => setRoastRevealed(false)}
              onClick={() => setRoastRevealed(!roastRevealed)}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header mimicking a listing */}
                <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center">
                      <Smartphone className="text-slate-500" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">2015 Toyota Camry</div>
                      <div className="text-xs text-slate-500">85k Miles • Clean Title</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Current Bid</div>
                    <div className="text-lg font-bold text-white">$10,200</div>
                  </div>
                </div>

                {/* The Reveal Overlay */}
                <div className="p-8 min-h-[300px] flex items-center justify-center text-center relative">
                   <div className={`transition-all duration-500 absolute inset-0 flex flex-col items-center justify-center p-8 ${roastRevealed ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                      <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                        <Lock className="text-slate-400 h-8 w-8" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">Tap to Reveal Truth</h3>
                      <p className="text-slate-400">See the hidden costs behind this bid.</p>
                   </div>

                   <div className={`transition-opacity duration-300 absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-8 ${roastRevealed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      {roastRevealed && (
                        <div className="w-full space-y-3">
                          <CostWaterfall marketPrice={11500} bid={10200} auctionFee={680} transport={350} recon={500} legend={false} className="mb-4" />
                          {[
                            { label: 'Sale Price (Est)', value: '$11,500', tone: 'text-emerald-400', labelTone: 'text-slate-400' },
                            { label: 'Bid Amount', value: '$10,200', tone: 'text-white', labelTone: 'text-slate-400' },
                            { label: 'Auction Fees', value: '-$680', tone: 'text-red-400', labelTone: 'text-red-400 font-medium' },
                            { label: 'Transport/Recon', value: '-$850', tone: 'text-red-400', labelTone: 'text-red-400 font-medium' },
                          ].map((row, i) => (
                            <motion.div
                              key={row.label}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.12, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                              className="flex justify-between text-sm"
                            >
                              <span className={row.labelTone}>{row.label}</span>
                              <span className={`${row.tone} font-mono`}>{row.value}</span>
                            </motion.div>
                          ))}
                          <div className="h-px bg-slate-800 my-2" />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.5, type: 'spring', damping: 18, stiffness: 260 }}
                            className="flex justify-between text-lg font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20"
                          >
                            <span className="text-red-500">Net Loss</span>
                            <AnimatedNumber value={-230} format={(n) => `-$${Math.abs(Math.round(n)).toLocaleString('en-US')}`} className="text-red-500" duration={1.1} />
                          </motion.div>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Persona Strategy */}
      <section id="personas" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">One Tool. Two Weapons.</h2>
          <p className="text-slate-400">Whether you're new school or old school, we protect your money.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Persona A: The Hunter */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-all">
            <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
              <Zap className="text-blue-400 h-6 w-6" />
            </div>
            <h3 className="text-2xl font-semibold tracking-tight text-white mb-2">The Digital Hunter</h3>
            <p className="text-slate-400 mb-6 h-12">"I want automation, data, and speed. I hate manual calculations."</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <span className="text-slate-300">Real-time API Data Analysis</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <span className="text-slate-300">Automated "Days-to-Sale" prediction</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <span className="text-slate-300">Competitor Listing Spy</span>
              </li>
            </ul>
          </div>

          {/* Persona B: The Veteran */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-all">
            <div className="h-12 w-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6">
              <Shield className="text-orange-400 h-6 w-6" />
            </div>
            <h3 className="text-2xl font-semibold tracking-tight text-white mb-2">The Auction Veteran</h3>
            <p className="text-slate-400 mb-6 h-12">"I trust my gut, but I hate overpaying on fees. Keep it simple."</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                <span className="text-slate-300">Simple Red Light / Green Light</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                <span className="text-slate-300">Instant Auction Fee Calculator</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                <span className="text-slate-300">Profit Margin Protection</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Guerrilla Beta Access */}
      <section id="beta" className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <Reveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 px-6 py-14 text-center shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)] sm:px-12 md:py-20">
            {/* Warm glow + fine dot texture, no images */}
            <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[46rem] max-w-[140%] -translate-x-1/2 rounded-full bg-orange-500/25 blur-[100px]" aria-hidden />
            <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]" aria-hidden />

            <div className="relative">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-orange-400">Beta Pilot program</p>
              <h2 className="mt-4 text-4xl md:text-6xl font-semibold text-white tracking-[-0.035em]">
                We Need 10 Dealers.
              </h2>
              <p className="mt-5 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
                We are looking for 10 "Beta Pilots" in each city. You get full access for free.
                All we ask for is your brutal, honest feedback.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-7 py-3.5 rounded-xl text-base font-semibold shadow-[0_12px_32px_-12px_rgb(249_115_22/0.8),inset_0_1px_0_0_rgb(255_255_255/0.25)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                >
                  Join the Beta Pilot <ArrowRight className="h-4 w-4" />
                </Link>
                <span className="text-slate-500 text-sm font-medium">
                  Only 3 spots left in your region
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 px-4 border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Target className="h-4 w-4" />
            <span>© {new Date().getFullYear()} Dealer Co-Pilot. Built for the hustle.</span>
          </div>
          <div className="flex gap-2">
            <a href="#" className="px-2 py-2.5 hover:text-white transition">Privacy</a>
            <a href="#" className="px-2 py-2.5 hover:text-white transition">Terms</a>
            <a href="#" className="px-2 py-2.5 hover:text-white transition">Contact</a>
          </div>
        </div>
      </footer>

      {/* Mobile sticky CTA once the hero scrolls away */}
      <AnimatePresence>
        {!heroInView && (
          <motion.div
            initial={{ y: 96 }}
            animate={{ y: 0 }}
            exit={{ y: 96 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="md:hidden fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent"
          >
            <Link
              to="/signup"
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3.5 rounded-2xl font-semibold shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-transform"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Fades content up once when it scrolls into view. */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
