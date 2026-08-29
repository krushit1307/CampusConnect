import { describe, it, expect, beforeEach } from 'vitest';
import { SponsorCurrencyConverterService } from './sponsorCurrencyConverterService';

describe('SponsorCurrencyConverterService', () => {
  let service: SponsorCurrencyConverterService;

  beforeEach(() => {
    service = new SponsorCurrencyConverterService();
  });

  it('should accurately convert USD to EUR at 0.92 multiplier', () => {
    const { convertedPrice, formattedText } = service.convertPrice(50.0, 'EUR');
    expect(convertedPrice).toBe(46);
    expect(formattedText).toBe('€46');
  });

  it('should accurately convert USD to GBP at 0.79 multiplier', () => {
    const { convertedPrice, formattedText } = service.convertPrice(100.0, 'GBP');
    expect(convertedPrice).toBe(79.0);
    expect(formattedText).toBe('£79.00');
  });

  it('should resolve geo location context for Germany (DE)', () => {
    const geo = service.resolveGeoLocation('194.12.44.102', 'DE');
    expect(geo.countryCode).toBe('DE');
    expect(geo.localCurrencyCode).toBe('EUR');
    expect(geo.currencySymbol).toBe('€');
  });

  it('should generate valid SVG badge overlay markup containing localized price', () => {
    const svg = service.generateSvgPriceBadgeOverlay('€46', 'Student Deal');
    expect(svg).toContain('<svg');
    expect(svg).toContain('€46');
    expect(svg).toContain('Student Deal');
    expect(svg).toContain('</svg>');
  });

  it('should localize sponsor asset with complete rendered configuration', () => {
    const sponsors = service.getSponsors();
    const jetbrains = sponsors.find((s) => s.id === 'spons-jetbrains-01');
    expect(jetbrains).toBeDefined();

    const result = service.localizeSponsorAsset(jetbrains!, 'DE');
    expect(result.formattedLocalPrice).toBe('€46');
    expect(result.geoContext.countryCode).toBe('DE');
    expect(result.svgBadgeOverlay).toContain('€46');
  });
});
