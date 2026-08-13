// =============================================================================
// Hook: useMentorshipDirectory
// Issue: #2963 - Build an 'Alumni Mentorship' Matching Module
--Description: Fetches and filters the alumni mentor directory.Handles
--pagination, search queries, and capacity availability checks.
    // =============================================================================

    import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface MentorProfile {
    user_id: string;
    industry: string;
    company: string;
    job_title: string;
    bio: string | null;
    expertise_tags: string[];
    max_mentees: number;
    current_mentees: number;
    is_accepting: boolean;
    profiles?: {
        full_name: string;
        avatar_url: string | null;
    };
}

export interface MentorshipFilters {
    search: string;
    industry: string;
    company: string;
    showAvailableOnly: boolean;
}

interface UseMentorshipDirectoryReturn {
    mentors: MentorProfile[];
    isLoading: boolean;
    error: string | null;
    filters: MentorshipFilters;
    setFilters: (filters: Partial<MentorshipFilters>) => void;
    industries: string[];
    companies: string[];
}

export function useMentorshipDirectory(): UseMentorshipDirectoryReturn {
    const [mentors, setMentors] = useState<MentorProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [industries, setIndustries] = useState<string[]>([]);
    const [companies, setCompanies] = useState<string[]>([]);

    const [filters, setFiltersState] = useState<MentorshipFilters>({
        search: '',
        industry: '',
        company: '',
        showAvailableOnly: false
    });

    const setFilters = (newFilters: Partial<MentorshipFilters>) => {
        setFiltersState(prev => ({ ...prev, ...newFilters }));
    };

    const fetchMentors = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            let query = supabase
                .from('mentor_profiles')
                .select(`
          *,
          profiles:user_id (full_name, avatar_url)
        `)
                .order('is_accepting', { ascending: false }) // Show available mentors first
                .order('company', { ascending: true });

            // Apply Filters
            if (filters.search) {
                query = query.or(`company.ilike.%${filters.search}%,job_title.ilike.%${filters.search}%,expertise_tags.cs.{${filters.search}}`);
            }
            if (filters.industry) {
                query = query.eq('industry', filters.industry);
            }
            if (filters.company) {
                query = query.eq('company', filters.company);
            }
            if (filters.showAvailableOnly) {
                query = query.eq('is_accepting', true);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            setMentors((data as MentorProfile[]) || []);

            // Extract unique industries and companies for filter dropdowns (if not already fetched)
            if (industries.length === 0 && data && data.length > 0) {
                const uniqueIndustries = Array.from(new Set(data.map(m => m.industry))).sort();
                const uniqueCompanies = Array.from(new Set(data.map(m => m.company))).sort();
                setIndustries(uniqueIndustries);
                setCompanies(uniqueCompanies);
            }

        } catch (err: any) {
            console.error('[useMentorshipDirectory] Fetch failed:', err);
            setError(err.message || 'Failed to load mentor directory.');
        } finally {
            setIsLoading(false);
        }
    }, [filters, industries.length]);

    useEffect(() => {
        fetchMentors();
    }, [fetchMentors]);

    return {
        mentors,
        isLoading,
        error,
        filters,
        setFilters,
        industries,
        companies
    };
}
