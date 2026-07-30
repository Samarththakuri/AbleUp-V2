# AbleUp — Bugs Found & Fixed

> A working log of defects this project hit, why each one happened, and what changed. It
> is written to be read out loud: every entry is **Symptom → Cause → Fix → Takeaway**, so
> "tell me about a bug you fixed" has an answer with a root cause and a lesson attached
> rather than a patch.
>
> Companion to [ARCHITECTURE.md](ARCHITECTURE.md), which describes the system as it stands
> today. This file describes how it got there. Anything still broken is collected in
> [Still open](#still-open) at the end.

---

## Contents

| Group | Theme |
|---|---|
| [A](#a-access-control--security) | Access control & security — who can read what |
| [B](#b-data-integrity) | Data integrity — two copies of one fact disagreeing |
| [C](#c-query-correctness--performance) | Query correctness & performance |
| [D](#d-the-frontend--backend-contract) | The frontend ↔ backend contract |
| [E](#e-file-uploads) | File uploads |
| [F](#f-react-state--rendering) | React state & rendering |
| [G](#g-the-typescript--javascript-conversion) | The TypeScript → JavaScript conversion |

---

## A. Access control & security

### A-01 · Verification documents were readable by anyone who guessed a filename

- **Symptom:** pasting `/uploads/1731…-4472.pdf` into a browser with no session returned
  another user's UDID card — a government disability ID, scanned.
- **Cause:** every upload landed in `./uploads`, and `app.use("/uploads", express.static(...))`
  serves that directory to the world. `express.static` has no notion of who is asking; it was
  the right tool for company logos and quietly the wrong one for medical documentation.
- **Fix:** two storage tiers. Verification documents now write to `./private/verification`,
  outside the static root entirely, and are reachable only through
  `GET /api/documents/:filename` — a handler that requires a bearer token and checks the
  caller either owns the document or is an admin. The stored URL changed from
  `/uploads/<file>` to `/api/documents/<file>`.
- **Takeaway:** access control that depends on a URL being hard to guess is not access
  control. Put files the wrong person must not read somewhere the static middleware
  cannot reach, and make the only path to them a handler that can ask "who are you?".

### A-02 · The document endpoint confirmed which files existed

- **Symptom:** requesting someone else's document returned `403 Forbidden`; requesting a
  filename that did not exist returned `404`. Two different answers, so anyone with a token
  could enumerate valid filenames by watching which status came back.
- **Cause:** the natural way to write the handler — 404 when the file is missing, 403 when
  the caller is not allowed — leaks existence to an unauthorised caller.
- **Fix:** both cases return **404**. An unauthorised read is indistinguishable from a
  missing file. The handler also resolves the path with `path.basename` plus a prefix check
  against the storage root (so `../../.env` cannot escape), restricts extensions to
  PDF/JPG/PNG, and sets `Cache-Control: private, no-store` so a shared browser cache does
  not hold a stranger's certificate.
- **Takeaway:** status codes are an information channel. On endpoints that serve private
  objects, "forbidden" and "does not exist" should be the same response.

### A-03 · A candidate could plant a review on a recruiter they had never met

- **Symptom:** a five-star review appeared on a company profile with no interview behind it.
- **Cause:** `submitReview` read `recruiterId` straight off the request body. The interview
  was checked for existence, but the review was written against whatever recruiter the
  client named.
- **Fix:** `recruiterId` is derived from the interview being reviewed
  (`recruiterId: interview.recruiterId` in [reviewController.js](../backend/src/controllers/reviewController.js)),
  and the field is no longer in the Zod DTO, so `validate()` strips it before the controller
  ever sees it. The interview itself is loaded with `{ _id, candidateId: req.user._id }`, so
  it must belong to the caller.
- **Takeaway:** never accept an identifier the server can already infer from data it
  trusts. Every id in a request body is something the client gets to choose.

### A-04 · Recruiters verified themselves at registration

- **Symptom:** the admin recruiter queue was permanently empty, and any account that
  completed signup could immediately post jobs.
- **Cause:** registration set `verificationStatus: "VERIFIED"` for the RECRUITER branch —
  a convenience from early development that was never taken back out. The whole
  human-review gate existed in the UI and was bypassed by the default.
- **Fix:** both roles default to `PENDING` at the schema level, and posting a job runs
  through `requireVerifiedRecruiter`. Verification is now something an admin does after
  reading the submitted incorporation or GST proof.
- **Takeaway:** a security default set for local convenience becomes production behaviour
  unless something forces the question. The default should be the restrictive one, and the
  permissive path should be the one that takes an explicit action.

### A-05 · Rejected applications still wrote a resume to disk

- **Symptom:** `./uploads/resumes` filled with files belonging to no application. An
  unverified candidate hitting Apply got a 403 — after their upload had already been saved.
- **Cause:** middleware order. Multer ran before `requireVerifiedCandidate`, so the request
  body (and the file) was fully parsed before anything checked whether the caller was
  allowed to apply at all.
- **Fix:** `requireVerifiedCandidate` moved ahead of the upload on the apply route. The
  rejection now happens before a byte is written.
- **Takeaway:** in Express the middleware order *is* the security policy. Anything that can
  reject the request should run before anything that has a side effect.

### A-06 · Unknown body fields reached Mongoose

- **Symptom:** `POST /api/reviews/submit` with `{"rating": 5, "averageRating": 5}` — or a
  profile update carrying `verificationStatus` — set fields the client has no business
  setting.
- **Cause:** controllers passed `req.body` into `Model.create` / `findOneAndUpdate` more or
  less whole. Mongoose ignores paths not in the schema, but every server-owned field
  (`averageRating`, `reviewCount`, `recruiterId`, `applicantsCount`) *is* in the schema.
- **Fix:** `validate(schema)` parses the body with Zod and **replaces `req.body` with the
  parsed result**. Zod strips unknown keys by default, so a controller cannot be handed a
  field its DTO does not list, whether or not the controller remembers to pick fields out.
- **Takeaway:** mass-assignment is prevented by what the boundary *removes*, not by what
  the controller remembers to read. Replacing the body, rather than merely validating it,
  is what makes that guarantee hold everywhere.

### A-07 · Password hashes were serialised into API responses

- **Symptom:** `GET /api/auth/me` returned the bcrypt hash, and the admin user list returned
  one per row. Reset tokens went out the same way.
- **Cause:** the controllers returned Mongoose documents directly. Some read paths
  remembered `.select("-password")`; new ones did not, and the list endpoints never had.
- **Fix:** inverted the default. `password`, `resetPasswordToken` and
  `emailVerificationToken` are `select: false` on the schema, so reading them requires an
  explicit `.select("+password")` — which exactly four auth paths do. A `toJSON` transform
  on `User` deletes them as a second layer, in case a document reaches a response some
  other way.
- **Takeaway:** make the sensitive field opt-in rather than opt-out. A rule enforced by
  every call site remembering to exclude something will be broken by the next call site.

### A-08 · JWT verification fell back to the literal secret `"secret"`

- **Symptom:** none visible — which is the problem. The token-signing path used the
  Zod-validated `env.JWT_SECRET`, while the middleware that *verifies* tokens read
  `process.env.JWT_SECRET || "secret"`.
- **Cause:** the middleware predated `config/env.js` and was never migrated. `config/db.js`
  and the seed script had the same shape: `process.env.MONGO_URI ||
  "mongodb://localhost:27017/abelup"`.
- **Fix:** both import the validated `env`. The fallbacks are gone, so a deploy missing
  `JWT_SECRET` exits at startup instead of accepting tokens signed with a value published
  in the source. The seed script's `MONGO_URI` fallback was the same class of bug wearing a
  worse hat: its confirmation banner printed the fallback URI while `connectDB()` connected
  to the real one, so `npm run seed -- --yes` could name one database and drop another.
- **Takeaway:** validate configuration once at startup and make that object the only way to
  read it. A `||` fallback next to a secret turns a loud misconfiguration into a silent
  vulnerability, and two components disagreeing about the same variable is worse than
  either default alone.

### A-09 · The database password was printed on every startup

- **Symptom:** every boot, seed and maintenance script logged
  `MongoDB connected: mongodb+srv://AbleUpUser:<password>@cluster0…` — the live Atlas
  credentials, in plain text, into stdout and therefore into any CI log, terminal
  scrollback or pasted bug report.
- **Cause:** `console.log(\`MongoDB connected: ${uri}\`)`. A MongoDB SRV connection string
  carries the password inline, so logging "which database did we connect to?" logs the
  credentials as a side effect. It reads as harmless — it is the connection URI, not a
  secret named `PASSWORD`.
- **Fix:** a `redactUri` helper replacing the `//user:pass@` segment with
  `//<credentials>@`, used by both the connection log and the seed script's confirmation
  banner — which is the one output most likely to get pasted somewhere, since it is what
  you read before agreeing to drop every collection.
- **Takeaway:** secrets do not only live in variables called `SECRET`. Connection strings,
  webhook URLs and signed links all embed credentials, and logging one whole is the easiest
  way to leak it.

### A-10 · Both verification queues had nothing to show

- **Symptom:** admins were approving and rejecting accounts from a name and an email
  address. The candidate review dialog rendered a broken link where the document should be.
- **Cause:** three gaps that each looked complete on its own. `verificationDocuments`
  existed on both profile schemas, but no endpoint could write to it. The candidate dialog
  linked `udidDocumentUrl` — a field no upload path had ever set. And the recruiter
  completion check did not require any document, so "complete" meant a profile with no
  evidence in it.
- **Fix:** upload and delete endpoints for both roles, an authenticated viewer component
  shared by both queues, at least one document added to the recruiter's required
  completion checks, and both queue responses embedding the documents inline so the
  decision is made with the evidence on screen.
- **Takeaway:** a schema field with no writer is a feature that looks shipped in code
  review and does nothing in production. Trace a feature end to end — storage, write path,
  read path, UI — before calling it done.

---

## B. Data integrity

### B-01 · Deleting a recruiter orphaned every job they had posted

- **Symptom:** deleted companies kept appearing in job search. Opening one of their
  listings 500'd on the recruiter lookup.
- **Cause:** `deleteAccount` ran `Job.find({ postedBy: userId })`. The field on `Job` is
  `recruiterId`. Mongo does not error on a filter naming a field that does not exist — it
  matches nothing, so the cleanup silently deleted zero jobs and reported success.
- **Fix:** all cross-collection teardown moved into `services/cascadeService.js`, one
  implementation for both "delete job" and "delete account", written against the real field
  names.
- **Takeaway:** a query against a misspelled field in Mongo is not an error, it is an empty
  result — and an empty result looks identical to "nothing to clean up." Anywhere a filter
  returning nothing is indistinguishable from success, assert on the count.

### B-02 · Both teardown paths forgot `Review`

- **Symptom:** a company's average rating included reviews written by deleted candidates,
  and `reviewCount` never came back down.
- **Cause:** account deletion and job deletion had each been written separately, at
  different times, and each enumerated the collections its author happened to remember.
  `Review` was the newest collection and appeared in neither.
- **Fix:** one `cascadeService` owns both teardowns. Deleting interviews deletes the reviews
  hanging off them and then recomputes every affected recruiter's aggregates, so the caches
  match reality after the delete rather than drifting from it.
- **Takeaway:** duplicated cleanup logic diverges the moment the schema grows. One function
  per teardown means adding a collection is one edit, not a search for every place that
  guessed at the list.

### B-03 · `Job.applicantsCount` only ever went up

- **Symptom:** a job showed 40 applicants with 12 rows in the applicants table.
- **Cause:** apply incremented the counter; nothing decremented it when an application or
  job was deleted. Worse, a second endpoint returned a live `countDocuments` under the same
  field name — so the same job reported two different numbers depending on which endpoint
  you asked, and neither was labelled as an estimate.
- **Fix:** exactly one writer. `cascadeService` owns the counter in **both** directions —
  incrementing on apply, and aggregating per-job deletion counts into a single
  `Job.bulkWrite` `$inc` on teardown. `npm run db:repair` recomputes it from the source
  collection and `--dry` reports drift without writing.
- **Takeaway:** a denormalised counter needs a named owner and a way to prove it is right.
  If you cannot say which function is allowed to write it, it is already wrong.

### B-04 · `Application.shortlisted` disagreed with `Application.status`

- **Symptom:** an application showed as shortlisted in the candidate's timeline while the
  recruiter's applicant list had it as rejected.
- **Cause:** the model stored both a `status` enum and a `shortlisted` boolean. The
  single-application endpoint updated both; the bulk action updated only `status`. Two
  stored copies of one fact, and one write path that knew about one of them.
- **Fix:** `shortlisted` is now a **virtual** — `this.status === "SHORTLISTED"`. It is
  present in every API response and absent from Mongo, so it cannot drift and cannot be
  filtered on; every query filters `{ status: "SHORTLISTED" }`.
- **Takeaway:** if one field is always computable from another, do not store it. Two copies
  of a fact eventually disagree, and the bug surfaces as "the UI is lying" long after the
  write path that caused it.

### B-05 · The "Verified Hire" badge froze at review time

- **Symptom:** a candidate reviewed a company, was hired two weeks later, and the badge
  never appeared.
- **Cause:** `Review.isVerifiedHire` was computed once, when the review was written, and
  stored. Any later change to the application status left the stored copy behind.
- **Fix:** the field is gone from the schema. `reviewService.withVerifiedHireFlag` derives
  it per request from the application's current status, in two batched queries for the
  whole list rather than one per review.
- **Takeaway:** the same lesson as B-04 with a longer fuse — a stored derivation of a value
  that keeps changing is only correct for as long as nothing changes.

### B-06 · Double-clicking Apply created two applications

- **Symptom:** duplicate rows in the applicants list, and `applicantsCount` incremented
  twice for one candidate.
- **Cause:** the guard was a `findOne` followed by a `create`. Two requests in flight
  together both read "no existing application" before either wrote one — the classic
  check-then-act race, which no amount of disabling the button on the client fixes.
- **Fix:** a **unique compound index** on `{ jobId, candidateId }`. The database rejects the
  second write regardless of timing, and the controller catches duplicate-key `11000` and
  returns a clean 409. The application-level check stays as the fast path for the common
  case; the index is what makes it correct.
- **Takeaway:** uniqueness is a database constraint, not an application check. Application
  code can only narrow the race window; the index closes it.

### B-07 · Jobs saved with a maximum salary below the minimum

- **Symptom:** listings showing `₹80,000 – ₹40,000`.
- **Cause:** both fields validated independently — each had to be a number ≥ 0 — and nothing
  compared them.
- **Fix:** a `pre("validate")` hook on `Job` invalidates `salaryMax` when it is below
  `salaryMin`, plus a matching Zod refinement at the boundary. Two layers on purpose: the
  seed and any direct write bypass HTTP entirely, so the schema has to hold the rule too.
- **Takeaway:** field-level validation cannot express a relationship between fields. Any
  rule involving two values needs somewhere that sees both. *(Known gap: this hook is
  document-level and does not fire on `findOneAndUpdate`, which is how job updates are
  written — see [Still open](#still-open).)*

### B-08 · `updatedAt` fields that never updated

- **Symptom:** admin queues sorted by "recently modified" showed a stable, meaningless order.
- **Cause:** several models declared `createdAt` / `updatedAt` as ordinary `Date` fields
  with `default: Date.now`. Nothing ever wrote `updatedAt` again, so it was a second copy of
  `createdAt` under a name that promised otherwise.
- **Fix:** one shared `baseSchemaOptions` in
  [schemaOptions.js](../backend/src/models/schemaOptions.js) with `timestamps: true`, spread
  into all seven schemas. `Application` renames the created field to `appliedAt` through the
  same mechanism rather than hand-managing it.
- **Takeaway:** a hand-maintained field that the framework will maintain for you is a field
  that will fall out of date. Push the convention into one shared options object so
  "correct" is the default for the next model too.

### B-09 · Registration could strand an account that could never be used

- **Symptom:** a handful of users who could log in, but whose dashboard 500'd — no profile
  existed, and nothing in the UI could create one.
- **Cause:** registration writes two documents, `User` then the role profile. Without
  transactions, a failure on the second leaves the first committed. The deployment is a
  standalone `mongod`, and Mongo sessions require a replica set, so `withTransaction` is not
  available.
- **Fix:** an explicit compensating action — if the profile create throws, delete the user
  and surface the failure, so the caller can retry cleanly. Documented as a known trade-off
  rather than papered over.
- **Takeaway:** when you cannot have atomicity, you need a compensation and you need to have
  decided what it is. "It'll probably succeed" is not an error-handling strategy.

### B-10 · The frontend offered options the API rejected

- **Symptom:** a recruiter picking an industry from the dropdown got
  `400 Validation error: industry`.
- **Cause:** the option lists exist twice — `backend/src/constants/*.js` feeds both the
  Mongoose enum and the Zod enum, and `frontend/src/constants/company.js` mirrors them for
  the UI. A value added on one side only was invisible until someone selected it.
- **Fix:** `npm run check:constants` parses the frontend file and compares all eight
  mirrored lists against the backend's, failing on any drift. It runs as a pre-release check.
- **Takeaway:** duplicated constants across a package boundary will drift; the question is
  only whether you find out from a test or from a user. A shared workspace package would
  prevent it outright — the check is the cheap version of that.

---

## C. Query correctness & performance

### C-01 · Job search tried to look up a job with the id `"search"`

- **Symptom:** `GET /api/jobs/search` returned `400 INVALID_ID` — a `CastError` on the
  string `"search"`.
- **Cause:** route declaration order. `router.get("/:jobId", ...)` was registered before
  `router.get("/search", ...)`, and Express matches in registration order, so the parameter
  route swallowed the literal one.
- **Fix:** literal segments (`/search`, `/recruiter/:recruiterId`) are declared before
  `/:jobId`, with a comment saying why so the next edit does not undo it. The same class of
  bug exists on the client, where `/recruiter/:id` must be declared after
  `/recruiter/profile` and `/recruiter/onboarding`.
- **Takeaway:** a router is an ordered list, not a set. Static routes go before dynamic ones,
  and the reason belongs in a comment, because the fix looks like arbitrary line order.

### C-02 · Job search scanned every job, and a `(` in the query crashed it

- **Symptom:** search was slow and got slower with the collection; searching `C++` or
  `(remote)` returned a 500.
- **Cause:** two unanchored, case-insensitive `$regex` clauses over `title` and `description`.
  Unanchored regex cannot use an index, so every search scanned every active job — twice,
  once for `find` and once for `countDocuments`. And the raw query string was interpolated
  into the regex, so any regex metacharacter the user typed either changed the meaning of
  the search or was an invalid pattern.
- **Fix:** a MongoDB **text index** on `{ title, description }` and a `$text` search. The
  `location` filter is still a regex — prefix matching is what is wanted there — but runs
  through an `escapeRegex` helper that treats user input as a literal.
- **Takeaway:** user input concatenated into a query language is the injection bug wearing a
  different hat; regex is a query language. And "it's fast on my seed data" is not a
  statement about the query plan.

### C-03 · `?recruiter=anything` returned a 500

- **Symptom:** a malformed query parameter produced `500 Internal Server Error` instead of
  an empty result or a 400.
- **Cause:** `filter.recruiterId = req.query.recruiter` assigned the raw string. Mongoose
  casts it to `ObjectId` at query time, and anything that is not 24 hex characters throws
  a `CastError` from inside the driver.
- **Fix:** guard with `mongoose.isValidObjectId(...)` before the filter is built; an invalid
  id is simply not applied. The central `errorHandler` also maps any `CastError` that does
  slip through to a `400 INVALID_ID` rather than a 500.
- **Takeaway:** every id arriving from a URL is a string until you prove otherwise. Validate
  at the boundary *and* map the framework's exception centrally, so the next one that gets
  missed is a 400 rather than a page of stack trace.

### C-04 · Every admin queue and interview list was a collection scan

- **Symptom:** page loads degrading steadily as seed data grew.
- **Cause:** the queries had been written before any index existed, and the only indexes
  present were the automatic `_id` and the `unique` declarations. `Mongoose`'s `autoIndex`
  had happily created exactly what was declared, which was nothing useful.
- **Fix:** indexes derived from the queries actually run rather than guessed at —
  `{ role, verificationStatus, createdAt: -1 }` for the admin queues,
  `{ recruiterId, scheduledAt }` and `{ candidateId, scheduledAt }` for the two interview
  lists, `{ jobId, status, appliedAt: -1 }` for the applicants list. The field order matters:
  equality filters first, sort key last, so the index serves the sort as well as the filter.
- **Takeaway:** write the index from the query, not the other way round. An unindexed sort
  is the one that shows up last, because it is invisible until the collection is big enough.

### C-05 · Removed indexes stayed in the database

- **Symptom:** `db.collection.getIndexes()` listed indexes on fields the schema no longer
  had — still being maintained on every write, serving nothing.
- **Cause:** Mongoose's `autoIndex` creates indexes declared in the schema. It never drops
  ones that have been removed from it, so the database accumulated the union of every schema
  version the code had ever had.
- **Fix:** `npm run db:sync-indexes` runs `syncIndexes()` across all seven models, which
  creates what is missing **and drops what is no longer declared**.
- **Takeaway:** `autoIndex` is a create-only convenience. Reconciling the database to the
  schema — in both directions — is a deliberate, separate operation.

### C-06 · Rows appeared twice, or not at all, across paginated pages

- **Symptom:** paging through the applicants list showed one candidate on both page 1 and
  page 2, while another never appeared.
- **Cause:** `skip`/`limit` sorted by `appliedAt` alone. Documents sharing a timestamp have
  no defined order between them, so two queries a moment apart could order the tie
  differently and shift a row across the page boundary.
- **Fix:** tie-break the sort on `_id`, which is unique, making the ordering total and the
  page boundary stable.
- **Takeaway:** `skip`/`limit` is only correct over a **total** order. A sort key with
  duplicates is a partial order, and pagination over it silently loses and repeats rows.

### C-07 · The applicants table fetched one interview per row

- **Symptom:** opening a job with 40 shortlisted applicants issued 43 HTTP requests and took
  seconds to settle. With `?limit=100` the ceiling was 103.
- **Cause:** the applicants list returned applications without their interviews, so the client
  filled the gap the only way it could — `Promise.all` over the rows, firing
  `GET /interviews/application/:id` for every shortlisted one. A textbook N+1, except the
  "+1 per row" was a network round trip rather than a query. Two further requests came from
  the same page downloading the recruiter's **entire job list** to read `title` and
  `location` off one job, and doing it *sequentially* after the other two had resolved.
- **Fix:** `getJobApplicants` loads the whole page's interviews in one
  `Interview.find({ applicationId: { $in: applicationIds } })`, run in parallel with the
  existing candidate-profile lookup, and attaches each to its row. The unique
  `{ applicationId }` index already existed, so the `$in` needed no schema work. `getJobSummary`
  now also returns `title`/`location`/`remote` from the job document it had already loaded,
  which removed the job-list download. `limit` is capped at 100 — uncapped, it was both a
  client-controlled full-collection read and a way to size the `$in` arbitrarily.
- **Result:** `3 + N` requests → `2`; the dashboard's expand-job panel went `1 + N` → `1`.
- **Takeaway:** an N+1 does not stop being an N+1 because the loop lives in the client. If a
  list endpoint omits something every row needs, the caller will fetch it per row, and the
  cost moves from the query planner — where it is at least visible — to the network, where it
  is not. Serve what the screen needs in the response that the screen already asks for.

---

## D. The frontend ↔ backend contract

### D-01 · Every id was `undefined` on the client

- **Symptom:** navigating to a job detail page produced `/jobs/undefined`.
- **Cause:** the `toJSON` transform added during the schema cleanup drops `_id` in favour of
  `id`, so every model serialises consistently. Client code written before that still read
  `job._id`. Both are plausible-looking property accesses and neither throws — you get
  `undefined` in a URL.
- **Fix:** the client normalises once, at the boundary: `AuthContext.mapUser` reconciles
  `data.id || data._id`, and components read `id`.
- **Takeaway:** JavaScript's silence on missing properties makes wire-format changes fail far
  from their cause. Normalise the shape in one place on arrival rather than defending at
  every call site.

### D-02 · Role checks failed for everyone

- **Symptom:** correctly logged-in users were bounced to `/` by `ProtectedRoute`.
- **Cause:** the backend's enum is `"CANDIDATE"`; the client's route guards compared against
  `"candidate"`. `"CANDIDATE" === "candidate"` is `false`, quietly.
- **Fix:** `mapRole` lowercases and maps the role once, in `AuthContext`, as the user object
  is stored. Guards compare normalised values. The verification vocabulary got the same
  treatment — `mapVerification` folds the backend's `VERIFIED` and the older `approved` onto
  a single client-side `"approved"`.
- **Takeaway:** two services will spell the same enum differently. Translate at one
  boundary, on arrival, instead of remembering to `.toLowerCase()` at fifteen comparisons.

### D-03 · Password reset silently did nothing for mixed-case emails

- **Symptom:** a user who registered as `Alice@example.com` requested a reset, saw "if an
  account exists, we've sent a link", and never received one. No error anywhere — not in the
  UI, not in the logs.
- **Cause:** two reasonable decisions combining badly. The email lookup was case-sensitive
  because the schema had no `lowercase`, and `/forgot-password` deliberately returns a
  generic success for **every** input so it cannot be used to enumerate accounts. The
  anti-enumeration behaviour that protects real users was also hiding a real failure.
- **Fix:** `lowercase: true` and `trim: true` on `User.email` at the schema, so registration
  and lookup normalise identically, plus a validator on the route.
- **Takeaway:** the hardest bugs are two correct decisions interacting. Any endpoint that
  deliberately reports success unconditionally needs its own observability — you will never
  hear about the failure from a user.

### D-04 · The frontend called a port the backend was not on

- **Symptom:** a clean checkout ran both dev servers successfully and every request failed
  with `ERR_CONNECTION_REFUSED`.
- **Cause:** three sources of truth for one number. `backend/.env` set `PORT=5002`,
  `frontend/src/lib/api.js` defaulted to `http://localhost:5002/api`, and the documentation
  and README said 5000. Since `.env` is gitignored, a fresh clone got the code's default and
  the doc's instructions — which disagreed.
- **Fix:** checked-in `.env.example` files on both sides carrying the real values and a
  comment tying them together, and the port corrected everywhere in the docs.
- **Takeaway:** if the only correct copy of a value lives in a gitignored file, a new clone
  is guaranteed to be wrong. Commit an example file and keep it accurate — it is
  documentation the setup steps can actually be checked against.

---

## E. File uploads

### E-01 · Multipart uploads failed with "Unexpected end of form"

- **Symptom:** every file upload 500'd inside multer. The same request built by hand with
  curl worked.
- **Cause:** the upload helper set `Content-Type: multipart/form-data` explicitly, copying
  the JSON helper's shape. A multipart content type is meaningless without the `boundary`
  parameter, which only the browser can generate — and setting the header by hand overrides
  the one `fetch` would have written with the boundary in it.
- **Fix:** `apiUpload` sends `FormData` with **no** `Content-Type` header at all and lets the
  browser fill it in, with a comment saying why so it does not get "fixed" back.
- **Takeaway:** with `FormData`, the header is the browser's job. This one is worth
  remembering because the symptom points at the server and the cause is one line on the
  client.

### E-02 · A renamed executable passed the file filter

- **Symptom:** `payload.exe` renamed to `resume.pdf` uploaded successfully.
- **Cause:** the multer `fileFilter` tested the extension only. The extension is part of the
  filename — entirely under the caller's control.
- **Fix:** `makeFileFilter` checks the extension **and** the MIME type, and each of the three
  uploaders declares its own allow-list and size cap: resumes PDF/DOC/DOCX ≤ 5 MB, logos
  JPG/PNG/WEBP ≤ 2 MB, verification documents PDF/JPG/PNG ≤ 5 MB. Stored filenames are
  server-generated (`${Date.now()}-${random}${ext}`), never the client's.
- **Takeaway:** anything in the request is attacker-controlled, filenames included. Two weak
  checks are better than one, and neither is a substitute for storing the file somewhere it
  cannot be executed. *(Still not scanned for malware — see [Still open](#still-open).)*

### E-03 · Document previews leaked memory

- **Symptom:** the admin queue's memory footprint climbed steadily while reviewing a batch
  of applications, and did not come back down.
- **Cause:** protected documents cannot be linked to directly — the browser attaches no
  Authorization header to `<img src>`, so the request 401s. The viewer fetches the file with
  its token and calls `URL.createObjectURL(blob)`. Each of those pins the blob in memory
  until it is explicitly revoked, and nothing revoked them.
- **Fix:** `DocumentViewer` owns the object URL's lifetime and revokes it in a `useEffect`
  cleanup, so closing the dialog or previewing the next document releases the previous one.
- **Takeaway:** `createObjectURL` is a manual allocation in a garbage-collected language.
  Whichever component creates one owns revoking it, and in React that means the cleanup
  function.

### E-04 · Opening a document was blocked as a popup

- **Symptom:** clicking "View document" did nothing. No error — the tab simply never opened.
- **Cause:** the handler awaited `fetchProtectedFile()` and then called `window.open`. By the
  time the promise resolved, the browser no longer associated the call with the click, so it
  was treated as an unsolicited popup and blocked. The user-gesture allowance does not
  survive an `await`.
- **Fix:** render the preview inline in a dialog instead of opening a tab, which is also the
  better interaction for reviewing a queue of documents.
- **Takeaway:** browser gesture permissions are consumed by the synchronous part of the
  handler. If you need to fetch first, do not plan to open a window afterwards.

---

## F. React state & rendering

### F-01 · The admin queue invented candidates when the API was down

- **Symptom:** during a backend outage the verification queue rendered four candidates who
  did not exist. An admin could open one, read the (fabricated) details and click Approve.
- **Cause:** a `catch` block that fell back to a hard-coded `mockCandidates` array — scaffolding
  from before the endpoint existed, left in place because it made the page look finished.
- **Fix:** removed. The page now renders an explicit error state with a retry, so an outage
  looks like an outage.
- **Takeaway:** a fallback that is indistinguishable from real data converts an obvious
  failure into a silent one, on the screen where decisions get made. Fail visibly.
  *(`JobSearchPage` still does this — see [Still open](#still-open).)*

### F-02 · The job list showed results for the previous filter

- **Symptom:** selecting a disability filter left the old results on screen; selecting a
  second one showed the results for the first. Always exactly one change behind.
- **Cause:** the search ran from a `useEffect` keyed on the filter state, and the effect
  closed over the values from the render that created it. The dependency array named the
  effect's trigger but not everything the request body read, so each fetch was built from a
  previous render's `keyword` and `disabilityFilter`.
- **Fix:** search is now an **explicit action**, not a reaction. `handleSearch` calls
  `fetchJobs()` directly, and because `fetchJobs` is redefined on every render it always
  closes over current state. The remaining `useEffect` is deliberately `[]` — it loads the
  initial page once and nothing else, which is exactly what an empty dependency array
  honestly means.
- **Takeaway:** an incomplete dependency array fails one render behind rather than loudly,
  so it reads as a caching problem or a slow API. Where the trigger is a user action, calling
  the function from the handler sidesteps the whole class of bug — effects are for
  synchronising with something external, not for responding to clicks.

### F-03 · Fast typing showed the wrong search results

- **Symptom:** typing quickly in the job search box left results for a partial query — often
  a broader result set than what was in the input.
- **Cause:** while search was still effect-driven, every keystroke fired a request and every
  response called `setJobs`. Responses do not arrive in the order they were sent, so a slower
  earlier request could resolve after a faster later one and overwrite the correct results.
- **Fix:** the same change as F-02 removes most of it — one request per Search press rather
  than one per keystroke. If it goes back to search-as-you-type, the fix is to track the
  latest request and ignore any response that is not from it (an incrementing ref, or
  `AbortController` on the superseded fetch), plus debouncing so most of those requests are
  never sent at all.
- **Takeaway:** concurrent requests writing to the same state need a last-write-wins guard.
  Debouncing reduces how often you hit the race; it does not make it correct.

### F-04 · Profile inputs went from uncontrolled to controlled

- **Symptom:** a React warning on the profile page, and the first character typed into a
  field being dropped.
- **Cause:** inputs bound to `value={profile.city}` mounted before the profile had loaded, so
  `value` was `undefined` — React treats that as uncontrolled — and became a string once the
  fetch resolved, switching the input's mode mid-life.
- **Fix:** initialise the form state with every field defaulted to `""` rather than spreading
  a partial API response, so `value` is a string from first render.
- **Takeaway:** `undefined` and `""` are different kinds of empty to React. Give a controlled
  input a defined value on its very first render, before any data arrives.

### F-05 · One unmemoised function flooded the API until it returned 429

- **Symptom:** the app started failing with `429 Too Many Requests` across the board. Anything
  a recruiter did afterwards — search, apply, even log in — hit the same wall, because the
  rate limiter is per IP and the budget was already gone. A second, stranger symptom pointed
  at the real cause: text typed into the onboarding wizard erased itself every few hundred
  milliseconds.
- **Cause:** `updateUser` in `AuthContext` was a plain arrow function, so it got a **new
  identity on every provider render**. `useRecruiterProfile` had built a `useCallback` chain
  on top of it that terminated in a dependency array:

  ```
  load() → GET /recruiter/profile → applyResponse() → updateUser()
         → setUser(prev => ({ ...prev, ...updates }))   // always a new object
         → provider re-renders → new updateUser
         → new applyResponse ([updateUser]) → new load ([applyResponse])
         → useEffect([load]) sees a changed dep → load()
  ```

  Every link is individually reasonable. `useCallback` with honest dependencies, a functional
  `setState`, an effect that depends on the function it calls — this is all standard. The
  cycle only exists because the chain closes: the fetch's own response handler causes the
  render that invalidates the effect that fired the fetch. Nothing bounds it, because
  `{ ...prev, ...updates }` returns a fresh object even when every value is identical, so
  React never bails out of the re-render. Measured on the pre-fix code: **1877 requests in
  400 ms**. The disappearing form text was the same loop seen from the UI — both pages run
  `useEffect(() => setValues(profile), [profile])`, and `profile` was a new object each pass.
- **Fix:** three layers, because one was not worth trusting.
  1. Every function on the context is `useCallback`-wrapped. The deps are genuinely `[]` —
     none of them reads `user` or `token`, only their arguments and React's stable setters —
     so this is not an empty array papering over a stale closure.
  2. `updateUser` returns `prev` unchanged when the merged result is deep-equal, so a repeat
     call with identical data does not re-render consumers or rewrite localStorage.
  3. `useRecruiterProfile` reads `updateUser` through a ref, letting `applyResponse` declare
     `[]` and breaking the chain locally.

  Layer 3 is redundant while layer 1 holds. It is there because the invariant lives in a
  *different file*, re-arming it is a one-line edit, and the failure mode is not a slow render
  — it is a production outage. `useRecruiterProfile.test.jsx` asserts one fetch per mount and
  fails at 1877 if any layer is removed.
- **Takeaway:** in React, a function's *identity* is part of its contract, and a context is a
  published API. The damage a dependency-array bug can do is set by what sits at the end of
  the chain: the same mistake behind a `useMemo` costs a wasted render, and behind a `fetch`
  costs a denial of service against your own backend. Trace where an unstable identity
  actually terminates before deciding it is cosmetic — and when the answer is "a network
  request", enforce the invariant on both sides of the boundary rather than trusting the
  caller to keep it.

---

## G. The TypeScript → JavaScript conversion

> The backend and frontend were converted from TypeScript to plain JavaScript
> (commits `586487f` and `061a2e2`). Dropping `tsc` also meant dropping the bundler step on
> the backend, so Node now runs the source directly — which means **native ESM**, and native
> ESM is stricter than the module resolution `tsc` had been papering over.

### G-01 · Nothing started: `ERR_MODULE_NOT_FOUND` on every relative import

- **Symptom:** `node src/server.js` failed immediately on `import User from "../models/User"`.
- **Cause:** TypeScript let you write extensionless relative imports and rewrote them during
  compilation. Native ESM does not resolve extensions — the specifier is a URL, and
  `"../models/User"` is a path that does not exist.
- **Fix:** explicit `.js` on all 176 relative specifiers, applied as a codemod rather than by
  hand.
- **Takeaway:** extensionless imports were a compiler convenience, not a language feature.
  Removing the compiler surfaces every place that was relying on it.

### G-02 · `__dirname is not defined`

- **Symptom:** the server crashed at the `express.static` line.
- **Cause:** `__dirname` and `__filename` are CommonJS module-wrapper variables. They do not
  exist in ESM.
- **Fix:** `path.dirname(fileURLToPath(import.meta.url))`. The subtlety is *where* it
  resolves to: the file is `backend/src/server.js`, so it yields `backend/src`, and the
  existing `path.join(__dirname, "../uploads")` still points at `backend/uploads` — the same
  directory multer writes to. Getting that wrong would have served an empty directory and
  404'd every logo, with no error at startup.
- **Takeaway:** the ESM replacement for `__dirname` is mechanical; checking that every path
  built from it still resolves to the same place is not.

### G-03 · The constants barrel stopped resolving

- **Symptom:** `import { DISABILITY_TYPES } from "../constants"` — `ERR_MODULE_NOT_FOUND`.
- **Cause:** resolving a directory to its `index.js` is a CommonJS/bundler convention. ESM has
  no directory resolution at all.
- **Fix:** import `../constants/index.js` explicitly.
- **Takeaway:** "import a folder" was never part of the module system — it was Node's CJS
  resolver and every bundler agreeing to be helpful.

### G-04 · The documentation fix created dead links

- **Symptom:** three links in the docs pointed at `frontend/src/types/index.js`, a file that
  has never existed.
- **Cause:** a sweep to update `.ts` references to `.js` did exactly what it was asked, across
  every path — including three pointing at `frontend/src/types/index.ts`, a file the
  conversion had **deleted** because it contained nothing but type declarations. Rewriting the
  extension turned three correct-at-the-time links into three links to nothing.
- **Fix:** the mentions stay, because the doc is a record of work that was really done and the
  file really did exist then; the links are gone, with a note explaining the removal.
- **Takeaway:** a find-and-replace across documentation cannot tell a stale reference from a
  reference to something deliberately deleted. Verify that link targets exist after a bulk
  rename — the check is cheap and the failure is invisible in review.

---

## Still open

Known and deliberate, tracked in [ARCHITECTURE.md §8](ARCHITECTURE.md#8-trade-offs-known-gaps--what-id-improve):

| Ref | Issue |
|---|---|
| B-07 | The `salaryMax >= salaryMin` hook is `pre("validate")`, which does not fire on `findOneAndUpdate` — the path job *updates* actually take. |
| F-05 | Only `useRecruiterProfile` was audited for the identity-churn pattern. Nothing stops the next `useCallback` chain ending in a `useEffect` dependency array; there is no lint rule enforcing it and only one hook has the ref guard. |
| B-09 | Multi-document writes are still non-atomic; the deployment is a standalone `mongod`, so transactions need a replica set first. |
| C-04 | `bulkVerifyRecruiters` is an N+1 — it loops the single-verify path per id, four round-trips plus an email each, serialised, up to the 200-id cap. |
| E-02 | Uploads are not scanned for malware, and they land on the API server's local disk, so the app cannot run more than one instance without shared storage. |
| F-01 | `JobSearchPage` still falls back to `mockJobs` when the API errors. |
| — | An expired JWT produces a 401 on every request with no auto-logout, so the app looks broken rather than logged out. |
| — | `PUT /recruiter/application/:id/shortlist` and `PUT /recruiter/applications/bulk-action` have no `validate()`; their checks are hand-rolled in the controller. |
| — | `DELETE /job/:jobId` is not behind `requireVerifiedRecruiter`, while `PUT /job/:jobId` is. |
| — | The rate limiters are keyed on IP alone. They are mounted at app level, above each router's `auth`, so `req.user` does not exist yet and everyone behind one NAT shares a bucket. |
| — | `config/env.js` validates five variables; `JWT_EXPIRES_IN`, `FRONTEND_URL`, the `SMTP_*` set and the three upload-directory variables are unvalidated `process.env` reads with fallbacks. `FRONTEND_URL` in particular defaults to `:5173`, which is not where Vite serves this project, so password-reset links point at a dead port unless it is set. |
| — | The 42 pre-existing `console.*` calls bypass winston, so controller errors never reach `logs/error.log`. The logger is wired into morgan, the error handler and startup only. |
| — | Authenticated cross-origin GETs still preflight in production — `Authorization` alone makes a request non-simple. `cors({ maxAge: 600 })` caches the OPTIONS response; the dev proxy sidesteps it entirely, but there is no equivalent for a deployed cross-origin frontend. |
| — | The backend still has no test tooling. The frontend has Vitest and now one real regression test (`useRecruiterProfile.test.jsx`) alongside the placeholder. |
