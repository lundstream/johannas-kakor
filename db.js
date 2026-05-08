import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
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
  site_name: 'Bakery Labels',
  header_tagline: 'Label system',
  footer_text: 'Bakery Labels · A simple label designer for small bakeries',
  favicon_data_url: '',
  primary_color: '#b08654',
  instagram_url: 'https://www.instagram.com/johannaskakor',
  default_locale: 'sv',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings(key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

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

  // app settings
  getAllSettings: db.prepare('SELECT key, value FROM app_settings'),
  getSetting: db.prepare('SELECT value FROM app_settings WHERE key = ?'),
  setSetting: db.prepare(
    `INSERT INTO app_settings(key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ),
};
