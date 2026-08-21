import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface EventRoiSummary {
  event_id: string;
  event_title: string;
  ticket_count: number;
  ticket_sales_cents: number;
  stripe_fees_cents: number;
  refunds_cents: number;
  net_revenue_cents: number;
  total_expenses_cents: number;
  net_profit_cents: number;
  margin_percent: number;
  stripe_fee_model: string;
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export async function generateEventRoiPdf(summary: EventRoiSummary): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const left = 48;
  let y = 744;

  page.drawText("EVENT PROFIT & LOSS STATEMENT", {
    x: left,
    y,
    size: 20,
    font: bold,
    color: rgb(0, 0, 0),
  });

  y -= 30;
  page.drawText(summary.event_title || "Event", {
    x: left,
    y,
    size: 13,
    font: regular,
  });

  y -= 42;
  const rows: Array<[string, string]> = [
    ["Ticket sales", formatCurrency(summary.ticket_sales_cents)],
    ["Stripe processing fees", `-${formatCurrency(summary.stripe_fees_cents)}`],
    ["Refunds", `-${formatCurrency(summary.refunds_cents)}`],
    ["Net ticket revenue", formatCurrency(summary.net_revenue_cents)],
    ["Approved reimbursements", `-${formatCurrency(summary.total_expenses_cents)}`],
    ["Net profit / (loss)", formatCurrency(summary.net_profit_cents)],
    ["Profit margin", `${summary.margin_percent.toFixed(2)}%`],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, { x: left, y, size: 11, font: regular });
    page.drawText(value, { x: 390, y, size: 11, font: bold });
    y -= 26;
  }

  y -= 10;
  page.drawText("Audit details", { x: left, y, size: 12, font: bold });
  y -= 22;
  page.drawText(`Paid tickets: ${summary.ticket_count}`, { x: left, y, size: 10, font: regular });
  y -= 18;
  page.drawText(`Stripe fee model: ${summary.stripe_fee_model}`, {
    x: left,
    y,
    size: 10,
    font: regular,
  });
  y -= 18;
  page.drawText(`Generated: ${new Date().toLocaleString("en-US")}`, {
    x: left,
    y,
    size: 10,
    font: regular,
  });

  y -= 36;
  page.drawText("Prepared for Student Union audit and event reconciliation.", {
    x: left,
    y,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  });

  return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
