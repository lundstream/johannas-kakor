import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { ALLERGENS } from '../data/allergens';
import type { AllergenCode } from '../types';

interface Row {
  id: string;
  name: string;
  allergens: AllergenCode[];
}

/** Admin editor for the allergen tags on each base ingredient (the 14 Annex II groups). */
export function IngredientTagEditor() {
  const [items, setItems] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void api
      .get<{ ingredients: Row[] }>('/api/admin/ingredients')
      .then((r) => setItems(r.ingredients ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
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
      // revert on failure
      setItems((prev) => prev.map((i) => (i.id === row.id ? row : i)));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-ink/50">
        Klicka på en allergengrupp för att märka/avmarkera ingrediensen. Endast de 14 grupperna i
        bilaga II (1169/2011). Detta hjälper dig märka rätt – det är ingen garanti.
      </p>
      <input
        className="input"
        placeholder="Sök ingrediens…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!loaded ? (
        <div className="text-sm text-ink/50">Laddar…</div>
      ) : (
        <ul className="flex max-h-[480px] flex-col gap-2 overflow-auto">
          {filtered.map((row) => (
            <li key={row.id} className="rounded-xl border border-line p-2.5">
              <div className="mb-1.5 text-sm font-medium">{row.name}</div>
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
