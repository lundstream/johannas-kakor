import { useEffect, useState } from 'react';
import type { Ingredient } from '../types';
import { INGREDIENT_DB } from '../data/ingredients';
import { api } from '../api';

/**
 * Base ingredient list (with allergen tags) from the server DB, fetched once and
 * cached. Falls back to the bundled static list if the API is unavailable, so the
 * editor (incl. anonymous free mode) keeps working offline.
 */
let cache: Ingredient[] | null = null;

export function useIngredients(): Ingredient[] {
  const [list, setList] = useState<Ingredient[]>(cache ?? INGREDIENT_DB);
  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.get<{ ingredients: Ingredient[] }>('/api/public/ingredients');
        if (cancelled) return;
        if (Array.isArray(r?.ingredients) && r.ingredients.length > 0) {
          cache = r.ingredients;
          setList(r.ingredients);
        }
      } catch {
        /* keep the static fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return list;
}
