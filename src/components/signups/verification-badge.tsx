"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { VerificationResult } from "@/lib/verification/types";

// Same three-state contract every verification adapter returns (see
// src/lib/verification/types.ts) — this renders any of them without caring
// which check produced it or what its `details` shape is. `null`/`undefined`
// (accounts not created via self-service sign-up) renders the same as
// "unavailable", since there's nothing to show either way.
export function VerificationBadge({ result }: { result: VerificationResult<unknown> | null | undefined }) {
  const { t } = useI18n();

  if (!result || result.status === "unavailable") {
    return (
      <Badge variant="secondary" className="font-normal">
        {t("signups.verificationUnavailable", "Not auto-verified")}
      </Badge>
    );
  }

  if (result.status === "failed") {
    return (
      <Badge variant="destructive" className="font-normal">
        {t("signups.verificationFailed", "Failed")}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal border-utas-olive/40 bg-utas-olive/15 text-[color-mix(in_oklch,var(--utas-olive),black_35%)]"
      )}
    >
      {t("signups.verificationVerified", "Verified")}
    </Badge>
  );
}

// The muted one-line explanation shown under the badge — the "reason" the
// check couldn't verify/failed, or nothing at all when verified (the badge
// alone is enough in that case).
export function verificationDetail(result: VerificationResult<unknown> | null | undefined): string | null {
  if (!result) return null;
  if (result.status === "verified") return null;
  return result.reason;
}
