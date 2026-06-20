import nodemailer from 'nodemailer';
import { settings } from './settings.js';

let transporter = null;
function getTransporter() {
  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure, // true for 465 (implicit TLS); false for 587 (STARTTLS)
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });
  }
  return transporter;
}

/**
 * Send an email over SMTP (e.g. Gmail / Google Workspace).
 * In development without SMTP configured, logs to console.
 * Returns { ok: boolean, error?: string }.
 */
export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log('\n=== EMAIL (no SMTP configured) ===');
    console.log('From:   ', settings.email_from);
    console.log('To:     ', to);
    console.log('Subject:', subject);
    if (text) console.log('Text:   ', text);
    if (html) console.log('HTML:   ', html);
    console.log('==================================\n');
    return { ok: true };
  }
  try {
    await t.sendMail({ from: settings.email_from, to, subject, html, text });
    return { ok: true };
  } catch (e) {
    console.error('Email send failed:', e?.message || e);
    return { ok: false, error: String(e?.message || e) };
  }
}
