import type { BarcodeConfig } from '../types';

interface Props {
  value: BarcodeConfig;
  onChange: (next: BarcodeConfig) => void;
}

export function BarcodeSection({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2 text-sm">
        <span>Aktivera streckkod</span>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
      </label>

      <div className={`grid grid-cols-2 gap-3 ${value.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Format
          <select
            className="select"
            value={value.format}
            onChange={(e) => onChange({ ...value, format: e.target.value as BarcodeConfig['format'] })}
          >
            <option value="CODE128">CODE128 (universal)</option>
            <option value="EAN13">EAN-13</option>
            <option value="EAN8">EAN-8</option>
            <option value="UPC">UPC</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Höjd ({value.heightMm} mm)
          <input
            type="range"
            min={6}
            max={20}
            value={value.heightMm}
            onChange={(e) => onChange({ ...value, heightMm: Number(e.target.value) })}
            className="accent-ink"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-ink/70">
          Värde
          <input
            className="input font-mono"
            value={value.value}
            placeholder="t.ex. 7350001234567"
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
