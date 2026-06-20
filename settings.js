import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, 'settings.json');

// Config precedence: environment variables (production / Docker) override
// settings.json, which is an optional convenience for local development.
// Secrets (Stripe, Resend, session) are expected from env in production —
// see .env.example. settings.json is no longer required to boot.
const fileSettings = fs.existsSync(SETTINGS_PATH)
  ? JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))
  : {};

const env = process.env;
const pick = (envVal, fileVal, def) =>
  envVal !== undefined && envVal !== '' ? envVal : fileVal !== undefined ? fileVal : def;

export const settings = {
  app_name: pick(env.APP_NAME, fileSettings.app_name, 'bakery-labels'),
  port: Number(pick(env.PORT, fileSettings.port, 3060)),
  session_secret: pick(env.SESSION_SECRET, fileSettings.session_secret, ''),
  session_days: Number(pick(env.SESSION_DAYS, fileSettings.session_days, 30)),
  magic_link_minutes: Number(pick(env.MAGIC_LINK_MINUTES, fileSettings.magic_link_minutes, 15)),
  base_url: pick(env.BASE_URL, fileSettings.base_url, 'http://localhost:3050'),
  resend_api_key: pick(env.RESEND_API_KEY, fileSettings.resend_api_key, ''),
  email_from: pick(env.EMAIL_FROM, fileSettings.email_from, 'Enkel Etikett <noreply@example.com>'),
  first_admin_email: pick(env.FIRST_ADMIN_EMAIL, fileSettings.first_admin_email, ''),
  google: fileSettings.google || { enabled: false, client_id: '', client_secret: '' },
  // Raw value; parsed into Express's trust-proxy setting in server.js.
  trust_proxy: pick(env.TRUST_PROXY, fileSettings.trust_proxy, undefined),
};
