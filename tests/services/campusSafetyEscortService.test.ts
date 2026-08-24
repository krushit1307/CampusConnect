/**
 * Enterprise Architectural Specification & Header:
 * Module: Automated Unit Test Suite for Campus Safety Escort Service
 * File: tests/services/campusSafetyEscortService.test.ts
 * Framework: Jest JS / Enterprise CampusConnect Test Suite (#4256)
 * Coverage Goal: 100% Statement & Branch Coverage Compliance
 *
 * Test Scenarios:
 * 1. Default Safety Escort Request Record Lookup
 * 2. Haversine Distance & Dynamic ETA Calculation
 * 3. Continuous GPS Telemetry Broadcast & WebSocket Subscriber Notification
 * 4. Arrival Threshold Detection (< 0.02 miles -> 'ARRIVED')
 * 5. Input Sanitation Security Review against Cross-Site Scripting (XSS)
 */

import { CampusSafetyEscortService } from '../../src/services/campusSafetyEscortService';

describe('CampusSafetyEscortService Enterprise Test Suite (#4256)', () => {
  let service: CampusSafetyEscortService;

  beforeEach(() => {
    service = new CampusSafetyEscortService();
  });

  describe('Escort Record Initialization', () => {
    test('should lookup default active safety escort request record', () => {
      const record = service.getEscortRecord('ESCORT-8821');
      expect(record).toBeDefined();
      expect(record?.studentName).toBe('Samantha Reed');
      expect(record?.officerName).toBe('Officer John Smith');
      expect(record?.status).toBe('ACCEPTED');
    });
  });

  describe('GPS Telemetry Broadcast & Haversine ETA Calculation', () => {
    test('should calculate accurate Haversine distance and update ETA for en-route officer', () => {
      const update = service.broadcastOfficerGps('ESCORT-8821', 34.0550, -118.2460);

      expect(update.escortId).toBe('ESCORT-8821');
      expect(update.officerGps.latitude).toBe(34.0550);
      expect(update.status).toBe('EN_ROUTE');
      expect(update.etaMinutes).toBeGreaterThan(0);
      expect(update.etaMessage).toContain('Officer John Smith is');
    });

    test('should update status to ARRIVED when officer is within 0.02 miles', () => {
      // Broadcast coordinates virtually identical to pickup location (34.0522, -118.2437)
      const update = service.broadcastOfficerGps('ESCORT-8821', 34.0522, -118.2437);

      expect(update.status).toBe('ARRIVED');
      expect(update.etaMessage).toContain('HAS ARRIVED at your pickup location!');
    });

    test('should stream GPS update to active real-time subscribers', () => {
      let receivedUpdate: any = null;
      service.subscribeToEscortStream('ESCORT-8821', (update) => {
        receivedUpdate = update;
      });

      service.broadcastOfficerGps('ESCORT-8821', 34.0530, -118.2440);

      expect(receivedUpdate).not.toBeNull();
      expect(receivedUpdate.officerGps.latitude).toBe(34.0530);
    });
  });

  describe('Input Sanitation Security Validation', () => {
    test('should sanitize malicious XSS payloads', () => {
      const clean = service.sanitizeInput('<script>alert("hack")</script>');
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('&lt;script&gt;');
    });
  });
});
