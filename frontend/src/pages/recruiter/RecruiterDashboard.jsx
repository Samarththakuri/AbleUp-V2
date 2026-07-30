import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Briefcase, Users, PlusCircle, Eye, UserCheck, UserX, ChevronDown, ChevronUp,
  Loader2, CalendarPlus, RotateCcw, FileText, ShieldCheck, ShieldAlert,
  Star, CalendarCheck, Building2, Pencil, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, resolveFileUrl } from "@/lib/api";
import ScheduleInterviewDialog from "@/components/recruiter/ScheduleInterviewDialog";
import RecruiterProfileCompleteness from "@/components/recruiter/RecruiterProfileCompleteness";
import {
  COMPANY_ACCESSIBILITY_FACILITIES,
  JOB_ACCESSIBILITY_EXTRAS,
  WORK_HOUR_OPTIONS,
} from "@/constants/company";

// Was a local copy of this list. Job.workHours is enum-constrained to the
// shared vocabulary now, which CandidateProfile.preferredWorkHours also uses.
const WORK_HOURS = WORK_HOUR_OPTIONS;

const emptyJobForm = {
  title: "",
  location: "",
  salaryMin: "",
  salaryMax: "",
  workHours: "Full-time",
  description: "",
};

const RecruiterDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState(null);
  const [loadingApplicants, setLoadingApplicants] = useState(null);
  const [posting, setPosting] = useState(false);

  // Company header + counters, served by GET /recruiter/dashboard/stats.
  const [dashboard, setDashboard] = useState(null);

  // Controlled job form. The previous version read values off the DOM with
  // FormData, which silently dropped the Radix <Select> (it renders no native
  // named input, so work hours always fell back to "Full-time").
  const [jobForm, setJobForm] = useState(emptyJobForm);
  const [jobFacilities, setJobFacilities] = useState([]);
  const [formError, setFormError] = useState("");

  const [scheduleDialog, setScheduleDialog] = useState({ open: false, applicationId: "", candidateName: "", jobTitle: "" });

  const isVerified = user?.verificationStatus === "approved";
  const isRejected = user?.verificationStatus === "rejected";
  const company = dashboard?.company;
  const stats = dashboard?.stats;

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api("/recruiter/dashboard/stats");
      setDashboard(data);
    } catch {
      // Non-fatal — the job list below still renders.
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/recruiter/jobs");
      setListings(data.jobs.map((j) => ({
        id: j._id || j.id,
        title: j.title,
        location: j.location || (j.remote ? "Remote" : "On-site"),
        salary: j.salaryMin && j.salaryMax ? `₹${j.salaryMin.toLocaleString()} - ₹${j.salaryMax.toLocaleString()}` : "Not specified",
        hours: j.workHours || "Full-time",
        description: j.description || "",
        accessibility: (j.accessibilityFeatures || []).join(", ") || "",
        applicantsCount: j.applicantsCount || 0,
        shortlistedCount: j.shortlistedCount || 0,
        postedAt: j.createdAt ? new Date(j.createdAt).toLocaleDateString() : "—",
      })));
    } catch {
      // Keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchJobs();
  }, [fetchDashboard, fetchJobs]);

  // Seed a new job's accessibility from the company-wide facilities (spec §7):
  // the job still owns its own list, this just saves re-typing them.
  useEffect(() => {
    if (showForm && company?.accessibilityFacilities?.length && jobFacilities.length === 0) {
      setJobFacilities(company.accessibilityFacilities);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, company]);

  const fetchApplicants = async (jobId) => {
    setLoadingApplicants(jobId);
    try {
      const data = await api(`/recruiter/job/${jobId}/applicants`);

      // One request per expanded job. Each application arrives with its
      // interview embedded, replacing a GET /interviews/application/:id per
      // shortlisted row.
      const applicants = data.applications.map((a) => {
        const candidate = a.candidateId || {};
        const profile = a.candidateProfile || {};

        return {
          id: a._id || a.id,
          name: candidate.name || "Unknown",
          email: candidate.email || "",
          disability: profile.disabilityType || "—",
          status: (a.status || "APPLIED").toLowerCase(),
          resumeUrl: a.applicationResumeUrl || a.resumeUrl || profile.resumeUrl,
          interview: a.interview || null,
        };
      });

      setListings((prev) => prev.map((j) => (j.id === jobId ? { ...j, applicants } : j)));
    } catch {
      toast({ title: "Failed to load applicants", variant: "destructive" });
    } finally {
      setLoadingApplicants(null);
    }
  };

  const toggleExpand = (jobId) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
    } else {
      setExpandedJob(jobId);
      const job = listings.find((j) => j.id === jobId);
      if (!job?.applicants) fetchApplicants(jobId);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    setFormError("");

    // Checkbox selections only. This used to merge in a comma-separated
    // free-text box, but Job.accessibilityFeatures is enum-constrained now
    // (JOB_ACCESSIBILITY_FEATURES) — typed values were never matchable against
    // anything and would now be rejected by the API.
    const accessibilityFeatures = Array.from(new Set(jobFacilities));

    if (accessibilityFeatures.length === 0) {
      setFormError("Specify at least one accessibility feature for this job.");
      return;
    }
    if (jobForm.description.trim().length < 20) {
      setFormError("Description must be at least 20 characters.");
      return;
    }

    const salaryMin = parseInt(jobForm.salaryMin, 10) || undefined;
    const salaryMax = parseInt(jobForm.salaryMax, 10) || undefined;
    if (salaryMin !== undefined && salaryMax !== undefined && salaryMax < salaryMin) {
      setFormError("Maximum salary must be greater than or equal to the minimum.");
      return;
    }

    setPosting(true);
    try {
      await api("/recruiter/jobs", {
        method: "POST",
        body: {
          title: jobForm.title.trim(),
          description: jobForm.description.trim(),
          location: jobForm.location.trim() || "Remote",
          workHours: jobForm.workHours,
          salaryMin,
          salaryMax,
          accessibilityFeatures,
          remote: jobForm.location.toLowerCase().includes("remote"),
        },
      });
      toast(
        { title: "Job Posted!", description: "Your job listing has been published." }
      );
      setShowForm(false);
      setJobForm(emptyJobForm);
      setJobFacilities([]);
      fetchJobs();
      fetchDashboard();
    } catch (err) {
      // Surface the backend's reason (e.g. RECRUITER_NOT_VERIFIED) rather than
      // a generic failure toast.
      setFormError(err?.message || "Failed to post job");
      toast({
        title: "Failed to post job",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const updateApplicantStatus = async (jobId, applicationId, shortlisted) => {
    try {
      await api(`/recruiter/application/${applicationId}/shortlist`, {
        method: "PUT",
        body: { shortlisted },
      });
      const newStatus = shortlisted ? "shortlisted" : "rejected";
      setListings((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? { ...job, applicants: job.applicants?.map((a) => (a.id === applicationId ? { ...a, status: newStatus } : a)) }
            : job));
      toast({ title: shortlisted ? "Candidate Shortlisted" : "Candidate Rejected" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const openScheduleDialog = (applicant, jobTitle) => {
    setScheduleDialog({
      open: true,
      applicationId: applicant.id,
      candidateName: applicant.name,
      jobTitle,
      existingInterview: applicant.interview,
    });
  };

  const handleInterviewScheduled = () => {
    if (expandedJob) fetchApplicants(expandedJob);
    fetchDashboard();
  };

  const interviewStatusBadge = (interview) => {
    if (!interview) return null;
    const config = {
      SCHEDULED: { label: "Interview Scheduled", className: "bg-primary/10 text-primary" },
      ACCEPTED: { label: "Interview Accepted", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
      RESCHEDULE_REQUESTED: { label: "Reschedule Requested", className: "bg-accent/10 text-accent" },
      RESCHEDULED: { label: "Rescheduled", className: "bg-primary/10 text-primary" },
      COMPLETED: { label: "Interview Done", className: "bg-muted text-muted-foreground" },
    };
    const c = config[interview.status] || config.SCHEDULED;
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const logo = resolveFileUrl(company?.companyLogo);
  const companyName = company?.companyName || user?.name || "Your company";

  const statTiles = [
    { icon: Briefcase, label: "Jobs Posted", value: stats?.jobsPosted, tone: "text-primary" },
    { icon: Users, label: "Applications", value: stats?.applicationsReceived, tone: "text-accent" },
    { icon: UserCheck, label: "Shortlisted", value: stats?.shortlistedCount, tone: "text-green-600" },
    { icon: CalendarCheck, label: "Interviews", value: stats?.interviewsScheduled, tone: "text-blue-600" },
  ];

  // Candidate reviews are the only recruiter reputation signal.
  const reviewCount = company?.reviewCount ?? 0;
  const reputationTiles = [
    {
      icon: Star,
      label: "Candidate Rating",
      value: reviewCount
        ? `${(company?.averageRating ?? 0).toFixed(1)} (${reviewCount} review${reviewCount === 1 ? "" : "s"})`
        : "No reviews yet",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30">
        <div className="container py-8">
          {/* ---------- Verification banner ---------- */}
          {!isVerified && (
            <Alert
              variant={isRejected ? "destructive" : "default"}
              className={`mb-6 ${isRejected ? "" : "border-warning/40 bg-warning/5"}`}>
              {isRejected ? (
                <XCircle className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              )}
              <AlertTitle>
                {isRejected ? "Verification unsuccessful" : "Your company is under review"}
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>
                  {isRejected
                    ? user?.rejectionReason ||
                      "Update your company profile and submit it again to start posting jobs."
                    : "You can post jobs once an admin verifies your company. Everything else stays available."}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link to="/recruiter/verification-pending">View status</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ---------- Company header ---------- */}
          <Card className="mb-6">
            <CardContent className="flex flex-wrap items-start gap-5 p-6">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-primary/10 text-2xl font-bold text-primary">
                {logo ? (
                  <img
                    src={logo}
                    alt={`${companyName} logo`}
                    className="h-full w-full object-contain" />
                ) : (
                  companyName.charAt(0).toUpperCase()
                )}
              </div>

              <div className="min-w-[200px] flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{companyName}</h1>

                  {isVerified ? (
                    <Badge
                      className="gap-1 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      {isRejected ? "Rejected" : "Pending verification"}
                    </Badge>
                  )}

                </div>

                {company?.industry && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" aria-hidden="true" /> {company.industry}
                  </p>
                )}

                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                  {reputationTiles.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-semibold text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/recruiter/profile">
                    <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Edit company profile
                  </Link>
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => setShowForm(!showForm)}
                  disabled={!isVerified}
                  title={isVerified ? undefined : "Available once an admin verifies your company"}>
                  <PlusCircle className="h-4 w-4" aria-hidden="true" /> Post a Job
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* ---------- Main column ---------- */}
            <div className="space-y-6 lg:col-span-2">
              {/* Stat tiles */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statTiles.map(({ icon: Icon, label, value, tone }) => (
                  <Card key={label}>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                      <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
                      <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-foreground">
                        {value === undefined ? "—" : value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Job posting form */}
              {showForm && (
                <Card>
                  <CardHeader><CardTitle>Post a New Job</CardTitle></CardHeader>
                  <CardContent>
                    <form onSubmit={handlePost} className="grid gap-4 md:grid-cols-2">
                      {formError && (
                        <div className="md:col-span-2">
                          <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                          </Alert>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="job-title">Job Title *</Label>
                        <Input
                          id="job-title"
                          value={jobForm.title}
                          onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                          required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job-location">Location</Label>
                        <Input
                          id="job-location"
                          placeholder="e.g. Remote, Mumbai"
                          value={jobForm.location}
                          onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job-salary-min">Min Salary (₹)</Label>
                        <Input
                          id="job-salary-min"
                          type="number"
                          placeholder="15000"
                          value={jobForm.salaryMin}
                          onChange={(e) => setJobForm({ ...jobForm, salaryMin: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job-salary-max">Max Salary (₹)</Label>
                        <Input
                          id="job-salary-max"
                          type="number"
                          placeholder="30000"
                          value={jobForm.salaryMax}
                          onChange={(e) => setJobForm({ ...jobForm, salaryMax: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job-hours">Work Hours</Label>
                        <Select
                          value={jobForm.workHours}
                          onValueChange={(v) => setJobForm({ ...jobForm, workHours: v })}>
                          <SelectTrigger id="job-hours"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {WORK_HOURS.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="job-desc">Description *</Label>
                        <Textarea
                          id="job-desc"
                          rows={4}
                          value={jobForm.description}
                          onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                          required />
                      </div>

                      {/* Job accessibility — seeded from the company profile */}
                      <fieldset className="space-y-3 md:col-span-2">
                        <legend className="text-sm font-medium">Accessibility for this job *</legend>
                        <p className="text-xs text-muted-foreground">
                          Pre-filled from your company facilities. Adjust for this specific role.
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {COMPANY_ACCESSIBILITY_FACILITIES.map((f) => {
                            const id = `job-facility-${f.replace(/\s+/g, "-").toLowerCase()}`;
                            return (
                              <div key={f} className="flex items-center gap-2">
                                <Checkbox
                                  id={id}
                                  checked={jobFacilities.includes(f)}
                                  onCheckedChange={(state) =>
                                    setJobFacilities((prev) =>
                                      state === true ? [...prev, f] : prev.filter((x) => x !== f))
                                  } />
                                <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                                  {f}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                        <p className="pt-2 text-xs text-muted-foreground">
                          Role-specific arrangements
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {JOB_ACCESSIBILITY_EXTRAS.map((f) => {
                            const id = `job-extra-${f.replace(/\s+/g, "-").toLowerCase()}`;
                            return (
                              <div key={f} className="flex items-center gap-2">
                                <Checkbox
                                  id={id}
                                  checked={jobFacilities.includes(f)}
                                  onCheckedChange={(state) =>
                                    setJobFacilities((prev) =>
                                      state === true ? [...prev, f] : prev.filter((x) => x !== f))
                                  } />
                                <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                                  {f}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </fieldset>

                      <div className="md:col-span-2">
                        <Button type="submit" size="lg" disabled={posting}>
                          {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                          Publish Job
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Job listings — unchanged behaviour */}
              <div>
                <h2 className="mb-4 text-lg font-semibold text-foreground">Your Job Listings</h2>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2
                      className="h-8 w-8 animate-spin text-muted-foreground"
                      aria-label="Loading jobs" />
                  </div>
                ) : listings.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    {isVerified
                      ? "No job listings yet. Post your first job!"
                      : "No job listings yet. You can post once your company is verified."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {listings.map((job) => (
                      <Card key={job.id}>
                        <CardContent className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                <span
                                  className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">{job.location}</span>
                                <span
                                  className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">{job.salary}</span>
                                <span
                                  className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">{job.hours}</span>
                              </div>
                              {job.accessibility && <p className="mt-1 text-xs text-primary">♿ {job.accessibility}</p>}
                              <p className="mt-1 text-xs text-muted-foreground">Posted: {job.postedAt}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => navigate(`/recruiter/job/${job.id}/applicants`)}>
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View Applicants
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => toggleExpand(job.id)}
                                aria-expanded={expandedJob === job.id}>
                                {loadingApplicants === job.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                {job.applicantsCount} Applicant{job.applicantsCount !== 1 ? "s" : ""}
                                {expandedJob === job.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>

                          {expandedJob === job.id && (
                            <div className="mt-4 border-t pt-4">
                              {!job.applicants ? (
                                <div className="flex justify-center py-4">
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                                </div>
                              ) : job.applicants.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No applicants yet.</p>
                              ) : (
                                <div className="space-y-3">
                                  <h4 className="text-sm font-medium text-foreground">Applicants</h4>
                                  {job.applicants.map((applicant) => (
                                    <div
                                      key={applicant.id}
                                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                                      <div>
                                        <p className="font-medium text-foreground">{applicant.name}</p>
                                        <p className="text-xs text-muted-foreground">{applicant.email}</p>
                                        <p className="text-xs text-primary">Disability: {applicant.disability}</p>
                                        {applicant.resumeUrl && (
                                          <a
                                            href={resolveFileUrl(applicant.resumeUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                            <FileText className="h-3 w-3" aria-hidden="true" /> View Resume
                                          </a>
                                        )}
                                        {applicant.interview && (
                                          <div className="mt-1 flex items-center gap-2">
                                            {interviewStatusBadge(applicant.interview)}
                                            <span className="text-xs text-muted-foreground">
                                              {new Date(applicant.interview.scheduledAt).toLocaleDateString("en-IN")} at{" "}
                                              {new Date(applicant.interview.scheduledAt).toLocaleTimeString("en-IN", { timeStyle: "short" })}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {applicant.status === "shortlisted" && (
                                          <>
                                            <Badge
                                              className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Shortlisted</Badge>
                                            {!applicant.interview ? (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1 border-primary/30 text-primary hover:bg-primary/10"
                                                onClick={() => openScheduleDialog(applicant, job.title)}>
                                                <CalendarPlus className="h-3 w-3" aria-hidden="true" /> Schedule Interview
                                              </Button>
                                            ) : applicant.interview.status === "RESCHEDULE_REQUESTED" ? (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1 border-accent/30 text-accent hover:bg-accent/10"
                                                onClick={() => openScheduleDialog(applicant, job.title)}>
                                                <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reschedule
                                              </Button>
                                            ) : null}
                                          </>
                                        )}
                                        {applicant.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                                        {applicant.status === "applied" && (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="gap-1 border-green-300 text-green-700 hover:bg-green-50"
                                              onClick={() => updateApplicantStatus(job.id, applicant.id, true)}>
                                              <UserCheck className="h-3 w-3" aria-hidden="true" /> Shortlist
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                              onClick={() => updateApplicantStatus(job.id, applicant.id, false)}>
                                              <UserX className="h-3 w-3" aria-hidden="true" /> Reject
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ---------- Sidebar ---------- */}
            <div className="space-y-6">
              <RecruiterProfileCompleteness completion={dashboard?.profileCompletion ?? null} />

              {company?.accessibilityFacilities && company.accessibilityFacilities.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Company Accessibility</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-wrap gap-2">
                      {company.accessibilityFacilities.map((f) => (
                        <li key={f}>
                          <Badge variant="secondary">{f}</Badge>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <ScheduleInterviewDialog
        open={scheduleDialog.open}
        onOpenChange={(open) => setScheduleDialog((prev) => ({ ...prev, open }))}
        applicationId={scheduleDialog.applicationId}
        candidateName={scheduleDialog.candidateName}
        jobTitle={scheduleDialog.jobTitle}
        existingInterview={scheduleDialog.existingInterview}
        onScheduled={handleInterviewScheduled} />
    </div>
  );
};

export default RecruiterDashboard;
