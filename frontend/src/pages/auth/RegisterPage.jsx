import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accessibility, UserPlus, Building2 } from "lucide-react";
import { DISABILITY_TYPES } from "@/constants/company";
import { getPostAuthRedirect } from "@/lib/navigation";

const RegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("candidate");
  const [disabilityType, setDisabilityType] = useState("");
  const [udidNumber, setUdidNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) { setError("Please fill in all required fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (role === "candidate" && !disabilityType) { setError("Please select a disability type."); return; }
    if (role === "candidate" && udidNumber && !/^[A-Z]{2}\d{10,18}$/i.test(udidNumber)) {
      setError(
        "Invalid UDID format. Expected format: 2 letters followed by 10-18 digits."
      ); return;
    }
    // RecruiterProfile.companyName is required server-side, and the profile is
    // created in the same transaction as the account.
    if (role === "recruiter" && companyName.trim().length < 2) {
      setError("Please enter your company name."); return;
    }

    setLoading(true);
    try {
      const user = await register({
        name,
        email,
        password,
        role,
        disabilityType,
        udidNumber,
        companyName: companyName.trim(),
      });
      // Auto-login happens in register. Recruiters continue into onboarding;
      // candidates land on their dashboard.
      navigate(getPostAuthRedirect(user), { replace: true });
    } catch (err) {
      setError(err?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Link
            to="/"
            className="mx-auto mb-4 flex items-center gap-2 text-xl font-bold text-primary">
            <Accessibility className="h-7 w-7" /> AbelUp
          </Link>
          <CardTitle className="text-2xl">Create Your Account</CardTitle>
          <CardDescription>Join AbelUp and unlock inclusive opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <div
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              role="alert">{error}</div>}

            <div className="space-y-2">
              <Label htmlFor="role">I am a</Label>
              <Select value={role} onValueChange={(v) => setRole(v)}>
                <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="candidate">Candidate (Job Seeker)</SelectItem>
                  <SelectItem value="recruiter">Recruiter (Employer)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email *</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Password * (min 6 characters)</Label>
              <Input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password" />
            </div>

            {role === "candidate" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="disability">Disability Type *</Label>
                  <Select value={disabilityType} onValueChange={setDisabilityType}>
                    <SelectTrigger id="disability"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {DISABILITY_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="udid">UDID Number</Label>
                  <Input
                    id="udid"
                    value={udidNumber}
                    onChange={(e) => setUdidNumber(e.target.value)}
                    placeholder="e.g. AB1234567890" />
                  <p className="text-xs text-muted-foreground">Your Unique Disability ID for verification.</p>
                </div>
              </>
            )}

            {role === "recruiter" && (
              <div className="space-y-2">
                <Label htmlFor="companyName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  Company Name *
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Inclusive Tech Solutions"
                  aria-describedby="companyName-hint"
                  required />
                <p id="companyName-hint" className="text-xs text-muted-foreground">
                  You'll add your company details and accessibility facilities in the
                  next step. An admin verifies every employer before job posting is
                  unlocked.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
              <UserPlus className="h-5 w-5" /> {loading ? "Creating account..." : "Register"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
