// Document types accepted by the shared VerificationDocument subschema
// (models/verificationDocument.js), which both RecruiterProfile and
// CandidateProfile embed.
// Mirrored (values only) in frontend/src/constants/company.js — keep both in sync.

/** Proof a company uploads for admin verification. */
export const RECRUITER_DOC_TYPES = [
  "Certificate of Incorporation",
  "GST Certificate",
  "PAN Card",
  "Company Registration"
];

/** Proof a candidate uploads for admin verification. */
export const CANDIDATE_DOC_TYPES = ["UDID Card", "Disability Certificate", "Government ID"];

/**
 * One enum for one subschema. The role-specific lists above are what the UI
 * offers; the schema accepts the union plus "Other" so a single embedded
 * document type serves both profiles.
 */
export const VERIFICATION_DOC_TYPES = [...RECRUITER_DOC_TYPES, ...CANDIDATE_DOC_TYPES, "Other"];
