import {
  AlumniProfile,
  BackgroundCheckReport,
  BackgroundCheckStatus,
  DeanReviewDossier,
  SpeakerRoleType,
} from '../types/alumniSpeaker';

export interface AssignSpeakerRoleParams {
  alumniId: string;
  eventId: string;
  role: SpeakerRoleType;
  organizerUserId: string;
  checkrApiKey?: string;
}

export interface AssignSpeakerRoleResult {
  assigned: boolean;
  requiresBackgroundCheck: boolean;
  privilegeStatus: 'active' | 'suspended' | 'under_dean_review';
  report?: BackgroundCheckReport;
  dossier?: DeanReviewDossier;
  message: string;
}

export function isBackgroundCheckExpired(lastCheckDateStr?: string): boolean {
  if (!lastCheckDateStr) return true;
  const lastCheckDate = new Date(lastCheckDateStr);
  if (isNaN(lastCheckDate.getTime())) return true;

  const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
  const elapsedMs = Date.now() - lastCheckDate.getTime();
  return elapsedMs > TWELVE_MONTHS_MS;
}

export async function triggerCheckrBackgroundScreening(
  alumni: AlumniProfile,
  checkrApiKey: string = 'chk_test_mock_api_key'
): Promise<BackgroundCheckReport> {
  const mockReportId = `rep_${Math.random().toString(36).substring(2, 9)}`;
  const mockCandidateId = `cand_${Math.random().toString(36).substring(2, 9)}`;

  const containsFraudHistory =
    alumni.fullName.toLowerCase().includes('fraud') ||
    alumni.fullName.toLowerCase().includes('convicted') ||
    alumni.fullName.toLowerCase().includes('scam');

  const status: BackgroundCheckStatus = containsFraudHistory ? 'consider' : 'clear';
  const flagsFound = containsFraudHistory;

  return {
    id: `bgr_${Date.now()}`,
    alumniId: alumni.id,
    checkrCandidateId: mockCandidateId,
    checkrReportId: mockReportId,
    status,
    flagsFound,
    civilRecordCount: containsFraudHistory ? 2 : 0,
    criminalRecordCount: containsFraudHistory ? 1 : 0,
    detailsSummary: containsFraudHistory
      ? 'Civil litigation flag: Corporate fraud & Securities violations reported within 24 months.'
      : 'Clean background check record. No criminal or civil flags detected.',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

export function buildDeanReviewDossier(
  alumni: AlumniProfile,
  report: BackgroundCheckReport,
  assignedRole: SpeakerRoleType,
  eventId?: string
): DeanReviewDossier {
  const isHighRisk = report.criminalRecordCount > 0 || report.civilRecordCount > 1;

  return {
    dossierId: `dos_${Date.now()}_${alumni.id}`,
    alumniId: alumni.id,
    alumniName: alumni.fullName,
    alumniEmail: alumni.email,
    eventId,
    assignedRole,
    reportId: report.id,
    flagDetails: [report.detailsSummary],
    civilRecordCount: report.civilRecordCount,
    criminalRecordCount: report.criminalRecordCount,
    riskScore: isHighRisk ? 'critical' : 'high',
    submittedToDeanAt: new Date().toISOString(),
    deanDecision: 'pending_more_info',
  };
}

export async function processAlumniSpeakerAssignment(
  alumni: AlumniProfile,
  params: AssignSpeakerRoleParams
): Promise<AssignSpeakerRoleResult> {
  const needsCheck = isBackgroundCheckExpired(alumni.lastBackgroundCheckDate);

  if (!needsCheck && alumni.speakerPrivileges === 'active') {
    return {
      assigned: true,
      requiresBackgroundCheck: false,
      privilegeStatus: 'active',
      message: 'Alumni speaker role assigned successfully. Background check is up to date.',
    };
  }

  const report = await triggerCheckrBackgroundScreening(
    alumni,
    params.checkrApiKey
  );

  alumni.lastBackgroundCheckDate = report.completedAt;
  alumni.backgroundCheckStatus = report.status;

  if (report.status === 'consider' || report.status === 'review') {
    alumni.speakerPrivileges = 'suspended';

    const dossier = buildDeanReviewDossier(
      alumni,
      report,
      params.role,
      params.eventId
    );

    return {
      assigned: false,
      requiresBackgroundCheck: true,
      privilegeStatus: 'suspended',
      report,
      dossier,
      message: `Speaker privileges instantly suspended due to '${report.status}' background screening flags. Dossier routed to Dean of Students for manual review.`,
    };
  }

  alumni.speakerPrivileges = 'active';
  return {
    assigned: true,
    requiresBackgroundCheck: true,
    privilegeStatus: 'active',
    report,
    message: 'Background check passed cleanly. Speaker privileges granted.',
  };
}
