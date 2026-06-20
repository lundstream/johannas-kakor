import { useEffect, useState } from 'react';
import { api, ApiError, type GalleryTag, type MyGallery, type MyUpload } from '../api';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const UPLOAD_ERRORS: Record<string, string> = {
  premium_required: 'Galleriet är en premiumfunktion.',
  too_large: 'Bilden är för stor (max 8 MB).',
  unsupported_format: 'Filformatet stöds inte. Använd JPEG, PNG eller WebP.',
  invalid_image: 'Kunde inte läsa bilden. Försök med en annan fil.',
  invalid_link: 'Länken måste vara en giltig https-adress.',
  invalid_input: 'Något i formuläret var ogiltigt.',
};

const STATUS: Record<MyUpload['status'], { label: string; cls: string }> = {
  pending: { label: 'Väntar på granskning', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Publicerad', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Nekad', cls: 'bg-red-100 text-red-700' },
};

export function GalleryAccountPanel() {
  const [data, setData] = useState<MyGallery | null>(null);
  const [tags, setTags] = useState<GalleryTag[]>([]);
  const [labelTags, setLabelTags] = useState<string[]>([]);
  const [savingOptIn, setSavingOptIn] = useState(false);

  const refresh = async () => {
    const [g, t] = await Promise.all([
      api.get<MyGallery>('/api/me/gallery'),
      api.get<{ tags: GalleryTag[] }>('/api/public/gallery/tags'),
    ]);
    setData(g);
    setLabelTags(g.labelTags);
    setTags(t.tags);
  };

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  if (!data) return null;

  const saveOptIn = async (showInGallery: boolean, nextTags: string[]) => {
    setSavingOptIn(true);
    try {
      await api.put('/api/me/gallery', { showInGallery, tags: nextTags });
      await refresh();
    } catch {
      /* surfaced via refresh state */
    } finally {
      setSavingOptIn(false);
    }
  };

  const toggleLabelTag = (id: string) => {
    setLabelTags((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, 6)));
  };

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-display text-lg font-semibold">Galleri</h2>
      <p className="mb-3 text-sm text-ink/60">
        Visa upp dina etiketter och produkter på startsidan. En premiumfunktion.
      </p>

      {!data.premium && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Galleriet ingår i premium. Uppgradera för att visa dina etiketter och ladda upp bilder.
        </div>
      )}

      {/* Part 1: opt-in + label tags */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-cream/40 p-3">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-ink"
            disabled={!data.premium || savingOptIn || !data.hasLabel}
            checked={data.showInGallery}
            onChange={(e) => saveOptIn(e.target.checked, labelTags)}
          />
          <span>Visa min etikett i galleriet</span>
        </label>
        {!data.hasLabel && (
          <p className="text-xs text-ink/50">Skapa och spara en etikett först för att kunna visa den.</p>
        )}
        <div>
          <div className="mb-1 text-xs text-ink/60">Kategorier (för filtrering)</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <TagChip key={t.id} active={labelTags.includes(t.id)} disabled={!data.premium} onClick={() => toggleLabelTag(t.id)}>
                {t.label}
              </TagChip>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary self-start text-sm"
          disabled={!data.premium || savingOptIn}
          onClick={() => saveOptIn(data.showInGallery, labelTags)}
        >
          {savingOptIn ? 'Sparar…' : 'Spara galleriinställningar'}
        </button>
      </div>

      {/* Part 2: uploads */}
      <div className="mt-5">
        <h3 className="mb-2 font-display text-base font-semibold">Ladda upp bild</h3>
        <p className="mb-3 text-xs text-ink/60">
          Ladda upp ett foto av din färdiga produkt. Bilder granskas av oss innan de visas publikt.
        </p>
        <UploadForm tags={tags} disabled={!data.premium} onUploaded={refresh} />
      </div>

      {/* My uploads */}
      {data.uploads.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-display text-base font-semibold">Mina uppladdningar</h3>
          <ul className="flex flex-col gap-2">
            {data.uploads.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
                <img
                  src={u.imageUrl || `/api/me/gallery/uploads/${u.id}/preview`}
                  alt=""
                  className="h-12 w-12 rounded-md object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{u.caption || 'Utan beskrivning'}</div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${STATUS[u.status].cls}`}>
                    {STATUS[u.status].label}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  onClick={async () => {
                    if (!confirm('Ta bort den här uppladdningen?')) return;
                    await api.del(`/api/me/gallery/uploads/${u.id}`);
                    await refresh();
                  }}
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TagChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
        active ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink/70 hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  );
}

function UploadForm({
  tags,
  disabled,
  onUploaded,
}: {
  tags: GalleryTag[];
  disabled?: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, 6)));

  const readAsDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('read_failed'));
      r.readAsDataURL(f);
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (!file) return setError('Välj en bild först.');
    if (file.size > MAX_UPLOAD_BYTES) return setError(UPLOAD_ERRORS.too_large);
    setBusy(true);
    try {
      const imageBase64 = await readAsDataUrl(file);
      await api.post('/api/me/gallery/uploads', {
        imageBase64,
        caption: caption || undefined,
        linkUrl: linkUrl || undefined,
        tags: picked,
      });
      setFile(null);
      setCaption('');
      setLinkUrl('');
      setPicked([]);
      setDone(true);
      await onUploaded();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'invalid_image';
      setError(UPLOAD_ERRORS[code] || 'Uppladdningen misslyckades.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-line bg-cream/40 p-3">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || busy}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="text-xs"
      />
      <input
        className="input text-sm"
        placeholder="Beskrivning (valfritt)"
        maxLength={200}
        value={caption}
        disabled={disabled || busy}
        onChange={(e) => setCaption(e.target.value)}
      />
      <input
        className="input text-sm"
        placeholder="Länk till din sida (https://, valfritt)"
        value={linkUrl}
        disabled={disabled || busy}
        onChange={(e) => setLinkUrl(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <TagChip key={t.id} active={picked.includes(t.id)} disabled={disabled} onClick={() => toggle(t.id)}>
            {t.label}
          </TagChip>
        ))}
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {done && <div className="text-sm text-green-700">Tack! Bilden skickades in för granskning.</div>}
      <button type="submit" className="btn btn-primary self-start text-sm" disabled={disabled || busy}>
        {busy ? 'Laddar upp…' : 'Skicka in för granskning'}
      </button>
    </form>
  );
}
