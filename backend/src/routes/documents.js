import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { streamVerificationDocument } from "../controllers/documentController.js";

/**
 * Verification documents are personal records, so unlike `/uploads` this is
 * behind `auth` and the handler additionally checks ownership. No `requireRole`
 * — both the owner (any role) and admins are legitimate readers, and the
 * handler is the only place that can tell them apart.
 */
const router = Router();

router.get("/:filename", auth, streamVerificationDocument);

export default router;
