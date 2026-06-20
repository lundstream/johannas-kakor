/**
 * Gallery pillar helpers — kept out of server.js so the routes stay readable.
 *
 * Security posture (public-facing surface; treat every byte as hostile):
 *  - Uploads are validated by MAGIC BYTES (not extension/client MIME), restricted to
 *    raster jpeg/png/webp, then RE-ENCODED with sharp. Re-encoding neutralises
 *    polyglots/embedded payloads, enforces max dimensions, and DROPS all metadata
 *    (EXIF/GPS) — sharp keeps metadata only if .withMetadata() is called, which we
 *    never do. SVG is rejected outright (XML can carry script).
 *  - Decode is guarded against decompression bombs (input pixel cap + byte cap).
 *  - Links are https-only, length-capped, and rendered as a display domain.
 *  - Rendered label thumbnails reuse the existing server-side render pipeline
 *    (export.js) and are cached on disk, regenerated when the label changes.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { renderLabel } from './export.js';
import { queries, GALLERY_LABELS_DIR, GALLERY_UPLOADS_DIR } from './db.js';

// ---- Upload limits ----
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB pre-decode cap (after base64 decode)
const MAX_INPUT_PIXELS = 50 * 1000 * 1000; // 50 MP decode cap (decompression-bomb guard)
const MAX_DIM = 1600; // re-encoded uploads fit inside this box
const LABEL_THUMB_W = 1000; // rendered-label thumbnail width

// ---- Magic-byte sniffing (first bytes decide; never trust client MIME) ----
function sniffRaster(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  )
    return 'png';
  // RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return 'webp';
  return null; // anything else (incl. '<' for SVG/HTML) is rejected
}

/** Decode a base64 (optionally data-URL) string to a size-capped Buffer, or throw. */
export function decodeUploadBase64(input) {
  if (typeof input !== 'string' || input.length === 0) throw new Error('no_image');
  const comma = input.indexOf(',');
  const b64 = input.startsWith('data:') && comma >= 0 ? input.slice(comma + 1) : input;
  // base64 length ~= 4/3 of bytes; reject obviously oversized before allocating.
  if (b64.length > Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8) throw new Error('too_large');
  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    throw new Error('invalid_image');
  }
  if (buf.length === 0) throw new Error('invalid_image');
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error('too_large');
  return buf;
}

/**
 * Validate + re-encode an uploaded image to a normalized webp.
 * Returns { buffer, width, height, ext:'webp' }. Throws on any rejection.
 */
export async function processUploadImage(buf) {
  const kind = sniffRaster(buf);
  if (!kind) throw new Error('unsupported_format'); // not jpeg/png/webp by magic bytes

  // Header-only metadata read first (cheap) to reject decompression bombs by dimension.
  let meta;
  try {
    meta = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new Error('invalid_image');
  }
  if (!meta.width || !meta.height) throw new Error('invalid_image');
  if (meta.width * meta.height > MAX_INPUT_PIXELS) throw new Error('too_large');

  // Re-encode: auto-orient from EXIF then DROP metadata (no withMetadata), cap size.
  const out = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // applies EXIF orientation, then orientation tag is dropped on output
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return { buffer: out.data, width: out.info.width, height: out.info.height, ext: 'webp' };
}

/** Persist a processed upload buffer under the data volume with a random name. */
export function saveUploadBuffer(buffer, ext = 'webp') {
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(GALLERY_UPLOADS_DIR, name), buffer);
  return name;
}

export function uploadFilePath(name) {
  // Defend against traversal: only a bare filename is ever valid.
  const base = path.basename(name || '');
  return path.join(GALLERY_UPLOADS_DIR, base);
}

// ---- Link sanitisation (links render on the most public page) ----
const MAX_LINK_LEN = 300;
export function sanitizeLink(input) {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw || raw.length > MAX_LINK_LEN) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null; // https only — rejects javascript:/data:/http:
  return { url: u.toString(), domain: u.hostname.replace(/^www\./, '') };
}

// ---- Tag validation against the fixed taxonomy ----
export function validTagIds(input) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(queries.listGalleryTags.all().map((t) => t.id));
  return [...new Set(input.filter((t) => typeof t === 'string' && allowed.has(t)))].slice(0, 6);
}

// ---- Rendered-label thumbnail cache (Part 1) ----
function labelHash(labelData) {
  return crypto.createHash('sha1').update(JSON.stringify(labelData)).digest('hex');
}

const inflight = new Map(); // user_id -> Promise (coalesce concurrent renders)

/**
 * Ensure a cached webp thumbnail exists for a tenant's label and return its filename.
 * Renders via the real pipeline (watermark=false; eligibility is the caller's job),
 * caches on disk, and regenerates when the label JSON changes. Returns null on failure.
 */
export async function ensureLabelThumb(userId, labelData) {
  const hash = labelHash(labelData);
  const row = queries.getGalleryLabel.get(userId);
  const name = `${userId}.webp`;
  const filePath = path.join(GALLERY_LABELS_DIR, name);
  if (row?.render_hash === hash && row?.render_path && fs.existsSync(filePath)) return name;

  if (inflight.has(userId)) return inflight.get(userId);
  const p = (async () => {
    try {
      const png = await renderLabel({ label: labelData, watermark: false, format: 'png', copies: 1 });
      const webp = await sharp(png)
        .resize({ width: LABEL_THUMB_W, withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
      fs.writeFileSync(filePath, webp);
      queries.setGalleryLabelRender.run(name, hash, Date.now(), userId);
      return name;
    } catch (e) {
      console.error('gallery label render failed for user', userId, e?.message || e);
      return null;
    } finally {
      inflight.delete(userId);
    }
  })();
  inflight.set(userId, p);
  return p;
}

export function labelThumbPath(name) {
  return path.join(GALLERY_LABELS_DIR, path.basename(name || ''));
}
