import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { queries } from './db.js';
import { settings } from './settings.js';
import { sendEmail } from './email.js';

const SESSION_COOKIE = 'bl_session';
const SESSION_MS = settings.session_days * 24 * 60 * 60 * 1000;
const MAGIC_MS = settings.magic_link_minutes * 60 * 1000;

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function createSession(userId, userAgent) {
  const id = randomToken();
  const now = Date.now();
  queries.createSession.run(id, userId, now, now + SESSION_MS, userAgent || null);
  return id;
}

export function destroySession(sessionId) {
  if (sessionId) queries.deleteSession.run(sessionId);
}

export function setSessionCookie(res, sessionId) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MS,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Express middleware: attaches `req.user` if a valid session exists. */
export function authMiddleware(req, _res, next) {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return next();
  const sess = queries.findSession.get(sid, Date.now());
  if (!sess) return next();
  const user = queries.findUserById.get(sess.user_id);
  if (!user) return next();
  req.user = user;
  req.sessionId = sid;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  next();
}

/** Find or create a user by email (used by magic-link + Google). */
export function findOrCreateUser(email, { name } = {}) {
  const existing = queries.findUserByEmail.get(email);
  if (existing) return existing;
  const now = Date.now();
  // Promote first user matching settings.first_admin_email to admin.
  const role = settings.first_admin_email && email.toLowerCase() === settings.first_admin_email.toLowerCase()
    ? 'admin'
    : 'user';
  const info = queries.createUser.run(email, null, name || null, role, null, now, null);
  return queries.findUserById.get(info.lastInsertRowid);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Read branding from app_settings (white-label) with fallbacks. */
function brand() {
  const get = (k) => queries.getSetting.get(k)?.value || '';
  return {
    name: get('site_name') || 'Enkel Etikett',
    tagline: get('header_tagline'),
    accent: get('primary_color') || '#b08654',
  };
}
function brandName() {
  return brand().name;
}

function magicLinkText(url, minutes) {
  const b = brand();
  return `Logga in på ${b.name}:\n${url}\n\nLänken är giltig i ${minutes} minuter. Om du inte begärde den kan du ignorera det här mejlet.`;
}

/** On-brand, mobile-friendly HTML email (table layout + inline styles for email clients). */
export function magicLinkHtml(url, minutes) {
  const b = brand();
  const initial = (b.name[0] || 'E').toUpperCase();
  const tagline = b.tagline
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b6b6b;margin-top:6px;">${b.tagline}</div>`
    : '';
  return `<!doctype html>
<html lang="sv"><body style="margin:0;padding:0;background:#f5f1e8;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">Din inloggningslänk till ${b.name} – giltig i ${minutes} minuter.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#ffffff;border:1px solid #e7e3d8;border-radius:20px;overflow:hidden;">
<tr><td style="height:4px;background:${b.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="padding:32px 32px 4px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:46px;height:46px;background:#0a0a0a;border-radius:13px;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:22px;color:#fafaf7;line-height:46px;">${initial}</td></tr></table>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#0a0a0a;margin-top:14px;">${b.name}</div>
${tagline}
</td></tr>
<tr><td align="center" style="padding:8px 32px 0;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#0a0a0a;margin:18px 0 8px;">Logga in</div>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#3f3f3f;margin:0 0 24px;">Klicka på knappen för att logga in på ${b.name}.</p>
<a href="${url}" style="display:inline-block;background:#0a0a0a;color:#fafaf7;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:13px 34px;border-radius:999px;">Logga in</a>
</td></tr>
<tr><td style="padding:26px 32px 0;">
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8a8a;margin:0 0 6px;">Eller klistra in den här länken i webbläsaren:</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;margin:0;word-break:break-all;"><a href="${url}" style="color:${b.accent};">${url}</a></p>
</td></tr>
<tr><td style="padding:24px 32px 32px;">
<div style="border-top:1px solid #e7e3d8;margin:0 0 16px;font-size:0;line-height:0;">&nbsp;</div>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8a8a8a;margin:0;">Länken är giltig i ${minutes} minuter. Om du inte begärde den kan du ignorera det här mejlet.</p>
</td></tr>
</table>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a9a9a;margin-top:16px;">${b.name}</div>
</td></tr>
</table>
</body></html>`;
}

/** Issue a magic link and send the email. */
export async function issueMagicLink(email) {
  const token = randomToken();
  const now = Date.now();
  queries.cleanupMagicTokens.run(now);
  queries.createMagicToken.run(token, email, now, now + MAGIC_MS);
  const url = `${settings.base_url.replace(/\/$/, '')}/api/auth/magic/verify?token=${encodeURIComponent(token)}`;
  const minutes = settings.magic_link_minutes;
  await sendEmail({
    to: email,
    subject: `Din inloggningslänk – ${brandName()}`,
    text: magicLinkText(url, minutes),
    html: magicLinkHtml(url, minutes),
  });
  return token;
}

/** Validate magic token (one-time-use), return user or null. */
export function consumeMagicLink(token) {
  const now = Date.now();
  const row = queries.findMagicToken.get(token, now);
  if (!row) return null;
  queries.consumeMagicToken.run(now, token);
  const user = findOrCreateUser(row.email);
  queries.updateUserLastLogin.run(now, user.id);
  return user;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
