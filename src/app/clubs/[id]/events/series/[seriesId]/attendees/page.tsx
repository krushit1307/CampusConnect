'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getSeriesAttendeesWithRisk, analyzeDropoutRisk, sendInterventionEmail } from '@/lib/analytics/dropoutPrediction';
import DropoutRiskBadge from '@/components/analytics/DropoutRiskBadge';
import InterventionEmailModal from '@/components/analytics/InterventionEmailModal';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Attendee {
    user_id: string;
    risk_status: 'stable' | 'at_risk' | 'dropped';
    delta_trend: 'improving' | 'neutral' | 'declining';
    average_check_in_delta_minutes: number;
    profiles: { email: string; full_name: string };
}

export default function SeriesAttendeesPage() {
    const params = useParams();
    const seriesId = params.seriesId as string;

    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const data = await getSeriesAttendeesWithRisk(seriesId);
                setAttendees(data || []);
            } catch (error) {
                console.error('Failed to fetch attendees:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [seriesId]);

    const handleReanalyze = async (userId: string) => {
        try {
            await analyzeDropoutRisk(userId, seriesId);
            // Refresh data
            const data = await getSeriesAttendeesWithRisk(seriesId);
            setAttendees(data || []);
        } catch (error) {
            console.error('Reanalysis failed:', error);
        }
    };

    const handleSendIntervention = async () => {
        if (!selectedAttendee) return;
        await sendInterventionEmail(selectedAttendee.user_id, 'Coding Bootcamp Series', 'organizer@campusconnect.com');
        setSelectedAttendee(null);
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading attendee analytics...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Series Attendee Engagement
                    </h1>
                    <button
                        onClick={() => {
                            attendees.forEach(a => handleReanalyze(a.user_id));
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Refresh Risk Analysis
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Risk Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Avg Check-in Delta</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {attendees.map((attendee) => (
                                <tr key={attendee.user_id} className={attendee.risk_status === 'at_risk' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{attendee.profiles?.full_name || 'Unknown'}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{attendee.profiles?.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <DropoutRiskBadge
                                            riskStatus={attendee.risk_status}
                                            deltaTrend={attendee.delta_trend}
                                            avgDeltaMinutes={attendee.average_check_in_delta_minutes}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {attendee.average_check_in_delta_minutes > 0 ? '+' : ''}
                                        {attendee.average_check_in_delta_minutes.toFixed(1)} mins
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {attendee.risk_status === 'at_risk' && (
                                            <button
                                                onClick={() => setSelectedAttendee(attendee)}
                                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center space-x-1"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                <span>Send Intervention</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedAttendee && (
                <InterventionEmailModal
                    studentName={selectedAttendee.profiles?.full_name || 'Student'}
                    seriesName="Event Series"
                    onClose={() => setSelectedAttendee(null)}
                    onSend={handleSendIntervention}
                />
            )}
        </div>
    );
}
