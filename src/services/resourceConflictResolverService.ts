/**
 * Enterprise Architectural Specification & Service Tier:
 * Module: Dynamic Resource Conflict Resolver Engine
 * File: src/services/resourceConflictResolverService.ts
 * Standard: ECMAScript 2022 Class Specification, Temporal Intersection Engine
 * Scope: Evaluates scarce IT asset bookings ('event_start' to 'event_end'), detects temporal overlaps,
 *        blocks conflicting draft selections, and recommends available alternative resources (#4281).
 */

export interface UniversityResource {
  id: string;
  assetTag: string; // e.g. 'Projector_A1'
  name: string;
  category: 'AV_EQUIPMENT' | 'VENUE_SPACE' | 'LAB_GEAR';
  alternativeResourceId?: string;
}

export interface ResourceBooking {
  id: string;
  resourceId: string;
  organizerClubName: string;
  startTime: Date;
  endTime: Date;
  status: 'CONFIRMED' | 'PENDING';
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingClub?: string;
  conflictStart?: Date;
  conflictEnd?: Date;
  alternativeResource?: UniversityResource;
  conflictMessage?: string;
}

export class ResourceConflictResolverService {
  private resourcesStore: Map<string, UniversityResource>;
  private bookingsStore: ResourceBooking[];

  constructor() {
    this.resourcesStore = new Map();
    this.bookingsStore = [];
    this.initDefaultData();
  }

  /**
   * Initializes default scarce resources and existing bookings for demonstration
   */
  private initDefaultData(): void {
    const projA1: UniversityResource = {
      id: 'RES-PROJ-A1',
      assetTag: 'Projector_A1',
      name: '4K Main Auditorium Laser Projector (A1)',
      category: 'AV_EQUIPMENT',
      alternativeResourceId: 'RES-PROJ-B2'
    };

    const projB2: UniversityResource = {
      id: 'RES-PROJ-B2',
      assetTag: 'Projector_B2',
      name: 'High-Lumen Portable Projector (B2)',
      category: 'AV_EQUIPMENT'
    };

    this.resourcesStore.set(projA1.id, projA1);
    this.resourcesStore.set(projB2.id, projB2);

    // Mock existing booking: CS Club Friday 5:00 PM to 7:00 PM
    const today = new Date();
    const fridayStart = new Date(today.setDate(today.getDate() + ((5 + 7 - today.getDay()) % 7)));
    fridayStart.setHours(17, 0, 0, 0); // 5:00 PM

    const fridayEnd = new Date(fridayStart);
    fridayEnd.setHours(19, 0, 0, 0); // 7:00 PM

    this.bookingsStore.push({
      id: 'BOOKING-101',
      resourceId: 'RES-PROJ-A1',
      organizerClubName: 'Computer Science Club',
      startTime: fridayStart,
      endTime: fridayEnd,
      status: 'CONFIRMED'
    });
  }

  /**
   * Evaluates temporal intersection between requested window [startTime, endTime] and existing bookings for resourceId
   * Formula: Intersection exists if (requestedStart < existingEnd) AND (requestedEnd > existingStart)
   * @param resourceId - Target asset UUID or assetTag
   * @param startTime - Requested start time
   * @param endTime - Requested end time
   */
  public checkResourceConflict(resourceId: string, startTime: Date, endTime: Date): ConflictCheckResult {
    if (startTime >= endTime) {
      throw new Error('Requested start time must be strictly before end time.');
    }

    const targetResource = Array.from(this.resourcesStore.values()).find(
      (r) => r.id === resourceId || r.assetTag === resourceId
    );

    if (!targetResource) {
      throw new Error(`Resource '${resourceId}' not found in campus inventory.`);
    }

    // Check temporal overlap with confirmed bookings
    const conflict = this.bookingsStore.find((booking) => {
      if (booking.resourceId !== targetResource.id || booking.status !== 'CONFIRMED') {
        return false;
      }
      return startTime < booking.endTime && endTime > booking.startTime;
    });

    if (conflict) {
      // Find an available alternative resource in the same category
      const altResource = Array.from(this.resourcesStore.values()).find((r) => {
        if (r.id === targetResource.id || r.category !== targetResource.category) return false;
        // Verify alternative has no temporal overlap during requested period
        const altConflict = this.bookingsStore.some(
          (b) => b.resourceId === r.id && b.status === 'CONFIRMED' && startTime < b.endTime && endTime > b.startTime
        );
        return !altConflict;
      });

      const startFmt = conflict.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endFmt = conflict.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const msg = `${targetResource.assetTag} is booked by the ${conflict.organizerClubName} from ${startFmt} to ${endFmt}.${
        altResource ? ` Would you like to request ${altResource.assetTag} instead?` : ' No alternative resource available.'
      }`;

      return {
        hasConflict: true,
        conflictingClub: conflict.organizerClubName,
        conflictStart: conflict.startTime,
        conflictEnd: conflict.endTime,
        alternativeResource: altResource,
        conflictMessage: msg
      };
    }

    return {
      hasConflict: false
    };
  }

  /**
   * Returns list of all registered campus resources
   */
  public getAllResources(): UniversityResource[] {
    return Array.from(this.resourcesStore.values());
  }

  /**
   * Input sanitizer against script injection
   */
  public sanitizeInput(str: string): string {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (match) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return map[match];
    });
  }
}

export const resourceConflictResolverService = new ResourceConflictResolverService();
