import type { AllergenCode } from '../types';

// The 14 Annex II groups (1169/2011), in regulation order, with Swedish display names.
export const ALLERGENS: { code: AllergenCode; label: string; description: string }[] = [
  { code: 'GLUTEN', label: 'Spannmål som innehåller gluten', description: 'Vete, råg, korn, havre, spelt/dinkel, khorasanvete' },
  { code: 'KRÄFTDJUR', label: 'Kräftdjur', description: 'Räka, krabba, hummer, kräfta m.fl.' },
  { code: 'ÄGG', label: 'Ägg', description: '' },
  { code: 'FISK', label: 'Fisk', description: '' },
  { code: 'JORDNÖTTER', label: 'Jordnötter', description: '' },
  { code: 'SOJA', label: 'Sojabönor', description: '' },
  { code: 'MJÖLK', label: 'Mjölk', description: 'Inkl. laktos' },
  { code: 'NÖTTER', label: 'Nötter', description: 'Mandel, hasselnöt, valnöt, cashew, pekan, para, pistasch, makadamia' },
  { code: 'SELLERI', label: 'Selleri', description: '' },
  { code: 'SENAP', label: 'Senap', description: '' },
  { code: 'SESAM', label: 'Sesamfrön', description: '' },
  { code: 'SULFITER', label: 'Svaveldioxid/sulfit', description: '' },
  { code: 'LUPIN', label: 'Lupin', description: '' },
  { code: 'BLÖTDJUR', label: 'Blötdjur', description: 'Mussla, ostron, bläckfisk m.fl.' },
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
  { code: 'KRÄFTDJUR', patterns: [/\bräka/i, /\bräkor/i, /\bkrabba/i, /\bhummer/i, /\bkräfta/i, /\bkräftdjur/i, /\blangust/i] },
  { code: 'ÄGG', patterns: [/\bägg/i, /\bäggvita/i, /\bäggula/i, /\bäggpulver/i] },
  { code: 'FISK', patterns: [/\bfisk/i, /\blax\b/i, /\btorsk/i, /\bsill/i, /\bansjovis/i, /\btonfisk/i, /\bmakrill/i] },
  { code: 'JORDNÖTTER', patterns: [/\bjordnöt/i] },
  { code: 'SOJA', patterns: [/\bsoja/i, /\bsojasås/i, /\bedamame/i, /\btofu/i, /\bsojalecitin/i] },
  { code: 'MJÖLK', patterns: [/\bmjölk/i, /\bgrädde/i, /\bsmör\b/i, /\bost\b/i, /\bvassle/i, /\byoghurt/i, /\bkefir/i, /\bkvarg/i, /\bkesella/i, /\bcrème\s*fra/i, /\bkondenserad/i, /\bmjölkpulver/i, /\bskummjölk/i, /\bfil\b/i, /\blaktos/i, /\bkasein/i] },
  // NÖTTER (Annex II group 8) includes almond/marzipan.
  { code: 'NÖTTER', patterns: [/\bnöt/i, /\bmandel/i, /\bmarsipan/i, /\bhasselnöt/i, /\bvalnöt/i, /\bcashew/i, /\bpekannöt/i, /\bparanöt/i, /\bmacadamia/i, /\bmakadamia/i, /\bpistasch/i, /\bpistage/i] },
  { code: 'SELLERI', patterns: [/\bselleri/i] },
  { code: 'SENAP', patterns: [/\bsenap/i] },
  { code: 'SESAM', patterns: [/\bsesam/i, /\btahini/i] },
  { code: 'SULFITER', patterns: [/\bsulfit/i, /\bsvaveldioxid/i, /\be22[0-8]/i] },
  { code: 'LUPIN', patterns: [/\blupin/i] },
  { code: 'BLÖTDJUR', patterns: [/\bmussla/i, /\bmusslor/i, /\bostron/i, /\bbläckfisk/i, /\bsnäck/i, /\bpilgrimsmussla/i, /\bblötdjur/i] },
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
