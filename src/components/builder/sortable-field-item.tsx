"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/config";
import type { FormField } from "@/types";
import { GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortableFieldItem({
  field,
  selected,
  onSelect,
  onDelete,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Wrap with a plain <div> so setNodeRef reaches the real DOM node.
  // shadcn v4 Card is NOT forwardRef (designed for React 19 ref-as-prop),
  // so passing ref to Card in React 18 silently drops the ref — dnd-kit never
  // learns the element's position and the sensor gets stuck.
  return (
    <div ref={setNodeRef} style={style}>
      <Card
        onClick={onSelect}
        className={cn(
          "flex cursor-pointer items-start gap-2 p-3 transition-colors",
          selected && "border-primary ring-1 ring-primary",
          isDragging && "opacity-50"
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{field.label || "Untitled question"}</p>
            {field.required && (
              <span className="text-red-500" aria-label="required">
                *
              </span>
            )}
          </div>
          <Badge variant="secondary" className="mt-1 text-xs">
            {t(`builder.fieldTypeLabels.${field.type}`)}
          </Badge>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Card>
    </div>
  );
}
