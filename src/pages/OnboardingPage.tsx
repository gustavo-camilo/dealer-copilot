import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, Target, Clock, RefreshCw, AlertCircle, ChevronRight, Globe, Database, ArrowLeft, Mail, ShieldCheck, Zap, Rocket, BarChart3, TrendingUp } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import Header from '../components/Header';

export default function OnboardingPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    if (analyzing) {
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 100) { clearInterval(interval); setAnalysisComplete(true); setAnalyzing(false); return 100; }
          return prev + 1;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [analyzing]);

  const handleStartAnalysis = () => { setError(null); setAnalyzing(true); setAnalysisProgress(0); };

  if (analysisComplete) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <Header user={user} tenant={tenant} signOut={signOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
        <div className="max-w-4xl mx-auto px-6 py-20 relative z-10 text-center">
          <GlassCard className="p-16">
            <div className="mb-10 inline-flex p-6 bg-primary-500 rounded-3xl shadow-glow-primary">
              <CheckCircle size={48} className="text-white" />
            </div>
            <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-6 uppercase italic tracking-tighter">Sector <span className="text-primary-500">Synchronized</span></h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest leading-relaxed mb-12">Registry calibration complete. Your local market delta has been analyzed and mapped to the global sink.</p>
            <button onClick={() => navigate('/dashboard')} className="px-12 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all flex items-center gap-3 mx-auto">
              Deploy Terminal <Rocket size={14} />
            </button>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Header user={user} tenant={tenant} signOut={signOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="px-3 py-1 bg-primary-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg">Phase 01</div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Initialization</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white mb-8 tracking-tighter uppercase italic">
              Welcome to the <span className="text-primary-500">Registry</span>
            </h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest leading-loose mb-12 max-w-lg">
              Your dealership profile has been detected. We are ready to initialize your local sector intelligence and calibrate acquisition protocols.
            </p>

            <div className="space-y-6">
              {[
                { label: 'Validated Merchant Identity', icon: ShieldCheck, status: 'Active' },
                { label: 'Local Sector Telemetry', icon: Globe, status: 'Ready' },
                { label: 'Inventory Matrix Mapping', icon: Database, status: 'Pending' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-2xl">
                  <div className="p-3 bg-slate-100 dark:bg-white/10 rounded-xl">
                    <item.icon size={18} className="text-primary-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{item.label}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">{item.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <GlassCard className="p-10 md:p-16 flex flex-col items-center text-center">
            {!analyzing ? (
              <>
                <div className="w-24 h-24 bg-primary-500/10 rounded-3xl flex items-center justify-center mb-10 border border-primary-500/20">
                  <Target size={40} className="text-primary-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4 uppercase italic tracking-tighter">Initialize Analysis</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed mb-12 max-w-xs">
                  Begin local sector probe to establish baseline acquisition delta and identify predatory opportunities.
                </p>

                {error && (
                  <div className="w-full p-4 mb-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}

                <button
                  onClick={handleStartAnalysis}
                  className="w-full py-6 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary-500/20"
                >
                  Execute Probe Protocol <ChevronRight size={14} />
                </button>
              </>
            ) : (
              <>
                <div className="relative w-48 h-48 mb-12">
                  <svg className="w-full h-full rotate-[-90deg]">
                    <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100 dark:text-white/5" />
                    <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={553} strokeDashoffset={553 - (553 * analysisProgress) / 100} className="text-primary-500 transition-all duration-300" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <RefreshCw size={32} className="text-primary-500 animate-spin mb-2" />
                    <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{analysisProgress}%</div>
                  </div>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4 uppercase italic tracking-tighter">Analyzing Sector</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed mb-10 animate-pulse">
                  Mapping competitor nodes and establishing price ceilings...
                </p>
                <div className="w-full space-y-3">
                  {[
                    { label: 'Scraping Registry Data', progress: Math.min(100, analysisProgress * 1.5) },
                    { label: 'Calculating Market Delta', progress: Math.max(0, Math.min(100, (analysisProgress - 30) * 1.5)) },
                    { label: 'Calibrating Protocols', progress: Math.max(0, Math.min(100, (analysisProgress - 60) * 2.5)) },
                  ].map((p, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        <span>{p.label}</span>
                        <span>{Math.floor(p.progress)}%</span>
                      </div>
                      <div className="h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </GlassCard>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          {[
            { title: 'Alpha Tracking', desc: 'Identify extreme market outliers', icon: TrendingUp },
            { title: 'Predictive Sourcing', icon: Target, desc: 'AI-driven asset recommendations' },
            { title: 'Sector Monitoring', icon: BarChart3, desc: 'Real-time competitor inventory logs' },
          ].map((feat, i) => (
            <div key={i} className="flex gap-4 p-8 bg-white/30 dark:bg-white/5 rounded-3xl border border-slate-200/50 dark:border-white/5 backdrop-blur-sm">
              <div className="p-3 h-fit bg-primary-500/10 rounded-2xl">
                <feat.icon size={20} className="text-primary-500" />
              </div>
              <div>
                <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2">{feat.title}</h4>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
