import { createAdminClient } from "@/lib/supabase/server";

export interface CreateSignupUserInput {
  civil_id: string;
  email: string;
  // Chosen directly by the person signing up — see create-admin-account.ts
  // for why a real, caller-chosen password never goes through
  // createAuthUser()/SEED_USER_PASSWORD branching.
  password: string;
}

// The third (and last) permitted direct call site for
// supabase.auth.admin.createUser() — see create-auth-user.ts and
// create-admin-account.ts for the other two. This one is for a self-service
// sign-up: always role EMPLOYEE, always account_status PENDING/is_active
// false until an admin with approve_signups reviews it. `name` is
// deliberately omitted — the sign-up form only collects Civil ID/Email/
// Password, so handle_new_auth_user()'s existing split_part(email, '@', 1)
// fallback supplies it.
export async function createSignupUser({ civil_id, email, password }: CreateSignupUserInput) {
  const admin = createAdminClient();
  return admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "EMPLOYEE",
      civil_id,
      account_status: "PENDING",
      is_active: false,
    },
  });
}
