import multer from "multer";
import path from "path";
import fs from "fs";

const resumeDir = process.env.UPLOAD_DIR || "./uploads/resumes";
const logoDir = process.env.LOGO_UPLOAD_DIR || "./uploads/logos";

/**
 * Verification documents live OUTSIDE ./uploads on purpose.
 *
 * `server.js` mounts `./uploads` with `express.static`, which has no auth of
 * any kind — anyone who knows or guesses a filename can fetch it. These files
 * are UDID cards, disability certificates and government IDs: the medical and
 * identity records of disabled people. They are served only through
 * `GET /api/documents/:filename`, which checks that the caller either owns the
 * document or is an admin.
 *
 * Keeping them in a sibling directory means a future `express.static` addition
 * cannot accidentally expose them.
 */
export const verificationDir =
  process.env.VERIFICATION_UPLOAD_DIR || "./private/verification";

for (const dir of [resumeDir, logoDir, verificationDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const diskStorage = (dest) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  });

/**
 * Checks extension AND mime type. Extension alone (the previous behaviour) is
 * trivially spoofed by renaming a file.
 */
const makeFileFilter =
  (
    allowedExts,
    allowedMimes,
    label,
    // Some browsers send application/octet-stream for .doc/.docx. Allowing it
    // when the extension already matches keeps existing resume uploads working.
    allowGenericMime = false,
  ) =>
  (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk =
      allowedMimes.includes(file.mimetype) ||
      (allowGenericMime && file.mimetype === "application/octet-stream");

    if (allowedExts.includes(ext) && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error(`Only ${label} files are allowed`));
    }
  };

export const uploadResume = multer({
  storage: diskStorage(resumeDir),
  fileFilter: makeFileFilter([".pdf", ".doc", ".docx"], [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ], "PDF, DOC, DOCX", true),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single("resume");

export const uploadLogo = multer({
  storage: diskStorage(logoDir),
  fileFilter: makeFileFilter(
    [".jpg", ".jpeg", ".png", ".webp"],
    ["image/jpeg", "image/png", "image/webp"],
    "JPG, PNG, WEBP"
  ),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}).single("logo");

/**
 * Proof uploaded for admin verification — UDID cards, disability certificates,
 * incorporation documents.
 *
 * Both profiles have carried a `verificationDocuments` array for a while with
 * no route that could ever write to it, so admins approved accounts with
 * nothing to look at. This is that route's uploader.
 */
export const uploadVerificationDoc = multer({
  storage: diskStorage(verificationDir),
  fileFilter: makeFileFilter(
    [".pdf", ".jpg", ".jpeg", ".png"],
    ["application/pdf", "image/jpeg", "image/png"],
    "PDF, JPG, PNG"
  ),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single("document");

/** Public URL path for a stored logo file. */
export const logoPublicPath = (filename) => `/uploads/logos/${filename}`;

/**
 * URL for a stored verification document.
 *
 * Points at the authenticated API route, not the static mount — these files are
 * not on a publicly readable path. The client fetches it with its bearer token
 * (see `fetchProtectedFile` in the frontend's lib/api.js).
 */
export const verificationDocPublicPath = (filename) =>
  `/api/documents/${filename}`;

/** Filename back out of a stored document URL, or null if it is not one of ours. */
export const verificationDocFilename = url => {
  const match = /^\/api\/documents\/([^/]+)$/.exec(url);
  return match ? match[1] : null;
};
