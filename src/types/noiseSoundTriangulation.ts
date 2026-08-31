export interface EventAttendeeMicReading {
  attendeeId: string;
  attendeeName: string;
  checkedInEventId: string;
  audioSampleDurationMs: number; // 2000 ms (2 sec)
  measuredDbfs: number; // Decibels relative to full scale (e.g. -12 dBFS)
  calculatedSplDb: number; // Calibrated Sound Pressure Level in dBA (e.g. 105 dB)
  hasMicPermissionGranted: boolean;
  capturedAt: string;
  deviceModel: string;
}

export interface NoiseComplaintIncident {
  id: string;
  eventId: string;
  eventName: string;
  venueRoom: string;
  organizerName: string;
  complaintsCount: number; // Triggered when >= 3 complaints
  complaintTimestamps: string[];
  status: 'PENDING_TRIANGULATION' | 'VERIFIED_VIOLATION' | 'UNVERIFIED_DISMISSED';
  triangulatedAverageDb: number;
  thresholdMaxDb: number; // 100 dB
  crowdsourcedReadings: EventAttendeeMicReading[];
  policeDispatchTicket?: {
    ticketId: string;
    dispatchPriority: 'HIGH_DISCIPLINARY' | 'STANDARD_WARNING' | 'LOGGED_ONLY';
    empiricalDataSummary: string;
    assignedOfficer: string;
    generatedAt: string;
  };
  created_at: string;
}
