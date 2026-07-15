"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { UtasLogo } from "@/components/common/utas-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProfileChip } from "@/components/nav/profile-chip";
import type { AdminPermission, Profile } from "@/types";
import { ADMIN_PERMISSION_PRIORITY } from "@/lib/roles";
import {
  LayoutDashboard,
  ClipboardCheck,
  FileEdit,
  Network,
  Tag,
  BarChart3,
  ShieldCheck,
  LogOut,
  Menu,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

// Each role sees a fixed, explicit set of nav items — including different
// labels for the same /admin route depending on whether it's an approval
// queue (Department Head) or a read-only overview (Super Admin). ADMIN isn't
// here — its nav is built dynamically from granted permissions, below.
const NAV_ITEMS_BY_ROLE: Record<Exclude<Profile["role"], "ADMIN">, NavItem[]> = {
  EMPLOYEE: [
    { href: "/forms", icon: FileText, labelKey: "nav.forms" },
    { href: "/my-submissions", icon: LayoutDashboard, labelKey: "nav.mySubmissions" },
  ],
  DEPARTMENT_HEAD: [
    { href: "/forms", icon: FileText, labelKey: "nav.forms" },
    { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.mySubmissions" },
    { href: "/admin", icon: ClipboardCheck, labelKey: "nav.approvals" },
  ],
  SUPER_ADMIN: [
    { href: "/admin", icon: ClipboardCheck, labelKey: "nav.allSubmissions" },
    { href: "/admin/builder", icon: FileEdit, labelKey: "nav.formBuilder" },
    { href: "/admin/org", icon: Network, labelKey: "nav.orgChart" },
    { href: "/admin/filters", icon: Tag, labelKey: "nav.filters" },
    { href: "/admin/analytics", icon: BarChart3, labelKey: "nav.analytics" },
    { href: "/admin/admins", icon: ShieldCheck, labelKey: "nav.admins" },
  ],
};

const ADMIN_PERMISSION_NAV: Record<AdminPermission, NavItem> = {
  view_submissions: { href: "/admin", icon: ClipboardCheck, labelKey: "nav.allSubmissions" },
  manage_forms: { href: "/admin/builder", icon: FileEdit, labelKey: "nav.formBuilder" },
  manage_org_chart: { href: "/admin/org", icon: Network, labelKey: "nav.orgChart" },
  manage_filters: { href: "/admin/filters", icon: Tag, labelKey: "nav.filters" },
  view_analytics: { href: "/admin/analytics", icon: BarChart3, labelKey: "nav.analytics" },
};

function NavLinks({
  profile,
  permissions,
  onNavigate,
}: {
  profile: Profile;
  permissions: AdminPermission[];
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items =
    profile.role === "ADMIN"
      ? ADMIN_PERMISSION_PRIORITY.filter((p) => permissions.includes(p)).map((p) => ADMIN_PERMISSION_NAV[p])
      : NAV_ITEMS_BY_ROLE[profile.role];

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  profile,
  permissions = [],
  children,
}: {
  profile: Profile;
  // Only meaningful when profile.role === "ADMIN" — ignored otherwise.
  permissions?: AdminPermission[];
  children: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={locale === "ar" ? "right" : "left"} className="w-64 p-4">
              <div className="mb-6 flex items-center gap-2 font-semibold">
                <UtasLogo size={20} title="UTAS" />
                {t("app.name")}
              </div>
              <NavLinks profile={profile} permissions={permissions} />
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <UtasLogo size={20} title="UTAS" />
            <span className="hidden sm:inline">{t("app.name")}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ProfileChip profile={profile} permissions={permissions} />
          <Button variant="ghost" size="icon" onClick={handleLogout} disabled={signingOut} title={t("common.logout")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-e bg-muted/20 p-4 lg:block">
          <NavLinks profile={profile} permissions={permissions} />
        </aside>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
