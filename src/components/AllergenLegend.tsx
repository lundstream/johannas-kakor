import { ALLERGENS } from '../data/allergens';
import type { AllergenCode } from '../types';

interface Props {
  active: AllergenCode[];
}

export function AllergenLegend({ active }: Props) {
  if (active.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-cream/40 px-3 py-2 text-xs text-ink/60">
        Inga allergener upptäckta.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((code) => {
        const meta = ALLERGENS.find((a) => a.code === code);
        return (
          <span key={code} className="chip chip-allergen" title={meta?.description}>
            {code}
          </span>
        );
      })}
    </div>
  );
}
