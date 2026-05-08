import type { LabelData, LabelSize } from '../types';
import { LABEL_SIZES } from '../data/labelSizes';

interface Props {
  value: LabelSize;
  onChange: (s: LabelSize) => void;
  onCustom: (s: LabelSize) => void;
  layout: LabelData['layout'];
  onLayout: (l: LabelData['layout']) => void;
}

export function LabelSizeSelector({ value, onChange, onCustom, layout, onLayout }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="label">Etikettstorlek</span>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {LABEL_SIZES.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => onChange(s)}
              className={`rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                value.id === s.id
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-white text-ink hover:bg-cream'
              }`}
            >
              <div className="font-semibold">{s.label}</div>
              <div className={`mt-0.5 text-[10px] ${value.id === s.id ? 'text-paper/70' : 'text-ink/50'}`}>
                {s.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Bredd (mm)
          <input
            type="number"
            min={20}
            max={300}
            className="input"
            value={value.widthMm}
            onChange={(e) =>
              onCustom({
                ...value,
                id: 'custom',
                label:
                  value.shape === 'round'
                    ? `⌀ ${e.target.value} mm rund`
                    : `${e.target.value} × ${value.heightMm} mm`,
                widthMm: Number(e.target.value),
                heightMm: value.shape === 'round' ? Number(e.target.value) : value.heightMm,
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Höjd (mm)
          <input
            type="number"
            min={10}
            max={400}
            className="input"
            disabled={value.shape === 'round'}
            value={value.heightMm}
            onChange={(e) =>
              onCustom({
                ...value,
                id: 'custom',
                label: `${value.widthMm} × ${e.target.value} mm`,
                heightMm: Number(e.target.value),
              })
            }
          />
        </label>
      </div>

      <div>
        <span className="label">Form</span>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {(['rect', 'round'] as const).map((sh) => (
            <button
              type="button"
              key={sh}
              onClick={() => {
                const newShape = sh;
                if (newShape === 'round') {
                  const d = Math.min(value.widthMm, value.heightMm);
                  onCustom({
                    ...value,
                    id: 'custom',
                    label: `⌀ ${d} mm rund`,
                    widthMm: d,
                    heightMm: d,
                    shape: 'round',
                  });
                } else {
                  onCustom({ ...value, shape: 'rect' });
                }
              }}
              className={`rounded-xl border px-2.5 py-2 text-xs transition ${
                (value.shape ?? 'rect') === sh
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-white text-ink hover:bg-cream'
              }`}
            >
              {sh === 'round' ? 'Rund (⌀)' : 'Rektangulär'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Layout</span>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {(['classic', 'compact', 'banner', 'minimal'] as const).map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => onLayout(v)}
              className={`rounded-xl border px-2.5 py-2 text-xs capitalize transition ${
                layout === v
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-white text-ink hover:bg-cream'
              }`}
            >
              {labelOf(v)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function labelOf(v: string) {
  return {
    classic: 'Klassisk',
    compact: 'Kompakt',
    banner: 'Banner',
    minimal: 'Minimal',
  }[v];
}
