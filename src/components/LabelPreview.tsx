import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import type { FieldKey, FieldStyle, Ingredient, LabelData } from '../types';
import { collectAllergens, tokenizeIngredient, allergenLabels } from '../utils/allergens';
import { formatDateSv } from '../utils/format';
import { renderBarcodeSvg } from '../utils/barcode';
import { defaultFieldStyles } from '../data/templates';

interface Props {
  label: LabelData;
  /** mm per pixel scale used for screen preview. Print is always 1:1 mm. */
  scale?: number;
  className?: string;
}

const FONT_STACKS: Record<string, string> = {
  inter: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  fraunces: '"Fraunces", Georgia, "Times New Roman", serif',
  georgia: 'Georgia, "Times New Roman", serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  caveat: '"Caveat", "Comic Sans MS", cursive',
};

export function LabelPreview({ label, scale = 3.4, className = '' }: Props) {
  return (
    <div
      className={className}
      style={{
        width: `${label.size.widthMm * scale}px`,
        height: `${label.size.heightMm * scale}px`,
      }}
    >
      <LabelInner label={label} pxPerMm={scale} />
    </div>
  );
}

/** Renders at exact mm dimensions for PDF/print. */
export function LabelExact({ label }: { label: LabelData }) {
  return (
    <div
      className="label-print"
      style={{ width: `${label.size.widthMm}mm`, height: `${label.size.heightMm}mm` }}
    >
      <LabelInner label={label} pxPerMm={3.7795275591} /* 1mm = 3.78px */ />
    </div>
  );
}

function LabelInner({ label, pxPerMm }: { label: LabelData; pxPerMm: number }) {
  const allergenCodes = collectAllergens(label.ingredients);

  const w = label.size.widthMm;
  const h = label.size.heightMm;
  const base = Math.min(w, h);

  const typo = label.typography ?? { fontFamily: 'inter', scale: 1 };
  const sections = label.sections ?? {
    ingredientsLabelOwnRow: false,
    allergenDisplay: 'inline',
    allergenStyle: 'caps',
    sectionSpacingMm: 0,
    showAllergenHelper: false,
  };
  const fields = label.fields ?? defaultFieldStyles();

  const autoTitle = clamp(base * 0.18, 9, 22);
  const autoMeta = clamp(base * 0.085, 6.5, 11);
  const autoBody = clamp(base * 0.075, 6, 9.5);
  const titlePt = (typo.titlePt ?? autoTitle) * typo.scale;
  const metaPt = (typo.metaPt ?? autoMeta) * typo.scale;
  const bodyPt = (typo.bodyPt ?? autoBody) * typo.scale;

  const padMm = clamp(Math.min(w, h) * 0.06, 1.5, 4);
  const isRound = label.size.shape === 'round';
  // Round labels need extra inset so text doesn't clip at the curved edge.
  const roundInsetMm = isRound ? Math.min(w, h) * 0.085 : 0;
  const totalPadMm = padMm + roundInsetMm;

  /** Style helper: combines pt size + per-field overrides into inline CSS. */
  const fieldStyle = (key: FieldKey, basePt: number): React.CSSProperties => {
    const f: FieldStyle = fields[key] ?? { visible: true };
    const finalPt = f.sizePt ?? basePt;
    const px = (finalPt * pxPerMm) / 2.83465;
    return {
      fontSize: `${px}px`,
      fontFamily: f.fontFamily ? FONT_STACKS[f.fontFamily] : undefined,
      fontWeight: f.bold ? 700 : undefined,
      fontStyle: f.italic ? 'italic' : undefined,
    };
  };

  return (
    <div
      className="label-canvas h-full w-full"
      style={{
        padding: `${totalPadMm * pxPerMm}px`,
        boxSizing: 'border-box',
        borderRadius: isRound ? '50%' : undefined,
        fontFamily: FONT_STACKS[typo.fontFamily] ?? FONT_STACKS.inter,
      }}
    >
      <Layout
        label={label}
        pxPerMm={pxPerMm}
        fieldStyle={fieldStyle}
        titlePt={titlePt}
        metaPt={metaPt}
        bodyPt={bodyPt}
        fields={fields}
        allergenCodes={allergenCodes}
      />
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function Layout({
  label,
  pxPerMm,
  fieldStyle,
  titlePt,
  metaPt,
  bodyPt,
  fields,
  allergenCodes,
}: {
  label: LabelData;
  pxPerMm: number;
  fieldStyle: (key: FieldKey, basePt: number) => React.CSSProperties;
  titlePt: number;
  metaPt: number;
  bodyPt: number;
  fields: Record<FieldKey, FieldStyle>;
  allergenCodes: ReturnType<typeof collectAllergens>;
}) {
  const variant = label.layout;
  const pos = label.logo.position;
  const stackTop = pos === 'top' || pos === 'top-center' || variant === 'banner';
  const headerJustify =
    pos === 'top' || pos === 'top-center'
      ? 'items-center'
      : pos === 'top-right'
        ? 'items-start justify-end'
        : 'items-start';

  const sections = label.sections;
  const allergenStyle = sections.allergenStyle;
  const showInline = sections.allergenDisplay === 'inline' || sections.allergenDisplay === 'both';
  const showSeparate = sections.allergenDisplay === 'separate' || sections.allergenDisplay === 'both';
  const gap = `${sections.sectionSpacingMm * pxPerMm}px`;

  const showBakery = fields.bakeryName.visible && !!label.bakeryName;
  const showProduct = fields.productName.visible;
  const showDescription =
    (fields.productDescription?.visible ?? true) && !!label.productDescription;
  const showMeta = fields.meta.visible && (label.weight || label.price);
  const showIngredients =
    fields.ingredientsList.visible && variant !== 'minimal' && label.ingredients.length > 0;
  const showIngLabel = fields.ingredientsLabel.visible;
  const showAllergenSeparate =
    fields.allergenSeparate.visible &&
    showSeparate &&
    allergenCodes.length > 0 &&
    variant !== 'minimal';
  const showHelper =
    fields.allergenHelper.visible &&
    sections.showAllergenHelper &&
    allergenCodes.length > 0 &&
    showInline;
  const showBestBefore = fields.bestBefore.visible && !!label.bestBefore;
  const showBakedDate = (fields.bakedDate?.visible ?? true) && !!label.bakedDate;
  const showStorage = fields.storage.visible && !!label.storage && variant !== 'minimal';
  const showExtra = fields.extraText.visible && !!label.extraText && variant === 'classic';

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ gap: gap !== '0px' ? gap : '0.6mm' }}
    >
      {stackTop && label.logo.dataUrl && (
        <div className={`flex w-full ${pos === 'top-right' ? 'justify-end' : pos === 'top-left' ? 'justify-start' : 'justify-center'}`}>
          <Logo label={label} pxPerMm={pxPerMm} />
        </div>
      )}

      {/* Top row: logo + title block */}
      <header
        className={`flex gap-2 ${stackTop ? 'flex-col' : pos === 'top-right' ? 'flex-row-reverse' : 'flex-row'} ${headerJustify}`}
      >
        {!stackTop && <Logo label={label} pxPerMm={pxPerMm} />}
        <div
          className={`flex-1 min-w-0 ${pos === 'top-right' && !stackTop ? 'text-right' : pos === 'top' || pos === 'top-center' ? 'text-center' : ''}`}
        >
          {showBakery && (
            <div
              className="uppercase tracking-[0.18em] text-[#000] opacity-80"
              style={fieldStyle('bakeryName', metaPt * 0.78)}
            >
              {label.bakeryName}
            </div>
          )}
          {showProduct && (
            <h1
              className="label-title text-[#000] whitespace-pre-line"
              style={{ ...fieldStyle('productName', titlePt), overflow: 'visible' }}
            >
              {label.productName || 'Produktnamn'}
            </h1>
          )}
          {showDescription && (
            <div
              className="text-[#000] whitespace-pre-line"
              style={fieldStyle('productDescription', bodyPt * 0.95)}
            >
              {label.productDescription}
            </div>
          )}
          {showMeta && (
            <div
              className={`label-meta flex gap-2 text-[#000] ${pos === 'top-right' && !stackTop ? 'justify-end' : pos === 'top' || pos === 'top-center' ? 'justify-center' : ''}`}
              style={fieldStyle('meta', metaPt)}
            >
              {label.weight && <span>{label.weight}</span>}
              {label.weight && label.price && <span>·</span>}
              {label.price && <span>{label.price}</span>}
            </div>
          )}
        </div>
      </header>

      {/* Body: ingredients */}
      {showIngredients && (
        <section style={fieldStyle('ingredientsList', bodyPt)} className="leading-[1.25] text-[#000]">
          {sections.ingredientsLabelOwnRow ? (
            <>
              {showIngLabel && (
                <div
                  className={sections.ingredientsLabelBold ? 'font-semibold' : ''}
                  style={fieldStyle('ingredientsLabel', bodyPt)}
                >
                  {sections.ingredientsLabelText || 'Ingredienser'}:
                </div>
              )}
              <IngredientsInline
                ingredients={label.ingredients}
                allergenStyle={showInline ? allergenStyle : 'normal'}
              />
              <span>.</span>
            </>
          ) : (
            <>
              {showIngLabel && (
                <span
                  className={sections.ingredientsLabelBold ? 'font-semibold' : ''}
                  style={fieldStyle('ingredientsLabel', bodyPt)}
                >
                  {sections.ingredientsLabelText || 'Ingredienser'}:{' '}
                </span>
              )}
              <IngredientsInline
                ingredients={label.ingredients}
                allergenStyle={showInline ? allergenStyle : 'normal'}
              />
              <span>.</span>
            </>
          )}
          {showHelper && (
            <>
              {' '}
              <span className="italic opacity-80" style={fieldStyle('allergenHelper', bodyPt * 0.92)}>
                Allergener {allergenStyle.includes('caps') ? 'i versaler' : 'i fet stil'}.
              </span>
            </>
          )}
        </section>
      )}

      {showAllergenSeparate && (
        <section style={fieldStyle('allergenSeparate', bodyPt)} className="leading-[1.25] text-[#000]">
          <span className={sections.allergenSeparateLabelBold ? 'font-semibold' : ''}>
            {sections.allergenSeparateLabelText || 'Innehåller'}:{' '}
          </span>
          {allergenLabels(allergenCodes).join(', ')}.
        </section>
      )}

      {/* Footer: dates + storage + qr/barcode */}
      <footer className="mt-auto flex items-end gap-2">
        <div className="flex-1 min-w-0">
          {showBakedDate && (
            <div className="text-[#000]" style={fieldStyle('bakedDate', metaPt)}>
              <span className="font-semibold">Bakat: </span>
              {formatDateSv(label.bakedDate)}
            </div>
          )}
          {showBestBefore && (
            <div className="text-[#000]" style={fieldStyle('bestBefore', metaPt)}>
              <span className="font-semibold">Bäst före: </span>
              {formatDateSv(label.bestBefore)}
            </div>
          )}
          {showStorage && (
            <div
              className="text-[#000] opacity-90 whitespace-pre-line"
              style={fieldStyle('storage', bodyPt * 0.95)}
            >
              {label.storage}
            </div>
          )}
          {showExtra && (
            <div
              className="mt-[0.4mm] italic text-[#000] opacity-80 whitespace-pre-line"
              style={fieldStyle('extraText', bodyPt * 0.95)}
            >
              {label.extraText}
            </div>
          )}
        </div>
        <CodesBlock label={label} pxPerMm={pxPerMm} />
      </footer>
    </div>
  );
}

function IngredientsInline({
  ingredients,
  allergenStyle,
}: {
  ingredients: Ingredient[];
  allergenStyle: 'caps' | 'bold' | 'caps-bold' | 'normal';
}) {
  return (
    <>
      {ingredients.map((ing, i) => {
        const tokens = tokenizeIngredient(ing);
        return (
          <span key={ing.id}>
            {tokens.map((t, j) => {
              if (!t.isAllergen) return <span key={j}>{t.text}</span>;
              const text =
                allergenStyle === 'caps' || allergenStyle === 'caps-bold'
                  ? t.text.toLocaleUpperCase('sv-SE')
                  : t.text;
              const bold = allergenStyle === 'bold' || allergenStyle === 'caps-bold';
              return (
                <span key={j} style={bold ? { fontWeight: 700 } : undefined}>
                  {text}
                </span>
              );
            })}
            {i < ingredients.length - 1 ? ', ' : ''}
          </span>
        );
      })}
    </>
  );
}


function Logo({ label, pxPerMm }: { label: LabelData; pxPerMm: number }) {
  if (!label.logo.dataUrl) return null;
  const widthMm = (label.size.widthMm * label.logo.widthPercent) / 100;
  return (
    <div
      style={{
        width: `${widthMm * pxPerMm}px`,
        flexShrink: 0,
      }}
    >
      <img
        src={label.logo.dataUrl}
        alt=""
        className="block h-auto w-full"
        style={{
          filter: label.logo.monochrome ? 'grayscale(1) contrast(1.4) brightness(0.9)' : undefined,
        }}
      />
    </div>
  );
}

function CodesBlock({ label, pxPerMm }: { label: LabelData; pxPerMm: number }) {
  return (
    <div className="flex items-end gap-2">
      {label.qr.enabled && <QrSquare label={label} pxPerMm={pxPerMm} />}
      {label.barcode.enabled && <BarcodeBlock label={label} pxPerMm={pxPerMm} />}
    </div>
  );
}

function QrSquare({ label, pxPerMm }: { label: LabelData; pxPerMm: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const value = qrValue(label);
  const sizePx = label.qr.sizeMm * pxPerMm;

  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value || ' ', {
      margin: 0,
      width: Math.max(64, sizePx * 2),
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {
      /* ignore */
    });
  }, [value, sizePx]);

  return (
    <canvas
      ref={ref}
      style={{ width: `${sizePx}px`, height: `${sizePx}px`, imageRendering: 'pixelated' }}
    />
  );
}

function qrValue(label: LabelData): string {
  switch (label.qr.type) {
    case 'product':
      return `${label.qr.value || 'https://example.com'}/${encodeURIComponent(label.productName)}`;
    case 'ingredients':
      return `Ingredienser: ${label.ingredients.map((i) => i.name).join(', ')}`;
    case 'text':
      return label.qr.value;
    case 'url':
    default:
      return label.qr.value;
  }
}

function BarcodeBlock({ label, pxPerMm }: { label: LabelData; pxPerMm: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    renderBarcodeSvg(ref.current, label.barcode.value, label.barcode.format, label.barcode.heightMm * pxPerMm);
  }, [label.barcode.value, label.barcode.format, label.barcode.heightMm, pxPerMm]);

  return (
    <svg
      ref={ref}
      style={{
        height: `${label.barcode.heightMm * pxPerMm + 14}px`,
      }}
    />
  );
}
