import type { FieldKey, LabelData } from '../types';
import { collectAllergens, allergenLabels } from './allergens';

export type CheckStatus = 'ok' | 'missing' | 'advisory';
export interface CheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}
export interface CompletenessResult {
  mode: LabelData['packagingType'];
  required: CheckItem[]; // always-required (ok | missing)
  advisories: CheckItem[]; // conditional (soft "kontrollera")
  missingCount: number;
  allergens: string[]; // present allergen group labels
}

function fieldVisible(label: LabelData, key: FieldKey): boolean {
  return label.fields?.[key]?.visible ?? true;
}
function nonEmpty(v: unknown): boolean {
  return !!String(v ?? '').trim();
}
function present(label: LabelData, key: FieldKey, value: unknown): boolean {
  return fieldVisible(label, key) && nonEmpty(value);
}

/**
 * Mode-aware completeness guidance (NOT a compliance verdict). Branches on
 * packagingType. Reuses Phase A allergen detection for the emphasis cross-check.
 *
 * NOTE: the 'inte färdigförpackad' checklist follows Swedish national rules
 * (LIVSFS 2014:4) — kept deliberately minimal/conservative and should be
 * confirmed against the current regulation.
 */
export function checkCompleteness(label: LabelData): CompletenessResult {
  const mode = label.packagingType ?? 'inte färdigförpackad';
  const ings = label.ingredients ?? [];
  const ingredientsPresent = fieldVisible(label, 'ingredientsList') && ings.length > 0;

  const allergenCodes = collectAllergens(ings);
  const allergens = allergenLabels(allergenCodes);

  // Allergen-emphasis cross-check (both modes): allergens present but not framhävda?
  const sec = label.sections;
  const emphasisedInline =
    (sec?.allergenDisplay === 'inline' || sec?.allergenDisplay === 'both') &&
    sec?.allergenStyle !== 'normal';
  const declaredSeparately =
    (sec?.allergenDisplay === 'separate' || sec?.allergenDisplay === 'both') &&
    (label.fields?.allergenSeparate?.visible ?? true);
  const allergensHandled = allergenCodes.length === 0 || emphasisedInline || declaredSeparately;

  const required: CheckItem[] = [];
  const advisories: CheckItem[] = [];
  const req = (id: string, lbl: string, ok: boolean, detail?: string) =>
    required.push({ id, label: lbl, status: ok ? 'ok' : 'missing', detail: ok ? undefined : detail });
  const adv = (id: string, lbl: string, ok: boolean, detail: string) =>
    advisories.push({ id, label: lbl, status: ok ? 'ok' : 'advisory', detail });

  if (mode === 'färdigförpackad') {
    req('beteckning', 'Beteckning (produktnamn)', present(label, 'productName', label.productName));
    req('ingredienser', 'Ingrediensförteckning', ingredientsPresent);
    req(
      'allergen',
      'Allergener framhävda',
      allergensHandled,
      'Allergener finns men framhävs inte – använd VERSALER/fet eller en "Innehåller:"-rad.',
    );
    req('netto', 'Nettokvantitet', present(label, 'meta', label.weight), 'Ange nettokvantitet (t.ex. vikt).');
    req(
      'datum',
      'Datummärkning',
      (fieldVisible(label, 'bestBefore') && nonEmpty(label.bestBefore)) ||
        (fieldVisible(label, 'bakedDate') && nonEmpty(label.bakedDate)),
      'Ange bäst före-datum (eller sista förbrukningsdag).',
    );
    req(
      'kontakt',
      'Kontaktuppgift (namn + adress)',
      present(label, 'bakeryName', label.bakeryName) && nonEmpty(label.contactAddress),
      'Ange livsmedelsföretagarens namn och adress.',
    );
    req(
      'naring',
      'Näringsdeklaration',
      !!label.nutrition?.perHundred,
      'Näringsdeklaration saknas – generera den i näringssteget (premium).',
    );

    // Conditional — advise, never hard-flag.
    adv('forvaring', 'Förvaringsanvisning', present(label, 'storage', label.storage), 'Kontrollera om förvaringsanvisning behövs.');
    adv('ursprung', 'Ursprungsmärkning', false, 'Kontrollera om ursprung måste anges.');
    adv('quid', 'Mängdangivelse (QUID)', false, 'Kontrollera om procentuell mängdangivelse krävs.');
    adv('alkohol', 'Alkoholhalt', false, 'Kontrollera om alkoholhalt måste anges (drycker > 1,2 %).');
    adv('bruks', 'Bruksanvisning', false, 'Kontrollera om bruksanvisning behövs.');
  } else {
    // 'inte färdigförpackad' (LIVSFS 2014:4) — minimal & conservative.
    req('beteckning', 'Beteckning (produktnamn)', present(label, 'productName', label.productName));
    req(
      'allergen-info',
      'Allergeninformation',
      allergenCodes.length === 0 ? true : ingredientsPresent && allergensHandled,
      'Allergener finns – se till att de framgår tydligt (t.ex. i ingrediensförteckningen).',
    );
  }

  const missingCount = required.filter((i) => i.status === 'missing').length;
  return { mode, required, advisories, missingCount, allergens };
}
