import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { submitReviewSchema } from "../validators/reviewValidators.js";
import { submitReview, getRecruiterReviews } from "../controllers/reviewController.js";

const router = Router();

// Candidates can submit reviews
router.post(
  "/submit",
  auth,
  requireRole("CANDIDATE"),
  validate(submitReviewSchema),
  submitReview
);

// Public — the same reviews are already served unauthenticated via
// GET /api/jobs/recruiter/:recruiterId, so requiring auth here protected
// nothing while making the endpoint inconsistent.
router.get("/recruiter/:recruiterId", getRecruiterReviews);

export default router;
