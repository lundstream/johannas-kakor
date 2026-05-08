import JsBarcode from 'jsbarcode';

export function renderBarcodeSvg(
  svg: SVGSVGElement,
  value: string,
  format: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC',
  heightPx: number
) {
  try {
    JsBarcode(svg, value || ' ', {
      format,
      displayValue: true,
      fontSize: 12,
      height: heightPx,
      margin: 0,
      lineColor: '#000',
      background: '#fff',
    });
  } catch {
    // Invalid value for chosen format – render fallback CODE128.
    try {
      JsBarcode(svg, value || ' ', {
        format: 'CODE128',
        displayValue: true,
        fontSize: 12,
        height: heightPx,
        margin: 0,
      });
    } catch {
      /* ignore */
    }
  }
}
