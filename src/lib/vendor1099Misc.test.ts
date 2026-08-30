import { describe, expect, it } from "vitest";
import {
  FORM_1099_MISC,
  REPORTING_THRESHOLD_DOLLARS,
  aggregateEscrowPayoutsByVendor,
  filing1099MiscFilename,
  generate1099MiscPdf,
  isValidTin,
  map1099MiscSchema,
  shouldFreezeVendorBidding,
  taxYearOf,
  type EscrowPayout,
  type VendorW9Data,
} from "./vendor1099Misc";

const DJ_ALICE = "vendor-alice";

const payouts: EscrowPayout[] = [
  { vendor_id: DJ_ALICE, amount: 500, released_at: "2026-03-01T12:00:00.000Z" },
  { vendor_id: DJ_ALICE, amount: 300, released_at: "2026-11-01T12:00:00.000Z" },
  { vendor_id: DJ_ALICE, amount: 200, released_at: "2025-12-15T12:00:00.000Z" },
  { vendor_id: DJ_ALICE, amount: 50, released_at: null },
  { vendor_id: "vendor-other", amount: 600, released_at: "2026-06-01T00:00:00.000Z" },
];

const w9: VendorW9Data = {
  legal_name: "Alice Chen",
  business_name: "DJ Alice",
  tin_type: "ssn",
  tin: "123-45-6789",
  address_line1: "100 Campus Way",
  city: "Berkeley",
  state: "CA",
  zip: "94704",
};

describe("1099-MISC contractor generator (#4730)", () => {
  it("uses the IRS $600 independent-contractor threshold", () => {
    expect(REPORTING_THRESHOLD_DOLLARS).toBe(600);
  });

  it("aggregates successful escrow payouts per vendor_id for the fiscal year", () => {
    expect(aggregateEscrowPayoutsByVendor(payouts, 2026)).toEqual([
      { vendor_id: DJ_ALICE, total_paid: 800 },
      { vendor_id: "vendor-other", total_paid: 600 },
    ]);
    expect(aggregateEscrowPayoutsByVendor(payouts, 2025)).toEqual([
      { vendor_id: DJ_ALICE, total_paid: 200 },
    ]);
    expect(taxYearOf("2026-11-01T12:00:00.000Z")).toBe(2026);
  });

  it("freezes bidding when Total_Paid >= $600 and no W-9 is on file", () => {
    expect(shouldFreezeVendorBidding(800, false)).toBe(true);
    expect(shouldFreezeVendorBidding(600, false)).toBe(true);
    expect(shouldFreezeVendorBidding(599.99, false)).toBe(false);
    expect(shouldFreezeVendorBidding(800, true)).toBe(false);
  });

  it("accepts W-9 SSN and EIN collection formats", () => {
    expect(isValidTin("ssn", "123-45-6789")).toBe(true);
    expect(isValidTin("ein", "12-3456789")).toBe(true);
    expect(isValidTin("ssn", "123456789")).toBe(false);
    expect(isValidTin("ein", "123456789")).toBe(false);
  });

  it("maps club EIN, vendor W-9 data, and Total Paid into the IRS 1099-MISC schema", () => {
    const schema = map1099MiscSchema({
      taxYear: 2026,
      club: { name: "Engineering Society", ein: "94-1234567" },
      vendorW9: w9,
      totalPaid: 800,
    });

    expect(schema).toEqual({
      form: FORM_1099_MISC,
      tax_year: 2026,
      payer_name: "Engineering Society",
      payer_tin: "94-1234567",
      recipient_name: "DJ Alice",
      recipient_tin: "123-45-6789",
      recipient_tin_type: "ssn",
      recipient_address: "100 Campus Way, Berkeley, CA 94704",
      box_3_other_income: 800,
    });
  });

  it("renders a 1099-MISC PDF with treasurer Copy C and vendor Copy B", async () => {
    const schema = map1099MiscSchema({
      taxYear: 2026,
      club: { name: "Engineering Society", ein: "94-1234567" },
      vendorW9: w9,
      totalPaid: 800,
    });
    const bytes = await generate1099MiscPdf(schema);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
    expect(
      filing1099MiscFilename(2026, "club-1", DJ_ALICE, "C"),
    ).toBe("2026/club-1/vendor-alice-1099-MISC-copy-C.pdf");
  });
});
