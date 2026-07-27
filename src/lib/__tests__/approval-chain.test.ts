import { resolveApprovalChain, resolveLegacyRequiredApprovers } from "@/lib/approval-chain";
import type { ApprovalChainStep, OrgNode } from "@/types";

// A minimal fake of the one Supabase chain shape approval-chain.ts actually
// uses: .from("org_nodes").select(...).eq(k1, v1).eq(k2, v2).maybeSingle().
// Filters accumulate across .eq() calls and are matched against the fixture
// rows on .maybeSingle() — enough to faithfully exercise the real resolution
// logic without a live database, per the mock-with-jest.fn() rule for this
// pass.
interface FakeQueryBuilder {
  select: (columns: string) => FakeQueryBuilder;
  eq: (key: string, value: unknown) => FakeQueryBuilder;
  maybeSingle: () => Promise<{ data: Partial<OrgNode> | null }>;
}

function fakeSupabase(nodes: Partial<OrgNode>[]) {
  return {
    from: jest.fn((table: string) => {
      if (table !== "org_nodes") throw new Error(`unexpected table: ${table}`);
      const filters: Record<string, unknown> = {};
      const builder: FakeQueryBuilder = {
        select: jest.fn(() => builder),
        eq: jest.fn((key: string, value: unknown) => {
          filters[key] = value;
          return builder;
        }),
        maybeSingle: jest.fn(async () => {
          const match = nodes.find((n) => Object.entries(filters).every(([k, v]) => (n as Record<string, unknown>)[k] === v));
          return { data: match ?? null };
        }),
      };
      return builder;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  };
}

function node(overrides: Partial<OrgNode>): OrgNode {
  return {
    id: "node-id",
    title: "Position",
    parent_id: null,
    assigned_profile_id: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("resolveApprovalChain", () => {
  it("resolves an empty chain to no approvers", async () => {
    const supabase = fakeSupabase([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveApprovalChain(supabase as any, [], "submitter-1");
    expect(result).toEqual({ ok: true, approverIds: [] });
  });

  it("resolves a node step to whoever currently holds that position", async () => {
    const nodes = [node({ id: "node-a", title: "HR Manager", assigned_profile_id: "profile-a" })];
    const chain: ApprovalChainStep[] = [{ type: "node", node_id: "node-a", label: "HR Manager" }];
    const supabase = fakeSupabase(nodes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveApprovalChain(supabase as any, chain, "submitter-1");
    expect(result).toEqual({ ok: true, approverIds: ["profile-a"] });
  });

  it("blocks submission when a node step's position is vacant", async () => {
    const nodes = [node({ id: "node-a", title: "HR Manager", assigned_profile_id: null })];
    const chain: ApprovalChainStep[] = [{ type: "node", node_id: "node-a", label: "HR Manager" }];
    const supabase = fakeSupabase(nodes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveApprovalChain(supabase as any, chain, "submitter-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("HR Manager");
      expect(result.message).toContain("vacant");
    }
  });

  it("falls back to the step's label when the node itself can't be found (inactive/deleted)", async () => {
    const chain: ApprovalChainStep[] = [{ type: "node", node_id: "missing-node", label: "Registrar" }];
    const supabase = fakeSupabase([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveApprovalChain(supabase as any, chain, "submitter-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Registrar");
  });

  it("resolves a direct_manager step to the submitter's parent position holder", async () => {
    const nodes = [
      node({ id: "node-mine", assigned_profile_id: "submitter-1", parent_id: "node-parent" }),
      node({ id: "node-parent", title: "Dean", assigned_profile_id: "profile-dean" }),
    ];
    const chain: ApprovalChainStep[] = [{ type: "direct_manager", label: "Direct Manager" }];
    const supabase = fakeSupabase(nodes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveApprovalChain(supabase as any, chain, "submitter-1");
    expect(result).toEqual({ ok: true, approverIds: ["profile-dean"] });
  });

  it("blocks submission when the submitter holds no position at all", async () => {
    const chain: ApprovalChainStep[] = [{ type: "direct_manager", label: "Direct Manager" }];
    const supabase = fakeSupabase([]); // submitter has no org_nodes row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveApprovalChain(supabase as any, chain, "submitter-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Direct Manager");
  });

  it("blocks submission when the submitter's position has no parent", async () => {
    const nodes = [node({ id: "node-mine", assigned_profile_id: "submitter-1", parent_id: null })];
    const chain: ApprovalChainStep[] = [{ type: "direct_manager", label: "Direct Manager" }];
    const supabase = fakeSupabase(nodes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveApprovalChain(supabase as any, chain, "submitter-1");
    expect(result.ok).toBe(false);
  });

  it("de-duplicates approver ids when multiple steps resolve to the same person", async () => {
    const nodes = [
      node({ id: "node-a", assigned_profile_id: "profile-x" }),
      node({ id: "node-b", assigned_profile_id: "profile-x" }),
    ];
    const chain: ApprovalChainStep[] = [
      { type: "node", node_id: "node-a", label: "A" },
      { type: "node", node_id: "node-b", label: "B" },
    ];
    const supabase = fakeSupabase(nodes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resolveApprovalChain(supabase as any, chain, "submitter-1");
    expect(result).toEqual({ ok: true, approverIds: ["profile-x"] });
  });
});

describe("resolveLegacyRequiredApprovers", () => {
  it("returns an empty array for a form with no legacy approvers", () => {
    expect(resolveLegacyRequiredApprovers([])).toEqual([]);
  });

  it("de-duplicates a literal approver id list", () => {
    expect(resolveLegacyRequiredApprovers(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
});
