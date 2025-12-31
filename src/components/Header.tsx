import { Link, useLocation } from 'react-router-dom';
import { Target, Menu, X } from 'lucide-react';
import NavigationMenu from './NavigationMenu';
import ThemeSwitch from './ThemeSwitch';

interface HeaderProps {
    user: any;
    tenant: any;
    signOut: () => Promise<void>;
    menuOpen: boolean;
    setMenuOpen: (open: boolean) => void;
    onScanVinClick?: () => void;
}

export default function Header({
    user,
    tenant,
    signOut,
    menuOpen,
    setMenuOpen,
    onScanVinClick,
}: HeaderProps) {
    const location = useLocation();

    return (
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/dashboard" className="flex items-center">
                        <Target className="h-8 w-8 text-primary-500" />
                        <span className="ml-2 text-xl font-bold text-slate-900 dark:text-white">Dealer Co-Pilot</span>
                    </Link>
                    <div className="flex items-center space-x-4 relative">
                        <ThemeSwitch />
                        <span className="text-sm text-slate-600 dark:text-slate-400 hidden md:inline">{tenant?.name}</span>
                        <button
                            onClick={() => {
                                if (onScanVinClick) {
                                    onScanVinClick();
                                } else {
                                    window.location.href = '/scan';
                                }
                            }}
                            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition hidden md:inline-block font-semibold shadow-glow-primary"
                        >
                            Scan VIN
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300"
                                aria-label="Menu"
                            >
                                {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>

                            {menuOpen && (
                                <NavigationMenu
                                    currentPath={location.pathname}
                                    onClose={() => setMenuOpen(false)}
                                    onSignOut={signOut}
                                    user={user}
                                    tenantName={tenant?.name}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
