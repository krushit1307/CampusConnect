import { BugReportModal } from "@/components/Modals/BugReportModal";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Github from "lucide-react/dist/esm/icons/github";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const NAV_LINK_KEYS = [
  { key: "navbar.events", to: "/events" },
  { key: "navbar.clubs", to: "/clubs" },
  { key: "navbar.feed", to: "/feed" },
  { key: "navbar.directory", to: "/directory" },
  { key: "navbar.certificates", to: "/certificates" },
  { key: "navbar.dashboard", to: "/dashboard" },
];

const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/krushit1307/CampusConnect",
    icon: <Github className="h-4 w-4" />,
  },
  {
    label: "Discord",
    href: "https://discord.gg/BEMjApACe",
    icon: <MessageCircle className="h-4 w-4" />,
  },
  {
    label: "Docs",
    href: "https://github.com/krushit1307/CampusConnect#readme",
    icon: <ExternalLink className="h-4 w-4" />,
  },
];

export function Footer() {
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t-4 border-black bg-lime shadow-[0_-4px_0_0_var(--color-ink)]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="neu-border inline-block w-fit bg-black px-3 py-1 shadow-[4px_4px_0_0_var(--color-ink)]">
              <span className="font-display text-lg font-black text-lime">CampusConnect</span>
            </div>
            <p className="max-w-xs font-mono text-xs leading-relaxed text-black">
              {t("footer.tagline")}
            </p>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black">
              {t("footer.license")}
            </p>
          </div>

          {/* Nav Links */}
          <div className="flex flex-col gap-3">
            <p className="neu-border inline-block w-fit bg-black px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-lime shadow-[3px_3px_0_0_var(--color-ink)]">
              {t("footer.navigate")}
            </p>
            <ul className="space-y-2">
              {NAV_LINK_KEYS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="font-mono text-xs font-bold uppercase tracking-wide text-black underline-offset-4 hover:underline"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Links */}
          <div className="flex flex-col gap-3">
            <p className="neu-border inline-block w-fit bg-black px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-lime shadow-[3px_3px_0_0_var(--color-ink)]">
              {t("footer.community")}
            </p>
            <div className="flex flex-col gap-2">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="neu-border inline-flex w-fit items-center gap-2 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-[3px_3px_0_0_var(--color-ink)] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_0_var(--color-ink)]"
                >
                  {s.icon}
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t-2 border-black pt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black">
            {t("footer.copyright", { year: currentYear })}
          </p>

          <div className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="font-mono text-[10px] font-bold uppercase tracking-widest text-black underline-offset-4 hover:underline"
            >
              {t("footer.privacy")}
            </Link>
            <Link
              to="/terms"
              className="font-mono text-[10px] font-bold uppercase tracking-widest text-black underline-offset-4 hover:underline"
            >
              {t("footer.terms")}
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <BugReportModal open={bugReportOpen} onOpenChange={setBugReportOpen} />
            <p className="font-mono text-[10px] uppercase tracking-widest text-black">
              {t("footer.version")}
            </p>
          </div>
        </div>

        {/* Language switcher — inside the footer layout, not outside it */}
        <div className="mt-4 border-t-2 border-black pt-4">
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
