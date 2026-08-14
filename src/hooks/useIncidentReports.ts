// =============================================================================
// Hook: useIncidentReports
// Issue: #2969 - Build an 'Anonymous Incident Reporting' Workflow
// Description: Manages the submission of anonymous incident reports and 
// the retrieval of report status via claim tickets. Handles CAPTCHA state 
// and rate limiting feedback.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface IncidentSubmissionResult {
    success: boolean;
    claimTicket?: string;
    isEscalated?: boolean;
    error?: string;
}

export interface IncidentStatus {
    status: 'pending' | 'under_investigation' | 'resolved' | 'dismissed';
    submitted_at: string;
    updated_at: string;
    event_title: string;
}

interface UseIncidentReportsReturn {
    submitReport: (eventId: string, description: string, captchaToken: string) => Promise<IncidentSubmissionResult>;
    checkStatus: (ticket: string) => Promise<IncidentStatus | null>;
    isSubmitting: boolean;
    isChecking: boolean;
}

export function useIncidentReports(): UseIncidentReportsReturn {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    /**
     * Submits an anonymous incident report.
     * Decoupled from the user's auth session to guarantee anonymity.
     */
    const submitReport = async (
        eventId: string,
        description: string,
        captchaToken: string
    ): Promise<IncidentSubmissionResult> => {
        setIsSubmitting(true);

        try {
            // Validate CAPTCHA token via an Edge Function to prevent client-side bypass
            // For this implementation, we assume the Edge Function handles the insert 
            // after verifying the CAPTCHA and applying rate limits.
            const { data, error } = await supabase.functions.invoke('submit-incident-report', {
                body: {
                    event_id: eventId,
                    description: description,
                    captcha_token: captchaToken
                }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            return {
                success: true,
                claimTicket: data.claim_ticket,
                isEscalated: data.is_escalated
            };
        } catch (err: any) {
            console.error('[useIncidentReports] Submission failed:', err);
            return {
                success: false,
                error: err.message || 'Failed to submit report. Please try again later.'
            };
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Checks the status of a report using the anonymous claim ticket.
     * Does not require authentication.
     */
    const checkStatus = async (ticket: string): Promise<IncidentStatus | null> => {
        if (!ticket.trim()) return null;
        setIsChecking(true);

        try {
            const { data, error } = await supabase.rpc('check_incident_status', {
                p_ticket: ticket.trim().toUpperCase()
            });

            if (error) throw error;

            if (!data || data.length === 0) {
                return null; // Ticket not found
            }

            return data[0] as IncidentStatus;
        } catch (err: any) {
            console.error('[useIncidentReports] Status check failed:', err);
            return null;
        } finally {
            setIsChecking(false);
        }
    };

    return {
        submitReport,
        checkStatus,
        isSubmitting,
        isChecking
    };
}
