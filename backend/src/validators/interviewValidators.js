import { z } from "zod";

/**
 * The interview routes had no validators at all — every check was hand-rolled
 * in the controller. `applicationId` was never checked for ObjectId shape, so a
 * malformed one reached Interview.findById and surfaced as a 500 rather than a
 * 400, and an out-of-enum `mode` did the same via Mongoose.
 *
 * Bounds mirror models/Interview.js.
 */
const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

export const scheduleInterviewSchema = z.object({
  applicationId: objectId,
  scheduledAt: z.coerce.date(),
  duration: z.number().int().min(15).max(480).optional(),
  mode: z.enum(["ONLINE", "IN_PERSON", "PHONE"]).optional(),
  location: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const respondToInterviewSchema = z.object({
  // Was compared against string literals inside the handler.
  action: z.enum(["accept", "reschedule"]),
  message: z.string().trim().max(1000).optional(),
});
