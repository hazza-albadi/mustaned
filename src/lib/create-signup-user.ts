import { createAdminClient } from "@/lib/supabase/server";
import type { CivilIdVerificationResult } from "@/lib/verification/kawader";
import type { EmailAvailabilityResult } from "@/lib/verification/directory";

export interface CreateSignupUserInput {
  civil_id: string;
  email: string;
  // Chosen directly by the person signing up — see create-admin-account.ts
  // for why a real, caller-chosen password never goes through
  // createAuthUser()/SEED_USER_PASSWORD branching.
  password: string;
  // Recorded on the profile as-is, so the reviewing admin sees exactly what
  // was auto-checked at submission time. Required (not optional) so a
  // caller can't forget to run them — POST /api/signups always calls both
  // adapters before reaching here.
  civilIdVerification: CivilIdVerificationResult;
  emailVerification: EmailAvailabilityResult;
}

// The third (and last) permitted direct call site for
// supabase.auth.admin.createUser() — see create-auth-user.ts and
// create-admin-account.ts for the other two. This one is for a self-service
// sign-up: always role EMPLOYEE, always account_status PENDING/is_active
// false until an admin with approve_signups reviews it.
//
// name/name_ar: the sign-up form itself never collects a name (only Civil
// ID/Email/Password), so handle_new_auth_user()'s split_part(email, '@', 1)
// fallback normally supplies it. The one exception is when Kawader
// verification comes back "verified" — at that point Kawader's fullName/
// fullNameAr *is* the authoritative identity for this Civil ID, so it's used
// instead of the email-derived guess. Today verifyCivilId() always returns
// "unavailable" (see TODO(kawader-integration) there), so this never fires
// yet — it activates automatically once that integration is wired in.
export async function createSignupUser({
  civil_id,
  email,
  password,
  civilIdVerification,
  emailVerification,
}: CreateSignupUserInput) {
  const admin = createAdminClient();
  const verifiedIdentity = civilIdVerification.status === "verified" ? civilIdVerification.details : null;

  return admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "EMPLOYEE",
      civil_id,
      account_status: "PENDING",
      is_active: false,
      ...(verifiedIdentity
        ? { name: verifiedIdentity.fullName, name_ar: verifiedIdentity.fullNameAr ?? "" }
        : {}),
      civil_id_verification: civilIdVerification,
      email_verification: emailVerification,
    },
  });
}
