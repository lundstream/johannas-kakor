import { v4 as uuid } from 'uuid';
import type { AllergenCode, Ingredient, RecipeConfig, RecipeRow } from '../types';

/**
 * Convert an entered quantity to grams. v1 supports exact mass units only
 * (g, kg) — no density/volume guessing (volume + count units are Phase E).
 * Returns null when the weight can't be determined (invalid/zero amount).
 */
export function rowGrams(row: RecipeRow): number | null {
  const q = Number(row.quantity);
  if (!Number.isFinite(q) || q <= 0) return null;
  if (row.unit === 'kg') return q * 1000;
  if (row.unit === 'g') return q;
  return null;
}

export interface GeneratedDeclaration {
  /** Ingredients sorted DESCENDING by entered weight, ready for Phase A emphasis. */
  ingredients: Ingredient[];
  /** Free-text rows without allergen data (surface as "ingen allergendata"). */
  unmapped: string[];
  /** Rows lacking a usable weight (excluded from the order). */
  missingWeight: string[];
}

function rowHasName(r: RecipeRow): boolean {
  return !!(r.name && r.name.trim()) || !!(r.components && r.components.length);
}

/**
 * Build the legal ingredient declaration from a recipe, sorted DESCENDING BY
 * WEIGHT (mängdordning). Weight basis = INPUT weight as entered; baking
 * evaporation is NOT modelled. The sort is deterministic: equal weights fall back
 * to the row's insertion order (explicit tiebreaker), so the same recipe always
 * renders the identical list. Allergens come from Phase A mapped tags.
 */
export function generateDeclaration(recipe: RecipeConfig | undefined): GeneratedDeclaration {
  const rows = (recipe?.rows ?? []).filter(rowHasName);
  const indexed = rows.map((r, i) => ({ r, i, g: rowGrams(r) }));

  const missingWeight = indexed.filter((x) => x.g === null).map((x) => x.r.name.trim()).filter(Boolean);

  const weighed = indexed.filter((x) => x.g !== null) as { r: RecipeRow; i: number; g: number }[];
  // Descending by weight; explicit deterministic tiebreaker = insertion order.
  weighed.sort((a, b) => b.g - a.g || a.i - b.i);

  const unmapped: string[] = [];
  const ingredients: Ingredient[] = weighed.map(({ r }) => {
    const allergens = new Set<AllergenCode>(r.allergens ?? []);
    let name = r.name.trim();

    const comps = (r.components ?? []).filter((c) => c.name && c.name.trim());
    if (comps.length > 0) {
      for (const c of comps) (c.allergens ?? []).forEach((a) => allergens.add(a));
      name = `${name} (${comps.map((c) => c.name.trim()).join(', ')})`;
    }

    const mapped = !!r.ingredientId || comps.some((c) => c.ingredientId);
    if (!mapped) unmapped.push(r.name.trim());

    return { id: uuid(), name, allergens: Array.from(allergens) };
  });

  return { ingredients, unmapped, missingWeight };
}
