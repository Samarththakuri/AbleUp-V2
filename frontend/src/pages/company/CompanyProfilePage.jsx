import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Globe, Star, Users, Calendar,
  ArrowLeft, Loader2, ShieldCheck, CheckCircle2,
  Briefcase, ExternalLink,
  Building2, Accessibility, Mail, Phone,
} from "lucide-react";
import StarRating from "@/components/shared/StarRating";
import { api, resolveFileUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { COMPANY_SIZE_LABELS } from "@/constants/company";

/** `new URL()` throws on a schemeless value, which used to crash this page. */
const hostnameOf = (url) => {
  if (!url) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
};

const absoluteUrl = (url) =>
  url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : undefined;

const StatCard = ({
  icon,
  iconClass,
  label,
  value
}) => (
  <Card>
    <CardContent className="flex items-center gap-4 p-6">
      <div className={`rounded-full p-3 ${iconClass}`}>{icon}</div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const CompanyProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const result = await api(`/jobs/recruiter/${id}`);
        setData(result);
      } catch {
        toast({ title: "Failed to load company profile", variant: "destructive" });
        navigate("/jobs");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!data) return null;

  const { recruiter, jobs, reviews } = data;
  const profile = recruiter.profile;
  const companyName = profile?.companyName || recruiter.name;
  const logo = resolveFileUrl(profile?.companyLogo);
  const isVerified =
    recruiter.isVerified ?? recruiter.verificationStatus === "VERIFIED";
  const location = [profile?.city, profile?.state, profile?.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30">
        <div className="container py-8">
          <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </Button>

          {/* Hero */}
          <div
            className="relative mb-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div
              className="h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="px-6 pb-6">
              <div
                className="relative -mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
                <div
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-primary/10 text-3xl font-bold text-primary shadow-sm">
                  {logo ? (
                    <img
                      src={logo}
                      alt={`${companyName} logo`}
                      className="h-full w-full object-contain" />
                  ) : (
                    companyName.charAt(0).toUpperCase()
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold text-foreground">{companyName}</h1>

                    {(profile?.reviewCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <StarRating value={Math.round(profile.averageRating)} readOnly size="sm" />
                        <span className="font-medium text-foreground">
                          {profile.averageRating.toFixed(1)}
                        </span>
                        ({profile.reviewCount})
                      </span>
                    )}
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {profile?.industry && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" aria-hidden="true" /> {profile.industry}
                      </span>
                    )}
                    {profile?.companySize && (
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" aria-hidden="true" />{" "}
                        {COMPANY_SIZE_LABELS[profile.companySize] || profile.companySize}
                      </span>
                    )}
                    {location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" aria-hidden="true" /> {location}
                      </span>
                    )}
                    {profile?.website && (
                      <a
                        href={absoluteUrl(profile.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 transition-colors hover:text-primary">
                        <Globe className="h-4 w-4" aria-hidden="true" /> {hostnameOf(profile.website)}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" aria-hidden="true" /> Joined{" "}
                      {new Date(recruiter.createdAt).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {isVerified && (
                      <span className="flex items-center gap-1 font-medium text-green-600">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Verified Employer
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden lg:block">
                  <Button asChild>
                    <a href={`mailto:${profile?.companyEmail || recruiter.email}`}>
                      Contact Company
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats — reviews are now the only recruiter reputation signal */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={<Star className="h-6 w-6 fill-yellow-500/20" aria-hidden="true" />}
              iconClass="bg-yellow-500/10 text-yellow-600"
              label="Avg. Rating"
              value={(profile?.averageRating ?? 0).toFixed(1)} />
            <StatCard
              icon={<Users className="h-6 w-6" aria-hidden="true" />}
              iconClass="bg-orange-500/10 text-orange-600"
              label="Reviews"
              value={profile?.reviewCount ?? 0} />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/*
                Accessibility leads the page. With the inclusivity tier badge
                gone, this is the most decision-relevant content a candidate
                on a PwD job portal needs — and unlike a self-assigned score,
                it is a concrete list they can check against their own needs.
              */}
              <section aria-labelledby="accessibility-heading">
                <h2
                  id="accessibility-heading"
                  className="mb-3 flex items-center gap-2 text-xl font-bold">
                  <Accessibility className="h-5 w-5 text-primary" aria-hidden="true" />
                  Workplace Accessibility
                </h2>
                <Card>
                  <CardContent className="p-6">
                    {profile?.accessibilityFacilities?.length ? (
                      <ul className="flex flex-wrap gap-2">
                        {profile.accessibilityFacilities.map((f) => (
                          <li key={f}>
                            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                              {f}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        This company has not listed its accessibility facilities yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* About */}
              {profile?.companyDescription && (
                <section aria-labelledby="about-heading">
                  <h2
                    id="about-heading"
                    className="mb-3 flex items-center gap-2 text-xl font-bold">
                    <Building2 className="h-5 w-5 text-primary" aria-hidden="true" /> About{" "}
                    {companyName}
                  </h2>
                  <Card>
                    <CardContent
                      className="whitespace-pre-line p-6 text-sm leading-relaxed text-muted-foreground">
                      {profile.companyDescription}
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Jobs */}
              <section aria-labelledby="jobs-heading">
                <h2
                  id="jobs-heading"
                  className="mb-3 flex items-center gap-2 text-xl font-bold">
                  <Briefcase className="h-5 w-5 text-primary" aria-hidden="true" /> Active Jobs (
                  {jobs.length})
                </h2>

                {jobs.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                      No active jobs found for this company.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {jobs.map((job) => (
                      <Card
                        key={job._id}
                        className="border-primary/10 transition-all hover:shadow-md">
                        <CardContent className="flex h-full flex-col justify-between p-5">
                          <div>
                            <h3 className="line-clamp-1 text-lg font-semibold">{job.title}</h3>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" aria-hidden="true" />{" "}
                                {job.location || (job.remote ? "Remote" : "On-site")}
                              </span>
                              <span>•</span>
                              <span>{job.workHours || "Full-time"}</span>
                            </div>
                            {(job.salaryMin > 0 || job.salaryMax > 0) && (
                              <p className="mt-3 text-sm font-medium text-primary">
                                ₹{(job.salaryMin || 0).toLocaleString()} - ₹
                                {(job.salaryMax || 0).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                            <Link to={`/jobs/${job._id}`}>View Details</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact */}
              {(profile?.hrContactPerson || profile?.hrContactNumber || profile?.companyEmail) && (
                <section aria-labelledby="contact-heading">
                  <h2 id="contact-heading" className="mb-3 text-xl font-bold">
                    Contact
                  </h2>
                  <Card>
                    <CardContent className="space-y-3 p-4 text-sm">
                      {profile.hrContactPerson && (
                        <p className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {profile.hrContactPerson}
                        </p>
                      )}
                      {profile.hrContactNumber && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <a href={`tel:${profile.hrContactNumber}`} className="hover:text-primary">
                            {profile.hrContactNumber}
                          </a>
                        </p>
                      )}
                      {profile.companyEmail && (
                        <p className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <a
                            href={`mailto:${profile.companyEmail}`}
                            className="break-all hover:text-primary">
                            {profile.companyEmail}
                          </a>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Reviews */}
              <section aria-labelledby="reviews-heading">
                <h2
                  id="reviews-heading"
                  className="mb-3 flex items-center gap-2 text-xl font-bold">
                  <Star className="h-5 w-5 text-yellow-500" aria-hidden="true" /> Candidate Reviews
                </h2>

                {reviews.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                      No reviews yet.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <Card key={review._id}>
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">
                                {typeof review.candidateId === "string"
                                  ? "Candidate"
                                  : review.candidateId?.name}
                              </p>
                              <StarRating value={review.rating} readOnly size="sm" />
                            </div>
                            {review.isVerifiedHire && (
                              <Badge
                                variant="outline"
                                className="gap-1 border-green-200 bg-green-50 px-1.5 py-0 text-[10px] text-green-700">
                                <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Verified Hire
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm italic text-muted-foreground">"{review.comment}"</p>
                          <p className="text-right text-[10px] text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CompanyProfilePage;
