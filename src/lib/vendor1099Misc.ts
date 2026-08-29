/**
 * Automated 1099-MISC contractor generator (#4730).
 *
 * Successful escrow payouts are summed per vendor_id for the calendar tax year.
 * At $600 the vendor cannot bid on new gigs until a digital W-9 is on file.
 * Year-end mapping fills the IRS 1099-MISC PDF schema for the club treasurer
 * (Copy C) and the vendor (Copy B).
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const FORM_1099_MISC = "1099-MISC";
export const REPORTING_THRESHOLD_DOLLARS = 600;

export type TinType = "ssn" | "ein";

export type EscrowPayout = {
  vendor_id: string;
  amount: number;
  released_at: string | null;
};

export type VendorW9Data = {
  legal_name: string;
  business_name?: string | null;
  tin_type: TinType;
  tin: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
};

export type ClubPayerData = {
  name: string;
  ein: string;
};

export type Irs1099MiscSchema = {
  form: typeof FORM_1099_MISC;
  tax_year: number;
  payer_name: string;
  payer_tin: string;
  recipient_name: string;
  recipient_tin: string;
  recipient_tin_type: TinType;
  recipient_address: string;
  box_3_other_income: number;
};

export function taxYearOf(isoTimestamp: string): number {
  return new Date(isoTimestamp).getUTCFullYear();
}

/** Sum successful escrow payouts (released_at set) per vendor_id for one tax year. */
export function aggregateEscrowPayoutsByVendor(
  payouts: ReadonlyArray<EscrowPayout>,
  taxYear: number,
): Array<{ vendor_id: string; total_paid: number }> {
  const totals = new Map<string, number>();

  for (const payout of payouts) {
    if (!payout.vendor_id || !payout.released_at) continue;
    if (taxYearOf(payout.released_at) !== taxYear) continue;
    const amount = Number(payout.amount) || 0;
    if (amount <= 0) continue;
    totals.set(payout.vendor_id, (totals.get(payout.vendor_id) || 0) + amount);
  }

  return [...totals.entries()]
    .map(([vendor_id, total_paid]) => ({
      vendor_id,
      total_paid: Number(total_paid.toFixed(2)),
    }))
    .sort((a, b) => a.vendor_id.localeCompare(b.vendor_id));
}

export function shouldFreezeVendorBidding(totalPaid: number, hasW9: boolean): boolean {
  return Number(totalPaid) >= REPORTING_THRESHOLD_DOLLARS && !hasW9;
}

export function isValidTin(tinType: TinType, tin: string): boolean {
  const value = (tin || "").trim();
  if (tinType === "ein") return /^\d{2}-\d{7}$/.test(value);
  return /^\d{3}-\d{2}-\d{4}$/.test(value);
}

export function formatVendorAddress(w9: VendorW9Data): string {
  return `${w9.address_line1}, ${w9.city}, ${w9.state} ${w9.zip}`;
}

/** Map club EIN + vendor W-9 + Total_Paid onto the IRS 1099-MISC field schema. */
export function map1099MiscSchema(input: {
  taxYear: number;
  club: ClubPayerData;
  vendorW9: VendorW9Data;
  totalPaid: number;
}): Irs1099MiscSchema {
  return {
    form: FORM_1099_MISC,
    tax_year: input.taxYear,
    payer_name: input.club.name,
    payer_tin: input.club.ein,
    recipient_name: input.vendorW9.business_name?.trim() || input.vendorW9.legal_name,
    recipient_tin: input.vendorW9.tin,
    recipient_tin_type: input.vendorW9.tin_type,
    recipient_address: formatVendorAddress(input.vendorW9),
    box_3_other_income: Number(Number(input.totalPaid).toFixed(2)),
  };
}

export function format1099MiscDollars(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function filing1099MiscFilename(
  taxYear: number,
  clubId: string,
  vendorId: string,
  copy: "B" | "C",
): string {
  return `${taxYear}/${clubId}/${vendorId}-1099-MISC-copy-${copy}.pdf`;
}

function drawCopy(
  page: ReturnType<PDFDocument["addPage"]>,
  schema: Irs1099MiscSchema,
  copyLabel: string,
  fonts: { regular: Awaited<ReturnType<PDFDocument["embedFont"]>>; bold: Awaited<ReturnType<PDFDocument["embedFont"]>> },
) {
  const left = 48;
  let y = 744;
  const { regular, bold } = fonts;

  page.drawText("Form 1099-MISC", { x: left, y, size: 20, font: bold, color: rgb(0, 0, 0) });
  y -= 22;
  page.drawText(`${copyLabel}  ·  Tax year ${schema.tax_year}`, { x: left, y, size: 11, font: regular });
  y -= 36;

  const rows: Array<[string, string]> = [
    ["PAYER'S name", schema.payer_name],
    ["PAYER'S TIN (EIN)", schema.payer_tin],
    ["RECIPIENT'S name", schema.recipient_name],
    ["RECIPIENT'S TIN", schema.recipient_tin],
    ["RECIPIENT'S address", schema.recipient_address],
    ["Box 3  Other income", format1099MiscDollars(schema.box_3_other_income)],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, { x: left, y, size: 9, font: bold });
    y -= 16;
    page.drawText(value || "—", { x: left, y, size: 11, font: regular });
    y -= 26;
  }
}

export async function generate1099MiscPdf(schema: Irs1099MiscSchema): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  const copyC = pdf.addPage([612, 792]);
  drawCopy(copyC, schema, "Copy C — For Payer (Club Treasurer)", fonts);
  const copyB = pdf.addPage([612, 792]);
  drawCopy(copyB, schema, "Copy B — For Recipient (Vendor)", fonts);

  return pdf.save();
}
