/**
 * Where a signed-in user belongs.
 *
 * This mapping used to be copy-pasted in LoginPage, RegisterPage and Navbar,
 * which is why the recruiter onboarding flow could not be added in one place.
 *
 * Recruiter routing follows the lifecycle:
 *   profile INCOMPLETE  -> finish onboarding
 *   awaiting/failed admin review -> verification status page
 *   verified            -> dashboard
 */
export const getPostAuthRedirect = user => {
  if (!user) return "/login";

  if (user.role === "admin") return "/admin";
  if (user.role === "candidate") return "/candidate";

  const profile = user.recruiterProfile;

  // Not resolved on this paint — send them to the dashboard, whose own guard
  // routes correctly once the profile loads.
  if (!profile) return "/recruiter";

  if (profile.onboardingStatus === "INCOMPLETE") return "/recruiter/onboarding";
  if (user.verificationStatus !== "approved") return "/recruiter/verification-pending";

  return "/recruiter";
};

/** Dashboard home for a role, ignoring onboarding state (used by the navbar). */
export const getDashboardPath = role => {
  if (role === "admin") return "/admin";
  if (role === "recruiter") return "/recruiter";
  return "/candidate";
};
