import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SiteConfigProvider, useSiteConfig, useSiteConfigLoaded } from './hooks/useSiteConfig';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import EditorPage from './pages/EditorPage';
import FreeEditorPage from './pages/FreeEditorPage';
import LandingPage from './pages/LandingPage';
import ExportLabel from './pages/ExportLabel';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import AccountPage from './pages/AccountPage';
import type { ReactNode } from 'react';

function Loading() {
  return <div className="grid min-h-full place-items-center text-sm text-ink/60">Loading…</div>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
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

/** "/" — logged-in users see the editor (unchanged); logged-out visitors see the landing page. */
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <EditorPage /> : <LandingPage />;
}

/**
 * Handles /:slug — renders the free editor when free mode is on and the slug is
 * a configured free-mode slug. Supports multiple slugs (free_mode_slugs), and
 * still honors the legacy single free_mode_path for back-compat.
 */
function FreeRoute() {
  const { slug } = useParams<{ slug: string }>();
  const cfg = useSiteConfig();
  const loaded = useSiteConfigLoaded();
  if (!loaded) return <Loading />;
  if (cfg.free_mode_enabled !== '1') return <Navigate to="/" replace />;

  let slugs: { slug: string; plan?: string }[] = [];
  try {
    const parsed = JSON.parse(cfg.free_mode_slugs || '[]');
    if (Array.isArray(parsed)) slugs = parsed;
  } catch {
    /* ignore malformed config */
  }
  const isConfiguredSlug = slugs.some((s) => s && s.slug === slug);
  const isLegacySlug = slug === (cfg.free_mode_path || 'free');
  if (!isConfiguredSlug && !isLegacySlug) return <Navigate to="/" replace />;
  return <FreeEditorPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteConfigProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
            <Route path="/konto" element={<RequireAuth><AccountPage /></RequireAuth>} />
            <Route path="/integritetspolicy" element={<PrivacyPage />} />
            <Route path="/anvandarvillkor" element={<TermsPage />} />
            <Route path="/" element={<HomeRoute />} />
            {/* Public start/landing page — reachable even when logged in (logo target). */}
            <Route path="/start" element={<LandingPage />} />
            {/* Headless render target for server-side export (static path ranks above /:slug). */}
            <Route path="/__export" element={<ExportLabel />} />
            <Route path="/:slug" element={<FreeRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </SiteConfigProvider>
    </BrowserRouter>
  );
}
