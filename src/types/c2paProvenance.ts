export interface SensorMetadata {
  deviceId: string;
  cameraModel: string;
  iso: number;
  focalLength: number;
  exposureTimeSeconds: number;
  rawPixelHash: string;
}

export interface ProvenanceCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export interface C2PAAssertion {
  label: string;
  data: Record<string, unknown>;
}

export interface C2PAManifest {
  claimGenerator: string;
  title: string;
  format: string;
  instanceId: string;
  timestampIso: string;
  sensor: SensorMetadata;
  location: ProvenanceCoordinates;
  assertions: C2PAAssertion[];
  signatureAlgorithm: 'ECDSA-P256' | 'RSA-SHA256';
  signatureBase64: string;
  publicKeyPem: string;
}

export interface C2PAVerificationResult {
  isAuthentic: boolean;
  provenanceVerified: boolean;
  signatureValid: boolean;
  sensorValid: boolean;
  tamperDetected: boolean;
  rejectionReason?: string;
  manifest?: C2PAManifest;
}
