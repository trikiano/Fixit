import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import Shell from './components/shell/Shell';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';
import ErrorPage from './pages/ErrorPage';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { useEffect } from 'react';




// Redirect to /login if not authenticated
const RequireAuth = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Redirect to / if already logged in
const RedirectIfAuth = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

// Listen to auth:unauthorized event and navigate to /login
function AuthEventListener() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  useEffect(() => {
    const handler = () => { logout(); navigate('/login', { replace: true }); };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [navigate, logout]);
  return null;
}

const RequireSuperAdmin = ({ children }) => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'super_admin') return <Navigate to="/" replace />;
  return children;
};

const AuthenticatedApp = () => (
  <Routes>
    {/* Public */}
    <Route path="/login" element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
    <Route path="/register" element={<RedirectIfAuth><Register /></RedirectIfAuth>} />

    {/* Super admin */}
    <Route path="/admin" element={<RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin>} />

    {/* Protected — Shell handles ALL navigation via tabs */}
    <Route path="/" element={<RequireAuth><Shell /></RequireAuth>} />

    {/* Error pages */}
    <Route path="/403" element={<ErrorPage code={403} />} />
    <Route path="/500" element={<ErrorPage code={500} />} />
    <Route path="/503" element={<ErrorPage code={503} />} />

    {/* 404 — catch all */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthEventListener />
          <AuthenticatedApp />
        </Router>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>

    </AuthProvider>
  );
}


export default App;