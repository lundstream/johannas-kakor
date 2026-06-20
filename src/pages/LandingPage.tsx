import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { LegalLinks } from '../components/LegalPage';
import { GallerySection } from '../components/GallerySection';

/**
 * Marketing-/startsida för utloggade besökare.
 * - Primär väg: "Skapa konto" / "Logga in" (→ /login)
 * - Gratis-alternativ: "Prova gratis" (→ /prova, publik inloggningsfri trial)
 *
 * OBS: /prova är den publika trial-sluggen (plan='trial', vattenmärks senare).
 * Partnerlänken /johanna (plan='free_comp') lämnas orörd och fungerar separat.
 */
const FREE_MODE_URL = '/prova';

export default function LandingPage() {
  const site = useSiteConfig();
  const name = site.site_name || 'Enkel Etikett';

  useEffect(() => {
    document.title = `${name} – Etiketter för ditt bageri`;
  }, [name]);

  return (
    <div className="min-h-full bg-paper text-ink">
      {/* ---------- Toppnavigering ---------- */}
      <header className="border-b border-line bg-paper/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-paper">
              <span className="font-display text-lg font-bold">{name[0]}</span>
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold">{name}</div>
              {site.header_tagline && (
                <div className="text-[11px] uppercase tracking-[0.18em] text-ink/50">
                  {site.header_tagline}
                </div>
              )}
            </div>
          </div>
          <nav className="flex items-center gap-2" aria-label="Huvudmeny">
            <Link
              to="/login"
              className="btn btn-ghost text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              Logga in
            </Link>
            <Link
              to="/login"
              className="btn btn-primary text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              Skapa konto
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <span className="chip chip-allergen">För små bagerier</span>
            <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Designa och skriv ut etiketter för ditt bageri
            </h1>
            <p className="max-w-xl text-lg text-ink/70">
              Skapa snygga produktetiketter med innehållsförteckning, automatisk
              allergenmärkning och exakt mm-skala – och skriv ut direkt på din
              termoskrivare. Inget krångel, allt på svenska.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="btn btn-primary px-6 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
              >
                Skapa konto
              </Link>
              <Link
                to={FREE_MODE_URL}
                className="btn px-6 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
              >
                Prova gratis
              </Link>
            </div>
            <p className="text-sm text-ink/50">
              Inget kort krävs. Prova alla funktioner direkt i webbläsaren.
            </p>
          </div>

          {/* Dekorativ etikett-förhandsvisning */}
          <div className="flex justify-center lg:justify-end" aria-hidden="true">
            <div className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-cream to-paper p-8 shadow-[0_20px_60px_rgba(0,0,0,0.10)] ring-1 ring-black/5">
              <div className="rounded-md bg-white p-5 text-center shadow-[0_8px_30px_rgba(0,0,0,0.10)] ring-1 ring-black/5">
                <div className="font-display text-xl font-bold leading-tight">Kanelbulle</div>
                <div className="mt-1 text-xs text-ink/60">Nybakad med smör och kardemumma</div>
                <div className="my-3 border-t border-line" />
                <div className="text-left text-[11px] leading-relaxed text-ink/80">
                  <span className="font-semibold">Ingredienser:</span> Vetemjöl,
                  VATTEN, MJÖLK, smör, ÄGG, jäst, socker, kanel, salt.
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-ink/60">
                  <span>Bäst före 2026-06-25</span>
                  <span className="font-medium text-ink/80">85 g</span>
                </div>
                <div className="mt-3 flex justify-center gap-1">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span
                      key={i}
                      className="inline-block h-7 w-[2px] bg-ink"
                      style={{ opacity: i % 3 === 0 ? 1 : 0.55 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Funktioner ---------- */}
        <section className="border-t border-line bg-cream/40">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              Allt du behöver för proffsiga etiketter
            </h2>
            <p className="mt-2 max-w-2xl text-ink/70">
              Byggt för bagerier – från enstaka kakor till hela sortimentet.
            </p>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: 'Designa etiketter',
                  body: 'Flera layouter, typografi och egen logga – allt med levande förhandsvisning.',
                },
                {
                  title: 'Innehåll & allergener',
                  body: 'Sök bland 150+ ingredienser. Allergener markeras automatiskt i VERSALER.',
                },
                {
                  title: 'Skriv ut på termoskrivare',
                  body: 'Exakt mm-skala för skarp utskrift, eller exportera till PDF och PNG.',
                },
                {
                  title: 'White-label',
                  body: 'Sätt ditt eget namn, dina färger och din logga – etiketterna blir dina.',
                },
              ].map((f) => (
                <li key={f.title} className="card p-5">
                  <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-ink/70">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Så funkar det ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Så funkar det</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Kom igång',
                body: 'Skapa ett konto eller prova gratis direkt i webbläsaren – inget kort krävs.',
              },
              {
                step: '2',
                title: 'Designa din etikett',
                body: 'Fyll i produkt, ingredienser och format. Se resultatet uppdateras direkt.',
              },
              {
                step: '3',
                title: 'Skriv ut eller exportera',
                body: 'Skriv ut på din termoskrivare i exakt storlek, eller spara som PDF och PNG.',
              },
            ].map((s) => (
              <li key={s.step} className="flex flex-col gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink font-display text-lg font-bold text-paper">
                  {s.step}
                </span>
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-ink/70">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Galleri ---------- */}
        <GallerySection />

        {/* ---------- Avslutande CTA ---------- */}
        <section className="border-t border-line bg-ink text-paper">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-16 text-center">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              Redo att skapa dina första etiketter?
            </h2>
            <p className="max-w-xl text-paper/70">
              Börja gratis idag och uppgradera när du vill spara ditt arbete i molnet.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="btn border-paper bg-paper px-6 py-3 text-base text-ink hover:bg-paper/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/50"
              >
                Skapa konto
              </Link>
              <Link
                to={FREE_MODE_URL}
                className="btn border-paper/30 bg-transparent px-6 py-3 text-base text-paper shadow-none hover:bg-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/50"
              >
                Prova gratis
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Sidfot ---------- */}
      <footer className="border-t border-line bg-paper py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-5 text-xs text-ink/50">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {site.instagram_url && (
            <a
              href={site.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink/70 transition hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
          )}
          <span>{site.footer_text || `${name} · ${site.header_tagline}`}</span>
        </div>
        <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
