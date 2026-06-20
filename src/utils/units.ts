/**
 * Deterministic quantity -> grams conversion for AI recipe import. The model only
 * extracts {name, quantity, unit}; ALL weight conversion happens here in code — never
 * model-guessed. Unknown densities / count weights return grams=null and are surfaced
 * for user confirmation (never silently guessed).
 */

const MASS_G: Record<string, number> = { g: 1, gram: 1, hg: 100, kg: 1000 };
const VOLUME_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000, liter: 1000,
  msk: 15, tsk: 5, krm: 1, kkp: 150, kryddmått: 1, matsked: 15, tesked: 5,
};

// Density (g per ml) for common bakery ingredients, matched by name token. Order
// matters — more specific groups first (florsocker before socker, liquids before mjöl).
const DENSITY: { kw: string[]; d: number }[] = [
  { kw: ['vatten', 'mjölk', 'grädde', 'filmjölk', 'kärnmjölk', 'crème', 'créme'], d: 1.0 },
  { kw: ['florsocker'], d: 0.5 },
  { kw: ['socker'], d: 0.85 }, // strösocker, råsocker, farinsocker …
  { kw: ['mjöl'], d: 0.6 }, // vetemjöl, rågmjöl, dinkelmjöl … (mjölk excluded: doesn't end in "mjöl")
  { kw: ['smör'], d: 0.95 },
  { kw: ['margarin'], d: 0.95 },
  { kw: ['olja'], d: 0.92 },
  { kw: ['sirap'], d: 1.4 },
  { kw: ['salt'], d: 1.2 },
  { kw: ['kakao'], d: 0.45 },
  // Seeds & kernels measured by volume (1 dl ≈ 55–60 g): pumpa-/solros-/sesam-/lin-/chiafrö …
  { kw: ['kärnor', 'kärna'], d: 0.55 }, // pumpakärnor, solroskärnor, sesamkärnor
  { kw: ['frö', 'frön'], d: 0.6 }, // sesamfrö, linfrö, chiafrö, vallmofrö, hampafrö
  // Rolled grains / flakes (light & fluffy): havregryn, rågflingor …
  { kw: ['gryn', 'flingor', 'flinga'], d: 0.4 },
];

// Per-piece weights for count items (st). Conservative; unknowns surfaced.
const COUNT_G: { kw: string[]; g: number }[] = [{ kw: ['ägg'], g: 50 }];

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-zåäö0-9 ]/g, ' ').trim();
const tokens = (s: string) => norm(s).split(/\s+/).filter(Boolean);

function matchKw(name: string, groups: { kw: string[] }[]): number {
  const ts = tokens(name);
  return groups.findIndex((g) =>
    g.kw.some((k) => ts.some((t) => t === k || (k.length >= 4 && t.endsWith(k)) || t.includes(k))),
  );
}

export interface GramsResult {
  grams: number | null;
  /** Swedish note when grams couldn't be determined (surface for confirmation). */
  note?: string;
}

export function convertToGrams(quantity: number, unit: string, name: string): GramsResult {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return { grams: null, note: 'ogiltig mängd' };
  const u = String(unit || '').toLowerCase().trim();

  if (u in MASS_G) return { grams: Math.round(q * MASS_G[u]) };

  if (u === '' || u === 'st' || u === 'styck' || u === 'stycken') {
    const i = matchKw(name, COUNT_G);
    if (i >= 0) return { grams: Math.round(q * COUNT_G[i].g) };
    return { grams: null, note: 'okänd styckvikt – ange gram' };
  }

  if (u in VOLUME_ML) {
    const ml = q * VOLUME_ML[u];
    const i = matchKw(name, DENSITY);
    if (i >= 0) return { grams: Math.round(ml * DENSITY[i].d) };
    return { grams: null, note: 'okänd densitet – ange gram' };
  }

  return { grams: null, note: 'okänd enhet – ange gram' };
}
