import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, FileCheck, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Renders the SERVER-computed completion percentage (spec §6).
 *
 * Unlike the candidate equivalent, which recomputes its checklist in the
 * browser, this component only displays what
 * recruiterProfileService.computeProfileCompletion returned — so the number on
 * the dashboard always matches the one that gates submission for verification.
 */
const RecruiterProfileCompleteness = ({
  completion,
  showCta = true,
  ctaHref = "/recruiter/profile"
}) => {
  if (!completion) return null;

  const { percentage, checks } = completion;
  const complete = percentage === 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <FileCheck
          className={complete ? "h-5 w-5 text-green-600" : "h-5 w-5 text-amber-600"}
          aria-hidden="true" />
        <CardTitle className="text-base">Profile Completion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Progress
            value={percentage}
            className="h-3 flex-1"
            aria-label={`Company profile ${percentage} percent complete`} />
          <span className="text-sm font-bold text-foreground">{percentage}%</span>
        </div>

        {!complete && (
          <p className="text-sm text-muted-foreground">Profile Incomplete</p>
        )}

        <ul className="space-y-2">
          {checks.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
                {item.label}
                {item.required && !item.done && (
                  <span className="ml-1 text-xs text-amber-600">(required)</span>
                )}
              </span>
            </li>
          ))}
        </ul>

        {showCta && !complete && (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={ctaHref}>
              Complete profile
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default RecruiterProfileCompleteness;
