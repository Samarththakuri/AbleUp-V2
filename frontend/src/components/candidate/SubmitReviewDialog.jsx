import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import StarRating from "@/components/shared/StarRating";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const MIN_COMMENT = 10;

/**
 * Candidate → recruiter review form.
 *
 * Note there is no recruiter selector: the backend derives the recruiter from
 * the interview, so there is nothing here the client could point at the wrong
 * company.
 */
const SubmitReviewDialog = ({
  open,
  onOpenChange,
  interviewId,
  companyName,
  jobTitle,
  onSubmitted
}) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setRating(0);
    setComment("");
    setError("");
  };

  const handleSubmit = async () => {
    setError("");

    if (rating < 1) {
      setError("Please select a rating.");
      return;
    }
    if (comment.trim().length < MIN_COMMENT) {
      setError(`Please write at least ${MIN_COMMENT} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await api("/reviews/submit", {
        method: "POST",
        body: { interviewId, rating, comment: comment.trim() },
      });
      toast({
        title: "Review submitted",
        description: `Thanks for sharing your experience with ${companyName}.`,
      });
      reset();
      onOpenChange(false);
      onSubmitted();
    } catch (err) {
      setError(err?.message || "Could not submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Review {companyName}</DialogTitle>
          <DialogDescription>
            Your review is public on {companyName}'s company page and helps other
            candidates decide whether to apply. Interviewed for {jobTitle}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="review-rating">Your rating *</Label>
            <StarRating
              value={rating}
              onChange={setRating}
              size="lg"
              label="Your rating out of 5" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-comment">Your experience *</Label>
            <Textarea
              id="review-comment"
              rows={5}
              placeholder="How was the interview process? Was the workplace accessible? Were your accommodation needs handled well?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              aria-describedby="review-comment-hint" />
            <p id="review-comment-hint" className="text-xs text-muted-foreground">
              At least {MIN_COMMENT} characters. {comment.trim().length} entered.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitReviewDialog;
