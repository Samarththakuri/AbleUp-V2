/**
 * Brings the indexes in MongoDB in line with what the schemas declare.
 *
 * Mongoose builds *new* indexes automatically (`autoIndex` defaults to true)
 * but never drops ones you have removed — so an index built by a schema version
 * you no longer run keeps sitting there, consuming writes and, if it was
 * unique, still enforcing a constraint the code no longer knows about.
 *
 * `syncIndexes()` does both: creates what is missing, drops what is no longer
 * declared. Run it after any change to a schema's indexes.
 *
 *   npm run db:sync-indexes
 *
 * Dropped by this refactor: the duplicate second index on User.email,
 * CandidateProfile.userId, RecruiterProfile.userId, Interview.applicationId and
 * Application.jobId, plus Application's standalone { status: 1 }, which no
 * query could use because every status filter is scoped by jobId first.
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Application from "../models/Application.js";
import CandidateProfile from "../models/CandidateProfile.js";
import Interview from "../models/Interview.js";
import Job from "../models/Job.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import Review from "../models/Review.js";
import User from "../models/User.js";

const MODELS = [
  User,
  CandidateProfile,
  RecruiterProfile,
  Job,
  Application,
  Interview,
  Review,
];

const run = async () => {
  await connectDB();

  const report = {};

  for (const model of MODELS) {
    // Returns the names of the indexes it removed.
    const dropped = await model.syncIndexes();
    const indexes = await model.collection.indexes();
    report[model.collection.collectionName] = {
      dropped: dropped.length ? dropped.join(", ") : "—",
      indexes: indexes.length,
    };
  }

  console.log("\n[db:sync-indexes] indexes are now in sync with the schemas\n");
  console.table(report);

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("[db:sync-indexes] FAILED:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
