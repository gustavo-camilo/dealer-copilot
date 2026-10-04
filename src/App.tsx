import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router-dom';
import { Toaster, ToastIcon } from 'react-hot-toast';
import { MotionConfig } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { PageLoader } from './components/ui';
import { installSpotlight } from './lib/spotlight';

// Each page is its own chunk, so visitors only download the screen they open.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const VINScanPage = lazy(() => import('./pages/VINScanPage'));
const ManageInventoryPage = lazy(() => import('./pages/ManageInventoryPage'));
const CompetitorAnalysisPage = lazy(() => import('./pages/CompetitorAnalysisPage'));
const CompetitorHistoryPage = lazy(() => import('./pages/CompetitorHistoryPage'));
const UpgradePage = lazy(() => import('./pages/UpgradePage'));
const UpgradeSuccessPage = lazy(() => import('./pages/UpgradeSuccessPage'));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage'));
const RecommendationDetailPage = lazy(() => import('./pages/RecommendationDetailPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// Dev-only component playground; the import is stripped from production builds.
const DesignPlayground = import.meta.env.DEV ? lazy(() => import('./pages/dev/DesignPlayground')) : null;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, subscription } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/signin" />;
  }

  const hasActiveSubscription =
    subscription?.status === 'active' || subscription?.status === 'trialing';
  const isUpgradePath = location.pathname.startsWith('/upgrade');

  if (!isUpgradePath && user.role !== 'super_admin' && !hasActiveSubscription) {
    return <Navigate to="/upgrade" replace />;
  }

  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (user) {
    // Redirect super admins to admin panel, others to dashboard
    return <Navigate to={user.role === 'super_admin' ? '/admin' : '/dashboard'} />;
  }

  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
        <LandingPage />
      </Suspense>
    ),
  },
  ...(DesignPlayground
    ? [
        {
          path: '/design',
          element: (
            <Suspense fallback={<PageLoader />}>
              <DesignPlayground />
            </Suspense>
          ),
        },
      ]
    : []),
  {
    path: '/signup',
    element: (
      <PublicRoute>
        <SignUpPage />
      </PublicRoute>
    ),
  },
  {
    path: '/signin',
    element: (
      <PublicRoute>
        <SignInPage />
      </PublicRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/scan',
    element: (
      <ProtectedRoute>
        <VINScanPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/inventory',
    element: (
      <ProtectedRoute>
        <ManageInventoryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/competitors',
    element: (
      <ProtectedRoute>
        <CompetitorAnalysisPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/competitor-history/:competitorId',
    element: (
      <ProtectedRoute>
        <CompetitorHistoryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/upgrade',
    element: (
      <ProtectedRoute>
        <UpgradePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/upgrade/success',
    element: (
      <ProtectedRoute>
        <UpgradeSuccessPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/recommendations',
    element: (
      <ProtectedRoute>
        <RecommendationsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/recommendations/:scanId',
    element: (
      <ProtectedRoute>
        <RecommendationDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <AdminPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    ),
  },
]);

function App() {
  useEffect(() => installSpotlight(), []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              success: { iconTheme: { primary: 'rgb(var(--success))', secondary: '#fff' } },
              error: { iconTheme: { primary: 'rgb(var(--danger))', secondary: '#fff' } },
            }}
          >
            {(t) => {
              const message = typeof t.message === 'function' ? t.message(t) : t.message;
              return (
                <div
                  className={`flex w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-line bg-surface/95 py-3 pl-4 pr-2 text-sm text-ink shadow-[0_16px_40px_-16px_rgb(0_0_0/0.4)] backdrop-blur-xl transition-all duration-200 ${
                    t.visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                  }`}
                >
                  <ToastIcon toast={t} />
                  <div className="flex-1">{message}</div>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="rounded-full p-1.5 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                    aria-label="Close notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            }}
          </Toaster>
          <RouterProvider router={router} />
        </MotionConfig>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
