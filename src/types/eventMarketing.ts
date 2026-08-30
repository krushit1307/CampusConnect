export type QrStylePattern = 'squares' | 'dots' | 'rounded';
export type FlyerLayoutTemplate = 'standard_flyer' | 'minimalist_card' | 'poster_badge';

export interface QrCustomizationOptions {
  primaryColor: string;
  backgroundColor: string;
  logoUrl?: string;
  logoSizePercent: number; // e.g. 20%
  pattern: QrStylePattern;
  includeEventTitle: boolean;
  includeCallToAction: boolean;
  ctaText: string;
  flyerTemplate: FlyerLayoutTemplate;
}

export interface MarketingEventDetails {
  eventId: string;
  title: string;
  clubName: string;
  clubLogoUrl?: string;
  dateString: string;
  location: string;
  targetUrl: string;
}
