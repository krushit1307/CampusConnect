import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      zh: { translation: zh },
      ar: { translation: ar },
    },

    // Fallback if detected language has no translation
    fallbackLng: "en",

    // Detection order: localStorage → browser language → default
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "campusconnect-language",
      caches: ["localStorage"],
    },

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
