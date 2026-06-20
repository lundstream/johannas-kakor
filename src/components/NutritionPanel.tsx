import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import type { NutritionDeclaration, RecipeConfig } from '../types';

interface Props {
  premium: boolean;
  recipe: RecipeConfig;
  nutrition?: NutritionDeclaration;
  onChangeFinishedWeight: (g: number | undefined) => void;
  onApply: (decl: NutritionDeclaration) => void;
  onClear: () => void;
}

function Table({ n }: { n: NutritionDeclaration }) {
  const v = n.perHundred;
  const row = (label: string, value: string, indent = false) => (
    <div className={`flex justify-between gap-3 ${indent ? 'pl-3 text-ink/70' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink/50">Per 100 g</div>
      {row('Energi', `${v.energiKj} kJ / ${v.energiKcal} kcal`)}
      {row('Fett', `${v.fett} g`)}
      {row('varav mättat fett', `${v.mattatFett} g`, true)}
      {row('Kolhydrat', `${v.kolhydrat} g`)}
      {row('varav sockerarter', `${v.sockerarter} g`, true)}
      {row('Protein', `${v.protein} g`)}
      {row('Salt', `${v.salt} g`)}
    </div>
  );
}

export function NutritionPanel({
  premium,
  recipe,
  nutrition,
  onChangeFinishedWeight,
  onApply,
  onClear,
}: Props) {
  const [meta, setMeta] = useState<{ version: string; count: number } | null>(null);
  const [result, setResult] = useState<NutritionDeclaration | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .get<{ version: string; count: number }>('/api/public/nutrition-meta')
      .then(setMeta)
      .catch(() => {});
  }, []);

  if (!premium) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-medium">Näringsdeklaration ingår i Premium.</p>
        <p className="mt-1 text-amber-800">
          Beräkna näringsvärden automatiskt från receptet (per 100 g) baserat på Livsmedelsverkets
          Livsmedelsdatabas.
        </p>
        <Link to="/login" className="btn btn-primary mt-2 text-xs">
          Uppgradera
        </Link>
      </div>
    );
  }

  const compute = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<{ declaration: NutritionDeclaration }>('/api/me/nutrition', {
        recipe,
        finishedWeightG: recipe.finishedWeightG,
      });
      setResult(r.declaration);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'error';
      const map: Record<string, string> = {
        no_dataset: 'Näringsdatabasen är inte importerad ännu.',
        no_data: 'Inga ingredienser kunde kopplas till näringsdata. Koppla livsmedelsnummer i admin.',
        invalid_recipe: 'Lägg till ingredienser med vikt i receptet först.',
        premium_required: 'Funktionen kräver Premium.',
      };
      setError(map[code] || `Något gick fel (${code}).`);
    } finally {
      setBusy(false);
    }
  };

  const shown = result ?? nutrition ?? null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-ink/50">
        Näringsvärdena är <strong>beräknade uppskattningar</strong> från receptet – hjälper dig, ingen
        garanti. Kontrollera mot analys vid behov.
      </p>

      <label className="flex flex-col gap-1">
        <span className="label">Färdig vikt efter bakning (g, valfritt)</span>
        <input
          type="number"
          min={0}
          step="any"
          className="input w-40"
          placeholder="t.ex. 850"
          value={recipe.finishedWeightG || ''}
          onChange={(e) =>
            onChangeFinishedWeight(e.target.value ? Number(e.target.value) : undefined)
          }
        />
      </label>

      <button type="button" className="btn btn-primary self-start text-sm" onClick={compute} disabled={busy}>
        {busy ? 'Beräknar…' : 'Beräkna näringsdeklaration'}
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {shown && (
        <div className="rounded-xl border border-line bg-cream/40 p-3">
          <Table n={shown} />

          {shown.basis === 'raw' && (
            <p className="mt-2 text-[11px] text-amber-700">
              Uppskattning baserad på rå invägning – ange färdig vikt för mer exakt värde.
            </p>
          )}
          {shown.incomplete && (
            <p className="mt-1 text-[11px] text-amber-700">
              {shown.unmappedCount} ingrediens(er) saknar näringsdata – deklarationen kan vara
              ofullständig.
            </p>
          )}
          <p className="mt-2 text-[10px] text-ink/45">
            Källa: Livsmedelsverkets Livsmedelsdatabas version {shown.datasetVersion || meta?.version || '—'}
          </p>

          {result && (
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-primary text-xs" onClick={() => onApply(result)}>
                Använd på etiketten
              </button>
              {nutrition && (
                <button type="button" className="btn btn-ghost text-xs" onClick={onClear}>
                  Ta bort från etiketten
                </button>
              )}
            </div>
          )}
          {!result && nutrition && (
            <button type="button" className="btn btn-ghost mt-3 text-xs" onClick={onClear}>
              Ta bort från etiketten
            </button>
          )}
        </div>
      )}

      {meta && meta.count === 0 && (
        <p className="text-[11px] text-amber-700">
          Näringsdatabasen är inte importerad ännu (admin).
        </p>
      )}
    </div>
  );
}
