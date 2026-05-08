import { useRef } from 'react';
import type { LogoConfig } from '../types';

interface Props {
  value: LogoConfig;
  onChange: (next: LogoConfig) => void;
}

export function LogoUploader({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    if (!/^image\/(png|svg\+xml|jpeg|jpg|webp)/.test(file.type)) {
      alert('Endast PNG, SVG, JPG eller WEBP stöds.');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    onChange({ ...value, dataUrl });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-line bg-cream/40"
        >
          {value.dataUrl ? (
            <img
              src={value.dataUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
              style={{ filter: value.monochrome ? 'grayscale(1) contrast(1.4)' : undefined }}
            />
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-ink/40">Ingen logga</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Ladda upp logga
          </button>
          {value.dataUrl && (
            <button
              type="button"
              className="btn btn-ghost btn-danger text-xs"
              onClick={() => onChange({ ...value, dataUrl: undefined })}
            >
              Ta bort
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/svg+xml,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Storlek ({value.widthPercent}%)
          <input
            type="range"
            min={10}
            max={70}
            value={value.widthPercent}
            onChange={(e) => onChange({ ...value, widthPercent: Number(e.target.value) })}
            className="accent-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Position
          <select
            className="select"
            value={value.position}
            onChange={(e) => onChange({ ...value, position: e.target.value as LogoConfig['position'] })}
          >
            <option value="top">Ovanför (centrerad, fullbredd)</option>
            <option value="top-left">Vänster (bredvid text)</option>
            <option value="top-center">Mitten (bredvid text)</option>
            <option value="top-right">Höger (bredvid text)</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink/80">
        <input
          type="checkbox"
          checked={value.monochrome}
          onChange={(e) => onChange({ ...value, monochrome: e.target.checked })}
        />
        Svartvitt läge för termoskrivare
      </label>
    </div>
  );
}
