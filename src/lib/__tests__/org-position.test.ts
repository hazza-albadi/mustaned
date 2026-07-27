import { formatPositionLabel, resolveOrgPosition, type OrgNodeLite } from "@/lib/org-position";

describe("resolveOrgPosition", () => {
  const nodes: OrgNodeLite[] = [
    { id: "dean", title: "Dean", parent_id: null, assigned_profile_id: "profile-dean" },
    { id: "hr-manager", title: "HR Manager", parent_id: "dean", assigned_profile_id: "profile-hr" },
    { id: "vacant-node", title: "Vacant Role", parent_id: "dean", assigned_profile_id: null },
  ];

  it("returns null when the profile holds no position", () => {
    expect(resolveOrgPosition("unassigned-profile", nodes)).toBeNull();
  });

  it("resolves a position with a parent section", () => {
    expect(resolveOrgPosition("profile-hr", nodes)).toEqual({ title: "HR Manager", section: "Dean" });
  });

  it("resolves a top-level position (no parent) with a null section", () => {
    expect(resolveOrgPosition("profile-dean", nodes)).toEqual({ title: "Dean", section: null });
  });
});

describe("formatPositionLabel", () => {
  it("returns null for no position", () => {
    expect(formatPositionLabel(null, "en")).toBeNull();
  });

  it("formats 'Title, Section' in English", () => {
    expect(formatPositionLabel({ title: "HR Manager", section: "Dean" }, "en")).toBe("HR Manager, Dean");
  });

  it("formats with the Arabic separator in Arabic", () => {
    expect(formatPositionLabel({ title: "مدير", section: "عميد" }, "ar")).toBe("مدير، عميد");
  });

  it("returns just the title when there's no section", () => {
    expect(formatPositionLabel({ title: "Dean", section: null }, "en")).toBe("Dean");
  });
});
