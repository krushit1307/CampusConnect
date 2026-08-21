// =============================================================================
// Component: LiveQAAttendee
--Issue: #2898 - Develop a Real - Time 'Live Q&A' Module for Events
--Description: The mobile - optimized interface for event attendees to submit
--questions and upvote others.Features a chat - like scrolling feed.
// =============================================================================

import React, { useState } from 'react';
import { useLiveQA } from '../../hooks/useLiveQA';
import { QuestionCard } from './QuestionCard';

interface LiveQAAttendeeProps {
    eventId: string;
}

export const LiveQAAttendee: React.FC<LiveQAAttendeeProps> = ({ eventId }) => {
    const { questions, isLoading, submitQuestion, toggleUpvote } = useLiveQA(eventId, false);
    const [newQuestion, setNewQuestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion.trim() || isSubmitting) return;

        setIsSubmitting(true);
        const success = await submitQuestion(newQuestion);
        if (success) {
            setNewQuestion('');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] max-h-[800px] bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    Live Q&A
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {questions.length} active questions
                </span>
            </div>

            {/* Questions Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-xl animate-pulse"></div>
                        ))}
                    </div>
                ) : questions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                        <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-lg font-medium">No questions yet</p>
                        <p className="text-sm mt-1">Be the first to ask something!</p>
                    </div>
                ) : (
                    questions.map(q => (
                        <QuestionCard
                            key={q.id}
                            question={q}
                            onUpvote={toggleUpvote}
                        />
                    ))
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Type your question..."
                        maxLength={500}
                        className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting || !newQuestion.trim()}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        )}
                        Ask
                    </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                    {newQuestion.length}/500 characters
                </p>
            </form>
        </div>
    );
};
