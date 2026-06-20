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
import type { FieldKey, FieldStyle } from '../types';

interface Props {
  order: FieldKey[];
  fields: Record<FieldKey, FieldStyle>;
  onChange: (order: FieldKey[]) => void;
}

const LABELS: Record<string, string> = {
  bakeryName: 'Bageri / företag',
  productName: 'Produktnamn',
  productDescription: 'Produktbeskrivning',
  meta: 'Vikt & pris',
  ingredientsList: 'Ingredienser',
  allergenSeparate: '"Innehåller: …"',
  bakedDate: 'Bakat (datum)',
  bestBefore: 'Bäst före',
  storage: 'Förvaring',
  extraText: 'Övrig text',
  nutrition: 'Näringsvärde',
};

export function FieldOrderPanel({ order, fields, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id as FieldKey);
    const newIdx = order.indexOf(over.id as FieldKey);
    if (oldIdx >= 0 && newIdx >= 0) onChange(arrayMove(order, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1.5">
          {order.map((key) => (
            <Row key={key} fieldKey={key} hidden={!(fields[key]?.visible ?? true)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ fieldKey, hidden }: { fieldKey: FieldKey; hidden: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fieldKey,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-1.5 ${
        hidden ? 'opacity-50' : ''
      }`}
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
      <span className="flex-1 truncate text-sm">{LABELS[fieldKey] ?? fieldKey}</span>
      {hidden && (
        <span className="text-[10px] uppercase tracking-wide text-ink/40">dold</span>
      )}
    </li>
  );
}
