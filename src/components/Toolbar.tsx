interface Props {
  onPrint: () => void;
  onPdf: () => void;
  onPng: () => void;
  onReset: () => void;
  copies: number;
  onCopies: (n: number) => void;
}

export function Toolbar({ onPrint, onPdf, onPng, onReset, copies, onCopies }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1">
        <button
          type="button"
          className="rounded-full px-2 py-0.5 text-sm hover:bg-cream"
          onClick={() => onCopies(Math.max(1, copies - 1))}
          aria-label="Färre kopior"
        >
          −
        </button>
        <span className="min-w-[2.5rem] text-center text-sm tabular-nums">
          {copies} st
        </span>
        <button
          type="button"
          className="rounded-full px-2 py-0.5 text-sm hover:bg-cream"
          onClick={() => onCopies(Math.min(999, copies + 1))}
          aria-label="Fler kopior"
        >
          +
        </button>
      </div>
      <button type="button" className="btn" onClick={onPdf}>
        Exportera PDF
      </button>
      <button type="button" className="btn" onClick={onPng} title="PNG med transparent bakgrund">
        Exportera PNG
      </button>
      <button type="button" className="btn btn-primary" onClick={onPrint}>
        Skriv ut
      </button>
      <button type="button" className="btn btn-ghost text-ink/60" onClick={onReset}>
        Återställ
      </button>
    </div>
  );
}
