"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/config";
import { FormCard } from "@/components/dashboard/form-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Filter, FormDefinition } from "@/types";

export function FormsContent({ forms, filters }: { forms: FormDefinition[]; filters: Filter[] }) {
  const { t, locale } = useI18n();
  const [category, setCategory] = useState<string>("ALL");

  const visibleForms = useMemo(
    () => (category === "ALL" ? forms : forms.filter((f) => f.filter_ids?.includes(category))),
    [forms, category]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.availableForms")}</h1>
        {filters.length > 0 && (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("dashboard.allCategories")}</SelectItem>
              {filters.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {locale === "ar" ? f.name_ar : f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {visibleForms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {category === "ALL" ? t("dashboard.noForms") : t("dashboard.noFormsInCategory")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleForms.map((form) => (
            <FormCard key={form.id} form={form} />
          ))}
        </div>
      )}
    </div>
  );
}
