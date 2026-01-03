import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import LandingPage from './pages/LandingPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import DashboardPage from './pages/DashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import VINScanPage from './pages/VINScanPage';
import ManageInventoryPage from './pages/ManageInventoryPage';
import CompetitorAnalysisPage from './pages/CompetitorAnalysisPage';
import CompetitorHistoryPage from './pages/CompetitorHistoryPage';
import UpgradePage from './pages/UpgradePage';
import UpgradeSuccessPage from './pages/UpgradeSuccessPage';
import RecommendationsPage from './pages/RecommendationsPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, subscription } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-brand-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 dark:border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
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

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-brand-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 dark:border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    // Redirect super admins to admin panel, others to dashboard
    return <Navigate to={user.role === 'super_admin' ? '/admin' : '/dashboard'} />;
  }

  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
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
  return (
    <AuthProvider>
      <ThemeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: 'dark:!bg-navy-800 dark:!text-white dark:!border dark:!border-navy-700',
            style: {
              background: '#fff',
              color: '#363636',
              padding: '16px',
              paddingRight: '48px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            },
            success: {
              className: 'dark:!bg-green-900 dark:!border-green-700',
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              className: 'dark:!bg-red-900 dark:!border-red-700',
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        >
          {(t) => {
            const message = typeof t.message === 'function' ? t.message(t) : t.message;
            return (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {t.icon}
                <div style={{ marginLeft: '12px', flex: 1 }}>
                  {message}
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            );
          }}
        </Toaster>
        <RouterProvider router={router} />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
