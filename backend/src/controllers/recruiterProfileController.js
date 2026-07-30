import Job from "../models/Job.js";
import Application from "../models/Application.js";
import Interview from "../models/Interview.js";
import {
  uploadLogo,
  logoPublicPath,
  uploadVerificationDoc,
  verificationDocPublicPath,
} from "../middleware/upload.js";
import { fail, ok } from "../utils/apiResponse.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import {
  buildProfileSummary,
  computeProfileCompletion,
  submitForVerification,
  syncOnboardingStatus,
  updateRecruiterProfile,
} from "../services/recruiterProfileService.js";
import { recruiterVerificationDocSchema } from "../validators/recruiterValidators.js";
import { unlinkVerificationFile } from "./documentController.js";

/**
 * Recruiter company-profile management. This controller owns profile data
 * only — jobs live in recruiterController, interviews in interviewController.
 */

/** Serialises a profile together with its derived completion state. */
const present = (profile, user) => ({
  profile,
  profileCompletion: computeProfileCompletion(profile),
  verificationStatus: user.verificationStatus,
  rejectionReason: user.rejectionReason,
});

// GET /api/recruiter/profile
export const getProfile = async (req, res) => {
  const profile = await RecruiterProfile.findOne({ userId: req.user._id });
  if (!profile) {
    return fail(res, 404, "Recruiter profile not found", "PROFILE_NOT_FOUND");
  }

  return ok(res, present(profile, req.user));
};

// PUT /api/recruiter/profile
export const updateProfile = async (req, res) => {
  const updates = req.body;

  const profile = await updateRecruiterProfile(req.user._id, updates);
  if (!profile) {
    return fail(res, 404, "Recruiter profile not found", "PROFILE_NOT_FOUND");
  }

  await syncOnboardingStatus(profile);
  return ok(res, present(profile, req.user));
};

// PATCH /api/recruiter/profile/accessibility
export const updateAccessibility = async (req, res) => {
  const { accessibilityFacilities } = req.body;

  const profile = await updateRecruiterProfile(req.user._id, {
    accessibilityFacilities,
  });
  if (!profile) {
    return fail(res, 404, "Recruiter profile not found", "PROFILE_NOT_FOUND");
  }

  await syncOnboardingStatus(profile);
  return ok(res, present(profile, req.user));
};

// PATCH /api/recruiter/profile/logo  (multipart/form-data, field name "logo")
export const updateLogo = async (req, res) => {
  uploadLogo(req, res, async (err) => {
    if (err) {
      return fail(res, 400, err.message || "Logo upload failed", "UPLOAD_FAILED");
    }
    if (!req.file) {
      return fail(res, 400, "No logo file uploaded", "NO_FILE");
    }

    try {
      const profile = await updateRecruiterProfile(req.user._id, {
        companyLogo: logoPublicPath(req.file.filename),
      });
      if (!profile) {
        return fail(res, 404, "Recruiter profile not found", "PROFILE_NOT_FOUND");
      }

      await syncOnboardingStatus(profile);
      return ok(res, present(profile, req.user));
    } catch (uploadErr) {
      console.error("[RecruiterProfile] Logo update error:", uploadErr);
      return fail(res, 500, "Could not save the uploaded logo");
    }
  });
};

/**
 * PATCH /api/recruiter/profile/verification-document
 * (multipart/form-data, field name "document")
 *
 * `verificationDocuments` has been on this schema since onboarding was built
 * and had no writer, so admins approved companies with nothing to review.
 */
export const uploadRecruiterVerificationDoc = async (req, res) => {
  uploadVerificationDoc(req, res, async (err) => {
    if (err) {
      return fail(res, 400, err.message || "Upload failed", "UPLOAD_FAILED");
    }
    if (!req.file) {
      return fail(res, 400, "No document uploaded", "NO_FILE");
    }

    // Multipart fields do not exist until multer has parsed the body, so this
    // cannot be a validate() middleware.
    const parsed = recruiterVerificationDocSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, parsed.error.errors[0].message, "VALIDATION_ERROR");
    }

    try {
      const profile = await RecruiterProfile.findOneAndUpdate({ userId: req.user._id }, {
        $push: {
          verificationDocuments: {
            url: verificationDocPublicPath(req.file.filename),
            docType: parsed.data.docType,
          },
        },
      }, { new: true, runValidators: true });
      if (!profile) {
        return fail(res, 404, "Recruiter profile not found", "PROFILE_NOT_FOUND");
      }

      await syncOnboardingStatus(profile);
      return ok(res, present(profile, req.user));
    } catch (uploadErr) {
      console.error("[RecruiterProfile] Verification doc error:", uploadErr);
      return fail(res, 500, "Could not save the uploaded document");
    }
  });
};

/**
 * DELETE /api/recruiter/profile/verification-document
 *
 * `$pull` is scoped by `userId` as well as `url`, so a recruiter can only
 * detach a document from their own profile.
 */
export const deleteRecruiterVerificationDoc = async (req, res) => {
  const { url } = req.body;

  const profile = await RecruiterProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $pull: { verificationDocuments: { url } } },
    { new: true }
  );
  if (!profile) {
    return fail(res, 404, "Recruiter profile not found", "PROFILE_NOT_FOUND");
  }

  await unlinkVerificationFile(url);

  await syncOnboardingStatus(profile);
  return ok(res, present(profile, req.user));
};

// POST /api/recruiter/profile/submit
export const submitProfileForVerification = async (req, res) => {
  const result = await submitForVerification(req.user._id);

  if (!result.ok) {
    return res.status(400).json({
      success: false,
      code: "PROFILE_INCOMPLETE",
      message: `Complete your company profile before submitting: ${result.missingRequired.join(", ")}`,
      missingRequired: result.missingRequired,
    });
  }

  return ok(res, {
    message:
      req.user.verificationStatus === "VERIFIED"
        ? "Company profile updated."
        : "Company profile submitted for verification. An admin will review it shortly.",
    ...present(result.profile, req.user),
  });
};

/**
 * GET /api/recruiter/dashboard/stats
 *
 * One request for everything the dashboard header needs (spec §8). The client
 * previously derived these by fetching every job and then one interview
 * request per shortlisted applicant.
 */
export const getDashboardStats = async (req, res) => {
  const recruiterId = req.user._id;

  const profile = await RecruiterProfile.findOne({ userId: recruiterId });
  if (!profile) {
    // Registration creates the profile alongside the User, so a recruiter
    // without one is a broken account, not a state to render around.
    return fail(res, 404, "Recruiter profile not found", "PROFILE_NOT_FOUND");
  }

  const jobIds = await Job.find({ recruiterId }).distinct("_id");

  const [jobsPosted, activeJobs, applicationsReceived, shortlistedCount, interviewsScheduled] =
    await Promise.all([
      Job.countDocuments({ recruiterId }),
      Job.countDocuments({ recruiterId, isActive: true }),
      Application.countDocuments({ jobId: { $in: jobIds } }),
      // `status`, not the removed `shortlisted` boolean — see models/Application.
      Application.countDocuments({ jobId: { $in: jobIds }, status: "SHORTLISTED" }),
      Interview.countDocuments({ recruiterId }),
    ]);

  return ok(res, {
    stats: {
      jobsPosted,
      activeJobs,
      applicationsReceived,
      shortlistedCount,
      interviewsScheduled,
    },
    company: {
      companyName: profile.companyName,
      companyLogo: profile.companyLogo,
      industry: profile.industry,
      website: profile.website,
      averageRating: profile.averageRating,
      reviewCount: profile.reviewCount,
      accessibilityFacilities: profile.accessibilityFacilities,
      onboardingStatus: profile.onboardingStatus,
    },
    profileCompletion: computeProfileCompletion(profile),
    profileSummary: buildProfileSummary(profile),
    verificationStatus: req.user.verificationStatus,
    rejectionReason: req.user.rejectionReason,
  });
};
