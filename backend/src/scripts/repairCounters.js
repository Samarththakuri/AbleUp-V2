/**
 * Recomputes every cached counter from the documents they summarise.
 *
 *   npm run db:repair            report drift and fix it
 *   npm run db:repair -- --dry   report drift only
 *
 * Two caches exist:
 *   Job.applicantsCount                   — count of applications for that job
 *   RecruiterProfile.reviewCount/averageRating — over that recruiter's reviews
 *
 * Both are maintained incrementally in normal operation (cascadeService and
 * reviewService respectively). This is the safety net for the cases increments
 * cannot cover: a crash between two non-atomic writes, a manual edit in mongosh,
 * a seed that wrote documents directly.
 *
 * It is also the verification step for the cascade work: after deleting a
 * candidate account, this should report ZERO corrections. Anything else means a
 * delete path is still bypassing cascadeService.
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import Review from "../models/Review.js";

const DRY_RUN = process.argv.slice(2).includes("--dry");

/** Job.applicantsCount vs the real number of applications. */
const repairApplicantCounts = async () => {
  const actual = await Application.aggregate([
    { $group: { _id: "$jobId", count: { $sum: 1 } } },
  ]);
  const actualByJob = new Map(actual.map((a) => [a._id.toString(), a.count]));

  const jobs = await Job.find().select("applicantsCount").lean();
  const drift = [];

  for (const job of jobs) {
    const real = actualByJob.get(job._id.toString()) || 0;
    if (job.applicantsCount !== real) {
      drift.push({
        jobId: job._id.toString(),
        stored: job.applicantsCount,
        actual: real,
      });
    }
  }

  if (drift.length && !DRY_RUN) {
    await Job.bulkWrite(drift.map((d) => ({
      updateOne: {
        filter: { _id: d.jobId },
        update: { $set: { applicantsCount: d.actual } },
      },
    })));
  }

  return drift;
};

/** RecruiterProfile.reviewCount / averageRating vs the real review set. */
const repairReviewAggregates = async () => {
  const actual = await Review.aggregate([
    {
      $group: { _id: "$recruiterId", count: { $sum: 1 }, average: { $avg: "$rating" } },
    },
  ]);
  const actualByRecruiter = new Map(actual.map((a) => [a._id.toString(), a]));

  const profiles = await RecruiterProfile.find()
    .select("userId reviewCount averageRating")
    .lean();
  const drift = [];

  const updates = [];

  for (const profile of profiles) {
    const found = actualByRecruiter.get(profile.userId.toString());
    const count = found?.count || 0;
    // Same 1dp rounding reviewService applies, so a correct cache is not
    // reported as drift by a floating-point tail.
    const average = found ? Math.round(found.average * 10) / 10 : 0;

    if (profile.reviewCount !== count || profile.averageRating !== average) {
      drift.push({
        userId: profile.userId.toString(),
        stored: `${profile.reviewCount} reviews / ${profile.averageRating}`,
        actual: `${count} reviews / ${average}`,
      });
      updates.push({ userId: profile.userId, count, average });
    }
  }

  if (updates.length && !DRY_RUN) {
    await RecruiterProfile.bulkWrite(updates.map((u) => ({
      updateOne: {
        filter: { userId: u.userId },
        update: { $set: { reviewCount: u.count, averageRating: u.average } },
      },
    })));
  }

  return drift;
};

/** Reviews whose interview no longer exists — cascadeService should prevent these. */
const findOrphanedReviews = async () => {
  const orphans = await Review.aggregate([
    {
      $lookup: {
        from: "interviews",
        localField: "interviewId",
        foreignField: "_id",
        as: "interview",
      },
    },
    { $match: { interview: { $size: 0 } } },
    { $project: { _id: 1, interviewId: 1 } },
  ]);

  if (orphans.length && !DRY_RUN) {
    await Review.deleteMany({ _id: { $in: orphans.map((o) => o._id) } });
  }

  return orphans;
};

const run = async () => {
  await connectDB();
  console.log(`\n[db:repair] ${DRY_RUN ? "DRY RUN — reporting only" : "repairing"}\n`);

  const applicantDrift = await repairApplicantCounts();
  const reviewDrift = await repairReviewAggregates();
  const orphans = await findOrphanedReviews();

  if (applicantDrift.length) {
    console.log(`Job.applicantsCount — ${applicantDrift.length} incorrect:`);
    console.table(applicantDrift);
  }
  if (reviewDrift.length) {
    console.log(`RecruiterProfile review aggregates — ${reviewDrift.length} incorrect:`);
    console.table(reviewDrift);
  }
  if (orphans.length) {
    console.log(`Reviews pointing at a deleted interview — ${orphans.length} removed.`);
  }

  const total = applicantDrift.length + reviewDrift.length + orphans.length;
  console.log(total === 0
    ? "[db:repair] no drift — every cached counter matches its source\n"
    : `[db:repair] ${total} correction(s)${DRY_RUN ? " needed" : " applied"}\n`);

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("[db:repair] FAILED:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
