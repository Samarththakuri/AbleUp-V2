import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { COMPANY_SIZES } from "@/constants/company";

/**
 * Client-side mirror of backend/src/validators/recruiterValidators.js.
 * The server remains the authority — this exists to give inline feedback
 * before a round-trip, not to replace validation.
 */
const urlish = z
  .string()
  .trim()
  .refine(
  (v) => v === "" || /^([a-z][a-z0-9+.-]*:\/\/)?[\w-]+(\.[\w-]+)+.*$/i.test(v),
  {
      message: "Enter a valid URL",
    }
);

export const companyProfileSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(150),
  industry: z.string().trim().min(2, "Select an industry"),
  companySize: z.enum(COMPANY_SIZES, { errorMap: () => ({ message: "Select a company size" }) }),
  companyDescription: z
    .string()
    .trim()
    .min(30, "Describe your company in at least 30 characters")
    .max(3000),
  hrContactPerson: z.string().trim().min(2, "Enter the HR contact person"),
  hrContactNumber: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s()-]{6,19}$/, "Enter a valid contact number"),
  website: urlish.optional().or(z.literal("")),
  linkedin: urlish.optional().or(z.literal("")),
  companyEmail: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  foundedYear: z
    .number()
    .int()
    .min(1800, "Enter a valid year")
    .max(new Date().getFullYear(), "Year cannot be in the future")
    .optional(),
});

/** Validates a subset of keys and returns per-field messages. */
export const validateCompanyFields = (values, keys) => {
  const errors = {};
  const shape = companyProfileSchema.shape;

  for (const key of keys) {
    const fieldSchema = shape[key];
    if (!fieldSchema) continue;

    const raw = (values)[key];
    // Skip untouched optional fields rather than reporting "required".
    if ((raw === undefined || raw === "") && fieldSchema.isOptional()) continue;

    const result = fieldSchema.safeParse(raw ?? "");
    if (!result.success) errors[key] = result.error.errors[0]?.message;
  }

  return errors;
};

/** Fields the API accepts on PUT /recruiter/profile. */
const EDITABLE_KEYS = [
  "companyName",
  "website",
  "companyEmail",
  "linkedin",
  "industry",
  "companySize",
  "companyDescription",
  "foundedYear",
  "mission",
  "vision",
  "hrContactPerson",
  "hrContactNumber",
  "companyAddress",
  "city",
  "state",
  "country",
  "gstNumber",
];

/** Strips derived/server-owned fields and empty strings before sending. */
export const toUpdatePayload = (values) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    const value = values[key];
    if (value === undefined || value === null || value === "") continue;
    payload[key] = value;
  }
  return payload;
};

/**
 * Owns loading and mutating the recruiter's own company profile.
 * Shared by the onboarding wizard and the profile page so both stay in sync
 * with the server-computed completion percentage.
 */
export const useRecruiterProfile = () => {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  /**
   * updateUser is read through a ref so this hook's request volume cannot
   * depend on AuthContext's memoisation. applyResponse -> load -> the mount
   * effect below is a dependency chain: when updateUser had an unstable
   * identity, every load re-created it and re-fired the effect, turning the
   * initial fetch into an unbounded GET /recruiter/profile loop. AuthContext
   * is fixed, but the failure mode is a request flood and the way to re-arm it
   * is a one-line edit in another file, so the chain is broken here too.
   */
  const updateUserRef = useRef(updateUser);
  useEffect(() => {
    updateUserRef.current = updateUser;
  });

  /** Keeps the cached auth user's recruiter summary aligned after a mutation. */
  const applyResponse = useCallback((res) => {
    setProfile(res.profile);
    setCompletion(res.profileCompletion);
    setVerificationStatus(res.verificationStatus);
    updateUserRef.current({
      recruiterProfile: {
        companyName: res.profile.companyName,
        companyLogo: res.profile.companyLogo,
        onboardingStatus: res.profile.onboardingStatus,
        profileCompletion: res.profileCompletion.percentage,
      },
    });
    return res;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api("/recruiter/profile");
      applyResponse(res);
    } catch (err) {
      setLoadError(err?.message || "Could not load your company profile");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (values) => {
    setSaving(true);
    try {
      const res = await api("/recruiter/profile", {
        method: "PUT",
        body: toUpdatePayload(values),
      });
      return applyResponse(res);
    } finally {
      setSaving(false);
    }
  }, [applyResponse]);

  const saveAccessibility = useCallback(async (accessibilityFacilities) => {
    setSaving(true);
    try {
      const res = await api(
        "/recruiter/profile/accessibility",
        { method: "PATCH", body: { accessibilityFacilities } }
      );
      return applyResponse(res);
    } finally {
      setSaving(false);
    }
  }, [applyResponse]);

  const submitForVerification = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api("/recruiter/profile/submit", {
        method: "POST",
      });
      return applyResponse(res);
    } finally {
      setSaving(false);
    }
  }, [applyResponse]);

  return {
    profile,
    completion,
    verificationStatus,
    loading,
    saving,
    loadError,
    reload: load,
    save,
    saveAccessibility,
    submitForVerification,
    applyResponse,
  };
};
