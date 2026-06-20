import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { LegalLinks } from '../components/LegalPage';
import { GalleryAccountPanel } from '../components/GalleryAccountPanel';

export default function AccountPage() {
  const site = useSiteConfig();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = site.site_name || 'Enkel Etikett';

  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planLabel =
    user?.plan === 'paid' ? 'Betald' : user?.plan === 'free_comp' ? 'Fri (komp)' : 'Prova';

  const deleteAccount = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.del('/api/me');
      await logout();
      navigate('/', { replace: true });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'error';
      const map: Record<string, string> = {
        last_admin:
          'Du är den enda administratören och kan inte radera kontot. Gör någon annan till administratör först.',
        active_subscription:
          'Du har en aktiv prenumeration. Avsluta den först (via betalningsportalen) innan du raderar kontot.',
      };
      setError(map[code] || `Något gick fel (${code}).`);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-paper text-ink">
      <header className="border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-paper">
              <span className="font-display text-lg font-bold">{name[0]}</span>
            </div>
            <span className="font-display text-lg font-semibold">{name}</span>
          </Link>
          <Link to="/" className="btn btn-ghost text-sm">
            Tillbaka till editorn
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">Konto</h1>

        <div className="card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Uppgifter</h2>
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-ink/50">E-post</dt>
            <dd>{user?.email}</dd>
            {user?.name && (
              <>
                <dt className="text-ink/50">Namn</dt>
                <dd>{user.name}</dd>
              </>
            )}
            <dt className="text-ink/50">Plan</dt>
            <dd>{planLabel}</dd>
          </dl>
        </div>

        <GalleryAccountPanel />

        <div className="card p-5">
          <h2 className="mb-1 font-display text-lg font-semibold">Exportera dina uppgifter</h2>
          <p className="mb-3 text-sm text-ink/60">
            Ladda ner allt du har sparat (konto, etikett, mallar och egna ingredienser) som en
            JSON-fil.
          </p>
          {/* Authed GET; the browser downloads with the session cookie. */}
          <a href="/api/me/export" className="btn text-sm" download>
            Exportera (JSON)
          </a>
        </div>

        <div className="card border-red-200 p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-red-700">Radera konto</h2>
          <p className="mb-3 text-sm text-ink/60">
            Detta raderar ditt konto och all sparad data permanent. Åtgärden kan inte ångras.
          </p>

          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

          {!confirming ? (
            <button
              type="button"
              className="btn btn-danger text-sm"
              onClick={() => {
                setConfirming(true);
                setError(null);
              }}
            >
              Radera mitt konto
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <label className="text-sm text-red-900">
                Skriv <strong>RADERA</strong> för att bekräfta:
                <input
                  className="input mt-1"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-danger text-sm"
                  disabled={busy || confirmText.trim().toUpperCase() !== 'RADERA'}
                  onClick={deleteAccount}
                >
                  {busy ? '...' : 'Bekräfta radering'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    setConfirmText('');
                    setError(null);
                  }}
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-line py-8">
        <LegalLinks />
      </footer>
    </div>
  );
}
