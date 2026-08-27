// =============================================================================
// Component: TranscriptSummaryAccordion
//Issue: #3539 - Implement 'Real-Time Event Transcript Summarizer (TL;DR)'
//Description: Renders a beautiful, collapsible "TL;DR" accordion directly
//above the Video Player.Displays the 5 AI - generated bullet points for 
//fast consumption.Includes a "Regenerate" button for admins.
// =============================================================================

import React, { useState } from 'react';
import { useTranscriptSummary } from '../../hooks/useTranscriptSummary';

interface TranscriptSummaryAccordionProps {
    eventId: string;
    transcriptText: string | null;
    isAdmin?: boolean;
}

export const TranscriptSummaryAccordion: React.FC<TranscriptSummaryAccordionProps> = ({
    eventId,
    transcriptText,
    isAdmin = false
}) => {
    const { summary, isLoading, isGenerating, error, triggerGeneration } = useTranscriptSummary(eventId);
    const [isOpen, setIsOpen] = useState(true);

    if (isLoading) {
        return (
            <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse h-20"></div>
        );
    }

    if (!summary && !transcriptText) return null;

    const handleGenerate = async () => {
        if (transcriptText) {
            await triggerGeneration(transcriptText);
        }
    };

    return (
        <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 overflow-hidden shadow-sm">
            {/* Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">TL;DR Summary</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {summary ? `Generated via ${summary.model_used}` : 'AI-powered key takeaways'}
                        </p>
                    </div>
                </div>
                <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Content */}
            {isOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-indigo-100 dark:border-indigo-800/50 animate-fade-in">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm mb-4">
                            {error}
                        </div>
                    )}

                    {isGenerating ? (
                        <div className="flex items-center gap-3 py-8 justify-center text-indigo-600 dark:text-indigo-400">
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="font-medium">Analyzing transcript and generating takeaways...</span>
                        </div>
                    ) : summary ? (
                        <ul className="space-y-3">
                            {summary.summary_points.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                        {point}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                No summary generated yet for this transcript.
                            </p>
                            {isAdmin && transcriptText && (
                                <button
                                    onClick={handleGenerate}
                                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-sm shadow-sm"
                                >
                                    Generate TL;DR Now
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
