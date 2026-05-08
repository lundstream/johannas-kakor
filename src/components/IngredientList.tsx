import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Ingredient } from '../types';
import { formatIngredient } from '../utils/allergens';

interface Props {
  items: Ingredient[];
  onChange: (items: Ingredient[]) => void;
}

export function IngredientList({ items, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx >= 0 && newIdx >= 0) onChange(arrayMove(items, oldIdx, newIdx));
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-cream/40 p-4 text-center text-sm text-ink/60">
        Inga ingredienser ännu. Sök ovan för att lägga till.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1.5">
          {items.map((ing) => (
            <Row
              key={ing.id}
              ing={ing}
              onRemove={() => onChange(items.filter((i) => i.id !== ing.id))}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ ing, onRemove }: { ing: Ingredient; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ing.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatted = formatIngredient(ing);
  const hasAllergen = (ing.allergens ?? []).length > 0 || formatted !== ing.name;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-1.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-7 w-5 cursor-grab items-center justify-center text-ink/30 hover:text-ink/70 active:cursor-grabbing"
        aria-label="Flytta"
        title="Dra för att ändra ordning"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
          <circle cx="5" cy="3" r="1.2" />
          <circle cx="11" cy="3" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="5" cy="13" r="1.2" />
          <circle cx="11" cy="13" r="1.2" />
        </svg>
      </button>

      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="truncate text-sm">
          <span className={hasAllergen ? 'font-medium' : ''}>{formatted}</span>
          {ing.custom && <span className="ml-2 text-[10px] uppercase tracking-wide text-ink/40">egen</span>}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {(ing.allergens ?? []).map((a) => (
            <span
              key={a}
              className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
            >
              {a}
            </span>
          ))}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-1 text-ink/40 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-700"
        aria-label="Ta bort"
        title="Ta bort"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}
