// =============================================================================
// Component: LeaderboardPage
--Issue: #2971 - Develop a 'Cross-Club Leaderboard'(Gamification)
--Description: The main page layout for the Cross - Club Leaderboard.
--Combines the animated Podium for the top 3 clubs and the detailed
--LeaderboardTable for the rest.
// =============================================================================

import React from 'react';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { PodiumCard } from './PodiumCard';
import { LeaderboardTable } from './LeaderboardTable';

export const LeaderboardPage: React.FC = () => {
    const { entries, isLoading, error } = useLeaderboard();

    const top3 = entries.slice(0, 3);
    // Reorder for visual podium: 2nd place (left), 1st place (center), 3rd place (right)
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
                        Campus Club Leaderboard
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Celebrating the most active, engaging, and highest-quality clubs on campus this semester.
                    </p>
                    <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                            <span>10 pts / Event</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <span>Normalized Engagement</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                            <span>+50 pts / 4.5+ Rating</span>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400">Calculating scores...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center max-w-md mx-auto">
                        {error}
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                        <p className="text-xl font-bold">No clubs have earned points yet this semester.</p>
                        <p className="mt-2">Host events and engage your members to climb the ranks!</p>
                    </div>
                ) : (
                    <>
                        {/* Podium Section */}
                        <div className="flex items-end justify-center gap-4 md:gap-8 mb-16 h-80">
                            {podiumOrder.map((entry, idx) => {
                                // Map visual index back to actual position (Left=2, Center=1, Right=3)
                                const actualPosition = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                                return (
                                    <PodiumCard
                                        key={entry.club_id}
                                        entry={entry}
                                        position={actualPosition as 1 | 2 | 3}
                                    />
                                );
                            })}
                        </div>

                        {/* Full Rankings Table */}
                        {entries.length > 3 && (
                            <div className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 px-2">
                                    Full Rankings
                                </h2>
                                <LeaderboardTable entries={entries} />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Custom Animations */}
            <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        .animate-shine {
          animation: shine 3s infinite;
        }
      `}</style>
        </div>
    );
};
