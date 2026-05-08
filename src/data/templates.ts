import { v4 as uuid } from 'uuid';
import type { FieldKey, FieldStyle, LabelData, Template } from '../types';
import { INGREDIENT_DB } from './ingredients';
import { LABEL_SIZES } from './labelSizes';

const find = (name: string) =>
  INGREDIENT_DB.find((i) => i.name.toLowerCase() === name.toLowerCase());

const ings = (...names: string[]) =>
  names.map((n) => find(n)!).filter(Boolean).map((i) => ({ ...i, id: uuid() }));

export function defaultFieldStyles(): Record<FieldKey, FieldStyle> {
  const v: FieldStyle = { visible: true };
  return {
    bakeryName: v,
    productName: v,
    productDescription: v,
    meta: v,
    ingredientsLabel: v,
    ingredientsList: v,
    allergenSeparate: v,
    allergenHelper: v,
    bakedDate: v,
    bestBefore: v,
    storage: v,
    extraText: v,
  };
}

export function createBlankLabel(): LabelData {
  return {
    id: uuid(),
    productName: 'Kanelbulle',
    productDescription: '',
    bakeryName: 'Ditt Bageri',
    weight: '85 g',
    price: '25 kr',
    bestBefore: '',
    bakedDate: '',
    storage: 'Förvaras torrt och svalt.',
    ingredients: ings('Vetemjöl', 'Vatten', 'Mjölk', 'Smör', 'Socker', 'Ägg', 'Jäst', 'Kardemumma', 'Kanel', 'Salt'),
    extraText: 'Bakat med kärlek..',
    layout: 'classic',
    size: LABEL_SIZES[3], // 102x59
    typography: {
      fontFamily: 'inter',
      scale: 1,
    },
    sections: {
      ingredientsLabelOwnRow: false,
      ingredientsLabelText: 'Ingredienser',
      ingredientsLabelBold: true,
      allergenDisplay: 'inline',
      allergenStyle: 'caps',
      allergenSeparateLabelText: 'Innehåller',
      allergenSeparateLabelBold: true,
      sectionSpacingMm: 0,
      showAllergenHelper: false,
    },
    fields: defaultFieldStyles(),
    logo: { widthPercent: 30, position: 'top-left', monochrome: true },
    qr: { enabled: false, type: 'url', value: 'https://johannaskakor.se', sizeMm: 18 },
    barcode: { enabled: false, format: 'CODE128', value: '7350001234567', heightMm: 10 },
    copies: 1,
    updatedAt: Date.now(),
  };
}

export const PRESET_TEMPLATES: Template[] = [
  {
    id: 'tpl-kanelbulle',
    name: 'Kanelbulle (klassisk)',
    createdAt: Date.now(),
    data: createBlankLabel(),
  },
  {
    id: 'tpl-kardemummabulle',
    name: 'Kardemummabulle',
    createdAt: Date.now(),
    data: {
      ...createBlankLabel(),
      productName: 'Kardemummabulle',
      ingredients: ings('Vetemjöl', 'Mjölk', 'Smör', 'Socker', 'Ägg', 'Jäst', 'Kardemumma', 'Pärlsocker', 'Salt'),
    },
  },
  {
    id: 'tpl-mandelkubb',
    name: 'Mandelkubb',
    createdAt: Date.now(),
    data: {
      ...createBlankLabel(),
      productName: 'Mandelkubb',
      weight: '120 g',
      price: '35 kr',
      ingredients: ings('Mandelmassa', 'Socker', 'Ägg', 'Vetemjöl', 'Smör', 'Vaniljsocker'),
      size: LABEL_SIZES[5], // 50x120
    },
  },
  {
    id: 'tpl-rågbröd',
    name: 'Rågbröd',
    createdAt: Date.now(),
    data: {
      ...createBlankLabel(),
      productName: 'Rågbröd',
      weight: '750 g',
      price: '59 kr',
      storage: 'Förvaras vid rumstemperatur. Tål frysning.',
      ingredients: ings('Rågmjöl', 'Vetemjöl', 'Vatten', 'Surdeg', 'Sirap', 'Salt', 'Jäst'),
      size: LABEL_SIZES[6], // 70x100
      barcode: { enabled: true, format: 'CODE128', value: '7350001230011', heightMm: 10 },
    },
  },
];
