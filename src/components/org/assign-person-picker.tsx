"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/config";
import type { Profile } from "@/types";
import type { AssignPersonValue } from "@/lib/assign-person";

export function AssignPersonPicker({
  unassignedProfiles,
  value,
  onChange,
}: {
  unassignedProfiles: Profile[];
  value: AssignPersonValue;
  onChange: (value: AssignPersonValue) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={value.mode === "existing" ? "default" : "outline"}
          disabled={unassignedProfiles.length === 0}
          onClick={() => onChange({ mode: "existing", profileId: unassignedProfiles[0]?.id ?? "" })}
        >
          {t("org.pickExisting", "Pick existing person")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value.mode === "new" ? "default" : "outline"}
          onClick={() => onChange({ mode: "new", name: "", email: "" })}
        >
          {t("org.createNew", "Create new person")}
        </Button>
      </div>

      {value.mode === "existing" && (
        <div className="space-y-2">
          <Label>{t("org.person", "Person")}</Label>
          <Select
            value={value.profileId}
            onValueChange={(v) => onChange({ mode: "existing", profileId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("org.selectPerson", "Select a person")} />
            </SelectTrigger>
            <SelectContent>
              {unassignedProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.mode === "new" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("common.name")}</Label>
            <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.email")}</Label>
            <Input
              type="email"
              value={value.email}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
