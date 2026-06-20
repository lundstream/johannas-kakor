import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { ALLERGENS } from '../data/allergens';
import type { AllergenCode } from '../types';

interface Row {
  id: string;
  name: string;
  allergens: AllergenCode[];
  livsmedelsnummer: string | null;
}

interface Meta {
  version: string;
  count: number;
  importedAt: number | null;
}

/** Admin editor: allergen tags + Livsmedelsverket mapping per ingredient, and dataset import. */
export function IngredientTagEditor() {
  const [items, setItems] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [version, setVersion] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const loadMeta = () =>
    api.get<Meta>('/api/admin/nutrition/meta').then(setMeta).catch(() => {});

  useEffect(() => {
    void api
      .get<{ ingredients: Row[] }>('/api/admin/ingredients')
      .then((r) => setItems(r.ingredients ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
    void loadMeta();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? items.filter((i) => i.name.toLowerCase().includes(needle)) : items;
    return list.slice(0, 60);
  }, [items, q]);

  const toggle = async (row: Row, code: AllergenCode) => {
    const next = row.allergens.includes(code)
      ? row.allergens.filter((c) => c !== code)
      : [...row.allergens, code];
    setItems((prev) => prev.map((i) => (i.id === row.id ? { ...i, allergens: next } : i)));
    try {
      await api.put(`/api/admin/ingredients/${row.id}/allergens`, { allergens: next });
    } catch {
      setItems((prev) => prev.map((i) => (i.id === row.id ? row : i)));
    }
  };

  const saveNumber = async (row: Row, value: string) => {
    const v = value.trim();
    setItems((prev) => prev.map((i) => (i.id === row.id ? { ...i, livsmedelsnummer: v || null } : i)));
    try {
      await api.put(`/api/admin/ingredients/${row.id}/livsmedelsnummer`, { livsmedelsnummer: v });
    } catch {
      /* ignore */
    }
  };

  const runImport = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const r = await api.post<{ count: number; version: string }>('/api/admin/nutrition/import', {
        version: version.trim() || undefined,
      });
      setImportMsg(`Importerade ${r.count} livsmedel (version ${r.version}).`);
      await loadMeta();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'error';
      const map: Record<string, string> = {
        no_file: 'Ingen fil hittades i data/livsmedelsdatabasen/ (lägg en CSV/JSON där).',
        empty_file: 'Filen är tom.',
        missing_key_columns: 'Filen saknar kolumnerna livsmedelsnummer/namn.',
      };
      setImportMsg(map[code] || `Importen misslyckades (${code}).`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Nutrition dataset import */}
      <div className="rounded-xl border border-line bg-cream/40 p-3 text-sm">
        <div className="mb-2 font-semibold">Näringsdatabas (Livsmedelsverket)</div>
        <p className="mb-2 text-xs text-ink/60">
          {meta && meta.count > 0
            ? `Version ${meta.version} · ${meta.count} livsmedel${
                meta.importedAt ? ` · importerad ${new Date(meta.importedAt).toLocaleDateString('sv-SE')}` : ''
              }`
            : 'Ingen databas importerad. Lägg en CSV/JSON-export i data/livsmedelsdatabasen/ och importera.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-48"
            placeholder="Version (t.ex. 2024-01)"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <button type="button" className="btn btn-primary text-xs" onClick={runImport} disabled={importing}>
            {importing ? 'Importerar…' : 'Importera / uppdatera'}
          </button>
        </div>
        {importMsg && <div className="mt-2 text-xs text-ink/70">{importMsg}</div>}
      </div>

      <p className="text-[11px] text-ink/50">
        Märk allergengrupper (bilaga II) och koppla livsmedelsnummer för näringsberäkning. Hjälper
        dig märka rätt – ingen garanti.
      </p>
      <input className="input" placeholder="Sök ingrediens…" value={q} onChange={(e) => setQ(e.target.value)} />

      {!loaded ? (
        <div className="text-sm text-ink/50">Laddar…</div>
      ) : (
        <ul className="flex max-h-[480px] flex-col gap-2 overflow-auto">
          {filtered.map((row) => (
            <li key={row.id} className="rounded-xl border border-line p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{row.name}</span>
                <input
                  className="input w-32 py-1 text-xs"
                  placeholder="Livsmedelsnr"
                  defaultValue={row.livsmedelsnummer ?? ''}
                  onBlur={(e) => saveNumber(row, e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {ALLERGENS.map((a) => {
                  const active = row.allergens.includes(a.code);
                  return (
                    <button
                      key={a.code}
                      type="button"
                      onClick={() => toggle(row, a.code)}
                      title={a.label}
                      className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                        active
                          ? 'border-amber-300 bg-amber-100 font-semibold text-amber-900'
                          : 'border-line bg-white text-ink/50 hover:text-ink'
                      }`}
                    >
                      {a.code}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="text-sm text-ink/50">Inga träffar.</li>}
        </ul>
      )}
    </div>
  );
}
