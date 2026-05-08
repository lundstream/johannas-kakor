export function formatDateSv(value: string): string {
  if (!value) return '';
  // Already free text? Keep as-is.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value + 'T00:00:00');
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('sv-SE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(d)
    .replace(/-/g, '-');
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
