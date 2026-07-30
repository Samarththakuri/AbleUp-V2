import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from "../validators/authValidators.js";
import {
  register,
  login,
  getMe,
  deleteAccount,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from "../controllers/authController.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
// These four carried no validate() and hand-rolled their checks in the handler
// instead. forgot-password in particular reached User.findOne with an
// un-normalised address, so a mixed-case email silently found no account.
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.get("/me", auth, getMe);
router.delete("/delete-account", auth, validate(deleteAccountSchema), deleteAccount);
router.post("/change-password", auth, validate(changePasswordSchema), changePassword);

export default router;
