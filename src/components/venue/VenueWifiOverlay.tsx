import { useState, type ReactNode } from "react";
import { AlertTriangle, Gauge, Loader2, Radio, Users, Wifi } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  formatWifiSpeed,
  getVenueWifiWarning,
  getWifiSpeedTone,
  sortVenuesForEvent,
  type VenueWifiMetrics,
} from "@/lib/venueWifi";

interface VenueWifiOverlayProps {
  venue?: VenueWifiMetrics | null;
  venues?: VenueWifiMetrics[];
  techHeavy: boolean;
  attendeeCount?: number;
}

export function VenueWifiOverlay({
  venue,
  venues = [],
  techHeavy,
  attendeeCount,
}: VenueWifiOverlayProps) {
  const [showReportForm, setShowReportForm] = useState(false);
  const [downloadSpeed, setDownloadSpeed] = useState("");
  const [deviceCount, setDeviceCount] = useState("");
  const [latency, setLatency] = useState("");
  const [notes, setNotes] = useState("");
  const supabase = createClient();
  const warning = getVenueWifiWarning(venue, techHeavy, attendeeCount);
  const alternatives = sortVenuesForEvent(venues, techHeavy, attendeeCount)
    .filter((candidate) => candidate.id !== venue?.id)
    .slice(0, 3);

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!venue?.id) throw new Error("Select a venue before submitting a speed report.");
      const speed = Number(downloadSpeed);
      if (!Number.isFinite(speed) || speed < 0) {
        throw new Error("Enter a valid download speed.");
      }

      const { error } = await supabase.rpc("submit_venue_wifi_report", {
        p_venue_id: venue.id,
        p_download_speed_mbps: speed,
        p_device_count: deviceCount ? Number(deviceCount) : null,
        p_upload_speed_mbps: null,
        p_latency_ms: latency ? Number(latency) : null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks — the venue Wi-Fi data has been updated.");
      setDownloadSpeed("");
      setDeviceCount("");
      setLatency("");
      setNotes("");
      setShowReportForm(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!venue) return null;

  return (
    <div className="space-y-3 border-2 border-black bg-sky-50 p-4 text-black shadow-[3px_3px_0_0_#000]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="border-2 border-black bg-white p-2">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-sky-800">
              Connectivity overlay
            </p>
            <h3 className="font-display text-lg font-black uppercase">{venue.name} Wi-Fi</h3>
            <p className="font-mono text-[11px] text-gray-600">
              {venue.wifi_report_count ?? 0} recent crowd report
              {venue.wifi_report_count === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowReportForm((current) => !current)}
          className="border-2 border-black bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase hover:bg-lime"
        >
          {showReportForm ? "Close" : "Test Wi-Fi"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric
          icon={<Gauge className="h-4 w-4" />}
          label="Avg speed"
          value={formatWifiSpeed(venue.avg_wifi_speed_mbps)}
          tone={getWifiSpeedTone(venue.avg_wifi_speed_mbps)}
        />
        <Metric
          icon={<Users className="h-4 w-4" />}
          label="Device capacity"
          value={venue.max_device_capacity ? `${venue.max_device_capacity} devices` : "Not rated"}
        />
        <Metric
          icon={<Radio className="h-4 w-4" />}
          label="Last tested"
          value={
            venue.last_wifi_tested_at
              ? new Date(venue.last_wifi_tested_at).toLocaleDateString()
              : "Not tested"
          }
        />
      </div>

      {warning && (
        <div
          className="flex gap-2 border-2 border-red-800 bg-red-100 p-3 text-red-950"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-mono text-xs font-bold leading-5">{warning}</p>
        </div>
      )}

      {techHeavy && alternatives.length > 0 && (
        <div className="border-t-2 border-black pt-3">
          <p className="font-mono text-[10px] font-black uppercase">Better connectivity options</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {alternatives.map((candidate) => (
              <span
                key={candidate.id}
                className="border-2 border-black bg-white px-2 py-1 font-mono text-[10px] font-bold"
              >
                {candidate.name} · {candidate.max_device_capacity ?? "?"} devices
              </span>
            ))}
          </div>
        </div>
      )}

      {showReportForm && (
        <div className="space-y-3 border-t-2 border-black pt-3">
          <p className="font-mono text-xs leading-5 text-gray-700">
            Run a speed test while sitting in this venue, then add the result to keep the campus map
            accurate.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="font-mono text-[10px] font-bold uppercase">
              Download Mbps
              <input
                type="number"
                min="0"
                step="0.1"
                value={downloadSpeed}
                onChange={(event) => setDownloadSpeed(event.target.value)}
                className="mt-1 w-full border-2 border-black bg-white p-2 font-mono text-xs"
                placeholder="125"
              />
            </label>
            <label className="font-mono text-[10px] font-bold uppercase">
              Devices nearby (optional)
              <input
                type="number"
                min="0"
                step="1"
                value={deviceCount}
                onChange={(event) => setDeviceCount(event.target.value)}
                className="mt-1 w-full border-2 border-black bg-white p-2 font-mono text-xs"
                placeholder="80"
              />
            </label>
            <label className="font-mono text-[10px] font-bold uppercase">
              Latency ms (optional)
              <input
                type="number"
                min="0"
                step="0.1"
                value={latency}
                onChange={(event) => setLatency(event.target.value)}
                className="mt-1 w-full border-2 border-black bg-white p-2 font-mono text-xs"
                placeholder="18"
              />
            </label>
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Optional notes: basement corner, peak-hour slowdown..."
            className="w-full border-2 border-black bg-white p-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending}
            className="flex items-center justify-center gap-2 border-2 border-black bg-black px-3 py-2 font-mono text-xs font-bold uppercase text-white disabled:opacity-50"
          >
            {reportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit speed report
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "good" | "caution" | "slow" | "neutral";
}) {
  const toneClass = {
    good: "bg-lime-200",
    caution: "bg-amber-200",
    slow: "bg-red-200",
    neutral: "bg-white",
  }[tone];

  return (
    <div className={`border-2 border-black p-2 ${toneClass}`}>
      <div className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-gray-500">
        {icon} {label}
      </div>
      <p className="mt-1 font-display text-sm font-black">{value}</p>
    </div>
  );
}
