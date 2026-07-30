import { z } from "zod";
import {
  COMPANY_ACCESSIBILITY_FACILITIES,
  COMPANY_SIZES,
  INDUSTRIES,
  RECRUITER_DOC_TYPES,
} from "../constants/index.js";

/** Accepts "acme.com" as well as "https://acme.com". */
const urlish = z
  .string()
  .trim()
  .max(300)
  .refine(
  (v) => v === "" || /^([a-z][a-z0-9+.-]*:\/\/)?[\w-]+(\.[\w-]+)+.*$/i.test(v),
  { message: "Must be a valid URL" }
)
  .transform((v) => {
    if (!v) return v;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
  });

const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s()-]{6,19}$/, "Must be a valid contact number");

export const companyNameSchema = z
  .string()
  .trim()
  .min(2, "Company name must be at least 2 characters")
  .max(150);

/**
 * Editable company fields. Every key is optional (PUT accepts partials), but
 * unknown keys are stripped by Zod — this is what keeps server-owned review
 * aggregates (averageRating, reviewCount) out of client reach.
 */
export const updateRecruiterProfileSchema = z
  .object({
    companyName: companyNameSchema,
    website: urlish,
    companyEmail: z.string().trim().email("Must be a valid email").max(255),
    linkedin: urlish,
    // INDUSTRIES existed in constants/company.js and was mirrored in the
    // frontend's dropdown, but neither this DTO nor the schema was wired to it —
    // so the one list the UI offers was not the one the API enforced.
    industry: z.enum(INDUSTRIES),
    companySize: z.enum(COMPANY_SIZES),
    companyDescription: z.string().trim().max(3000),
    foundedYear: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear()),
    mission: z.string().trim().max(1000),
    vision: z.string().trim().max(1000),

    hrContactPerson: z.string().trim().min(2).max(100),
    hrContactNumber: phone,

    companyAddress: z.string().trim().max(300),
    city: z.string().trim().max(100),
    state: z.string().trim().max(100),
    country: z.string().trim().max(100),

    gstNumber: z.string().trim().max(20),

    accessibilityFacilities: z
      .array(z.enum(COMPANY_ACCESSIBILITY_FACILITIES))
      .max(COMPANY_ACCESSIBILITY_FACILITIES.length),
  })
  .partial()
  .strip();

export const updateAccessibilitySchema = z.object({
  accessibilityFacilities: z
    .array(z.enum(COMPANY_ACCESSIBILITY_FACILITIES))
    .max(COMPANY_ACCESSIBILITY_FACILITIES.length),
});

/** Body accompanying a multipart verification-document upload. */
export const recruiterVerificationDocSchema = z.object({
  docType: z.enum([...RECRUITER_DOC_TYPES, "Other"]),
});
