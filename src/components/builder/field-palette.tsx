"use client";

import { useDraggable } from "@dnd-kit/core";
import { useI18n } from "@/lib/i18n/config";
import { FIELD_TYPES } from "@/lib/form-fields";
import { cn } from "@/lib/utils";
import type { FieldType } from "@/types";
import {
  Type,
  AlignLeft,
  Hash,
  Mail,
  Calendar,
  ChevronDown,
  CheckSquare,
  Circle,
  Paperclip,
  Heading,
  Image as ImageIcon,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Type,
  AlignLeft,
  Hash,
  Mail,
  Calendar,
  ChevronDown,
  CheckSquare,
  Circle,
  Paperclip,
  Heading,
  Image: ImageIcon,
  Table: TableIcon,
};

function PaletteItem({ type, icon }: { type: FieldType; icon: string }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { isPalette: true, fieldType: type },
  });
  const Icon = ICONS[icon];

  // Use a plain <div> so setNodeRef reaches the DOM node directly.
  // shadcn v4 Card is not forwardRef and React 18 drops the ref silently.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm",
        "text-card-foreground ring-1 ring-foreground/10 hover:border-primary/50 hover:bg-accent active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {t(`builder.fieldTypeLabels.${type}`)}
    </div>
  );
}

export function FieldPalette() {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{t("builder.fieldTypes")}</h3>
      <div className="space-y-2">
        {FIELD_TYPES.map((f) => (
          <PaletteItem key={f.type} type={f.type} icon={f.icon} />
        ))}
      </div>
    </div>
  );
}
