import type { Ingredient, AllergenCode } from '../types';
import { ALLERGEN_CODES, ALLERGENS, detectAllergens } from '../data/allergens';

export type AllergenStyle = 'caps' | 'bold' | 'caps-bold' | 'normal';

export interface IngredientToken {
  text: string;
  isAllergen: boolean;
}

/**
 * Plain-text declaration with allergens UPPERCASED inline.
 * Used for QR-code values etc.
 */
export function renderIngredientDeclaration(items: Ingredient[]): string {
  return items.map(formatIngredient).join(', ');
}

/**
 * Tokenized version that React can render with bold/caps styling per allergen segment.
 * The resulting array alternates allergen + non-allergen tokens for each ingredient.
 */
export function tokenizeIngredient(ing: Ingredient): IngredientToken[] {
  const tagged = new Set<AllergenCode>(ing.allergens ?? []);
  for (const c of detectAllergens(ing.name)) tagged.add(c);

  if (tagged.size === 0) return [{ text: ing.name, isAllergen: false }];

  // Build a single regex covering all stems for tagged allergens.
  const stems: string[] = [];
  for (const { code, stems: s } of STEMS) {
    if (tagged.has(code)) stems.push(...s);
  }
  if (stems.length === 0) return [{ text: ing.name, isAllergen: true }];

  const pattern = new RegExp(`(${stems.map(escapeRegex).join('|')})`, 'iu');
  const out: IngredientToken[] = [];
  let rest = ing.name;
  let safety = 0;
  while (rest.length > 0 && safety++ < 30) {
    const m = rest.match(pattern);
    if (!m || m.index === undefined) {
      out.push({ text: rest, isAllergen: false });
      break;
    }
    if (m.index > 0) out.push({ text: rest.slice(0, m.index), isAllergen: false });
    out.push({ text: m[0], isAllergen: true });
    rest = rest.slice(m.index + m[0].length);
  }
  // If nothing matched as allergen, mark whole thing as allergen.
  if (!out.some((t) => t.isAllergen)) return [{ text: ing.name, isAllergen: true }];
  return out;
}

const STEMS: { code: AllergenCode; stems: string[] }[] = [
  { code: 'GLUTEN', stems: ['gluten', 'vete', 'råg', 'korn', 'spelt', 'dinkel', 'durum', 'bulgur', 'mannagryn', 'havre'] },
  { code: 'MJÖLK', stems: ['mjölk', 'grädde', 'smör', 'ost', 'vassle', 'yoghurt', 'kvarg', 'fil', 'laktos', 'kasein'] },
  { code: 'KRÄFTDJUR', stems: ['räka', 'krabba', 'hummer', 'kräfta', 'langust'] },
  { code: 'ÄGG', stems: ['ägg'] },
  { code: 'FISK', stems: ['fisk', 'lax', 'torsk', 'sill', 'ansjovis', 'tonfisk', 'makrill'] },
  { code: 'JORDNÖTTER', stems: ['jordnöt'] },
  { code: 'SOJA', stems: ['soja', 'tofu', 'edamame'] },
  // NÖTTER includes almond/marzipan (Annex II group 8); emphasis uses the specific word.
  { code: 'NÖTTER', stems: ['mandel', 'marsipan', 'hasselnöt', 'valnöt', 'cashew', 'pekannöt', 'paranöt', 'pistasch', 'pistage', 'macadamia', 'makadamia', 'nöt'] },
  { code: 'SELLERI', stems: ['selleri'] },
  { code: 'SENAP', stems: ['senap'] },
  { code: 'SESAM', stems: ['sesam', 'tahini'] },
  { code: 'SULFITER', stems: ['sulfit', 'svaveldioxid'] },
  { code: 'LUPIN', stems: ['lupin'] },
  { code: 'BLÖTDJUR', stems: ['mussla', 'ostron', 'bläckfisk', 'snäck', 'pilgrimsmussla'] },
];

export function formatIngredient(ing: Ingredient): string {
  const tokens = tokenizeIngredient(ing);
  return tokens.map((t) => (t.isAllergen ? t.text.toLocaleUpperCase('sv-SE') : t.text)).join('');
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function collectAllergens(items: Ingredient[]): AllergenCode[] {
  const found = new Set<AllergenCode>();
  for (const i of items) {
    (i.allergens ?? []).forEach((c) => found.add(c));
    detectAllergens(i.name).forEach((c) => found.add(c));
  }
  return Array.from(found).sort(
    (a, b) => ALLERGEN_CODES.indexOf(a) - ALLERGEN_CODES.indexOf(b)
  );
}

export function allergenLabels(codes: AllergenCode[]): string[] {
  return codes.map((c) => ALLERGENS.find((a) => a.code === c)?.label ?? c);
}
