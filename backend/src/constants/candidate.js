// Single source of truth for candidate-level option lists.
// Consumed by the CandidateProfile schema enums, the Job schema (a job's
// `disabilityEligible` is drawn from the same vocabulary a candidate declares,
// which is what makes candidate<->job matching possible at all) and the Zod DTOs.
// Mirrored (values only) in frontend/src/constants/company.js — keep both in sync.

export const DISABILITY_TYPES = [
  "Visual Impairment",
  "Hearing Impairment",
  "Locomotor Disability",
  "Intellectual Disability",
  "Mental Illness",
  "Multiple Disabilities",
  "Other"
];
