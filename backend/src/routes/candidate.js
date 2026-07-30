import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { requireVerifiedCandidate } from "../middleware/requireVerified.js";
import { validate } from "../middleware/validate.js";
import {
  updateCandidateProfileSchema,
  deleteVerificationDocSchema,
} from "../validators/candidateValidators.js";
import {
  getAppliedJobs,
  getSavedJobs,
  toggleSaveJob,
  applyToJob,
  uploadCandidateResume,
  uploadCandidateVerificationDoc,
  deleteCandidateVerificationDoc,
  getProfile,
  updateProfile,
} from "../controllers/candidateController.js";

const router = Router();
router.use(auth, requireRole("CANDIDATE"));

router.get("/applied", getAppliedJobs);
router.get("/saved", getSavedJobs);
router.post("/save/:jobId", toggleSaveJob);
// Verification is checked before multer runs, so a rejected apply no longer
// leaves an orphaned resume file on disk.
router.post("/apply/:jobId", requireVerifiedCandidate, applyToJob);
router.post("/resume", uploadCandidateResume);
// Multipart — multer parses the body inside the handler, so the docType field
// is validated there rather than by validate() middleware.
router.post("/verification-document", uploadCandidateVerificationDoc);
router.delete(
  "/verification-document",
  validate(deleteVerificationDocSchema),
  deleteCandidateVerificationDoc
);
router.get("/profile", getProfile);
// This route had no validate(), so `skills` accepted arbitrary JSON.
router.put("/profile", validate(updateCandidateProfileSchema), updateProfile);

export default router;
