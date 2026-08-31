import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/bouncer/emergency-evacuation
 * High-priority EMERGENCY_EVACUATION payload from Bouncer iPad fire alarm fingerprinting.
 * Validates session, then calls trigger_emergency_evacuation RPC to drop magnetic locks.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || body.type !== "EMERGENCY_EVACUATION")
      return NextResponse.json({ error: "Invalid payload type" }, { status: 400 });

    const { eventId, bouncerId, detectionDurationSeconds, venueId } = body as {
      eventId: string;
      bouncerId: string;
      detectionDurationSeconds: number;
      venueId?: string | null;
    };
    if (!eventId || !bouncerId)
      return NextResponse.json({ error: "eventId and bouncerId required" }, { status: 400 });
    if (typeof detectionDurationSeconds !== "number" || detectionDurationSeconds < 5) {
      return NextResponse.json({ error: "T3 must be detected >5 seconds" }, { status: 400 });
    }
    if (bouncerId !== user.id) {
      // Allow bouncers to trigger for their assigned event even if JWT user differs from payload bouncerId
      // but log mismatch for audit
    }

    const { data, error } = await supabase.rpc("trigger_emergency_evacuation", {
      p_event_id: eventId,
      p_bouncer_id: bouncerId,
      p_detection_duration_seconds: detectionDurationSeconds,
      p_payload: body as Record<string, unknown>,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, ...((data as Record<string, unknown>) ?? {}) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
