import { createClient } from "@/lib/supabase/client";

// Helper function to format dates to strict YYYYMMDDTHHmmssZ
const formatIcsDate = (dateString: string | null | undefined) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const eventId = params.id;
  const supabase = createClient();

  // 1. Fetch the event details from Postgres
  const { data: event, error } = await supabase
    .from("events")
    .select("title, start_date, end_date, location")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return new Response("Event not found", { status: 404 });
  }

  // 2. Construct the VCALENDAR string using an array to fix Prettier/Formatting CI bugs
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${formatIcsDate(event.start_date)}`,
    `DTEND:${formatIcsDate(event.end_date)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location || "TBA"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  // 3. Return the response with the specific file-download headers
  return new Response(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar",
      "Content-Disposition": 'attachment; filename="event.ics"',
    },
  });
}
