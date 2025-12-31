
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
  ShieldCheck,
  LayoutDashboard,
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
      label: 'Inventory',
      icon: Car,
      showOnMobile: true,
    },
    {
      path: '/competitors',
      label: 'Competitors',
      icon: TrendingUp,
      showOnMobile: true,
    },
    {
      path: '/recommendations',
      label: 'VIN Scans',
      icon: Package,
      showOnMobile: true,
    },
  ];

  return (
    <>
      {/* Full-page overlay on mobile, backdrop on desktop */}
      <div
        className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
      />

      {/* Mobile: Full-page menu, Desktop: Dropdown */}
      <div className="fixed inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-50 md:absolute md:inset-auto md:right-0 md:mt-3 md:w-72 md:rounded-2xl md:shadow-2xl md:border md:border-slate-200 dark:md:border-white/5 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Mobile Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/5 md:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-primary-500" />
            </div>
            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Control Hub</span>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 md:p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
          <p className="text-sm font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{user?.full_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black px-1.5 py-0.5 bg-primary-500 text-white rounded uppercase tracking-widest">
              {user?.role?.replace('_', ' ')}
            </span>
            <p className="text-[10px] font-bold text-slate-500 truncate">{user?.email}</p>
          </div>
          {tenantName && (
            <p className="text-[10px] font-black text-primary-500 mt-2 uppercase tracking-tighter flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {tenantName}
            </p>
          )}
        </div>

        {/* Menu Items */}
        <div className="py-4 md:py-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-6 md:px-5 py-3.5 md:py-2.5 text-sm font-bold transition-all relative group ${isActive
                  ? 'text-primary-500 bg-primary-500/5'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                  } ${item.mobileOnly ? 'md:hidden' : ''}`}
                onClick={onClose}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 shadow-glow-primary rounded-r-full" />
                )}
                <Icon
                  className={`h-5 w-5 mr-4 md:mr-3 transition-colors ${isActive ? 'text-primary-500' : 'text-slate-400 group-hover:text-primary-500'
                    }`}
                />
                <span className="flex-1">{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shadow-glow-primary" />
                )}
              </Link>
            );
          })}

          <div className="h-px bg-slate-100 dark:bg-white/5 mx-6 md:mx-5 my-2" />

          {/* Settings */}
          <Link
            to="/settings"
            className={`flex items-center px-6 md:px-5 py-3.5 md:py-2.5 text-sm font-bold transition-all relative group ${currentPath === '/settings'
              ? 'text-primary-500 bg-primary-500/5'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            onClick={onClose}
          >
            {currentPath === '/settings' && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 shadow-glow-primary rounded-r-full" />
            )}
            <Settings className={`h-5 w-5 mr-4 md:mr-3 ${currentPath === '/settings' ? 'text-primary-500' : 'text-slate-400 group-hover:text-primary-500'}`} />
            Preferences
          </Link>

          {/* Admin Panel */}
          {(user?.role === 'va_uploader' || user?.role === 'super_admin') && (
            <Link
              to="/admin"
              className={`flex items-center px-6 md:px-5 py-3.5 md:py-2.5 text-sm font-bold transition-all relative group ${currentPath === '/admin'
                ? 'text-secondary-500 bg-secondary-500/5'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              onClick={onClose}
            >
              {currentPath === '/admin' && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary-500 shadow-glow-secondary rounded-r-full" />
              )}
              {user?.role === 'va_uploader' ? (
                <LayoutDashboard className={`h-5 w-5 mr-4 md:mr-3 ${currentPath === '/admin' ? 'text-secondary-500' : 'text-slate-400 group-hover:text-secondary-500'}`} />
              ) : (
                <ShieldCheck className={`h-5 w-5 mr-4 md:mr-3 ${currentPath === '/admin' ? 'text-secondary-500' : 'text-slate-400 group-hover:text-secondary-500'}`} />
              )}
              {user?.role === 'va_uploader' ? 'VA Dashboard' : 'System Control'}
            </Link>
          )}
        </div>

        {/* Sign Out */}
        <div className="p-4 bg-slate-50/50 dark:bg-black/20">
          <button
            onClick={onSignOut}
            className="flex items-center w-full px-4 py-3 text-sm font-black text-red-500 bg-red-500/5 hover:bg-red-500 hover:text-white rounded-xl transition-all uppercase tracking-widest group"
          >
            <LogOut className="h-5 w-5 mr-3 group-hover:translate-x-1 transition-transform" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
