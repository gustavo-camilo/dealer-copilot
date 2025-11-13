import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Target, Check, TrendingUp, Zap, Crown, Menu, X, History } from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';

export default function UpgradePage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentTier, setCurrentTier] = useState<string>('starter');

  const feature = searchParams.get('feature');
  const competitorId = searchParams.get('competitor');

  useEffect(() => {
    loadCurrentTier();
  }, [tenant?.id]);

  const loadCurrentTier = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('subscription_tier')
        .eq('id', tenant?.id)
        .single();

      if (error) throw error;
      setCurrentTier(data?.subscription_tier || 'starter');
    } catch (error) {
      console.error('Error loading tier:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const plans = [
    {
      name: 'Starter',
      icon: Zap,
      price: 'Free',
      period: '',
      description: 'Perfect for getting started',
      features: [
        'Basic competitor scanning',
        'Current snapshot only',
        'Up to 3 competitors',
        'Email support',
      ],
      current: currentTier === 'starter',
      color: 'gray',
    },
    {
      name: 'Professional',
      icon: TrendingUp,
      price: '$99',
      period: '/month',
      description: 'For growing dealerships',
      features: [
        'Advanced competitor scanning',
        'Up to 10 competitors',
        'Price alerts',
        'Priority support',
        'API access',
      ],
      current: currentTier === 'professional',
      color: 'blue',
      comingSoon: true,
    },
    {
      name: 'Enterprise',
      icon: Crown,
      price: '$299',
      period: '/month',
      description: 'For serious competitors',
      features: [
        'Everything in Professional',
        'Unlimited competitors',
        'Full scan history & analytics',
        'Detailed trend analysis',
        'Custom reports',
        'Dedicated account manager',
        'White-label options',
      ],
      current: currentTier === 'enterprise',
      color: 'purple',
      comingSoon: true,
      highlighted: feature === 'history', // Highlight if coming from history feature
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center">
              <Target className="h-8 w-8 text-blue-900" />
              <span className="ml-2 text-xl font-bold text-gray-900">Dealer Co-Pilot</span>
            </Link>
            <div className="flex items-center space-x-4 relative">
              <span className="text-sm text-gray-600 hidden md:inline">{tenant?.name}</span>
              <Link
                to="/scan"
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition hidden md:inline-block"
              >
                Scan VIN
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition"
                  aria-label="Menu"
                >
                  {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>

                {menuOpen && (
                  <NavigationMenu
                    currentPath="/upgrade"
                    onClose={() => setMenuOpen(false)}
                    onSignOut={handleSignOut}
                    user={user}
                    tenantName={tenant?.name}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Feature-Specific Banner */}
        {feature === 'history' && (
          <div className="mb-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <History className="w-8 h-8 text-purple-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Unlock Competitor Scan History
                </h2>
                <p className="text-gray-700">
                  Track competitor inventory changes over time with full scan history and analytics.
                  Upgrade to Enterprise to access this powerful feature.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {feature === 'history' ? 'Upgrade to Access Scan History' : 'Upgrade Your Competitive Intelligence'}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the plan that best fits your dealership's needs and stay ahead of the competition
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative bg-white rounded-xl shadow-lg border-2 ${
                  plan.current
                    ? 'border-green-500'
                    : plan.highlighted
                    ? 'border-purple-500 ring-4 ring-purple-200'
                    : plan.color === 'purple'
                    ? 'border-purple-500'
                    : 'border-gray-200'
                } overflow-hidden transition-transform hover:scale-105`}
              >
                {plan.current && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    Current Plan
                  </div>
                )}
                {!plan.current && plan.highlighted && (
                  <div className="absolute top-0 right-0 bg-purple-600 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    Recommended
                  </div>
                )}
                {!plan.current && !plan.highlighted && plan.comingSoon && (
                  <div className="absolute top-0 right-0 bg-orange-500 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    Coming Soon
                  </div>
                )}

                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`p-3 rounded-lg ${
                        plan.color === 'purple'
                          ? 'bg-purple-100'
                          : plan.color === 'blue'
                          ? 'bg-blue-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          plan.color === 'purple'
                            ? 'text-purple-600'
                            : plan.color === 'blue'
                            ? 'text-blue-600'
                            : 'text-gray-600'
                        }`}
                      />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  </div>

                  <p className="text-gray-600 mb-6">{plan.description}</p>

                  <div className="mb-8">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-gray-600">{plan.period}</span>}
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled={plan.current || plan.comingSoon}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition ${
                      plan.current
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : plan.comingSoon
                        ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                        : plan.color === 'purple'
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {plan.current
                      ? 'Current Plan'
                      : plan.comingSoon
                      ? 'Coming Soon'
                      : 'Upgrade Now'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact Section */}
        <div className="mt-16 text-center">
          <div className="bg-blue-50 rounded-xl p-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Need a Custom Solution?</h2>
            <p className="text-gray-600 mb-6">
              Contact our sales team to discuss enterprise features, custom integrations, and volume
              pricing for dealership groups.
            </p>
            <a
              href="mailto:sales@dealer-copilot.com"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
