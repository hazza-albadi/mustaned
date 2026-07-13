"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { ApprovalChainStep, OrgNode } from "@/types";
import { AlertTriangle, GripVertical, Plus, Search, User, Users, X } from "lucide-react";

function stepKey(step: ApprovalChainStep): string {
  return step.type === "node" ? `node:${step.node_id}` : "direct_manager";
}

function ChainStepChip({
  step,
  index,
  vacant,
  onRemove,
}: {
  step: ApprovalChainStep;
  index: number;
  vacant: boolean;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stepKey(step),
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card px-3 py-2",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs font-semibold text-muted-foreground">{index + 1}.</span>
      {step.type === "direct_manager" ? (
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <User className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className="flex-1 text-sm font-medium">{step.label}</span>
      {vacant && (
        <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
          <AlertTriangle className="h-3 w-3" /> {t("builder.positionVacant", "This position is currently vacant")}
        </span>
      )}
      <button
        type="button"
        aria-label={`Remove ${step.label}`}
        onClick={onRemove}
        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ApprovalChainBuilder({
  orgNodes,
  value,
  onChange,
}: {
  orgNodes: OrgNode[];
  value: ApprovalChainStep[];
  onChange: (steps: ApprovalChainStep[]) => void;
}) {
  const { t } = useI18n();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const hasDirectManager = value.some((s) => s.type === "direct_manager");
  const usedNodeIds = new Set(
    value.filter((s): s is Extract<ApprovalChainStep, { type: "node" }> => s.type === "node").map((s) => s.node_id)
  );
  const availableNodes = orgNodes.filter((n) => !usedNodeIds.has(n.id));
  const nodeById = new Map(orgNodes.map((n) => [n.id, n]));

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableNodes;
    return availableNodes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
    );
  }, [availableNodes, search]);

  function closePicker(open: boolean) {
    setPickerOpen(open);
    if (!open) setSearch("");
  }

  function addNodeStep(node: OrgNode) {
    onChange([...value, { type: "node", node_id: node.id, label: node.title }]);
    closePicker(false);
  }

  function addDirectManagerStep() {
    if (hasDirectManager) return;
    onChange([...value, { type: "direct_manager", label: "Direct Manager" }]);
    closePicker(false);
  }

  function removeStep(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.findIndex((s) => stepKey(s) === active.id);
    const newIndex = value.findIndex((s) => stepKey(s) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(value, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={value.map(stepKey)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {value.map((step, index) => {
                const vacant = step.type === "node" ? !nodeById.get(step.node_id)?.assigned_profile_id : false;
                return (
                  <ChainStepChip
                    key={stepKey(step)}
                    step={step}
                    index={index}
                    vacant={vacant}
                    onRemove={() => removeStep(index)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Popover open={pickerOpen} onOpenChange={closePicker}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1">
            <Plus className="h-3.5 w-3.5" /> {t("builder.addStep", "Add Step")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="p-1.5">
            <button
              type="button"
              disabled={hasDirectManager}
              onClick={addDirectManagerStep}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {t("builder.directManager", "Direct Manager")}
              {hasDirectManager && (
                <span className="ms-auto text-xs text-muted-foreground">{t("builder.alreadyAdded", "Added")}</span>
              )}
            </button>
          </div>

          <div className="border-t p-1.5">
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
              {t("builder.specificPosition", "Specific Position")}
            </p>
            <div className="relative px-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("builder.searchPositions", "Search positions...")}
                className="h-8 ps-8 text-sm"
              />
            </div>
            <div className="mt-1 max-h-56 overflow-y-auto">
              {filteredNodes.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  {t("builder.noPositionsAvailable", "No positions available")}
                </p>
              ) : (
                filteredNodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => addNodeStep(n)}
                    className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent"
                  >
                    <span>{n.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{n.id.slice(0, 8)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
