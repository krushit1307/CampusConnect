import {
  NoiseComplaintIncident,
  EventAttendeeMicReading,
} from '../types/noiseSoundTriangulation';

// Mock attendees checked into the event with pre-granted mic permissions
const checkedInAttendees = [
  { attendeeId: 'att_001', attendeeName: 'Samir Rao', deviceModel: 'iPhone 15 Pro' },
  { attendeeId: 'att_002', attendeeName: 'Chloe Bennett', deviceModel: 'Pixel 8' },
  { attendeeId: 'att_003', attendeeName: 'Mateo Hernandez', deviceModel: 'Samsung Galaxy S24' },
  { attendeeId: 'att_004', attendeeName: 'Aisha Al-Mansoor', deviceModel: 'iPhone 14' },
  { attendeeId: 'att_005', attendeeName: 'Liam Campbell', deviceModel: 'OnePlus 12' },
  { attendeeId: 'att_006', attendeeName: 'Jessica Wu', deviceModel: 'Pixel 7a' },
  { attendeeId: 'att_007', attendeeName: 'Daniel Novak', deviceModel: 'iPhone 13' },
];

const mockIncidents: NoiseComplaintIncident[] = [
  {
    id: 'nc-inc-4822',
    eventId: 'evt-electric-rave-2026',
    eventName: 'Sigma Chi EDM Charity Rave & Light Show',
    venueRoom: 'Student Union Grand Ballroom & Patio',
    organizerName: 'Bradford Vance (Sigma Chi Social Chair)',
    complaintsCount: 3,
    complaintTimestamps: [
      new Date(Date.now() - 15 * 60000).toISOString(),
      new Date(Date.now() - 10 * 60000).toISOString(),
      new Date(Date.now() - 2 * 60000).toISOString(),
    ],
    status: 'PENDING_TRIANGULATION',
    triangulatedAverageDb: 0,
    thresholdMaxDb: 100,
    crowdsourcedReadings: [],
    created_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
];

export class NoiseSoundTriangulationService {
  private incidents: NoiseComplaintIncident[] = [...mockIncidents];

  public getIncidents(): NoiseComplaintIncident[] {
    return [...this.incidents];
  }

  public getIncidentById(id: string): NoiseComplaintIncident | undefined {
    return this.incidents.find((i) => i.id === id);
  }

  /**
   * Converts raw dBFS (Decibels relative to Full Scale) into calibrated ambient SPL (Sound Pressure Level in dBA)
   * Formula: SPL = 120 + dBfs (where 0 dBfs = max ~120 dBA acoustic peak)
   */
  public convertDbfsToSpl(dbfs: number): number {
    return Math.round(120 + dbfs);
  }

  /**
   * Silently triggers WebSocket command to 5 random checked-in attendees to capture 2s audio dBfs
   */
  public async executeMobileSoundTriangulation(
    incidentId: string,
    simulatedLoudnessPreset: 'extreme_loud' | 'moderate_ambient' | 'quiet' = 'extreme_loud'
  ): Promise<NoiseComplaintIncident> {
    const incident = this.incidents.find((i) => i.id === incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found.`);
    }

    // Pick 5 random checked-in attendees
    const selectedAttendees = [...checkedInAttendees].sort(() => 0.5 - Math.random()).slice(0, 5);

    // Simulate 2-second audio capture returning ONLY calculated integer dB SPL
    const readings: EventAttendeeMicReading[] = selectedAttendees.map((att) => {
      let baseDbfs = -15;
      if (simulatedLoudnessPreset === 'extreme_loud') {
        baseDbfs = -10 - Math.random() * 8; // -10 to -18 dBFS -> ~102 to 110 dB SPL
      } else if (simulatedLoudnessPreset === 'moderate_ambient') {
        baseDbfs = -35 - Math.random() * 8; // ~77 to 85 dB SPL
      } else {
        baseDbfs = -60 - Math.random() * 8; // ~52 to 60 dB SPL
      }

      const calculatedSpl = this.convertDbfsToSpl(baseDbfs);

      return {
        attendeeId: att.attendeeId,
        attendeeName: att.attendeeName,
        checkedInEventId: incident.eventId,
        audioSampleDurationMs: 2000,
        measuredDbfs: Math.round(baseDbfs * 10) / 10,
        calculatedSplDb: calculatedSpl,
        hasMicPermissionGranted: true,
        capturedAt: new Date().toISOString(),
        deviceModel: att.deviceModel,
      };
    });

    // Calculate aggregated average decibel reading across the 5 phones
    const totalSpl = readings.reduce((acc, r) => acc + r.calculatedSplDb, 0);
    const avgDb = Math.round(totalSpl / readings.length);

    incident.crowdsourcedReadings = readings;
    incident.triangulatedAverageDb = avgDb;

    // Evaluation: If avgDb > 100dB threshold -> True Violation
    if (avgDb > incident.thresholdMaxDb) {
      incident.status = 'VERIFIED_VIOLATION';
      incident.policeDispatchTicket = {
        ticketId: `DISPATCH-CPD-${Date.now()}`,
        dispatchPriority: 'HIGH_DISCIPLINARY',
        empiricalDataSummary: `Verified: Room volume is currently ${avgDb}dB (Exceeds campus threshold by +${avgDb - incident.thresholdMaxDb}dB across 5 calibrated mobile nodes).`,
        assignedOfficer: 'Officer Kowalski (Unit 4 - North Sector)',
        generatedAt: new Date().toISOString(),
      };
    } else {
      incident.status = 'UNVERIFIED_DISMISSED';
      incident.policeDispatchTicket = {
        ticketId: `DISPATCH-CPD-${Date.now()}`,
        dispatchPriority: 'LOGGED_ONLY',
        empiricalDataSummary: `Unverified: Room volume is currently ${avgDb}dB (Within permissible 100dB limit). Noise complaint dismissed as unsubstantiated.`,
        assignedOfficer: 'Auto-Resolved by Campus Safety Telemetry Engine',
        generatedAt: new Date().toISOString(),
      };
    }

    return incident;
  }
}

export const noiseSoundTriangulationService = new NoiseSoundTriangulationService();
