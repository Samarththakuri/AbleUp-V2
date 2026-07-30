import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  scheduleInterviewSchema,
  respondToInterviewSchema,
} from "../validators/interviewValidators.js";
import {
  scheduleInterview,
  respondToInterview,
  getMyInterviews,
  getApplicationInterview,
} from "../controllers/interviewController.js";

const router = Router();
router.use(auth);

// Role gates come from requireRole here, as they do on every other router.
// This one checked `req.user.role !== "RECRUITER"` inline in the handler.
router.post(
  "/schedule",
  requireRole("RECRUITER"),
  validate(scheduleInterviewSchema),
  scheduleInterview
);
router.put(
  "/:interviewId/respond",
  requireRole("CANDIDATE"),
  validate(respondToInterviewSchema),
  respondToInterview
);
router.get("/my", getMyInterviews);
// Candidate-side lookup for a single application. Recruiters no longer call
// this: /recruiter/job/:jobId/applicants embeds the interview per row, which
// was one HTTP request per shortlisted applicant before.
router.get("/application/:applicationId", getApplicationInterview);

export default router;
