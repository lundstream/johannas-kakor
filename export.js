import puppeteer from 'puppeteer';
import { settings } from './settings.js';

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

    // Inject the payload before any app script runs.
    await page.evaluateOnNewDocument(
      (payload) => {
        window.__EXPORT__ = payload;
      },
      { label, watermark, copies: format === 'pdf' ? copies : 1, transparent: format === 'png' && transparent },
    );

    await page.goto(`${EXPORT_BASE_URL}/__export`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__EXPORT_READY__ === true, { timeout: 30000 });

    if (format === 'png') {
      const el = await page.$('.label-print');
      if (!el) throw new Error('label node not found');
      return await el.screenshot({ type: 'png', omitBackground: transparent });
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
