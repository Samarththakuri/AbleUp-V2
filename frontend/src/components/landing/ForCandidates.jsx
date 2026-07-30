import { Filter, Clock, Upload, BadgeCheck, Accessibility } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Filter, title: "Filter by Disability Type", desc: "Find jobs matching your specific needs and abilities." },
  { icon: Clock, title: "Flexible Work Hours", desc: "Discover roles with part-time, flexi-time, and remote options." },
  { icon: Accessibility, title: "Accessibility Details", desc: "Every listing shows workplace accessibility features." },
  { icon: Upload, title: "Resume Upload", desc: "Upload and manage your resume with a single click." },
  { icon: BadgeCheck, title: "Verification Badge", desc: "UDID-verified candidates get a trusted badge on their profile." },
];

const ForCandidates = () => {
  const navigate = useNavigate();

  return (
    <section
      className="py-20 bg-secondary/30"
      id="candidates"
      aria-labelledby="candidates-heading">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span
              className="mb-2 inline-block text-sm font-semibold uppercase tracking-wider text-primary">For Candidates</span>
            <h2
              id="candidates-heading"
              className="mb-4 text-3xl font-bold text-foreground">Your Abilities, Your Future</h2>
            <p className="mb-8 text-muted-foreground">AbelUp is built around your needs — from accessible job search to verified profiles that employers trust.</p>
            <ul className="space-y-4" role="list">
              {features.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button className="mt-8" size="lg" onClick={() => navigate("/register")}>Join as Candidate</Button>
          </div>
          <div className="flex items-center justify-center" aria-hidden="true">
            <div
              className="h-72 w-full max-w-sm rounded-2xl bg-gradient-to-br from-primary/10 via-secondary to-accent/10 flex items-center justify-center">
              <Accessibility className="h-24 w-24 text-primary/30" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForCandidates;
