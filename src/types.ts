export type AllergenCode =
  | 'GLUTEN'
  | 'MJÖLK'
  | 'ÄGG'
  | 'NÖTTER'
  | 'MANDEL'
  | 'SOJA'
  | 'SESAM'
  | 'JORDNÖTTER'
  | 'FISK'
  | 'SKALDJUR'
  | 'SELLERI'
  | 'SENAP'
  | 'LUPIN'
  | 'SULFITER';

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
