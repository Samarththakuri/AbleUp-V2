import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const InterviewSchema = new Schema({
  // Indexed once, by the unique index below — the inline `index: true` here
  // built a second, redundant index on the same key.
  applicationId: { type: Schema.Types.ObjectId, ref: "Application", required: true },
  jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
  candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recruiterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  scheduledAt: { type: Date, required: true },
  // The controller carried its own `duration || 30` / `mode || "ONLINE"`
  // fallbacks in two places. The schema owns the defaults now.
  duration: { type: Number, default: 30, min: 15, max: 480 },
  mode: { type: String, enum: ["ONLINE", "IN_PERSON", "PHONE"], default: "ONLINE" },
  location: { type: String, trim: true, maxlength: 500 },
  notes: { type: String, trim: true, maxlength: 2000 },
  status: {
    type: String,
    enum: ["SCHEDULED", "ACCEPTED", "RESCHEDULE_REQUESTED", "RESCHEDULED", "COMPLETED", "CANCELLED"],
    default: "SCHEDULED",
  },
  candidateMessage: { type: String, trim: true, maxlength: 1000 },
}, baseSchemaOptions);

// One interview per application — a reschedule mutates this document rather
// than creating a second round.
InterviewSchema.index({ applicationId: 1 }, { unique: true });

/**
 * Both interview lists filter by one party and sort by scheduledAt.
 * `recruiterId` carried no index at all, so the recruiter branch of
 * getMyInterviews and the recruiter dashboard's interview count were both full
 * collection scans; `candidateId` had one but not the sort key.
 */
InterviewSchema.index({ recruiterId: 1, scheduledAt: 1 });
InterviewSchema.index({ candidateId: 1, scheduledAt: 1 });

export default mongoose.model("Interview", InterviewSchema);
