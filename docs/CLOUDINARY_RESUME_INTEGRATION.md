# Implementation Plan — Cloudinary for Candidate Resume Storage

> **Goal:** replace the local-disk resume store (`multer.diskStorage` → `./uploads/resumes`, served by `express.static`) with Cloudinary object storage, without breaking existing records, the recruiter "View Resume" links, or the apply flow.

**Status:** proposed · **Scope:** `backend/` (storage layer, 2 controllers, 2 models, env) + `frontend/` (URL resolution helper, 4 call sites) · **Estimated effort:** ~1 day for Phase 1–3, +0.5 day for Phase 4 (private delivery).

---

## 1. Why change

| Problem today | Consequence |
|---|---|
| Files live on the container's local disk (`backend/uploads/resumes`) | Any redeploy/restart on an ephemeral filesystem host (Render, Railway, Fly, Heroku, most containers) **silently loses every resume**; `resumeUrl` in Mongo then points at a 404. |
| No horizontal scaling | Two API instances = a candidate uploads to instance A, a recruiter's download hits instance B and 404s. |
| Files served from the app process | Resume downloads consume Node event-loop time and app bandwidth; no CDN, no caching. |
| `app.use("/uploads", express.static(...))` is **completely unauthenticated** | Anyone who guesses/leaks a filename can read a resume. On a platform whose users are PwD candidates (resumes sit next to UDID/disability data), that is a real privacy exposure, not a theoretical one. |
| No delete path | Re-uploading a resume orphans the old file forever. |

Cloudinary fixes durability, CDN delivery, and (Phase 4) gives us signed, expiring, access-controlled URLs.

---

## 2. Current state — exactly what touches resumes

**Backend**

| File | Role today |
|---|---|
| [backend/src/middleware/upload.js](../backend/src/middleware/upload.js) | `multer.diskStorage` → `UPLOAD_DIR` (default `./uploads/resumes`), random filename, extension filter (`.pdf/.doc/.docx`), 5 MB limit, exported as `uploadResume` (`.single("resume")`). |
| [backend/src/controllers/candidateController.js:120](../backend/src/controllers/candidateController.js#L120) | `uploadCandidateResume` — writes `resumeUrl = "/uploads/resumes/<file>"` onto `CandidateProfile` (upsert). |
| [backend/src/controllers/candidateController.js:60](../backend/src/controllers/candidateController.js#L60) | `applyToJob` — same multer middleware; resume resolution order: uploaded file → `req.body.resumeUrl` → profile's `resumeUrl`; snapshot stored on the `Application`. |
| [backend/src/models/CandidateProfile.js:22](../backend/src/models/CandidateProfile.js#L22) | optional `resumeUrl` string (also `udidDocumentUrl` — same future problem, out of scope here). |
| [backend/src/models/Application.js:26](../backend/src/models/Application.js#L26) | optional `resumeUrl` string (per-application snapshot). |
| [backend/src/server.js:36](../backend/src/server.js#L36) | `app.use("/uploads", express.static(...))` — public static serving. |
| [backend/src/controllers/recruiterController.js:91](../backend/src/controllers/recruiterController.js#L91) | Returns `applicationResumeUrl` + the whole `candidateProfile` (which carries `resumeUrl`). |
| [backend/src/config/env.js](../backend/src/config/env.js) | Zod-validated env, `process.exit(1)` on failure. `UPLOAD_DIR` is read directly in `upload.js`, **not** part of the schema. `LOCAL_UPLOAD` exists in `.env` but is unused in code. |

**Frontend**

| File | Role today |
|---|---|
| [frontend/src/components/candidate/ResumeUpload.jsx:58](../frontend/src/components/candidate/ResumeUpload.jsx#L58) | `apiUpload("/candidate/resume", formData)` — note the `catch` block fakes success ("Uploaded (offline)"), which **hides real upload failures**. |
| [frontend/src/pages/candidate/JobDetailPage.jsx:158](../frontend/src/pages/candidate/JobDetailPage.jsx#L158) | Apply dialog posts `resume` + `coverLetter` to `/candidate/apply/:id`. |
| [frontend/src/pages/recruiter/JobApplicantsPage.jsx:360](../frontend/src/pages/recruiter/JobApplicantsPage.jsx#L360) | `href={`${API_BASE_URL.replace("/api","")}${applicant.resumeUrl}`}` |
| [frontend/src/pages/recruiter/RecruiterDashboard.jsx:367](../frontend/src/pages/recruiter/RecruiterDashboard.jsx#L367) | Same string concatenation. |
| [frontend/src/pages/admin/AdminDashboard.jsx:196](../frontend/src/pages/admin/AdminDashboard.jsx#L196) | Same pattern for `udidDocumentUrl` — will benefit from the shared helper. |

> ⚠️ **The breaking detail:** those four call sites *prepend the API origin*. The moment `resumeUrl` becomes an absolute `https://res.cloudinary.com/...`, they produce `http://localhost:5000https://res.cloudinary.com/...`. A URL-resolution helper is **mandatory**, not optional polish.

---

## 3. Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Upload mechanism | `multer.memoryStorage()` + `cloudinary.uploader.upload_stream` piped from the buffer | Avoids the extra `multer-storage-cloudinary` dependency and its version coupling to the SDK; gives full control over `public_id`, folder, tags, `access_mode`, and error mapping. Files are ≤ 5 MB, so buffering is safe. |
| Storage abstraction | `src/services/storageService.js` with a `StorageDriver` interface, `cloudinary` + `local` implementations, selected by `STORAGE_DRIVER` env | Keeps controllers storage-agnostic, keeps local dev working with no Cloudinary account, and gives an instant rollback switch. |
| `resource_type` | `"raw"` for all resume types | `"auto"` classifies PDFs as `image`, which is subject to Cloudinary's "Allow delivery of PDF and ZIP files" account setting (**off by default** on newer accounts → 401 on delivery). `raw` sidesteps that and treats `.doc`/`.docx` identically. |
| What we persist | Keep `resumeUrl` (now absolute) **and add `resumePublicId`** | `public_id` is the only durable handle for delete/replace/signing; a URL is not. |
| `Application.resumeUrl` snapshot | Keep the snapshot, add `resumePublicId` | An application must show the resume as it was *at apply time*; profile updates must not rewrite history. |
| Access control | **Phase 1–3 public** `access_mode: "public"` with unguessable `public_id`; **Phase 4** `type: "authenticated"` + short-lived signed URLs behind an authorized redirect endpoint | Ships value fast without a big-bang change; Phase 4 is where the real privacy win lands. Do not stop at Phase 3 in production. |
| Old files on disk | Leave them; keep `express.static("/uploads")` during transition; backfill via a one-off script | Existing `Application.resumeUrl` values are relative paths — removing static serving before migrating breaks recruiter access to historic applications. |
| Folder layout | `ableup/resumes/<userId>/<timestamp>-<random>` | Namespaced per candidate → easy per-user cleanup on account deletion (DPDP Act erasure requests) and readable in the Cloudinary Media Library. |

---

## 4. Implementation phases

### Phase 0 — Account & configuration (30 min)

1. Create a Cloudinary account; from the dashboard copy **Cloud name / API key / API secret**.
2. In *Settings → Security*, leave PDF delivery **off** (we use `raw`), and note the account's *strict transformations* setting.
3. Add to `backend/.env` (already git-ignored):

```dotenv
STORAGE_DRIVER=cloudinary          # cloudinary | local
CLOUDINARY_CLOUD_NAME=xxxx
CLOUDINARY_API_KEY=xxxx
CLOUDINARY_API_SECRET=xxxx
CLOUDINARY_FOLDER=ableup/resumes
CLOUDINARY_SIGNED_URL_TTL=600      # seconds, Phase 4
```

4. Create `backend/.env.example` with the same keys and empty values (the repo has none today).
5. Install: `npm i cloudinary` in `backend/` (v2 SDK; `import { v2 as cloudinary } from "cloudinary"`). No `streamifier` needed — use `Readable.from(buffer)` from `node:stream`.

### Phase 1 — Config & storage service (backend)

**1.1 Extend [backend/src/config/env.js](../backend/src/config/env.js)**

Add optional keys plus a `superRefine` that requires the three Cloudinary credentials **only when** `STORAGE_DRIVER === "cloudinary"`. Keeping them optional preserves the current fail-fast behaviour without forcing every contributor to hold Cloudinary keys.

```js
const envSchema = z.object({
  // ...existing
  STORAGE_DRIVER: z.enum(["local", "cloudinary"]).default("local"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default("ableup/resumes"),
  CLOUDINARY_SIGNED_URL_TTL: z.coerce.number().default(600),
  UPLOAD_DIR: z.string().default("./uploads/resumes"),
}).superRefine((v, ctx) => {
  if (v.STORAGE_DRIVER === "cloudinary" &&
      !(v.CLOUDINARY_CLOUD_NAME && v.CLOUDINARY_API_KEY && v.CLOUDINARY_API_SECRET)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["CLOUDINARY_CLOUD_NAME"],
      message: "Cloudinary credentials are required when STORAGE_DRIVER=cloudinary" });
  }
});
```

Also drop the unused `LOCAL_UPLOAD` key from `.env`, and switch `upload.js` to read `env.UPLOAD_DIR` instead of `process.env`.

**1.2 New `backend/src/config/cloudinary.js`** — configure the SDK once at import (`cloud_name`, `api_key`, `api_secret`, `secure: true`) and export the instance.

**1.3 New `backend/src/services/storageService.js`**

Every driver resolves uploads to the same object shape:

```js
{
  url,          // string — absolute (Cloudinary) or relative (local, legacy shape)
  publicId,     // string | null — null for the local driver
  bytes,        // number
  originalName, // string
  format,       // string — "pdf" | "doc" | "docx"
}
```

and exposes the same three methods:

```js
// upload(file, { userId, kind })  -> Promise of the object above.
//   `file` is the multer file (memoryStorage, so `file.buffer` is populated);
//   `kind` is "resume" today.
// remove(publicId)                -> Promise<void>. Best-effort, never throws.
// signedUrl(publicId, ttlSeconds) -> string. Phase 4; identity for local.
```

- `cloudinaryDriver.upload` → `upload_stream({ folder: `${env.CLOUDINARY_FOLDER}/${userId}`, resource_type: "raw", public_id: `${Date.now()}-${crypto.randomUUID()}`, use_filename: false, unique_filename: true, overwrite: false, tags: ["resume", userId], context: { originalName: file.originalname } })`, with `Readable.from(file.buffer).pipe(stream)`; resolve `{ url: result.secure_url, publicId: result.public_id, ... }`.
- `localDriver.upload` writes the buffer to `env.UPLOAD_DIR` (preserving today's `Date.now()-random.ext` naming) and returns the `/uploads/resumes/<file>` relative URL — behaviour-identical to today, so `STORAGE_DRIVER=local` is a true rollback.
- `remove` swallows errors and logs — a failed cleanup must never fail the user's request (same posture as the mailer side-channel).
- Export a single `storage` selected by `env.STORAGE_DRIVER`.

**1.4 Rewrite [backend/src/middleware/upload.js](../backend/src/middleware/upload.js)**

- `multer.memoryStorage()`; keep the 5 MB limit and the extension allow-list, and additionally validate `file.mimetype` against the three MIME types the frontend already enforces (extension-only checking is trivially bypassable).
- Keep the exported name `uploadResume` and the `.single("resume")` shape so no call site changes.
- Map multer's `LIMIT_FILE_SIZE` to a friendly 400 message ("File too large. Maximum size is 5MB.").
- Delete the `fs.mkdirSync` at module load (that now belongs to the local driver only).

### Phase 2 — Models & controllers (backend)

**2.1 [CandidateProfile.js](../backend/src/models/CandidateProfile.js)** — add, all optional and non-breaking:

```
resumePublicId      String, optional
resumeOriginalName  String, optional
resumeSizeBytes     Number, optional
resumeUploadedAt    Date,   optional
```

**2.2 [Application.js](../backend/src/models/Application.js)** — add `resumePublicId` and `resumeOriginalName` (both optional strings) alongside the existing `resumeUrl` snapshot.

**2.3 `uploadCandidateResume`** ([candidateController.js:120](../backend/src/controllers/candidateController.js#L120))

1. Read the existing profile first (need the old `resumePublicId`).
2. `const stored = await storage.upload(req.file, { userId, kind: "resume" })`.
3. Update the profile with all five fields (`upsert: true`, `new: true`).
4. **After** the DB write succeeds, best-effort `storage.remove(oldPublicId)` — never before, or a failed write orphans the candidate with no resume.
5. Respond `{ success: true, resumeUrl, resumeOriginalName, resumeUploadedAt }`.
6. Wrap the Cloudinary call so an upstream failure returns **502** with a clear message rather than a generic 500.

**2.4 `applyToJob`** ([candidateController.js:60](../backend/src/controllers/candidateController.js#L60))

- Same resolution order, but only call `storage.upload` **after** the verification / job-active / duplicate-application guards pass. Today the file is written to disk before those checks, so every rejected apply leaves a junk file — on Cloudinary that would be a junk *billable asset*.
  → Concretely: multer buffers into memory (cheap, discarded on return); upload to Cloudinary happens just before `Application.create`.
- Drop the `req.body.resumeUrl` passthrough, or validate it against the candidate's own `resumeUrl`. Right now a client can put an arbitrary string in that field and have it stored and rendered as a link to recruiters.
- Persist `resumeUrl` + `resumePublicId` + `resumeOriginalName` on the Application. Do **not** delete this asset when the profile resume is later replaced (see §5).

**2.5 Delete endpoint (new, optional but recommended)** — `DELETE /api/candidate/resume` clears the profile fields and calls `storage.remove`. The UI already has a remove button that currently only clears local component state.

### Phase 3 — Frontend URL resolution

**3.1 New helper in [frontend/src/lib/api.js](../frontend/src/lib/api.js)**

```js
export const resolveFileUrl = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;              // Cloudinary (new)
  return `${API_BASE_URL.replace(/\/api\/?$/, "")}${url.startsWith("/") ? "" : "/"}${url}`; // legacy disk path
};
```

This is the single piece of backward compatibility that lets old and new records coexist — no data migration is required for the app to work.

**3.2 Replace the four concatenation sites** with `resolveFileUrl(...)`:
[JobApplicantsPage.jsx:360](../frontend/src/pages/recruiter/JobApplicantsPage.jsx#L360), [RecruiterDashboard.jsx:367](../frontend/src/pages/recruiter/RecruiterDashboard.jsx#L367), [AdminDashboard.jsx:196](../frontend/src/pages/admin/AdminDashboard.jsx#L196), plus any candidate-side link. Add `download` / `rel="noopener noreferrer"` (already present on the recruiter links).

**3.3 Fix the fake-success fallback** in [ResumeUpload.jsx:61-69](../frontend/src/components/candidate/ResumeUpload.jsx#L61-L69) — show a destructive toast with the real error instead of "Uploaded (offline)". With remote storage a false "uploaded" is worse than before: the candidate believes a resume exists and applies without one.

**3.4 Show real state** — after upload, render the persisted `resumeOriginalName` + a "View" link from `resolveFileUrl(profile.resumeUrl)`, and hydrate from `GET /candidate/profile` on mount so a page refresh doesn't lose the "uploaded" indicator (it currently does).

### Phase 4 — Private delivery (do before real candidate data lands)

1. Upload with `type: "authenticated"` (or `access_control: [{ access_type: "token" }]`) so the raw URL alone is not enough to fetch the file.
2. New backend endpoints that authorize, then **302-redirect** to a freshly signed URL (`cloudinary.utils.private_download_url` / signed delivery with `expires_at = now + CLOUDINARY_SIGNED_URL_TTL`):
   - `GET /api/candidate/resume/download` — the candidate's own resume.
   - `GET /api/recruiter/applications/:applicationId/resume` — 403 unless the requesting recruiter owns the application's job (mirror the ownership check in [recruiterController.js:63](../backend/src/controllers/recruiterController.js#L63)).
   - `GET /api/admin/users/:userId/udid-document` when the same treatment is extended to UDID docs.
3. Recruiter/admin API responses stop returning raw storage URLs and instead return `resumeDownloadPath` (an API path). Update `resolveFileUrl` call sites accordingly.
4. Remove `app.use("/uploads", express.static(...))` **only after** the backfill in Phase 5 is complete.
5. Note: signed URLs are short-lived, so the frontend must link to the API endpoint, never cache the redirect target.

### Phase 5 — Backfill & cleanup (one-off script)

`backend/src/scripts/migrateResumesToCloudinary.js` (run with `tsx`, add `"migrate:resumes"` to `package.json` scripts):

1. Query `CandidateProfile` where `resumeUrl` starts with `/uploads/` and `resumePublicId` is null; same for `Application`.
2. For each, read the file from disk (skip + log if missing), `storage.upload`, update the document.
3. Idempotent (re-runnable), `--dry-run` flag, summary report of migrated/skipped/failed.
4. Keep the disk files until the report is clean, then remove static serving and the `uploads/` directory.

### Phase 6 — Docs

Update [docs/ARCHITECTURE.md](./ARCHITECTURE.md): the `Files[/uploads…/]` node in the §2 mermaid diagram → Cloudinary; the "Static files" bullet at §2; the Multer row in the §3 stack table; the schema fields in §4; and move "resumes on local disk" from the trade-offs list to resolved.

---

## 5. Edge cases & decisions to honour

| Case | Handling |
|---|---|
| Candidate replaces their resume after applying | Application snapshots keep their own `resumePublicId`; **never** delete an asset still referenced by an Application. Before `storage.remove(oldPublicId)`, check `Application.exists({ resumePublicId: oldPublicId })`. |
| Cloudinary is down / credentials wrong | Upload returns 502 with an actionable message; the apply flow fails loudly (unlike email, a resume is not best-effort). Consider allowing apply-with-profile-resume to still succeed. |
| Partial failure: uploaded to Cloudinary, DB write fails | Compensating `storage.remove` in the catch block, best-effort. |
| Duplicate apply (409) or unverified candidate (403) | No Cloudinary upload happens at all (Phase 2.4 reordering). |
| Legacy relative URLs | Handled forever by `resolveFileUrl`; no forced migration. |
| Account deletion / erasure request | Everything for a user is under `ableup/resumes/<userId>/` → `cloudinary.api.delete_resources_by_prefix`. |
| `.doc`/`.docx` in browser | `raw` delivery sends `application/octet-stream`; the file downloads rather than previewing. Acceptable; add `fl_attachment` + the original filename so the download is named sensibly. |
| Free-tier limits | 25 GB storage/bandwidth per month; at 5 MB max per resume that is ~5,000 resumes stored. Add a `bytes` log line per upload for visibility. |
| Rate limiting | Uploads pass through the existing 100 req/15 min `/api/` limiter; a stricter per-user upload limiter is worth adding once storage is billable. |

---

## 6. File-change checklist

**New**
- `backend/src/config/cloudinary.js`
- `backend/src/services/storageService.js`
- `backend/src/scripts/migrateResumesToCloudinary.js`
- `backend/.env.example`

**Modified — backend**
- [src/config/env.js](../backend/src/config/env.js) — storage + Cloudinary keys, conditional refinement
- [src/middleware/upload.js](../backend/src/middleware/upload.js) — memory storage, MIME check, error mapping
- [src/controllers/candidateController.js](../backend/src/controllers/candidateController.js) — `uploadCandidateResume`, `applyToJob`, (new) `deleteCandidateResume`
- [src/models/CandidateProfile.js](../backend/src/models/CandidateProfile.js), [src/models/Application.js](../backend/src/models/Application.js) — new optional fields
- [src/routes/candidate.js](../backend/src/routes/candidate.js) — `DELETE /resume`, (Phase 4) `GET /resume/download`
- [src/routes/recruiter.js](../backend/src/routes/recruiter.js) + [src/controllers/recruiterController.js](../backend/src/controllers/recruiterController.js) — (Phase 4) authorized resume redirect
- [src/server.js](../backend/src/server.js) — remove static `/uploads` at the end of Phase 5
- `backend/package.json` — `cloudinary` dep, `migrate:resumes` script

**Modified — frontend**
- [src/lib/api.js](../frontend/src/lib/api.js) — `resolveFileUrl`
- [src/components/candidate/ResumeUpload.jsx](../frontend/src/components/candidate/ResumeUpload.jsx) — real error handling, persisted state, view link
- [src/pages/recruiter/JobApplicantsPage.jsx](../frontend/src/pages/recruiter/JobApplicantsPage.jsx), [src/pages/recruiter/RecruiterDashboard.jsx](../frontend/src/pages/recruiter/RecruiterDashboard.jsx), [src/pages/admin/AdminDashboard.jsx](../frontend/src/pages/admin/AdminDashboard.jsx) — use the helper

---

## 7. Test plan (manual — the repo has no test runner today)

1. `STORAGE_DRIVER=local` → every existing flow behaves exactly as before (regression baseline).
2. `STORAGE_DRIVER=cloudinary`, missing credentials → server exits at boot with the Zod message.
3. Upload a 2 MB PDF via profile → asset appears under `ableup/resumes/<userId>/`, `secure_url` opens, profile shows the filename after a page refresh.
4. Upload `.docx` → succeeds; upload `.txt` renamed to `.pdf` → rejected by the MIME check; upload 8 MB → 400 "File too large".
5. Apply with a new resume → `Application.resumeUrl` is absolute; recruiter's "View Resume" opens it.
6. Apply while `PENDING` (unverified) and apply twice → 403 / 409, and **no** new asset in the Cloudinary Media Library.
7. Apply with no file → falls back to the profile resume.
8. A record with a legacy `/uploads/...` URL still opens for the recruiter (`resolveFileUrl` branch).
9. Replace a resume that an existing application references → the old asset survives; replace an unreferenced one → old asset is removed.
10. Phase 4: signed URL expires after TTL; a recruiter who does not own the job gets 403.

---

## 8. Rollback

Set `STORAGE_DRIVER=local` and redeploy. New uploads go back to disk; already-uploaded Cloudinary URLs keep working because they are absolute and `resolveFileUrl` passes them through untouched. No schema rollback is needed — every new field is optional.
