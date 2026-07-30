import { Accessibility, Mail, Shield, FileText } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const handleNavClick = (e, href) => {
    e.preventDefault();
    const [path, hash] = href.split("#");
    if (location.pathname === "/" || location.pathname === path) {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/");
      setTimeout(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  return (
    <footer
      className="border-t bg-muted/50"
      role="contentinfo"
      aria-label="Site footer">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2 text-lg font-bold text-primary">
              <Accessibility className="h-6 w-6" aria-hidden="true" />
              <span>AbelUp</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          <nav aria-label={t("footer.quickLinks")}>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t("footer.quickLinks")}</h3>
            <ul className="space-y-2 text-sm">
              <li><a
                href="/#about"
                onClick={(e) => handleNavClick(e, "/#about")}
                className="text-muted-foreground hover:text-primary">{t("nav.about")}</a></li>
              <li><a
                href="/#how-it-works"
                onClick={(e) => handleNavClick(e, "/#how-it-works")}
                className="text-muted-foreground hover:text-primary">{t("nav.howItWorks")}</a></li>
              <li><Link to="/jobs" className="text-muted-foreground hover:text-primary">{t("landing.browseJobs")}</Link></li>
            </ul>
          </nav>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t("footer.legal")}</h3>
            <ul className="space-y-2 text-sm">
              <li><a
                href="#"
                className="text-muted-foreground hover:text-primary flex items-center gap-1"><Shield className="h-3 w-3" aria-hidden="true" /> {t("footer.privacy")}</a></li>
              <li><a
                href="#"
                className="text-muted-foreground hover:text-primary flex items-center gap-1"><FileText className="h-3 w-3" aria-hidden="true" /> {t("footer.accessibilityStatement")}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t("footer.contact")}</h3>
            <a
              href="mailto:hello@abelup.com"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
              <Mail className="h-4 w-4" aria-hidden="true" /> hello@abelup.com
            </a>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
