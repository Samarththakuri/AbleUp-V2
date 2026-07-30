import { Schema } from "mongoose";
import { VERIFICATION_DOC_TYPES } from "../constants/index.js";

/**
 * Proof uploaded for admin verification, embedded by both RecruiterProfile and
 * CandidateProfile.
 *
 * It lived inside RecruiterProfile.js before, which is why candidate UDID proof
 * was modelled as a single loose `udidDocumentUrl: String` with no doc type and
 * no upload timestamp — the two halves of the same feature had two different
 * shapes. `docType` was a free-form required string; it is an enum now.
 *
 * `_id: false` is deliberate: these are value objects addressed by url, not
 * entities. Removal is by url or index, never by subdocument id.
 */
export const VerificationDocumentSchema = new Schema({
  url: { type: String, required: true, trim: true },
  docType: { type: String, required: true, enum: [...VERIFICATION_DOC_TYPES] },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });
