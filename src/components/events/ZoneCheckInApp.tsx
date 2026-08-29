import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRScanner } from "@/components/kiosk/QRScanner";
import { createClient } from "@/lib/supabase/client";
import { zoneCheckInAppTitle, type EventLayoutZone } from "@/lib/eventLayoutHeatmap";
import { useEventLayoutHeatmap } from "@/hooks/useEventLayoutHeatmap";

export function ZoneCheckInApp() {
  const { eventId = "", zoneId = "" } = useParams();
  const { zones, refresh } = useEventLayoutHeatmap(eventId || null);
  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastScan = useRef(0);

  const title = zoneCheckInAppTitle(zone?.name ?? "Zone");

  const recordScan = async (ticketPayload: string) => {
    const now = Date.now();
    if (now - lastScan.current < 2000 || busy || !zoneId) return;
    lastScan.current = now;
    setBusy(true);
    setError(null);
    setStatus(null);
    const client = createClient() as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error: rpcError } = await client.rpc("record_event_zone_checkin", {
      p_zone_id: zoneId,
      p_ticket_payload: ticketPayload,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const result = data as {
      success?: boolean;
      error?: string;
      zone_name?: string;
      current_occupancy?: number;
      max_capacity?: number;
      security_alert?: boolean;
      message?: string | null;
    } | null;
    if (!result?.success) {
      setError(result?.error || "Check-in failed.");
      return;
    }
    setStatus(
      result.security_alert && result.message
        ? result.message
        : `${result.zone_name} occupancy ${result.current_occupancy}/${result.max_capacity}`,
    );
    void refresh();
  };

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-300">
          Bouncer Check-in
        </p>
        <h1 className="font-display text-3xl font-black">{title}</h1>
        <p className="font-mono text-xs text-white/60">
          Internal door scanner for this zone. Each QR scan updates the organizer heatmap live.
        </p>
        {zone && <ZoneOccupancyBanner zone={zone} />}
        <QRScanner isActive={Boolean(zoneId)} onScanSuccess={(text) => void recordScan(text)} />
        <button
          type="button"
          disabled={busy || !zoneId}
          onClick={() => void recordScan(`manual:${Date.now()}`)}
          className="w-full bg-yellow-300 py-4 font-mono text-sm font-black uppercase text-black disabled:opacity-50"
        >
          {busy ? "Recording…" : "Record check-in"}
        </button>
        {status && <p className="font-mono text-xs text-emerald-300">{status}</p>}
        {error && <p className="font-mono text-xs text-rose-300">{error}</p>}
        <Link
          to={`/events/${eventId}/dashboard`}
          className="block font-mono text-[11px] uppercase text-white/50 underline"
        >
          Organizer dashboard
        </Link>
      </div>
    </div>
  );
}

function ZoneOccupancyBanner({ zone }: { zone: EventLayoutZone }) {
  return (
    <p className="font-mono text-sm">
      {zone.current_occupancy} / {zone.max_capacity} in {zone.name}
    </p>
  );
}

export default ZoneCheckInApp;
