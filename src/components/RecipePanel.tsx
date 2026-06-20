import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { AllergenCode, Ingredient, RecipeComponent, RecipeConfig, RecipeRow } from '../types';
import { searchIngredients } from '../data/ingredients';
import { useIngredients } from '../hooks/useIngredients';
import { tokenizeIngredient } from '../utils/allergens';
import { generateDeclaration } from '../utils/recipe';
import { AiRecipeImport } from './AiRecipeImport';

interface Props {
  recipe: RecipeConfig;
  onChange: (recipe: RecipeConfig) => void;
  customIngredients: Ingredient[];
  /** Apply the generated declaration as the label's ingredient list. */
  onApply: (ingredients: Ingredient[]) => void;
  /** Premium tenants get the BETA AI recipe import. */
  premium?: boolean;
}

/** Renders an ingredient name with the specific allergen words in VERSALER (Phase A). */
function Emphasis({ name, allergens }: { name: string; allergens?: AllergenCode[] }) {
  const tokens = tokenizeIngredient({ id: 'x', name, allergens });
  return (
    <>
      {tokens.map((t, i) =>
        t.isAllergen ? (
          <span key={i} className="font-semibold">
            {t.text.toLocaleUpperCase('sv-SE')}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
    </>
  );
}

/** Inline ingredient autocomplete that maps to the Phase A DB (or leaves free text). */
function IngredientField({
  value,
  ingredientId,
  customIngredients,
  placeholder,
  onPick,
  onFreeText,
}: {
  value: string;
  ingredientId?: string;
  customIngredients: Ingredient[];
  placeholder: string;
  onPick: (ing: Ingredient) => void;
  onFreeText: (name: string) => void;
}) {
  const base = useIngredients();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value);
  const results = useMemo(
    () => (open && q.trim() ? searchIngredients(q, base, customIngredients).slice(0, 8) : []),
    [open, q, base, customIngredients],
  );
  return (
    <div className="relative">
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          onFreeText(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {!ingredientId && value.trim() && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-700">
          ingen allergendata
        </span>
      )}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-line bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQ(r.name);
                setOpen(false);
                onPick(r);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-cream"
            >
              <span className="truncate">{r.name}</span>
              <span className="flex gap-1">
                {(r.allergens ?? []).map((a) => (
                  <span key={a} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                    {a}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecipePanel({ recipe, onChange, customIngredients, onApply, premium }: Props) {
  const rows = recipe.rows ?? [];
  const setRows = (next: RecipeRow[]) => onChange({ ...recipe, rows: next });
  const patchRow = (id: string, patch: Partial<RecipeRow>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows([...rows, { id: uuid(), name: '', quantity: 0, unit: 'g' }]);
  const removeRow = (id: string) => setRows(rows.filter((r) => r.id !== id));

  const addComponent = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    patchRow(rowId, { components: [...(row.components ?? []), { id: uuid(), name: '' }] });
  };
  const patchComponent = (rowId: string, compId: string, patch: Partial<RecipeComponent>) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    patchRow(rowId, {
      components: (row.components ?? []).map((c) => (c.id === compId ? { ...c, ...patch } : c)),
    });
  };
  const removeComponent = (rowId: string, compId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    patchRow(rowId, { components: (row.components ?? []).filter((c) => c.id !== compId) });
  };

  const generated = useMemo(() => generateDeclaration(recipe), [recipe]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-ink/50">
        Ange ingredienser med vikt så skapas ingrediensförteckningen automatiskt i mängdordning
        (fallande efter vikt). Hjälper dig – ingen garanti, granska alltid resultatet.
      </p>

      {premium && (
        <AiRecipeImport
          customIngredients={customIngredients}
          onApplyRows={(rows) => onChange({ ...recipe, rows })}
        />
      )}

      {/* Rows */}
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-line p-3">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-start gap-2">
              <IngredientField
                value={row.name}
                ingredientId={row.ingredientId}
                customIngredients={customIngredients}
                placeholder="Ingrediens"
                onPick={(ing) =>
                  patchRow(row.id, { name: ing.name, ingredientId: ing.id, allergens: ing.allergens ?? [] })
                }
                onFreeText={(name) => patchRow(row.id, { name, ingredientId: undefined, allergens: [] })}
              />
              <input
                type="number"
                min={0}
                step="any"
                className="input w-24"
                placeholder="Mängd"
                value={row.quantity || ''}
                onChange={(e) => patchRow(row.id, { quantity: Number(e.target.value) })}
              />
              <select
                className="select w-20"
                value={row.unit}
                onChange={(e) => patchRow(row.id, { unit: e.target.value as 'g' | 'kg' })}
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="rounded-full p-2 text-ink/40 hover:bg-red-50 hover:text-red-700"
                aria-label="Ta bort"
                title="Ta bort"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Compound components (one level) */}
            {(row.components ?? []).length > 0 && (
              <div className="mt-2 flex flex-col gap-2 border-l-2 border-line pl-3">
                {(row.components ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <IngredientField
                        value={c.name}
                        ingredientId={c.ingredientId}
                        customIngredients={customIngredients}
                        placeholder="Delingrediens"
                        onPick={(ing) =>
                          patchComponent(row.id, c.id, { name: ing.name, ingredientId: ing.id, allergens: ing.allergens ?? [] })
                        }
                        onFreeText={(name) => patchComponent(row.id, c.id, { name, ingredientId: undefined, allergens: [] })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeComponent(row.id, c.id)}
                      className="rounded-full p-1.5 text-ink/40 hover:bg-red-50 hover:text-red-700"
                      aria-label="Ta bort delingrediens"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => addComponent(row.id)}
              className="mt-2 text-[11px] text-ink/50 underline-offset-2 hover:text-ink hover:underline"
            >
              + Dela upp i delingredienser (sammansatt)
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="btn self-start text-sm">
        + Lägg till ingrediens
      </button>

      {/* Generated declaration (the point where the baker reads/acts on the order) */}
      <div className="rounded-xl border border-line bg-cream/40 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="label">Ingrediensförteckning (mängdordning)</span>
          <button
            type="button"
            className="btn btn-primary text-xs"
            disabled={generated.ingredients.length === 0}
            onClick={() => onApply(generated.ingredients)}
          >
            Använd som ingrediensförteckning
          </button>
        </div>

        {generated.ingredients.length === 0 ? (
          <p className="text-sm text-ink/50">Lägg till ingredienser med vikt för att skapa listan.</p>
        ) : (
          <p className="text-sm leading-relaxed text-ink/80">
            {generated.ingredients.map((ing, i) => (
              <span key={ing.id}>
                <Emphasis name={ing.name} allergens={ing.allergens} />
                {i < generated.ingredients.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>
        )}

        {/* Inline draft/approximation status — right where the list is read. */}
        <p className="mt-2 text-[11px] text-ink/50">
          Utkast – ordningen baseras på angivna vikter (rå invägning, ingen hänsyn till
          bakförlust). Granska innan användning.
        </p>

        {generated.unmapped.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-700">
            Utan allergendata: {generated.unmapped.join(', ')}. Välj från listan för att få med
            allergener.
          </p>
        )}
        {generated.missingWeight.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-700">
            Saknar vikt (ej med i ordningen): {generated.missingWeight.join(', ')}.
          </p>
        )}
      </div>
    </div>
  );
}
