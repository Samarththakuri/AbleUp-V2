import Job from "../models/Job.js";
import Application from "../models/Application.js";
import CandidateProfile from "../models/CandidateProfile.js";
import Interview from "../models/Interview.js";
import User from "../models/User.js";
import { sendEmail, buildShortlistEmail } from "../utils/mailer.js";
import { fail, ok } from "../utils/apiResponse.js";
import { deleteJobCascade } from "../services/cascadeService.js";

/**
 * Recruiter job & applicant operations only.
 * Company-profile concerns live in recruiterProfileController.
 */

export const getRecruiterJobs = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const filter = { recruiterId: req.user._id };
  if (req.query.active === "true") filter.isActive = true;

  const [jobs, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);

  // Add shortlisted counts. Filters on `status` rather than the old stored
  // `shortlisted` boolean — that field is a virtual now, so it does not exist
  // in Mongo and cannot be matched on. Served by { jobId, status, appliedAt }.
  const jobIds = jobs.map((j) => j._id);
  const shortlistedCounts = await Application.aggregate([
    { $match: { jobId: { $in: jobIds }, status: "SHORTLISTED" } },
    { $group: { _id: "$jobId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(shortlistedCounts.map((c) => [c._id.toString(), c.count]));

  const result = jobs.map((j) => ({
    ...j.toObject(),
    shortlistedCount: countMap.get(j._id.toString()) || 0,
  }));

  return ok(res, { jobs: result, meta: { page, limit, total } });
};

/**
 * Creates a job and nothing else.
 *
 * This used to upsert the recruiter's RecruiterProfile and recompute an
 * inclusivity score as side effects, mixing onboarding and reputation into
 * job creation. The profile is now created at registration, and
 * requireVerifiedRecruiter has already rejected recruiters without a
 * completed, verified profile before this handler runs.
 *
 * Body is validated and whitelisted by validate(createJobSchema).
 */
export const createJob = async (req, res) => {
  const job = await Job.create({
    ...(req.body),
    recruiterId: req.user._id,
  });

  return ok(res, { job }, 201);
};

export const getJobApplicants = async (req, res) => {
  const { jobId } = req.params;
  const job = await Job.findById(jobId);
  if (!job || job.recruiterId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Not authorized", "NOT_JOB_OWNER");
  }

  const page = parseInt(req.query.page) || 1;
  // Capped: an uncapped `limit` is a client-controlled full-collection read,
  // and it would size the $in below to match.
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip = (page - 1) * limit;
  const filter = { jobId };
  if (req.query.status) filter.status = req.query.status;

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate("candidateId", "name email verificationStatus")
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  // Attach candidate profiles and interviews.
  //
  // The interview used to be the client's problem: the applicants table looped
  // GET /interviews/application/:id once per shortlisted row, so opening one
  // job could be up to `limit` extra HTTP requests. One $in over the whole page
  // replaces all of them, served by the unique { applicationId } index on
  // Interview. Only SHORTLISTED applications can have one (scheduleInterview
  // rejects the rest), so this fetches nothing the loop did not.
  const candidateIds = applications.map((a) => a.candidateId?._id).filter(Boolean);
  const applicationIds = applications.map((a) => a._id);

  const [profiles, interviews] = await Promise.all([
    CandidateProfile.find({ userId: { $in: candidateIds } }),
    Interview.find({ applicationId: { $in: applicationIds } }).lean(),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));
  const interviewMap = new Map(
    interviews.map((i) => [i.applicationId.toString(), i])
  );

  const result = applications.map((a) => ({
    ...a.toObject(),
    candidateProfile: a.candidateId ? profileMap.get(a.candidateId._id.toString()) || null : null,
    applicationResumeUrl: a.resumeUrl || null,
    interview: interviewMap.get(a._id.toString()) || null,
  }));

  return ok(res, { applications: result, meta: { page, limit, total } });
};

export const shortlistApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { shortlisted, reason } = req.body;

  const application = await Application.findById(applicationId);
  if (!application) {
    return fail(res, 404, "Application not found", "APPLICATION_NOT_FOUND");
  }

  const job = await Job.findById(application.jobId);
  if (!job || job.recruiterId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Not authorized", "NOT_JOB_OWNER");
  }

  // `status` is the single source of truth — the `shortlisted` boolean it used
  // to be written alongside is a virtual derived from this line, and
  // `updatedAt` is maintained by the schema's timestamps.
  application.status = shortlisted ? "SHORTLISTED" : "REJECTED";
  application.shortlistReason = reason || undefined;
  application.shortlistedBy = req.user._id;
  await application.save();

  // Send email notification if shortlisted
  if (shortlisted) {
    try {
      const candidate = await User.findById(application.candidateId);
      if (candidate?.email && job) {
        const { subject, html } = buildShortlistEmail(candidate.name, job.title);
        sendEmail({ to: candidate.email, subject, html }); // fire-and-forget
      }
    } catch (emailErr) {
      console.error("[Recruiter] Email notification error:", emailErr);
    }
  }

  return ok(res, { application });
};

export const bulkActionApplications = async (req, res) => {
  const { applicationIds, action } = req.body;
  if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
    return fail(res, 400, "No applications specified", "NO_APPLICATIONS");
  }
  if (!["shortlist", "reject"].includes(action)) {
    return fail(res, 400, "Invalid action", "INVALID_ACTION");
  }

  const applications = await Application.find({ _id: { $in: applicationIds } });
  const jobIds = [...new Set(applications.map((a) => a.jobId.toString()))];
  const jobs = await Job.find({ _id: { $in: jobIds }, recruiterId: req.user._id });
  const authorizedJobIds = new Set(jobs.map((j) => j._id.toString()));

  const authorized = applications.filter((a) =>
    authorizedJobIds.has(a.jobId.toString()));

  for (const app of authorized) {
    // `status` only — `shortlisted` is derived from it, `updatedAt` is
    // maintained by timestamps.
    app.status = action === "shortlist" ? "SHORTLISTED" : "REJECTED";
    app.shortlistedBy = req.user._id;
    await app.save();
  }

  if (action === "shortlist" && authorized.length > 0) {
    // Was a User.findById + Job.findById per application inside the loop, with
    // the same job re-fetched every iteration even though `jobs` was already
    // loaded above. Two batched reads instead.
    try {
      const candidates = await User.find({
        _id: { $in: authorized.map((a) => a.candidateId) },
      })
        .select("name email")
        .lean();
      const candidateMap = new Map(candidates.map((c) => [c._id.toString(), c]));
      const jobMap = new Map(jobs.map((j) => [j._id.toString(), j]));

      for (const app of authorized) {
        const candidate = candidateMap.get(app.candidateId.toString());
        const job = jobMap.get(app.jobId.toString());
        if (candidate?.email && job) {
          const { subject, html } = buildShortlistEmail(candidate.name, job.title);
          sendEmail({ to: candidate.email, subject, html }); // fire-and-forget
        }
      }
    } catch (emailErr) {
      console.error("[Recruiter] Bulk shortlist email error:", emailErr);
    }
  }

  return ok(res, { updated: authorized.length });
};

export const getJobSummary = async (req, res) => {
  const { jobId } = req.params;
  const job = await Job.findById(jobId);
  if (!job || job.recruiterId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Not authorized", "NOT_JOB_OWNER");
  }

  // `applicantsCount` comes off the job document, not a fresh count. This
  // endpoint used to recompute it and return the real number under the same
  // field name the job list served from cache, so the two disagreed whenever
  // the cache had drifted. One meaning per name; `npm run db:repair` is what
  // corrects the cache.
  const shortlistedCount = await Application.countDocuments({
    jobId,
    status: "SHORTLISTED",
  });

  // title/location/remote come off the job document already loaded above, at no
  // extra query. They are here so the applicants page can stop downloading the
  // recruiter's entire job list just to read two fields off one job.
  return ok(res, {
    title: job.title,
    location: job.location,
    remote: job.remote,
    applicantsCount: job.applicantsCount,
    shortlistedCount,
  });
};

export const updateJob = async (req, res) => {
  const { jobId } = req.params;
  const job = await Job.findById(jobId);

  if (!job || job.recruiterId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Not authorized", "NOT_JOB_OWNER");
  }

  // req.body is the whitelisted UpdateJobDto — server-owned fields such as
  // recruiterId and applicantsCount cannot be reached from the client.
  const updatedJob = await Job.findByIdAndUpdate(jobId, req.body, { new: true, runValidators: true });

  return ok(res, { job: updatedJob });
};

export const deleteJob = async (req, res) => {
  const { jobId } = req.params;
  const job = await Job.findById(jobId);

  if (!job || job.recruiterId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Not authorized", "NOT_JOB_OWNER");
  }

  // Applications, interviews AND the reviews attached to those interviews.
  // The hand-rolled teardown here left reviews behind pointing at interviews
  // that no longer existed, and never recomputed the recruiter's rating.
  await deleteJobCascade(jobId);

  return ok(res, { message: "Job and associated applications deleted" });
};
