import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Settings, LogOut, Shield, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from './ui';

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

/** Account menu: anchored popover on every screen size (primary nav lives in the header / tab bar). */
export default function NavigationMenu({
  currentPath,
  onClose,
  onSignOut,
  user,
  tenantName,
}: NavigationMenuProps) {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = [
    { path: '/onboarding', label: 'Scan website', icon: Globe },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // Admin Panel - For va_uploader and super_admin
  if (user?.role === 'va_uploader' || user?.role === 'super_admin') {
    items.push({
      path: '/admin',
      label: user.role === 'va_uploader' ? 'Upload Portal' : 'Admin Panel',
      icon: Shield,
    });
  }

  const row =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink';

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <motion.div
        role="menu"
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -2 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: 'top right' }}
        className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-1.5 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.35)]"
      >
        <div className="px-3 pb-3 pt-2.5">
          <p className="truncate text-sm font-semibold text-ink">{user?.full_name}</p>
          <p className="truncate text-xs text-ink-muted">{user?.email}</p>
          {tenantName && <p className="mt-1 truncate text-xs text-ink-subtle">{tenantName}</p>}
        </div>
        <div className="h-px bg-line" />

        <div className="py-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                role="menuitem"
                onClick={onClose}
                className={cn(row, currentPath === item.path && 'bg-surface-2 text-ink')}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <button role="menuitem" onClick={toggleTheme} className={row}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>

        <div className="h-px bg-line" />
        <div className="pt-1.5">
          <button role="menuitem" onClick={onSignOut} className={cn(row, 'text-danger hover:bg-danger/10 hover:text-danger')}>
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </motion.div>
    </>
  );
}
