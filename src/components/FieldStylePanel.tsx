import type { FieldKey, FieldStyle, FontFamily } from '../types';

interface Props {
  fields: Record<FieldKey, FieldStyle>;
  onChange: (fields: Record<FieldKey, FieldStyle>) => void;
}

const FIELD_LABELS: { key: FieldKey; label: string; hint?: string }[] = [
  { key: 'bakeryName', label: 'Bageri / företag' },
  { key: 'productName', label: 'Produktnamn (titel)' },
  { key: 'productDescription', label: 'Produktbeskrivning' },
  { key: 'meta', label: 'Vikt & pris' },
  { key: 'ingredientsLabel', label: '"Ingredienser:"' },
  { key: 'ingredientsList', label: 'Ingredienslista' },
  { key: 'allergenSeparate', label: '"Innehåller: …"-rad' },
  { key: 'allergenHelper', label: 'Allergen-hjälptext' },
  { key: 'bakedDate', label: 'Bakat (datum)' },
  { key: 'bestBefore', label: 'Bäst före' },
  { key: 'storage', label: 'Förvaring' },
  { key: 'extraText', label: 'Övrig text' },
];

const FONTS: { value: '' | FontFamily; label: string }[] = [
  { value: '', label: 'Ärv (samma som global)' },
  { value: 'inter', label: 'Inter (sans)' },
  { value: 'fraunces', label: 'Fraunces (serif)' },
  { value: 'georgia', label: 'Georgia (serif)' },
  { value: 'helvetica', label: 'Helvetica (sans)' },
  { value: 'system', label: 'System UI' },
  { value: 'mono', label: 'JetBrains Mono' },
  { value: 'caveat', label: 'Caveat (handstil)' },
];

export function FieldStylePanel({ fields, onChange }: Props) {
  const update = (key: FieldKey, patch: Partial<FieldStyle>) => {
    onChange({ ...fields, [key]: { ...fields[key], ...patch } });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-ink/50">
        Styr varje fält individuellt: synlighet, typsnitt, storlek (pt), fet, kursiv. Lämna pt-fält
        tomt för automatisk storlek.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-ink/50">
            <tr className="text-left">
              <th className="pb-1.5 pr-2 font-medium">Fält</th>
              <th className="pb-1.5 pr-2 font-medium">Synlig</th>
              <th className="pb-1.5 pr-2 font-medium">Typsnitt</th>
              <th className="pb-1.5 pr-2 font-medium">pt</th>
              <th className="pb-1.5 pr-2 font-medium">Fet</th>
              <th className="pb-1.5 pr-2 font-medium">Kursiv</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_LABELS.map(({ key, label }) => {
              const f = fields[key] ?? { visible: true };
              return (
                <tr key={key} className="border-t border-line/70 align-middle">
                  <td className="py-1.5 pr-2">{label}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="checkbox"
                      checked={f.visible}
                      onChange={(e) => update(key, { visible: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      className="select py-1 text-xs"
                      value={f.fontFamily ?? ''}
                      onChange={(e) =>
                        update(key, {
                          fontFamily: e.target.value === '' ? undefined : (e.target.value as FontFamily),
                        })
                      }
                    >
                      {FONTS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min={3}
                      max={48}
                      step={0.5}
                      className="input w-16 py-1 text-xs"
                      placeholder="auto"
                      value={f.sizePt ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        update(key, { sizePt: v === '' ? undefined : Number(v) });
                      }}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="checkbox"
                      checked={!!f.bold}
                      onChange={(e) => update(key, { bold: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="checkbox"
                      checked={!!f.italic}
                      onChange={(e) => update(key, { italic: e.target.checked })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
