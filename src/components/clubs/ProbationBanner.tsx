'use client';

import { Club } from '@/types/club';

interface ProbationBannerProps {
    club: Club;
}

export default function ProbationBanner({ club }: ProbationBannerProps) {
    if (club.status !== 'probation') {
        return null;
    }

    return (
        <div className="w-full bg-red-600 dark:bg-red-800 text-white p-6 shadow-lg border-b-4 border-red-800 dark:border-red-950">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                    <svg className="w-8 h-8 flex-shrink-0 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h2 className="text-xl font-bold uppercase tracking-wide">
                            Your club is on Probation
                        </h2>
                        <div className="mt-2 p-2.5 bg-black/30 border border-red-300/40 rounded-lg text-sm font-semibold text-amber-200 flex items-center gap-2">
                            <span>❄️</span>
                            <span>Point Accumulation is FROZEN due to active Disciplinary Probation.</span>
                        </div>
                        <p className="mt-2 text-red-100 text-sm">
                            Financial, Event, and Gamification Leaderboard privileges are suspended.
                            {club.probation_reason && <span className="block mt-1 font-medium text-white">Reason: {club.probation_reason}</span>}
                            {club.probation_end_date && (
                                <span className="block text-xs text-red-200 mt-1">
                                    Probation ends: {new Date(club.probation_end_date).toLocaleDateString()}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                {!club.compliance_acknowledged && (
                    <a
                        href={`/clubs/${club.id}/compliance/acknowledgment`}
                        className="flex-shrink-0 bg-white text-red-700 hover:bg-red-50 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-gray-800 font-bold py-3 px-6 rounded-lg shadow-md transition-colors duration-200 text-center"
                    >
                        Complete Compliance Acknowledgment
                    </a>
                )}
            </div>
        </div>
    );
}
