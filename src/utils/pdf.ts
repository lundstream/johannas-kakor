import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { LabelData } from '../types';

/**
 * Render every visible `.label-print` node into a multi-page PDF that matches
 * each label's mm size exactly. Requires a print-root mounted in the DOM.
 */
export async function exportLabelsToPdf(label: LabelData, copies: number) {
  const root = document.getElementById('pdf-root');
  if (!root) throw new Error('PDF-root saknas');

  const node = root.querySelector<HTMLElement>('.label-print');
  if (!node) throw new Error('Etikett saknas');

  const w = label.size.widthMm;
  const h = label.size.heightMm;
  const orientation = w >= h ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ unit: 'mm', format: [w, h], orientation });

  const canvas = await html2canvas(node, {
    backgroundColor: '#ffffff',
    scale: 4, // crisp for thermal
    useCORS: true,
  });
  const img = canvas.toDataURL('image/png');

  for (let i = 0; i < copies; i++) {
    if (i > 0) pdf.addPage([w, h], orientation);
    pdf.addImage(img, 'PNG', 0, 0, w, h, undefined, 'FAST');
  }

  pdf.save(`${slug(label.productName) || 'etikett'}.pdf`);
}

function slug(s: string) {
  return s
    .toLocaleLowerCase('sv-SE')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Export the current label as a PNG. If `transparent` is true, the white
 * label background is removed for use on dark surfaces or as overlay.
 */
export async function exportLabelToPng(label: LabelData, transparent: boolean) {
  const root = document.getElementById('pdf-root');
  if (!root) throw new Error('PDF-root saknas');
  const node = root.querySelector<HTMLElement>('.label-print');
  if (!node) throw new Error('Etikett saknas');

  // Temporarily strip the white canvas background for transparent export.
  const canvasEl = node.querySelector<HTMLElement>('.label-canvas');
  const prevBg = canvasEl?.style.background;
  if (transparent && canvasEl) canvasEl.style.background = 'transparent';

  try {
    const canvas = await html2canvas(node, {
      backgroundColor: transparent ? null : '#ffffff',
      scale: 4,
      useCORS: true,
    });
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${slug(label.productName) || 'etikett'}${transparent ? '-transparent' : ''}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    if (transparent && canvasEl) canvasEl.style.background = prevBg ?? '';
  }
}
