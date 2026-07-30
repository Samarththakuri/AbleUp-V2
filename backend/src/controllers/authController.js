import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import CandidateProfile from "../models/CandidateProfile.js";
import { sendEmail, buildAccountDeletedEmail, buildWelcomeEmail, buildForgotPasswordEmail } from "../utils/mailer.js";
import { env } from "../config/env.js";
import { fail, ok } from "../utils/apiResponse.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import {
  buildProfileSummary,
  createRecruiterProfile,
} from "../services/recruiterProfileService.js";
import { deleteUserCascade } from "../services/cascadeService.js";

/**
 * This controller is responsible for authentication only. Role-specific
 * profile documents are created by their own services — see
 * services/recruiterProfileService. Request bodies are validated by the
 * validate() middleware in routes/auth.js, so `req.body` is already a
 * parsed, whitelisted DTO here.
 */

const signToken = (user) =>
  jwt.sign({ id: user._id }, env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

/** Shared shape returned by register/login/me so the client sees one contract. */
const toAuthUser = (
  user,
  extras = {},
) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  verificationStatus: user.verificationStatus,
  rejectionReason: user.rejectionReason,
  forcePasswordChange: user.forcePasswordChange,
  ...extras,
});

/** Loads the role-specific profile data attached to an auth response. */
const loadRoleExtras = async user => {
  if (user.role === "CANDIDATE") {
    const profile = await CandidateProfile.findOne({ userId: user._id });
    return {
      disabilityType: profile?.disabilityType,
      udidNumber: profile?.udidNumber,
    };
  }

  if (user.role === "RECRUITER") {
    // Created alongside the User at registration. buildProfileSummary returns
    // null if it is somehow absent — the recruiter endpoints 404 on that.
    const profile = await RecruiterProfile.findOne({ userId: user._id });
    return { recruiterProfile: buildProfileSummary(profile) };
  }

  return {};
};

export const register = async (req, res) => {
  const data = req.body;

  const exists = await User.findOne({ email: data.email });
  if (exists) {
    return fail(res, 409, "Email already registered", "EMAIL_IN_USE");
  }

  const hashed = await bcrypt.hash(data.password, 12);

  // Both roles now start PENDING. Recruiters are no longer self-verifying —
  // only an admin can move them to VERIFIED (spec §2).
  const user = await User.create({
    name: data.name,
    email: data.email,
    password: hashed,
    role: data.role,
    verificationStatus: "PENDING",
  });

  // Registration must produce User + role profile atomically. There is no
  // replica set here, so a failed profile create is compensated by deleting
  // the user rather than leaving an account that can never be onboarded.
  try {
    if (data.role === "CANDIDATE") {
      await CandidateProfile.create({
        userId: user._id,
        disabilityType: data.disabilityType,
        udidNumber: data.udidNumber,
      });
    } else {
      await createRecruiterProfile(user._id, {
        companyName: data.companyName,
      });
    }
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    throw err;
  }

  try {
    const { subject, html } = buildWelcomeEmail(user.name);
    sendEmail({ to: user.email, subject, html });
  } catch (emailErr) {
    console.error("[Auth] Welcome email error:", emailErr);
  }

  const extras = await loadRoleExtras(user);

  return ok(res, { token: signToken(user), user: toAuthUser(user, extras) }, 201);
};

export const login = async (req, res) => {
  const data = req.body;
  const isAdminAttempt =
    data.email.toLowerCase().includes("admin") || req.body.isAdminLogin;

  // `password` is `select: false` on the schema, so the compare below needs an
  // explicit opt-in. Every other read of a User now excludes it by default.
  const user = await User.findOne({ email: data.email }).select("+password");
  if (!user) {
    if (isAdminAttempt || req.body.role === "admin") {
      return fail(res, 401, "Invalid admin credentials.", "INVALID_ADMIN");
    }
    return fail(
      res,
      404,
      "No account found with this email. You are a new user. Kindly register first.",
      "USER_NOT_FOUND"
    );
  }

  const valid = await bcrypt.compare(data.password, user.password);
  if (!valid) {
    if (user.role === "ADMIN") {
      return fail(res, 401, "Invalid admin credentials.", "INVALID_ADMIN");
    }
    return fail(res, 401, "Incorrect password. Please try again.", "INVALID_PASSWORD");
  }

  const extras = await loadRoleExtras(user);

  return ok(res, { token: signToken(user), user: toAuthUser(user, extras) });
};

/**
 * GET /api/auth/me — lets the client refresh its cached user after onboarding
 * or after an admin verifies the account, without forcing a re-login.
 */
export const getMe = async (req, res) => {
  const user = req.user;
  const extras = await loadRoleExtras(user);
  return ok(res, { user: toAuthUser(user, extras) });
};

export const deleteAccount = async (req, res) => {
  const userId = req.user._id;
  // Validated by validate(deleteAccountSchema) in routes/auth.js.
  const { password } = req.body;

  const user = await User.findById(userId).select("+password");
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ message: "Incorrect password" });
    return;
  }

  // The role-aware teardown lives in cascadeService so account deletion and job
  // deletion cannot drift apart. It also removes the Review documents this
  // handler used to leave orphaned, and fixes the applicant counters the
  // deleted applications were part of.
  await deleteUserCascade(user);

  const userEmail = user.email;
  const userName = user.name;
  await User.findByIdAndDelete(userId);

  try {
    const { subject, html } = buildAccountDeletedEmail(userName);
    sendEmail({ to: userEmail, subject, html });
  } catch (emailErr) {
    console.error("[Auth] Deletion email error:", emailErr);
  }

  res.json({ success: true, message: "Account deleted successfully" });
};

export const changePassword = async (req, res) => {
  // Validated by validate(changePasswordSchema) in routes/auth.js — the length
  // rule lived here as well as in the DTO, in two different places.
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) {
    res.status(401).json({ message: "Current password is incorrect" });
    return;
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.forcePasswordChange = false;
  await user.save();

  res.json({ success: true, message: "Password changed" });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    // Return success even if user not found to prevent enumeration
    res.json(
      { success: true, message: "If an account exists, a reset link has been sent." }
    );
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;
  
  try {
    const { subject, html } = buildForgotPasswordEmail(user.name, resetLink);
    sendEmail({ to: user.email, subject, html });
  } catch (err) {
    console.error("[Auth] Forgot password email error:", err);
  }

  res.json(
    { success: true, message: "If an account exists, a reset link has been sent." }
  );
};

export const resetPassword = async (req, res) => {
  // Validated by validate(resetPasswordSchema) in routes/auth.js.
  const { token, password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400).json({ message: "Invalid or expired reset token" });
    return;
  }

  user.password = await bcrypt.hash(password, 12);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.forcePasswordChange = false;
  await user.save();

  res.json({ success: true, message: "Password has been reset. You can now login." });
};

export const verifyEmail = async (req, res) => {
  const { token } = req.params;
  const user = await User.findOne({ emailVerificationToken: token });

  if (!user) {
    res.status(400).json({ message: "Invalid verification token" });
    return;
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();

  res.json({ success: true, message: "Email verified successfully" });
};
