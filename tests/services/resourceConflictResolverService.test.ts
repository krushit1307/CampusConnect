/**
 * Enterprise Architectural Specification & Header:
 * Module: Automated Unit Test Suite for Dynamic Resource Conflict Resolver
 * File: tests/services/resourceConflictResolverService.test.ts
 * Framework: Jest JS / Enterprise CampusConnect Test Suite (#4281)
 * Coverage Goal: 100% Statement & Branch Coverage Compliance
 *
 * Test Scenarios:
 * 1. Default Asset Initialization
 * 2. Temporal Intersection Overlap Detection ([start, end] vs [booking_start, booking_end])
 * 3. Immediate Selection Blocking & Alternative Resource Suggestion
 * 4. Non-Conflicting Temporal Request Validation
 * 5. Input Sanitation Security Review against Cross-Site Scripting (XSS)
 */

import { ResourceConflictResolverService } from '../../src/services/resourceConflictResolverService';

describe('ResourceConflictResolverService Enterprise Test Suite (#4281)', () => {
  let service: ResourceConflictResolverService;

  beforeEach(() => {
    service = new ResourceConflictResolverService();
  });

  describe('Asset Inventory Setup', () => {
    test('should initialize default campus resources including Projector_A1 and Projector_B2', () => {
      const resources = service.getAllResources();
      expect(resources.length).toBeGreaterThanOrEqual(2);
      expect(resources.some((r) => r.assetTag === 'Projector_A1')).toBe(true);
      expect(resources.some((r) => r.assetTag === 'Projector_B2')).toBe(true);
    });
  });

  describe('Temporal Overlap Collision Detection', () => {
    test('should detect temporal conflict for Projector_A1 on Friday 6 PM (overlapping CS Club 5 PM - 7 PM)', () => {
      const today = new Date();
      const friday6pm = new Date(today.setDate(today.getDate() + ((5 + 7 - today.getDay()) % 7)));
      friday6pm.setHours(18, 0, 0, 0); // 6:00 PM

      const friday730pm = new Date(friday6pm);
      friday730pm.setHours(19, 30, 0, 0); // 7:30 PM

      const check = service.checkResourceConflict('Projector_A1', friday6pm, friday730pm);

      expect(check.hasConflict).toBe(true);
      expect(check.conflictingClub).toBe('Computer Science Club');
      expect(check.alternativeResource?.assetTag).toBe('Projector_B2');
      expect(check.conflictMessage).toContain('Projector_A1 is booked by the Computer Science Club');
      expect(check.conflictMessage).toContain('Would you like to request Projector_B2 instead?');
    });

    test('should pass validation for non-conflicting time window (Saturday 10 AM)', () => {
      const today = new Date();
      const sat10am = new Date(today.setDate(today.getDate() + ((6 + 7 - today.getDay()) % 7)));
      sat10am.setHours(10, 0, 0, 0);

      const sat12pm = new Date(sat10am);
      sat12pm.setHours(12, 0, 0, 0);

      const check = service.checkResourceConflict('Projector_A1', sat10am, sat12pm);

      expect(check.hasConflict).toBe(false);
      expect(check.conflictingClub).toBeUndefined();
    });

    test('should throw error when requested start time is after end time', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3600000);
      expect(() => service.checkResourceConflict('Projector_A1', now, past)).toThrow(
        'Requested start time must be strictly before end time.'
      );
    });
  });

  describe('Input Sanitation Security Validation', () => {
    test('should sanitize malicious script tags', () => {
      const clean = service.sanitizeInput('<script>alert("xss")</script>');
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('&lt;script&gt;');
    });
  });
});
