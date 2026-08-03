import { z } from "zod";
import { companyNameSchema } from "./recruiterValidators.js";
import { DISABILITY_TYPES } from "../constants/index.js";

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128);

const baseAccount = {
  name: z.string().trim().min(2, "Name is required").max(100),
  email: emailSchema,
  password: passwordSchema,
};

//since we use user schema as base for recruiter and candidate there a discrimate union
//this validates against the role schema
export const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("CANDIDATE"),
    ...baseAccount,
    // Matches the CandidateProfile.disabilityType enum — a free string here
    // produced a 500 from the schema rather than a 400 from the DTO.
    disabilityType: z.enum(DISABILITY_TYPES).optional(),
    udidNumber: z.string().trim().max(50).optional(),
  }),
  z.object({
    role: z.literal("RECRUITER"),
    ...baseAccount,
    companyName: companyNameSchema,
  }),
]);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});

/**
 * These two routes carried no validate() at all, so `email` reached
 * `User.findOne({ email })` exactly as typed. Combined with a schema that did
 * not normalise either, a reset requested for `Alice@x.com` matched nothing and
 * returned the anti-enumeration success message — a reset link that never
 * arrived, with no error anywhere to explain why.
 */
export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
  password: passwordSchema,
});

/** Replaces the hand-rolled length check inside changePassword. */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete account"),
});
