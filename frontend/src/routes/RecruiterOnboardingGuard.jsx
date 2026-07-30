import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Keeps recruiters out of the working dashboard until their company profile
 * has been filled in.
 *
 * Deliberately does NOT gate on verificationStatus — a PENDING recruiter is
 * allowed onto a read-only dashboard; the backend rejects the writes and the
 * dashboard shows a banner. This only redirects when there is nothing useful
 * to show yet.
 *
 * Wrap INSIDE ProtectedRoute so the role check runs first.
 */
const RecruiterOnboardingGuard = ({
  children
}) => {
  const { user } = useAuth();

  if (!user || user.role !== "recruiter") return <>{children}</>;

  // Summary not resolved yet on this paint — render children rather than
  // redirecting; the page's own fetch settles the real state without a flash.
  if (!user.recruiterProfile) return <>{children}</>;

  if (user.recruiterProfile.onboardingStatus === "INCOMPLETE") {
    return <Navigate to="/recruiter/onboarding" replace />;
  }

  return <>{children}</>;
};

export default RecruiterOnboardingGuard;
