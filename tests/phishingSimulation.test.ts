import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  suspendAccount,
  checkIfAccountSuspended,
  unsuspendAccount,
} from '@/lib/security/accountSuspensionService';
import {
  generatePhishingEmail,
  selectRandomCampaignType,
} from '@/lib/security/phishingEmailTemplateService';
import {
  createRemediationCourse,
  getCourseProgress,
  completeModule,
  completeCourse,
  isRemediationRequired,
  getCourseModule,
} from '@/lib/security/remediationCourseService';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';

describe('Phishing Simulation System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Account Suspension Service', () => {
    it('should suspend an account', async () => {
      const result = await suspendAccount(mockUserId, 'Test suspension');

      expect(result.userId).toBe(mockUserId);
      expect(result.reason).toBe('Test suspension');
      expect(result.isActive).toBe(true);
    });

    it('should check if account is suspended', async () => {
      await suspendAccount(mockUserId, 'Test suspension');

      const { isSuspended } = await checkIfAccountSuspended(mockUserId);
      expect(isSuspended).toBe(true);
    });

    it('should unsuspend an account', async () => {
      await suspendAccount(mockUserId, 'Test suspension');
      await unsuspendAccount(mockUserId);

      const { isSuspended } = await checkIfAccountSuspended(mockUserId);
      expect(isSuspended).toBe(false);
    });

    it('should not show expired suspensions as active', async () => {
      // Suspend for 0 hours (immediately expires)
      await suspendAccount(mockUserId, 'Test', undefined, 0);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { isSuspended } = await checkIfAccountSuspended(mockUserId);
      expect(isSuspended).toBe(false);
    });
  });

  describe('Phishing Email Template Service', () => {
    it('should generate stripe_escrow email', () => {
      const email = generatePhishingEmail(
        'stripe_escrow',
        'test@university.edu',
        'John Doe',
        'https://example.com/test'
      );

      expect(email.subject).toContain('Stripe');
      expect(email.subject).toContain('Escrow');
      expect(email.htmlBody).toContain('https://example.com/test');
      expect(email.fromEmail).toContain('@stripe');
    });

    it('should generate university_it email', () => {
      const email = generatePhishingEmail(
        'university_it',
        'test@university.edu',
        'Jane Smith',
        'https://example.com/test'
      );

      expect(email.subject).toContain('University IT');
      expect(email.subject).toContain('Password');
      expect(email.urgencyLevel).toBe('critical');
    });

    it('should generate payment_processing email', () => {
      const email = generatePhishingEmail(
        'payment_processing',
        'test@university.edu',
        'Admin User',
        'https://example.com/test'
      );

      expect(email.subject).toContain('PCI');
      expect(email.htmlBody).toContain('Compliance');
    });

    it('should generate security_alert email', () => {
      const email = generatePhishingEmail(
        'security_alert',
        'test@university.edu',
        'User Name',
        'https://example.com/test'
      );

      expect(email.subject).toContain('Security Alert');
      expect(email.htmlBody).toContain('Suspicious Activity');
    });

    it('should randomly select campaign type', () => {
      const types = new Set();

      // Generate 10 campaign types
      for (let i = 0; i < 10; i++) {
        types.add(selectRandomCampaignType());
      }

      // Should have at least 2 different types (statistically)
      expect(types.size).toBeGreaterThan(1);
    });
  });

  describe('Remediation Course Service', () => {
    it('should create a remediation course', async () => {
      const course = await createRemediationCourse(mockUserId);

      expect(course.userId).toBe(mockUserId);
      expect(course.status).toBe('in_progress');
      expect(course.modulesCompleted).toBe(0);
      expect(course.currentModule).toBe(1);
      expect(course.totalModules).toBe(6);
    });

    it('should get course progress', async () => {
      const created = await createRemediationCourse(mockUserId);
      const progress = await getCourseProgress(mockUserId);

      expect(progress?.id).toBe(created.id);
      expect(progress?.status).toBe('in_progress');
    });

    it('should complete module', async () => {
      const course = await createRemediationCourse(mockUserId);

      await completeModule(course.id, 1);

      const updated = await getCourseProgress(mockUserId);
      expect(updated?.modulesCompleted).toBeGreaterThan(0);
      expect(updated?.currentModule).toBe(2);
    });

    it('should complete course', async () => {
      const course = await createRemediationCourse(mockUserId);

      // Complete all modules
      for (let i = 1; i <= 6; i++) {
        await completeModule(course.id, i);
      }

      const completed = await completeCourse(course.id, mockUserId);

      expect(completed.status).toBe('completed');
      expect(completed.modulesCompleted).toBe(6);
    });

    it('should check if remediation is required', async () => {
      await createRemediationCourse(mockUserId);

      const required = await isRemediationRequired(mockUserId);
      expect(required).toBe(true);
    });

    it('should return false if no remediation needed', async () => {
      const required = await isRemediationRequired(mockUserId + 'different');
      expect(required).toBe(false);
    });

    it('should get course module content', () => {
      const module = getCourseModule(1);

      expect(module).toBeDefined();
      expect(module?.id).toBe(1);
      expect(module?.title).toBeTruthy();
      expect(module?.quizQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('Phishing Simulation Integration', () => {
    it('should complete full training flow', async () => {
      // 1. Create course
      const course = await createRemediationCourse(mockUserId);
      expect(course.status).toBe('in_progress');

      // 2. Get initial progress
      let progress = await getCourseProgress(mockUserId);
      expect(progress?.modulesCompleted).toBe(0);

      // 3. Complete first module
      await completeModule(course.id, 1);
      progress = await getCourseProgress(mockUserId);
      expect(progress?.currentModule).toBe(2);

      // 4. Complete all remaining modules
      for (let i = 2; i <= 6; i++) {
        await completeModule(course.id, i);
      }

      // 5. Complete course
      const completed = await completeCourse(course.id, mockUserId);
      expect(completed.status).toBe('completed');

      // 6. Check remediation is no longer required
      const required = await isRemediationRequired(mockUserId);
      expect(required).toBe(false);
    });

    it('should suspend account and require remediation', async () => {
      // Suspend account
      const suspension = await suspendAccount(
        mockUserId,
        'Phishing test credentials entered',
        undefined,
        1
      );

      // Check suspension
      const { isSuspended, suspension: susp } = await checkIfAccountSuspended(
        mockUserId
      );

      expect(isSuspended).toBe(true);
      expect(susp?.reason).toContain('Phishing');
    });
  });
});