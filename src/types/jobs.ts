/**
 * Job Board Types for CampusConnect
 * Defines interfaces and enums related to alumni job postings and their lifecycle.
 */

export type JobStatus = 'active' | 'archived' | 'filled';

export interface AlumniJob {
    id: string;
    alumni_id: string;
    title: string;
    company: string;
    description: string;
    location: string;
    job_type: string;
    application_link: string;
    status: JobStatus;
    expires_at: string;
    renewal_token: string | null;
    created_at: string;
    updated_at: string;
}

export interface JobRenewalRequest {
    token: string;
    jobId: string;
    extendDays: number;
}

export interface JobRenewalResponse {
    success: boolean;
    message: string;
    newExpiresAt: string;
}
