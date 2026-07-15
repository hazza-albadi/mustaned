"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Filter } from "@/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FilterDialog({
  filter,
  open,
  onOpenChange,
}: {
  filter: Filter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(filter?.name ?? "");
      setNameAr(filter?.name_ar ?? "");
    }
  }, [open, filter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = { name, name_ar: nameAr };
    const { error } = filter
      ? await supabase.from("filters").update(payload).eq("id", filter.id)
      : await supabase.from("filters").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t("common.success"));
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{filter ? t("filters.editFilter") : t("filters.newFilter")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("filters.nameEn")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t("filters.nameAr")}</Label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
