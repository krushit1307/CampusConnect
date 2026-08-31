export const BREAKER_AMPS = 20;
export const SAFETY_THRESHOLD_RATIO = 0.85;
export const DEFAULT_RACK_VOLTS = 120;
export const LOW_PRIORITY_STUDENT_SELECTOR = "priority=low,workload=student";

export type PduVendor = "apc" | "cyberpower";

export type RackPowerReading = {
  vendor: PduVendor;
  volts: number;
  amps: number;
  watts: number;
};

export type ThrottleDecision = {
  exceedsThreshold: boolean;
  thresholdAmps: number;
  thresholdWatts: number;
  reading: RackPowerReading;
};

export function safetyThresholdAmps(
  breakerAmps = BREAKER_AMPS,
  ratio = SAFETY_THRESHOLD_RATIO,
): number {
  return breakerAmps * ratio;
}

export function wattsFromAmps(amps: number, volts = DEFAULT_RACK_VOLTS): number {
  return amps * volts;
}

export function ampsFromWatts(watts: number, volts = DEFAULT_RACK_VOLTS): number {
  if (!volts) return 0;
  return watts / volts;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const found = asNumber(source[key]);
    if (found != null) return found;
  }
  return null;
}

export function parsePduTelemetry(vendor: PduVendor, payload: unknown): RackPowerReading {
  const root = (payload ?? {}) as Record<string, unknown>;
  const nested =
    (root.data as Record<string, unknown> | undefined) ||
    (root.device as Record<string, unknown> | undefined) ||
    (root.outletPhaseMeasurement as Record<string, unknown> | undefined) ||
    (root.meter as Record<string, unknown> | undefined) ||
    root;

  const volts =
    pickNumber(nested, ["voltage", "volts", "volt", "input_voltage"]) ??
    pickNumber(root, ["voltage", "volts"]) ??
    DEFAULT_RACK_VOLTS;
  const amps = pickNumber(nested, [
    "current",
    "amps",
    "amp",
    "current_amp",
    "outletCurrent",
    "aggregate_amps",
  ]);
  const watts = pickNumber(nested, [
    "power",
    "watts",
    "watt",
    "power_watt",
    "outletPower",
    "aggregate_watts",
  ]);

  const resolvedAmps = amps ?? (watts != null ? ampsFromWatts(watts, volts) : 0);
  const resolvedWatts = watts ?? wattsFromAmps(resolvedAmps, volts);

  return { vendor, volts, amps: resolvedAmps, watts: resolvedWatts };
}

export function evaluateRackPower(reading: RackPowerReading): ThrottleDecision {
  const thresholdAmps = safetyThresholdAmps();
  const thresholdWatts = wattsFromAmps(thresholdAmps, reading.volts);
  return {
    exceedsThreshold: reading.amps > thresholdAmps || reading.watts > thresholdWatts,
    thresholdAmps,
    thresholdWatts,
    reading,
  };
}

export function kubernetesThrottlePatch(): {
  spec: {
    containers: Array<{
      name: string;
      resources: { limits: Record<string, string> };
    }>;
  };
} {
  return {
    spec: {
      containers: [
        {
          name: "*",
          resources: {
            limits: {
              cpu: "250m",
              memory: "256Mi",
              "nvidia.com/gpu": "0",
            },
          },
        },
      ],
    },
  };
}

export function pduStatusPath(vendor: PduVendor): string {
  return vendor === "cyberpower" ? "/api/v1/pdu/status" : "/rest/pdu/olMeter";
}
