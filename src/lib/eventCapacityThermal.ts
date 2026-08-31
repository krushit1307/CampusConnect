export type WifiProvider = "meraki" | "aruba" | "normalized";

export type WifiDensityReading = {
  macAddress: string;
  deviceCount: number;
};

export type ThermalAccessPoint = {
  access_point_id: string;
  mac_address: string;
  label: string;
  area_name: string;
  x_ft: number;
  y_ft: number;
  radius_ft: number;
  max_device_capacity: number;
  device_count: number | null;
  sampled_at: string | null;
  over_capacity: boolean;
};

export function normalizeMacAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/-/g, ":");
  return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(normalized) ? normalized : null;
}

export function normalizeWifiApiResponse(payload: unknown): WifiDensityReading[] {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).data ??
        (payload as Record<string, unknown>).clients ??
        (payload as Record<string, unknown>).results ??
        [])
      : [];
  if (!Array.isArray(records)) return [];

  const readings: WifiDensityReading[] = [];
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const item = record as Record<string, unknown>;
    const macAddress = normalizeMacAddress(
      item.macAddress ?? item.mac ?? item.deviceMac ?? item.access_point_mac ?? item.bssid,
    );
    const rawCount =
      item.clientCount ?? item.clients ?? item.deviceCount ?? item.count ?? item.numClients;
    const deviceCount = typeof rawCount === "number" ? rawCount : Number(rawCount);
    if (!macAddress || !Number.isFinite(deviceCount) || deviceCount < 0 || deviceCount > 1_000_000)
      continue;
    readings.push({ macAddress, deviceCount: Math.floor(deviceCount) });
  }
  return readings;
}

export function getThermalRatio(deviceCount: number | null | undefined, capacity: number): number {
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  return Math.max(0, (deviceCount ?? 0) / capacity);
}

export function getThermalColor(ratio: number): string {
  if (ratio >= 1.2) return "#dc2626";
  if (ratio >= 0.95) return "#f97316";
  if (ratio >= 0.75) return "#facc15";
  if (ratio >= 0.5) return "#38bdf8";
  return "#86efac";
}

export function formatDeviceCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "No reading" : `${value.toLocaleString()} devices`;
}
