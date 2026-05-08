import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type User } from '../api';

interface AuthState {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const r = await api.get<{ user: User }>('/api/me');
      setUser(r.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUser(null);
      else console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch { /* ignore */ }
    setUser(null);
  };

  useEffect(() => { void refresh(); }, []);

  return <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
