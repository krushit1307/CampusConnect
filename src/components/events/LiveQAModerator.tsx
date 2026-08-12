// =============================================================================
// Component: LiveQAModerator
--Issue: #2898 - Develop a Real - Time 'Live Q&A' Module for Events
--Description: High - contrast, simplified dashboard optimized for an iPad 
--or presenter screen.Sorts questions purely by upvotes and provides
--quick actions to mark as answered or delete inappropriate content.
// =============================================================================

import React from 'react';
import { useLiveQA } from '../../hooks/useLiveQA';
import { QuestionCard } from './QuestionCard';

interface LiveQAModeratorProps {
    eventId: string;
}

export const LiveQAModerator: React.FC<LiveQAModeratorProps> = ({ eventId }) => {
    const { questions, isLoading, toggleUpvote, markAnswered, deleteQuestion } = useLiveQA(eventId, true);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            {/* Presenter Header */}
            <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tight flex items-center gap-4">
                        <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]"></span>
                        Live Q&A Dashboard
                    </h1>
                    <p className="text-xl text-gray-400 mt-2">
                        Moderator View • Sorted by Audience Upvotes
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-5xl font-black text-indigo-400">
                        {questions.length}
                    </div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider font-bold">
                        Pending
                    </div>
                </div>
            </div>

            {/* Questions Grid */}
            <div className="max-w-4xl mx-auto space-y-6">
                {isLoading ? (
                    <div className="text-center py-20 text-gray-500">Loading live feed...</div>
                ) : questions.length === 0 ? (
                    <div className="text-center py-20 bg-gray-800 rounded-2xl border border-gray-700">
                        <svg className="w-24 h-24 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-2xl font-bold text-gray-400">Waiting for audience questions...</p>
                    </div>
                ) : (
                    questions.map((q, index) => (
                        <div key={q.id} className="relative">
                            {/* Rank Indicator for Top 3 */}
                            {index < 3 && (
                                <div className={`absolute -left-4 top-4 w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shadow-lg z-10 ${index === 0 ? 'bg-yellow-500 text-yellow-900' :
                                        index === 1 ? 'bg-gray-300 text-gray-800' :
                                            'bg-orange-600 text-orange-100'
                                    }`}>
                                    #{index + 1}
                                </div>
                            )}

                            <div className={`
                bg-gray-800 border-2 rounded-2xl p-6 transition-all
                ${index === 0 ? 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]' : 'border-gray-700'}
              `}>
                                <QuestionCard
                                    question={q}
                                    onUpvote={toggleUpvote}
                                    onMarkAnswered={markAnswered}
                                    onDelete={deleteQuestion}
                                    isModerator={true}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
