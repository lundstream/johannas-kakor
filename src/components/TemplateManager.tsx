import { v4 as uuid } from 'uuid';
import type { LabelData, Template } from '../types';

interface Props {
  templates: Template[];
  onLoad: (data: LabelData) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  current: LabelData;
}

export function TemplateManager({ templates, onLoad, onSave, onDelete, onDuplicate }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          id="tpl-name"
          className="input"
          placeholder="Mallens namn (t.ex. Kanelbulle 85g)"
        />
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={() => {
            const el = document.getElementById('tpl-name') as HTMLInputElement | null;
            const name = (el?.value || '').trim();
            if (!name) {
              el?.focus();
              return;
            }
            onSave(name);
            if (el) el.value = '';
          }}
        >
          Spara mall
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-cream/40 px-3 py-4 text-center text-xs text-ink/60">
          Inga sparade mallar ännu.
        </div>
      ) : (
        <ul className="flex max-h-60 flex-col gap-1.5 overflow-auto">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-1.5"
            >
              <button
                type="button"
                onClick={() => onLoad({ ...t.data, id: uuid(), updatedAt: Date.now() })}
                className="flex flex-1 flex-col items-start truncate text-left"
                title="Ladda mall"
              >
                <span className="truncate text-sm">{t.name}</span>
                <span className="text-[10px] text-ink/50">
                  {t.data.size.label} · {t.data.ingredients.length} ingredienser
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost p-1 text-xs"
                title="Duplicera"
                onClick={() => onDuplicate(t.id)}
              >
                Dup
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-danger p-1 text-xs"
                title="Radera"
                onClick={() => onDelete(t.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
