import type { QrConfig } from '../types';

interface Props {
  value: QrConfig;
  onChange: (next: QrConfig) => void;
}

export function QRCodeSection({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2 text-sm">
        <span>Aktivera QR-kod</span>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
      </label>

      <div className={`grid grid-cols-2 gap-3 ${value.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Typ
          <select
            className="select"
            value={value.type}
            onChange={(e) => onChange({ ...value, type: e.target.value as QrConfig['type'] })}
          >
            <option value="url">Webbsida (URL)</option>
            <option value="product">Produktsida</option>
            <option value="ingredients">Ingredienslista</option>
            <option value="text">Egen text</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Storlek ({value.sizeMm} mm)
          <input
            type="range"
            min={8}
            max={40}
            value={value.sizeMm}
            onChange={(e) => onChange({ ...value, sizeMm: Number(e.target.value) })}
            className="accent-ink"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-ink/70">
          Värde
          <input
            className="input"
            value={value.value}
            placeholder={value.type === 'text' ? 'Egen text' : 'https://…'}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
