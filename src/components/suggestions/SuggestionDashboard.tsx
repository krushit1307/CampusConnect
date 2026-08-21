import React, { useState } from 'react';
import { SuggestionBox } from './SuggestionBox';
import { SuggestionInbox } from './SuggestionInbox';
import { Shield, HelpCircle, FileText, Settings, BarChart2 } from 'lucide-react';

interface SuggestionDashboardProps {
    clubId: string;
    isAdmin: boolean;
}

export const SuggestionDashboard: React.FC<SuggestionDashboardProps> = ({ clubId, isAdmin }) => {
    const [activeTab, setActiveTab] = useState<'submit' | 'inbox' | 'analytics'>('submit');

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 w-full font-sans">
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center space-x-3">
                    <Shield className="w-8 h-8 text-indigo-600" />
                    <span>Digital Suggestion Box & Feedback Hub</span>
                </h1>
                <p className="mt-2 text-sm text-gray-500 max-w-2xl">
                    A cryptographically secure, anonymous channel for club members to voice their ideas,
                    concerns, and constructive feedback directly to the leadership team without fear of judgment.
                </p>
            </div>

            {isAdmin && (
                <div className="flex space-x-1 border-b border-gray-200 mb-6 bg-gray-50/50 p-1 rounded-t-xl">
                    <button
                        onClick={() => setActiveTab('submit')}
                        className={`flex items-center space-x-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'submit'
                                ? 'bg-white text-indigo-700 shadow border border-gray-200'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        <span>Submit Feedback</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`flex items-center space-x-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'inbox'
                                ? 'bg-white text-indigo-700 shadow border border-gray-200'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        <InboxIcon className="w-4 h-4" />
                        <span>Executive Inbox</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`flex items-center space-x-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'analytics'
                                ? 'bg-white text-indigo-700 shadow border border-gray-200'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        <BarChart2 className="w-4 h-4" />
                        <span>Analytics</span>
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    {activeTab === 'submit' || !isAdmin ? (
                        <SuggestionBox clubId={clubId} />
                    ) : activeTab === 'inbox' ? (
                        <SuggestionInbox clubId={clubId} />
                    ) : (
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 flex flex-col items-center justify-center min-h-[500px]">
                            <BarChart2 className="w-16 h-16 text-gray-200 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">Analytics Coming Soon</h3>
                            <p className="text-gray-500 text-center max-w-sm mt-2">
                                Sentiment analysis and volume tracking for anonymous suggestions will be available in V2.
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-100 rounded-xl p-6 border border-indigo-100">
                        <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide flex items-center space-x-2 mb-4">
                            <Shield className="w-4 h-4" />
                            <span>Privacy Guarantee</span>
                        </h3>
                        <ul className="space-y-3 text-sm text-indigo-800/80">
                            <li className="flex items-start">
                                <span className="mr-2 font-bold text-indigo-500">•</span>
                                <div><strong className="text-indigo-900">No PII Stored:</strong> User IDs are never linked to suggestions.</div>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2 font-bold text-indigo-500">•</span>
                                <div><strong className="text-indigo-900">IP Blinded:</strong> Your network address is hashed using a one-way function.</div>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-2 font-bold text-indigo-500">•</span>
                                <div><strong className="text-indigo-900">Executive Only:</strong> Only verified executive board members can read the inbox.</div>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2 mb-4">
                            <HelpCircle className="w-4 h-4 text-gray-400" />
                            <span>FAQ</span>
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900">Is it really anonymous?</h4>
                                <p className="text-xs text-gray-500 mt-1">Yes. The system intentionally drops all user identity data before writing to the database.</p>
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900">What about harassment?</h4>
                                <p className="text-xs text-gray-500 mt-1">We employ a strict IP-based rate limiter and an automated NLP toxicity filter to quarantine abuse.</p>
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900">Can execs reply to me?</h4>
                                <p className="text-xs text-gray-500 mt-1">No. The nature of true anonymity means they cannot reply 1:1, but they can address feedback publicly.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple icon for inbox to keep imports clean above
function InboxIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
    );
}
