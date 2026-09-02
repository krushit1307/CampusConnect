/**
 * Foreign Student Visa Tuition & International Financial Guarantee Catalog
 */

export const INTERNATIONAL_TUITION_POLICIES = [
  { countryRegion: 'North America / EU', internationalSurchargePercent: 25.0, requireBankGuarantee: true },
  { countryRegion: 'Asia Pacific / SE Asia', internationalSurchargePercent: 20.0, requireBankGuarantee: true },
  { countryRegion: 'Global Exchange Partner', internationalSurchargePercent: 0.0, requireBankGuarantee: false },
];

/**
 * Calculates international student tuition surcharge amount.
 */
export function calculateInternationalTuitionSurcharge(baseTuitionUSD: number, countryRegion: string): number {
  const match = INTERNATIONAL_TUITION_POLICIES.find(p => p.countryRegion === countryRegion);
  const surcharge = match ? match.internationalSurchargePercent : 20.0;
  return Math.round(baseTuitionUSD * (surcharge / 100.0));
}
