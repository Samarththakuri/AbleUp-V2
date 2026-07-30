import { useState } from "react";
import { Eye, Keyboard, Monitor, ZoomIn, ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";

const commitments = [
  { icon: Monitor, title: "WCAG Compliant", desc: "Built to meet WCAG 2.1 AA standards." },
  { icon: ScanEye, title: "Screen-Reader Support", desc: "Semantic HTML and ARIA labels throughout." },
  { icon: Keyboard, title: "Keyboard Navigation", desc: "Every action is fully keyboard accessible." },
  { icon: Eye, title: "High Contrast Mode", desc: "Toggle high contrast for better visibility." },
  { icon: ZoomIn, title: "Adjustable Font Size", desc: "Increase text size for comfortable reading." },
];

const AccessibilityCommitment = () => {
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState("normal");

  const toggleContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle("high-contrast");
  };

  const cycleFontSize = () => {
    const next = fontScale === "normal" ? "large" : fontScale === "large" ? "xlarge" : "normal";
    document.documentElement.classList.remove("font-large", "font-xlarge");
    if (next !== "normal") document.documentElement.classList.add(`font-${next}`);
    setFontScale(next);
  };

  return (
    <section className="py-20 bg-secondary/30" aria-labelledby="a11y-heading">
      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 id="a11y-heading" className="mb-3 text-3xl font-bold text-foreground">Our Accessibility Commitment</h2>
          <p className="text-muted-foreground">AbelUp is built with accessibility at every level.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {commitments.map((c) => (
            <div
              key={c.title}
              className="flex items-start gap-3 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">{c.title}</h3>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={toggleContrast}
            aria-pressed={highContrast}
            className="gap-2">
            <Eye className="h-4 w-4" /> {highContrast ? "Disable" : "Enable"} High Contrast
          </Button>
          <Button variant="outline" onClick={cycleFontSize} className="gap-2">
            <ZoomIn className="h-4 w-4" /> Font: {fontScale === "normal" ? "Default" : fontScale === "large" ? "Large" : "Extra Large"}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default AccessibilityCommitment;
