# Implementation Plan — Remove Inclusivity Scoring, Keep Candidate → Recruiter Reviews

> **Goal:** delete the inclusivity score / tier system end-to-end, leaving **candidate reviews as the only recruiter reputation signal** — and make reviews actually usable, since no submission UI exists today.

**Status:** complete · **Scope:** `backend/` (1 service deleted, 1 added, 4 controllers, 1 model) + `frontend/` (2 components added, 4 pages/components edited, shared types) · **Estimated effort:** ~1 day.

---

## 1. Why change

| Problem today | Consequence |
|---|---|
| `calculateInclusivityScore` blends three unrelated signals (accessibility 40 pts + review rating 40 pts + response rate 20 pts) into one number | A single opaque score that means nothing precise. A recruiter with great reviews and one job post scores the same as one with bad reviews and many. |
| The score is **self-reported and gameable** | 40% of the score comes from `job.accessibilityFeatures.length` — a free-text array the recruiter types themselves. Nothing verifies the ramp exists. On a PwD job portal, a "GOLD Inclusive Employer" badge earned by typing words is actively misleading to the people it is meant to protect. |
| The service is called as a fire-and-forget side effect from 5 places | `createJob`, `updateJob`, `deleteJob`, `shortlistApplication` and `submitReview` all reach into reputation scoring. Job and applicant handlers have no business knowing reputation exists. |
| `averageRating` / `reviewCount` are written **only** inside that service | Deleting it without a replacement silently freezes every recruiter's rating forever. |
| Reviews have **no UI at all** | `POST /api/reviews/submit` exists but nothing in `frontend/src` ever calls `/reviews`. Candidates cannot leave a review. The whole feature is decorative. |
| `submitReview` trusts `recruiterId` from the request body | **Security hole** — see §4.1. Any candidate can attach a review to any recruiter. |

Reviews are the honest signal: they come from candidates who actually interviewed, and a recruiter cannot write their own.

---

## 2. Current state — exactly what touches the feature

### Backend

| File | Role today |
|---|---|
| [backend/src/services/inclusivityService.js](../backend/src/services/inclusivityService.js) | The whole scoring algorithm. **Deleted.** Also the sole writer of `averageRating` / `reviewCount` / `responseRate`. |
| [backend/src/models/RecruiterProfile.js](../backend/src/models/RecruiterProfile.js) | `InclusivityTier` type, `inclusivityScore` / `tier` / `responseRate` fields, `inclusivityTier` virtual. |
| [backend/src/controllers/recruiterController.js](../backend/src/controllers/recruiterController.js) | Import + 4 `void calculateInclusivityScore(...)` call sites. |
| [backend/src/controllers/reviewController.js](../backend/src/controllers/reviewController.js) | Import + 1 call; also the security bug and the eligibility gate. |
| [backend/src/controllers/recruiterProfileController.js](../backend/src/controllers/recruiterProfileController.js) | `getDashboardStats` returns `tier`, `inclusivityScore`, `responseRate`. |
| [backend/src/controllers/jobController.js](../backend/src/controllers/jobController.js) | `getPublicRecruiterProfile` leaks all of them via `profile.toJSON()`. |
| [backend/src/controllers/interviewController.js](../backend/src/controllers/interviewController.js) | `getMyInterviews` does **not** populate `recruiterId` — which the submit call needs. |

### Frontend

| File | Role today |
|---|---|
| `frontend/src/types/index.ts` *(since removed — see note below)* | `InclusivityTier`; score/tier/responseRate on `RecruiterProfile` + `RecruiterDashboardCompany`. |
| [frontend/src/pages/company/CompanyProfilePage.jsx](../frontend/src/pages/company/CompanyProfilePage.jsx) | Tier badge in hero; "Inclusivity Score" + "Response Rate" stat cards; the reviews list (display only). |
| [frontend/src/pages/recruiter/RecruiterDashboard.jsx](../frontend/src/pages/recruiter/RecruiterDashboard.jsx) | `reputationTiles` array; tier badge in the company header. |
| [frontend/src/pages/candidate/JobDetailPage.jsx](../frontend/src/pages/candidate/JobDetailPage.jsx) | Tier header strip + GOLD medal overlay on the company mini-card. |
| [frontend/src/components/candidate/CandidateInterviewCard.jsx](../frontend/src/components/candidate/CandidateInterviewCard.jsx) | Renders **no action at all** for `ACCEPTED`/`COMPLETED` interviews — the gap where "Leave a review" belongs. |

> **Leave alone:** every "Inclusive"/"inclusively" string in `seed.js`, `utils/mailer.js`, `components/landing/*`, `RegisterPage.jsx`, `JobSearchPage.jsx` and `i18n/locales/en.json`. That is product copy about inclusive hiring — the platform's actual mission — not the scoring feature.

> **Note (added after this work shipped):** `frontend/src/types/index.ts` no longer exists. The project was later converted from TypeScript to JavaScript, and that file held nothing but type declarations, so it was deleted outright rather than renamed. The shared shapes it described are now implicit in the API responses. References to it below are kept as a record of what this change touched at the time; the `.ts` code samples in §5 and §6 are likewise shown as they were originally written.

---

## 3. Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Review aggregates | Keep `averageRating` / `reviewCount` cached on `RecruiterProfile`; new `reviewService.recomputeRecruiterRating()` is the **sole writer** | Preserves the existing API shape (no frontend rating changes) and keeps reads cheap. One writer = no drift. |
| `responseRate` | Removed | It existed only to feed the score. Nothing else computes or needs it. |
| Eligibility to review | `status ∈ {ACCEPTED, COMPLETED}` **and** `scheduledAt` in the past | `COMPLETED` is never set by any code path, so the old gate effectively allowed only `ACCEPTED` — which means "candidate confirmed the slot", i.e. a review before the interview happened. The date check fixes that with no new recruiter action. |
| `canReview` computed | Server-side, in `getMyInterviews` | Keeps the eligibility rule in exactly one place instead of duplicating date/status logic in the client. |
| `recruiterId` on submit | Derived from the interview, **removed from the request body** | Closes the security hole by construction — there is no client-supplied value left to forge. |
| Star input | New shared `StarRating` with a `readOnly` mode | No interactive rating component exists. One component serves both the form and the four read-only display sites. |
| Dropped fields in Mongo | Cleared by dropping collections in `seed1.js` | Mongoose does not remove keys from existing documents when you delete them from the schema. Dropping also clears stale indexes, which emptying does not. |

---

## 4. Phase 1 — Backend removal + `reviewService`

### 4.1 The security fix (do this first)

`submitReview` validates the interview, then ignores it:

```ts
const interview = await Interview.findOne({
  _id: interviewId,
  candidateId: req.user!._id,
  status: { $in: ["COMPLETED", "ACCEPTED"] },
});
if (!interview) { /* 403 */ }

const review = await Review.create({
  candidateId: req.user!._id,
  recruiterId,          // ← straight from req.body, never compared to interview.recruiterId
  interviewId, rating, comment,
});
```

A candidate passes their own valid `interviewId` with any `recruiterId` and plants a 1-star review on a recruiter they have never met. `recruiterId` is not even validated as an ObjectId, so a malformed value throws a `CastError` into the error handler.

**Fix:** drop `recruiterId` from the accepted body and use `interview.recruiterId`.

### 4.2 `reviewService.recomputeRecruiterRating`

```ts
// backend/src/services/reviewService.js
export const recomputeRecruiterRating = async (recruiterId) => {
  const [reviews, profile] = await Promise.all([
    Review.find({ recruiterId }).select("rating").lean(),
    RecruiterProfile.findOne({ userId: recruiterId }),
  ]);
  if (!profile) return null;

  profile.reviewCount = reviews.length;
  profile.averageRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;                       // no length guard — deleting the last review resets to 0
  await profile.save();
  return profile;
};
```

Fixes two bugs inherited from `inclusivityService` by construction:
- the old code assigned aggregates **inside** `if (reviews.length > 0)`, so removing the last review left stale values forever;
- `averageRating` was stored unrounded (`4.333333333333333`).

### 4.3 Removal checklist

- **Delete** `backend/src/services/inclusivityService.js`.
- `models/RecruiterProfile.js` — drop `InclusivityTier`, `inclusivityScore`, `tier`, `responseRate`, the `inclusivityTier` virtual. Keep `reviewCount` / `averageRating`, relabelled as review aggregates. **Keep `toJSON/toObject: { virtuals: true }`** — `jobController` calls `profile.toJSON()`.
- `controllers/recruiterController.js` — remove the import and all four call blocks.
- `controllers/recruiterProfileController.js` — drop the three fields from the `company` block.
- `controllers/jobController.js` — update the stale "reputation metrics" comment.
- Comment-only: `services/recruiterProfileService.js`, `validators/recruiterValidators.js`.

### 4.4 `reviewController` hardening

- Zod DTO + the existing `validate` middleware ([backend/src/middleware/validate.js](../backend/src/middleware/validate.js)) — matches how every other route validates. `rating` currently escapes as a Mongoose `ValidationError` instead of a clean 400.
- `ok` / `fail` from [backend/src/utils/apiResponse.js](../backend/src/utils/apiResponse.js) so failures carry a machine-readable `code`.
- Compute `isVerifiedHire` from the linked `Application.status === "HIRED"` rather than leaving it permanently `false`.
- `getRecruiterReviews` also returns `averageRating` / `reviewCount`.
- Remove the unused `RecruiterProfile` import.

---

## 5. Phase 2 — Expose what the UI needs

`getMyInterviews` populates `jobId`, `candidateId`, `applicationId` — but not `recruiterId`. For candidates, add in one batched pass (mirroring the batching in `adminController.getRecruiters`):

| Field | Source |
|---|---|
| `recruiterId` | `.populate("recruiterId", "name")` |
| `companyName` | one `RecruiterProfile.find({ userId: { $in: recruiterIds } })` |
| `hasReviewed` | one `Review.find({ interviewId: { $in: interviewIds } })` |
| `canReview` | `hasReviewed === false && status ∈ {ACCEPTED, COMPLETED} && scheduledAt < now` |

Three queries total regardless of interview count — no N+1.

---

## 6. Phase 3 — Review submission UI

| File | Change |
|---|---|
| `frontend/src/components/shared/StarRating.jsx` **new** | Interactive 1–5 star input, `role="radiogroup"` with arrow-key + Home/End support and a visible focus ring. **Keyboard operability is non-negotiable here** — this is a portal for people with disabilities, and a click-only star grid excludes screen-reader and switch-access users. `readOnly` mode for display sites. |
| `frontend/src/components/candidate/SubmitReviewDialog.jsx` **new** | `StarRating` + comment `Textarea` + `POST /reviews/submit`. Follows the dialog pattern already in `CandidateInterviewCard` (reschedule) and `ScheduleInterviewDialog`. |
| `frontend/src/components/candidate/CandidateInterviewCard.jsx` | "Leave a review" action when `canReview`; "Reviewed" badge when `hasReviewed`. |
| `frontend/src/types/index.ts` *(since removed)* | Shared `Review` interface (currently redeclared locally in `CompanyProfilePage`). |

**Entry point:** Candidate Dashboard → Interviews tab. No new route.

---

## 7. Phase 4 — Frontend cleanup and reflow

- **`types/index.ts`** *(since removed)* — delete `InclusivityTier`; remove the three fields from `RecruiterProfile` and `RecruiterDashboardCompany`.
- **`CompanyProfilePage.jsx`** — remove the tier badge and the Inclusivity Score / Response Rate stat cards; stat grid `lg:grid-cols-4` → `lg:grid-cols-2`; **move Workplace Accessibility above About** (with the tier badge gone, accessibility facilities are the page's most decision-relevant content for a PwD candidate); reuse `StarRating readOnly`; prune `Medal` / `TrendingUp` / `MessageSquare` imports.
- **`RecruiterDashboard.jsx`** — `reputationTiles` reduced to Avg. Rating (with review count); remove the tier badge; prune imports.
- **`JobDetailPage.jsx`** — remove tier fields, the tier header strip and the GOLD medal overlay; keep the `averageRating (reviewCount)` chip; collapse the now-pointless `overflow-hidden`/`p-0` Card nesting.

No changes needed in `RecruiterProfileCompleteness.jsx` or `useRecruiterProfile.js` — both are clean, and `EDITABLE_KEYS` already excludes derived fields.

---

## 8. Phase 5 — Clearing the dropped fields

Mongoose does not delete keys from existing documents when you remove them from the schema, so `inclusivityScore` / `tier` / `responseRate` would linger in MongoDB.

A one-time `$unset` migration originally handled this. It has since been deleted along with the rest of the backward-compatibility code: `npm run seed -- --yes` **drops** every collection rather than emptying it, which clears the stale fields *and* the redundant compound index on `reviews` in one step.

If you ever need to clear the fields without wiping data, `RecruiterProfile.updateMany({}, { $unset: { inclusivityScore: "", tier: "", responseRate: "" } })` is all it took.

---

## 9. Suggestions (not included — your call)

1. **Redundant unique indexes on `Review`.** `interviewId` is already `unique: true`, which alone guarantees one review per interview; the compound `{ candidateId, recruiterId, interviewId }` unique index adds nothing. Worth dropping.

2. **`Application.status = "HIRED"` is never set anywhere.** The enum has it and the "Verified Hire" badge keys off it, so that badge can never render. Add a recruiter "Mark as hired" action — genuinely useful for a job portal, and this plan wires `isVerifiedHire` so it works the moment `HIRED` starts being set.

3. **`GET /api/reviews/recruiter/:id` requires auth, but the same data is public** via `GET /api/jobs/recruiter/:id`. The auth protects nothing — make it consistently public.

4. **No moderation path.** Anyone who attends an interview can post free text onto a public company page, with no admin visibility and no delete. Recommend an admin review queue, or at minimum a delete endpoint (which `recomputeRecruiterRating` is already built to handle).

5. **Reviews are unpaginated.** Both `getRecruiterReviews` and the company page return every review. Add `?page`/`?limit` — the convention already used across this codebase — before real volume.

6. **No `updatedAt` on `Review`** (manual `createdAt` only). Switch to `timestamps: true` if reviews ever become editable.

7. **Consider showing a rating distribution** (5★ ×8, 4★ ×3 …) on the company page once volume justifies it. More informative than a single average, and cheap from data already fetched.

---

## 10. Rollout checklist

- [ ] Phase 1 — delete service, strip fields, add `reviewService`, harden `reviewController`
- [ ] Phase 2 — extend `getMyInterviews`
- [ ] Phase 3 — `StarRating`, `SubmitReviewDialog`, card wiring
- [ ] Phase 4 — frontend cleanup + reflow
- [ ] `npm run lint` clean in frontend; `npm run build` clean in frontend
- [ ] Grep clean: `rg -i "inclusiv|\btier\b|responseRate" backend/src frontend/src` returns only product copy
- [ ] Security check: cannot attach a review to a recruiter you did not interview with
- [ ] Eligibility check: future-dated / `SCHEDULED` interviews rejected; past `ACCEPTED` accepted; duplicate rejected
- [ ] Full round-trip: submit a review → appears on `/company/:id` → average updates
- [ ] Keyboard-only pass on `StarRating` + dialog
- [ ] Phase 5 — `npm run seed -- --yes`, then confirm `reviews` carries only `_id_` and the unique `interviewId` index
