export type EquipmentCategory = 'hpc_gpu' | '3d_printer' | 'vr_suite' | 'microscope' | 'laser_cutter';
export type EquipmentStatus = 'operational' | 'in_use' | 'maintenance' | 'offline';

export interface LabEquipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  labLocation: string;
  status: EquipmentStatus;
  hourlyLimitPerWeek: number;
  requiredCertificationId?: string;
  requiredCertificationName?: string;
  specs: Record<string, string>; // e.g. { "GPU": "4x NVIDIA H100", "VRAM": "320GB" }
  telemetry?: {
    utilizationPercent: number;
    temperatureCelsius: number;
    powerWattage: number;
    currentJobName?: string;
  };
}

export interface EquipmentReservation {
  id: string;
  equipmentId: string;
  equipmentName: string;
  studentId: string;
  studentName: string;
  startTime: string; // ISO String
  endTime: string;
  purpose: string;
  status: 'confirmed' | 'active' | 'completed' | 'cancelled';
}

export interface UserSafetyCertification {
  id: string;
  title: string;
  passedAt: string;
  expiresAt: string;
  scorePercent: number;
}
