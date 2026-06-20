// Thin fetch wrapper for the bakery-labels API.
// All requests include cookies (session auth).

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message || code);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let code = res.statusText;
    try {
      const j = await res.json();
      if (j?.error) code = j.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return undefined as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// ---------- Types ----------

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  created_at: number;
  last_login_at: number | null;
  plan: 'trial' | 'free_comp' | 'paid';
  /** Server-computed: whether this user's exports/prints are watermarked. */
  watermarked: boolean;
}

export interface SiteConfig {
  site_name: string;
  header_tagline: string;
  footer_text: string;
  favicon_data_url: string;
  primary_color: string;
  instagram_url: string;
  default_locale: string;
  free_mode_enabled: '0' | '1';
  free_mode_path: string;
  /** JSON array string of { slug, plan } for multi-slug free mode. */
  free_mode_slugs: string;
}
