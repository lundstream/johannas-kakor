import type { AllergenCode, Ingredient } from '../types';
import seedData from '../../ingredients.seed.json';

/**
 * Bundled fallback ingredient list. The server seeds its DB from the SAME
 * ingredients.seed.json, and the editor normally fetches the (admin-editable)
 * list from /api/public/ingredients (see useIngredients). This static copy is
 * only used when the API is unavailable (e.g. offline).
 */
const seeds = seedData as { name: string; allergens?: string[] }[];

export const INGREDIENT_DB: Ingredient[] = seeds.map((s, i) => ({
  id: `db-${i}`,
  name: s.name,
  allergens: (s.allergens ?? []) as AllergenCode[],
}));

export function searchIngredients(
  query: string,
  base: Ingredient[] = INGREDIENT_DB,
  custom: Ingredient[] = [],
): Ingredient[] {
  const q = query.trim().toLowerCase();
  const all = [...base, ...custom];
  if (!q) return all.slice(0, 40);
  const starts: Ingredient[] = [];
  const contains: Ingredient[] = [];
  for (const ing of all) {
    const n = ing.name.toLowerCase();
    if (n.startsWith(q)) starts.push(ing);
    else if (n.includes(q)) contains.push(ing);
  }
  return [...starts, ...contains].slice(0, 40);
}
