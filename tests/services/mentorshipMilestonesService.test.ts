/**
 * Enterprise Architectural Specification & Header:
 * Module: Automated Unit Test Suite for Mentorship Milestones Tracking Service
 * File: tests/services/mentorshipMilestonesService.test.ts
 * Framework: Jest JS / Enterprise CampusConnect Test Suite (#4282)
 * Coverage Goal: 100% Statement & Branch Coverage Compliance
 *
 * Test Scenarios:
 * 1. Default Initialization of Mentorship Pair State
 * 2. 6-Digit Dynamic PIN Generation for Authorized Mentors
 * 3. PIN Expiration & Validation Logic
 * 4. Meeting Count Incrementation & Milestone Reward Unlocking (5-meeting trigger)
 * 5. Input Sanitation Security Review against Cross-Site Scripting (XSS)
 */

import { MentorshipMilestonesService } from '../../src/services/mentorshipMilestonesService';

describe('MentorshipMilestonesService Enterprise Test Suite (#4282)', () => {
  let service: MentorshipMilestonesService;

  beforeEach(() => {
    service = new MentorshipMilestonesService();
  });

  describe('Constructor & State Management', () => {
    test('should initialize default mock mentorship pairs correctly', () => {
      const pair = service.getPairState('PAIR-101');
      expect(pair).toBeDefined();
      expect(pair?.mentorId).toBe('MENTOR-ALUMNI-401');
      expect(pair?.menteeId).toBe('MENTEE-STUDENT-882');
      expect(pair?.meetingCount).toBe(4);
    });
  });

  describe('Dynamic PIN Generation (Mentor Action)', () => {
    test('should generate valid 6-digit PIN with 5-minute expiration for authorized mentor', () => {
      const res = service.generateCheckInPin('PAIR-101', 'MENTOR-ALUMNI-401');
      expect(res.pin).toMatch(/^\d{6}$/);
      expect(res.expiresInSeconds).toBe(300);
      expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const pair = service.getPairState('PAIR-101');
      expect(pair?.currentPin).toBe(res.pin);
    });

    test('should throw error when non-mentor attempts to generate PIN', () => {
      expect(() => service.generateCheckInPin('PAIR-101', 'UNAUTHORIZED-USER')).toThrow(
        'Unauthorized: Only the assigned alumni mentor can generate the check-in PIN.'
      );
    });
  });

  describe('PIN Verification & Milestone Unlocking (Mentee Action)', () => {
    test('should fail verification for incorrect PIN', () => {
      service.generateCheckInPin('PAIR-101', 'MENTOR-ALUMNI-401');
      const res = service.verifyCheckInPin('PAIR-101', 'MENTEE-STUDENT-882', '000000');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Invalid check-in PIN entered');
    });

    test('should successfully verify valid PIN, increment meeting count to 5, and unlock Milestone rewards', () => {
      const gen = service.generateCheckInPin('PAIR-101', 'MENTOR-ALUMNI-401');
      const res = service.verifyCheckInPin('PAIR-101', 'MENTEE-STUDENT-882', gen.pin);

      expect(res.success).toBe(true);
      expect(res.newMeetingCount).toBe(5);
      expect(res.milestoneUnlocked).toBe(true);
      expect(res.pointsAwarded).toBe(1000);
      expect(res.certificateGenerated).toBe(true);

      const updatedPair = service.getPairState('PAIR-101');
      expect(updatedPair?.totalMilestonesAchieved).toBe(1);
      expect(updatedPair?.currentPin).toBeNull();
    });
  });

  describe('Input Sanitation Security Review', () => {
    test('should sanitize malicious XSS payloads', () => {
      const payload = '<script>alert("hack")</script>';
      const clean = service.sanitizeInput(payload);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('&lt;script&gt;');
    });
  });
});
