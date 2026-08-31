export interface HapticPayload {
  timestamp: number;
  bassAmplitude: number; // 0 to 255 normalized integer
  midAmplitude: number;
  trebleAmplitude: number;
  vibrationDurationMs: number;
  intensityPercent: number; // 0-100%
  frequencyBand: 'sub_bass' | 'bass' | 'mid' | 'high';
}

export interface LivestreamAudioStream {
  streamId: string;
  eventName: string;
  performer: string;
  isBroadcasting: boolean;
  activeListeners: number;
  hapticsEnabled: boolean;
  sampleRate: number;
  currentBpm: number;
}
