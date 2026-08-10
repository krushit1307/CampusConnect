import { createClient } from "@/lib/supabase/client";

interface RescheduleBody {
  start_date: string;
  end_date: string;
  event_date: string;
  version: number;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const eventId = params.id;
  const supabase = createClient();

  let body: RescheduleBody;
  try {
    body = (await req.json()) as RescheduleBody;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const targetVersion = Number(body.version);
  if (!Number.isInteger(targetVersion)) {
    return new Response("Missing expected version for optimistic locking", { status: 400 });
  }

  // Guarded update: only succeeds when the event is still on the version the
  // client fetched, so a concurrent reschedule/edit cannot be silently overwritten.
  const { data, error } = await supabase
    .from("events")
    .update({
      start_date: body.start_date,
      end_date: body.end_date,
      event_date: body.event_date,
      updated_at: new Date().toISOString(),
      version: targetVersion + 1,
    })
    .eq("id", eventId)
    .eq("version", targetVersion)
    .select("id, version");

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  // 0 rows affected -> another user bumped the version first.
  if (!data || data.length === 0) {
    return new Response(
      "Conflict: This event was modified by another user. Please refresh and try again.",
      { status: 409 },
    );
  }

  return Response.json({
    success: true,
    eventId,
    updatedStart: body.start_date,
    updatedEnd: body.end_date,
    message: "Event rescheduled successfully",
  });
}
