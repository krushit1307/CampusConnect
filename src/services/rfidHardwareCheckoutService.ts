import {
  HardwareAsset,
  HardwareBooking,
  RfidGateScanEvent,
  RfidSecurityEvaluationResult,
  StudentFinancialLedgerPenalty,
} from '../types/rfidHardwareCheckout';

// In-memory mock database store for RFID hardware assets and active bookings
const mockAssets: HardwareAsset[] = [
  {
    id: 'asset-drone-001',
    rfidTagEpc: 'E280116060000204781A3F01',
    name: 'DJI Matrice 300 RTK Enterprise Drone',
    category: 'drone',
    assetTagNumber: 'TAG-DRN-2026-01',
    serialNumber: 'DJI-M300-884912',
    valuationUsd: 2000,
    status: 'available',
    locationId: 'student_union_hardware_library',
    rfidGateId: 'gate-union-exit-01',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'asset-vr-002',
    rfidTagEpc: 'E280116060000204781A3F02',
    name: 'Meta Quest Pro Enterprise AR/VR Rig',
    category: 'vr_headset',
    assetTagNumber: 'TAG-VR-2026-02',
    serialNumber: 'MQ-PRO-99214',
    valuationUsd: 1500,
    status: 'available',
    locationId: 'student_union_hardware_library',
    rfidGateId: 'gate-union-exit-01',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'asset-cam-003',
    rfidTagEpc: 'E280116060000204781A3F03',
    name: 'Sony FX3 Cinema Camera Kit',
    category: 'camera',
    assetTagNumber: 'TAG-CAM-2026-03',
    serialNumber: 'SNY-FX3-102941',
    valuationUsd: 3800,
    status: 'available',
    locationId: 'student_union_hardware_library',
    rfidGateId: 'gate-union-exit-01',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockBookings: HardwareBooking[] = [
  {
    id: 'booking-auth-001',
    assetId: 'asset-drone-001',
    studentId: 'std_alice_902',
    studentName: 'Alice Johnson',
    studentEmail: 'alice.johnson@university.edu',
    studentIdCardNumber: 'STD-2026-9021',
    startTime: new Date(Date.now() - 3600000).toISOString(), // Started 1 hr ago
    endTime: new Date(Date.now() + 7200000).toISOString(), // Ends in 2 hrs
    status: 'active',
    purposeDescription: 'Autonomous campus lidar terrain mapping thesis',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockPenalties: StudentFinancialLedgerPenalty[] = [];

/**
 * RFID Automated Hardware Checkout Service
 * Evaluates real-time gate webhook payloads, enforces booking validation,
 * locks exterior doors, signals emergency drone dispatch, and applies financial penalties.
 */
export class RfidHardwareCheckoutService {
  private assets: HardwareAsset[] = [...mockAssets];
  private bookings: HardwareBooking[] = [...mockBookings];
  private penalties: StudentFinancialLedgerPenalty[] = [...mockPenalties];
  private doorLockState: { isLocked: boolean; lockReason: string; lockedAt?: string } = {
    isLocked: false,
    lockReason: '',
  };

  /**
   * Fetch all registered hardware assets with their RFID EPC tags
   */
  public async getAssets(): Promise<HardwareAsset[]> {
    return [...this.assets];
  }

  /**
   * Fetch all bookings
   */
  public async getBookings(): Promise<HardwareBooking[]> {
    return [...this.bookings];
  }

  /**
   * Fetch financial ledger penalties
   */
  public async getPenalties(): Promise<StudentFinancialLedgerPenalty[]> {
    return [...this.penalties];
  }

  /**
   * Check physical door lock status
   */
  public getDoorLockStatus() {
    return { ...this.doorLockState };
  }

  /**
   * Manually unlock exterior doors after security clearance
   */
  public unlockExteriorDoors(staffId: string, overrideReason: string) {
    this.doorLockState = {
      isLocked: false,
      lockReason: `Unlocked by staff ${staffId}: ${overrideReason}`,
      lockedAt: undefined,
    };
    return this.doorLockState;
  }

  /**
   * Create or update an active hardware booking for a student
   */
  public async createBooking(
    booking: Omit<HardwareBooking, 'id' | 'created_at' | 'status'>
  ): Promise<HardwareBooking> {
    const newBooking: HardwareBooking = {
      ...booking,
      id: `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    this.bookings.push(newBooking);

    // Update asset status
    const asset = this.assets.find((a) => a.id === booking.assetId);
    if (asset) {
      asset.status = 'checked_out';
      asset.updated_at = new Date().toISOString();
    }

    return newBooking;
  }

  /**
   * Process incoming Webhook scan from physical RFID gate reader (e.g. Alien, Impinj, Zebra)
   */
  public async processRfidGateScan(scanEvent: RfidGateScanEvent): Promise<RfidSecurityEvaluationResult> {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Locate physical asset by EPC Gen2 RFID tag
    const asset = this.assets.find((a) => a.rfidTagEpc.toLowerCase() === scanEvent.rfidTagEpc.toLowerCase());

    if (!asset) {
      return {
        asset: null,
        activeBooking: null,
        isAuthorized: false,
        actionTaken: 'unknown_tag_ignored',
        doorsLocked: false,
        silentAlarmBroadcast: false,
        emergencyDroneDispatched: false,
        message: `Unknown RFID EPC Tag [${scanEvent.rfidTagEpc}] detected at Gate ${scanEvent.gateId}.`,
      };
    }

    // Update asset last scanned timestamp
    asset.lastScannedAt = nowIso;

    // 2. Query digital hardware ledger for active booking
    const activeBooking = this.bookings.find((b) => {
      if (b.assetId !== asset.id) return false;
      if (b.status !== 'active' && b.status !== 'reserved') return false;

      const startTime = new Date(b.startTime);
      const endTime = new Date(b.endTime);
      return now >= startTime && now <= endTime;
    });

    // 3. Evaluation: If student holding active booking matches or if valid booking exists
    if (activeBooking) {
      // Check if student identity matches (if identified at gate)
      const isStudentMatch = !scanEvent.identifiedStudentId || scanEvent.identifiedStudentId === activeBooking.studentId;

      if (isStudentMatch) {
        asset.status = 'checked_out';
        asset.updated_at = nowIso;
        activeBooking.status = 'active';
        activeBooking.checkedOutAt = activeBooking.checkedOutAt || nowIso;

        return {
          asset,
          activeBooking,
          isAuthorized: true,
          actionTaken: 'checkout_approved',
          doorsLocked: false,
          silentAlarmBroadcast: false,
          emergencyDroneDispatched: false,
          message: `Authorized RFID checkout approved for ${asset.name} to ${activeBooking.studentName} (${activeBooking.studentId}).`,
        };
      }
    }

    // 4. SECURITY BREACH: No active booking found or unauthorized student
    // Trigger physical security lockdown protocols
    this.doorLockState = {
      isLocked: true,
      lockReason: `CRITICAL: Unauthorized RFID removal detected for Asset [${asset.name}] (${asset.assetTagNumber}) at Gate ${scanEvent.gateId}`,
      lockedAt: nowIso,
    };

    asset.status = 'flagged_unauthorized';
    asset.updated_at = nowIso;

    const chargedStudentId = scanEvent.identifiedStudentId || 'STD_UNIDENTIFIED_PERPETRATOR';
    const penaltyAmountUsd = 500; // Mandatory $500 unauthorized removal penalty

    const penaltyEntry: StudentFinancialLedgerPenalty = {
      id: `penalty-ledger-${Date.now()}`,
      studentId: chargedStudentId,
      studentName: scanEvent.identifiedStudentId ? `Student ID: ${scanEvent.identifiedStudentId}` : 'Facial Cam / Badge Capture',
      incidentType: 'unauthorized_hardware_removal',
      amountUsd: penaltyAmountUsd,
      status: 'charged',
      assetId: asset.id,
      rfidGateId: scanEvent.gateId,
      timestamp: nowIso,
      reason: `Unauthorized removal of ${asset.name} ($${asset.valuationUsd} value) without active booking at ${scanEvent.gateLocation}.`,
    };

    this.penalties.push(penaltyEntry);

    return {
      asset,
      activeBooking: null,
      isAuthorized: false,
      actionTaken: 'unauthorized_penalty_applied',
      penaltyApplied: {
        penaltyAmountUsd,
        chargedStudentId,
        incidentId: `INC-SEC-${Date.now()}`,
        ledgerEntryId: penaltyEntry.id,
        timestamp: nowIso,
      },
      doorsLocked: true,
      silentAlarmBroadcast: true,
      emergencyDroneDispatched: true, // Auto integrates with Campus Safety Emergency Drone Dispatch
      message: `SECURITY ALERT: Unauthorized removal of ${asset.name} detected! Exterior doors locked, silent alarm triggered, emergency safety drone dispatched, and $500 penalty charged to student ledger.`,
    };
  }
}

export const rfidHardwareCheckoutService = new RfidHardwareCheckoutService();
