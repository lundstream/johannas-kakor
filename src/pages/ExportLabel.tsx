import { useEffect, useRef, useState } from 'react';
import type { LabelData } from '../types';
import { LabelExact } from '../components/LabelPreview';

/**
 * Headless render target for server-side export (NOT user-facing).
 * Puppeteer injects `window.__EXPORT__` before scripts run, navigates here,
 * waits for `window.__EXPORT_READY__`, then screenshots `.label-print` (PNG) or
 * page.pdf's the exact-mm page (PDF). The watermark is baked in via LabelExact.
 */
declare global {
  interface Window {
    __EXPORT__?: {
      label: LabelData;
      watermark: boolean;
      copies?: number;
      transparent?: boolean;
    };
    __EXPORT_READY__?: boolean;
  }
}

export default function ExportLabel() {
  const data = typeof window !== 'undefined' ? window.__EXPORT__ : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const [, setReady] = useState(false);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void (async () => {
      // Transparent PNG: strip the white label background before capture.
      if (data.transparent && rootRef.current) {
        rootRef.current.querySelectorAll<HTMLElement>('.label-canvas').forEach((el) => {
          el.style.background = 'transparent';
        });
      }
      try {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      } catch {
        /* fonts API unavailable — continue */
      }
      // Let barcode/QR effects and images paint before signalling ready.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled) return;
      window.__EXPORT_READY__ = true;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!data) return <div data-export-error>missing __EXPORT__</div>;

  const copies = data.copies && data.copies > 1 ? data.copies : 1;

  return (
    <div ref={rootRef} id="export-root" style={{ background: data.transparent ? 'transparent' : '#fff' }}>
      {Array.from({ length: copies }).map((_, i) => (
        <div key={i} style={{ breakAfter: i < copies - 1 ? 'page' : 'auto' }}>
          <LabelExact label={data.label} watermark={data.watermark} />
        </div>
      ))}
    </div>
  );
}
