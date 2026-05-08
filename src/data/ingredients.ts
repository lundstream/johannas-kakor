import type { Ingredient } from '../types';

/**
 * Curated Swedish bakery ingredient database. The `name` is the canonical
 * form shown to the user. Allergens are pre-tagged so detection is consistent.
 */
type Seed = Omit<Ingredient, 'id' | 'custom'>;

const seeds: Seed[] = [
  // Mjöl & spannmål
  { name: 'Vetemjöl', allergens: ['GLUTEN'] },
  { name: 'Vetemjöl special', allergens: ['GLUTEN'] },
  { name: 'Grahamsmjöl', allergens: ['GLUTEN'] },
  { name: 'Rågmjöl', allergens: ['GLUTEN'] },
  { name: 'Rågsikt', allergens: ['GLUTEN'] },
  { name: 'Havremjöl', allergens: ['GLUTEN'] },
  { name: 'Kornmjöl', allergens: ['GLUTEN'] },
  { name: 'Speltmjöl', allergens: ['GLUTEN'] },
  { name: 'Dinkelmjöl', allergens: ['GLUTEN'] },
  { name: 'Mannagryn', allergens: ['GLUTEN'] },
  { name: 'Durumvete', allergens: ['GLUTEN'] },
  { name: 'Havregryn', allergens: ['GLUTEN'] },
  { name: 'Rågflingor', allergens: ['GLUTEN'] },
  { name: 'Vetekli', allergens: ['GLUTEN'] },
  { name: 'Vetegroddar', allergens: ['GLUTEN'] },
  { name: 'Solrosfrön' },
  { name: 'Linfrön' },
  { name: 'Pumpakärnor' },
  { name: 'Chiafrön' },
  { name: 'Vallmofrön' },

  // Glutenfritt
  { name: 'Risflingor' },
  { name: 'Rismjöl' },
  { name: 'Majsmjöl' },
  { name: 'Majsstärkelse' },
  { name: 'Potatismjöl' },
  { name: 'Bovetemjöl' },
  { name: 'Mandelmjöl', allergens: ['MANDEL'] },
  { name: 'Kokosmjöl' },

  // Sötning
  { name: 'Socker' },
  { name: 'Strösocker' },
  { name: 'Florsocker' },
  { name: 'Råsocker' },
  { name: 'Farinsocker' },
  { name: 'Muscovadosocker' },
  { name: 'Sirap' },
  { name: 'Mörk sirap' },
  { name: 'Ljus sirap' },
  { name: 'Honung' },
  { name: 'Lönnsirap' },
  { name: 'Pärlsocker' },
  { name: 'Vaniljsocker' },
  { name: 'Vanilj' },
  { name: 'Vaniljstång' },
  { name: 'Glykos' },
  { name: 'Fruktos' },
  { name: 'Dextros' },

  // Mejeri
  { name: 'Smör', allergens: ['MJÖLK'] },
  { name: 'Osaltat smör', allergens: ['MJÖLK'] },
  { name: 'Margarin' },
  { name: 'Bagerimargarin' },
  { name: 'Mjölk', allergens: ['MJÖLK'] },
  { name: 'Standardmjölk', allergens: ['MJÖLK'] },
  { name: 'Lättmjölk', allergens: ['MJÖLK'] },
  { name: 'Mellanmjölk', allergens: ['MJÖLK'] },
  { name: 'Mjölkpulver', allergens: ['MJÖLK'] },
  { name: 'Skummjölkspulver', allergens: ['MJÖLK'] },
  { name: 'Grädde', allergens: ['MJÖLK'] },
  { name: 'Vispgrädde', allergens: ['MJÖLK'] },
  { name: 'Crème fraiche', allergens: ['MJÖLK'] },
  { name: 'Kvarg', allergens: ['MJÖLK'] },
  { name: 'Yoghurt', allergens: ['MJÖLK'] },
  { name: 'Filmjölk', allergens: ['MJÖLK'] },
  { name: 'Kondenserad mjölk', allergens: ['MJÖLK'] },
  { name: 'Färskost', allergens: ['MJÖLK'] },
  { name: 'Riven ost', allergens: ['MJÖLK'] },
  { name: 'Vassle', allergens: ['MJÖLK'] },

  // Ägg
  { name: 'Ägg', allergens: ['ÄGG'] },
  { name: 'Äggvita', allergens: ['ÄGG'] },
  { name: 'Äggula', allergens: ['ÄGG'] },
  { name: 'Äggpulver', allergens: ['ÄGG'] },

  // Jäsning & hjälpmedel
  { name: 'Jäst' },
  { name: 'Färsk jäst' },
  { name: 'Torrjäst' },
  { name: 'Bakpulver' },
  { name: 'Bikarbonat' },
  { name: 'Hjorthornssalt' },
  { name: 'Surdeg', allergens: ['GLUTEN'] },

  // Smaker & kryddor
  { name: 'Salt' },
  { name: 'Havssalt' },
  { name: 'Flingsalt' },
  { name: 'Kardemumma' },
  { name: 'Malen kardemumma' },
  { name: 'Kanel' },
  { name: 'Ingefära' },
  { name: 'Muskot' },
  { name: 'Nejlika' },
  { name: 'Anis' },
  { name: 'Fänkål' },
  { name: 'Pomeransskal' },
  { name: 'Citronskal' },
  { name: 'Apelsinskal' },
  { name: 'Citronsaft' },

  // Choklad & nötter
  { name: 'Kakao' },
  { name: 'Kakaopulver' },
  { name: 'Choklad', allergens: ['MJÖLK', 'SOJA'] },
  { name: 'Mörk choklad', allergens: ['SOJA'] },
  { name: 'Mjölkchoklad', allergens: ['MJÖLK', 'SOJA'] },
  { name: 'Vit choklad', allergens: ['MJÖLK', 'SOJA'] },
  { name: 'Chokladknappar', allergens: ['MJÖLK', 'SOJA'] },
  { name: 'Nougat', allergens: ['MJÖLK', 'NÖTTER'] },
  { name: 'Mandel', allergens: ['MANDEL'] },
  { name: 'Mandelmassa', allergens: ['MANDEL'] },
  { name: 'Marsipan', allergens: ['MANDEL'] },
  { name: 'Hasselnötter', allergens: ['NÖTTER'] },
  { name: 'Valnötter', allergens: ['NÖTTER'] },
  { name: 'Pekannötter', allergens: ['NÖTTER'] },
  { name: 'Cashewnötter', allergens: ['NÖTTER'] },
  { name: 'Pistagenötter', allergens: ['NÖTTER'] },
  { name: 'Paranötter', allergens: ['NÖTTER'] },
  { name: 'Kokosflingor' },
  { name: 'Kokos' },
  { name: 'Jordnötter', allergens: ['JORDNÖTTER'] },
  { name: 'Sesamfrön', allergens: ['SESAM'] },
  { name: 'Tahini', allergens: ['SESAM'] },

  // Frukt & bär
  { name: 'Russin' },
  { name: 'Sultanrussin' },
  { name: 'Korinter' },
  { name: 'Aprikoser' },
  { name: 'Dadlar' },
  { name: 'Fikon' },
  { name: 'Tranbär' },
  { name: 'Blåbär' },
  { name: 'Hallon' },
  { name: 'Jordgubbar' },
  { name: 'Lingon' },
  { name: 'Äpple' },
  { name: 'Päron' },
  { name: 'Banan' },
  { name: 'Citron' },
  { name: 'Apelsin' },
  { name: 'Sukat' },

  // Fett & oljor
  { name: 'Rapsolja' },
  { name: 'Olivolja' },
  { name: 'Solrosolja' },
  { name: 'Kokosolja' },

  // Tillsatser
  { name: 'Sojalecitin', allergens: ['SOJA'] },
  { name: 'Lecitin' },
  { name: 'Pektin' },
  { name: 'Agar-agar' },
  { name: 'Gelatin' },
  { name: 'Citronsyra' },
  { name: 'Vinsten' },

  // Vätskor & övrigt
  { name: 'Vatten' },
  { name: 'Kaffe' },
  { name: 'Espresso' },
  { name: 'Rom' },
  { name: 'Konjak' },
  { name: 'Mandelessens', allergens: ['MANDEL'] },
  { name: 'Vaniljessens' },
];

export const INGREDIENT_DB: Ingredient[] = seeds.map((s, i) => ({
  ...s,
  id: `db-${i}`,
}));

export function searchIngredients(query: string, custom: Ingredient[] = []): Ingredient[] {
  const q = query.trim().toLowerCase();
  const all = [...INGREDIENT_DB, ...custom];
  if (!q) return all.slice(0, 40);
  const starts: Ingredient[] = [];
  const contains: Ingredient[] = [];
  for (const ing of all) {
    const n = ing.name.toLowerCase();
    if (n.startsWith(q)) starts.push(ing);
    else if (n.includes(q)) contains.push(ing);
  }
  return [...starts, ...contains].slice(0, 40);
}
