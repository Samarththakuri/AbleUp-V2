import { useTranslation } from "react-i18next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import ForCandidates from "@/components/landing/ForCandidates";
import ForRecruiters from "@/components/landing/ForRecruiters";
import AccessibilityCommitment from "@/components/landing/AccessibilityCommitment";

const LandingPage = () => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">{t("accessibility.skipToContent")}</a>
      <Navbar />
      <main id="main-content" role="main">
        <HeroSection />
        <HowItWorks />
        <ForCandidates />
        <ForRecruiters />
        <AccessibilityCommitment />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
