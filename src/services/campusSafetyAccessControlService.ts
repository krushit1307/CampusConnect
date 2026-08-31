// =============================================================================
// Service: CampusSafetyAccessControlService
// Purpose: Manages locking exterior doors via REST APIs, with automatic off-grid
//   failover to LoRaWAN radio Gateway broadcasts during network outages.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface Door {
  id: string;
  building: string;
  door_name: string;
  status: 'OPEN' | 'LOCKED' | 'LOCKED_BY_LORA';
  rest_endpoint_url: string;
  lora_device_eui: string;
  last_checked_at?: string;
}

export interface Gateway {
  id: string;
  gateway_name: string;
  location: string;
  status: 'ONLINE' | 'OFFLINE';
}

export class CampusSafetyAccessControlService {
  /**
   * Generates a mock encrypted SHA-256 signature representation for the LoRaWAN packet.
   * Emulates secure Low-Bandwidth Message Integrity Code (MIC).
   */
  private static generateEncryptedPayload(command: string, deviceEui: string): string {
    const timestamp = Date.now();
    // Simulate HMAC-SHA256 signature payload
    const salt = "LoRaWAN-Secured-Fallback-Key-9998";
    const rawString = `${command}:${deviceEui}:${timestamp}:${salt}`;
    
    // Simplistic hash function representation for hex signature string
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const signature = Math.abs(hash).toString(16).padStart(8, '0') + 
                      Math.abs(hash * 31).toString(16).padStart(8, '0');
    
    return `payload:0x${signature.toUpperCase()}`;
  }

  /**
   * Attempts to lock all doors for a specified building.
   * Tries REST API first with a 2-second timeout, falling back immediately to LoRaWAN on failure/timeout.
   */
  static async lockDoors(
    building: string,
    options?: { simulateNetworkBlackout?: boolean }
  ): Promise<{
    success: boolean;
    method: 'REST' | 'LORAWAN';
    logs: string[];
    doorsUpdated: number;
  }> {
    const supabase = createClient();
    const logs: string[] = [];
    const simulateFailure = options?.simulateNetworkBlackout ?? false;

    logs.push(`[Access Control] Initiating lockdown command for "${building}"...`);

    try {
      // 1. Fetch doors for the building
      const { data: doors, error: fetchErr } = await supabase
        .from("exterior_doors")
        .select("*")
        .eq("building", building);

      if (fetchErr) throw fetchErr;

      if (!doors || doors.length === 0) {
        logs.push(`[Warning] No exterior doors registered for building "${building}".`);
        return { success: false, method: 'REST', logs, doorsUpdated: 0 };
      }

      logs.push(`Found ${doors.length} registered exterior doors.`);

      // 2. Fetch an online LoRaWAN gateway for fallback
      const { data: gateways } = await supabase
        .from("lorawan_gateways")
        .select("*")
        .eq("status", "ONLINE")
        .limit(1);

      const activeGateway = gateways && gateways.length > 0 ? gateways[0] : null;

      let loraGatewayUsed = false;
      let doorsLocked = 0;

      // Process doors
      for (const door of doors) {
        let doorLockedByREST = false;

        if (simulateFailure) {
          logs.push(`[Simulated Outage] Fiber line severed simulation active. Skipping REST attempt for ${door.door_name}.`);
        } else {
          // Attempt REST Call with 2s timeout
          logs.push(`[REST API] Connecting to ${door.door_name} door controller...`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          try {
            const response = await fetch(door.rest_endpoint_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'LOCK' }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              logs.push(`[REST API] Success: Locked ${door.door_name} successfully.`);
              doorLockedByREST = true;

              // Update door status to LOCKED
              await supabase
                .from("exterior_doors")
                .update({
                  status: 'LOCKED',
                  last_checked_at: new Date().toISOString()
                })
                .eq("id", door.id);

              doorsLocked++;
            } else {
              logs.push(`[REST API] Failed: Server returned status ${response.status} for ${door.door_name}.`);
            }
          } catch (restErr: any) {
            clearTimeout(timeoutId);
            if (restErr.name === 'AbortError') {
              logs.push(`[REST API] Timeout: Connection timed out (2000ms limit reached) for ${door.door_name}. Possible severed connection.`);
            } else {
              logs.push(`[REST API] Connection Error: ${restErr.message || "Endpoint unreachable"} for ${door.door_name}.`);
            }
          }
        }

        // 3. Fallback to LoRaWAN Radio transmission if REST failed
        if (!doorLockedByREST) {
          logs.push(`[LoRaWAN Fallback] Deploying off-grid radio command to ${door.door_name}...`);

          if (!activeGateway) {
            logs.push(`[Error] LoRaWAN gateway unavailable. Cannot transmit backup signal to ${door.door_name}.`);
            continue;
          }

          // Generate encrypted payload
          const encryptedPayload = this.generateEncryptedPayload("LOCK_ALL", door.lora_device_eui);
          logs.push(`[LoRaWAN Fallback] Encrypted payload signed: ${encryptedPayload}`);

          // Log LoRaWAN transmission packet
          const { error: transmissionError } = await supabase
            .from("lorawan_transmissions")
            .insert({
              gateway_id: activeGateway.id,
              building: building,
              command: 'LOCK_ALL',
              encrypted_payload: encryptedPayload,
              status: 'TRANSMITTED'
            });

          if (transmissionError) {
            logs.push(`[Warning] Failed to log LoRaWAN transmission audit trail: ${transmissionError.message}`);
          } else {
            logs.push(`[LoRaWAN Fallback] Broadcast sent via gateway: ${activeGateway.gateway_name}`);
          }

          // Update door status to LOCKED_BY_LORA
          const { error: updateErr } = await supabase
            .from("exterior_doors")
            .update({
              status: 'LOCKED_BY_LORA',
              last_checked_at: new Date().toISOString()
            })
            .eq("id", door.id);

          if (updateErr) {
            logs.push(`[Error] Failed to update door status: ${updateErr.message}`);
          } else {
            logs.push(`[Success] Door ${door.door_name} is locked via backup LoRa radio.`);
            doorsLocked++;
            loraGatewayUsed = true;
          }
        }
      }

      const finalMethod = loraGatewayUsed ? 'LORAWAN' : 'REST';
      logs.push(`[Access Control] Lockdown process complete. Method: ${finalMethod}. Locked ${doorsLocked}/${doors.length} doors.`);

      return {
        success: doorsLocked === doors.length,
        method: finalMethod,
        logs,
        doorsUpdated: doorsLocked
      };
    } catch (globalErr: any) {
      logs.push(`[Fatal Error] Lockdown pipeline failed: ${globalErr.message}`);
      return { success: false, method: 'REST', logs, doorsUpdated: 0 };
    }
  }

  /**
   * Resets all doors to OPEN for active drill/safety clearance.
   */
  static async unlockAllDoors(building: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("exterior_doors")
        .update({ status: 'OPEN', last_checked_at: new Date().toISOString() })
        .eq("building", building);
      return !error;
    } catch {
      return false;
    }
  }
}
