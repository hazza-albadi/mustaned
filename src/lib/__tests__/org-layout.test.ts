import { layoutOrgNodes } from "@/lib/org-layout";
import type { OrgNode } from "@/types";

// dagre's exact pixel output is an internal implementation detail of that
// library, not app logic — asserting specific x/y coordinates here would
// just be a brittle test of dagre's version, not of anything this codebase
// controls. What actually matters (and is genuinely this app's logic) is
// that the parent_id hierarchy is translated into the right node/edge shape.
function node(overrides: Partial<OrgNode>): OrgNode {
  return {
    id: "id",
    title: "Title",
    parent_id: null,
    assigned_profile_id: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("layoutOrgNodes", () => {
  it("returns one flow node per org node, each carrying its own data", () => {
    const nodes = [node({ id: "a" }), node({ id: "b", parent_id: "a" })];
    const { nodes: flowNodes } = layoutOrgNodes(nodes);
    expect(flowNodes).toHaveLength(2);
    expect(flowNodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(flowNodes.find((n) => n.id === "b")?.data.node.parent_id).toBe("a");
  });

  it("creates no edges for a root-only tree", () => {
    const nodes = [node({ id: "a" }), node({ id: "b" })];
    const { edges } = layoutOrgNodes(nodes);
    expect(edges).toHaveLength(0);
  });

  it("creates exactly one edge per parent-child relationship", () => {
    const nodes = [node({ id: "a" }), node({ id: "b", parent_id: "a" }), node({ id: "c", parent_id: "a" })];
    const { edges } = layoutOrgNodes(nodes);
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => `${e.source}->${e.target}`).sort()).toEqual(["a->b", "a->c"]);
  });

  it("marks every node non-draggable (layout is derived, never manual)", () => {
    const { nodes: flowNodes } = layoutOrgNodes([node({ id: "a" })]);
    expect(flowNodes.every((n) => n.draggable === false)).toBe(true);
  });
});
