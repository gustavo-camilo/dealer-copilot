import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Menu, Target, X, Rocket, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import GlassCard from '../components/ui/GlassCard';

export default function UpgradeSuccessPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Header user={user} tenant={tenant} signOut={signOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <div className="max-w-4xl mx-auto px-6 py-20 relative z-10">
        <GlassCard className="p-16 text-center overflow-hidden relative">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Rocket size={240} className="rotate-12" />
          </div>

          <div className="relative z-10">
            <div className="relative inline-block mb-10">
              <div className="absolute inset-0 bg-primary-500/20 blur-2xl rounded-full" />
              <div className="relative bg-primary-500 p-6 rounded-3xl shadow-glow-primary">
                <ShieldCheck className="h-12 w-12 text-white" />
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tighter uppercase italic">
              Registry Subscription <span className="text-primary-500">Activated</span>
            </h1>

            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-xl mx-auto leading-relaxed mb-12">
              Advanced acquisition protocols are now live in your terminal. All platform barriers have been neutralized.
            </p>

            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-16">
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full md:w-auto px-10 py-5 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary-500/20"
              >
                Initialize Onboarding <ArrowRight size={14} />
              </button>
              <Link
                to="/dashboard"
                className="w-full md:w-auto px-10 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all flex items-center justify-center gap-3"
              >
                Terminal Dashboard
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12 border-t border-slate-100 dark:border-white/5">
              {[
                { label: 'Asset Delta', status: 'Enabled' },
                { label: 'Sector Intel', status: 'Unlocked' },
                { label: 'AI Registry', status: 'Online' },
                { label: 'Global Sink', status: 'Ready' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</div>
                  <div className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center justify-center gap-1">
                    <Sparkles size={10} /> {item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
