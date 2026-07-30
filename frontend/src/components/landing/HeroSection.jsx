import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

const HeroSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section
      className="relative overflow-hidden bg-secondary/30 py-20 md:py-32"
      id="about"
      aria-labelledby="hero-heading">
      <div className="absolute inset-0 -z-10 opacity-30" aria-hidden="true">
        <div
          className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div
          className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <span
            className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            India's Inclusive Job Platform
          </span>
          <h1
            id="hero-heading"
            className="mb-6 text-4xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl text-balance">
            {t("landing.heroTitle")}
          </h1>
          <p
            className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t("landing.heroSubtitle")}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="min-w-[200px] text-base gap-2"
              onClick={() => navigate("/register")}>
              {t("landing.getStarted")} <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-w-[200px] text-base gap-2"
              onClick={() => navigate("/jobs")}>
              <Search className="h-5 w-5" aria-hidden="true" /> {t("landing.browseJobs")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
