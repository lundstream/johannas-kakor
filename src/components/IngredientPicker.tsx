import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Ingredient } from '../types';
import { searchIngredients } from '../data/ingredients';
import { detectAllergens } from '../data/allergens';

interface Props {
  customIngredients: Ingredient[];
  onAdd: (ingredient: Ingredient) => void;
  onCreateCustom: (ingredient: Ingredient) => void;
}

export function IngredientPicker({ customIngredients, onAdd, onCreateCustom }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const results = useMemo(
    () => searchIngredients(query, customIngredients),
    [query, customIngredients]
  );

  const trimmed = query.trim();
  const noExact = trimmed && !results.some((r) => r.name.toLowerCase() === trimmed.toLowerCase());

  const commit = (ing: Ingredient) => {
    onAdd({ ...ing, id: uuid() });
    setQuery('');
    setHighlight(0);
  };

  const addCustom = () => {
    if (!trimmed) return;
    const detected = detectAllergens(trimmed);
    const ing: Ingredient = {
      id: uuid(),
      name: trimmed,
      allergens: detected,
      custom: true,
    };
    onCreateCustom(ing);
    onAdd(ing);
    setQuery('');
  };

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="Sök eller skriv egen ingrediens…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[highlight]) commit(results[highlight]);
            else if (noExact) addCustom();
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && (results.length > 0 || noExact) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-line bg-white shadow-lg">
          {results.map((r, i) => (
            <button
              type="button"
              key={r.id}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(r);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                i === highlight ? 'bg-cream' : 'bg-white'
              }`}
            >
              <span className="truncate">{r.name}</span>
              <span className="flex items-center gap-1">
                {(r.allergens ?? []).map((a) => (
                  <span key={a} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                    {a}
                  </span>
                ))}
                {r.custom && <span className="text-[10px] text-ink/50">egen</span>}
              </span>
            </button>
          ))}
          {noExact && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addCustom();
              }}
              className="flex w-full items-center justify-between gap-2 border-t border-line px-3 py-2 text-left text-sm text-ink hover:bg-cream"
            >
              <span>+ Lägg till “{trimmed}” som egen ingrediens</span>
              <span className="text-[10px] text-ink/50">Enter</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
