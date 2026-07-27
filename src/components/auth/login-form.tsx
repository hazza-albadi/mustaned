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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { UtasLogo } from "@/components/common/utas-logo";
import { CheckStatusDialog } from "@/components/auth/check-status-dialog";
import { Loader2, CheckCircle2 } from "lucide-react";

// Temporary rollout toggle — flip to true to bring the Sign Up tab back.
// Everything behind it (this form's signup state/handlers, /api/signups and
// its approve/reject routes, 0013/0014 migrations, /admin/signups) is fully
// intact and untouched; this is the only gate. No other feature-flag
// convention exists yet in this codebase to match, so this is a plain
// module-level constant rather than an env var.
const SIGNUP_ENABLED = false;

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

  const [civilId, setCivilId] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const [checkStatusOpen, setCheckStatusOpen] = useState(false);

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

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      setError(t("auth.invalidCredentials"));
      setLoading(false);
      return;
    }

    // Sign-up (self-service, gated by admin approval) creates the auth user
    // immediately with real credentials but the profile starts out
    // PENDING/REJECTED — signInWithPassword succeeds either way, so this
    // status check has to happen before anything else (including MFA), and
    // must sign the session back out rather than leaving it dangling in the
    // browser once denied. RLS (auth_is_approved(), 0013_signup_requests.sql)
    // blocks any real data access regardless, but the UI shouldn't imply
    // they're signed in.
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", signInData.user.id)
      .single();

    if (profile && profile.account_status !== "ACTIVE") {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        profile.account_status === "PENDING"
          ? t("auth.pendingApproval", "Your account is pending admin approval")
          : profile.account_status === "APPROVED_AWAITING_DIRECTORY"
            ? t("auth.awaitingDirectory", "Your request was approved and your account is being set up")
            : t("auth.signupRejected", "Your sign-up request was not approved")
      );
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

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    setSignupLoading(true);

    const res = await fetch("/api/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ civil_id: civilId, email: signupEmail, password: signupPassword }),
    });
    const body = await res.json().catch(() => ({}));
    setSignupLoading(false);

    if (!res.ok) {
      setSignupError(body.error ?? t("common.error"));
      return;
    }

    setSignupSuccess(true);
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
          ) : !SIGNUP_ENABLED ? (
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
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signUp", "Sign Up")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
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
              </TabsContent>

              <TabsContent value="signup">
                {signupSuccess ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {t("auth.signupSuccessDesc", "Your sign-up request has been submitted and is pending admin approval.")}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <form onSubmit={handleSignupSubmit} className="space-y-4">
                    {signupError && (
                      <Alert variant="destructive">
                        <AlertDescription>{signupError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="civilId">{t("auth.civilId", "Civil ID")}</Label>
                      <Input
                        id="civilId"
                        inputMode="numeric"
                        maxLength={8}
                        required
                        value={civilId}
                        onChange={(e) => setCivilId(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupEmail">{t("auth.email")}</Label>
                      <Input
                        id="signupEmail"
                        type="email"
                        required
                        autoComplete="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupPassword">{t("auth.password")}</Label>
                      <Input
                        id="signupPassword"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "auth.passwordHint",
                          "At least 10 characters, with uppercase, lowercase, a number, and a symbol"
                        )}
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={signupLoading}>
                      {signupLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t("auth.signUp", "Sign Up")}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          )}
          {!mfaFactorId && (
            <Button type="button" variant="link" className="w-full" onClick={() => setCheckStatusOpen(true)}>
              {t("auth.checkStatus", "Check my request status")}
            </Button>
          )}
        </CardContent>
      </Card>
      <CheckStatusDialog open={checkStatusOpen} onOpenChange={setCheckStatusOpen} />
    </div>
  );
}
