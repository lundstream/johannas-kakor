import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import type { Ingredient, LabelData, Template } from '../types';
import { createBlankLabel, defaultFieldStyles, normalizeFieldOrder, PRESET_TEMPLATES } from '../data/templates';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Field } from '../components/Field';
import { LabelExact, LabelPreview } from '../components/LabelPreview';
import { IngredientPicker } from '../components/IngredientPicker';
import { IngredientList } from '../components/IngredientList';
import { LogoUploader } from '../components/LogoUploader';
import { QRCodeSection } from '../components/QRCodeSection';
import { BarcodeSection } from '../components/BarcodeSection';
import { LabelSizeSelector } from '../components/LabelSizeSelector';
import { TemplateManager } from '../components/TemplateManager';
import { AllergenLegend } from '../components/AllergenLegend';
import { Toolbar } from '../components/Toolbar';
import { TypographyPanel } from '../components/TypographyPanel';
import { FieldStylePanel } from '../components/FieldStylePanel';
import { FieldOrderPanel } from '../components/FieldOrderPanel';
import { collectAllergens } from '../utils/allergens';
import { printNow } from '../utils/print';
import { exportLabelsToPdf, exportLabelToPng } from '../utils/pdf';
import { todayIso } from '../utils/format';
import { useSiteConfig } from '../hooks/useSiteConfig';

const LS_LABEL = 'jk:label:v1';
const LS_TEMPLATES = 'jk:templates:v1';
const LS_CUSTOM = 'jk:customIngredients:v1';

export default function FreeEditorPage() {
  const site = useSiteConfig();
  const { slug } = useParams<{ slug: string }>();
  // Best-effort watermark flag for the client-side print path; server re-decides
  // authoritatively for PDF/PNG export based on this slug's plan.
  const freeWatermark = useMemo(() => {
    try {
      const slugs = JSON.parse(site.free_mode_slugs || '[]');
      const match = Array.isArray(slugs) ? slugs.find((s: { slug?: string }) => s && s.slug === slug) : null;
      if (!match) return true; // unknown slug → watermark (safe)
      return match.plan !== 'free_comp';
    } catch {
      return true;
    }
  }, [site.free_mode_slugs, slug]);
  const [label, setLabel] = useLocalStorage<LabelData>(LS_LABEL, createBlankLabel());
  const [templates, setTemplates] = useLocalStorage<Template[]>(LS_TEMPLATES, PRESET_TEMPLATES);
  const [customIngredients, setCustomIngredients] = useLocalStorage<Ingredient[]>(LS_CUSTOM, []);
  const [previewScale, setPreviewScale] = useState(3.4);

  // Migrate older labels missing new fields.
  useEffect(() => {
    setLabel((l) => {
      const blank = createBlankLabel();
      const next = { ...l };
      let changed = false;
      if (typeof next.productDescription !== 'string') { next.productDescription = ''; changed = true; }
      if (typeof next.bakedDate !== 'string') { next.bakedDate = ''; changed = true; }
      if (!next.typography) { next.typography = blank.typography; changed = true; }
      if (!next.sections) {
        next.sections = blank.sections; changed = true;
      } else {
        const merged = { ...blank.sections, ...next.sections };
        if (Object.keys(merged).length !== Object.keys(next.sections).length) { next.sections = merged; changed = true; }
      }
      if (!next.fields) {
        next.fields = defaultFieldStyles(); changed = true;
      } else {
        const merged = { ...defaultFieldStyles(), ...next.fields };
        if (Object.keys(merged).length !== Object.keys(next.fields).length) { next.fields = merged; changed = true; }
      }
      const normOrder = normalizeFieldOrder(next.fieldOrder);
      if (!Array.isArray(next.fieldOrder) || normOrder.length !== next.fieldOrder.length) {
        next.fieldOrder = normOrder; changed = true;
      }
      return changed ? next : l;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist updatedAt automatically.
  useEffect(() => {
    const id = setTimeout(() => setLabel((l) => ({ ...l, updatedAt: Date.now() })), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    label.productName, label.productDescription, label.bakeryName, label.weight, label.price,
    label.bestBefore, label.bakedDate, label.storage, label.extraText, label.layout,
    label.size.id, label.size.widthMm, label.size.heightMm, label.ingredients, label.qr,
    label.barcode, label.logo, label.typography, label.sections, label.fields, label.copies,
  ]);

  const allergens = useMemo(() => collectAllergens(label.ingredients), [label.ingredients]);
  const updateLabel = <K extends keyof LabelData>(key: K, value: LabelData[K]) =>
    setLabel({ ...label, [key]: value });

  const handlePrint = () => printNow();
  const handlePdf = async () => { try { await exportLabelsToPdf(label, label.copies, slug); } catch (e) { console.error(e); alert('Kunde inte exportera PDF.'); } };
  const handlePng = async () => { try { await exportLabelToPng(label, true, slug); } catch (e) { console.error(e); alert('Kunde inte exportera PNG.'); } };
  const handleReset = () => { if (confirm('Återställ etikett till tom mall?')) setLabel(createBlankLabel()); };

  const saveTemplate = (name: string) => {
    const tpl: Template = { id: uuid(), name, createdAt: Date.now(), data: { ...label, id: uuid() } };
    setTemplates([tpl, ...templates]);
  };
  const deleteTemplate = (id: string) => {
    if (confirm('Radera mall?')) setTemplates(templates.filter((t) => t.id !== id));
  };
  const duplicateTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTemplates([{ ...t, id: uuid(), name: `${t.name} (kopia)`, createdAt: Date.now() }, ...templates]);
  };

  return (
    <div className="min-h-full">
      {/* Free trial banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800">
        Du använder en gratis förhandsvisning. Dina etiketter sparas lokalt i webbläsaren.{' '}
        <Link to="/login" className="font-semibold underline underline-offset-2 hover:text-amber-900">
          Skapa konto
        </Link>{' '}
        för att spara i molnet och komma åt från flera enheter.
      </div>

      {/* Header */}
      <header className="border-b border-line bg-paper/80 backdrop-blur lg:sticky lg:top-0 z-30">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-paper">
              <span className="font-display text-lg font-bold">{(site.site_name || 'B')[0]}</span>
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold">{site.site_name}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink/50">
                {site.header_tagline}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Toolbar
              onPrint={handlePrint}
              onPdf={handlePdf}
              onPng={handlePng}
              onReset={handleReset}
              copies={label.copies}
              onCopies={(n) => updateLabel('copies', n)}
            />
            <div className="hidden items-center gap-2 border-l border-line pl-3 lg:flex">
              <Link to="/login" className="btn btn-primary text-xs">Skapa konto / Logga in</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)]">
        {/* LEFT: Editor */}
        <section className="flex flex-col gap-4">
          <div className="card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Produkt</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Produktnamn" className="col-span-2" hint="Använd Enter för radbrytning.">
                <textarea className="input min-h-[64px] resize-y" rows={2} value={label.productName}
                  onChange={(e) => updateLabel('productName', e.target.value)} />
              </Field>
              <Field label="Bageri / företag" className="col-span-2">
                <input className="input" value={label.bakeryName}
                  onChange={(e) => updateLabel('bakeryName', e.target.value)} />
              </Field>
              <Field label="Produktbeskrivning" className="col-span-2" hint="Kort beskrivning som visas under produktnamnet. Stöder radbrytning.">
                <textarea className="input min-h-[44px] resize-y" rows={2} value={label.productDescription ?? ''}
                  onChange={(e) => updateLabel('productDescription', e.target.value)} />
              </Field>
              <Field label="Vikt">
                <input className="input" placeholder="t.ex. 85 g" value={label.weight}
                  onChange={(e) => updateLabel('weight', e.target.value)} />
              </Field>
              <Field label="Pris">
                <input className="input" placeholder="t.ex. 25 kr" value={label.price}
                  onChange={(e) => updateLabel('price', e.target.value)} />
              </Field>
              <Field label="Bäst före">
                <div className="flex gap-2">
                  <input type="date" className="input"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(label.bestBefore) ? label.bestBefore : ''}
                    onChange={(e) => updateLabel('bestBefore', e.target.value)} />
                  <button type="button" className="btn whitespace-nowrap text-xs"
                    onClick={() => updateLabel('bestBefore', todayIso())}>Idag</button>
                </div>
              </Field>
              <Field label="Bakat">
                <div className="flex gap-2">
                  <input type="date" className="input"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(label.bakedDate ?? '') ? label.bakedDate : ''}
                    onChange={(e) => updateLabel('bakedDate', e.target.value)} />
                  <button type="button" className="btn whitespace-nowrap text-xs"
                    onClick={() => updateLabel('bakedDate', todayIso())}>Idag</button>
                </div>
              </Field>
              <Field label="Förvaring">
                <textarea className="input min-h-[44px] resize-y" rows={2} value={label.storage}
                  onChange={(e) => updateLabel('storage', e.target.value)} />
              </Field>
              <Field label="Övrig text" className="col-span-2" hint="Visas som kursiv rad i klassisk layout. Stöder radbrytning.">
                <textarea className="input min-h-[44px] resize-y" rows={2} value={label.extraText}
                  onChange={(e) => updateLabel('extraText', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Ingredienser</h2>
              <span className="text-xs text-ink/50">{label.ingredients.length} st · dra för att sortera</span>
            </div>
            <div className="flex flex-col gap-3">
              <IngredientPicker
                customIngredients={customIngredients}
                onAdd={(ing) => updateLabel('ingredients', [...label.ingredients, ing])}
                onCreateCustom={(ing) => setCustomIngredients([{ ...ing, id: `custom-${ing.name}` }, ...customIngredients])}
              />
              <IngredientList items={label.ingredients} onChange={(items) => updateLabel('ingredients', items)} />
              <div>
                <span className="label">Upptäckta allergener</span>
                <div className="mt-1.5"><AllergenLegend active={allergens} /></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-3 font-display text-base font-semibold">Logga</h2>
              <LogoUploader value={label.logo} onChange={(logo) => updateLabel('logo', logo)} />
            </div>
            <div className="card p-4">
              <h2 className="mb-3 font-display text-base font-semibold">Format</h2>
              <LabelSizeSelector
                value={label.size} onChange={(s) => updateLabel('size', s)}
                onCustom={(s) => updateLabel('size', s)} layout={label.layout}
                onLayout={(l) => updateLabel('layout', l)} />
            </div>
          </div>

          <div className="card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Typografi & sektioner</h2>
            <TypographyPanel
              typography={label.typography} onTypography={(t) => updateLabel('typography', t)}
              sections={label.sections} onSections={(s) => updateLabel('sections', s)} />
          </div>

          <div className="card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Fältformatering</h2>
            <div className="mb-4">
              <span className="label">Ordning på etiketten</span>
              <p className="mb-2 mt-1 text-[11px] text-ink/50">
                Dra för att ändra i vilken ordning fälten visas på etiketten.
              </p>
              <FieldOrderPanel
                order={normalizeFieldOrder(label.fieldOrder)}
                fields={label.fields ?? defaultFieldStyles()}
                onChange={(o) => updateLabel('fieldOrder', o)}
              />
            </div>
            <FieldStylePanel fields={label.fields ?? defaultFieldStyles()} onChange={(f) => updateLabel('fields', f)} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-3 font-display text-base font-semibold">QR-kod</h2>
              <QRCodeSection value={label.qr} onChange={(qr) => updateLabel('qr', qr)} />
            </div>
            <div className="card p-4">
              <h2 className="mb-3 font-display text-base font-semibold">Streckkod</h2>
              <BarcodeSection value={label.barcode} onChange={(barcode) => updateLabel('barcode', barcode)} />
            </div>
          </div>

          <div className="card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Mallar</h2>
            <TemplateManager
              templates={templates} current={label}
              onLoad={(d) => setLabel(d)} onSave={saveTemplate}
              onDelete={deleteTemplate} onDuplicate={duplicateTemplate} />
          </div>
        </section>

        {/* RIGHT: Live preview */}
        <section className="flex flex-col gap-4 lg:sticky lg:top-[72px] lg:self-start">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Förhandsvisning</h2>
              <div className="flex items-center gap-2 text-xs text-ink/60">
                <span>Zoom</span>
                <input type="range" min={1.5} max={6} step={0.1} value={previewScale}
                  onChange={(e) => setPreviewScale(Number(e.target.value))} className="accent-ink" />
                <span className="tabular-nums">{previewScale.toFixed(1)}×</span>
              </div>
            </div>
            <div className="flex min-h-[260px] items-center justify-center rounded-xl bg-gradient-to-br from-cream to-paper p-6">
              <div className="rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
                <LabelPreview label={label} scale={previewScale} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/60">
              <span>Storlek: <strong className="text-ink/80">{label.size.widthMm} × {label.size.heightMm} mm</strong></span>
              <span>Layout: <strong className="text-ink/80 capitalize">{label.layout}</strong></span>
              <span>Senast ändrad: {new Date(label.updatedAt).toLocaleTimeString('sv-SE')}</span>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="mb-2 font-display text-base font-semibold">Tips för termoskrivare</h2>
            <ul className="list-disc space-y-1 pl-4 text-sm text-ink/70">
              <li>Välj exakt etikettstorlek i skrivardialogen (t.ex. 102 × 59 mm).</li>
              <li>Sätt skalning till <em>Faktisk storlek</em> – aldrig <em>Anpassa</em>.</li>
              <li>Aktivera svartvitt läge på loggan för skarpare termotryck.</li>
              <li>Katasymbol T50M Pro: använd "Direct Thermal" och 203 dpi.</li>
            </ul>
          </div>

          {/* Sign-up CTA */}
          <div className="card border-amber-200 bg-amber-50 p-4">
            <h2 className="mb-1 font-display text-base font-semibold text-amber-900">Vill du spara ditt arbete?</h2>
            <p className="mb-3 text-sm text-amber-800">Skapa ett konto för att spara etiketter och mallar i molnet.</p>
            <Link to="/login" className="btn btn-primary text-sm">Kom igång gratis</Link>
          </div>
        </section>
      </main>

      {/* Print root (window.print). PDF/PNG export is rendered server-side. */}
      <div id="print-root" aria-hidden className="print-only">
        {Array.from({ length: Math.max(1, label.copies) }).map((_, i) => (
          <LabelExact key={i} label={label} watermark={freeWatermark} />
        ))}
      </div>

      <footer className="border-t border-line bg-paper py-6">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-3 px-5 text-xs text-ink/50">
          {site.instagram_url && (
            <a href={site.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink/70 transition hover:bg-ink hover:text-paper hover:border-ink">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
          )}
          <span>{site.footer_text || `${site.site_name} · ${site.header_tagline}`}</span>
        </div>
      </footer>
    </div>
  );
}
