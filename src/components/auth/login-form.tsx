"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { UtasLogo } from "@/components/common/utas-logo";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // S-13: set once signInWithPassword succeeds but the session is only AAL1
  // while a verified TOTP factor exists — i.e. this account enrolled MFA via
  // ProfileChip's MfaEnrollPanel, so a password alone is no longer enough.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  function completeLogin() {
    // S-05: only ever follow a relative, same-origin path. A bare "/" prefix
    // check alone isn't enough — "//evil.com" and "/\evil.com" both parse as
    // protocol-relative external URLs in a browser, so those are rejected too.
    const rawRedirect = searchParams.get("redirect");
    const isSafeRedirect =
      !!rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.startsWith("/\\");
    const redirectTo = isSafeRedirect ? rawRedirect : "/";
    router.push(redirectTo);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(t("auth.invalidCredentials"));
      setLoading(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.find((f) => f.status === "verified");
      setLoading(false);
      if (!factor) {
        // Enrolled factor is unverified/missing — shouldn't normally happen,
        // fail closed rather than silently skip the MFA step.
        setError(t("auth.mfaInvalidCode", "Invalid code"));
        return;
      }
      setMfaFactorId(factor.id);
      return;
    }

    setLoading(false);
    completeLogin();
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setError(null);
    setLoading(true);

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? t("auth.mfaInvalidCode", "Invalid code"));
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    setLoading(false);
    if (verifyError) {
      setError(t("auth.mfaInvalidCode", "Invalid code"));
      return;
    }

    completeLogin();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 end-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center">
            <UtasLogo size={40} title="UTAS" />
          </div>
          <CardTitle>{t("auth.loginTitle")}</CardTitle>
          <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {mfaFactorId ? (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="mfaCode">{t("auth.mfaEnterCode", "Enter the 6-digit code")}</Label>
                <Input
                  id="mfaCode"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || mfaCode.trim().length < 6}>
                {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("common.confirm", "Confirm")}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {loading ? t("auth.loggingIn") : t("auth.login")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
