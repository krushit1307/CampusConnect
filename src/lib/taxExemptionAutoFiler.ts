export interface VendorInvoiceItem {
  description: string;
  unitAmountCents: number;
  quantity: number;
}

export interface VendorStripeInvoicePayload {
  contractId: string;
  vendorId: string;
  subtotalAmountCents: number;
  taxAmountCents: number; // in cents
  totalAmountCents: number;
  items: VendorInvoiceItem[];
}

export interface ContractTaxExemptionPayload {
  contractId: string;
  clubName: string;
  isUniversity501c3: boolean;
  st5CertificateUrl: string;
  taxExemptionClause: string;
  isAcknowledgedByVendor: boolean;
}

export interface InvoiceValidationResult {
  isApproved: boolean;
  blockedReason?: string;
  finalChargeAmountCents: number;
}

export const OFFICIAL_ST5_CERTIFICATE_URL =
  "https://storage.campusconnect.edu/compliance/university_st5_form.pdf";

export const TAX_EXEMPTION_LEGAL_CLAUSE =
  "I acknowledge this entity is Tax-Exempt and I will NOT apply state sales tax to this invoice.";

/**
 * Injects official University ST-5 Tax Exemption Certificate into vendor contract payload.
 */
export function injectTaxExemptionCertificate(
  contractId: string,
  clubName: string,
  acknowledged = false,
): ContractTaxExemptionPayload {
  return {
    contractId,
    clubName,
    isUniversity501c3: true,
    st5CertificateUrl: OFFICIAL_ST5_CERTIFICATE_URL,
    taxExemptionClause: TAX_EXEMPTION_LEGAL_CLAUSE,
    isAcknowledgedByVendor: acknowledged,
  };
}

/**
 * Validates vendor invoice payload and rejects payment if sales tax > 0 is included for tax-exempt clubs.
 */
export function validateVendorInvoiceTaxCompliance(
  invoice: VendorStripeInvoicePayload,
  isContractTaxExempt = true,
): InvoiceValidationResult {
  if (isContractTaxExempt && invoice.taxAmountCents > 0) {
    const taxInDollars = (invoice.taxAmountCents / 100).toFixed(2);
    return {
      isApproved: false,
      blockedReason: `Payment Blocked: This entity is 501(c)(3) Tax-Exempt. An illegal state sales tax of $${taxInDollars} was detected. Please remove tax from ledger and resubmit.`,
      finalChargeAmountCents: 0,
    };
  }

  return {
    isApproved: true,
    finalChargeAmountCents: invoice.subtotalAmountCents,
  };
}
