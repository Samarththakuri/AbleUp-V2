import Application from "../models/Application.js";
import CandidateProfile from "../models/CandidateProfile.js";
import Interview from "../models/Interview.js";
import Job from "../models/Job.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import Review from "../models/Review.js";
import { recomputeRecruiterRating } from "./reviewService.js";

/** Called when an application is created. The only increment in the app. */
export const incrementApplicantsCount = async (jobId) => {
  await Job.findByIdAndUpdate(jobId, { $inc: { applicantsCount: 1 } });
};

/**
 * Deletes applications matching `filter` and decrements each affected job's
 * counter by exactly the number removed.
 *
 * Counts are grouped up front because the documents are gone afterwards, and
 * `$max: 0`-style clamping is left to the schema's `min: 0` plus db:repair.
 */
export const deleteApplications = async (filter) => {
  const perJob = await Application.aggregate([
    { $match: filter },
    { $group: { _id: "$jobId", count: { $sum: 1 } } },
  ]);

  if (perJob.length === 0) return 0;

  await Application.deleteMany(filter);

  await Job.bulkWrite(perJob.map((entry) => ({
    updateOne: {
      filter: { _id: entry._id },
      update: { $inc: { applicantsCount: -entry.count } },
    },
  })));

  return perJob.reduce((sum, entry) => sum + entry.count, 0);
};

/**
 * Deletes interviews matching `filter` along with the reviews attached to them,
 * then recomputes the aggregates of every recruiter whose review set changed.
 *
 * Nothing did this before, so a review could outlive the interview that
 * authorised it — and since the unique index is on `interviewId`, that orphan
 * also permanently blocked any future review of a re-created interview.
 */
export const deleteInterviews = async (filter) => {
  const interviews = await Interview.find(filter).select("_id").lean();
  if (interviews.length === 0) return 0;

  const interviewIds = interviews.map((i) => i._id);

  const affectedRecruiters = await Review.distinct("recruiterId", {
    interviewId: { $in: interviewIds },
  });

  await Review.deleteMany({ interviewId: { $in: interviewIds } });
  await Interview.deleteMany({ _id: { $in: interviewIds } });

  for (const recruiterId of affectedRecruiters) {
    await recomputeRecruiterRating(recruiterId);
  }

  return interviews.length;
};

/** Removes a job and everything that points at it. */
export const deleteJobCascade = async (jobId) => {
  await deleteInterviews({ jobId });
  // Deliberately not deleteApplications() — the job row is about to go, so
  // decrementing its counter first would be wasted work.
  await Application.deleteMany({ jobId });
  await Job.findByIdAndDelete(jobId);
};

/**
 * Removes a user and every document that belongs to them.
 *
 * Candidates: reviews they wrote are removed and the recruiters they rated are
 * recomputed, otherwise a deleted account keeps influencing a company's score.
 * Recruiters: their jobs, and everything hanging off those jobs, go with them.
 */
export const deleteUserCascade = async (user) => {
  const userId = user._id;

  if (user.role === "CANDIDATE") {
    const ratedRecruiters = await Review.distinct("recruiterId", {
      candidateId: userId,
    });
    await Review.deleteMany({ candidateId: userId });

    await Interview.deleteMany({ candidateId: userId });
    await deleteApplications({ candidateId: userId });
    await CandidateProfile.deleteMany({ userId });

    for (const recruiterId of ratedRecruiters) {
      await recomputeRecruiterRating(recruiterId);
    }
  } else if (user.role === "RECRUITER") {
    // Job's owner field is `recruiterId`; an earlier `postedBy` filter matched
    // nothing, so jobs and applications were silently orphaned.
    const jobs = await Job.find({ recruiterId: userId }).select("_id").lean();
    const jobIds = jobs.map((j) => j._id);

    await Review.deleteMany({ recruiterId: userId });
    await Interview.deleteMany({ recruiterId: userId });
    await Application.deleteMany({ jobId: { $in: jobIds } });
    await Job.deleteMany({ recruiterId: userId });
    await RecruiterProfile.deleteMany({ userId });
  }
};
