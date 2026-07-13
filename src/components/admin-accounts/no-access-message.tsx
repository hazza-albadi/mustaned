"use client";

import { useI18n } from "@/lib/i18n/config";
import { ShieldAlert } from "lucide-react";

export function NoAccessMessage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{t("admin.noAccessTitle")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("admin.noAccessDescription")}</p>
    </div>
  );
}
