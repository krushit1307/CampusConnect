import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    if (!record || !record.name) {
      return new Response("Invalid payload", { status: 400 })
    }

    const filePath = record.name // e.g., student-id/resume.pdf
    const studentBucket = "raw_resumes"
    const sponsorBucket = "sponsor_resume_book"

    // 1. Download raw PDF from the private bucket
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(studentBucket)
      .download(filePath)

    if (downloadError) throw downloadError

    const pdfBytes = await fileData.arrayBuffer()

    // 2. Call PII detection API or mock bounding boxes returned for SSN/Address
    // In production, integrate Google Cloud DLP or AWS Comprehend PII here.
    // Example response structure: [{ page: 0, x: 100, y: 200, width: 150, height: 15 }]
    const piiBoundingBoxes = await detectPiiCoordinates(pdfBytes)

    // 3. Load PDF with pdf-lib and apply black-out rectangles
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()

    for (const box of piiBoundingBoxes) {
      const page = pages[box.page]
      if (page) {
        page.drawRectangle({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          color: rgb(0, 0, 0), // Solid black redaction
        })
      }
    }

    const sanitizedPdfBytes = await pdfDoc.save()

    // 4. Save sanitized PDF to the sponsor-facing bucket
    const { error: uploadError } = await supabase.storage
      .from(sponsorBucket)
      .upload(filePath, sanitizedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      })

    if (uploadError) throw uploadError

    return new Response(JSON.stringify({ success: true, message: "Resume redacted successfully." }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    console.error("Redaction error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

async function detectPiiCoordinates(pdfBuffer: ArrayBuffer) {
  // Placeholder for DLP / OCR coordination returning bounding boxes
  return []
}
