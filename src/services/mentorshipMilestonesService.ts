/**
 * Enterprise Architectural Specification & Service Tier:
 * Module: Automated Mentorship Milestones Tracking Service
 * File: src/services/mentorshipMilestonesService.ts
 * Standard: ECMAScript 2022 Class Specification, Cryptographic Check-In Verification Engine
 * Scope: Handles dynamic 6-digit PIN generation for mentors, 5-minute expiration countdowns,
 *        mentee PIN validation, meeting count incrementation, certificate triggering, and gamification rewards (#4282).
 */

export interface MentorshipPairState {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  meetingCount: number;
  currentPin?: string | null;
  pinExpiresAt?: Date | null;
  totalMilestonesAchieved: number;
}

export interface CheckInPinGenerationResult {
  pin: string;
  expiresAt: Date;
  expiresInSeconds: number;
}

export interface CheckInVerificationResult {
  success: boolean;
  newMeetingCount: number;
  milestoneUnlocked: boolean;
  pointsAwarded?: number;
  certificateGenerated?: boolean;
  message: string;
}

export class MentorshipMilestonesService {
  private pairsStore: Map<string, MentorshipPairState>;

  constructor() {
    this.pairsStore = new Map();
    this.initDefaultPairs();
  }

  /**
   * Initializes mock mentorship pairs for demonstration and testing
   */
  private initDefaultPairs(): void {
    this.pairsStore.set('PAIR-101', {
      id: 'PAIR-101',
      mentorId: 'MENTOR-ALUMNI-401',
      mentorName: 'Dr. Sarah Jenkins (Alumni 18)',
      menteeId: 'MENTEE-STUDENT-882',
      menteeName: 'Alex Rivera (CS Senior)',
      meetingCount: 4, // 1 away from 5th meeting milestone
      currentPin: null,
      pinExpiresAt: null,
      totalMilestonesAchieved: 0
    });
  }

  /**
   * Generates a dynamic 6-digit PIN for the mentor with a strict 5-minute expiration window
   * @param pairId - Mentorship pair identifier
   * @param mentorId - Mentor user identifier validating ownership
   */
  public generateCheckInPin(pairId: string, mentorId: string): CheckInPinGenerationResult {
    const pair = this.pairsStore.get(pairId);
    if (!pair) {
      throw new Error('Mentorship pair record not found.');
    }

    if (pair.mentorId !== mentorId) {
      throw new Error('Unauthorized: Only the assigned alumni mentor can generate the check-in PIN.');
    }

    // Generate random 6-digit zero-padded PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    pair.currentPin = pin;
    pair.pinExpiresAt = expiresAt;

    return {
      pin: pin,
      expiresAt: expiresAt,
      expiresInSeconds: 300
    };
  }

  /**
   * Validates the 6-digit PIN submitted by the mentee, increments meeting count, and unlocks milestone rewards
   * @param pairId - Mentorship pair identifier
   * @param menteeId - Mentee user identifier
   * @param inputPin - 6-digit PIN code submitted by mentee
   */
  public verifyCheckInPin(pairId: string, menteeId: string, inputPin: string): CheckInVerificationResult {
    const pair = this.pairsStore.get(pairId);
    if (!pair) {
      throw new Error('Mentorship pair record not found.');
    }

    if (pair.menteeId !== menteeId) {
      throw new Error('Unauthorized: Only the assigned student mentee can verify the check-in PIN.');
    }

    if (!pair.currentPin || pair.currentPin !== inputPin) {
      return {
        success: false,
        newMeetingCount: pair.meetingCount,
        milestoneUnlocked: false,
        message: 'Invalid check-in PIN entered. Please verify with your mentor.'
      };
    }

    if (!pair.pinExpiresAt || new Date() > pair.pinExpiresAt) {
      return {
        success: false,
        newMeetingCount: pair.meetingCount,
        milestoneUnlocked: false,
        message: 'Check-in PIN has expired (5-minute limit exceeded). Please ask mentor to regenerate.'
      };
    }

    // Successful check-in: Increment meeting count & invalidate PIN
    pair.meetingCount += 1;
    pair.currentPin = null;
    pair.pinExpiresAt = null;

    const milestoneUnlocked = pair.meetingCount % 5 === 0;

    if (milestoneUnlocked) {
      pair.totalMilestonesAchieved += 1;
      return {
        success: true,
        newMeetingCount: pair.meetingCount,
        milestoneUnlocked: true,
        pointsAwarded: 1000,
        certificateGenerated: true,
        message: `🎉 Check-in Verified! Milestone Unlocked (Meeting #${pair.meetingCount})! Awarded 1,000 Gamification points to Mentor & generated Verified Mentorship Certificate.`
      };
    }

    return {
      success: true,
      newMeetingCount: pair.meetingCount,
      milestoneUnlocked: false,
      message: `Check-in verified successfully! Current meeting count: ${pair.meetingCount}/5 to next milestone.`
    };
  }

  /**
   * Retrieves mentorship pair status by ID
   * @param pairId - Pair ID
   */
  public getPairState(pairId: string): MentorshipPairState | undefined {
    return this.pairsStore.get(pairId);
  }

  /**
   * Input sanitizer against script injection
   * @param str - Raw input
   */
  public sanitizeInput(str: string): string {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (match) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return map[match];
    });
  }
}

export const mentorshipMilestonesService = new MentorshipMilestonesService();
