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
      path: '/scan',
      label: 'Scan VIN',
      icon: Scan,
      showOnMobile: true,
      mobileOnly: true,
      highlight: true,
    },
    {
      path: '/inventory',
      label: 'Manage Inventory',
      icon: Car,
      showOnMobile: true,
    },
    {
      path: '/competitors',
      label: 'Competitor Intel',
      icon: TrendingUp,
      showOnMobile: true,
    },
    {
      path: '/recommendations',
      label: 'View Recommendations',
      icon: Target,
      showOnMobile: true,
    },
    {
      path: '/vin-scans',
      label: 'VIN Scan History',
      icon: Package,
      showOnMobile: true,
    },
    {
      path: '/onboarding',
      label: 'Scan Website',
      icon: Globe,
      showOnMobile: true,
    },
  ];

  return (
    <>
      {/* Full-page overlay on mobile, backdrop on desktop */}
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Mobile: Full-page menu, Desktop: Dropdown */}
      <div className="fixed inset-0 bg-white z-50 md:absolute md:inset-auto md:right-0 md:mt-2 md:w-64 md:rounded-lg md:shadow-lg md:border md:border-gray-200">
        {/* Mobile Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 md:hidden">
          <div className="flex items-center">
            <Target className="h-6 w-6 text-blue-900" />
            <span className="ml-2 text-lg font-bold text-gray-900">Menu</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 md:p-4 border-b border-gray-200">
          <p className="text-base md:text-sm font-semibold text-gray-900">{user?.full_name}</p>
          <p className="text-sm md:text-xs text-gray-500">{user?.email}</p>
          <p className="text-sm md:text-xs text-gray-500 mt-1">{tenantName}</p>
        </div>

        {/* Menu Items */}
        <div className="py-4 md:py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            const itemClasses = `flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50 ${
              isActive ? 'bg-gray-50' : ''
            } ${item.mobileOnly ? 'md:hidden' : ''}`;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={itemClasses}
                onClick={onClose}
              >
                <Icon
                  className={`h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3 ${
                    item.highlight ? 'text-orange-600' : ''
                  }`}
                />
                {item.label}
              </Link>
            );
          })}

          {/* Settings - For all authenticated users */}
          <Link
            to="/settings"
            className={`flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50 ${
              currentPath === '/settings' ? 'bg-gray-50' : ''
            }`}
            onClick={onClose}
          >
            <Settings className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
            Settings
          </Link>

          {/* Admin Panel - For va_uploader and super_admin */}
          {(user?.role === 'va_uploader' || user?.role === 'super_admin') && (
            <Link
              to="/admin"
              className={`flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50 ${
                currentPath === '/admin' ? 'bg-gray-50' : ''
              }`}
              onClick={onClose}
            >
              <Settings className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
              {user?.role === 'va_uploader' ? 'Upload Portal' : 'Admin Panel'}
            </Link>
          )}
        </div>

        {/* Sign Out */}
        <div className="border-t border-gray-200 py-4 md:py-2 mt-auto">
          <button
            onClick={onSignOut}
            className="flex items-center w-full px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
