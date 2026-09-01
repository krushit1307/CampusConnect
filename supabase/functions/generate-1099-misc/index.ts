import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { verifyAuth } from "../shared/auth-middleware.ts";
import {
  filing1099MiscFilename,
  format1099MiscDollars,
  type Irs1099MiscSchema,
} from "../_shared/vendor1099Misc.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asSchema(value: unknown): Irs1099MiscSchema | null {
  const row = value as Irs1099MiscSchema | null;
  if (!row || row.form !== "1099-MISC") return null;
  return row;
}

async function generate1099MiscPdf(schema: Irs1099MiscSchema): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  const draw = (page: ReturnType<PDFDocument["addPage"]>, copyLabel: string) => {
    const left = 48;
    let y = 744;
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
  };

  draw(pdf.addPage([612, 792]), "Copy C — For Payer (Club Treasurer)");
  draw(pdf.addPage([612, 792]), "Copy B — For Recipient (Vendor)");
  return pdf.save();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = (await req.json().catch(() => ({}))) as {
      taxYear?: number;
      clubId?: string;
    };
    const taxYear = Number(body.taxYear) || new Date().getUTCFullYear() - 1;
    const clubId = body.clubId || null;

    let userId: string | null = null;
    try {
      const user = await verifyAuth(req, supabase);
      userId = user.id;
    } catch {
      userId = null;
    }

    if (!userId) {
      const secret = Deno.env.get("WEBHOOK_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const authHeader = req.headers.get("Authorization");
      if (!secret || authHeader !== `Bearer ${secret}`) {
        return json({ error: "Unauthorized" }, 401);
      }
    } else if (!clubId) {
      return json({ error: "clubId is required" }, 400);
    } else {
      const { data: allowed } = await supabase.rpc("is_club_treasurer", {
        p_club_id: clubId,
        p_user_id: userId,
      });
      if (!allowed) return json({ error: "Forbidden" }, 403);
    }

    const { data: prepared, error: prepareError } = await supabase.rpc(
      "prepare_vendor_1099_misc_filings",
      { p_tax_year: taxYear, p_club_id: clubId },
    );
    if (prepareError) {
      console.error("[generate-1099-misc] prepare failed:", prepareError);
      return json({ error: "Failed to map 1099-MISC filings" }, 500);
    }

    let query = supabase
      .from("vendor_1099_misc_filings")
      .select("id, tax_year, club_id, vendor_id, schema, pdf_url")
      .eq("tax_year", taxYear)
      .is("pdf_url", null);
    if (clubId) query = query.eq("club_id", clubId);
    const { data: filings, error: listError } = await query;
    if (listError) {
      console.error("[generate-1099-misc] list failed:", listError);
      return json({ error: "Failed to load 1099-MISC filings" }, 500);
    }

    let generated = 0;
    for (const filing of filings || []) {
      const schema = asSchema(filing.schema);
      if (!schema) continue;

      const bytes = await generate1099MiscPdf(schema);
      const path = filing1099MiscFilename(filing.tax_year, filing.club_id, filing.vendor_id);
      const { error: uploadError } = await supabase.storage
        .from("tax-forms")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (uploadError) {
        console.error("[generate-1099-misc] upload failed:", uploadError);
        continue;
      }

      const { data: signed } = await supabase.storage
        .from("tax-forms")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const pdfUrl = signed?.signedUrl || path;

      await supabase
        .from("vendor_1099_misc_filings")
        .update({ pdf_url: pdfUrl })
        .eq("id", filing.id);

      const treasurerIds: string[] = [];
      const { data: members } = await supabase
        .from("club_members")
        .select("user_id, role")
        .eq("club_id", filing.club_id)
        .eq("status", "approved");
      for (const member of members || []) {
        const role = String(member.role || "").toLowerCase();
        if (["treasurer", "president", "admin", "owner"].includes(role)) {
          treasurerIds.push(member.user_id);
        }
      }
      const { data: club } = await supabase
        .from("clubs")
        .select("created_by, name")
        .eq("id", filing.club_id)
        .maybeSingle();
      if (club?.created_by) treasurerIds.push(club.created_by);

      const recipients = [...new Set([...treasurerIds, filing.vendor_id])];
      const title = `1099-MISC ${filing.tax_year}`;
      const message = `A 1099-MISC for ${format1099MiscDollars(schema.box_3_other_income)} paid by ${club?.name || "the club"} is ready for tax filing.`;
      const now = new Date().toISOString();

      if (recipients.length > 0) {
        await supabase.from("notifications").insert(
          recipients.map((user_id) => ({
            user_id,
            type: "1099_misc",
            title,
            message,
            link: pdfUrl,
          })),
        );
      }

      await supabase
        .from("vendor_1099_misc_filings")
        .update({
          treasurer_notified_at: now,
          vendor_notified_at: now,
        })
        .eq("id", filing.id);

      generated += 1;
    }

    return json({ success: true, prepared: prepared || 0, generated });
  } catch (err) {
    console.error("[generate-1099-misc]", err);
    return json({ error: "Failed to generate 1099-MISC" }, 500);
  }
});
