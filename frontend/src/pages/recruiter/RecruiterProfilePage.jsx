import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatusBadge from "@/components/shared/StatusBadge";
import RecruiterProfileCompleteness from "@/components/recruiter/RecruiterProfileCompleteness";
import AccessibilityFacilitiesPicker from "@/components/recruiter/AccessibilityFacilitiesPicker";
import CompanyLogoUpload from "@/components/recruiter/CompanyLogoUpload";
import {
  CompanyBasicsFields,
  CompanyContactFields,
} from "@/components/recruiter/CompanyFormFields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Phone,
  Accessibility,
  Pencil,
  Save,
  X,
  Loader2,
  Globe,
  Mail,
  MapPin,
  Send,
  AlertCircle,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import DocumentList from "@/components/shared/DocumentList";
import VerificationDocumentUpload from "@/components/shared/VerificationDocumentUpload";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRecruiterProfile, validateCompanyFields } from "@/hooks/useRecruiterProfile";
import { api } from "@/lib/api";
import { COMPANY_SIZE_LABELS, RECRUITER_DOC_TYPES } from "@/constants/company";

/**
 * The recruiter's own company profile (spec §9).
 *
 * Follows the same view/edit-toggle-per-card pattern as CandidateProfile, so
 * both roles behave identically, but each section saves independently and
 * every save round-trips through the server so the completion percentage
 * shown here is always the authoritative one.
 */

const BASIC_FIELDS = [
  "companyName",
  "industry",
  "companySize",
  "companyDescription",
  "website",
  "foundedYear",
];
const CONTACT_FIELDS = ["hrContactPerson", "hrContactNumber", "companyEmail", "linkedin"];

const ReadOnlyRow = ({
  icon: Icon,
  label,
  value
}) => (
  <div className="space-y-1">
    <p
      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </p>
    <p className="text-sm text-foreground">
      {value === undefined || value === null || value === "" ? (
        <span className="text-muted-foreground">Not provided</span>
      ) : (
        value
      )}
    </p>
  </div>
);

const RecruiterProfilePage = () => {
  const { user } = useAuth();
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

  const [editingBasics, setEditingBasics] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingAccess, setEditingAccess] = useState(false);

  const [values, setValues] = useState({});
  const [facilities, setFacilities] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!profile) return;
    setValues(profile);
    setFacilities(profile.accessibilityFacilities || []);
  }, [profile]);

  const setField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleDeleteDocument = async (doc) => {
    try {
      // Returns the same RecruiterProfileResponse shape every other profile
      // mutation does, so the completion percentage refreshes with it.
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

  const resetEdits = () => {
    if (profile) {
      setValues(profile);
      setFacilities(profile.accessibilityFacilities || []);
    }
    setErrors({});
  };

  const handleSaveSection = async (fields, done) => {
    const sectionErrors = validateCompanyFields(values, fields);
    if (Object.keys(sectionErrors).length > 0) {
      setErrors(sectionErrors);
      return;
    }

    try {
      await save(values);
      done();
      toast({ title: "Company profile updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveAccessibility = async () => {
    try {
      await saveAccessibility(facilities);
      setEditingAccess(false);
      toast({ title: "Accessibility facilities updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    try {
      await submitForVerification();
      toast({
        title: "Submitted for verification",
        description: "An admin will review your company profile shortly.",
      });
    } catch (err) {
      toast({
        title: "Could not submit",
        description: err?.message || "Complete all required fields first.",
        variant: "destructive",
      });
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

  const verificationStatus = user?.verificationStatus ?? "none";
  const canSubmit =
    completion?.missingRequired.length === 0 &&
    profile?.onboardingStatus !== "COMPLETE";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30">
        <div className="container py-8">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Company Profile</h1>
            <p className="mt-1 text-muted-foreground">
              This is what candidates see when they view your company.
            </p>
          </header>

          {loadError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* ---------- Main column ---------- */}
            <div className="space-y-6 lg:col-span-2">
              {/* Company basics */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                    Company details
                  </CardTitle>

                  {editingBasics ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          resetEdits();
                          setEditingBasics(false);
                        }}
                        disabled={saving}>
                        <X className="mr-1 h-4 w-4" aria-hidden="true" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveSection(BASIC_FIELDS, () => setEditingBasics(false))}
                        disabled={saving}>
                        {saving ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Save className="mr-1 h-4 w-4" aria-hidden="true" />
                        )}
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditingBasics(true)}>
                      <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  )}
                </CardHeader>

                <CardContent>
                  {editingBasics ? (
                    <CompanyBasicsFields values={values} onChange={setField} errors={errors} disabled={saving} />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ReadOnlyRow label="Company name" value={profile?.companyName} />
                        <ReadOnlyRow label="Industry" value={profile?.industry} />
                        <ReadOnlyRow
                          label="Company size"
                          value={
                            profile?.companySize
                              ? COMPANY_SIZE_LABELS[profile.companySize] || profile.companySize
                              : undefined
                          } />
                        <ReadOnlyRow label="Founded" value={profile?.foundedYear} />
                        <ReadOnlyRow icon={Globe} label="Website" value={profile?.website} />
                      </div>
                      <ReadOnlyRow label="Description" value={profile?.companyDescription} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* HR contact */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
                    HR contact & location
                  </CardTitle>

                  {editingContact ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          resetEdits();
                          setEditingContact(false);
                        }}
                        disabled={saving}>
                        <X className="mr-1 h-4 w-4" aria-hidden="true" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleSaveSection(CONTACT_FIELDS, () => setEditingContact(false))
                        }
                        disabled={saving}>
                        {saving ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Save className="mr-1 h-4 w-4" aria-hidden="true" />
                        )}
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditingContact(true)}>
                      <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  )}
                </CardHeader>

                <CardContent>
                  {editingContact ? (
                    <CompanyContactFields values={values} onChange={setField} errors={errors} disabled={saving} />
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ReadOnlyRow label="HR contact person" value={profile?.hrContactPerson} />
                      <ReadOnlyRow icon={Phone} label="HR contact number" value={profile?.hrContactNumber} />
                      <ReadOnlyRow icon={Mail} label="Company email" value={profile?.companyEmail} />
                      <ReadOnlyRow label="LinkedIn" value={profile?.linkedin} />
                      <ReadOnlyRow
                        icon={MapPin}
                        label="Location"
                        value={
                          [profile?.city, profile?.state, profile?.country]
                            .filter(Boolean)
                            .join(", ") || undefined
                        } />
                      <ReadOnlyRow label="GST number" value={profile?.gstNumber} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Accessibility facilities */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Accessibility className="h-5 w-5 text-primary" aria-hidden="true" />
                    Accessibility facilities
                  </CardTitle>

                  {editingAccess ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          resetEdits();
                          setEditingAccess(false);
                        }}
                        disabled={saving}>
                        <X className="mr-1 h-4 w-4" aria-hidden="true" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveAccessibility} disabled={saving}>
                        {saving ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Save className="mr-1 h-4 w-4" aria-hidden="true" />
                        )}
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditingAccess(true)}>
                      <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  )}
                </CardHeader>

                <CardContent>
                  {editingAccess ? (
                    <AccessibilityFacilitiesPicker
                      value={facilities}
                      onChange={setFacilities}
                      disabled={saving}
                      hint="These apply company-wide. Individual jobs can list extra accessibility features." />
                  ) : profile?.accessibilityFacilities?.length ? (
                    <ul className="flex flex-wrap gap-2">
                      {profile.accessibilityFacilities.map((f) => (
                        <li key={f}>
                          <Badge variant="secondary">{f}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No accessibility facilities listed yet. Candidates rely on this
                      to decide whether they can work with you.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ---------- Sidebar ---------- */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Company logo</CardTitle>
                </CardHeader>
                <CardContent>
                  <CompanyLogoUpload
                    currentLogo={profile?.companyLogo}
                    companyName={profile?.companyName}
                    onUploaded={applyResponse} />
                </CardContent>
              </Card>

              {/* Verification documents. Required for submission — an admin
                  approving a company with no proof attached is the verification
                  gate doing nothing. */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                  <FileCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base">Verification documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DocumentList
                    documents={profile?.verificationDocuments || []}
                    onDelete={handleDeleteDocument}
                    emptyMessage="Upload proof of incorporation, GST registration or company PAN so an admin can verify your company." />
                  <VerificationDocumentUpload
                    endpoint="/recruiter/profile/verification-document"
                    method="PATCH"
                    docTypes={RECRUITER_DOC_TYPES}
                    onUploaded={applyResponse} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base">Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatusBadge status={verificationStatus} />

                  <p className="text-sm text-muted-foreground">
                    {verificationStatus === "approved"
                      ? "Your company is verified. You can post jobs."
                      : verificationStatus === "rejected"
                        ? user?.rejectionReason ||
                          "Your verification was rejected. Update your details and resubmit."
                        : "An admin reviews every employer before job posting is unlocked."}
                  </p>

                  {canSubmit && (
                    <Button className="w-full" onClick={handleSubmit} disabled={saving}>
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      Submit for verification
                    </Button>
                  )}

                  {verificationStatus !== "approved" && (
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/recruiter/verification-pending">View status</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <RecruiterProfileCompleteness completion={completion} showCta={false} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RecruiterProfilePage;
