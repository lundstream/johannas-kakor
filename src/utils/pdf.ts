import type { LabelData } from '../types';

/**
 * Export is rendered SERVER-SIDE (headless Chromium) so the watermark for
 * non-paying tenants is composited into the artifact and can't be stripped via
 * devtools. The server decides the watermark authoritatively (logged-in user's
 * entitlement, or the free-mode slug's plan); the client only supplies the label
 * data and, for anonymous free mode, the slug.
 */
async function downloadExport(
  format: 'pdf' | 'png',
  label: LabelData,
  opts: { copies?: number; slug?: string; transparent?: boolean } = {},
) {
  const res = await fetch(`/api/export/${format}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: { ...label, copies: opts.copies ?? label.copies ?? 1 },
      slug: opts.slug,
      transparent: opts.transparent,
    }),
  });
  if (!res.ok) throw new Error('export_failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(label.productName) || 'etikett'}${
    format === 'png' && opts.transparent ? '-transparent' : ''
  }.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Multi-page PDF at exact mm size, one page per copy. */
export async function exportLabelsToPdf(label: LabelData, copies: number, freeSlug?: string) {
  await downloadExport('pdf', label, { copies, slug: freeSlug });
}

/** PNG export. `transparent` strips the white label background. */
export async function exportLabelToPng(label: LabelData, transparent: boolean, freeSlug?: string) {
  await downloadExport('png', label, { transparent, slug: freeSlug });
}

function slug(s: string) {
  return s
    .toLocaleLowerCase('sv-SE')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
