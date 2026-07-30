import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Bookmark,
  Search,
  BookmarkX,
  Loader2,
  CalendarCheck,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ResumeUpload from "@/components/candidate/ResumeUpload";
import CandidateInterviewCard from "@/components/candidate/CandidateInterviewCard";
import ApplicationTimeline from "@/components/candidate/ApplicationTimeline";
import ProfileCompleteness from "@/components/candidate/ProfileCompleteness";
import SkillTags from "@/components/candidate/SkillTags";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const CandidateDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("applied");
  const [profileData, setProfileData] = useState({});
  const [skills, setSkills] = useState([]);

  const fetchInterviews = async () => {
    try {
      const data = await api("/interviews/my");
      setInterviews(data.interviews || []);
    } catch {
      // Keep empty
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [appliedRes, savedRes, profileRes] = await Promise.all([
          api("/candidate/applied").catch(() => ({
            applications: [],
          })),
          api("/candidate/saved").catch(() => ({
            savedJobs: [],
          })),
          api("/candidate/profile").catch(() => ({
            user: {},
            profile: {},
          })),
        ]);

        // Profile data for completeness
        const prof = profileRes.profile || {};
        const usr = profileRes.user || {};
        setProfileData({
          name: usr.name,
          email: usr.email,
          disabilityType: prof.disabilityType,
          udidNumber: prof.udidNumber,
          resumeUrl: prof.resumeUrl,
          verificationStatus: usr.verificationStatus,
          skills: prof.skills || [],
          preferredWorkHours: prof.preferredWorkHours,
        });
        setSkills(prof.skills || []);

        setAppliedJobs(appliedRes.applications.map((a) => {
          const job = a.jobId || {};
          return {
            id: a._id || a.id,
            title: job.title || "Unknown Job",
            company: job.company || "—",
            location: job.location || (job.remote ? "Remote" : "—"),
            salary:
              job.salaryMin && job.salaryMax
                ? `₹${job.salaryMin.toLocaleString()} - ₹${job.salaryMax.toLocaleString()}`
                : "—",
            appliedDate: a.appliedAt
              ? new Date(a.appliedAt).toLocaleDateString()
              : "—",
            updatedDate: a.updatedAt
              ? new Date(a.updatedAt).toLocaleDateString()
              : "—",
            status: a.status || "APPLIED",
          };
        }));

        setSavedJobs(savedRes.savedJobs.map((j) => ({
          id: j._id || j.id,
          title: j.title || "Unknown Job",
          location: j.location || (j.remote ? "Remote" : "—"),
          salary:
            j.salaryMin && j.salaryMax
              ? `₹${j.salaryMin.toLocaleString()} - ₹${j.salaryMax.toLocaleString()}`
              : "—",
          accessibility: (j.accessibilityFeatures || []).join(", ") || "—",
        })));

        await fetchInterviews();
      } catch {
        // Keep empty arrays on error
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRemoveSaved = async (jobId) => {
    try {
      await api(`/candidate/save/${jobId}`, { method: "POST" });
      setSavedJobs((prev) => prev.filter((j) => j.id !== jobId));
      toast({ title: "Job removed from saved list" });
    } catch {
      setSavedJobs((prev) => prev.filter((j) => j.id !== jobId));
      toast({ title: "Removed (offline)" });
    }
  };

  const handleSkillsUpdate = async (newSkills) => {
    setSkills(newSkills);
    setProfileData((prev) => ({ ...prev, skills: newSkills }));
    try {
      await api("/candidate/profile", {
        method: "PUT",
        body: { skills: newSkills },
      });
    } catch {
      // Optimistic update already applied
    }
  };

  const statusColor = (status) => {
    const s = status.toUpperCase();
    if (s === "SHORTLISTED" || s === "HIRED")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (s === "REJECTED")
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  };

  const statusLabel = (s) => {
    const map = {
      APPLIED: "Under Review",
      SHORTLISTED: "Shortlisted",
      REJECTED: "Rejected",
      HIRED: "Hired",
    };
    return map[s.toUpperCase()] || s;
  };

  const pendingInterviews = interviews.filter((i) =>
    ["SCHEDULED", "RESCHEDULED"].includes(i.status));

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30">
        <div className="container py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Welcome, {user?.name || "Candidate"}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Verification:
                </span>
                <StatusBadge status={user?.verificationStatus || "pending"} />
              </div>
            </div>
            <Button className="gap-2" onClick={() => navigate("/jobs")}>
              <Search className="h-4 w-4" /> Search Jobs
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("applied")}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Applied Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? "—" : appliedJobs.length}
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("saved")}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Bookmark className="h-5 w-5 text-accent" />
                <CardTitle className="text-base">Saved Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? "—" : savedJobs.length}
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("interviews")}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Interviews</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {loading ? "—" : pendingInterviews.length}
                </p>
                {pendingInterviews.length > 0 && (
                  <p className="text-xs text-primary mt-1">Action needed</p>
                )}
              </CardContent>
            </Card>
            <ProfileCompleteness profile={profileData} />
          </div>

          <div className="mt-8 flex gap-2 border-b">
            {(["applied", "saved", "interviews"]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {tab === "applied"
                  ? `Applied (${appliedJobs.length})`
                  : tab === "saved"
                    ? `Saved (${savedJobs.length})`
                    : `Interviews (${interviews.length})`}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activeTab === "applied" ? (
                <div className="space-y-4">
                  {appliedJobs.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center">
                      You haven't applied to any jobs yet.
                    </p>
                  ) : (
                    appliedJobs.map((job) => (
                      <div key={job.id} className="space-y-2">
                        <Card>
                          <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">
                                {job.title}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {job.company}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span
                                  className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                                  {job.location}
                                </span>
                                <span
                                  className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                                  {job.salary}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Applied: {job.appliedDate}
                              </p>
                            </div>
                            <Badge className={statusColor(job.status)}>
                              {statusLabel(job.status)}
                            </Badge>
                          </CardContent>
                        </Card>
                        <ApplicationTimeline
                          status={job.status}
                          appliedDate={job.appliedDate}
                          updatedDate={job.updatedDate} />
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === "saved" ? (
                <div className="space-y-4">
                  {savedJobs.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center">
                      No saved jobs.
                    </p>
                  ) : (
                    savedJobs.map((job) => (
                      <Card key={job.id}>
                        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">
                              {job.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span
                                className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                                {job.location}
                              </span>
                              <span
                                className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                                {job.salary}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-primary">
                              ♿ {job.accessibility}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/jobs/${job.id}`)}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveSaved(job.id)}>
                              <BookmarkX className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {interviews.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center">
                      No interviews scheduled yet.
                    </p>
                  ) : (
                    interviews.map((interview) => (
                      <CandidateInterviewCard key={interview._id} interview={interview} onUpdated={fetchInterviews} />
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="space-y-6">
              <SkillTags skills={skills} onUpdate={handleSkillsUpdate} />
              <ResumeUpload />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CandidateDashboard;
