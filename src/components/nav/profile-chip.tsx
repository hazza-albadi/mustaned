"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ADMIN_PERMISSION_OPTIONS } from "@/lib/admin-permission-options";
import { MfaEnrollPanel } from "@/components/auth/mfa-enroll-panel";
import type { AdminPermission, Profile } from "@/types";

interface OrgPositionInfo {
  title: string;
  // Nearest ancestor first, root last — e.g. ["Networks Section", "IS Centre", "Deputy VC"].
  breadcrumb: string[];
}

export function ProfileChip({
  profile,
  permissions,
}: {
  profile: Profile;
  permissions: AdminPermission[];
}) {
  const { t } = useI18n();
  const supabase = createClient();
  // undefined = still loading, null = no org node assignment (legacy/admin account).
  const [orgInfo, setOrgInfo] = useState<OrgPositionInfo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: myNode } = await supabase
        .from("org_nodes")
        .select("id, title, parent_id")
        .eq("assigned_profile_id", profile.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!myNode) {
        if (!cancelled) setOrgInfo(null);
        return;
      }

      const { data: allNodes } = await supabase
        .from("org_nodes")
        .select("id, title, parent_id")
        .eq("is_active", true);

      const byId = new Map((allNodes ?? []).map((n) => [n.id, n]));
      const breadcrumb: string[] = [];
      const seen = new Set<string>([myNode.id]);
      let parentId = myNode.parent_id;
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parentNode = byId.get(parentId);
        if (!parentNode) break;
        breadcrumb.push(parentNode.title);
        parentId = parentNode.parent_id;
      }

      if (!cancelled) setOrgInfo({ title: myNode.title, breadcrumb });
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const positionLabel = orgInfo?.title ?? t(`roles.${profile.role}`);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hidden items-center gap-2 rounded-md px-2 py-1 text-start transition-colors hover:bg-accent sm:flex"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <p className="text-sm font-medium">{profile.name}</p>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[10px]">
                {positionLabel}
              </Badge>
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div>
          <p className="text-sm font-semibold">{profile.name}</p>
          <p className="text-xs text-muted-foreground">{profile.email}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t("profile.position")}</p>
          <p className="text-sm">{positionLabel}</p>
        </div>

        {orgInfo && orgInfo.breadcrumb.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t("profile.orgPath")}</p>
            <p className="text-xs leading-relaxed">{[orgInfo.title, ...orgInfo.breadcrumb].join(" / ")}</p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t("profile.role")}</p>
          <Badge variant="outline" className="text-[10px]">
            {t(`roles.${profile.role}`)}
          </Badge>
        </div>

        {profile.role === "ADMIN" && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t("admin.permissions", "Permissions")}</p>
            {permissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("admin.noPermissions", "None")}</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {permissions.map((p) => (
                  <Badge key={p} variant="secondary" className="text-[10px]">
                    {t(ADMIN_PERMISSION_OPTIONS.find((o) => o.value === p)?.labelKey ?? p)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {(profile.role === "SUPER_ADMIN" || profile.role === "ADMIN") && <MfaEnrollPanel />}
      </PopoverContent>
    </Popover>
  );
}
