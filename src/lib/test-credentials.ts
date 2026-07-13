// Shared default password for non-production test accounts. Single source of
// truth for "what do I log in with" across scripts/seed.ts and the
// /api/users create-person route — both import this instead of redefining it.
export const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Password123!";
