import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import db, { queries } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');
/** Directory the operator drops the Livsmedelsdatabas export into (XLSX, CSV or JSON). */
export const NUTRITION_DIR =
  process.env.NUTRITION_DIR || path.join(path.dirname(DB_PATH), 'livsmedelsdatabasen');

// Target column -> accepted source header synonyms (normalised, incl. the real
// Livsmedelsdatabasen headers). See README for the expected format.
const SYNONYMS = {
  livsmedelsnummer: ['livsmedelsnummer', 'nummer', 'livsmedelsnr', 'number'],
  namn: ['livsmedelsnamn', 'namn', 'livsmedel', 'name'],
  energi_kcal: ['energi (kcal)', 'energi_kcal', 'energi, kcal', 'energi kcal'],
  energi_kj: ['energi (kj)', 'energi_kj', 'energi, kj', 'energi kj'],
  fett: ['fett, totalt (g)', 'fett', 'fett (g)', 'fett, totalt', 'summa fett'],
  mattat_fett: ['summa mättade fettsyror (g)', 'mattat_fett', 'mättat fett', 'summa mättade fettsyror', 'fett, mättat', 'mättade fettsyror'],
  kolhydrat: ['kolhydrater, tillgängliga (g)', 'kolhydrat', 'kolhydrater', 'kolhydrater, tillgängliga', 'tillgängliga kolhydrater', 'kolhydrater (g)'],
  sockerarter: ['sockerarter, totalt (g)', 'sockerarter', 'socker', 'summa sockerarter', 'sockerarter (g)', 'sockerarter, totalt'],
  protein: ['protein (g)', 'protein'],
  salt: ['salt, nacl (g)', 'salt (g)', 'salt'],
};
const NUMERIC = ['energi_kcal', 'energi_kj', 'fett', 'mattat_fett', 'kolhydrat', 'sockerarter', 'protein', 'salt'];

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const stripUnit = (s) => norm(s).replace(/\s*\([^)]*\)\s*$/, '').trim();

function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  if (s.includes(',') && !s.includes('.')) s = s.replace(/\s/g, '').replace(',', '.');
  else s = s.replace(/\s/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Minimal CSV -> array-of-arrays (delimiter ';' or ',', quoted fields). */
function parseCSVRows(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const delim = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let field = '', row = [], inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQ) {
      if (c === '"') { if (clean[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const isNummerHeader = (c) => SYNONYMS.livsmedelsnummer.includes(norm(c)) || SYNONYMS.livsmedelsnummer.includes(stripUnit(c));
const isNamnHeader = (c) => SYNONYMS.namn.includes(norm(c)) || SYNONYMS.namn.includes(stripUnit(c));

/** From a 2D grid, find the header row (has nummer + namn), the version (title rows), and records. */
function gridToRecords(rows) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i] || [];
    if (cells.some(isNummerHeader) && cells.some(isNamnHeader)) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('missing_key_columns');
  // Version from any title row above the header (e.g. "...version 2025-10-29").
  let version = null;
  for (let i = 0; i < headerIdx; i++) {
    const m = (rows[i] || []).join(' ').match(/version\s+(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\S+)/i);
    if (m) { version = m[1]; break; }
  }
  const headers = (rows[headerIdx] || []).map((h) => String(h ?? '').trim());
  const records = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r.some((c) => String(c ?? '').trim() !== '')) continue;
    const o = {};
    headers.forEach((h, j) => { o[h] = r[j]; });
    records.push(o);
  }
  return { records, version };
}

function buildColumnMap(headerKeys) {
  const lookup = new Map();
  for (const k of headerKeys) {
    lookup.set(norm(k), k);
    lookup.set(stripUnit(k), k);
  }
  const map = {};
  const unmatched = [];
  for (const [target, syns] of Object.entries(SYNONYMS)) {
    const hit = syns.find((s) => lookup.has(s));
    if (hit) map[target] = lookup.get(hit);
    else unmatched.push(target);
  }
  return { map, unmatched };
}

function findFile(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(xlsx|json|csv)$/i.test(f))
    .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m); // newest first (supports drop-in re-import)
  return files.length ? path.join(dir, files[0].f) : null;
}

function readSource(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) throw new Error('empty_file');
    return { records: data, version: null };
  }
  if (ext === '.csv') return gridToRecords(parseCSVRows(fs.readFileSync(file, 'utf8')));
  if (ext === '.xlsx') {
    const wb = XLSX.readFile(file, { cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false });
    return gridToRecords(rows);
  }
  throw new Error('unsupported_format');
}

/**
 * Import the Livsmedelsdatabas export from NUTRITION_DIR into nutrition_items.
 * Full refresh (clear + insert), version-stamped. Source values stored as-imported
 * (CC BY 4.0 — never altered). Returns { count, version, file, unmatched }.
 */
export function importNutrition({ version } = {}) {
  const file = findFile(NUTRITION_DIR);
  if (!file) throw new Error('no_file');
  const { records, version: detectedVersion } = readSource(file);
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
  const ver = (version && String(version).trim()) || readVersionFile() || detectedVersion || 'okänd';
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
