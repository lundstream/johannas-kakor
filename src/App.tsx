import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SiteConfigProvider } from './hooks/useSiteConfig';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import EditorPage from './pages/EditorPage';
import type { ReactNode } from 'react';

function Loading() {
  return <div className="grid min-h-full place-items-center text-sm text-ink/60">Loading…</div>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteConfigProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
            <Route path="/" element={<RequireAuth><EditorPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </SiteConfigProvider>
    </BrowserRouter>
  );
}
