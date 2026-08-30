import axios, { AxiosInstance } from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export interface IseAuthResult {
  deviceId: string;
  status: 'authorized' | 'pending' | 'error';
  message?: string;
}

export interface IseDevicePolicy {
  deviceId: string;
  macAddress: string;
  status: string;
  authorizationLevel: string;
}

class CiscoIseClient {
  private clients: Map<string, AxiosInstance> = new Map();

  /**
   * Get or create ISE client for campus
   */
  private async getClient(campusId: string): Promise<AxiosInstance> {
    // Check cache first
    if (this.clients.has(campusId)) {
      return this.clients.get(campusId)!;
    }

    // Fetch config from database
    const { data: config, error } = await supabase
      .from('ztna_network_config')
      .select('ise_server_url, ise_api_key, ise_api_secret')
      .eq('campus_id', campusId)
      .single();

    if (error || !config) {
      throw new Error(`ISE config not found for campus: ${campusId}`);
    }

    // Create axios client with basic auth
    const client = axios.create({
      baseURL: config.ise_server_url,
      auth: {
        username: config.ise_api_key,
        password: config.ise_api_secret,
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 10000,
    });

    this.clients.set(campusId, client);
    return client;
  }

  /**
   * Authorize a device MAC address with ISE
   */
  async authorizeDeviceMac(
    macAddress: string,
    userId: string,
    sessionId: string,
    campusId: string
  ): Promise<IseAuthResult> {
    try {
      const client = await this.getClient(campusId);

      // Normalize MAC address (remove colons, uppercase)
      const normalizedMac = macAddress.replace(/:/g, '').toUpperCase();

      // Call ISE API to authorize MAC
      const response = await client.post('/api/v1/endpoint', {
        mac: normalizedMac,
        userName: userId,
        sessionId,
        groupTag: 'GuestWiFi',
        description: `CampusConnect WiFi - Session: ${sessionId}`,
        deviceType: 'Mobile-Device',
      });

      return {
        deviceId: response.data.id || normalizedMac,
        status: response.data.status || 'authorized',
        message: response.data.message,
      };
    } catch (err) {
      console.error(`ISE authorization failed for ${macAddress}:`, err);
      return {
        deviceId: '',
        status: 'error',
        message: `Authorization failed: ${err}`,
      };
    }
  }

  /**
   * Revoke device MAC from ISE
   */
  async revokeDeviceMac(
    macAddress: string,
    iseDeviceId: string,
    campusId: string
  ): Promise<boolean> {
    try {
      const client = await this.getClient(campusId);

      // Call ISE API to revoke MAC
      await client.delete(`/api/v1/endpoint/${iseDeviceId}`);

      return true;
    } catch (err) {
      console.error(`ISE revocation failed for ${macAddress}:`, err);
      return false;
    }
  }

  /**
   * Validate device policy with ISE
   */
  async validateDevicePolicy(
    macAddress: string,
    campusId: string
  ): Promise<boolean> {
    try {
      const client = await this.getClient(campusId);

      // Normalize MAC address
      const normalizedMac = macAddress.replace(/:/g, '').toUpperCase();

      // Query ISE for device status
      const response = await client.get('/api/v1/endpoint', {
        params: {
          mac: normalizedMac,
        },
      });

      const device = response.data.resources?.[0];

      if (!device) {
        return false;
      }

      // Check if device is authorized and not quarantined
      const isAuthorized = device.status === 'AUTHORIZED';
      const notQuarantined = device.groupTag !== 'Quarantine';

      return isAuthorized && notQuarantined;
    } catch (err) {
      console.error(`Policy validation failed for ${macAddress}:`, err);
      return false;
    }
  }

  /**
   * Get device status from ISE
   */
  async getDeviceStatus(
    macAddress: string,
    campusId: string
  ): Promise<IseDevicePolicy | null> {
    try {
      const client = await this.getClient(campusId);

      const normalizedMac = macAddress.replace(/:/g, '').toUpperCase();

      const response = await client.get('/api/v1/endpoint', {
        params: {
          mac: normalizedMac,
        },
      });

      const device = response.data.resources?.[0];

      if (!device) {
        return null;
      }

      return {
        deviceId: device.id,
        macAddress: device.mac,
        status: device.status,
        authorizationLevel: device.groupTag,
      };
    } catch (err) {
      console.error(`Failed to get device status:`, err);
      return null;
    }
  }

  /**
   * Bulk authorize multiple MACs (for historical data)
   */
  async bulkAuthorizeDevices(
    devices: Array<{ mac: string; userId: string }>,
    campusId: string
  ): Promise<IseAuthResult[]> {
    const results: IseAuthResult[] = [];

    for (const device of devices) {
      try {
        const result = await this.authorizeDeviceMac(
          device.mac,
          device.userId,
          '',
          campusId
        );
        results.push(result);

        // Add delay between requests to avoid ISE rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        results.push({
          deviceId: '',
          status: 'error',
          message: `Batch authorization failed: ${err}`,
        });
      }
    }

    return results;
  }

  /**
   * Clear all clients (for testing or config refresh)
   */
  clearClients(): void {
    this.clients.clear();
  }
}

// Singleton instance
const iseClient = new CiscoIseClient();

/**
 * Authorize a MAC address with Cisco ISE
 */
export async function authorizeDeviceMac(
  macAddress: string,
  userId: string,
  sessionId: string,
  campusId: string
): Promise<IseAuthResult> {
  return iseClient.authorizeDeviceMac(macAddress, userId, sessionId, campusId);
}

/**
 * Revoke a MAC address from Cisco ISE
 */
export async function revokeDeviceMac(
  macAddress: string,
  iseDeviceId: string,
  campusId: string
): Promise<boolean> {
  return iseClient.revokeDeviceMac(macAddress, iseDeviceId, campusId);
}

/**
 * Validate device policy with Cisco ISE
 */
export async function validateDevicePolicy(
  macAddress: string,
  campusId: string
): Promise<boolean> {
  return iseClient.validateDevicePolicy(macAddress, campusId);
}

/**
 * Get device status from Cisco ISE
 */
export async function getDeviceStatus(
  macAddress: string,
  campusId: string
): Promise<IseDevicePolicy | null> {
  return iseClient.getDeviceStatus(macAddress, campusId);
}

export default {
  authorizeDeviceMac,
  revokeDeviceMac,
  validateDevicePolicy,
  getDeviceStatus,
  iseClient,
};