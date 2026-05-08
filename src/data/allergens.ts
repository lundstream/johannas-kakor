import type { AllergenCode } from '../types';

export const ALLERGENS: { code: AllergenCode; label: string; description: string }[] = [
  { code: 'GLUTEN', label: 'Gluten', description: 'Vete, råg, korn, havre m.fl.' },
  { code: 'MJÖLK', label: 'Mjölk', description: 'Inkl. laktos' },
  { code: 'ÄGG', label: 'Ägg', description: '' },
  { code: 'NÖTTER', label: 'Nötter', description: 'Hassel-, val-, cashew- m.fl.' },
  { code: 'MANDEL', label: 'Mandel', description: '' },
  { code: 'SOJA', label: 'Soja', description: '' },
  { code: 'SESAM', label: 'Sesam', description: '' },
  { code: 'JORDNÖTTER', label: 'Jordnötter', description: '' },
  { code: 'FISK', label: 'Fisk', description: '' },
  { code: 'SKALDJUR', label: 'Skaldjur', description: '' },
  { code: 'SELLERI', label: 'Selleri', description: '' },
  { code: 'SENAP', label: 'Senap', description: '' },
  { code: 'LUPIN', label: 'Lupin', description: '' },
  { code: 'SULFITER', label: 'Sulfiter', description: 'Svaveldioxid' },
];

export const ALLERGEN_CODES = ALLERGENS.map((a) => a.code);

/**
 * Returns a Set of allergen codes detected in a piece of text by scanning
 * for word stems. Case-insensitive, accent-aware (Swedish characters preserved).
 */
const STEM_MATCHERS: { code: AllergenCode; patterns: RegExp[] }[] = [
  {
    code: 'GLUTEN',
    patterns: [/\bgluten/i, /\bvete/i, /\bråg/i, /\bkorn/i, /\bspelt/i, /\bdinkel/i, /\bkamut/i, /\bsemolina/i, /\bdurum/i, /\bbulgur/i, /\bcouscous/i, /\bmannagryn/i],
  },
  { code: 'MJÖLK', patterns: [/\bmjölk/i, /\bgrädde/i, /\bsmör\b/i, /\bost\b/i, /\bvassle/i, /\byoghurt/i, /\bkefir/i, /\bkvarg/i, /\bkesella/i, /\bcrème\s*fra/i, /\bkondenserad/i, /\bmjölkpulver/i, /\bskummjölk/i, /\bfil\b/i, /\blaktos/i, /\bkasein/i] },
  { code: 'ÄGG', patterns: [/\bägg/i, /\bäggvita/i, /\bäggula/i, /\bäggpulver/i] },
  { code: 'MANDEL', patterns: [/\bmandel/i, /\bmandelmassa/i, /\bmarsipan/i] },
  { code: 'NÖTTER', patterns: [/\bnöt/i, /\bhasselnöt/i, /\bvalnöt/i, /\bcashew/i, /\bpekannöt/i, /\bparanöt/i, /\bmacadamia/i, /\bpistasch/i] },
  { code: 'SOJA', patterns: [/\bsoja/i, /\bsojasås/i, /\bedamame/i, /\btofu/i, /\bsojalecitin/i] },
  { code: 'SESAM', patterns: [/\bsesam/i, /\btahini/i] },
  { code: 'JORDNÖTTER', patterns: [/\bjordnöt/i] },
  { code: 'FISK', patterns: [/\bfisk/i, /\blax\b/i, /\btorsk/i, /\bsill/i, /\bansjovis/i, /\btonfisk/i, /\bmakrill/i] },
  { code: 'SKALDJUR', patterns: [/\bräka/i, /\bräkor/i, /\bkrabba/i, /\bhummer/i, /\bmussla/i, /\bostron/i, /\bbläckfisk/i, /\bskaldjur/i] },
  { code: 'SELLERI', patterns: [/\bselleri/i] },
  { code: 'SENAP', patterns: [/\bsenap/i] },
  { code: 'LUPIN', patterns: [/\blupin/i] },
  { code: 'SULFITER', patterns: [/\bsulfit/i, /\bsvaveldioxid/i, /\be22[0-8]/i] },
];

export function detectAllergens(text: string): AllergenCode[] {
  const found = new Set<AllergenCode>();
  for (const m of STEM_MATCHERS) {
    if (m.patterns.some((p) => p.test(text))) {
      found.add(m.code);
    }
  }
  return Array.from(found);
}
