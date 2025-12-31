import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Target, Menu, X } from 'lucide-react';
import NavigationMenu from './NavigationMenu';

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

    const handleLogoClick = (e: React.MouseEvent) => {
        // If we are already on dashboard, we might want to refresh data, 
        // but the requirement is just "back to homepage".
    };

    return (
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/dashboard" onClick={handleLogoClick} className="flex items-center">
                        <Target className="h-8 w-8 text-blue-900" />
                        <span className="ml-2 text-xl font-bold text-gray-900">Dealer Co-Pilot</span>
                    </Link>
                    <div className="flex items-center space-x-4 relative">
                        <span className="text-sm text-gray-600 hidden md:inline">{tenant?.name}</span>
                        <button
                            onClick={() => {
                                if (onScanVinClick) {
                                    onScanVinClick();
                                } else {
                                    window.location.href = '/scan';
                                }
                            }}
                            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition hidden md:inline-block font-semibold"
                        >
                            Scan VIN
                        </button>
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
