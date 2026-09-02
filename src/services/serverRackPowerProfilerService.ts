import {
  LOW_PRIORITY_STUDENT_SELECTOR,
  evaluateRackPower,
  kubernetesThrottlePatch,
  parsePduTelemetry,
  pduStatusPath,
  type PduVendor,
  type ThrottleDecision,
} from "@/lib/serverRackPowerProfiler";

export type HttpFn = (input: string, init?: RequestInit) => Promise<Response>;

export type RackPowerProfilerConfig = {
  pduBaseUrl: string;
  pduVendor: PduVendor;
  pduToken?: string;
  kubernetesApiUrl: string;
  kubernetesToken?: string;
  kubernetesNamespace?: string;
};

type PodList = {
  items?: Array<{
    metadata?: { name?: string; namespace?: string };
    spec?: { containers?: Array<{ name: string }> };
  }>;
};

export async function fetchRackPowerReading(
  config: RackPowerProfilerConfig,
  http: HttpFn = fetch,
): Promise<ThrottleDecision> {
  const url = `${config.pduBaseUrl.replace(/\/$/, "")}${pduStatusPath(config.pduVendor)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.pduToken) headers.Authorization = `Bearer ${config.pduToken}`;

  const response = await http(url, { headers });
  if (!response.ok) {
    throw new Error(`PDU API ${response.status}`);
  }
  const payload = await response.json();
  return evaluateRackPower(parsePduTelemetry(config.pduVendor, payload));
}

export async function throttleLowPriorityStudentContainers(
  config: RackPowerProfilerConfig,
  http: HttpFn = fetch,
): Promise<string[]> {
  const namespace = config.kubernetesNamespace || "hackathon";
  const listUrl = `${config.kubernetesApiUrl.replace(/\/$/, "")}/api/v1/namespaces/${namespace}/pods?labelSelector=${encodeURIComponent(LOW_PRIORITY_STUDENT_SELECTOR)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.kubernetesToken) headers.Authorization = `Bearer ${config.kubernetesToken}`;

  const listResponse = await http(listUrl, { headers });
  if (!listResponse.ok) {
    throw new Error(`Kubernetes API ${listResponse.status}`);
  }
  const list = (await listResponse.json()) as PodList;
  const throttled: string[] = [];
  const limits = kubernetesThrottlePatch().spec.containers[0].resources.limits;

  for (const pod of list.items ?? []) {
    const name = pod.metadata?.name;
    if (!name) continue;
    const containers = (pod.spec?.containers ?? []).map((container) => ({
      name: container.name,
      resources: { limits },
    }));
    const patchUrl = `${config.kubernetesApiUrl.replace(/\/$/, "")}/api/v1/namespaces/${namespace}/pods/${name}`;
    const patchResponse = await http(patchUrl, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/strategic-merge-patch+json" },
      body: JSON.stringify({ spec: { containers } }),
    });
    if (!patchResponse.ok) {
      throw new Error(`Kubernetes throttle ${patchResponse.status}`);
    }
    throttled.push(name);
  }

  return throttled;
}

export async function profileRackAndThrottleIfNeeded(
  config: RackPowerProfilerConfig,
  http: HttpFn = fetch,
): Promise<{ decision: ThrottleDecision; throttledPods: string[] }> {
  const decision = await fetchRackPowerReading(config, http);
  if (!decision.exceedsThreshold) {
    return { decision, throttledPods: [] };
  }
  const throttledPods = await throttleLowPriorityStudentContainers(config, http);
  return { decision, throttledPods };
}
