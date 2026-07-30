// Mirrors backend/src/constants/company.js — values must stay identical,
// the backend validates every one of these against its own enum.

export const COMPANY_ACCESSIBILITY_FACILITIES = [
  "Wheelchair Accessible",
  "Accessible Washrooms",
  "Braille Signage",
  "Accessible Parking",
  "Sign Language Support",
  "Flexible Work Environment",
  "Assistive Technology"
];

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

export const COMPANY_SIZE_LABELS = {
  "1-10": "1-10 employees",
  "11-50": "11-50 employees",
  "51-200": "51-200 employees",
  "201-500": "201-500 employees",
  "501-1000": "501-1000 employees",
  "1000+": "1000+ employees",
};

export const INDUSTRIES = [
  "Information Technology",
  "Banking & Finance",
  "Healthcare",
  "Education",
  "Manufacturing",
  "Retail & E-commerce",
  "Telecommunications",
  "Consulting",
  "Government & Public Sector",
  "Non-Profit",
  "Hospitality",
  "Logistics & Transportation",
  "Media & Entertainment",
  "Real Estate",
  "Other"
];

/**
 * Shared disability list — was duplicated in RegisterPage and CandidateProfile.
 * Mirrors backend/src/constants/candidate.js; the backend now enforces it as a
 * schema enum on both `CandidateProfile.disabilityType` and
 * `Job.disabilityEligible`, so a value not in this list is rejected.
 */
export const DISABILITY_TYPES = [
  "Visual Impairment",
  "Hearing Impairment",
  "Locomotor Disability",
  "Intellectual Disability",
  "Mental Illness",
  "Multiple Disabilities",
  "Other"
];

// --- Mirrors backend/src/constants/job.js ---

/** Shared by `Job.workHours` and `CandidateProfile.preferredWorkHours`. */
export const WORK_HOUR_OPTIONS = ["Full-time", "Part-time", "Flexi-time"];

/**
 * Accessibility arrangements that only make sense per-role. A job's
 * `accessibilityFeatures` is enum-constrained to
 * COMPANY_ACCESSIBILITY_FACILITIES + these, which is why the job form offers
 * checkboxes rather than the free-text "extras" box it used to have — typed
 * values were silently unmatched against anything and now fail validation.
 */
export const JOB_ACCESSIBILITY_EXTRAS = [
  "Remote Work Option",
  "Flexible Hours",
  "Screen Reader Compatible Tools",
  "Job Coach / Mentor Support",
  "Accessible Transport Support",
  "Quiet Workspace",
  "Captioned Meetings",
  "Extended Interview Time"
];

export const JOB_ACCESSIBILITY_FEATURES = [...COMPANY_ACCESSIBILITY_FACILITIES, ...JOB_ACCESSIBILITY_EXTRAS];

// --- Mirrors backend/src/constants/verification.js ---

export const RECRUITER_DOC_TYPES = [
  "Certificate of Incorporation",
  "GST Certificate",
  "PAN Card",
  "Company Registration"
];

export const CANDIDATE_DOC_TYPES = ["UDID Card", "Disability Certificate", "Government ID"];

export const VERIFICATION_DOC_TYPES = [...RECRUITER_DOC_TYPES, ...CANDIDATE_DOC_TYPES, "Other"];
