import React from 'react';
import { Link } from 'react-router-dom';
import {
  Target,
  TrendingUp,
  Car,
  Package,
  Scan,
  Globe,
  Settings,
  LogOut,
  X,
  Menu,
} from 'lucide-react';

interface NavigationMenuProps {
  currentPath: string;
  onClose: () => void;
  onSignOut: () => void;
  user: {
    full_name?: string;
    email?: string;
    role?: string;
  } | null;
  tenantName?: string;
}

export default function NavigationMenu({
  currentPath,
  onClose,
  onSignOut,
  user,
  tenantName,
}: NavigationMenuProps) {
  const menuItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: Target,
      showOnMobile: true,
    },
    {
      path: '/inventory',
      label: 'Inventory',
      icon: Car,
      showOnMobile: true,
    },
    {
      path: '/scan',
      label: 'Scan',
      icon: Scan,
      showOnMobile: true,
      highlight: true,
    },
    {
      path: '/competitors',
      label: 'Competitors',
      icon: TrendingUp,
      showOnMobile: true,
    },
    {
      path: '/recommendations',
      label: 'Recommendations',
      icon: Target,
      showOnMobile: false, // Not in bottom nav (too many items)
    },
    {
      path: '/vin-scans',
      label: 'VIN History',
      icon: Package,
      showOnMobile: false, // Not in bottom nav
    },
    {
      path: '/onboarding',
      label: 'Scan Website',
      icon: Globe,
      showOnMobile: true,
    },
  ];

  // Items for mobile bottom navigation (max 5)
  const mobileNavItems = menuItems.filter(item => item.showOnMobile).slice(0, 5);

  // Items for desktop dropdown (all items)
  const desktopMenuItems = menuItems;

  return (
    <>
      {/* Desktop Dropdown Menu (unchanged) */}
      <div className="hidden md:block">
        {/* Overlay/backdrop */}
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40"
          onClick={onClose}
        />

        {/* Dropdown menu */}
        <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg bg-white border border-gray-200 z-50">
          {/* User Info */}
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
            <p className="text-xs text-gray-500 mt-1">{tenantName}</p>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {desktopMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 ${
                    isActive ? 'bg-gray-50' : ''
                  }`}
                  onClick={onClose}
                >
                  <Icon
                    className={`h-4 w-4 mr-3 ${
                      item.highlight ? 'text-orange-600' : ''
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}

            {/* Admin Panel - Only for super_admin */}
            {user?.role === 'super_admin' && (
              <Link
                to="/admin"
                className={`flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 ${
                  currentPath === '/admin' ? 'bg-gray-50' : ''
                }`}
                onClick={onClose}
              >
                <Settings className="h-4 w-4 mr-3" />
                Admin Panel
              </Link>
            )}
          </div>

          {/* Sign Out */}
          <div className="border-t border-gray-200 py-2">
            <button
              onClick={onSignOut}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation (ALWAYS VISIBLE) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="flex justify-around items-center h-16">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full ${
                  isActive ? 'text-blue-900' : 'text-gray-600'
                } hover:text-blue-900 transition-colors`}
              >
                <Icon
                  className={`h-6 w-6 ${
                    item.highlight && !isActive ? 'text-orange-600' : ''
                  }`}
                />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
