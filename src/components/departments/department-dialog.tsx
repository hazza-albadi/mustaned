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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department, Profile } from "@/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DepartmentDialog({
  department,
  potentialHeads,
  open,
  onOpenChange,
}: {
  department: Department | null;
  potentialHeads: Profile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [headId, setHeadId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(department?.name ?? "");
      setNameAr(department?.name_ar ?? "");
      setHeadId(department?.head_id ?? "");
    }
  }, [open, department]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = { name, name_ar: nameAr, head_id: headId || null };
    const { error } = department
      ? await supabase.from("departments").update(payload).eq("id", department.id)
      : await supabase.from("departments").insert(payload);

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
          <DialogTitle>{department ? t("departments.editDepartment") : t("departments.newDepartment")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("departments.nameEn")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t("departments.nameAr")}</Label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" required />
          </div>
          <div className="space-y-2">
            <Label>{t("departments.head")}</Label>
            <Select value={headId} onValueChange={setHeadId}>
              <SelectTrigger>
                <SelectValue placeholder={t("departments.noHead")} />
              </SelectTrigger>
              <SelectContent>
                {potentialHeads.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
