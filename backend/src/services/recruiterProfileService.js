import RecruiterProfile from "../models/RecruiterProfile.js";

/**
 * Weighted completion checklist. Weights are relative, not percentages —
 * the total is normalised below, so adding a field never breaks the maths.
 * `required: true` fields also gate submission for verification.
 */
const COMPLETION_FIELDS = [
  { key: "companyName", label: "Company name", weight: 2, required: true, isDone: (p) => !!p.companyName?.trim() },
  { key: "industry", label: "Industry", weight: 2, required: true, isDone: (p) => !!p.industry?.trim() },
  { key: "companySize", label: "Company size", weight: 1, required: true, isDone: (p) => !!p.companySize },
  { key: "companyDescription", label: "Company description", weight: 2, required: true, isDone: (p) => (p.companyDescription?.trim().length || 0) >= 30 },
  { key: "hrContactPerson", label: "HR contact person", weight: 2, required: true, isDone: (p) => !!p.hrContactPerson?.trim() },
  { key: "hrContactNumber", label: "HR contact number", weight: 2, required: true, isDone: (p) => !!p.hrContactNumber?.trim() },
  { key: "accessibilityFacilities", label: "Accessibility facilities", weight: 3, required: true, isDone: (p) => (p.accessibilityFacilities?.length || 0) > 0 },
  // Required: an admin approving a company with no proof attached is the
  // verification gate doing nothing. This array had no writer at all until the
  // document endpoints existed, so it could not be a check before now.
  { key: "verificationDocuments", label: "Verification document", weight: 3, required: true, isDone: (p) => (p.verificationDocuments?.length || 0) > 0 },
  { key: "website", label: "Website", weight: 1, required: false, isDone: (p) => !!p.website?.trim() },
  { key: "companyLogo", label: "Company logo", weight: 2, required: false, isDone: (p) => !!p.companyLogo?.trim() },
  { key: "city", label: "City", weight: 1, required: false, isDone: (p) => !!p.city?.trim() },
  { key: "companyEmail", label: "Company email", weight: 1, required: false, isDone: (p) => !!p.companyEmail?.trim() },
];

export const computeProfileCompletion = profile => {
  const checks = COMPLETION_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    weight: f.weight,
    required: f.required,
    done: f.isDone(profile),
  }));

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => (c.done ? sum + c.weight : sum), 0);

  return {
    percentage: totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100),
    checks,
    missingRequired: checks.filter((c) => c.required && !c.done).map((c) => c.label),
  };
};

/** A profile is "complete" once every required field is filled. */
export const isProfileComplete = profile => computeProfileCompletion(profile).missingRequired.length === 0;

/**
 * Creates the RecruiterProfile that accompanies a new recruiter User.
 * Called from registration (and admin user creation) — never from job flows.
 */
export const createRecruiterProfile = async (userId, input) => {
  const profile = await RecruiterProfile.create({
    userId,
    companyName: input.companyName.trim(),
    website: input.website,
    industry: input.industry,
    companySize: input.companySize,
    companyDescription: input.companyDescription,
    hrContactPerson: input.hrContactPerson,
    hrContactNumber: input.hrContactNumber,
    onboardingStatus: "INCOMPLETE",
  });

  // A profile supplied fully at signup should not be reported as INCOMPLETE.
  return syncOnboardingStatus(profile);
};

/**
 * Recomputes onboardingStatus from the data. Never downgrades a profile that
 * an admin has already marked COMPLETE (verified), and never silently
 * un-submits a profile awaiting review.
 */
export const syncOnboardingStatus = async profile => {
  if (profile.onboardingStatus === "COMPLETE") return profile;

  const complete = isProfileComplete(profile);

  if (!complete && profile.onboardingStatus !== "INCOMPLETE") {
    profile.onboardingStatus = "INCOMPLETE";
    await profile.save();
  }
  return profile;
};

/** Partial update of the editable company fields. */
export const updateRecruiterProfile = async (userId, updates) => {
  const profile = await RecruiterProfile.findOne({ userId });
  if (!profile) return null;

  // `updates` has already been through a Zod schema that strips unknown keys,
  // so the review aggregates (averageRating, reviewCount) cannot be reached.
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) (profile)[key] = value;
  });

  await profile.save();
  return profile;
};

/**
 * Marks the profile as submitted for admin review. Returns the missing
 * required fields instead of throwing so the controller can 400 with detail.
 */
export const submitForVerification = async userId => {
  const profile = await RecruiterProfile.findOne({ userId });
  if (!profile) return { ok: false, missingRequired: ["Company profile"] };

  const completion = computeProfileCompletion(profile);
  if (completion.missingRequired.length > 0) {
    return { ok: false, missingRequired: completion.missingRequired };
  }

  // Already verified — nothing to resubmit.
  if (profile.onboardingStatus !== "COMPLETE") {
    profile.onboardingStatus = "SUBMITTED";
    profile.submittedForVerificationAt = new Date();
    await profile.save();
  }

  return { ok: true, profile };
};

/**
 * Compact profile summary embedded in auth responses so the client can decide
 * where to route (onboarding / pending / dashboard) without a second request.
 */
export const buildProfileSummary = (profile) => {
  if (!profile) return null;
  return {
    companyName: profile.companyName,
    companyLogo: profile.companyLogo,
    onboardingStatus: profile.onboardingStatus,
    profileCompletion: computeProfileCompletion(profile).percentage,
  };
};
