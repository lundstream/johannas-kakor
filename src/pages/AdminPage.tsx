import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type User } from '../api';
import { useAuth } from '../hooks/useAuth';
import { IngredientTagEditor } from '../components/IngredientTagEditor';
import { GalleryAdminPanel } from '../components/GalleryAdminPanel';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // New user form
  const [nuEmail, setNuEmail] = useState('');
  const [nuName, setNuName] = useState('');
  const [nuRole, setNuRole] = useState<'user' | 'admin'>('user');
  const [nuPassword, setNuPassword] = useState('');
  const [nuError, setNuError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        api.get<{ users: User[] }>('/api/admin/users'),
        api.get<{ settings: Record<string, string> }>('/api/admin/settings'),
      ]);
      setUsers(u.users);
      setSettings(s.settings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const updateSetting = (key: string, value: string) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/api/admin/settings', settings);
    } finally {
      setSavingSettings(false);
    }
  };

  const onFavicon = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => updateSetting('favicon_data_url', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNuError(null);
    try {
      await api.post('/api/admin/users', {
        email: nuEmail,
        name: nuName || undefined,
        role: nuRole,
        password: nuPassword || undefined,
      });
      setNuEmail(''); setNuName(''); setNuRole('user'); setNuPassword('');
      await refresh();
    } catch (e) {
      setNuError(e instanceof ApiError ? e.code : 'error');
    }
  };

  const setRole = async (id: number, role: 'user' | 'admin') => {
    try { await api.patch(`/api/admin/users/${id}`, { role }); await refresh(); }
    catch (e) { alert(e instanceof ApiError ? e.code : 'error'); }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) return;
    try { await api.del(`/api/admin/users/${u.id}`); await refresh(); }
    catch (e) { alert(e instanceof ApiError ? e.code : 'error'); }
  };

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-paper/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3">
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold">Admin</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink/50">Settings & users</div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink/60">{user?.email}</span>
            <Link to="/" className="btn">Back to editor</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 px-5 py-6 lg:grid-cols-2">
        {/* Site settings */}
        <section className="card p-4">
          <h2 className="mb-3 font-display text-base font-semibold">Site settings</h2>
          {loading ? (
            <div className="text-sm text-ink/60">Loading...</div>
          ) : (
            <div className="flex flex-col gap-3">
              <SettingField label="Site name" value={settings.site_name || ''} onChange={(v) => updateSetting('site_name', v)} />
              <SettingField label="Header tagline" value={settings.header_tagline || ''} onChange={(v) => updateSetting('header_tagline', v)} />
              <SettingField label="Footer text" value={settings.footer_text || ''} onChange={(v) => updateSetting('footer_text', v)} />
              <SettingField label="Instagram URL" value={settings.instagram_url || ''} onChange={(v) => updateSetting('instagram_url', v)} placeholder="https://www.instagram.com/..." />
              <label className="flex flex-col gap-1">
                <span className="label">Primary color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.primary_color || '#b08654'}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="h-9 w-14 cursor-pointer rounded-md border border-line bg-white"
                  />
                  <input
                    className="input"
                    value={settings.primary_color || ''}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Favicon</span>
                <div className="flex items-center gap-3">
                  {settings.favicon_data_url ? (
                    <img src={settings.favicon_data_url} alt="" className="h-10 w-10 rounded-md border border-line bg-white object-contain" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-md border border-line bg-cream text-[10px] text-ink/40">none</div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/webp"
                    onChange={(e) => e.target.files?.[0] && onFavicon(e.target.files[0])}
                    className="text-xs"
                  />
                  {settings.favicon_data_url && (
                    <button type="button" onClick={() => updateSetting('favicon_data_url', '')} className="btn btn-ghost text-xs">Remove</button>
                  )}
                </div>
              </label>
              <button onClick={saveSettings} disabled={savingSettings} className="btn btn-primary self-start mt-2">
                {savingSettings ? 'Saving...' : 'Save settings'}
              </button>

              <hr className="border-line" />

              {/* Free preview mode */}
              <div>
                <div className="mb-2 font-semibold text-sm">Free preview mode</div>
                <div className="flex flex-col gap-3 rounded-xl border border-line bg-cream/40 p-3 text-sm">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ink"
                      checked={settings.free_mode_enabled === '1'}
                      onChange={(e) => updateSetting('free_mode_enabled', e.target.checked ? '1' : '0')}
                    />
                    <span>Enable public no-login editor</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="label">URL path</span>
                    <div className="flex items-center gap-2">
                      <span className="text-ink/50 text-xs whitespace-nowrap">{window.location.host}/</span>
                      <input
                        className="input"
                        value={settings.free_mode_path || 'free'}
                        placeholder="free"
                        onChange={(e) => updateSetting('free_mode_path', e.target.value.replace(/[^a-z0-9-_]/gi, '').toLowerCase())}
                      />
                    </div>
                  </label>
                  {settings.free_mode_enabled === '1' && (
                    <div className="text-xs text-ink/60">
                      Public URL:{' '}
                      <a
                        href={`/${settings.free_mode_path || 'free'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-ink"
                      >
                        {window.location.host}/{settings.free_mode_path || 'free'}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Users */}
        <section className="card p-4">
          <h2 className="mb-3 font-display text-base font-semibold">Users</h2>

          <form onSubmit={createUser} className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-line bg-cream/40 p-3 text-xs">
            <div className="font-semibold uppercase tracking-wider text-ink/60">Add user</div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Email" value={nuEmail} required onChange={(e) => setNuEmail(e.target.value)} />
              <input className="input" placeholder="Name (optional)" value={nuName} onChange={(e) => setNuName(e.target.value)} />
              <select className="input" value={nuRole} onChange={(e) => setNuRole(e.target.value as 'user' | 'admin')}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <input className="input" type="password" placeholder="Password (optional, ≥ 8 chars)" minLength={8} value={nuPassword} onChange={(e) => setNuPassword(e.target.value)} />
            </div>
            {nuError && <div className="text-red-600">{nuError}</div>}
            <button className="btn btn-primary self-start" type="submit">Create</button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink/50">
                <tr>
                  <th className="py-2 pr-2">Email</th>
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Role</th>
                  <th className="py-2 pr-2">Last login</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line">
                    <td className="py-2 pr-2">{u.email}</td>
                    <td className="py-2 pr-2 text-ink/70">{u.name || '—'}</td>
                    <td className="py-2 pr-2">
                      <select
                        className="input py-1"
                        value={u.role}
                        onChange={(e) => setRole(u.id, e.target.value as 'user' | 'admin')}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-ink/60 text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => deleteUser(u)} className="btn btn-danger text-xs" disabled={u.id === user?.id}>Delete</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-4 text-center text-ink/50">No users yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ingredient allergen tags */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-semibold">Allergenmärkning (ingredienser)</h2>
          <IngredientTagEditor />
        </section>

        {/* Gallery moderation */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-semibold">Galleri (granskning &amp; moderering)</h2>
          <GalleryAdminPanel />
        </section>
      </main>
    </div>
  );
}

function SettingField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
