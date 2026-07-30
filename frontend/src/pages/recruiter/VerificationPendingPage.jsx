import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StatusBadge from "@/components/shared/StatusBadge";
import {
  Clock,
  ShieldCheck,
  XCircle,
  RefreshCw,
  Pencil,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Where a recruiter waits between submitting their company profile and an
 * admin approving it (spec §5). Also the landing spot after a rejection,
 * where the reason is shown alongside a route back into editing.
 */
const VerificationPendingPage = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  const status = user?.verificationStatus ?? "pending";
  const rejected = status === "rejected";

  // Pull fresh status on mount — approval happens server-side while the
  // recruiter sits on this page.
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (status === "approved") {
      navigate("/recruiter", { replace: true });
    }
  }, [status, navigate]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const fresh = await refreshUser();
      if (fresh?.verificationStatus === "approved") {
        toast({ title: "You're verified!", description: "You can now post jobs." });
        navigate("/recruiter", { replace: true });
      } else {
        toast({
          title: "Still under review",
          description: "We'll email you as soon as an admin approves your company.",
        });
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center bg-muted/30">
        <div className="container max-w-2xl py-12">
          <Card>
            <CardHeader className="items-center text-center">
              <div
                className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                  rejected ? "bg-destructive/10" : "bg-warning/10"
                }`}>
                {rejected ? (
                  <XCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                ) : (
                  <Clock className="h-8 w-8 text-warning" aria-hidden="true" />
                )}
              </div>

              <CardTitle className="text-2xl">
                {rejected ? "Verification unsuccessful" : "Verification in progress"}
              </CardTitle>

              <div className="pt-2">
                <StatusBadge status={status} />
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="text-center text-muted-foreground">
                {rejected ? (
                  <>
                    We could not verify{" "}
                    <span className="font-medium text-foreground">
                      {user?.recruiterProfile?.companyName || "your company"}
                    </span>
                    . Update your company profile and submit it again.
                  </>
                ) : (
                  <>
                    We're reviewing{" "}
                    <span className="font-medium text-foreground">
                      {user?.recruiterProfile?.companyName || "your company"}
                    </span>
                    . This usually takes one business day — you'll get an email
                    the moment you're approved.
                  </>
                )}
              </p>

              {rejected && user?.rejectionReason && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    <span className="font-medium">Reason: </span>
                    {user.rejectionReason}
                  </AlertDescription>
                </Alert>
              )}

              {!rejected && (
                <div className="rounded-lg border border-border bg-background p-4">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                    What happens next
                  </h2>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li>1. An admin reviews your company details.</li>
                    <li>2. You receive a confirmation email.</li>
                    <li>3. Job posting unlocks on your dashboard.</li>
                  </ol>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCheck}
                  disabled={checking}>
                  {checking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Check status
                </Button>

                <Button asChild className="flex-1">
                  <Link to="/recruiter/profile">
                    <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                    Edit company profile
                  </Link>
                </Button>
              </div>

              <p className="text-center text-sm">
                <Link
                  to="/recruiter"
                  className="text-primary underline-offset-4 hover:underline">
                  Go to dashboard
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VerificationPendingPage;
