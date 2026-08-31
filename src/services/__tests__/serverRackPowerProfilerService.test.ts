import { describe, expect, it, vi } from "vitest";
import { profileRackAndThrottleIfNeeded } from "../serverRackPowerProfilerService";

const config = {
  pduBaseUrl: "https://pdu.union.campus",
  pduVendor: "cyberpower" as const,
  kubernetesApiUrl: "https://k8s.hackathon.campus",
  kubernetesNamespace: "hackathon",
};

describe("server rack power profiler service (#5282)", () => {
  it("throttles low-priority student pods when PDU draw exceeds the breaker cap", async () => {
    const http = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/v1/pdu/status")) {
        return new Response(JSON.stringify({ data: { power_watt: 4000, voltage: 120 } }), {
          status: 200,
        });
      }
      if (url.includes("/pods?") && !init?.method) {
        return new Response(
          JSON.stringify({
            items: [
              {
                metadata: { name: "student-gpu-low-1" },
                spec: { containers: [{ name: "notebook" }] },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    });

    const result = await profileRackAndThrottleIfNeeded(config, http);
    expect(result.decision.exceedsThreshold).toBe(true);
    expect(result.throttledPods).toEqual(["student-gpu-low-1"]);
    const patchCall = http.mock.calls.find((call) => call[1]?.method === "PATCH");
    expect(patchCall?.[0]).toContain("/pods/student-gpu-low-1");
    expect(
      JSON.parse(String(patchCall?.[1]?.body)).spec.containers[0].resources.limits[
        "nvidia.com/gpu"
      ],
    ).toBe("0");
  });

  it("does not call Kubernetes when the rack is under the 85% threshold", async () => {
    const http = vi.fn(async () => {
      return new Response(JSON.stringify({ amps: 10, volts: 120 }), { status: 200 });
    });
    const result = await profileRackAndThrottleIfNeeded({ ...config, pduVendor: "apc" }, http);
    expect(result.decision.exceedsThreshold).toBe(false);
    expect(result.throttledPods).toEqual([]);
    expect(http).toHaveBeenCalledTimes(1);
  });
});
