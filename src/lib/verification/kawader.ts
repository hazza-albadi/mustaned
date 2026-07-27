import type { VerificationResult } from "./types";

export type CivilIdVerificationDetails = {
  // Employee's legal name as held by Kawader — once wired up, this (not the
  // sign-up form, which never collects a name) becomes the source of truth
  // for profiles.name/name_ar. See createSignupUser().
  fullName: string;
  fullNameAr: string | null;
};

export type CivilIdVerificationResult = VerificationResult<CivilIdVerificationDetails>;

// TODO(kawader-integration): call the real Kawader API to confirm `civilId`
// belongs to a current employee AND that they don't already have an email/
// account assigned. No Kawader API docs are available in this repo yet, so
// this always reports "unavailable" rather than guessing at a request/
// response shape — see the matching TODO(kawader-integration) marker in
// src/app/api/signups/[id]/approve/route.ts for the other half of this gap
// (auto-assigning org position/role). Swapping this stub for the real call
// is the only change needed once integration details are known — every
// caller already handles all three VerificationResult states.
export async function verifyCivilId(civilId: string): Promise<CivilIdVerificationResult> {
  void civilId; // unused until the real integration lands — kept named for documentation
  return { status: "unavailable", reason: "Kawader integration is not yet available" };
}
