export interface HardwareAsset {
  id: string;
  rfidTagEpc: string;
  name: string;
  category: 'drone' | 'camera' | 'sensor_kit' | 'vr_headset' | 'microcontroller' | 'power_station';
  assetTagNumber: string;
  serialNumber: string;
  valuationUsd: number;
  status: 'available' | 'checked_out' | 'maintenance' | 'flagged_unauthorized';
  locationId: string;
  rfidGateId?: string;
  lastScannedAt?: string;
  created_at: string;
  updated_at: string;
}

export interface HardwareBooking {
  id: string;
  assetId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentIdCardNumber: string;
  startTime: string;
  endTime: string;
  status: 'reserved' | 'active' | 'completed' | 'overdue' | 'cancelled';
  purposeDescription: string;
  approvedByStaffId?: string;
  checkedOutAt?: string;
  returnedAt?: string;
  created_at: string;
}

export interface RfidGateScanEvent {
  id: string;
  gateId: string;
  gateLocation: string;
  rfidTagEpc: string;
  antennaNumber: number;
  rssi: number;
  scanTimestamp: string;
  identifiedStudentId?: string;
  identificationMethod?: 'rfid_badge' | 'facial_recognition_camera' | 'pin_pad' | 'unknown';
  cameraSnapshotUrl?: string;
}

export interface RfidSecurityEvaluationResult {
  asset: HardwareAsset | null;
  activeBooking: HardwareBooking | null;
  isAuthorized: boolean;
  actionTaken: 'checkout_approved' | 'silent_alarm_triggered' | 'unauthorized_penalty_applied' | 'unknown_tag_ignored';
  penaltyApplied?: {
    penaltyAmountUsd: number;
    chargedStudentId: string;
    incidentId: string;
    ledgerEntryId: string;
    timestamp: string;
  };
  doorsLocked: boolean;
  silentAlarmBroadcast: boolean;
  emergencyDroneDispatched: boolean;
  message: string;
}

export interface StudentFinancialLedgerPenalty {
  id: string;
  studentId: string;
  studentName: string;
  incidentType: 'unauthorized_hardware_removal' | 'late_return' | 'damaged_hardware';
  amountUsd: number;
  status: 'pending' | 'charged' | 'disputed' | 'waived';
  assetId: string;
  rfidGateId: string;
  timestamp: string;
  reason: string;
}
