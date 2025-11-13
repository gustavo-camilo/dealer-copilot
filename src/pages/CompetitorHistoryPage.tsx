import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Target, ArrowLeft, Menu, X, TrendingUp, Construction } from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';

export default function CompetitorHistoryPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const { competitorId } = useParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSubscriptionTier();
  }, [tenant?.id]);

  const checkSubscriptionTier = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('subscription_tier')
        .eq('id', tenant?.id)
        .single();

      if (error) throw error;

      const tier = data?.subscription_tier || 'starter';
      setSubscriptionTier(tier);

      // Redirect non-enterprise users to upgrade page
      if (tier !== 'enterprise') {
        navigate(`/upgrade?feature=history&competitor=${competitorId}`);
      }
    } catch (error) {
      console.error('Error checking subscription tier:', error);
      navigate('/upgrade?feature=history');
    } finally {
      setLoading(false);
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

  // Show loading while checking tier
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Only render page for enterprise users (others are redirected)
  if (subscriptionTier !== 'enterprise') {
    return null;
  }

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
                    currentPath="/competitor-analysis"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          to="/competitor-analysis"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Competitor Analysis
        </Link>

        {/* Coming Soon Message */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-6">
            <Construction className="w-10 h-10 text-orange-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Detailed History Analytics Coming Soon
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            We're working hard to bring you comprehensive competitor history analytics, including:
          </p>

          <div className="grid md:grid-cols-2 gap-6 text-left mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Trend Analysis</h3>
              </div>
              <p className="text-sm text-gray-600">
                Visual charts showing pricing, inventory, and market trends over time
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Comparative Insights</h3>
              </div>
              <p className="text-sm text-gray-600">
                Compare multiple competitors side-by-side to identify market opportunities
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">Predictive Analytics</h3>
              </div>
              <p className="text-sm text-gray-600">
                AI-powered predictions for pricing strategies and inventory optimization
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Custom Reports</h3>
              </div>
              <p className="text-sm text-gray-600">
                Export detailed reports for team meetings and strategic planning
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Want to be notified when it's ready?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This feature is scheduled for release in Q2 2025. We'll send you an email as soon as
              it's available.
            </p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold">
              Notify Me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
