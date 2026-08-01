import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
const applicationSchemaOptions = {
  ...baseSchemaOptions,
  timestamps: { createdAt: "appliedAt", updatedAt: "updatedAt" },
};

const ApplicationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["APPLIED", "SHORTLISTED", "REJECTED", "HIRED"],
      default: "APPLIED",
    },
    shortlistReason: { type: String, trim: true, maxlength: 1000 },
    shortlistedBy: { type: Schema.Types.ObjectId, ref: "User" },
    coverLetter: { type: String, trim: true, maxlength: 5000 },
    resumeUrl: String,
  },
  applicationSchemaOptions,
);

//this virtual is added for api response and runs whenever mongoose does
//solely done for the frontend becuase it relied on shortlisted value
//this will return the json response with a shortlisted field as set true if status is shortlisted
ApplicationSchema.virtual("shortlisted").get(function () {
  return this.status === "SHORTLISTED";
});

// One application per candidate per job. This unique index — not the
// check-then-act guard in the controller — is what actually prevents doubles.
//yaad haina ki index retrival ke saath update or insert pe bhi help karta hai
ApplicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

// "My applications", sorted newest first.
ApplicationSchema.index({ candidateId: 1, appliedAt: -1 });

// Applicants for a job, optionally filtered by status, sorted newest first.
// Also serves the shortlisted counts and the bare { jobId } counts by prefix.
// Replaces a standalone { status: 1 } index that no query could ever use —
// every status filter in the app is scoped by jobId first.
ApplicationSchema.index({ jobId: 1, status: 1, appliedAt: -1 });

export default mongoose.model("Application", ApplicationSchema);
