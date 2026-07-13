"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { FormDefinition } from "@/types";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function FormsList({ forms }: { forms: FormDefinition[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [deleteTarget, setDeleteTarget] = useState<FormDefinition | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(
    () => forms.filter((f) => f.title.toLowerCase().includes(debouncedSearch.toLowerCase())),
    [forms, debouncedSearch]
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("forms").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("common.success"));
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("builder.title")}</h1>
        <Button asChild className="gap-1">
          <Link href="/admin/builder/new">
            <Plus className="h-4 w-4" /> {t("builder.newForm")}
          </Link>
        </Button>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("common.search")}
          className="ps-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((form) => (
          <Card key={form.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{form.title}</CardTitle>
                <Badge variant={form.is_active ? "default" : "secondary"}>
                  {form.is_active ? t("common.active") : t("common.inactive")}
                </Badge>
              </div>
              {form.description && (
                <CardDescription className="line-clamp-2">{form.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {form.fields.length} {locale === "ar" ? "حقول" : "fields"}
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1 gap-1">
                <Link href={`/admin/builder/${form.id}`}>
                  <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-600"
                onClick={() => setDeleteTarget(form)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            {t("common.noResults")}
          </p>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("builder.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
