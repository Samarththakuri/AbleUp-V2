import mongoose from "mongoose";
import Review from "../models/Review.js";
import Interview from "../models/Interview.js";
import { fail, ok } from "../utils/apiResponse.js";
import {
  isInterviewReviewable,
  recomputeRecruiterRating,
  withVerifiedHireFlag,
} from "../services/reviewService.js";

/**
 * Candidate → recruiter reviews, the platform's only recruiter reputation
 * signal. Body is validated by validate(submitReviewSchema) on the route.
 */

// POST /api/reviews/submit
export const submitReview = async (req, res) => {
  const { interviewId, rating, comment } = req.body;

  // Ownership: the interview must belong to the calling candidate.
  const interview = await Interview.findOne({
    _id: interviewId,
    candidateId: req.user._id,
  });

  if (!interview) {
    return fail(
      res,
      403,
      "You can only review recruiters you have interviewed with.",
      "INTERVIEW_NOT_FOUND"
    );
  }

  if (!isInterviewReviewable(interview)) {
    return fail(
      res,
      403,
      "You can leave a review once the interview has taken place.",
      "INTERVIEW_NOT_REVIEWABLE"
    );
  }

  const existing = await Review.findOne({ interviewId });
  if (existing) {
    return fail(res, 409, "You have already reviewed this interview.", "ALREADY_REVIEWED");
  }

  let review;
  try {
    review = await Review.create({
      candidateId: req.user._id,
      // Derived from the verified interview, never from the request body —
      // accepting it from the client allowed a candidate to plant a review on
      // a recruiter they had never met.
      recruiterId: interview.recruiterId,
      interviewId: interview._id,
      rating,
      comment,
    });
  } catch (err) {
    // Unique index on interviewId — a concurrent double-submit lands here.
    if (err?.code === 11000) {
      return fail(res, 409, "You have already reviewed this interview.", "ALREADY_REVIEWED");
    }
    throw err;
  }

  await recomputeRecruiterRating(interview.recruiterId);

  return ok(res, { review }, 201);
};

// GET /api/reviews/recruiter/:recruiterId  (public)
export const getRecruiterReviews = async (req, res) => {
  const { recruiterId } = req.params;

  if (!mongoose.isValidObjectId(recruiterId)) {
    return fail(res, 404, "Recruiter not found", "RECRUITER_NOT_FOUND");
  }

  const found = await Review.find({ recruiterId })
    .populate("candidateId", "name")
    .sort({ createdAt: -1 })
    .lean();

  // "Verified Hire" is derived from the current application status rather than
  // read off a stale flag stored on the review — see reviewService.
  const reviews = await withVerifiedHireFlag(found);

  // Returned alongside the list so a caller that only wants the summary does
  // not have to re-derive it.
  const reviewCount = reviews.length;
  const averageRating = reviewCount
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
    : 0;

  return ok(res, { reviews, reviewCount, averageRating });
};
