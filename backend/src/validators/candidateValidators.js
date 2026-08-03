import { z } from "zod";
import {
  CANDIDATE_DOC_TYPES,
  DISABILITY_TYPES,
  WORK_HOUR_OPTIONS,
} from "../constants/index.js";

/**
 * PUT /api/candidate/profile had no validate() at all — `skills` accepted any
 * JSON the client sent and Mongoose cast whatever came through, and three
 * schema fields (`disabilityPercentage`, the UDID document, contact details)
 * had no path that could reach them from the API in the first place.
 *
 * Enum bounds mirror the CandidateProfile schema so a bad value is a 400 from
 * here rather than a ValidationError from Mongo.
 */
/**
 * The profile form posts every field it holds, including the ones the user has
 * not filled in yet, so "" arrives for an unset enum. Treating it as "absent"
 * rather than "invalid" is what the old unvalidated handler effectively did.
 */
const optionalEnum = (values) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.enum(values).optional());
//this preprocessor runs before validation and if the values recived is empty then subistuite it with undefined taki error na aaye
export const updateCandidateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),

    disabilityType: optionalEnum(DISABILITY_TYPES),
    disabilityPercentage: z.number().int().min(0).max(100).optional(),
    udidNumber: z.string().trim().max(50).optional(),

    phone: z.string().trim().max(20).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),

    preferredWorkHours: optionalEnum(WORK_HOUR_OPTIONS),
    skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  })
  .strict();
//the array z function validates each item in the array
/** Body accompanying a multipart verification-document upload. */
export const verificationDocSchema = z.object({
  docType: z.enum([...CANDIDATE_DOC_TYPES, "Other"]),
});

/**
 * Shared by both roles' delete endpoints. The pattern pins the URL to the
 * documents route so an arbitrary path can never reach the unlink helper.
 */
export const deleteVerificationDocSchema = z.object({
  url: z
    .string()
    .trim()
    .regex(/^\/api\/documents\/[A-Za-z0-9._-]+$/, "Not a document URL"),
});
