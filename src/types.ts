/**
 * The 14 allergen groups in Annex II of EU reg 1169/2011 (exactly these — no more).
 * Order follows the regulation. Note: almond is part of NÖTTER (not its own group),
 * and crustaceans/molluscs are distinct groups (KRÄFTDJUR / BLÖTDJUR).
 */
export type AllergenCode =
  | 'GLUTEN'
  | 'KRÄFTDJUR'
  | 'ÄGG'
  | 'FISK'
  | 'JORDNÖTTER'
  | 'SOJA'
  | 'MJÖLK'
  | 'NÖTTER'
  | 'SELLERI'
  | 'SENAP'
  | 'SESAM'
  | 'SULFITER'
  | 'LUPIN'
  | 'BLÖTDJUR';

export interface Ingredient {
  id: string;
  name: string;
  /** Optional allergens this ingredient triggers. */
  allergens?: AllergenCode[];
  /** True if user-defined. */
  custom?: boolean;
}

export interface LabelSize {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  /** Visual shape: 'rect' (default) or 'round' (circular die-cut). */
  shape?: 'rect' | 'round';
  description?: string;
}

export type LayoutVariant = 'classic' | 'compact' | 'banner' | 'minimal';

export type FontFamily =
  | 'inter'
  | 'fraunces'
  | 'system'
  | 'mono'
  | 'georgia'
  | 'helvetica'
  | 'caveat';

/** Logical text elements that can be styled and toggled individually. */
export type FieldKey =
  | 'bakeryName'
  | 'productName'
  | 'productDescription'
  | 'meta'
  | 'ingredientsLabel'
  | 'ingredientsList'
  | 'allergenSeparate'
  | 'allergenHelper'
  | 'bakedDate'
  | 'bestBefore'
  | 'storage'
  | 'extraText';

export interface FieldStyle {
  /** If false, hide this element completely. */
  visible: boolean;
  /** Override font family (else inherits global typography.fontFamily). */
  fontFamily?: FontFamily;
  /** Explicit pt size; empty = auto (derived from base typography). */
  sizePt?: number;
  bold?: boolean;
  italic?: boolean;
}

export type AllergenStyle = 'caps' | 'bold' | 'caps-bold' | 'normal';

export type AllergenDisplay = 'inline' | 'separate' | 'both';

export interface TypographyConfig {
  fontFamily: FontFamily;
  /** Multiplier applied to all auto-calculated text sizes (0.6 – 1.6). */
  scale: number;
  /** Horizontal text alignment on the label. Defaults to left (or logo-derived for old labels). */
  align?: 'left' | 'center' | 'right';
  /** Optional explicit overrides in pt. Empty = use auto. */
  titlePt?: number;
  bodyPt?: number;
  metaPt?: number;
}

export interface SectionConfig {
  /** Show "Ingredienser:" on its own line above the list. */
  ingredientsLabelOwnRow: boolean;
  /** Custom text for the ingredients label (default: "Ingredienser"). */
  ingredientsLabelText: string;
  /** Render the ingredients label in bold. */
  ingredientsLabelBold: boolean;
  /** Show allergens as separate "Innehåller:" line. */
  allergenDisplay: AllergenDisplay;
  allergenStyle: AllergenStyle;
  /** Custom text for the separate allergen label (default: "Innehåller"). */
  allergenSeparateLabelText: string;
  /** Render the separate allergen label in bold. */
  allergenSeparateLabelBold: boolean;
  /** Extra blank line between sections. */
  sectionSpacingMm: number;
  /** Show the "Allergener i versaler"-helper text. */
  showAllergenHelper: boolean;
}

export interface QrConfig {
  enabled: boolean;
  type: 'url' | 'product' | 'ingredients' | 'text';
  value: string;
  sizeMm: number;
}

export interface BarcodeConfig {
  enabled: boolean;
  format: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC';
  value: string;
  heightMm: number;
}

export interface LogoConfig {
  dataUrl?: string;
  /** 0–100 % of label width */
  widthPercent: number;
  /**
   * 'top' = logo centered above all text on its own row.
   * 'top-left' / 'top-right' / 'top-center' = inline with title block.
   */
  position: 'top' | 'top-left' | 'top-right' | 'top-center';
  monochrome: boolean;
}

/** A sub-component of a compound recipe ingredient (one level; full recursive QUID is future work). */
export interface RecipeComponent {
  id: string;
  name: string;
  /** Mapped Phase A ingredient DB id, if matched. */
  ingredientId?: string;
  allergens?: AllergenCode[];
}

/** One row of a recipe: an ingredient (mapped or free text) + an entered quantity. */
export interface RecipeRow {
  id: string;
  name: string;
  /** Mapped Phase A ingredient DB id; absent = free text (no allergen data). */
  ingredientId?: string;
  allergens?: AllergenCode[];
  /** Entered amount, in `unit`. v1 supports exact mass units only (g, kg). */
  quantity: number;
  unit: 'g' | 'kg';
  /** Optional one-level breakdown into components (compound ingredient). */
  components?: RecipeComponent[];
}

export interface RecipeConfig {
  rows: RecipeRow[];
  /** Optional baked yield in grams; used to normalise nutrition per 100 g of finished product. */
  finishedWeightG?: number;
}

/** Mandatory 1169/2011 per-100g nutrition values (legal order). */
export interface NutritionValues {
  energiKj: number;
  energiKcal: number;
  fett: number;
  mattatFett: number;
  kolhydrat: number;
  sockerarter: number;
  protein: number;
  salt: number;
}

/** A computed nutrition declaration applied to a label (calculation from the recipe). */
export interface NutritionDeclaration {
  perHundred: NutritionValues;
  /** 'finished' = normalised against entered färdig vikt; 'raw' = against summed input weight (estimate). */
  basis: 'raw' | 'finished';
  totalWeightG: number;
  datasetVersion: string;
  /** True when some recipe ingredients lacked nutrition data (totals may be incomplete). */
  incomplete: boolean;
  unmappedCount: number;
  computedAt: number;
}

export interface LabelData {
  id: string;
  productName: string;
  productDescription: string;
  bakeryName: string;
  weight: string;
  price: string;
  bestBefore: string; // ISO yyyy-mm-dd or free text
  bakedDate: string; // ISO yyyy-mm-dd or free text
  storage: string;
  ingredients: Ingredient[];
  extraText: string;
  layout: LayoutVariant;
  size: LabelSize;
  typography: TypographyConfig;
  sections: SectionConfig;
  /** Per-field overrides (visibility + typography). */
  fields: Record<FieldKey, FieldStyle>;
  /** Order in which the (orderable) text blocks render on the label, top to bottom. */
  fieldOrder: FieldKey[];
  /** Optional recipe that auto-generates the ingredient declaration in descending weight order. */
  recipe: RecipeConfig;
  /** Drives the mode-aware completeness checker. Internal key; Swedish values. */
  packagingType: 'färdigförpackad' | 'inte färdigförpackad';
  /** Optional food business operator address (prepacked labelling needs name + address). */
  contactAddress?: string;
  /** Applied nutrition declaration (premium); presence makes the checker mark näringsdeklaration as present. */
  nutrition?: NutritionDeclaration;
  logo: LogoConfig;
  qr: QrConfig;
  barcode: BarcodeConfig;
  copies: number;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  data: LabelData;
  createdAt: number;
}
