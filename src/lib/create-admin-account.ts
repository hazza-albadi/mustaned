import { createAdminClient } from "@/lib/supabase/server";

export interface CreateAdminAccountInput {
  name: string;
  name_ar?: string;
  email: string;
  // Chosen directly by the Super Admin creating the account. Required,
  // never generated — see the comment in create-auth-user.ts for why this
  // deliberately does not go through createAuthUser()/SEED_USER_PASSWORD.
  password: string;
}

// The second (and only other) permitted call site for
// supabase.auth.admin.createUser() — see create-auth-user.ts for the first.
// This one is for real ADMIN staff accounts, created directly by a Super
// Admin with a real chosen password. Never routes through createAuthUser().
export async function createAdminAccount({ name, name_ar, email, password }: CreateAdminAccountInput) {
  const admin = createAdminClient();
  return admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, name_ar: name_ar ?? "", role: "ADMIN" },
  });
}
