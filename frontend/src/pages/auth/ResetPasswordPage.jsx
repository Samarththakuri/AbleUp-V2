import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accessibility, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError(
        "Invalid or missing reset token. Please request a new password reset link."
      );
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Both fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token, password }
      });
      
      toast.success("Password reset successfully. You can now log in.");
      navigate("/login");
    } catch (err) {
      setError(err?.message || "Failed to reset password. The link might be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
             <Link
               to="/"
               className="mx-auto mb-4 flex items-center gap-2 text-xl font-bold text-primary">
              <Accessibility className="h-7 w-7" /> AbelUp
            </Link>
            <CardTitle className="text-2xl text-destructive">Invalid Link</CardTitle>
            <CardDescription>The password reset link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link to="/forgot-password">Request New Link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link
            to="/"
            className="mx-auto mb-4 flex items-center gap-2 text-xl font-bold text-primary">
            <Accessibility className="h-7 w-7" /> AbelUp
          </Link>
          <CardTitle className="text-2xl">Create New Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                role="alert">
                <p>{error}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required />
            </div>
            
            <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
              <KeyRound className="h-5 w-5" /> {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
