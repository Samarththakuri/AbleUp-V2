import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
import { VerificationDocumentSchema } from "./verificationDocument.js";
import { DISABILITY_TYPES, WORK_HOUR_OPTIONS } from "../constants/index.js";

const CandidateProfileSchema = new Schema({
  // `unique` builds the index; a separate `index: true` only produced a
  // duplicate-index warning on boot.
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

  // Contact / location — RecruiterProfile has had these since onboarding was
  // built; the candidate side never did, so a recruiter could not tell where
  // an applicant was based.
  phone: { type: String, trim: true, maxlength: 20 },
  city: { type: String, trim: true, maxlength: 100 },
  state: { type: String, trim: true, maxlength: 100 },
  country: { type: String, trim: true, maxlength: 100 },

  // Job preferences
  preferredWorkHours: { type: String, enum: [...WORK_HOUR_OPTIONS] },
  resumeUrl: String,
  skills: [{ type: String, trim: true, maxlength: 60 }],
  savedJobs: [{ type: Schema.Types.ObjectId, ref: "Job" }],

  /**
   * Replaces the loose `udidDocumentUrl: String`, which had no document type,
   * no upload timestamp, no way to hold more than one file, and no API path
   * that could ever set it. Same embedded shape RecruiterProfile uses, so
   * admin verification sees one structure for both roles.
   */
  verificationDocuments: { type: [VerificationDocumentSchema], default: [] },
}, baseSchemaOptions);

// No index on `skills` yet — nothing compares CandidateProfile.skills against
// Job.requiredSkills anywhere in the app. Add { skills: 1 } when matching ships.

export default mongoose.model("CandidateProfile", CandidateProfileSchema);
