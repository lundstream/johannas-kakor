import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useSiteConfig } from '../hooks/useSiteConfig';

type Mode = 'magic' | 'password' | 'signup';

export default function LoginPage() {
  const site = useSiteConfig();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    try {
      if (mode === 'magic') {
        await api.post('/api/auth/magic/request', { email });
        setInfo(`We sent a sign-in link to ${email}. Check your inbox.`);
      } else if (mode === 'password') {
        await api.post('/api/auth/login', { email, password });
        await refresh();
        navigate('/', { replace: true });
      } else {
        await api.post('/api/auth/signup', { email, password });
        await refresh();
        navigate('/', { replace: true });
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'error';
      const map: Record<string, string> = {
        invalid_credentials: 'Wrong email or password.',
        email_in_use: 'That email already has an account. Try signing in instead.',
        invalid_input: 'Please check your input. Password must be at least 8 characters.',
        invalid_email: 'Please enter a valid email address.',
        send_failed: 'Could not send the email. Please try again later.',
      };
      setError(map[code] || `Something went wrong (${code}).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full grid place-items-center px-5 py-10">
      <div className="card w-full max-w-md p-6">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ink text-paper">
            <span className="font-display text-xl font-bold">{(site.site_name || 'B')[0]}</span>
          </div>
          <h1 className="font-display text-xl font-semibold">{site.site_name}</h1>
          <p className="text-xs uppercase tracking-[0.18em] text-ink/50">{site.header_tagline || 'Sign in'}</p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-cream p-1 text-xs">
          {(['magic', 'password', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setInfo(null); }}
              className={`rounded-lg py-1.5 capitalize transition ${
                mode === m ? 'bg-paper shadow-sm font-semibold' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {m === 'magic' ? 'Email link' : m === 'password' ? 'Password' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="label">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== 'magic' && (
            <label className="flex flex-col gap-1">
              <span className="label">Password</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {info && <div className="text-sm text-emerald-700">{info}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary mt-2">
            {busy ? '...' : mode === 'magic' ? 'Send link' : mode === 'password' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
