import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { api, ApiError } from '../api';
import type { AllergenCode, Ingredient, RecipeRow } from '../types';
import { useIngredients } from '../hooks/useIngredients';
import { matchIngredient } from '../utils/match';
import { convertToGrams } from '../utils/units';

interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
  matched: Ingredient | null;
  allergens: AllergenCode[];
  grams: number | null;
  note?: string;
}

interface Props {
  customIngredients: Ingredient[];
  onApplyRows: (rows: RecipeRow[]) => void;
}

const BetaBadge = () => (
  <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-paper">
    Beta
  </span>
);

/** Capability 1: paste recipe -> server-side LLM extraction -> deterministic map/convert -> review -> apply. */
export function AiRecipeImport({ customIngredients, onApplyRows }: Props) {
  const base = useIngredients();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItem[] | null>(null);

  const parse = async () => {
    setError(null);
    setBusy(true);
    setItems(null);
    try {
      const r = await api.post<{ ingredients: { name: string; quantity: number; unit: string }[] }>(
        '/api/me/recipe-import',
        { text },
      );
      const list = base.concat(customIngredients);
      const parsed: ParsedItem[] = r.ingredients.map((i) => {
        const matched = matchIngredient(i.name, list);
        const conv = convertToGrams(i.quantity, i.unit, matched?.name ?? i.name);
        return {
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          matched,
          allergens: (matched?.allergens ?? []) as AllergenCode[],
          grams: conv.grams,
          note: conv.note,
        };
      });
      setItems(parsed);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'error';
      const map: Record<string, string> = {
        ai_unavailable: 'AI-ifyllnad är inte tillgänglig just nu – fyll i manuellt.',
        ai_failed: 'AI-tolkningen misslyckades – försök igen eller fyll i manuellt.',
        bad_output: 'Kunde inte tolka receptet – fyll i manuellt.',
        empty: 'Klistra in ett recept först.',
        premium_required: 'Funktionen kräver Premium.',
      };
      setError(map[code] || `Något gick fel (${code}).`);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!items) return;
    const rows: RecipeRow[] = items.map((it) => ({
      id: uuid(),
      name: it.matched?.name ?? it.name,
      ingredientId: it.matched?.id,
      allergens: it.allergens,
      quantity: it.grams ?? 0,
      unit: 'g',
    }));
    onApplyRows(rows);
    setItems(null);
    setText('');
  };

  return (
    <div className="rounded-xl border border-line bg-cream/40 p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold">AI-import av recept</span>
        <BetaBadge />
      </div>
      <p className="mb-2 text-[11px] text-ink/50">
        Klistra in ett recept så föreslår vi ingredienser och mängder. Granska alltid förslaget –
        ingen garanti. Texten bearbetas lokalt på egen hårdvara.
      </p>
      <textarea
        className="input min-h-[90px] resize-y"
        placeholder={'t.ex.\n6 dl vetemjöl\n150 g smör\n2 dl mjölk\n1 ägg'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={8000}
      />
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="btn btn-primary text-sm" onClick={parse} disabled={busy || !text.trim()}>
          {busy ? 'Tolkar…' : 'Tolka recept'}
        </button>
        {error && <span className="text-xs text-amber-700">{error}</span>}
      </div>

      {items && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink/45">
            Granska ({items.length})
          </div>
          <ul className="flex flex-col gap-1.5">
            {items.map((it, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm">
                <span className="font-medium">
                  {it.quantity} {it.unit} {it.name}
                </span>
                <span className="flex items-center gap-2 text-xs">
                  {it.matched ? (
                    <span className="text-ink/60">→ {it.matched.name}</span>
                  ) : (
                    <span className="text-amber-700">ingen allergendata</span>
                  )}
                  {it.allergens.map((a) => (
                    <span key={a} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                      {a}
                    </span>
                  ))}
                  {it.grams != null ? (
                    <span className="tabular-nums text-ink/70">{it.grams} g</span>
                  ) : (
                    <span className="text-amber-700">{it.note || 'okänd vikt'}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink/50">
            Poster utan känd vikt läggs in med 0 g – fyll i vikten i receptet nedan. Ordningen
            beräknas sedan efter vikt (utkast).
          </p>
          <button type="button" className="btn btn-primary self-start text-sm" onClick={apply}>
            Använd i receptet
          </button>
        </div>
      )}
    </div>
  );
}
