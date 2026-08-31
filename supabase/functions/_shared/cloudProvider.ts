export interface CloudProvider {
  provisionInstances(
    count: number,
    instanceType: string,
    tags: Record<string, string>,
  ): Promise<{ instanceIds: string[]; status: string }>;
  terminateInstances(instanceIds: string[]): Promise<boolean>;
  getInstanceDetails(
    instanceId: string,
  ): Promise<{ publicIp?: string; privateIp?: string; status: string }>;
}

export class MockAwsProvider implements CloudProvider {
  async provisionInstances(count: number, instanceType: string, tags: Record<string, string>) {
    console.log(`[MOCK AWS] Provisioning ${count} of ${instanceType} with tags`, tags);
    const instanceIds = Array.from({ length: count }).map((_, i) => `i-mock-${Date.now()}-${i}`);
    return { instanceIds, status: "active" };
  }

  async terminateInstances(instanceIds: string[]) {
    console.log(`[MOCK AWS] Terminating instances: ${instanceIds.join(", ")}`);
    return true;
  }

  async getInstanceDetails(instanceId: string) {
    return {
      publicIp: `203.0.113.${Math.floor(Math.random() * 255)}`,
      privateIp: `10.0.0.${Math.floor(Math.random() * 255)}`,
      status: "active",
    };
  }
}

export class RealAwsProvider implements CloudProvider {
  async provisionInstances(count: number, instanceType: string, tags: Record<string, string>) {
  // In a real implementation, this would use the AWS SDK for Deno (e.g., via esm.sh)
  // and credentials from Deno.env.get('AWS_ACCESS_KEY_ID'), etc.
  // For the scope of this PR, the framework is here and relies on the mock for dev.

  async provisionInstances(count: number, instanceType: string, tags: Record<string, string>) {
    // REAL AWS logic using Deno.env
    throw new Error("Real AWS provisioning not fully implemented in this stub.");
  }
  async terminateInstances(instanceIds: string[]) {
    throw new Error("Real AWS termination not fully implemented in this stub.");
  }
  async getInstanceDetails(instanceId: string) {
    throw new Error("Real AWS details not fully implemented in this stub.");
  }
}

export function getCloudProvider(): CloudProvider {
  const env = Deno.env.get("ENVIRONMENT") || "development";
  // As requested: "For local development and tests, provide a mock provider so tests NEVER create real cloud resources."
  if (env === "development" || env === "test" || !Deno.env.get("AWS_ACCESS_KEY_ID")) {
    return new MockAwsProvider();
  }
  return new RealAwsProvider();
}
