import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSiteConfig } from '../hooks/useSiteConfig';

/** Footer links to the legal pages + the static necessary-cookies note. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink/50 ${className}`}
    >
      <Link to="/integritetspolicy" className="underline-offset-2 hover:text-ink hover:underline">
        Integritetspolicy
      </Link>
      <span aria-hidden="true">·</span>
      <Link to="/anvandarvillkor" className="underline-offset-2 hover:text-ink hover:underline">
        Användarvillkor
      </Link>
      <span aria-hidden="true">·</span>
      <span>Vi använder endast nödvändiga cookies.</span>
    </div>
  );
}

/** Shared chrome for the long-form legal pages (works logged-in or out). */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const site = useSiteConfig();
  const name = site.site_name || 'Enkel Etikett';
  useEffect(() => {
    document.title = `${title} – ${name}`;
  }, [title, name]);

  return (
    <div className="min-h-full bg-paper text-ink">
      <header className="border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-paper">
              <span className="font-display text-lg font-bold">{name[0]}</span>
            </div>
            <span className="font-display text-lg font-semibold">{name}</span>
          </Link>
          <Link to="/" className="btn btn-ghost text-sm">
            Tillbaka
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {/* DRAFT NOTICE — remove once reviewed/approved by a qualified person. */}
        <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Utkast.</strong> Detta är ett utkast som måste granskas av en kvalificerad person
          (t.ex. jurist) innan publicering. Det utgör inte juridisk rådgivning och är ingen garanti
          för regelefterlevnad.
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-ink/50">Senast uppdaterad: [DATUM]</p>

        <div className="mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-ink/80">
          {children}
        </div>
      </main>

      <footer className="border-t border-line py-8">
        <LegalLinks />
        <div className="mt-2 text-center text-[11px] text-ink/40">{name}</div>
      </footer>
    </div>
  );
}

/** Section heading helper for the legal prose. */
export function LegalH2({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-xl font-semibold text-ink">{children}</h2>;
}
