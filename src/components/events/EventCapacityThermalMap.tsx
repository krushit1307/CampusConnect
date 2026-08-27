import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MapPin, Plus, Radio, RefreshCw, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { loadFloorplan } from "@/lib/floorplan/service";
import {
  ASSET_DEFAULTS,
  DEFAULT_VENUE,
  FT_TO_PX,
  type FloorplanAsset,
  type VenueBounds,
} from "@/lib/floorplan/types";
import {
  formatDeviceCount,
  getThermalColor,
  getThermalRatio,
  type ThermalAccessPoint,
} from "@/lib/eventCapacityThermal";
import { Button } from "@/components/ui/button";

const EMPTY_FORM = {
  macAddress: "",
  label: "",
  areaName: "",
  xFt: "",
  yFt: "",
  radiusFt: "12",
  maxCapacity: "100",
};

type FormState = typeof EMPTY_FORM;

export function EventCapacityThermalMap({ eventId }: { eventId: string }) {
  const [points, setPoints] = useState<ThermalAccessPoint[]>([]);
  const [assets, setAssets] = useState<FloorplanAsset[]>([]);
  const [venue, setVenue] = useState<VenueBounds>(DEFAULT_VENUE);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showMapping, setShowMapping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadMap = async () => {
    setIsLoading(true);
    try {
      const [{ data, error }, floorplan] = await Promise.all([
        supabase.rpc("get_event_capacity_thermal_map", { p_event_id: eventId }),
        loadFloorplan(supabase, eventId),
      ]);
      if (error) throw error;
      setPoints((data ?? []) as ThermalAccessPoint[]);
      setAssets(floorplan.assets);
      setVenue(floorplan.venue);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load the capacity thermal map.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMap();
    const channel = supabase
      .channel(`event-capacity-thermal:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_wifi_access_points",
          filter: `event_id=eq.${eventId}`,
        },
        () => void loadMap(),
      )
      .subscribe();
    return () => {
      void channel.unsubscribe();
    };
  }, [eventId]);

  const hottestPoint = useMemo(
    () =>
      points.reduce<ThermalAccessPoint | null>((hottest, point) => {
        if (
          !hottest ||
          getThermalRatio(point.device_count, point.max_device_capacity) >
            getThermalRatio(hottest.device_count, hottest.max_device_capacity)
        )
          return point;
        return hottest;
      }, null),
    [points],
  );

  const savePoint = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_event_wifi_access_point", {
        p_event_id: eventId,
        p_access_point_id: null,
        p_mac_address: form.macAddress,
        p_label: form.label,
        p_area_name: form.areaName,
        p_x_ft: Number(form.xFt),
        p_y_ft: Number(form.yFt),
        p_radius_ft: Number(form.radiusFt),
        p_max_device_capacity: Number(form.maxCapacity),
        p_enabled: true,
      });
      if (error) throw error;
      toast.success("Access point mapped to the event floorplan.");
      setForm(EMPTY_FORM);
      setShowMapping(false);
      await loadMap();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save access point mapping.");
    } finally {
      setIsSaving(false);
    }
  };

  const deletePoint = async (id: string) => {
    const { error } = await supabase.rpc("delete_event_wifi_access_point", {
      p_access_point_id: id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Access point removed.");
      await loadMap();
    }
  };

  const viewW = venue.width_ft * FT_TO_PX;
  const viewH = venue.height_ft * FT_TO_PX;

  return (
    <section
      className="space-y-4 border-4 border-black bg-slate-950 p-5 text-white shadow-[6px_6px_0_0_#000]"
      aria-labelledby="thermal-map-title"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
            Organizer live operations
          </p>
          <h2
            id="thermal-map-title"
            className="mt-1 flex items-center gap-2 font-display text-2xl font-black uppercase"
          >
            <Wifi className="h-6 w-6 text-cyan-300" /> Event capacity thermal map
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-slate-300">
            Aggregate enterprise Wi-Fi counts refresh every minute. Only mapped access-point totals
            are stored; device identities are never collected.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadMap()}
          disabled={isLoading}
          className="neu-border bg-white font-mono text-xs font-bold uppercase text-black"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {hottestPoint &&
        getThermalRatio(hottestPoint.device_count, hottestPoint.max_device_capacity) >= 1.2 && (
          <div
            className="flex gap-2 border-2 border-red-300 bg-red-950 p-3 text-red-100"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="font-mono text-xs font-bold leading-5">
              {hottestPoint.area_name} is above 120% of its mapped device capacity. Attendees in
              that area have been alerted to move to a less crowded space.
            </p>
          </div>
        )}

      {isLoading ? (
        <div className="h-80 animate-pulse bg-slate-800" aria-label="Loading thermal map" />
      ) : points.length === 0 ? (
        <div className="border-2 border-dashed border-slate-500 p-8 text-center font-mono text-sm text-slate-300">
          Map your first enterprise access point to start receiving live density data.
        </div>
      ) : (
        <div className="overflow-auto border-2 border-slate-700 bg-slate-900 p-3">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="h-auto min-w-[620px] w-full"
            role="img"
            aria-label={`Live capacity thermal map with ${points.length} access points over a ${venue.width_ft} by ${venue.height_ft} foot floorplan`}
          >
            <defs>
              <pattern
                id={`thermal-grid-${eventId}`}
                width={FT_TO_PX}
                height={FT_TO_PX}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${FT_TO_PX} 0 L 0 0 0 ${FT_TO_PX}`}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1"
                />
              </pattern>
              <filter id={`thermal-glow-${eventId}`} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>
            <rect width={viewW} height={viewH} fill={`url(#thermal-grid-${eventId})`} />
            <rect
              x="1"
              y="1"
              width={viewW - 2}
              height={viewH - 2}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="3"
            />
            {assets.map((asset) => (
              <rect
                key={asset.id}
                x={asset.x * FT_TO_PX}
                y={asset.y * FT_TO_PX}
                width={asset.width * FT_TO_PX}
                height={asset.height * FT_TO_PX}
                rx={asset.kind === "round_table" ? (asset.width * FT_TO_PX) / 2 : 4}
                fill={ASSET_DEFAULTS[asset.kind].color}
                fillOpacity="0.65"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            ))}
            {points.map((point) => {
              const ratio = getThermalRatio(point.device_count, point.max_device_capacity);
              const cx = point.x_ft * FT_TO_PX;
              const cy = point.y_ft * FT_TO_PX;
              const radius = point.radius_ft * FT_TO_PX;
              const color = getThermalColor(ratio);
              return (
                <g
                  key={point.access_point_id}
                  aria-label={`${point.area_name}, ${formatDeviceCount(point.device_count)}, ${Math.round(ratio * 100)} percent of capacity`}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={color}
                    fillOpacity="0.45"
                    filter={`url(#thermal-glow-${eventId})`}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={Math.max(6, radius / 5)}
                    fill={color}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  <text
                    x={cx}
                    y={cy - radius - 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {point.area_name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Legend color="#86efac" label="Low density" />
        <Legend color="#facc15" label="High density" />
        <Legend color="#dc2626" label="120%+ alert" />
      </div>

      <div className="border-t-2 border-slate-700 pt-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-mono text-xs font-black uppercase tracking-wider">
              Mapped access points
            </h3>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              Coordinates use the saved floorplan’s feet-based coordinate system.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowMapping((current) => !current)}
            className="neu-border bg-cyan-300 font-mono text-xs font-black uppercase text-black hover:bg-cyan-200"
          >
            <Plus className="mr-2 h-4 w-4" /> {showMapping ? "Close mapping" : "Map access point"}
          </Button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {points.map((point) => (
            <div
              key={point.access_point_id}
              className="flex items-center justify-between gap-3 border-2 border-slate-700 bg-slate-900 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-bold">
                  {point.label} · {point.area_name}
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  {formatDeviceCount(point.device_count)} / {point.max_device_capacity} ·{" "}
                  {point.x_ft}ft, {point.y_ft}ft
                </p>
              </div>
              <button
                type="button"
                onClick={() => void deletePoint(point.access_point_id)}
                className="border-2 border-red-300 p-2 text-red-300 hover:bg-red-950"
                aria-label={`Remove ${point.label}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showMapping && (
        <div className="grid gap-3 border-2 border-cyan-300 bg-slate-900 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="MAC address"
            value={form.macAddress}
            placeholder="AA:BB:CC:DD:EE:FF"
            onChange={(value) => setForm({ ...form, macAddress: value })}
          />
          <Field
            label="Label"
            value={form.label}
            placeholder="Gym A AP 01"
            onChange={(value) => setForm({ ...form, label: value })}
          />
          <Field
            label="Area name"
            value={form.areaName}
            placeholder="Gym A"
            onChange={(value) => setForm({ ...form, areaName: value })}
          />
          <Field
            label="X feet"
            value={form.xFt}
            placeholder="20"
            type="number"
            onChange={(value) => setForm({ ...form, xFt: value })}
          />
          <Field
            label="Y feet"
            value={form.yFt}
            placeholder="15"
            type="number"
            onChange={(value) => setForm({ ...form, yFt: value })}
          />
          <Field
            label="Heat radius feet"
            value={form.radiusFt}
            placeholder="12"
            type="number"
            onChange={(value) => setForm({ ...form, radiusFt: value })}
          />
          <Field
            label="Device capacity"
            value={form.maxCapacity}
            placeholder="100"
            type="number"
            onChange={(value) => setForm({ ...form, maxCapacity: value })}
          />
          <div className="flex items-end">
            <Button
              type="button"
              onClick={() => void savePoint()}
              disabled={isSaving}
              className="neu-border w-full bg-lime font-mono text-xs font-black uppercase text-black"
            >
              {isSaving ? "Saving…" : "Save mapping"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        <Radio className="h-3.5 w-3.5 text-lime-300" /> Live data is aggregated by access point ·{" "}
        <MapPin className="h-3.5 w-3.5 text-cyan-300" /> {points.length} mapped
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="font-mono text-[10px] font-bold uppercase text-slate-200">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border-2 border-slate-500 bg-slate-950 p-2 text-xs text-white placeholder:text-slate-600"
      />
    </label>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-slate-300">
      <span
        className="h-3 w-3 rounded-full border border-white"
        style={{ backgroundColor: color }}
      />{" "}
      {label}
    </div>
  );
}
