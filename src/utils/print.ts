/**
 * Trigger the browser's print dialog. Print CSS in index.css ensures only
 * the #print-root content is shown.
 */
export function printNow() {
  // Slight delay to let React commit the print copies.
  requestAnimationFrame(() => {
    setTimeout(() => window.print(), 50);
  });
}
