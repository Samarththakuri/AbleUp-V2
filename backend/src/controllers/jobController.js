import mongoose from "mongoose";
import Job from "../models/Job.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import User from "../models/User.js";
import Review from "../models/Review.js";
import { withVerifiedHireFlag } from "../services/reviewService.js";

/** Treats user input as a literal inside a $regex filter. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET public job search
export const searchJobs = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const filter = { isActive: true };

  // Free-text search runs against the { title, description } text index rather
  // than two unanchored case-insensitive $regex clauses. Those could not be
  // served by any index — every search scanned every active job, twice (find +
  // countDocuments) — and interpolated the raw query string into a regex.
  if (req.query.q) {
    filter.$text = { $search: String(req.query.q) };
  }
  // `location` stays a prefix match, but escaped: a user typing "C++" or "(" no
  // longer produces an invalid-regex 500.
  if (req.query.location) {
    filter.location = { $regex: escapeRegex(String(req.query.location)), $options: "i" };
  }
  if (req.query.remote === "true") filter.remote = true;
  if (req.query.disability) filter.disabilityEligible = { $in: [req.query.disability] };
  // Assigning an arbitrary string here produced a CastError 500 on any input
  // that was not a valid ObjectId.
  if (req.query.recruiter && mongoose.isValidObjectId(req.query.recruiter)) {
    filter.recruiterId = req.query.recruiter;
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);

  res.json({ success: true, jobs, meta: { page, limit, total } });
};

// GET single job
export const getJobById = async (req, res) => {
  const job = await Job.findById(req.params.jobId).populate("recruiterId", "name email");
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  // Fetch recruiter profile
  const recruiterProfile = await RecruiterProfile.findOne({ userId: job.recruiterId });

  res.json({ success: true, job, recruiterProfile });
};

// GET similar jobs
export const getSimilarJobs = async (req, res) => {
  const job = await Job.findById(req.params.jobId);
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  const filter = {
    _id: { $ne: job._id },
    isActive: true,
    $or: [],
  };

  if (job.disabilityEligible?.length) {
    filter.$or.push({ disabilityEligible: { $in: job.disabilityEligible } });
  }
  if (job.location) {
    filter.$or.push({ location: { $regex: escapeRegex(job.location), $options: "i" } });
  }
  if (job.remote) {
    filter.$or.push({ remote: true });
  }

  // Fallback: if no $or conditions, just get recent active jobs
  if (!filter.$or.length) delete filter.$or;

  const similar = await Job.find(filter).sort({ createdAt: -1 }).limit(6);
  res.json({ success: true, jobs: similar });
};

/**
 * Public company page consumed by candidates (spec §10).
 *
 * Returns the company identity, accessibility facilities and the candidate
 * reviews that are now the sole recruiter reputation signal. `isVerified` is
 * derived from the user's real verificationStatus so the client no longer has
 * to hardcode a "Verified Employer" badge.
 */
export const getPublicRecruiterProfile = async (req, res) => {
  const { recruiterId } = req.params;

  if (!mongoose.isValidObjectId(recruiterId)) {
    res.status(404).json({ success: false, message: "Recruiter not found" });
    return;
  }

  const [user, profile, jobs, foundReviews] = await Promise.all([
    User.findById(recruiterId).select("name email role createdAt verificationStatus"),
    RecruiterProfile.findOne({ userId: recruiterId }),
    // Bounded — this list was unlimited, so a company with thousands of jobs
    // served all of them on a public page.
    Job.find({ recruiterId, isActive: true }).sort({ createdAt: -1 }).limit(50),
    Review.find({ recruiterId })
      .populate("candidateId", "name")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  if (!user || user.role !== "RECRUITER") {
    res.status(404).json({ success: false, message: "Recruiter not found" });
    return;
  }

  const reviews = await withVerifiedHireFlag(foundReviews);

  res.json({
    success: true,
    recruiter: {
      ...user.toObject(),
      isVerified: user.verificationStatus === "VERIFIED",
      profile: profile ? profile.toJSON() : null,
    },
    jobs,
    reviews,
  });
};
