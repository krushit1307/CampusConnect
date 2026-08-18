/**
 * LanguageSwitcher — reusable language selector.
 *
 * Uses i18next changeLanguage() — no page reload, instant UI update.
 * The selected language is persisted to localStorage via the
 * i18next-browser-languagedetector config in src/i18n/index.ts.
 *
 * Styled to match the existing neubrutalist design system (neu-border,
 * font-mono, uppercase) so it blends naturally into the footer.
 */

import { useTranslation } from "react-i18next";
import { useEffect } from "react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
] as const;

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const currentLang = i18n.language?.split("-")[0] ?? "en";

  // Keep <html lang="..."> in sync with the active language (WCAG, SEO, AT)
  useEffect(() => {
    document.documentElement.lang = currentLang;
    const isRTL = currentLang === "ar" || currentLang === "he";
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
  }, [currentLang]);

  return (
    <div className="flex items-center gap-2" aria-label={t("language_switcher.label")}>
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black">
        {t("footer.language")}:
      </span>
      <div className="flex items-center gap-1">
        {LANGUAGES.map((lang) => {
          const isActive = currentLang === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => i18n.changeLanguage(lang.code)}
              aria-label={lang.label}
              aria-pressed={isActive}
              className={`neu-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-all
                ${
                  isActive
                    ? "bg-black text-lime shadow-none translate-x-[1px] translate-y-[1px]"
                    : "bg-white text-black shadow-[2px_2px_0_0_var(--color-ink)] hover:bg-lime hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--color-ink)]"
                }`}
            >
              {lang.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
