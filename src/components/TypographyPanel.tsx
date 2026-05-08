import type { FontFamily, SectionConfig, TypographyConfig } from '../types';

interface Props {
  typography: TypographyConfig;
  onTypography: (t: TypographyConfig) => void;
  sections: SectionConfig;
  onSections: (s: SectionConfig) => void;
}

const FONTS: { value: FontFamily; label: string; sample: string }[] = [
  { value: 'inter', label: 'Inter (sans, modern)', sample: 'AaBb' },
  { value: 'fraunces', label: 'Fraunces (serif, varm)', sample: 'AaBb' },
  { value: 'georgia', label: 'Georgia (serif, klassisk)', sample: 'AaBb' },
  { value: 'helvetica', label: 'Helvetica (sans, neutral)', sample: 'AaBb' },
  { value: 'system', label: 'System UI', sample: 'AaBb' },
  { value: 'mono', label: 'JetBrains Mono', sample: 'AaBb' },
  { value: 'caveat', label: 'Caveat (handstil)', sample: 'AaBb' },
];

export function TypographyPanel({ typography, onTypography, sections, onSections }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs text-ink/70">
        Typsnitt
        <select
          className="select"
          value={typography.fontFamily}
          onChange={(e) => onTypography({ ...typography, fontFamily: e.target.value as FontFamily })}
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink/70">
        Textstorlek ({Math.round(typography.scale * 100)}%)
        <input
          type="range"
          min={0.6}
          max={1.6}
          step={0.05}
          value={typography.scale}
          onChange={(e) => onTypography({ ...typography, scale: Number(e.target.value) })}
          className="accent-ink"
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <PtField
          label="Titel pt"
          value={typography.titlePt}
          onChange={(v) => onTypography({ ...typography, titlePt: v })}
        />
        <PtField
          label="Brödtext pt"
          value={typography.bodyPt}
          onChange={(v) => onTypography({ ...typography, bodyPt: v })}
        />
        <PtField
          label="Meta pt"
          value={typography.metaPt}
          onChange={(v) => onTypography({ ...typography, metaPt: v })}
        />
      </div>
      <p className="text-[11px] text-ink/50">Lämna pt-fält tomt för automatisk anpassning.</p>

      <hr className="border-line" />

      <label className="flex flex-col gap-1 text-xs text-ink/70">
        Allergener visas som
        <select
          className="select"
          value={sections.allergenStyle}
          onChange={(e) => onSections({ ...sections, allergenStyle: e.target.value as SectionConfig['allergenStyle'] })}
        >
          <option value="caps">VERSALER (CAPS)</option>
          <option value="bold">Fet stil (bold)</option>
          <option value="caps-bold">VERSALER + fet</option>
          <option value="normal">Vanlig text</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink/70">
        Allergenlista
        <select
          className="select"
          value={sections.allergenDisplay}
          onChange={(e) => onSections({ ...sections, allergenDisplay: e.target.value as SectionConfig['allergenDisplay'] })}
        >
          <option value="inline">Endast i ingrediensraden</option>
          <option value="separate">Egen rad ("Innehåller: …")</option>
          <option value="both">Både och</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-line p-3">
        <label className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-ink/50">
          Etiketter (rubriktexter)
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          „Ingredienser“-text
          <input
            type="text"
            className="input"
            value={sections.ingredientsLabelText ?? 'Ingredienser'}
            placeholder="Ingredienser"
            onChange={(e) => onSections({ ...sections, ingredientsLabelText: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink/80 self-end">
          <input
            type="checkbox"
            checked={sections.ingredientsLabelBold ?? true}
            onChange={(e) => onSections({ ...sections, ingredientsLabelBold: e.target.checked })}
          />
          Fet stil
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          „Innehåller“-text
          <input
            type="text"
            className="input"
            value={sections.allergenSeparateLabelText ?? 'Innehåller'}
            placeholder="Innehåller, Med spår av, …"
            onChange={(e) => onSections({ ...sections, allergenSeparateLabelText: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink/80 self-end">
          <input
            type="checkbox"
            checked={sections.allergenSeparateLabelBold ?? true}
            onChange={(e) => onSections({ ...sections, allergenSeparateLabelBold: e.target.checked })}
          />
          Fet stil
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink/80">
        <input
          type="checkbox"
          checked={sections.ingredientsLabelOwnRow}
          onChange={(e) => onSections({ ...sections, ingredientsLabelOwnRow: e.target.checked })}
        />
        “Ingredienser:” på egen rad ovanför listan
      </label>

      <label className="flex items-center gap-2 text-sm text-ink/80">
        <input
          type="checkbox"
          checked={sections.showAllergenHelper}
          onChange={(e) => onSections({ ...sections, showAllergenHelper: e.target.checked })}
        />
        Visa hjälptext (“Allergener i versaler.”)
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink/70">
        Mellanrum mellan sektioner ({sections.sectionSpacingMm.toFixed(1)} mm)
        <input
          type="range"
          min={0}
          max={4}
          step={0.2}
          value={sections.sectionSpacingMm}
          onChange={(e) => onSections({ ...sections, sectionSpacingMm: Number(e.target.value) })}
          className="accent-ink"
        />
      </label>
    </div>
  );
}

function PtField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink/70">
      {label}
      <input
        type="number"
        min={4}
        max={48}
        step={0.5}
        className="input"
        value={value ?? ''}
        placeholder="auto"
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
      />
    </label>
  );
}
