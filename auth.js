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
    subject: 'Your sign-in link',
    text: `Sign in to Bakery Labels: ${url}\n\nThis link is valid for ${minutes} minutes.`,
    html: `<p>Sign in to <strong>Bakery Labels</strong>:</p>
<p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#0a0a0a;color:#fafaf7;border-radius:999px;text-decoration:none">Sign in</a></p>
<p style="color:#666;font-size:13px">Or paste this URL into your browser:<br><a href="${url}">${url}</a></p>
<p style="color:#999;font-size:12px">This link is valid for ${minutes} minutes. If you didn't request it, ignore this email.</p>`,
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
