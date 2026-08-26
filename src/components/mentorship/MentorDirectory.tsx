// =============================================================================
// Component: MentorDirectory
// Issue: #2963 - Build an 'Alumni Mentorship' Matching Module
--Description: The main directory page where students can browse, filter,
    --and search for alumni mentors.Includes a sidebar for filters and a grid
--of MentorProfileCards.
// =============================================================================

import React, { useState } from 'react';
import { useMentorshipDirectory } from '../../hooks/useMentorshipDirectory';
import { MentorProfileCard } from './MentorProfileCard';
import { RequestMentorshipModal } from './RequestMentorshipModal';

export const MentorDirectory: React.FC = () => {
    const { mentors, isLoading, error, filters, setFilters, industries, companies } = useMentorshipDirectory();
    const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);

    const selectedMentor = mentors.find(m => m.user_id === selectedMentorId);

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Alumni Mentor Network</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Connect with alumni who have volunteered to mentor current students in their industry.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Filters Sidebar */}
                <aside className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sticky top-24">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Filters
                        </h3>

                        {/* Search */}
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Search
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={filters.search}
                                    onChange={(e) => setFilters({ search: e.target.value })}
                                    placeholder="Company, role, or skill..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                />
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        {/* Industry Filter */}
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Industry
                            </label>
                            <select
                                value={filters.industry}
                                onChange={(e) => setFilters({ industry: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">All Industries</option>
                                {industries.map(ind => (
                                    <option key={ind} value={ind}>{ind}</option>
                                ))}
                            </select>
                        </div>

                        {/* Company Filter */}
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Company
                            </label>
                            <select
                                value={filters.company}
                                onChange={(e) => setFilters({ company: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">All Companies</option>
                                {companies.map(comp => (
                                    <option key={comp} value={comp}>{comp}</option>
                                ))}
                            </select>
                        </div>

                        {/* Availability Toggle */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={filters.showAvailableOnly}
                                        onChange={(e) => setFilters({ showAvailableOnly: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-indigo-600 transition-colors"></div>
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                                    Available Only
                                </span>
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-13">
                                Hide mentors who are currently at capacity.
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Mentors Grid */}
                <main className="lg:col-span-3">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center">
                            {error}
                        </div>
                    ) : mentors.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                            <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Mentors Found</h3>
                            <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or check back later.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {mentors.map(mentor => (
                                <MentorProfileCard
                                    key={mentor.user_id}
                                    mentor={mentor}
                                    onRequest={() => setSelectedMentorId(mentor.user_id)}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Request Modal */}
            {selectedMentor && (
                <RequestMentorshipModal
                    mentor={selectedMentor}
                    onClose={() => setSelectedMentorId(null)}
                />
            )}
        </div>
    );
};
