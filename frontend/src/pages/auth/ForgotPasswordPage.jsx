import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accessibility, ArrowLeft, Mail } from "lucide-react";
import { api } from "@/lib/api";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Email address is required.");
      return;
    }
    
    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email }
      });
      setSuccess(true);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your email to receive a password reset link</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-6 text-center">
              <div className="rounded-md bg-primary/10 p-4 text-sm text-primary">
                <p>If an account exists with that email, a reset link has been sent.</p>
                <p className="mt-2 font-medium">Please check your inbox.</p>
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link to="/login">Back to Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert">
                  <p>{error}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email" />
              </div>
              
              <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
                <Mail className="h-5 w-5" /> {loading ? "Sending..." : "Send Reset Link"}
              </Button>

              <div className="text-center mt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
