import { useEffect, useState } from 'react';
import { api, type AdminGalleryLabel, type AdminGalleryUpload, type GalleryTag } from '../api';

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};

export function GalleryAdminPanel() {
  const [labels, setLabels] = useState<AdminGalleryLabel[]>([]);
  const [uploads, setUploads] = useState<AdminGalleryUpload[]>([]);
  const [tagLabel, setTagLabel] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [g, t] = await Promise.all([
        api.get<{ labels: AdminGalleryLabel[]; uploads: AdminGalleryUpload[] }>('/api/admin/gallery'),
        api.get<{ tags: GalleryTag[] }>('/api/public/gallery/tags'),
      ]);
      setLabels(g.labels);
      setUploads(g.uploads);
      setTagLabel(Object.fromEntries(t.tags.map((x) => [x.id, x.label])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const patchUpload = async (id: number, body: Record<string, unknown>) => {
    await api.patch(`/api/admin/gallery/uploads/${id}`, body);
    await refresh();
  };
  const patchLabel = async (userId: number, body: Record<string, unknown>) => {
    await api.patch(`/api/admin/gallery/labels/${userId}`, body);
    await refresh();
  };
  const deleteUpload = async (id: number) => {
    if (!confirm('Delete this upload permanently?')) return;
    await api.del(`/api/admin/gallery/uploads/${id}`);
    await refresh();
  };

  const pending = uploads.filter((u) => u.status === 'pending');
  const reviewed = uploads.filter((u) => u.status !== 'pending');
  const renderTags = (ids: string[]) =>
    ids.map((t) => (
      <span key={t} className="rounded-full bg-cream px-2 py-0.5 text-[10px] text-ink/60">
        {tagLabel[t] || t}
      </span>
    ));

  if (loading) return <div className="text-sm text-ink/60">Loading gallery…</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Approval queue */}
      <div>
        <h3 className="mb-2 font-display text-sm font-semibold">
          Approval queue {pending.length > 0 && <span className="text-amber-700">({pending.length})</span>}
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-ink/50">No uploads awaiting review.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((u) => (
              <div key={u.id} className="flex flex-col gap-2 rounded-xl border border-line p-2">
                <img src={u.imageUrl} alt="" className="aspect-[4/3] w-full rounded-md object-contain bg-white" />
                <div className="text-xs text-ink/60">{u.email}</div>
                {u.caption && <div className="text-sm">{u.caption}</div>}
                {u.link && (
                  <a href={u.link.url} target="_blank" rel="nofollow noopener noreferrer" className="text-xs underline">
                    {u.link.domain}
                  </a>
                )}
                <div className="flex flex-wrap gap-1">{renderTags(u.tags)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button className="btn btn-primary text-xs" onClick={() => patchUpload(u.id, { status: 'approved' })}>
                    Approve
                  </button>
                  <button className="btn text-xs" onClick={() => patchUpload(u.id, { status: 'rejected' })}>
                    Reject
                  </button>
                  <button className="btn btn-danger text-xs" onClick={() => deleteUpload(u.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviewed uploads */}
      {reviewed.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-sm font-semibold">Reviewed uploads</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviewed.map((u) => (
              <div key={u.id} className="flex flex-col gap-2 rounded-xl border border-line p-2">
                <img src={u.imageUrl} alt="" className="aspect-[4/3] w-full rounded-md object-contain bg-white" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink/60">{u.email}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_CLS[u.status]}`}>{u.status}</span>
                </div>
                {u.caption && <div className="text-sm">{u.caption}</div>}
                <div className="flex flex-wrap gap-1">{renderTags(u.tags)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.status === 'approved' && (
                    <button className="btn text-xs" onClick={() => patchUpload(u.id, { hidden: !u.hidden })}>
                      {u.hidden ? 'Unhide' : 'Hide'}
                    </button>
                  )}
                  {u.status === 'rejected' && (
                    <button className="btn text-xs" onClick={() => patchUpload(u.id, { status: 'approved' })}>
                      Approve
                    </button>
                  )}
                  <button className="btn text-xs" onClick={() => patchUpload(u.id, { pinned: !u.pinned })}>
                    {u.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button className="btn btn-danger text-xs" onClick={() => deleteUpload(u.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opted-in labels */}
      <div>
        <h3 className="mb-2 font-display text-sm font-semibold">Opted-in labels</h3>
        {labels.length === 0 ? (
          <p className="text-sm text-ink/50">No tenants have opted in yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {labels.map((l) => (
              <div key={l.userId} className="flex flex-col gap-2 rounded-xl border border-line p-2">
                <img src={l.imageUrl} alt="" className="aspect-[4/3] w-full rounded-md object-contain bg-white" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink/60">{l.bakeryName || l.email}</span>
                  {!l.premium && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">not premium</span>}
                </div>
                <div className="flex flex-wrap gap-1">{renderTags(l.tags)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button className="btn text-xs" onClick={() => patchLabel(l.userId, { hidden: !l.hidden })}>
                    {l.hidden ? 'Unhide' : 'Hide'}
                  </button>
                  <button className="btn text-xs" onClick={() => patchLabel(l.userId, { pinned: !l.pinned })}>
                    {l.pinned ? 'Unpin' : 'Pin'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
