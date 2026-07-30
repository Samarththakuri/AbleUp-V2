import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Phone,
  Accessibility,
  ImageIcon,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRecruiterProfile, validateCompanyFields } from "@/hooks/useRecruiterProfile";
import {
  CompanyBasicsFields,
  CompanyContactFields,
} from "@/components/recruiter/CompanyFormFields";
import AccessibilityFacilitiesPicker from "@/components/recruiter/AccessibilityFacilitiesPicker";
import CompanyLogoUpload from "@/components/recruiter/CompanyLogoUpload";
import DocumentList from "@/components/shared/DocumentList";
import VerificationDocumentUpload from "@/components/shared/VerificationDocumentUpload";
import { api } from "@/lib/api";
import { RECRUITER_DOC_TYPES } from "@/constants/company";

/**
 * Recruiter onboarding (spec §5).
 *
 * Registration creates the User + RecruiterProfile with just a company name;
 * this wizard collects the rest and submits the profile for admin review.
 * Each step persists on "Continue", so a recruiter can leave and resume.
 */

const STEPS = [
  {
    id: "basics",
    title: "Company basics",
    description: "Tell candidates who you are.",
    icon: Building2,
    fields: ["companyName", "industry", "companySize", "companyDescription", "website", "foundedYear"],
  },
  {
    id: "contact",
    title: "HR contact",
    description: "How candidates and our team reach you.",
    icon: Phone,
    fields: ["hrContactPerson", "hrContactNumber", "companyEmail", "linkedin"],
  },
  {
    id: "accessibility",
    title: "Accessibility",
    description: "The facilities your workplace offers.",
    icon: Accessibility,
    fields: [],
  },
  {
    id: "documents",
    title: "Documents",
    description: "Proof our reviewers check before approving you.",
    icon: FileCheck,
    fields: [],
  },
  {
    id: "logo",
    title: "Logo & submit",
    description: "Finish up and send for verification.",
    icon: ImageIcon,
    fields: [],
  },
];

const RecruiterOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    profile,
    completion,
    loading,
    saving,
    loadError,
    save,
    saveAccessibility,
    submitForVerification,
    applyResponse,
  } = useRecruiterProfile();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState({});
  const [facilities, setFacilities] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  // Seed the form once the profile arrives.
  useEffect(() => {
    if (!profile) return;
    setValues(profile);
    setFacilities(profile.accessibilityFacilities || []);
  }, [profile]);

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  const setField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleDeleteDocument = async (doc) => {
    try {
      const res = await api(
        "/recruiter/profile/verification-document",
        { method: "DELETE", body: { url: doc.url } }
      );
      applyResponse(res);
      toast({ title: "Document removed", description: doc.docType });
    } catch (err) {
      toast({
        title: "Could not remove document",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const alreadySubmitted = useMemo(
    () => profile?.onboardingStatus === "SUBMITTED" || profile?.onboardingStatus === "COMPLETE",
    [profile]
  );

  const goNext = async () => {
    setSubmitError(null);

    // Validate only the fields owned by this step.
    if (current.fields.length > 0) {
      const stepErrors = validateCompanyFields(values, current.fields);
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        return;
      }
    }

    try {
      if (current.id === "accessibility") {
        if (facilities.length === 0) {
          setSubmitError("Select at least one accessibility facility.");
          return;
        }
        await saveAccessibility(facilities);
      } else if (current.id === "documents") {
        // Mirrors the server's required `verificationDocuments` completion
        // check, so the recruiter finds out here rather than at submit.
        if ((profile?.verificationDocuments?.length || 0) === 0) {
          setSubmitError("Upload at least one verification document.");
          return;
        }
      } else if (current.fields.length > 0) {
        await save(values);
      }

      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (err) {
      setSubmitError(err?.message || "Could not save your changes. Please try again.");
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await submitForVerification();
      toast({
        title: "Submitted for verification",
        description: "An admin will review your company profile shortly.",
      });
      navigate("/recruiter/verification-pending", { replace: true });
    } catch (err) {
      setSubmitError(
        err?.message || "Could not submit your profile. Please complete all required fields."
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center bg-muted/30">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30">
        <div className="container max-w-3xl py-8">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              Complete your company profile
            </h1>
            <p className="mt-1 text-muted-foreground">
              We verify every employer before they can post jobs, so candidates
              know who they are applying to.
            </p>
          </header>

          {loadError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {/* Step indicator */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-3">
              <Progress
                value={progress}
                className="h-2 flex-1"
                aria-label={`Step ${step + 1} of ${STEPS.length}`} />
              <span className="text-sm font-medium text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
            </div>

            <ol className="flex flex-wrap gap-2" aria-label="Onboarding steps">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const state = i < step ? "done" : i === step ? "current" : "upcoming";
                return (
                  <li key={s.id}>
                    <span
                      aria-current={state === "current" ? "step" : undefined}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                        state === "done"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : state === "current"
                            ? "border-foreground/20 bg-background text-foreground"
                            : "border-border text-muted-foreground"
                      }`}>
                      {state === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {s.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{current.title}</CardTitle>
              <CardDescription>{current.description}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {current.id === "basics" && (
                <CompanyBasicsFields values={values} onChange={setField} errors={errors} disabled={saving} />
              )}

              {current.id === "contact" && (
                <CompanyContactFields values={values} onChange={setField} errors={errors} disabled={saving} />
              )}

              {current.id === "accessibility" && (
                <AccessibilityFacilitiesPicker
                  value={facilities}
                  onChange={setFacilities}
                  disabled={saving}
                  hint="Select every facility your workplace provides. Individual job posts can add job-specific accessibility on top of these." />
              )}

              {current.id === "documents" && (
                <div className="space-y-4">
                  <DocumentList
                    documents={profile?.verificationDocuments || []}
                    onDelete={handleDeleteDocument}
                    emptyMessage="No documents yet. Upload proof of incorporation, GST registration or company PAN." />
                  <VerificationDocumentUpload
                    endpoint="/recruiter/profile/verification-document"
                    method="PATCH"
                    docTypes={RECRUITER_DOC_TYPES}
                    onUploaded={applyResponse} />
                </div>
              )}

              {current.id === "logo" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Company logo</h3>
                    <CompanyLogoUpload
                      currentLogo={profile?.companyLogo}
                      companyName={profile?.companyName}
                      onUploaded={applyResponse} />
                  </div>

                  {completion && (
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center gap-3">
                        <Progress value={completion.percentage} className="h-2 flex-1" />
                        <span className="text-sm font-bold">{completion.percentage}%</span>
                      </div>
                      {completion.missingRequired.length > 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Still needed: {completion.missingRequired.join(", ")}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Everything required is filled in. You can submit for verification.
                        </p>
                      )}
                    </div>
                  )}

                  {alreadySubmitted && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <AlertDescription>
                        Your profile has already been submitted. Saving again will
                        update the details our reviewers see.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <div
                className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(s - 1, 0))}
                  disabled={step === 0 || saving}>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Back
                </Button>

                {isLastStep ? (
                  <Button onClick={handleSubmit} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Submit for verification
                  </Button>
                ) : (
                  <Button onClick={goNext} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Save & continue
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RecruiterOnboarding;
