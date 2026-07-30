import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, FileCheck } from "lucide-react";

const ProfileCompleteness = ({
  profile
}) => {
  const checks = [
    { label: "Full name", done: !!profile.name },
    { label: "Email verified", done: !!profile.email },
    { label: "Disability type", done: !!profile.disabilityType },
    { label: "UDID verification", done: profile.verificationStatus === "approved" },
    { label: "Resume uploaded", done: !!profile.resumeUrl },
    { label: "Skills added", done: !!(profile.skills && profile.skills.length > 0) },
    { label: "Work hours preference", done: !!profile.preferredWorkHours },
  ];

  const completed = checks.filter((c) => c.done).length;
  const percentage = Math.round((completed / checks.length) * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <FileCheck className="h-5 w-5 text-green-600" aria-hidden="true" />
        <CardTitle className="text-base">Profile Completion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Progress value={percentage} className="flex-1 h-3" />
          <span className="text-sm font-bold text-foreground">{percentage}%</span>
        </div>
        <ul className="space-y-2">
          {checks.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default ProfileCompleteness;
