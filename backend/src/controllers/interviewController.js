import Interview from "../models/Interview.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import Review from "../models/Review.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import { isInterviewReviewable } from "../services/reviewService.js";
import { sendEmail, buildInterviewScheduledEmail, buildInterviewRescheduleRequestEmail, buildInterviewAcceptedEmail } from "../utils/mailer.js";

/**
 * The scheduled/rescheduled notification, sent from both branches of
 * scheduleInterview. Reads duration and mode off the saved document rather than
 * re-deriving the defaults, so the email always states what was actually stored.
 */
const notifyCandidateOfSchedule = async (candidateId, jobTitle, interview) => {
  try {
    const candidate = await User.findById(candidateId).select("name email").lean();
    if (!candidate?.email) return;

    const { subject, html } = buildInterviewScheduledEmail(
      candidate.name,
      jobTitle,
      interview.scheduledAt,
      interview.duration,
      interview.mode,
      interview.location
    );
    sendEmail({ to: candidate.email, subject, html }); // fire-and-forget
  } catch (e) {
    console.error("[Interview] Email error:", e);
  }
};

/**
 * Role is gated by requireRole("RECRUITER") and the body is validated by
 * validate(scheduleInterviewSchema), both in routes/interview.js. `duration`
 * and `mode` are left undefined when absent so the schema's own defaults apply
 * — the controller used to carry its own `|| 30` / `|| "ONLINE"` copies in two
 * places, which is two more places to forget when a default changes.
 */
export const scheduleInterview = async (req, res) => {
  const { applicationId, scheduledAt, duration, mode, location, notes } =
    req.body;

  const application = await Application.findById(applicationId);
  if (!application) {
    res.status(404).json({ message: "Application not found" });
    return;
  }
  if (application.status !== "SHORTLISTED") {
    res.status(400).json({ message: "Can only schedule interviews for shortlisted candidates" });
    return;
  }

  const job = await Job.findById(application.jobId);
  if (!job || job.recruiterId.toString() !== req.user._id.toString()) {
    res.status(403).json({ message: "Not authorized" });
    return;
  }

  // Check if interview already exists
  const existing = await Interview.findOne({ applicationId });
  if (existing) {
    // Update existing interview (reschedule). No manual updatedAt — the schema
    // maintains it now.
    existing.scheduledAt = scheduledAt;
    if (duration !== undefined) existing.duration = duration;
    if (mode !== undefined) existing.mode = mode;
    existing.location = location;
    existing.notes = notes;
    existing.status = existing.status === "RESCHEDULE_REQUESTED" ? "RESCHEDULED" : "SCHEDULED";
    await existing.save();

    await notifyCandidateOfSchedule(application.candidateId, job.title, existing);

    res.json({ success: true, interview: existing });
    return;
  }

  const interview = await Interview.create({
    applicationId,
    jobId: application.jobId,
    candidateId: application.candidateId,
    recruiterId: req.user._id,
    scheduledAt,
    duration,
    mode,
    location,
    notes,
  });

  await notifyCandidateOfSchedule(application.candidateId, job.title, interview);

  res.status(201).json({ success: true, interview });
};

/**
 * Role gated by requireRole("CANDIDATE"), body by
 * validate(respondToInterviewSchema) — both in routes/interview.js.
 */
export const respondToInterview = async (req, res) => {
  const { action, message } = req.body;
  const interview = await Interview.findById(req.params.interviewId);
  if (!interview) {
    res.status(404).json({ message: "Interview not found" });
    return;
  }
  if (interview.candidateId.toString() !== req.user._id.toString()) {
    res.status(403).json({ message: "Not authorized" });
    return;
  }

  if (action === "accept") {
    interview.status = "ACCEPTED";
  } else {
    interview.status = "RESCHEDULE_REQUESTED";
    interview.candidateMessage = message || "Requesting a different time slot";
  }

  // No manual updatedAt — the schema maintains it.
  await interview.save();

  // Notify recruiter. Three independent reads, previously awaited one after
  // another.
  try {
    const [recruiter, candidate, job] = await Promise.all([
      User.findById(interview.recruiterId).select("name email").lean(),
      User.findById(interview.candidateId).select("name").lean(),
      Job.findById(interview.jobId).select("title").lean(),
    ]);
    if (recruiter?.email && candidate && job) {
      if (action === "accept") {
        const { subject, html } = buildInterviewAcceptedEmail(recruiter.name, candidate.name, job.title, interview.scheduledAt);
        sendEmail({ to: recruiter.email, subject, html });
      } else if (action === "reschedule") {
        const { subject, html } = buildInterviewRescheduleRequestEmail(
          recruiter.name,
          candidate.name,
          job.title,
          message || "Requesting a different time slot"
        );
        sendEmail({ to: recruiter.email, subject, html });
      }
    }
  } catch (e) { console.error("[Interview] Email error:", e); }

  res.json({ success: true, interview });
};

export const getMyInterviews = async (req, res) => {
  const isCandidate = req.user.role === "CANDIDATE";
  const filter = isCandidate
    ? { candidateId: req.user._id }
    : { recruiterId: req.user._id };

  const interviews = await Interview.find(filter)
    .populate("jobId", "title location")
    .populate("candidateId", "name email")
    .populate("recruiterId", "name")
    .populate("applicationId", "status")
    .sort({ scheduledAt: 1 });

  if (!isCandidate) {
    res.json({ success: true, interviews });
    return;
  }

  // Candidates get the extra fields the review flow needs: which company they
  // met, whether they already reviewed it, and whether they may review it yet.
  // Two batched queries regardless of interview count — no N+1.
  const recruiterIds = [
    ...new Set(interviews
      .map((i) => i.recruiterId?._id?.toString() || i.recruiterId?.toString())
      .filter(Boolean)),
  ];

  const [profiles, reviews] = await Promise.all([
    RecruiterProfile.find({ userId: { $in: recruiterIds } })
      .select("userId companyName companyLogo")
      .lean(),
    Review.find({ interviewId: { $in: interviews.map((i) => i._id) } })
      .select("interviewId")
      .lean(),
  ]);

  const companyByRecruiter = new Map(profiles.map((p) => [p.userId.toString(), p]));
  const reviewedInterviews = new Set(reviews.map((r) => r.interviewId.toString()));

  const now = new Date();
  const result = interviews.map((interview) => {
    const recruiterId =
      interview.recruiterId?._id?.toString() || interview.recruiterId?.toString();
    const company = recruiterId ? companyByRecruiter.get(recruiterId) : null;
    const hasReviewed = reviewedInterviews.has(interview._id.toString());

    return {
      ...interview.toObject(),
      companyName: company?.companyName || interview.recruiterId?.name || null,
      companyLogo: company?.companyLogo || null,
      hasReviewed,
      // Computed server-side so the eligibility rule lives in exactly one
      // place — isInterviewReviewable — rather than being duplicated in the UI.
      canReview: !hasReviewed && isInterviewReviewable(interview, now),
    };
  });

  res.json({ success: true, interviews: result });
};

export const getApplicationInterview = async (req, res) => {
  // Scoped to the caller. This looked up an interview by application id with no
  // ownership check at all, so any authenticated user could read the schedule,
  // notes and meeting link of any interview by guessing an application id.
  const userId = req.user._id;
  const interview = await Interview.findOne({
    applicationId: req.params.applicationId,
    $or: [{ candidateId: userId }, { recruiterId: userId }],
  });

  res.json({ success: true, interview: interview || null });
};
