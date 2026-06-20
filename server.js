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
import { importNutrition, nutritionMeta } from './nutrition-import.js';
import { chatJSON, ollamaAvailable } from './ollama.js';
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

/** The 14 Annex II allergen codes (1169/2011) — the only values accepted as tags. */
const ALLERGEN_CODES = ['GLUTEN','KRÄFTDJUR','ÄGG','FISK','JORDNÖTTER','SOJA','MJÖLK','NÖTTER','SELLERI','SENAP','SESAM','SULFITER','LUPIN','BLÖTDJUR'];

/** Build the ingredient list with their allergen tags. */
function listIngredientsWithAllergens() {
  const tagsById = new Map();
  for (const t of queries.listIngredientAllergens.all()) {
    if (!tagsById.has(t.ingredient_id)) tagsById.set(t.ingredient_id, []);
    tagsById.get(t.ingredient_id).push(t.code);
  }
  return queries.listIngredients.all().map((i) => ({
    id: i.id,
    name: i.name,
    allergens: tagsById.get(i.id) || [],
    livsmedelsnummer: i.livsmedelsnummer || null,
  }));
}

/** Premium access = entitled (reuses the entitlement helper; paid-active, free_comp, admin). */
function hasPremium(user) {
  return !!user && !isWatermarked(user);
}

const NUTRITION_KEYS = ['energi_kj', 'energi_kcal', 'fett', 'mattat_fett', 'kolhydrat', 'sockerarter', 'protein', 'salt'];

function rowGramsServer(row) {
  const q = Number(row?.quantity);
  if (!Number.isFinite(q) || q <= 0) return null;
  if (row.unit === 'kg') return q * 1000;
  if (row.unit === 'g') return q;
  return null;
}

/** Compute the per-100g nutrition declaration from a recipe. Source values are
 *  per-100g; contribution = value × g/100; normalised by färdig vikt (or raw sum). */
function computeNutrition(recipe, finishedWeightG) {
  const rows = recipe?.rows ?? [];
  const numberByIngredient = new Map(
    queries.listIngredientNumbers.all().map((r) => [r.id, r.livsmedelsnummer]),
  );
  const acc = Object.fromEntries(NUTRITION_KEYS.map((k) => [k, 0]));
  let rawTotal = 0;
  let unmapped = 0;
  let mappedAny = false;

  for (const r of rows) {
    const g = rowGramsServer(r);
    if (g == null) continue;
    rawTotal += g;
    const lnr = r.ingredientId ? numberByIngredient.get(r.ingredientId) : null;
    const item = lnr ? queries.getNutritionItem.get(lnr) : null;
    if (!item) {
      unmapped++;
      continue;
    }
    mappedAny = true;
    for (const k of NUTRITION_KEYS) {
      if (typeof item[k] === 'number') acc[k] += item[k] * (g / 100);
    }
  }

  const basisWeight = finishedWeightG && finishedWeightG > 0 ? finishedWeightG : rawTotal;
  if (!mappedAny || basisWeight <= 0) return null;

  const f = 100 / basisWeight;
  const round = (n, d) => {
    const p = 10 ** d;
    return Math.round(n * f * p) / p;
  };
  return {
    perHundred: {
      energiKj: round(acc.energi_kj, 0),
      energiKcal: round(acc.energi_kcal, 0),
      fett: round(acc.fett, 1),
      mattatFett: round(acc.mattat_fett, 1),
      kolhydrat: round(acc.kolhydrat, 1),
      sockerarter: round(acc.sockerarter, 1),
      protein: round(acc.protein, 1),
      salt: round(acc.salt, 2),
    },
    basis: finishedWeightG && finishedWeightG > 0 ? 'finished' : 'raw',
    totalWeightG: Math.round(basisWeight),
    datasetVersion: nutritionMeta().version,
    incomplete: unmapped > 0,
    unmappedCount: unmapped,
    computedAt: Date.now(),
  };
}

/** Public: nutrition dataset version/meta (for CC BY attribution display). */
app.get('/api/public/nutrition-meta', (_req, res) => res.json(nutritionMeta()));

/** Public: ingredient list + allergen tags (reference data; used by the editor incl. free mode). */
app.get('/api/public/ingredients', (_req, res) => {
  res.json({ ingredients: listIngredientsWithAllergens() });
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

// ---------- Nutrition (premium) ----------

app.post('/api/me/nutrition', requireAuth, (req, res) => {
  if (!hasPremium(req.user)) return res.status(403).json({ error: 'premium_required' });
  if (nutritionMeta().count === 0) return res.status(409).json({ error: 'no_dataset' });
  const { recipe, finishedWeightG } = req.body || {};
  if (!recipe || !Array.isArray(recipe.rows)) return res.status(400).json({ error: 'invalid_recipe' });
  const declaration = computeNutrition(recipe, Number(finishedWeightG) || 0);
  if (!declaration) return res.status(422).json({ error: 'no_data' });
  res.json({ declaration });
});

// ---------- Local AI assist (premium, BETA) ----------

/** AI availability (premium) — drives the BETA UI's "tillgänglig/inte tillgänglig" state. */
app.get('/api/me/ai-status', requireAuth, async (req, res) => {
  if (!hasPremium(req.user)) return res.json({ premium: false, available: false });
  res.json({ premium: true, available: await ollamaAvailable() });
});

// Capability 1: extract pasted recipe text -> [{name, quantity, unit}] (extraction only).
const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' } },
        required: ['name', 'quantity', 'unit'],
      },
    },
  },
  required: ['ingredients'],
};
const recipeZod = z.object({
  ingredients: z
    .array(z.object({ name: z.string(), quantity: z.number(), unit: z.string() }))
    .max(200),
});

app.post('/api/me/recipe-import', requireAuth, async (req, res) => {
  if (!hasPremium(req.user)) return res.status(403).json({ error: 'premium_required' });
  const text = String(req.body?.text ?? '').slice(0, 8000); // clamp untrusted input
  if (!text.trim()) return res.status(400).json({ error: 'empty' });
  try {
    const raw = await chatJSON({
      schema: RECIPE_SCHEMA,
      system:
        'Du extraherar ingredienser ur ett recept till JSON {ingredients:[{name,quantity,unit}]}. ' +
        'name = ingrediensens namn, quantity = mängd som tal, unit = enhet (g, kg, dl, ml, msk, tsk, krm, st). ' +
        'Hitta inte på värden, bedöm inte allergener och lägg inte till något som inte står i texten.',
      user: text,
    });
    const parsed = recipeZod.safeParse(raw);
    if (!parsed.success) return res.status(422).json({ error: 'bad_output' });
    const ingredients = parsed.data.ingredients
      .map((i) => ({
        name: String(i.name).slice(0, 120).trim(),
        quantity: Number.isFinite(i.quantity) ? i.quantity : 0,
        unit: String(i.unit).slice(0, 12).trim().toLowerCase(),
      }))
      .filter((i) => i.name);
    res.json({ ingredients });
  } catch (e) {
    if (e?.message === 'ollama_unreachable') return res.status(503).json({ error: 'ai_unavailable' });
    console.error('recipe-import failed:', e?.message || e);
    res.status(502).json({ error: 'ai_failed' });
  }
});

// Capability 2 helpers: deterministic fuzzy match + variant detection.
function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-zåäö0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function nameTokens(s) {
  return normName(s).split(' ').filter(Boolean);
}
function bigrams(s) {
  const x = normName(s).replace(/ /g, '');
  const r = [];
  for (let i = 0; i < x.length - 1; i++) r.push(x.slice(i, i + 2));
  return r;
}
function dice(a, b) {
  const A = bigrams(a);
  const Bg = bigrams(b);
  if (!A.length || !Bg.length) return 0;
  const m = new Map();
  for (const g of Bg) m.set(g, (m.get(g) || 0) + 1);
  let inter = 0;
  for (const g of A) {
    const c = m.get(g);
    if (c > 0) { inter++; m.set(g, c - 1); }
  }
  return (2 * inter) / (A.length + Bg.length);
}
// Hybrid: token containment (handles "Strösocker"~"Socker", "Smör"~"Smör, normalsaltat")
// + character-bigram similarity (robust to Swedish compound words). 0..1.
function scoreMatch(ingName, candName) {
  const it = nameTokens(ingName);
  if (!it.length) return 0;
  const ct = nameTokens(candName);
  const cset = new Set(ct);
  let hit = 0;
  for (const t of it) {
    if (cset.has(t)) { hit++; continue; }
    if (ct.some((c) => (c.startsWith(t) || t.startsWith(c)) && Math.min(c.length, t.length) >= 3)) { hit++; continue; }
    if (ct.some((c) => c.length >= 4 && t.includes(c))) { hit++; continue; }
  }
  const tok = hit / it.length;
  let score = 0.6 * tok + 0.4 * dice(ingName, candName);
  if (ct[0] && it[0] && ct[0] === it[0]) score += 0.05;
  return Math.min(1, score);
}
function detectVariants(cands) {
  const text = cands.map((c) => normName(c.namn)).join(' | ');
  const flags = [];
  if (/\bsaltat\b/.test(text) && /\bosaltat\b/.test(text)) flags.push('saltat/osaltat (påverkar salt)');
  const milk = ['minimjölk', 'lättmjölk', 'mellanmjölk', 'standardmjölk'].filter((m) => text.includes(m));
  if (milk.length >= 2) flags.push('mjölksort (påverkar fett): ' + milk.join('/'));
  if (/\bfullkorn\b/.test(text) && /(vitt|siktat|special)/.test(text)) flags.push('fullkorn/siktat');
  return flags;
}
const RANK_SCHEMA = {
  type: 'object',
  properties: { livsmedelsnummer: { type: 'string' }, reason: { type: 'string' } },
  required: ['livsmedelsnummer'],
};
const rankZod = z.object({
  livsmedelsnummer: z.union([z.string(), z.number()]).transform(String),
  reason: z.string().optional(),
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

app.get('/api/admin/ingredients', requireAdmin, (_req, res) => {
  res.json({ ingredients: listIngredientsWithAllergens() });
});

app.put('/api/admin/ingredients/:id/allergens', requireAdmin, (req, res) => {
  const schema = z.object({ allergens: z.array(z.enum(ALLERGEN_CODES)).max(14) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  if (!queries.getIngredient.get(req.params.id)) return res.status(404).json({ error: 'not_found' });
  queries.clearIngredientAllergens.run(req.params.id);
  for (const code of [...new Set(parsed.data.allergens)]) {
    queries.addIngredientAllergen.run(req.params.id, code);
  }
  res.json({ ok: true });
});

app.put('/api/admin/ingredients/:id/livsmedelsnummer', requireAdmin, (req, res) => {
  const schema = z.object({ livsmedelsnummer: z.string().trim().max(40).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  if (!queries.getIngredient.get(req.params.id)) return res.status(404).json({ error: 'not_found' });
  queries.setIngredientLivsmedelsnummer.run(parsed.data.livsmedelsnummer?.trim() || null, req.params.id);
  res.json({ ok: true });
});

// Capability 2: suggest a livsmedelsnummer mapping (fuzzy first, Gemma ranks the
// ambiguous remainder among REAL candidates only — never generates a number).
app.post('/api/admin/ingredients/:id/suggest-mapping', requireAdmin, async (req, res) => {
  const ing = queries.getIngredient.get(req.params.id);
  if (!ing) return res.status(404).json({ error: 'not_found' });
  if (nutritionMeta().count === 0) return res.status(409).json({ error: 'no_dataset' });

  const ranked = queries.listNutritionNames
    .all()
    .map((r) => ({ livsmedelsnummer: r.livsmedelsnummer, namn: r.namn, score: scoreMatch(ing.name, r.namn) }))
    .sort((a, b) => b.score - a.score);
  const topN = ranked.slice(0, 6);
  const best = topN[0];
  const second = topN[1];
  const variants = detectVariants(topN);

  let suggestion = null;
  let usedModel = false;

  if (best && best.score >= 0.85 && (!second || best.score - second.score >= 0.15) && variants.length === 0) {
    suggestion = { livsmedelsnummer: best.livsmedelsnummer, namn: best.namn, confidence: 'hög' };
  } else if (best && best.score >= 0.25) {
    try {
      const list = topN.map((c) => `${c.livsmedelsnummer}: ${c.namn}`).join('\n');
      const raw = await chatJSON({
        schema: RANK_SCHEMA,
        system:
          'Välj det livsmedel ur kandidatlistan som bäst motsvarar ingrediensen. Svara med JSON ' +
          '{livsmedelsnummer, reason}. livsmedelsnummer MÅSTE vara ett av numren i listan – hitta inte på nummer. reason kort på svenska.',
        user: `Ingrediens: ${ing.name}\nKandidater:\n${list}`,
      });
      const z2 = rankZod.safeParse(raw);
      // HARD CONSTRAINT: only accept an id that was in the candidate list.
      const picked = z2.success ? topN.find((c) => String(c.livsmedelsnummer) === z2.data.livsmedelsnummer) : null;
      if (picked) {
        suggestion = { livsmedelsnummer: picked.livsmedelsnummer, namn: picked.namn, confidence: 'medel', reason: (z2.data.reason || '').slice(0, 200) };
        usedModel = true;
      } else {
        suggestion = { livsmedelsnummer: best.livsmedelsnummer, namn: best.namn, confidence: 'låg' };
      }
    } catch {
      // Ollama unavailable — still offer the deterministic fuzzy best (low confidence).
      suggestion = { livsmedelsnummer: best.livsmedelsnummer, namn: best.namn, confidence: 'låg' };
    }
  }

  res.json({
    suggestion,
    candidates: topN.map((c) => ({ livsmedelsnummer: c.livsmedelsnummer, namn: c.namn })),
    variants,
    usedModel,
  });
});

// Re-importable Livsmedelsdatabas import (operator drops a CSV/JSON file first).
app.post('/api/admin/nutrition/import', requireAdmin, (req, res) => {
  try {
    const result = importNutrition({ version: req.body?.version });
    res.json({ ok: true, ...result });
  } catch (e) {
    const known = ['no_file', 'empty_file', 'missing_key_columns'];
    console.error('nutrition import failed:', e?.message || e);
    res.status(400).json({ error: known.includes(e?.message) ? e.message : 'import_failed' });
  }
});

app.get('/api/admin/nutrition/meta', requireAdmin, (_req, res) => res.json(nutritionMeta()));

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
