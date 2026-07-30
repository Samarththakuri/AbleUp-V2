import { z } from "zod";

/**
 * Whitelists the fields a recruiter may set on a job.
 *
 * Previously createJob did `Job.create({ ...req.body, recruiterId })` and
 * updateJob did `findByIdAndUpdate(jobId, req.body)`, which let a client set
 * server-owned fields such as applicantsCount, isActive and recruiterId.
 * Zod's default strip behaviour removes anything not listed here.
 */
const jobFields = {
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(10000),
  salaryMin: z.coerce.number().int().min(0).max(100_000_000).optional(),
  salaryMax: z.coerce.number().int().min(0).max(100_000_000).optional(),
  workHours: z.string().trim().max(100).optional(),
  location: z.string().trim().max(150).optional(),
  remote: z.coerce.boolean().optional(),
  disabilityEligible: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  requiredSkills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),

  // Job-specific accessibility. Company-wide facilities live on the
  // RecruiterProfile; a job may declare additional or overlapping ones.
  accessibilityFeatures: z
    .array(z.string().trim().min(1).max(120))
    .min(1, "Specify at least one accessibility feature for this job")
    .max(30),
};

const salaryRangeIsValid = (data) =>
  data.salaryMin === undefined ||
  data.salaryMax === undefined ||
  data.salaryMax === 0 ||
  data.salaryMax >= data.salaryMin;

export const createJobSchema = z
  .object(jobFields)
  .strip()
  .refine(salaryRangeIsValid, {
    message: "Maximum salary must be greater than or equal to minimum salary",
    path: ["salaryMax"],
  });

/**
 * Partial for PATCH-like updates, but accessibilityFeatures keeps its
 * non-empty rule when present — updateJob previously skipped that check
 * entirely, letting a recruiter strip accessibility data after posting.
 */
export const updateJobSchema = z
  .object({ ...jobFields, isActive: z.coerce.boolean().optional() })
  .partial()
  .strip()
  .refine(salaryRangeIsValid, {
    message: "Maximum salary must be greater than or equal to minimum salary",
    path: ["salaryMax"],
  });
