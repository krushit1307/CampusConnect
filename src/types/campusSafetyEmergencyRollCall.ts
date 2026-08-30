/**
 * Type definitions for Real-Time Campus Safety Emergency Roll Call.
 * Issue: #5097 - Real-Time "Campus Safety" Emergency Roll Call
 */

export type EmergencyType =
  | "FIRE_EVACUATION"
  | "ACTIVE_THREAT"
  | "SEVERE_WEATHER"
  | "HAZMAT_LEAK"
  | "OFF_CAMPUS_TRIP_CHECK"
  | "GENERAL_SAFETY_DRILL";

export type RollCallStatus = "ACTIVE" | "EXPIRED" | "RESOLVED" | "CANCELLED";

export type AttendeeSafetyStatus = "PENDING" | "SAFE" | "NEED_ASSISTANCE" | "OVERDUE";

export interface EmergencyRollCallCheck {
  id: string;
  eventId: string;
  eventTitle: string;
  campusLocation: string;
  emergencyType: EmergencyType;
  initiatedByUserId: string;
  initiatedByName: string;
  expiresAt: string; // ISO String (e.g. 15 mins from initiation)
  status: RollCallStatus;
  totalAttendeesCount: number;
  safeCount: number;
  assistanceNeededCount: number;
  overdueCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyRollCallAttendeeResponse {
  id: string;
  rollCallCheckId: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  status: AttendeeSafetyStatus;
  respondedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  assistanceDetails?: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  droneDispatched: boolean;
}

export interface RollCallStatsSummary {
  totalCount: number;
  safeCount: number;
  assistanceNeededCount: number;
  overdueCount: number;
  pendingCount: number;
  safePercentage: number;
  isTimerExpired: boolean;
}
