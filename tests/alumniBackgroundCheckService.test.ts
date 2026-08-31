import { describe, it, expect } from 'vitest';
import {
  isBackgroundCheckExpired,
  processAlumniSpeakerAssignment,
  buildDeanReviewDossier,
} from '../src/services/alumniBackgroundCheckService';
import { AlumniProfile } from '../src/types/alumniSpeaker';

describe('Alumni Speaker Automated Background Check Service (#4912)', () => {
  const mockCleanAlumni: AlumniProfile = {
    id: 'alm-101',
    userId: 'user-clean',
    fullName: 'Jane Doe',
    email: 'jane.doe@alumni.univ.edu',
    graduationYear: 2018,
    degree: 'Computer Science',
    lastBackgroundCheckDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    speakerPrivileges: 'active',
  };

  const mockExpiredAlumni: AlumniProfile = {
    id: 'alm-102',
    userId: 'user-expired',
    fullName: 'John Smith',
    email: 'john.smith@alumni.univ.edu',
    graduationYear: 2015,
    degree: 'Economics',
    lastBackgroundCheckDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    speakerPrivileges: 'active',
  };

  const mockFraudConvictedAlumni: AlumniProfile = {
    id: 'alm-103',
    userId: 'user-fraud',
    fullName: 'Victor Fraudster',
    email: 'victor@fakecorp.com',
    graduationYear: 2010,
    degree: 'Finance',
    lastBackgroundCheckDate: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(),
    speakerPrivileges: 'active',
  };

  it('should detect when background check is expired (> 12 months)', () => {
    expect(isBackgroundCheckExpired(mockCleanAlumni.lastBackgroundCheckDate)).toBe(false);
    expect(isBackgroundCheckExpired(mockExpiredAlumni.lastBackgroundCheckDate)).toBe(true);
    expect(isBackgroundCheckExpired(undefined)).toBe(true);
  });

  it('should bypass background check if active and check is recent', async () => {
    const result = await processAlumniSpeakerAssignment(mockCleanAlumni, {
      alumniId: mockCleanAlumni.id,
      eventId: 'evt-keynote',
      role: 'keynote',
      organizerUserId: 'org-admin-1',
    });

    expect(result.assigned).toBe(true);
    expect(result.requiresBackgroundCheck).toBe(false);
    expect(result.privilegeStatus).toBe('active');
  });

  it('should trigger check and instantly suspend privileges when flags are found', async () => {
    const result = await processAlumniSpeakerAssignment(mockFraudConvictedAlumni, {
      alumniId: mockFraudConvictedAlumni.id,
      eventId: 'evt-keynote',
      role: 'keynote',
      organizerUserId: 'org-admin-1',
    });

    expect(result.assigned).toBe(false);
    expect(result.requiresBackgroundCheck).toBe(true);
    expect(result.privilegeStatus).toBe('suspended');
    expect(result.report?.status).toBe('consider');
    expect(result.dossier).toBeDefined();
    expect(result.dossier?.riskScore).toBe('critical');
  });

  it('should build proper Dean review dossier structure for manual review', () => {
    const report = {
      id: 'rep-test',
      alumniId: mockFraudConvictedAlumni.id,
      checkrCandidateId: 'cand-1',
      checkrReportId: 'rep-1',
      status: 'consider' as const,
      flagsFound: true,
      civilRecordCount: 2,
      criminalRecordCount: 1,
      detailsSummary: 'Securities fraud conviction flag.',
      createdAt: new Date().toISOString(),
    };

    const dossier = buildDeanReviewDossier(
      mockFraudConvictedAlumni,
      report,
      'keynote',
      'evt-123'
    );

    expect(dossier.alumniName).toBe('Victor Fraudster');
    expect(dossier.civilRecordCount).toBe(2);
    expect(dossier.criminalRecordCount).toBe(1);
    expect(dossier.riskScore).toBe('critical');
  });
});
