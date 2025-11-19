import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import DashboardPage from './pages/DashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import VINScanPage from './pages/VINScanPage';
import VINScansPage from './pages/VINScansPage';
import ManageInventoryPage from './pages/ManageInventoryPage';
import CompetitorAnalysisPage from './pages/CompetitorAnalysisPage';
import CompetitorHistoryPage from './pages/CompetitorHistoryPage';
import UpgradePage from './pages/UpgradePage';
import RecommendationsPage from './pages/RecommendationsPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import ManualScrapingUploadPage from './pages/ManualScrapingUploadPage';
import ScrapingManagementPage from './pages/ScrapingManagementPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignUpPage />
              </PublicRoute>
            }
          />
          <Route
            path="/signin"
            element={
              <PublicRoute>
                <SignInPage />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scan"
            element={
              <ProtectedRoute>
                <VINScanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vin-scans"
            element={
              <ProtectedRoute>
                <VINScansPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <ManageInventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitors"
            element={
              <ProtectedRoute>
                <CompetitorAnalysisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitor-history/:competitorId"
            element={
              <ProtectedRoute>
                <CompetitorHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade"
            element={
              <ProtectedRoute>
                <UpgradePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recommendations"
            element={
              <ProtectedRoute>
                <RecommendationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/upload"
            element={
              <ProtectedRoute>
                <ManualScrapingUploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/scraping"
            element={
              <ProtectedRoute>
                <ScrapingManagementPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
