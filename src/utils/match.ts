import type { Ingredient } from '../types';

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-zåäö0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Map a parsed (AI-extracted) ingredient name to a Phase A ingredient DB entry.
 * Deterministic, conservative (exact -> prefix -> contains). Returns null when no
 * confident match — caller surfaces it as "ingen allergendata", never auto-creates.
 */
export function matchIngredient(name: string, base: Ingredient[]): Ingredient | null {
  const n = norm(name);
  if (!n) return null;
  let m = base.find((b) => norm(b.name) === n);
  if (m) return m;
  m = base.find((b) => {
    const bn = norm(b.name);
    return bn.startsWith(n) || n.startsWith(bn);
  });
  if (m) return m;
  m = base.find((b) => {
    const bn = norm(b.name);
    return bn.includes(n) || n.includes(bn);
  });
  return m || null;
}
