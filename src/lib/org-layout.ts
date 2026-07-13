import dagre from "dagre";
import type { Edge, Node } from "reactflow";
import type { OrgNode } from "@/types";

export const ORG_NODE_WIDTH = 208;
export const ORG_NODE_HEIGHT = 92;

// Computes a top-down tree layout from parent_id relationships using dagre
// (the same layout engine n8n uses) — node positions are purely derived from
// the hierarchy, never user-draggable.
export function layoutOrgNodes(nodes: OrgNode[]): { nodes: Node[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 72 });

  for (const node of nodes) {
    graph.setNode(node.id, { width: ORG_NODE_WIDTH, height: ORG_NODE_HEIGHT });
  }
  for (const node of nodes) {
    if (node.parent_id) graph.setEdge(node.parent_id, node.id);
  }

  dagre.layout(graph);

  const flowNodes: Node[] = nodes.map((node) => {
    const { x, y } = graph.node(node.id);
    return {
      id: node.id,
      type: "orgNode",
      position: { x: x - ORG_NODE_WIDTH / 2, y: y - ORG_NODE_HEIGHT / 2 },
      data: { node },
      draggable: false,
    };
  });

  // Base geometry only — click-to-focus styling (color/width/opacity/pulse)
  // is layered on at render time in OrgFlowCanvas, since it depends on
  // interaction state that changes far more often than the tree shape does.
  const flowEdges: Edge[] = nodes
    .filter((node): node is OrgNode & { parent_id: string } => Boolean(node.parent_id))
    .map((node) => ({
      id: `${node.parent_id}->${node.id}`,
      source: node.parent_id,
      target: node.id,
      type: "orgEdge",
    }));

  return { nodes: flowNodes, edges: flowEdges };
}
