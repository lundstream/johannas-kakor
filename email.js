import { Resend } from 'resend';
import { settings } from './settings.js';

let client = null;
function getClient() {
  if (!settings.resend_api_key) return null;
  if (!client) client = new Resend(settings.resend_api_key);
  return client;
}

/**
 * Send an email via Resend. In development without an API key, logs to console.
 * Returns { ok: boolean, error?: string }.
 */
export async function sendEmail({ to, subject, html, text }) {
  const c = getClient();
  if (!c) {
    console.log('\n=== EMAIL (no Resend key configured) ===');
    console.log('To:     ', to);
    console.log('Subject:', subject);
    if (text) console.log('Text:   ', text);
    if (html) console.log('HTML:   ', html);
    console.log('=========================================\n');
    return { ok: true };
  }
  try {
    await c.emails.send({
      from: settings.email_from,
      to,
      subject,
      html,
      text,
    });
    return { ok: true };
  } catch (e) {
    console.error('Email send failed:', e?.message || e);
    return { ok: false, error: String(e?.message || e) };
  }
}
