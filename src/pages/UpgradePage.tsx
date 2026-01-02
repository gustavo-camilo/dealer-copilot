import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, Check, TrendingUp, Zap, Crown, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import NavigationMenu from '../components/NavigationMenu';

export default function UpgradePage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState<string | null>(null);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);

  const currentPlan = tenant?.plan_type || 'free';

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleCheckout = async (planType: 'pro' | 'enterprise') => {
    if (!tenant?.id) {
      setCheckoutError('Unable to start checkout. Please try again.');
      return;
    }

    setCheckoutLoading(planType);
    setCheckoutError(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          tenantId: tenant.id,
          planType,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        throw new Error('Checkout session could not be created.');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to start checkout.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const plans = [
    {
      name: 'Starter',
      planType: 'free',
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
      color: 'gray',
    },
    {
      name: 'Professional',
      planType: 'pro',
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
      color: 'blue',
    },
    {
      name: 'Enterprise',
      planType: 'enterprise',
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
      color: 'purple',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center">
              <Target className="h-8 w-8 text-blue-900 dark:text-blue-400" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Dealer Co-Pilot</span>
            </Link>
            <div className="flex items-center space-x-4 relative">
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden md:inline">{tenant?.name}</span>
              <Link
                to="/scan"
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 dark:hover:bg-orange-600 transition hidden md:inline-block"
              >
                Scan VIN
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition dark:text-gray-300"
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
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Upgrade Your Competitive Intelligence
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Choose the plan that best fits your dealership's needs and stay ahead of the competition
          </p>
        </div>

        {checkoutError && (
          <div className="max-w-3xl mx-auto mb-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
            {checkoutError}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.planType;
            const isLoading = checkoutLoading === plan.planType;
            const isPaidPlan = plan.planType !== 'free';
            const isDisabled = isCurrent || isLoading || !isPaidPlan;

            return (
              <div
                key={plan.name}
                className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 ${
                  isCurrent
                    ? 'border-green-500 dark:border-green-500'
                    : plan.color === 'purple'
                    ? 'border-purple-500 dark:border-purple-500'
                    : plan.color === 'blue'
                    ? 'border-blue-500 dark:border-blue-500'
                    : 'border-gray-200 dark:border-gray-700'
                } overflow-hidden transition-transform hover:scale-105`}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    Current Plan
                  </div>
                )}

                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`p-3 rounded-lg ${
                        plan.color === 'purple'
                          ? 'bg-purple-100 dark:bg-purple-900'
                          : plan.color === 'blue'
                          ? 'bg-blue-100 dark:bg-blue-900'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          plan.color === 'purple'
                            ? 'text-purple-600 dark:text-purple-400'
                            : plan.color === 'blue'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-300'
                        }`}
                      />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 mb-6">{plan.description}</p>

                  <div className="mb-8">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    {plan.period && <span className="text-gray-600 dark:text-gray-400">{plan.period}</span>}
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled={isDisabled}
                    onClick={
                      isPaidPlan && !isCurrent
                        ? () => handleCheckout(plan.planType as 'pro' | 'enterprise')
                        : undefined
                    }
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition ${
                      isCurrent
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : isLoading
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-wait'
                        : plan.color === 'purple'
                        ? 'bg-purple-600 text-white hover:bg-purple-700 dark:hover:bg-purple-500'
                        : 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500'
                    }`}
                  >
                    {isCurrent
                      ? 'Current Plan'
                      : isLoading
                      ? 'Redirecting...'
                      : isPaidPlan
                      ? 'Upgrade Now'
                      : 'Starter Plan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact Section */}
        <div className="mt-16 text-center">
          <div className="bg-blue-50 dark:bg-blue-900 rounded-xl p-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Need a Custom Solution?</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Contact our sales team to discuss enterprise features, custom integrations, and volume
              pricing for dealership groups.
            </p>
            <a
              href="mailto:sales@dealer-copilot.com"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-500 transition"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
