import { describe, expect, it } from "vitest";
import {
  convertUsdToCurrency,
  currencyForLocale,
  formatCurrencyAmount,
  isSupportedCurrency,
  normalizeCurrency,
} from "./currency";

describe("currency helpers", () => {
  it("normalizes only supported currency codes", () => {
    expect(normalizeCurrency(" eur ")).toBe("EUR");
    expect(normalizeCurrency("not-a-currency")).toBeNull();
    expect(isSupportedCurrency("INR")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
  });

  it("maps common locales to their local display currency", () => {
    expect(currencyForLocale("de-DE")).toBe("EUR");
    expect(currencyForLocale("en-IN")).toBe("INR");
    expect(currencyForLocale("en-US")).toBe("USD");
    expect(currencyForLocale("unknown")).toBe("USD");
  });

  it("converts USD amounts to cents-rounded estimates", () => {
    expect(convertUsdToCurrency(50, 0.924)).toBe(46.2);
    expect(convertUsdToCurrency(12.345, 1.1)).toBe(13.58);
    expect(convertUsdToCurrency(10, -1)).toBe(0);
  });

  it("formats estimates using the requested currency", () => {
    expect(formatCurrencyAmount(46.2, "EUR", "en-US")).toContain("€46.20");
  });
});
