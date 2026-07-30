import Review from "../models/Review.js";
import RecruiterProfile from "../models/RecruiterProfile.js";
import Interview from "../models/Interview.js";
import Application from "../models/Application.js";

/**
 * Statuses at which an interview is considered to have gone ahead.
 *
 * Nothing in the codebase ever sets COMPLETED — scheduleInterview writes
 * SCHEDULED/RESCHEDULED and respondToInterview writes ACCEPTED/
 * RESCHEDULE_REQUESTED — so ACCEPTED is the one that fires in practice. It is
 * included for when a "mark as completed" action is added.
 */
const REVIEWABLE_STATUSES = ["ACCEPTED", "COMPLETED"];

/**
 * Single source of truth for "may this interview be reviewed yet?".
 *
 * Used both by submitReview (to authorise) and by getMyInterviews (to render
 * the `canReview` flag), so the two can never disagree.
 *
 * ACCEPTED only means the candidate confirmed the slot, so status alone would
 * let someone review an interview that has not happened yet. Requiring the
 * scheduled time to be in the past makes a review mean "I attended this".
 */
export const isInterviewReviewable = (interview, now = new Date()) => REVIEWABLE_STATUSES.includes(interview.status) &&
new Date(interview.scheduledAt).getTime() <= now.getTime();

/**
 * Owns the cached review aggregates on RecruiterProfile.
 *
 * This is the ONLY writer of `reviewCount` and `averageRating`. Previously
 * they were a side effect of the inclusivity scoring service, which meant
 * reputation data was recomputed by job and applicant handlers that had no
 * business touching it. Reviews are now the single recruiter reputation
 * signal, so they get a single, explicit owner.
 */
export const recomputeRecruiterRating = async (recruiterId) => {
  const [reviews, profile] = await Promise.all([
    Review.find({ recruiterId }).select("rating").lean(),
    RecruiterProfile.findOne({ userId: recruiterId }),
  ]);

  if (!profile) return null;

  profile.reviewCount = reviews.length;

  // Deliberately NOT guarded by `reviews.length > 0`. The old implementation
  // only assigned inside that guard, so removing the last review left the
  // stale average in place forever. Rounded to 1dp — it was stored raw before
  // (4.333333333333333) and every consumer calls .toFixed(1) anyway.
  profile.averageRating = reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  await profile.save();
  return profile;
};

/**
 * Attaches the "Verified Hire" flag to a list of reviews at read time.
 *
 * This used to be `Review.isVerifiedHire`, a boolean stored when the review was
 * written. That was wrong twice over: nothing in the app ever sets
 * `Application.status = "HIRED"`, so the stored value was permanently false;
 * and a snapshot taken at review time would never catch up with a hire that
 * happened afterwards, which is the normal order of events.
 *
 * Two batched queries regardless of list size — the same $in-and-Map shape used
 * by getMyInterviews.
 */
export const withVerifiedHireFlag = async reviews => {
  if (reviews.length === 0) return [];

  const interviews = await Interview.find({
    _id: { $in: reviews.map((r) => r.interviewId) },
  })
    .select("applicationId")
    .lean();

  const applicationByInterview = new Map(interviews.map((i) => [i._id.toString(), i.applicationId.toString()]));

  const hired = await Application.find({
    _id: { $in: [...applicationByInterview.values()] },
    status: "HIRED",
  })
    .select("_id")
    .lean();

  const hiredApplicationIds = new Set(hired.map((a) => a._id.toString()));

  return reviews.map((review) => {
    const applicationId = applicationByInterview.get(String(review.interviewId));
    return {
      ...review,
      isVerifiedHire: !!applicationId && hiredApplicationIds.has(applicationId),
    };
  });
};
