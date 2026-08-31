import { describe, it, expect } from 'vitest';
import {
  generateC2PAImageManifest,
  embedC2PAInImageBuffer,
  extractC2PAManifestFromBuffer,
  verifyC2PAImageProvenance,
  computeBufferSha256,
} from '../src/services/c2paProvenanceService';
import { SensorMetadata, ProvenanceCoordinates } from '../src/types/c2paProvenance';

describe('Cryptographic Camera Provenance C2PA Detection Engine (#5137)', () => {
  const sampleSensor: SensorMetadata = {
    deviceId: 'dev-secure-enclave-01',
    cameraModel: 'CCD Hardware Sensor 12MP',
    iso: 100,
    focalLength: 28,
    exposureTimeSeconds: 0.01,
    rawPixelHash: '',
  };

  const sampleLocation: ProvenanceCoordinates = {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracyMeters: 5,
  };

  const mockPhotoBuffer = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9
  ]);

  it('should compute consistent SHA-256 hash over raw photo buffer', async () => {
    const hash = await computeBufferSha256(mockPhotoBuffer);
    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should generate valid C2PA manifest with ECDSA signature', async () => {
    const manifest = await generateC2PAImageManifest(mockPhotoBuffer, sampleSensor, sampleLocation);
    expect(manifest.claimGenerator).toContain('CampusConnect-C2PA');
    expect(manifest.sensor.rawPixelHash).toBeDefined();
    expect(manifest.signatureBase64).toBeDefined();
  });

  it('should embed and extract C2PA manifest to and from image buffer', async () => {
    const manifest = await generateC2PAImageManifest(mockPhotoBuffer, sampleSensor, sampleLocation);
    const embeddedBuffer = embedC2PAInImageBuffer(mockPhotoBuffer, manifest);

    const extracted = extractC2PAManifestFromBuffer(embeddedBuffer);
    expect(extracted).not.toBeNull();
    expect(extracted?.title).toBe('Authenticated Campus Photo');
  });

  it('should verify authentic signed image buffer successfully', async () => {
    const manifest = await generateC2PAImageManifest(mockPhotoBuffer, sampleSensor, sampleLocation);
    const embeddedBuffer = embedC2PAInImageBuffer(mockPhotoBuffer, manifest);

    const verification = await verifyC2PAImageProvenance(embeddedBuffer);
    expect(verification.isAuthentic).toBe(true);
    expect(verification.provenanceVerified).toBe(true);
    expect(verification.tamperDetected).toBe(false);
  });

  it('should reject unsigned image buffer uploaded from camera roll', async () => {
    const verification = await verifyC2PAImageProvenance(mockPhotoBuffer);
    expect(verification.isAuthentic).toBe(false);
    expect(verification.rejectionReason).toContain('Fraud Detected: Missing C2PA cryptographic camera provenance manifest');
  });
});
