/**
 * smartwatchHaptics.ts
 * 
 * Web Bluetooth (BLE) Integration for Haptic Smartwatches (Apple Watch / WearOS).
 * Offloads spatial navigation telemetry for visually impaired users to physical wrist feedback.
 */

// Custom BLE UUIDs for the companion smartwatch app
const HAPTIC_SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const HAPTIC_CHARACTERISTIC_UUID = "12345678-1234-5678-1234-56789abcdef1";

export enum HapticAction {
  TURN_LEFT = 0x01,
  TURN_RIGHT = 0x02,
  STOP_OBSTACLE = 0x03,
  CLEAR = 0x04
}

export class SmartwatchHapticsAdapter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  
  public isConnected: boolean = false;

  /**
   * Requests pairing with a nearby companion smartwatch.
   * MUST be called directly from a user gesture (e.g., button click) per Web Bluetooth security policies.
   */
  public async connect(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.bluetooth) {
      console.warn("[Smartwatch BLE] Web Bluetooth API not supported in this browser.");
      return false;
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HAPTIC_SERVICE_UUID] }],
        optionalServices: [HAPTIC_SERVICE_UUID]
      });

      if (!this.device || !this.device.gatt) return false;

      this.device.addEventListener("gattserverdisconnected", this.handleDisconnect);
      
      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(HAPTIC_SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(HAPTIC_CHARACTERISTIC_UUID);

      this.isConnected = true;
      console.log(`[Smartwatch BLE] Connected to ${this.device.name}`);
      return true;

    } catch (err) {
      console.error("[Smartwatch BLE] Connection failed:", err);
      this.isConnected = false;
      return false;
    }
  }

  public disconnect(): void {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.handleDisconnect();
  }

  private handleDisconnect = (): void => {
    console.log("[Smartwatch BLE] Device disconnected.");
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.characteristic = null;
  };

  /**
   * Dispatches a single-byte payload over BLE to trigger specific physical haptic feedback.
   */
  public async sendHapticSignal(action: HapticAction): Promise<void> {
    if (!this.isConnected || !this.characteristic) {
      // Graceful fallback for environments lacking BLE support
      console.debug(`[Smartwatch BLE - MOCK] Dispatching haptic signal: 0x0${action.toString(16)}`);
      return;
    }

    try {
      const payload = new Uint8Array([action]);
      await this.characteristic.writeValue(payload);
    } catch (err) {
      console.error("[Smartwatch BLE] Failed to send haptic signal:", err);
    }
  }
}

export const smartwatchHapticsAdapter = new SmartwatchHapticsAdapter();
