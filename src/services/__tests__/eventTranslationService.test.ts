import { describe, it, expect } from "vitest";
import {
  detectLanguage,
  normalizeLocale,
  shouldShowTranslateButton,
} from "../eventTranslationService";

describe("eventTranslationService - Language Detection & Formatting", () => {
  it("detects Chinese language (Mandarin) correctly", () => {
    const text = "欢迎参加中国学生学者联合会的中秋晚会！精彩节目与月饼等你来。";
    expect(detectLanguage(text)).toBe("zh");
  });

  it("detects Japanese script correctly", () => {
    const text = "今週末のプログラミング勉強会へようこそ！";
    expect(detectLanguage(text)).toBe("ja");
  });

  it("detects Spanish accentuation correctly", () => {
    const text = "¡Únete a nuestra reunión de debate y poesía esta tarde!";
    expect(detectLanguage(text)).toBe("es");
  });

  it("defaults to English for standard Latin script without accent marks", () => {
    const text = "Join the robotics workshop this Friday in the lab!";
    expect(detectLanguage(text)).toBe("en");
  });

  it("normalizes locale correctly", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("zh-CN")).toBe("zh");
    expect(normalizeLocale("es-ES")).toBe("es");
  });

  it("shows translate button when post source language differs from user language", () => {
    expect(shouldShowTranslateButton("zh", "en-US")).toBe(true);
    expect(shouldShowTranslateButton("es", "en-GB")).toBe(true);
  });

  it("does NOT show translate button when source matches user language", () => {
    expect(shouldShowTranslateButton("en", "en-US")).toBe(false);
    expect(shouldShowTranslateButton("zh", "zh-CN")).toBe(false);
  });
});
