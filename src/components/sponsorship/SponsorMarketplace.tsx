// =============================================================================
// Component: SponsorMarketplace
// Issue: #2961 - Implement 'Sponsorship Matchmaking' Algorithm
// Description: The main UI for Club Admins to view algorithmically recommended 
// sponsors for their funding requests. Displays match scores, shared demographics, 
// and allows them to initiate a pitch.
// =============================================================================

import React, { useState } from 'react';
import { useSponsorshipMatches } from '../../hooks/useSponsorshipMatches';
import {
    formatCurrency,
    formatDemographic,
    getMatchScorePercentage,
    getMatchScoreColor,
    SponsorshipCampaign
} from '../../lib/sponsorship/matchmaking';
import { SponsorPitchModal } from './SponsorPitchModal';
import { SponsorshipPricingGrid } from './SponsorshipPricingGrid';

interface SponsorMarketplaceProps {
    requestId: string;
    requestTitle: string;
    requestedAmount: number;
    clubId?: string;
}

export const SponsorMarketplace: React.FC<SponsorMarketplaceProps> = ({
    requestId,
    requestTitle,
    requestedAmount,
    clubId
}) => {    const { matches, pitches, isLoading, error } = useSponsorshipMatches(requestId);
    const [selectedCampaign, setSelectedCampaign] = useState<SponsorshipCampaign | null>(null);

    const getPitchStatus = (campaignId: string) => {
        const pitch = pitches.find(p => p.campaign_id === campaignId);
        return pitch ? pitch.status : null;
    };

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl"></div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
                <p className="font-bold mb-1">Error loading marketplace</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Recommended Sponsors
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        AI-matched sponsors for: <span className="font-medium text-gray-700 dark:text-gray-300">{requestTitle}</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                        Seeking
                    </p>
                    <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(requestedAmount)}
                    </p>
</div>
            </div>

            {clubId && (
                <div className="pt-2 pb-6 border-b border-gray-200 dark:border-gray-700">
                    <SponsorshipPricingGrid clubId={clubId} />
                </div>
            )}

            {matches.length === 0 ? (                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Matches Found</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        We couldn't find any active sponsor campaigns matching your target demographics and budget requirements right now. Try broadening your target audience.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches.map(campaign => {
                        const pitchStatus = getPitchStatus(campaign.campaign_id);
                        const scorePct = getMatchScorePercentage(campaign.match_score);
                        const scoreColor = getMatchScoreColor(campaign.match_score);

                        return (
                            <div
                                key={campaign.campaign_id}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                                            {campaign.company_name}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {campaign.campaign_title}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Budget Left</p>
                                        <p className="font-bold text-green-600 dark:text-green-400">
                                            {formatCurrency(campaign.remaining_budget)}
                                        </p>
                                    </div>
                                </div>

                                {/* Match Score Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        <span>Match Score</span>
                                        <span>{scorePct}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 ${scoreColor}`}
                                            style={{ width: `${scorePct}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Shared Demographics Tags */}
                                <div className="flex flex-wrap gap-2 mb-4 flex-1">
                                    {campaign.shared_demographics.map(demo => (
                                        <span
                                            key={demo}
                                            className="px-2 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800"
                                        >
                                            {formatDemographic(demo)}
                                        </span>
                                    ))}
                                    {campaign.shared_demographics.length === 0 && (
                                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                                            Budget match only
                                        </span>
                                    )}
                                </div>

                                {/* Action Button */}
                                {pitchStatus ? (
                                    <div className={`w-full py-2 rounded-lg text-center text-sm font-bold uppercase tracking-wider ${pitchStatus === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' :
                                            pitchStatus === 'partial' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                                pitchStatus === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' :
                                                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>
                                        {pitchStatus === 'pending' ? 'Pitch Sent' : pitchStatus}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setSelectedCampaign(campaign)}
                                        className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm active:scale-[0.98]"
                                    >
                                        Send Pitch
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pitch Modal */}
            {selectedCampaign && (
                <SponsorPitchModal
                    campaign={selectedCampaign}
                    requestAmount={requestedAmount}
                    onClose={() => setSelectedCampaign(null)}
                />
            )}
        </div>
    );
};
