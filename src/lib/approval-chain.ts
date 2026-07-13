import type { createClient } from "@/lib/supabase/client";
import type { ApprovalChainStep, OrgNode } from "@/types";

export type ApprovalChainResolution =
  | { ok: true; approverIds: string[] }
  | { ok: false; message: string };

// Resolves a form's node-based approval_chain to the profile ids currently
// holding each step's position — never persisted, always re-resolved at
// submission time so routing reflects who holds a role today. Any step whose
// position is vacant (no assigned_profile_id, or the node was deactivated)
// blocks the whole submission.
export async function resolveApprovalChain(
  supabase: ReturnType<typeof createClient>,
  chain: ApprovalChainStep[],
  submitterProfileId: string
): Promise<ApprovalChainResolution> {
  const nodeCache = new Map<string, OrgNode | null>();

  async function fetchNode(id: string): Promise<OrgNode | null> {
    if (nodeCache.has(id)) return nodeCache.get(id) ?? null;
    const { data } = await supabase
      .from("org_nodes")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    const node = (data as OrgNode | null) ?? null;
    nodeCache.set(id, node);
    return node;
  }

  const { data: myNodeRow } = await supabase
    .from("org_nodes")
    .select("*")
    .eq("assigned_profile_id", submitterProfileId)
    .eq("is_active", true)
    .maybeSingle();
  const myNode = (myNodeRow as OrgNode | null) ?? null;

  const approverIds: string[] = [];

  for (const step of chain) {
    if (step.type === "node") {
      const node = await fetchNode(step.node_id);
      if (!node || !node.assigned_profile_id) {
        return {
          ok: false,
          message: `Cannot submit: the position '${node?.title ?? step.label}' is currently vacant. Please contact your administrator.`,
        };
      }
      approverIds.push(node.assigned_profile_id);
    } else {
      const parentId = myNode?.parent_id ?? null;
      const parent = parentId ? await fetchNode(parentId) : null;
      if (!parent || !parent.assigned_profile_id) {
        return {
          ok: false,
          message: `Cannot submit: the position '${parent?.title ?? "Direct Manager"}' is currently vacant. Please contact your administrator.`,
        };
      }
      approverIds.push(parent.assigned_profile_id);
    }
  }

  return { ok: true, approverIds: Array.from(new Set(approverIds)) };
}

// Backward-compat fallback for forms saved before approval_chain existed —
// required_approvers previously stored literal approver profile ids (the
// short-lived DYNAMIC_DEPT_HEAD sentinel has been retired along with the
// node-based routing above).
export function resolveLegacyRequiredApprovers(requiredApprovers: string[]): string[] {
  return Array.from(new Set(requiredApprovers));
}
