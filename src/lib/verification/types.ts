// Shared result shape for every external verification check run during
// sign-up (Kawader identity match, directory email availability). Neither
// external API is available yet — see kawader.ts and directory.ts — so every
// adapter today only ever returns "unavailable". The shape exists now so the
// rest of the app (storage, the admin review screen) never has to change
// when a real integration replaces a stub: only the adapter's implementation
// changes, never its callers.
export type VerificationResult<TDetails> =
  | { status: "verified"; details: TDetails }
  | { status: "failed"; reason: string }
  // Integration not wired up yet — distinct from "failed" so callers never
  // treat "we couldn't check" the same as "we checked and it's invalid".
  | { status: "unavailable"; reason: string };
