import { describe, it, expect } from "vitest";
import {
  injectTaxExemptionCertificate,
  validateVendorInvoiceTaxCompliance,
  OFFICIAL_ST5_CERTIFICATE_URL,
  TAX_EXEMPTION_LEGAL_CLAUSE,
  VendorStripeInvoicePayload,
} from "./taxExemptionAutoFiler";

describe("Implement Automated Tax-Exempt Sales Tax Exemption Certificate Auto-Filer Suite (#4823)", () => {
  it("injects ST-5 certificate and acknowledgement clause into contract payload", () => {
    const contract = injectTaxExemptionCertificate("ctr_pizza_order", "Robotics Club", true);

    expect(contract.isUniversity501c3).toBe(true);
    expect(contract.st5CertificateUrl).toBe(OFFICIAL_ST5_CERTIFICATE_URL);
    expect(contract.taxExemptionClause).toBe(TAX_EXEMPTION_LEGAL_CLAUSE);
    expect(contract.isAcknowledgedByVendor).toBe(true);
  });

  it("blocks payment and throws compliant error when invoice includes tax_amount > 0", () => {
    // Vendor submits $1,000 pizza with $80 sales tax
    const invalidInvoice: VendorStripeInvoicePayload = {
      contractId: "ctr_pizza_order",
      vendorId: "vnd_pizza_parlor",
      subtotalAmountCents: 100000, // $1,000.00
      taxAmountCents: 8000, // $80.00 tax
      totalAmountCents: 108000,
      items: [{ description: "100 Large Pizzas", unitAmountCents: 1000, quantity: 100 }],
    };

    const validation = validateVendorInvoiceTaxCompliance(invalidInvoice, true);

    expect(validation.isApproved).toBe(false);
    expect(validation.blockedReason).toContain(
      "Payment Blocked: This entity is 501(c)(3) Tax-Exempt",
    );
    expect(validation.blockedReason).toContain("$80.00");
    expect(validation.finalChargeAmountCents).toBe(0);
  });

  it("approves payment when invoice has zero sales tax", () => {
    const validInvoice: VendorStripeInvoicePayload = {
      contractId: "ctr_pizza_order",
      vendorId: "vnd_pizza_parlor",
      subtotalAmountCents: 100000, // $1,000.00
      taxAmountCents: 0, // $0.00 tax
      totalAmountCents: 100000,
      items: [{ description: "100 Large Pizzas", unitAmountCents: 1000, quantity: 100 }],
    };

    const validation = validateVendorInvoiceTaxCompliance(validInvoice, true);

    expect(validation.isApproved).toBe(true);
    expect(validation.blockedReason).toBeUndefined();
    expect(validation.finalChargeAmountCents).toBe(100000);
  });
});
