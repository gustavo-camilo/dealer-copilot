import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Target, ArrowLeft, TrendingUp, Construction, Calendar, BarChart3, Rocket, ShieldCheck } from 'lucide-react';
import Header from '../components/Header';
import GlassCard from '../components/ui/GlassCard';

export default function CompetitorHistoryPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const { competitorId } = useParams();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Header user={user} tenant={tenant} signOut={signOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Back Link */}
        <Link to="/competitor-analysis" className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary-500 transition-colors mb-12">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to Sector Intelligence
        </Link>

        {/* Coming Soon Protocol */}
        <div className="max-w-4xl mx-auto">
          <GlassCard className="p-16 text-center overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Construction size={240} />
            </div>

            <div className="relative z-10">
              <div className="relative inline-block mb-10">
                <div className="absolute inset-0 bg-secondary-500/20 blur-2xl rounded-full" />
                <div className="relative bg-secondary-500 p-6 rounded-3xl shadow-glow-secondary">
                  <Construction className="h-12 w-12 text-white" />
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tighter uppercase italic">
                Strategic <span className="text-secondary-500">Timeline</span> Protocols
              </h1>

              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-xl mx-auto leading-relaxed mb-16">
                Initializing detailed historical delta analytics & longitudinal market trend monitoring
              </p>

              <div className="grid md:grid-cols-2 gap-6 text-left mb-16">
                {[
                  { label: 'Trend Synthesis', desc: 'Visual trajectory mapping for pricing, inventory, and market shifts.', icon: BarChart3, color: 'text-primary-500' },
                  { label: 'Comparative Logic', desc: 'Side-by-side sector benchmarking to unlock tactical opportunities.', icon: Calendar, color: 'text-green-500' },
                  { label: 'Predictive Matrix', desc: 'AI-driven trajectory forecasting for inventory cycle optimization.', icon: ShieldCheck, color: 'text-purple-500' },
                  { label: 'Legacy Reporting', desc: 'High-fidelity tactical exports for leadership briefings.', icon: Rocket, color: 'text-orange-500' },
                ].map((item, i) => (
                  <GlassCard key={i} className="p-6 border-slate-200/50 dark:border-white/5">
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`p-2 rounded-xl bg-slate-50 dark:bg-white/5 ${item.color}`}>
                        <item.icon size={18} />
                      </div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">{item.label}</h3>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                      {item.desc}
                    </p>
                  </GlassCard>
                ))}
              </div>

              <div className="bg-slate-900 dark:bg-white rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-left">
                  <h3 className="text-white dark:text-slate-900 font-black uppercase tracking-tighter text-2xl italic mb-2">Protocol Deployment: Q2 2025</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Subscribe to delta updates for immediate activation</p>
                </div>
                <button className="whitespace-nowrap px-8 py-4 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all">
                  Notify My Registry
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
