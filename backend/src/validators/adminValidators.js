import { z } from "zod";

export const verifyUserSchema = z
  .object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.status !== "REJECTED" || !!d.reason, {
    message: "A reason is required when rejecting",
    path: ["reason"],
  });

export const bulkVerifySchema = z.object({
  userIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id")).min(1).max(200),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(["CANDIDATE", "RECRUITER", "ADMIN"]),
  companyName: z.string().trim().min(2).max(150).optional(),
});
