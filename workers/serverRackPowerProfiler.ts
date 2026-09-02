// =============================================================================
// Worker: Student Union rack power profiler
// Issue: #5282 - Poll APC/CyberPower PDUs and throttle low-priority K8s loads
// =============================================================================

import {
  profileRackAndThrottleIfNeeded,
  type RackPowerProfilerConfig,
} from "../src/services/serverRackPowerProfilerService";
import type { PduVendor } from "../src/lib/serverRackPowerProfiler";

const POLL_MS = 2000;

function configFromEnv(): RackPowerProfilerConfig {
  const vendor = (process.env.PDU_VENDOR || "apc").toLowerCase();
  return {
    pduBaseUrl: process.env.PDU_BASE_URL || "https://pdu.student-union.campus",
    pduVendor: vendor === "cyberpower" ? "cyberpower" : "apc",
    pduToken: process.env.PDU_API_TOKEN,
    kubernetesApiUrl: process.env.K8S_API_URL || "https://kubernetes.default.svc",
    kubernetesToken: process.env.K8S_API_TOKEN,
    kubernetesNamespace: process.env.K8S_NAMESPACE || "hackathon",
  };
}

export async function pollRackPowerOnce(
  config: RackPowerProfilerConfig = configFromEnv(),
): Promise<void> {
  const result = await profileRackAndThrottleIfNeeded(config);
  if (result.decision.exceedsThreshold) {
    console.warn(
      `[rack-power] ${result.decision.reading.watts}W / ${result.decision.reading.amps}A exceeded ${result.decision.thresholdAmps}A; throttled ${result.throttledPods.length} student pods`,
    );
  }
}

if (process.env.RACK_POWER_WORKER === "1") {
  void pollRackPowerOnce();
  setInterval(() => {
    void pollRackPowerOnce();
  }, POLL_MS);
}
