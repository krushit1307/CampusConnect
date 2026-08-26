import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import i18n from "@/i18n";

const supportedLanguages = ["en", "es"];

export default function LanguageRouter() {
  const { lang } = useParams();

  useEffect(() => {
    if (lang && supportedLanguages.includes(lang)) {
      i18n.changeLanguage(lang);
    }
  }, [lang]);

  return <Outlet />;
}
