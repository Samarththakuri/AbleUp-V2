import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatusBadge from "@/components/shared/StatusBadge";
import ResumeUpload from "@/components/candidate/ResumeUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  FileCheck,
  Pencil,
  Save,
  Loader2,
} from "lucide-react";
import DocumentList from "@/components/shared/DocumentList";
import VerificationDocumentUpload from "@/components/shared/VerificationDocumentUpload";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DISABILITY_TYPES, CANDIDATE_DOC_TYPES } from "@/constants/company";

// The backend enforces this exact list as an enum on
// CandidateProfile.disabilityType, so a local copy that drifts becomes a 400.
const disabilityTypes = DISABILITY_TYPES;

const CandidateProfile = () => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [disabilityType, setDisabilityType] = useState(user?.disabilityType || "");
  const [udidNumber, setUdidNumber] = useState(user?.udidNumber || "");
  const [preferredWorkHours, setPreferredWorkHours] = useState("");
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api("/candidate/profile");
        if (data.profile) {
          setDisabilityType(data.profile.disabilityType || "");
          setUdidNumber(data.profile.udidNumber || "");
          setPreferredWorkHours(data.profile.preferredWorkHours || "");
          setDocuments(data.profile.verificationDocuments || []);
        }
        if (data.user) {
          setName(data.user.name || "");
        }
      } catch {
        // Use context data as fallback
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api("/candidate/profile", {
        method: "PUT",
        body: { name, disabilityType, preferredWorkHours },
      });
      updateUser({ name, disabilityType });
      toast({ title: "Profile updated" });
    } catch {
      updateUser({ name, disabilityType });
      toast({ title: "Profile updated (offline)" });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleDeleteDocument = async (doc) => {
    try {
      const res = await api(
        "/candidate/verification-document",
        { method: "DELETE", body: { url: doc.url } }
      );
      setDocuments(res.verificationDocuments || []);
      toast({ title: "Document removed", description: doc.docType });
    } catch (err) {
      toast({
        title: "Could not remove document",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const isVerified = user?.verificationStatus === "approved";

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30" id="main-content">
        <div className="container py-8">
          <h1 className="mb-6 text-2xl font-bold text-foreground">
            My Profile
          </h1>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-primary" aria-hidden="true" />
                    Personal Details
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => (editing ? handleSave() : setEditing(true))}
                    disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editing ? (
                      <>
                        <Save className="h-4 w-4" /> Save
                      </>
                    ) : (
                      <>
                        <Pencil className="h-4 w-4" /> Edit
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-name">Full Name</Label>
                      {editing ? (
                        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
                      ) : (
                        <p className="text-sm text-foreground">
                          {name || user?.name || "—"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-email">Email</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm text-foreground">
                          {user?.email || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-phone">Phone</Label>
                      {editing ? (
                        <Input
                          id="profile-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Enter phone number" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <p className="text-sm text-foreground">
                            {phone || "Not provided"}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-location">Location</Label>
                      {editing ? (
                        <Input
                          id="profile-location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="City, State" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <p className="text-sm text-foreground">
                            {location || "Not provided"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      Disability Information
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="profile-disability">
                          Disability Type
                        </Label>
                        {editing ? (
                          <Select value={disabilityType} onValueChange={setDisabilityType}>
                            <SelectTrigger id="profile-disability">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {disabilityTypes.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-foreground">
                            {disabilityType || "Not specified"}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>UDID Number</Label>
                        <p className="text-sm text-foreground">
                          {udidNumber || user?.udidNumber || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                    Verification Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <StatusBadge status={user?.verificationStatus || "pending"} />
                    <p className="text-sm text-muted-foreground">
                      {isVerified
                        ? "You are verified and can apply for jobs."
                        : "Your profile is under review. You'll be able to apply once verified by an admin."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Verification documents — the proof an admin reviews before
                  approving the account. Nothing could write to this array
                  until the /candidate/verification-document endpoints existed,
                  so admins were deciding with nothing attached. */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                    Verification Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DocumentList
                    documents={documents}
                    onDelete={handleDeleteDocument}
                    emptyMessage="Upload your UDID card or disability certificate so an admin can verify your account." />
                  <VerificationDocumentUpload
                    endpoint="/candidate/verification-document"
                    docTypes={CANDIDATE_DOC_TYPES}
                    onUploaded={(res) =>
                      setDocuments(res.verificationDocuments || [])
                    } />
                </CardContent>
              </Card>

              <ResumeUpload />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CandidateProfile;
