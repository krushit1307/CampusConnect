// =============================================================================
// Hook: useSponsorROI
--Issue: #3238 - Build a 'Sponsorship ROI Dashboard' for Corporate Partners
--Description: Fetches aggregated demographic data for a specific event 
--sponsored by the current corporate partner.Handles the k - anonymity check
--and provides a function to export the opt -in lead list as a CSV.
    // =============================================================================

    import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface DemographicChart {
    label: string;
    value: number;
}

export interface ROIData {
    isAnonymous: boolean;
    totalRsvps: number;
    message?: string;
    majors?: DemographicChart[];
    graduationYears?: DemographicChart[];
}

export interface SponsorLead {
    full_name: string;
    email: string;
    major: string;
    graduation_year: number;
    linkedin_url: string | null;
}

interface UseSponsorROIReturn {
    roiData: ROIData | null;
    isLoading: boolean;
    error: string | null;
    fetchROI: () => Promise<void>;
    exportLeads: () => Promise<boolean>;
}

export function useSponsorROI(eventId: string | null, sponsorId: string | null): UseSponsorROIReturn {
    const [roiData, setRoiData] = useState<ROIData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchROI = useCallback(async () => {
        if (!eventId || !sponsorId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc('get_event_demographics', {
                p_event_id: eventId,
                p_sponsor_id: sponsorId
            });

            if (rpcError) throw rpcError;

            setRoiData({
                isAnonymous: data.is_anonymous,
                totalRsvps: data.total_rsvps,
                message: data.message,
                majors: data.majors || [],
                graduationYears: data.graduation_years || []
            });
        } catch (err: any) {
            console.error('[useSponsorROI] Fetch failed:', err);
            setError(err.message || 'Failed to load ROI data.');
        } finally {
            setIsLoading(false);
        }
    }, [eventId, sponsorId]);

    useEffect(() => {
        fetchROI();
    }, [fetchROI]);

    /**
     * Fetches the opt-in lead list and triggers a CSV download.
     */
    const exportLeads = async (): Promise<boolean> => {
        if (!eventId || !sponsorId) return false;

        try {
            const { data: leads, error: fetchError } = await supabase.rpc('get_sponsor_leads', {
                p_event_id: eventId,
                p_sponsor_id: sponsorId
            });

            if (fetchError) throw fetchError;
            if (!leads || leads.length === 0) {
                alert('No students opted in to share their data with sponsors for this event.');
                return false;
            }

            // Generate CSV
            const headers = ['Full Name', 'Email', 'Major', 'Graduation Year', 'LinkedIn'];
            const rows = leads.map((lead: SponsorLead) => [
                `"${lead.full_name}"`,
                lead.email,
                `"${lead.major || ''}"`,
                lead.graduation_year || '',
                lead.linkedin_url || ''
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            // Trigger Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `event-leads-${eventId}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return true;
        } catch (err: any) {
            console.error('[useSponsorROI] Export failed:', err);
            alert('Failed to export leads: ' + err.message);
            return false;
        }
    };

    return {
        roiData,
        isLoading,
        error,
        fetchROI,
        exportLeads
    };
}
