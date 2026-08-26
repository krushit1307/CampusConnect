// =============================================================================
// Component: ClubQualityScore
// Issue: #4042 - Implement 'Automated "Post-Event Feedback" Aggregation'
// Description: Displays the aggregated 1-5 star rating and total review count 
// on the public Club Profile page.
// =============================================================================

import React from 'react';

interface ClubQualityScoreProps {
    rating: number;
    totalReviews: number;
}

export const ClubQualityScore: React.FC<ClubQualityScoreProps> = ({ rating, totalReviews }) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                        key={star}
                        className={`w-5 h-5 ${star <= fullStars
                            ? 'text-yellow-400'
                            : star === fullStars + 1 && hasHalfStar
                                ? 'text-yellow-400' // Simplified half-star visualization
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                ))}
            </div>
            <div className="flex flex-col">
                <span className="text-sm font-black text-gray-900 dark:text-white leading-none">
                    {rating.toFixed(1)}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                    {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                </span>
            </div>
        </think>
    );
}