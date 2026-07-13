"use client";

import { useI18n } from "@/lib/i18n/config";
import { FormCard } from "@/components/dashboard/form-card";
import type { FormDefinition } from "@/types";

export function FormsContent({ forms }: { forms: FormDefinition[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.availableForms")}</h1>
      {forms.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("dashboard.noForms")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <FormCard key={form.id} form={form} />
          ))}
        </div>
      )}
    </div>
  );
}
