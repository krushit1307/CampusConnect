import { createServerFn } from "@tanstack/react-start";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createServer } from "@/lib/supabase/server";

export const generateCertificate = createServerFn()
  .validator((data: { eventId: string; userId: string }) => {
    return data;
  })
  .handler(async ({ data: { eventId, userId } }) => {
    const supabase = createServer();

    // 1. Verify user is logged in and matches userId
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      throw new Error("Unauthorized");
    }

    // 2. Fetch event and profile details
    const { data: event } = await supabase
      .from("events")
      .select("title, event_date, clubs(name)")
      .eq("id", eventId)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    if (!event || !profile) {
      throw new Error("Event or Profile not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clubsAny = event.clubs as any;
    const clubName = Array.isArray(clubsAny) ? clubsAny[0]?.name : clubsAny?.name;

    // 3. Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("Certificate of Participation", {
      x: 100,
      y: 320,
      size: 30,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(`This certifies that`, { x: 230, y: 270, size: 16, font: helveticaNormal });
    page.drawText(profile.full_name || "Student", {
      x: 200,
      y: 230,
      size: 24,
      font: helveticaFont,
    });
    page.drawText(`has successfully participated in`, {
      x: 190,
      y: 190,
      size: 16,
      font: helveticaNormal,
    });
    page.drawText(event.title, { x: 150, y: 150, size: 20, font: helveticaFont });
    page.drawText(`Organized by ${clubName || "CampusConnect"}`, {
      x: 200,
      y: 110,
      size: 14,
      font: helveticaNormal,
    });

    const dateStr = event.event_date
      ? new Date(event.event_date).toLocaleDateString()
      : new Date().toLocaleDateString();
    page.drawText(`Date: ${dateStr}`, { x: 250, y: 70, size: 12, font: helveticaNormal });

    const pdfBytes = await pdfDoc.save();

    // 4. Upload to Supabase Storage
    const fileName = `${userId}/${eventId}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error("Failed to upload certificate");
    }

    const { data: publicUrlData } = supabase.storage.from("certificates").getPublicUrl(fileName);

    // 5. Insert into certificates table
    const { data: insertData, error: insertError } = await supabase
      .from("certificates")
      .insert({
        event_id: eventId,
        user_id: userId,
        certificate_url: publicUrlData.publicUrl,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error("Failed to save certificate record");
    }

    return insertData;
  });
