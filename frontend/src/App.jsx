import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import Sidebar from './components/Sidebar';
import LoadingScreen from './components/LoadingScreen';
import ConnectionStatus from './components/ConnectionStatus';
import UpdatePrompt from './components/UpdatePrompt';
import LoginPage from './pages/LoginPage';
import ProfileSetup from './pages/ProfileSetup';
import DashboardPage from './pages/DashboardPage';
import SitesPage from './pages/SitesPage';
import RoomsPage from './pages/RoomsPage';
import NodesPage from './pages/NodesPage';
import ReportsPage from './pages/ReportsPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import ScheduledReportsPage from './pages/ScheduledReportsPage';
import UserManagement from './pages/UserManagement';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  // Force profile setup if not completed
  if (user.profileCompleted === false) return <Navigate to="/profile-setup" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
      <ConnectionStatus />
    </div>
  );
}

function ProfileSetupRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.profileCompleted !== false) return <Navigate to="/" replace />;
  return <ProfileSetup />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) {
    if (user.profileCompleted === false) return <Navigate to="/profile-setup" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <UpdatePrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/profile-setup" element={<ProfileSetupRoute />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/sites" element={<SitesPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/nodes" element={<NodesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
              <Route path="/scheduled-reports" element={<ScheduledReportsPage />} />
              <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
