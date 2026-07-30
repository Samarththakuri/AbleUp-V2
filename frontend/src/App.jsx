import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/routes/ProtectedRoute";
import RecruiterOnboardingGuard from "@/routes/RecruiterOnboardingGuard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import RegisterPage from "./pages/auth/RegisterPage";
import CandidateDashboard from "./pages/candidate/CandidateDashboard";
import JobSearchPage from "./pages/candidate/JobSearchPage";
import JobDetailPage from "./pages/candidate/JobDetailPage";
import CandidateProfile from "./pages/candidate/CandidateProfile";
import CompanyProfilePage from "./pages/company/CompanyProfilePage";
import RecruiterDashboard from "./pages/recruiter/RecruiterDashboard";
import RecruiterOnboarding from "./pages/recruiter/RecruiterOnboarding";
import VerificationPendingPage from "./pages/recruiter/VerificationPendingPage";
import RecruiterProfilePage from "./pages/recruiter/RecruiterProfilePage";
import JobApplicantsPage from "./pages/recruiter/JobApplicantsPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AccountSettings from "./pages/settings/AccountSettings";

const queryClient = new QueryClient();

/**
 * The public company page used to live at /recruiter/:id, inside the
 * recruiter-private namespace. It now lives at /company/:id; this preserves
 * any links already shared or bookmarked.
 */
const LegacyRecruiterRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/company/${id}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* ---------- Public ---------- */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/jobs" element={<JobSearchPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/company/:id" element={<CompanyProfilePage />} />

            {/* ---------- Candidate ---------- */}
            <Route
              path="/candidate"
              element={
                <ProtectedRoute allowedRoles={["candidate"]}>
                  <CandidateDashboard />
                </ProtectedRoute>
              } />
            <Route
              path="/candidate/profile"
              element={
                <ProtectedRoute allowedRoles={["candidate"]}>
                  <CandidateProfile />
                </ProtectedRoute>
              } />

            {/*
              Recruiter. Onboarding, verification status and the company
              profile stay reachable while onboarding is incomplete — only the
              working pages sit behind RecruiterOnboardingGuard.
            */}
            <Route
              path="/recruiter/onboarding"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <RecruiterOnboarding />
                </ProtectedRoute>
              } />
            <Route
              path="/recruiter/verification-pending"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <VerificationPendingPage />
                </ProtectedRoute>
              } />
            <Route
              path="/recruiter/profile"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <RecruiterProfilePage />
                </ProtectedRoute>
              } />
            <Route
              path="/recruiter"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <RecruiterOnboardingGuard>
                    <RecruiterDashboard />
                  </RecruiterOnboardingGuard>
                </ProtectedRoute>
              } />
            <Route
              path="/recruiter/job/:jobId/applicants"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <RecruiterOnboardingGuard>
                    <JobApplicantsPage />
                  </RecruiterOnboardingGuard>
                </ProtectedRoute>
              } />
            {/* Backward compatibility for the old public company URL. */}
            <Route path="/recruiter/:id" element={<LegacyRecruiterRedirect />} />

            {/* ---------- Admin / shared ---------- */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={["candidate", "recruiter", "admin"]}>
                  <AccountSettings />
                </ProtectedRoute>
              } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
