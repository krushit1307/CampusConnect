export type TinType = "ssn" | "ein";

export type Irs1099MiscSchema = {
  form: "1099-MISC";
  tax_year: number;
  payer_name: string;
  payer_tin: string;
  recipient_name: string;
  recipient_tin: string;
  recipient_tin_type: TinType;
  recipient_address: string;
  box_3_other_income: number;
};

export function format1099MiscDollars(amount: number): string {
  return `$${Number(amount).toFixed(2)}`;
}

export function filing1099MiscFilename(
  taxYear: number,
  clubId: string,
  vendorId: string,
): string {
  return `${taxYear}/${clubId}/${vendorId}-1099-MISC.pdf`;
}
