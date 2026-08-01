import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
import {
  DISABILITY_TYPES,
  JOB_ACCESSIBILITY_FEATURES,
  WORK_HOUR_OPTIONS,
} from "../constants/index.js";

const JobSchema = new Schema(
  {
    recruiterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
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

    //a little newer syntax
    disabilityEligible: [{ type: String, enum: [...DISABILITY_TYPES] }],
    accessibilityFeatures: [
      { type: String, enum: [...JOB_ACCESSIBILITY_FEATURES] },
    ],

    requiredSkills: [{ type: String, trim: true, maxlength: 60 }],

    location: { type: String, trim: true, maxlength: 200 },
    remote: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    //calcaluted via the cascade service
    applicantsCount: { type: Number, default: 0, min: 0 },
  },
  baseSchemaOptions,
);
//this hook helps to validate whenever document is being stored in mongodb ensuring consistency
//runs but does not throw only tell its invalidated so jab baadme mein moongose validate karega pata lag jayega ki yeh field
//invalid hai and then this throws a error
//this hook does not run for the findoneandupdate query only runs in case of save
//hence zod still helps in validation
JobSchema.pre("validate", function (next) {
  const { salaryMin, salaryMax } = this;
  if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
    this.invalidate(
      "salaryMax",
      "salaryMax must be greater than or equal to salaryMin",
    );
  }
  next();
});

// Public job list: find({ isActive: true }).sort({ createdAt: -1 }).
JobSchema.index({ isActive: 1, createdAt: -1 });

// Every recruiter-scoped listing sorts by createdAt; a bare { recruiterId: 1 }
// index served the filter and then sorted the whole result set in memory.
JobSchema.index({ recruiterId: 1, isActive: 1, createdAt: -1 });

// index can serve, run twice per request (find + countDocuments).
//easier to get for searching in case of particular jd
JobSchema.index({ title: "text", description: "text" });

export default mongoose.model("Job", JobSchema);
