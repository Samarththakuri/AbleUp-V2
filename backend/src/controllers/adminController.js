import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import CandidateProfile from "../models/CandidateProfile.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import {
  sendEmail,
  buildVerificationEmail,
  buildRejectionEmail,
} from "../utils/mailer.js";
import { fail, ok } from "../utils/apiResponse.js";
import {
  computeProfileCompletion,
  createRecruiterProfile,
} from "../services/recruiterProfileService.js";

// POST create user with default password
export const createUser = async (req, res) => {
  const { name, email, role, companyName } = req.body;

  if (role === "RECRUITER" && !companyName) {
    return fail(
      res,
      400,
      "companyName is required when creating a recruiter",
      "COMPANY_NAME_REQUIRED"
    );
  }

  const exists = await User.findOne({ email });
  if (exists) {
    return fail(res, 409, "Email already exists", "EMAIL_IN_USE");
  }

  const tempPassword = crypto.randomBytes(8).toString("base64").slice(0, 12);
  const hashed = await bcrypt.hash(tempPassword, 12);

  const user = await User.create({
    name,
    email,
    password: hashed,
    role,
    // Recruiters no longer self-verify; an admin creating one still has to
    // approve it explicitly via the verification queue.
    verificationStatus: role === "ADMIN" ? "VERIFIED" : "PENDING",
    forcePasswordChange: true,
  });

  try {
    if (role === "CANDIDATE") {
      await CandidateProfile.create({ userId: user._id });
    } else if (role === "RECRUITER") {
      await createRecruiterProfile(user._id, { companyName: companyName });
    }
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    throw err;
  }

  return ok(res, { user: { id: user._id, name, email, role }, tempPassword }, 201);
};

/**
 * Applies a verification decision to one user.
 *
 * Shared by the candidate and recruiter queues — the decision itself is
 * role-agnostic; only the side effect on RecruiterProfile.onboardingStatus
 * differs. `expectedRole` guards each queue against acting on the wrong role.
 */
const applyVerificationDecision = async (
  userId,
  status,
  reason,
  expectedRole,
) => {
  const user = await User.findById(userId);
  if (!user) return { error: "USER_NOT_FOUND" };
  if (expectedRole && user.role !== expectedRole) {
    return { error: "WRONG_ROLE" };
  }

  user.verificationStatus = status;
  user.rejectionReason = status === "REJECTED" ? reason : undefined;
  await user.save();

  // A verified recruiter's onboarding is finished; a rejected one goes back
  // to SUBMITTED so they can edit and resubmit without starting over.
  if (user.role === "RECRUITER") {
    const profile = await RecruiterProfile.findOne({ userId: user._id });
    if (profile) {
      profile.onboardingStatus = status === "VERIFIED" ? "COMPLETE" : "SUBMITTED";
      await profile.save();
    }
  }

  try {
    const { subject, html } =
      status === "VERIFIED"
        ? buildVerificationEmail(user.name)
        : buildRejectionEmail(user.name, reason || "Documents provided were insufficient.");
    sendEmail({ to: user.email, subject, html });
  } catch (emailErr) {
    console.error("[Admin] Verification email error:", emailErr);
  }

  return { user };
};

// PUT /api/admin/verify/:userId — candidate verification queue
export const verifyCandidate = async (req, res) => {
  const { status, reason } = req.body;

  const result = await applyVerificationDecision(req.params.userId, status, reason);
  if ("error" in result) {
    return fail(res, 404, "User not found", "USER_NOT_FOUND");
  }

  return ok(res, {
    user: {
      id: result.user._id,
      verificationStatus: result.user.verificationStatus,
      rejectionReason: result.user.rejectionReason,
    },
  });
};

// PUT /api/admin/recruiter/:userId/verify — recruiter verification queue
export const verifyRecruiter = async (req, res) => {
  const { status, reason } = req.body;

  const result = await applyVerificationDecision(req.params.userId, status, reason, "RECRUITER");

  if ("error" in result) {
    return result.error === "WRONG_ROLE"
      ? fail(res, 400, "That user is not a recruiter", "NOT_A_RECRUITER")
      : fail(res, 404, "User not found", "USER_NOT_FOUND");
  }

  return ok(res, {
    user: {
      id: result.user._id,
      verificationStatus: result.user.verificationStatus,
      rejectionReason: result.user.rejectionReason,
    },
  });
};

/**
 * GET /api/admin/recruiters?status=PENDING
 * Recruiter review queue: users joined with their company profile so an admin
 * can judge without a second round-trip per row.
 */
export const getRecruiters = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const filter = { role: "RECRUITER" };
  if (req.query.status) filter.verificationStatus = req.query.status;

  const [users, total] = await Promise.all([
    // No .select("-password") — the schema marks it `select: false`.
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Single batched lookup rather than one query per row.
  const profiles = await RecruiterProfile.find({
    userId: { $in: users.map((u) => u._id) },
  });
  const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

  const recruiters = users.map((u) => {
    const profile = profileMap.get(u._id.toString()) || null;
    return {
      ...u,
      profile,
      profileCompletion: profile ? computeProfileCompletion(profile).percentage : 0,
    };
  });

  return ok(res, { recruiters, meta: { page, limit, total } });
};

/**
 * POST /api/admin/recruiters/bulk-verify
 * Approves many recruiters in one action, for clearing a backlog in the
 * verification queue without opening each one.
 */
export const bulkVerifyRecruiters = async (req, res) => {
  const { userIds } = req.body;

  let verified = 0;
  const skipped = [];

  for (const userId of userIds) {
    const result = await applyVerificationDecision(userId, "VERIFIED", undefined, "RECRUITER");
    if ("error" in result) skipped.push(userId);
    else verified++;
  }

  return ok(res, { verified, skipped });
};

// GET all users (paginated)
export const getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.verificationStatus)
    filter.verificationStatus = req.query.verificationStatus;

  const [users, total] = await Promise.all([
    // No .select("-password") — the schema marks it `select: false`.
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Enrich with role-specific profile data in two batched queries rather than
  // one query per user (the previous Promise.all was an N+1).
  const candidateIds = users.filter((u) => u.role === "CANDIDATE").map((u) => u._id);
  const recruiterIds = users.filter((u) => u.role === "RECRUITER").map((u) => u._id);

  const [candidateProfiles, recruiterProfiles] = await Promise.all([
    candidateIds.length
      ? CandidateProfile.find({ userId: { $in: candidateIds } }).lean()
      : [],
    recruiterIds.length
      ? RecruiterProfile.find({ userId: { $in: recruiterIds } }).lean()
      : [],
  ]);

  const candidateMap = new Map(candidateProfiles.map((p) => [p.userId.toString(), p]));
  const recruiterMap = new Map(recruiterProfiles.map((p) => [p.userId.toString(), p]));

  const enriched = users.map((u) => {
    if (u.role === "CANDIDATE") {
      const profile = candidateMap.get(u._id.toString());
      return {
        ...u,
        udidNumber: profile?.udidNumber,
        disabilityType: profile?.disabilityType,
        disabilityPercentage: profile?.disabilityPercentage,
        // The proof an admin is supposed to be judging. Candidate verification
        // decisions were previously made with nothing attached to look at.
        verificationDocuments: profile?.verificationDocuments || [],
      };
    }
    if (u.role === "RECRUITER") {
      const profile = recruiterMap.get(u._id.toString());
      return {
        ...u,
        companyName: profile?.companyName,
        onboardingStatus: profile?.onboardingStatus,
      };
    }
    return u;
  });

  return ok(res, { users: enriched, meta: { page, limit, total } });
};

// PUT force password reset
export const forcePasswordReset = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.userId, { forcePasswordChange: true }, { new: true });
  if (!user) {
    return fail(res, 404, "User not found", "USER_NOT_FOUND");
  }
  return ok(res, { message: "User must change password on next login" });
};
