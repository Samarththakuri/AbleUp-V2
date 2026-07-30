import { Router } from "express";
import { searchJobs, getJobById, getSimilarJobs, getPublicRecruiterProfile } from "../controllers/jobController.js";

const router = Router();

router.get("/search", searchJobs);
router.get("/recruiter/:recruiterId", getPublicRecruiterProfile);
router.get("/:jobId", getJobById);
router.get("/:jobId/similar", getSimilarJobs);

export default router;

