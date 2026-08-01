import { Schema } from "mongoose";
import { VERIFICATION_DOC_TYPES } from "../constants/index.js";

export const VerificationDocumentSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    docType: {
      type: String,
      required: true,
      enum: [...VERIFICATION_DOC_TYPES],
    },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);
