import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface DropoutRiskAnalysis {
    user_id: string;
    risk_status: 'stable' | 'at_risk' | 'dropped';
    delta_trend: 'improving' | 'neutral' | 'declining';
    average_delta_minutes: number;
    requires_intervention: boolean;
}

/**
 * Analyzes a user's attendance pattern in an event series for dropout risk.
 */
export async function analyzeDropoutRisk(userId: string, eventSeriesId: string): Promise<DropoutRiskAnalysis> {
    const { data, error } = await supabase.functions.invoke('analyze_dropout_risk', {
        body: { userId, eventSeriesId },
    });

    if (error) {
        console.error('Failed to analyze dropout risk:', error);
        throw new Error(error.message || 'Failed to process dropout risk analysis');
    }

    return data as DropoutRiskAnalysis;
}

/**
 * Sends an automated intervention email to an at-risk student.
 */
export async function sendInterventionEmail(userId: string, seriesName: string, organizerEmail: string) {
    // In a real app, this would trigger a Resend/SendGrid API call via an Edge Function
    const { data, error } = await supabase.functions.invoke('send_intervention_email', {
        body: { userId, seriesName, organizerEmail },
    });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

/**
 * Fetches all attendees for a series with their current risk status.
 */
export async function getSeriesAttendeesWithRisk(eventSeriesId: string) {
    const { data, error } = await supabase
        .from('user_series_engagement')
        .select(`
      user_id,
      risk_status,
      delta_trend,
      average_check_in_delta_minutes,
      profiles (email, full_name)
    `)
        .eq('event_series_id', eventSeriesId);

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
