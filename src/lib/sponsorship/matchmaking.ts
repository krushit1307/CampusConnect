// =============================================================================
// Utility: Sponsorship Matchmaking Types & Helpers
// Issue: #2961 - Implement 'Sponsorship Matchmaking' Algorithm
// Description: Defines TypeScript interfaces for the sponsorship marketplace 
// and provides utility functions for formatting currency and demographic tags.
// =============================================================================

export interface FundingRequest {
    id: string;
    club_id: string;
    event_id: string | null;
    title: string;
    description: string;
    requested_amount: number; // In cents
    target_demographics: string[];
    status: 'open' | 'funded' | 'partial' | 'closed';
    created_at: string;
}

export interface SponsorshipCampaign {
    campaign_id: string;
    company_name: string;
    campaign_title: string;
    remaining_budget: number;
    match_score: number;
    shared_demographics: string[];
}

export interface SponsorPitch {
    id: string;
    request_id: string;
    campaign_id: string;
    pitch_message: string;
    requested_amount: number;
    approved_amount: number | null;
    status: 'pending' | 'approved' | 'partial' | 'rejected';
    created_at: string;
}

/**
 * Standardized list of target demographics available in the system.
 * Used for dropdowns and tag selection in the UI.
 */
export const DEMOGRAPHIC_OPTIONS = [
    { value: 'cs_majors', label: 'Computer Science Majors' },
    { value: 'engineering', label: 'Engineering Students' },
    { value: 'business', label: 'Business & Economics' },
    { value: 'arts_humanities', label: 'Arts & Humanities' },
    { value: 'underclassmen', label: 'Freshmen & Sophomores' },
    { value: 'upperclassmen', label: 'Juniors & Seniors' },
    { value: 'grad_students', label: 'Graduate Students' },
    { value: 'international', label: 'International Students' },
    { value: 'stem_women', label: 'Women in STEM' },
    { value: 'first_gen', label: 'First-Generation Students' },
];

/**
 * Formats a demographic value into a human-readable label.
 */
export function formatDemographic(value: string): string {
    const option = DEMOGRAPHIC_OPTIONS.find(opt => opt.value === value);
    return option ? option.label : value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Formats an integer representing cents into a localized USD currency string.
 */
export function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

/**
 * Calculates the visual width of a match score progress bar (0-100%).
 * The max possible score is 150 (100 demo + 50 budget).
 */
export function getMatchScorePercentage(score: number): number {
    return Math.min(100, Math.round((score / 150) * 100));
}

/**
 * Returns Tailwind color classes based on the match score percentage.
 */
export function getMatchScoreColor(score: number): string {
    const pct = getMatchScorePercentage(score);
    if (pct >= 80) return 'bg-green-500 dark:bg-green-400';
    if (pct >= 50) return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-red-500 dark:bg-red-400';
}
