import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createUserSchema,
  verifyUserSchema,
  bulkVerifySchema,
} from "../validators/adminValidators.js";
import {
  createUser,
  verifyCandidate,
  verifyRecruiter,
  getRecruiters,
  bulkVerifyRecruiters,
  getAllUsers,
  forcePasswordReset,
} from "../controllers/adminController.js";

const router = Router();
//always hits this first then moves ahead remember that
router.use(auth, requireRole("ADMIN"));
// router.get("/users", auth, requireRole("ADMIN"), getAllUsers); could have written like this too
router.post("/create-user", validate(createUserSchema), createUser);
router.get("/users", getAllUsers);
router.put("/verify/:userId", validate(verifyUserSchema), verifyCandidate);
router.put("/user/:userId/force-reset", forcePasswordReset);

// Recruiter verification queue (spec §2) — only an admin can move a
// recruiter from PENDING to VERIFIED.
router.get("/recruiters", getRecruiters);
router.put("/recruiter/:userId/verify", validate(verifyUserSchema), verifyRecruiter);
router.post(
  "/recruiters/bulk-verify",
  validate(bulkVerifySchema),
  bulkVerifyRecruiters
);

export default router;
