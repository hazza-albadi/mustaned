"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrgFlowNode, type OrgFlowNodeData } from "@/components/org/org-flow-node";
import { OrgFlowEdge, type OrgFlowEdgeData } from "@/components/org/org-flow-edge";
import { OrgNodeEditDialog } from "@/components/org/org-node-edit-dialog";
import { AddPositionDialog } from "@/components/org/add-position-dialog";
import { useI18n } from "@/lib/i18n/config";
import { layoutOrgNodes } from "@/lib/org-layout";
import type { FormDefinition, OrgNode, Profile } from "@/types";
import { AlertTriangle, Crosshair, Plus, Search, X } from "lucide-react";

const nodeTypes = { orgNode: OrgFlowNode };
const edgeTypes = { orgEdge: OrgFlowEdge };

// How long the traveling dot takes to reach the child node before the edge
// locks into its bold static state — matches the <animateMotion dur> below.
const PULSE_DURATION_MS = 450;

function OrgFlowCanvas({
  nodes,
  selectedNodeId,
  onEditRequest,
}: {
  nodes: OrgNode[];
  selectedNodeId: string | null;
  onEditRequest: (node: OrgNode) => void;
}) {
  const { t } = useI18n();
  const { fitView } = useReactFlow();
  const [query, setQuery] = useState("");
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [pulseSettled, setPulseSettled] = useState(false);

  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => layoutOrgNodes(nodes), [nodes]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter((n) => n.title.toLowerCase().includes(q));
  }, [nodes, query]);
  const matchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);

  // Searching and click-to-focus are separate exploration modes — starting a
  // search clears any active focus so their dim/highlight states don't fight.
  useEffect(() => {
    if (query) setFocusNodeId(null);
  }, [query]);

  // Re-arm the traveling pulse every time the focused node changes (including
  // re-selecting the same node after clearing it) — settle to the bold static
  // edge state shortly after the dot would have arrived.
  useEffect(() => {
    if (!focusNodeId) return;
    setPulseSettled(false);
    const timer = setTimeout(() => setPulseSettled(true), PULSE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [focusNodeId]);

  const directChildrenIds = useMemo(() => {
    if (!focusNodeId) return new Set<string>();
    return new Set(nodes.filter((n) => n.parent_id === focusNodeId).map((n) => n.id));
  }, [nodes, focusNodeId]);

  const flowNodes: Node<OrgFlowNodeData>[] = useMemo(
    () =>
      baseNodes.map((n) => {
        const isFocused = n.id === focusNodeId;
        const isChild = directChildrenIds.has(n.id);
        return {
          ...n,
          selected: n.id === selectedNodeId,
          data: {
            node: nodeById.get(n.id)!,
            highlighted: matchIds.size > 0 ? matchIds.has(n.id) : n.id === selectedNodeId,
            dimmed: matchIds.size > 0 && !matchIds.has(n.id),
            focusState: isFocused ? "focused" : isChild ? "child" : "none",
            focusDimmed: !!focusNodeId && !isFocused && !isChild,
            onEditRequest: () => onEditRequest(nodeById.get(n.id)!),
          },
        };
      }),
    [baseNodes, nodeById, matchIds, selectedNodeId, focusNodeId, directChildrenIds, onEditRequest]
  );

  const edges: Edge<OrgFlowEdgeData>[] = useMemo(
    () =>
      baseEdges.map((edge) => {
        const isActiveBranch = !!focusNodeId && edge.source === focusNodeId && directChildrenIds.has(edge.target);
        return {
          ...edge,
          data: {
            active: isActiveBranch,
            settled: isActiveBranch && pulseSettled,
            dimmed: !!focusNodeId && !isActiveBranch,
            activationKey: focusNodeId ?? "",
          },
        };
      }),
    [baseEdges, focusNodeId, directChildrenIds, pulseSettled]
  );

  const handleNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    setFocusNodeId((prev) => (prev === node.id ? null : node.id));
  }, []);

  function fitToNode(id: string) {
    fitView({ nodes: [{ id }], duration: 400, maxZoom: 1.25, padding: 2 });
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={() => setFocusNodeId(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls position="bottom-right" showInteractive={false} />
      <MiniMap position="bottom-right" style={{ bottom: 96 }} pannable zoomable />

      <Panel position="top-left" className="w-64 rounded-lg border bg-card p-2 shadow-md">
        <div className="relative">
          <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("org.searchPlaceholder", "Search positions...")}
            className="h-8 ps-7 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {query && (
          <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => fitToNode(m.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-xs hover:bg-accent"
                >
                  <span className="min-w-0 truncate">{m.title}</span>
                  <Crosshair className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        )}
      </Panel>
    </ReactFlow>
  );
}

export function OrgTreeContent({
  nodes,
  profiles,
  forms,
}: {
  nodes: OrgNode[];
  profiles: Profile[];
  forms: Pick<FormDefinition, "id" | "title" | "approval_chain">[];
}) {
  const { t } = useI18n();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<OrgNode | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const assignedProfileIds = useMemo(
    () => new Set(nodes.filter((n) => n.assigned_profile_id).map((n) => n.assigned_profile_id as string)),
    [nodes]
  );
  const unassignedProfiles = useMemo(
    () => profiles.filter((p) => p.is_active && !assignedProfileIds.has(p.id)),
    [profiles, assignedProfileIds]
  );

  const vacantCount = nodes.filter((n) => n.is_active && !n.assigned_profile_id).length;

  function openEdit(node: OrgNode) {
    setSelectedNodeId(node.id);
    setEditTarget(node);
    setEditOpen(true);
  }

  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col lg:-m-6">
      <div className="space-y-3 border-b bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t("org.title", "Org Chart")}</h1>
          <Button className="gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> {t("org.addPosition", "Add Position")}
          </Button>
        </div>

        {vacantCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-utas-gold/40 bg-utas-gold/10 px-3 py-2 text-sm font-medium text-[color-mix(in_oklch,var(--utas-gold),black_45%)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {vacantCount} {t("org.vacantSuffix", "position(s) are currently vacant")}
          </div>
        )}
      </div>

      <div className="relative flex-1">
        {nodes.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("org.empty", 'No positions yet. Click "Add Position" to build your org chart.')}
          </p>
        ) : (
          <ReactFlowProvider>
            <OrgFlowCanvas nodes={nodes} selectedNodeId={selectedNodeId} onEditRequest={openEdit} />
          </ReactFlowProvider>
        )}
      </div>

      <OrgNodeEditDialog
        node={editTarget}
        allNodes={nodes}
        profileMap={profileMap}
        unassignedProfiles={unassignedProfiles}
        forms={forms}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AddPositionDialog
        allNodes={nodes}
        unassignedProfiles={unassignedProfiles}
        defaultParentId={selectedNodeId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}
