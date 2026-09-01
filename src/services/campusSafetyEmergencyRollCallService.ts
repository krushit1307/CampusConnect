import { createClient } from "@/lib/supabase/client";
import {
  AttendeeSafetyStatus,
  EmergencyRollCallAttendeeResponse,
  EmergencyRollCallCheck,
  EmergencyType,
  RollCallStatsSummary,
} from "@/types/campusSafetyEmergencyRollCall";

const supabase = createClient();

const SAMPLE_ATTENDEES: Array<{
  userId: string;
  name: string;
  email: string;
  contactName: string;
  contactPhone: string;
}> = [
  {
    userId: "usr-stu-1",
    name: "Maya Lin",
    email: "m.lin@campus.edu",
    contactName: "David Lin (Father)",
    contactPhone: "+1 (555) 234-5678",
  },
  {
    userId: "usr-stu-2",
    name: "Brandon Vance",
    email: "b.vance@campus.edu",
    contactName: "Elena Vance (Mother)",
    contactPhone: "+1 (555) 345-6789",
  },
  {
    userId: "usr-stu-3",
    name: "Chloe Bennett",
    email: "c.bennett@campus.edu",
    contactName: "Marcus Bennett (Guardian)",
    contactPhone: "+1 (555) 456-7890",
  },
  {
    userId: "usr-stu-4",
    name: "Derek O'Connor",
    email: "d.oconnor@campus.edu",
    contactName: "Sarah O'Connor (Sister)",
    contactPhone: "+1 (555) 567-8901",
  },
];

export class CampusSafetyEmergencyRollCallService {
  private activeChecks: Map<string, EmergencyRollCallCheck> = new Map();
  private attendeeResponses: Map<string, EmergencyRollCallAttendeeResponse[]> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData(): void {
    const checkId = "rc-active-demo";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    const initialCheck: EmergencyRollCallCheck = {
      id: checkId,
      eventId: "evt-mountain-hike",
      eventTitle: "Annual Mountain Camping & Hiking Trip",
      campusLocation: "North Wilderness Ridge Basecamp",
      emergencyType: "SEVERE_WEATHER",
      initiatedByUserId: "sec-officer-1",
      initiatedByName: "Officer James Miller (Campus Safety)",
      expiresAt,
      status: "ACTIVE",
      totalAttendeesCount: 4,
      safeCount: 2,
      assistanceNeededCount: 1,
      overdueCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const initialResponses: EmergencyRollCallAttendeeResponse[] = [
      {
        id: "resp-1",
        rollCallCheckId: checkId,
        userId: "usr-stu-1",
        studentName: "Maya Lin",
        studentEmail: "m.lin@campus.edu",
        status: "SAFE",
        respondedAt: new Date(now.getTime() - 120000).toISOString(),
        latitude: 40.718,
        longitude: -74.008,
        emergencyContactName: "David Lin (Father)",
        emergencyContactPhone: "+1 (555) 234-5678",
        droneDispatched: false,
      },
      {
        id: "resp-2",
        rollCallCheckId: checkId,
        userId: "usr-stu-2",
        studentName: "Brandon Vance",
        studentEmail: "b.vance@campus.edu",
        status: "SAFE",
        respondedAt: new Date(now.getTime() - 60000).toISOString(),
        latitude: 40.7175,
        longitude: -74.0075,
        emergencyContactName: "Elena Vance (Mother)",
        emergencyContactPhone: "+1 (555) 345-6789",
        droneDispatched: false,
      },
      {
        id: "resp-3",
        rollCallCheckId: checkId,
        userId: "usr-stu-3",
        studentName: "Chloe Bennett",
        studentEmail: "c.bennett@campus.edu",
        status: "NEED_ASSISTANCE",
        respondedAt: new Date(now.getTime() - 30000).toISOString(),
        assistanceDetails: "Minor ankle injury near trail marker #4. Need transport assistance.",
        latitude: 40.719,
        longitude: -74.009,
        emergencyContactName: "Marcus Bennett (Guardian)",
        emergencyContactPhone: "+1 (555) 456-7890",
        droneDispatched: true,
      },
      {
        id: "resp-4",
        rollCallCheckId: checkId,
        userId: "usr-stu-4",
        studentName: "Derek O'Connor",
        studentEmail: "d.oconnor@campus.edu",
        status: "PENDING",
        emergencyContactName: "Sarah O'Connor (Sister)",
        emergencyContactPhone: "+1 (555) 567-8901",
        droneDispatched: false,
      },
    ];

    this.activeChecks.set(checkId, initialCheck);
    this.attendeeResponses.set(checkId, initialResponses);
  }

  /**
   * Initiates a new real-time emergency roll call check.
   */
  public initiateEmergencyRollCall(params: {
    eventId: string;
    eventTitle: string;
    campusLocation: string;
    emergencyType: EmergencyType;
    durationMinutes?: number;
    initiatedByUserId?: string;
    initiatedByName?: string;
  }): EmergencyRollCallCheck {
    const checkId = `rc-${Date.now()}`;
    const now = new Date();
    const duration = params.durationMinutes || 15;
    const expiresAt = new Date(now.getTime() + duration * 60 * 1000).toISOString();

    const check: EmergencyRollCallCheck = {
      id: checkId,
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      campusLocation: params.campusLocation,
      emergencyType: params.emergencyType,
      initiatedByUserId: params.initiatedByUserId || "sec-officer-1",
      initiatedByName: params.initiatedByName || "Campus Safety Dispatch",
      expiresAt,
      status: "ACTIVE",
      totalAttendeesCount: SAMPLE_ATTENDEES.length,
      safeCount: 0,
      assistanceNeededCount: 0,
      overdueCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const responses: EmergencyRollCallAttendeeResponse[] = SAMPLE_ATTENDEES.map((att, i) => ({
      id: `resp-${Date.now()}-${i}`,
      rollCallCheckId: checkId,
      userId: att.userId,
      studentName: att.name,
      studentEmail: att.email,
      status: "PENDING",
      emergencyContactName: att.contactName,
      emergencyContactPhone: att.contactPhone,
      droneDispatched: false,
    }));

    this.activeChecks.set(checkId, check);
    this.attendeeResponses.set(checkId, responses);

    return check;
  }

  /**
   * Submits an attendee's safety check-in status.
   */
  public submitAttendeeStatus(params: {
    rollCallCheckId: string;
    userId: string;
    status: "SAFE" | "NEED_ASSISTANCE";
    assistanceDetails?: string;
    latitude?: number;
    longitude?: number;
  }): EmergencyRollCallAttendeeResponse {
    const responses = this.attendeeResponses.get(params.rollCallCheckId);
    if (!responses) throw new Error("Roll call responses not found");

    const resp = responses.find((r) => r.userId === params.userId);
    if (!resp) throw new Error("Attendee response record not found");

    resp.status = params.status;
    resp.respondedAt = new Date().toISOString();
    if (params.assistanceDetails) resp.assistanceDetails = params.assistanceDetails;
    if (params.latitude) resp.latitude = params.latitude;
    if (params.longitude) resp.longitude = params.longitude;

    this.evaluateRollCallMetrics(params.rollCallCheckId);
    return resp;
  }

  /**
   * Evaluates current responses and updates counts & overdue statuses.
   */
  public evaluateRollCallMetrics(rollCallCheckId: string): RollCallStatsSummary {
    const check = this.activeChecks.get(rollCallCheckId);
    const responses = this.attendeeResponses.get(rollCallCheckId) || [];

    if (!check) {
      return {
        totalCount: 0,
        safeCount: 0,
        assistanceNeededCount: 0,
        overdueCount: 0,
        pendingCount: 0,
        safePercentage: 0,
        isTimerExpired: false,
      };
    }

    const isTimerExpired = new Date(check.expiresAt) <= new Date();

    // If timer expired, mark PENDING attendees as OVERDUE
    if (isTimerExpired && check.status === "ACTIVE") {
      check.status = "EXPIRED";
      responses.forEach((r) => {
        if (r.status === "PENDING") {
          r.status = "OVERDUE";
        }
      });
    }

    const totalCount = responses.length;
    const safeCount = responses.filter((r) => r.status === "SAFE").length;
    const assistanceNeededCount = responses.filter((r) => r.status === "NEED_ASSISTANCE").length;
    const overdueCount = responses.filter((r) => r.status === "OVERDUE").length;
    const pendingCount = responses.filter((r) => r.status === "PENDING").length;

    const safePercentage = totalCount > 0 ? Math.round((safeCount / totalCount) * 100) : 0;

    check.safeCount = safeCount;
    check.assistanceNeededCount = assistanceNeededCount;
    check.overdueCount = overdueCount;
    check.updatedAt = new Date().toISOString();

    return {
      totalCount,
      safeCount,
      assistanceNeededCount,
      overdueCount,
      pendingCount,
      safePercentage,
      isTimerExpired,
    };
  }

  /**
   * Dispatches emergency search drone or rescue unit to attendee location.
   */
  public dispatchDroneToAttendee(rollCallCheckId: string, userId: string): boolean {
    const responses = this.attendeeResponses.get(rollCallCheckId);
    if (!responses) return false;

    const resp = responses.find((r) => r.userId === userId);
    if (resp) {
      resp.droneDispatched = true;
      return true;
    }
    return false;
  }

  /**
   * Resolves the emergency roll call check.
   */
  public resolveEmergencyRollCall(rollCallCheckId: string): EmergencyRollCallCheck {
    const check = this.activeChecks.get(rollCallCheckId);
    if (!check) throw new Error("Roll call check not found");

    check.status = "RESOLVED";
    check.updatedAt = new Date().toISOString();
    return check;
  }

  public getActiveCheck(eventId: string): EmergencyRollCallCheck | undefined {
    return Array.from(this.activeChecks.values()).find(
      (c) => c.eventId === eventId && (c.status === "ACTIVE" || c.status === "EXPIRED"),
    );
  }

  public getResponsesForCheck(rollCallCheckId: string): EmergencyRollCallAttendeeResponse[] {
    return this.attendeeResponses.get(rollCallCheckId) || [];
  }

  public resetToSampleData(): void {
    this.activeChecks.clear();
    this.attendeeResponses.clear();
    this.seedInitialData();
  }
}

export const campusSafetyEmergencyRollCallService = new CampusSafetyEmergencyRollCallService();
