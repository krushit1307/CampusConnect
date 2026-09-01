// ─── Real-Time Accessibility Need Fulfillment Tracker Types ──────────────────────

import { GeoPoint } from "./accessibility";

export type AccommodationCategory =
  | "mobility"
  | "auditory"
  | "visual"
  | "cognitive"
  | "spatial";

export type FulfillmentStage =
  | "submitted"
  | "triaged"
  | "dispatched"
  | "in_progress"
  | "completed";

export type FulfillmentStatus =
  | "on_schedule"
  | "delayed"
  | "urgent"
  | "completed";

export type UrgencyLevel = "low" | "medium" | "high" | "immediate";

export interface TimelineLogEntry {
  id: string;
  stage: FulfillmentStage;
  text: string;
  timestamp: Date;
  author: string;
  role: "system" | "staff" | "student" | "dispatcher";
}

export interface StudentFeedback {
  rating: number; // 1 to 5 stars
  comment?: string;
  submittedAt: Date;
}

export interface DispatcherInfo {
  id: string;
  name: string;
  role: string; // e.g. "Accessibility Mobility Specialist", "ASL Interpreter Lead"
  phone: string;
  avatar: string;
  currentLocation: GeoPoint;
}

export interface AccommodationRequest {
  id: string; // e.g. "ACC-9042"
  studentId: string;
  studentName: string;
  studentAvatar: string;
  category: AccommodationCategory;
  accommodationType: string; // e.g., "Portable Wheelchair Ramp", "Live ASL Interpreter", "Assistive Listening Headset"
  eventOrLocation: string; // e.g., "Science Symposium Hall B"
  buildingName: string;
  roomNumber?: string;
  urgency: UrgencyLevel;
  currentStage: FulfillmentStage;
  status: FulfillmentStatus;
  
  dispatcher?: DispatcherInfo;
  destinationLocation: GeoPoint;
  
  etaMinutes: number;
  submittedAt: Date;
  estimatedFulfillmentAt: Date;
  completedAt?: Date;
  
  notes: string;
  stageTimestamps: Partial<Record<FulfillmentStage, Date>>;
  timelineLogs: TimelineLogEntry[];
  studentFeedback?: StudentFeedback;
}

export interface FulfillmentMetrics {
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  avgResolutionMinutes: number;
  satisfactionScore: number; // out of 5.0
  onTimePercentage: number;
}

export interface CategoryInfo {
  id: AccommodationCategory;
  name: string;
  description: string;
  iconName: string;
  color: string;
  badgeBg: string;
  examples: string[];
}

export interface StageConfig {
  stage: FulfillmentStage;
  label: string;
  shortDescription: string;
  detailedDescription: string;
  icon: string;
  estimatedDurationMins: number;
}
