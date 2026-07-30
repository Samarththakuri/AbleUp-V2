// Single source of truth for job-level option lists.
// Mirrored (values only) in frontend/src/constants/company.js — keep both in sync.

import { COMPANY_ACCESSIBILITY_FACILITIES } from "./company.js";

/**
 * Work-hour vocabulary shared by `Job.workHours` and
 * `CandidateProfile.preferredWorkHours`. One list on purpose — a candidate
 * preference that cannot be expressed in the same terms as a job posting is
 * a preference nothing can ever match against.
 */
export const WORK_HOUR_OPTIONS = ["Full-time", "Part-time", "Flexi-time"];

/**
 * Accessibility a *specific role* offers.
 *
 * A superset of the company-wide facilities (re-exported rather than retyped so
 * the two can never diverge) plus arrangements that only make sense per-role.
 * Recruiters pre-fill this from their company profile and then adjust.
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
