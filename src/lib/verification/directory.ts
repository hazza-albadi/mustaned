import type { VerificationResult } from "./types";

export type EmailAvailabilityDetails = Record<string, never>;

export type EmailAvailabilityResult = VerificationResult<EmailAvailabilityDetails>;

// TODO(directory-integration): call the organization's directory (on-prem
// AD, Azure/Entra, or hybrid — not yet confirmed, so nothing here guesses at
// a request/response shape) to confirm `email` isn't already taken. Mustanad
// only ever reads from the directory for this check — it does not and will
// not write directory accounts; see POST /api/signups/[id]/mark-created,
// which just records that IT created the account elsewhere. Swapping this
// stub for the real call is the only change needed once the directory
// platform and API are known.
export async function checkEmailAvailable(email: string): Promise<EmailAvailabilityResult> {
  void email; // unused until the real integration lands — kept named for documentation
  return { status: "unavailable", reason: "Directory integration is not yet available" };
}
