export interface VenueSpeaker {
  id: number;
  venueId: number;
  speakerCode: string;
  speakerName: string;
  zoneId?: number;
  roomName?: string;
  locationDescription?: string;
  latitude?: number;
  longitude?: number;
  frequencyRange: string;
  directionality: 'omnidirectional' | 'directional';
  audioOutputType: 'speaker' | 'buzzer' | 'alarm';
  apiEndpoint: string;
  deviceId: string;
  isActive: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastTested?: Date;
}

export interface AcousticZone {
  id: number;
  venueId: number;
  zoneName: string;
  zoneType: 'room' | 'hallway' | 'stairwell' | 'exit';
  speakerIds: number[];
  exitName?: string;
  exitLatitude?: number;
  exitLongitude?: number;
  isEmergencyExit: boolean;
  accessibilityNotes?: string;
}

export interface WayfindingRoute {
  id: number;
  venueId: number;
  routeName: string;
  startZoneId: number;
  endZoneId: number; // Exit zone
  speakerSequence: number[];
  totalDurationSeconds: number;
  intervalBetweenPingsMs: number;
  audioFrequencyHz: number;
  audioDurationMs: number;
  isActive: boolean;
}

export interface EmergencyAudioSequence {
  id: number;
  emergencyEventId: number;
  venueId: number;
  sequenceType: 'evacuation_path' | 'alarm_override' | 'guided_exit';
  status: 'pending' | 'active' | 'completed' | 'failed';
  speakerSequence: number[];
  audioFrequencyHz: number;
  loopCount: number;
  activatedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface AudioWaypoint {
  speakerId: number;
  speakerName: string;
  sequenceOrder: number;
  delayMs: number;
  audioFrequencyHz: number;
  latitude?: number;
  longitude?: number;
}

export interface WayfindingConfig {
  audioFrequencyHz: number; // 2000-4000 Hz optimal for intelligibility
  audioDurationMs: number; // Length of each "ping" or "chirp"
  intervalBetweenPingsMs: number; // Delay between speakers
  loopCount: number; // How many times to repeat sequence
  volumeLevelDb: number; // Audio level in decibels
}