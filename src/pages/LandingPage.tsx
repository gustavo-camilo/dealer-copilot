import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Target, Zap, Shield, TrendingUp, CheckCircle, XCircle, AlertTriangle, ArrowRight, Menu, X, Smartphone, BarChart3, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { decodeVIN } from '../services/vinDecoder';
import { getMarketPricing } from '../services/marketPricing';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [vinInput, setVinInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<'idle' | 'scanning' | 'success' | 'danger' | 'error' | 'limit'>('idle');
  const [roastRevealed, setRoastRevealed] = useState(false);
  const [scanData, setScanData] = useState<any>(null);

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
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-orange-500/30">
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
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-orange-500/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase">Live Auction Intelligence</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold leading-tight tracking-tight mb-6"
          >
            Stop Guessing. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-orange-600">
              Start Profiting.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            The "Auction Shield" for independent dealers. We calculate hidden fees, reconditioning, and real market days-to-sale in 3 seconds.
          </motion.p>

          {/* Interactive Mock Scan */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="max-w-md mx-auto bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl shadow-black/50 ring-1 ring-white/10"
          >
            {scanResult === 'idle' && (
              <form onSubmit={handleScan} className="relative">
                <input
                  type="text"
                  value={vinInput}
                  onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                  placeholder="Enter VIN to Scan"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all font-mono tracking-wider"
                />
                <button
                  type="submit"
                  disabled={vinInput.length < 11}
                  className="absolute right-2 top-2 bottom-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 rounded-lg font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
                >
                  Scan
                </button>
              </form>
            )}

            {scanResult === 'scanning' && (
              <div className="h-[72px] flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" />
                <span className="text-slate-300 font-mono animate-pulse">Analyzing Market Data...</span>
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
                            ${scanData.market?.average_price?.toLocaleString() || 'N/A'}
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
          
          <p className="mt-4 text-xs text-slate-500 font-medium">
            <span className="text-orange-500 font-bold">Quick Tip:</span> Enter any VIN to get an instant market estimate. Free for 3 vehicles/day.
          </p>
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
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
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

                   <div className={`transition-all duration-500 absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 ${roastRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}>
                      <div className="w-full space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Sale Price (Est)</span>
                          <span className="text-emerald-400 font-mono">$11,500</span>
                        </div>
                        <div className="h-px bg-slate-800 my-2" />
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Bid Amount</span>
                          <span className="text-white font-mono">$10,200</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-400 font-medium">Auction Fees</span>
                          <span className="text-red-400 font-mono">-$680</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-400 font-medium">Transport/Recon</span>
                          <span className="text-red-400 font-mono">-$850</span>
                        </div>
                        <div className="h-px bg-slate-800 my-2" />
                        <div className="flex justify-between text-lg font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                          <span className="text-red-500">Net Loss</span>
                          <span className="text-red-500">-$230</span>
                        </div>
                      </div>
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
          <h2 className="text-3xl md:text-5xl font-bold mb-4">One Tool. Two Weapons.</h2>
          <p className="text-slate-400">Whether you're new school or old school, we protect your money.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Persona A: The Hunter */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-all">
            <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
              <Zap className="text-blue-400 h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">The Digital Hunter</h3>
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
            <h3 className="text-2xl font-bold text-white mb-2">The Auction Veteran</h3>
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
      <section id="beta" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-orange-600"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-orange-900/90 to-transparent"></div>
        
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight">
            We Need 10 Dealers.
          </h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto font-medium">
            We are looking for 10 "Beta Pilots" in each city. You get full access for free. 
            All we ask for is your brutal, honest feedback.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              to="/signup"
              className="bg-white text-orange-600 px-8 py-4 rounded-xl text-xl font-bold hover:bg-orange-50 transition-all shadow-xl shadow-black/20 transform hover:-translate-y-1"
            >
              Join the Beta Pilot
            </Link>
            <span className="text-orange-200 text-sm font-medium">
              Only 3 spots left in your region
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 px-4 border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Target className="h-4 w-4" />
            <span>© 2024 Dealer Co-Pilot. Built for the hustle.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition">Privacy</a>
            <a href="#" className="hover:text-white transition">Terms</a>
            <a href="#" className="hover:text-white transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
