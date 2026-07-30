import { CheckCircle2, Clock, XCircle, CalendarCheck, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusOrder = ["APPLIED", "SHORTLISTED", "INTERVIEW", "HIRED"];

const getSteps = (status, appliedDate, updatedDate) => {
  const upperStatus = status.toUpperCase();
  const isRejected = upperStatus === "REJECTED";
  const currentIndex = isRejected ? 1 : statusOrder.indexOf(upperStatus);

  const steps = [
    {
      label: "Applied",
      date: appliedDate,
      active: currentIndex === 0,
      completed: currentIndex > 0,
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    {
      label: isRejected ? "Rejected" : "Shortlisted",
      date: currentIndex >= 1 ? updatedDate : undefined,
      active: currentIndex === 1,
      completed: currentIndex > 1,
      icon: isRejected ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />,
    },
    {
      label: "Interview",
      date: currentIndex >= 2 ? updatedDate : undefined,
      active: currentIndex === 2,
      completed: currentIndex > 2,
      icon: <CalendarCheck className="h-5 w-5" />,
    },
    {
      label: "Hired",
      date: currentIndex >= 3 ? updatedDate : undefined,
      active: currentIndex === 3,
      completed: currentIndex >= 3,
      icon: <Trophy className="h-5 w-5" />,
    },
  ];

  return steps;
};

const ApplicationTimeline = ({
  status,
  appliedDate,
  updatedDate
}) => {
  const steps = getSteps(status, appliedDate, updatedDate);
  const isRejected = status.toUpperCase() === "REJECTED";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Application Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {steps.map((step, i) => (
            <div key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`rounded-full p-1.5 ${
                    step.completed
                      ? "bg-primary text-primary-foreground"
                      : step.active
                      ? isRejected && i === 1
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary/20 text-primary ring-2 ring-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                  {step.completed ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                </div>
                <span
                  className={`text-[10px] font-medium text-center leading-tight ${
                    step.active || step.completed ? "text-foreground" : "text-muted-foreground"
                  }`}>
                  {step.label}
                </span>
                {step.date && (
                  <span className="text-[9px] text-muted-foreground">{step.date}</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 ${
                    step.completed ? "bg-primary" : "bg-muted"
                  }`} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApplicationTimeline;
