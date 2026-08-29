/**
 * Club Types for CampusConnect
 * Defines interfaces and enums related to club management and status.
 */

export type ClubStatus = 'active' | 'probation' | 'suspended' | 'dissolved';

export interface Club {
    id: string;
    name: string;
    description: string;
    status: ClubStatus;
    president_id: string;
    probation_reason?: string;
    probation_start_date?: string;
    probation_end_date?: string;
    compliance_acknowledged: boolean;
    created_at: string;
    updated_at: string;
}

export interface ComplianceQuizAnswer {
    question_id: string;
    selected_option: string;
    is_correct: boolean;
}

export interface ComplianceSubmission {
    club_id: string;
    submitted_by: string;
    answers: ComplianceQuizAnswer[];
    passed: boolean;
    submitted_at: string;
}
