"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// S-13: surfaces Supabase Auth's native TOTP MFA for SUPER_ADMIN/ADMIN — the
// two roles that carry the broadest RLS bypass, so a compromised password
// alone shouldn't be enough to reach them. This is opt-in enrollment (not a
// forced gate): every existing SUPER_ADMIN/ADMIN account currently has zero
// factors enrolled, so hard-requiring AAL2 here would lock all of them out
// immediately. See login-form.tsx for the matching AAL2 challenge step that
// activates automatically once a factor is enrolled.
export function MfaEnrollPanel() {
  const { t } = useI18n();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (!cancelled) {
        setEnrolledFactorId(verified?.id ?? null);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? t("common.error"));
      return;
    }
    setPendingFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  }

  async function confirmEnroll() {
    if (!pendingFactorId || code.trim().length < 6) return;
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: pendingFactorId,
      });
      if (challengeError || !challenge) throw new Error(challengeError?.message);

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw new Error(verifyError.message);

      toast.success(t("auth.mfaEnabled", "Two-factor authentication enabled"));
      setEnrolledFactorId(pendingFactorId);
      setEnrolling(false);
      setCode("");
      setQrCode(null);
      setSecret(null);
      setPendingFactorId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.mfaInvalidCode", "Invalid code"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!enrolledFactorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.mfaDisabled", "Two-factor authentication disabled"));
    setEnrolledFactorId(null);
  }

  if (loading) return null;

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t("auth.mfaSectionTitle", "Two-factor authentication")}
      </p>

      {enrolledFactorId && !enrolling && (
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <ShieldCheck className="h-3 w-3" /> {t("auth.mfaOn", "Enabled")}
          </Badge>
          <Button type="button" size="sm" variant="outline" onClick={disable} disabled={busy}>
            {busy && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
            {t("auth.mfaDisable", "Disable")}
          </Button>
        </div>
      )}

      {!enrolledFactorId && !enrolling && (
        <Button type="button" size="sm" onClick={startEnroll} disabled={busy}>
          {busy && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
          {t("auth.mfaEnable", "Enable two-factor authentication")}
        </Button>
      )}

      {enrolling && (
        <div className="space-y-2">
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase returns a data: URI SVG, not a static asset
            <img src={qrCode} alt="TOTP QR code" className="h-36 w-36 rounded-md border bg-white p-1" />
          )}
          {secret && (
            <p className="break-all text-[10px] text-muted-foreground">
              {t("auth.mfaManualEntry", "Or enter manually")}: {secret}
            </p>
          )}
          <Label className="text-xs">{t("auth.mfaEnterCode", "Enter the 6-digit code")}</Label>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              className="h-8"
            />
            <Button type="button" size="sm" onClick={confirmEnroll} disabled={busy || code.trim().length < 6}>
              {busy && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
              {t("common.confirm", "Confirm")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
