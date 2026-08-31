export type SpeakerRoleType = 'keynote' | 'panelist' | 'workshop_lead' | 'guest_lecturer';

export type BackgroundCheckStatus = 'pending' | 'clear' | 'consider' | 'review' | 'expired' | 'failed';

export type SpeakerPrivilegeStatus = 'active' | 'suspended' | 'under_dean_review' | 'revoked';

export interface AlumniProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  graduationYear: number;
  degree: string;
  currentCompany?: string;
  currentTitle?: string;
  ssnLastFour?: string;
  dateOfBirth?: string;
  lastBackgroundCheckDate?: string; // ISO String
  backgroundCheckStatus?: BackgroundCheckStatus;
  speakerPrivileges: SpeakerPrivilegeStatus;
  activeRole?: SpeakerRoleType;
}

export interface BackgroundCheckReport {
  id: string;
  alumniId: string;
  checkrCandidateId: string;
  checkrReportId: string;
  status: BackgroundCheckStatus;
  flagsFound: boolean;
  civilRecordCount: number;
  criminalRecordCount: number;
  detailsSummary: string;
  createdAt: string;
  completedAt?: string;
}

export interface DeanReviewDossier {
  dossierId: string;
  alumniId: string;
  alumniName: string;
  alumniEmail: string;
  eventId?: string;
  assignedRole: SpeakerRoleType;
  reportId: string;
  flagDetails: string[];
  civilRecordCount: number;
  criminalRecordCount: number;
  riskScore: 'low' | 'medium' | 'high' | 'critical';
  submittedToDeanAt: string;
  deanDecision?: 'approved' | 'rejected' | 'pending_more_info';
  deanNotes?: string;
  reviewedByDeanId?: string;
}
