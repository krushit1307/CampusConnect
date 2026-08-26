import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib";
import { encodeHex } from "jsr:@std/encoding/hex";

export async function generatePdf(payload: any): Promise<Uint8Array> {
  const { poll, options, votes } = payload;
  const isAnonymous = poll.is_anonymous;

  // 1. Generate Audit Hash from deterministic JSON
  // Strip profile details for hash to ensure consistency of raw vote count data
  const dataToHash = {
    pollId: poll.id,
    question: poll.question,
    isAnonymous,
    options: options.map((o: any) => ({ id: o.id, text: o.text })),
    votes: votes.map((v: any) => ({
      id: v.id,
      option_id: v.option_id,
      created_at: v.created_at,
    })),
  };

  const jsonString = JSON.stringify(dataToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jsonString));
  const signature = encodeHex(hashBuffer);

  // 2. Aggregate Results
  const optionMap = new Map();
  const totals: Record<string, number> = {};

  options.forEach((opt: any) => {
    optionMap.set(opt.id, opt.text);
    totals[opt.id] = 0;
  });

  votes.forEach((v: any) => {
    if (totals[v.option_id] !== undefined) {
      totals[v.option_id]++;
    }
  });

  // 3. PDF Generation
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  let y = 750;
  const margin = 50;

  // Title
  page.drawText("Poll Results Report", {
    x: margin,
    y,
    size: 24,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 40;

  // Metadata
  page.drawText(`Generated: ${new Date().toUTCString()}`, { x: margin, y, size: 10, font });
  y -= 20;
  page.drawText(`Status: ${poll.is_active ? "Active" : "Closed"}`, {
    x: margin,
    y,
    size: 10,
    font,
  });
  y -= 20;
  page.drawText(`Privacy: ${isAnonymous ? "Anonymous" : "Public"}`, {
    x: margin,
    y,
    size: 10,
    font,
  });
  y -= 40;

  // Question
  page.drawText("Question:", { x: margin, y, size: 14, font: fontBold });
  y -= 20;
  page.drawText(poll.question, { x: margin, y, size: 14, font });
  y -= 40;

  // Results Section
  page.drawText("Results:", { x: margin, y, size: 14, font: fontBold });
  y -= 30;

  const maxVotes = Math.max(...Object.values(totals), 1);
  const totalVotes = votes.length;

  options.forEach((opt: any) => {
    const count = totals[opt.id];
    const text = opt.text;

    // Simple Text Bar
    const barLength = Math.round((count / maxVotes) * 30);
    const bar = "█".repeat(barLength);

    page.drawText(`${text}: ${count} votes`, { x: margin, y, size: 12, font: fontBold });
    y -= 15;
    page.drawText(bar || "▏", {
      x: margin,
      y,
      size: 12,
      font: fontMono,
      color: rgb(0.2, 0.5, 0.8),
    });
    y -= 30;
  });

  y -= 20;
  page.drawText(`Total Votes: ${totalVotes}`, { x: margin, y, size: 14, font: fontBold });

  // Winning Outcome
  if (totalVotes > 0) {
    let maxCount = -1;
    let winners: string[] = [];
    Object.entries(totals).forEach(([id, count]) => {
      if (count > maxCount) {
        maxCount = count;
        winners = [optionMap.get(id)];
      } else if (count === maxCount) {
        winners.push(optionMap.get(id));
      }
    });

    y -= 30;
    page.drawText("Outcome:", { x: margin, y, size: 14, font: fontBold });
    y -= 20;
    page.drawText(winners.join(", "), { x: margin, y, size: 14, font });
  }

  // Footer & Audit Signature
  y = margin + 40;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 600 - margin, y },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  y -= 20;
  page.drawText("Audit Signature (SHA-256):", { x: margin, y, size: 10, font: fontBold });
  y -= 15;
  page.drawText(signature, { x: margin, y, size: 9, font: fontMono });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
