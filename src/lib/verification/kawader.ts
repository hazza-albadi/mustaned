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

export type EmployeeProfileDetails = {
  fullName: string;
  fullNameAr: string | null;
  department: string | null;
  phone: string | null;
  // A formatted position/job path (e.g. "College of X > Department of Y >
  // Position Z"). Modeled as a single string rather than a structured
  // breadcrumb array — deliberately the simplest shape that could work,
  // since the real API's actual representation of "position path" is
  // unknown; this is expected to need adjusting once that's known, same as
  // every other field here.
  jobPath: string | null;
};

export type EmployeeProfileResult = VerificationResult<EmployeeProfileDetails>;

// TODO(kawader-integration): call the real Kawader API to fetch this
// employee's current name/department/phone/position path for display at
// login. Same unknown-shape situation as verifyCivilId() above — no docs or
// credentials exist yet, so this always reports "unavailable". See
// POST /api/auth/kawader-sync for the caller: it never blocks or slows down
// login on this, and only writes the new profiles.kawader_* columns
// (0017_kawader_employee_profile.sql) on an actual "verified" result.
export async function fetchEmployeeProfile(civilId: string): Promise<EmployeeProfileResult> {
  void civilId; // unused until the real integration lands — kept named for documentation
  return { status: "unavailable", reason: "Kawader integration is not yet available" };
}
