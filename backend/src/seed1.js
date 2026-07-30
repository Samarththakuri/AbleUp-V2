/**
 * seed1 — clean-slate seed for manual verification.
 *
 * DROPS EVERY COLLECTION (documents *and* indexes), then creates exactly three
 * accounts (candidate, recruiter, admin) with their required role profiles,
 * all fully verified so every feature is reachable the moment you log in.
 *
 * Run:
 *   npm run seed1 -- --yes
 *   npm run seed1 -- --yes --pending-recruiter
 *
 * The --yes flag is required. MONGO_URI points at a hosted Atlas cluster, and
 * an accidental run would destroy real data, so this refuses to do anything
 * without it. The target database is printed before any writes happen.
 *
 * ---------------------------------------------------------------------------
 * ACCOUNTS (all use the same password: Password@123)
 *
 *   Candidate   candidate@ableup.test    verified, can apply immediately
 *   Recruiter   recruiter@ableup.test    verified + profile COMPLETE, can post jobs
 *   Admin       admin@ableup.test        verified
 *
 * ---------------------------------------------------------------------------
 * SUGGESTED MANUAL PASS
 *
 *   1. Recruiter  -> /recruiter          post a job
 *   2. Candidate  -> /jobs               find it, apply with a resume
 *   3. Recruiter  -> applicants          shortlist, schedule an interview
 *   4. Candidate  -> Interviews tab      accept the interview
 *   5. Admin      -> /admin              both verification queues
 *
 * TWO THINGS THIS SEED CANNOT SET UP FOR YOU:
 *
 *   • Recruiter onboarding. These accounts are pre-verified, so the wizard is
 *     skipped. To exercise it, either run with --pending-recruiter, or just
 *     register a brand new recruiter from /register — that walks the real
 *     path (onboarding -> verification-pending -> admin approves -> dashboard).
 *
 *   • Leaving a review. A review requires an interview that is ACCEPTED *and*
 *     already in the past, but the scheduling UI disables past dates, so you
 *     cannot reach that state by clicking alone. After step 4 above, move the
 *     interview backwards directly in Mongo:
 *
 *       db.interviews.updateOne(
 *         { status: "ACCEPTED" },
 *         { $set: { scheduledAt: new Date(Date.now() - 864e5) } }
 *       )
 *
 *     Reload the candidate's Interviews tab and "Leave a review" appears.
 * ---------------------------------------------------------------------------
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB, redactUri } from "./config/db.js";
import { env } from "./config/env.js";
import User from "./models/User.js";
import CandidateProfile from "./models/CandidateProfile.js";
import RecruiterProfile from "./models/RecruiterProfile.js";
import Job from "./models/Job.js";
import Application from "./models/Application.js";
import Interview from "./models/Interview.js";
import Review from "./models/Review.js";

const args = process.argv.slice(2);
const CONFIRMED = args.includes("--yes");
const PENDING_RECRUITER = args.includes("--pending-recruiter");

const PASSWORD = "Password@123";

const ACCOUNTS = {
  candidate: { name: "Test Candidate", email: "candidate@ableup.test" },
  recruiter: { name: "Test Recruiter", email: "recruiter@ableup.test" },
  admin: { name: "Test Admin", email: "admin@ableup.test" },
};

const seed = async () => {
  // The same value connectDB() will use. Reading process.env with its own
  // fallback here would let the confirmation banner name one database while
  // the drop ran against another.
  // Redacted: this banner is the last thing shown before every collection is
  // dropped, and it should be safe to paste into a bug report.
  const uri = redactUri(env.MONGO_URI);

  if (!CONFIRMED) {
    console.error("\n  Refusing to run without --yes.\n");
    console.error(`  This DROPS EVERY COLLECTION in: ${uri}\n`);
    console.error("  If that is what you want:  npm run seed1 -- --yes\n");
    process.exit(1);
  }

  await connectDB();
  console.log(`\n[seed1] target database: ${uri}`);
  console.log("[seed1] dropping all collections...");

  /**
   * drop() rather than deleteMany({}) so INDEXES go too, not just documents.
   * Emptying a collection leaves stale indexes behind — an index built by a
   * schema version you no longer run keeps enforcing its old constraint
   * forever. Mongoose rebuilds the current schema's indexes on first write.
   *
   * A collection that does not exist yet throws NamespaceNotFound (code 26);
   * that is the expected case on a fresh database, so it is swallowed.
   */
  const drop = async (model) => {
    try {
      await model.collection.drop();
      return "dropped";
    } catch (err) {
      if (err?.code === 26 || err?.codeName === "NamespaceNotFound") return "absent";
      throw err;
    }
  };

  // Every model in the app. Order does not matter — there are no FK constraints.
  console.table({
    reviews: await drop(Review),
    interviews: await drop(Interview),
    applications: await drop(Application),
    jobs: await drop(Job),
    recruiterProfiles: await drop(RecruiterProfile),
    candidateProfiles: await drop(CandidateProfile),
    users: await drop(User),
  });

  const password = await bcrypt.hash(PASSWORD, 12);

  // ---------------------------------------------------------------- candidate
  const candidate = await User.create({
    ...ACCOUNTS.candidate,
    password,
    role: "CANDIDATE",
    // VERIFIED so applying works immediately. Registering a new candidate from
    // the UI starts PENDING and needs admin approval — that is the flow to use
    // if you want to test the candidate verification queue.
    verificationStatus: "VERIFIED",
    isEmailVerified: true,
  });

  await CandidateProfile.create({
    userId: candidate._id,
    // Every value below is drawn from the shared vocabularies in
    // src/constants — the schemas enforce them as enums now, so a typo here
    // fails the seed instead of quietly creating data nothing can match.
    disabilityType: "Locomotor Disability",
    disabilityPercentage: 60,
    udidNumber: "MH1234567890",
    phone: "+91 98200 54321",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    preferredWorkHours: "Full-time",
    skills: ["React", "TypeScript", "Accessibility Testing"],
    // So the admin candidate queue has a document to render. The URL points at
    // the authenticated /api/documents route, not the public static mount —
    // these are identity records. No file is written to disk, so opening it
    // 404s; upload a real one from the profile page to exercise the viewer.
    verificationDocuments: [
      { url: "/api/documents/seed-udid-card.pdf", docType: "UDID Card" },
    ],
  });

  // ---------------------------------------------------------------- recruiter
  const recruiter = await User.create({
    ...ACCOUNTS.recruiter,
    password,
    role: "RECRUITER",
    verificationStatus: PENDING_RECRUITER ? "PENDING" : "VERIFIED",
    isEmailVerified: true,
  });

  // Every required field is filled so profileCompletion reports 100% and the
  // job-posting gate (requireVerifiedRecruiter) passes. With
  // --pending-recruiter the profile is left INCOMPLETE so the onboarding
  // wizard takes over on first login.
  await RecruiterProfile.create({
    userId: recruiter._id,
    companyName: "Test Company Pvt Ltd",
    website: "https://testcompany.example.com",
    companyEmail: "careers@testcompany.example.com",
    linkedin: "https://linkedin.com/company/testcompany",
    industry: "Information Technology",
    companySize: "51-200",
    companyDescription:
      "A test employer used for manual verification. We build accessible software and hire inclusively across all disability types.",
    foundedYear: 2015,
    hrContactPerson: "Test HR",
    hrContactNumber: "+91 98200 12345",
    companyAddress: "1 Test Street",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    accessibilityFacilities: [
      "Wheelchair Accessible",
      "Accessible Washrooms",
      "Sign Language Support",
      "Flexible Work Environment",
      "Assistive Technology",
    ],
    gstNumber: "27AAACT0000A1Z5",
    // So the admin recruiter queue has documents to render — this array had no
    // writer at all before, so admins approved companies with nothing attached.
    verificationDocuments: [
      {
        url: "/api/documents/seed-incorporation.pdf",
        docType: "Certificate of Incorporation",
      },
      { url: "/api/documents/seed-gst.pdf", docType: "GST Certificate" },
    ],
    onboardingStatus: PENDING_RECRUITER ? "INCOMPLETE" : "COMPLETE",
  });

  // -------------------------------------------------------------------- admin
  await User.create({
    ...ACCOUNTS.admin,
    password,
    role: "ADMIN",
    verificationStatus: "VERIFIED",
    isEmailVerified: true,
  });

  console.log("\n[seed1] created 3 accounts — password for all: " + PASSWORD + "\n");
  console.table([
    { role: "CANDIDATE", ...ACCOUNTS.candidate, status: "VERIFIED" },
    {
      role: "RECRUITER",
      ...ACCOUNTS.recruiter,
      status: PENDING_RECRUITER ? "PENDING (onboarding)" : "VERIFIED",
    },
    { role: "ADMIN", ...ACCOUNTS.admin, status: "VERIFIED" },
  ]);

  if (PENDING_RECRUITER) {
    console.log(
      "[seed1] --pending-recruiter: the recruiter lands on /recruiter/onboarding\n" +
        "        and must be approved by the admin before posting jobs.\n"
    );
  }

  await mongoose.disconnect();
  console.log("[seed1] done\n");
};

seed().catch(async (err) => {
  console.error("[seed1] FAILED:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
