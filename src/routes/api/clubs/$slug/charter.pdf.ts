import { createClient } from "@/lib/supabase/client";
import { generatePdf } from "@/services/pdfService";

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: club, error } = await supabase
    .from("clubs")
    .select("id, slug")
    .eq("slug", params.slug)
    .single();

  if (error || !club) {
    return new Response("Club not found", {
      status: 404,
    });
  }

  const url = new URL(req.url);

  const printablePage = `${url.origin}/clubs/${club.slug}?print=1`;

  const pdf = await generatePdf(printablePage);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${club.slug}-charter.pdf"`,
    },
  });
}
