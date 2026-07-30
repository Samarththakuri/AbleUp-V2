import { Users, ListFilter, Megaphone, Building2, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Megaphone, title: "Post Inclusive Jobs", desc: "Create listings that highlight accessibility and inclusivity." },
  { icon: ListFilter, title: "Filter Applicants", desc: "Search verified candidates by skills, disability type, and more." },
  { icon: Building2, title: "Accessibility Listings", desc: "Showcase your workplace accessibility features to attract talent." },
  { icon: Heart, title: "Promote Diversity Hiring", desc: "Strengthen your brand with genuine commitment to inclusion." },
];

const ForRecruiters = () => {
  const navigate = useNavigate();

  return (
    <section
      className="py-20 bg-background"
      id="recruiters"
      aria-labelledby="recruiters-heading">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div
            className="order-2 flex items-center justify-center lg:order-1"
            aria-hidden="true">
            <div
              className="h-72 w-full max-w-sm rounded-2xl bg-gradient-to-br from-accent/10 via-muted to-primary/10 flex items-center justify-center">
              <Users className="h-24 w-24 text-accent/30" />
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <span
              className="mb-2 inline-block text-sm font-semibold uppercase tracking-wider text-accent">For Recruiters</span>
            <h2
              id="recruiters-heading"
              className="mb-4 text-3xl font-bold text-foreground">Hire Inclusively. Grow Stronger.</h2>
            <p className="mb-8 text-muted-foreground">Access a pool of verified, talented candidates with disabilities. Make your workplace truly inclusive.</p>
            <ul className="space-y-4" role="list">
              {features.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90"
              size="lg"
              onClick={() => navigate("/register")}>Hire Inclusively</Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForRecruiters;
