import { createAdminClient } from "@/lib/supabase/server";
import { SEED_USER_PASSWORD } from "@/lib/test-credentials";

export interface CreateAuthUserInput {
  email: string;
  /** Honored whenever supplied. If omitted (and not in seed mode), a random one-time password is generated and returned. */
  password?: string;
  metadata: {
    name: string;
    name_ar?: string;
    role: "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "EMPLOYEE";
  };
}

// S-02 fix: this used to hand out SEED_USER_PASSWORD (a fixed, published
// string) to every new account whenever `NODE_ENV` wasn't the exact literal
// "production" — a single string comparison silently discarding whatever
// password the caller actually supplied, with no warning anywhere. Any
// deployment that didn't set NODE_ENV=production precisely (staging, a bare
// `next start` without the env var forwarded, etc.) meant every account in
// that environment shared one publicly-known password.
//
// The fixed-password path now requires an explicit, separate opt-in
// (SEED_MODE=true) that only scripts/seed.ts sets, so it can never be
// reached by accident via an app request. Every other caller (the real
// account-provisioning API routes) always honors a caller-supplied password,
// or — since no current UI actually collects one for EMPLOYEE/DEPARTMENT_HEAD
// accounts — generates a random one-time password and returns it to the
// caller so it can be surfaced/shared with the new user.
//
// The one deliberate exception: createAdminAccount() in create-admin-account.ts
// also calls supabase.auth.admin.createUser() directly, for real ADMIN staff
// accounts created by a Super Admin with a real chosen password — that use
// case must never be subject to SEED_MODE branching, so it intentionally
// does not go through this function.
export async function createAuthUser({ email, password, metadata }: CreateAuthUserInput) {
  const admin = createAdminClient();
  const isSeedMode = process.env.SEED_MODE === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (isSeedMode && isProduction) {
    throw new Error(
      "SEED_MODE must never be set in a production environment — refusing to issue a shared fixed password."
    );
  }

  const generatedPassword = isSeedMode ? undefined : password ?? crypto.randomUUID();
  const finalPassword = isSeedMode ? SEED_USER_PASSWORD : generatedPassword!;

  const result = await admin.auth.admin.createUser({
    email,
    password: finalPassword,
    email_confirm: true,
    user_metadata: {
      name: metadata.name,
      name_ar: metadata.name_ar ?? "",
      role: metadata.role,
    },
  });

  // Only surfaced when the caller didn't supply their own password, so the
  // route/UI can hand it to whoever is provisioning the account. Never set
  // in seed mode (the shared seed password is not a secret worth returning).
  return { ...result, generatedPassword: password ? undefined : generatedPassword };
}
