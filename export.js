import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { settings } from './settings.js';

// Target raster resolution for the PNG (thermal printers are commonly 203/300 dpi).
// We emit a native-DPI, pure 1-bit image so the printer has no grey to dither.
const PRINT_DPI = 300;
// Grey edges darker than this become solid black (slightly thickens thin text, which
// reads better on thermal heads); lighter greys become white. 0=all white, 255=all black.
const MONO_THRESHOLD = 190;

// Where the headless browser loads the SPA's /__export route from.
// In production the API serves the built SPA (dist) on its own origin, so this
// defaults to the API's own port. Override with EXPORT_BASE_URL in dev (e.g.
// the Vite dev server, http://localhost:3050) — see README.
const EXPORT_BASE_URL =
  process.env.EXPORT_BASE_URL || `http://127.0.0.1:${settings.port || 3060}`;

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
      .catch((e) => {
        browserPromise = null; // allow retry on next request
        throw e;
      });
  }
  return browserPromise;
}

/**
 * Render a label to a PDF or PNG buffer using the real React renderer inside
 * headless Chromium. `watermark` is decided by the caller (server-authoritative)
 * and baked into the artifact — it cannot be removed by the client.
 */
export async function renderLabel({ label, watermark, format, copies = 1, transparent = false }) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: 1400,
      height: 1400,
      deviceScaleFactor: format === 'png' ? 4 : 1, // crisp raster for PNG; PDF is vector
    });
    // page.pdf() defaults to print media, where the app's print CSS hides
    // everything except #print-root. The export route renders into #export-root,
    // so force screen media to render the label normally.
    await page.emulateMediaType('screen');

    // Inject the payload before any app script runs. The PNG is for thermal printing,
    // so it is never transparent — it renders on solid white and is thresholded below.
    await page.evaluateOnNewDocument(
      (payload) => {
        window.__EXPORT__ = payload;
      },
      { label, watermark, copies: format === 'pdf' ? copies : 1, transparent: false },
    );

    await page.goto(`${EXPORT_BASE_URL}/__export`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__EXPORT_READY__ === true, { timeout: 30000 });

    if (format === 'png') {
      const el = await page.$('.label-print');
      if (!el) throw new Error('label node not found');
      const raw = await el.screenshot({ type: 'png' }); // white background, anti-aliased
      // Thermal-optimize: flatten on white, resample to the exact native-DPI pixel grid,
      // then threshold to pure 1-bit black/white. Doing the threshold AFTER the resize
      // means the final image carries no grey for the printer to dither, so text/barcodes
      // print crisp. DPI metadata makes "print at actual size" land 1:1.
      const wPx = Math.max(1, Math.round((label.size.widthMm / 25.4) * PRINT_DPI));
      const hPx = Math.max(1, Math.round((label.size.heightMm / 25.4) * PRINT_DPI));
      return await sharp(raw)
        .flatten({ background: '#ffffff' })
        .resize(wPx, hPx, { fit: 'fill', kernel: 'lanczos3' })
        .grayscale()
        .threshold(MONO_THRESHOLD)
        .withMetadata({ density: PRINT_DPI })
        .png({ compressionLevel: 9, palette: true, colors: 2 })
        .toBuffer();
    }

    // PDF: exact mm page size; the label sits at the page top-left (Tailwind
    // preflight zeroes the body margin), so each page is exactly one label.
    const w = label.size.widthMm;
    const h = label.size.heightMm;
    return await page.pdf({
      width: `${w}mm`,
      height: `${h}mm`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await page.close();
  }
}

/** Close the shared browser (e.g. on shutdown). */
export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close();
  }
}
