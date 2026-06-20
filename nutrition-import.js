import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { queries } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');
/** Directory the operator drops the Livsmedelsdatabas export into (CSV or JSON). */
export const NUTRITION_DIR =
  process.env.NUTRITION_DIR || path.join(path.dirname(DB_PATH), 'livsmedelsdatabasen');

// Target column -> accepted source header synonyms (normalised). Canonical keys are
// included so a JSON export using these keys maps directly. See README for the format.
const SYNONYMS = {
  livsmedelsnummer: ['livsmedelsnummer', 'nummer', 'livsmedelsnr', 'food number', 'number'],
  namn: ['livsmedelsnamn', 'namn', 'livsmedel', 'name'],
  energi_kcal: ['energi_kcal', 'energi (kcal)', 'energi, kcal', 'energi kcal', 'energi kcal (kcal)'],
  energi_kj: ['energi_kj', 'energi (kj)', 'energi, kj', 'energi kj'],
  fett: ['fett', 'fett (g)', 'fett, totalt', 'summa fett'],
  mattat_fett: ['mattat_fett', 'mättat fett', 'summa mättade fettsyror', 'fett, mättat', 'mättade fettsyror'],
  kolhydrat: ['kolhydrat', 'kolhydrater', 'kolhydrater, tillgängliga', 'tillgängliga kolhydrater', 'kolhydrater (g)'],
  sockerarter: ['sockerarter', 'socker', 'summa sockerarter', 'sockerarter (g)'],
  protein: ['protein', 'protein (g)'],
  salt: ['salt', 'salt (g)'],
};
const NUMERIC = ['energi_kcal', 'energi_kj', 'fett', 'mattat_fett', 'kolhydrat', 'sockerarter', 'protein', 'salt'];

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function num(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  // Swedish exports use decimal comma; normalise to dot. Strip thousands spaces.
  if (s.includes(',') && !s.includes('.')) s = s.replace(/\s/g, '').replace(',', '.');
  else s = s.replace(/\s/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Minimal CSV parser: delimiter ';' or ',', quoted fields, returns array of row objects. */
function parseCSV(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const delim = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let field = '';
  let row = [];
  let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQ) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}

function buildColumnMap(sampleKeys) {
  const byNorm = new Map(sampleKeys.map((k) => [norm(k), k]));
  const map = {};
  const unmatched = [];
  for (const [target, syns] of Object.entries(SYNONYMS)) {
    const hit = syns.map(norm).find((s) => byNorm.has(s));
    if (hit) map[target] = byNorm.get(hit);
    else unmatched.push(target);
  }
  return { map, unmatched };
}

function findFile(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /\.(json|csv)$/i.test(f));
  // Prefer JSON, then CSV. (Excel: export to CSV/JSON first — see README.)
  files.sort((a, b) => (a.toLowerCase().endsWith('.json') ? -1 : 1));
  return files.length ? path.join(dir, files[0]) : null;
}

/**
 * Import the Livsmedelsdatabas export from NUTRITION_DIR into nutrition_items.
 * Full refresh (clear + insert), version-stamped. Source values stored as-imported
 * (CC BY 4.0 — not altered). Returns { count, version, file, unmatched }.
 */
export function importNutrition({ version } = {}) {
  const file = findFile(NUTRITION_DIR);
  if (!file) throw new Error('no_file');
  const ext = path.extname(file).toLowerCase();
  const text = fs.readFileSync(file, 'utf8');
  const records = ext === '.json' ? JSON.parse(text) : parseCSV(text);
  if (!Array.isArray(records) || records.length === 0) throw new Error('empty_file');

  const { map, unmatched } = buildColumnMap(Object.keys(records[0]));
  if (!map.livsmedelsnummer || !map.namn) throw new Error('missing_key_columns');

  const tx = db.transaction((recs) => {
    queries.clearNutrition.run();
    for (const rec of recs) {
      const number = String(rec[map.livsmedelsnummer] ?? '').trim();
      if (!number) continue;
      const out = {
        livsmedelsnummer: number,
        namn: String(rec[map.namn] ?? '').trim(),
        raw_json: JSON.stringify(rec),
      };
      for (const t of NUMERIC) out[t] = map[t] ? num(rec[map[t]]) : null;
      queries.upsertNutritionItem.run(out);
    }
  });
  tx(records);

  const count = queries.countNutrition.get().n;
  const ver = (version && String(version).trim()) || readVersionFile() || 'okänd';
  queries.setSetting.run('nutrition_dataset_version', ver);
  queries.setSetting.run('nutrition_imported_at', String(Date.now()));
  queries.setSetting.run('nutrition_item_count', String(count));
  return { count, version: ver, file: path.basename(file), unmatched };
}

function readVersionFile() {
  const p = path.join(NUTRITION_DIR, 'version.txt');
  try {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
  } catch {
    return null;
  }
}

export function nutritionMeta() {
  return {
    version: queries.getSetting.get('nutrition_dataset_version')?.value || '',
    importedAt: Number(queries.getSetting.get('nutrition_imported_at')?.value || 0) || null,
    count: Number(queries.getSetting.get('nutrition_item_count')?.value || 0) || 0,
  };
}
