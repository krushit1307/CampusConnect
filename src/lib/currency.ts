export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "INR", name: "Indian Rupee" },
  { code: "GBP", name: "British Pound" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "KRW", name: "South Korean Won" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "ZAR", name: "South African Rand" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map(({ code }) => code) as [
  CurrencyCode,
  ...CurrencyCode[],
];

const LOCALE_CURRENCY_MAP: Record<string, CurrencyCode> = {
  AE: "AED",
  AU: "AUD",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  DE: "EUR",
  ES: "EUR",
  FR: "EUR",
  GB: "GBP",
  HK: "HKD",
  IN: "INR",
  IT: "EUR",
  JP: "JPY",
  KR: "KRW",
  NZ: "NZD",
  SG: "SGD",
  US: "USD",
  ZA: "ZAR",
};

export function isSupportedCurrency(value: string | null | undefined): value is CurrencyCode {
  return SUPPORTED_CURRENCY_CODES.includes((value || "").toUpperCase() as CurrencyCode);
}

export function normalizeCurrency(value: string | null | undefined): CurrencyCode | null {
  const normalized = value?.trim().toUpperCase();
  return isSupportedCurrency(normalized) ? normalized : null;
}

export function currencyForLocale(locale: string | null | undefined): CurrencyCode {
  const region = locale?.split("-")[1]?.toUpperCase();
  return LOCALE_CURRENCY_MAP[region || ""] || "USD";
}

export function convertUsdToCurrency(amountUsd: number, rate: number): number {
  if (!Number.isFinite(amountUsd) || !Number.isFinite(rate) || rate < 0) return 0;
  return Math.round(amountUsd * rate * 100) / 100;
}

export function formatCurrencyAmount(
  amount: number,
  currency: CurrencyCode,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale || undefined, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(amount);
}
