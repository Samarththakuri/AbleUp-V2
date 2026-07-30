import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { requireVerifiedRecruiter } from "../middleware/requireVerified.js";
import {
  updateRecruiterProfileSchema,
  updateAccessibilitySchema,
} from "../validators/recruiterValidators.js";
import { deleteVerificationDocSchema } from "../validators/candidateValidators.js";
import { createJobSchema, updateJobSchema } from "../validators/jobValidators.js";
import {
  getRecruiterJobs,
  createJob,
  getJobApplicants,
  shortlistApplication,
  bulkActionApplications,
  getJobSummary,
  updateJob,
  deleteJob,
} from "../controllers/recruiterController.js";
import {
  getProfile,
  updateProfile,
  updateAccessibility,
  updateLogo,
  uploadRecruiterVerificationDoc,
  deleteRecruiterVerificationDoc,
  submitProfileForVerification,
  getDashboardStats,
} from "../controllers/recruiterProfileController.js";

const router = Router();
router.use(auth, requireRole("RECRUITER"));

/**
 * Company profile (spec §4). Declared before the /job/:jobId patterns so the
 * static segments always win, and left ungated by verification: a pending
 * recruiter must be able to read and finish their own profile.
 */
router.get("/profile", getProfile);
router.put("/profile", validate(updateRecruiterProfileSchema), updateProfile);
router.patch("/profile/logo", updateLogo); // multipart — multer runs in the handler
router.patch(
  "/profile/accessibility",
  validate(updateAccessibilitySchema),
  updateAccessibility
);
// Multipart — multer parses the body inside the handler, so docType is
// validated there rather than by validate() middleware.
router.patch("/profile/verification-document", uploadRecruiterVerificationDoc);
router.delete(
  "/profile/verification-document",
  validate(deleteVerificationDocSchema),
  deleteRecruiterVerificationDoc
);
router.post("/profile/submit", submitProfileForVerification);

router.get("/dashboard/stats", getDashboardStats);

/**
 * Jobs. Writes require an admin-verified recruiter; reads stay open so the
 * dashboard renders while verification is pending.
 */
router.get("/jobs", getRecruiterJobs);
router.post("/jobs", requireVerifiedRecruiter, validate(createJobSchema), createJob);
router.get("/job/:jobId/applicants", getJobApplicants);
router.put("/application/:applicationId/shortlist", shortlistApplication);
router.put("/applications/bulk-action", bulkActionApplications);
router.get("/job/:jobId/summary", getJobSummary);
router.put(
  "/job/:jobId",
  requireVerifiedRecruiter,
  validate(updateJobSchema),
  updateJob
);
router.delete("/job/:jobId", deleteJob);

export default router;
