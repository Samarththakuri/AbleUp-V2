import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

/**
 * Note what is NOT here: `recruiterId`.
 *
 * The previous implementation accepted it from the request body and never
 * checked it against the interview, so a candidate could attach a review to
 * any recruiter. It is now derived from the verified interview server-side,
 * which removes the forgeable input entirely rather than validating it.
 */
export const submitReviewSchema = z.object({
  interviewId: objectId,
  rating: z.coerce
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  comment: z
    .string()
    .trim()
    .min(10, "Please write at least 10 characters")
    .max(2000),
});
