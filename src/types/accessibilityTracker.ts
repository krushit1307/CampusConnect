// =============================================================================
// File: src/types/accessibilityTracker.ts
// Issue: #4307 - Build a 'Real-Time "Accessibility Need" Fulfillment Tracker'
// Description: Type definitions for real-time accessibility accommodation requests,
//              4-stage fulfillment lifecycle state machines, and provider dispatch.
// =============================================================================

export type AccommodationCategory =
  | "asl_interpreter"
  | "wheelchair_seating"
  | "live_captioning_cart"
  | "assistive_listening_device"
  | "sensory_quiet_room"
  | "dietary_anaphylaxis_kit"
  | "service_animal_escort"
  | "tactile_braille_guide";

export type FulfillmentStage =
  | "requested"
  | "approved"
  | "provider_assigned"
  | "confirmed_on_site";

export interface AccommodationProvider {
  id: string;
  name: string;
  agencyOrDepartment: string;
  certifications: string[]; // e.g. ["RID Certified Deaf Interpreter", "NIC Master"]
  contactEmail: string;
  contactPhone: string;
  avatarUrl?: string;
  onSiteLocationBadge?: string; // e.g. "Stage Left Check-in Desk"
  checkInStatus: "pending" | "on_campus" | "at_venue_station";
}

export interface FulfillmentStepState {
  stage: FulfillmentStage;
  title: string;
  description: string;
  completedAt?: string;
  isCurrent: boolean;
  isCompleted: boolean;
  assignedOfficerName?: string;
}

export interface AccommodationRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  category: AccommodationCategory;
  customNotes?: string;
  currentStage: FulfillmentStage;
  createdAt: string;
  updatedAt: string;
  steps: FulfillmentStepState[];
  assignedProvider?: AccommodationProvider;
  specialInstructions?: string;
  slaDeadline: string;
  isUrgentEscalated?: boolean;
}

export interface AccommodationFilterOptions {
  category?: string;
  stage?: string;
  eventId?: string;
  searchQuery?: string;
}
