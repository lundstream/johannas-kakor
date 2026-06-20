import { useMemo } from 'react';
import type { LabelData } from '../types';
import { checkCompleteness, type CheckItem } from '../utils/completeness';

interface Props {
  label: LabelData;
  onChangePackaging: (v: LabelData['packagingType']) => void;
}

function Dot({ status }: { status: CheckItem['status'] }) {
  const cls =
    status === 'ok' ? 'bg-emerald-500' : status === 'missing' ? 'bg-red-500' : 'bg-amber-400';
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

export function CompletenessPanel({ label, onChangePackaging }: Props) {
  const result = useMemo(() => checkCompleteness(label), [label]);
  const missing = result.required.filter((i) => i.status === 'missing');
  const ok = result.required.filter((i) => i.status === 'ok');

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="label">Förpackningstyp</span>
        <select
          className="select"
          value={result.mode}
          onChange={(e) => onChangePackaging(e.target.value as LabelData['packagingType'])}
        >
          <option value="inte färdigförpackad">Inte färdigförpackad (säljs över disk)</option>
          <option value="färdigförpackad">Färdigförpackad</option>
        </select>
      </label>

      {result.missingCount === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          Ser komplett ut ✓
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <div className="mb-1 text-sm font-semibold text-red-700">
            Saknas ({result.missingCount})
          </div>
          <ul className="flex flex-col gap-1.5">
            {missing.map((i) => (
              <li key={i.id} className="flex gap-2 text-sm text-ink/80">
                <Dot status={i.status} />
                <span>
                  <strong>{i.label}</strong>
                  {i.detail && <span className="block text-xs text-ink/55">{i.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ok.length > 0 && (
        <ul className="flex flex-col gap-1">
          {ok.map((i) => (
            <li key={i.id} className="flex gap-2 text-xs text-ink/55">
              <Dot status="ok" />
              {i.label}
            </li>
          ))}
        </ul>
      )}

      {result.advisories.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink/45">
            Kontrollera om det gäller
          </div>
          <ul className="flex flex-col gap-1.5">
            {result.advisories.map((i) => (
              <li key={i.id} className="flex gap-2 text-sm text-ink/70">
                <Dot status={i.status} />
                <span>
                  {i.label}
                  {i.status !== 'ok' && i.detail && (
                    <span className="block text-xs text-ink/50">{i.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.allergens.length > 0 && (
        <p className="text-[11px] text-ink/50">
          Upptäckta allergener: {result.allergens.join(', ')}.
        </p>
      )}

      {result.mode === 'inte färdigförpackad' && (
        <p className="text-[11px] text-ink/45">
          Reglerna för oförpackade livsmedel är nationella (LIVSFS 2014:4) – kontrollera mot
          gällande föreskrift.
        </p>
      )}

      <p className="text-[11px] text-ink/50">
        Checklistan hjälper dig att hitta information som verkar saknas – ingen garanti för
        regelefterlevnad. Du ansvarar för att kontrollera etiketten.
      </p>
    </div>
  );
}
