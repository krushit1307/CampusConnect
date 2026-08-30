import { createClient } from '@supabase/supabase-js';
import { ChurnRiskAssessment, SeriesAttendeeRisk } from '@/types/churn';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Calculates the churn risk score for a specific user in an event series.
 */
export async function calculateChurnRisk(userId: string, eventSeriesId: string): Promise<ChurnRiskAssessment> {
    const { data, error } = await supabase.functions.invoke('calculate_churn_score', {
        body: { userId, eventSeriesId },
    });

    if (error) {
        console.error('Failed to calculate churn risk:', error);
        throw new Error(error.message || 'Failed to process churn prediction');
    }

    return data as ChurnRiskAssessment;
}

/**
 * Fetches all attendees for a series along with their current churn risk assessments.
 */
export async function getSeriesAttendeesWithChurnRisk(eventSeriesId: string): Promise<SeriesAttendeeRisk[]> {
    const { data, error } = await supabase
        .from('user_series_churn_risk')
        .select(`
      user_id,
      flight_risk_score,
      risk_level,
      engagement_signals,
      profiles (full_name, email)
    `)
        .eq('event_series_id', eventSeriesId)
        .order('flight_risk_score', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return (data || []).map(row => ({
        user_id: row.user_id,
        full_name: row.profiles?.full_name || 'Unknown',
        email: row.profiles?.email || 'Unknown',
        flight_risk_score: row.flight_risk_score,
        risk_level: row.risk_level,
        primary_signals: (row.engagement_signals || [])
            .filter((s: any) => s.triggered)
            .map((s: any) => s.details || s.signal_type),
    }));
}
