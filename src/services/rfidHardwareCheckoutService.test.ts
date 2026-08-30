import { describe, it, expect, beforeEach } from 'vitest';
import { RfidHardwareCheckoutService } from './rfidHardwareCheckoutService';
import { RfidGateScanEvent } from '../types/rfidHardwareCheckout';

describe('RfidHardwareCheckoutService', () => {
  let service: RfidHardwareCheckoutService;

  beforeEach(() => {
    service = new RfidHardwareCheckoutService();
  });

  it('should approve checkout for authorized student with active booking', async () => {
    const assets = await service.getAssets();
    const droneAsset = assets.find((a) => a.category === 'drone');
    expect(droneAsset).toBeDefined();

    const scanEvent: RfidGateScanEvent = {
      id: 'scan-test-01',
      gateId: 'gate-union-exit-01',
      gateLocation: 'Student Union Exit Portal',
      rfidTagEpc: droneAsset!.rfidTagEpc,
      antennaNumber: 1,
      rssi: -40.0,
      scanTimestamp: new Date().toISOString(),
      identifiedStudentId: 'std_alice_902',
      identificationMethod: 'rfid_badge',
    };

    const result = await service.processRfidGateScan(scanEvent);
    expect(result.isAuthorized).toBe(true);
    expect(result.actionTaken).toBe('checkout_approved');
    expect(result.doorsLocked).toBe(false);
    expect(result.silentAlarmBroadcast).toBe(false);
  });

  it('should trigger silent alarm, lock doors, and levy $500 penalty for unauthorized removal', async () => {
    const assets = await service.getAssets();
    const droneAsset = assets.find((a) => a.category === 'drone');
    expect(droneAsset).toBeDefined();

    const scanEvent: RfidGateScanEvent = {
      id: 'scan-test-breach',
      gateId: 'gate-union-exit-01',
      gateLocation: 'Student Union Exit Portal',
      rfidTagEpc: droneAsset!.rfidTagEpc,
      antennaNumber: 1,
      rssi: -38.5,
      scanTimestamp: new Date().toISOString(),
      identifiedStudentId: 'std_intruder_999',
      identificationMethod: 'facial_recognition_camera',
    };

    const result = await service.processRfidGateScan(scanEvent);
    expect(result.isAuthorized).toBe(false);
    expect(result.actionTaken).toBe('unauthorized_penalty_applied');
    expect(result.doorsLocked).toBe(true);
    expect(result.silentAlarmBroadcast).toBe(true);
    expect(result.emergencyDroneDispatched).toBe(true);
    expect(result.penaltyApplied?.penaltyAmountUsd).toBe(500);

    const penalties = await service.getPenalties();
    expect(penalties.length).toBeGreaterThan(0);
    expect(penalties[0].amountUsd).toBe(500);

    const doorStatus = service.getDoorLockStatus();
    expect(doorStatus.isLocked).toBe(true);

    // Verify manual unlock
    service.unlockExteriorDoors('STAFF_007', 'Cleared suspect');
    expect(service.getDoorLockStatus().isLocked).toBe(false);
  });

  it('should ignore unrecognized RFID EPC tags gracefully', async () => {
    const scanEvent: RfidGateScanEvent = {
      id: 'scan-test-unknown',
      gateId: 'gate-union-exit-01',
      gateLocation: 'Student Union Exit Portal',
      rfidTagEpc: 'UNKNOWN_EPC_00000000000000',
      antennaNumber: 2,
      rssi: -70.0,
      scanTimestamp: new Date().toISOString(),
      identifiedStudentId: 'std_random_111',
    };

    const result = await service.processRfidGateScan(scanEvent);
    expect(result.isAuthorized).toBe(false);
    expect(result.actionTaken).toBe('unknown_tag_ignored');
    expect(result.doorsLocked).toBe(false);
  });
});
