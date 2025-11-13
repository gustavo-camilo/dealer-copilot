import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Target, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NavigationMenu from './NavigationMenu';

export default function AppHeader() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center">
              <Target className="h-8 w-8 text-blue-900" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                Dealer Co-Pilot
              </span>
            </Link>

            {/* Right side */}
            <div className="flex items-center space-x-4 relative">
              {/* Tenant name - hidden on mobile */}
              <span className="text-sm text-gray-600 hidden md:inline">
                {tenant?.name}
              </span>

              {/* Scan VIN button - hidden on mobile (shown in bottom nav) */}
              <Link
                to="/scan"
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition hidden md:inline-block"
              >
                Scan VIN
              </Link>

              {/* Desktop menu button - only shown on desktop */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition"
                  aria-label="Menu"
                >
                  {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>

                {/* Desktop dropdown menu */}
                {menuOpen && (
                  <NavigationMenu
                    currentPath={location.pathname}
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

      {/* Mobile bottom navigation - always visible */}
      <div className="md:hidden">
        <NavigationMenu
          currentPath={location.pathname}
          onClose={() => {}} // No-op on mobile since it's always visible
          onSignOut={handleSignOut}
          user={user}
          tenantName={tenant?.name}
        />
      </div>
    </>
  );
}
