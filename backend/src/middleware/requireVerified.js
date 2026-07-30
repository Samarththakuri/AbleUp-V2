import RecruiterProfile from "../models/RecruiterProfile.js";
import { fail } from "../utils/apiResponse.js";

/**
 * Gates write actions behind admin verification.
 *
 * Recruiters now register as PENDING and can only be moved to VERIFIED by an
 * admin, so this is what enforces "PENDING recruiters cannot post jobs".
 * Read endpoints stay open on purpose — a pending recruiter can still browse
 * their (empty) dashboard and finish their company profile.
 */
export const requireVerifiedRecruiter = async (req, res, next) => {
  const user = req.user;
  if (!user) return fail(res, 401, "Authentication required", "UNAUTHENTICATED");

  if (user.role !== "RECRUITER") {
    return fail(res, 403, "Only recruiters can perform this action", "FORBIDDEN");
  }

  const profile = await RecruiterProfile.findOne({ userId: user._id });

  if (!profile || profile.onboardingStatus === "INCOMPLETE") {
    return fail(
      res,
      403,
      "Complete your company profile before posting jobs.",
      "RECRUITER_PROFILE_INCOMPLETE"
    );
  }

  if (user.verificationStatus === "REJECTED") {
    return fail(res, 403, user.rejectionReason
      ? `Your company verification was rejected: ${user.rejectionReason}`
      : "Your company verification was rejected. Please update your profile and resubmit.", "RECRUITER_REJECTED");
  }

  if (user.verificationStatus !== "VERIFIED") {
    return fail(
      res,
      403,
      "Your company is pending admin verification. You'll be able to post jobs once approved.",
      "RECRUITER_NOT_VERIFIED"
    );
  }

  next();
};

/**
 * Candidate equivalent — replaces the inline check that was duplicated inside
 * candidateController.applyToJob.
 */
export const requireVerifiedCandidate = (req, res, next) => {
  const user = req.user;
  if (!user) return fail(res, 401, "Authentication required", "UNAUTHENTICATED");

  if (user.verificationStatus !== "VERIFIED") {
    return fail(res, 403, "Complete UDID verification to apply.", "CANDIDATE_NOT_VERIFIED");
  }

  next();
};
