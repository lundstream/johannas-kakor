import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { settings } from './settings.js';
import { queries } from './db.js';
import { createCheckoutSession, createPortalSession, handleWebhook } from './billing.js';
import { isWatermarked } from './entitlements.js';
import { renderLabel } from './export.js';
import {
  authMiddleware,
  requireAuth,
  requireAdmin,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  findOrCreateUser,
  hashPassword,
  verifyPassword,
  issueMagicLink,
  consumeMagicLink,
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Trust proxy for the Cloudflare -> reverse proxy -> app chain, so req.ip,
// secure-cookie detection and rate limiting see the real client IP. Configured
// via TRUST_PROXY (see README/.env.example): a number (hop count), 'true'/'false',
// or a comma-separated list of trusted proxy IPs/CIDRs. Never defaults to trusting
// everything. Does NOT affect the raw-body webhook below.
if (settings.trust_proxy !== undefined && settings.trust_proxy !== '') {
  const tp = String(settings.trust_proxy).trim();
  let value;
  if (/^\d+$/.test(tp)) value = Number(tp);
  else if (tp === 'true' || tp === 'false') value = tp === 'true';
  else value = tp.includes(',') ? tp.split(',').map((s) => s.trim()) : tp;
  app.set('trust proxy', value);
}

// Stripe webhook MUST see the raw body for signature verification, so it is
// registered BEFORE express.json() and uses express.raw on its own route only.
// It is unauthenticated (verified by signature), so it sits ahead of authMiddleware too.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// ---------- Public ----------

/** Public site config: site_name, header_tagline, footer_text, primary_color, favicon, instagram_url. */
app.get('/api/public/site', (_req, res) => {
  const all = queries.getAllSettings.all();
  const obj = Object.fromEntries(all.map((r) => [r.key, r.value]));
  res.json({
    site_name: obj.site_name || 'Bakery Labels',
    header_tagline: obj.header_tagline || '',
    footer_text: obj.footer_text || '',
    favicon_data_url: obj.favicon_data_url || '',
    primary_color: obj.primary_color || '#b08654',
    instagram_url: obj.instagram_url || '',
    default_locale: obj.default_locale || 'en',
    free_mode_enabled: obj.free_mode_enabled || '0',
    free_mode_path: obj.free_mode_path || 'free',
    // Multi-slug free mode: JSON array of { slug, plan }. Server-seeded only.
    free_mode_slugs: obj.free_mode_slugs || '[]',
  });
});

// ---------- Auth ----------

const emailSchema = z.string().trim().toLowerCase().email();

app.post('/api/auth/magic/request', async (req, res) => {
  const parsed = emailSchema.safeParse(req.body?.email);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_email' });
  const email = parsed.data;
  try {
    await issueMagicLink(email);
    res.json({ ok: true });
  } catch (e) {
    console.error('magic link error', e);
    res.status(500).json({ error: 'send_failed' });
  }
});

app.get('/api/auth/magic/verify', (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(400).json({ error: 'missing_token' });
  const user = consumeMagicLink(token);
  if (!user) return res.status(400).json({ error: 'invalid_or_expired' });
  const sid = createSession(user.id, req.headers['user-agent']);
  setSessionCookie(res, sid);
  // Redirect to root for browser flow.
  res.redirect('/');
});

const credSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(200),
});

app.post('/api/auth/signup', async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { email, password } = parsed.data;
  if (queries.findUserByEmail.get(email)) {
    return res.status(409).json({ error: 'email_in_use' });
  }
  const user = findOrCreateUser(email);
  const hash = await hashPassword(password);
  queries.updateUserPassword.run(hash, user.id);
  queries.updateUserLastLogin.run(Date.now(), user.id);
  const sid = createSession(user.id, req.headers['user-agent']);
  setSessionCookie(res, sid);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { email, password } = parsed.data;
  const user = queries.findUserByEmail.get(email);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  queries.updateUserLastLogin.run(Date.now(), user.id);
  const sid = createSession(user.id, req.headers['user-agent']);
  setSessionCookie(res, sid);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req.sessionId);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  res.json({ user: publicUser(req.user) });
});

app.patch('/api/me', requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(80).optional(),
    password: z.string().min(8).max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  if (parsed.data.name !== undefined) queries.updateUserName.run(parsed.data.name, req.user.id);
  if (parsed.data.password) {
    const hash = await hashPassword(parsed.data.password);
    queries.updateUserPassword.run(hash, req.user.id);
  }
  res.json({ ok: true });
});

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
    // plan + watermarked are safe to expose (drive the print footer + an
    // "uppgradera" nudge); stripe_* are NOT shipped. PDF/PNG enforcement is
    // re-decided server-side at export time and never trusts a client flag.
    plan: u.plan || 'trial',
    watermarked: isWatermarked(u),
  };
}

/** Authoritative watermark decision for an anonymous free-mode slug. */
function slugIsWatermarked(slug) {
  try {
    const row = queries.getSetting.get('free_mode_slugs');
    const slugs = JSON.parse(row?.value || '[]');
    const match = Array.isArray(slugs) ? slugs.find((s) => s && s.slug === slug) : null;
    if (!match) return true; // unknown / no slug → watermark (safe default)
    return match.plan !== 'free_comp'; // trial → watermark; free_comp → clean
  } catch {
    return true;
  }
}

// ---------- Billing ----------

app.post('/api/billing/checkout', requireAuth, async (req, res) => {
  try {
    const url = await createCheckoutSession(req.user);
    res.json({ url });
  } catch (e) {
    if (e.message === 'billing_not_configured') return res.status(503).json({ error: 'billing_not_configured' });
    console.error('checkout error', e);
    res.status(500).json({ error: 'checkout_failed' });
  }
});

app.post('/api/billing/portal', requireAuth, async (req, res) => {
  try {
    const url = await createPortalSession(req.user);
    res.json({ url });
  } catch (e) {
    if (e.message === 'no_customer') return res.status(400).json({ error: 'no_customer' });
    if (e.message === 'billing_not_configured') return res.status(503).json({ error: 'billing_not_configured' });
    console.error('portal error', e);
    res.status(500).json({ error: 'portal_failed' });
  }
});

// ---------- Export (server-side render + watermark) ----------

// Watermark is decided HERE, server-side: logged-in users by isWatermarked()
// from their session; anonymous free-mode by the slug's server-side plan. A
// client-supplied flag is never trusted.
app.post('/api/export/:format', async (req, res) => {
  const format = req.params.format === 'png' ? 'png' : 'pdf';
  const { label, slug, transparent } = req.body || {};
  if (!label || typeof label !== 'object' || !label.size || typeof label.size.widthMm !== 'number') {
    return res.status(400).json({ error: 'invalid_label' });
  }
  const watermark = req.user ? isWatermarked(req.user) : slugIsWatermarked(slug);
  const copies = Math.min(Math.max(1, Number(label.copies) || 1), 50);
  try {
    const buf = await renderLabel({ label, watermark, format, copies, transparent: !!transparent });
    res.setHeader('Content-Type', format === 'png' ? 'image/png' : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="etikett.${format}"`);
    res.send(buf);
  } catch (e) {
    console.error('export error', e);
    res.status(500).json({ error: 'export_failed' });
  }
});

// ---------- Per-user data ----------

app.get('/api/me/label', requireAuth, (req, res) => {
  const row = queries.getLabel.get(req.user.id);
  if (!row) return res.json({ label: null, updated_at: null });
  res.json({ label: JSON.parse(row.data), updated_at: row.updated_at });
});

app.put('/api/me/label', requireAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'invalid_body' });
  queries.upsertLabel.run(req.user.id, JSON.stringify(data), Date.now());
  res.json({ ok: true });
});

app.get('/api/me/templates', requireAuth, (req, res) => {
  const rows = queries.listTemplates.all(req.user.id);
  res.json({
    templates: rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: JSON.parse(r.data),
      createdAt: r.created_at,
    })),
  });
});

app.post('/api/me/templates', requireAuth, (req, res) => {
  const schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    data: z.any(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { id, name, data } = parsed.data;
  queries.createTemplate.run(id, req.user.id, name, JSON.stringify(data), Date.now());
  res.json({ ok: true });
});

app.put('/api/me/templates/:id', requireAuth, (req, res) => {
  const schema = z.object({ name: z.string().min(1).max(120), data: z.any() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  queries.updateTemplate.run(parsed.data.name, JSON.stringify(parsed.data.data), req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/me/templates/:id', requireAuth, (req, res) => {
  queries.deleteTemplate.run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/me/custom-ingredients', requireAuth, (req, res) => {
  const row = queries.getCustomIngredients.get(req.user.id);
  res.json({ ingredients: row ? JSON.parse(row.data) : [] });
});

app.put('/api/me/custom-ingredients', requireAuth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'invalid_body' });
  queries.upsertCustomIngredients.run(req.user.id, JSON.stringify(req.body), Date.now());
  res.json({ ok: true });
});

// ---------- Data subject rights (self-service, GDPR) ----------

/** Export ALL of the requesting user's own data as a downloadable JSON file. */
app.get('/api/me/export', requireAuth, (req, res) => {
  const u = req.user;
  const labelRow = queries.getLabel.get(u.id);
  const templates = queries.listTemplates.all(u.id);
  const customRow = queries.getCustomIngredients.get(u.id);
  const data = {
    exported_at: new Date().toISOString(),
    account: publicUser(u),
    label: labelRow ? JSON.parse(labelRow.data) : null,
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      data: JSON.parse(t.data),
      createdAt: t.created_at,
    })),
    custom_ingredients: customRow ? JSON.parse(customRow.data) : [],
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="enkel-etikett-mina-uppgifter.json"');
  res.send(JSON.stringify(data, null, 2));
});

/** Self-service account deletion. Hard delete; FK cascade removes the user's rows. */
app.delete('/api/me', requireAuth, (req, res) => {
  const u = req.user;
  // Respect the last-admin guard (mirrors the admin delete route).
  if (u.role === 'admin') {
    const admins = queries.listUsers.all().filter((a) => a.role === 'admin');
    if (admins.length <= 1) return res.status(400).json({ error: 'last_admin' });
  }
  // Block while a Stripe subscription is live, to avoid dangling billing.
  // FLAGGED: this blocks deletion; it does NOT call Stripe to cancel.
  if (['active', 'trialing', 'past_due'].includes(u.subscription_status)) {
    return res.status(409).json({ error: 'active_subscription' });
  }
  destroySession(req.sessionId);
  clearSessionCookie(res);
  queries.deleteUser.run(u.id); // cascade: labels, templates, custom ingredients, sessions
  res.json({ ok: true });
});

// ---------- Admin ----------

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  res.json({ users: queries.listUsers.all() });
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const schema = z.object({
    email: emailSchema,
    name: z.string().min(1).max(80).optional(),
    role: z.enum(['user', 'admin']).default('user'),
    password: z.string().min(8).max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { email, name, role, password } = parsed.data;
  if (queries.findUserByEmail.get(email)) return res.status(409).json({ error: 'email_in_use' });
  const now = Date.now();
  const passHash = password ? await hashPassword(password) : null;
  const info = queries.createUser.run(email, passHash, name || null, role, null, now, null);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(80).optional(),
    role: z.enum(['user', 'admin']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const id = Number(req.params.id);
  if (parsed.data.name !== undefined) queries.updateUserName.run(parsed.data.name, id);
  if (parsed.data.role !== undefined) {
    // Prevent demoting the last admin.
    if (parsed.data.role === 'user') {
      const admins = queries.listUsers.all().filter((u) => u.role === 'admin');
      if (admins.length === 1 && admins[0].id === id) {
        return res.status(400).json({ error: 'last_admin' });
      }
    }
    queries.updateUserRole.run(parsed.data.role, id);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'cannot_delete_self' });
  const admins = queries.listUsers.all().filter((u) => u.role === 'admin');
  const target = queries.findUserById.get(id);
  if (target && target.role === 'admin' && admins.length === 1) {
    return res.status(400).json({ error: 'last_admin' });
  }
  queries.deleteUser.run(id);
  res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  const all = queries.getAllSettings.all();
  res.json({ settings: Object.fromEntries(all.map((r) => [r.key, r.value])) });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const schema = z.record(z.string(), z.string());
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  for (const [key, value] of Object.entries(parsed.data)) {
    // Whitelist keys to prevent unknown writes.
    if (
      ![
        'site_name',
        'header_tagline',
        'footer_text',
        'favicon_data_url',
        'primary_color',
        'instagram_url',
        'default_locale',
        'free_mode_enabled',
        'free_mode_path',
      ].includes(key)
    ) continue;
    queries.setSetting.run(key, value);
  }
  res.json({ ok: true });
});

// ---------- Static (production only) ----------

const DIST = path.join(__dirname, 'dist');
import fs from 'node:fs';
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('/*splat', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

const port = settings.port || 3060;
app.listen(port, () => {
  console.log(`[bakery-labels] API listening on :${port}`);
});
