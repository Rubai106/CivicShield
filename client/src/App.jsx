import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ReporterDashboard from './pages/ReporterDashboard';
import AuthorityDashboard from './pages/AuthorityDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CreateReport from './pages/CreateReport';
import EditDraft from './pages/EditDraft';
import ReportDetail from './pages/ReportDetail';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import ComplianceDashboard from './pages/ComplianceDashboard';
import ChatPage from './pages/ChatPage';
import ConsultationsPage from './pages/ConsultationsPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'authority') return <Navigate to="/authority" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return children;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'authority') return <Navigate to="/authority" replace />;
  return <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Reporter */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['reporter']}><ReporterDashboard /></ProtectedRoute>
      } />
      <Route path="/reports/new" element={
        <ProtectedRoute allowedRoles={['reporter']}><CreateReport /></ProtectedRoute>
      } />
      <Route path="/reports/:id/edit" element={
        <ProtectedRoute allowedRoles={['reporter']}><EditDraft /></ProtectedRoute>
      } />
      <Route path="/reports/:id" element={
        <ProtectedRoute><ReportDetail /></ProtectedRoute>
      } />

      {/* Authority */}
      <Route path="/authority" element={
        <ProtectedRoute allowedRoles={['authority']}><AuthorityDashboard /></ProtectedRoute>
      } />

      {/* Admin — note the /* wildcard so sub-routes inside AdminDashboard work */}
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>
      } />

      {/* Compliance */}
      <Route path="/compliance" element={
        <ProtectedRoute allowedRoles={['admin']}><ComplianceDashboard /></ProtectedRoute>
      } />

      {/* Chat */}
      <Route path="/chat" element={
        <ProtectedRoute allowedRoles={['reporter', 'authority']}><ChatPage /></ProtectedRoute>
      } />
      <Route path="/chat/:userId" element={
        <ProtectedRoute allowedRoles={['reporter', 'authority']}><ChatPage /></ProtectedRoute>
      } />

      {/* Consultations */}
      <Route path="/consultations" element={
        <ProtectedRoute allowedRoles={['reporter', 'authority']}><ConsultationsPage /></ProtectedRoute>
      } />

      {/* Profile */}
      <Route path="/profile" element={
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      } />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
        <AppRoutes />
        </SocketProvider>
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