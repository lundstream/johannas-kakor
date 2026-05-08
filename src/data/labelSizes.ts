import type { LabelSize } from '../types';

export const LABEL_SIZES: LabelSize[] = [
  { id: '62x29', label: '62 × 29 mm', widthMm: 62, heightMm: 29, description: 'Smal etikett – pris/datum' },
  { id: '62x40', label: '62 × 40 mm', widthMm: 62, heightMm: 40, description: 'Standard produktetikett' },
  { id: '89x36', label: '89 × 36 mm', widthMm: 89, heightMm: 36, description: 'Adress/standard' },
  { id: '102x59', label: '102 × 59 mm', widthMm: 102, heightMm: 59, description: 'Större produktetikett' },
  { id: '50x80', label: '50 × 80 mm', widthMm: 50, heightMm: 80, description: 'Smal hög etikett' },
  { id: '50x120', label: '50 × 120 mm', widthMm: 50, heightMm: 120, description: 'Lång etikett – ingredienser' },
  { id: '70x100', label: '70 × 100 mm', widthMm: 70, heightMm: 100, description: 'Bröd & limpor' },
  { id: '100x150', label: '100 × 150 mm', widthMm: 100, heightMm: 150, description: 'Stor etikett – fraktl./presentlådor' },
  { id: 'round-40', label: '⌀ 40 mm rund', widthMm: 40, heightMm: 40, shape: 'round', description: 'Liten rund – burklock' },
  { id: 'round-50', label: '⌀ 50 mm rund', widthMm: 50, heightMm: 50, shape: 'round', description: 'Standard rund – småkakor' },
  { id: 'round-60', label: '⌀ 60 mm rund', widthMm: 60, heightMm: 60, shape: 'round', description: 'Mellan rund – mufflock' },
  { id: 'round-80', label: '⌀ 80 mm rund', widthMm: 80, heightMm: 80, shape: 'round', description: 'Stor rund – tårtor' },
];
