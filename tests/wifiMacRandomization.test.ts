import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMacSession,
  rotateMacAddress,
  validateMacSession,
  extendSessionExpiry,
  getActiveSessions,
  revokeSession,
} from '@/lib/network/macRandomizationSessionManager';
import {
  generateWifiJwt,
  verifyWifiJwt,
  refreshWifiJwt,
} from '@/lib/network/wifiJwtTokenManager';
import {
  authorizeDeviceMac,
  validateDevicePolicy,
} from '@/lib/network/ciscoIseIntegration';

// Mock data
const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockCampusId = '223e4567-e89b-12d3-a456-426614174000';
const mockMacAddress = 'AA:BB:CC:DD:EE:FF';
const mockMacAddress2 = 'FF:EE:DD:CC:BB:AA';

describe('MAC Randomization Session Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMacSession', () => {
    it('should create a new MAC session with JWT token', async () => {
      const result = await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      expect(result.session).toBeDefined();
      expect(result.session.userId).toBe(mockUserId);
      expect(result.session.currentMacAddress).toBe(mockMacAddress);
      expect(result.jwtToken).toBeDefined();
      expect(result.session.jwtExpiresAt).toBeTruthy();
    });

    it('should throw error if MAC session creation fails', async () => {
      await expect(
        createMacSession({
          userId: '',
          macAddress: '',
          campusId: '',
        })
      ).rejects.toThrow();
    });
  });

  describe('rotateMacAddress', () => {
    it('should rotate MAC address for existing session', async () => {
      // First create a session
      const created = await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      // Then rotate
      const rotated = await rotateMacAddress(
        created.session.sessionId,
        mockMacAddress2
      );

      expect(rotated.currentMacAddress).toBe(mockMacAddress2);
      expect(rotated.previousMacAddresses).toContain(mockMacAddress);
    });

    it('should update last_rotation_at timestamp', async () => {
      const created = await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      const oldRotationTime = new Date(created.session.lastRotationAt);

      // Wait a bit and rotate
      await new Promise((resolve) => setTimeout(resolve, 100));

      const rotated = await rotateMacAddress(
        created.session.sessionId,
        mockMacAddress2
      );

      const newRotationTime = new Date(rotated.lastRotationAt);
      expect(newRotationTime.getTime()).toBeGreaterThan(oldRotationTime.getTime());
    });
  });

  describe('validateMacSession', () => {
    it('should validate valid MAC session', async () => {
      const created = await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      const validation = await validateMacSession(
        created.session.sessionId,
        mockMacAddress,
        created.jwtToken
      );

      expect(validation.isValid).toBe(true);
      expect(validation.userId).toBe(mockUserId);
    });

    it('should reject invalid JWT token', async () => {
      const created = await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      const validation = await validateMacSession(
        created.session.sessionId,
        mockMacAddress,
        'invalid.token.here'
      );

      expect(validation.isValid).toBe(false);
      expect(validation.reason).toContain('Invalid JWT');
    });

    it('should reject unknown MAC address', async () => {
      const created = await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      const validation = await validateMacSession(
        created.session.sessionId,
        mockMacAddress2, // Different MAC
        created.jwtToken
      );

      expect(validation.isValid).toBe(false);
    });
  });

  describe('extendSessionExpiry', () => {
    it('should extend session expiry time', async () => {
      const created = await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      const originalExpiry = new Date(created.session.jwtExpiresAt);

      const extended = await extendSessionExpiry(created.session.sessionId, 60);

      const newExpiry = new Date(extended.jwtExpiresAt);
      expect(newExpiry.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      const sessions = await getActiveSessions(mockUserId);

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].userId).toBe(mockUserId);
    });
  });

  describe('revokeSession', () => {
    it('should revoke session and remove from database', async () => {
      const created = await createMacSession({
        userId: mockUserId,
        macAddress: mockMacAddress,
        campusId: mockCampusId,
      });

      await revokeSession(created.session.sessionId);

      const sessions = await getActiveSessions(mockUserId);
      const revoked = sessions.find(
        (s) => s.sessionId === created.session.sessionId
      );

      expect(revoked).toBeUndefined();
    });
  });
});

describe('WiFi JWT Token Manager', () => {
  describe('generateWifiJwt', () => {
    it('should generate valid JWT token', async () => {
      const result = await generateWifiJwt(mockUserId, undefined, mockCampusId);

      expect(result.jwtToken).toBeTruthy();
      expect(result.expiresAt).toBeTruthy();
      expect(result.expiresIn).toBeGreaterThan(0);
    });

    it('JWT should contain correct claims', async () => {
      const result = await generateWifiJwt(mockUserId, undefined, mockCampusId);

      const verification = await verifyWifiJwt(result.jwtToken);

      expect(verification.isValid).toBe(true);
      expect(verification.decoded?.sub).toBe(mockUserId);
      expect(verification.decoded?.campus_id).toBe(mockCampusId);
      expect(verification.decoded?.type).toBe('wifi_session');
    });
  });

  describe('verifyWifiJwt', () => {
    it('should verify valid token', async () => {
      const generated = await generateWifiJwt(
        mockUserId,
        undefined,
        mockCampusId
      );

      const verification = await verifyWifiJwt(generated.jwtToken);

      expect(verification.isValid).toBe(true);
    });

    it('should reject invalid token', async () => {
      const verification = await verifyWifiJwt('invalid.fake.token');

      expect(verification.isValid).toBe(false);
      expect(verification.error).toBeTruthy();
    });
  });

  describe('refreshWifiJwt', () => {
    it('should refresh expired token', async () => {
      const original = await generateWifiJwt(
        mockUserId,
        undefined,
        mockCampusId
      );

      const refreshed = await refreshWifiJwt(original.jwtToken);

      expect(refreshed.jwtToken).toBeTruthy();
      expect(refreshed.jwtToken).not.toBe(original.jwtToken);
    });
  });
});

describe('Cisco ISE Integration', () => {
  describe('authorizeDeviceMac', () => {
    it('should authorize device MAC with ISE', async () => {
      const result = await authorizeDeviceMac(
        mockMacAddress,
        mockUserId,
        'session-123',
        mockCampusId
      );

      expect(result.deviceId).toBeTruthy();
      expect(['authorized', 'pending', 'error']).toContain(result.status);
    });
  });

  describe('validateDevicePolicy', () => {
    it('should validate device policy', async () => {
      // First authorize
      await authorizeDeviceMac(
        mockMacAddress,
        mockUserId,
        'session-123',
        mockCampusId
      );

      // Then validate
      const isValid = await validateDevicePolicy(mockMacAddress, mockCampusId);

      expect(typeof isValid).toBe('boolean');
    });
  });
});

describe('MAC Randomization Integration', () => {
  it('should handle complete MAC rotation flow', async () => {
    // 1. Create session
    const created = await createMacSession({
      userId: mockUserId,
      macAddress: mockMacAddress,
      campusId: mockCampusId,
    });

    // 2. Validate session
    let validation = await validateMacSession(
      created.session.sessionId,
      mockMacAddress,
      created.jwtToken
    );
    expect(validation.isValid).toBe(true);

    // 3. Simulate MAC rotation
    const rotated = await rotateMacAddress(
      created.session.sessionId,
      mockMacAddress2
    );

    // 4. Validate with new MAC
    validation = await validateMacSession(
      created.session.sessionId,
      mockMacAddress2,
      created.jwtToken
    );
    expect(validation.isValid).toBe(true);

    // 5. Check session still has old MAC in history
    expect(rotated.previousMacAddresses).toContain(mockMacAddress);
  });
});