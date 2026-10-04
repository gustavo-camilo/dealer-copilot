import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Target, Home, Car, Scan, TrendingUp, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import NavigationMenu from './NavigationMenu';
import { cn } from './ui';

interface HeaderProps {
    user: any;
    tenant: any;
    signOut: () => Promise<void>;
    menuOpen: boolean;
    setMenuOpen: (open: boolean) => void;
    onScanVinClick?: () => void;
}

const primaryNav = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/inventory', label: 'Inventory', icon: Car },
    { path: '/recommendations', label: 'VIN Scans', icon: Package },
    { path: '/competitors', label: 'Competitors', icon: TrendingUp },
];

function initials(name?: string, email?: string) {
    const source = name?.trim() || email || '?';
    return source
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
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
    const navigate = useNavigate();

    const handleScanClick = () => {
        if (onScanVinClick) {
            onScanVinClick();
        } else {
            navigate('/scan');
        }
    };

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150 pt-safe">
                <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 md:h-16 lg:px-8">
                    <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-orange-500 to-red-600 shadow-[0_4px_14px_-4px_rgb(249_115_22/0.6)]">
                            <Target className="h-[18px] w-[18px] text-white" />
                        </span>
                        <span className="text-[15px] font-semibold tracking-tight text-ink">Dealer Co-Pilot</span>
                    </Link>

                    {/* Desktop navigation */}
                    <nav className="isolate hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
                        {primaryNav.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    cn(
                                        'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                        isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <motion.span
                                                layoutId="nav-active"
                                                className="absolute inset-0 -z-10 rounded-lg bg-surface-2 ring-1 ring-inset ring-line"
                                                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                            />
                                        )}
                                        {item.label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="relative ml-auto flex items-center gap-2 md:ml-0">
                        <button
                            onClick={handleScanClick}
                            className="hidden h-9 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong active:scale-[0.97] md:inline-flex"
                        >
                            <Scan className="h-4 w-4" />
                            Scan VIN
                        </button>
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink ring-1 ring-line transition hover:ring-ink-subtle/50"
                            aria-label="Account menu"
                            aria-expanded={menuOpen}
                            aria-haspopup="menu"
                        >
                            {initials(user?.full_name, user?.email)}
                        </button>

                        <AnimatePresence>
                            {menuOpen && (
                                <NavigationMenu
                                    currentPath={location.pathname}
                                    onClose={() => setMenuOpen(false)}
                                    onSignOut={signOut}
                                    user={user}
                                    tenantName={tenant?.name}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            <MobileTabBar pathname={location.pathname} onScanClick={handleScanClick} />
        </>
    );
}

function MobileTabBar({ pathname, onScanClick }: { pathname: string; onScanClick: () => void }) {
    const [home, inventory, scans, competitors] = primaryNav;

    const tab = (item: (typeof primaryNav)[number]) => {
        const Icon = item.icon;
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
            <Link
                key={item.path}
                to={item.path}
                className={cn(
                    'relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                    active ? 'text-ink' : 'text-ink-subtle'
                )}
                aria-current={active ? 'page' : undefined}
            >
                {active && (
                    <motion.span
                        layoutId="dock-active"
                        className="absolute inset-x-0.5 inset-y-1.5 -z-10 rounded-[20px] bg-ink/[0.07] ring-1 ring-inset ring-ink/[0.06]"
                        transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                    />
                )}
                <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
            </Link>
        );
    };

    return (
        <nav
            className="app-tabbar glass fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 isolate rounded-[28px] border border-line/70 md:hidden"
            aria-label="Main"
        >
            <div className="flex h-16 items-stretch px-1.5">
                {tab(home)}
                {tab(inventory)}
                <div className="flex flex-1 items-center justify-center">
                    <button
                        onClick={onScanClick}
                        className={cn(
                            'flex h-12 w-12 items-center justify-center rounded-[18px] text-white',
                            'bg-gradient-to-br from-orange-500 to-red-600',
                            'shadow-[0_8px_20px_-6px_rgb(249_115_22/0.75),inset_0_1px_0_0_rgb(255_255_255/0.3)] transition-transform active:scale-95'
                        )}
                        aria-label="Scan VIN"
                    >
                        <Scan className="h-[22px] w-[22px]" />
                    </button>
                </div>
                {tab(scans)}
                {tab(competitors)}
            </div>
        </nav>
    );
}
