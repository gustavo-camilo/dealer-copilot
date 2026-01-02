import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Menu, Target, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import NavigationMenu from '../components/NavigationMenu';

export default function UpgradeSuccessPage() {
  const { user, tenant, signOut } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-navy-950">
      <div className="sticky top-0 z-40 bg-white dark:bg-navy-900 border-b border-gray-200 dark:border-navy-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center">
              <Target className="h-8 w-8 text-blue-900 dark:text-blue-400" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Dealer Co-Pilot</span>
            </Link>
            <div className="flex items-center space-x-4 relative">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:inline">{tenant?.name}</span>
              <Link
                to="/scan"
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition hidden md:inline-block dark:bg-orange-700 dark:hover:bg-orange-800"
              >
                Scan VIN
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 transition"
                  aria-label="Menu"
                >
                  {menuOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
                </button>

                {menuOpen && (
                  <NavigationMenu
                    currentPath="/upgrade/success"
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-lg border border-gray-200 dark:border-navy-700 p-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full p-4">
              <CheckCircle2 className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Subscription activated
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            You now have full access to the platform. Let's get your dealership set up.
          </p>
          <button
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center justify-center bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Go to onboarding
          </button>
          <div className="mt-6">
            <Link to="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Go to dashboard instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
