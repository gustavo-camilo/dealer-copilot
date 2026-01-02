import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Check, TrendingUp, Zap, Crown, Sparkles, ShieldCheck, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import GlassCard from '../components/ui/GlassCard';

export default function UpgradePage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState<string | null>(null);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);

  const currentPlan = tenant?.plan_type || 'free';

  const handleCheckout = async (planType: 'pro' | 'enterprise') => {
    if (!tenant?.id) { setCheckoutError('Unable to start checkout. Please try again.'); return; }
    setCheckoutLoading(planType); setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: { tenantId: tenant.id, planType } });
      if (error) throw error;
      if (!data?.url) throw new Error('Checkout session could not be created.');
      window.location.href = data.url;
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to start checkout.');
    } finally { setCheckoutLoading(null); }
  };

  const plans = [
    { name: 'Baseline', planType: 'free', icon: Zap, price: '0', period: '/forever', description: 'Core sector intelligence for local dealerships', features: ['Standard competitor tracking', 'Single inventory snapshot', '3 target domains', 'Standard registry access'], color: 'slate' },
    { name: 'Velocity', planType: 'pro', icon: TrendingUp, price: '99', period: '/month', description: 'Performance tools for high-volume growth', features: ['Advanced delta tracking', 'Multi-source intel (10 units)', 'Price shift notifications', 'Enterprise priority queue', 'API telemetry access'], color: 'primary' },
    { name: 'Dominion', planType: 'enterprise', icon: Crown, price: '299', period: '/month', description: 'Total market control & predictive logic', features: ['Global registry access', 'Unlimited sector targets', 'Historical trajectory analysis', 'AI-driven forecasting', 'Custom white-label reports', 'Dedicated protocol manager'], color: 'secondary' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Header user={user} tenant={tenant} signOut={signOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tighter uppercase italic">
            Upgrade Your <span className="text-primary-500">Intelligence</span> Matrix
          </h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest max-w-2xl mx-auto leading-relaxed">
            Select the acquisition protocol that matches your dealership's growth trajectory. Unlock predatory market logic today.
          </p>
        </div>

        {checkoutError && (
          <div className="max-w-3xl mx-auto mb-10 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-2xl text-center">
            {checkoutError}
          </div>
        )}

        {/* Pricing Matrix */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.planType;
            const isLoading = checkoutLoading === plan.planType;
            const isPaidPlan = plan.planType !== 'free';
            const isDisabled = isCurrent || isLoading || !isPaidPlan;

            return (
              <GlassCard
                key={plan.name}
                className={`p-10 flex flex-col h-full relative group transition-all duration-500 ${isCurrent ? 'border-primary-500 shadow-glow-primary' : 'hover:border-slate-300 dark:hover:border-white/10'}`}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 p-6">
                    <span className="px-3 py-1 bg-primary-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-glow-primary">Protocol Active</span>
                  </div>
                )}

                <div className="flex items-center gap-4 mb-8">
                  <div className={`p-4 rounded-2xl bg-${plan.color === 'slate' ? 'slate-100 dark:bg-white/5' : plan.color + '-500/10'}`}>
                    <Icon size={24} className={plan.color === 'slate' ? 'text-slate-400' : `text-${plan.color}-500`} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">{plan.name}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Aquisition Protocol</p>
                  </div>
                </div>

                <div className="mb-10">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">${plan.price}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{plan.period}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-4 leading-relaxed h-10">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-12 flex-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="mt-1 p-0.5 bg-primary-500/10 rounded-full">
                        <Check size={10} className="text-primary-500" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isDisabled}
                  onClick={isPaidPlan && !isCurrent ? () => handleCheckout(plan.planType as any) : undefined}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${isCurrent ? 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed' :
                    isLoading ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 animate-pulse' :
                      plan.color === 'secondary' ? 'bg-secondary-500 text-white hover:shadow-glow-secondary shadow-lg shadow-secondary-500/20' :
                        'bg-primary-500 text-white hover:shadow-glow-primary shadow-lg shadow-primary-500/20'
                    }`}
                >
                  {isCurrent ? 'Active Registry' : isLoading ? 'Calibrating...' : isPaidPlan ? 'Upgrade Protocol' : 'Baseline Tier'}
                </button>
              </GlassCard>
            );
          })}
        </div>

        {/* Enterprise Protocol Section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <GlassCard className="p-10 md:p-16 border-dashed border-slate-200 dark:border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <ShieldCheck size={200} />
            </div>
            <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6 tracking-tighter uppercase italic">Need <span className="text-secondary-500">Custom</span> Logic?</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-loose mb-8">
                  Discuss tailored enterprise features, large-scale sector integrations, and volume pricing matrix for dealership groups.
                </p>
                <a href="mailto:sales@dealer-copilot.com" className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all">
                  Initialize Contact <Sparkles size={14} />
                </a>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Bulk Sector Support', icon: Database },
                  { label: 'White Label Logic', icon: Target },
                  { label: 'API Registry Access', icon: Zap },
                  { label: 'Account Protocol', icon: ShieldCheck },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <item.icon size={16} className="text-primary-500 mb-3" />
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
