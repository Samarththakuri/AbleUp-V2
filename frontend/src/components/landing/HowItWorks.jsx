import { UserPlus, ShieldCheck, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    icon: UserPlus,
    title: "Register with UDID",
    description: "Create your account and provide your Unique Disability ID for verification.",
  },
  {
    icon: ShieldCheck,
    title: "Get Verified by Admin",
    description: "Our team verifies your UDID document to ensure a trusted platform for all.",
  },
  {
    icon: Briefcase,
    title: "Apply to Inclusive Jobs",
    description: "Browse jobs with accessibility info and apply with confidence.",
  },
];

const HowItWorks = () => {
  return (
    <section
      className="py-20 bg-background"
      id="how-it-works"
      aria-labelledby="how-heading">
      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 id="how-heading" className="mb-3 text-3xl font-bold text-foreground">How It Works</h2>
          <p className="text-muted-foreground">Three simple steps to your next inclusive opportunity.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <Card
              key={step.title}
              className="relative overflow-hidden border-2 border-transparent transition-all hover:border-primary/20 hover:shadow-lg animate-fade-in"
              style={{ animationDelay: `${i * 150}ms` }}>
              <CardContent className="flex flex-col items-center p-8 text-center">
                <div
                  className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <step.icon className="h-8 w-8" aria-hidden="true" />
                </div>
                <span className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">Step {i + 1}</span>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
