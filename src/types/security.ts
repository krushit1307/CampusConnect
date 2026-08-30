/**
 * Phishing Simulation Training Types
 */

export type CampaignType = 'stripe_escrow' | 'university_it' | 'payment_processing' | 'security_alert';
export type PhishingCampaignStatus = 'pending' | 'sent' | 'clicked' | 'credentials_entered' | 'completed';
export type RemediationStatus = 'in_progress' | 'completed' | 'suspended';
export type AuditEventType =
  | 'ADMIN_PROMOTED'
  | 'PHISHING_CAMPAIGN_CREATED'
  | 'PHISHING_EMAIL_SENT'
  | 'PHISHING_LINK_CLICKED'
  | 'PHISHING_CREDENTIALS_CAPTURED'
  | 'ACCOUNT_SUSPENDED_FOR_PHISHING'
  | 'REMEDIATION_STARTED'
  | 'REMEDIATION_MODULE_COMPLETED'
  | 'REMEDIATION_COMPLETED'
  | 'ACCOUNT_UNSUSPENDED';

export interface AdminPromotionEvent {
  id: string;
  userId: string;
  clubId: string;
  promotedAt: string;
  phishingTriggeredAt?: string;
  phishingCampaignId?: string;
}

export interface PhishingCampaign {
  id: string;
  adminPromotionId: string;
  campaignType: CampaignType;
  emailTemplate: string;
  honeyPotToken: string;
  status: PhishingCampaignStatus;
  sentAt?: string;
  clickedAt?: string;
  credentialsEnteredAt?: string;
  remediationRequiredUntil?: string;
}

export interface RemediationCourse {
  id: string;
  userId: string;
  campaignId?: string;
  courseStartAt: string;
  courseCompletionAt?: string;
  status: RemediationStatus;
  modulesCompleted: number;
  totalModules: number;
  currentModule: number;
}

export interface AccountSuspension {
  id: string;
  userId: string;
  reason: string;
  suspendedAt: string;
  suspendedUntil: string;
  remediationCourseId?: string;
  isActive: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  eventType: AuditEventType;
  campaignId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CourseModule {
  id: number;
  title: string;
  description: string;
  content: string;
  videoUrl?: string;
  estimatedDuration: number;
  quizQuestions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface EmailTemplate {
  subject: string;
  fromEmail: string;
  fromName: string;
  htmlBody: string;
  textBody: string;
  urgencyLevel: 'high' | 'critical';
}