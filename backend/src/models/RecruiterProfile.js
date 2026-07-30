import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
import { VerificationDocumentSchema } from "./verificationDocument.js";
import {
  COMPANY_ACCESSIBILITY_FACILITIES,
  COMPANY_SIZES,
  INDUSTRIES,
  ONBOARDING_STATUSES,
} from "../constants/index.js";

const RecruiterProfileSchema = new Schema({
  // `unique` builds the index on its own; the extra `index: true` here was a
  // duplicate-index warning on every boot.
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    unique: true,
    required: true,
  },

  // Company identity
  companyName: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
  companyLogo: String,
  website: { type: String, trim: true },
  companyEmail: { type: String, trim: true, lowercase: true },
  linkedin: { type: String, trim: true },
  // INDUSTRIES already existed in constants/company.js and was already used by
  // the Zod DTO — the schema was simply not wired to it.
  industry: { type: String, enum: [...INDUSTRIES] },
  companySize: { type: String, enum: [...COMPANY_SIZES] },
  companyDescription: { type: String, trim: true, maxlength: 5000 },
  foundedYear: { type: Number, min: 1800, max: new Date().getFullYear() },
  mission: { type: String, trim: true, maxlength: 2000 },
  vision: { type: String, trim: true, maxlength: 2000 },

  // HR contact
  hrContactPerson: { type: String, trim: true, maxlength: 100 },
  hrContactNumber: { type: String, trim: true, maxlength: 20 },

  // Location
  companyAddress: { type: String, trim: true, maxlength: 300 },
  city: { type: String, trim: true, maxlength: 100 },
  state: { type: String, trim: true, maxlength: 100 },
  country: { type: String, trim: true, maxlength: 100 },

  // Company-wide accessibility facilities
  accessibilityFacilities: {
    type: [{ type: String, enum: [...COMPANY_ACCESSIBILITY_FACILITIES] }],
    default: [],
  },

  // Verification / onboarding
  gstNumber: { type: String, trim: true, uppercase: true },
  verificationDocuments: { type: [VerificationDocumentSchema], default: [] },
  onboardingStatus: {
    type: String,
    enum: [...ONBOARDING_STATUSES],
    default: "INCOMPLETE",
    index: true,
  },
  submittedForVerificationAt: Date,

  // Review aggregates — written only by services/reviewService.
  // Recompute with `npm run db:repair`.
  reviewCount: { type: Number, default: 0, min: 0 },
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
}, baseSchemaOptions);

// A GST number identifies exactly one company. It was stored, accepted by the
// DTO, and never constrained or read. Sparse — most profiles have none.
RecruiterProfileSchema.index({ gstNumber: 1 }, { unique: true, sparse: true });

export default mongoose.model("RecruiterProfile", RecruiterProfileSchema);
