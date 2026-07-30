import {
  uploadResume,
  uploadVerificationDoc,
  verificationDocPublicPath,
} from "../middleware/upload.js";
import Application from "../models/Application.js";
import CandidateProfile from "../models/CandidateProfile.js";
import Job from "../models/Job.js";
import { sendEmail, buildApplyConfirmationEmail } from "../utils/mailer.js";
import { incrementApplicantsCount } from "../services/cascadeService.js";
import { unlinkVerificationFile } from "./documentController.js";
import { verificationDocSchema } from "../validators/candidateValidators.js";

export const getAppliedJobs = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    Application.find({ candidateId: req.user._id })
      .populate("jobId", "title location remote salaryMin salaryMax isActive")
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments({ candidateId: req.user._id }),
  ]);

  res.json({ success: true, applications, meta: { page, limit, total } });
};

export const getSavedJobs = async (req, res) => {
  const profile = await CandidateProfile.findOne({
    userId: req.user._id,
  }).populate(
    "savedJobs",
    "title location remote salaryMin salaryMax isActive recruiterId"
  );
  res.json({ success: true, savedJobs: profile?.savedJobs || [] });
};

export const toggleSaveJob = async (req, res) => {
  const { jobId } = req.params;
  const job = await Job.findById(jobId);
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  const profile = await CandidateProfile.findOne({ userId: req.user._id });
  if (!profile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  const idx = profile.savedJobs.findIndex((id) => id.toString() === jobId);
  if (idx > -1) {
    profile.savedJobs.splice(idx, 1);
    await profile.save();
    res.json({ success: true, saved: false });
  } else {
    profile.savedJobs.push(job._id);
    await profile.save();
    res.json({ success: true, saved: true });
  }
};

export const applyToJob = (req, res) => {
  uploadResume(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        res.status(400).json({ message: uploadErr.message });
        return;
      }

      // Verification is enforced by requireVerifiedCandidate on the route.
      const { jobId } = req.params;
      const job = await Job.findById(jobId);
      if (!job || !job.isActive) {
        res.status(404).json({ message: "Job not found or inactive" });
        return;
      }

      const existing = await Application.findOne({
        jobId,
        candidateId: req.user._id,
      });
      if (existing) {
        res.status(409).json({ message: "Already applied" });
        return;
      }

      let resumeUrl = req.body.resumeUrl;
      if (req.file) {
        resumeUrl = `/uploads/resumes/${req.file.filename}`;
      }
      if (!resumeUrl) {
        const profile = await CandidateProfile.findOne({
          userId: req.user._id,
        });
        resumeUrl = profile?.resumeUrl;
      }

      const application = await Application.create({
        jobId,
        candidateId: req.user._id,
        coverLetter: req.body.coverLetter,
        resumeUrl,
      });

      // Through cascadeService, which owns this counter in both directions —
      // the increment used to live here with no matching decrement anywhere.
      await incrementApplicantsCount(jobId);

      // Trigger Apply Confirmation Email
      try {
        const { subject, html } = buildApplyConfirmationEmail(req.user.name, job.title);
        sendEmail({ to: req.user.email, subject, html });
      } catch (emailErr) {
        console.error("[Candidate] Apply confirmation email error:", emailErr);
      }

      res.status(201).json({ success: true, application });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      res
        .status(statusCode)
        .json({ message: "Server error", error: err.message });
    }
  });
};

export const uploadCandidateResume = (req, res) => {
  uploadResume(req, res, async (err) => {
    try {
      if (err) {
        res.status(400).json({ message: err.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const resumeUrl = `/uploads/resumes/${req.file.filename}`;
      await CandidateProfile.findOneAndUpdate({ userId: req.user._id }, { resumeUrl }, { upsert: true });
      res.json({ success: true, resumeUrl });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });
};

export const getProfile = async (req, res) => {
  const profile = await CandidateProfile.findOne({ userId: req.user._id });
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      verificationStatus: req.user.verificationStatus,
    },
    profile: profile || {},
  });
};

/**
 * Body is validated and whitelisted by validate(updateCandidateProfileSchema)
 * in routes/candidate.js. The handler used to pick four fields off an
 * unvalidated body by hand, which is why `disabilityPercentage` and the contact
 * fields were stored on the model but unreachable from the API.
 */
export const updateProfile = async (req, res) => {
  const { name, ...profileFields } = req.body;

  if (name) {
    req.user.name = name;
    await req.user.save();
  }

  const profile = await CandidateProfile.findOneAndUpdate(
    { userId: req.user._id },
    profileFields,
    { new: true, upsert: true, runValidators: true }
  );

  res.json({ success: true, profile });
};

/**
 * Attaches a verification document (UDID card, disability certificate) to the
 * candidate's profile.
 *
 * `CandidateProfile.verificationDocuments` — and the recruiter equivalent — had
 * no writer at all, so the admin verification queues showed a decision to make
 * and nothing to base it on.
 */
export const uploadCandidateVerificationDoc = (req, res) => {
  uploadVerificationDoc(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        res.status(400).json({ message: uploadErr.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      // Validated here rather than by middleware: the field arrives as
      // multipart, so it does not exist until multer has parsed the request.
      const parsed = verificationDocSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "Validation error",
          code: "VALIDATION_ERROR",
          errors: parsed.error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }

      const profile = await CandidateProfile.findOneAndUpdate({ userId: req.user._id }, {
        $push: {
          verificationDocuments: {
            url: verificationDocPublicPath(req.file.filename),
            docType: parsed.data.docType,
          },
        },
      }, { new: true, upsert: true, runValidators: true });

      res.status(201).json({
        success: true,
        verificationDocuments: profile?.verificationDocuments || [],
      });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  });
};

/**
 * DELETE /api/candidate/verification-document
 *
 * `$pull` is scoped by `userId` as well as `url`, so a candidate can only ever
 * detach a document from their own profile even if they know someone else's URL.
 */
export const deleteCandidateVerificationDoc = async (req, res) => {
  const { url } = req.body;

  const profile = await CandidateProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $pull: { verificationDocuments: { url } } },
    { new: true }
  );

  if (!profile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  // Only unbind the file once the reference is definitely gone.
  await unlinkVerificationFile(url);

  res.json({ success: true, verificationDocuments: profile.verificationDocuments });
};
