import {
  SponsorPricingAsset,
  GeoLocationContext,
  CurrencyConversionRate,
  LocalizedSponsorLogoRenderConfig,
} from '../types/sponsorCurrencyConverter';

const mockSponsors: SponsorPricingAsset[] = [
  {
    id: 'spons-jetbrains-01',
    sponsorName: 'JetBrains',
    campaignTitle: 'All Products Pack Student License',
    logoUrl: 'https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg',
    targetUrl: 'https://jetbrains.com/community/education',
    basePriceUsd: 50.0,
    promoBadgeText: 'Student Annual Deal',
    tier: 'platinum',
    active: true,
  },
  {
    id: 'spons-github-02',
    sponsorName: 'GitHub Copilot Enterprise',
    campaignTitle: 'AI Developer Assistant Pro',
    logoUrl: 'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png',
    targetUrl: 'https://github.com/features/copilot',
    basePriceUsd: 100.0,
    promoBadgeText: 'Exclusive Campus Pro',
    tier: 'platinum',
    active: true,
  },
  {
    id: 'spons-nordvpn-03',
    sponsorName: 'NordVPN Secure Pass',
    campaignTitle: 'Encrypted Campus WiFi Protection',
    logoUrl: 'https://s1.nordcdn.com/nordvpn/media/1.2267.0/images/global/favicon/apple-touch-icon-180x180.png',
    targetUrl: 'https://nordvpn.com',
    basePriceUsd: 35.0,
    promoBadgeText: 'Campus Privacy Pack',
    tier: 'gold',
    active: true,
  },
];

// Live multi-currency exchange rates table mapped to USD
const liveExchangeRates: Record<string, { multiplier: number; symbol: string }> = {
  USD: { multiplier: 1.0, symbol: '$' },
  EUR: { multiplier: 0.92, symbol: '€' },
  GBP: { multiplier: 0.79, symbol: '£' },
  CAD: { multiplier: 1.36, symbol: 'CA$' },
  AUD: { multiplier: 1.52, symbol: 'A$' },
  INR: { multiplier: 83.45, symbol: '₹' },
  JPY: { multiplier: 154.2, symbol: '¥' },
  CHF: { multiplier: 0.89, symbol: 'CHF ' },
  SGD: { multiplier: 1.34, symbol: 'S$' },
};

// Country-to-Currency lookup table
const countryCurrencyMap: Record<string, { currency: string; symbol: string; countryName: string }> = {
  US: { currency: 'USD', symbol: '$', countryName: 'United States' },
  DE: { currency: 'EUR', symbol: '€', countryName: 'Germany' },
  FR: { currency: 'EUR', symbol: '€', countryName: 'France' },
  IT: { currency: 'EUR', symbol: '€', countryName: 'Italy' },
  ES: { currency: 'EUR', symbol: '€', countryName: 'Spain' },
  GB: { currency: 'GBP', symbol: '£', countryName: 'United Kingdom' },
  CA: { currency: 'CAD', symbol: 'CA$', countryName: 'Canada' },
  AU: { currency: 'AUD', symbol: 'A$', countryName: 'Australia' },
  IN: { currency: 'INR', symbol: '₹', countryName: 'India' },
  JP: { currency: 'JPY', symbol: '¥', countryName: 'Japan' },
  CH: { currency: 'CHF', symbol: 'CHF ', countryName: 'Switzerland' },
  SG: { currency: 'SGD', symbol: 'S$', countryName: 'Singapore' },
};

export class SponsorCurrencyConverterService {
  private sponsors: SponsorPricingAsset[] = [...mockSponsors];

  public getSponsors(): SponsorPricingAsset[] {
    return [...this.sponsors];
  }

  /**
   * Determine client geo-location context via IP or fallback country
   */
  public resolveGeoLocation(ipAddress: string, countryCodeFallback: string = 'DE'): GeoLocationContext {
    const code = countryCodeFallback.toUpperCase();
    const mapped = countryCurrencyMap[code] || countryCurrencyMap['US'];

    return {
      ipAddress,
      countryCode: code,
      countryName: mapped.countryName,
      city: code === 'DE' ? 'Berlin' : code === 'GB' ? 'London' : code === 'IN' ? 'Bengaluru' : 'New York',
      region: 'Academic Campus Subnet',
      localCurrencyCode: mapped.currency,
      currencySymbol: mapped.symbol,
    };
  }

  /**
   * Calculate live converted price based on base USD price and target currency
   */
  public convertPrice(basePriceUsd: number, targetCurrency: string): { convertedPrice: number; formattedText: string } {
    const rateData = liveExchangeRates[targetCurrency] || liveExchangeRates['USD'];
    const converted = basePriceUsd * rateData.multiplier;

    // Formatting based on currency convention
    let formattedText: string;
    if (targetCurrency === 'JPY') {
      formattedText = `${rateData.symbol}${Math.round(converted).toLocaleString()}`;
    } else if (targetCurrency === 'EUR') {
      formattedText = `${rateData.symbol}${Math.round(converted)}`;
    } else {
      formattedText = `${rateData.symbol}${converted.toFixed(2)}`;
    }

    return {
      convertedPrice: Math.round(converted * 100) / 100,
      formattedText,
    };
  }

  /**
   * Generates dynamic SVG Badge Overlay injected on top of the Sponsor's rendered logo asset
   */
  public generateSvgPriceBadgeOverlay(
    formattedPrice: string,
    badgeText: string = 'Campus Deal',
    theme: 'vibrant_gradient' | 'minimal_dark' | 'glassmorphism' = 'vibrant_gradient'
  ): string {
    if (theme === 'vibrant_gradient') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="100%" height="100%">
  <defs>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="50%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#db2777" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect x="4" y="4" width="232" height="52" rx="26" fill="url(#badgeGrad)" filter="url(#shadow)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
  <text x="32" y="24" fill="#fbcfe8" font-size="10" font-family="system-ui, -apple-system, sans-serif" font-weight="700" letter-spacing="1.2" text-transform="uppercase">${badgeText}</text>
  <text x="32" y="45" fill="#ffffff" font-size="20" font-family="system-ui, -apple-system, sans-serif" font-weight="800">${formattedPrice}</text>
  <circle cx="204" cy="30" r="16" fill="rgba(255,255,255,0.2)"/>
  <path d="M198 30 L208 30 M204 25 L209 30 L204 35" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="100%" height="100%">
  <rect x="4" y="4" width="232" height="52" rx="12" fill="#0f172a" stroke="#334155" stroke-width="2"/>
  <text x="24" y="36" fill="#38bdf8" font-size="18" font-family="monospace" font-weight="700">${formattedPrice}</text>
  <text x="130" y="35" fill="#94a3b8" font-size="11" font-family="sans-serif">${badgeText}</text>
</svg>`;
  }

  /**
   * Produce complete localized configuration for rendering
   */
  public localizeSponsorAsset(
    asset: SponsorPricingAsset,
    userCountryCode: string = 'DE',
    ipAddress: string = '194.12.44.102'
  ): LocalizedSponsorLogoRenderConfig {
    const geo = this.resolveGeoLocation(ipAddress, userCountryCode);
    const { convertedPrice, formattedText } = this.convertPrice(asset.basePriceUsd, geo.localCurrencyCode);
    const svgOverlay = this.generateSvgPriceBadgeOverlay(formattedText, asset.promoBadgeText || 'Campus Deal');

    return {
      asset,
      geoContext: geo,
      convertedPrice,
      formattedLocalPrice: formattedText,
      svgBadgeOverlay: svgOverlay,
    };
  }
}

export const sponsorCurrencyConverterService = new SponsorCurrencyConverterService();
