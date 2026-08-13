// =============================================================================
// Component: PodiumCard
--Issue: #2971 - Develop a 'Cross-Club Leaderboard'(Gamification)
--Description: Renders the animated podium graphics for the Top 3 clubs.
--Includes distinct visual treatments for Gold, Silver, and Bronze positions.
// =============================================================================

import React from 'react';
import { LeaderboardEntry } from '../../hooks/useLeaderboard';

interface PodiumCardProps {
    entry: LeaderboardEntry;
    position: 1 | 2 | 3;
}

export const PodiumCard: React.FC<PodiumCardProps> = ({ entry, position }) => {
    const getStyles = () => {
        switch (position) {
            case 1:
                return {
                    height: 'h-48',
                    ring: 'ring-4 ring-yellow-400 dark:ring-yellow-500',
                    bg: 'bg-gradient-to-t from-yellow-600 to-yellow-400',
                    text: 'text-yellow-900',
                    medal: '🥇',
                    delay: 'delay-100'
                };
            case 2:
                return {
                    height: 'h-36',
                    ring: 'ring-4 ring-gray-400 dark:ring-gray-500',
                    bg: 'bg-gradient-to-t from-gray-500 to-gray-300',
                    text: 'text-gray-800',
                    medal: '🥈',
                    delay: 'delay-200'
                };
            case 3:
                return {
                    height: 'h-28',
                    ring: 'ring-4 ring-orange-400 dark:ring-orange-600',
                    bg: 'bg-gradient-to-t from-orange-700 to-orange-500',
                    text: 'text-orange-900',
                    medal: '🥉',
                    delay: 'delay-300'
                };
        }
    };

    const styles = getStyles();

    return (
        <div className={`flex flex-col items-center animate-fade-in-up ${styles.delay}`}>
            {/* Club Avatar & Info */}
            <div className="mb-4 text-center">
                <div className="relative inline-block">
                    <div className={`w-20 h-20 rounded-full overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg ${styles.ring}`}>
                        {entry.logo_url ? (
                            <img src={entry.logo_url} alt={entry.club_name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-2xl font-black text-indigo-700 dark:text-indigo-300">
                                {entry.club_name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="absolute -top-2 -right-2 text-3xl drop-shadow-md">
                        {styles.medal}
                    </div>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mt-3 text-lg truncate max-w-[120px]">
                    {entry.club_name}
                </h3>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {entry.total_score.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                    Points
                </p>
            </div>

            {/* Podium Block */}
            <div className={`w-32 ${styles.height} ${styles.bg} rounded-t-xl shadow-xl flex items-start justify-center pt-4 relative overflow-hidden`}>
                <span className={`text-6xl font-black ${styles.text} opacity-20`}>
                    {position}
                </span>
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 transform -skew-x-12 animate-shine"></div>
            </div>
        </div>
    );
};
