"use client";

import { useEffect, useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n/config";
import type { SignupStatusLookupResult } from "@/app/api/signups/status/route";
import { Loader2 } from "lucide-react";

// Lets a requester check their sign-up status from any device without
// signing in — there's nothing to sign in with yet if their account isn't
// ACTIVE. Externally controlled (open/onOpenChange), matching every other
// dialog in this app (e.g. ApproveSignupDialog) rather than an internal
// DialogTrigger.
export function CheckStatusDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const [civilId, setCivilId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SignupStatusLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCivilId("");
      setResult(null);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch("/api/signups/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ civil_id: civilId }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? t("common.error"));
      return;
    }
    setResult(body.status as SignupStatusLookupResult);
  }

  const STATUS_MESSAGE: Record<SignupStatusLookupResult, string> = {
    not_found: t("auth.statusNotFound", "No sign-up request was found for this Civil ID."),
    pending: t("auth.statusPending", "Your request is pending admin review."),
    approved_awaiting_directory: t(
      "auth.statusAwaitingDirectory",
      "Your request was approved and your account is being set up."
    ),
    rejected: t("auth.statusRejected", "Your sign-up request was not approved."),
    active: t("auth.statusActive", "Your account is active — you can sign in normally."),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("auth.checkStatusTitle", "Check sign-up request status")}</DialogTitle>
        </DialogHeader>

        {result ? (
          <Alert>
            <AlertDescription>{STATUS_MESSAGE[result]}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="statusCivilId">{t("auth.civilId", "Civil ID")}</Label>
              <Input
                id="statusCivilId"
                inputMode="numeric"
                maxLength={8}
                required
                value={civilId}
                onChange={(e) => setCivilId(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || civilId.length !== 8}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("common.confirm", "Confirm")}
            </Button>
          </form>
        )}

        {result && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResult(null)}>
              {t("auth.checkAnother", "Check another Civil ID")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
