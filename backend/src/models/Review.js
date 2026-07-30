import mongoose, { Schema } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const ReviewSchema = new Schema({
  candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recruiterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  interviewId: {
    type: Schema.Types.ObjectId,
    ref: "Interview",
    required: true,
    unique: true,
  },
  rating: { type: Number, required: true, min: 1, max: 5 },
  // Bounds mirror validators/reviewValidators.js.
  comment: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
}, baseSchemaOptions);

/**
 * `isVerifiedHire` used to live here as a stored boolean set at write time from
 * `application.status === "HIRED"`. Nothing in the app ever assigns HIRED, so
 * it was permanently false; and even once a HIRED transition exists, a snapshot
 * taken when the review was written would never refresh. The badge is computed
 * at read time from the application status instead — see reviewController.
 */

// One review per interview is already guaranteed by the unique `interviewId`
// above, so no compound index on { candidateId, recruiterId, interviewId } is
// needed.

// Company profile reviews: find({ recruiterId }).sort({ createdAt: -1 }), three
// call sites. A bare { recruiterId: 1 } index left the sort to be done in memory.
ReviewSchema.index({ recruiterId: 1, createdAt: -1 });

// "Reviews I have written" — candidateId was a required ref with no index.
ReviewSchema.index({ candidateId: 1, createdAt: -1 });

export default mongoose.model("Review", ReviewSchema);
