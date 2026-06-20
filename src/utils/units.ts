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
// matters — more specific groups first (florsocker before socker, powders before
// liquids, marzipan before nuts, flour after the liquids that contain "mjölk").
const DENSITY: { kw: string[]; d: number }[] = [
  // Powders (before liquids, so "*pulver" doesn't inherit a liquid density).
  { kw: ['mjölkpulver', 'skummjölkspulver', 'äggpulver', 'mandelmjöl', 'kokosmjöl'], d: 0.45 },
  // Thin liquids & fresh dairy (~water).
  { kw: ['vatten', 'mjölk', 'grädde', 'filmjölk', 'kärnmjölk', 'yoghurt', 'kvarg', 'vassle', 'kaffe', 'espresso'], d: 1.0 },
  { kw: ['creme', 'fraiche', 'färskost'], d: 1.0 }, // crème fraiche, färskost (è normaliseras till e)
  { kw: ['citronsaft', 'saft'], d: 1.0 },
  { kw: ['surdeg'], d: 1.0 },
  { kw: ['ost'], d: 0.4 }, // riven ost
  // Spirits & flavour extracts.
  { kw: ['rom', 'konjak', 'likör', 'sprit'], d: 0.95 },
  { kw: ['essens', 'essence', 'arom', 'extrakt'], d: 0.9 },
  // Sweeteners & syrups.
  { kw: ['honung'], d: 1.4 },
  { kw: ['sirap', 'glykos', 'melass'], d: 1.4 },
  { kw: ['florsocker'], d: 0.5 },
  { kw: ['socker'], d: 0.85 }, // strösocker, råsocker, farinsocker, vaniljsocker …
  { kw: ['fruktos', 'dextros'], d: 0.85 },
  // Fats.
  { kw: ['smör'], d: 0.95 },
  { kw: ['margarin'], d: 0.95 },
  { kw: ['olja'], d: 0.92 }, // rapsolja, olivolja, kokosolja …
  { kw: ['tahini'], d: 0.95 },
  // Almond paste / marzipan (dense) — before nuts so "mandel…" doesn't take the nut density.
  { kw: ['mandelmassa', 'marsipan', 'massa'], d: 1.0 },
  // Nuts.
  { kw: ['mandel', 'hasselnöt', 'valnöt', 'pekannöt', 'cashew', 'pistage', 'paranöt', 'jordnöt', 'nötter', 'nöt'], d: 0.55 },
  // Seeds & kernels (1 dl ≈ 55–60 g): pumpa-/solros-/sesam-/lin-/chiafrö …
  { kw: ['kärnor', 'kärna'], d: 0.55 },
  { kw: ['frö', 'frön'], d: 0.6 },
  // Dried fruit & berries.
  { kw: ['russin', 'sultan', 'korinter', 'aprikos', 'dadlar', 'dadel', 'fikon', 'tranbär', 'sukat'], d: 0.6 },
  { kw: ['blåbär', 'hallon', 'jordgubb', 'lingon', 'bär'], d: 0.6 },
  // Coconut (shredded, light).
  { kw: ['kokos'], d: 0.35 },
  // Flour family.
  { kw: ['mjöl'], d: 0.6 }, // vetemjöl, rågmjöl, dinkelmjöl … (mjölk handled above)
  { kw: ['rågsikt', 'sikt', 'durum', 'stärkelse', 'kli', 'groddar'], d: 0.5 },
  // Rolled grains / flakes / bran (light & fluffy).
  { kw: ['gryn', 'flingor', 'flinga'], d: 0.4 },
  { kw: ['kakao'], d: 0.45 },
  // Spices & zest (small amounts, tsk/krm).
  { kw: ['kardemumma', 'kanel', 'ingefära', 'muskot', 'nejlika', 'anis', 'fänkål', 'vanilj', 'skal', 'krydda'], d: 0.5 },
  // Leavening / raising agents.
  { kw: ['jäst', 'bakpulver', 'bikarbonat', 'hjorthorn', 'vinsten'], d: 0.8 },
  // Gelling & additives.
  { kw: ['pektin', 'agar', 'gelatin', 'lecitin', 'citronsyra'], d: 0.6 },
  // Salt (dense crystalline).
  { kw: ['salt'], d: 1.2 },
  // Egg by volume (whole egg ≈ 1.03; per-piece "st" handled in COUNT_G).
  { kw: ['ägg'], d: 1.03 },
];

// Per-piece weights for count items (st). Conservative; unknowns surfaced.
const COUNT_G: { kw: string[]; g: number }[] = [
  { kw: ['ägg'], g: 50 },
  { kw: ['äpple', 'päron'], g: 150 },
  { kw: ['banan'], g: 120 },
  { kw: ['apelsin'], g: 130 },
  { kw: ['citron'], g: 100 },
  { kw: ['vaniljstång', 'vaniljstang'], g: 3 },
];

// Lower-case + fold common Latin accents (é→e) so "crème" matches, while keeping å ä ö.
const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàâã]/g, 'a')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úùû]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[^a-zåäö0-9 ]/g, ' ')
    .trim();
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
