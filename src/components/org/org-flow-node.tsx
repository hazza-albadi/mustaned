"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { useI18n } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/types";
import { Pencil } from "lucide-react";

export type OrgFlowNodeData = {
  node: OrgNode;
  // Search-match ring — unrelated to click-to-focus, mutually exclusive with it.
  highlighted: boolean;
  dimmed: boolean;
  // Click-to-focus: "focused" is the clicked node itself, "child" is one of
  // its direct subordinates, "none" is everything else.
  focusState: "focused" | "child" | "none";
  // True when some other node is focused and this one isn't in that branch.
  focusDimmed: boolean;
  onEditRequest: () => void;
};

function OrgFlowNodeImpl({ data }: NodeProps<OrgFlowNodeData>) {
  const { t } = useI18n();
  const { node, highlighted, dimmed, focusState, focusDimmed, onEditRequest } = data;
  const isVacant = !node.assigned_profile_id;

  return (
    <div
      className={cn(
        "w-52 cursor-pointer select-none rounded-lg border bg-card p-3 shadow-sm transition-all",
        highlighted && "border-primary ring-2 ring-primary",
        dimmed && "opacity-25",
        !node.is_active && "opacity-50",
        focusState === "focused" && "org-node-pulse-focus",
        focusState === "child" && "border-2 border-utas-orange",
        focusDimmed && "opacity-40"
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-none !bg-border" />

      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 truncate text-sm font-semibold">{node.title}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditRequest();
          }}
          title={t("org.editPosition", "Edit Position")}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">{node.id.slice(0, 8)}</p>
      <div className="mt-2 flex items-center gap-1.5">
        {isVacant ? (
          <span className="inline-flex items-center rounded-full bg-utas-gold/15 px-2 py-0.5 text-[10px] font-medium text-[color-mix(in_oklch,var(--utas-gold),black_40%)]">
            {t("org.vacant", "Vacant")}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-utas-teal" /> {t("org.assigned", "Assigned")}
          </span>
        )}
        {!node.is_active && (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t("common.inactive")}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-none !bg-border" />
    </div>
  );
}

export const OrgFlowNode = memo(OrgFlowNodeImpl);
