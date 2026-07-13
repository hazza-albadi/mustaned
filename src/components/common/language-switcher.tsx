"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/config";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
      className="gap-2"
    >
      <Languages className="h-4 w-4" />
      {locale === "en" ? "العربية" : "English"}
    </Button>
  );
}
