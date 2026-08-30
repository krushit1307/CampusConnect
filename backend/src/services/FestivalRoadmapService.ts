/**
 * Enterprise Campus Multi-Track Festival & Event Schedule Service
 * Manages event tracks, session schedule matrices, real-time conflict detection algorithms,
 * personal itinerary building, and iCalendar export telemetry.
 */

export interface MultiTrackSession {
  sessionId: string;
  title: string;
  track: 'MAINSTAGE' | 'AI_ML' | 'UX_DESIGN' | 'FOUNDERS' | 'CYBER_SECURITY';
  speakerName: string;
  speakerTitle: string;
  startTime: string;
  endTime: string;
  locationRoom: string;
  capacityLimit: number;
  currentBookings: number;
  abstractText: string;
}

export interface PersonalizedItineraryTicket {
  ticketId: string;
  userId: string;
  sessionId: string;
  sessionTitle: string;
  track: string;
  startTime: string;
  endTime: string;
  locationRoom: string;
  bookmarkedAt: string;
}

export class FestivalRoadmapService {
  private static sessions: MultiTrackSession[] = [
    {
      sessionId: 'SESS-AI-101',
      title: 'Keynote: Scaling Multi-Agent Neural Networks & LLM Orchestration',
      track: 'AI_ML',
      speakerName: 'Dr. Katherine Chen',
      speakerTitle: 'VP of AI Research at DeepMind Technologies',
      startTime: '2026-09-10T09:00:00Z',
      endTime: '2026-09-10T10:30:00Z',
      locationRoom: 'Grand Auditorium A1',
      capacityLimit: 500,
      currentBookings: 432,
      abstractText: 'Exploring production patterns for enterprise autonomous agents, memory persistence, and tool execution pipelines.',
    },
    {
      sessionId: 'SESS-SEC-202',
      title: 'Zero-Trust Microsegmentation & eBPF Kernel Auditing',
      track: 'CYBER_SECURITY',
      speakerName: 'Marcus Thorne',
      speakerTitle: 'Chief Information Security Officer',
      startTime: '2026-09-10T10:00:00Z',
      endTime: '2026-09-10T11:30:00Z',
      locationRoom: 'Cyber Lab Hall B',
      capacityLimit: 150,
      currentBookings: 148,
      abstractText: 'Deep dive into Linux eBPF probes for kernel-level runtime security enforcement and zero-day threat prevention.',
    },
    {
      sessionId: 'SESS-FND-303',
      title: 'Venture Capital Term Sheets & Series A Pitch Masterclass',
      track: 'FOUNDERS',
      speakerName: 'Elena Vance',
      speakerTitle: 'Managing Partner at Apex Capital',
      startTime: '2026-09-10T11:00:00Z',
      endTime: '2026-09-10T12:30:00Z',
      locationRoom: 'Founders Studio 4',
      capacityLimit: 200,
      currentBookings: 195,
      abstractText: 'Deconstructing cap tables, liquidation preferences, anti-dilution clauses, and investor negotiation strategies.',
    },
  ];

  private static itineraries: PersonalizedItineraryTicket[] = [];

  public static getSessions(trackFilter?: string): MultiTrackSession[] {
    if (!trackFilter || trackFilter === 'ALL') {
      return this.sessions;
    }
    return this.sessions.filter((s) => s.track === trackFilter);
  }

  /**
   * Schedule Conflict Detection Engine:
   * Real-time algorithmic verification: (S1.start < S2.end && S2.start < S1.end)
   */
  public static checkScheduleConflict(userId: string, newSession: MultiTrackSession): boolean {
    const userTickets = this.itineraries.filter((t) => t.userId === userId);
    const newStart = new Date(newSession.startTime).getTime();
    const newEnd = new Date(newSession.endTime).getTime();

    for (const ticket of userTickets) {
      const existingStart = new Date(ticket.startTime).getTime();
      const existingEnd = new Date(ticket.endTime).getTime();

      if (newStart < existingEnd && existingStart < newEnd) {
        return true; // Conflict detected
      }
    }

    return false;
  }

  public static bookmarkSession(userId: string, sessionId: string): PersonalizedItineraryTicket {
    const session = this.sessions.find((s) => s.sessionId === sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found.`);
    }

    if (this.checkScheduleConflict(userId, session)) {
      throw new Error(`Schedule conflict detected! Session ${session.title} overlaps with an existing bookmarked session.`);
    }

    session.currentBookings += 1;

    const ticket: PersonalizedItineraryTicket = {
      ticketId: `TICK-ITIN-${Date.now()}`,
      userId,
      sessionId,
      sessionTitle: session.title,
      track: session.track,
      startTime: session.startTime,
      endTime: session.endTime,
      locationRoom: session.locationRoom,
      bookmarkedAt: new Date().toISOString(),
    };

    this.itineraries.push(ticket);
    return ticket;
  }

  public static getUserItinerary(userId: string): PersonalizedItineraryTicket[] {
    return this.itineraries.filter((t) => t.userId === userId);
  }

  /**
   * RFC 5545 iCalendar (.ics) Exporter
   * Generates valid iCalendar format strings for Apple/Google/Outlook export
   */
  public static generateICalendarExport(userId: string): string {
    const userTickets = this.getUserItinerary(userId);
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//CampusConnect//Festival Schedule Engine//EN\n";

    for (const ticket of userTickets) {
      const startClean = ticket.startTime.replace(/[-:]/g, "").split(".")[0];
      const endClean = ticket.endTime.replace(/[-:]/g, "").split(".")[0];
      icsContent += `BEGIN:VEVENT\nSUMMARY:${ticket.sessionTitle}\nLOCATION:${ticket.locationRoom}\nDTSTART:${startClean}\nDTEND:${endClean}\nDESCRIPTION:Bookmarked via CampusConnect Festival Schedule Engine\nEND:VEVENT\n`;
    }

    icsContent += "END:VCALENDAR";
    return icsContent;
  }

  public static getMetrics() {
    const totalSessions = this.sessions.length;
    const totalBookings = this.sessions.reduce((acc, s) => acc + s.currentBookings, 0);
    const avgCapacityPct = Math.round(
      (totalBookings / this.sessions.reduce((acc, s) => acc + s.capacityLimit, 0)) * 100
    );

    return {
      totalSessions,
      totalBookings,
      avgCapacityPct,
    };
  }
}
