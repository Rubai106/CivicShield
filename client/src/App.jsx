import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ReporterDashboard from './pages/ReporterDashboard';
import CreateReport from './pages/CreateReport';
import EditDraft from './pages/EditDraft';
import ReportDetail from './pages/ReportDetail';
import NotFoundPage from './pages/NotFoundPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback = '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return children;

  const redirect = '/dashboard';
  return <Navigate to={redirect} replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['reporter', 'authority']}>
          <ReporterDashboard />
        </ProtectedRoute>
      } />

      <Route path="/reports/new" element={
        <ProtectedRoute allowedRoles={['reporter']}>
          <CreateReport />
        </ProtectedRoute>
      } />

      <Route path="/reports/:id/edit" element={
        <ProtectedRoute allowedRoles={['reporter']}>
          <EditDraft />
        </ProtectedRoute>
      } />

      <Route path="/reports/:id" element={
        <ProtectedRoute>
          <ReportDetail />
        </ProtectedRoute>
      } />


      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #1e293b',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
