import { useEffect, useMemo, useState } from 'react';
import { api, type GalleryItem, type GalleryTag } from '../api';

/**
 * Public showcase on the landing page: approved premium uploads + opted-in
 * rendered labels, filterable by the fixed taxonomy. Lazy: images use
 * loading="lazy" and the server returns cached/re-encoded renditions, so it
 * never blocks the hero. Falls back to a curated baseline so it's never empty.
 */
export function GallerySection() {
  const [tags, setTags] = useState<GalleryTag[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tags once.
  useEffect(() => {
    void api
      .get<{ tags: GalleryTag[] }>('/api/public/gallery/tags')
      .then((r) => setTags(r.tags))
      .catch(() => setTags([]));
  }, []);

  // Items on filter change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = active ? `?tag=${encodeURIComponent(active)}` : '';
    void api
      .get<{ items: GalleryItem[] }>(`/api/public/gallery${q}`)
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [active]);

  const tagLabel = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t.label])), [tags]);
  const showEmpty = !loading && items.length === 0;

  return (
    <section className="border-t border-line bg-cream/40" aria-labelledby="galleri-rubrik">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 id="galleri-rubrik" className="font-display text-2xl font-semibold sm:text-3xl">
          Senaste etiketter
        </h2>
        <p className="mt-2 max-w-2xl text-ink/70">
          Riktiga etiketter och produkter från bagerier som använder tjänsten.
        </p>

        {/* Filter chips */}
        {tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrera galleriet">
            <FilterChip active={active === null} onClick={() => setActive(null)}>
              Alla
            </FilterChip>
            {tags.map((t) => (
              <FilterChip key={t.id} active={active === t.id} onClick={() => setActive(t.id)}>
                {t.label}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-line/40" />
              ))
            : items.map((it) => <GalleryCard key={`${it.type}-${it.id}`} item={it} tagLabel={tagLabel} />)}
        </div>

        {showEmpty && <BaselineFallback />}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
        active ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink/70 hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  );
}

function GalleryCard({ item, tagLabel }: { item: GalleryItem; tagLabel: Record<string, string> }) {
  return (
    <figure className="card overflow-hidden p-0">
      <div className="aspect-[4/3] bg-white">
        <img
          src={item.imageUrl}
          alt={
            item.caption ||
            (item.attribution ? `Etikett från ${item.attribution}` : 'Etikett från ett bageri')
          }
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>
      <figcaption className="flex flex-col gap-1 p-3">
        {item.attribution && <span className="text-sm font-medium text-ink">{item.attribution}</span>}
        {item.caption && <span className="text-xs text-ink/60">{item.caption}</span>}
        {item.tags.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span key={t} className="rounded-full bg-cream px-2 py-0.5 text-[10px] text-ink/60">
                {tagLabel[t] || t}
              </span>
            ))}
          </span>
        )}
        {item.link && (
          // Public page: untrusted user link — nofollow, no referrer/opener, show domain only.
          <a
            href={item.link.url}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-ink/70 underline underline-offset-2 hover:text-ink"
          >
            {item.link.domain}
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/** Curated baseline so the section never looks empty (static, brand-on demo cards). */
function BaselineFallback() {
  const demos = [
    { name: 'Bageri Solrosen', product: 'Surdegsbröd', tag: 'Bröd' },
    { name: 'Kardemumman', product: 'Kanelbulle', tag: 'Bullar' },
    { name: 'Lilla Konditoriet', product: 'Citrontårta', tag: 'Tårtor' },
    { name: 'Skogsbacken', product: 'Havrekakor', tag: 'Småkakor' },
  ];
  return (
    <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {demos.map((d) => (
        <figure key={d.name} className="card overflow-hidden p-0">
          <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-cream to-paper p-4">
            <div className="w-full rounded-md bg-white p-3 text-center shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
              <div className="font-display text-sm font-bold leading-tight">{d.product}</div>
              <div className="mt-1 text-[10px] text-ink/50">Nybakat · {d.name}</div>
              <div className="mt-2 flex justify-center gap-0.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <span key={i} className="inline-block h-4 w-[2px] bg-ink" style={{ opacity: i % 3 === 0 ? 1 : 0.5 }} />
                ))}
              </div>
            </div>
          </div>
          <figcaption className="flex flex-col gap-1 p-3">
            <span className="text-sm font-medium text-ink">{d.name}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] text-ink/60">{d.tag}</span>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
