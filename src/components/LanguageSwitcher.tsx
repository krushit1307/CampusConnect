import { useTranslation } from "react-i18next";
import { useEffect } from "react";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
    // RTL layout flip logic
    if (newLang === "ar" || newLang === "he") {
      document.documentElement.dir = "rtl";
    } else {
      document.documentElement.dir = "ltr";
    }
  };

  useEffect(() => {
    if (i18n.language === "ar" || i18n.language === "he") {
      document.documentElement.dir = "rtl";
    } else {
      document.documentElement.dir = "ltr";
    }
  }, [i18n.language]);

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="lang-select" className="text-sm font-medium">
        {t("settings.language") || "Language"}:
      </label>
      <select
        id="lang-select"
        className="form-select text-sm rounded-md border-gray-300 dark:bg-gray-800 dark:border-gray-700"
        value={i18n.language}
        onChange={handleLanguageChange}
      >
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="zh">中文</option>
      </select>
    </div>
  );
}
