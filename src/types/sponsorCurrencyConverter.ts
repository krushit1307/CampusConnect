export interface SponsorPricingAsset {
  id: string;
  sponsorName: string;
  campaignTitle: string;
  logoUrl: string;
  targetUrl: string;
  basePriceUsd: number;
  promoBadgeText?: string;
  tier: 'platinum' | 'gold' | 'silver' | 'partner';
  supportedCurrencies?: string[];
  active: boolean;
}

export interface GeoLocationContext {
  ipAddress: string;
  countryCode: string;
  countryName: string;
  city: string;
  region: string;
  localCurrencyCode: string;
  currencySymbol: string;
}

export interface CurrencyConversionRate {
  baseCurrency: string;
  targetCurrency: string;
  multiplier: number;
  lastUpdated: string;
}

export interface LocalizedSponsorLogoRenderConfig {
  asset: SponsorPricingAsset;
  geoContext: GeoLocationContext;
  convertedPrice: number;
  formattedLocalPrice: string;
  svgBadgeOverlay: string; // Dynamic SVG overlay markup
}
