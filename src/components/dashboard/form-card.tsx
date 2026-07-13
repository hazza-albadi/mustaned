"use client";

import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/config";
import type { FormDefinition } from "@/types";
import { ArrowRight, FileText } from "lucide-react";

export function FormCard({ form }: { form: FormDefinition }) {
  const { locale, t } = useI18n();
  const title = locale === "ar" && form.title_ar ? form.title_ar : form.title;
  const description = locale === "ar" && form.description_ar ? form.description_ar : form.description;

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="line-clamp-2">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1" />
      <CardFooter>
        <Button asChild className="w-full gap-1">
          <Link href={`/fill/${form.id}`}>
            {t("dashboard.fillForm")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
