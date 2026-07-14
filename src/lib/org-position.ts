import type { Locale } from "@/lib/i18n/config";

export type OrgNodeLite = {
  id: string;
  title: string;
  parent_id: string | null;
  assigned_profile_id: string | null;
};

export type OrgPosition = {
  title: string;
  section: string | null;
};

// Same lookup the header profile chip uses: find the active org node assigned
// to this person, then its immediate parent for the section/department name.
export function resolveOrgPosition(profileId: string, nodes: OrgNodeLite[]): OrgPosition | null {
  const node = nodes.find((n) => n.assigned_profile_id === profileId);
  if (!node) return null;
  const parent = node.parent_id ? (nodes.find((n) => n.id === node.parent_id) ?? null) : null;
  return { title: node.title, section: parent?.title ?? null };
}

// "Position, Section" when an org node is assigned; null otherwise (no
// position held).
export function formatPositionLabel(position: OrgPosition | null, locale: Locale): string | null {
  if (!position) return null;
  return position.section ? `${position.title}${locale === "ar" ? "، " : ", "}${position.section}` : position.title;
}
