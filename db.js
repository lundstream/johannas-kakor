import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH lets the deploy point SQLite at a mounted volume (e.g. /app/data/app.db).
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');
const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  google_id TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS magic_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_labels (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_templates (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_user ON user_templates(user_id);

CREATE TABLE IF NOT EXISTS user_custom_ingredients (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

/** Default app_settings — only inserted if not present. */
const DEFAULT_SETTINGS = {
  site_name: 'Enkel Etikett',
  header_tagline: 'Enkelt etikettsystem för ditt bageri',
  footer_text: 'Enkel Etikett · Enkelt etikettsystem för små bagerier',
  favicon_data_url: '',
  primary_color: '#b08654',
  instagram_url: '',
  default_locale: 'sv',
  free_mode_enabled: '0',
  free_mode_path: 'free',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings(key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

// One-time migration: replace old default values with new brand
const migrateSetting = db.prepare('UPDATE app_settings SET value = ? WHERE key = ? AND value = ?');
migrateSetting.run('Enkel Etikett', 'site_name', 'Bakery Labels');
migrateSetting.run('Enkelt etikettsystem för ditt bageri', 'header_tagline', 'Label system');
migrateSetting.run('Enkel Etikett · Enkelt etikettsystem för små bagerier', 'footer_text', 'Bakery Labels · A simple label designer for small bakeries');
migrateSetting.run('', 'instagram_url', 'https://www.instagram.com/johannaskakor');

// ---- Migration: entitlement / billing columns on users (idempotent) ----
// Each account is the billable "tenant". Only the Stripe webhook writes these.
function columnExists(table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}
function addColumn(table, col, def) {
  if (!columnExists(table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('users', 'plan', "TEXT NOT NULL DEFAULT 'trial'"); // 'trial' | 'free_comp' | 'paid'
addColumn('users', 'stripe_customer_id', 'TEXT');
addColumn('users', 'stripe_subscription_id', 'TEXT');
addColumn('users', 'subscription_status', 'TEXT'); // raw Stripe status
db.exec('CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)');

// ---- Phase 1.5 seed: comped partner + multi-slug free mode (idempotent) ----
// Free mode supports multiple slugs, each tagged with a plan (consumed by the
// watermark phase). Slug plans are server-seeded only — NOT in the admin write
// whitelist — so they can't be changed by users/admins via the settings API.
const COMP_PARTNER_EMAIL = 'johanna.bergstrom93@outlook.com';
// Only correct the wrong 'trial' default; never clobber a deliberate later plan (e.g. 'paid').
db.prepare("UPDATE users SET plan = 'free_comp' WHERE email = ? AND plan = 'trial'").run(COMP_PARTNER_EMAIL);

const DEFAULT_FREE_SLUGS = [
  { slug: 'johanna', plan: 'free_comp' }, // private comped link for the partner
  { slug: 'prova', plan: 'trial' }, // public anonymous trial (watermarked later)
];
let freeSlugs = [];
try {
  freeSlugs = JSON.parse(db.prepare("SELECT value FROM app_settings WHERE key = 'free_mode_slugs'").get()?.value || '[]');
  if (!Array.isArray(freeSlugs)) freeSlugs = [];
} catch {
  freeSlugs = [];
}
for (const def of DEFAULT_FREE_SLUGS) {
  const existing = freeSlugs.find((s) => s && s.slug === def.slug);
  if (existing) existing.plan = def.plan; // update in place, no duplicate
  else freeSlugs.push({ ...def });
}
db.prepare(
  `INSERT INTO app_settings(key, value) VALUES('free_mode_slugs', ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value`
).run(JSON.stringify(freeSlugs));

// ---- Phase A: ingredient DB + allergen tags (idempotent) ----
db.exec(`
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ingredient_allergens (
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  PRIMARY KEY (ingredient_id, code)
);
`);

function ingredientSlug(name) {
  return (
    'ing-' +
    name
      .toLowerCase()
      .replace(/å/g, 'a')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  );
}

// Seed from the SAME ingredients.seed.json the frontend falls back to. Tags are
// only seeded when the ingredient row is newly created, so admin edits survive restarts.
try {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'ingredients.seed.json'), 'utf8'));
  const insIngredient = db.prepare('INSERT OR IGNORE INTO ingredients(id, name, sort) VALUES (?, ?, ?)');
  const insTag = db.prepare('INSERT OR IGNORE INTO ingredient_allergens(ingredient_id, code) VALUES (?, ?)');
  const seedTx = db.transaction((items) => {
    items.forEach((it, i) => {
      const id = ingredientSlug(it.name);
      const info = insIngredient.run(id, it.name, i);
      if (info.changes > 0) for (const code of it.allergens || []) insTag.run(id, code);
    });
  });
  if (Array.isArray(seed)) seedTx(seed);
} catch (e) {
  console.error('ingredient seed failed', e);
}

// ---- Phase D: shared nutrition dataset (Livsmedelsverket) + ingredient mapping ----
db.exec(`
CREATE TABLE IF NOT EXISTS nutrition_items (
  livsmedelsnummer TEXT PRIMARY KEY,
  namn TEXT NOT NULL,
  energi_kj REAL, energi_kcal REAL,
  fett REAL, mattat_fett REAL,
  kolhydrat REAL, sockerarter REAL,
  protein REAL, salt REAL,
  raw_json TEXT
);
`);
// Optional link from an ingredient to a dataset row (per-product mapping).
addColumn('ingredients', 'livsmedelsnummer', 'TEXT');

// ---- Phase A migration: rewrite stored label/template/custom blobs to Annex II ----
// MANDEL -> NÖTTER (almond is part of group 8). SKALDJUR was ambiguous and is
// dropped (surfaced for manual re-tag). Idempotent: a no-op once codes are gone.
function migrateAllergenArray(arr) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  let changed = false;
  for (const c of arr) {
    if (c === 'MANDEL') { changed = true; if (!out.includes('NÖTTER')) out.push('NÖTTER'); }
    else if (c === 'SKALDJUR') { changed = true; } // dropped — needs manual re-tag
    else if (!out.includes(c)) out.push(c);
  }
  return changed ? out : null;
}
function migrateBlob(node) {
  let changed = false;
  if (Array.isArray(node)) {
    for (const n of node) if (migrateBlob(n)) changed = true;
  } else if (node && typeof node === 'object') {
    if (Array.isArray(node.allergens)) {
      const next = migrateAllergenArray(node.allergens);
      if (next) { node.allergens = next; changed = true; }
    }
    for (const k of Object.keys(node)) if (migrateBlob(node[k])) changed = true;
  }
  return changed;
}
try {
  const tables = [
    { sel: 'SELECT user_id AS k, data FROM user_labels', upd: 'UPDATE user_labels SET data = ? WHERE user_id = ?' },
    { sel: 'SELECT id AS k, data FROM user_templates', upd: 'UPDATE user_templates SET data = ? WHERE id = ?' },
    { sel: 'SELECT user_id AS k, data FROM user_custom_ingredients', upd: 'UPDATE user_custom_ingredients SET data = ? WHERE user_id = ?' },
  ];
  let migrated = 0;
  for (const t of tables) {
    const upd = db.prepare(t.upd);
    for (const row of db.prepare(t.sel).all()) {
      try {
        const data = JSON.parse(row.data);
        if (migrateBlob(data)) { upd.run(JSON.stringify(data), row.k); migrated++; }
      } catch { /* skip malformed */ }
    }
  }
  if (migrated > 0) console.log(`[db] Annex II allergen migration rewrote ${migrated} blob(s)`);
} catch (e) {
  console.error('allergen blob migration failed', e);
}

// ---- Gallery pillar: opt-in rendered-label feed + premium uploads + tags ----
// Public-facing showcase data. Real tables (NOT label blobs). Idempotent.
db.exec(`
CREATE TABLE IF NOT EXISTS gallery_labels (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_in_gallery INTEGER NOT NULL DEFAULT 0, -- tenant opt-in (default OFF)
  admin_hidden INTEGER NOT NULL DEFAULT 0,    -- operator moderation: hide from feed
  pinned INTEGER NOT NULL DEFAULT 0,          -- operator: curated baseline / featured
  render_path TEXT,                           -- cached PNG filename (under DATA/gallery/labels)
  render_hash TEXT,                           -- hash of label data the cache was built from
  rendered_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,                   -- random server-generated filename (NEVER client name)
  caption TEXT,
  link_url TEXT,                              -- validated https only
  link_domain TEXT,                           -- display domain (not raw text-as-URL)
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'approved' | 'rejected'
  admin_hidden INTEGER NOT NULL DEFAULT 0,    -- un-publish an already-approved item
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_gallery_uploads_user ON gallery_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_uploads_status ON gallery_uploads(status);

CREATE TABLE IF NOT EXISTS gallery_tags (
  id TEXT PRIMARY KEY,   -- english slug
  label TEXT NOT NULL,   -- swedish display
  sort INTEGER NOT NULL DEFAULT 0
);

-- Polymorphic join: item_type in ('label','upload'); item_id is the user_id (label) or upload id.
CREATE TABLE IF NOT EXISTS gallery_item_tags (
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  tag_id TEXT NOT NULL REFERENCES gallery_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_type, item_id, tag_id)
);
`);

// Fixed, curated Swedish taxonomy (server-owned; not user-writable). Extend here.
const GALLERY_TAGS = [
  ['brod', 'Bröd'],
  ['bullar', 'Bullar'],
  ['smakakor', 'Småkakor'],
  ['kakor', 'Kakor & mjuka'],
  ['tartor', 'Tårtor & bakelser'],
  ['chark', 'Chark'],
  ['sylt', 'Sylt & marmelad'],
  ['choklad', 'Choklad & konfekt'],
  ['ost', 'Ost'],
  ['glutenfritt', 'Glutenfritt'],
  ['veganskt', 'Veganskt'],
];
{
  const insTag = db.prepare('INSERT INTO gallery_tags(id, label, sort) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label, sort = excluded.sort');
  GALLERY_TAGS.forEach(([id, label], i) => insTag.run(id, label, i));
}

// Gallery asset dirs live under the persisted data volume, OUTSIDE dist/web-root,
// so uploads are never statically served or executable.
export const GALLERY_DIR = path.join(DATA_DIR, 'gallery');
export const GALLERY_LABELS_DIR = path.join(GALLERY_DIR, 'labels');
export const GALLERY_UPLOADS_DIR = path.join(GALLERY_DIR, 'uploads');
for (const d of [GALLERY_DIR, GALLERY_LABELS_DIR, GALLERY_UPLOADS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

export default db;

export const queries = {
  // users
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  createUser: db.prepare(
    `INSERT INTO users(email, password_hash, name, role, google_id, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),
  updateUserLastLogin: db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?'),
  updateUserPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  updateUserName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
  updateUserRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

  // billing / entitlement (written ONLY by the Stripe webhook + checkout customer creation)
  findUserByStripeCustomer: db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?'),
  updateUserStripeCustomer: db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?'),
  setUserBilling: db.prepare(
    `UPDATE users SET plan = ?,
       stripe_customer_id = COALESCE(?, stripe_customer_id),
       stripe_subscription_id = ?,
       subscription_status = ?
     WHERE id = ?`
  ),
  setUserPlan: db.prepare('UPDATE users SET plan = ? WHERE id = ?'),
  listUsers: db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users ORDER BY created_at DESC'),

  // sessions
  createSession: db.prepare(
    'INSERT INTO sessions(id, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)'
  ),
  findSession: db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
  deleteSessionsForUser: db.prepare('DELETE FROM sessions WHERE user_id = ?'),

  // magic tokens
  createMagicToken: db.prepare(
    'INSERT INTO magic_tokens(token, email, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ),
  findMagicToken: db.prepare(
    'SELECT * FROM magic_tokens WHERE token = ? AND expires_at > ? AND used_at IS NULL'
  ),
  consumeMagicToken: db.prepare('UPDATE magic_tokens SET used_at = ? WHERE token = ?'),
  cleanupMagicTokens: db.prepare('DELETE FROM magic_tokens WHERE expires_at < ?'),

  // labels
  getLabel: db.prepare('SELECT data, updated_at FROM user_labels WHERE user_id = ?'),
  upsertLabel: db.prepare(
    `INSERT INTO user_labels(user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ),

  // templates
  listTemplates: db.prepare('SELECT * FROM user_templates WHERE user_id = ? ORDER BY created_at DESC'),
  getTemplate: db.prepare('SELECT * FROM user_templates WHERE id = ? AND user_id = ?'),
  createTemplate: db.prepare(
    'INSERT INTO user_templates(id, user_id, name, data, created_at) VALUES (?, ?, ?, ?, ?)'
  ),
  updateTemplate: db.prepare('UPDATE user_templates SET name = ?, data = ? WHERE id = ? AND user_id = ?'),
  deleteTemplate: db.prepare('DELETE FROM user_templates WHERE id = ? AND user_id = ?'),

  // custom ingredients
  getCustomIngredients: db.prepare('SELECT data FROM user_custom_ingredients WHERE user_id = ?'),
  upsertCustomIngredients: db.prepare(
    `INSERT INTO user_custom_ingredients(user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ),

  // ingredients (Phase A)
  listIngredients: db.prepare('SELECT id, name, livsmedelsnummer FROM ingredients ORDER BY sort, name'),
  listIngredientAllergens: db.prepare('SELECT ingredient_id, code FROM ingredient_allergens'),
  getIngredient: db.prepare('SELECT id, name FROM ingredients WHERE id = ?'),
  clearIngredientAllergens: db.prepare('DELETE FROM ingredient_allergens WHERE ingredient_id = ?'),
  addIngredientAllergen: db.prepare('INSERT OR IGNORE INTO ingredient_allergens(ingredient_id, code) VALUES (?, ?)'),
  setIngredientLivsmedelsnummer: db.prepare('UPDATE ingredients SET livsmedelsnummer = ? WHERE id = ?'),
  listIngredientNumbers: db.prepare('SELECT id, livsmedelsnummer FROM ingredients WHERE livsmedelsnummer IS NOT NULL'),

  // nutrition dataset (Phase D)
  getNutritionItem: db.prepare('SELECT * FROM nutrition_items WHERE livsmedelsnummer = ?'),
  upsertNutritionItem: db.prepare(
    `INSERT INTO nutrition_items
       (livsmedelsnummer, namn, energi_kj, energi_kcal, fett, mattat_fett, kolhydrat, sockerarter, protein, salt, raw_json)
     VALUES (@livsmedelsnummer, @namn, @energi_kj, @energi_kcal, @fett, @mattat_fett, @kolhydrat, @sockerarter, @protein, @salt, @raw_json)
     ON CONFLICT(livsmedelsnummer) DO UPDATE SET
       namn=excluded.namn, energi_kj=excluded.energi_kj, energi_kcal=excluded.energi_kcal,
       fett=excluded.fett, mattat_fett=excluded.mattat_fett, kolhydrat=excluded.kolhydrat,
       sockerarter=excluded.sockerarter, protein=excluded.protein, salt=excluded.salt, raw_json=excluded.raw_json`
  ),
  clearNutrition: db.prepare('DELETE FROM nutrition_items'),
  countNutrition: db.prepare('SELECT COUNT(*) AS n FROM nutrition_items'),
  listNutritionNames: db.prepare('SELECT livsmedelsnummer, namn FROM nutrition_items'),

  // app settings
  getAllSettings: db.prepare('SELECT key, value FROM app_settings'),
  getSetting: db.prepare('SELECT value FROM app_settings WHERE key = ?'),
  setSetting: db.prepare(
    `INSERT INTO app_settings(key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ),

  // ---- Gallery: tags ----
  listGalleryTags: db.prepare('SELECT id, label FROM gallery_tags ORDER BY sort, label'),
  getGalleryTag: db.prepare('SELECT id FROM gallery_tags WHERE id = ?'),
  listItemTags: db.prepare('SELECT tag_id FROM gallery_item_tags WHERE item_type = ? AND item_id = ?'),
  clearItemTags: db.prepare('DELETE FROM gallery_item_tags WHERE item_type = ? AND item_id = ?'),
  addItemTag: db.prepare('INSERT OR IGNORE INTO gallery_item_tags(item_type, item_id, tag_id) VALUES (?, ?, ?)'),
  listAllItemTags: db.prepare('SELECT item_type, item_id, tag_id FROM gallery_item_tags'),

  // ---- Gallery: per-tenant rendered-label opt-in (Part 1) ----
  getGalleryLabel: db.prepare('SELECT * FROM gallery_labels WHERE user_id = ?'),
  upsertGalleryOptIn: db.prepare(
    `INSERT INTO gallery_labels(user_id, show_in_gallery, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET show_in_gallery = excluded.show_in_gallery, updated_at = excluded.updated_at`
  ),
  setGalleryLabelRender: db.prepare(
    'UPDATE gallery_labels SET render_path = ?, render_hash = ?, rendered_at = ? WHERE user_id = ?'
  ),
  setGalleryLabelModeration: db.prepare(
    'UPDATE gallery_labels SET admin_hidden = ?, pinned = ?, updated_at = ? WHERE user_id = ?'
  ),
  // Eligible opted-in labels (admin moderation + render cache resolved in JS against users/labels).
  listOptedInLabels: db.prepare('SELECT * FROM gallery_labels WHERE show_in_gallery = 1'),

  // ---- Gallery: premium uploads (Part 2) ----
  createUpload: db.prepare(
    `INSERT INTO gallery_uploads(user_id, image_path, caption, link_url, link_domain, width, height, status, created_at)
     VALUES (@user_id, @image_path, @caption, @link_url, @link_domain, @width, @height, 'pending', @created_at)`
  ),
  getUpload: db.prepare('SELECT * FROM gallery_uploads WHERE id = ?'),
  listUploadsByUser: db.prepare('SELECT * FROM gallery_uploads WHERE user_id = ? ORDER BY created_at DESC'),
  listAllUploads: db.prepare("SELECT * FROM gallery_uploads ORDER BY (status = 'pending') DESC, created_at DESC"),
  listApprovedUploads: db.prepare("SELECT * FROM gallery_uploads WHERE status = 'approved' AND admin_hidden = 0"),
  setUploadStatus: db.prepare('UPDATE gallery_uploads SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?'),
  setUploadModeration: db.prepare('UPDATE gallery_uploads SET admin_hidden = ?, pinned = ? WHERE id = ?'),
  deleteUpload: db.prepare('DELETE FROM gallery_uploads WHERE id = ?'),
};
