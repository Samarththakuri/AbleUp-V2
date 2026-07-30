import fs from "fs/promises";
import path from "path";
import CandidateProfile from "../models/CandidateProfile.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import { verificationDir, verificationDocPublicPath } from "../middleware/upload.js";
import { fail } from "../utils/apiResponse.js";

/**
 * Serves verification documents behind authentication.
 *
 * The rest of `./uploads` is mounted with `express.static` and is readable by
 * anyone with the URL. That is tolerable for company logos. It is not tolerable
 * for UDID cards, disability certificates and government IDs, which is why
 * these files are stored outside that directory and reachable only here.
 *
 * Access rule: you may read a document if it is attached to your own profile,
 * or if you are an admin (who has to read them to make a verification
 * decision). Nobody else, including other candidates and other recruiters.
 */

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/** True if `filename` is attached to the requesting user's own profile. */
const ownsDocument = async (userId, url) => {
  const [candidate, recruiter] = await Promise.all([
    CandidateProfile.exists({ userId, "verificationDocuments.url": url }),
    RecruiterProfile.exists({ userId, "verificationDocuments.url": url }),
  ]);
  return !!candidate || !!recruiter;
};

// GET /api/documents/:filename
export const streamVerificationDocument = async (req, res) => {
  const { filename } = req.params;

  /**
   * Path traversal guard. `path.basename` strips any directory component, so
   * "../../.env" collapses to ".env" and then fails the resolve check below —
   * belt and braces, because this reads from the filesystem by user input.
   */
  const safeName = path.basename(filename);
  const absoluteDir = path.resolve(verificationDir);
  const absolutePath = path.resolve(absoluteDir, safeName);

  if (!absolutePath.startsWith(absoluteDir + path.sep)) {
    return fail(res, 400, "Invalid document path", "INVALID_PATH");
  }

  const extension = path.extname(safeName).toLowerCase();
  if (!CONTENT_TYPES[extension]) {
    return fail(res, 400, "Unsupported document type", "INVALID_PATH");
  }

  // Authorise against the stored URL, never against the path on disk.
  const url = verificationDocPublicPath(safeName);
  const isAdmin = req.user.role === "ADMIN";

  if (!isAdmin && !(await ownsDocument(req.user._id, url))) {
    // 404 rather than 403: a 403 would confirm the file exists to someone
    // probing for other people's documents.
    return fail(res, 404, "Document not found", "DOCUMENT_NOT_FOUND");
  }

  try {
    await fs.access(absolutePath);
  } catch {
    return fail(res, 404, "Document not found", "DOCUMENT_NOT_FOUND");
  }

  res.setHeader("Content-Type", CONTENT_TYPES[extension]);
  // `inline` so admins can preview in-browser; the filename is the stored
  // random one, which never echoes what the uploader called it.
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  // These are personal records — no shared caches, ever.
  res.setHeader("Cache-Control", "private, no-store");

  return res.sendFile(absolutePath);
};

/**
 * Removes the file backing a document URL.
 *
 * Best-effort: a profile that no longer references the document is the outcome
 * that matters, and an orphaned file on disk is preferable to a delete that
 * half-failed and left the profile pointing at nothing.
 */
export const unlinkVerificationFile = async (url) => {
  const match = /^\/api\/documents\/([^/]+)$/.exec(url);
  if (!match) return;

  const absoluteDir = path.resolve(verificationDir);
  const absolutePath = path.resolve(absoluteDir, path.basename(match[1]));
  if (!absolutePath.startsWith(absoluteDir + path.sep)) return;

  try {
    await fs.unlink(absolutePath);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.error("[Documents] Could not delete file:", err);
    }
  }
};
