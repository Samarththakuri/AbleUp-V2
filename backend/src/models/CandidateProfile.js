import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
import { VerificationDocumentSchema } from "./verificationDocument.js";
import { DISABILITY_TYPES, WORK_HOUR_OPTIONS } from "../constants/index.js";

const CandidateProfileSchema = new Schema(
  {
    // `unique` builds the index; a separate `index: true` only produced a
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    // Identity / disability. `disabilityType` shares its vocabulary with
    // Job.disabilityEligible — free text on either side made matching
    // impossible, which is why both are enums now.
    disabilityType: { type: String, enum: [...DISABILITY_TYPES] },
    disabilityPercentage: { type: Number, min: 0, max: 100 },
    udidNumber: { type: String, unique: true, sparse: true, trim: true },
    phone: { type: String, trim: true, maxlength: 20 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 },

    // Job preferences
    preferredWorkHours: { type: String, enum: [...WORK_HOUR_OPTIONS] },
    resumeUrl: String,
    skills: [{ type: String, trim: true, maxlength: 60 }],
    savedJobs: [{ type: Schema.Types.ObjectId, ref: "Job" }],
    //every user can sumbit multiple prrofs fpr verification
    verificationDocuments: { type: [VerificationDocumentSchema], default: [] },
  },
  baseSchemaOptions,
);

// No index on `skills` yet — nothing compares CandidateProfile.skills against
// Job.requiredSkills anywhere in the app. Add { skills: 1 } when matching ships.

export default mongoose.model("CandidateProfile", CandidateProfileSchema);
