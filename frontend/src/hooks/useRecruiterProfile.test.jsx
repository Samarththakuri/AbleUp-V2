import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/context/AuthContext";
import { useRecruiterProfile } from "@/hooks/useRecruiterProfile";

/**
 * Regression net for the request loop described in BUGS.md F-05.
 *
 * `useRecruiterProfile` builds applyResponse -> load -> a mount effect on top
 * of AuthContext's `updateUser`. When `updateUser` was a plain arrow function
 * its identity changed on every provider render, and because applyResponse
 * calls it — causing exactly such a render — the mount effect re-fired forever.
 * The page issued GET /recruiter/profile as fast as the network allowed until
 * the backend rate limiter answered 429.
 *
 * A render-count assertion would not catch this: the defect is the *number of
 * fetches*, so that is what these assert.
 */
vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  API_BASE_URL: "/api",
  API_ORIGIN: "",
}));

import { api } from "@/lib/api";

const profileResponse = {
  profile: {
    companyName: "Acme",
    companyLogo: null,
    onboardingStatus: "IN_PROGRESS",
    city: "Pune",
  },
  profileCompletion: { percentage: 60 },
  verificationStatus: "PENDING",
};

const Consumer = () => {
  const { profile, loading } = useRecruiterProfile();
  if (loading) return <div>loading</div>;
  return <div data-testid="company">{profile?.companyName}</div>;
};

describe("useRecruiterProfile", () => {
  beforeEach(() => {
    localStorage.setItem("abelup_token", "test-token");
    localStorage.setItem(
      "abelup_user",
      JSON.stringify({ id: "u1", name: "R", email: "r@x.com", role: "recruiter" })
    );
    api.mockReset();
    api.mockResolvedValue(profileResponse);
  });

  afterEach(() => localStorage.clear());

  it("fetches the profile exactly once per mount", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("company")).toHaveTextContent("Acme"));

    // The loop was unbounded, so any regression overshoots this by orders of
    // magnitude rather than by one.
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/recruiter/profile");
  });

  it("stays at one fetch after the auth user settles", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("company")).toHaveTextContent("Acme"));

    // applyResponse writes the recruiter summary back into AuthContext, which
    // re-renders the provider. Nothing that follows may trigger another fetch.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(api).toHaveBeenCalledTimes(1);
  });
});
