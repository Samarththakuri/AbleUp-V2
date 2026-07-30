import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Clock, MapPin, Video, Phone, Building2, CheckCircle2, RotateCcw, Loader2, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import SubmitReviewDialog from "@/components/candidate/SubmitReviewDialog";

const modeIcon = (mode) => {
  switch (mode) {
    case "ONLINE": return <Video className="h-4 w-4" />;
    case "IN_PERSON": return <Building2 className="h-4 w-4" />;
    case "PHONE": return <Phone className="h-4 w-4" />;
    default: return <Video className="h-4 w-4" />;
  }
};

const statusConfig = {
  SCHEDULED: { label: "Scheduled", className: "bg-primary/10 text-primary border-primary/20" },
  RESCHEDULED: { label: "Rescheduled", className: "bg-primary/10 text-primary border-primary/20" },
  ACCEPTED: { label: "Accepted", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  RESCHEDULE_REQUESTED: { label: "Reschedule Requested", className: "bg-accent/10 text-accent border-accent/20" },
  COMPLETED: { label: "Completed", className: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
};

const CandidateInterviewCard = ({
  interview,
  onUpdated
}) => {
  const { toast } = useToast();
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scheduledDate = new Date(interview.scheduledAt);
  const status = statusConfig[interview.status] || statusConfig.SCHEDULED;
  const canRespond = ["SCHEDULED", "RESCHEDULED"].includes(interview.status);

  // canReview / hasReviewed are computed by the backend so the eligibility
  // rule (interview attended, not already reviewed) lives in one place.
  const companyName = interview.companyName || "this company";

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await api(`/interviews/${interview._id}/respond`, {
        method: "PUT",
        body: { action: "accept" },
      });
      toast(
        { title: "Interview Accepted!", description: "You've confirmed the interview slot." }
      );
      onUpdated();
    } catch (err) {
      toast({ title: err.message || "Failed to accept", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRescheduleRequest = async () => {
    if (!rescheduleMessage.trim()) {
      toast({ title: "Please provide a reason", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api(`/interviews/${interview._id}/respond`, {
        method: "PUT",
        body: { action: "reschedule", message: rescheduleMessage },
      });
      toast(
        { title: "Reschedule Requested", description: "The recruiter will be notified." }
      );
      setShowRescheduleDialog(false);
      onUpdated();
    } catch (err) {
      toast(
        { title: err.message || "Failed to request reschedule", variant: "destructive" }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{interview.jobId.title}</h3>
                <Badge className={status.className}>{status.label}</Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {scheduledDate.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {scheduledDate.toLocaleTimeString("en-IN", { timeStyle: "short" })} ({interview.duration} min)
                </span>
                <span className="flex items-center gap-1">
                  {modeIcon(interview.mode)}
                  {interview.mode === "ONLINE" ? "Online" : interview.mode === "IN_PERSON" ? "In Person" : "Phone"}
                </span>
              </div>

              {interview.location && (
                <p className="text-sm text-primary flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {interview.mode === "ONLINE" ? (
                    <a
                      href={interview.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline">
                      Join Meeting
                    </a>
                  ) : interview.location}
                </p>
              )}

              {interview.notes && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1">
                  📝 {interview.notes}
                </p>
              )}
            </div>

            {canRespond && (
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={handleAccept} disabled={submitting}>
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setShowRescheduleDialog(true)}
                  disabled={submitting}>
                  <RotateCcw className="h-3 w-3" /> Request Reschedule
                </Button>
              </div>
            )}

            {/* Post-interview: leave a review. This slot rendered nothing at
                all before, which is why reviews had no entry point. */}
            {interview.canReview && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-yellow-400/40 text-yellow-700 hover:bg-yellow-50 dark:text-yellow-500 dark:hover:bg-yellow-950"
                onClick={() => setShowReviewDialog(true)}>
                <Star className="h-3 w-3" aria-hidden="true" /> Leave a review
              </Button>
            )}

            {interview.hasReviewed && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                Reviewed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
            <p className="text-sm text-muted-foreground">{interview.jobId.title}</p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Current slot: {scheduledDate.toLocaleDateString("en-IN")} at {scheduledDate.toLocaleTimeString("en-IN", { timeStyle: "short" })}
            </p>
            <Textarea
              placeholder="Please explain why you need a different time slot..."
              value={rescheduleMessage}
              onChange={(e) => setRescheduleMessage(e.target.value)}
              rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRescheduleDialog(false)}>Cancel</Button>
            <Button onClick={handleRescheduleRequest} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SubmitReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        interviewId={interview._id}
        companyName={companyName}
        jobTitle={interview.jobId.title}
        onSubmitted={onUpdated} />
    </>
  );
};

export default CandidateInterviewCard;
