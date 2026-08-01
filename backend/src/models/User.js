import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";
const userSchemaOptions = {
  ...baseSchemaOptions,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.password;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpires;
      delete ret.emailVerificationToken;
      return ret;
    },
  },
};

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // `select: false` — callers that need to compare a hash must opt in with
    // .select("+password"). See authController login/changePassword/reset.
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["CANDIDATE", "RECRUITER", "ADMIN"],
      required: true,
    },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    isEmailVerified: { type: Boolean, default: false },
    forcePasswordChange: { type: Boolean, default: false },
  },
  userSchemaOptions,
);

// Admin queues: find({ role, verificationStatus? }).sort({ createdAt: -1 }).
// Without this both admin list endpoints collection-scan then sort in memory.
UserSchema.index({ role: 1, verificationStatus: 1, createdAt: -1 });

// Token lookups were full collection scans on every password reset / email
// verification. Sparse because only a handful of users hold a live token.
//
// NOT a TTL index on resetPasswordExpires — TTL deletes the whole document,
// which here is the user's account. Tokens are cleared on use instead.
UserSchema.index({ resetPasswordToken: 1 }, { sparse: true });
UserSchema.index({ emailVerificationToken: 1 }, { sparse: true });

export default mongoose.model("User", UserSchema);
