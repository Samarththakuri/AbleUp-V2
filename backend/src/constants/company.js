// Single source of truth for company-level option lists.
// Consumed by the RecruiterProfile schema enums and the Zod DTOs.
// Mirrored (values only) in frontend/src/constants/company.js — keep both in sync.

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

export const ONBOARDING_STATUSES = ["INCOMPLETE", "SUBMITTED", "COMPLETE"];
