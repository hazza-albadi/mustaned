import { createAdminClient } from "@/lib/supabase/server";
import { SEED_USER_PASSWORD } from "@/lib/test-credentials";

export interface CreateAuthUserInput {
  email: string;
  /** Only honored in production. Ignored everywhere else in favor of SEED_USER_PASSWORD. */
  password?: string;
  metadata: {
    name: string;
    name_ar?: string;
    role: "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "EMPLOYEE";
  };
}

// Every account-creation path for test/throwaway accounts (create-person
// form, the org-node "assign new person" flow, the seed script)
// must call this instead of deciding password logic itself — outside
// production every new account gets SEED_USER_PASSWORD, in production it
// gets a real or randomly generated one.
//
// The one deliberate exception: createAdminAccount() in create-admin-account.ts
// also calls supabase.auth.admin.createUser() directly, for real ADMIN staff
// accounts created by a Super Admin with a real chosen password — that use
// case must never be subject to SEED_USER_PASSWORD/NODE_ENV branching, so it
// intentionally does not go through this function.
export async function createAuthUser({ email, password, metadata }: CreateAuthUserInput) {
  const admin = createAdminClient();
  const isProduction = process.env.NODE_ENV === "production";
  const finalPassword = isProduction ? password ?? crypto.randomUUID() : SEED_USER_PASSWORD;

  return admin.auth.admin.createUser({
    email,
    password: finalPassword,
    email_confirm: true,
    user_metadata: {
      name: metadata.name,
      name_ar: metadata.name_ar ?? "",
      role: metadata.role,
    },
  });
}
