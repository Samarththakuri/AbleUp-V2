import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
import {
  DISABILITY_TYPES,
  JOB_ACCESSIBILITY_FEATURES,
  WORK_HOUR_OPTIONS,
} from "../constants/index.js";

const JobSchema = new Schema({
  recruiterId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Bounds mirror validators/jobValidators.js exactly. They live here as well
  // as in Zod because the seed and any direct write bypass the HTTP layer,
  // and a 10,000-word description that only the API rejects is not a rule.
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 20,
    maxlength: 10000,
  },

  salaryMin: { type: Number, min: 0 },
  salaryMax: { type: Number, min: 0 },

  workHours: { type: String, enum: [...WORK_HOUR_OPTIONS] },

  // Both vocabularies were unconstrained `[String]`. A recruiter typing
  // "wheelchair access" and a candidate declaring "Locomotor Disability"
  // could never be matched, which is the whole point of these two fields.
  disabilityEligible: [{ type: String, enum: [...DISABILITY_TYPES] }],
  accessibilityFeatures: [{ type: String, enum: [...JOB_ACCESSIBILITY_FEATURES] }],

  requiredSkills: [{ type: String, trim: true, maxlength: 60 }],

  location: { type: String, trim: true, maxlength: 200 },
  remote: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  /**
   * Cached count of applications, owned by services/cascadeService — the only
   * place that increments and decrements it. Recompute with `npm run db:repair`.
   */
  applicantsCount: { type: Number, default: 0, min: 0 },
}, baseSchemaOptions);

/**
 * Cross-field rule, previously enforced only by `salaryRangeIsValid` in the Zod
 * DTO, so the seed and any direct write could store an inverted range.
 *
 * A `pre("validate")` hook rather than a path validator because the rule needs
 * both fields, and `invalidate` so it surfaces as a ValidationError (mapped to
 * 400 by middleware/errorHandler) instead of a thrown 500. Document-level hooks
 * do not fire on findOneAndUpdate — the Zod DTO still covers the PATCH path.
 */
JobSchema.pre("validate", function (next) {
  const { salaryMin, salaryMax } = this;
  if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
    this.invalidate("salaryMax", "salaryMax must be greater than or equal to salaryMin");
  }
  next();
});

// Public job list: find({ isActive: true }).sort({ createdAt: -1 }).
JobSchema.index({ isActive: 1, createdAt: -1 });

// Every recruiter-scoped listing sorts by createdAt; a bare { recruiterId: 1 }
// index served the filter and then sorted the whole result set in memory.
JobSchema.index({ recruiterId: 1, isActive: 1, createdAt: -1 });

// Job search used unanchored case-insensitive $regex over both fields, which no
// index can serve, run twice per request (find + countDocuments).
JobSchema.index({ title: "text", description: "text" });

export default mongoose.model("Job", JobSchema);
